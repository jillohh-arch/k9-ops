/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Canonical Readiness Wire Contracts & Domain Types (Corrected)
 *
 * Implements canonical readiness foundation contracts according to:
 * - HEALTH_V1_FIRESTORE_SCHEMA.md
 * - HEALTH_V1_READINESS_POLICY.md
 * - HEALTH_WEB_DATA_SOURCE_MATRIX.md
 * - HW-3A Corrective Review
 */

import type { ReadState } from "./read-states";

// ============================================================================
// Official Domain Readiness States (5 Canonical Server-Side States)
// ============================================================================

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
} as const;

export const READINESS_STATUS_PRIORITY: Record<ReadinessStatus, number> = {
  temporarily_unfit: 0,
  fit_with_restrictions: 1,
  operational_attention: 2,
  not_evaluated: 3,
  operational: 4,
} as const;

// ============================================================================
// Technical Quality States for Readiness Presentation
// ============================================================================

export type QualityStateLabel =
  | "Atualizada"
  | "Desatualizada"
  | "Parcial"
  | "Conflito"
  | "Sem projeção válida";

// ============================================================================
// Projection Version & Policy Constants
// ============================================================================

/** Canonical schema version is strict numeric 1 */
export const CURRENT_CANONICAL_SCHEMA_VERSION = 1;
export const SUPPORTED_CANONICAL_SCHEMA_VERSIONS: readonly number[] = [1] as const;

export const DEFAULT_MAX_FRESHNESS_AGE_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Firestore Wire Document Contracts (snake_case)
// ============================================================================

export interface DataCompletenessWire {
  has_recent_weight?: boolean;
  has_active_nutrition?: boolean;
  has_vaccination_current?: boolean;
  has_recent_exam?: boolean;
}

export interface RestrictionCountWire {
  absolute?: number;
  partial?: number;
  attention?: number;
}

export interface RecordedByWire {
  ra: string;
  name?: string | null;
  role?: string | null;
}

export interface ProfessionalIdentityWire {
  name: string;
  crmv?: string | null;
  clinic?: string | null;
}

export interface HealthDocumentRefWire {
  id?: string | null;
  name?: string | null;
  url?: string | null;
}

/** Wire document at dogs/{dogId}/health_summary/current */
export interface HealthSummaryWireDoc {
  readiness_status?: string;
  readiness_label?: string | null;
  readiness_reason?: string | null;
  readiness_updated_at?: unknown;
  active_restrictions?: Array<Record<string, unknown>> | null;
  restriction_count?: RestrictionCountWire | null;
  last_evaluated_at?: unknown;
  evaluated_by?: string | null;
  data_completeness?: DataCompletenessWire | null;
  active_cases_count?: number | null;
  active_treatments_count?: number | null;
  last_weight?: Record<string, unknown> | null;
  last_vaccination?: Record<string, unknown> | null;
  last_exam?: Record<string, unknown> | null;
  last_consultation?: Record<string, unknown> | null;
  nutrition_plan?: Record<string, unknown> | null;
  pending_schedule_count?: number | null;
  overdue_schedule_count?: number | null;
  open_alerts?: Array<Record<string, unknown>> | null;
  updated_at?: unknown;
  schema_version?: unknown;
}

/** Wire document at dogs/{dogId}/operational_restrictions/{restrictionId} */
export interface OperationalRestrictionWireDoc {
  level?: string;
  category?: string;
  description?: string;
  activities_restricted?: string[];
  issued_at?: unknown;
  recorded_by?: RecordedByWire | string | null;
  professional?: ProfessionalIdentityWire | string | null;
  source_document?: HealthDocumentRefWire | string | null;
  expected_end?: unknown;
  actual_end?: unknown;
  ended_by?: RecordedByWire | string | null;
  end_professional?: ProfessionalIdentityWire | string | null;
  end_source_document?: HealthDocumentRefWire | string | null;
  end_reason?: string | null;
  evidence?: Record<string, unknown> | null;
  status?: string;
  case_id?: string | null;
  event_id?: string | null;
  exam_id?: string | null;
  schema_version?: unknown;
}

// ============================================================================
// Canonical Parsed Domain Models (Structured Post-Parsing)
// ============================================================================

export interface CanonicalHealthSummaryDoc {
  dogId: string;
  readinessStatus: ReadinessStatus | string;
  readinessLabel: string | null;
  readinessReason: string | null;
  readinessUpdatedAt: Date | null;
  lastEvaluatedAt: Date | null;
  updatedAt: Date | null;
  evaluatedBy: string | null;
  activeRestrictions: Array<Record<string, unknown>>;
  restrictionCount: {
    absolute: number;
    partial: number;
    attention: number;
  };
  dataCompleteness: {
    hasRecentWeight: boolean;
    hasActiveNutrition: boolean;
    hasVaccinationCurrent: boolean;
    hasRecentExam: boolean;
  } | null;
  activeCasesCount: number;
  activeTreatmentsCount: number;
  pendingScheduleCount: number;
  overdueScheduleCount: number;
  schemaVersion: number | null;
  rawWireDoc: HealthSummaryWireDoc;
}

export interface CanonicalRestrictionDoc {
  id: string;
  dogId: string;
  level: "absolute" | "partial" | "attention" | string;
  category: string;
  description: string;
  activitiesRestricted: string[];
  issuedAt: Date;
  recordedBy: RecordedByWire | null;
  professional: ProfessionalIdentityWire | null;
  sourceDocument: HealthDocumentRefWire | null;
  expectedEnd: Date | null;
  actualEnd: Date | null;
  endedBy: RecordedByWire | null;
  endProfessional: ProfessionalIdentityWire | null;
  endSourceDocument: HealthDocumentRefWire | null;
  endReason: string | null;
  evidence: Record<string, unknown> | null;
  status: "active" | "ended" | "cancelled" | string;
  caseId: string | null;
  eventId: string | null;
  examId: string | null;
  schemaVersion: number | null;
  rawWireDoc: OperationalRestrictionWireDoc;
}

// ============================================================================
// Dog Identity (Composed from Institutional K9 Catalog / Effective Dog)
// ============================================================================

export interface DogIdentityReadModel {
  id: string;
  name: string;
  registrationNumber: string | null;
  photoUrl: string | null;
  breed: string | null;
  sex: string | null;
  dateOfBirth: Date | null;
  conductor: {
    ra: string;
    name: string | null;
  } | null;
  specialties: Array<{
    id: string;
    type: string;
    status: string;
  }>;
}

// ============================================================================
// Restriction Presentation Read Model
// ============================================================================

export interface OperationalRestrictionReadModel {
  id: string;
  dogId: string;
  type: "absolute" | "partial" | "attention";
  status: "active" | "ended" | "cancelled";
  reason: string;
  description: string;
  restrictedActivities: string[];
  issuedAt: Date;
  recordedBy: RecordedByWire | null;
  professional: ProfessionalIdentityWire | null;
  sourceDocument: HealthDocumentRefWire | null;
  expectedEnd: Date | null;
  actualEnd: Date | null;
  authorityLabel: string | null;
  sourceDocumentUrl: string | null;
  clinicalCaseId: string | null;
  isOverdueReevaluation: boolean;
}

// ============================================================================
// Freshness & Conflict Results
// ============================================================================

export interface FreshnessEvaluationResult {
  evaluatedAt: Date;
  readinessUpdatedAt: Date | null;
  lastEvaluatedAt: Date | null;
  updatedAt: Date | null;
  ageMs: number | null;
  maxAgeMs: number;
  isStale: boolean;
  isFutureAnomaly: boolean;
  hasValidTimestamp: boolean;
  status: "fresh" | "stale" | "missing_timestamp" | "future_anomaly";
}

export interface VersionEvaluationResult {
  rawVersion: unknown;
  parsedVersion: number | null;
  isSupported: boolean;
  isMissing: boolean;
  status: "valid" | "missing" | "incompatible";
  details: string;
}

export type ReadinessConflictType =
  | "summary_restriction_mismatch"
  | "stale_projection"
  | "missing_summary"
  | "unknown_readiness_enum"
  | "incompatible_projection_version"
  | "restriction_reference_inconsistency"
  | "future_timestamp_anomaly";

export interface ReadinessConflictResult {
  hasConflict: boolean;
  conflictType: ReadinessConflictType | null;
  description: string | null;
  affectedFields: string[];
}

// ============================================================================
// Presentation Read Models (Read-only aggregation)
// ============================================================================

export interface ReadinessListItem {
  dog: DogIdentityReadModel;
  summary: CanonicalHealthSummaryDoc | null;
  readinessStatus: ReadinessStatus;
  readinessLabel: string;
  reason: string | null;
  activeRestrictionsSummary: OperationalRestrictionReadModel[];
  updatedAt: Date | null;
  freshness: FreshnessEvaluationResult;
  dataQuality: ReadState;
  qualityLabel: QualityStateLabel;
  conflict: ReadinessConflictResult | null;
  projectionMetadata: {
    version: number | null;
    source: string;
  } | null;
  cockpitAvailable: boolean;
}

export interface EvidenceAvailability<T = unknown> {
  available: boolean;
  reason: string;
  data?: T | null;
}

export interface ReadinessCockpit {
  dog: DogIdentityReadModel;
  summary: CanonicalHealthSummaryDoc | null;
  readinessStatus: ReadinessStatus;
  readinessLabel: string;
  reason: string | null;
  restrictions: OperationalRestrictionReadModel[];
  vaccinationEvidence: EvidenceAvailability;
  weightEvidence: EvidenceAvailability;
  scheduleSummary: EvidenceAvailability;
  nutritionSummary: EvidenceAvailability;
  clinicalSummary: EvidenceAvailability;
  timelineSummary: EvidenceAvailability;
  freshness: FreshnessEvaluationResult;
  dataQuality: ReadState;
  qualityLabel: QualityStateLabel;
  conflict: ReadinessConflictResult | null;
  projectionMetadata: {
    version: number | null;
    source: string;
  } | null;
}
