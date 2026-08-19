export type NutritionMutationDomainCode =
  | "validation"
  | "invalid_timezone"
  | "active-plan-conflict"
  | "revision-conflict"
  | "integrity-conflict"
  | "idempotency-conflict"
  | "receipt-integrity"
  | "legacy-receipt-replay-unsupported"
  | "retroactive-plan-conflict"
  | "nutrition_plan_conflict"
  | "integrity"
  | "idempotency_conflict"
  | "plan-not-found"
  | "already-cancelled"
  | "invalid-lifecycle"
  | "internal-integrity-error"
  | "invalid-validity-window"
  | "permission-denied"
  | "unauthenticated"
  | "not-found"
  | "internal";

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

export interface NutritionMutationError {
  firebaseCode: FirebaseFunctionsErrorCode;
  domainCode?: NutritionMutationDomainCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}
