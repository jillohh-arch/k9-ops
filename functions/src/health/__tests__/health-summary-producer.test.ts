/**
 * K9 Ops Backend — Health Web v1 HW-3P
 * Pure Projection Producer Unit Tests
 *
 * Implements pure unit test suite covering all 15 scenarios in HW-3P §21.
 */

import { describe, expect, it } from "vitest";
import { buildHealthSummary } from "../health-summary-builder";

const fixedNow = new Date("2026-08-09T12:00:00.000Z");
const dogId = "k9-odin";

describe("HW-3P Backend Projection Producer (Pure Engine)", () => {
  it("1. no evaluation -> not_evaluated", () => {
    const output = buildHealthSummary({ dogId, now: fixedNow });
    expect(output.readiness_status).toBe("not_evaluated");
    expect(output.readiness_label).toBe("Não avaliado");
    expect(output.readiness_reason).toBe("Nenhuma avaliação registrada");
    expect(output.schema_version).toBe(1);
  });

  it("2. complete evidence + no restriction -> operational", () => {
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      vaccinationRecords: [{ id: "v1", type: "V10", date: fixedNow, next_due: new Date(fixedNow.getTime() + 30 * 86400000) }],
      nutritionPlans: [{ id: "n1", status: "active", food_type: "Super Premium", daily_amount_g: 500 }],
      clinicalCases: [{ id: "c1", clinical_status: "discharged", events: [{ type: "exam", date: fixedNow }] }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational");
    expect(output.readiness_label).toBe("Operacional");
    expect(output.data_completeness.has_recent_weight).toBe(true);
    expect(output.data_completeness.has_active_nutrition).toBe(true);
    expect(output.data_completeness.has_vaccination_current).toBe(true);
    expect(output.data_completeness.has_recent_exam).toBe(true);
  });

  it("3. attention restriction -> operational_attention", () => {
    const output = buildHealthSummary({
      dogId,
      restrictions: [{ id: "r1", level: "attention", status: "active", description: "Monitorar hidratação" }],
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      vaccinationRecords: [{ id: "v1", date: fixedNow }],
      nutritionPlans: [{ id: "n1", status: "active" }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational_attention");
    expect(output.readiness_label).toBe("Operacional com atenção");
    expect(output.readiness_reason).toBe("Monitorar hidratação");
    expect(output.restriction_count.attention).toBe(1);
  });

  it("4. partial restriction -> fit_with_restrictions", () => {
    const output = buildHealthSummary({
      dogId,
      restrictions: [{ id: "r2", level: "partial", status: "active", description: "Sem faro contínuo" }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("fit_with_restrictions");
    expect(output.readiness_label).toBe("Apto com restrições");
    expect(output.readiness_reason).toBe("Sem faro contínuo");
    expect(output.restriction_count.partial).toBe(1);
  });

  it("5. absolute restriction -> temporarily_unfit", () => {
    const output = buildHealthSummary({
      dogId,
      restrictions: [{ id: "r3", level: "absolute", status: "active", description: "Repouso absoluto veterinário" }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("temporarily_unfit");
    expect(output.readiness_label).toBe("Temporariamente inapto");
    expect(output.readiness_reason).toBe("Repouso absoluto veterinário");
    expect(output.restriction_count.absolute).toBe(1);
  });

  it("6. multiple: attention + partial -> fit_with_restrictions", () => {
    const output = buildHealthSummary({
      dogId,
      restrictions: [
        { id: "r1", level: "attention", status: "active", description: "Observar olho" },
        { id: "r2", level: "partial", status: "active", description: "Sem saltos" },
      ],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("fit_with_restrictions");
    expect(output.restriction_count.partial).toBe(1);
    expect(output.restriction_count.attention).toBe(1);
  });

  it("7. multiple: absolute + partial -> temporarily_unfit", () => {
    const output = buildHealthSummary({
      dogId,
      restrictions: [
        { id: "r2", level: "partial", status: "active", description: "Sem faro" },
        { id: "r3", level: "absolute", status: "active", description: "Inapto cirúrgico" },
      ],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("temporarily_unfit");
    expect(output.restriction_count.absolute).toBe(1);
    expect(output.restriction_count.partial).toBe(1);
  });

  it("8. incomplete data (missing recent weight or nutrition) -> operational_attention", () => {
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 30, measured_at: new Date(fixedNow.getTime() - 100 * 86400000) }], // > 90 days
      vaccinationRecords: [{ id: "v1", date: fixedNow }],
      nutritionPlans: [], // missing
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational_attention");
    expect(output.data_completeness.has_recent_weight).toBe(false);
    expect(output.data_completeness.has_active_nutrition).toBe(false);
    expect(output.readiness_reason).toContain("Pesagem em atraso");
    expect(output.readiness_reason).toContain("Plano alimentar ausente");
  });

  it("9. ended restriction -> ignored for active status", () => {
    const output = buildHealthSummary({
      dogId,
      restrictions: [{ id: "r1", level: "absolute", status: "ended", description: "Antiga restrição encerrada" }],
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      vaccinationRecords: [{ id: "v1", date: fixedNow }],
      nutritionPlans: [{ id: "n1", status: "active" }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational");
    expect(output.active_restrictions).toHaveLength(0);
    expect(output.restriction_count.absolute).toBe(0);
  });

  it("10. cancelled restriction -> ignored for active status", () => {
    const output = buildHealthSummary({
      dogId,
      restrictions: [{ id: "r1", level: "absolute", status: "cancelled", description: "Erro administrativo" }],
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      vaccinationRecords: [{ id: "v1", date: fixedNow }],
      nutritionPlans: [{ id: "n1", status: "active" }],
      now: fixedNow,
    });

    expect(output.readiness_status).toBe("operational");
    expect(output.active_restrictions).toHaveLength(0);
  });

  it("11. idempotency -> consecutive builds with same sources yield identical logical output", () => {
    const sources = {
      dogId,
      restrictions: [{ id: "r1", level: "partial", status: "active", description: "Faro restrito" }],
      weightRecords: [{ id: "w1", weight_kg: 33, measured_at: fixedNow }],
      now: fixedNow,
    };

    const out1 = buildHealthSummary(sources);
    const out2 = buildHealthSummary(sources);

    expect(out1.readiness_status).toBe(out2.readiness_status);
    expect(out1.readiness_reason).toBe(out2.readiness_reason);
    expect(out1.restriction_count).toEqual(out2.restriction_count);
    expect(out1.schema_version).toBe(out2.schema_version);
  });

  it("12. source mutation -> changing restriction level updates readiness status", () => {
    const outPartial = buildHealthSummary({
      dogId,
      restrictions: [{ id: "r1", level: "partial", status: "active", description: "Faro restrito" }],
      now: fixedNow,
    });
    expect(outPartial.readiness_status).toBe("fit_with_restrictions");

    const outAbsolute = buildHealthSummary({
      dogId,
      restrictions: [{ id: "r1", level: "absolute", status: "active", description: "Cirurgia de joelho" }],
      now: fixedNow,
    });
    expect(outAbsolute.readiness_status).toBe("temporarily_unfit");
  });

  it("13. source deletion/ended -> ending restriction restores operational status when complete", () => {
    const outEnded = buildHealthSummary({
      dogId,
      restrictions: [{ id: "r1", level: "absolute", status: "ended" }],
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      vaccinationRecords: [{ id: "v1", date: fixedNow }],
      nutritionPlans: [{ id: "n1", status: "active" }],
      now: fixedNow,
    });

    expect(outEnded.readiness_status).toBe("operational");
  });

  it("14. schema_version is strict numeric 1", () => {
    const output = buildHealthSummary({ dogId, now: fixedNow });
    expect(output.schema_version).toBe(1);
    expect(typeof output.schema_version).toBe("number");
  });

  it("15. timestamps semantic correctness", () => {
    const priorReadinessDate = new Date("2026-08-01T00:00:00.000Z");
    const existingSummary = {
      readiness_status: "operational",
      readiness_reason: "Nenhuma restrição ou pendência ativa",
      readiness_updated_at: priorReadinessDate,
    };

    // Rebuilding with unchanged readiness status preserves readiness_updated_at
    const output = buildHealthSummary({
      dogId,
      weightRecords: [{ id: "w1", weight_kg: 34, measured_at: fixedNow }],
      vaccinationRecords: [{ id: "v1", date: fixedNow }],
      nutritionPlans: [{ id: "n1", status: "active" }],
      existingSummary,
      now: fixedNow,
    });

    expect(output.readiness_updated_at.getTime()).toBe(priorReadinessDate.getTime());
    expect(output.last_evaluated_at.getTime()).toBe(fixedNow.getTime());
    expect(output.updated_at.getTime()).toBe(fixedNow.getTime());
  });
});
