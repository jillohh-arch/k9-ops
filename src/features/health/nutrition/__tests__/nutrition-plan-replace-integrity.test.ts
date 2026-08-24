/**
 * K9 Ops Web — Health Web v1 / WEB-01B.3
 * REPLACE atomicity at the transport level.
 *
 * The source repo proved this through the replace dialog
 * (nutrition-plan-replace-integrity.test.tsx). That test imports
 * NutritionPlanReplaceDialog, which belongs to a later UI phase, so it is
 * deferred. The property it guarded is not deferred: REPLACE must reach the
 * backend as ONE CreateAndActivatePlan invocation carrying the expectation
 * pair, never as a client-side cancel-then-create sequence.
 *
 * A client-side sequence would leave a window where the K9 has no active plan
 * (or two), and would lose the backend's single-transaction supersede. These
 * tests assert the invariant against the mocked callable factory, so a
 * regression that introduced a CANCEL call would fail here rather than in
 * production.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Functions } from "firebase/functions";

import {
  buildCreateNutritionPlanRequest,
  executeCreateNutritionPlan,
} from "../data/nutrition-plan-mutation-service";
import type { CreateNutritionPlanCommand } from "../mutation-types";

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(),
}));

import { httpsCallable } from "firebase/functions";

const mockHttpsCallable = httpsCallable as unknown as ReturnType<typeof vi.fn>;

function createMockFunctions(): Functions {
  return {} as Functions;
}

const replaceCommand: CreateNutritionPlanCommand = {
  dogId: "dog-1",
  expectedActivePlanId: "plan-active-1",
  expectedActiveRevision: 3,
  planData: {
    foodType: "Ração Premium",
    amountGramsPerDay: 520,
    mealsPerDay: 3,
    timezone: "America/Sao_Paulo",
    validFrom: "2026-08-12T00:00:00.000Z",
    mealSchedule: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WEB-01B.3 — REPLACE integrity (single atomic callable)", () => {
  it("issues exactly one callable, and it is CreateAndActivatePlan", async () => {
    const callable = vi.fn().mockResolvedValue({
      data: {
        success: true,
        planId: "plan-new-1",
        status: "active",
        revision: 1,
        supersededPlanId: "plan-active-1",
        wasNoOp: false,
      },
    });
    mockHttpsCallable.mockReturnValue(callable);

    const request = buildCreateNutritionPlanRequest(replaceCommand, "op-replace-1");
    await executeCreateNutritionPlan(createMockFunctions(), request);

    // One transport invocation, one callable resolved.
    expect(mockHttpsCallable).toHaveBeenCalledTimes(1);
    expect(callable).toHaveBeenCalledTimes(1);
    expect(mockHttpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      "healthNutritionCreateAndActivatePlan",
    );
  });

  it("never invokes the CANCEL callable while replacing", async () => {
    const callable = vi.fn().mockResolvedValue({
      data: {
        success: true,
        planId: "plan-new-1",
        status: "active",
        revision: 1,
        supersededPlanId: "plan-active-1",
        wasNoOp: false,
      },
    });
    mockHttpsCallable.mockReturnValue(callable);

    const request = buildCreateNutritionPlanRequest(replaceCommand, "op-replace-2");
    await executeCreateNutritionPlan(createMockFunctions(), request);

    const requestedCallables = mockHttpsCallable.mock.calls.map((call) => call[1]);
    expect(requestedCallables).not.toContain("healthNutritionCancelPlan");
    expect(requestedCallables).not.toContain("healthNutritionUpdateActivePlan");
    expect(requestedCallables).toEqual(["healthNutritionCreateAndActivatePlan"]);
  });

  it("carries the expectation pair in the single request", async () => {
    const callable = vi.fn().mockResolvedValue({
      data: {
        success: true,
        planId: "plan-new-1",
        status: "active",
        revision: 1,
        supersededPlanId: "plan-active-1",
        wasNoOp: false,
      },
    });
    mockHttpsCallable.mockReturnValue(callable);

    const request = buildCreateNutritionPlanRequest(replaceCommand, "op-replace-3");
    await executeCreateNutritionPlan(createMockFunctions(), request);

    const sent = callable.mock.calls[0][0];
    expect(sent.expectedActivePlanId).toBe("plan-active-1");
    expect(sent.expectedActiveRevision).toBe(3);
    expect(sent.operationId).toBe("op-replace-3");
  });

  it("surfaces supersededPlanId as proof the backend superseded the old plan", async () => {
    const callable = vi.fn().mockResolvedValue({
      data: {
        success: true,
        planId: "plan-new-1",
        status: "active",
        revision: 1,
        supersededPlanId: "plan-active-1",
        wasNoOp: false,
      },
    });
    mockHttpsCallable.mockReturnValue(callable);

    const request = buildCreateNutritionPlanRequest(replaceCommand, "op-replace-4");
    const result = await executeCreateNutritionPlan(createMockFunctions(), request);

    expect(result.supersededPlanId).toBe("plan-active-1");
    expect(result.status).toBe("active");
  });

  it("rejects a partial expectation pair before any transport happens", () => {
    expect(() =>
      buildCreateNutritionPlanRequest(
        { ...replaceCommand, expectedActiveRevision: null },
        "op-replace-5",
      ),
    ).toThrow(/must be provided together/i);

    // Nothing reached the transport layer.
    expect(mockHttpsCallable).not.toHaveBeenCalled();
  });
});
