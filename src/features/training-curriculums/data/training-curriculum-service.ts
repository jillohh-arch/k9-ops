"use client";

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  setDoc,
  type DocumentData,
} from "firebase/firestore";

import type { AuthProfile } from "@/features/auth/providers/auth-provider";
import { canônicalModality } from "@/features/effective/lib/k9-modalities";
import { db } from "@/lib/firebase/client";

export type CurriculumAuditAction =
  | "create_milestone"
  | "create_module"
  | "create_program"
  | "update_milestone"
  | "update_module"
  | "update_program";

export type PromotionCriteriaInput = {
  instructorApprovalRequired: boolean;
  maxAverageDurationS: string;
  minDistanceM: string;
  minSessions: string;
  minSuccessRate: string;
  notes: string;
  requiredEvents: string;
};

export type ProgramInput = {
  active: boolean;
  description: string;
  modality: string;
  name: string;
};

export type ModuleInput = {
  description: string;
  order: string;
  title: string;
  criteria: PromotionCriteriaInput;
};

export type MilestoneInput = {
  description: string;
  order: string;
  required: boolean;
  title: string;
};

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replaceAll("&", " e ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function nullableNumber(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function requiredNumber(value: string, fallback: number) {
  return nullableNumber(value) ?? fallback;
}

function eventList(value: string) {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function auditEntry(action: CurriculumAuditAction, profile: AuthProfile | null) {
  return {
    action,
    at: Timestamp.now(),
    by_name: profile?.displayName ?? profile?.email ?? "web",
    by_ra: profile?.ra ?? null,
    by_uid: profile?.uid ?? null,
    source: "k9_ops_web",
  };
}

function appendAudit(data: DocumentData, entry: DocumentData) {
  const previous = Array.isArray(data.audit_trail) ? data.audit_trail : [];
  return [...previous, entry];
}

function programPayload(input: ProgramInput) {
  const modality = canônicalModality(input.modality || input.name);
  return {
    active: input.active,
    description: input.description.trim(),
    label: input.name.trim(),
    modality,
    name: input.name.trim(),
    updated_at: Timestamp.now(),
  };
}

function criteriaPayload(input: PromotionCriteriaInput) {
  return {
    instructor_approval_required: input.instructorApprovalRequired,
    max_average_duration_s: nullableNumber(input.maxAverageDurationS),
    min_distance_m: nullableNumber(input.minDistanceM),
    min_sessions: requiredNumber(input.minSessions, 0),
    min_success_rate: nullableNumber(input.minSuccessRate),
    notes: input.notes.trim(),
    required_events: eventList(input.requiredEvents),
  };
}

function modulePayload(input: ModuleInput) {
  return {
    description: input.description.trim(),
    order: requiredNumber(input.order, 0),
    promotion_criteria: criteriaPayload(input.criteria),
    title: input.title.trim(),
    updated_at: Timestamp.now(),
  };
}

function milestonePayload(input: MilestoneInput) {
  return {
    description: input.description.trim(),
    label: input.title.trim(),
    order: requiredNumber(input.order, 0),
    required: input.required,
    title: input.title.trim(),
    updated_at: Timestamp.now(),
  };
}

export async function createTrainingProgram(
  input: ProgramInput,
  profile: AuthProfile | null,
) {
  const modality = canônicalModality(input.modality || input.name);
  const id = slug(modality || input.name);
  if (!id) throw new Error("Informe uma modalidade valida.");
  const ref = doc(db, "training_programs", id);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    throw new Error("Já existe um currículo com esse identificador.");
  }

  const entry = auditEntry("create_program", profile);
  await setDoc(ref, {
    ...programPayload(input),
    version: 1,
    created_at: Timestamp.now(),
    audit_trail: [entry],
  });

  return id;
}

export async function updateTrainingProgram(
  programId: string,
  input: ProgramInput,
  profile: AuthProfile | null,
) {
  const ref = doc(db, "training_programs", programId);
  const entry = auditEntry("update_program", profile);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Currículo não encontrado.");
    transaction.update(ref, {
      ...programPayload(input),
      audit_trail: appendAudit(snapshot.data(), entry),
    });
  });
}

export async function createTrainingModule(
  programId: string,
  input: ModuleInput,
  profile: AuthProfile | null,
) {
  const programRef = doc(db, "training_programs", programId);
  const modulesRef = collection(db, "training_programs", programId, "modules");
  const entry = auditEntry("create_module", profile);

  await runTransaction(db, async (transaction) => {
    const programSnap = await transaction.get(programRef);
    if (!programSnap.exists()) throw new Error("Programa não encontrado.");

    const moduleRef = doc(modulesRef);
    transaction.set(moduleRef, {
      ...modulePayload(input),
      created_at: Timestamp.now(),
      audit_trail: [entry],
    });

    transaction.update(programRef, {
      version: increment(1),
      updated_at: Timestamp.now(),
    });
  });
}

export async function updateTrainingModule(
  programId: string,
  moduleId: string,
  input: ModuleInput,
  profile: AuthProfile | null,
) {
  const programRef = doc(db, "training_programs", programId);
  const moduleRef = doc(db, "training_programs", programId, "modules", moduleId);
  const entry = auditEntry("update_module", profile);

  await runTransaction(db, async (transaction) => {
    const [programSnap, moduleSnap] = await Promise.all([
      transaction.get(programRef),
      transaction.get(moduleRef),
    ]);
    if (!programSnap.exists()) throw new Error("Programa não encontrado.");
    if (!moduleSnap.exists()) throw new Error("Módulo não encontrado.");

    transaction.update(moduleRef, {
      ...modulePayload(input),
      audit_trail: appendAudit(moduleSnap.data(), entry),
    });

    transaction.update(programRef, {
      version: increment(1),
      updated_at: Timestamp.now(),
    });
  });
}

export async function createTrainingMilestone(
  programId: string,
  moduleId: string,
  input: MilestoneInput,
  profile: AuthProfile | null,
) {
  const programRef = doc(db, "training_programs", programId);
  const milestonesRef = collection(
    db,
    "training_programs",
    programId,
    "modules",
    moduleId,
    "milestones",
  );
  const entry = auditEntry("create_milestone", profile);

  await runTransaction(db, async (transaction) => {
    const programSnap = await transaction.get(programRef);
    if (!programSnap.exists()) throw new Error("Programa não encontrado.");

    const milestoneRef = doc(milestonesRef);
    transaction.set(milestoneRef, {
      ...milestonePayload(input),
      created_at: Timestamp.now(),
      audit_trail: [entry],
    });

    transaction.update(programRef, {
      version: increment(1),
      updated_at: Timestamp.now(),
    });
  });
}

export async function updateTrainingMilestone(
  programId: string,
  moduleId: string,
  milestoneId: string,
  input: MilestoneInput,
  profile: AuthProfile | null,
) {
  const programRef = doc(db, "training_programs", programId);
  const milestoneRef = doc(
    db,
    "training_programs",
    programId,
    "modules",
    moduleId,
    "milestones",
    milestoneId,
  );
  const entry = auditEntry("update_milestone", profile);

  await runTransaction(db, async (transaction) => {
    const [programSnap, milestoneSnap] = await Promise.all([
      transaction.get(programRef),
      transaction.get(milestoneRef),
    ]);
    if (!programSnap.exists()) throw new Error("Programa não encontrado.");
    if (!milestoneSnap.exists()) throw new Error("Marco não encontrado.");

    transaction.update(milestoneRef, {
      ...milestonePayload(input),
      audit_trail: appendAudit(milestoneSnap.data(), entry),
    });

    transaction.update(programRef, {
      version: increment(1),
      updated_at: Timestamp.now(),
    });
  });
}
