"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Functions } from "firebase/functions";
import {
  buildCreateNutritionPlanRequest,
  buildUpdateNutritionPlanRequest,
  buildCancelNutritionPlanRequest,
  executeCreateNutritionPlan,
  executeUpdateNutritionPlan,
  executeCancelNutritionPlan,
  generateNutritionPlanOperationId,
  isNutritionPlanConflictError,
  isPermissionError,
  isValidationError,
  isTransportError,
} from "../data/nutrition-plan-mutation-service";
import type {
  CreateNutritionPlanCommand,
  UpdateNutritionPlanCommand,
  CancelNutritionPlanCommand,
  CreateNutritionPlanResult,
  UpdateNutritionPlanResult,
  CancelNutritionPlanResult,
  NutritionMutationError,
} from "../types";

// =============================================================================
// INTENT TYPES
// =============================================================================

/**
 * A prepared create intent — the request is frozen, operationId is stable.
 */
export interface PreparedCreateIntent {
  operationId: string;
  command: CreateNutritionPlanCommand;
}

/**
 * A prepared update intent — the request is frozen, operationId is stable.
 */
export interface PreparedUpdateIntent {
  operationId: string;
  command: UpdateNutritionPlanCommand;
}

/**
 * A prepared cancel intent — the request is frozen, operationId is stable.
 */
export interface PreparedCancelIntent {
  operationId: string;
  command: CancelNutritionPlanCommand;
}

// =============================================================================
// MUTATION STATE TYPES
// =============================================================================

/**
 * A local error used when the API contract is violated locally.
 * Distinct from NutritionMutationError (which comes from the backend).
 */
export interface LocalMutationError {
  kind: "local";
  message: string;
  code: "no-prepared-intent" | "already-executing" | "not-idle";
}

function isLocalError(err: LocalMutationError | NutritionMutationError): err is LocalMutationError {
  return "kind" in err && (err as LocalMutationError).kind === "local";
}

export type CreateMutationState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "ready"; intent: PreparedCreateIntent }
  | { status: "executing"; intent: PreparedCreateIntent }
  | { status: "success"; result: CreateNutritionPlanResult; intent: PreparedCreateIntent }
  | { status: "error"; error: NutritionMutationError | LocalMutationError; intent: PreparedCreateIntent };

export type UpdateMutationState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "ready"; intent: PreparedUpdateIntent }
  | { status: "executing"; intent: PreparedUpdateIntent }
  | { status: "success"; result: UpdateNutritionPlanResult; intent: PreparedUpdateIntent }
  | { status: "error"; error: NutritionMutationError | LocalMutationError; intent: PreparedUpdateIntent };

export type CancelMutationState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "ready"; intent: PreparedCancelIntent }
  | { status: "executing"; intent: PreparedCancelIntent }
  | { status: "success"; result: CancelNutritionPlanResult; intent: PreparedCancelIntent }
  | { status: "error"; error: NutritionMutationError | LocalMutationError; intent: PreparedCancelIntent };

// =============================================================================
// MUTATION ERROR FACTORIES
// =============================================================================

function noPreparedIntentError(operation: string): LocalMutationError {
  return { kind: "local", message: `${operation} called without a prepared intent. Call prepare${operation.replace("execute", "Create").replace("retry", "Create")} first.`, code: "no-prepared-intent" };
}

function alreadyExecutingError(operation: string): LocalMutationError {
  return { kind: "local", message: `${operation} called while another mutation is already executing`, code: "already-executing" };
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Options for useNutritionPlanMutations.
 */
export interface UseNutritionPlanMutationsOptions {
  /**
   * Firebase Functions instance.
   * Can be provided directly (e.g., from props) or imported from @/lib/firebase/client.
   */
  functions: Functions;
}

// =============================================================================
// HOOK RETURN TYPE
// =============================================================================

/**
 * Convenience helpers for checking error types.
 * These work with both NutritionMutationError (backend) and LocalMutationError.
 */
export interface NutritionMutationErrorHelpers {
  isConflict: (err: NutritionMutationError | LocalMutationError | null | undefined) => boolean;
  isPermission: (err: NutritionMutationError | LocalMutationError | null | undefined) => boolean;
  isValidation: (err: NutritionMutationError | LocalMutationError | null | undefined) => boolean;
  isTransport: (err: NutritionMutationError | LocalMutationError | null | undefined) => boolean;
  isLocal: (err: NutritionMutationError | LocalMutationError | null | undefined) => boolean;
}

/**
 * Return type of useNutritionPlanMutations.
 * Provides independent mutation capabilities for CREATE, UPDATE, and CANCEL.
 *
 * Design guarantees:
 * - One logical intent → one operationId
 * - Retry uses the SAME request (same operationId)
 * - New intent → new operationId
 * - Concurrent executions of the same mutation type are prevented
 * - Race safety: stale responses are discarded via operationId comparison
 */
export interface UseNutritionPlanMutationsReturn {
  // ─── CREATE ───────────────────────────────────────────────────────────────

  /**
   * Prepares a CREATE intent.
   * Generates a NEW operationId and builds a stable request.
   *
   * Idempotent for the same command: calling again replaces the previous intent.
   * Returns the prepared intent for inspection.
   */
  prepareCreate(command: CreateNutritionPlanCommand): PreparedCreateIntent;

  /**
   * Executes the prepared CREATE intent.
   * Throws LocalMutationError if no intent is prepared or if already executing.
   *
   * After success, the state transitions to 'success' with the result.
   * After failure, the state transitions to 'error' with the normalized error.
   */
  executeCreate(): Promise<CreateNutritionPlanResult>;

  /**
   * Retries the last prepared CREATE intent.
   * Uses the EXACT SAME operationId and request.
   * Throws LocalMutationError if no intent is prepared.
   */
  retryCreate(): Promise<CreateNutritionPlanResult>;

  /** Current state of the CREATE mutation. */
  createState: CreateMutationState;

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  /**
   * Prepares an UPDATE intent.
   * Generates a NEW operationId and builds a stable request.
   */
  prepareUpdate(command: UpdateNutritionPlanCommand): PreparedUpdateIntent;

  /**
   * Executes the prepared UPDATE intent.
   */
  executeUpdate(): Promise<UpdateNutritionPlanResult>;

  /**
   * Retries the last prepared UPDATE intent.
   */
  retryUpdate(): Promise<UpdateNutritionPlanResult>;

  /** Current state of the UPDATE mutation. */
  updateState: UpdateMutationState;

  // ─── CANCEL ───────────────────────────────────────────────────────────────

  /**
   * Prepares a CANCEL intent.
   * Generates a NEW operationId and builds a stable request.
   */
  prepareCancel(command: CancelNutritionPlanCommand): PreparedCancelIntent;

  /**
   * Executes the prepared CANCEL intent.
   */
  executeCancel(): Promise<CancelNutritionPlanResult>;

  /**
   * Retries the last prepared CANCEL intent.
   */
  retryCancel(): Promise<CancelNutritionPlanResult>;

  /** Current state of the CANCEL mutation. */
  cancelState: CancelMutationState;

  // ─── RESET ────────────────────────────────────────────────────────────────

  /**
   * Resets the CREATE mutation state to idle.
   * Clears the prepared intent.
   */
  resetCreate(): void;

  /**
   * Resets the UPDATE mutation state to idle.
   * Clears the prepared intent.
   */
  resetUpdate(): void;

  /**
   * Resets the CANCEL mutation state to idle.
   * Clears the prepared intent.
   */
  resetCancel(): void;

  /**
   * Resets all three mutation states to idle.
   */
  resetAll(): void;

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  /**
   * Convenience helpers for classifying errors.
   */
  error: NutritionMutationErrorHelpers;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * A React hook for executing NutritionPlan mutations with proper operationId lifecycle.
 *
 * Architecture:
 * - One logical intent → one operationId (generated at prepare time)
 * - Retry reuses the SAME operationId and request (no rebuild)
 * - New prepare call replaces the previous intent and generates a new operationId
 * - Concurrent executions of the same mutation type are blocked
 * - Race safety: stale responses are discarded via operationId comparison
 */
export function useNutritionPlanMutations(
  options: UseNutritionPlanMutationsOptions
): UseNutritionPlanMutationsReturn {
  const { functions } = options;

  // ─── CREATE state ───────────────────────────────────────────────────────
  const [createState, setCreateState] = useState<CreateMutationState>({ status: "idle" });

  // ─── UPDATE state ───────────────────────────────────────────────────────
  const [updateState, setUpdateState] = useState<UpdateMutationState>({ status: "idle" });

  // ─── CANCEL state ───────────────────────────────────────────────────────
  const [cancelState, setCancelState] = useState<CancelMutationState>({ status: "idle" });

  // ─── Race safety: refs for current state ────────────────────────────────
  // These refs are always updated synchronously BEFORE setState is called.
  // Async callbacks (Firebase calls) use these refs instead of closure-captured state.
  const createStateRef = useRef<CreateMutationState>({ status: "idle" });
  const updateStateRef = useRef<UpdateMutationState>({ status: "idle" });
  const cancelStateRef = useRef<CancelMutationState>({ status: "idle" });

  // Sync refs with state when state changes inside callback functions (no render-time ref mutation)

  // ─── Race safety: operationId generation counter ────────────────────────
  const createIntentCounter = useRef(0);
  const updateIntentCounter = useRef(0);
  const cancelIntentCounter = useRef(0);

  // ─── Race safety: mounted ref ───────────────────────────────────────────
  // Prevents state updates after unmount.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════════════════════

  const prepareCreate = useCallback(
    (command: CreateNutritionPlanCommand): PreparedCreateIntent => {
      const operationId = generateNutritionPlanOperationId();
      // Validate command synchronously before updating state
      buildCreateNutritionPlanRequest(command, operationId);

      createIntentCounter.current += 1;
      const intent: PreparedCreateIntent = { operationId, command };
      // Update ref FIRST so async callbacks see latest state
      createStateRef.current = { status: "ready", intent };
      setCreateState({ status: "ready", intent });
      return intent;
    },
    []
  );

  const executeCreate = useCallback(
    async (): Promise<CreateNutritionPlanResult> => {
      const currentState = createStateRef.current;

      if (currentState.status === "executing") {
        throw alreadyExecutingError("executeCreate");
      }

      if (currentState.status !== "ready") {
        throw noPreparedIntentError("executeCreate");
      }

      const { intent } = currentState;

      // Transition to executing synchronously (ref first, then state)
      createStateRef.current = { status: "executing", intent };
      setCreateState({ status: "executing", intent });

      const request = buildCreateNutritionPlanRequest(intent.command, intent.operationId);

      try {
        const result = await executeCreateNutritionPlan(functions, request);

        // Race safety: only update if still the same intent
        if (mountedRef.current) {
          const latest = createStateRef.current;
          if (latest.status === "executing" && latest.intent.operationId === intent.operationId) {
            createStateRef.current = { status: "success", result, intent };
            setCreateState({ status: "success", result, intent });
          }
        }

        return result;
      } catch (err) {
        const normalizedError = err as NutritionMutationError;

        // Race safety: only update if still the same intent
        if (mountedRef.current) {
          const latest = createStateRef.current;
          if (latest.status === "executing" && latest.intent.operationId === intent.operationId) {
            createStateRef.current = { status: "error", error: normalizedError, intent };
            setCreateState({ status: "error", error: normalizedError, intent });
          }
        }

        throw normalizedError;
      }
    },
    [functions]
  );

  const retryCreate = useCallback(
    async (): Promise<CreateNutritionPlanResult> => {
      const currentState = createStateRef.current;

      if (currentState.status === "executing") {
        throw alreadyExecutingError("retryCreate");
      }

      if (currentState.status === "idle" || currentState.status === "preparing") {
        throw noPreparedIntentError("retryCreate");
      }

      // Retry from error state: transition to executing, reuse the prepared intent
      const { intent } = currentState;
      createStateRef.current = { status: "executing", intent };
      setCreateState({ status: "executing", intent });

      // Build the same request (do not generate new operationId)
      const request = buildCreateNutritionPlanRequest(intent.command, intent.operationId);

      try {
        const result = await executeCreateNutritionPlan(functions, request);

        // Race safety: only update if still the same intent
        if (mountedRef.current) {
          const latest = createStateRef.current;
          if (latest.status === "executing" && latest.intent.operationId === intent.operationId) {
            createStateRef.current = { status: "success", result, intent };
            setCreateState({ status: "success", result, intent });
          }
        }

        return result;
      } catch (err) {
        const normalizedError = err as NutritionMutationError;

        // Race safety: only update if still the same intent
        if (mountedRef.current) {
          const latest = createStateRef.current;
          if (latest.status === "executing" && latest.intent.operationId === intent.operationId) {
            createStateRef.current = { status: "error", error: normalizedError, intent };
            setCreateState({ status: "error", error: normalizedError, intent });
          }
        }

        throw normalizedError;
      }
    },
    [functions]
  );

  const resetCreate = useCallback((): void => {
    createStateRef.current = { status: "idle" };
    setCreateState({ status: "idle" });
    createIntentCounter.current += 1;
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════════════════════════

  const prepareUpdate = useCallback(
    (command: UpdateNutritionPlanCommand): PreparedUpdateIntent => {
      const operationId = generateNutritionPlanOperationId();
      // Validate command synchronously before updating state
      buildUpdateNutritionPlanRequest(command, operationId);

      updateIntentCounter.current += 1;
      const intent: PreparedUpdateIntent = { operationId, command };
      updateStateRef.current = { status: "ready", intent };
      setUpdateState({ status: "ready", intent });
      return intent;
    },
    []
  );

  const executeUpdate = useCallback(
    async (): Promise<UpdateNutritionPlanResult> => {
      const currentState = updateStateRef.current;

      if (currentState.status === "executing") {
        throw alreadyExecutingError("executeUpdate");
      }

      if (currentState.status !== "ready") {
        throw noPreparedIntentError("executeUpdate");
      }

      const { intent } = currentState;

      updateStateRef.current = { status: "executing", intent };
      setUpdateState({ status: "executing", intent });

      const request = buildUpdateNutritionPlanRequest(intent.command, intent.operationId);

      try {
        const result = await executeUpdateNutritionPlan(functions, request);

        if (mountedRef.current) {
          const latest = updateStateRef.current;
          if (latest.status === "executing" && latest.intent.operationId === intent.operationId) {
            updateStateRef.current = { status: "success", result, intent };
            setUpdateState({ status: "success", result, intent });
          }
        }

        return result;
      } catch (err) {
        const normalizedError = err as NutritionMutationError;

        if (mountedRef.current) {
          const latest = updateStateRef.current;
          if (latest.status === "executing" && latest.intent.operationId === intent.operationId) {
            updateStateRef.current = { status: "error", error: normalizedError, intent };
            setUpdateState({ status: "error", error: normalizedError, intent });
          }
        }

        throw normalizedError;
      }
    },
    [functions]
  );

  const retryUpdate = useCallback(
    async (): Promise<UpdateNutritionPlanResult> => {
      const currentState = updateStateRef.current;

      if (currentState.status === "executing") {
        throw alreadyExecutingError("retryUpdate");
      }

      if (currentState.status === "idle" || currentState.status === "preparing") {
        throw noPreparedIntentError("retryUpdate");
      }

      // Retry from error state: transition to executing, reuse the prepared intent
      const { intent } = currentState;
      updateStateRef.current = { status: "executing", intent };
      setUpdateState({ status: "executing", intent });

      const request = buildUpdateNutritionPlanRequest(intent.command, intent.operationId);

      try {
        const result = await executeUpdateNutritionPlan(functions, request);

        if (mountedRef.current) {
          const latest = updateStateRef.current;
          if (latest.status === "executing" && latest.intent.operationId === intent.operationId) {
            updateStateRef.current = { status: "success", result, intent };
            setUpdateState({ status: "success", result, intent });
          }
        }

        return result;
      } catch (err) {
        const normalizedError = err as NutritionMutationError;

        if (mountedRef.current) {
          const latest = updateStateRef.current;
          if (latest.status === "executing" && latest.intent.operationId === intent.operationId) {
            updateStateRef.current = { status: "error", error: normalizedError, intent };
            setUpdateState({ status: "error", error: normalizedError, intent });
          }
        }

        throw normalizedError;
      }
    },
    [functions]
  );

  const resetUpdate = useCallback((): void => {
    updateStateRef.current = { status: "idle" };
    setUpdateState({ status: "idle" });
    updateIntentCounter.current += 1;
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // CANCEL
  // ═══════════════════════════════════════════════════════════════════════════

  const prepareCancel = useCallback(
    (command: CancelNutritionPlanCommand): PreparedCancelIntent => {
      const operationId = generateNutritionPlanOperationId();
      // Validate command synchronously before updating state
      buildCancelNutritionPlanRequest(command, operationId);

      cancelIntentCounter.current += 1;
      const intent: PreparedCancelIntent = { operationId, command };
      cancelStateRef.current = { status: "ready", intent };
      setCancelState({ status: "ready", intent });
      return intent;
    },
    []
  );

  const executeCancel = useCallback(
    async (): Promise<CancelNutritionPlanResult> => {
      const currentState = cancelStateRef.current;

      if (currentState.status === "executing") {
        throw alreadyExecutingError("executeCancel");
      }

      if (currentState.status !== "ready") {
        throw noPreparedIntentError("executeCancel");
      }

      const { intent } = currentState;

      cancelStateRef.current = { status: "executing", intent };
      setCancelState({ status: "executing", intent });

      const request = buildCancelNutritionPlanRequest(intent.command, intent.operationId);

      try {
        const result = await executeCancelNutritionPlan(functions, request);

        if (mountedRef.current) {
          const latest = cancelStateRef.current;
          if (latest.status === "executing" && latest.intent.operationId === intent.operationId) {
            cancelStateRef.current = { status: "success", result, intent };
            setCancelState({ status: "success", result, intent });
          }
        }

        return result;
      } catch (err) {
        const normalizedError = err as NutritionMutationError;

        if (mountedRef.current) {
          const latest = cancelStateRef.current;
          if (latest.status === "executing" && latest.intent.operationId === intent.operationId) {
            cancelStateRef.current = { status: "error", error: normalizedError, intent };
            setCancelState({ status: "error", error: normalizedError, intent });
          }
        }

        throw normalizedError;
      }
    },
    [functions]
  );

  const retryCancel = useCallback(
    async (): Promise<CancelNutritionPlanResult> => {
      const currentState = cancelStateRef.current;

      if (currentState.status === "executing") {
        throw alreadyExecutingError("retryCancel");
      }

      if (currentState.status === "idle" || currentState.status === "preparing") {
        throw noPreparedIntentError("retryCancel");
      }

      // Retry from error state: transition to executing, reuse the prepared intent
      const { intent } = currentState;
      cancelStateRef.current = { status: "executing", intent };
      setCancelState({ status: "executing", intent });

      const request = buildCancelNutritionPlanRequest(intent.command, intent.operationId);

      try {
        const result = await executeCancelNutritionPlan(functions, request);

        if (mountedRef.current) {
          const latest = cancelStateRef.current;
          if (latest.status === "executing" && latest.intent.operationId === intent.operationId) {
            cancelStateRef.current = { status: "success", result, intent };
            setCancelState({ status: "success", result, intent });
          }
        }

        return result;
      } catch (err) {
        const normalizedError = err as NutritionMutationError;

        if (mountedRef.current) {
          const latest = cancelStateRef.current;
          if (latest.status === "executing" && latest.intent.operationId === intent.operationId) {
            cancelStateRef.current = { status: "error", error: normalizedError, intent };
            setCancelState({ status: "error", error: normalizedError, intent });
          }
        }

        throw normalizedError;
      }
    },
    [functions]
  );

  const resetCancel = useCallback((): void => {
    cancelStateRef.current = { status: "idle" };
    setCancelState({ status: "idle" });
    cancelIntentCounter.current += 1;
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET ALL
  // ═══════════════════════════════════════════════════════════════════════════

  const resetAll = useCallback((): void => {
    resetCreate();
    resetUpdate();
    resetCancel();
  }, [resetCreate, resetUpdate, resetCancel]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const errorHelpers: NutritionMutationErrorHelpers = {
    isConflict: (err) =>
      err != null && !isLocalError(err as NutritionMutationError) && isNutritionPlanConflictError(err as NutritionMutationError),

    isPermission: (err) =>
      err != null && !isLocalError(err as NutritionMutationError) && isPermissionError(err as NutritionMutationError),

    isValidation: (err) =>
      err != null && !isLocalError(err as NutritionMutationError) && isValidationError(err as NutritionMutationError),

    isTransport: (err) =>
      err != null && !isLocalError(err as NutritionMutationError) && isTransportError(err as NutritionMutationError),

    isLocal: (err) => err != null && isLocalError(err as LocalMutationError),
  };

  return {
    // CREATE
    prepareCreate,
    executeCreate,
    retryCreate,
    createState,
    // UPDATE
    prepareUpdate,
    executeUpdate,
    retryUpdate,
    updateState,
    // CANCEL
    prepareCancel,
    executeCancel,
    retryCancel,
    cancelState,
    // RESET
    resetCreate,
    resetUpdate,
    resetCancel,
    resetAll,
    // HELPERS
    error: errorHelpers,
  };
}
