/**
 * K9 Ops Backend — Health Web v1 HW-3P Corrective
 * Pure Health Summary Projection Producer
 *
 * Implements server-side readiness projection logic according to:
 * - HW-3P Corrective Review §2 (Thresholds), §3 (Consultation vs Exam), §4 (Has Evaluation Predicate)
 * - HEALTH_V1_READINESS_POLICY.md
 * - HEALTH_V1_FIRESTORE_SCHEMA.md
 *
 * CRITICAL MANDATES:
 * - PURE FUNCTION: 100% testable without Firestore or mocks.
 * - Dynamic ReadinessThresholdConfig parameter (Default production: null / not configured).
 * - Distinguishes consultation (veterinary) from exam.
 * - Explicit hasHealthEvaluation predicate for not_evaluated status.
 * - Strictly outputs canonical snake_case wire document with numeric schema_version = 1.
 */

export type ReadinessStatus =
  | "operational"
  | "operational_attention"
  | "fit_with_restrictions"
  | "temporarily_unfit"
  | "not_evaluated";

export const OFFICIAL_READINESS_STATUSES: readonly ReadinessStatus[] = [
  "operational",
  "operational_attention",
  "fit_with_restrictions",
  "temporarily_unfit",
  "not_evaluated",
] as const;

export const READINESS_STATUS_LABELS: Record<ReadinessStatus, string> = {
  operational: "Operacional",
  operational_attention: "Operacional com atenção",
  fit_with_restrictions: "Apto com restrições",
  temporarily_unfit: "Temporariamente inapto",
  not_evaluated: "Não avaliado",
};

export const CURRENT_CANONICAL_SCHEMA_VERSION = 1;

export interface ReadinessThresholdConfig {
  weightRecencyDays: number | null;
  consultationRecencyDays: number | null;
  vaccinationRequired: boolean;
  nutritionRequired: boolean;
}

export const DEFAULT_PRODUCTION_THRESHOLDS: ReadinessThresholdConfig = {
  weightRecencyDays: null,
  consultationRecencyDays: null,
  vaccinationRequired: false,
  nutritionRequired: false,
};

export interface SourceDocument {
  id: string;
  [key: string]: unknown;
}

export interface BuildHealthSummaryInput {
  dogId: string;
  restrictions?: SourceDocument[];
  weightRecords?: SourceDocument[];
  vaccinationRecords?: SourceDocument[];
  nutritionPlans?: SourceDocument[];
  clinicalCases?: SourceDocument[];
  treatmentProtocols?: SourceDocument[];
  healthSchedule?: SourceDocument[];
  existingSummary?: Record<string, unknown> | null;
  thresholdConfig?: ReadinessThresholdConfig;
  now?: Date;
}

export interface HealthSummaryWireOutput {
  dog_id: string;
  readiness_status: ReadinessStatus;
  readiness_label: string;
  readiness_reason: string;
  readiness_updated_at: Date;
  last_evaluated_at: Date;
  updated_at: Date;
  evaluated_by: string;
  active_restrictions: Array<{
    id: string;
    level: string;
    category: string;
    description: string;
    activities_restricted: string[];
    issued_at: Date | string | null;
    expected_end: Date | string | null;
  }>;
  restriction_count: {
    absolute: number;
    partial: number;
    attention: number;
  };
  data_completeness: {
    has_recent_weight: boolean;
    has_active_nutrition: boolean;
    has_vaccination_current: boolean;
    has_recent_exam: boolean;
  };
  active_cases_count: number;
  active_treatments_count: number;
  last_weight: {
    kg: number;
    measured_at: Date | string;
    bcs?: number | null;
  } | null;
  last_vaccination: {
    type: string;
    date: Date | string;
    next_due?: Date | string | null;
  } | null;
  last_exam: {
    type: string;
    date: Date | string;
    status: string;
  } | null;
  last_consultation: {
    date: Date | string;
    professional: string | null;
    case_id: string | null;
  } | null;
  nutrition_plan: {
    active: boolean;
    food_type: string | null;
    amount_grams: number | null;
  } | null;
  pending_schedule_count: number;
  overdue_schedule_count: number;
  open_alerts: Array<Record<string, unknown>>;
  schema_version: number;
}

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    if (typeof obj.toDate === "function") {
      try {
        const d = (obj.toDate as () => Date)();
        return isNaN(d.getTime()) ? null : d;
      } catch {
        return null;
      }
    }
    if (typeof obj.seconds === "number") {
      const d = new Date(obj.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

/**
 * Predicate to determine if a K9 has any clinical health evaluation registered.
 * Administrative records (e.g. mere schedule items) alone do NOT constitute a clinical evaluation.
 */
export function hasHealthEvaluation(input: BuildHealthSummaryInput): boolean {
  const restrictions = input.restrictions ?? [];
  const weightRecords = input.weightRecords ?? [];
  const vaccinationRecords = input.vaccinationRecords ?? [];
  const clinicalCases = input.clinicalCases ?? [];
  const nutritionPlans = input.nutritionPlans ?? [];

  if (restrictions.length > 0) return true;
  if (weightRecords.length > 0) return true;
  if (vaccinationRecords.length > 0) return true;
  if (nutritionPlans.length > 0) return true;

  // Check if clinical cases contain events/exams/consultations
  if (clinicalCases.length > 0) return true;

  return false;
}

/**
 * Pure function to build the canonical health_summary wire document.
 */
export function buildHealthSummary(
  input: BuildHealthSummaryInput
): HealthSummaryWireOutput {
  const now = input.now ?? new Date();
  const dogId = input.dogId;
  const thresholds = input.thresholdConfig ?? DEFAULT_PRODUCTION_THRESHOLDS;

  // 1. Process active operational restrictions
  // MANDATE §14: Active restriction with expected_end in past STILL counts as active until status is ended/cancelled!
  const rawRestrictions = input.restrictions ?? [];
  const activeRestrictionsDocs = rawRestrictions.filter((r) => {
    const st = String(r.status ?? "active").toLowerCase();
    return st === "active";
  });

  const activeAbsolute = activeRestrictionsDocs.filter((r) => String(r.level ?? r.type ?? "").toLowerCase() === "absolute");
  const activePartial = activeRestrictionsDocs.filter((r) => String(r.level ?? r.type ?? "").toLowerCase() === "partial");
  const activeAttention = activeRestrictionsDocs.filter((r) => String(r.level ?? r.type ?? "").toLowerCase() === "attention");

  const restriction_count = {
    absolute: activeAbsolute.length,
    partial: activePartial.length,
    attention: activeAttention.length,
  };

  const active_restrictions = activeRestrictionsDocs.map((r) => ({
    id: String(r.id),
    level: String(r.level ?? r.type ?? "attention").toLowerCase(),
    category: String(r.category ?? "operational"),
    description: String(r.description ?? r.reason ?? "Restrição ativa"),
    activities_restricted: Array.isArray(r.activities_restricted)
      ? (r.activities_restricted as string[])
      : Array.isArray(r.restrictedActivities)
      ? (r.restrictedActivities as string[])
      : [],
    issued_at: parseDate(r.issued_at ?? r.issuedAt) ?? now,
    expected_end: parseDate(r.expected_end ?? r.expectedEnd),
  }));

  // 2. Extract Evidence Summaries
  const weightRecords = input.weightRecords ?? [];
  const validWeights = weightRecords
    .map((w) => ({ doc: w, date: parseDate(w.measured_at ?? w.measuredAt) }))
    .filter((w): w is { doc: SourceDocument; date: Date } => w.date !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const lastWeightDoc = validWeights.length > 0 ? validWeights[0] : null;

  const nutritionPlans = input.nutritionPlans ?? [];
  const activeNutrition = nutritionPlans.find((n) => String(n.status ?? "active").toLowerCase() === "active");

  const vaccinationRecords = input.vaccinationRecords ?? [];
  const validVaccinations = vaccinationRecords
    .map((v) => ({ doc: v, date: parseDate(v.date ?? v.administered_at) }))
    .filter((v): v is { doc: SourceDocument; date: Date } => v.date !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  
  const lastVaccineDoc = validVaccinations.length > 0 ? validVaccinations[0] : null;
  const vaccineNextDue = lastVaccineDoc ? parseDate(lastVaccineDoc.doc.next_due ?? lastVaccineDoc.doc.nextDueDate) : null;
  const has_vaccination_current = Boolean(lastVaccineDoc && (!vaccineNextDue || vaccineNextDue.getTime() >= now.getTime()));

  const clinicalCases = input.clinicalCases ?? [];
  const activeCases = clinicalCases.filter((c) => {
    const st = String(c.clinical_status ?? c.status ?? "open").toLowerCase();
    return ["open", "under_investigation", "under_treatment", "monitoring"].includes(st);
  });

  const validExams: Array<{ doc: SourceDocument; date: Date }> = [];
  const validConsultations: Array<{ doc: SourceDocument; date: Date; caseId: string | null }> = [];

  clinicalCases.forEach((c) => {
    const events = Array.isArray(c.events) ? c.events : [];
    events.forEach((ev: Record<string, unknown>) => {
      const type = String(ev.type ?? ev.event_type ?? "").toLowerCase();
      if (type === "exam") {
        const d = parseDate(ev.date ?? ev.occurred_at);
        if (d) validExams.push({ doc: ev as SourceDocument, date: d });
      } else if (type === "consultation" || type === "veterinary_consultation") {
        const d = parseDate(ev.date ?? ev.occurred_at);
        if (d) validConsultations.push({ doc: ev as SourceDocument, date: d, caseId: String(c.id) });
      }
    });

    // Also check direct exams subcollection if present on case object
    const exams = Array.isArray(c.exams) ? c.exams : [];
    exams.forEach((ex: Record<string, unknown>) => {
      const d = parseDate(ex.date ?? ex.performed_at);
      if (d) validExams.push({ doc: ex as SourceDocument, date: d });
    });
  });

  validExams.sort((a, b) => b.date.getTime() - a.date.getTime());
  validConsultations.sort((a, b) => b.date.getTime() - a.date.getTime());

  const lastExamDoc = validExams.length > 0 ? validExams[0] : null;
  const lastConsultationDoc = validConsultations.length > 0 ? validConsultations[0] : null;

  // 3. Evaluate Data Completeness Fact Booleans
  let has_recent_weight = Boolean(lastWeightDoc);
  if (thresholds.weightRecencyDays !== null && lastWeightDoc) {
    const daysSinceWeight = (now.getTime() - lastWeightDoc.date.getTime()) / (1000 * 60 * 60 * 24);
    has_recent_weight = daysSinceWeight <= thresholds.weightRecencyDays;
  }

  const has_recent_exam = Boolean(lastExamDoc);
  const has_active_nutrition = Boolean(activeNutrition);

  const data_completeness = {
    has_recent_weight,
    has_active_nutrition,
    has_vaccination_current,
    has_recent_exam,
  };

  // 4. Server-Side Readiness Matrix Evaluation
  const evaluated = hasHealthEvaluation(input);
  let readiness_status: ReadinessStatus = "operational";
  let readiness_reason = "Nenhuma restrição ou pendência ativa";

  if (activeAbsolute.length > 0) {
    readiness_status = "temporarily_unfit";
    readiness_reason = String(activeAbsolute[0].description ?? activeAbsolute[0].reason ?? "Restrição absoluta ativa");
  } else if (activePartial.length > 0) {
    readiness_status = "fit_with_restrictions";
    readiness_reason = String(activePartial[0].description ?? activePartial[0].reason ?? "Restrição parcial ativa");
  } else if (activeAttention.length > 0) {
    readiness_status = "operational_attention";
    readiness_reason = String(activeAttention[0].description ?? activeAttention[0].reason ?? "Atenção operacional ativa");
  } else if (!evaluated) {
    readiness_status = "not_evaluated";
    readiness_reason = "Nenhuma avaliação registrada";
  } else {
    // Check if explicit configured thresholds generate attention
    const gaps: string[] = [];
    if (thresholds.weightRecencyDays !== null && !has_recent_weight) {
      gaps.push(`Pesagem em atraso (> ${thresholds.weightRecencyDays} dias)`);
    }
    if (thresholds.consultationRecencyDays !== null && lastConsultationDoc) {
      const daysSinceConsult = (now.getTime() - lastConsultationDoc.date.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceConsult > thresholds.consultationRecencyDays) {
        gaps.push(`Consulta em atraso (> ${thresholds.consultationRecencyDays} dias)`);
      }
    } else if (thresholds.consultationRecencyDays !== null && !lastConsultationDoc) {
      gaps.push("Sem consulta veterinária registrada");
    }
    if (thresholds.nutritionRequired && !has_active_nutrition) {
      gaps.push("Plano alimentar ausente");
    }
    if (thresholds.vaccinationRequired && !has_vaccination_current) {
      gaps.push("Vacinação pendente");
    }

    if (gaps.length > 0) {
      readiness_status = "operational_attention";
      readiness_reason = gaps.join("; ");
    }
  }

  // 5. Structure Summaries for Output
  const treatmentProtocols = input.treatmentProtocols ?? [];
  const activeTreatments = treatmentProtocols.filter((t) => String(t.status ?? "active").toLowerCase() === "active");

  const scheduleItems = input.healthSchedule ?? [];
  const pendingSchedule = scheduleItems.filter((s) => {
    const st = String(s.status ?? s.lifecycle_status ?? "").toLowerCase();
    return st === "scheduled" || st === "pending";
  });
  const overdueSchedule = scheduleItems.filter((s) => {
    const st = String(s.status ?? s.lifecycle_status ?? "").toLowerCase();
    return st === "overdue";
  });

  const last_weight = lastWeightDoc
    ? {
        kg: Number(lastWeightDoc.doc.weight_kg ?? lastWeightDoc.doc.weightKg ?? 0),
        measured_at: lastWeightDoc.date,
        bcs: typeof lastWeightDoc.doc.bcs === "number" ? (lastWeightDoc.doc.bcs as number) : null,
      }
    : null;

  const last_vaccination = lastVaccineDoc
    ? {
        type: String(lastVaccineDoc.doc.type ?? lastVaccineDoc.doc.vaccine_name ?? "Vacina"),
        date: lastVaccineDoc.date,
        next_due: vaccineNextDue,
      }
    : null;

  const last_exam = lastExamDoc
    ? {
        type: String(lastExamDoc.doc.subtype ?? lastExamDoc.doc.title ?? lastExamDoc.doc.type ?? "Exame"),
        date: lastExamDoc.date,
        status: String(lastExamDoc.doc.status ?? "completed"),
      }
    : null;

  const last_consultation = lastConsultationDoc
    ? {
        date: lastConsultationDoc.date,
        professional: typeof lastConsultationDoc.doc.vet_name === "string" ? lastConsultationDoc.doc.vet_name : null,
        case_id: lastConsultationDoc.caseId,
      }
    : null;

  const nutrition_plan = activeNutrition
    ? {
        active: true,
        food_type: typeof activeNutrition.food_type === "string" ? activeNutrition.food_type : String(activeNutrition.name ?? "Plano Ativo"),
        amount_grams: typeof activeNutrition.daily_amount_g === "number" ? activeNutrition.daily_amount_g : null,
      }
    : null;

  // 6. Timestamps Logic
  const existingSummary = input.existingSummary;
  const existingStatus = existingSummary ? String(existingSummary.readiness_status ?? "") : "";
  const existingReason = existingSummary ? String(existingSummary.readiness_reason ?? "") : "";
  const existingReadinessUpdatedAt = existingSummary ? parseDate(existingSummary.readiness_updated_at) : null;

  // Update readiness_updated_at ONLY if readiness_status or readiness_reason changed or if missing
  let readiness_updated_at = existingReadinessUpdatedAt ?? now;
  if (!existingSummary || existingStatus !== readiness_status || existingReason !== readiness_reason) {
    readiness_updated_at = now;
  }

  const last_evaluated_at = now;
  const updated_at = now;

  return {
    dog_id: dogId,
    readiness_status,
    readiness_label: READINESS_STATUS_LABELS[readiness_status],
    readiness_reason,
    readiness_updated_at,
    last_evaluated_at,
    updated_at,
    evaluated_by: "function_v1",
    active_restrictions,
    restriction_count,
    data_completeness,
    active_cases_count: activeCases.length,
    active_treatments_count: activeTreatments.length,
    last_weight,
    last_vaccination,
    last_exam,
    last_consultation,
    nutrition_plan,
    pending_schedule_count: pendingSchedule.length,
    overdue_schedule_count: overdueSchedule.length,
    open_alerts: [],
    schema_version: CURRENT_CANONICAL_SCHEMA_VERSION,
  };
}
