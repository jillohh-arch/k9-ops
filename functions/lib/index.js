"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shiftReminders = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const messaging = (0, messaging_1.getMessaging)();
// ─── Helpers ───────────────────────────────────────────────────────────────────
const MS_PER_DAY = 86_400_000;
function startOfLocalDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
function dateOnly(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match)
        return null;
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
}
function isShiftWorkDay(group, date) {
    if (!group.active)
        return false;
    if (group.scheduleType === "weekdays") {
        const day = date.getDay();
        return day >= 1 && day <= 5;
    }
    if (group.scheduleType === "two_by_two") {
        if (!group.anchorDate)
            return false;
        const anchor = dateOnly(group.anchorDate);
        if (!anchor)
            return false;
        const diff = Math.floor((startOfLocalDay(date).getTime() - anchor.getTime()) / MS_PER_DAY);
        const cycleIndex = ((diff % 4) + 4) % 4;
        return group.workPattern.includes(cycleIndex);
    }
    return false;
}
function isOvernightShift(group) {
    return group.expectedStartHour >= group.expectedEndHour;
}
function shiftStartTime(group, date) {
    const d = startOfLocalDay(date);
    d.setHours(group.expectedStartHour, 0, 0, 0);
    return d;
}
function shiftEndTime(group, date) {
    const d = startOfLocalDay(date);
    d.setHours(group.expectedEndHour, 0, 0, 0);
    if (isOvernightShift(group)) {
        d.setDate(d.getDate() + 1);
    }
    return d;
}
async function getUserFcmTokens(userIds) {
    const tokenMap = new Map();
    if (userIds.length === 0)
        return tokenMap;
    // Batch in groups of 30 (Firestore "in" limit)
    const batches = [];
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
            const userId = data.userId;
            const token = data.token;
            if (!userId || !token)
                continue;
            const existing = tokenMap.get(userId) ?? [];
            existing.push(token);
            tokenMap.set(userId, existing);
        }
    }
    return tokenMap;
}
async function sendShiftNotification(tokens, title, body, data) {
    if (tokens.length === 0)
        return 0;
    const message = {
        notification: { title, body },
        data,
        tokens,
    };
    const response = await messaging.sendEachForMulticast(message);
    // Clean up invalid tokens
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
        if (resp.error &&
            (resp.error.code === "messaging/invalid-registration-token" ||
                resp.error.code === "messaging/registration-token-not-registered")) {
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
        v2_1.logger.info(`Cleaned up ${invalidTokens.length} invalid FCM tokens`);
    }
    return response.successCount;
}
async function createNotificationRecord(userId, type, title, body, metadata) {
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
async function hasRecentNotification(userId, type, shiftGroupId, withinMinutes) {
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
// ─── Scheduler ─────────────────────────────────────────────────────────────────
exports.shiftReminders = (0, scheduler_1.onSchedule)({
    schedule: "every 5 minutes",
    region: "southamerica-east1",
    timeZone: "America/Sao_Paulo",
    memory: "256MiB",
    timeoutSeconds: 120,
}, async () => {
    const now = new Date();
    v2_1.logger.info("Shift reminders scanner started", { timestamp: now.toISOString() });
    // 1. Load active shift groups
    const groupsSnapshot = await db
        .collection("shift_groups")
        .where("active", "==", true)
        .get();
    if (groupsSnapshot.empty) {
        v2_1.logger.info("No active shift groups found");
        return;
    }
    const groups = groupsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));
    // 2. Load active assignments
    const assignmentsSnapshot = await db
        .collection("user_shift_assignments")
        .where("active", "==", true)
        .get();
    const assignments = assignmentsSnapshot.docs.map((doc) => doc.data());
    // 3. Build map: groupId -> userIds
    const groupMembers = new Map();
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
        if (!isShiftWorkDay(group, today))
            continue;
        const members = groupMembers.get(group.id) ?? [];
        if (members.length === 0)
            continue;
        const shiftStart = shiftStartTime(group, today);
        const shiftEnd = shiftEndTime(group, today);
        const notifications = group.notifications;
        const minutesUntilStart = (shiftStart.getTime() - now.getTime()) / 60_000;
        const minutesSinceEnd = (now.getTime() - shiftEnd.getTime()) / 60_000;
        // ── Start reminder ──
        if (notifications.startReminderEnabled &&
            minutesUntilStart > 0 &&
            minutesUntilStart <= notifications.startLeadMinutes) {
            for (const userId of members) {
                const alreadySent = await hasRecentNotification(userId, "shift_start_reminder", group.id, notifications.startLeadMinutes);
                if (alreadySent)
                    continue;
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
        if (notifications.endReminderEnabled &&
            minutesSinceEnd >= -5 &&
            minutesSinceEnd <= 5) {
            for (const userId of members) {
                const alreadySent = await hasRecentNotification(userId, "shift_end_reminder", group.id, 30);
                if (alreadySent)
                    continue;
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
        if (notifications.overdueReminderEnabled &&
            minutesSinceEnd >= notifications.overdueAfterMinutes) {
            // Check if shift is still open (no one ended it)
            const activeShiftSnapshot = await db
                .collection("active_shifts")
                .where("shiftGroupId", "==", group.id)
                .where("status", "in", ["active", "ativo", "em_andamento"])
                .limit(1)
                .get();
            if (!activeShiftSnapshot.empty) {
                for (const userId of members) {
                    const alreadySent = await hasRecentNotification(userId, "shift_overdue", group.id, notifications.overdueRepeatMinutes);
                    if (alreadySent)
                        continue;
                    const tokens = tokenMap.get(userId) ?? [];
                    const overdueMinutes = Math.round(minutesSinceEnd);
                    const title = "Turno em atraso";
                    const body = `${group.name} deveria ter encerrado ha ${overdueMinutes} minutos. Finalize ou registre a justificativa.`;
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
    v2_1.logger.info("Shift reminders scanner finished", {
        groupsProcessed: groups.length,
        totalNotificationsSent: totalSent,
    });
});
//# sourceMappingURL=index.js.map