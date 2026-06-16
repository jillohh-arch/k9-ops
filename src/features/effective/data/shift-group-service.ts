"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  type Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";

const MS_PER_DAY = 86_400_000;
const SHIFT_GROUPS_COLLECTION = "shift_groups";
const USER_SHIFT_ASSIGNMENTS_COLLECTION = "user_shift_assignments";

export type ShiftGroupType = "operational" | "administrative";
export type ShiftScheduleType = "two_by_two" | "weekdays" | "custom";

export type ShiftNotificationSettings = {
  endReminderEnabled: boolean;
  overdueAfterMinutes: number;
  overdueReminderEnabled: boolean;
  overdueRepeatMinutes: number;
  startLeadMinutes: number;
  startReminderEnabled: boolean;
};

export type ShiftGroup = {
  active: boolean;
  anchorDate: string | null;
  code: string;
  createdAt: Date;
  expectedEndHour: number;
  expectedStartHour: number;
  id: string;
  municipality: string;
  name: string;
  notes: string;
  notifications: ShiftNotificationSettings;
  scheduleType: ShiftScheduleType;
  type: ShiftGroupType;
  updatedAt: Date;
  workPattern: number[];
};

export type ShiftAssignment = {
  active: boolean;
  assignedAt: Date;
  endedAt: Date | null;
  id: string;
  shiftGroupId: string;
  shiftGroupLabel: string | null;
  userId: string;
};

export type ShiftGroupFormValues = {
  anchorDate: string | null;
  code: string;
  expectedEndHour: number;
  expectedStartHour: number;
  municipality: string;
  name: string;
  notes: string;
  notifications: ShiftNotificationSettings;
  scheduleType: ShiftScheduleType;
  type: ShiftGroupType;
  workPattern: number[];
};

export type ShiftWindow = {
  end: Date;
  group: ShiftGroup;
  start: Date;
};

export const defaultShiftNotifications: ShiftNotificationSettings = {
  endReminderEnabled: true,
  overdueAfterMinutes: 30,
  overdueReminderEnabled: true,
  overdueRepeatMinutes: 60,
  startLeadMinutes: 15,
  startReminderEnabled: true,
};

export const defaultTwoByTwoWorkPattern = [0, 1];

export async function getShiftGroup(id: string): Promise<ShiftGroup | null> {
  const docRef = doc(db, SHIFT_GROUPS_COLLECTION, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return parseShiftGroupDoc(snapshot.id, snapshot.data());
}

export async function getAllShiftGroups(): Promise<ShiftGroup[]> {
  const q = query(
    collection(db, SHIFT_GROUPS_COLLECTION),
    where("active", "==", true),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => parseShiftGroupDoc(item.id, item.data()));
}

export async function saveShiftGroup(
  values: ShiftGroupFormValues,
  id?: string,
): Promise<string> {
  const docId = id ?? doc(collection(db, SHIFT_GROUPS_COLLECTION)).id;
  const docRef = doc(db, SHIFT_GROUPS_COLLECTION, docId);
  const now = new Date();
  const workPattern = normalizeWorkPattern(values.workPattern);
  const anchorDate =
    values.scheduleType === "two_by_two" ? values.anchorDate : null;

  const data: Record<string, unknown> = {
    active: true,
    anchorDate,
    anchor_date: anchorDate,
    code: normalizeCode(values.code || values.name),
    end_time: hourToTime(values.expectedEndHour),
    expectedEndHour: clampHour(values.expectedEndHour),
    expectedStartHour: clampHour(values.expectedStartHour),
    municipality: values.municipality.trim().toLowerCase(),
    name: values.name.trim(),
    notes: values.notes.trim(),
    notifications: values.notifications,
    observations: values.notes.trim(),
    scheduleType: values.scheduleType,
    schedule_type: values.scheduleType,
    start_time: hourToTime(values.expectedStartHour),
    type: values.type,
    updatedAt: now,
    updated_at: now,
    workPattern,
    work_pattern: workPattern,
  };

  if (!id) {
    data.createdAt = now;
    data.created_at = now;
  }

  await setDoc(docRef, data, { merge: true });
  return docId;
}

export async function archiveShiftGroup(id: string): Promise<void> {
  const now = new Date();
  const docRef = doc(db, SHIFT_GROUPS_COLLECTION, id);
  await updateDoc(docRef, {
    active: false,
    archivedAt: now,
    archived_at: now,
    updatedAt: now,
    updated_at: now,
  });
}

export async function getUserShiftAssignment(
  userId: string,
): Promise<ShiftAssignment | null> {
  const q = query(
    collection(db, USER_SHIFT_ASSIGNMENTS_COLLECTION),
    where("userId", "==", userId),
    where("active", "==", true),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const item = snapshot.docs[0];
  return parseAssignmentDoc(item.id, item.data());
}

export async function getActiveShiftAssignments(): Promise<ShiftAssignment[]> {
  const q = query(
    collection(db, USER_SHIFT_ASSIGNMENTS_COLLECTION),
    where("active", "==", true),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => parseAssignmentDoc(item.id, item.data()));
}

export async function assignUserToShift(
  userId: string,
  shiftGroupId: string,
): Promise<string> {
  const existingQ = query(
    collection(db, USER_SHIFT_ASSIGNMENTS_COLLECTION),
    where("userId", "==", userId),
  );
  const existing = await getDocs(existingQ);
  const now = new Date();

  if (!existing.empty) {
    const batch = writeBatch(db);
    for (const item of existing.docs) {
      batch.update(item.ref, {
        active: false,
        endedAt: now,
        ended_at: now,
      });
    }
    await batch.commit();
  }

  const docRef = doc(collection(db, USER_SHIFT_ASSIGNMENTS_COLLECTION));
  await setDoc(docRef, {
    active: true,
    assignedAt: now,
    assigned_at: now,
    endedAt: null,
    ended_at: null,
    shiftGroupId,
    shiftGroupLabel: null,
    shift_group_id: shiftGroupId,
    shift_group_label: null,
    userId,
    user_id: userId,
    user_ra: userId,
  });
  return docRef.id;
}

export async function syncShiftGroupMembers(
  group: Pick<ShiftGroup, "code" | "id" | "name">,
  userIds: string[],
): Promise<void> {
  const selected = new Set(
    userIds.map((item) => item.trim()).filter((item) => item.length > 0),
  );
  const assignments = await getActiveShiftAssignments();
  const now = new Date();
  const batch = writeBatch(db);
  let operations = 0;

  for (const assignment of assignments) {
    const belongsToGroup = assignment.shiftGroupId === group.id;
    const userStillSelected = selected.has(assignment.userId);
    const selectedInAnotherGroup =
      userStillSelected && assignment.shiftGroupId !== group.id;

    if ((belongsToGroup && !userStillSelected) || selectedInAnotherGroup) {
      batch.update(doc(db, USER_SHIFT_ASSIGNMENTS_COLLECTION, assignment.id), {
        active: false,
        endedAt: now,
        ended_at: now,
        updatedAt: now,
        updated_at: now,
      });
      operations += 1;
    }
  }

  for (const userId of selected) {
    const alreadyInGroup = assignments.some(
      (assignment) =>
        assignment.active &&
        assignment.userId === userId &&
        assignment.shiftGroupId === group.id,
    );

    if (alreadyInGroup) continue;

    const docRef = doc(collection(db, USER_SHIFT_ASSIGNMENTS_COLLECTION));
    batch.set(docRef, {
      active: true,
      assignedAt: now,
      assigned_at: now,
      endedAt: null,
      ended_at: null,
      shiftGroupId: group.id,
      shiftGroupLabel: group.name,
      shift_group_code: group.code,
      shift_group_id: group.id,
      shift_group_label: group.name,
      userId,
      user_id: userId,
      user_ra: userId,
    });
    operations += 1;
  }

  if (operations > 0) {
    await batch.commit();
  }
}

export async function removeUserShiftAssignment(
  userId: string,
): Promise<void> {
  const q = query(
    collection(db, USER_SHIFT_ASSIGNMENTS_COLLECTION),
    where("userId", "==", userId),
    where("active", "==", true),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const now = new Date();
  const batch = writeBatch(db);
  for (const item of snapshot.docs) {
    batch.update(item.ref, {
      active: false,
      endedAt: now,
      ended_at: now,
    });
  }
  await batch.commit();
}

export async function getShiftGroupMembers(
  shiftGroupId: string,
): Promise<string[]> {
  const assignments = await getActiveShiftAssignments();
  return assignments
    .filter((assignment) => assignment.shiftGroupId === shiftGroupId)
    .map((assignment) => assignment.userId);
}

export async function getMembersCountByShiftGroup(): Promise<
  Record<string, number>
> {
  const q = query(
    collection(db, USER_SHIFT_ASSIGNMENTS_COLLECTION),
    where("active", "==", true),
  );
  const snapshot = await getDocs(q);
  const counts: Record<string, number> = {};
  for (const item of snapshot.docs) {
    const shiftGroupId = stringValue(
      item.data().shiftGroupId,
      item.data().shift_group_id,
    );
    if (!shiftGroupId) continue;
    counts[shiftGroupId] = (counts[shiftGroupId] ?? 0) + 1;
  }
  return counts;
}

export function subscribeShiftGroups(
  callback: (groups: ShiftGroup[]) => void,
): () => void {
  const q = query(
    collection(db, SHIFT_GROUPS_COLLECTION),
    where("active", "==", true),
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((item) => parseShiftGroupDoc(item.id, item.data())),
    );
  });
}

export function subscribeShiftAssignments(
  callback: (assignments: ShiftAssignment[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, USER_SHIFT_ASSIGNMENTS_COLLECTION),
    where("active", "==", true),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      callback(
        snapshot.docs.map((item) => parseAssignmentDoc(item.id, item.data())),
      );
    },
    onError,
  );
}

export function expectedShiftWindowAt(
  group: ShiftGroup,
  moment = new Date(),
): ShiftWindow | null {
  const today = expectedShiftWindowForDate(group, moment);
  if (today && moment >= today.start && moment < today.end) return today;

  const previousDate = new Date(moment);
  previousDate.setDate(previousDate.getDate() - 1);
  const previous = expectedShiftWindowForDate(group, previousDate);
  if (previous && moment >= previous.start && moment < previous.end) {
    return previous;
  }

  return null;
}

export function expectedShiftWindowForDate(
  group: ShiftGroup,
  date = new Date(),
): ShiftWindow | null {
  if (!isShiftWorkDay(group, date)) return null;

  const day = startOfLocalDay(date);
  const start = new Date(day);
  start.setHours(group.expectedStartHour, 0, 0, 0);

  const end = new Date(day);
  end.setHours(group.expectedEndHour, 0, 0, 0);
  if (isOvernightShift(group)) {
    end.setDate(end.getDate() + 1);
  }

  return { end, group, start };
}

export function formatShiftWindow(window: ShiftWindow | null) {
  if (!window) return "Sem previsão";

  const day = window.start.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  const start = timeLabel(window.start);
  const end = timeLabel(window.end);
  const overnight =
    window.start.toDateString() === window.end.toDateString() ? "" : " (+1 dia)";

  return `${day} · ${start} às ${end}${overnight}`;
}

export function isOvernightShift(
  group: Pick<ShiftGroup, "expectedEndHour" | "expectedStartHour">,
) {
  return group.expectedStartHour >= group.expectedEndHour;
}

export function isShiftWorkDay(group: ShiftGroup, date = new Date()) {
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
      (startOfLocalDay(date).getTime() - anchor.getTime()) / MS_PER_DAY,
    );
    const cycleIndex = ((diff % 4) + 4) % 4;
    return group.workPattern.includes(cycleIndex);
  }

  return false;
}

export function nextShiftWindow(group: ShiftGroup, from = new Date()) {
  for (let offset = 0; offset <= 60; offset += 1) {
    const candidateDate = new Date(from);
    candidateDate.setDate(candidateDate.getDate() + offset);
    const window = expectedShiftWindowForDate(group, candidateDate);
    if (window && window.end > from) return window;
  }
  return null;
}

function booleanValue(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "sim", "yes", "active"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "nao", "não", "no", "inactive"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function clampHour(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(23, Math.trunc(value)));
}

function dateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function hourFromTime(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):/.exec(value.trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function hourToTime(hour: number) {
  return `${String(clampHour(hour)).padStart(2, "0")}:00`;
}

function normalizeCode(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function normalizeWorkPattern(value: unknown): number[] {
  const raw = Array.isArray(value) ? value : defaultTwoByTwoWorkPattern;
  const normalized = raw
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 3);

  return normalized.length
    ? Array.from(new Set(normalized))
    : defaultTwoByTwoWorkPattern;
}

function numberValue(...valuesAndFallback: unknown[]) {
  const fallback = Number(valuesAndFallback.at(-1) ?? 0);
  for (const value of valuesAndFallback.slice(0, -1)) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function parseAssignmentDoc(
  id: string,
  data: Record<string, unknown>,
): ShiftAssignment {
  return {
    active: booleanValue(data.active, true),
    assignedAt: parseDate(data.assignedAt ?? data.assigned_at),
    endedAt: parseNullableDate(data.endedAt ?? data.ended_at),
    id,
    shiftGroupId: stringValue(data.shiftGroupId, data.shift_group_id) ?? "",
    shiftGroupLabel:
      stringValue(data.shiftGroupLabel, data.shift_group_label, data.shiftLabel) ??
      null,
    userId: stringValue(data.userId, data.user_id, data.user_ra, data.ra) ?? "",
  };
}

function parseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : new Date();
    }
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  return new Date();
}

function parseGroupType(value: unknown): ShiftGroupType {
  return value === "administrative" ? "administrative" : "operational";
}

function parseNotifications(value: unknown): ShiftNotificationSettings {
  if (!value || typeof value !== "object") return defaultShiftNotifications;
  const data = value as Record<string, unknown>;
  return {
    endReminderEnabled: booleanValue(
      data.endReminderEnabled ?? data.end_reminder_enabled,
      true,
    ),
    overdueAfterMinutes: numberValue(
      data.overdueAfterMinutes,
      data.overdue_after_minutes,
      30,
    ),
    overdueReminderEnabled: booleanValue(
      data.overdueReminderEnabled ?? data.overdue_reminder_enabled,
      true,
    ),
    overdueRepeatMinutes: numberValue(
      data.overdueRepeatMinutes,
      data.overdue_repeat_minutes,
      60,
    ),
    startLeadMinutes: numberValue(
      data.startLeadMinutes,
      data.start_lead_minutes,
      15,
    ),
    startReminderEnabled: booleanValue(
      data.startReminderEnabled ?? data.start_reminder_enabled,
      true,
    ),
  };
}

function parseNullableDate(value: unknown): Date | null {
  if (value == null) return null;
  return parseDate(value);
}

function parseScheduleType(
  value: unknown,
  groupType: unknown,
): ShiftScheduleType {
  if (value === "two_by_two" || value === "weekdays" || value === "custom") {
    return value;
  }
  return groupType === "administrative" ? "weekdays" : "two_by_two";
}

function parseShiftGroupDoc(
  id: string,
  data: Record<string, unknown>,
): ShiftGroup {
  const expectedStartHour = numberValue(
    data.expectedStartHour,
    data.expected_start_hour,
    hourFromTime(data.start_time),
    7,
  );
  const expectedEndHour = numberValue(
    data.expectedEndHour,
    data.expected_end_hour,
    hourFromTime(data.end_time),
    19,
  );

  return {
    active: booleanValue(data.active, true),
    anchorDate: stringValue(data.anchorDate, data.anchor_date),
    code: stringValue(data.code, data.codigo) ?? normalizeCode(String(data.name ?? id)),
    createdAt: parseDate(data.createdAt ?? data.created_at),
    expectedEndHour,
    expectedStartHour,
    id,
    municipality: stringValue(data.municipality, data.municipio) ?? "",
    name: stringValue(data.name) ?? "",
    notes: stringValue(data.notes, data.observations, data.observacoes) ?? "",
    notifications: parseNotifications(data.notifications),
    scheduleType: parseScheduleType(data.scheduleType ?? data.schedule_type, data.type),
    type: parseGroupType(data.type),
    updatedAt: parseDate(data.updatedAt ?? data.updated_at),
    workPattern: normalizeWorkPattern(data.workPattern ?? data.work_pattern),
  };
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return null;
}

function timeLabel(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
