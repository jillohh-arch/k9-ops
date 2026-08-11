import type {
  FirebaseFunctionsErrorCode,
  NutritionMutationDomainCode,
  NutritionMutationError,
} from "./nutrition-mutation-error-types";

const DOMAIN_NON_RETRYABLE: ReadonlySet<NutritionMutationDomainCode> = new Set([
  "validation",
  "invalid_timezone",
  "active-plan-conflict",
  "revision-conflict",
  "integrity-conflict",
  "idempotency-conflict",
  "idempotency_conflict",
  "receipt-integrity",
  "legacy-receipt-replay-unsupported",
  "retroactive-plan-conflict",
  "nutrition_plan_conflict",
  "integrity",
  "plan-not-found",
  "already-cancelled",
  "invalid-lifecycle",
  "internal-integrity-error",
  "invalid-validity-window",
  "permission-denied",
  "unauthenticated",
  "not-found",
  "internal",
]);

const TRANSPORT_RETRYABLE: ReadonlySet<FirebaseFunctionsErrorCode> = new Set([
  "unavailable",
  "deadline-exceeded",
]);

const TRANSPORT_NON_RETRYABLE: ReadonlySet<FirebaseFunctionsErrorCode> = new Set([
  "permission-denied",
  "unauthenticated",
  "not-found",
  "invalid-argument",
  "failed-precondition",
  "already-exists",
]);

const SAFE_DOMAIN_MESSAGES: Partial<
  Record<NutritionMutationDomainCode, string>
> = {
  "plan-not-found":
    "O plano nutricional não foi encontrado. Atualize os dados e tente novamente.",
  "already-cancelled": "Este plano nutricional já foi cancelado.",
  "invalid-lifecycle":
    "O plano nutricional não está ativo. Atualize os dados antes de continuar.",
  "internal-integrity-error":
    "Não foi possível concluir a operação com segurança. Tente novamente mais tarde.",
  "invalid-validity-window":
    "A vigência informada não é válida para esta operação.",
  internal:
    "Não foi possível concluir a operação. Tente novamente mais tarde.",
};

export function mapDomainCode(
  code: string,
): NutritionMutationDomainCode | undefined {
  const normalized = code.toLowerCase().trim();

  switch (normalized) {
    case "validation":
    case "invalid_timezone":
    case "active-plan-conflict":
    case "revision-conflict":
    case "integrity-conflict":
    case "idempotency-conflict":
    case "receipt-integrity":
    case "legacy-receipt-replay-unsupported":
    case "retroactive-plan-conflict":
    case "nutrition_plan_conflict":
    case "integrity":
    case "plan-not-found":
    case "already-cancelled":
    case "invalid-lifecycle":
    case "internal-integrity-error":
    case "invalid-validity-window":
    case "permission-denied":
    case "unauthenticated":
    case "not-found":
    case "internal":
      return normalized as NutritionMutationDomainCode;

    case "idempotency_conflict":
      return "idempotency-conflict";

    default:
      return undefined;
  }
}

export function isDomainCodeRetryable(
  code: NutritionMutationDomainCode,
): boolean {
  return !DOMAIN_NON_RETRYABLE.has(code);
}

export function isTransportCodeRetryable(
  code: FirebaseFunctionsErrorCode,
): boolean {
  if (TRANSPORT_RETRYABLE.has(code)) return true;
  if (TRANSPORT_NON_RETRYABLE.has(code)) return false;
  return false;
}

function publicDetails(
  domainCode: NutritionMutationDomainCode | undefined,
  backendDetails: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!backendDetails) return undefined;
  if (domainCode === "internal-integrity-error" || domainCode === "internal") {
    return { code: domainCode };
  }
  return backendDetails;
}

export function normalizeNutritionMutationError(
  error: unknown,
  defaultMessage = "Erro desconhecido na mutação de plano nutricional",
): NutritionMutationError {
  const base: NutritionMutationError = {
    firebaseCode: "unknown",
    message: defaultMessage,
    retryable: false,
    details: {},
  };

  if (error == null) return base;

  let firebaseCode: FirebaseFunctionsErrorCode = "unknown";
  let backendDetails: Record<string, unknown> | undefined;

  if (error instanceof Error) {
    const errorWithCode = error as unknown as Record<string, unknown>;
    if (typeof errorWithCode.code === "string") {
      const rawCode = errorWithCode.code;
      firebaseCode = (rawCode.startsWith("functions/")
        ? rawCode.slice("functions/".length)
        : rawCode) as FirebaseFunctionsErrorCode;
    }

    if (
      errorWithCode.details &&
      typeof errorWithCode.details === "object" &&
      !Array.isArray(errorWithCode.details)
    ) {
      backendDetails = errorWithCode.details as Record<string, unknown>;
    }
  }

  const detailCode = backendDetails?.code;
  const domainCode =
    typeof detailCode === "string" && detailCode.length > 0
      ? mapDomainCode(detailCode)
      : undefined;
  const retryable = domainCode
    ? isDomainCodeRetryable(domainCode)
    : isTransportCodeRetryable(firebaseCode);

  let message = defaultMessage;
  if (domainCode && SAFE_DOMAIN_MESSAGES[domainCode]) {
    message = SAFE_DOMAIN_MESSAGES[domainCode]!;
  } else if (
    typeof backendDetails?.message === "string" &&
    backendDetails.message.length > 0
  ) {
    message = backendDetails.message;
  } else if (
    error instanceof Error &&
    error.message.length > 0 &&
    error.message !== "Error"
  ) {
    message = error.message;
  }

  return {
    firebaseCode,
    domainCode,
    message,
    retryable,
    details: publicDetails(domainCode, backendDetails),
  };
}

export function isNutritionPlanConflictError(
  error: NutritionMutationError,
): boolean {
  return (
    error.domainCode === "active-plan-conflict" ||
    error.domainCode === "revision-conflict" ||
    error.domainCode === "integrity-conflict" ||
    error.domainCode === "idempotency-conflict" ||
    error.domainCode === "idempotency_conflict" ||
    error.domainCode === "receipt-integrity" ||
    error.domainCode === "legacy-receipt-replay-unsupported" ||
    error.domainCode === "retroactive-plan-conflict" ||
    error.domainCode === "nutrition_plan_conflict" ||
    error.domainCode === "integrity" ||
    error.domainCode === "already-cancelled" ||
    error.domainCode === "invalid-lifecycle"
  );
}

export function isPermissionError(error: NutritionMutationError): boolean {
  return (
    error.domainCode === "permission-denied" ||
    error.domainCode === "unauthenticated"
  );
}

export function isValidationError(error: NutritionMutationError): boolean {
  return (
    error.domainCode === "validation" ||
    error.domainCode === "invalid_timezone" ||
    error.domainCode === "invalid-validity-window"
  );
}

export function isTransportError(error: NutritionMutationError): boolean {
  return TRANSPORT_RETRYABLE.has(error.firebaseCode);
}
