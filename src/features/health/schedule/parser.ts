/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — RD-I1
 * Strict parser for `dogs/{dogId}/health_schedule/{scheduleId}`.
 *
 * CONTRACT AUTHORITY: HEALTH_V1_FIRESTORE_SCHEMA.md §2.14, frozen by
 * FRONT20-SCHED-CONTRACT-R2 @ b3838cd.
 *
 * DESIGN RULES (HW-4.WEB-SCHED-P1.R2):
 * - Fail-safe, never throws for field-level defects: a defective sibling must
 *   not destroy the list.
 * - Nothing is invented. No placeholder title, no substituted "now", no unknown
 *   enum normalized to a canonical value, no `dog_id` back-filled from the path.
 * - Timestamps are FIRESTORE-STRICT (see `parseScheduleTimestamp`). This is the
 *   one place Schedule deliberately diverges from the shared Health helper.
 * - Temporal derivation is OUT OF SCOPE (RD-I2). This module normalizes
 *   persisted inputs and says nothing about overdue/pending/today/upcoming.
 */

import type { RecordedByReadModel } from "../clinical/types";
import {
  SCHEDULE_LEGACY_ABSENT_REVISION,
  SCHEDULE_LIFECYCLE_STATUSES,
  SCHEDULE_SCHEMA_VERSION,
  SCHEDULE_SOURCE_TYPES,
  SCHEDULE_TYPES,
  type ScheduleDataQuality,
  type ScheduleItemReadModel,
  type ScheduleItemWireDoc,
  type ScheduleLifecycleStatus,
  type ScheduleParseIssue,
  type ScheduleRevisionSource,
  type ScheduleSourceType,
  type ScheduleType,
} from "./types";

/**
 * Temporal values that legacy documents persisted before the Health v1 cutover.
 * The canonical contract discards them; we detect them to report the legacy
 * shape rather than silently ignoring it.
 */
const LEGACY_TEMPORAL_VALUES = new Set([
  "scheduled",
  "upcoming",
  "today",
  "pending",
  "overdue",
]);

/** Upper bound of the Firestore Timestamp nanoseconds field (inclusive). */
const MAX_TIMESTAMP_NANOSECONDS = 999_999_999;

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Non-negative integer domain shared by `revision` and `schema_version`.
 *
 * A bare `Number.isFinite` check is NOT sufficient for either field: it admits
 * negative and fractional values, which cannot be a monotonic revision counter
 * nor a schema version, and which would otherwise be reported as canonical.
 */
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Valid persisted `revision` (§2.14: "Monotônico; criação = 1").
 *
 * The floor is 0, not 1: legacy absence carries semantic 0, so a physically
 * persisted 0 has no contractual basis for rejection. `revisionSource` keeps the
 * two cases distinguishable.
 */
function isValidRevision(value: unknown): value is number {
  return isNonNegativeInteger(value);
}

/**
 * Valid persisted `schema_version` (§2.14: "Atual: 1").
 *
 * Structural validity is proven BEFORE comparing against the current version, so
 * a malformed numeric can never acquire legitimate legacy/future semantics.
 */
function isValidSchemaVersion(value: unknown): value is number {
  return isNonNegativeInteger(value);
}

/**
 * Trimmed non-empty string, or null.
 *
 * `present` distinguishes "absent" from "present but unusable", which the two
 * callers need in order to pick between a missing-field and a malformed-field
 * issue.
 */
function readString(value: unknown): { value: string | null; present: boolean } {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return { value: trimmed.length > 0 ? trimmed : null, present: true };
  }
  return { value: null, present: isPresent(value) };
}

/**
 * FIRESTORE-STRICT timestamp normalization.
 *
 * Accepts ONLY values that prove Firestore Timestamp semantics:
 *   - callable `toMillis()`
 *   - callable `toDate()`
 *   - finite `seconds` (+ optional `nanoseconds`)
 *   - finite `_seconds` (+ optional `_nanoseconds`)   [REST/serialized form]
 *
 * Rejects ISO strings, epoch numbers, bare `Date` instances and anything whose
 * extraction yields a non-finite date. There is no `new Date()` fallback and no
 * implicit current time: an unparseable value returns null and the caller
 * records an issue.
 *
 * A bare `Date` is rejected on purpose. It cannot come from the Firestore SDK
 * for a timestamp field, so accepting it would let a fabricated value in
 * (precisely the `parseFirestoreDate` defect this replaces).
 *
 * Exported for direct unit coverage of the accept/reject matrix.
 */
export function parseScheduleTimestamp(value: unknown): Date | null {
  if (!isRecord(value)) return null;

  const candidate = value as {
    toMillis?: unknown;
    toDate?: unknown;
    seconds?: unknown;
    nanoseconds?: unknown;
    _seconds?: unknown;
    _nanoseconds?: unknown;
  };

  if (typeof candidate.toMillis === "function") {
    try {
      const millis = (candidate.toMillis as () => unknown)();
      if (typeof millis !== "number" || !Number.isFinite(millis)) return null;
      return finiteDate(new Date(millis));
    } catch {
      return null;
    }
  }

  if (typeof candidate.toDate === "function") {
    try {
      const date = (candidate.toDate as () => unknown)();
      return date instanceof Date ? finiteDate(date) : null;
    } catch {
      return null;
    }
  }

  // Structural seconds/nanoseconds form. A real Firestore Timestamp guarantees
  // an INTEGER `seconds` and `0 <= nanoseconds <= 999_999_999`, so anything
  // outside that domain cannot have come from the SDK and is rejected — the
  // same reasoning that rejects a bare `Date` above.
  //
  // Out-of-range nanoseconds are NEVER clamped, rounded or carried into
  // `seconds`: normalizing them would silently shift the instant (e.g.
  // `nanoseconds: 5e9` moving the value five seconds forward) while reporting
  // a successfully parsed timestamp.
  const usesUnderscore = typeof candidate.seconds !== "number";
  const seconds = usesUnderscore ? candidate._seconds : candidate.seconds;
  if (typeof seconds !== "number" || !Number.isInteger(seconds)) return null;

  const rawNanos = usesUnderscore ? candidate._nanoseconds : candidate.nanoseconds;
  let nanos = 0;
  if (isPresent(rawNanos)) {
    if (
      typeof rawNanos !== "number" ||
      !Number.isInteger(rawNanos) ||
      rawNanos < 0 ||
      rawNanos > MAX_TIMESTAMP_NANOSECONDS
    ) {
      return null;
    }
    nanos = rawNanos;
  }

  return finiteDate(new Date(seconds * 1000 + Math.trunc(nanos / 1e6)));
}

function finiteDate(date: Date): Date | null {
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Validates an IANA zone using the platform's own database via `Intl`.
 *
 * No new dependency: this mirrors the existing Nutrition precedent
 * (`nutrition-plan-service.ts`). `Intl.DateTimeFormat` throws `RangeError` for
 * an unknown zone, which is the only reliable native check.
 */
export function isValidIanaTimezone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Canonical Schedule actor (`RecordedBy { uid, name, internal_role }`).
 *
 * Implemented locally because the equivalent Clinical helper is module-private
 * and Clinical source is frozen for this gate. Only the TYPE is imported, so
 * both aggregates keep one shared shape without one editing the other.
 *
 * Subfields stay nullable so an incomplete actor snapshot is preserved
 * truthfully instead of being discarded or invented.
 *
 * The contract note "Ou 'system' para Function" is prose: no implemented writer
 * persists a literal string, so a string here is reported as a non-map defect
 * rather than accepted as a speculative union.
 */
function parseScheduleActor(raw: unknown): {
  actor: RecordedByReadModel | null;
  incomplete: boolean;
  notMap: boolean;
} {
  if (!isPresent(raw)) {
    return { actor: null, incomplete: false, notMap: false };
  }
  if (!isRecord(raw)) {
    return { actor: null, incomplete: false, notMap: true };
  }

  const uid = readString(raw.uid).value;
  const name = readString(raw.name).value;
  const internalRole = readString(raw.internal_role).value;

  if (uid === null && name === null && internalRole === null) {
    return { actor: null, incomplete: true, notMap: false };
  }

  return {
    actor: { uid, name, internalRole },
    incomplete: uid === null || name === null || internalRole === null,
    notMap: false,
  };
}

/** Builds the all-null model used when the document is structurally unusable. */
function unusableModel(
  dogId: string,
  scheduleId: string,
  issues: ScheduleParseIssue[]
): ScheduleItemReadModel {
  return {
    dogId,
    scheduleId,
    persistedDogId: null,
    scheduleType: null,
    rawScheduleType: null,
    title: null,
    scheduledFor: null,
    dueUntil: null,
    timezone: null,
    lifecycleStatus: null,
    rawLifecycleStatus: null,
    sourceType: null,
    rawSourceType: null,
    sourceId: null,
    caseId: null,
    completedAt: null,
    completedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    createdAt: null,
    recordedBy: null,
    revision: null,
    revisionSource: "unavailable",
    schemaVersion: null,
    notes: null,
    migrationBatchId: null,
    dataQuality: "partial",
    issues,
  };
}

/**
 * Parses a raw `health_schedule/{scheduleId}` wire document into a fail-safe
 * Web read model. Never throws for field-level defects.
 *
 * `dogId` is the STRUCTURAL identity from the read path and is always the scope
 * authority. The persisted `dog_id` is parsed separately and compared.
 */
export function parseScheduleItemWireDoc(
  rawWire: Record<string, unknown> | null | undefined,
  scheduleId: string,
  dogId: string
): ScheduleItemReadModel {
  const issues: ScheduleParseIssue[] = [];
  const addIssue = (issue: ScheduleParseIssue) => issues.push(issue);

  if (!isRecord(rawWire)) {
    return unusableModel(dogId, scheduleId, [
      { field: "<document>", code: "malformed_document", detail: "wire doc is not an object" },
    ]);
  }

  const wire = rawWire as ScheduleItemWireDoc;

  // Quality accumulators. `partial` outranks `degraded` outranks `legacy`.
  let hasDefect = false;
  let isLegacy = false;
  let isDegraded = false;

  // --- dog_id (canonical required; absent on legacy documents) --------------
  // The structural path identity is NEVER copied into persistedDogId: doing so
  // would make a legacy document indistinguishable from a canonical one.
  let persistedDogId: string | null = null;
  const dogIdRead = readString(wire.dog_id);
  if (dogIdRead.value !== null) {
    persistedDogId = dogIdRead.value;
    if (persistedDogId !== dogId) {
      // Integrity defect, NOT an authorization matter: Rules cannot compare a
      // collection-group document against its parent path.
      hasDefect = true;
      addIssue({
        field: "dog_id",
        code: "dog_id_path_mismatch",
        detail: `persisted "${persistedDogId}" != structural "${dogId}"`,
      });
    }
  } else if (dogIdRead.present) {
    hasDefect = true;
    addIssue({ field: "dog_id", code: "dog_id_malformed" });
  } else {
    // Documented pre-cutover shape. Still readable by path authority.
    isLegacy = true;
    addIssue({ field: "dog_id", code: "legacy_missing_dog_id" });
  }

  // --- schedule_type (required enum) ---------------------------------------
  let scheduleType: ScheduleType | null = null;
  let rawScheduleType: string | null = null;
  if (typeof wire.schedule_type === "string") {
    rawScheduleType = wire.schedule_type;
    if ((SCHEDULE_TYPES as readonly string[]).includes(wire.schedule_type)) {
      scheduleType = wire.schedule_type as ScheduleType;
    } else {
      hasDefect = true;
      addIssue({
        field: "schedule_type",
        code: "unrecognized_schedule_type",
        detail: wire.schedule_type,
      });
    }
  } else {
    hasDefect = true;
    addIssue({
      field: "schedule_type",
      code: isPresent(wire.schedule_type) ? "malformed_field" : "missing_required_field",
    });
  }

  // --- title (required; never fabricated) ----------------------------------
  let title: string | null = null;
  const titleRead = readString(wire.title);
  if (titleRead.value !== null) {
    title = titleRead.value;
  } else {
    hasDefect = true;
    addIssue({
      field: "title",
      code: titleRead.present ? "malformed_field" : "missing_title",
    });
  }

  // --- scheduled_for (required timestamp) ----------------------------------
  const scheduledFor = parseScheduleTimestamp(wire.scheduled_for);
  if (scheduledFor === null) {
    hasDefect = true;
    addIssue({
      field: "scheduled_for",
      code: isPresent(wire.scheduled_for)
        ? "timestamp_not_firestore_shape"
        : "missing_required_field",
    });
  }

  // --- created_at (required timestamp) -------------------------------------
  const createdAt = parseScheduleTimestamp(wire.created_at);
  if (createdAt === null) {
    hasDefect = true;
    addIssue({
      field: "created_at",
      code: isPresent(wire.created_at)
        ? "timestamp_not_firestore_shape"
        : "missing_required_field",
    });
  }

  // --- due_until (optional timestamp) --------------------------------------
  // Absence is NOT a defect: it is the documented trigger for the type-specific
  // tolerance rule evaluated in RD-I2.
  let dueUntil: Date | null = null;
  if (isPresent(wire.due_until)) {
    dueUntil = parseScheduleTimestamp(wire.due_until);
    if (dueUntil === null) {
      hasDefect = true;
      addIssue({ field: "due_until", code: "timestamp_not_firestore_shape" });
    }
  }

  // --- timezone (required; IANA-validated, never classified here) -----------
  let timezone: string | null = null;
  const timezoneRead = readString(wire.timezone);
  if (timezoneRead.value !== null) {
    if (isValidIanaTimezone(timezoneRead.value)) {
      timezone = timezoneRead.value;
    } else {
      hasDefect = true;
      addIssue({
        field: "timezone",
        code: "invalid_timezone",
        detail: timezoneRead.value,
      });
    }
  } else {
    hasDefect = true;
    addIssue({
      field: "timezone",
      code: timezoneRead.present ? "malformed_field" : "missing_required_field",
    });
  }

  // --- lifecycle_status (required enum; ONLY persisted state) --------------
  let lifecycleStatus: ScheduleLifecycleStatus | null = null;
  let rawLifecycleStatus: string | null = null;
  if (typeof wire.lifecycle_status === "string") {
    rawLifecycleStatus = wire.lifecycle_status;
    if ((SCHEDULE_LIFECYCLE_STATUSES as readonly string[]).includes(wire.lifecycle_status)) {
      lifecycleStatus = wire.lifecycle_status as ScheduleLifecycleStatus;
    } else {
      // Covers persisted temporal values too: they are not lifecycle values.
      hasDefect = true;
      addIssue({
        field: "lifecycle_status",
        code: "unrecognized_lifecycle_status",
        detail: wire.lifecycle_status,
      });
    }
  } else {
    hasDefect = true;
    addIssue({
      field: "lifecycle_status",
      code: isPresent(wire.lifecycle_status) ? "malformed_field" : "missing_required_field",
    });
  }

  // --- legacy temporal `status` (never authority) ---------------------------
  // Reported, never consumed. A legacy temporal value marks the pre-cutover
  // shape; any other `status` content is still not lifecycle authority.
  const legacyStatusRead = readString(wire.status);
  if (legacyStatusRead.value !== null) {
    if (LEGACY_TEMPORAL_VALUES.has(legacyStatusRead.value.toLowerCase())) {
      isLegacy = true;
    } else {
      hasDefect = true;
    }
    addIssue({
      field: "status",
      code: "legacy_temporal_field_present",
      detail: legacyStatusRead.value,
    });
  } else if (legacyStatusRead.present) {
    hasDefect = true;
    addIssue({ field: "status", code: "legacy_temporal_field_present" });
  }

  // --- source_type (required enum; unknown NEVER becomes `manual`) ----------
  let sourceType: ScheduleSourceType | null = null;
  let rawSourceType: string | null = null;
  if (typeof wire.source_type === "string") {
    rawSourceType = wire.source_type;
    if ((SCHEDULE_SOURCE_TYPES as readonly string[]).includes(wire.source_type)) {
      sourceType = wire.source_type as ScheduleSourceType;
    } else {
      hasDefect = true;
      addIssue({
        field: "source_type",
        code: "unrecognized_source_type",
        detail: wire.source_type,
      });
    }
  } else {
    hasDefect = true;
    addIssue({
      field: "source_type",
      code: isPresent(wire.source_type) ? "malformed_field" : "missing_required_field",
    });
  }

  // --- recorded_by (required actor) ----------------------------------------
  const recordedByResult = parseScheduleActor(wire.recorded_by);
  const recordedBy = recordedByResult.actor;
  if (recordedByResult.notMap) {
    hasDefect = true;
    addIssue({
      field: "recorded_by",
      code: "recorded_by_not_map",
      detail: typeof wire.recorded_by,
    });
  } else if (recordedBy === null) {
    hasDefect = true;
    addIssue({
      field: "recorded_by",
      code: recordedByResult.incomplete ? "recorded_by_incomplete" : "missing_required_field",
    });
  } else if (recordedByResult.incomplete) {
    hasDefect = true;
    addIssue({ field: "recorded_by", code: "recorded_by_incomplete" });
  }

  // --- revision (required on canonical writes; absent => legacy 0) ---------
  let revision: number | null = null;
  let revisionSource: ScheduleRevisionSource = "unavailable";
  if (isValidRevision(wire.revision)) {
    revision = wire.revision;
    revisionSource = "canonical";
  } else if (isPresent(wire.revision)) {
    hasDefect = true;
    addIssue({ field: "revision", code: "revision_malformed" });
  } else {
    // 4E Gate 2: absent means semantic 0 — NEVER 1. `revisionSource` keeps this
    // distinguishable from a document that genuinely persisted 0.
    revision = SCHEDULE_LEGACY_ABSENT_REVISION;
    revisionSource = "legacy_absent";
    isLegacy = true;
  }

  // --- schema_version (required numeric; strict) ----------------------------
  let schemaVersion: number | null = null;
  if (isValidSchemaVersion(wire.schema_version)) {
    schemaVersion = wire.schema_version;
    if (schemaVersion < SCHEDULE_SCHEMA_VERSION) {
      isLegacy = true;
    } else if (schemaVersion > SCHEDULE_SCHEMA_VERSION) {
      // A newer writer may carry semantics this reader cannot interpret.
      isDegraded = true;
    }
  } else {
    // Strings such as "1" / "1.0" are rejected: the contract says number.
    hasDefect = true;
    addIssue({
      field: "schema_version",
      code: "schema_version_invalid",
      detail: isPresent(wire.schema_version) ? typeof wire.schema_version : undefined,
    });
  }

  // --- documented-optional scalars (absence is never a defect) -------------
  const sourceId = readString(wire.source_id).value;
  const caseId = readString(wire.case_id).value;
  const cancelReason = readString(wire.cancel_reason).value;
  const notes = readString(wire.notes).value;
  const migrationBatchId = readString(wire.migration_batch_id).value;

  // --- optional lifecycle timestamps + actors -------------------------------
  let completedAt: Date | null = null;
  if (isPresent(wire.completed_at)) {
    completedAt = parseScheduleTimestamp(wire.completed_at);
    if (completedAt === null) {
      hasDefect = true;
      addIssue({ field: "completed_at", code: "timestamp_not_firestore_shape" });
    }
  }

  let cancelledAt: Date | null = null;
  if (isPresent(wire.cancelled_at)) {
    cancelledAt = parseScheduleTimestamp(wire.cancelled_at);
    if (cancelledAt === null) {
      hasDefect = true;
      addIssue({ field: "cancelled_at", code: "timestamp_not_firestore_shape" });
    }
  }

  const completedByResult = parseScheduleActor(wire.completed_by);
  if (completedByResult.notMap) {
    hasDefect = true;
    addIssue({ field: "completed_by", code: "recorded_by_not_map" });
  } else if (completedByResult.incomplete) {
    hasDefect = true;
    addIssue({ field: "completed_by", code: "recorded_by_incomplete" });
  }

  const cancelledByResult = parseScheduleActor(wire.cancelled_by);
  if (cancelledByResult.notMap) {
    hasDefect = true;
    addIssue({ field: "cancelled_by", code: "recorded_by_not_map" });
  } else if (cancelledByResult.incomplete) {
    hasDefect = true;
    addIssue({ field: "cancelled_by", code: "recorded_by_incomplete" });
  }

  const dataQuality: ScheduleDataQuality = hasDefect
    ? "partial"
    : isDegraded
      ? "degraded"
      : isLegacy
        ? "legacy"
        : "complete";

  return {
    dogId,
    scheduleId,
    persistedDogId,
    scheduleType,
    rawScheduleType,
    title,
    scheduledFor,
    dueUntil,
    timezone,
    lifecycleStatus,
    rawLifecycleStatus,
    sourceType,
    rawSourceType,
    sourceId,
    caseId,
    completedAt,
    completedBy: completedByResult.actor,
    cancelledAt,
    cancelledBy: cancelledByResult.actor,
    cancelReason,
    createdAt,
    recordedBy,
    revision,
    revisionSource,
    schemaVersion,
    notes,
    migrationBatchId,
    dataQuality,
    issues,
  };
}
