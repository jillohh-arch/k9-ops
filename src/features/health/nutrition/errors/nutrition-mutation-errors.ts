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

/**
 * Domain codes whose rejection PROVES the snapshot the client used is obsolete.
 *
 * Derived from the backend transaction guards (canil-gcm @
 * feature/health-v1-foundation), not from severity or retryability:
 *
 * - `revision-conflict`   — `assertExpectedRevision` found `current !== expected`
 *                           (engine 1533-1539), so the revision on screen is
 *                           provably not the current one.
 * - `already-cancelled`   — the target is `status: "cancelled"` (engine 1524)
 *                           while the reader is still showing it as active.
 * - `invalid-lifecycle`   — the target is not `active` (engine 1521), same
 *                           contradiction by a different route.
 * - `plan-not-found`      — the document the reader named does not exist
 *                           (engine 1522).
 * - `active-plan-conflict`— CREATE found an active plan where the reader reported
 *                           none, or REPLACE found the expected plan is no longer
 *                           the active one (engine 1595, 1602, 1610-1619).
 *
 * Every one of these is the backend contradicting the screen. The mutation was
 * refused, so nothing was written — but continuing to act on that snapshot only
 * produces the same refusal again.
 */
const STALE_READER_AUTHORITY: ReadonlySet<NutritionMutationDomainCode> = new Set([
  "revision-conflict",
  "already-cancelled",
  "invalid-lifecycle",
  "plan-not-found",
  "active-plan-conflict",
]);

/**
 * True when a REJECTED mutation also proved the reader's snapshot is stale.
 *
 * This is a statement about READER AUTHORITY, not about mutation outcome. It sits
 * alongside two other conditions that must not be conflated:
 *
 *   confirmed success        — the write happened
 *   potentially committed    — `invalid-mutation-response`; the write MAY have
 *                              happened and we cannot tell
 *   stale reader authority   — the write definitely did NOT happen, but the state
 *                              the operator is looking at is already obsolete
 *
 * The last two converge on the same remedy (withhold actions until the realtime
 * reader reconciles) and must never share the same wording: telling an operator a
 * cancellation "may have completed" after the backend explicitly refused it would
 * be false.
 *
 * Deliberately narrow. It is NOT "every non-retryable error":
 *
 * - `permission-denied` / `unauthenticated` reject a possibly perfectly current
 *   snapshot; the auth gate never reads plan state (callables 290, 106-113).
 * - `idempotency-conflict` describes an operationId reused with a different
 *   payload (engine 1125). It says nothing about plan authority.
 * - `internal-integrity-error` describes a stored revision below 1 (engine 1515)
 *   — a backend integrity problem, with no successor snapshot implied.
 * - `validation` / `invalid_timezone` are refused before any state comparison.
 * - `invalid-mutation-response` belongs to the potentially-committed family and
 *   must not also be treated as a rejection; see `isPotentiallyCommittedOutcome`.
 *
 * Widening this set would freeze the UI after operations that left the screen
 * perfectly valid.
 */
export function requiresNutritionReaderReconciliation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const domainCode = (error as { domainCode?: unknown }).domainCode;
  if (typeof domainCode !== "string") return false;
  return STALE_READER_AUTHORITY.has(domainCode as NutritionMutationDomainCode);
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
