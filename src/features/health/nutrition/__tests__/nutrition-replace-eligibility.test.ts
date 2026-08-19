/**
 * K9 Ops Web — Health Web v1 / WEB-01B.6
 * REPLACE eligibility matrix (capability x read state), plus the full
 * CREATE / EDIT / REPLACE exclusivity guarantee.
 *
 * Structural replacement requires a canonical active plan AND an explicit
 * management grant. Kept as a pure function so every cell is asserted without
 * rendering.
 *
 * The cell that matters most: `legacy` + manage=true must refuse. A legacy
 * prescription has no canonical planId/revision pair, so it cannot populate
 * `expectedActivePlanId`/`expectedActiveRevision` — a REPLACE offered there would
 * either send no expectation pair (racing active-plan-conflict) or a fabricated
 * one.
 */

import { describe, expect, it } from "vitest";

import type { NutritionPlanState } from "../types";
import {
  canOfferNutritionCreate,
  canOfferNutritionEdit,
  canOfferNutritionReplace,
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

/** [label, state, offers REPLACE when manage=true] */
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

describe("WEB-01B.6 — REPLACE eligibility with manage capability", () => {
  for (const [label, state, expected] of matrix) {
    it(`${label} -> ${expected ? "offers" : "refuses"} REPLACE`, () => {
      const decision = resolveNutritionView(state);
      expect(canOfferNutritionReplace(decision, true)).toBe(expected);
    });
  }
});

describe("WEB-01B.6 — REPLACE eligibility without manage capability", () => {
  for (const [label, state] of matrix) {
    it(`${label} -> refuses REPLACE`, () => {
      const decision = resolveNutritionView(state);
      expect(canOfferNutritionReplace(decision, false)).toBe(false);
    });
  }
});

describe("WEB-01B.6 — structural guarantees", () => {
  it("exactly one state offers REPLACE", () => {
    const offering = matrix.filter(([, , expected]) => expected);
    expect(offering).toHaveLength(1);
    expect(offering[0][0]).toBe("canonical active");
  });

  it("capability alone is never sufficient", () => {
    const decision = resolveNutritionView(
      stateFor({ status: "canonical", activePlan: canonicalPlan }),
    );
    expect(canOfferNutritionReplace(decision, false)).toBe(false);
  });

  it("read state alone is never sufficient", () => {
    const decision = resolveNutritionView(
      stateFor({ status: "canonical", activePlan: canonicalPlan }),
    );
    expect(decision.kind).toBe("canonical");
    expect(canOfferNutritionReplace(decision, false)).toBe(false);
  });

  it("legacy refuses REPLACE: no canonical planId/revision to expect against", () => {
    const decision = resolveNutritionView(
      stateFor({ status: "legacy", activePlan: legacyPlan, legacyPlan }),
    );
    expect(decision.kind).toBe("legacy");
    expect(canOfferNutritionReplace(decision, true)).toBe(false);
  });

  it("degraded refuses REPLACE: a partially parsed revision is not a trustworthy expectation", () => {
    const decision = resolveNutritionView(
      stateFor({ status: "degraded", activePlan: canonicalPlan }),
    );
    expect(decision.kind).toBe("degraded");
    expect(canOfferNutritionReplace(decision, true)).toBe(false);
  });

  it("conflict refuses REPLACE: replacing would silently pick a winner", () => {
    const decision = resolveNutritionView(stateFor({ status: "conflict" }));
    expect(decision.kind).toBe("conflict");
    expect(canOfferNutritionReplace(decision, true)).toBe(false);
  });

  it("empty refuses REPLACE: there is nothing to supersede — that state offers CREATE", () => {
    const decision = resolveNutritionView(stateFor({ status: "empty", error: null }));
    expect(canOfferNutritionReplace(decision, true)).toBe(false);
    expect(canOfferNutritionCreate(decision, true)).toBe(true);
  });
});

/**
 * §11 — the three write affordances across every read state.
 *
 * CREATE needs proven absence; EDIT and REPLACE need a proven active plan. No
 * state may offer CREATE alongside either of the others, or the operator could
 * author a second plan for a K9 that already has one.
 */
describe("WEB-01B.6 — CREATE / EDIT / REPLACE exclusivity", () => {
  for (const [label, state] of matrix) {
    it(`${label} never offers CREATE together with EDIT or REPLACE`, () => {
      const decision = resolveNutritionView(state);
      const create = canOfferNutritionCreate(decision, true);
      const edit = canOfferNutritionEdit(decision, true);
      const replace = canOfferNutritionReplace(decision, true);

      expect(create && edit, `${label} offered CREATE and EDIT`).toBe(false);
      expect(create && replace, `${label} offered CREATE and REPLACE`).toBe(false);
    });
  }

  it("canonical active offers EDIT and REPLACE together, and never CREATE", () => {
    const decision = resolveNutritionView(
      stateFor({ status: "canonical", activePlan: canonicalPlan }),
    );
    expect(canOfferNutritionEdit(decision, true)).toBe(true);
    expect(canOfferNutritionReplace(decision, true)).toBe(true);
    expect(canOfferNutritionCreate(decision, true)).toBe(false);
  });

  it("empty offers CREATE alone", () => {
    const decision = resolveNutritionView(stateFor({ status: "empty", error: null }));
    expect(canOfferNutritionCreate(decision, true)).toBe(true);
    expect(canOfferNutritionEdit(decision, true)).toBe(false);
    expect(canOfferNutritionReplace(decision, true)).toBe(false);
  });

  it("every technical state offers none of the three", () => {
    for (const label of ["loading", "error", "conflict", "degraded"]) {
      const [, state] = matrix.find(([rowLabel]) => rowLabel === label)!;
      const decision = resolveNutritionView(state);
      expect(canOfferNutritionCreate(decision, true), label).toBe(false);
      expect(canOfferNutritionEdit(decision, true), label).toBe(false);
      expect(canOfferNutritionReplace(decision, true), label).toBe(false);
    }
  });

  it("EDIT and REPLACE agree on eligibility across the whole matrix", () => {
    // They answer different questions (patch a revision vs supersede a plan) but
    // both require a canonical active plan today. If one is ever relaxed, this
    // pins that the change was deliberate.
    for (const [label, state] of matrix) {
      const decision = resolveNutritionView(state);
      expect(
        canOfferNutritionReplace(decision, true),
        `${label} diverged from EDIT`,
      ).toBe(canOfferNutritionEdit(decision, true));
    }
  });
});
