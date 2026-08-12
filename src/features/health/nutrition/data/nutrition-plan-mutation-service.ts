/**
 * K9 Ops Web — Health Web v1 / WEB-01B.3
 * Nutrition plan mutation transport (callable only).
 *
 * Boundary: builds callable wire requests, invokes the three canonical
 * callables, parses responses fail-closed, and normalizes errors through the
 * `errors/` authority reconciled in WEB-01B.0R1.
 *
 * This module never writes Firestore directly. Every NutritionPlan mutation is
 * server-authored behind a callable, so there is no setDoc/updateDoc/writeBatch
 * path here by design.
 *
 * REPLACE is not a fourth callable: it is the CREATE callable plus the
 * expectation pair (expectedActivePlanId + expectedActiveRevision), which the
 * backend applies as supersede-old + activate-new in one transaction. A
 * client-side "cancel then create" sequence would break atomicity and is
 * deliberately not implementable through this surface.
 *
 * The Functions instance is injected rather than constructed here, so the
 * canonical instance from `@/lib/firebase/client` (region resolved from
 * NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION, defaulting to southamerica-east1) is
 * the only one in play. No second Firebase initialization.
 */

import { httpsCallable, type Functions } from "firebase/functions";

import type { NutritionMutationError } from "../errors/nutrition-mutation-error-types";
import { normalizeNutritionMutationError } from "../errors/nutrition-mutation-errors";
import type {
  CancelNutritionPlanCommand,
  CancelNutritionPlanResult,
  CancelNutritionPlanWireRequest,
  CreateNutritionPlanCommand,
  CreateNutritionPlanResult,
  CreateNutritionPlanWireRequest,
  UpdateNutritionPlanCommand,
  UpdateNutritionPlanResult,
  UpdateNutritionPlanWireRequest,
  WireMealScheduleSlot,
  WireSupplementRegimen,
} from "../mutation-types";

export {
  isNutritionPlanConflictError,
  isPermissionError,
  isTransportError,
  isValidationError,
  normalizeNutritionMutationError,
} from "../errors/nutrition-mutation-errors";

// Callable function names — canonical backend, no aliases, no client renaming.
const CALLABLE_CREATE = "healthNutritionCreateAndActivatePlan";
const CALLABLE_UPDATE = "healthNutritionUpdateActivePlan";
const CALLABLE_CANCEL = "healthNutritionCancelPlan";

// =============================================================================
// OPERATION ID GENERATION
// =============================================================================

/**
 * Generates a browser-safe operation ID using the Web Crypto API.
 *
 * Architecture guarantee:
 * - One logical intent → one operationId
 * - Retry of the same intent → same operationId
 * - New intent → new operationId
 *
 * The caller owns the lifecycle: generate once per intent and pass the same id
 * to build + execute on every attempt. Never call this inside a retry path.
 */
export function generateNutritionPlanOperationId(): string {
  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { crypto?: unknown }).crypto === "object" &&
    typeof (globalThis as { crypto?: { randomUUID?: unknown } }).crypto?.randomUUID ===
      "function"
  ) {
    return (globalThis as { crypto: { randomUUID: () => string } }).crypto.randomUUID();
  }

  // Fallback for environments without Web Crypto (should not happen in modern
  // browsers). Uses a deterministic pattern to ensure uniqueness per call.
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}-${random2}-xxxxxxxx`.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

// =============================================================================
// REQUEST BUILDERS
// =============================================================================

/**
 * Maps a MealScheduleSlot (camelCase) to WireMealScheduleSlot (snake_case).
 */
function mapMealScheduleSlot(slot: {
  id: string;
  period: string;
  scheduledTime: string;
  targetGrams: number;
}): WireMealScheduleSlot {
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
  dose: number;
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
    unit: supp.unit as WireSupplementRegimen["unit"],
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
 *
 * The expectation pair is all-or-nothing: providing only one half is a local
 * contract violation and throws before any transport happens, rather than
 * silently degrading a REPLACE into a CREATE (which would activate a second
 * plan instead of superseding the first).
 */
export function buildCreateNutritionPlanRequest(
  command: CreateNutritionPlanCommand,
  operationId: string,
): CreateNutritionPlanWireRequest {
  const { planData } = command;

  const request: CreateNutritionPlanWireRequest = {
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
      source_document: planData.sourceDocument
        ? {
            health_document_id: planData.sourceDocument.health_document_id,
            description: planData.sourceDocument.description ?? null,
          }
        : null,
      attachment_refs: planData.attachmentRefs ?? null,
    },
  };

  const hasExpectedId =
    command.expectedActivePlanId != null &&
    typeof command.expectedActivePlanId === "string" &&
    command.expectedActivePlanId.trim().length > 0;
  const hasExpectedRev =
    command.expectedActiveRevision != null &&
    typeof command.expectedActiveRevision === "number" &&
    Number.isInteger(command.expectedActiveRevision);

  if (hasExpectedId && hasExpectedRev) {
    request.expectedActivePlanId = command.expectedActivePlanId!.trim();
    request.expectedActiveRevision = command.expectedActiveRevision!;
  } else if (hasExpectedId || hasExpectedRev) {
    throw new Error(
      "expectedActivePlanId and expectedActiveRevision must be provided together for REPLACE.",
    );
  }

  return request;
}

/**
 * Builds a callable request for updating a NutritionPlan.
 *
 * Sends `planData` (not `changes`) per backend contract, and only includes
 * fields explicitly present in `changes`:
 * - absent → preserve (not sent)
 * - null → clear
 * - value → replace
 *
 * Only administrative fields exist in NutritionPlanUpdateChanges, so a
 * structural change cannot reach UPDATE through this builder.
 */
export function buildUpdateNutritionPlanRequest(
  command: UpdateNutritionPlanCommand,
  operationId: string,
): UpdateNutritionPlanWireRequest {
  const { changes } = command;

  const hasChanges =
    changes.specialInstructions !== undefined ||
    changes.professional !== undefined ||
    changes.sourceDocument !== undefined ||
    changes.attachmentRefs !== undefined;

  if (!hasChanges) {
    throw new Error("Update command must include at least one change field");
  }

  const planData: UpdateNutritionPlanWireRequest["planData"] = {};

  if (changes.specialInstructions !== undefined) {
    planData.special_instructions = changes.specialInstructions;
  }
  if (changes.professional !== undefined) {
    planData.professional = changes.professional;
  }
  if (changes.sourceDocument !== undefined) {
    planData.source_document = changes.sourceDocument
      ? {
          health_document_id: changes.sourceDocument.health_document_id,
          description: changes.sourceDocument.description ?? null,
        }
      : null;
  }
  if (changes.attachmentRefs !== undefined) {
    planData.attachment_refs = changes.attachmentRefs;
  }

  return {
    dogId: command.dogId,
    planId: command.planId,
    operationId,
    expectedRevision: command.expectedRevision,
    planData,
  };
}

/**
 * Builds a callable request for cancelling a NutritionPlan.
 *
 * Reason is mandatory: an empty/whitespace reason is rejected locally rather
 * than sent for the backend to refuse.
 */
export function buildCancelNutritionPlanRequest(
  command: CancelNutritionPlanCommand,
  operationId: string,
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
 * Type guard for callable response success. Anything other than an explicit
 * `success: true` is treated as failure — no arbitrary payload is accepted as
 * a successful mutation.
 */
function isSuccessResponse<T extends { success?: unknown }>(
  response: T,
): response is T & { success: true } {
  return response.success === true;
}

/**
 * Sentinel marking an already-normalized error, so the outer catch re-throws it
 * unchanged instead of running it back through the normalizer (which would see
 * a plain object with no `code` and flatten a precise domain error into
 * `unknown`).
 */
const NORMALIZED = Symbol("nutritionMutationErrorNormalized");

function alreadyNormalized(error: unknown): boolean {
  return typeof error === "object" && error !== null && NORMALIZED in error;
}

function markNormalized(error: NutritionMutationError): NutritionMutationError {
  Object.defineProperty(error, NORMALIZED, { value: true, enumerable: false });
  return error;
}

/**
 * Fails closed on a structurally invalid success payload.
 *
 * `success: true` alone is not sufficient. The identity fields are what the
 * caller acts on afterwards: `planId` addresses the plan and `revision` becomes
 * the `expectedRevision` of the next UPDATE/CANCEL. Defaulting a missing
 * revision to 1 would hand the caller a fabricated expectation and turn the
 * next mutation into a spurious revision-conflict — or, worse, a write against
 * the wrong revision. A missing planId would address nothing at all.
 *
 * `wasNoOp` and `supersededPlanId` are deliberately NOT required: the backend
 * omits them on paths where they do not apply, and their absence is meaningful
 * rather than malformed.
 */
function assertValidMutationPayload(
  data: { planId?: unknown; status?: unknown; revision?: unknown },
  defaultMessage: string,
): asserts data is { planId: string; status: string; revision: number } {
  const planIdOk = typeof data.planId === "string" && data.planId.trim().length > 0;
  const revisionOk =
    typeof data.revision === "number" &&
    Number.isInteger(data.revision) &&
    data.revision >= 0;
  const statusOk = typeof data.status === "string" && data.status.trim().length > 0;

  if (!planIdOk || !revisionOk || !statusOk) {
    throw markNormalized({
      firebaseCode: "internal",
      message: defaultMessage,
      retryable: false,
      details: { code: "invalid-mutation-response" },
    });
  }
}

/**
 * Executes the healthNutritionCreateAndActivatePlan callable.
 *
 * This is also the REPLACE transport: when the request carries the expectation
 * pair, the backend supersedes the active plan and activates the new one
 * atomically. `supersededPlanId` in the response is the observable proof.
 *
 * @param functions - Firebase Functions instance (from src/lib/firebase/client)
 * @param request - Pre-built wire request with stable operationId
 */
export async function executeCreateNutritionPlan(
  functions: Functions,
  request: CreateNutritionPlanWireRequest,
): Promise<CreateNutritionPlanResult> {
  try {
    const callable = httpsCallable<
      CreateNutritionPlanWireRequest,
      {
        success: boolean;
        planId?: string;
        status?: string;
        revision?: number;
        supersededPlanId?: string | null;
        wasNoOp?: boolean;
        [key: string]: unknown;
      }
    >(functions, CALLABLE_CREATE);

    const response = await callable(request);

    if (!isSuccessResponse(response.data)) {
      throw normalizeNutritionMutationError(
        new Error("Backend returned unsuccessful response"),
        "Falha ao criar plano nutricional",
      );
    }

    assertValidMutationPayload(response.data, "Falha ao criar plano nutricional");

    return {
      success: true,
      planId: response.data.planId,
      status: response.data.status as CreateNutritionPlanResult["status"],
      revision: response.data.revision,
      supersededPlanId: response.data.supersededPlanId ?? null,
      wasNoOp: response.data.wasNoOp ?? false,
    };
  } catch (error) {
    if (alreadyNormalized(error)) throw error;
    throw normalizeNutritionMutationError(error, "Erro ao criar plano nutricional");
  }
}

/**
 * Executes the healthNutritionUpdateActivePlan callable.
 *
 * @param functions - Firebase Functions instance (from src/lib/firebase/client)
 * @param request - Pre-built wire request with stable operationId
 */
export async function executeUpdateNutritionPlan(
  functions: Functions,
  request: UpdateNutritionPlanWireRequest,
): Promise<UpdateNutritionPlanResult> {
  try {
    const callable = httpsCallable<
      UpdateNutritionPlanWireRequest,
      {
        success: boolean;
        planId?: string;
        status?: string;
        revision?: number;
        wasNoOp?: boolean;
        [key: string]: unknown;
      }
    >(functions, CALLABLE_UPDATE);

    const response = await callable(request);

    if (!isSuccessResponse(response.data)) {
      throw normalizeNutritionMutationError(
        new Error("Backend returned unsuccessful response"),
        "Falha ao atualizar plano nutricional",
      );
    }

    assertValidMutationPayload(response.data, "Falha ao atualizar plano nutricional");

    return {
      success: true,
      planId: response.data.planId,
      status: response.data.status as UpdateNutritionPlanResult["status"],
      revision: response.data.revision,
      wasNoOp: response.data.wasNoOp ?? false,
    };
  } catch (error) {
    if (alreadyNormalized(error)) throw error;
    throw normalizeNutritionMutationError(error, "Erro ao atualizar plano nutricional");
  }
}

/**
 * Executes the healthNutritionCancelPlan callable.
 *
 * @param functions - Firebase Functions instance (from src/lib/firebase/client)
 * @param request - Pre-built wire request with stable operationId
 */
export async function executeCancelNutritionPlan(
  functions: Functions,
  request: CancelNutritionPlanWireRequest,
): Promise<CancelNutritionPlanResult> {
  try {
    const callable = httpsCallable<
      CancelNutritionPlanWireRequest,
      {
        success: boolean;
        planId?: string;
        status?: string;
        revision?: number;
        wasNoOp?: boolean;
        [key: string]: unknown;
      }
    >(functions, CALLABLE_CANCEL);

    const response = await callable(request);

    if (!isSuccessResponse(response.data)) {
      throw normalizeNutritionMutationError(
        new Error("Backend returned unsuccessful response"),
        "Falha ao cancelar plano nutricional",
      );
    }

    assertValidMutationPayload(response.data, "Falha ao cancelar plano nutricional");

    return {
      success: true,
      planId: response.data.planId,
      status: response.data.status as CancelNutritionPlanResult["status"],
      revision: response.data.revision,
      wasNoOp: response.data.wasNoOp ?? false,
    };
  } catch (error) {
    if (alreadyNormalized(error)) throw error;
    throw normalizeNutritionMutationError(error, "Erro ao cancelar plano nutricional");
  }
}
