/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — RD-I1
 * Canonical `health_schedule` wire + read model types.
 *
 * CONTRACT AUTHORITY (frozen by FRONT20-SCHED-CONTRACT-R2 @ b3838cd):
 * `HEALTH_V1_FIRESTORE_SCHEMA.md` §2.14 — `dogs/{dogId}/health_schedule/{scheduleId}`.
 *
 * SCOPE OF THIS SLICE (RD-I1): persisted wire validation/normalization ONLY.
 * Temporal derivation (`overdue`/`pending`/`today`/`upcoming`/`scheduled`), the
 * approved 24h tolerance, the `dose` fail-closed deadline rule and the Front30
 * `D0…D+6` display window all belong to RD-I2 and are deliberately ABSENT here.
 * No field in this file anticipates them.
 */

import type { RecordedByReadModel } from "../clinical/types";

/**
 * Canonical `schedule_type` (§2.14). Exactly nine values.
 *
 * `dose` is listed like any other type here, but it carries a distinct temporal
 * rule downstream (no generic tolerance — RD-I2). That distinction is NOT a
 * parsing concern and is not encoded in this file.
 */
export const SCHEDULE_TYPES = [
  "dose",
  "vaccination",
  "exam",
  "consultation",
  "weighing",
  "reevaluation",
  "deworming",
  "bath",
  "general",
] as const;

export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

/** Canonical `source_type` (§2.14). Exactly five values. */
export const SCHEDULE_SOURCE_TYPES = [
  "treatment_protocol",
  "clinical_case",
  "exam_process",
  "preventive",
  "manual",
] as const;

export type ScheduleSourceType = (typeof SCHEDULE_SOURCE_TYPES)[number];

/**
 * The ONLY persisted lifecycle state (§2.14: "único campo de estado persistido").
 *
 * The temporal labels `scheduled`, `upcoming`, `today`, `pending` and `overdue`
 * are read-time derivations and are NEVER valid persisted values. The canonical
 * writer's `readLifecycle()` throws on them; this reader classifies them as
 * unrecognized rather than accepting them.
 */
export const SCHEDULE_LIFECYCLE_STATUSES = ["open", "completed", "cancelled"] as const;

export type ScheduleLifecycleStatus = (typeof SCHEDULE_LIFECYCLE_STATUSES)[number];

/** Canonical `schema_version` for Schedule documents (§2.14: "Atual: 1"). */
export const SCHEDULE_SCHEMA_VERSION = 1;

/**
 * Canonical creation `revision` (§2.14: "Monotônico; criação = 1").
 *
 * Legacy documents predating 4E Gate 2 carry no `revision` at all and are
 * interpreted as semantic 0. Absence is NEVER promoted to 1.
 */
export const SCHEDULE_LEGACY_ABSENT_REVISION = 0;

/**
 * Machine-readable parse issue codes.
 *
 * These describe DEFECTS or LEGACY shapes in a canonical document — never the
 * mere absence of a documented-optional field.
 *
 * Structurally this mirrors the Clinical taxonomy (`{field, code, detail}`), but
 * the codes are Schedule-specific where the semantics genuinely differ:
 *
 * - `timestamp_not_firestore_shape` is NOT Clinical's `malformed_timestamp`.
 *   Clinical's shared helper accepts ISO strings and epoch numbers; Schedule
 *   rejects them, so the code names the strictness explicitly.
 * - `dog_id_path_mismatch` is an INTEGRITY defect (persisted identity disagrees
 *   with the structural path), not a generic malformed field.
 * - the two `legacy_*` codes mark pre-cutover shapes, not corruption.
 */
export type ScheduleParseIssueCode =
  | "unrecognized_schedule_type"
  | "unrecognized_source_type"
  | "unrecognized_lifecycle_status"
  | "missing_title"
  | "missing_required_field"
  | "malformed_field"
  | "timestamp_not_firestore_shape"
  | "invalid_timezone"
  | "schema_version_invalid"
  | "revision_malformed"
  | "recorded_by_not_map"
  | "recorded_by_incomplete"
  | "dog_id_path_mismatch"
  | "dog_id_malformed"
  | "legacy_missing_dog_id"
  | "legacy_temporal_field_present"
  | "malformed_document";

/** A single truthful observation about why an item is not fully canonical. */
export interface ScheduleParseIssue {
  /** Canonical (snake_case) wire field the issue refers to. */
  field: string;
  code: ScheduleParseIssueCode;
  /** Diagnostic detail. Never rendered as domain data. */
  detail?: string;
}

/**
 * Data quality classification for a single parsed schedule item.
 *
 * "complete" — every canonically required field present and well-formed.
 * "legacy"   — canonically readable, but carrying a documented pre-cutover
 *              shape (absent `revision`, absent `dog_id`, older
 *              `schema_version`). Not a defect.
 * "degraded" — a FUTURE `schema_version`: the document may carry semantics this
 *              reader cannot interpret, so it must not be presented as fully
 *              understood.
 * "partial"  — at least one required field is absent/malformed, or a present
 *              value could not be recognized.
 *
 * Precedence when several apply: partial > degraded > legacy > complete.
 */
export type ScheduleDataQuality = "complete" | "legacy" | "degraded" | "partial";

/**
 * Provenance of the effective `revision` value.
 *
 * Keeps "legacy document with no revision" distinguishable from "canonical
 * document that genuinely persisted 0", which the number alone cannot express.
 */
export type ScheduleRevisionSource = "canonical" | "legacy_absent" | "unavailable";

/**
 * Web read projection of `dogs/{dogId}/health_schedule/{scheduleId}`.
 *
 * Nullability is semantic, not defensive: `null` means "not truthfully
 * available from the canonical document", never a substituted default.
 */
export interface ScheduleItemReadModel {
  /** Structural dog identity from the read path — the scope authority. */
  dogId: string;
  /** Firestore document ID. Not unique across dogs on its own. */
  scheduleId: string;

  /**
   * Persisted canonical `dog_id`, kept SEPARATE from the structural `dogId`.
   * Null for legacy documents written before `dog_id` became canonical; never
   * back-filled from the path.
   */
  persistedDogId: string | null;

  scheduleType: ScheduleType | null;
  /** Raw wire value preserved verbatim whenever a string was present. */
  rawScheduleType: string | null;

  title: string | null;

  scheduledFor: Date | null;
  dueUntil: Date | null;
  timezone: string | null;

  lifecycleStatus: ScheduleLifecycleStatus | null;
  /** Raw wire value preserved verbatim whenever a string was present. */
  rawLifecycleStatus: string | null;

  sourceType: ScheduleSourceType | null;
  /** Raw wire value preserved verbatim whenever a string was present. */
  rawSourceType: string | null;
  sourceId: string | null;
  caseId: string | null;

  completedAt: Date | null;
  completedBy: RecordedByReadModel | null;
  cancelledAt: Date | null;
  cancelledBy: RecordedByReadModel | null;
  cancelReason: string | null;

  createdAt: Date | null;
  recordedBy: RecordedByReadModel | null;

  /** Effective revision. Read together with `revisionSource`. */
  revision: number | null;
  revisionSource: ScheduleRevisionSource;

  schemaVersion: number | null;

  notes: string | null;
  migrationBatchId: string | null;

  dataQuality: ScheduleDataQuality;
  issues: ScheduleParseIssue[];
}

/**
 * Raw snake_case Firestore wire document for a HealthScheduleItem.
 *
 * Every field is `unknown` on purpose: the parser must prove each value's shape
 * rather than trust a declared type.
 *
 * `status` is declared here NOT because it is canonical — it is not — but
 * because legacy pre-cutover documents may still carry a persisted temporal
 * value there. Declaring it lets the parser detect and report it instead of
 * silently ignoring it. It is never read as lifecycle authority.
 *
 * The idempotency shortcut fields (`create_operation_id`, `create_fingerprint`,
 * `last_update_operation_id`, `last_lifecycle_operation_id`) are intentionally
 * omitted: they exist on the document but have no Agenda read-side consumer,
 * and receipts are the durable source of idempotency.
 */
export interface ScheduleItemWireDoc {
  dog_id?: unknown;
  schedule_type?: unknown;
  title?: unknown;
  scheduled_for?: unknown;
  due_until?: unknown;
  timezone?: unknown;
  lifecycle_status?: unknown;
  source_type?: unknown;
  source_id?: unknown;
  case_id?: unknown;
  completed_at?: unknown;
  completed_by?: unknown;
  cancelled_at?: unknown;
  cancelled_by?: unknown;
  cancel_reason?: unknown;
  created_at?: unknown;
  recorded_by?: unknown;
  revision?: unknown;
  schema_version?: unknown;
  notes?: unknown;
  migration_batch_id?: unknown;
  /** Legacy-only temporal field. NEVER canonical lifecycle authority. */
  status?: unknown;
}
