/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Strict Firestore Wire Document Parsers
 *
 * Implements strict, safe parsing of snake_case Firestore wire documents into
 * typed canonical domain models according to:
 * - HEALTH_V1_FIRESTORE_SCHEMA.md
 * - HEALTH_V1_READINESS_POLICY.md
 * - HW-3A Corrective Review §1, §4, §7
 */

import { parseTimestamp } from "./freshness-policy";
import {
  OFFICIAL_READINESS_STATUSES,
  READINESS_STATUS_LABELS,
  type CanonicalHealthSummaryDoc,
  type CanonicalRestrictionDoc,
  type HealthDocumentRefWire,
  type HealthSummaryWireDoc,
  type OperationalRestrictionWireDoc,
  type ProfessionalIdentityWire,
  type ReadinessStatus,
  type RecordedByWire,
} from "./readiness-types";

/**
 * Safely parses a `RecordedBy` wire field (which can be a structured object or a raw RA string).
 */
export function parseRecordedBy(raw: unknown): RecordedByWire | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    return { ra: raw };
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.ra === "string") {
      return {
        ra: obj.ra,
        name: typeof obj.name === "string" ? obj.name : null,
        role: typeof obj.role === "string" ? obj.role : null,
      };
    }
  }
  return null;
}

/**
 * Safely parses a `ProfessionalIdentity` wire field (which can be a structured object or a string name).
 */
export function parseProfessionalIdentity(raw: unknown): ProfessionalIdentityWire | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    return { name: raw };
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.name === "string") {
      return {
        name: obj.name,
        crmv: typeof obj.crmv === "string" ? obj.crmv : null,
        clinic: typeof obj.clinic === "string" ? obj.clinic : null,
      };
    }
  }
  return null;
}

/**
 * Safely parses a `HealthDocumentRef` wire field.
 */
export function parseHealthDocumentRef(raw: unknown): HealthDocumentRefWire | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    return { url: raw };
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    return {
      id: typeof obj.id === "string" ? obj.id : null,
      name: typeof obj.name === "string" ? obj.name : null,
      url: typeof obj.url === "string" ? obj.url : null,
    };
  }
  return null;
}

/**
 * Parses a raw `health_summary/current` Firestore wire document into a CanonicalHealthSummaryDoc.
 */
export function parseHealthSummaryWireDoc(
  rawWire: Record<string, unknown> | null | undefined,
  dogId: string
): CanonicalHealthSummaryDoc | null {
  if (!rawWire || typeof rawWire !== "object") {
    return null;
  }

  const wire = rawWire as HealthSummaryWireDoc;

  const rawStatus = typeof wire.readiness_status === "string" ? wire.readiness_status : "not_evaluated";
  const isValidEnum = OFFICIAL_READINESS_STATUSES.includes(rawStatus as ReadinessStatus);
  const readinessStatus: ReadinessStatus | string = isValidEnum ? (rawStatus as ReadinessStatus) : rawStatus;
  const readinessLabel = isValidEnum ? READINESS_STATUS_LABELS[rawStatus as ReadinessStatus] : null;

  const readinessUpdatedAt = parseTimestamp(wire.readiness_updated_at);
  const lastEvaluatedAt = parseTimestamp(wire.last_evaluated_at);
  const updatedAt = parseTimestamp(wire.updated_at);

  const activeRestrictions = Array.isArray(wire.active_restrictions)
    ? (wire.active_restrictions as Array<Record<string, unknown>>)
    : [];

  const rawCounts = wire.restriction_count;
  const restrictionCount = {
    absolute: typeof rawCounts?.absolute === "number" ? rawCounts.absolute : 0,
    partial: typeof rawCounts?.partial === "number" ? rawCounts.partial : 0,
    attention: typeof rawCounts?.attention === "number" ? rawCounts.attention : 0,
  };

  const rawCompleteness = wire.data_completeness;
  const dataCompleteness = rawCompleteness && typeof rawCompleteness === "object"
    ? {
        hasRecentWeight: Boolean(rawCompleteness.has_recent_weight),
        hasActiveNutrition: Boolean(rawCompleteness.has_active_nutrition),
        hasVaccinationCurrent: Boolean(rawCompleteness.has_vaccination_current),
        hasRecentExam: Boolean(rawCompleteness.has_recent_exam),
      }
    : null;

  const schemaVersion = typeof wire.schema_version === "number" ? wire.schema_version : null;

  return {
    dogId,
    readinessStatus,
    readinessLabel,
    readinessReason: typeof wire.readiness_reason === "string" ? wire.readiness_reason : null,
    readinessUpdatedAt,
    lastEvaluatedAt,
    updatedAt,
    evaluatedBy: typeof wire.evaluated_by === "string" ? wire.evaluated_by : null,
    activeRestrictions,
    restrictionCount,
    dataCompleteness,
    activeCasesCount: typeof wire.active_cases_count === "number" ? wire.active_cases_count : 0,
    activeTreatmentsCount: typeof wire.active_treatments_count === "number" ? wire.active_treatments_count : 0,
    pendingScheduleCount: typeof wire.pending_schedule_count === "number" ? wire.pending_schedule_count : 0,
    overdueScheduleCount: typeof wire.overdue_schedule_count === "number" ? wire.overdue_schedule_count : 0,
    schemaVersion,
    rawWireDoc: wire,
  };
}

/**
 * Parses a raw `operational_restrictions` Firestore wire document into a CanonicalRestrictionDoc.
 */
export function parseOperationalRestrictionWireDoc(
  rawWire: Record<string, unknown> | null | undefined,
  id: string,
  dogId: string
): CanonicalRestrictionDoc | null {
  if (!rawWire || typeof rawWire !== "object") {
    return null;
  }

  const wire = rawWire as OperationalRestrictionWireDoc;

  const level = typeof wire.level === "string" ? wire.level.toLowerCase() : "attention";
  const status = typeof wire.status === "string" ? wire.status.toLowerCase() : "active";

  const description = typeof wire.description === "string" ? wire.description : "Restrição registrada";

  const activitiesRestricted = Array.isArray(wire.activities_restricted)
    ? wire.activities_restricted.filter((a): a is string => typeof a === "string")
    : [];

  const issuedAt = parseTimestamp(wire.issued_at) ?? new Date();
  const expectedEnd = parseTimestamp(wire.expected_end);
  const actualEnd = parseTimestamp(wire.actual_end);

  const recordedBy = parseRecordedBy(wire.recorded_by);
  const professional = parseProfessionalIdentity(wire.professional);
  const sourceDocument = parseHealthDocumentRef(wire.source_document);

  const endedBy = parseRecordedBy(wire.ended_by);
  const endProfessional = parseProfessionalIdentity(wire.end_professional);
  const endSourceDocument = parseHealthDocumentRef(wire.end_source_document);

  const schemaVersion = typeof wire.schema_version === "number" ? wire.schema_version : null;

  return {
    id,
    dogId,
    level,
    category: typeof wire.category === "string" ? wire.category : "operational",
    description,
    activitiesRestricted,
    issuedAt,
    recordedBy,
    professional,
    sourceDocument,
    expectedEnd,
    actualEnd,
    endedBy,
    endProfessional,
    endSourceDocument,
    endReason: typeof wire.end_reason === "string" ? wire.end_reason : null,
    evidence: typeof wire.evidence === "object" && wire.evidence !== null ? wire.evidence : null,
    status,
    caseId: typeof wire.case_id === "string" ? wire.case_id : null,
    eventId: typeof wire.event_id === "string" ? wire.event_id : null,
    examId: typeof wire.exam_id === "string" ? wire.exam_id : null,
    schemaVersion,
    rawWireDoc: wire,
  };
}
