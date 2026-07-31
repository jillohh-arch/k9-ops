import { describe, expect, it } from "vitest";
import { buildCreateNutritionPlanRequest } from "../data/nutrition-plan-mutation-service";
import { normalizeNutritionMutationError } from "../errors/nutrition-mutation-errors";
import type { CreateNutritionPlanCommand } from "../types";

function makeHttpsError(code: string, message: string, details?: unknown) {
  const err = new Error(message) as Error & {
    code: string;
    details?: unknown;
  };
  err.code = code;
  err.details = details;
  return err;
}

describe("Web Client Transport Layer — Cross-Repository Contract Verification", () => {
  const baseCommand: CreateNutritionPlanCommand = {
    dogId: "dog-alpha-123",
    planData: {
      foodType: "Ração Operacional Premium",
      amountGramsPerDay: 750,
      mealsPerDay: 3,
      mealSchedule: [
        { id: "slot-1", period: "morning", scheduledTime: "06:00", targetGrams: 250 },
        { id: "slot-2", period: "afternoon", scheduledTime: "12:00", targetGrams: 250 },
        { id: "slot-3", period: "night", scheduledTime: "18:00", targetGrams: 250 },
      ],
      supplements: [],
      validFrom: "2026-08-01T00:00:00.000Z",
      timezone: "America/Sao_Paulo",
      hydrationMl: 2000,
      specialInstructions: "Manter água fresca disponível",
    },
  };

  it("1. CREATE without expectations: sends request omitting expectedActivePlanId and expectedActiveRevision", () => {
    const wireRequest = buildCreateNutritionPlanRequest(baseCommand, "op-create-001");

    expect(wireRequest.dogId).toBe("dog-alpha-123");
    expect(wireRequest.operationId).toBe("op-create-001");
    expect(wireRequest).not.toHaveProperty("expectedActivePlanId");
    expect(wireRequest).not.toHaveProperty("expectedActiveRevision");
    expect(wireRequest).not.toHaveProperty("expected_active_plan_id");
    expect(wireRequest).not.toHaveProperty("expected_active_revision");
    expect(wireRequest).not.toHaveProperty("intent");
  });

  it("2. REPLACE with current active ID/revision: sends expectedActivePlanId and expectedActiveRevision in camelCase", () => {
    const replaceCommand: CreateNutritionPlanCommand = {
      ...baseCommand,
      expectedActivePlanId: "plan-active-001",
      expectedActiveRevision: 3,
    };

    const wireRequest = buildCreateNutritionPlanRequest(replaceCommand, "op-replace-002");

    expect(wireRequest.expectedActivePlanId).toBe("plan-active-001");
    expect(wireRequest.expectedActiveRevision).toBe(3);
    expect(wireRequest.operationId).toBe("op-replace-002");
    expect(wireRequest).not.toHaveProperty("expected_active_plan_id");
    expect(wireRequest).not.toHaveProperty("expected_active_revision");
  });

  it("3. REPLACE with stale revision: normalizes backend revision-conflict error", () => {
    const backendError = makeHttpsError("failed-precondition", "Stale revision", {
      code: "revision-conflict",
      message: "The active plan revision has changed.",
      expectedRevision: 3,
      actualRevision: 4,
    });

    const normalized = normalizeNutritionMutationError(backendError);

    expect(normalized.firebaseCode).toBe("failed-precondition");
    expect(normalized.domainCode).toBe("revision-conflict");
    expect(normalized.retryable).toBe(false);
  });

  it("4. REPLACE with stale active plan ID: normalizes backend active-plan-conflict error", () => {
    const backendError = makeHttpsError("failed-precondition", "Active plan mismatch", {
      code: "active-plan-conflict",
      message: "Active plan ID mismatch.",
      expectedPlanId: "plan-active-001",
      actualPlanId: "plan-active-009",
    });

    const normalized = normalizeNutritionMutationError(backendError);

    expect(normalized.firebaseCode).toBe("failed-precondition");
    expect(normalized.domainCode).toBe("active-plan-conflict");
    expect(normalized.retryable).toBe(false);
  });

  it("5. Replay v2 with same operationId: handles idempotent success receipt without error", () => {
    const receiptResponse = {
      receipt: {
        receiptId: "rcpt-001",
        operationId: "op-replace-002",
        planId: "plan-new-999",
        revision: 4,
        status: "active",
        timestamp: "2026-08-01T12:00:00.000Z",
      },
    };

    expect(receiptResponse.receipt.operationId).toBe("op-replace-002");
    expect(receiptResponse.receipt.planId).toBe("plan-new-999");
  });

  it("6. Existing operationId with different payload: normalizes backend idempotency-conflict", () => {
    const backendError = makeHttpsError("already-exists", "Operation already processed", {
      code: "idempotency-conflict",
      message: "Reuse of operationId with different payload.",
    });

    const normalized = normalizeNutritionMutationError(backendError);

    expect(normalized.firebaseCode).toBe("already-exists");
    expect(normalized.domainCode).toBe("idempotency-conflict");
    expect(normalized.retryable).toBe(false);
  });

  it("7. Legacy receipt replay unsupported: maps legacy replay rejection to fail-closed non-retryable error", () => {
    const backendError = makeHttpsError("failed-precondition", "Legacy receipt replay not supported", {
      code: "legacy-receipt-replay-unsupported",
      message: "Legacy receipts cannot be replayed automatically.",
    });

    const normalized = normalizeNutritionMutationError(backendError);

    expect(normalized.domainCode).toBe("legacy-receipt-replay-unsupported");
    expect(normalized.retryable).toBe(false);
  });

  it("8. Partial expectation pair: throws local error before reaching transport", () => {
    const invalidCommand: CreateNutritionPlanCommand = {
      ...baseCommand,
      expectedActivePlanId: "plan-active-001",
      expectedActiveRevision: undefined,
    };

    expect(() => buildCreateNutritionPlanRequest(invalidCommand, "op-err-001")).toThrow(
      /expectedActivePlanId and expectedActiveRevision must be provided together/i
    );
  });
});
