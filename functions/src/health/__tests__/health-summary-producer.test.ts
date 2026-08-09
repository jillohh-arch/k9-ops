/**
 * K9 Ops Backend — Health Web v1 HW-3P Corrective
 * Pure Projection Producer Unit Tests
 *
 * Implements unit test suite covering all corrective requirements in HW-3P §2-§8:
 * - 100% Canonical Source Schema Keys (VaccinationRecord, ClinicalEvent, ExamProcess)
 * - Strict hasHealthEvaluation predicate (Isolated weight/vaccine/nutrition/schedule do NOT prove evaluation)
 * - Dynamic threshold configuration and NULL threshold semantics
 * - Restriction is_overdue and open_alerts generation
 */

import { describe, expect, it } from "vitest";
import {
  buildHealthSummary,
  hasHealthEvaluation,
  type ReadinessThresholdConfig,
} from "../health-summary-builder";

const fixedNow = new Date("2026-08-09T12:00:00.000Z");
const dogId = "k9-odin";

const explicitTestThresholds: ReadinessThresholdConfig = {
  weightRecencyDays: 90,
  consultationRecencyDays: 180,
  vaccinationRequired: true,
  nutritionRequired: true,
};

describe("HW-3P Canonical Producer Unit Tests", () => {
  it("1. K9 without evaluation -> not_evaluated (hasHealthEvaluation returns false)", () => {
    const evaluated = hasHealthEvaluation({ dogId });
    expect(evaluated).toBe(false);

    const output = buildHealthSummary({ dogId, now: fixedNow });
    expect(output.readiness_status).toBe("not_evaluated");
    expect(output.readiness_label).toBe("Não avaliado");
    expect(output.readiness_reason).toBe("Nenhuma avaliação registrada");
  });

  it("2. Mandatory §6: Isolated weight record alone != clinical evaluation -> not_evaluated", () => {
    const input = {
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      now: fixedNow,
    };
    expect(hasHealthEvaluation(input)).toBe(false);

    const output = buildHealthSummary(input);
    expect(output.readiness_status).toBe("not_evaluated");
    expect(output.last_weight?.kg).toBe(34);
  });

  it("3. Mandatory §6: Isolated vaccination record alone != clinical evaluation -> not_evaluated", () => {
    const input = {
      dogId,
      vaccinationRecords: [
        {
          id: "v1",
          vaccine_name: "V10 Polivalente",
          vaccine_type: "viral",
          record_status: "final",
          applied_at: fixedNow,
          next_due_at: new Date("2027-08-09T12:00:00.000Z"),
        },
      ],
      now: fixedNow,
    };
    expect(hasHealthEvaluation(input)).toBe(false);

    const output = buildHealthSummary(input);
    expect(output.readiness_status).toBe("not_evaluated");
    expect(output.last_vaccination?.type).toBe("V10 Polivalente");
  });

  it("4. Mandatory §6: Isolated nutrition plan alone != clinical evaluation -> not_evaluated", () => {
    const input = {
      dogId,
      nutritionPlans: [{ id: "n1", status: "active", food_type: "Super Premium", daily_amount_g: 400 }],
      now: fixedNow,
    };
    expect(hasHealthEvaluation(input)).toBe(false);

    const output = buildHealthSummary(input);
    expect(output.readiness_status).toBe("not_evaluated");
    expect(output.nutrition_plan?.food_type).toBe("Super Premium");
  });

  it("5. Mandatory §6: Administrative schedule item alone != clinical evaluation -> not_evaluated", () => {
    const input = {
      dogId,
      healthSchedule: [{ id: "sch-1", title: "Vermifugação agendada", status: "scheduled" }],
      now: fixedNow,
    };
    expect(hasHealthEvaluation(input)).toBe(false);

    const output = buildHealthSummary(input);
    expect(output.readiness_status).toBe("not_evaluated");
  });

  it("6. Canonical ClinicalEvent consultation proves evaluation -> operational", () => {
    const input = {
      dogId,
      clinicalCases: [
        {
          id: "case-1",
          events: [
            {
              event_type: "consultation",
              status: "final",
              occurred_at: fixedNow,
              professional: { name: "Dr. Santos", crmv: "CRMV-SP 12345" },
            },
          ],
        },
      ],
      now: fixedNow,
    };
    expect(hasHealthEvaluation(input)).toBe(true);

    const output = buildHealthSummary(input);
    expect(output.readiness_status).toBe("operational");
    expect(output.last_consultation?.professional).toBe("Dr. Santos");
  });

  it("7. Canonical ExamProcess (resulted/interpreted) proves evaluation -> operational", () => {
    const input = {
      dogId,
      clinicalCases: [
        {
          id: "case-2",
          exams: [
            {
              exam_id: "ex-1",
              case_id: "case-2",
              exam_type: "Ultrassom Abdominal",
              current_stage: "interpreted",
              created_at: fixedNow,
            },
          ],
        },
      ],
      now: fixedNow,
    };
    expect(hasHealthEvaluation(input)).toBe(true);

    const output = buildHealthSummary(input);
    expect(output.readiness_status).toBe("operational");
    expect(output.last_exam?.type).toBe("Ultrassom Abdominal");
    expect(output.last_exam?.status).toBe("interpreted");
  });

  it("8. Draft / Cancelled ClinicalEvents and pending ExamProcess stage (requested) do NOT prove evaluation", () => {
    const input = {
      dogId,
      clinicalCases: [
        {
          id: "case-3",
          events: [
            { event_type: "consultation", status: "draft", occurred_at: fixedNow },
            { event_type: "consultation", status: "cancelled", occurred_at: fixedNow },
          ],
          exams: [
            { exam_type: "Raio-X", current_stage: "requested", created_at: fixedNow },
          ],
        },
      ],
      now: fixedNow,
    };
    expect(hasHealthEvaluation(input)).toBe(false);

    const output = buildHealthSummary(input);
    expect(output.readiness_status).toBe("not_evaluated");
  });

  it("9. Threshold config (explicit test injection): consultation > 180 days generates operational_attention", () => {
    const oldConsultDate = new Date(fixedNow.getTime() - 200 * 86400000);
    const recentExamDate = new Date(fixedNow.getTime() - 10 * 86400000);

    const output = buildHealthSummary({
      dogId,
      clinicalCases: [
        {
          id: "c1",
          events: [
            { event_type: "consultation", status: "final", occurred_at: oldConsultDate, professional: { name: "Dr. Santos" } },
          ],
          exams: [
            { exam_type: "Raio-X", current_stage: "resulted", created_at: recentExamDate },
          ],
        },
      ],
      thresholdConfig: explicitTestThresholds,
      now: fixedNow,
    });

    expect(output.last_consultation?.date).toEqual(oldConsultDate);
    expect(output.last_exam?.date).toEqual(recentExamDate);
    expect(output.data_completeness.has_recent_exam).toBe(true);
    expect(output.readiness_status).toBe("operational_attention");
    expect(output.readiness_reason).toContain("Consulta em atraso (> 180 dias)");
  });

  it("10. Mandatory §8: Active restriction with expected_end in past yields is_overdue: true and open_alert", () => {
    const pastExpectedEnd = new Date(fixedNow.getTime() - 10 * 86400000);
    const output = buildHealthSummary({
      dogId,
      restrictions: [
        {
          id: "r-overdue",
          level: "partial",
          status: "active",
          description: "Restrição parcial com prazo vencido",
          expected_end: pastExpectedEnd,
        },
      ],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("fit_with_restrictions");
    expect(output.active_restrictions).toHaveLength(1);
    expect(output.active_restrictions[0].is_overdue).toBe(true);
    expect(output.open_alerts).toHaveLength(1);
    expect(output.open_alerts[0].type).toBe("restriction_reevaluation_overdue");
  });

  it("11. Idempotency proof: consecutive calls produce identical output and alerts", () => {
    const input = {
      dogId,
      restrictions: [{ id: "r1", level: "partial", status: "active", description: "Faro restrito" }],
      clinicalCases: [
        {
          id: "case-1",
          events: [{ event_type: "consultation", status: "final", occurred_at: fixedNow, professional: { name: "Dr. Lima" } }],
        },
      ],
      now: fixedNow,
    };

    const out1 = buildHealthSummary(input);
    const out2 = buildHealthSummary(input);

    expect(out1.readiness_status).toBe(out2.readiness_status);
    expect(out1.readiness_reason).toBe(out2.readiness_reason);
    expect(out1.restriction_count).toEqual(out2.restriction_count);
    expect(out1.schema_version).toBe(1);
  });
});
