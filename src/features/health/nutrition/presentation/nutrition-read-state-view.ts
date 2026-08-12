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

/**
 * WEB-01B.4 — CREATE eligibility.
 *
 * `health.manage_nutrition_plan` is necessary but NOT sufficient: the read state
 * must also prove the K9 is safely writable. Kept as a pure function so the
 * capability x state matrix is directly unit-testable, outside the render tree.
 *
 * CREATE is offered ONLY on proven absence (`empty`, which the resolver already
 * guarantees means error === null). Every other state is refused:
 *
 * - canonical  → a structural change to an active plan is REPLACE (B.6), never a
 *                second CREATE. A manager must not get "create another plan".
 * - legacy     → the legacy/canonical coexistence contract is not proven from
 *                this repo, so offering it could race active-plan-conflict.
 *                Deferred as an architectural decision.
 * - degraded   → creating a plan is not a remedy for an integrity problem.
 * - conflict   → same, fail closed.
 * - error      → the state is unknown; never write against an unknown state.
 * - loading    → nothing is proven yet.
 */
export function canOfferNutritionCreate(
  decision: NutritionViewDecision,
  canManage: boolean,
): boolean {
  if (!canManage) return false;
  return decision.kind === "empty";
}

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
