/**
 * K9 Ops Web — Health Web v1 HW-6A.I1
 * ClinicalCase Web Read Model — Types
 *
 * Canonical authority:
 * - HEALTH_V1_FIRESTORE_SCHEMA.md §2.1 (`clinical_cases/{caseId}`)
 * - ADR-003-CLINICAL-CASE-WORKFLOW.md §12 (Impacto em Firestore)
 * - Front 20 Clinical Read Foundation (f98952c) — firestore.rules
 *
 * CRITICAL MANDATES:
 * - This is a READ PROJECTION of the canonical ClinicalCase aggregate.
 *   It is NOT a competing domain schema and defines no lifecycle of its own.
 * - `ClinicalCaseStatus` and `CLINICAL_CASE_STATUS_LABELS` are REUSED from the
 *   shared Health domain. The six canonical statuses are never redefined here.
 * - Strictly read-only. No write payloads, no command shapes.
 */

import type { ClinicalCaseStatus } from "../domain/read-states";

/**
 * Canonical `opening_type` enum (HEALTH_V1_FIRESTORE_SCHEMA.md §2.1).
 */
export const CLINICAL_OPENING_TYPES = [
  "incident",
  "consultation",
  "preventive",
  "administrative",
] as const;

export type ClinicalOpeningType = (typeof CLINICAL_OPENING_TYPES)[number];

/**
 * Canonical `closure_type` enum (HEALTH_V1_FIRESTORE_SCHEMA.md §2.1).
 */
export const CLINICAL_CLOSURE_TYPES = [
  "discharge",
  "cancelled",
  "administrative",
] as const;

export type ClinicalClosureType = (typeof CLINICAL_CLOSURE_TYPES)[number];

/**
 * Canonical `RecordedBy` actor envelope for the Clinical aggregate.
 *
 * IMPORTANT — this is NOT the same wire shape as the Readiness
 * `RecordedByWire` (which keys on `ra`). ADR-003 §12 and
 * HEALTH_V1_FIRESTORE_SCHEMA.md §2.1 define the Clinical actor as
 * `RecordedBy { uid, name, internal_role }`. The shared Readiness parser is
 * therefore NOT reusable here and is deliberately left untouched.
 *
 * Subfields are nullable so that an incomplete actor snapshot can be
 * preserved truthfully instead of being discarded or invented.
 */
export interface RecordedByReadModel {
  uid: string | null;
  name: string | null;
  internalRole: string | null;
}

/**
 * Canonical `ProfessionalIdentity` (PII) — professional attribution.
 *
 * Kept strictly distinct from `RecordedByReadModel`: the authenticated actor
 * who registered a case is not necessarily the responsible professional.
 */
export interface ProfessionalIdentityReadModel {
  name: string | null;
  crmv: string | null;
  clinic: string | null;
}

/**
 * Machine-readable parse issue codes.
 *
 * These describe DEFECTS in a canonical document — never the mere absence of
 * a documented-optional field.
 */
export type ClinicalCaseParseIssueCode =
  | "unrecognized_value"
  | "malformed_timestamp"
  | "missing_required_field"
  | "malformed_field"
  | "incomplete_actor"
  | "malformed_document";

/**
 * A single truthful observation about why a case is not fully reliable.
 */
export interface ClinicalCaseParseIssue {
  /** Canonical (snake_case) field name the issue refers to. */
  field: string;
  code: ClinicalCaseParseIssueCode;
  /** Human-readable detail for diagnostics. Never rendered as domain data. */
  detail?: string;
}

/**
 * Data quality classification for a single parsed case.
 *
 * "complete" — every canonically REQUIRED field was present and well-formed.
 * "partial"  — at least one required field is absent/malformed, or a present
 *              field could not be recognized. Documented-optional derived
 *              fields being absent does NOT make a case partial; they simply
 *              stay `null` (see §9 of the HW-6A.I1 contract).
 */
export type ClinicalCaseDataQuality = "complete" | "partial";

/**
 * Web read projection of `dogs/{dogId}/clinical_cases/{caseId}`.
 *
 * Nullability is semantic, not defensive: `null` means "not truthfully
 * available from the canonical document", never "false" and never "zero".
 */
export interface ClinicalCaseReadModel {
  /** Structural dog identity from the read path — never from the payload. */
  dogId: string;
  /** Firestore document ID. */
  caseId: string;

  /** Recognized canonical status, or null when unrecognized. */
  clinicalStatus: ClinicalCaseStatus | null;
  /** Raw wire value preserved verbatim whenever a status string was present. */
  rawClinicalStatus: string | null;

  title: string | null;

  openedAt: Date | null;
  openedBy: RecordedByReadModel | null;
  /**
   * Canonical `recorded_by` — the executor who registered the case.
   * DISTINCT from `openedBy` even though the two usually coincide.
   * Never aliased to `openedBy`.
   */
  recordedBy: RecordedByReadModel | null;
  openingEventId: string | null;
  openingType: ClinicalOpeningType | null;

  primaryProfessional: ProfessionalIdentityReadModel | null;

  closedAt: Date | null;
  closedBy: RecordedByReadModel | null;
  closureType: ClinicalClosureType | null;
  closureReason: string | null;

  /** Function-derived, documented-optional. ABSENT !== false. */
  hasActiveRestriction: boolean | null;
  /** Function-derived, documented-optional. ABSENT !== false. */
  hasPendingSchedule: boolean | null;
  /** Function-derived, documented-optional. ABSENT !== 0. */
  activeTreatmentsCount: number | null;
  /** Derived, documented-optional. Never substituted by `opened_at`. */
  lastEventAt: Date | null;
  /** Derived, documented-optional. ABSENT !== 0. */
  eventCount: number | null;

  schemaVersion: number | null;

  dataQuality: ClinicalCaseDataQuality;
  issues: ClinicalCaseParseIssue[];
}

/**
 * Raw snake_case Firestore wire document for a ClinicalCase.
 *
 * Every field is `unknown` on purpose: the parser must prove each value's
 * shape rather than trust a declared type.
 */
export interface ClinicalCaseWireDoc {
  clinical_status?: unknown;
  title?: unknown;
  opened_at?: unknown;
  opened_by?: unknown;
  recorded_by?: unknown;
  opening_event_id?: unknown;
  opening_type?: unknown;
  primary_professional?: unknown;
  closed_at?: unknown;
  closed_by?: unknown;
  closure_type?: unknown;
  closure_reason?: unknown;
  has_active_restriction?: unknown;
  has_pending_schedule?: unknown;
  active_treatments_count?: unknown;
  last_event_at?: unknown;
  event_count?: unknown;
  schema_version?: unknown;
  [key: string]: unknown;
}
