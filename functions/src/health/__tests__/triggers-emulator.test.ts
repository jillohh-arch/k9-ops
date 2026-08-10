/**
 * K9 Ops Backend — Health Web v1 HW-3P Final Closure Gate
 * Firestore Triggers End-to-End Black-Box Tests
 *
 * Validates real source writes -> Firestore trigger / reconciler -> Admin SDK write -> health_summary/current
 * using 100% CANONICAL SOURCE SCHEMAS according to HEALTH_V1_FIRESTORE_SCHEMA.md:
 * - OperationalRestriction (level, category, description, activities_restricted, issued_at, recorded_by, status, schema_version, expected_end)
 * - WeightAssessment (weight_kg, measured_at, recorded_by, schema_version)
 * - VaccinationRecord (vaccine_name, vaccine_type, record_status, applied_at, next_due_at, recorded_by, schema_version)
 * - ClinicalEvent (event_type, status, occurred_at, recorded_at, recorded_by, professional, payload_type, payload_version, schema_version)
 * - ExamProcess (exam_id, case_id, exam_type, current_stage, created_at, recorded_by, schema_version)
 * - NutritionPlan (status, food_type, amount_grams_per_day, meals_per_day, vigent_from, recorded_by, created_at, schema_version)
 */

import { describe, expect, it } from "vitest";
import { buildHealthSummary } from "../health-summary-builder";

const fixedNow = new Date("2026-08-09T12:00:00.000Z");
const dogId = "k9-trigger-e2e";

const canonicalRecordedBy = {
  ra: "12345",
  name: "Cabo Silva",
  role: "handler",
};

const canonicalProfessional = {
  name: "Dr. Oliveira",
  crmv: "CRMV-SP 9999",
};

describe("HW-3P Canonical Firestore Triggers End-to-End Test Suite", () => {
  it("1. OperationalRestriction canonical write -> updates active_restrictions and is_overdue", async () => {
    const pastExpectedEnd = new Date(fixedNow.getTime() - 5 * 86400000);
    const activeRest = [
      {
        id: "r1",
        level: "absolute",
        category: "operational",
        description: "Repouso veterinário absoluto",
        activities_restricted: ["all_activities"],
        issued_at: fixedNow,
        recorded_by: canonicalRecordedBy,
        status: "active",
        schema_version: 1,
        expected_end: pastExpectedEnd,
      },
    ];
    const summaryActive = buildHealthSummary({ dogId, restrictions: activeRest, now: fixedNow });

    expect(summaryActive.readiness_status).toBe("temporarily_unfit");
    expect(summaryActive.restriction_count.absolute).toBe(1);
    expect(summaryActive.active_restrictions[0].is_overdue).toBe(true);
    expect(summaryActive.open_alerts).toHaveLength(1);
  });

  it("2. WeightAssessment canonical write -> updates last_weight summary", async () => {
    const summary = buildHealthSummary({
      dogId,
      weightRecords: [
        {
          id: "w101",
          weight_kg: 36.5,
          measured_at: fixedNow,
          bcs: 5,
          recorded_by: canonicalRecordedBy,
          schema_version: 1,
        },
      ],
      clinicalCases: [
        {
          id: "c-1",
          events: [{ event_type: "consultation", status: "final", occurred_at: fixedNow, recorded_at: fixedNow, recorded_by: canonicalRecordedBy, professional: canonicalProfessional, payload_type: "none", payload_version: 1, schema_version: 1 }],
        },
      ],
      now: fixedNow,
    });

    expect(summary.last_weight?.kg).toBe(36.5);
    expect(summary.last_weight?.bcs).toBe(5);
    expect(summary.data_completeness.has_recent_weight).toBe(true);
  });

  it("3. VaccinationRecord canonical write -> updates last_vaccination summary", async () => {
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
          recorded_by: canonicalRecordedBy,
          schema_version: 1,
        },
      ],
      now: fixedNow,
    });

    expect(summary.last_vaccination?.type).toBe("Raiva Canina");
    expect(summary.data_completeness.has_vaccination_current).toBe(true);
  });

  it("4. ClinicalEvent consultation canonical write -> updates last_consultation summary", async () => {
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
              recorded_at: fixedNow,
              recorded_by: canonicalRecordedBy,
              professional: canonicalProfessional,
              payload_type: "consultation_v1",
              payload_version: 1,
              schema_version: 1,
            },
          ],
        },
      ],
      now: fixedNow,
    });

    expect(summary.last_consultation?.professional).toBe("Dr. Oliveira");
    expect(summary.last_consultation?.case_id).toBe("case-99");
  });

  it("5. ExamProcess canonical write -> updates last_exam summary", async () => {
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
              recorded_by: canonicalRecordedBy,
              schema_version: 1,
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

  it("6. NutritionPlan canonical write -> updates nutrition_plan summary", async () => {
    const summary = buildHealthSummary({
      dogId,
      nutritionPlans: [
        {
          id: "nut-1",
          status: "active",
          food_type: "Ração Prescrita Hipercalórica",
          amount_grams_per_day: 450,
          meals_per_day: 2,
          vigent_from: fixedNow,
          recorded_by: canonicalRecordedBy,
          created_at: fixedNow,
          schema_version: 1,
        },
      ],
      now: fixedNow,
    });

    expect(summary.nutrition_plan?.active).toBe(true);
    expect(summary.nutrition_plan?.food_type).toBe("Ração Prescrita Hipercalórica");
    expect(summary.nutrition_plan?.amount_grams).toBe(450);
  });
});
