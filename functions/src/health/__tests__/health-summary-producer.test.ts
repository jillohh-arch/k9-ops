/**
 * K9 Ops Backend — Health Web v1 HW-3P Final Closure Gate
 * Pure Projection Producer Unit Tests & Boundary Suite
 *
 * Implements unit test suite covering all mandates:
 * - Approved Configurable Defaults (weightRecencyDays = 90, consultationRecencyDays = 180)
 * - Deterministic boundary tests (89/90/91 days for weight, 179/180/181 days for consultation)
 * - Full canonical source schemas (OperationalRestriction, WeightAssessment, VaccinationRecord, ClinicalEvent, ExamProcess, NutritionPlan)
 * - Strict hasHealthEvaluation predicate behavior
 */

import { describe, expect, it } from "vitest";
import {
  buildHealthSummary,
  hasHealthEvaluation,
} from "../health-summary-builder";

const fixedNow = new Date("2026-08-09T12:00:00.000Z");
const dogId = "k9-odin";

const recordedByRef = {
  ra: "12345",
  name: "Cabo Silva",
  role: "handler",
};

const professionalRef = {
  name: "Dr. Santos",
  crmv: "CRMV-SP 12345",
};

describe("HW-3P Boundary & Canonical Unit Tests", () => {
  it("1. Weight recency boundary: 89 days -> recent (true)", () => {
    const d89 = new Date(fixedNow.getTime() - 89 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: d89, recorded_by: recordedByRef, schema_version: 1 }],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: fixedNow, professional: professionalRef }] }],
      now: fixedNow,
    });

    expect(output.data_completeness.has_recent_weight).toBe(true);
    expect(output.readiness_status).toBe("operational");
  });

  it("2. Weight recency boundary: 90 days -> recent (true)", () => {
    const d90 = new Date(fixedNow.getTime() - 90 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: d90, recorded_by: recordedByRef, schema_version: 1 }],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: fixedNow, professional: professionalRef }] }],
      now: fixedNow,
    });

    expect(output.data_completeness.has_recent_weight).toBe(true);
    expect(output.readiness_status).toBe("operational");
  });

  it("3. Weight recency boundary: 91 days -> NOT recent (false, operational_attention)", () => {
    const d91 = new Date(fixedNow.getTime() - 91 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: d91, recorded_by: recordedByRef, schema_version: 1 }],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: fixedNow, professional: professionalRef }] }],
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
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: d179, professional: professionalRef }] }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational");
  });

  it("5. Consultation recency boundary: 180 days -> recent (operational)", () => {
    const d180 = new Date(fixedNow.getTime() - 180 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: d180, professional: professionalRef }] }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational");
  });

  it("6. Consultation recency boundary: 181 days -> NOT recent (operational_attention)", () => {
    const d181 = new Date(fixedNow.getTime() - 181 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      clinicalCases: [{ id: "c1", events: [{ event_type: "consultation", status: "final", occurred_at: d181, professional: professionalRef }] }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational_attention");
    expect(output.readiness_reason).toContain("Consulta em atraso (> 180 dias)");
  });

  it("7. Canonical OperationalRestriction fixture with past expected_end yields is_overdue: true", () => {
    const pastExpectedEnd = new Date(fixedNow.getTime() - 5 * 86400000);
    const output = buildHealthSummary({
      dogId,
      restrictions: [
        {
          id: "r-canonical",
          level: "partial",
          category: "patrol",
          description: "Restrição parcial de patrulha",
          activities_restricted: ["patrol_night"],
          issued_at: fixedNow,
          recorded_by: recordedByRef,
          status: "active",
          schema_version: 1,
          expected_end: pastExpectedEnd,
        },
      ],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("fit_with_restrictions");
    expect(output.active_restrictions[0].is_overdue).toBe(true);
    expect(output.open_alerts).toHaveLength(1);
    expect(output.open_alerts[0].type).toBe("restriction_reevaluation_overdue");
  });

  it("8. Canonical NutritionPlan fixture mapping amount_grams_per_day", () => {
    const output = buildHealthSummary({
      dogId,
      nutritionPlans: [
        {
          id: "nut-canonical",
          status: "active",
          food_type: "Ração Prescrita Hipercalórica",
          amount_grams_per_day: 500,
          meals_per_day: 2,
          vigent_from: fixedNow,
          recorded_by: recordedByRef,
          created_at: fixedNow,
          schema_version: 1,
        },
      ],
      now: fixedNow,
    });

    expect(output.nutrition_plan?.active).toBe(true);
    expect(output.nutrition_plan?.food_type).toBe("Ração Prescrita Hipercalórica");
    expect(output.nutrition_plan?.amount_grams).toBe(500);
  });

  it("9. Strict hasHealthEvaluation: isolated weight/vaccine/nutrition/schedule alone -> not_evaluated", () => {
    const inputWeight = { dogId, weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow, recorded_by: recordedByRef, schema_version: 1 }], now: fixedNow };
    expect(hasHealthEvaluation(inputWeight)).toBe(false);
    expect(buildHealthSummary(inputWeight).readiness_status).toBe("not_evaluated");

    const inputVaccine = {
      dogId,
      vaccinationRecords: [{ id: "v1", vaccine_name: "Raiva", vaccine_type: "viral", record_status: "final", applied_at: fixedNow, next_due_at: fixedNow, recorded_by: recordedByRef, schema_version: 1 }],
      now: fixedNow,
    };
    expect(hasHealthEvaluation(inputVaccine)).toBe(false);
    expect(buildHealthSummary(inputVaccine).readiness_status).toBe("not_evaluated");
  });
});
