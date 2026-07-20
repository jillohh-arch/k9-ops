import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  useNutritionPlanMutations,
  type PreparedUpdateIntent,
  type PreparedCancelIntent,
} from "../hooks/use-nutrition-plan-mutations";
import type {
  CreateNutritionPlanCommand,
  UpdateNutritionPlanCommand,
  CancelNutritionPlanCommand,
  NutritionMutationError,
} from "../types";

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock the mutation service — NOT Firebase
vi.mock("../data/nutrition-plan-mutation-service", () => ({
  generateNutritionPlanOperationId: vi.fn(() => `op-${Math.random().toString(36).slice(2, 10)}`),
  buildCreateNutritionPlanRequest: vi.fn((command, operationId) => ({
    dogId: command.dogId,
    operationId,
    planData: { food_type: command.planData.foodType, amount_grams_per_day: command.planData.amountGramsPerDay },
  })),
  buildUpdateNutritionPlanRequest: vi.fn((command, operationId) => {
    const changes = command.changes || {};
    const hasChanges =
      changes.specialInstructions !== undefined ||
      changes.professional !== undefined ||
      changes.sourceDocument !== undefined ||
      changes.attachmentRefs !== undefined;

    if (!hasChanges) {
      throw new Error("Update command must include at least one change field");
    }

    return {
      dogId: command.dogId,
      planId: command.planId,
      operationId,
      expectedRevision: command.expectedRevision,
      changes: command.changes,
    };
  }),
  buildCancelNutritionPlanRequest: vi.fn((command, operationId) => {
    const reason = (command.reason || "").trim();
    if (!reason) {
      throw new Error("Cancel reason cannot be empty");
    }

    return {
      dogId: command.dogId,
      planId: command.planId,
      operationId,
      expectedRevision: command.expectedRevision,
      reason,
    };
  }),
  executeCreateNutritionPlan: vi.fn(),
  executeUpdateNutritionPlan: vi.fn(),
  executeCancelNutritionPlan: vi.fn(),
  isNutritionPlanConflictError: vi.fn((e: NutritionMutationError) =>
    e?.domainCode === "nutrition_plan_conflict" || e?.domainCode === "integrity"
  ),
  isPermissionError: vi.fn((e: NutritionMutationError) =>
    e?.domainCode === "permission-denied" || e?.domainCode === "unauthenticated"
  ),
  isValidationError: vi.fn((e: NutritionMutationError) =>
    e?.domainCode === "validation" || e?.domainCode === "invalid_timezone"
  ),
  isTransportError: vi.fn((e: NutritionMutationError) =>
    e?.firebaseCode === "unavailable" || e?.firebaseCode === "deadline-exceeded"
  ),
}));

import {
  generateNutritionPlanOperationId,
  buildCreateNutritionPlanRequest,
  buildUpdateNutritionPlanRequest,
  buildCancelNutritionPlanRequest,
  executeCreateNutritionPlan,
  executeUpdateNutritionPlan,
  executeCancelNutritionPlan,
} from "../data/nutrition-plan-mutation-service";

const mockExecuteCreate = executeCreateNutritionPlan as ReturnType<typeof vi.fn>;
const mockExecuteUpdate = executeUpdateNutritionPlan as ReturnType<typeof vi.fn>;
const mockExecuteCancel = executeCancelNutritionPlan as ReturnType<typeof vi.fn>;
const mockBuildCreate = buildCreateNutritionPlanRequest as ReturnType<typeof vi.fn>;
const mockBuildUpdate = buildUpdateNutritionPlanRequest as ReturnType<typeof vi.fn>;
const mockBuildCancel = buildCancelNutritionPlanRequest as ReturnType<typeof vi.fn>;
const mockGenOpId = generateNutritionPlanOperationId as ReturnType<typeof vi.fn>;

// Mock Firebase functions
const mockFunctions = {} as Parameters<typeof useNutritionPlanMutations>[0]["functions"];

// =============================================================================
// MANUAL MOCK STATE — avoids vitest queue pitfalls
// =============================================================================

/**
 * Simple Promise factory for controlled async mocking.
 * Each call to makeCreatePending() creates a fresh pending promise.
 * The test calls resolve/reject on the current pending promise.
 */
function createPromiseFactory<T>(): {
  current: { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } | null;
  makePending: () => void;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
  reset: () => void;
} {
  let current: { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } | null = null;

  function makePending() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    current = { promise, resolve, reject };
  }

  function resolve(v: T) {
    current?.resolve(v);
  }

  function reject(e: unknown) {
    current?.reject(e);
  }

  function reset() {
    current = null;
  }

  // Start with one pending promise already created
  makePending();

  return { get current() { return current; }, makePending, resolve, reject, reset };
}

const createFactory = createPromiseFactory<unknown>();
const updateFactory = createPromiseFactory<unknown>();
const cancelFactory = createPromiseFactory<unknown>();

// Set up mock implementations — each call returns the current pending promise
mockExecuteCreate.mockImplementation(() => createFactory.current!.promise as Promise<unknown>);
mockExecuteUpdate.mockImplementation(() => updateFactory.current!.promise as Promise<unknown>);
mockExecuteCancel.mockImplementation(() => cancelFactory.current!.promise as Promise<unknown>);

// Reset between tests: create fresh pending promises, clear mock call history
// Does NOT call clearAllMocks — that would erase the mockImplementation set at module level
function resetManualMock() {
  createFactory.reset();
  updateFactory.reset();
  cancelFactory.reset();
  createFactory.makePending();
  updateFactory.makePending();
  cancelFactory.makePending();
  // Clear call history only, NOT implementation
  mockExecuteCreate.mockClear();
  mockExecuteUpdate.mockClear();
  mockExecuteCancel.mockClear();
  mockBuildCreate.mockClear();
  mockGenOpId.mockClear();
}

// Convenience helpers — resolve/reject the current pending promise
function resolveCreate(result: unknown) { createFactory.resolve(result); }
function rejectCreate(err: unknown) { createFactory.reject(err); }
function resolveUpdate(result: unknown) { updateFactory.resolve(result); }
function rejectUpdate(err: unknown) { updateFactory.reject(err); }
function resolveCancel(result: unknown) { cancelFactory.resolve(result); }
function rejectCancel(err: unknown) { cancelFactory.reject(err); }
function newCreatePending() { createFactory.makePending(); }

// =============================================================================
// HELPERS
// =============================================================================

const mockSuccessCreateResult = (overrides = {}) => ({
  success: true as const,
  planId: "plan-new-123",
  status: "active" as const,
  revision: 1,
  supersededPlanId: null,
  wasNoOp: false,
  ...overrides,
});

const mockSuccessUpdateResult = (overrides = {}) => ({
  success: true as const,
  planId: "plan-123",
  status: "active" as const,
  revision: 4,
  wasNoOp: false,
  ...overrides,
});

const mockSuccessCancelResult = (overrides = {}) => ({
  success: true as const,
  planId: "plan-123",
  status: "cancelled" as const,
  revision: 6,
  wasNoOp: false,
  ...overrides,
});

const mockError = (firebaseCode: string, domainCode?: string, retryable = false): NutritionMutationError => ({
  firebaseCode: firebaseCode as NutritionMutationError["firebaseCode"],
  domainCode: domainCode as NutritionMutationError["domainCode"],
  message: `Error: ${firebaseCode}`,
  retryable,
  details: domainCode ? { code: domainCode } : {},
});

// =============================================================================
// TESTS: CREATE
// =============================================================================

describe("CREATE Mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenOpId.mockImplementation(() => `op-${Math.random().toString(36).slice(2, 10)}`);
    resetManualMock();
  });

  const validCreateCommand: CreateNutritionPlanCommand = {
    dogId: "dog-1",
    planData: {
      foodType: "Ração Premium",
      amountGramsPerDay: 500,
      mealsPerDay: 3,
      timezone: "America/Sao_Paulo",
      validFrom: "2026-07-19T10:00:00.000Z",
      mealSchedule: [],
    },
  };

  describe("prepareCreate", () => {
    it("should generate a new operationId", () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });

      expect(mockGenOpId).toHaveBeenCalled();
      expect(result.current.createState).toMatchObject({ status: "ready" });
    });

    it("should set state to 'ready' after prepare", () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      expect(result.current.createState.status).toBe("idle");

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });

      expect(result.current.createState.status).toBe("ready");
    });

    it("should preserve the command in the intent", () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });

      const state = result.current.createState as Extract<typeof result.current.createState, { status: "ready" }>;
      expect(state.intent.command).toBe(validCreateCommand);
      expect(state.intent.command.dogId).toBe("dog-1");
    });

    it("should allow replacing the previous intent with a new operationId", () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      const opId1 = "op-first";
      const opId2 = "op-second";
      mockGenOpId.mockReturnValueOnce(opId1).mockReturnValueOnce(opId2);

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });
      expect(result.current.createState).toMatchObject({ status: "ready", intent: { operationId: opId1 } });

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });
      expect(result.current.createState).toMatchObject({ status: "ready", intent: { operationId: opId2 } });

      // Only 2 operationIds generated (no accidental stacking)
      expect(mockGenOpId).toHaveBeenCalledTimes(2);
    });
  });

  describe("executeCreate", () => {
    it("should use exactly the prepared request with the correct operationId", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      const opId = "op-execute-test";
      mockGenOpId.mockReturnValue(opId);

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });

      newCreatePending();
      await act(async () => {
        resolveCreate(mockSuccessCreateResult());
        await result.current.executeCreate();
      });

      expect(mockBuildCreate).toHaveBeenCalledWith(validCreateCommand, opId);
      expect(mockExecuteCreate).toHaveBeenCalledWith(mockFunctions, expect.objectContaining({ operationId: opId }));
    });

    it("should transition to 'success' on success", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });

      newCreatePending();
      await act(async () => {
        resolveCreate(mockSuccessCreateResult());
        await result.current.executeCreate();
      });

      expect(result.current.createState.status).toBe("success");
    });

    it("should expose the result with all fields including wasNoOp true", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });

      newCreatePending();
      await act(async () => {
        resolveCreate(mockSuccessCreateResult({ planId: "existing-plan", wasNoOp: true, supersededPlanId: "old-plan" }));
        await result.current.executeCreate();
      });

      expect(result.current.createState).toMatchObject({
        status: "success",
        result: {
          success: true,
          planId: "existing-plan",
          wasNoOp: true,
          supersededPlanId: "old-plan",
        },
      });
    });

    it("should transition to 'error' with normalized error on failure", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });

      const err = mockError("invalid-argument", "validation", false);

      newCreatePending();
      await act(async () => {
        rejectCreate(err);
        try {
          await result.current.executeCreate();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.createState.status).toBe("error");
      const state = result.current.createState as Extract<typeof result.current.createState, { status: "error" }>;
      expect(state.error).toMatchObject({ firebaseCode: "invalid-argument", domainCode: "validation", retryable: false });
    });

    it("should preserve normalized error fields (firebaseCode, domainCode, message, retryable, details)", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });

      const err: NutritionMutationError = {
        firebaseCode: "failed-precondition",
        domainCode: "nutrition_plan_conflict",
        message: "Expected revision mismatch",
        retryable: false,
        details: { currentRevision: 5, expectedRevision: 4 },
      };

      newCreatePending();
      await act(async () => {
        rejectCreate(err);
        try {
          await result.current.executeCreate();
        } catch {
          // Expected
        }
      });

      const state = result.current.createState as Extract<typeof result.current.createState, { status: "error" }>;
      expect(state.error).toEqual(err);
      expect((state.error as NutritionMutationError).details).toEqual({ currentRevision: 5, expectedRevision: 4 });
    });

    it("should throw NutritionMutationError on failure (re-throw)", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });

      const err = mockError("unavailable", undefined, true);

      newCreatePending();
      let thrown: unknown;
      await act(async () => {
        rejectCreate(err);
        try {
          await result.current.executeCreate();
        } catch (e) {
          thrown = e;
        }
      });

      expect(thrown).toMatchObject({ firebaseCode: "unavailable", retryable: true });
    });

    it("should throw LocalMutationError if executeCreate called without prepared intent", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      let thrown: unknown;
      await act(async () => {
        try {
          await result.current.executeCreate();
        } catch (e) {
          thrown = e;
        }
      });

      expect(thrown).toMatchObject({
        kind: "local",
        code: "no-prepared-intent",
      });
    });

    it("should throw LocalMutationError if executeCreate called while already executing", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });

      // Start first execution — never resolve (simulates hanging call)
      await act(async () => {
        void result.current.executeCreate();
      });

      // Try second execution while first is still "executing"
      let thrown: unknown;
      await act(async () => {
        try {
          await result.current.executeCreate(); // Should throw "already-executing"
        } catch (e) {
          thrown = e;
        }
      });

      expect(thrown).toMatchObject({
        kind: "local",
        code: "already-executing",
      });
    });
  });

  describe("retryCreate", () => {
    it("should use exactly the same operationId and request as the original intent after error", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      const opId = "op-retry-stable";
      mockGenOpId.mockReturnValue(opId);

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });

      // First execution fails
      mockExecuteCreate.mockRejectedValueOnce(mockError("unavailable", undefined, true));

      let thrown: unknown;
      await act(async () => {
        try {
          await result.current.executeCreate();
        } catch (e) {
          thrown = e;
        }
      });

      expect(thrown).toMatchObject({ firebaseCode: "unavailable", retryable: true });
      expect(result.current.createState.status).toBe("error");

      // Retry succeeds — same operationId (mock handles resolution)
      mockExecuteCreate.mockResolvedValueOnce(mockSuccessCreateResult());

      await act(async () => {
        await result.current.retryCreate();
      });

      expect(mockExecuteCreate).toHaveBeenCalledWith(mockFunctions, expect.objectContaining({ operationId: opId }));
      expect(result.current.createState.status).toBe("success");
    });

    it("should re-execute after transport error using same operationId", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      const opId = "op-retry-transport";
      mockGenOpId.mockReturnValue(opId);

      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });

      // First execution fails
      mockExecuteCreate.mockRejectedValueOnce(mockError("unavailable", undefined, true));

      let thrown: unknown;
      await act(async () => {
        try {
          await result.current.executeCreate();
        } catch (e) {
          thrown = e;
        }
      });

      expect(thrown).toMatchObject({ firebaseCode: "unavailable", retryable: true });
      expect(result.current.createState.status).toBe("error");

      // Retry succeeds — same operationId
      mockExecuteCreate.mockResolvedValueOnce(mockSuccessCreateResult());

      await act(async () => {
        await result.current.retryCreate();
      });

      expect(mockExecuteCreate).toHaveBeenCalledWith(mockFunctions, expect.objectContaining({ operationId: opId }));
      expect(result.current.createState.status).toBe("success");
    });

    it("should throw LocalMutationError if retryCreate called without prepared intent", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      let thrown: unknown;
      await act(async () => {
        try {
          await result.current.retryCreate();
        } catch (e) {
          thrown = e;
        }
      });

      expect(thrown).toMatchObject({ kind: "local", code: "no-prepared-intent" });
    });
  });

  describe("double submit protection", () => {
    it("should not create a second intent when executeCreate is called while a previous intent is in 'ready' state (intentional: prepare replaces, not stacks)", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      const opId1 = "op-first";
      const opId2 = "op-second";
      mockGenOpId.mockReturnValueOnce(opId1).mockReturnValueOnce(opId2);

      // First prepare
      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });
      expect(result.current.createState).toMatchObject({ status: "ready", intent: { operationId: opId1 } });

      // Second prepare (should replace, not stack)
      act(() => {
        result.current.prepareCreate(validCreateCommand);
      });
      expect(result.current.createState).toMatchObject({ status: "ready", intent: { operationId: opId2 } });

      // Only 2 operationIds generated (no accidental stacking)
      expect(mockGenOpId).toHaveBeenCalledTimes(2);
    });
  });
});

// =============================================================================
// TESTS: UPDATE
// =============================================================================

describe("UPDATE Mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenOpId.mockImplementation(() => `op-${Math.random().toString(36).slice(2, 10)}`);
    resetManualMock();
  });

  const validUpdateCommand: UpdateNutritionPlanCommand = {
    dogId: "dog-1",
    planId: "plan-123",
    expectedRevision: 3,
    changes: { specialInstructions: "Updated instructions" },
  };

  describe("prepareUpdate", () => {
    it("should generate a new operationId and set state to 'ready'", () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      expect(result.current.updateState.status).toBe("idle");

      act(() => {
        result.current.prepareUpdate(validUpdateCommand);
      });

      expect(result.current.updateState.status).toBe("ready");
      expect(mockGenOpId).toHaveBeenCalled();
    });

    it("should preserve expectedRevision in the intent", () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareUpdate(validUpdateCommand);
      });

      const state = result.current.updateState as Extract<typeof result.current.updateState, { status: "ready" }>;
      expect(state.intent.command.expectedRevision).toBe(3);
    });

    it("should throw synchronously on invalid command (empty changes) and not leave state stuck in 'preparing' or corrupt previous valid intent", () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      // 1. Prepare valid intent first
      act(() => {
        result.current.prepareUpdate(validUpdateCommand);
      });
      expect(result.current.updateState.status).toBe("ready");
      const initialIntent = (result.current.updateState as { intent: PreparedUpdateIntent }).intent;

      // 2. Attempt invalid prepare (empty changes)
      const invalidCmd: UpdateNutritionPlanCommand = {
        dogId: "dog-1",
        planId: "plan-123",
        expectedRevision: 3,
        changes: {},
      };

      expect(() => {
        result.current.prepareUpdate(invalidCmd);
      }).toThrow("Update command must include at least one change field");

      // 3. Verify state is not stuck in preparing and previous valid intent is preserved
      expect(result.current.updateState.status).toBe("ready");
      expect((result.current.updateState as { intent: PreparedUpdateIntent }).intent).toBe(initialIntent);
    });
  });

  describe("executeUpdate", () => {
    it("should use exactly the prepared request with correct operationId and expectedRevision", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      const opId = "op-update-123";
      mockGenOpId.mockReturnValue(opId);

      act(() => {
        result.current.prepareUpdate(validUpdateCommand);
      });

      await act(async () => {
        resolveUpdate(mockSuccessUpdateResult({ revision: 4 }));
        await result.current.executeUpdate();
      });

      expect(mockBuildUpdate).toHaveBeenCalledWith(validUpdateCommand, opId);
      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        mockFunctions,
        expect.objectContaining({ operationId: opId, expectedRevision: 3 })
      );
    });

    it("should expose nutrition_plan_conflict error integrally", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareUpdate(validUpdateCommand);
      });

      const err: NutritionMutationError = {
        firebaseCode: "failed-precondition",
        domainCode: "nutrition_plan_conflict",
        message: "Revision mismatch",
        retryable: false,
        details: { currentRevision: 5, expectedRevision: 3 },
      };

      await act(async () => {
        rejectUpdate(err);
        try {
          await result.current.executeUpdate();
        } catch {
          // Expected
        }
      });

      const state = result.current.updateState as Extract<typeof result.current.updateState, { status: "error" }>;
      expect(state.error).toMatchObject({ domainCode: "nutrition_plan_conflict", firebaseCode: "failed-precondition" });
      expect(result.current.error.isConflict(state.error)).toBe(true);
    });

    it("should NOT update revision alone — hook does not decide to refresh", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      const opId = "op-update-no-refresh";
      mockGenOpId.mockReturnValue(opId);

      act(() => {
        result.current.prepareUpdate(validUpdateCommand);
      });

      // Conflict error
      await act(async () => {
        rejectUpdate(mockError("failed-precondition", "nutrition_plan_conflict", false));
        try {
          await result.current.executeUpdate();
        } catch {
          // Expected
        }
      });

      expect(result.current.updateState.status).toBe("error");

      // Prepare a NEW intent with a new expectedRevision (caller provides this)
      const newCommand = { ...validUpdateCommand, expectedRevision: 5 };
      act(() => {
        result.current.prepareUpdate(newCommand);
      });

      // The new intent has the new revision and a new operationId
      const state = result.current.updateState as Extract<typeof result.current.updateState, { status: "ready" }>;
      expect(state.intent.command.expectedRevision).toBe(5);
    });

    it("should transition to 'success' with result on success", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareUpdate(validUpdateCommand);
      });

      await act(async () => {
        resolveUpdate(mockSuccessUpdateResult({ revision: 4, wasNoOp: true }));
        await result.current.executeUpdate();
      });

      expect(result.current.updateState).toMatchObject({
        status: "success",
        result: { success: true, revision: 4, wasNoOp: true },
      });
    });
  });

  describe("retryUpdate", () => {
    it("should use exactly the same operationId and request after error", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      const opId = "op-update-retry-stable";
      mockGenOpId.mockReturnValue(opId);

      act(() => {
        result.current.prepareUpdate(validUpdateCommand);
      });

      // First execution fails
      mockExecuteUpdate.mockRejectedValueOnce(mockError("unavailable", undefined, true));

      let thrown: unknown;
      await act(async () => {
        try {
          await result.current.executeUpdate();
        } catch (e) {
          thrown = e;
        }
      });

      expect(thrown).toMatchObject({ firebaseCode: "unavailable", retryable: true });
      expect(result.current.updateState.status).toBe("error");

      // Retry succeeds — same operationId
      mockExecuteUpdate.mockResolvedValueOnce(mockSuccessUpdateResult());

      await act(async () => {
        await result.current.retryUpdate();
      });

      expect(mockExecuteUpdate).toHaveBeenCalledWith(mockFunctions, expect.objectContaining({ operationId: opId }));
      expect(result.current.updateState.status).toBe("success");
    });
  });

  describe("resetUpdate", () => {
    it("should reset state to idle and clear the intent", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareUpdate(validUpdateCommand);
      });

      expect(result.current.updateState.status).toBe("ready");

      act(() => {
        result.current.resetUpdate();
      });

      expect(result.current.updateState.status).toBe("idle");
    });
  });
});

// =============================================================================
// TESTS: CANCEL
// =============================================================================

describe("CANCEL Mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenOpId.mockImplementation(() => `op-${Math.random().toString(36).slice(2, 10)}`);
    resetManualMock();
  });

  const validCancelCommand: CancelNutritionPlanCommand = {
    dogId: "dog-1",
    planId: "plan-123",
    expectedRevision: 5,
    reason: "Cão faleceu",
  };

  describe("prepareCancel", () => {
    it("should generate a new operationId and set state to 'ready'", () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      expect(result.current.cancelState.status).toBe("idle");

      act(() => {
        result.current.prepareCancel(validCancelCommand);
      });

      expect(result.current.cancelState.status).toBe("ready");
      expect(mockGenOpId).toHaveBeenCalled();
    });

    it("should preserve reason and expectedRevision in the intent", () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareCancel(validCancelCommand);
      });

      const state = result.current.cancelState as Extract<typeof result.current.cancelState, { status: "ready" }>;
      expect(state.intent.command.reason).toBe("Cão faleceu");
      expect(state.intent.command.expectedRevision).toBe(5);
    });

    it("should throw synchronously on invalid command (empty reason) and not leave state stuck in 'preparing' or corrupt previous valid intent", () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      // 1. Prepare valid intent first
      act(() => {
        result.current.prepareCancel(validCancelCommand);
      });
      expect(result.current.cancelState.status).toBe("ready");
      const initialIntent = (result.current.cancelState as { intent: PreparedCancelIntent }).intent;

      // 2. Attempt invalid prepare (empty reason)
      const invalidCmd: CancelNutritionPlanCommand = {
        dogId: "dog-1",
        planId: "plan-123",
        expectedRevision: 5,
        reason: "   ",
      };

      expect(() => {
        result.current.prepareCancel(invalidCmd);
      }).toThrow("Cancel reason cannot be empty");

      // 3. Verify state is not stuck in preparing and previous valid intent is preserved
      expect(result.current.cancelState.status).toBe("ready");
      expect((result.current.cancelState as { intent: PreparedCancelIntent }).intent).toBe(initialIntent);
    });
  });

  describe("executeCancel", () => {
    it("should use exactly the prepared request with correct operationId, reason, and expectedRevision", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      const opId = "op-cancel-123";
      mockGenOpId.mockReturnValue(opId);

      act(() => {
        result.current.prepareCancel(validCancelCommand);
      });

      await act(async () => {
        resolveCancel(mockSuccessCancelResult());
        await result.current.executeCancel();
      });

      expect(mockBuildCancel).toHaveBeenCalledWith(validCancelCommand, opId);
      expect(mockExecuteCancel).toHaveBeenCalledWith(
        mockFunctions,
        expect.objectContaining({ operationId: opId, reason: "Cão faleceu", expectedRevision: 5 })
      );
    });

    it("should handle replay result with wasNoOp true", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareCancel(validCancelCommand);
      });

      await act(async () => {
        resolveCancel(mockSuccessCancelResult({ wasNoOp: true }));
        await result.current.executeCancel();
      });

      expect(result.current.cancelState).toMatchObject({
        status: "success",
        result: { wasNoOp: true },
      });
    });

    it("should expose permission error integrally", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareCancel(validCancelCommand);
      });

      const err: NutritionMutationError = {
        firebaseCode: "permission-denied",
        domainCode: "permission-denied",
        message: "Not allowed",
        retryable: false,
      };

      await act(async () => {
        rejectCancel(err);
        try {
          await result.current.executeCancel();
        } catch {
          // Expected
        }
      });

      const state = result.current.cancelState as Extract<typeof result.current.cancelState, { status: "error" }>;
      expect(state.error).toMatchObject({ domainCode: "permission-denied" });
      expect(result.current.error.isPermission(state.error)).toBe(true);
    });
  });

  describe("retryCancel", () => {
    it("should use exactly the same operationId and request after error", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      const opId = "op-cancel-retry-stable";
      mockGenOpId.mockReturnValue(opId);

      act(() => {
        result.current.prepareCancel(validCancelCommand);
      });

      // First execution fails
      mockExecuteCancel.mockRejectedValueOnce(mockError("unavailable", undefined, true));

      let thrown: unknown;
      await act(async () => {
        try {
          await result.current.executeCancel();
        } catch (e) {
          thrown = e;
        }
      });

      expect(thrown).toMatchObject({ firebaseCode: "unavailable", retryable: true });
      expect(result.current.cancelState.status).toBe("error");

      // Retry succeeds — same operationId
      mockExecuteCancel.mockResolvedValueOnce(mockSuccessCancelResult());

      await act(async () => {
        await result.current.retryCancel();
      });

      expect(mockExecuteCancel).toHaveBeenCalledWith(mockFunctions, expect.objectContaining({ operationId: opId }));
      expect(result.current.cancelState.status).toBe("success");
    });
  });

  describe("resetCancel", () => {
    it("should reset state to idle", async () => {
      const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

      act(() => {
        result.current.prepareCancel(validCancelCommand);
      });

      expect(result.current.cancelState.status).toBe("ready");

      act(() => {
        result.current.resetCancel();
      });

      expect(result.current.cancelState.status).toBe("idle");
    });
  });
});

// =============================================================================
// TESTS: INDEPENDENT STATES
// =============================================================================

describe("Independent Mutation States", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenOpId.mockImplementation(() => `op-${Math.random().toString(36).slice(2, 10)}`);
    resetManualMock();
  });

  it("should not silently overwrite result/error of one mutation when another is reset", async () => {
    const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

    const createCmd: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: { foodType: "R", amountGramsPerDay: 500, mealsPerDay: 3, timezone: "UTC", validFrom: "2026-01-01T00:00:00.000Z", mealSchedule: [] },
    };
    const updateCmd: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 1,
      changes: { specialInstructions: "Test" },
    };

    // Prepare and execute create
    act(() => {
      result.current.prepareCreate(createCmd);
    });
    mockExecuteCreate.mockResolvedValueOnce(mockSuccessCreateResult({ planId: "created-plan" }));
    await act(async () => {
      await result.current.executeCreate();
    });
    expect(result.current.createState.status).toBe("success");

    // Prepare and execute update
    act(() => {
      result.current.prepareUpdate(updateCmd);
    });
    mockExecuteUpdate.mockResolvedValueOnce(mockSuccessUpdateResult());
    await act(async () => {
      await result.current.executeUpdate();
    });
    expect(result.current.updateState.status).toBe("success");

    // Reset create — should NOT affect update
    act(() => {
      result.current.resetCreate();
    });

    expect(result.current.createState.status).toBe("idle");
    expect(result.current.updateState.status).toBe("success");
    const updateState = result.current.updateState as Extract<typeof result.current.updateState, { status: "success" }>;
    expect(updateState.result.planId).toBe("plan-123");
  });
});

// =============================================================================
// TESTS: ERROR HELPERS
// =============================================================================

describe("Error Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("error.isConflict should return true for nutrition_plan_conflict", () => {
    const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

    const conflictErr: NutritionMutationError = {
      firebaseCode: "failed-precondition",
      domainCode: "nutrition_plan_conflict",
      message: "Conflict",
      retryable: false,
    };

    expect(result.current.error.isConflict(conflictErr)).toBe(true);
  });

  it("error.isConflict should return true for integrity", () => {
    const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

    const integrityErr: NutritionMutationError = {
      firebaseCode: "failed-precondition",
      domainCode: "integrity",
      message: "Integrity error",
      retryable: false,
    };

    expect(result.current.error.isConflict(integrityErr)).toBe(true);
  });

  it("error.isTransport should return true for unavailable", () => {
    const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

    const transportErr: NutritionMutationError = {
      firebaseCode: "unavailable",
      domainCode: undefined,
      message: "Unavailable",
      retryable: true,
    };

    expect(result.current.error.isTransport(transportErr)).toBe(true);
  });

  it("error.isLocal should return true for local errors", () => {
    const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

    const localErr = { kind: "local" as const, message: "No intent", code: "no-prepared-intent" as const };

    expect(result.current.error.isLocal(localErr)).toBe(true);
    expect(result.current.error.isLocal(null)).toBe(false);
    expect(result.current.error.isLocal(undefined)).toBe(false);
  });
});

// =============================================================================
// TESTS: RACE SAFETY
// =============================================================================

describe("Race Safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenOpId.mockImplementation(() => `op-${Math.random().toString(36).slice(2, 10)}`);
    resetManualMock();
  });

  it("A: older response should NOT overwrite newer state (intent counter)", async () => {
    const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

    const createCmd: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: { foodType: "R", amountGramsPerDay: 500, mealsPerDay: 3, timezone: "UTC", validFrom: "2026-01-01T00:00:00.000Z", mealSchedule: [] },
    };

    // First intent
    const opId1 = "op-race-1";
    mockGenOpId.mockReturnValueOnce(opId1);
    act(() => {
      result.current.prepareCreate(createCmd);
    });

    // Simulate slow first request — we resolve it AFTER a second intent is prepared
    let resolveFirst: (value: unknown) => void;
    mockExecuteCreate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );

    // Start first execution
    await act(async () => {
      const promise = result.current.executeCreate();
      // Immediately prepare a NEW intent while first is still executing
      const opId2 = "op-race-2";
      mockGenOpId.mockReturnValueOnce(opId2);
      result.current.prepareCreate(createCmd);

      // Resolve the FIRST request (stale)
      resolveFirst!(mockSuccessCreateResult({ planId: "old-plan" }));
      await promise;
    });

    // The state should reflect the NEW intent, not the old resolved response
    expect(result.current.createState.status).toBe("ready");
    const state = result.current.createState as Extract<typeof result.current.createState, { status: "ready" }>;
    expect(state.intent.operationId).toBe("op-race-2");
  });

  it("B: result of earlier intent should not appear after prepare + execute of later intent", async () => {
    const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

    const createCmd: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: { foodType: "R", amountGramsPerDay: 500, mealsPerDay: 3, timezone: "UTC", validFrom: "2026-01-01T00:00:00.000Z", mealSchedule: [] },
    };

    // First intent
    mockGenOpId.mockReturnValueOnce("op-intent-1");
    act(() => {
      result.current.prepareCreate(createCmd);
    });
    mockExecuteCreate.mockResolvedValueOnce(mockSuccessCreateResult({ planId: "plan-from-intent-1" }));
    await act(async () => {
      await result.current.executeCreate();
    });
    expect(result.current.createState.status).toBe("success");
    expect(mockExecuteCreate).toHaveBeenCalledWith(mockFunctions, expect.objectContaining({ operationId: "op-intent-1" }));

    // Second intent replaces the first
    mockGenOpId.mockReturnValueOnce("op-intent-2");
    act(() => {
      result.current.prepareCreate(createCmd);
    });
    mockExecuteCreate.mockResolvedValueOnce(mockSuccessCreateResult({ planId: "plan-from-intent-2" }));
    await act(async () => {
      await result.current.executeCreate();
    });
    expect(result.current.createState.status).toBe("success");

    // State should reflect the second intent's result
    expect(result.current.createState).toMatchObject({
      status: "success",
      result: { planId: "plan-from-intent-2" },
    });
  });

  it("C: component unmounts before promise resolves -> no state update after unmount", async () => {
    let resolveFirst: (value: unknown) => void;
    mockExecuteCreate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );

    const { result, unmount } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

    const createCmd: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: { foodType: "R", amountGramsPerDay: 500, mealsPerDay: 3, timezone: "UTC", validFrom: "2026-01-01T00:00:00.000Z", mealSchedule: [] },
    };

    act(() => {
      result.current.prepareCreate(createCmd);
    });

    let executePromise: Promise<unknown> | undefined;
    act(() => {
      executePromise = result.current.executeCreate();
    });

    expect(result.current.createState.status).toBe("executing");

    // Unmount before promise resolves
    unmount();

    // Now resolve the promise
    await act(async () => {
      resolveFirst!(mockSuccessCreateResult());
      await executePromise?.catch(() => {});
    });
  });
});

// =============================================================================
// TESTS: RESET ALL
// =============================================================================

describe("resetAll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenOpId.mockImplementation(() => `op-${Math.random().toString(36).slice(2, 10)}`);
    resetManualMock();
  });

  it("should reset all three mutation states to idle", async () => {
    const { result } = renderHook(() => useNutritionPlanMutations({ functions: mockFunctions }));

    const createCmd: CreateNutritionPlanCommand = {
      dogId: "dog-1",
      planData: { foodType: "R", amountGramsPerDay: 500, mealsPerDay: 3, timezone: "UTC", validFrom: "2026-01-01T00:00:00.000Z", mealSchedule: [] },
    };
    const updateCmd: UpdateNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 1,
      changes: { specialInstructions: "Test" },
    };
    const cancelCmd: CancelNutritionPlanCommand = {
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 1,
      reason: "Reason",
    };

    act(() => {
      result.current.prepareCreate(createCmd);
      result.current.prepareUpdate(updateCmd);
      result.current.prepareCancel(cancelCmd);
    });

    expect(result.current.createState.status).toBe("ready");
    expect(result.current.updateState.status).toBe("ready");
    expect(result.current.cancelState.status).toBe("ready");

    act(() => {
      result.current.resetAll();
    });

    expect(result.current.createState.status).toBe("idle");
    expect(result.current.updateState.status).toBe("idle");
    expect(result.current.cancelState.status).toBe("idle");
  });
});
