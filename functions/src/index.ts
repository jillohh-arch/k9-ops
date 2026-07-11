import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ShiftNotificationSettings {
  endReminderEnabled: boolean;
  overdueAfterMinutes: number;
  overdueReminderEnabled: boolean;
  overdueRepeatMinutes: number;
  startLeadMinutes: number;
  startReminderEnabled: boolean;
}

interface ShiftGroup {
  active: boolean;
  anchorDate: string | null;
  code: string;
  expectedEndHour: number;
  expectedStartHour: number;
  name: string;
  notifications: ShiftNotificationSettings;
  scheduleType: "two_by_two" | "weekdays" | "custom";
  type: "operational" | "administrative";
  workPattern: number[];
}

interface ShiftAssignment {
  active: boolean;
  shiftGroupId: string;
  userId: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function isShiftWorkDay(group: ShiftGroup, date: Date): boolean {
  if (!group.active) return false;

  if (group.scheduleType === "weekdays") {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  }

  if (group.scheduleType === "two_by_two") {
    if (!group.anchorDate) return false;
    const anchor = dateOnly(group.anchorDate);
    if (!anchor) return false;
    const diff = Math.floor(
      (startOfLocalDay(date).getTime() - anchor.getTime()) / MS_PER_DAY
    );
    const cycleIndex = ((diff % 4) + 4) % 4;
    return group.workPattern.includes(cycleIndex);
  }

  return false;
}

function isOvernightShift(group: ShiftGroup): boolean {
  return group.expectedStartHour >= group.expectedEndHour;
}

function shiftStartTime(group: ShiftGroup, date: Date): Date {
  const d = startOfLocalDay(date);
  d.setHours(group.expectedStartHour, 0, 0, 0);
  return d;
}

function shiftEndTime(group: ShiftGroup, date: Date): Date {
  const d = startOfLocalDay(date);
  d.setHours(group.expectedEndHour, 0, 0, 0);
  if (isOvernightShift(group)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

async function getUserFcmTokens(userIds: string[]): Promise<Map<string, string[]>> {
  const tokenMap = new Map<string, string[]>();
  if (userIds.length === 0) return tokenMap;

  // Batch in groups of 30 (Firestore "in" limit)
  const batches: string[][] = [];
  for (let i = 0; i < userIds.length; i += 30) {
    batches.push(userIds.slice(i, i + 30));
  }

  for (const batch of batches) {
    const snapshot = await db
      .collection("user_fcm_tokens")
      .where("userId", "in", batch)
      .where("active", "==", true)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const userId = data.userId as string;
      const token = data.token as string;
      if (!userId || !token) continue;

      const existing = tokenMap.get(userId) ?? [];
      existing.push(token);
      tokenMap.set(userId, existing);
    }
  }

  return tokenMap;
}

async function sendShiftNotification(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>
): Promise<number> {
  if (tokens.length === 0) return 0;

  const message = {
    notification: { title, body },
    data,
    tokens,
  };

  const response = await messaging.sendEachForMulticast(message);

  // Clean up invalid tokens
  const invalidTokens: string[] = [];
  response.responses.forEach((resp, idx) => {
    if (
      resp.error &&
      (resp.error.code === "messaging/invalid-registration-token" ||
        resp.error.code === "messaging/registration-token-not-registered")
    ) {
      invalidTokens.push(tokens[idx]);
    }
  });

  if (invalidTokens.length > 0) {
    const batch = db.batch();
    for (const token of invalidTokens) {
      const snapshot = await db
        .collection("user_fcm_tokens")
        .where("token", "==", token)
        .get();
      for (const doc of snapshot.docs) {
        batch.update(doc.ref, { active: false });
      }
    }
    await batch.commit();
    logger.info(`Cleaned up ${invalidTokens.length} invalid FCM tokens`);
  }

  return response.successCount;
}

async function createNotificationRecord(
  userId: string,
  type: string,
  title: string,
  body: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await db.collection("notifications").add({
    userId,
    type,
    title,
    body,
    metadata,
    read: false,
    resolved: false,
    action_required: true,
    created_at: new Date(),
  });
}

async function hasRecentNotification(
  userId: string,
  type: string,
  shiftGroupId: string,
  withinMinutes: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinMinutes * 60_000);
  const snapshot = await db
    .collection("notifications")
    .where("userId", "==", userId)
    .where("type", "==", type)
    .where("metadata.shiftGroupId", "==", shiftGroupId)
    .where("created_at", ">=", cutoff)
    .limit(1)
    .get();

  return !snapshot.empty;
}

// ─── decidePromotionRequest ────────────────────────────────────────────────────

interface DecidePromotionPayload {
  requestId: string;
  decision: "approved" | "rejected";
  reason?: string;
  note?: string;
}

export const decidePromotionRequest = onCall(
  { region: "southamerica-east1", memory: "256MiB", timeoutSeconds: 30 },
  async (request) => {
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError("unauthenticated", "Autenticação necessária.");
    }

    const { requestId, decision, reason, note } = request.data as DecidePromotionPayload;

    if (!requestId || typeof requestId !== "string") {
      throw new HttpsError("invalid-argument", "requestId é obrigatório.");
    }
    if (!decision || !["approved", "rejected"].includes(decision)) {
      throw new HttpsError("invalid-argument", "decision deve ser 'approved' ou 'rejected'.");
    }
    if (decision === "rejected" && (!reason || reason.trim().length < 3)) {
      throw new HttpsError("invalid-argument", "Justificativa obrigatória para rejeição (mínimo 3 caracteres).");
    }

    const uid = auth.uid;
    let deciderName = "Usuário";
    try {
      const userAuth = getAuth();
      const userRecord = await userAuth.getUser(uid);
      deciderName = userRecord.displayName ?? userRecord.email ?? "Usuário";
    } catch {
      logger.warn("Could not resolve display name for UID", { uid });
    }

    const docRef = db.collection("promotion_requests").doc(requestId);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) {
        throw new HttpsError("not-found", "Solicitação não encontrada.");
      }

      const data = snap.data()!;
      if (data.status !== "pending") {
        throw new HttpsError(
          "failed-precondition",
          "Esta solicitação já foi analisada."
        );
      }

      const now = new Date();
      const decisionReason = decision === "rejected" ? reason?.trim() : (note?.trim() || reason?.trim() || null);

      const update: Record<string, unknown> = {
        status: decision,
        decision,
        decision_by: deciderName,
        decision_uid: uid,
        decision_reason: decisionReason || null,
        decided_at: now,
        updated_at: now,
      };

      if (decision === "approved") {
        update.approved_by = deciderName;
      } else {
        update.rejected_by = deciderName;
        update.rejection_reason = reason?.trim() || null;
      }

      const auditEntry = {
        action: decision === "approved" ? "evolution_approved" : "request_rejected",
        at: now,
        by: deciderName,
        by_uid: uid,
        note: decisionReason || undefined,
      };

      update.audit_trail = FieldValue.arrayUnion(auditEntry);

      tx.update(docRef, update as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);

      return { id: requestId, status: decision };
    });

    logger.info("Promotion request decided", {
      requestId,
      decision,
      by: uid,
    });

    return result;
  }
);

// ─── Scheduler ─────────────────────────────────────────────────────────────────

export const shiftReminders = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "southamerica-east1",
    timeZone: "America/Sao_Paulo",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const now = new Date();
    logger.info("Shift reminders scanner started", { timestamp: now.toISOString() });

    // 1. Load active shift groups
    const groupsSnapshot = await db
      .collection("shift_groups")
      .where("active", "==", true)
      .get();

    if (groupsSnapshot.empty) {
      logger.info("No active shift groups found");
      return;
    }

    const groups: (ShiftGroup & { id: string })[] = groupsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as ShiftGroup),
    }));

    // 2. Load active assignments
    const assignmentsSnapshot = await db
      .collection("user_shift_assignments")
      .where("active", "==", true)
      .get();

    const assignments: ShiftAssignment[] = assignmentsSnapshot.docs.map(
      (doc) => doc.data() as ShiftAssignment
    );

    // 3. Build map: groupId -> userIds
    const groupMembers = new Map<string, string[]>();
    for (const assignment of assignments) {
      const existing = groupMembers.get(assignment.shiftGroupId) ?? [];
      existing.push(assignment.userId);
      groupMembers.set(assignment.shiftGroupId, existing);
    }

    // 4. Collect all user IDs and fetch FCM tokens
    const allUserIds = [...new Set(assignments.map((a) => a.userId))];
    const tokenMap = await getUserFcmTokens(allUserIds);

    let totalSent = 0;

    // 5. Process each group
    for (const group of groups) {
      const today = now;
      if (!isShiftWorkDay(group, today)) continue;

      const members = groupMembers.get(group.id) ?? [];
      if (members.length === 0) continue;

      const shiftStart = shiftStartTime(group, today);
      const shiftEnd = shiftEndTime(group, today);
      const notifications = group.notifications;
      const minutesUntilStart = (shiftStart.getTime() - now.getTime()) / 60_000;
      const minutesSinceEnd = (now.getTime() - shiftEnd.getTime()) / 60_000;

      // ── Start reminder ──
      if (
        notifications.startReminderEnabled &&
        minutesUntilStart > 0 &&
        minutesUntilStart <= notifications.startLeadMinutes
      ) {
        for (const userId of members) {
          const alreadySent = await hasRecentNotification(
            userId,
            "shift_start_reminder",
            group.id,
            notifications.startLeadMinutes
          );
          if (alreadySent) continue;

          const tokens = tokenMap.get(userId) ?? [];
          const title = "Plantao iniciando em breve";
          const body = `${group.name} inicia as ${String(group.expectedStartHour).padStart(2, "0")}h. Prepare-se para assumir o turno.`;

          const sent = await sendShiftNotification(tokens, title, body, {
            type: "shift_start_reminder",
            shiftGroupId: group.id,
            shiftGroupName: group.name,
            action: "assume_shift",
          });

          await createNotificationRecord(userId, "shift_start_reminder", title, body, {
            shiftGroupId: group.id,
            shiftGroupName: group.name,
            shiftStart: shiftStart.toISOString(),
          });

          totalSent += sent;
        }
      }

      // ── End reminder ──
      if (
        notifications.endReminderEnabled &&
        minutesSinceEnd >= -5 &&
        minutesSinceEnd <= 5
      ) {
        for (const userId of members) {
          const alreadySent = await hasRecentNotification(
            userId,
            "shift_end_reminder",
            group.id,
            30
          );
          if (alreadySent) continue;

          const tokens = tokenMap.get(userId) ?? [];
          const title = "Turno encerrando";
          const body = `${group.name} encerra as ${String(group.expectedEndHour).padStart(2, "0")}h. Finalize seu turno.`;

          const sent = await sendShiftNotification(tokens, title, body, {
            type: "shift_end_reminder",
            shiftGroupId: group.id,
            shiftGroupName: group.name,
            action: "end_shift",
          });

          await createNotificationRecord(userId, "shift_end_reminder", title, body, {
            shiftGroupId: group.id,
            shiftGroupName: group.name,
            shiftEnd: shiftEnd.toISOString(),
          });

          totalSent += sent;
        }
      }

      // ── Overdue reminder ──
      if (
        notifications.overdueReminderEnabled &&
        minutesSinceEnd >= notifications.overdueAfterMinutes
      ) {
        // Check if shift is still open (no one ended it)
        const activeShiftSnapshot = await db
          .collection("active_shifts")
          .where("shiftGroupId", "==", group.id)
          .where("status", "in", ["active", "ativo", "em_andamento"])
          .limit(1)
          .get();

        if (!activeShiftSnapshot.empty) {
          for (const userId of members) {
            const alreadySent = await hasRecentNotification(
              userId,
              "shift_overdue",
              group.id,
              notifications.overdueRepeatMinutes
            );
            if (alreadySent) continue;

            const tokens = tokenMap.get(userId) ?? [];
            const overdueMinutes = Math.round(minutesSinceEnd);
            const title = "Turno em atraso";
            const body = `${group.name} deveria ter encerrado há ${overdueMinutes} minutos. Finalize ou registre a justificativa.`;

            const sent = await sendShiftNotification(tokens, title, body, {
              type: "shift_overdue",
              shiftGroupId: group.id,
              shiftGroupName: group.name,
              action: "end_shift",
            });

            await createNotificationRecord(userId, "shift_overdue", title, body, {
              shiftGroupId: group.id,
              shiftGroupName: group.name,
              shiftEnd: shiftEnd.toISOString(),
              overdueMinutes: overdueMinutes.toString(),
            });

            totalSent += sent;
          }
        }
      }
    }

    logger.info("Shift reminders scanner finished", {
      groupsProcessed: groups.length,
      totalNotificationsSent: totalSent,
    });
  }
);