/**
 * K9 Ops Web — Health Web v1 / WEB-01B.6
 * Structural REPLACE flow through the rendered UI.
 *
 * Adapted from the pre-Foundation `nutrition-plan-replace-flow`, which rendered
 * `NutritionPlanManagement` with its own dog selector, `useEntities` and a
 * parallel access read. Those are dropped: the panel receives `dogId` as a prop
 * and resolves eligibility from capability x read state.
 *
 * The mock boundary here is the mutation hook, so the command construction and
 * the capability/state gating are observed at the real hook API. The same-turn
 * contract, operationId lifecycle and the post-success seam are proven
 * separately against the real hook in nutrition-replace-real-hook.test.tsx.
 *
 * The critical property: REPLACE must send an expectation pair frozen when the
 * dialog opened, never one read from the live plan. A silently re-pointed
 * expectation would apply a structural replacement to a revision the operator
 * never reviewed.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NutritionPlan, NutritionPlanState } from "../types";
import {
  buildNutritionPlanReplaceCommand,
  correlateSupersededPlan,
  normalizeSourceDocument,
  seedReplaceSlots,
  shouldShowNutritionReplaceStale,
  toDateInputValue,
} from "../presentation/nutrition-plan-replace-dialog";

vi.mock("firebase/app", () => ({ initializeApp: vi.fn(), getApps: () => [], getApp: vi.fn() }));
vi.mock("firebase/auth", () => ({ getAuth: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  doc: vi.fn(),
  getDoc: vi.fn(),
}));
vi.mock("firebase/storage", () => ({ getStorage: vi.fn() }));
vi.mock("@/lib/firebase/client", () => ({ db: {}, auth: {}, storage: {}, functions: {} }));

const mockCan = vi.fn();
vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can: mockCan }),
}));

const mockUseNutritionPlans = vi.fn();
vi.mock("../hooks/use-nutrition-plans", () => ({
  useNutritionPlans: (dogId: string) => mockUseNutritionPlans(dogId),
}));

const mutationMocks = vi.hoisted(() => ({
  prepareCreate: vi.fn(),
  executeCreate: vi.fn(),
  retryCreate: vi.fn(),
  resetCreate: vi.fn(),
  createState: { status: "idle" } as Record<string, unknown>,
  prepareUpdate: vi.fn(),
  executeUpdate: vi.fn(),
  retryUpdate: vi.fn(),
  resetUpdate: vi.fn(),
  updateState: { status: "idle" } as Record<string, unknown>,
  prepareCancel: vi.fn(),
  executeCancel: vi.fn(),
  retryCancel: vi.fn(),
  resetCancel: vi.fn(),
  cancelState: { status: "idle" } as Record<string, unknown>,
}));

vi.mock("../hooks/use-nutrition-plan-mutations", () => ({
  useNutritionPlanMutations: () => ({
    prepareCreate: mutationMocks.prepareCreate,
    executeCreate: mutationMocks.executeCreate,
    retryCreate: mutationMocks.retryCreate,
    resetCreate: mutationMocks.resetCreate,
    createState: mutationMocks.createState,
    prepareUpdate: mutationMocks.prepareUpdate,
    executeUpdate: mutationMocks.executeUpdate,
    retryUpdate: mutationMocks.retryUpdate,
    resetUpdate: mutationMocks.resetUpdate,
    updateState: mutationMocks.updateState,
    prepareCancel: mutationMocks.prepareCancel,
    executeCancel: mutationMocks.executeCancel,
    retryCancel: mutationMocks.retryCancel,
    resetCancel: mutationMocks.resetCancel,
    cancelState: mutationMocks.cancelState,
  }),
}));

const { NutritionPlanPanel } = await import("../presentation/nutrition-plan-panel");

function planAt(revision: number, overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    dogId: "dog-1",
    foodType: "Ração Premium",
    amountGramsPerDay: 500,
    mealsPerDay: 2,
    mealSchedule: [
      { id: "s1", period: "morning", scheduledTime: "08:00", targetGrams: 250 },
      { id: "s2", period: "evening", scheduledTime: "18:00", targetGrams: 250 },
    ],
    validFrom: new Date("2026-08-01T00:00:00.000Z"),
    timezone: "America/Sao_Paulo",
    recordedBy: { uid: "u1", name: "Vet", internalRole: "Vet" },
    status: "active",
    schemaVersion: 1,
    revision,
    supplements: [],
    specialInstructions: "Servir morno",
    ...overrides,
  };
}

function canonicalState(revision: number, overrides: Record<string, unknown> = {}) {
  const plan = planAt(revision, overrides);
  return {
    status: "canonical",
    dogId: "dog-1",
    generation: 1,
    activePlan: plan,
    plans: [plan],
    legacyPlan: null,
    error: null,
    integrityConflict: null,
    parsingErrors: [],
  } as unknown as NutritionPlanState;
}

function openReplace() {
  fireEvent.click(screen.getByTestId("nutrition-replace-plan-action"));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(true);
  mockUseNutritionPlans.mockReturnValue(canonicalState(3));
  mutationMocks.createState = { status: "idle" };
  mutationMocks.updateState = { status: "idle" };
  mutationMocks.cancelState = { status: "idle" };
  mutationMocks.executeCreate.mockResolvedValue({
    success: true,
    planId: "plan-2",
    status: "active",
    revision: 1,
    supersededPlanId: "plan-1",
    wasNoOp: false,
  });
});

describe("WEB-01B.6 — REPLACE affordance gating", () => {
  it("offers REPLACE on a canonical active plan with the manage grant", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
  });

  it("withholds REPLACE without the manage grant", () => {
    mockCan.mockReturnValue(false);
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
  });

  it("requires manage_nutrition_plan specifically, not a read capability", () => {
    mockCan.mockImplementation(
      (domain: string, action: string) =>
        domain === "health" && action !== "manage_nutrition_plan",
    );
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
  });

  it("offers EDIT and REPLACE side by side on the same card", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
  });

  it("offers no CANCEL affordance — that is B.7", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelar plano")).not.toBeInTheDocument();
  });

  it("withholds REPLACE on a legacy plan", () => {
    mockUseNutritionPlans.mockReturnValue({
      status: "legacy",
      dogId: "dog-1",
      generation: 1,
      activePlan: { id: "leg-1", dogId: "dog-1", legacySource: "legacy_db" },
      plans: [],
      legacyPlan: { id: "leg-1", dogId: "dog-1", legacySource: "legacy_db" },
      error: null,
      integrityConflict: null,
      parsingErrors: [],
    } as unknown as NutritionPlanState);
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
  });
});

describe("WEB-01B.6 — the frozen expectation pair", () => {
  it("sends the planId and revision that were displayed when the dialog opened", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.change(screen.getByLabelText("Tipo de alimento"), {
      target: { value: "Ração Hipoalergênica" },
    });
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareCreate).toHaveBeenCalledTimes(1));
    const [command] = mutationMocks.prepareCreate.mock.calls[0];
    expect(command.expectedActivePlanId).toBe("plan-1");
    expect(command.expectedActiveRevision).toBe(3);
  });

  it("displays the authority being replaced", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    expect(screen.getByTestId("replace-plan-expected-id")).toHaveTextContent("plan-1");
    expect(screen.getByTestId("replace-plan-expected-revision")).toHaveTextContent("3");
  });

  it("always sends BOTH halves of the pair, never a partial expectation", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareCreate).toHaveBeenCalledTimes(1));
    const [command] = mutationMocks.prepareCreate.mock.calls[0];
    expect(command.expectedActivePlanId).toBeTruthy();
    expect(typeof command.expectedActiveRevision).toBe("number");
    expect(Number.isInteger(command.expectedActiveRevision)).toBe(true);
  });
});

describe("WEB-01B.6 — stale before submit", () => {
  it("blocks submit when the reader advanced the revision underneath the form", () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();

    // Another operator changed the plan while this dialog was open.
    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("replace-plan-stale")).toBeInTheDocument();
    expect(screen.getByTestId("replace-plan-submit")).toBeDisabled();
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
  });

  it("does NOT silently re-point the expectations at the new revision", () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    // Still showing the frozen pair, not the live revision 4.
    expect(screen.getByTestId("replace-plan-expected-revision")).toHaveTextContent("3");
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
  });

  it("reaches no transport even if submit is forced while stale", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    fireEvent.submit(screen.getByTestId("replace-plan-submit").closest("form")!);

    await waitFor(() =>
      expect(screen.getByTestId("replace-plan-local-error")).toBeInTheDocument(),
    );
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
    expect(mutationMocks.executeCreate).not.toHaveBeenCalled();
  });
});

describe("WEB-01B.6 — structural payload", () => {
  it("pre-fills the form from the current plan", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    expect(screen.getByLabelText("Tipo de alimento")).toHaveValue("Ração Premium");
    expect(screen.getByLabelText("Fuso horário")).toHaveValue("America/Sao_Paulo");
    // The existing two-slot grid, with its totals.
    expect(screen.getByTestId("replace-plan-total")).toHaveTextContent("500");
  });

  it("sends the edited structure, deriving mealsPerDay and the daily total", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();

    fireEvent.change(screen.getByLabelText("Tipo de alimento"), {
      target: { value: "Ração Hipoalergênica" },
    });
    // Third meal: 600 g/day across 3 meals.
    fireEvent.click(screen.getByText("Adicionar refeição"));
    const gramInputs = screen.getAllByLabelText("Quantidade (g)");
    fireEvent.change(gramInputs[0], { target: { value: "200" } });
    fireEvent.change(gramInputs[1], { target: { value: "200" } });
    fireEvent.change(gramInputs[2], { target: { value: "200" } });

    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareCreate).toHaveBeenCalledTimes(1));
    const [command] = mutationMocks.prepareCreate.mock.calls[0];
    expect(command.planData.foodType).toBe("Ração Hipoalergênica");
    expect(command.planData.mealsPerDay).toBe(3);
    expect(command.planData.amountGramsPerDay).toBe(600);
    expect(command.planData.mealSchedule).toHaveLength(3);
  });

  it("carries administrative values onto the new plan rather than dropping them", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareCreate).toHaveBeenCalledTimes(1));
    const [command] = mutationMocks.prepareCreate.mock.calls[0];
    // REPLACE authors a whole new document, so an unchanged administrative value
    // must be stated explicitly — this is NOT patch semantics.
    expect(command.planData.specialInstructions).toBe("Servir morno");
  });

  it("refuses an empty food type", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.change(screen.getByLabelText("Tipo de alimento"), { target: { value: "  " } });
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("replace-plan-local-error")).toBeInTheDocument(),
    );
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
  });

  // Note: grams <= 0 and negative hydration cannot be driven through the rendered
  // form — those inputs carry `min` attributes, so native constraint validation
  // blocks submit before handleSubmit runs. Both guards are asserted directly
  // against the pure builder below.

  it("refuses an empty timezone", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.change(screen.getByLabelText("Fuso horário"), { target: { value: " " } });
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("replace-plan-local-error")).toBeInTheDocument(),
    );
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
  });

  it("§21 — an active plan whose validity already closed is still replaceable", async () => {
    // The reader only enforces validUntil > validFrom, never validUntil > now, so
    // this state is genuinely reachable: canonical, active, window already closed.
    mockUseNutritionPlans.mockReturnValue(
      canonicalState(3, { validUntil: new Date("2026-08-05T00:00:00.000Z") }),
    );
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();

    // The inherited date is offered, but it is editable and clearable.
    const validUntilInput = screen.getByLabelText("Término de vigência (opcional)");
    expect(validUntilInput).toHaveValue("2026-08-05");
    expect(validUntilInput).toBeEnabled();

    fireEvent.change(validUntilInput, { target: { value: "" } });
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareCreate).toHaveBeenCalledTimes(1));
    const [command] = mutationMocks.prepareCreate.mock.calls[0];
    expect(command.planData.validUntil).toBeNull();
  });

  it("§23 — states plainly when a source document will NOT be carried", () => {
    mockUseNutritionPlans.mockReturnValue(
      canonicalState(3, { sourceDocument: { description: "laudo sem id" } }),
    );
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();

    expect(
      screen.getByTestId("replace-plan-source-document-disposition").textContent ?? "",
    ).toMatch(/não será vinculado/i);
  });

  it("§22 — states how many supplements the new plan will carry", () => {
    mockUseNutritionPlans.mockReturnValue(
      canonicalState(3, {
        supplements: [
          { id: "sup-1", name: "Condroitina", dose: 500, unit: "mg", frequency: "daily" },
        ],
      }),
    );
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();

    expect(
      screen.getByTestId("replace-plan-supplements-disposition").textContent ?? "",
    ).toMatch(/1 mantido/i);
  });

  it("keeps the last meal row undeletable", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    const removeButtons = screen.getAllByLabelText("Remover refeição");
    fireEvent.click(removeButtons[0]);
    // Two slots -> one; the survivor cannot be removed.
    expect(screen.getAllByLabelText("Remover refeição")[0]).toBeDisabled();
  });
});

describe("WEB-01B.6 — zero CANCEL on the REPLACE path", () => {
  it("never touches the CANCEL track while replacing", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    expect(mutationMocks.prepareCancel).not.toHaveBeenCalled();
    expect(mutationMocks.executeCancel).not.toHaveBeenCalled();
    expect(mutationMocks.retryCancel).not.toHaveBeenCalled();
  });

  it("uses the CREATE track exactly once, and never the UPDATE track", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    expect(mutationMocks.prepareCreate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.prepareUpdate).not.toHaveBeenCalled();
    expect(mutationMocks.executeUpdate).not.toHaveBeenCalled();
  });
});

describe("WEB-01B.6 — busy and close paths", () => {
  // Note: double-submit is NOT asserted here. With the hook mocked, `createState`
  // never advances to "executing", so the dialog's `isBusy` guard cannot engage —
  // a mocked-hook test would prove nothing about it. It is asserted against the
  // real hook in nutrition-replace-real-hook.test.tsx (§45).

  it("refuses to close while the mutation is in flight", () => {
    mutationMocks.createState = { status: "executing", intent: { operationId: "op-1" } };
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();

    fireEvent.click(screen.getByTestId("replace-plan-close"));
    // Still mounted, and the hook was not reset underneath the in-flight call.
    expect(screen.getByTestId("replace-plan-close")).toBeInTheDocument();
    expect(mutationMocks.resetCreate).not.toHaveBeenCalled();
  });

  it("disables the structural fields while executing", () => {
    mutationMocks.createState = { status: "executing", intent: { operationId: "op-1" } };
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    expect(screen.getByLabelText("Tipo de alimento")).toBeDisabled();
    expect(screen.getByTestId("replace-plan-submit")).toBeDisabled();
  });

  it("withdraws the dialog when the manage capability is revoked", () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    expect(screen.getByTestId("replace-plan-submit")).toBeInTheDocument();

    mockCan.mockReturnValue(false);
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.queryByTestId("replace-plan-submit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
  });

  it("hides submit and keeps close available after success", () => {
    mutationMocks.createState = {
      status: "success",
      result: { planId: "plan-2", supersededPlanId: "plan-1", wasNoOp: false },
    };
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();

    expect(screen.getByTestId("replace-plan-success")).toBeInTheDocument();
    expect(screen.queryByTestId("replace-plan-submit")).not.toBeInTheDocument();
    expect(screen.getByTestId("replace-plan-close")).toBeEnabled();
  });
});

describe("WEB-01B.6 — post-success reconciliation latch", () => {
  it("withholds EDIT and REPLACE while the reader still shows the superseded plan", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    // Reader is still on plan-1 revision 3; the backend already superseded it.
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
    // The plan itself stays readable — no blank surface.
    expect(screen.getByTestId("nutrition-canonical-card")).toBeInTheDocument();
  });

  it("releases both actions once the reader reports the new plan", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();

    // Realtime reader catches up: plan-2 is now the active plan.
    mockUseNutritionPlans.mockReturnValue(
      canonicalState(1, { id: "plan-2", foodType: "Ração Hipoalergênica" }),
    );
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
  });

  it("does not fabricate the new plan while waiting for the reader", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    // The response said plan-2 / Ração Hipoalergênica, but the reader has not
    // confirmed it. The card must still show what the reader actually holds.
    expect(screen.getByText("Ração Premium")).toBeInTheDocument();
    expect(screen.queryByText("Ração Hipoalergênica")).not.toBeInTheDocument();
  });

  it("releases the latch if the reader leaves canonical entirely", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    mockUseNutritionPlans.mockReturnValue({
      status: "error",
      dogId: "dog-1",
      generation: 2,
      activePlan: null,
      plans: [],
      legacyPlan: null,
      error: "permission-denied",
      reason: "firestore-read-error",
      integrityConflict: null,
      parsingErrors: [],
    } as unknown as NutritionPlanState);
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    // Error surface, not a stale canonical card with hidden buttons.
    expect(screen.queryByTestId("nutrition-canonical-card")).not.toBeInTheDocument();
  });

  it("a latch from one K9 never suppresses actions for another", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();

    const other = canonicalState(2);
    (other as unknown as { dogId: string }).dogId = "dog-2";
    mockUseNutritionPlans.mockReturnValue(other);
    rerender(<NutritionPlanPanel dogId="dog-2" />);

    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
  });

  it("an idempotent replay also latches", async () => {
    mutationMocks.executeCreate.mockResolvedValue({
      success: true,
      planId: "plan-2",
      status: "active",
      revision: 1,
      supersededPlanId: "plan-1",
      wasNoOp: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
  });

  it("a failed REPLACE does NOT latch, so the operator can correct and retry", async () => {
    mutationMocks.executeCreate.mockRejectedValue({
      firebaseCode: "invalid-argument",
      domainCode: "validation",
      message: "Dados inválidos.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
  });

  it("a pending UPDATE also withholds REPLACE", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-edit-plan-action"));
    fireEvent.change(screen.getByLabelText("Instruções especiais"), {
      target: { value: "Nova instrução" },
    });
    mutationMocks.executeUpdate.mockResolvedValue({
      success: true,
      planId: "plan-1",
      status: "active",
      revision: 4,
      wasNoOp: false,
    });
    fireEvent.click(screen.getByTestId("edit-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    // The revision on screen is already superseded, so it cannot serve as
    // expectedActiveRevision for a replacement.
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
  });
});

/**
 * WEB-01B.6R — REPLACE after an unverifiable `success: true`. The sharpest case.
 *
 * The backend may have already superseded plan A and activated plan B while the
 * reader still shows A as active. In that window the screen is asserting
 * something false, and both EDIT and REPLACE would freeze an expectation pair
 * against a plan that is already dead.
 *
 * Note what the latch does NOT get here: `newPlanId`. The response is exactly
 * what we refused to trust, so its `planId` carries no authority. The reader
 * decides what replaced A.
 */
describe("WEB-01B.6R — REPLACE potentially-committed outcome", () => {
  const invalidMutationResponse = {
    firebaseCode: "internal",
    message: "Falha ao criar plano nutricional",
    retryable: false,
    details: { code: "invalid-mutation-response" },
  };

  it("withholds EDIT and REPLACE while the reader still shows the possibly-dead plan", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
    // Still readable: the operator sees the plan, just not actions against it.
    expect(screen.getByTestId("nutrition-canonical-card")).toBeInTheDocument();
  });

  it("does not start a second logical REPLACE", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    expect(mutationMocks.prepareCreate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.retryCreate).not.toHaveBeenCalled();
  });

  it("releases once the reader reports the successor plan", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();

    // The reader — not the rejected response — reports what actually replaced A.
    mockUseNutritionPlans.mockReturnValue(canonicalState(1, { id: "plan-2" }));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
  });

  it("never fabricates the successor before the reader confirms it", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    // plan-2 came back only in the payload we rejected. It must appear nowhere.
    expect(screen.queryByText(/plan-2/)).not.toBeInTheDocument();
    expect(screen.getByTestId("nutrition-canonical-card")).toBeInTheDocument();
  });

  it("engages the latch from a retry too", async () => {
    mutationMocks.createState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: {
        firebaseCode: "unavailable",
        message: "Serviço temporariamente indisponível.",
        retryable: true,
      },
    };
    mutationMocks.retryCreate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-retry"));

    await waitFor(() => expect(mutationMocks.retryCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
    expect(mutationMocks.retryCreate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
  });

  /*
   * The highest-risk resubmit of the three. Plan A may already be superseded and
   * plan B already active; a second submit here would mint a fresh operationId and
   * attempt a SECOND structural replacement against an expectation pair that is
   * very likely already dead. The panel latch cannot help — the card is behind
   * this dialog.
   */
  it("locks its own submit — a second click cannot start another REPLACE", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const submit = screen.getByTestId("replace-plan-submit");
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form")!);

    expect(mutationMocks.prepareCreate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.retryCreate).not.toHaveBeenCalled();
  });

  it("tells the operator the result is unconfirmed, not that it failed", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    const notice = screen.getByTestId("replace-plan-outcome-uncertain");
    expect(notice.textContent).toMatch(/não foi possível confirmar/i);
    // "Falha ao substituir" would imply A is still active — the most dangerous
    // thing to tell the operator here.
    expect(screen.queryByTestId("replace-plan-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("replace-plan-success")).not.toBeInTheDocument();
    expect(screen.queryByTestId("replace-plan-retry")).not.toBeInTheDocument();
  });

  it("does not leak the uncertain lock into a later legitimate REPLACE", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    // Reader reports the successor; a fresh REPLACE must be fully usable.
    mockUseNutritionPlans.mockReturnValue(canonicalState(1, { id: "plan-2" }));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    openReplace();

    expect(screen.getByTestId("replace-plan-submit")).not.toBeDisabled();
    expect(screen.queryByTestId("replace-plan-outcome-uncertain")).not.toBeInTheDocument();
  });

  it("an active-plan-conflict does NOT engage the latch", async () => {
    // The backend refused the replacement, so A is still the live authority.
    mutationMocks.executeCreate.mockRejectedValue({
      firebaseCode: "failed-precondition",
      domainCode: "active-plan-conflict",
      message: "O plano ativo não corresponde ao esperado.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
  });

  it("does not report a supersede correlation for a response it rejected", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);
    mutationMocks.createState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: invalidMutationResponse,
    };

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    // Correlation state describes an ACCEPTED response; this one was refused.
    expect(screen.queryByTestId("replace-plan-supersede-mismatch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("replace-plan-success")).not.toBeInTheDocument();
    // The uncertain surface replaces the ordinary error surface.
    expect(screen.getByTestId("replace-plan-outcome-uncertain")).toBeInTheDocument();
    expect(screen.queryByTestId("replace-plan-error")).not.toBeInTheDocument();
  });
});

// =============================================================================
// PURE HELPERS — no rendering, no mock sequencing (WEB-01B.5R discipline)
// =============================================================================

describe("WEB-01B.6 — shouldShowNutritionReplaceStale", () => {
  const base = {
    mutationStatus: "idle",
    planId: "plan-1",
    planRevision: 3,
    planStatus: "active",
    expectedActivePlanId: "plan-1",
    expectedActiveRevision: 3,
  };

  it("is not stale when the reader still matches the frozen pair", () => {
    expect(shouldShowNutritionReplaceStale(base)).toBe(false);
  });

  it("is stale when the revision advanced", () => {
    expect(shouldShowNutritionReplaceStale({ ...base, planRevision: 4 })).toBe(true);
  });

  it("is stale when the plan was swapped", () => {
    expect(shouldShowNutritionReplaceStale({ ...base, planId: "plan-2" })).toBe(true);
  });

  it("is stale when the plan stopped being active", () => {
    expect(shouldShowNutritionReplaceStale({ ...base, planStatus: "superseded" })).toBe(
      true,
    );
  });

  it("suppresses a false stale warning while our own mutation executes", () => {
    expect(
      shouldShowNutritionReplaceStale({
        ...base,
        planRevision: 4,
        mutationStatus: "executing",
      }),
    ).toBe(false);
  });

  it("suppresses a false stale warning in the success reconciliation window", () => {
    expect(
      shouldShowNutritionReplaceStale({
        ...base,
        planId: "plan-2",
        mutationStatus: "success",
      }),
    ).toBe(false);
  });

  it("still detects a real external change while merely prepared", () => {
    expect(
      shouldShowNutritionReplaceStale({
        ...base,
        planRevision: 4,
        mutationStatus: "ready",
      }),
    ).toBe(true);
  });
});

describe("WEB-01B.6 — correlateSupersededPlan", () => {
  it("confirms when the backend superseded the plan we expected", () => {
    expect(
      correlateSupersededPlan({
        expectedActivePlanId: "plan-1",
        supersededPlanId: "plan-1",
      }),
    ).toBe("confirmed");
  });

  it("flags a mismatch when a DIFFERENT plan was superseded", () => {
    // The source repo displayed this without ever comparing it, so a mismatch
    // would have been reported to the operator as a plain success.
    expect(
      correlateSupersededPlan({
        expectedActivePlanId: "plan-1",
        supersededPlanId: "plan-99",
      }),
    ).toBe("mismatch");
  });

  it("treats an absent supersededPlanId as unconfirmed, not as a mismatch", () => {
    // The field is optional in the contract; a response that omits it is legal.
    expect(
      correlateSupersededPlan({ expectedActivePlanId: "plan-1", supersededPlanId: null }),
    ).toBe("unconfirmed");
    expect(correlateSupersededPlan({ expectedActivePlanId: "plan-1" })).toBe(
      "unconfirmed",
    );
  });

  it("treats an empty-string supersededPlanId as unconfirmed", () => {
    expect(
      correlateSupersededPlan({ expectedActivePlanId: "plan-1", supersededPlanId: "  " }),
    ).toBe("unconfirmed");
  });
});

describe("WEB-01B.6 — buildNutritionPlanReplaceCommand", () => {
  const now = new Date("2026-08-12T12:00:00.000Z");

  const emptyPreserved = {
    specialInstructions: null,
    professional: null,
    sourceDocument: null,
    attachmentRefs: null,
    supplements: null,
  };

  function baseParams(overrides: Record<string, unknown> = {}) {
    return {
      dogId: "dog-1",
      expectedActivePlanId: "plan-1",
      expectedActiveRevision: 3,
      foodType: "Ração Hipoalergênica",
      timezone: "America/Sao_Paulo",
      hydrationMl: "",
      validUntil: "",
      slots: [
        { id: "s1", period: "morning" as const, scheduledTime: "07:00", targetGrams: "200" },
        { id: "s2", period: "afternoon" as const, scheduledTime: "13:00", targetGrams: "200" },
        { id: "s3", period: "evening" as const, scheduledTime: "19:00", targetGrams: "200" },
      ],
      preserved: emptyPreserved,
      now,
      ...overrides,
    };
  }

  it("emits the expectation pair as a unit", () => {
    const result = buildNutritionPlanReplaceCommand(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.expectedActivePlanId).toBe("plan-1");
    expect(result.command.expectedActiveRevision).toBe(3);
  });

  it("derives mealsPerDay and amountGramsPerDay from the schedule", () => {
    const result = buildNutritionPlanReplaceCommand(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.planData.mealsPerDay).toBe(3);
    expect(result.command.planData.amountGramsPerDay).toBe(600);
  });

  it("refuses a meal with zero grams", () => {
    const result = buildNutritionPlanReplaceCommand(
      baseParams({
        slots: [
          { id: "s1", period: "morning", scheduledTime: "07:00", targetGrams: "0" },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/maior que zero/i);
  });

  it("refuses a meal with a non-numeric quantity", () => {
    const result = buildNutritionPlanReplaceCommand(
      baseParams({
        slots: [
          { id: "s1", period: "morning", scheduledTime: "07:00", targetGrams: "abc" },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses a meal with no time", () => {
    const result = buildNutritionPlanReplaceCommand(
      baseParams({
        slots: [{ id: "s1", period: "morning", scheduledTime: "  ", targetGrams: "300" }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/horário/i);
  });

  it("refuses an empty schedule", () => {
    const result = buildNutritionPlanReplaceCommand(baseParams({ slots: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/pelo menos uma refeição/i);
  });

  it("refuses a negative hydration target", () => {
    const result = buildNutritionPlanReplaceCommand(baseParams({ hydrationMl: "-10" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/hidratação/i);
  });

  it("refuses a non-finite hydration target", () => {
    // The source's isNaN check let Infinity through; Number.isFinite does not.
    const result = buildNutritionPlanReplaceCommand(
      baseParams({ hydrationMl: "Infinity" }),
    );
    expect(result.ok).toBe(false);
  });

  it("accepts an omitted hydration target as null", () => {
    const result = buildNutritionPlanReplaceCommand(baseParams({ hydrationMl: "" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.planData.hydrationMl).toBeNull();
  });

  it("accepts a zero hydration target, which is a real value", () => {
    const result = buildNutritionPlanReplaceCommand(baseParams({ hydrationMl: "0" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.planData.hydrationMl).toBe(0);
  });

  it("refuses an empty food type", () => {
    const result = buildNutritionPlanReplaceCommand(baseParams({ foodType: "  " }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/tipo de alimento/i);
  });

  it("refuses an empty timezone", () => {
    const result = buildNutritionPlanReplaceCommand(baseParams({ timezone: " " }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/fuso horário/i);
  });

  it("carries administrative values explicitly onto the new plan", () => {
    const result = buildNutritionPlanReplaceCommand(
      baseParams({
        preserved: {
          ...emptyPreserved,
          specialInstructions: "Servir morno",
          professional: { name: "Dr. João", registration_type: "CRMV" },
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // NOT patch semantics: CREATE authors a whole document, so an unchanged value
    // must still be stated in the payload or the new plan would lose it.
    expect(result.command.planData.specialInstructions).toBe("Servir morno");
    expect(result.command.planData.professional).toMatchObject({ name: "Dr. João" });
  });

  it("§21 — an empty validUntil means open-ended, not an error", () => {
    const result = buildNutritionPlanReplaceCommand(baseParams({ validUntil: "" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.planData.validUntil).toBeNull();
  });

  it("§21 — accepts a future validUntil chosen by the operator", () => {
    const result = buildNutritionPlanReplaceCommand(
      baseParams({ validUntil: "2026-12-31" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.planData.validUntil).toBe("2026-12-31T23:59:59.999Z");
  });

  it("§21 — refuses a validUntil at or before the new plan's start", () => {
    const result = buildNutritionPlanReplaceCommand(
      baseParams({ validUntil: "2026-08-01" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/término de vigência/i);
  });

  it("§21 — clearing an already-expired date makes REPLACE reachable again", () => {
    // The dead end this fix closes: a past date must be correctable, not terminal.
    const expired = buildNutritionPlanReplaceCommand(
      baseParams({ validUntil: "2026-08-01" }),
    );
    expect(expired.ok).toBe(false);

    const cleared = buildNutritionPlanReplaceCommand(baseParams({ validUntil: "" }));
    expect(cleared.ok).toBe(true);
  });

  it("§21 — refuses an unparseable validUntil rather than sending NaN", () => {
    const result = buildNutritionPlanReplaceCommand(
      baseParams({ validUntil: "not-a-date" }),
    );
    expect(result.ok).toBe(false);
  });

  it("§23 — normalizes a source document into the wire contract's required shape", () => {
    const result = buildNutritionPlanReplaceCommand(
      baseParams({
        preserved: {
          ...emptyPreserved,
          sourceDocument: { health_document_id: "doc-1", description: "Laudo" },
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.planData.sourceDocument).toEqual({
      health_document_id: "doc-1",
      description: "Laudo",
    });
  });

  it("§23 — drops a source document that cannot supply health_document_id", () => {
    // The reader types source_document as an arbitrary record, so passing it
    // through would emit health_document_id: undefined and lose the reference.
    const result = buildNutritionPlanReplaceCommand(
      baseParams({
        preserved: { ...emptyPreserved, sourceDocument: { description: "sem id" } },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.planData.sourceDocument).toBeNull();
  });

  it("§22 — carries plan-level supplements onto the new plan", () => {
    const supplements = [
      { id: "sup-1", name: "Condroitina", dose: 500, unit: "mg", frequency: "daily" },
    ];
    const result = buildNutritionPlanReplaceCommand(
      baseParams({ preserved: { ...emptyPreserved, supplements } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.planData.supplements).toHaveLength(1);
    expect(result.command.planData.supplements?.[0]).toMatchObject({
      name: "Condroitina",
    });
  });

  it("§23 — carries attachment refs onto the new plan", () => {
    const result = buildNutritionPlanReplaceCommand(
      baseParams({
        preserved: { ...emptyPreserved, attachmentRefs: ["doc-a", "doc-b"] },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.planData.attachmentRefs).toEqual(["doc-a", "doc-b"]);
  });

  it("sets validFrom to the injected now", () => {
    const result = buildNutritionPlanReplaceCommand(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.planData.validFrom).toBe("2026-08-12T12:00:00.000Z");
  });

  it("never emits a structural field the operator did not set", () => {
    const result = buildNutritionPlanReplaceCommand(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A replacement with no supplements must not invent an empty regimen.
    expect(result.command.planData.supplements).toBeUndefined();
  });
});

describe("WEB-01B.6 — normalizeSourceDocument", () => {
  it("passes through a document that already carries health_document_id", () => {
    expect(
      normalizeSourceDocument({ health_document_id: "doc-1", description: "Laudo" }),
    ).toEqual({ health_document_id: "doc-1", description: "Laudo" });
  });

  it("accepts the camelCase and bare-id spellings the reader may hold", () => {
    expect(normalizeSourceDocument({ healthDocumentId: "doc-2" })).toEqual({
      health_document_id: "doc-2",
      description: null,
    });
    expect(normalizeSourceDocument({ id: "doc-3" })).toEqual({
      health_document_id: "doc-3",
      description: null,
    });
  });

  it("returns null when no usable id is present", () => {
    // Better an explicit "not linked" than health_document_id: undefined on the
    // wire, which would silently lose the reference.
    expect(normalizeSourceDocument({ description: "sem id" })).toBeNull();
    expect(normalizeSourceDocument({ health_document_id: "  " })).toBeNull();
    expect(normalizeSourceDocument({ health_document_id: 42 as never })).toBeNull();
  });

  it("returns null for an absent document", () => {
    expect(normalizeSourceDocument(null)).toBeNull();
  });
});

describe("WEB-01B.6 — toDateInputValue", () => {
  it("formats a Date as yyyy-mm-dd", () => {
    expect(toDateInputValue(new Date("2026-12-31T23:59:59.999Z"))).toBe("2026-12-31");
  });

  it("returns empty for absent or invalid dates", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue(undefined)).toBe("");
    expect(toDateInputValue(new Date("not-a-date"))).toBe("");
  });
});

describe("WEB-01B.6 — seedReplaceSlots", () => {
  it("preserves existing slot ids, times and grams", () => {
    const slots = seedReplaceSlots(planAt(3) as unknown as NutritionPlan);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      id: "s1",
      period: "morning",
      scheduledTime: "08:00",
      targetGrams: "250",
    });
  });

  it("falls back to a single default slot when the plan has no schedule", () => {
    const slots = seedReplaceSlots(
      planAt(3, { mealSchedule: [] }) as unknown as NutritionPlan,
    );
    expect(slots).toHaveLength(1);
    expect(slots[0].targetGrams).toBe("");
  });

  it("synthesizes an id for a slot that has none", () => {
    const slots = seedReplaceSlots(
      planAt(3, {
        mealSchedule: [
          { id: "", period: "morning", scheduledTime: "07:00", targetGrams: 300 },
        ],
      }) as unknown as NutritionPlan,
    );
    expect(slots[0].id).toBe("slot-1");
  });
});
