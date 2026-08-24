/**
 * K9 Ops Web — Health Web v1 / WEB-01B.5
 * EDIT eligibility matrix (capability x read state).
 *
 * Administrative UPDATE requires a canonical active plan AND an explicit
 * management grant. Kept as a pure function so every cell is asserted without
 * rendering.
 *
 * Also pins the relationship with B.4: CREATE needs proven absence, EDIT needs a
 * proven active plan, so no state may offer both.
 */

import { describe, expect, it } from "vitest";

import type { NutritionPlanState } from "../types";
import {
  canOfferNutritionCreate,
  canOfferNutritionEdit,
  resolveNutritionView,
} from "../presentation/nutrition-read-state-view";

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

/** [label, state, offers EDIT when manage=true] */
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

describe("WEB-01B.5 — EDIT eligibility with manage capability", () => {
  for (const [label, state, expected] of matrix) {
    it(`${label} -> ${expected ? "offers" : "refuses"} EDIT`, () => {
      const decision = resolveNutritionView(state);
      expect(canOfferNutritionEdit(decision, true)).toBe(expected);
    });
  }
});

describe("WEB-01B.5 — EDIT eligibility without manage capability", () => {
  for (const [label, state] of matrix) {
    it(`${label} -> refuses EDIT`, () => {
      const decision = resolveNutritionView(state);
      expect(canOfferNutritionEdit(decision, false)).toBe(false);
    });
  }
});

describe("WEB-01B.5 — structural guarantees", () => {
  it("exactly one state offers EDIT", () => {
    const offering = matrix.filter(([, , expected]) => expected);
    expect(offering).toHaveLength(1);
    expect(offering[0][0]).toBe("canonical active");
  });

  it("capability alone is never sufficient", () => {
    const decision = resolveNutritionView(
      stateFor({ status: "canonical", activePlan: canonicalPlan }),
    );
    expect(canOfferNutritionEdit(decision, false)).toBe(false);
  });

  it("no state ever offers both CREATE and EDIT", () => {
    for (const [label, state] of matrix) {
      const decision = resolveNutritionView(state);
      const create = canOfferNutritionCreate(decision, true);
      const edit = canOfferNutritionEdit(decision, true);
      expect(create && edit, `${label} offered both`).toBe(false);
    }
  });

  it("legacy refuses EDIT: a legacy prescription has no canonical revision", () => {
    const decision = resolveNutritionView(
      stateFor({ status: "legacy", activePlan: legacyPlan, legacyPlan }),
    );
    expect(decision.kind).toBe("legacy");
    expect(canOfferNutritionEdit(decision, true)).toBe(false);
  });

  it("degraded refuses EDIT: a partially parsed revision is not a trustworthy expectation", () => {
    const decision = resolveNutritionView(
      stateFor({ status: "degraded", activePlan: canonicalPlan }),
    );
    expect(decision.kind).toBe("degraded");
    expect(canOfferNutritionEdit(decision, true)).toBe(false);
  });
});
