export type MealPeriod = "morning" | "afternoon" | "evening" | "night" | "extra";
export type NutritionPlanStatus = "active" | "superseded" | "cancelled";

// Firestore raw/wire format interfaces
export interface FirestoreRecordedBy {
  uid?: string;
  id?: string;
  name?: string;
  internal_role?: string;
  role?: string;
}

export interface FirestoreMealScheduleSlot {
  id?: string;
  period?: string;
  scheduled_time?: string;
  target_grams?: number | string;
}

export interface FirestoreSupplementRegimen {
  id?: string;
  name?: string;
  dose?: string;
  unit?: string;
  frequency?: string;
  instructions?: string;
  valid_from?: unknown;
  valid_until?: unknown;
}

export interface FirestoreNutritionPlanDoc {
  food_type?: string;
  amount_grams_per_day?: number | string;
  meals_per_day?: number | string;
  meal_schedule?: FirestoreMealScheduleSlot[];
  valid_from?: unknown;
  valid_until?: unknown;
  timezone?: string;
  status?: string;
  recorded_by?: FirestoreRecordedBy;
  schema_version?: number | string;
  revision?: number | string;
  hydration_ml?: number | string;
  special_instructions?: string;
  professional?: {
    name?: string;
    crmv?: string;
    [key: string]: unknown;
  };
  source_document?: {
    id?: string;
    name?: string;
    [key: string]: unknown;
  };
  attachment_refs?: string[];
  supplements?: FirestoreSupplementRegimen[];
  legacy_source?: string;
  legacy_id?: string;
}

export interface FirestoreLegacyPlanDoc {
  food_type?: string;
  foodType?: string;
  racao?: string;
  food?: string;
  amount_grams_per_day?: number | string;
  amountGramsPerDay?: number | string;
  daily_amount?: number | string;
  meals_per_day?: number | string;
  mealsPerDay?: number | string;
  meals?: number | string;
  vigent_from?: unknown;
  vigentFrom?: unknown;
  valid_from?: unknown;
  created_at?: unknown;
  vigent_until?: unknown;
  vigentUntil?: unknown;
  valid_until?: unknown;
  hydration_ml?: number | string;
  special_instructions?: string;
  notes?: string;
  observations?: string;
  vet_name?: string;
  professional_name?: string;
  vetName?: string;
  vet_crmv?: string;
  crmv?: string;
  professional_crmv?: string;
  status?: string;
}

// Domain Model interfaces
export interface RecordedBy {
  uid: string;
  name: string;
  internalRole: string;
}

export interface MealScheduleSlot {
  id: string;
  period: MealPeriod;
  scheduledTime: string;
  targetGrams: number;
}

export interface NutritionPlanSupplementRegimen {
  id: string;
  name: string;
  dose: string;
  unit: string;
  frequency: string;
  instructions?: string;
  validFrom?: Date;
  validUntil?: Date;
}

export interface NutritionPlan {
  id: string;
  dogId: string;
  foodType: string;
  amountGramsPerDay: number;
  mealsPerDay: number;
  mealSchedule: MealScheduleSlot[];
  validFrom: Date;
  validUntil?: Date;
  timezone: string;
  recordedBy: RecordedBy;
  status: NutritionPlanStatus;
  schemaVersion: number;
  revision: number;
  hydrationMl?: number;
  specialInstructions?: string;
  professional?: {
    name?: string;
    registration_type?: string;
    registration_number?: string;
    registrationType?: string;
    registrationNumber?: string;
    crmv?: string;
    clinic?: string;
    specialty?: string;
    [key: string]: unknown;
  };
  sourceDocument?: {
    id?: string;
    name?: string;
    [key: string]: unknown;
  };
  attachmentRefs?: string[];
  supplements?: NutritionPlanSupplementRegimen[];
  legacySource?: string;
  legacyId?: string;
}

export interface LegacyNutritionPlanView {
  id: string;
  dogId: string;
  foodType: string;
  amountGramsPerDay: number;
  mealsPerDay: number;
  vigentFrom: Date;
  vigentUntil?: Date;
  hydrationMl?: number;
  notes?: string;
  professionalName?: string;
  professionalRegistrationType?: string;
  professionalRegistrationNumber?: string;
  professionalCrmv?: string;
  rawStatus?: string;
  legacySource: string;
  legacyId: string;
}

// Read-only Consolidated States
export type NutritionPlanStateStatus =
  | "loading"
  | "canonical"
  | "legacy"
  | "empty"
  | "degraded"
  | "error"
  | "conflict";

export type NutritionPlanStateReason =
  | "multiple-active-plans"
  | "malformed-canonical-document"
  | "firestore-read-error"
  | "malformed-primary-legacy"
  | "malformed-secondary-legacy"
  | "partial-parsing-errors"
  | "invalid-dog-id";

export interface NutritionPlanState {
  status: NutritionPlanStateStatus;
  reason?: NutritionPlanStateReason;
  dogId: string;
  generation?: number;
  activePlan: NutritionPlan | LegacyNutritionPlanView | null;
  plans: NutritionPlan[];
  legacyPlan: LegacyNutritionPlanView | null;
  error: string | null;
  integrityConflict: {
    message: string;
    activePlansCount: number;
    activePlanIds: string[];
  } | null;
  parsingErrors: Array<{
    documentId: string;
    error: string;
    collection: string;
    rawStatus?: string;
  }>;
}

// =============================================================================
// MUTATION COMMAND TYPES (camelCase - frontend API)
// =============================================================================

/**
 * ProfessionalIdentity in canonical shape for mutation commands.
 * Uses the contract recommended by the new web client.
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
 * Uses the contract recommended by the new web client.
 */
export interface HealthDocumentRef {
  health_document_id: string;
  description?: string | null;
}

/**
 * Command for creating a new NutritionPlan.
 * Uses camelCase for the outer structure.
 */
export interface CreateNutritionPlanCommand {
  dogId: string;
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
 * Semantics:
 * - property absent → preserve
 * - null explicitly → clear
 * - value → replace
 */
export interface NutritionPlanUpdateChanges {
  specialInstructions?: string | null;
  professional?: ProfessionalIdentity | null;
  sourceDocument?: HealthDocumentRef | null;
  attachmentRefs?: string[] | null; // [] means replace with empty
}

/**
 * Command for updating an existing NutritionPlan.
 */
export interface UpdateNutritionPlanCommand {
  dogId: string;
  planId: string;
  expectedRevision: number;
  changes: NutritionPlanUpdateChanges;
}

/**
 * Command for cancelling a NutritionPlan.
 */
export interface CancelNutritionPlanCommand {
  dogId: string;
  planId: string;
  expectedRevision: number;
  reason: string;
}

// =============================================================================
// CALLABLE WIRE TYPES (snake_case - Firebase Callable Request/Response)
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
 */
export interface WireSupplementRegimen {
  id: string;
  name: string;
  dose: string;
  unit: string;
  frequency: string;
  instructions?: string;
  valid_from?: string;
  valid_until?: string;
}

/**
 * Wire format for CreateNutritionPlan callable request.
 * Uses snake_case as required by the backend.
 */
export interface CreateNutritionPlanWireRequest {
  dogId: string;
  operationId: string;
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
 * Wire format for UpdateNutritionPlan callable request.
 */
export interface UpdateNutritionPlanWireRequest {
  dogId: string;
  planId: string;
  operationId: string;
  expectedRevision: number;
  changes?: {
    special_instructions?: string | null;
    professional?: ProfessionalIdentity | null;
    source_document?: HealthDocumentRef | null;
    attachment_refs?: string[] | null;
  };
}

/**
 * Wire format for CancelNutritionPlan callable request.
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
 * Result from CreateNutritionPlan callable.
 */
export interface CreateNutritionPlanResult extends BaseNutritionPlanMutationResult {
  supersededPlanId?: string | null;
  wasNoOp: boolean;
}

/**
 * Result from UpdateNutritionPlan callable.
 */
export interface UpdateNutritionPlanResult extends BaseNutritionPlanMutationResult {
  wasNoOp: boolean;
}

/**
 * Result from CancelNutritionPlan callable.
 */
export interface CancelNutritionPlanResult extends BaseNutritionPlanMutationResult {
  wasNoOp: boolean;
}

// =============================================================================
// MUTATION ERROR TYPES
// =============================================================================

/**
 * Domain error codes returned by the backend can be classified by retryability.
 * These are codes from details.code in the callable response.
 */
export type NutritionMutationDomainCode =
  | "validation"
  | "invalid_timezone"
  | "nutrition_plan_conflict"
  | "integrity"
  | "idempotency_conflict"
  | "permission-denied"
  | "unauthenticated"
  | "not-found"
  | "internal";

/**
 * Normalized error structure for mutation failures.
 * Preserves both Firebase transport code and domain code separately.
 */
export interface NutritionMutationError {
  /** Firebase Functions transport error code (e.g., 'unavailable', 'permission-denied') */
  firebaseCode: FirebaseFunctionsErrorCode;
  /** Domain code from details.code (e.g., 'validation', 'nutrition_plan_conflict') */
  domainCode?: NutritionMutationDomainCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Type alias for backward compatibility during transition.
 * @deprecated Use NutritionMutationError directly with firebaseCode/domainCode.
 */
export type NutritionMutationErrorCode = NutritionMutationDomainCode;

/**
 * Firebase Functions error codes that are transport/network related.
 */
export type FirebaseFunctionsErrorCode =
  | "ok"
  | "cancelled"
  | "unknown"
  | "invalid-argument"
  | "deadline-exceeded"
  | "not-found"
  | "already-exists"
  | "permission-denied"
  | "unauthenticated"
  | "resource-exhausted"
  | "failed-precondition"
  | "aborted"
  | "out-of-range"
  | "unimplemented"
  | "internal"
  | "unavailable"
  | "data-loss";
