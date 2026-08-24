import { describe, it, expect } from "vitest";
import {
  buildCreateNutritionPlanRequest,
  executeCreateNutritionPlan,
} from "../data/nutrition-plan-mutation-service";
import { normalizeNutritionMutationError } from "../errors/nutrition-mutation-errors";
import type { CreateNutritionPlanCommand } from "../mutation-types";

/**
 * P5-CR2-R2 PROVENANCE & WIRE CONTRACT TEST
 *
 * Demonstrates strict adherence to real Web client productive modules:
 * Request Builder: buildCreateNutritionPlanRequest (src/features/health/nutrition/data/nutrition-plan-mutation-service.ts)
 * Mutation Service: executeCreateNutritionPlan (src/features/health/nutrition/data/nutrition-plan-mutation-service.ts)
 * Error Normalizer: normalizeNutritionMutationError (src/features/health/nutrition/errors/nutrition-mutation-errors.ts)
 */

describe("Web Client Productive Provenance & Wire Contract", () => {
  const baseCommand: CreateNutritionPlanCommand = {
    dogId: "k9-provenance-dog",
    planData: {
      foodType: "Ração Operacional Provenance",
      amountGramsPerDay: 750,
      mealsPerDay: 2,
      timezone: "America/Sao_Paulo",
      validFrom: "2026-07-31T12:00:00.000Z",
      validUntil: null,
      mealSchedule: [
        { id: "s1", period: "morning", scheduledTime: "08:00", targetGrams: 375 },
        { id: "s2", period: "night", scheduledTime: "20:00", targetGrams: 375 },
      ],
      supplements: [],
      hydrationMl: 1500,
      specialInstructions: "Obs provenance",
    },
  };

  it("proves CREATE wire request builder attaches no expectations, no intent, no snake_case root keys", () => {
    const opId = "op-create-prov-1";
    const wireRequest = buildCreateNutritionPlanRequest(baseCommand, opId);

    // Root keys
    expect(wireRequest.dogId).toBe("k9-provenance-dog");
    expect(wireRequest.operationId).toBe(opId);
    expect(wireRequest.expectedActivePlanId).toBeUndefined();
    expect(wireRequest.expectedActiveRevision).toBeUndefined();

    // No root intent or snake_case root aliases
    const rawKeys = Object.keys(wireRequest as unknown as Record<string, unknown>);
    expect(rawKeys).not.toContain("intent");
    expect(rawKeys).not.toContain("expected_active_plan_id");
    expect(rawKeys).not.toContain("expected_active_revision");
    expect(rawKeys).not.toContain("dog_id");
    expect(rawKeys).not.toContain("operation_id");
  });

  it("proves REPLACE wire request builder attaches camelCase expectations from revised snapshot", () => {
    const opId = "op-replace-prov-1";
    const replaceCmd: CreateNutritionPlanCommand = {
      ...baseCommand,
      expectedActivePlanId: "plan-active-123",
      expectedActiveRevision: 4,
    };

    const wireRequest = buildCreateNutritionPlanRequest(replaceCmd, opId);

    expect(wireRequest.dogId).toBe("k9-provenance-dog");
    expect(wireRequest.operationId).toBe(opId);
    expect(wireRequest.expectedActivePlanId).toBe("plan-active-123");
    expect(wireRequest.expectedActiveRevision).toBe(4);

    const rawKeys = Object.keys(wireRequest as unknown as Record<string, unknown>);
    expect(rawKeys).not.toContain("intent");
    expect(rawKeys).not.toContain("expected_active_plan_id");
    expect(rawKeys).not.toContain("expected_active_revision");
  });

  it("proves error normalizer maps backend detail codes to domain conflict errors", () => {
    const revErr = Object.assign(new Error("Revision desatualizada"), {
      code: "functions/failed-precondition",
      details: { code: "revision-conflict" },
    });

    const normalized = normalizeNutritionMutationError(revErr, "Context msg");
    expect(normalized.domainCode).toBe("revision-conflict");
    expect(normalized.details?.code).toBe("revision-conflict");
  });

  it("proves executeCreateNutritionPlan is a function exposed by productive mutation service", () => {
    expect(typeof executeCreateNutritionPlan).toBe("function");
  });
});
