import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NutritionPlanReplaceDialog,
  REPLACE_ATOMIC_CONTRACT_AVAILABLE,
} from "../components/nutrition-plan-replace-dialog";
import type { NutritionPlan } from "../types";

const mutationMocks = vi.hoisted(() => ({
  prepareCreate: vi.fn(),
  executeCreate: vi.fn(),
  retryCreate: vi.fn(),
  resetCreate: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({ functions: {} }));
vi.mock("../hooks/use-nutrition-plan-mutations", () => ({
  useNutritionPlanMutations: () => ({
    createState: {
      status: "idle",
      intent: null,
      result: null,
      error: null,
    },
    prepareCreate: mutationMocks.prepareCreate,
    executeCreate: mutationMocks.executeCreate,
    retryCreate: mutationMocks.retryCreate,
    resetCreate: mutationMocks.resetCreate,
  }),
}));

const activePlan: NutritionPlan = {
  id: "plan-active",
  dogId: "dog-a",
  foodType: "Ração operacional",
  amountGramsPerDay: 600,
  mealsPerDay: 2,
  mealSchedule: [
    {
      id: "slot-morning",
      period: "morning",
      scheduledTime: "07:00",
      targetGrams: 300,
    },
    {
      id: "slot-night",
      period: "night",
      scheduledTime: "19:00",
      targetGrams: 300,
    },
  ],
  supplements: [],
  validFrom: new Date("2026-07-01T12:00:00.000Z"),
  timezone: "America/Sao_Paulo",
  hydrationMl: 1500,
  specialInstructions: "Sintético",
  recordedBy: {
    uid: "synthetic-user",
    name: "Operador Sintético",
    internalRole: "handler",
  },
  status: "active",
  schemaVersion: 1,
  revision: 3,
};

describe("NutritionPlanReplaceDialog data-integrity remediation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows productive confirmation when the atomic backend contract is available", () => {
    expect(REPLACE_ATOMIC_CONTRACT_AVAILABLE).toBe(true);
    render(
      <NutritionPlanReplaceDialog
        open
        onClose={vi.fn()}
        plan={activePlan}
        dogName="Rex"
      />,
    );

  });

  it("blocks review when the active plan revision changes", () => {
    const view = render(
      <NutritionPlanReplaceDialog
        open
        onClose={vi.fn()}
        plan={activePlan}
        dogName="Rex"
      />,
    );

    view.rerender(
      <NutritionPlanReplaceDialog
        open
        onClose={vi.fn()}
        plan={{ ...activePlan, revision: 4 }}
        dogName="Rex"
      />,
    );

    expect(screen.getByTestId("replace-stale-form-warning")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revisar Substituição/i }))
      .toBeDisabled();
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
  });

  it("invalidates the dialog when a different K9 plan replaces the prop", () => {
    const view = render(
      <NutritionPlanReplaceDialog
        open
        onClose={vi.fn()}
        plan={activePlan}
        dogName="Rex"
      />,
    );

    view.rerender(
      <NutritionPlanReplaceDialog
        open
        onClose={vi.fn()}
        plan={{ ...activePlan, id: "plan-dog-b", dogId: "dog-b" }}
        dogName="Lua"
      />,
    );

    expect(screen.getByTestId("replace-stale-form-warning")).toBeInTheDocument();
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
  });
});
