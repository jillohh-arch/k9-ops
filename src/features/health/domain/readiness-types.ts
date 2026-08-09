/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Canonical Readiness Read Models & Foundation Types
 *
 * Implements canonical readiness foundation contracts according to:
 * - HW-3A Specification §5-§15
 * - HEALTH_WEB_READINESS_POLICY.md §5-§10
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §14, §25
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

export const CURRENT_PROJECTION_VERSION = "1.0";
export const SUPPORTED_PROJECTION_VERSIONS: readonly (string | number)[] = [
  "1.0",
  1,
  "1",
] as const;

export const DEFAULT_MAX_FRESHNESS_AGE_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Canonical Server-Owned Projections / Documents
// Path: dogs/{dogId}/health_summary/current
// ============================================================================

export interface CanonicalHealthSummaryDoc {
  dogId: string;
  readinessStatus: ReadinessStatus | string;
  readinessReason?: string | null;
  activeRestrictionsCount?: number;
  activeTreatmentsCount?: number;
  pendingExamsCount?: number;
  dataCompleteness?: number | null;
  lastEvaluatedAt?: string | Date | number | { toMillis?: () => number; seconds?: number } | null;
  updatedAt?: string | Date | number | { toMillis?: () => number; seconds?: number } | null;
  version?: string | number | null;
  source?: string;
}

// Path: dogs/{dogId}/operational_restrictions/{restrictionId}
export interface CanonicalRestrictionDoc {
  id: string;
  dogId: string;
  level: "absolute" | "partial" | "attention" | string;
  status: "active" | "ended" | "cancelled" | string;
  category?: string;
  reason: string;
  description?: string | null;
  restrictedActivities?: string[];
  issuedAt: string | Date | number | { toMillis?: () => number; seconds?: number };
  issuedBy: string;
  expectedEnd?: string | Date | number | { toMillis?: () => number; seconds?: number } | null;
  actualEnd?: string | Date | number | { toMillis?: () => number; seconds?: number } | null;
  authority?: string | null;
  sourceDocumentUrl?: string | null;
  clinicalCaseId?: string | null;
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
// Restriction Read Model
// ============================================================================

export interface OperationalRestrictionReadModel {
  id: string;
  dogId: string;
  type: "absolute" | "partial" | "attention";
  status: "active" | "ended" | "cancelled";
  reason: string;
  description: string | null;
  restrictedActivities: string[];
  issuedAt: Date;
  issuedBy: string;
  expectedEnd: Date | null;
  actualEnd: Date | null;
  authority: string | null;
  sourceDocumentUrl: string | null;
  clinicalCaseId: string | null;
  isOverdueReevaluation: boolean;
}

// ============================================================================
// Freshness & Conflict Results
// ============================================================================

export interface FreshnessEvaluationResult {
  evaluatedAt: Date;
  computedAt: Date | null;
  ageMs: number | null;
  maxAgeMs: number;
  isStale: boolean;
  isFutureAnomaly: boolean;
  hasValidTimestamp: boolean;
  status: "fresh" | "stale" | "missing_timestamp" | "future_anomaly";
}

export interface VersionEvaluationResult {
  rawVersion: string | number | null | undefined;
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
  | "partial_reader_failure"
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
    version: string | number | null;
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
    version: string | number | null;
    source: string;
  } | null;
}
