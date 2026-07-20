import { httpsCallable, type Functions } from "firebase/functions";
import {
  // Command types
  CreateNutritionPlanCommand,
  UpdateNutritionPlanCommand,
  CancelNutritionPlanCommand,
  // Wire request types
  CreateNutritionPlanWireRequest,
  UpdateNutritionPlanWireRequest,
  CancelNutritionPlanWireRequest,
  // Result types
  CreateNutritionPlanResult,
  UpdateNutritionPlanResult,
  CancelNutritionPlanResult,
  // Helper types
  NutritionMutationError,
  WireMealScheduleSlot,
  WireSupplementRegimen,
} from "../types";
import {
  normalizeNutritionMutationError,
  isNutritionPlanConflictError,
  isPermissionError,
  isValidationError,
  isTransportError,
} from "../errors/nutrition-mutation-errors";

// Re-export error helpers for convenience
export {
  normalizeNutritionMutationError,
  isNutritionPlanConflictError,
  isPermissionError,
  isValidationError,
  isTransportError,
} from "../errors/nutrition-mutation-errors";

// Callable function names (canonical backend)
const CALLABLE_CREATE = "healthNutritionCreateAndActivatePlan";
const CALLABLE_UPDATE = "healthNutritionUpdateActivePlan";
const CALLABLE_CANCEL = "healthNutritionCancelPlan";

// =============================================================================
// OPERATION ID GENERATION
// =============================================================================

/**
 * Generates a browser-safe operation ID using Web Crypto API.
 *
 * Architecture guarantee:
 * - One logical intent → one operationId
 * - Retry of the same intent → same operationId
 * - New intent → new operationId
 *
 * Uses globalThis.crypto.randomUUID() which is available in all modern browsers.
 */
export function generateNutritionPlanOperationId(): string {
  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { crypto?: unknown }).crypto === "object" &&
    typeof (globalThis as { crypto?: { randomUUID?: unknown } }).crypto?.randomUUID === "function"
  ) {
    return (globalThis as { crypto: { randomUUID: () => string } }).crypto.randomUUID();
  }

  // Fallback for environments without Web Crypto (should not happen in modern browsers)
  // Uses a deterministic pattern to ensure uniqueness per call
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}-${random2}-xxxxxxxx`.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

// =============================================================================
// REQUEST BUILDERS
// =============================================================================

/**
 * Maps a MealScheduleSlot (camelCase) to WireMealScheduleSlot (snake_case).
 */
function mapMealScheduleSlot(slot: { id: string; period: string; scheduledTime: string; targetGrams: number }): WireMealScheduleSlot {
  return {
    id: slot.id,
    period: slot.period,
    scheduled_time: slot.scheduledTime,
    target_grams: slot.targetGrams,
  };
}

/**
 * Maps a supplement regimen to wire format.
 */
function mapSupplement(supp: {
  id: string;
  name: string;
  dose: string;
  unit: string;
  frequency: string;
  instructions?: string;
  validFrom?: Date;
  validUntil?: Date;
}): WireSupplementRegimen {
  const result: WireSupplementRegimen = {
    id: supp.id,
    name: supp.name,
    dose: supp.dose,
    unit: supp.unit,
    frequency: supp.frequency,
  };

  if (supp.instructions !== undefined) {
    result.instructions = supp.instructions;
  }
  if (supp.validFrom !== undefined) {
    result.valid_from = supp.validFrom.toISOString();
  }
  if (supp.validUntil !== undefined) {
    result.valid_until = supp.validUntil.toISOString();
  }

  return result;
}

/**
 * Builds a callable request for creating a NutritionPlan.
 *
 * The operationId must be generated ONCE per logical intent and passed here.
 * Retry calls must use the EXACT SAME operationId.
 */
export function buildCreateNutritionPlanRequest(
  command: CreateNutritionPlanCommand,
  operationId: string
): CreateNutritionPlanWireRequest {
  const { planData } = command;

  return {
    dogId: command.dogId,
    operationId,
    planData: {
      food_type: planData.foodType,
      amount_grams_per_day: planData.amountGramsPerDay,
      meals_per_day: planData.mealsPerDay,
      timezone: planData.timezone,
      valid_from: planData.validFrom,
      valid_until: planData.validUntil ?? null,
      meal_schedule: planData.mealSchedule.map(mapMealScheduleSlot),
      supplements: planData.supplements?.map(mapSupplement),
      hydration_ml: planData.hydrationMl ?? null,
      special_instructions: planData.specialInstructions ?? null,
      professional: planData.professional ?? null,
      source_document: planData.sourceDocument ?? null,
      attachment_refs: planData.attachmentRefs ?? null,
    },
  };
}

/**
 * Builds a callable request for updating a NutritionPlan.
 *
 * Only includes fields that are explicitly provided in changes.
 * Absent field → preserve (not sent)
 * null explicit → clear
 * value → replace
 *
 * Validates that changes is not empty before building.
 */
export function buildUpdateNutritionPlanRequest(
  command: UpdateNutritionPlanCommand,
  operationId: string
): UpdateNutritionPlanWireRequest {
  const { changes } = command;

  // Validate that we have something to update
  const hasChanges =
    changes.specialInstructions !== undefined ||
    changes.professional !== undefined ||
    changes.sourceDocument !== undefined ||
    changes.attachmentRefs !== undefined;

  if (!hasChanges) {
    throw new Error("Update command must include at least one change field");
  }

  const wireChanges: UpdateNutritionPlanWireRequest["changes"] = {};

  if (changes.specialInstructions !== undefined) {
    wireChanges.special_instructions = changes.specialInstructions;
  }

  if (changes.professional !== undefined) {
    wireChanges.professional = changes.professional;
  }

  if (changes.sourceDocument !== undefined) {
    wireChanges.source_document = changes.sourceDocument;
  }

  if (changes.attachmentRefs !== undefined) {
    wireChanges.attachment_refs = changes.attachmentRefs;
  }

  return {
    dogId: command.dogId,
    planId: command.planId,
    operationId,
    expectedRevision: command.expectedRevision,
    changes: wireChanges,
  };
}

/**
 * Builds a callable request for cancelling a NutritionPlan.
 *
 * Validates that reason is not empty (after trimming).
 */
export function buildCancelNutritionPlanRequest(
  command: CancelNutritionPlanCommand,
  operationId: string
): CancelNutritionPlanWireRequest {
  const reason = command.reason.trim();

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
}

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Type guard for callable response success.
 */
function isSuccessResponse<T extends { success?: unknown }>(response: T): response is T & { success: true } {
  return response.success === true;
}

/**
 * Executes the healthNutritionCreateAndActivatePlan callable.
 *
 * @param functions - Firebase Functions instance (from src/lib/firebase/client)
 * @param request - Pre-built wire request with stable operationId
 * @returns Normalized result or throws NutritionMutationError
 */
export async function executeCreateNutritionPlan(
  functions: Functions,
  request: CreateNutritionPlanWireRequest
): Promise<CreateNutritionPlanResult> {
  try {
    const callable = httpsCallable<CreateNutritionPlanWireRequest, {
      success: boolean;
      planId?: string;
      status?: string;
      revision?: number;
      supersededPlanId?: string | null;
      wasNoOp?: boolean;
      [key: string]: unknown;
    }>(functions, CALLABLE_CREATE);

    const response = await callable(request);

    if (!isSuccessResponse(response.data)) {
      throw normalizeNutritionMutationError(
        new Error("Backend returned unsuccessful response"),
        "Falha ao criar plano nutricional"
      );
    }

    return {
      success: true,
      planId: response.data.planId ?? "",
      status: (response.data.status as CreateNutritionPlanResult["status"]) ?? "active",
      revision: response.data.revision ?? 1,
      supersededPlanId: response.data.supersededPlanId ?? null,
      wasNoOp: response.data.wasNoOp ?? false,
    };
  } catch (error) {
    throw normalizeNutritionMutationError(error, "Erro ao criar plano nutricional");
  }
}

/**
 * Executes the healthNutritionUpdateActivePlan callable.
 *
 * @param functions - Firebase Functions instance (from src/lib/firebase/client)
 * @param request - Pre-built wire request with stable operationId
 * @returns Normalized result or throws NutritionMutationError
 */
export async function executeUpdateNutritionPlan(
  functions: Functions,
  request: UpdateNutritionPlanWireRequest
): Promise<UpdateNutritionPlanResult> {
  try {
    const callable = httpsCallable<UpdateNutritionPlanWireRequest, {
      success: boolean;
      planId?: string;
      status?: string;
      revision?: number;
      wasNoOp?: boolean;
      [key: string]: unknown;
    }>(functions, CALLABLE_UPDATE);

    const response = await callable(request);

    if (!isSuccessResponse(response.data)) {
      throw normalizeNutritionMutationError(
        new Error("Backend returned unsuccessful response"),
        "Falha ao atualizar plano nutricional"
      );
    }

    return {
      success: true,
      planId: response.data.planId ?? "",
      status: (response.data.status as UpdateNutritionPlanResult["status"]) ?? "active",
      revision: response.data.revision ?? 1,
      wasNoOp: response.data.wasNoOp ?? false,
    };
  } catch (error) {
    throw normalizeNutritionMutationError(error, "Erro ao atualizar plano nutricional");
  }
}

/**
 * Executes the healthNutritionCancelPlan callable.
 *
 * @param functions - Firebase Functions instance (from src/lib/firebase/client)
 * @param request - Pre-built wire request with stable operationId
 * @returns Normalized result or throws NutritionMutationError
 */
export async function executeCancelNutritionPlan(
  functions: Functions,
  request: CancelNutritionPlanWireRequest
): Promise<CancelNutritionPlanResult> {
  try {
    const callable = httpsCallable<CancelNutritionPlanWireRequest, {
      success: boolean;
      planId?: string;
      status?: string;
      revision?: number;
      wasNoOp?: boolean;
      [key: string]: unknown;
    }>(functions, CALLABLE_CANCEL);

    const response = await callable(request);

    if (!isSuccessResponse(response.data)) {
      throw normalizeNutritionMutationError(
        new Error("Backend returned unsuccessful response"),
        "Falha ao cancelar plano nutricional"
      );
    }

    return {
      success: true,
      planId: response.data.planId ?? "",
      status: (response.data.status as CancelNutritionPlanResult["status"]) ?? "cancelled",
      revision: response.data.revision ?? 1,
      wasNoOp: response.data.wasNoOp ?? false,
    };
  } catch (error) {
    throw normalizeNutritionMutationError(error, "Erro ao cancelar plano nutricional");
  }
}

// =============================================================================
// CONVENIENCE COMBINED FUNCTIONS
// =============================================================================

/**
 * High-level function that generates operationId, builds request, and executes.
 * Use this when you don't need to reuse the same operationId across retries.
 *
 * For retry-capable flows, use generateNutritionPlanOperationId() separately
 * and pass the same ID to the individual build/execute functions.
 */
export async function createNutritionPlan(
  functions: Functions,
  command: CreateNutritionPlanCommand
): Promise<CreateNutritionPlanResult> {
  const operationId = generateNutritionPlanOperationId();
  const request = buildCreateNutritionPlanRequest(command, operationId);
  return executeCreateNutritionPlan(functions, request);
}

/**
 * High-level function for updating a plan.
 */
export async function updateNutritionPlan(
  functions: Functions,
  command: UpdateNutritionPlanCommand
): Promise<UpdateNutritionPlanResult> {
  const operationId = generateNutritionPlanOperationId();
  const request = buildUpdateNutritionPlanRequest(command, operationId);
  return executeUpdateNutritionPlan(functions, request);
}

/**
 * High-level function for cancelling a plan.
 */
export async function cancelNutritionPlan(
  functions: Functions,
  command: CancelNutritionPlanCommand
): Promise<CancelNutritionPlanResult> {
  const operationId = generateNutritionPlanOperationId();
  const request = buildCancelNutritionPlanRequest(command, operationId);
  return executeCancelNutritionPlan(functions, request);
}
