/**
 * K9 Ops Web — Health Web v1 / WEB-01B.7
 * CANCEL eligibility matrix (capability x read state), plus the four-operation
 * exclusivity guarantee and the post-cancel read-model proof.
 *
 * CANCEL ends the active plan without deleting it. Like EDIT and REPLACE it needs
 * a canonical active plan, because the plan's id + revision are what travel as
 * `planId` + `expectedRevision`. Kept pure so every cell is asserted without
 * rendering.
 */

import { describe, expect, it } from "vitest";

import { consolidateActivePlan } from "../data/nutrition-plan-service";
import {
  canOfferNutritionCancel,
  canOfferNutritionCreate,
  canOfferNutritionEdit,
  canOfferNutritionReplace,
  resolveNutritionView,
} from "../presentation/nutrition-read-state-view";
import type { NutritionPlanState } from "../types";

function stateFor(partial: Partial<NutritionPlanState>): NutritionPlanState {
  return {
    status: "empty",
    dogId: "dog-1",
    generation: 1,
    activePlan: null,
    plans: [],
    legacyPlan: null,
    error: null,
    integrityConflict: null,
    parsingErrors: [],
    ...partial,
  } as NutritionPlanState;
}

const canonicalPlan = { id: "plan-1", dogId: "dog-1", revision: 3 } as never;
const legacyPlan = { id: "leg-1", dogId: "dog-1", legacySource: "legacy_db" } as never;

/** [label, state, offers CANCEL when manage=true] */
const matrix: Array<[string, NutritionPlanState, boolean]> = [
  ["loading", stateFor({ status: "loading" }), false],
  ["error", stateFor({ status: "error", reason: "firestore-read-error" }), false],
  ["empty", stateFor({ status: "empty", error: null }), false],
  ["empty with non-null error", stateFor({ status: "empty", error: "dogId inválido" }), false],
  ["conflict", stateFor({ status: "conflict" }), false],
  ["degraded", stateFor({ status: "degraded", activePlan: canonicalPlan }), false],
  ["legacy", stateFor({ status: "legacy", activePlan: legacyPlan, legacyPlan }), false],
  ["canonical active", stateFor({ status: "canonical", activePlan: canonicalPlan }), true],
];

describe("WEB-01B.7 — CANCEL eligibility with manage capability", () => {
  for (const [label, state, expected] of matrix) {
    it(`${label} -> ${expected ? "offers" : "refuses"} CANCEL`, () => {
      const decision = resolveNutritionView(state);
      expect(canOfferNutritionCancel(decision, true)).toBe(expected);
    });
  }
});

describe("WEB-01B.7 — CANCEL requires the management capability", () => {
  for (const [label, state] of matrix) {
    it(`${label} -> refuses CANCEL without manage`, () => {
      const decision = resolveNutritionView(state);
      expect(canOfferNutritionCancel(decision, false)).toBe(false);
    });
  }

  it("refuses CANCEL on a canonical plan when the grant is absent", () => {
    const decision = resolveNutritionView(
      stateFor({ status: "canonical", activePlan: canonicalPlan }),
    );
    expect(canOfferNutritionCancel(decision, true)).toBe(true);
    expect(canOfferNutritionCancel(decision, false)).toBe(false);
  });
});

describe("WEB-01B.7 — four-operation exclusivity", () => {
  it("CREATE never coexists with any lifecycle action", () => {
    for (const [, state] of matrix) {
      const decision = resolveNutritionView(state);
      const create = canOfferNutritionCreate(decision, true);
      const lifecycle =
        canOfferNutritionEdit(decision, true) ||
        canOfferNutritionReplace(decision, true) ||
        canOfferNutritionCancel(decision, true);
      expect(create && lifecycle).toBe(false);
    }
  });

  it("the three lifecycle actions agree on every read state", () => {
    // They answer different questions (patch / supersede / end) but all require a
    // canonical active plan, so today they must never disagree.
    for (const [label, state] of matrix) {
      const decision = resolveNutritionView(state);
      const edit = canOfferNutritionEdit(decision, true);
      const replace = canOfferNutritionReplace(decision, true);
      const cancel = canOfferNutritionCancel(decision, true);
      expect({ label, edit, replace }).toEqual({ label, edit: cancel, replace: cancel });
    }
  });

  it("canonical active is the only state offering CANCEL", () => {
    const offering = matrix.filter(([, state]) =>
      canOfferNutritionCancel(resolveNutritionView(state), true),
    );
    expect(offering).toHaveLength(1);
    expect(offering[0][0]).toBe("canonical active");
  });
});

/**
 * WEB-01B.7 §29 — what does the read model actually produce after a cancel?
 *
 * This is proven rather than assumed, because the panel's behaviour after
 * reconciliation depends entirely on it. `consolidateActivePlan` filters canonical
 * plans by `status === "active"` (nutrition-plan-service 458), so a cancelled plan
 * is not active, and with no other active plan and no legacy documents the cascade
 * falls through to `empty` with `error: null`.
 *
 * That is what makes CREATE reachable again after a cancellation — the reader
 * authorizes it, not the mutation.
 */
describe("WEB-01B.7 — post-cancel read model", () => {
  const cancelledPlan = {
    id: "plan-1",
    dogId: "dog-1",
    status: "cancelled",
    revision: 5,
    foodType: "Ração",
    amountGramsPerDay: 500,
    mealsPerDay: 2,
    mealSchedule: [],
    validFrom: new Date("2026-08-01T00:00:00.000Z"),
    timezone: "America/Sao_Paulo",
    recordedBy: { uid: "u1", name: "Vet", internalRole: "Vet" },
    schemaVersion: 1,
    supplements: [],
  } as never;

  function consolidateWith(plans: unknown[]) {
    return consolidateActivePlan({
      dogId: "dog-1",
      canonicalPlans: plans as never,
      legacyPrimary: [],
      legacyFallback: [],
      canonicalError: null,
      legacyPrimaryError: null,
      legacyFallbackError: null,
      parsingErrors: [],
    });
  }

  it("a cancelled plan with no other active plan yields empty, not canonical", () => {
    const state = consolidateWith([cancelledPlan]);
    expect(state.status).toBe("empty");
    expect(state.error).toBeNull();
    expect(state.activePlan).toBeNull();
  });

  it("the cancelled plan is still retained in history", () => {
    // Cancel is not a delete: the document must remain enumerable.
    const state = consolidateWith([cancelledPlan]);
    expect(state.plans).toHaveLength(1);
    expect((state.plans[0] as { id: string }).id).toBe("plan-1");
    expect((state.plans[0] as { status: string }).status).toBe("cancelled");
  });

  it("that empty state authorizes CREATE again, with manage", () => {
    const decision = resolveNutritionView(consolidateWith([cancelledPlan]));
    expect(decision.kind).toBe("empty");
    expect(canOfferNutritionCreate(decision, true)).toBe(true);
    // And no lifecycle action, because nothing is active any more.
    expect(canOfferNutritionEdit(decision, true)).toBe(false);
    expect(canOfferNutritionReplace(decision, true)).toBe(false);
    expect(canOfferNutritionCancel(decision, true)).toBe(false);
  });

  it("still refuses CREATE after a cancel when the grant is absent", () => {
    const decision = resolveNutritionView(consolidateWith([cancelledPlan]));
    expect(canOfferNutritionCreate(decision, false)).toBe(false);
  });

  it("a cancelled plan alongside a NEW active plan stays canonical", () => {
    // The natural sequence is cancel-then-create; if a successor already exists,
    // the reader reports it and the lifecycle actions belong to the new plan.
    const successor = { ...(cancelledPlan as object), id: "plan-2", status: "active", revision: 1 };
    const state = consolidateWith([cancelledPlan, successor]);
    expect(state.status).toBe("canonical");
    expect((state.activePlan as { id: string }).id).toBe("plan-2");

    const decision = resolveNutritionView(state);
    expect(canOfferNutritionCancel(decision, true)).toBe(true);
    expect(canOfferNutritionCreate(decision, true)).toBe(false);
  });
});
