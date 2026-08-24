/**
 * K9 Ops Backend — Health Web v1 HW-3P Final Contract Closure
 * Pure Projection Producer Unit Tests & Boundary Suite
 *
 * Implements unit test suite covering all mandates:
 * - Approved Defaults: weightRecencyDays = 90, consultationRecencyDays = 180, vaccinationRequired = true, nutritionRequired = true
 * - Deterministic boundary tests (89/90/91 days for weight, 179/180/181 days for consultation)
 * - 100% Canonical Source Schemas with RecordedBy { uid, name, internal_role }, ProfessionalIdentity, HealthDocumentRef, etc.
 * - Strict hasHealthEvaluation predicate behavior and precedence
 * - Overdue restriction yields is_overdue: true without immediate automatic open_alerts
 */

import { describe, expect, it } from "vitest";
import {
  buildHealthSummary,
  hasHealthEvaluation,
} from "../health-summary-builder";

const fixedNow = new Date("2026-08-09T12:00:00.000Z");
const dogId = "k9-odin";

const TEST_RECORDED_BY = {
  uid: "user-test-001",
  name: "GCM Teste",
  internal_role: "condutor" as const,
};

const TEST_PROFESSIONAL = {
  name: "Dra. Teste",
  registration_type: "CRMV",
  registration_number: "SP-00000",
  clinic: "Clínica Teste",
};

const TEST_SOURCE_DOC = {
  health_document_id: "doc-restriction-test",
  description: "Laudo clínico de teste",
};

const TEST_VALID_NUTRITION = {
  id: "nut-canonical",
  status: "active",
  food_type: "Ração Prescrita Hipercalórica",
  amount_grams_per_day: 500,
  meals_per_day: 2,
  vigent_from: fixedNow,
  recorded_by: TEST_RECORDED_BY,
  created_at: fixedNow,
  schema_version: 1,
};

const TEST_VALID_VACCINE = {
  id: "v-canonical",
  vaccine_name: "V10 Polivalente",
  vaccine_type: "viral",
  record_status: "final",
  applied_at: fixedNow,
  next_due_at: new Date("2027-08-09T12:00:00.000Z"),
  recorded_by: TEST_RECORDED_BY,
  schema_version: 1,
};

describe("HW-3P Final Contract Unit & Boundary Tests", () => {
  it("1. Weight recency boundary: 89 days -> recent (true)", () => {
    const d89 = new Date(fixedNow.getTime() - 89 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: d89, recorded_by: TEST_RECORDED_BY, schema_version: 1 }],
      vaccinationRecords: [TEST_VALID_VACCINE],
      nutritionPlans: [TEST_VALID_NUTRITION],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: fixedNow, recorded_at: fixedNow, recorded_by: TEST_RECORDED_BY, professional: TEST_PROFESSIONAL, content: "Rotina", payload_type: "consultation_v1", payload_version: 1, schema_version: 1 }] }],
      now: fixedNow,
    });

    expect(output.data_completeness.has_recent_weight).toBe(true);
    expect(output.readiness_status).toBe("operational");
  });

  it("2. Weight recency boundary: 90 days -> recent (true)", () => {
    const d90 = new Date(fixedNow.getTime() - 90 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: d90, recorded_by: TEST_RECORDED_BY, schema_version: 1 }],
      vaccinationRecords: [TEST_VALID_VACCINE],
      nutritionPlans: [TEST_VALID_NUTRITION],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: fixedNow, recorded_at: fixedNow, recorded_by: TEST_RECORDED_BY, professional: TEST_PROFESSIONAL, content: "Rotina", payload_type: "consultation_v1", payload_version: 1, schema_version: 1 }] }],
      now: fixedNow,
    });

    expect(output.data_completeness.has_recent_weight).toBe(true);
    expect(output.readiness_status).toBe("operational");
  });

  it("3. Weight recency boundary: 91 days -> NOT recent (false, operational_attention)", () => {
    const d91 = new Date(fixedNow.getTime() - 91 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: d91, recorded_by: TEST_RECORDED_BY, schema_version: 1 }],
      vaccinationRecords: [TEST_VALID_VACCINE],
      nutritionPlans: [TEST_VALID_NUTRITION],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: fixedNow, recorded_at: fixedNow, recorded_by: TEST_RECORDED_BY, professional: TEST_PROFESSIONAL, content: "Rotina", payload_type: "consultation_v1", payload_version: 1, schema_version: 1 }] }],
      now: fixedNow,
    });

    expect(output.data_completeness.has_recent_weight).toBe(false);
    expect(output.readiness_status).toBe("operational_attention");
    expect(output.readiness_reason).toContain("Pesagem em atraso (> 90 dias)");
  });

  it("4. Consultation recency boundary: 179 days -> recent (operational)", () => {
    const d179 = new Date(fixedNow.getTime() - 179 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow, recorded_by: TEST_RECORDED_BY, schema_version: 1 }],
      vaccinationRecords: [TEST_VALID_VACCINE],
      nutritionPlans: [TEST_VALID_NUTRITION],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: d179, recorded_at: d179, recorded_by: TEST_RECORDED_BY, professional: TEST_PROFESSIONAL, content: "Rotina", payload_type: "consultation_v1", payload_version: 1, schema_version: 1 }] }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational");
  });

  it("5. Consultation recency boundary: 180 days -> recent (operational)", () => {
    const d180 = new Date(fixedNow.getTime() - 180 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow, recorded_by: TEST_RECORDED_BY, schema_version: 1 }],
      vaccinationRecords: [TEST_VALID_VACCINE],
      nutritionPlans: [TEST_VALID_NUTRITION],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: d180, recorded_at: d180, recorded_by: TEST_RECORDED_BY, professional: TEST_PROFESSIONAL, content: "Rotina", payload_type: "consultation_v1", payload_version: 1, schema_version: 1 }] }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational");
  });

  it("6. Consultation recency boundary: 181 days -> NOT recent (operational_attention)", () => {
    const d181 = new Date(fixedNow.getTime() - 181 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow, recorded_by: TEST_RECORDED_BY, schema_version: 1 }],
      vaccinationRecords: [TEST_VALID_VACCINE],
      nutritionPlans: [TEST_VALID_NUTRITION],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: d181, recorded_at: d181, recorded_by: TEST_RECORDED_BY, professional: TEST_PROFESSIONAL, content: "Rotina", payload_type: "consultation_v1", payload_version: 1, schema_version: 1 }] }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational_attention");
    expect(output.readiness_reason).toContain("Consulta em atraso (> 180 dias)");
  });

  it("7. Evaluated K9 + missing nutrition plan -> operational_attention", () => {
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow, recorded_by: TEST_RECORDED_BY, schema_version: 1 }],
      vaccinationRecords: [TEST_VALID_VACCINE],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: fixedNow, recorded_at: fixedNow, recorded_by: TEST_RECORDED_BY, professional: TEST_PROFESSIONAL, content: "Rotina", payload_type: "consultation_v1", payload_version: 1, schema_version: 1 }] }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational_attention");
    expect(output.readiness_reason).toContain("Plano alimentar ausente");
  });

  it("8. Evaluated K9 + expired vaccination -> operational_attention", () => {
    const expiredVaccine = {
      ...TEST_VALID_VACCINE,
      next_due_at: new Date(fixedNow.getTime() - 10 * 86400000),
    };
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow, recorded_by: TEST_RECORDED_BY, schema_version: 1 }],
      vaccinationRecords: [expiredVaccine],
      nutritionPlans: [TEST_VALID_NUTRITION],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: fixedNow, recorded_at: fixedNow, recorded_by: TEST_RECORDED_BY, professional: TEST_PROFESSIONAL, content: "Rotina", payload_type: "consultation_v1", payload_version: 1, schema_version: 1 }] }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational_attention");
    expect(output.readiness_reason).toContain("Vacinação pendente");
  });

  it("9. K9 never evaluated + missing vaccine & nutrition -> not_evaluated (precedence rule)", () => {
    const output = buildHealthSummary({
      dogId,
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("not_evaluated");
    expect(hasHealthEvaluation({ dogId })).toBe(false);
  });

  it("10. Mandatory §8: Past expected_end yields is_overdue = true WITHOUT immediate open_alerts", () => {
    const pastExpectedEnd = new Date(fixedNow.getTime() - 1 * 86400000); // yesterday
    const output = buildHealthSummary({
      dogId,
      restrictions: [
        {
          id: "r-canonical",
          level: "partial",
          category: "injury",
          description: "Lesão articular leve em repouso parcial",
          activities_restricted: ["patrol_night"],
          issued_at: fixedNow,
          recorded_by: TEST_RECORDED_BY,
          professional: TEST_PROFESSIONAL,
          source_document: TEST_SOURCE_DOC,
          status: "active",
          schema_version: 1,
          expected_end: pastExpectedEnd,
        },
      ],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("fit_with_restrictions");
    expect(output.active_restrictions[0].is_overdue).toBe(true);
    expect(output.open_alerts).toHaveLength(0); // Omitted immediate alert per policy §8
  });
});
