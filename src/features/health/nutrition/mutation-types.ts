/**
 * K9 Ops Web — Health Web v1 / WEB-01B.3
 * Nutrition mutation contracts (commands, callable wire formats, results).
 *
 * Kept separate from `types.ts` on purpose: that file holds the read model
 * closed by B.1/B.1R and is imported by the read service, the read hook and the
 * presentation layer. Mutation contracts have a disjoint consumer set (mutation
 * service + mutation hook + their tests), so a separate module keeps the
 * stabilized read contract legible instead of doubling the size of types.ts.
 *
 * Error types are NOT declared here. `errors/` is the single authority for
 * mutation errors (reconciled in WEB-01B.0R1) and already covers every domain
 * code this contract can produce.
 *
 * Naming follows the backend contract exactly: camelCase at the request root,
 * snake_case inside `planData`. Do not "normalize" either side.
 */

import type {
  MealScheduleSlot,
  NutritionPlanStatus,
  NutritionPlanSupplementRegimen,
  SupplementUnit,
} from "./types";

// =============================================================================
// MUTATION COMMAND TYPES (camelCase — frontend API)
// =============================================================================

/**
 * ProfessionalIdentity in canonical shape for mutation commands.
 */
export interface ProfessionalIdentity {
  name: string;
  registration_type: string;
  registration_number: string;
  clinic?: string | null;
  specialty?: string | null;
}

/**
 * HealthDocumentRef in canonical shape for mutation commands.
 */
export interface HealthDocumentRef {
  health_document_id: string;
  description?: string | null;
}

/**
 * Command for creating a new NutritionPlan or replacing an active NutritionPlan.
 *
 * For CREATE (no active plan exists):
 * - expectedActivePlanId and expectedActiveRevision must be omitted/null.
 *
 * For REPLACE (replacing an active plan):
 * - expectedActivePlanId and expectedActiveRevision must be provided together.
 *
 * REPLACE is the same callable as CREATE plus the expectation pair — the
 * backend supersedes the old plan and activates the new one in one
 * transaction. There is no client-side cancel-then-create.
 */
export interface CreateNutritionPlanCommand {
  dogId: string;
  expectedActivePlanId?: string | null;
  expectedActiveRevision?: number | null;
  planData: {
    foodType: string;
    amountGramsPerDay: number;
    mealsPerDay: number;
    timezone: string;
    validFrom: string; // ISO-8601 UTC instant
    validUntil?: string | null; // ISO-8601 UTC instant
    mealSchedule: MealScheduleSlot[];
    supplements?: NutritionPlanSupplementRegimen[];
    hydrationMl?: number | null;
    specialInstructions?: string | null;
    professional?: ProfessionalIdentity | null;
    sourceDocument?: HealthDocumentRef | null;
    attachmentRefs?: string[] | null; // health_document_id[]
  };
}

/**
 * Patch fields allowed in UpdateNutritionPlanCommand.
 *
 * Semantics:
 * - property absent → preserve
 * - null explicitly → clear
 * - value → replace
 *
 * This set is deliberately administrative only. Structural fields (foodType,
 * amountGramsPerDay, mealsPerDay, mealSchedule, supplements, validity window)
 * are absent by design: changing them requires REPLACE, so the type system
 * prevents a structural change from being smuggled through UPDATE.
 */
export interface NutritionPlanUpdateChanges {
  specialInstructions?: string | null;
  professional?: ProfessionalIdentity | null;
  sourceDocument?: HealthDocumentRef | null;
  attachmentRefs?: string[] | null; // [] means replace with empty
}

/**
 * Command for updating an existing NutritionPlan (administrative only).
 */
export interface UpdateNutritionPlanCommand {
  dogId: string;
  planId: string;
  expectedRevision: number;
  changes: NutritionPlanUpdateChanges;
}

/**
 * Command for cancelling a NutritionPlan. Reason is mandatory.
 */
export interface CancelNutritionPlanCommand {
  dogId: string;
  planId: string;
  expectedRevision: number;
  reason: string;
}

// =============================================================================
// CALLABLE WIRE TYPES (snake_case planData — Firebase Callable request)
// =============================================================================

/**
 * Wire format for meal schedule slot sent to callable.
 */
export interface WireMealScheduleSlot {
  id: string;
  period: string;
  scheduled_time: string;
  target_grams: number;
}

/**
 * Wire format for supplement regimen sent to callable.
 * dose is numeric, unit is the canonical enum.
 */
export interface WireSupplementRegimen {
  id: string;
  name: string;
  dose: number;
  unit: SupplementUnit;
  frequency: string;
  instructions?: string;
  valid_from?: string;
  valid_until?: string;
}

/**
 * Wire format for the CreateNutritionPlan callable request.
 * camelCase at the root, snake_case inside planData, per backend contract.
 */
export interface CreateNutritionPlanWireRequest {
  dogId: string;
  operationId: string;
  expectedActivePlanId?: string;
  expectedActiveRevision?: number;
  planData: {
    food_type: string;
    amount_grams_per_day: number;
    meals_per_day: number;
    timezone: string;
    valid_from: string;
    valid_until?: string | null;
    meal_schedule: WireMealScheduleSlot[];
    supplements?: WireSupplementRegimen[];
    hydration_ml?: number | null;
    special_instructions?: string | null;
    professional?: ProfessionalIdentity | null;
    source_document?: HealthDocumentRef | null;
    attachment_refs?: string[] | null;
  };
}

/**
 * Wire format for the UpdateNutritionPlan callable request.
 * Sends `planData` (not `changes`) per backend contract; administrative
 * fields only.
 */
export interface UpdateNutritionPlanWireRequest {
  dogId: string;
  planId: string;
  operationId: string;
  expectedRevision: number;
  planData: {
    special_instructions?: string | null;
    professional?: ProfessionalIdentity | null;
    source_document?: HealthDocumentRef | null;
    attachment_refs?: string[] | null;
  };
}

/**
 * Wire format for the CancelNutritionPlan callable request.
 */
export interface CancelNutritionPlanWireRequest {
  dogId: string;
  planId: string;
  operationId: string;
  expectedRevision: number;
  reason: string;
}

// =============================================================================
// MUTATION RESULT TYPES
// =============================================================================

/**
 * Common fields in all mutation responses.
 */
export interface BaseNutritionPlanMutationResult {
  success: boolean;
  planId: string;
  status: NutritionPlanStatus;
  revision: number;
}

/**
 * Result from the CreateNutritionPlan callable.
 *
 * `wasNoOp` is observable on a legitimate replay (same operationId, same
 * payload) and must be preserved rather than collapsed into plain success.
 */
export interface CreateNutritionPlanResult extends BaseNutritionPlanMutationResult {
  supersededPlanId?: string | null;
  wasNoOp: boolean;
}

/**
 * Result from the UpdateNutritionPlan callable.
 */
export interface UpdateNutritionPlanResult extends BaseNutritionPlanMutationResult {
  wasNoOp: boolean;
}

/**
 * Result from the CancelNutritionPlan callable.
 */
export interface CancelNutritionPlanResult extends BaseNutritionPlanMutationResult {
  wasNoOp: boolean;
}
