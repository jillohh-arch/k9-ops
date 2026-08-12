/**
 * K9 Ops Web — Health Web v1 / WEB-01B.2
 * Pure mapping from the Nutrition read model to a presentation decision.
 *
 * Kept pure (no JSX, no hooks) so the state priority is testable in isolation
 * from rendering.
 *
 * MANDATORY PRIORITY — error outranks empty:
 *
 *   error > loading > conflict > degraded > canonical/legacy > empty
 *
 * The read model carries an inherited contract where an invalid dogId yields
 * `status: "empty"` with a NON-NULL `error`. Rendering an empty state there
 * would translate a failure into "no plan registered". The read model is NOT
 * changed for this (that would be a domain change); the ambiguity is resolved
 * here, in presentation, per WEB-01B.2 §15.
 *
 * Likewise WEB-01B.1R made legacy listener failures fail closed
 * (`status: "error"`, `reason: "firestore-read-error"`); this mapping must
 * surface that as an error, never as absence.
 */

import type { NutritionPlanState } from "../types";

export type NutritionViewKind =
  | "loading"
  | "error"
  | "conflict"
  | "degraded"
  | "canonical"
  | "legacy"
  | "empty";

export interface NutritionViewDecision {
  kind: NutritionViewKind;
  /** Operator-facing message. Never a raw backend/Firestore detail. */
  message?: string;
}

/** Operationally safe copy: no Firestore paths, collections or stack traces. */
const READ_FAILURE_MESSAGE =
  "Não foi possível concluir a leitura do plano alimentar. Nenhum estado foi presumido.";

export function resolveNutritionView(state: NutritionPlanState): NutritionViewDecision {
  // 1. Error has absolute priority, including the inherited `empty` + error case.
  if (state.status === "error" || state.error !== null) {
    return { kind: "error", message: READ_FAILURE_MESSAGE };
  }

  // 2. Loading: never show "no plan" while the sources are still resolving.
  if (state.status === "loading") {
    return { kind: "loading" };
  }

  // 3. Integrity conflict: no single active plan can be determined.
  if (state.status === "conflict") {
    return {
      kind: "conflict",
      message:
        "Há inconsistência de dados: não é possível determinar um único plano alimentar ativo para este K9.",
    };
  }

  // 4. Degraded: partially usable data, distinct from a total read failure.
  if (state.status === "degraded") {
    return {
      kind: "degraded",
      message:
        "Parte dos registros de nutrição não pôde ser interpretada. O conteúdo exibido pode estar incompleto.",
    };
  }

  if (state.status === "canonical") {
    return { kind: "canonical" };
  }

  if (state.status === "legacy") {
    return { kind: "legacy" };
  }

  // 5. Proven absence: empty AND error === null (guaranteed by the guard above).
  return { kind: "empty" };
}
