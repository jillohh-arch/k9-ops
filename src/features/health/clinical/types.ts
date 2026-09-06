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

// ─────────────────────────────────────────────────────────────────────────────
// ClinicalEvent & ClinicalAmendment Contracts (F20.1 Frozen Authority)
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical event_type enum (HEALTH_V1_FIRESTORE_SCHEMA §2.2 / F20.1) */
export const CLINICAL_EVENT_TYPES = [
  "consultation",
  "incident",
  "vaccination",
  "exam_request",
  "exam_collection",
  "exam_result",
  "exam_interpretation",
  "treatment_start",
  "treatment_note",
  "dose_note",
  "reevaluation",
  "discharge",
  "reopen",
  "restriction_issued",
  "restriction_ended",
  "surgical_note",
  "general_note",
  "observation",
] as const;

export type ClinicalEventType = (typeof CLINICAL_EVENT_TYPES)[number];

/** Canonical status enum for clinical events */
export const CLINICAL_EVENT_STATUSES = [
  "draft",
  "final",
  "cancelled",
] as const;

export type ClinicalEventStatus = (typeof CLINICAL_EVENT_STATUSES)[number];

/** Canonical amendment type enum (schema §2.3 / ADR-002) */
export const CLINICAL_AMENDMENT_TYPES = [
  "correction",
  "addendum",
  "complement",
] as const;

export type ClinicalAmendmentType = (typeof CLINICAL_AMENDMENT_TYPES)[number];

/**
 * Professional identity representation in an event or case.
 * Preserves external clinical professional attribution, distinctly separated
 * from the internal authenticated user who recorded the event (recorded_by).
 */
export interface ClinicalProfessionalReadModel {
  name: string | null;
  registrationType: string | null;
  registrationNumber: string | null;
  clinic: string | null;
  formattedRegistration?: string | null;
  rawMap?: Record<string, unknown>;
}

/**
 * Canonical read projection of ClinicalAmendment.
 * Subcollection:
 * dogs/{dogId}/clinical_cases/{caseId}/clinical_events/{eventId}/clinical_amendments/{amendmentId}
 */
export interface ClinicalAmendmentReadModel {
  id: string; // DocumentSnapshot.id
  eventId: string;
  caseId: string;
  dogId: string;
  type: ClinicalAmendmentType | null;
  rawType: string | null;
  reason: string;
  payloadType: string | null;
  payloadVersion: number | null;
  content: Record<string, unknown>;
  recordedBy: RecordedByReadModel | null;
  recordedAt: Date | null;
  schemaVersion: number | null;
  ordinal?: number;
  dataQualityIssues: string[];
  rawDoc: Record<string, unknown>;
}

/**
 * Canonical read projection of ClinicalEvent.
 * Subcollection:
 * dogs/{dogId}/clinical_cases/{caseId}/clinical_events/{eventId}
 *
 * UNKNOWN POLICY (Mandatory Rule 7.1 / F20.1):
 * - hasAmendments: null means UNKNOWN / not informed in stored document (NEVER defaulted to false).
 * - amendmentCount: null means UNKNOWN / not informed (NEVER defaulted to 0).
 * - attachmentRefs: null means UNKNOWN / not informed (NEVER defaulted to []).
 * - occurredAt: clinical occurrence time (distinct from recordedAt!).
 */
export interface ClinicalEventReadModel {
  id: string; // DocumentSnapshot.id (authoritative identity)
  caseId: string;
  dogId: string;
  type: ClinicalEventType | null;
  rawType: string | null;
  status: ClinicalEventStatus | null;
  rawStatus: string | null;
  occurredAt: Date | null;
  recordedAt: Date | null;
  updatedAt: Date | null;
  recordedBy: RecordedByReadModel | null;
  payloadType: string | null;
  payloadVersion: number | null;
  schemaVersion: number | null;
  revision: number | null;
  content: Record<string, unknown>;
  attachmentRefs: string[] | null;
  hasAmendments: boolean | null;
  amendmentCount: number | null;
  lastAmendedAt: Date | null;
  finalizedAt: Date | null;
  cancelReason: string | null;
  cancelledAt: Date | null;
  cancelledBy: RecordedByReadModel | null;
  professional: ClinicalProfessionalReadModel | null;
  examId: string | null;
  dataQualityIssues: string[];
  rawDoc: Record<string, unknown>;
}

/**
 * Raw wire shapes for ClinicalEvent and ClinicalAmendment
 */
export interface ClinicalEventWireDoc {
  dog_id?: unknown;
  case_id?: unknown;
  event_id?: unknown;
  entity_kind?: unknown;
  event_type?: unknown;
  type?: unknown;
  status?: unknown;
  occurred_at?: unknown;
  occurredAt?: unknown;
  recorded_at?: unknown;
  recordedAt?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
  recorded_by?: unknown;
  recordedBy?: unknown;
  payload_type?: unknown;
  payloadType?: unknown;
  payload_version?: unknown;
  payloadVersion?: unknown;
  schema_version?: unknown;
  schemaVersion?: unknown;
  revision?: unknown;
  content?: unknown;
  attachment_refs?: unknown;
  attachmentRefs?: unknown;
  has_amendments?: unknown;
  hasAmendments?: unknown;
  amendment_count?: unknown;
  amendmentCount?: unknown;
  last_amended_at?: unknown;
  lastAmendedAt?: unknown;
  finalized_at?: unknown;
  finalizedAt?: unknown;
  cancel_reason?: unknown;
  cancelReason?: unknown;
  cancelled_at?: unknown;
  cancelledAt?: unknown;
  cancelled_by?: unknown;
  cancelledBy?: unknown;
  professional?: unknown;
  exam_id?: unknown;
  examId?: unknown;
  [key: string]: unknown;
}

export interface ClinicalAmendmentWireDoc {
  type?: unknown;
  reason?: unknown;
  payload_type?: unknown;
  payloadType?: unknown;
  payload_version?: unknown;
  payloadVersion?: unknown;
  schema_version?: unknown;
  schemaVersion?: unknown;
  content?: unknown;
  recorded_by?: unknown;
  recordedBy?: unknown;
  recorded_at?: unknown;
  recordedAt?: unknown;
  [key: string]: unknown;
}
