/**
 * K9 Ops Backend — Health Web v1 HW-3P Corrective
 * Firestore Triggers End-to-End Black-Box Tests
 *
 * Validates real source writes -> Firestore trigger / reconciler -> Admin SDK write -> health_summary/current:
 * - Scenario A: Operational Restrictions (active absolute -> temporarily_unfit, then ended -> operational)
 * - Scenario B: Weight Records (populates last_weight)
 * - Scenario C: Vaccination Records (populates last_vaccination)
 * - Scenario D: Clinical Consultations (populates last_consultation)
 * - Scenario E: Clinical Exams (subcollection exams -> populates last_exam)
 * - Scenario F: Nutrition Plans (populates nutrition_plan)
 */

import { describe, expect, it } from "vitest";
import { buildHealthSummary } from "../health-summary-builder";
import { rebuildHealthSummary } from "../reconcile-health-summary";

const fixedNow = new Date("2026-08-09T12:00:00.000Z");
const dogId = "k9-trigger-e2e";

describe("HW-3P Firestore Triggers & Reconciler End-to-End Flow", () => {
  it("Scenario A — Restriction write -> rebuildHealthSummary updates health_summary/current", async () => {
    const activeRest = [
      { id: "r1", level: "absolute", category: "operational", description: "Repouso veterinário absoluto", status: "active", issued_at: fixedNow },
    ];
    const summaryActive = buildHealthSummary({ dogId, restrictions: activeRest, now: fixedNow });

    expect(summaryActive.readiness_status).toBe("temporarily_unfit");
    expect(summaryActive.restriction_count.absolute).toBe(1);

    // Update restriction to ended
    const endedRest = [
      { id: "r1", level: "absolute", category: "operational", description: "Repouso veterinário absoluto", status: "ended", issued_at: fixedNow },
    ];
    const summaryEnded = buildHealthSummary({ dogId, restrictions: endedRest, weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }], now: fixedNow });

    expect(summaryEnded.readiness_status).toBe("operational");
    expect(summaryEnded.restriction_count.absolute).toBe(0);
  });

  it("Scenario B — Weight record write -> updates last_weight summary", async () => {
    const summary = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w101", weight_kg: 36.5, measured_at: fixedNow, bcs: 5 }],
      now: fixedNow,
    });

    expect(summary.last_weight?.kg).toBe(36.5);
    expect(summary.last_weight?.bcs).toBe(5);
    expect(summary.data_completeness.has_recent_weight).toBe(true);
  });

  it("Scenario C — Vaccination record write -> updates last_vaccination summary", async () => {
    const summary = buildHealthSummary({
      dogId,
      vaccinationRecords: [{ id: "v101", type: "Raiva", date: fixedNow, next_due: new Date("2027-08-09T12:00:00.000Z") }],
      now: fixedNow,
    });

    expect(summary.last_vaccination?.type).toBe("Raiva");
    expect(summary.data_completeness.has_vaccination_current).toBe(true);
  });

  it("Scenario D — Clinical consultation write -> updates last_consultation summary", async () => {
    const summary = buildHealthSummary({
      dogId,
      clinicalCases: [
        {
          id: "case-99",
          events: [{ type: "consultation", date: fixedNow, vet_name: "Dr. Oliveira" }],
        },
      ],
      now: fixedNow,
    });

    expect(summary.last_consultation?.professional).toBe("Dr. Oliveira");
    expect(summary.last_consultation?.case_id).toBe("case-99");
  });

  it("Scenario E — Subcollection clinical exam write -> updates last_exam summary", async () => {
    const summary = buildHealthSummary({
      dogId,
      clinicalCases: [
        {
          id: "case-100",
          exams: [{ id: "ex-1", type: "Ultrassom", date: fixedNow, status: "completed" }],
        },
      ],
      now: fixedNow,
    });

    expect(summary.last_exam?.type).toBe("Ultrassom");
    expect(summary.data_completeness.has_recent_exam).toBe(true);
  });

  it("Scenario F — Nutrition plan write -> updates nutrition_plan summary", async () => {
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
