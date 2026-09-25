import {
  callHealthRestrictionCancel,
  callHealthRestrictionEnd,
} from "@/lib/firebase/functions";

export type RestrictionStatus = "active" | "ended" | "cancelled";

export type RestrictionLevel = "absolute" | "partial" | "attention";

export type RestrictionProfessional = {
  clinic?: string | null;
  name: string;
  registration_number: string;
  registration_type: string;
  specialty?: string | null;
};

export type RestrictionSourceDocument = {
  description?: string | null;
  health_document_id: string;
};

export type RestrictionRecordedBy = {
  internal_role?: string | null;
  name: string;
  uid: string;
};

export type OperationalRestriction = {
  actual_end?: Date | null;
  cancel_reason?: string | null;
  cancelled_at?: Date | null;
  cancelled_by?: RestrictionRecordedBy | null;
  category: string;
  description: string;
  dogId: string;
  end_professional?: RestrictionProfessional | null;
  end_reason?: string | null;
  end_source_document?: RestrictionSourceDocument | null;
  ended_by?: RestrictionRecordedBy | null;
  expected_end: Date | null;
  id: string;
  issued_at: Date;
  level: RestrictionLevel;
  professional: RestrictionProfessional;
  recorded_by: RestrictionRecordedBy;
  source_document: RestrictionSourceDocument;
  status: RestrictionStatus;
};

export type EndHealthRestrictionInput = {
  dogId: string;
  endProfessional: {
    clinic?: string | null;
    name: string;
    registration_number: string;
    registration_type: string;
    specialty?: string | null;
  };
  endReason: string;
  endSourceDocument: {
    description?: string | null;
    health_document_id: string;
  };
  idempotencyKey?: string;
  restrictionId: string;
};

export type CancelHealthRestrictionInput = {
  cancelReason: string;
  dogId: string;
  idempotencyKey?: string;
  restrictionId: string;
};

export function generateIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `key_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : null;
    }
  }
  return null;
}

function parseProfessional(raw: unknown): RestrictionProfessional {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    clinic: typeof obj.clinic === "string" ? obj.clinic.trim() : null,
    name: typeof obj.name === "string" ? obj.name.trim() : "",
    registration_number:
      typeof obj.registration_number === "string"
        ? obj.registration_number.trim()
        : typeof obj.registrationNumber === "string"
          ? obj.registrationNumber.trim()
          : "",
    registration_type:
      typeof obj.registration_type === "string"
        ? obj.registration_type.trim()
        : typeof obj.registrationType === "string"
          ? obj.registrationType.trim()
          : "CRMV",
    specialty: typeof obj.specialty === "string" ? obj.specialty.trim() : null,
  };
}

function parseSourceDocument(raw: unknown): RestrictionSourceDocument {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    description:
      typeof obj.description === "string" ? obj.description.trim() : null,
    health_document_id:
      typeof obj.health_document_id === "string"
        ? obj.health_document_id.trim()
        : typeof obj.healthDocumentId === "string"
          ? obj.healthDocumentId.trim()
          : "",
  };
}

function parseRecordedBy(raw: unknown): RestrictionRecordedBy {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    internal_role:
      typeof obj.internal_role === "string"
        ? obj.internal_role.trim()
        : typeof obj.internalRole === "string"
          ? obj.internalRole.trim()
          : null,
    name: typeof obj.name === "string" ? obj.name.trim() : "",
    uid: typeof obj.uid === "string" ? obj.uid.trim() : "",
  };
}

function normalizeStatus(value: unknown): RestrictionStatus {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "ended" || raw === "encerrada" || raw === "liberada") {
    return "ended";
  }
  if (raw === "cancelled" || raw === "invalidada" || raw === "cancelada") {
    return "cancelled";
  }
  return "active";
}

function normalizeLevel(value: unknown): RestrictionLevel {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "absolute" || raw === "absoluta") return "absolute";
  if (raw === "partial" || raw === "parcial") return "partial";
  return "attention";
}

export function parseOperationalRestriction(
  id: string,
  dogId: string,
  data: Record<string, unknown>,
): OperationalRestriction {
  const issuedAt =
    parseDateValue(data.issued_at ?? data.issuedAt ?? data.created_at) ??
    new Date();
  const expectedEnd = parseDateValue(
    data.expected_end ?? data.expectedEnd ?? data.estimated_end,
  );
  const actualEnd = parseDateValue(data.actual_end ?? data.actualEnd);
  const cancelledAt = parseDateValue(data.cancelled_at ?? data.cancelledAt);

  return {
    actual_end: actualEnd,
    cancel_reason:
      typeof data.cancel_reason === "string"
        ? data.cancel_reason
        : typeof data.cancelReason === "string"
          ? data.cancelReason
          : null,
    cancelled_at: cancelledAt,
    cancelled_by: data.cancelled_by ? parseRecordedBy(data.cancelled_by) : null,
    category: typeof data.category === "string" ? data.category : "Geral",
    description:
      typeof data.description === "string" ? data.description : "",
    dogId: (typeof data.dogId === "string" ? data.dogId : null) || dogId,
    end_professional: data.end_professional
      ? parseProfessional(data.end_professional)
      : data.endProfessional
        ? parseProfessional(data.endProfessional)
        : null,
    end_reason:
      typeof data.end_reason === "string"
        ? data.end_reason
        : typeof data.endReason === "string"
          ? data.endReason
          : null,
    end_source_document: data.end_source_document
      ? parseSourceDocument(data.end_source_document)
      : data.endSourceDocument
        ? parseSourceDocument(data.endSourceDocument)
        : null,
    ended_by: data.ended_by
      ? parseRecordedBy(data.ended_by)
      : data.endedBy
        ? parseRecordedBy(data.endedBy)
        : null,
    expected_end: expectedEnd,
    id,
    issued_at: issuedAt,
    level: normalizeLevel(data.level),
    professional: parseProfessional(data.professional),
    recorded_by: parseRecordedBy(data.recorded_by ?? data.recordedBy),
    source_document: parseSourceDocument(
      data.source_document ?? data.sourceDocument,
    ),
    status: normalizeStatus(data.status),
  };
}

export async function endHealthRestriction(input: EndHealthRestrictionInput) {
  const idempotencyKey = input.idempotencyKey ?? generateIdempotencyKey();
  const response = await callHealthRestrictionEnd({
    dogId: input.dogId,
    endProfessional: {
      clinic: input.endProfessional.clinic
        ? input.endProfessional.clinic.trim()
        : null,
      name: input.endProfessional.name.trim(),
      registration_number: input.endProfessional.registration_number.trim(),
      registration_type: input.endProfessional.registration_type.trim(),
      specialty: input.endProfessional.specialty
        ? input.endProfessional.specialty.trim()
        : null,
    },
    endReason: input.endReason.trim(),
    endSourceDocument: {
      description: input.endSourceDocument.description
        ? input.endSourceDocument.description.trim()
        : null,
      health_document_id: input.endSourceDocument.health_document_id.trim(),
    },
    idempotencyKey,
    restrictionId: input.restrictionId,
  });

  return response.data;
}

export async function cancelHealthRestriction(
  input: CancelHealthRestrictionInput,
) {
  const idempotencyKey = input.idempotencyKey ?? generateIdempotencyKey();
  const response = await callHealthRestrictionCancel({
    cancelReason: input.cancelReason.trim(),
    dogId: input.dogId,
    idempotencyKey,
    restrictionId: input.restrictionId,
  });

  return response.data;
}
