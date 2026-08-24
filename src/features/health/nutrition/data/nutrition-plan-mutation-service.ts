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
 * rather than malformed. Presence, however, is held to the declared type — a
 * truthy string `wasNoOp` or a numeric `supersededPlanId` is malformed, not a
 * value to coerce. Coercion here would let `wasNoOp: "false"` read as a replay
 * and a non-string `supersededPlanId` slip past the correlation comparison.
 */
function assertValidMutationPayload(
  data: {
    planId?: unknown;
    status?: unknown;
    revision?: unknown;
    wasNoOp?: unknown;
    supersededPlanId?: unknown;
  },
  defaultMessage: string,
): asserts data is { planId: string; status: string; revision: number } {
  const planIdOk = typeof data.planId === "string" && data.planId.trim().length > 0;
  const revisionOk =
    typeof data.revision === "number" &&
    Number.isInteger(data.revision) &&
    data.revision >= 0;
  const statusOk = typeof data.status === "string" && data.status.trim().length > 0;

  // Optional-by-contract, but never loosely typed when present.
  const wasNoOpOk = data.wasNoOp === undefined || typeof data.wasNoOp === "boolean";
  const supersededOk =
    data.supersededPlanId === undefined ||
    data.supersededPlanId === null ||
    (typeof data.supersededPlanId === "string" && data.supersededPlanId.trim().length > 0);

  if (!planIdOk || !revisionOk || !statusOk || !wasNoOpOk || !supersededOk) {
    throw markNormalized({
      firebaseCode: "internal",
      message: defaultMessage,
      retryable: false,
      details: { code: "invalid-mutation-response" },
    });
  }
}

// =============================================================================
// RESPONSE CORRELATION (WEB-01B.6R)
// =============================================================================

/**
 * Raises the same fail-closed error the shape gate uses.
 *
 * Correlation runs AFTER the backend answered `success: true`, so the mutation
 * may already be persisted. That makes it deliberately non-retryable: replaying
 * it would either hit the receipt (returning the same uncorrelatable payload) or
 * mint a second mutation. The caller must reload and look at the reader, which
 * is the only authority on what actually exists.
 *
 * The raw response never reaches the message — the operator gets the generic
 * operation failure, and `invalid-mutation-response` is the machine-readable
 * discriminator shared with the shape gate.
 */
function invalidMutationResponse(defaultMessage: string): never {
  throw markNormalized({
    firebaseCode: "internal",
    message: defaultMessage,
    retryable: false,
    details: { code: "invalid-mutation-response" },
  });
}

/**
 * True when a mutation failed AFTER the backend already answered `success: true`.
 *
 * This is the one error in the taxonomy where "failed" does not mean "did not
 * happen". Every other failure — permission-denied, revision-conflict,
 * active-plan-conflict, validation, transport — means the backend either refused
 * the mutation or never received it, so the pre-mutation snapshot is still
 * authoritative. `invalid-mutation-response` is raised only past the
 * `success: true` gate, by the shape check or by correlation, so the write may
 * already be persisted and the snapshot on screen may already be dead.
 *
 * Callers use this to withhold further mutations against that stale snapshot
 * until the realtime reader reconciles. It deliberately does NOT match bare
 * `internal`, `unknown` or `internal-integrity-error`: those can arise without
 * the client ever observing a success, and treating them as potentially
 * committed would freeze the UI after operations that plainly never landed.
 */
export function isPotentiallyCommittedOutcome(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const details = (error as { details?: unknown }).details;
  if (typeof details !== "object" || details === null) return false;
  return (details as { code?: unknown }).code === "invalid-mutation-response";
}

/**
 * Correlates a CREATE/REPLACE response with the request that produced it.
 *
 * Shape validity is not correlation: `{planId, status, revision}` can all be
 * well-typed and still describe an operation nobody asked for. The backend
 * contract (canil-gcm @ feature/health-v1-foundation) is narrow enough to check
 * exactly:
 *
 * - `status` is written as the literal "active" (engine 1654/1661)
 * - `revision` is written as the literal 1 — a plan is BORN at revision 1
 *   (engine 1654/1662); `planRevision` rejects anything < 1 (engine 1515)
 * - REPLACE (expectation pair present) supersedes precisely the plan the client
 *   named: the transaction refuses unless `previous.id === expectedActivePlanId`
 *   (engine 1612) and then reports that same id (engine 1641/1664)
 * - CREATE (no expectation pair) has no `previous`, so `supersededPlanId` is
 *   null (engine 1641). A non-null value would mean the backend silently
 *   superseded a plan this client never saw.
 * - REPLACE mints a NEW document, so the new planId cannot be the superseded one
 *
 * All of the above hold identically for a `wasNoOp: true` receipt replay: the
 * receipt stores the original `result` verbatim (engine 1157) and replay only
 * returns it after re-asserting intent + expectation pair (engine 1096-1102),
 * so a legitimate replay passes these checks unchanged.
 */
function assertCreateOrReplaceCorrelation(
  request: CreateNutritionPlanWireRequest,
  data: { planId: string; status: string; revision: number; supersededPlanId?: string | null },
  defaultMessage: string,
): void {
  if (data.status !== "active" || data.revision !== 1) {
    invalidMutationResponse(defaultMessage);
  }

  const expectedActivePlanId = request.expectedActivePlanId;
  const isReplace =
    typeof expectedActivePlanId === "string" &&
    expectedActivePlanId.length > 0 &&
    typeof request.expectedActiveRevision === "number";

  if (!isReplace) {
    // Plain CREATE: nothing existed to supersede.
    if (data.supersededPlanId != null) {
      invalidMutationResponse(defaultMessage);
    }
    return;
  }

  if (
    typeof data.supersededPlanId !== "string" ||
    data.supersededPlanId !== expectedActivePlanId ||
    data.planId === expectedActivePlanId
  ) {
    invalidMutationResponse(defaultMessage);
  }
}

/**
 * Correlates an UPDATE response with the request that produced it.
 *
 * UPDATE patches one existing document in place, so the response must name that
 * same document, leave it active, and land exactly one revision ahead:
 * `assertExpectedRevision` requires `current === expectedRevision` (engine 1533)
 * and the write uses `currentRevision + 1` (engine 1722). Any other revision
 * means the response does not describe the write this request asked for, and
 * adopting it would poison the `expectedRevision` of the next mutation.
 *
 * `supersededPlanId` must be null. UPDATE patches one document in place and
 * never supersedes anything, so the engine result carries no such field (engine
 * 1732) and `planResponse` normalizes the absence to null (callables 281). A
 * non-null value is therefore semantically impossible: it would claim this
 * UPDATE ended some other plan's life.
 */
function assertUpdateCorrelation(
  request: UpdateNutritionPlanWireRequest,
  data: {
    planId: string;
    status: string;
    revision: number;
    supersededPlanId?: string | null;
  },
  defaultMessage: string,
): void {
  if (
    data.planId !== request.planId ||
    data.status !== "active" ||
    data.revision !== request.expectedRevision + 1 ||
    data.supersededPlanId != null
  ) {
    invalidMutationResponse(defaultMessage);
  }
}

/**
 * Correlates a CANCEL response with the request that produced it.
 *
 * Same identity and revision arithmetic as UPDATE (engine 1758-1760), with the
 * terminal status: CANCEL writes the literal "cancelled". A response still
 * claiming "active" would let the UI report a cancellation that did not happen.
 *
 * `supersededPlanId` must be null for the same reason as UPDATE: cancelling ends
 * one plan without promoting a successor, so the engine result omits the field
 * (engine 1768) and `planResponse` reports null (callables 281).
 */
function assertCancelCorrelation(
  request: CancelNutritionPlanWireRequest,
  data: {
    planId: string;
    status: string;
    revision: number;
    supersededPlanId?: string | null;
  },
  defaultMessage: string,
): void {
  if (
    data.planId !== request.planId ||
    data.status !== "cancelled" ||
    data.revision !== request.expectedRevision + 1 ||
    data.supersededPlanId != null
  ) {
    invalidMutationResponse(defaultMessage);
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
    assertCreateOrReplaceCorrelation(
      request,
      response.data,
      "Falha ao criar plano nutricional",
    );

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
        // Always transmitted by `planResponse` (callables 281), normalized to
        // null on this path. Declared so correlation can reject a non-null value
        // instead of it disappearing into the index signature.
        supersededPlanId?: string | null;
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
    assertUpdateCorrelation(
      request,
      response.data,
      "Falha ao atualizar plano nutricional",
    );

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
        // Same rationale as UPDATE: always sent, contractually null here.
        supersededPlanId?: string | null;
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
    assertCancelCorrelation(
      request,
      response.data,
      "Falha ao cancelar plano nutricional",
    );

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
