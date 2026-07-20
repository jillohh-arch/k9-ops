import type {
  NutritionMutationError,
  NutritionMutationDomainCode,
  FirebaseFunctionsErrorCode,
} from "../types";

/**
 * Error codes that are NOT retryable — server-side logic or permission failures.
 */
const DOMAIN_NON_RETRYABLE: ReadonlySet<NutritionMutationDomainCode> = new Set([
  "validation",
  "permission-denied",
  "unauthenticated",
  "nutrition_plan_conflict",
  "idempotency_conflict",
  "integrity",
  "not-found",
] as const);

/**
 * Firebase Functions error codes that indicate transient/network failures — retryable.
 */
const TRANSPORT_RETRYABLE: ReadonlySet<FirebaseFunctionsErrorCode> = new Set([
  "unavailable",
  "deadline-exceeded",
] as const);

/**
 * Firebase Functions error codes that indicate permanent failures — NOT retryable.
 */
const TRANSPORT_NON_RETRYABLE: ReadonlySet<FirebaseFunctionsErrorCode> = new Set([
  "permission-denied",
  "unauthenticated",
  "not-found",
  "invalid-argument",
  "failed-precondition",
  "already-exists",
] as const);

/**
 * Maps a domain code string to a typed NutritionMutationDomainCode.
 * Returns undefined for unknown codes (preserved as-is in details).
 */
export function mapDomainCode(code: string): NutritionMutationDomainCode | undefined {
  const normalized = code.toLowerCase().trim();

  switch (normalized) {
    case "validation":
    case "invalid_timezone":
    case "nutrition_plan_conflict":
    case "integrity":
    case "idempotency_conflict":
    case "permission-denied":
    case "unauthenticated":
    case "not-found":
    case "internal":
      return normalized as NutritionMutationDomainCode;
    default:
      // Unknown domain code - return undefined, preserving the original in details
      return undefined;
  }
}

/**
 * Determines if a domain error code is retryable.
 * Conservative rules: server-side logic failures are NOT retryable.
 */
export function isDomainCodeRetryable(code: NutritionMutationDomainCode): boolean {
  return !DOMAIN_NON_RETRYABLE.has(code);
}

/**
 * Determines if a Firebase Functions error code is retryable.
 * Transient network failures are retryable.
 */
export function isTransportCodeRetryable(code: FirebaseFunctionsErrorCode): boolean {
  if (TRANSPORT_RETRYABLE.has(code)) return true;
  if (TRANSPORT_NON_RETRYABLE.has(code)) return false;
  // Unknown codes: conservative, don't retry
  return false;
}

/**
 * Normalizes an error from a Firebase Callable function call.
 *
 * The error may come from:
 * 1. Firebase Functions transport layer (HttpsError) - preserved as firebaseCode
 * 2. Backend domain logic (details.code) - preserved as domainCode
 *
 * This function preserves BOTH codes separately instead of collapsing
 * transport codes into domain codes.
 */
export function normalizeNutritionMutationError(
  error: unknown,
  defaultMessage = "Erro desconhecido na mutação de plano nutricional"
): NutritionMutationError {
  // Default structure
  const base: NutritionMutationError = {
    firebaseCode: "unknown",
    message: defaultMessage,
    retryable: false,
    details: {},
  };

  // Handle null/undefined
  if (error == null) {
    return base;
  }

  // Extract Firebase Functions error code
  let firebaseCode: FirebaseFunctionsErrorCode = "unknown";
  let backendDetails: Record<string, unknown> | undefined;

  if (error instanceof Error) {
    // Check for Firebase Functions HttpsError structure
    // Firebase Functions errors have a 'code' property that is a string
    const errorWithCode = error as unknown as Record<string, unknown>;
    if (typeof errorWithCode.code === "string") {
      firebaseCode = errorWithCode.code as FirebaseFunctionsErrorCode;
    }

    // Check for 'details' object with domain code
    if (
      errorWithCode.details &&
      typeof errorWithCode.details === "object"
    ) {
      backendDetails = errorWithCode.details as Record<string, unknown>;
    }
  }

  // Extract domain code from details
  let domainCode: NutritionMutationDomainCode | undefined;
  if (backendDetails) {
    const detailsCode = backendDetails.code;
    if (typeof detailsCode === "string" && detailsCode.length > 0) {
      domainCode = mapDomainCode(detailsCode);
    }
  }

  // Determine retryability:
  // - If we have a domain code, use its retryability
  // - Otherwise, use the transport code's retryability
  const retryable = domainCode
    ? isDomainCodeRetryable(domainCode)
    : isTransportCodeRetryable(firebaseCode);

  // Extract human-readable message
  let message = defaultMessage;
  if (error instanceof Error) {
    // Prefer domain message over transport message
    if (typeof backendDetails?.message === "string" && backendDetails.message.length > 0) {
      message = backendDetails.message;
    } else if (error.message && error.message.length > 0 && error.message !== "Error") {
      message = error.message;
    }
  }

  return {
    firebaseCode,
    domainCode,
    message,
    retryable,
    details: backendDetails,
  };
}

/**
 * Helper to check if an error indicates a conflict (revision mismatch).
 */
export function isNutritionPlanConflictError(error: NutritionMutationError): boolean {
  return error.domainCode === "nutrition_plan_conflict" || error.domainCode === "integrity";
}

/**
 * Helper to check if an error indicates a permission/authentication issue.
 */
export function isPermissionError(error: NutritionMutationError): boolean {
  return error.domainCode === "permission-denied" || error.domainCode === "unauthenticated";
}

/**
 * Helper to check if an error indicates a validation failure.
 */
export function isValidationError(error: NutritionMutationError): boolean {
  return error.domainCode === "validation" || error.domainCode === "invalid_timezone";
}

/**
 * Helper to check if an error is a transport/network error.
 */
export function isTransportError(error: NutritionMutationError): boolean {
  return TRANSPORT_RETRYABLE.has(error.firebaseCode);
}
