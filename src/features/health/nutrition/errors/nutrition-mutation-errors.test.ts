import { describe, expect, it } from "vitest";

import {
  mapDomainCode,
  normalizeNutritionMutationError,
  requiresNutritionReaderReconciliation,
} from "./nutrition-mutation-errors";
import type { NutritionMutationDomainCode } from "./nutrition-mutation-error-types";

function callableError(
  domainCode: string,
  message = "Backend message",
  firebaseCode = "functions/failed-precondition",
) {
  return Object.assign(new Error("Transport message"), {
    code: firebaseCode,
    details: { code: domainCode, message },
  });
}

const BACKEND_DOMAIN_CODES: NutritionMutationDomainCode[] = [
  "validation",
  "invalid_timezone",
  "active-plan-conflict",
  "revision-conflict",
  "integrity-conflict",
  "idempotency-conflict",
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
];

describe("Nutrition mutation domain error contract", () => {
  it.each(BACKEND_DOMAIN_CODES)("recognizes and preserves %s", (code) => {
    expect(mapDomainCode(code)).toBe(code);

    const normalized = normalizeNutritionMutationError(callableError(code));

    expect(normalized.firebaseCode).toBe("failed-precondition");
    expect(normalized.domainCode).toBe(code);
    expect(normalized.retryable).toBe(false);
  });

  it.each([
    "plan-not-found",
    "already-cancelled",
    "invalid-lifecycle",
    "internal-integrity-error",
    "invalid-validity-window",
  ] as const)("closes the WEB-01B.0 mismatch for %s", (code) => {
    const normalized = normalizeNutritionMutationError(callableError(code));
    expect(normalized.domainCode).toBe(code);
  });

  it("supports the Firebase callable transport prefix without turning it into a domain code", () => {
    const normalized = normalizeNutritionMutationError(
      Object.assign(new Error("Serviço indisponível"), {
        code: "functions/unavailable",
      }),
    );

    expect(normalized.firebaseCode).toBe("unavailable");
    expect(normalized.domainCode).toBeUndefined();
    expect(normalized.retryable).toBe(true);
  });

  it("keeps unknown domain codes out of the typed contract", () => {
    const normalized = normalizeNutritionMutationError(
      callableError("future-backend-code", "Mensagem futura"),
      "Fallback seguro",
    );

    expect(normalized.domainCode).toBeUndefined();
    expect(normalized.firebaseCode).toBe("failed-precondition");
    expect(normalized.retryable).toBe(false);
  });

  it("does not expose backend internals for internal-integrity-error", () => {
    const error = Object.assign(new Error("raw internal"), {
      code: "functions/internal",
      details: {
        code: "internal-integrity-error",
        message: "Sensitive collection/path/receipt detail",
        stack: "sensitive-stack",
      },
    });

    const normalized = normalizeNutritionMutationError(error);

    expect(normalized.domainCode).toBe("internal-integrity-error");
    expect(normalized.message).toBe(
      "Não foi possível concluir a operação com segurança. Tente novamente mais tarde.",
    );
    expect(normalized.message).not.toContain("Sensitive");
    expect(normalized.details).toEqual({ code: "internal-integrity-error" });
  });

  it("returns the existing safe fallback for a value without error metadata", () => {
    expect(normalizeNutritionMutationError(null, "Fallback seguro")).toEqual({
      firebaseCode: "unknown",
      message: "Fallback seguro",
      retryable: false,
      details: {},
    });
  });
});

/**
 * WEB-01B.7R — reader authority is a separate axis from mutation outcome.
 *
 * These codes all mean the mutation was REFUSED, so nothing was written. What
 * makes the class-B set different is that the refusal itself contradicts what the
 * screen is showing, so acting on that snapshot again can only fail the same way.
 *
 * The value of this predicate is being narrow. "Every non-retryable error" would
 * freeze the UI after refusals that left the screen perfectly valid.
 */
describe("requiresNutritionReaderReconciliation", () => {
  const CLASS_B: NutritionMutationDomainCode[] = [
    "revision-conflict",
    "already-cancelled",
    "invalid-lifecycle",
    "plan-not-found",
    "active-plan-conflict",
  ];

  const CLASS_A: NutritionMutationDomainCode[] = [
    "permission-denied",
    "unauthenticated",
    "idempotency-conflict",
    "internal-integrity-error",
    "validation",
    "invalid_timezone",
  ];

  it.each(CLASS_B)("treats %s as proof the snapshot is stale", (domainCode) => {
    const normalized = normalizeNutritionMutationError(callableError(domainCode));

    expect(normalized.domainCode).toBe(domainCode);
    expect(requiresNutritionReaderReconciliation(normalized)).toBe(true);
  });

  it.each(CLASS_A)("leaves %s as an ordinary rejection", (domainCode) => {
    const normalized = normalizeNutritionMutationError(callableError(domainCode));

    expect(requiresNutritionReaderReconciliation(normalized)).toBe(false);
  });

  it("does not claim staleness for a potentially-committed outcome", () => {
    // `invalid-mutation-response` is raised past the success gate by the mutation
    // service, so it is the potentially-committed case — a different family with
    // different copy. It must not also read as a rejection that proves staleness.
    expect(
      requiresNutritionReaderReconciliation({
        firebaseCode: "internal",
        message: "Falha ao cancelar plano nutricional",
        retryable: false,
        details: { code: "invalid-mutation-response" },
      }),
    ).toBe(false);
  });

  it("does not fire on a transport failure with no domain code", () => {
    const normalized = normalizeNutritionMutationError(
      Object.assign(new Error("offline"), { code: "functions/unavailable" }),
    );

    expect(normalized.domainCode).toBeUndefined();
    expect(normalized.retryable).toBe(true);
    expect(requiresNutritionReaderReconciliation(normalized)).toBe(false);
  });

  it("does not fire on an unknown error or missing details", () => {
    expect(requiresNutritionReaderReconciliation(null)).toBe(false);
    expect(requiresNutritionReaderReconciliation(undefined)).toBe(false);
    expect(
      requiresNutritionReaderReconciliation(normalizeNutritionMutationError(null)),
    ).toBe(false);
    expect(
      requiresNutritionReaderReconciliation({
        firebaseCode: "unknown",
        message: "sem detalhes",
        retryable: false,
      }),
    ).toBe(false);
  });

  it("is not merely a synonym for non-retryable", () => {
    // The distinction that matters: both are refused and neither is retryable,
    // but only one of them says the screen is out of date.
    const permission = normalizeNutritionMutationError(
      callableError("permission-denied"),
    );
    const revision = normalizeNutritionMutationError(callableError("revision-conflict"));

    expect(permission.retryable).toBe(false);
    expect(revision.retryable).toBe(false);
    expect(requiresNutritionReaderReconciliation(permission)).toBe(false);
    expect(requiresNutritionReaderReconciliation(revision)).toBe(true);
  });
});
