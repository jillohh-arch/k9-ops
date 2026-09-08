/**
 * K9 Ops Web — Health Web v1 HW-6B / F20.1 Intake
 * ClinicalEvent and ClinicalAmendment Fail-Safe Parsers
 *
 * Authoritative runtime read contract:
 * - F20.1 frozen runtime read contract @ 288c2e0 (authoritative)
 *
 * Background references (historical schema):
 * - HEALTH_V1_FIRESTORE_SCHEMA.md §2.2 (`clinical_events/{eventId}`)
 * - HEALTH_V1_FIRESTORE_SCHEMA.md §2.3 (`clinical_amendments/{amendmentId}`)
 *
 * Invariants:
 * 1. Does NOT throw fatal exceptions on individual malformed documents.
 * 2. Does NOT invent missing clinical data (Rule 7.1: UNKNOWN != false, UNKNOWN != 0, UNKNOWN != []).
 * 3. Strictly distinguishes `occurred_at` (clinical occurrence) from `recorded_at` (server write).
 * 4. DocumentSnapshot.id is authoritative identity; redundant persisted IDs are validated but never override snapshot id.
 * 5. Preserves unknown enums and open payload contracts in their raw forms.
 * 6. Records integrity degradation in `dataQualityIssues`.
 */

import { parseTimestamp } from "../../domain/freshness-policy";
import {
  CLINICAL_EVENT_TYPES,
  CLINICAL_EVENT_STATUSES,
  CLINICAL_AMENDMENT_TYPES,
  type ClinicalEventType,
  type ClinicalEventStatus,
  type ClinicalAmendmentType,
  type ClinicalEventReadModel,
  type ClinicalAmendmentReadModel,
  type ClinicalProfessionalReadModel,
  type RecordedByReadModel,
} from "../types";

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function parseActor(
  raw: unknown,
  issues: string[],
  prefix: string,
  isRequired: boolean = true
): RecordedByReadModel | null {
  if (!isPresent(raw)) {
    if (isRequired) issues.push(`missing_${prefix}`);
    return null;
  }
  if (typeof raw !== "object" || raw === null) {
    issues.push(`malformed_${prefix}`);
    return null;
  }

  const map = raw as Record<string, unknown>;
  const uid = typeof map.uid === "string" ? map.uid.trim() : "";
  const name = typeof map.name === "string" ? map.name.trim() : "";
  const rawRole = map.internal_role ?? map.internalRole ?? map.role;
  const internalRole = typeof rawRole === "string" ? rawRole.trim() : "";

  if (!uid) {
    issues.push(`${prefix}_missing_uid`);
  }
  if (!name) {
    issues.push(`${prefix}_missing_name`);
  }
  if (!internalRole) {
    issues.push(`${prefix}_missing_internal_role`);
  }

  if (!uid && !name && !internalRole) {
    return null;
  }

  return {
    uid: uid || null,
    name: name || null,
    internalRole: internalRole || null,
  };
}

function parseProfessional(raw: unknown): ClinicalProfessionalReadModel | null {
  if (!isPresent(raw) || typeof raw !== "object" || raw === null) {
    return null;
  }
  const map = raw as Record<string, unknown>;
  const name = typeof map.name === "string" && map.name.trim() ? map.name.trim() : null;
  const regType = map.registration_type ?? map.registrationType;
  const registrationType = typeof regType === "string" && regType.trim() ? regType.trim() : null;
  const regNum = map.registration_number ?? map.registrationNumber;
  const registrationNumber = typeof regNum === "string" && regNum.trim() ? regNum.trim() : null;
  const clinic = typeof map.clinic === "string" && map.clinic.trim() ? map.clinic.trim() : null;

  if (!name && !registrationType && !registrationNumber && !clinic) {
    return null;
  }

  const formattedParts: string[] = [];
  if (registrationType) formattedParts.push(registrationType);
  if (registrationNumber) formattedParts.push(registrationNumber);
  const formattedRegistration = formattedParts.length > 0 ? formattedParts.join(" ") : null;

  return {
    name,
    registrationType,
    registrationNumber,
    clinic,
    formattedRegistration,
    rawMap: map,
  };
}

function parseIntSafe(raw: unknown): number | null {
  if (!isPresent(raw)) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.floor(raw);
  if (typeof raw === "string" && raw.trim() !== "") {
    const num = Number(raw.trim());
    if (Number.isFinite(num)) return Math.floor(num);
  }
  return null;
}

export function parseClinicalEventWireDoc(
  rawWire: unknown,
  eventId: string,
  caseId: string,
  dogId: string
): ClinicalEventReadModel {
  const issues: string[] = [];

  if (!isPresent(rawWire) || typeof rawWire !== "object" || rawWire === null) {
    return {
      id: eventId,
      caseId,
      dogId,
      type: null,
      rawType: null,
      status: null,
      rawStatus: null,
      occurredAt: null,
      recordedAt: null,
      updatedAt: null,
      recordedBy: null,
      payloadType: null,
      payloadVersion: null,
      schemaVersion: null,
      revision: null,
      content: {},
      attachmentRefs: null,
      hasAmendments: null,
      amendmentCount: null,
      lastAmendedAt: null,
      finalizedAt: null,
      cancelReason: null,
      cancelledAt: null,
      cancelledBy: null,
      professional: null,
      examId: null,
      dataQualityIssues: ["malformed_document"],
      rawDoc: {},
    };
  }

  const data = rawWire as Record<string, unknown>;

  // Contextual identity checks (DocumentSnapshot.id is authoritative)
  if ("dog_id" in data) {
    const persistedDogId = typeof data.dog_id === "string" ? data.dog_id.trim() : "";
    if (persistedDogId && persistedDogId !== dogId) {
      issues.push("path_document_dog_id_mismatch");
    }
  }
  if ("case_id" in data) {
    const persistedCaseId = typeof data.case_id === "string" ? data.case_id.trim() : "";
    if (persistedCaseId && persistedCaseId !== caseId) {
      issues.push("path_document_case_id_mismatch");
    }
  }
  if ("event_id" in data) {
    const persistedEventId = typeof data.event_id === "string" ? data.event_id.trim() : "";
    if (persistedEventId && persistedEventId !== eventId) {
      issues.push("persisted_event_id_mismatch");
    }
  }

  // Event type
  const rawTypeVal = data.event_type ?? data.type;
  let type: ClinicalEventType | null = null;
  let rawType: string | null = null;
  if (!isPresent(rawTypeVal) || (typeof rawTypeVal === "string" && !rawTypeVal.trim())) {
    issues.push("missing_event_type");
  } else if (typeof rawTypeVal === "string") {
    rawType = rawTypeVal.trim();
    if (CLINICAL_EVENT_TYPES.includes(rawType as ClinicalEventType)) {
      type = rawType as ClinicalEventType;
    } else {
      issues.push(`unknown_event_type:${rawType}`);
    }
  } else {
    rawType = String(rawTypeVal);
    issues.push(`unknown_event_type:${rawType}`);
  }

  // Status
  const rawStatusVal = data.status;
  let status: ClinicalEventStatus | null = null;
  let rawStatus: string | null = null;
  if (!isPresent(rawStatusVal) || (typeof rawStatusVal === "string" && !rawStatusVal.trim())) {
    issues.push("missing_event_status");
  } else if (typeof rawStatusVal === "string") {
    rawStatus = rawStatusVal.trim();
    if (CLINICAL_EVENT_STATUSES.includes(rawStatus as ClinicalEventStatus)) {
      status = rawStatus as ClinicalEventStatus;
    } else {
      issues.push(`unknown_event_status:${rawStatus}`);
    }
  } else {
    rawStatus = String(rawStatusVal);
    issues.push(`unknown_event_status:${rawStatus}`);
  }

  // Temporal instances (occurred_at != recorded_at)
  const rawOccurred = data.occurred_at ?? data.occurredAt;
  let occurredAt: Date | null = null;
  if (!isPresent(rawOccurred)) {
    issues.push("missing_occurred_at");
  } else {
    occurredAt = parseTimestamp(rawOccurred);
    if (occurredAt === null) {
      issues.push("malformed_occurred_at");
    }
  }

  const rawRecorded = data.recorded_at ?? data.recordedAt;
  let recordedAt: Date | null = null;
  if (!isPresent(rawRecorded)) {
    issues.push("missing_recorded_at");
  } else {
    recordedAt = parseTimestamp(rawRecorded);
    if (recordedAt === null) {
      issues.push("malformed_recorded_at");
    }
  }

  const rawUpdated = data.updated_at ?? data.updatedAt;
  let updatedAt: Date | null = null;
  if (isPresent(rawUpdated)) {
    updatedAt = parseTimestamp(rawUpdated);
    if (updatedAt === null) {
      issues.push("malformed_updated_at");
    }
  }

  // Actor who recorded
  const recordedBy = parseActor(
    data.recorded_by ?? data.recordedBy,
    issues,
    "recorded_by",
    true
  );

  // Payload metadata
  const rawPayloadType = data.payload_type ?? data.payloadType;
  const payloadType = typeof rawPayloadType === "string" && rawPayloadType.trim() ? rawPayloadType.trim() : null;
  if (!payloadType) {
    issues.push("missing_payload_type");
  }

  const payloadVersion = parseIntSafe(data.payload_version ?? data.payloadVersion);
  if (payloadVersion === null) {
    issues.push("missing_payload_version");
  } else if (payloadVersion <= 0) {
    issues.push(`invalid_payload_version:${payloadVersion}`);
  }

  const schemaVersion = parseIntSafe(data.schema_version ?? data.schemaVersion);
  if (schemaVersion === null) {
    issues.push("missing_schema_version");
  } else if (schemaVersion <= 0) {
    issues.push(`invalid_schema_version:${schemaVersion}`);
  }

  const revision = parseIntSafe(data.revision);
  if (revision === null) {
    issues.push("missing_revision");
  } else if (revision <= 0) {
    issues.push(`invalid_revision:${revision}`);
  }

  // Clinical Content
  const rawContent = data.content;
  let content: Record<string, unknown> = {};
  if (isPresent(rawContent) && typeof rawContent === "object" && rawContent !== null && !Array.isArray(rawContent)) {
    content = rawContent as Record<string, unknown>;
  } else {
    if (isPresent(rawContent)) {
      issues.push("invalid_content_shape");
    }
    content = {};
  }

  // Attachment refs (HealthDocument IDs, not URLs. Rule 7.1: absent => null)
  let attachmentRefs: string[] | null = null;
  if ("attachment_refs" in data || "attachmentRefs" in data) {
    const rawAttachments = data.attachment_refs ?? data.attachmentRefs;
    if (Array.isArray(rawAttachments)) {
      attachmentRefs = rawAttachments.map((e) => String(e));
    } else {
      issues.push("malformed_attachment_refs");
      attachmentRefs = null;
    }
  } else {
    attachmentRefs = null;
  }

  // Amendment metadata (Rule 7.1: absent => null)
  let hasAmendments: boolean | null = null;
  if ("has_amendments" in data || "hasAmendments" in data) {
    const val = data.has_amendments ?? data.hasAmendments;
    if (typeof val === "boolean") {
      hasAmendments = val;
    } else {
      issues.push("malformed_has_amendments");
      hasAmendments = null;
    }
  } else {
    hasAmendments = null;
  }

  let amendmentCount: number | null = null;
  if ("amendment_count" in data || "amendmentCount" in data) {
    const rawCount = data.amendment_count ?? data.amendmentCount;
    if (typeof rawCount === "number" && Number.isFinite(rawCount)) {
      const count = Math.floor(rawCount);
      if (count < 0) {
        issues.push(`negative_amendment_count:${count}`);
        amendmentCount = null;
      } else {
        amendmentCount = count;
      }
    } else {
      issues.push("malformed_amendment_count");
      amendmentCount = null;
    }
  } else {
    amendmentCount = null;
  }

  // Internal consistency of amendment indicators when both are present
  if (hasAmendments !== null && amendmentCount !== null) {
    if (hasAmendments === true && amendmentCount === 0) {
      issues.push("inconsistent_amendments:has_amendments_true_with_zero_count");
    } else if (hasAmendments === false && amendmentCount > 0) {
      issues.push("inconsistent_amendments:has_amendments_false_with_positive_count");
    }
  }

  const rawLastAmended = data.last_amended_at ?? data.lastAmendedAt;
  let lastAmendedAt: Date | null = null;
  if (isPresent(rawLastAmended)) {
    lastAmendedAt = parseTimestamp(rawLastAmended);
    if (lastAmendedAt === null) {
      issues.push("malformed_last_amended_at");
    }
  }

  // Finalization metadata
  const rawFinalized = data.finalized_at ?? data.finalizedAt;
  let finalizedAt: Date | null = null;
  if (isPresent(rawFinalized)) {
    finalizedAt = parseTimestamp(rawFinalized);
    if (finalizedAt === null) {
      issues.push("malformed_finalized_at");
    }
  }

  // Cancellation metadata
  const rawCancelReason = data.cancel_reason ?? data.cancelReason;
  const cancelReason = typeof rawCancelReason === "string" && rawCancelReason.trim() ? rawCancelReason.trim() : null;

  const rawCancelledAt = data.cancelled_at ?? data.cancelledAt;
  let cancelledAt: Date | null = null;
  if (isPresent(rawCancelledAt)) {
    cancelledAt = parseTimestamp(rawCancelledAt);
    if (cancelledAt === null) {
      issues.push("malformed_cancelled_at");
    }
  }

  const cancelledBy = parseActor(
    data.cancelled_by ?? data.cancelledBy,
    issues,
    "cancelled_by",
    status === "cancelled"
  );

  if (status === "cancelled") {
    if (!cancelReason) issues.push("cancelled_event_missing_reason");
    if (!cancelledAt) issues.push("cancelled_event_missing_timestamp");
    if (!cancelledBy) issues.push("cancelled_event_missing_actor");
  }

  // External Professional
  const professional = parseProfessional(data.professional);

  // Exam ID
  const rawExamId = data.exam_id ?? data.examId;
  const examId = typeof rawExamId === "string" && rawExamId.trim() ? rawExamId.trim() : null;

  return {
    id: eventId,
    caseId,
    dogId,
    type,
    rawType,
    status,
    rawStatus,
    occurredAt,
    recordedAt,
    updatedAt,
    recordedBy,
    payloadType,
    payloadVersion,
    schemaVersion,
    revision,
    content,
    attachmentRefs,
    hasAmendments,
    amendmentCount,
    lastAmendedAt,
    finalizedAt,
    cancelReason,
    cancelledAt,
    cancelledBy,
    professional,
    examId,
    dataQualityIssues: issues,
    rawDoc: data,
  };
}

export function parseClinicalAmendmentWireDoc(
  rawWire: unknown,
  amendmentId: string,
  eventId: string,
  caseId: string,
  dogId: string,
  ordinal?: number
): ClinicalAmendmentReadModel {
  const issues: string[] = [];

  if (!isPresent(rawWire) || typeof rawWire !== "object" || rawWire === null) {
    return {
      id: amendmentId,
      eventId,
      caseId,
      dogId,
      type: null,
      rawType: null,
      reason: "",
      payloadType: null,
      payloadVersion: null,
      content: {},
      recordedBy: null,
      recordedAt: null,
      schemaVersion: null,
      ordinal,
      dataQualityIssues: ["malformed_document"],
      rawDoc: {},
    };
  }

  const data = rawWire as Record<string, unknown>;

  // Contextual path checks
  if ("dog_id" in data) {
    const persistedDogId = typeof data.dog_id === "string" ? data.dog_id.trim() : "";
    if (persistedDogId && persistedDogId !== dogId) {
      issues.push("path_document_dog_id_mismatch");
    }
  }
  if ("case_id" in data) {
    const persistedCaseId = typeof data.case_id === "string" ? data.case_id.trim() : "";
    if (persistedCaseId && persistedCaseId !== caseId) {
      issues.push("path_document_case_id_mismatch");
    }
  }
  if ("event_id" in data) {
    const persistedEventId = typeof data.event_id === "string" ? data.event_id.trim() : "";
    if (persistedEventId && persistedEventId !== eventId) {
      issues.push("persisted_event_id_mismatch");
    }
  }

  // Type
  const rawTypeVal = data.type;
  let type: ClinicalAmendmentType | null = null;
  let rawType: string | null = null;
  if (!isPresent(rawTypeVal) || (typeof rawTypeVal === "string" && !rawTypeVal.trim())) {
    issues.push("missing_amendment_type");
  } else if (typeof rawTypeVal === "string") {
    rawType = rawTypeVal.trim();
    if (CLINICAL_AMENDMENT_TYPES.includes(rawType as ClinicalAmendmentType)) {
      type = rawType as ClinicalAmendmentType;
    } else {
      issues.push(`unknown_amendment_type:${rawType}`);
    }
  } else {
    rawType = String(rawTypeVal);
    issues.push(`unknown_amendment_type:${rawType}`);
  }

  // Reason
  const rawReason = data.reason;
  let reason = "";
  if (typeof rawReason === "string" && rawReason.trim()) {
    reason = rawReason.trim();
  } else {
    issues.push("missing_amendment_reason");
    reason = typeof rawReason === "string" ? rawReason.trim() : (rawReason ? String(rawReason) : "");
  }

  // Recorded at
  const rawRecorded = data.recorded_at ?? data.recordedAt;
  let recordedAt: Date | null = null;
  if (!isPresent(rawRecorded)) {
    issues.push("missing_amendment_recorded_at");
  } else {
    recordedAt = parseTimestamp(rawRecorded);
    if (recordedAt === null) {
      issues.push("malformed_amendment_recorded_at");
    }
  }

  // Recorded by
  const recordedBy = parseActor(
    data.recorded_by ?? data.recordedBy,
    issues,
    "amendment_recorded_by",
    true
  );

  // Payload metadata
  const rawPayloadType = data.payload_type ?? data.payloadType;
  const payloadType = typeof rawPayloadType === "string" && rawPayloadType.trim() ? rawPayloadType.trim() : null;
  const payloadVersion = parseIntSafe(data.payload_version ?? data.payloadVersion);
  const schemaVersion = parseIntSafe(data.schema_version ?? data.schemaVersion);

  // Content
  const rawContent = data.content;
  let content: Record<string, unknown> = {};
  if (isPresent(rawContent) && typeof rawContent === "object" && rawContent !== null && !Array.isArray(rawContent)) {
    content = rawContent as Record<string, unknown>;
  } else {
    if (isPresent(rawContent)) {
      issues.push("invalid_amendment_content_shape");
    }
    content = {};
  }

  return {
    id: amendmentId,
    eventId,
    caseId,
    dogId,
    type,
    rawType,
    reason,
    payloadType,
    payloadVersion,
    content,
    recordedBy,
    recordedAt,
    schemaVersion,
    ordinal,
    dataQualityIssues: issues,
    rawDoc: data,
  };
}
