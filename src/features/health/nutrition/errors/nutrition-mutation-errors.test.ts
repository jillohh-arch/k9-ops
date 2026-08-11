import { describe, expect, it } from "vitest";

import {
  mapDomainCode,
  normalizeNutritionMutationError,
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
