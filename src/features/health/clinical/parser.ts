/**
 * K9 Ops Web — Health Web v1 HW-6A.I1
 * ClinicalCase Fail-Safe Parser
 *
 * Canonical authority:
 * - HEALTH_V1_FIRESTORE_SCHEMA.md §2.1 (`clinical_cases/{caseId}`)
 * - ADR-003-CLINICAL-CASE-WORKFLOW.md §12
 *
 * POLICY (HW-6A.I1 §6, §9):
 * - The parser NEVER invents permissive data.
 *   unknown status        -> clinicalStatus = null (raw preserved) + partial
 *   absent boolean flag   -> null   (NEVER false)
 *   absent count          -> null   (NEVER 0)
 *   present count of 0     -> 0
 *   absent last_event_at   -> null  (NEVER substituted by opened_at)
 *   absent title           -> null  (NEVER synthesized)
 * - A malformed field degrades ONLY that field to null and marks the case
 *   `partial`; it never throws, so a bad sibling can't drop the whole list.
 * - Documented-OPTIONAL fields being absent does NOT make a case partial.
 *   Only absent/malformed REQUIRED fields, or an unrecognized present value,
 *   do. Required (✅) per schema: clinical_status, title, opened_at,
 *   opened_by, opening_event_id, opening_type, recorded_by, schema_version.
 * - No Firestore fan-out, no users/access_profiles lookup, no next-action.
 */

import { parseTimestamp } from "../domain/freshness-policy";
import type { ClinicalCaseStatus } from "../domain/read-states";
import {
  CLINICAL_CLOSURE_TYPES,
  CLINICAL_OPENING_TYPES,
  type ClinicalCaseParseIssue,
  type ClinicalCaseReadModel,
  type ClinicalCaseWireDoc,
  type ClinicalClosureType,
  type ClinicalOpeningType,
  type ProfessionalIdentityReadModel,
  type RecordedByReadModel,
} from "./types";

const CANONICAL_STATUSES: readonly ClinicalCaseStatus[] = [
  "open",
  "under_investigation",
  "under_treatment",
  "monitoring",
  "discharged",
  "cancelled",
];

/**
 * Parses a canonical `RecordedBy { uid, name, internal_role }` envelope.
 *
 * Distinct from the Readiness `parseRecordedBy` (which keys on `ra`); the
 * Clinical actor shape is different, so this parser is local by design.
 *
 * Subfields are preserved individually: a present-but-incomplete actor keeps
 * the truthful data it has rather than collapsing to null. `null` is returned
 * only when nothing usable is present.
 */
function parseClinicalActor(raw: unknown): {
  actor: RecordedByReadModel | null;
  incomplete: boolean;
} {
  if (raw === null || raw === undefined) {
    return { actor: null, incomplete: false };
  }
  if (typeof raw !== "object") {
    return { actor: null, incomplete: true };
  }
  const obj = raw as Record<string, unknown>;
  const uid = typeof obj.uid === "string" && obj.uid.trim() ? obj.uid.trim() : null;
  const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : null;
  const internalRole =
    typeof obj.internal_role === "string" && obj.internal_role.trim()
      ? obj.internal_role.trim()
      : null;

  if (uid === null && name === null && internalRole === null) {
    return { actor: null, incomplete: true };
  }

  const incomplete = uid === null || name === null || internalRole === null;
  return { actor: { uid, name, internalRole }, incomplete };
}

/**
 * Parses a canonical `ProfessionalIdentity` (PII). Optional field: absence is
 * silent (returns null, no issue). A present-but-malformed value yields null.
 */
function parseProfessional(raw: unknown): ProfessionalIdentityReadModel | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : null;
  const crmv = typeof obj.crmv === "string" && obj.crmv.trim() ? obj.crmv.trim() : null;
  const clinic = typeof obj.clinic === "string" && obj.clinic.trim() ? obj.clinic.trim() : null;
  if (name === null && crmv === null && clinic === null) return null;
  return { name, crmv, clinic };
}

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined;
}

/**
 * Parses a raw snake_case `clinical_cases/{caseId}` wire document into a
 * fail-safe Web read model. Never throws for field-level defects.
 */
export function parseClinicalCaseWireDoc(
  rawWire: Record<string, unknown> | null | undefined,
  caseId: string,
  dogId: string
): ClinicalCaseReadModel {
  const issues: ClinicalCaseParseIssue[] = [];
  const addIssue = (issue: ClinicalCaseParseIssue) => issues.push(issue);

  // A non-object document is structurally unusable. Return a fully-null,
  // partial model rather than throwing — the caller keeps the sibling list.
  if (!rawWire || typeof rawWire !== "object") {
    return {
      dogId,
      caseId,
      clinicalStatus: null,
      rawClinicalStatus: null,
      title: null,
      openedAt: null,
      openedBy: null,
      recordedBy: null,
      openingEventId: null,
      openingType: null,
      primaryProfessional: null,
      closedAt: null,
      closedBy: null,
      closureType: null,
      closureReason: null,
      hasActiveRestriction: null,
      hasPendingSchedule: null,
      activeTreatmentsCount: null,
      lastEventAt: null,
      eventCount: null,
      schemaVersion: null,
      dataQuality: "partial",
      issues: [
        { field: "<document>", code: "malformed_document", detail: "wire doc is not an object" },
      ],
    };
  }

  const wire = rawWire as ClinicalCaseWireDoc;

  // --- clinical_status (required) -------------------------------------------
  let clinicalStatus: ClinicalCaseStatus | null = null;
  let rawClinicalStatus: string | null = null;
  if (typeof wire.clinical_status === "string") {
    rawClinicalStatus = wire.clinical_status;
    if (CANONICAL_STATUSES.includes(wire.clinical_status as ClinicalCaseStatus)) {
      clinicalStatus = wire.clinical_status as ClinicalCaseStatus;
    } else {
      addIssue({
        field: "clinical_status",
        code: "unrecognized_value",
        detail: wire.clinical_status,
      });
    }
  } else if (isPresent(wire.clinical_status)) {
    addIssue({ field: "clinical_status", code: "malformed_field" });
  } else {
    addIssue({ field: "clinical_status", code: "missing_required_field" });
  }

  // --- title (required) -----------------------------------------------------
  let title: string | null = null;
  if (typeof wire.title === "string" && wire.title.trim()) {
    title = wire.title.trim();
  } else if (isPresent(wire.title)) {
    addIssue({ field: "title", code: "malformed_field" });
  } else {
    // Absent title: partial, but NEVER synthesize a placeholder.
    addIssue({ field: "title", code: "missing_required_field" });
  }

  // --- opened_at (required timestamp) ---------------------------------------
  const openedAt = parseTimestamp(wire.opened_at);
  if (openedAt === null) {
    addIssue({
      field: "opened_at",
      code: isPresent(wire.opened_at) ? "malformed_timestamp" : "missing_required_field",
    });
  }

  // --- opened_by (required actor) -------------------------------------------
  const openedByResult = parseClinicalActor(wire.opened_by);
  const openedBy = openedByResult.actor;
  if (openedBy === null) {
    addIssue({
      field: "opened_by",
      code: isPresent(wire.opened_by) ? "malformed_field" : "missing_required_field",
    });
  } else if (openedByResult.incomplete) {
    addIssue({ field: "opened_by", code: "incomplete_actor" });
  }

  // --- recorded_by (required actor, DISTINCT from opened_by) ----------------
  const recordedByResult = parseClinicalActor(wire.recorded_by);
  const recordedBy = recordedByResult.actor;
  if (recordedBy === null) {
    addIssue({
      field: "recorded_by",
      code: isPresent(wire.recorded_by) ? "malformed_field" : "missing_required_field",
    });
  } else if (recordedByResult.incomplete) {
    addIssue({ field: "recorded_by", code: "incomplete_actor" });
  }

  // --- opening_event_id (required) ------------------------------------------
  let openingEventId: string | null = null;
  if (typeof wire.opening_event_id === "string" && wire.opening_event_id.trim()) {
    openingEventId = wire.opening_event_id.trim();
  } else if (isPresent(wire.opening_event_id)) {
    addIssue({ field: "opening_event_id", code: "malformed_field" });
  } else {
    addIssue({ field: "opening_event_id", code: "missing_required_field" });
  }

  // --- opening_type (required enum) -----------------------------------------
  let openingType: ClinicalOpeningType | null = null;
  if (typeof wire.opening_type === "string") {
    if (CLINICAL_OPENING_TYPES.includes(wire.opening_type as ClinicalOpeningType)) {
      openingType = wire.opening_type as ClinicalOpeningType;
    } else {
      addIssue({ field: "opening_type", code: "unrecognized_value", detail: wire.opening_type });
    }
  } else if (isPresent(wire.opening_type)) {
    addIssue({ field: "opening_type", code: "malformed_field" });
  } else {
    addIssue({ field: "opening_type", code: "missing_required_field" });
  }

  // --- primary_professional (optional) --------------------------------------
  const primaryProfessional = parseProfessional(wire.primary_professional);

  // --- closure block (all optional) -----------------------------------------
  const closedAt = parseTimestamp(wire.closed_at);
  if (closedAt === null && isPresent(wire.closed_at)) {
    addIssue({ field: "closed_at", code: "malformed_timestamp" });
  }

  const closedByResult = parseClinicalActor(wire.closed_by);
  const closedBy = closedByResult.actor;
  if (closedBy === null && isPresent(wire.closed_by)) {
    addIssue({ field: "closed_by", code: "malformed_field" });
  }

  let closureType: ClinicalClosureType | null = null;
  if (typeof wire.closure_type === "string") {
    if (CLINICAL_CLOSURE_TYPES.includes(wire.closure_type as ClinicalClosureType)) {
      closureType = wire.closure_type as ClinicalClosureType;
    } else {
      addIssue({ field: "closure_type", code: "unrecognized_value", detail: wire.closure_type });
    }
  } else if (isPresent(wire.closure_type)) {
    addIssue({ field: "closure_type", code: "malformed_field" });
  }

  const closureReason =
    typeof wire.closure_reason === "string" && wire.closure_reason.trim()
      ? wire.closure_reason.trim()
      : null;

  // --- derived optional fields: ABSENT !== false, ABSENT !== 0 --------------
  const hasActiveRestriction = parseOptionalBoolean(
    wire.has_active_restriction,
    "has_active_restriction",
    addIssue
  );
  const hasPendingSchedule = parseOptionalBoolean(
    wire.has_pending_schedule,
    "has_pending_schedule",
    addIssue
  );
  const activeTreatmentsCount = parseOptionalCount(
    wire.active_treatments_count,
    "active_treatments_count",
    addIssue
  );
  const eventCount = parseOptionalCount(wire.event_count, "event_count", addIssue);

  // last_event_at: derived, optional. NEVER substituted by opened_at here.
  let lastEventAt: Date | null = null;
  if (isPresent(wire.last_event_at)) {
    lastEventAt = parseTimestamp(wire.last_event_at);
    if (lastEventAt === null) {
      addIssue({ field: "last_event_at", code: "malformed_timestamp" });
    }
  }

  // --- schema_version (required) --------------------------------------------
  let schemaVersion: number | null = null;
  if (typeof wire.schema_version === "number" && Number.isFinite(wire.schema_version)) {
    schemaVersion = wire.schema_version;
  } else if (isPresent(wire.schema_version)) {
    addIssue({ field: "schema_version", code: "malformed_field" });
  } else {
    addIssue({ field: "schema_version", code: "missing_required_field" });
  }

  const dataQuality = issues.length === 0 ? "complete" : "partial";

  return {
    dogId,
    caseId,
    clinicalStatus,
    rawClinicalStatus,
    title,
    openedAt,
    openedBy,
    recordedBy,
    openingEventId,
    openingType,
    primaryProfessional,
    closedAt,
    closedBy,
    closureType,
    closureReason,
    hasActiveRestriction,
    hasPendingSchedule,
    activeTreatmentsCount,
    lastEventAt,
    eventCount,
    schemaVersion,
    dataQuality,
    issues,
  };
}

/**
 * Optional derived boolean. Absent -> null (never false). Present non-boolean
 * -> null + malformed issue.
 */
function parseOptionalBoolean(
  raw: unknown,
  field: string,
  addIssue: (issue: ClinicalCaseParseIssue) => void
): boolean | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw;
  addIssue({ field, code: "malformed_field" });
  return null;
}

/**
 * Optional derived count. Absent -> null (never 0). Present 0 -> 0. Present
 * non-finite / negative / non-number -> null + malformed issue.
 */
function parseOptionalCount(
  raw: unknown,
  field: string,
  addIssue: (issue: ClinicalCaseParseIssue) => void
): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
  addIssue({ field, code: "malformed_field" });
  return null;
}
