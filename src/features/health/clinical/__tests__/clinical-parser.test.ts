/**
 * K9 Ops Web — Health Web v1 HW-6A.I1
 * ClinicalCase Parser — Fail-Safe Contract Tests
 *
 * Covers the 20 mandatory parser scenarios of the HW-6A.I1 contract §14.
 * The central invariant under test: the parser never invents permissive data.
 */

import { describe, expect, it } from "vitest";

import { parseClinicalCaseWireDoc } from "../parser";
import { CLINICAL_CASE_STATUS_LABELS, type ClinicalCaseStatus } from "../../domain/read-states";

const DOG_ID = "k9-apollo";
const CASE_ID = "case-001";

const openedAtIso = "2026-08-10T14:32:00.000Z";
const lastEventIso = "2026-08-21T17:32:00.000Z";

/**
 * A canonically COMPLETE ClinicalCase: every required (✅) field present and
 * well-formed, per HEALTH_V1_FIRESTORE_SCHEMA.md §2.1.
 */
function completeWireDoc(): Record<string, unknown> {
  return {
    clinical_status: "under_treatment",
    title: "Otite bilateral",
    opened_at: openedAtIso,
    opened_by: { uid: "uid-opener", name: "Sgt. Lima", internal_role: "handler" },
    recorded_by: { uid: "uid-recorder", name: "Cabo Souza", internal_role: "operator" },
    opening_event_id: "evt-001",
    opening_type: "consultation",
    schema_version: 1,
  };
}

describe("HW-6A.I1 — ClinicalCase parser fail-safe contract", () => {
  // 1
  it("1. parses a complete valid case as complete with no issues", () => {
    const result = parseClinicalCaseWireDoc(completeWireDoc(), CASE_ID, DOG_ID);

    expect(result.dataQuality).toBe("complete");
    expect(result.issues).toEqual([]);
    expect(result.dogId).toBe(DOG_ID);
    expect(result.caseId).toBe(CASE_ID);
    expect(result.clinicalStatus).toBe("under_treatment");
    expect(result.rawClinicalStatus).toBe("under_treatment");
    expect(result.title).toBe("Otite bilateral");
    expect(result.openedAt?.toISOString()).toBe(openedAtIso);
    expect(result.openingEventId).toBe("evt-001");
    expect(result.openingType).toBe("consultation");
    expect(result.schemaVersion).toBe(1);
  });

  // 2
  it("2. parses all six canonical statuses unchanged", () => {
    const canonical: ClinicalCaseStatus[] = [
      "open",
      "under_investigation",
      "under_treatment",
      "monitoring",
      "discharged",
      "cancelled",
    ];

    for (const status of canonical) {
      const result = parseClinicalCaseWireDoc(
        { ...completeWireDoc(), clinical_status: status },
        CASE_ID,
        DOG_ID
      );
      expect(result.clinicalStatus).toBe(status);
      expect(result.rawClinicalStatus).toBe(status);
      expect(result.dataQuality).toBe("complete");
      // Labels are reused from the shared Health domain, never redefined.
      expect(CLINICAL_CASE_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  // 3
  it("3. unknown status -> null, raw preserved, partial (NEVER coerced to open)", () => {
    const result = parseClinicalCaseWireDoc(
      { ...completeWireDoc(), clinical_status: "quantum_superposition" },
      CASE_ID,
      DOG_ID
    );

    expect(result.clinicalStatus).toBeNull();
    expect(result.clinicalStatus).not.toBe("open");
    expect(result.rawClinicalStatus).toBe("quantum_superposition");
    expect(result.dataQuality).toBe("partial");
    expect(result.issues).toContainEqual({
      field: "clinical_status",
      code: "unrecognized_value",
      detail: "quantum_superposition",
    });
  });

  // 4
  it("4. absent has_active_restriction -> null, never false", () => {
    const result = parseClinicalCaseWireDoc(completeWireDoc(), CASE_ID, DOG_ID);
    expect(result.hasActiveRestriction).toBeNull();
    expect(result.hasActiveRestriction).not.toBe(false);
  });

  // 5
  it("5. explicit false has_active_restriction -> false", () => {
    const result = parseClinicalCaseWireDoc(
      { ...completeWireDoc(), has_active_restriction: false },
      CASE_ID,
      DOG_ID
    );
    expect(result.hasActiveRestriction).toBe(false);
    expect(result.dataQuality).toBe("complete");
  });

  // 6
  it("6. absent has_pending_schedule -> null", () => {
    const result = parseClinicalCaseWireDoc(completeWireDoc(), CASE_ID, DOG_ID);
    expect(result.hasPendingSchedule).toBeNull();
    expect(result.hasPendingSchedule).not.toBe(false);
  });

  // 7
  it("7. explicit false has_pending_schedule -> false", () => {
    const result = parseClinicalCaseWireDoc(
      { ...completeWireDoc(), has_pending_schedule: false },
      CASE_ID,
      DOG_ID
    );
    expect(result.hasPendingSchedule).toBe(false);
  });

  // 8
  it("8. absent active_treatments_count -> null, never 0", () => {
    const result = parseClinicalCaseWireDoc(completeWireDoc(), CASE_ID, DOG_ID);
    expect(result.activeTreatmentsCount).toBeNull();
    expect(result.activeTreatmentsCount).not.toBe(0);
  });

  // 9
  it("9. active_treatments_count of zero -> 0 (distinct from absent)", () => {
    const result = parseClinicalCaseWireDoc(
      { ...completeWireDoc(), active_treatments_count: 0 },
      CASE_ID,
      DOG_ID
    );
    expect(result.activeTreatmentsCount).toBe(0);
    expect(result.activeTreatmentsCount).not.toBeNull();
    expect(result.dataQuality).toBe("complete");
  });

  // 10
  it("10. absent event_count -> null, never 0", () => {
    const result = parseClinicalCaseWireDoc(completeWireDoc(), CASE_ID, DOG_ID);
    expect(result.eventCount).toBeNull();
    expect(result.eventCount).not.toBe(0);
  });

  // 11
  it("11. event_count of zero -> 0", () => {
    const result = parseClinicalCaseWireDoc(
      { ...completeWireDoc(), event_count: 0 },
      CASE_ID,
      DOG_ID
    );
    expect(result.eventCount).toBe(0);
    expect(result.eventCount).not.toBeNull();
  });

  // 12
  it("12. valid last_event_at is parsed to a Date", () => {
    const result = parseClinicalCaseWireDoc(
      { ...completeWireDoc(), last_event_at: lastEventIso },
      CASE_ID,
      DOG_ID
    );
    expect(result.lastEventAt).toBeInstanceOf(Date);
    expect(result.lastEventAt?.toISOString()).toBe(lastEventIso);
  });

  // 13
  it("13. absent last_event_at -> null and is NEVER substituted by opened_at", () => {
    const result = parseClinicalCaseWireDoc(completeWireDoc(), CASE_ID, DOG_ID);
    expect(result.lastEventAt).toBeNull();
    expect(result.openedAt?.toISOString()).toBe(openedAtIso);
    // The critical anti-falsification assertion.
    expect(result.lastEventAt).not.toEqual(result.openedAt);
    // Absence of a documented-optional derived field is not a defect.
    expect(result.dataQuality).toBe("complete");
  });

  // 14
  it("14. malformed timestamp -> field null + partial, without throwing", () => {
    const result = parseClinicalCaseWireDoc(
      { ...completeWireDoc(), last_event_at: "not-a-timestamp" },
      CASE_ID,
      DOG_ID
    );
    expect(result.lastEventAt).toBeNull();
    expect(result.dataQuality).toBe("partial");
    expect(result.issues).toContainEqual({
      field: "last_event_at",
      code: "malformed_timestamp",
    });
  });

  // 15
  it("15. missing title -> null with no invented title, marked partial", () => {
    const wire = completeWireDoc();
    delete wire.title;
    const result = parseClinicalCaseWireDoc(wire, CASE_ID, DOG_ID);

    expect(result.title).toBeNull();
    expect(result.dataQuality).toBe("partial");
    expect(result.issues).toContainEqual({
      field: "title",
      code: "missing_required_field",
    });
  });

  // 16
  it("16. absent schema_version -> null + truthful partial", () => {
    const wire = completeWireDoc();
    delete wire.schema_version;
    const result = parseClinicalCaseWireDoc(wire, CASE_ID, DOG_ID);

    expect(result.schemaVersion).toBeNull();
    expect(result.dataQuality).toBe("partial");
    expect(result.issues).toContainEqual({
      field: "schema_version",
      code: "missing_required_field",
    });
  });

  // 17
  it("17. opened_by and recorded_by are parsed independently", () => {
    const result = parseClinicalCaseWireDoc(completeWireDoc(), CASE_ID, DOG_ID);

    expect(result.openedBy).toEqual({
      uid: "uid-opener",
      name: "Sgt. Lima",
      internalRole: "handler",
    });
    expect(result.recordedBy).toEqual({
      uid: "uid-recorder",
      name: "Cabo Souza",
      internalRole: "operator",
    });
  });

  // 18
  it("18. recorded_by may differ from opened_by and is never aliased to it", () => {
    const result = parseClinicalCaseWireDoc(completeWireDoc(), CASE_ID, DOG_ID);

    expect(result.recordedBy?.uid).not.toBe(result.openedBy?.uid);

    // A case where recorded_by is absent must NOT inherit opened_by.
    const wire = completeWireDoc();
    delete wire.recorded_by;
    const missing = parseClinicalCaseWireDoc(wire, CASE_ID, DOG_ID);
    expect(missing.recordedBy).toBeNull();
    expect(missing.openedBy).not.toBeNull();
    expect(missing.dataQuality).toBe("partial");
    expect(missing.issues).toContainEqual({
      field: "recorded_by",
      code: "missing_required_field",
    });
  });

  // 19
  it("19. primary_professional is parsed independently of the recorded actor", () => {
    const result = parseClinicalCaseWireDoc(
      {
        ...completeWireDoc(),
        primary_professional: {
          name: "Dra. Helena Prado",
          crmv: "CRMV-SP 12345",
          clinic: "Clínica VetOps",
        },
      },
      CASE_ID,
      DOG_ID
    );

    expect(result.primaryProfessional).toEqual({
      name: "Dra. Helena Prado",
      crmv: "CRMV-SP 12345",
      clinic: "Clínica VetOps",
    });
    // Professional attribution never leaks into the actor envelope.
    expect(result.recordedBy?.name).toBe("Cabo Souza");
    expect(result.dataQuality).toBe("complete");
  });

  it("19b. absent primary_professional -> null and is never synthesized", () => {
    const result = parseClinicalCaseWireDoc(completeWireDoc(), CASE_ID, DOG_ID);
    expect(result.primaryProfessional).toBeNull();
    expect(result.dataQuality).toBe("complete");
  });

  // 20
  it("20. unknown extra Firestore fields are ignored safely", () => {
    const result = parseClinicalCaseWireDoc(
      {
        ...completeWireDoc(),
        some_future_field: { nested: true },
        tags: ["ortopedia"],
        reopened_count: 3,
      },
      CASE_ID,
      DOG_ID
    );

    expect(result.dataQuality).toBe("complete");
    expect(result.issues).toEqual([]);
    expect(result).not.toHaveProperty("some_future_field");
  });

  // --- Additional guardrails -------------------------------------------------

  it("preserves the closure block for a terminal case", () => {
    const closedIso = "2026-08-20T09:00:00.000Z";
    const result = parseClinicalCaseWireDoc(
      {
        ...completeWireDoc(),
        clinical_status: "discharged",
        closed_at: closedIso,
        closed_by: { uid: "uid-vet", name: "Dra. Helena", internal_role: "veterinarian" },
        closure_type: "discharge",
        closure_reason: "Recuperação completa",
      },
      CASE_ID,
      DOG_ID
    );

    expect(result.clinicalStatus).toBe("discharged");
    expect(result.closedAt?.toISOString()).toBe(closedIso);
    expect(result.closureType).toBe("discharge");
    expect(result.closureReason).toBe("Recuperação completa");
    expect(result.dataQuality).toBe("complete");
  });

  it("unknown opening_type -> null + partial, never defaulted", () => {
    const result = parseClinicalCaseWireDoc(
      { ...completeWireDoc(), opening_type: "telepathic" },
      CASE_ID,
      DOG_ID
    );
    expect(result.openingType).toBeNull();
    expect(result.dataQuality).toBe("partial");
  });

  it("malformed derived count (negative) -> null + partial, never 0", () => {
    const result = parseClinicalCaseWireDoc(
      { ...completeWireDoc(), active_treatments_count: -4 },
      CASE_ID,
      DOG_ID
    );
    expect(result.activeTreatmentsCount).toBeNull();
    expect(result.activeTreatmentsCount).not.toBe(0);
    expect(result.dataQuality).toBe("partial");
  });

  it("non-boolean derived flag -> null + partial, never coerced", () => {
    const result = parseClinicalCaseWireDoc(
      { ...completeWireDoc(), has_active_restriction: "yes" },
      CASE_ID,
      DOG_ID
    );
    expect(result.hasActiveRestriction).toBeNull();
    expect(result.hasActiveRestriction).not.toBe(true);
    expect(result.dataQuality).toBe("partial");
  });

  it("incomplete actor snapshot preserves available data and marks partial", () => {
    const result = parseClinicalCaseWireDoc(
      { ...completeWireDoc(), recorded_by: { name: "Cabo Souza" } },
      CASE_ID,
      DOG_ID
    );
    expect(result.recordedBy).toEqual({ uid: null, name: "Cabo Souza", internalRole: null });
    expect(result.dataQuality).toBe("partial");
    expect(result.issues).toContainEqual({
      field: "recorded_by",
      code: "incomplete_actor",
    });
  });

  it("a structurally invalid document yields a partial model without throwing", () => {
    expect(() => parseClinicalCaseWireDoc(null, CASE_ID, DOG_ID)).not.toThrow();
    const result = parseClinicalCaseWireDoc(null, CASE_ID, DOG_ID);
    expect(result.dataQuality).toBe("partial");
    expect(result.caseId).toBe(CASE_ID);
    expect(result.dogId).toBe(DOG_ID);
    expect(result.clinicalStatus).toBeNull();
  });

  it("never emits a synthetic next-action field", () => {
    const result = parseClinicalCaseWireDoc(completeWireDoc(), CASE_ID, DOG_ID);
    expect(result).not.toHaveProperty("nextAction");
    expect(result).not.toHaveProperty("next_action");
    expect(result).not.toHaveProperty("nextActionLabel");
  });
});
