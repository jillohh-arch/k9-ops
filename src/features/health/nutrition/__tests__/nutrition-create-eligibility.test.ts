/**
 * K9 Ops Web — Health Web v1 / WEB-01B.4
 * CREATE eligibility matrix (capability x read state).
 *
 * `health.manage_nutrition_plan` is necessary but not sufficient. This is the
 * executable form of the B.4 decision matrix, kept at the pure-function level so
 * every cell is asserted without rendering.
 *
 * The cell that matters most: canonical + manage=true must still refuse CREATE,
 * because replacing an active plan is REPLACE (B.6). A manager must never be
 * offered "create another plan" for a K9 that already has one.
 */

import { describe, expect, it } from "vitest";

import type { NutritionPlanState } from "../types";
import {
  canOfferNutritionCreate,
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

const canonicalPlan = { id: "plan-1", dogId: "dog-1", revision: 1 } as never;
const legacyPlan = { id: "leg-1", dogId: "dog-1", legacySource: "legacy_db" } as never;

/**
 * Each row is [label, state, expected offer when manage=true].
 * With manage=false every row must be false — asserted separately below.
 */
const matrix: Array<[string, NutritionPlanState, boolean]> = [
  ["loading", stateFor({ status: "loading" }), false],
  ["error", stateFor({ status: "error", reason: "firestore-read-error" }), false],
  ["conflict", stateFor({ status: "conflict" }), false],
  ["degraded", stateFor({ status: "degraded", activePlan: canonicalPlan }), false],
  ["canonical active", stateFor({ status: "canonical", activePlan: canonicalPlan }), false],
  [
    "legacy",
    stateFor({ status: "legacy", activePlan: legacyPlan, legacyPlan }),
    false,
  ],
  ["empty (error === null)", stateFor({ status: "empty", error: null }), true],
  // Inherited ambiguous contract: empty + non-null error resolves to ERROR, so
  // CREATE must not be offered against an unknown state.
  ["empty with non-null error", stateFor({ status: "empty", error: "dogId inválido" }), false],
];

describe("WEB-01B.4 — CREATE eligibility with manage capability", () => {
  for (const [label, state, expected] of matrix) {
    it(`${label} -> ${expected ? "offers" : "refuses"} CREATE`, () => {
      const decision = resolveNutritionView(state);
      expect(canOfferNutritionCreate(decision, true)).toBe(expected);
    });
  }
});

describe("WEB-01B.4 — CREATE eligibility without manage capability", () => {
  for (const [label, state] of matrix) {
    it(`${label} -> refuses CREATE`, () => {
      const decision = resolveNutritionView(state);
      expect(canOfferNutritionCreate(decision, false)).toBe(false);
    });
  }
});

describe("WEB-01B.4 — structural guarantees", () => {
  it("canonical active never offers CREATE, since that would be REPLACE", () => {
    const decision = resolveNutritionView(
      stateFor({ status: "canonical", activePlan: canonicalPlan }),
    );
    expect(decision.kind).toBe("canonical");
    expect(canOfferNutritionCreate(decision, true)).toBe(false);
  });

  it("capability alone is never sufficient", () => {
    const offeringStates = matrix.filter(([, , expected]) => expected);
    // Exactly one state in the whole matrix may offer CREATE.
    expect(offeringStates).toHaveLength(1);
    expect(offeringStates[0][0]).toBe("empty (error === null)");
  });

  it("read state alone is never sufficient", () => {
    const decision = resolveNutritionView(stateFor({ status: "empty", error: null }));
    expect(decision.kind).toBe("empty");
    expect(canOfferNutritionCreate(decision, false)).toBe(false);
  });
});
