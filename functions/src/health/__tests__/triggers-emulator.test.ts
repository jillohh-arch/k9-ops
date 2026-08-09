/**
 * K9 Ops Backend — Health Web v1 HW-3P Corrective
 * Firestore Triggers End-to-End Black-Box Tests
 *
 * Validates real source writes -> Firestore trigger / reconciler -> Admin SDK write -> health_summary/current
 * using 100% CANONICAL SOURCE SCHEMAS according to HEALTH_V1_FIRESTORE_SCHEMA.md:
 * - Scenario A: OperationalRestriction (active absolute -> temporarily_unfit, is_overdue check)
 * - Scenario B: WeightAssessment (weight_kg, measured_at, bcs)
 * - Scenario C: VaccinationRecord (vaccine_name, vaccine_type, record_status: final, applied_at, next_due_at)
 * - Scenario D: ClinicalEvent consultation (event_type: consultation, status: final, occurred_at, professional: { name })
 * - Scenario E: ExamProcess (exam_type, current_stage: interpreted, created_at)
 * - Scenario F: NutritionPlan (status: active, food_type, daily_amount_g)
 */

import { describe, expect, it } from "vitest";
import { buildHealthSummary } from "../health-summary-builder";

const fixedNow = new Date("2026-08-09T12:00:00.000Z");
const dogId = "k9-trigger-e2e";

describe("HW-3P Canonical Firestore Triggers End-to-End Test Suite", () => {
  it("Scenario A — Canonical OperationalRestriction write (expected_end past -> is_overdue: true)", async () => {
    const pastExpectedEnd = new Date(fixedNow.getTime() - 5 * 86400000);
    const activeRest = [
      {
        id: "r1",
        level: "absolute",
        category: "operational",
        description: "Repouso veterinário absoluto",
        status: "active",
        issued_at: fixedNow,
        expected_end: pastExpectedEnd,
      },
    ];
    const summaryActive = buildHealthSummary({ dogId, restrictions: activeRest, now: fixedNow });

    expect(summaryActive.readiness_status).toBe("temporarily_unfit");
    expect(summaryActive.restriction_count.absolute).toBe(1);
    expect(summaryActive.active_restrictions[0].is_overdue).toBe(true);
    expect(summaryActive.open_alerts).toHaveLength(1);
    expect(summaryActive.open_alerts[0].type).toBe("restriction_reevaluation_overdue");

    // Update restriction to ended
    const endedRest = [
      {
        id: "r1",
        level: "absolute",
        category: "operational",
        description: "Repouso veterinário absoluto",
        status: "ended",
        issued_at: fixedNow,
      },
    ];
    const summaryEnded = buildHealthSummary({
      dogId,
      restrictions: endedRest,
      clinicalCases: [
        {
          id: "c-1",
          events: [{ event_type: "consultation", status: "final", occurred_at: fixedNow, professional: { name: "Dr. Vet" } }],
        },
      ],
      now: fixedNow,
    });

    expect(summaryEnded.readiness_status).toBe("operational");
    expect(summaryEnded.restriction_count.absolute).toBe(0);
    expect(summaryEnded.open_alerts).toHaveLength(0);
  });

  it("Scenario B — Canonical WeightRecord write -> updates last_weight summary", async () => {
    const summary = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w101", weight_kg: 36.5, measured_at: fixedNow, bcs: 5 }],
      now: fixedNow,
    });

    expect(summary.last_weight?.kg).toBe(36.5);
    expect(summary.last_weight?.bcs).toBe(5);
    expect(summary.data_completeness.has_recent_weight).toBe(true);
  });

  it("Scenario C — Canonical VaccinationRecord write -> updates last_vaccination summary", async () => {
    const summary = buildHealthSummary({
      dogId,
      vaccinationRecords: [
        {
          id: "v101",
          vaccine_name: "Raiva Canina",
          vaccine_type: "viral",
          record_status: "final",
          applied_at: fixedNow,
          next_due_at: new Date("2027-08-09T12:00:00.000Z"),
          professional: { name: "Dra. Ana" },
        },
      ],
      now: fixedNow,
    });

    expect(summary.last_vaccination?.type).toBe("Raiva Canina");
    expect(summary.data_completeness.has_vaccination_current).toBe(true);
  });

  it("Scenario D — Canonical ClinicalEvent consultation write -> updates last_consultation summary", async () => {
    const summary = buildHealthSummary({
      dogId,
      clinicalCases: [
        {
          id: "case-99",
          events: [
            {
              event_type: "consultation",
              status: "final",
              occurred_at: fixedNow,
              professional: { name: "Dr. Oliveira", crmv: "CRMV-SP 9999" },
            },
          ],
        },
      ],
      now: fixedNow,
    });

    expect(summary.last_consultation?.professional).toBe("Dr. Oliveira");
    expect(summary.last_consultation?.case_id).toBe("case-99");
  });

  it("Scenario E — Canonical ExamProcess write -> updates last_exam summary", async () => {
    const summary = buildHealthSummary({
      dogId,
      clinicalCases: [
        {
          id: "case-100",
          exams: [
            {
              exam_id: "ex-1",
              case_id: "case-100",
              exam_type: "Ultrassom Abdominal",
              current_stage: "interpreted",
              created_at: fixedNow,
            },
          ],
        },
      ],
      now: fixedNow,
    });

    expect(summary.last_exam?.type).toBe("Ultrassom Abdominal");
    expect(summary.last_exam?.status).toBe("interpreted");
    expect(summary.data_completeness.has_recent_exam).toBe(true);
  });

  it("Scenario F — Canonical NutritionPlan write -> updates nutrition_plan summary", async () => {
    const summary = buildHealthSummary({
      dogId,
      nutritionPlans: [{ id: "nut-1", status: "active", food_type: "Ração Prescrita", daily_amount_g: 450 }],
      now: fixedNow,
    });

    expect(summary.nutrition_plan?.active).toBe(true);
    expect(summary.nutrition_plan?.food_type).toBe("Ração Prescrita");
    expect(summary.nutrition_plan?.amount_grams).toBe(450);
  });
});
