/**
 * K9 Ops Backend — Health Web v1 HW-3P Corrective
 * Pure Projection Producer Unit Tests
 *
 * Implements unit test suite covering all corrective requirements in HW-3P §2-§4, §13, §14.
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

describe("HW-3P Corrective Backend Projection Engine", () => {
  it("1. K9 never evaluated -> not_evaluated (hasHealthEvaluation returns false)", () => {
    const evaluated = hasHealthEvaluation({ dogId });
    expect(evaluated).toBe(false);

    const output = buildHealthSummary({ dogId, now: fixedNow });
    expect(output.readiness_status).toBe("not_evaluated");
    expect(output.readiness_label).toBe("Não avaliado");
    expect(output.readiness_reason).toBe("Nenhuma avaliação registrada");
  });

  it("2. Administrative schedule item alone != clinical evaluation -> not_evaluated", () => {
    const input = {
      dogId,
      healthSchedule: [{ id: "sch-1", title: "Vermifugação agendada", status: "scheduled" }],
      now: fixedNow,
    };
    expect(hasHealthEvaluation(input)).toBe(false);

    const output = buildHealthSummary(input);
    expect(output.readiness_status).toBe("not_evaluated");
  });

  it("3. Default production thresholds (unconfigured): weight > 90 days does NOT generate attention", () => {
    const oldWeightDate = new Date(fixedNow.getTime() - 120 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: oldWeightDate }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational"); // No attention because threshold is not configured in production!
    expect(output.data_completeness.has_recent_weight).toBe(true);
    expect(output.last_weight?.kg).toBe(34);
  });

  it("4. Explicit test configuration: weight > 90 days generates operational_attention", () => {
    const oldWeightDate = new Date(fixedNow.getTime() - 120 * 86400000);
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: oldWeightDate }],
      thresholdConfig: explicitTestThresholds,
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational_attention");
    expect(output.readiness_reason).toContain("Pesagem em atraso (> 90 dias)");
    expect(output.data_completeness.has_recent_weight).toBe(false);
  });

  it("5. Consultation vs Exam distinction: consultation > 180 days generates attention with explicit config", () => {
    const oldConsultDate = new Date(fixedNow.getTime() - 200 * 86400000);
    const recentExamDate = new Date(fixedNow.getTime() - 10 * 86400000);

    const output = buildHealthSummary({
      dogId,
      clinicalCases: [
        {
          id: "c1",
          events: [
            { type: "consultation", date: oldConsultDate, vet_name: "Dr. Santos" },
            { type: "exam", date: recentExamDate, subtype: "Raio-X" },
          ],
        },
      ],
      thresholdConfig: explicitTestThresholds,
      now: fixedNow,
    });

    expect((output.last_consultation?.date as Date).toISOString()).toBe(oldConsultDate.toISOString());
    expect((output.last_exam?.date as Date).toISOString()).toBe(recentExamDate.toISOString());
    expect(output.data_completeness.has_recent_exam).toBe(true);
    expect(output.readiness_status).toBe("operational_attention");
    expect(output.readiness_reason).toContain("Consulta em atraso (> 180 dias)");
  });

  it("6. Active restriction with expected_end in past STILL counts as active until ended/cancelled", () => {
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
    expect(output.active_restrictions[0].expected_end).toEqual(pastExpectedEnd);
  });

  it("7. Ended or cancelled restriction status releases active restriction", () => {
    const outputEnded = buildHealthSummary({
      dogId,
      restrictions: [{ id: "r1", level: "absolute", status: "ended" }],
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      now: fixedNow,
    });
    expect(outputEnded.readiness_status).toBe("operational");

    const outputCancelled = buildHealthSummary({
      dogId,
      restrictions: [{ id: "r2", level: "absolute", status: "cancelled" }],
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      now: fixedNow,
    });
    expect(outputCancelled.readiness_status).toBe("operational");
  });

  it("8. Timestamps: readiness_updated_at preserved when status/reason unchanged, updated_at & last_evaluated_at update", () => {
    const priorReadinessDate = new Date("2026-08-01T00:00:00.000Z");
    const existingSummary = {
      readiness_status: "operational",
      readiness_reason: "Nenhuma restrição ou pendência ativa",
      readiness_updated_at: priorReadinessDate,
    };

    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      existingSummary,
      now: fixedNow,
    });

    expect(output.readiness_updated_at.getTime()).toBe(priorReadinessDate.getTime());
    expect(output.last_evaluated_at.getTime()).toBe(fixedNow.getTime());
    expect(output.updated_at.getTime()).toBe(fixedNow.getTime());
  });

  it("9. Idempotency proof: consecutive calls produce identical output", () => {
    const input = {
      dogId,
      restrictions: [{ id: "r1", level: "partial", status: "active", description: "Faro restrito" }],
      weightRecords: [{ id: "w1", weight_kg: 33, measured_at: fixedNow }],
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
