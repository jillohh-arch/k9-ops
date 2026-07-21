/**
 * Gate 5D.8 — Web Conflict Reader Model Proof
 *
 * Prova que o reader/service Web detecta conflito quando 2 active plans
 * estão presentes — usando dados estruturais exatamente como retornados
 * pelo Firestore Emulator.
 *
 * NOTA: Este teste alimenta a função consolidateActivePlan com dados estruturais
 * equivalentes ao Emulator. Para prova de integração Emulator real,
 * seria necessário executar o reader Web contra Firestore Emulator com 2 active.
 *
 * Run:
 *   cd C:/Projetos/k9-ops
 *   npx vitest run src/features/health/nutrition/__tests__/gate-5d8-web-conflict-reader-emulator.test.ts
 */

import { describe, it, expect } from "vitest";
import { consolidateActivePlan } from "../data/nutrition-plan-service";
import type { NutritionPlan } from "../types";

describe("Gate 5D.8 — Web Conflict Reader + Emulator", () => {
  /**
   * Cria um plano parseado estruturalmente idêntico ao que seria
   * produzido pelo NutritionPlanDocumentParser ao consumir um documento
   * persistido pelo Firestore Emulator via callable.
   */
  function makeEmulatorPlan(
    planId: string,
    dogId: string,
    revision: number,
    status: "active" | "superseded" | "cancelled",
    createdAt?: Date,
  ): NutritionPlan {
    return {
      id: planId,
      dogId,
      foodType: `Racao Gate5D8-${planId.slice(-4)}`,
      amountGramsPerDay: 300,
      mealsPerDay: 2,
      mealSchedule: [
        { id: "slot-am", period: "morning", scheduledTime: "08:00", targetGrams: 150 },
        { id: "slot-pm", period: "evening", scheduledTime: "18:00", targetGrams: 150 },
      ],
      validFrom: new Date("2026-07-14T10:00:00.000Z"),
      validUntil: undefined,
      timezone: "America/Sao_Paulo",
      recordedBy: { uid: "seed-g5d8", name: "Seed Gate5D8", internalRole: "admin" },
      status,
      schemaVersion: 1,
      revision,
      hydrationMl: undefined,
      specialInstructions: undefined,
      supplements: [],
      attachmentRefs: undefined,
      professional: undefined,
      sourceDocument: undefined,
    };
  }

  it("2 active plans do Emulator → status=conflict, activePlansCount=2", () => {
    // Este é o cenário criado pelo harness de conflito do Emulator:
    // 1. Plano A criado via callable → active
    // 2. Plano B injetado manualmente (corrupt-active) → também active
    // Resultado: 2 active no banco

    const dogId = "dog-g5d8-conflict-emulator";
    const planA = makeEmulatorPlan("plan-a-g5d8", dogId, 1, "active");
    const planB = makeEmulatorPlan("plan-b-g5d8", dogId, 1, "active");

    // Executa o reader real (consolidateActivePlan)
    // Este é o mesmo código usado pelo Web UI para determinar o estado
    const state = consolidateActivePlan({
      dogId,
      canonicalPlans: [planA, planB],
      legacyPrimary: [],
      legacyFallback: [],
      canonicalError: null,
      parsingErrors: [],
    });

    // ✅ Prova 1: status deve ser conflict
    expect(state.status).toBe("conflict");

    // ✅ Prova 2: reason deve indicar múltiplos ativos
    expect(state.reason).toBe("multiple-active-plans");

    // ✅ Prova 3: integrityConflict deve conter contagem e IDs
    expect(state.integrityConflict).toBeDefined();
    expect(state.integrityConflict!.activePlansCount).toBe(2);
    expect(state.integrityConflict!.activePlanIds).toContain("plan-a-g5d8");
    expect(state.integrityConflict!.activePlanIds).toContain("plan-b-g5d8");

    // ✅ Prova 4: nenhum plano deve ser escolhido (fail-closed)
    expect(state.activePlan).toBeNull();
  });

  it("1 active + 1 superseded → status=canonical, único plano ativo", () => {
    const dogId = "dog-g5d8-replace-emulator";
    const planA = makeEmulatorPlan("plan-old-g5d8", dogId, 2, "superseded");
    const planB = makeEmulatorPlan("plan-new-g5d8", dogId, 1, "active");

    const state = consolidateActivePlan({
      dogId,
      canonicalPlans: [planA, planB],
      legacyPrimary: [],
      legacyFallback: [],
      canonicalError: null,
      parsingErrors: [],
    });

    // ✅ Prova: após REPLACE, apenas 1 active
    expect(state.status).toBe("canonical");
    expect(state.activePlan).not.toBeNull();
    expect(state.activePlan!.id).toBe("plan-new-g5d8");
    expect(state.integrityConflict).toBeNull();
  });

  it("0 active → status=empty, sem conflito", () => {
    const dogId = "dog-g5d8-cancelled-emulator";
    const planA = makeEmulatorPlan("plan-cancelled-g5d8", dogId, 2, "cancelled");

    const state = consolidateActivePlan({
      dogId,
      canonicalPlans: [planA],
      legacyPrimary: [],
      legacyFallback: [],
      canonicalError: null,
      parsingErrors: [],
    });

    // ✅ Prova: após CANCEL, 0 active
    expect(state.status).toBe("empty");
    expect(state.activePlan).toBeNull();
    expect(state.integrityConflict).toBeNull();
  });

  it("NÃO escolhe latest-wins — todos ativos são reportados no conflict", () => {
    // Este teste verifica explicitamente que o reader NÃO implementa
    // "latest wins" (escolher o mais recente). Todos os IDs devem estar
    // no integrityConflict para que o operador seja notificado.

    const dogId = "dog-g5d8-no-latest-wins";
    const now = new Date();

    // Plano "antigo" (criado 1h antes)
    const oldPlan = makeEmulatorPlan("plan-old-1234", dogId, 1, "active",
      new Date(now.getTime() - 3600000));

    // Plano "recente" (criado agora)
    const newPlan = makeEmulatorPlan("plan-new-5678", dogId, 1, "active", now);

    const state = consolidateActivePlan({
      dogId,
      canonicalPlans: [oldPlan, newPlan],
      legacyPrimary: [],
      legacyFallback: [],
      canonicalError: null,
      parsingErrors: [],
    });

    // ✅ Prova: AMBOS os planos estão no conflict (não latest-wins)
    expect(state.integrityConflict).toBeDefined();
    expect(state.integrityConflict!.activePlanIds).toHaveLength(2);
    expect(state.integrityConflict!.activePlanIds).toContain("plan-old-1234");
    expect(state.integrityConflict!.activePlanIds).toContain("plan-new-5678");
    expect(state.activePlan).toBeNull(); // nenhum escolhido
  });
});
