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
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShiftGroup = {
  id: string;
  name: string;
  type: "operational" | "administrative";
  expectedStartHour: number;
  expectedEndHour: number;
  municipality: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ShiftAssignment = {
  id: string;
  userId: string;
  shiftGroupId: string;
  rotationOffset: number;
  active: boolean;
  assignedAt: Date;
};

export type ShiftGroupFormValues = {
  name: string;
  type: "operational" | "administrative";
  expectedStartHour: number;
  expectedEndHour: number;
  municipality: string;
};

// ─── Collections ───────────────────────────────────────────────────────────────

const SHIFT_GROUPS_COLLECTION = "shift_groups";
const USER_SHIFT_ASSIGNMENTS_COLLECTION = "user_shift_assignments";

// ─── Shift Groups CRUD ────────────────────────────────────────────────────────

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
  return snapshot.docs.map((d) => parseShiftGroupDoc(d.id, d.data()));
}

export async function saveShiftGroup(
  values: ShiftGroupFormValues,
  id?: string,
): Promise<string> {
  const docId = id ?? doc(collection(db, SHIFT_GROUPS_COLLECTION)).id;
  const docRef = doc(db, SHIFT_GROUPS_COLLECTION, docId);

  const now = new Date();
  const data: Record<string, unknown> = {
    name: values.name.trim(),
    type: values.type,
    expectedStartHour: values.expectedStartHour,
    expectedEndHour: values.expectedEndHour,
    municipality: values.municipality.trim().toLowerCase(),
    active: true,
    updatedAt: now,
  };

  if (!id) {
    data.createdAt = now;
  }

  await setDoc(docRef, data, { merge: true });
  return docId;
}

export async function archiveShiftGroup(id: string): Promise<void> {
  const docRef = doc(db, SHIFT_GROUPS_COLLECTION, id);
  await updateDoc(docRef, {
    active: false,
    updatedAt: new Date(),
  });
}

// ─── User Shift Assignments ─────────────────────────────────────────────────

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
  const d = snapshot.docs[0];
  return parseAssignmentDoc(d.id, d.data());
}

export async function assignUserToShift(
  userId: string,
  shiftGroupId: string,
  rotationOffset: number = 0,
): Promise<string> {
  // First, deactivate any existing assignment
  const existingQ = query(
    collection(db, USER_SHIFT_ASSIGNMENTS_COLLECTION),
    where("userId", "==", userId),
  );
  const existing = await getDocs(existingQ);

  if (!existing.empty) {
    const batch = writeBatch(db);
    for (const d of existing.docs) {
      batch.update(d.ref, { active: false });
    }
    await batch.commit();
  }

  // Create new assignment
  const docRef = doc(collection(db, USER_SHIFT_ASSIGNMENTS_COLLECTION));
  await setDoc(docRef, {
    userId,
    shiftGroupId,
    rotationOffset,
    active: true,
    assignedAt: new Date(),
  });
  return docRef.id;
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

  const batch = writeBatch(db);
  for (const d of snapshot.docs) {
    batch.update(d.ref, { active: false });
  }
  await batch.commit();
}

export async function getShiftGroupMembers(
  shiftGroupId: string,
): Promise<string[]> {
  const q = query(
    collection(db, USER_SHIFT_ASSIGNMENTS_COLLECTION),
    where("shiftGroupId", "==", shiftGroupId),
    where("active", "==", true),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data().userId as string);
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
  for (const d of snapshot.docs) {
    const shiftGroupId = d.data().shiftGroupId as string;
    counts[shiftGroupId] = (counts[shiftGroupId] ?? 0) + 1;
  }
  return counts;
}

// ─── Real-time Subscriptions ────────────────────────────────────────────────

export function subscribeShiftGroups(
  callback: (groups: ShiftGroup[]) => void,
): () => void {
  const q = query(
    collection(db, SHIFT_GROUPS_COLLECTION),
    where("active", "==", true),
  );
  return onSnapshot(q, (snapshot) => {
    const groups = snapshot.docs.map((d) =>
      parseShiftGroupDoc(d.id, d.data()),
    );
    callback(groups);
  });
}

// ─── Parsers ────────────────────────────────────────────────────────────────

function parseShiftGroupDoc(
  id: string,
  data: Record<string, unknown>,
): ShiftGroup {
  return {
    id,
    name: (data.name as string) ?? "",
    type: (data.type as "operational" | "administrative") ?? "operational",
    expectedStartHour: (data.expectedStartHour as number) ?? 7,
    expectedEndHour: (data.expectedEndHour as number) ?? 19,
    municipality: (data.municipality as string) ?? "",
    active: (data.active as boolean) ?? true,
    createdAt: parseDate(data.createdAt),
    updatedAt: parseDate(data.updatedAt),
  };
}

function parseAssignmentDoc(
  id: string,
  data: Record<string, unknown>,
): ShiftAssignment {
  return {
    id,
    userId: (data.userId as string) ?? "",
    shiftGroupId: (data.shiftGroupId as string) ?? "",
    rotationOffset: (data.rotationOffset as number) ?? 0,
    active: (data.active as boolean) ?? true,
    assignedAt: parseDate(data.assignedAt),
  };
}

function parseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const ts = value as { toDate: () => Date };
    return ts.toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date();
}
