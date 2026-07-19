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
    crmv?: string;
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
