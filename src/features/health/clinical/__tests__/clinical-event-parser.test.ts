import { describe, expect, it } from "vitest";
import {
  parseClinicalEventWireDoc,
  parseClinicalAmendmentWireDoc,
} from "../parser/clinical-event-parser";

describe("ClinicalEventDocumentParser (Front 30 Web Intake)", () => {
  const dogId = "k9-apollo";
  const caseId = "case-2026-001";
  const eventId = "event-100";

  it("parses a valid complete clinical event successfully", () => {
    const raw = {
      dog_id: dogId,
      case_id: caseId,
      event_id: eventId,
      event_type: "consultation",
      status: "final",
      occurred_at: "2026-09-01T10:00:00.000Z",
      recorded_at: "2026-09-01T10:05:00.000Z",
      updated_at: "2026-09-01T10:05:00.000Z",
      recorded_by: {
        uid: "user-1",
        name: "Sgt. Silva",
        internal_role: "condutor_k9",
      },
      payload_type: "clinical_consultation",
      payload_version: 1,
      schema_version: 1,
      revision: 1,
      content: {
        anamnesis: "Paciente sem queixas.",
        physical_exam: "Parâmetros normais.",
      },
      attachment_refs: ["doc-1", "doc-2"],
      has_amendments: false,
      amendment_count: 0,
      professional: {
        name: "Dr. Roberto",
        registration_type: "CRMV-SP",
        registration_number: "12345",
        clinic: "Hospital Veterinário K9",
      },
    };

    const parsed = parseClinicalEventWireDoc(raw, eventId, caseId, dogId);

    expect(parsed.id).toBe(eventId);
    expect(parsed.dogId).toBe(dogId);
    expect(parsed.caseId).toBe(caseId);
    expect(parsed.type).toBe("consultation");
    expect(parsed.rawType).toBe("consultation");
    expect(parsed.status).toBe("final");
    expect(parsed.occurredAt?.toISOString()).toBe("2026-09-01T10:00:00.000Z");
    expect(parsed.recordedAt?.toISOString()).toBe("2026-09-01T10:05:00.000Z");
    expect(parsed.recordedBy).toEqual({
      uid: "user-1",
      name: "Sgt. Silva",
      internalRole: "condutor_k9",
    });
    expect(parsed.content).toEqual({
      anamnesis: "Paciente sem queixas.",
      physical_exam: "Parâmetros normais.",
    });
    expect(parsed.attachmentRefs).toEqual(["doc-1", "doc-2"]);
    expect(parsed.hasAmendments).toBe(false);
    expect(parsed.amendmentCount).toBe(0);
    expect(parsed.professional?.name).toBe("Dr. Roberto");
    expect(parsed.professional?.formattedRegistration).toBe("CRMV-SP 12345");
    expect(parsed.dataQualityIssues).toEqual([]);
  });

  it("preserves DocumentSnapshot.id authority over redundant persisted event_id mismatch", () => {
    const raw = {
      event_id: "divergent-event-id",
      event_type: "observation",
      status: "draft",
      occurred_at: "2026-09-01T10:00:00.000Z",
      recorded_at: "2026-09-01T10:05:00.000Z",
      recorded_by: { uid: "u1", name: "User", internal_role: "admin" },
      payload_type: "note",
      payload_version: 1,
      schema_version: 1,
      revision: 1,
    };

    const parsed = parseClinicalEventWireDoc(raw, eventId, caseId, dogId);

    expect(parsed.id).toBe(eventId); // Authoritative snapshot ID preserved!
    expect(parsed.dataQualityIssues).toContain("persisted_event_id_mismatch");
  });

  it("handles path document dog_id and case_id mismatches defensively", () => {
    const raw = {
      dog_id: "other-dog",
      case_id: "other-case",
      event_type: "general_note",
      status: "final",
      occurred_at: "2026-09-01T10:00:00.000Z",
      recorded_at: "2026-09-01T10:05:00.000Z",
      recorded_by: { uid: "u1", name: "User", internal_role: "admin" },
      payload_type: "note",
      payload_version: 1,
      schema_version: 1,
      revision: 1,
    };

    const parsed = parseClinicalEventWireDoc(raw, eventId, caseId, dogId);

    expect(parsed.dogId).toBe(dogId);
    expect(parsed.caseId).toBe(caseId);
    expect(parsed.dataQualityIssues).toContain("path_document_dog_id_mismatch");
    expect(parsed.dataQualityIssues).toContain("path_document_case_id_mismatch");
  });

  it("strictly enforces UNKNOWN semantics: missing fields NEVER become false/0/[] (Rule 7.1)", () => {
    const raw = {
      event_type: "consultation",
      status: "final",
      occurred_at: "2026-09-01T10:00:00.000Z",
      recorded_at: "2026-09-01T10:05:00.000Z",
      recorded_by: { uid: "u1", name: "User", internal_role: "handler" },
      payload_type: "consultation",
      payload_version: 1,
      schema_version: 1,
      revision: 1,
      // NOTE: attachment_refs, has_amendments, amendment_count are completely missing!
    };

    const parsed = parseClinicalEventWireDoc(raw, eventId, caseId, dogId);

    expect(parsed.hasAmendments).toBeNull(); // NOT false
    expect(parsed.amendmentCount).toBeNull(); // NOT 0
    expect(parsed.attachmentRefs).toBeNull(); // NOT []
  });

  it("handles unknown event type safely without crashing", () => {
    const raw = {
      event_type: "future_telemetry_event",
      status: "final",
      occurred_at: "2026-09-01T10:00:00.000Z",
      recorded_at: "2026-09-01T10:05:00.000Z",
      recorded_by: { uid: "u1", name: "User", internal_role: "admin" },
      payload_type: "telemetry",
      payload_version: 1,
      schema_version: 1,
      revision: 1,
    };

    const parsed = parseClinicalEventWireDoc(raw, eventId, caseId, dogId);

    expect(parsed.type).toBeNull();
    expect(parsed.rawType).toBe("future_telemetry_event");
    expect(parsed.dataQualityIssues).toContain("unknown_event_type:future_telemetry_event");
  });

  it("handles unknown event status safely", () => {
    const raw = {
      event_type: "consultation",
      status: "archived_legacy",
      occurred_at: "2026-09-01T10:00:00.000Z",
      recorded_at: "2026-09-01T10:05:00.000Z",
      recorded_by: { uid: "u1", name: "User", internal_role: "admin" },
      payload_type: "note",
      payload_version: 1,
      schema_version: 1,
      revision: 1,
    };

    const parsed = parseClinicalEventWireDoc(raw, eventId, caseId, dogId);

    expect(parsed.status).toBeNull();
    expect(parsed.rawStatus).toBe("archived_legacy");
    expect(parsed.dataQualityIssues).toContain("unknown_event_status:archived_legacy");
  });

  it("handles missing and malformed timestamps defensively", () => {
    const raw = {
      event_type: "consultation",
      status: "final",
      occurred_at: "not-a-date",
      // recorded_at is omitted
      recorded_by: { uid: "u1", name: "User", internal_role: "admin" },
      payload_type: "note",
      payload_version: 1,
      schema_version: 1,
      revision: 1,
    };

    const parsed = parseClinicalEventWireDoc(raw, eventId, caseId, dogId);

    expect(parsed.occurredAt).toBeNull();
    expect(parsed.recordedAt).toBeNull();
    expect(parsed.dataQualityIssues).toContain("malformed_occurred_at");
    expect(parsed.dataQualityIssues).toContain("missing_recorded_at");
  });

  it("records degradation for incomplete recorded_by actor", () => {
    const raw = {
      event_type: "consultation",
      status: "final",
      occurred_at: "2026-09-01T10:00:00.000Z",
      recorded_at: "2026-09-01T10:05:00.000Z",
      recorded_by: { uid: "u1", name: "" }, // missing internal_role and empty name
      payload_type: "note",
      payload_version: 1,
      schema_version: 1,
      revision: 1,
    };

    const parsed = parseClinicalEventWireDoc(raw, eventId, caseId, dogId);

    expect(parsed.recordedBy?.uid).toBe("u1");
    expect(parsed.recordedBy?.name).toBeNull();
    expect(parsed.recordedBy?.internalRole).toBeNull();
    expect(parsed.dataQualityIssues).toContain("recorded_by_missing_name");
    expect(parsed.dataQualityIssues).toContain("recorded_by_missing_internal_role");
  });

  it("parses cancelled event requirements correctly", () => {
    const raw = {
      event_type: "consultation",
      status: "cancelled",
      occurred_at: "2026-09-01T10:00:00.000Z",
      recorded_at: "2026-09-01T10:05:00.000Z",
      recorded_by: { uid: "u1", name: "User", internal_role: "condutor_k9" },
      payload_type: "note",
      payload_version: 1,
      schema_version: 1,
      revision: 1,
      cancel_reason: "Erro de digitação",
      cancelled_at: "2026-09-01T11:00:00.000Z",
      cancelled_by: { uid: "u2", name: "Gestor", internal_role: "admin" },
    };

    const parsed = parseClinicalEventWireDoc(raw, eventId, caseId, dogId);

    expect(parsed.status).toBe("cancelled");
    expect(parsed.cancelReason).toBe("Erro de digitação");
    expect(parsed.cancelledAt?.toISOString()).toBe("2026-09-01T11:00:00.000Z");
    expect(parsed.cancelledBy?.name).toBe("Gestor");
    expect(parsed.dataQualityIssues).toEqual([]);
  });

  it("detects cancelled event missing required cancellation metadata", () => {
    const raw = {
      event_type: "consultation",
      status: "cancelled",
      occurred_at: "2026-09-01T10:00:00.000Z",
      recorded_at: "2026-09-01T10:05:00.000Z",
      recorded_by: { uid: "u1", name: "User", internal_role: "condutor_k9" },
      payload_type: "note",
      payload_version: 1,
      schema_version: 1,
      revision: 1,
      // cancel_reason, cancelled_at, cancelled_by omitted!
    };

    const parsed = parseClinicalEventWireDoc(raw, eventId, caseId, dogId);

    expect(parsed.status).toBe("cancelled");
    expect(parsed.dataQualityIssues).toContain("cancelled_event_missing_reason");
    expect(parsed.dataQualityIssues).toContain("cancelled_event_missing_timestamp");
    expect(parsed.dataQualityIssues).toContain("cancelled_event_missing_actor");
  });

  it("handles amendment count and has_amendments inconsistency", () => {
    const raw = {
      event_type: "consultation",
      status: "final",
      occurred_at: "2026-09-01T10:00:00.000Z",
      recorded_at: "2026-09-01T10:05:00.000Z",
      recorded_by: { uid: "u1", name: "User", internal_role: "condutor_k9" },
      payload_type: "note",
      payload_version: 1,
      schema_version: 1,
      revision: 1,
      has_amendments: true,
      amendment_count: 0,
    };

    const parsed = parseClinicalEventWireDoc(raw, eventId, caseId, dogId);

    expect(parsed.dataQualityIssues).toContain(
      "inconsistent_amendments:has_amendments_true_with_zero_count"
    );
  });

  it("returns safe fallback on non-object wire doc without throwing", () => {
    const parsed = parseClinicalEventWireDoc(null, eventId, caseId, dogId);

    expect(parsed.id).toBe(eventId);
    expect(parsed.dataQualityIssues).toContain("malformed_document");
  });
});

describe("ClinicalAmendmentDocumentParser (Front 30 Web Intake)", () => {
  const dogId = "k9-apollo";
  const caseId = "case-2026-001";
  const eventId = "event-100";
  const amendmentId = "amend-001";

  it("parses a valid complete clinical amendment successfully", () => {
    const raw = {
      dog_id: dogId,
      case_id: caseId,
      event_id: eventId,
      type: "correction",
      reason: "Correção na posologia do antibiótico",
      recorded_at: "2026-09-01T12:00:00.000Z",
      recorded_by: {
        uid: "user-2",
        name: "Cabo Souza",
        internal_role: "operador",
      },
      payload_type: "posology_correction",
      payload_version: 1,
      schema_version: 1,
      content: { dosage: "250mg 2x/dia" },
    };

    const parsed = parseClinicalAmendmentWireDoc(
      raw,
      amendmentId,
      eventId,
      caseId,
      dogId,
      1
    );

    expect(parsed.id).toBe(amendmentId);
    expect(parsed.eventId).toBe(eventId);
    expect(parsed.caseId).toBe(caseId);
    expect(parsed.dogId).toBe(dogId);
    expect(parsed.type).toBe("correction");
    expect(parsed.rawType).toBe("correction");
    expect(parsed.reason).toBe("Correção na posologia do antibiótico");
    expect(parsed.recordedAt?.toISOString()).toBe("2026-09-01T12:00:00.000Z");
    expect(parsed.recordedBy?.name).toBe("Cabo Souza");
    expect(parsed.content).toEqual({ dosage: "250mg 2x/dia" });
    expect(parsed.ordinal).toBe(1);
    expect(parsed.dataQualityIssues).toEqual([]);
  });

  it("handles unknown amendment type and missing reason defensively", () => {
    const raw = {
      type: "custom_type",
      reason: "",
      recorded_at: "2026-09-01T12:00:00.000Z",
      recorded_by: { uid: "u1", name: "Sgt. Silva", internal_role: "condutor_k9" },
    };

    const parsed = parseClinicalAmendmentWireDoc(
      raw,
      amendmentId,
      eventId,
      caseId,
      dogId
    );

    expect(parsed.type).toBeNull();
    expect(parsed.rawType).toBe("custom_type");
    expect(parsed.reason).toBe("");
    expect(parsed.dataQualityIssues).toContain("unknown_amendment_type:custom_type");
    expect(parsed.dataQualityIssues).toContain("missing_amendment_reason");
  });

  it("handles non-object amendment wire doc safely", () => {
    const parsed = parseClinicalAmendmentWireDoc(
      null,
      amendmentId,
      eventId,
      caseId,
      dogId
    );

    expect(parsed.id).toBe(amendmentId);
    expect(parsed.dataQualityIssues).toContain("malformed_document");
  });
});
