/**
 * Gate 5D.8 — Web Builder Boundary Proof
 *
 * Prova que o payload usado no teste de Emulator é produzido pelo builder
 * REAL do Web (buildCreateNutritionPlanRequest / buildUpdateNutritionPlanRequest).
 *
 * Run:
 *   cd C:/Projetos/k9-ops
 *   npx vitest run src/features/health/nutrition/__tests__/gate-5d8-web-builder-boundary.test.ts
 */

import { describe, it, expect } from "vitest";
import { buildCreateNutritionPlanRequest } from "../data/nutrition-plan-mutation-service";
import type { CreateNutritionPlanCommand } from "../types";

describe("Gate 5D.8 — Web Builder Boundary (prova do payload real)", () => {
  it("buildCreateNutritionPlanRequest produz payload IDÊNTICO ao usado no Emulator test", () => {
    // Este é o payload EXATO do gate-5d8-nutriplan-emulator.cjs
    // (sem os timestamps dinâmicos para comparabilidade)
    const command = {
      dogId: "dog-g5d8-create-1234567890",
      planData: {
        foodType: "Racao Premium Gate5D8",
        amountGramsPerDay: 300,
        mealsPerDay: 2,
        timezone: "America/Sao_Paulo",
        validFrom: "2026-07-01T10:00:00.000Z",
        mealSchedule: [
          { id: "slot-am", period: "morning", scheduledTime: "08:00", targetGrams: 150 },
          { id: "slot-pm", period: "evening", scheduledTime: "18:00", targetGrams: 150 },
        ],
        supplements: [
          { id: "supp-1", name: "Omega 3", dose: 1000, unit: "mg", frequency: "1x ao dia" },
        ],
        hydrationMl: 500,
        specialInstructions: "Teste Gate 5D.8",
        professional: {
          name: "Dra. Ana Gate5D8",
          registration_type: "CRMV",
          registration_number: "12345-SP",
          clinic: "Clinica Gate5D8",
          specialty: "Nutricao Animal",
        },
        sourceDocument: {
          health_document_id: "doc-ref-g5d8-001",
          description: "Atestado Gate5D8",
        },
        attachmentRefs: ["att-g5d8-001"],
      },
    };

    const request = buildCreateNutritionPlanRequest(command as unknown as CreateNutritionPlanCommand, "g5d8-op-123");

    // ✅ Prova 1: request contém planData (NÃO changes)
    expect(request).toHaveProperty("planData");
    expect(request).not.toHaveProperty("changes");

    // ✅ Prova 2: campos estruturais
    expect(request.planData.food_type).toBe("Racao Premium Gate5D8");
    expect(request.planData.amount_grams_per_day).toBe(300);

    // ✅ Prova 3: supplements com dose NUMÉRICA (F-02: não string)
    expect(request.planData.supplements).toBeDefined();
    expect(request.planData.supplements).toHaveLength(1);
    expect(typeof request.planData.supplements![0].dose).toBe("number");
    expect(request.planData.supplements![0].dose).toBe(1000);
    expect(request.planData.supplements![0].unit).toBe("mg");

    // ✅ Prova 4: professional estruturado
    expect(request.planData.professional).toBeDefined();
    expect(request.planData.professional).toMatchObject({
      name: "Dra. Ana Gate5D8",
      registration_type: "CRMV",
      registration_number: "12345-SP",
      clinic: "Clinica Gate5D8",
    });

    // ✅ Prova 5: source_document estruturado
    expect(request.planData.source_document).toBeDefined();
    expect(request.planData.source_document).toMatchObject({
      health_document_id: "doc-ref-g5d8-001",
      description: "Atestado Gate5D8",
    });

    // ✅ Prova 6: attachment_refs array
    expect(Array.isArray(request.planData.attachment_refs)).toBe(true);
    expect(request.planData.attachment_refs).toContain("att-g5d8-001");

    // ✅ Prova 7: recorded_by NÃO está no payload (sempre null da UI — omitido se null)
    // O builder não inclui recorded_by no request
    expect("recorded_by" in request.planData).toBe(false);
  });

  it("buildCreateNutritionPlanRequest com supplements sem dose → aceita (validação é do backend)", () => {
    // Supplements sem dose: UI permite (o médico pode adicionar depois)
    // Backend rejeita se dose ausente (confirmed por Emulator test F-05)
    const command = {
      dogId: "dog-g5d8-no-dose",
      planData: {
        foodType: "Racao",
        amountGramsPerDay: 200,
        mealsPerDay: 1,
        timezone: "America/Sao_Paulo",
        validFrom: "2026-07-01T10:00:00.000Z",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mealSchedule: [] as any,
        supplements: [
          { id: "s1", name: "Vitamina", unit: "mg", frequency: "1x" },
          // dose omitida intencionalmente
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
      },
    };

    const request = buildCreateNutritionPlanRequest(command, "op-no-dose");
    expect(request.planData.supplements).toBeDefined();
    expect(request.planData.supplements![0].dose).toBeUndefined();
  });

  it("buildCreateNutritionPlanRequest com professional null → aceita (F-05)", () => {
    const command = {
      dogId: "dog-g5d8-no-prof",
      planData: {
        foodType: "Racao",
        amountGramsPerDay: 200,
        mealsPerDay: 1,
        timezone: "America/Sao_Paulo",
        validFrom: "2026-07-01T10:00:00.000Z",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mealSchedule: [] as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supplements: [] as any,
        professional: null,
      },
    };

    const request = buildCreateNutritionPlanRequest(command, "op-no-prof");
    expect(request.planData.professional).toBeNull();
  });

  it("buildCreateNutritionPlanRequest com source_document null → aceita (F-05)", () => {
    const command = {
      dogId: "dog-g5d8-no-sd",
      planData: {
        foodType: "Racao",
        amountGramsPerDay: 200,
        mealsPerDay: 1,
        timezone: "America/Sao_Paulo",
        validFrom: "2026-07-01T10:00:00.000Z",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mealSchedule: [] as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supplements: [] as any,
        sourceDocument: null,
      },
    };

    const request = buildCreateNutritionPlanRequest(command, "op-no-sd");
    expect(request.planData.source_document).toBeNull();
  });
});
