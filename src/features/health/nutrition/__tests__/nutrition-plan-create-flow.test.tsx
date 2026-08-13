/**
 * K9 Ops Web — Health Web v1 / WEB-01B.4
 * CREATE flow through the rendered UI.
 *
 * Replaces the pre-Foundation `nutrition-plan-create-flow`, which rendered
 * `NutritionPlanManagement` with its own dog selector, `useEntities` and a
 * parallel access-control read. Those assumptions are gone; the Foundation
 * equivalent is the panel for one dogId, gated by capability + read state.
 *
 * The mock boundary is the mutation hook, so the pipeline (prepare -> execute,
 * retry without re-prepare) is observed at the real API. Transport is already
 * proven in WEB-01B.3, and no callable is invoked here.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NutritionPlanState } from "../types";

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
vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
}));

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
}));

vi.mock("../hooks/use-nutrition-plan-mutations", () => ({
  useNutritionPlanMutations: () => ({
    prepareCreate: mutationMocks.prepareCreate,
    executeCreate: mutationMocks.executeCreate,
    retryCreate: mutationMocks.retryCreate,
    resetCreate: mutationMocks.resetCreate,
    createState: mutationMocks.createState,
  }),
}));

const { NutritionPlanPanel } = await import("../presentation/nutrition-plan-panel");

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

const CREATE_ACTION = /Novo plano alimentar/i;

beforeEach(() => {
  vi.clearAllMocks();
  mutationMocks.createState = { status: "idle" };
  mockUseNutritionPlans.mockReturnValue(stateFor({ status: "empty", error: null }));
  mockCan.mockReturnValue(false);
});

function openDialog() {
  fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));
}

function fillMinimumValidForm() {
  openDialog();
  fireEvent.change(screen.getByLabelText("Tipo de alimento"), {
    target: { value: "Ração Premium" },
  });
  fireEvent.change(screen.getByLabelText("Quantidade (g)"), {
    target: { value: "500" },
  });
}

describe("WEB-01B.4 — capability gate on the rendered surface", () => {
  it("hides CREATE when manage_nutrition_plan is absent", () => {
    mockCan.mockReturnValue(false);
    render(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: CREATE_ACTION })).not.toBeInTheDocument();
    // The plan surface itself stays readable.
    expect(screen.getByText(/Nenhum plano alimentar ativo/i)).toBeInTheDocument();
  });

  it("asks for exactly health.manage_nutrition_plan, not a read capability", () => {
    mockCan.mockReturnValue(true);
    render(<NutritionPlanPanel dogId="dog-1" />);

    expect(mockCan).toHaveBeenCalledWith("health", "manage_nutrition_plan");
    for (const call of mockCan.mock.calls) {
      expect(call[1]).not.toBe("view");
      expect(call[1]).not.toBe("read");
      expect(call[1]).not.toBe("edit");
    }
  });

  it("read-only capability keeps the plan readable with no write affordance", () => {
    // `can` returns false for manage while the layout still granted health.read.
    mockCan.mockImplementation((_module, action) => action === "read");
    render(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByText(/Nenhum plano alimentar ativo/i)).toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument();
  });

  it("shows CREATE on proven absence with manage capability", () => {
    mockCan.mockReturnValue(true);
    render(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("nutrition-create-plan-action")).toBeInTheDocument();
  });

  it("withdraws an open dialog if the write capability is revoked", () => {
    mockCan.mockReturnValue(true);
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // The provider re-evaluates (e.g. profile change) and manage is gone.
    mockCan.mockReturnValue(false);
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("create-plan-submit")).not.toBeInTheDocument();
  });
});

describe("WEB-01B.4 — states that must never offer CREATE", () => {
  const forbidden: Array<[string, Partial<NutritionPlanState>]> = [
    ["loading", { status: "loading" }],
    ["error", { status: "error", reason: "firestore-read-error" }],
    ["conflict", { status: "conflict" }],
    [
      "degraded",
      { status: "degraded", activePlan: null },
    ],
    [
      "canonical active",
      {
        status: "canonical",
        activePlan: {
          id: "plan-1",
          dogId: "dog-1",
          foodType: "Ração",
          amountGramsPerDay: 500,
          mealsPerDay: 2,
          mealSchedule: [],
          validFrom: new Date(),
          timezone: "America/Sao_Paulo",
          recordedBy: { uid: "u1", name: "Vet", internalRole: "Vet" },
          status: "active",
          schemaVersion: 1,
          revision: 1,
          supplements: [],
        } as never,
      },
    ],
    [
      "legacy",
      {
        status: "legacy",
        activePlan: {
          id: "leg-1",
          dogId: "dog-1",
          foodType: "Ração Legada",
          amountGramsPerDay: 400,
          mealsPerDay: 2,
          vigentFrom: new Date(),
          legacySource: "legacy_db",
          legacyId: "LEG-01",
        } as never,
        legacyPlan: {
          id: "leg-1",
          dogId: "dog-1",
          foodType: "Ração Legada",
          amountGramsPerDay: 400,
          mealsPerDay: 2,
          vigentFrom: new Date(),
          legacySource: "legacy_db",
          legacyId: "LEG-01",
        } as never,
      },
    ],
    ["empty with non-null error", { status: "empty", error: "dogId inválido" }],
  ];

  for (const [label, partial] of forbidden) {
    it(`${label} shows no CREATE even with manage capability`, () => {
      mockCan.mockReturnValue(true);
      mockUseNutritionPlans.mockReturnValue(stateFor(partial));

      const { container } = render(<NutritionPlanPanel dogId="dog-1" />);

      expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument();
      expect(container.textContent ?? "").not.toMatch(CREATE_ACTION);
    });
  }

  /*
   * WEB-01B.6 delivered REPLACE and WEB-01B.7 delivered CANCEL, so both are now
   * expected on a canonical active plan and asserted in their own suites. The
   * durable B.4 invariant survives unchanged and is what this test guards: CREATE
   * needs PROVEN ABSENCE, so it must never be reachable from a canonical plan —
   * CREATE and the lifecycle actions can never coexist.
   */
  it("canonical active offers no CREATE (CREATE needs proven absence)", () => {
    mockCan.mockReturnValue(true);
    mockUseNutritionPlans.mockReturnValue(
      stateFor({
        status: "canonical",
        activePlan: {
          id: "plan-1",
          dogId: "dog-1",
          foodType: "Ração",
          amountGramsPerDay: 500,
          mealsPerDay: 2,
          mealSchedule: [],
          validFrom: new Date(),
          timezone: "America/Sao_Paulo",
          recordedBy: { uid: "u1", name: "Vet", internalRole: "Vet" },
          status: "active",
          schemaVersion: 1,
          revision: 1,
          supplements: [],
        } as never,
      }),
    );

    const { container } = render(<NutritionPlanPanel dogId="dog-1" />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Novo plano/i);
    expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument();
    // The lifecycle actions own this state instead.
    expect(screen.getByTestId("nutrition-cancel-plan-action")).toBeInTheDocument();
  });
});

describe("WEB-01B.4 — submit pipeline", () => {
  beforeEach(() => {
    mockCan.mockReturnValue(true);
  });

  it("opens the dialog from the CREATE action", async () => {

    render(<NutritionPlanPanel dogId="dog-1" />);

    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de alimento")).toBeInTheDocument();
  });

  it("calls prepareCreate once then executeCreate once, in order", async () => {
    const order: string[] = [];
    mutationMocks.prepareCreate.mockImplementation(() => order.push("prepare"));
    mutationMocks.executeCreate.mockImplementation(async () => {
      order.push("execute");
      return { success: true, planId: "plan-1", status: "active", revision: 1, wasNoOp: false };
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    expect(mutationMocks.prepareCreate).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["prepare", "execute"]);
  });

  it("sends the route dogId and the institutional timezone in the command", async () => {
    mutationMocks.executeCreate.mockResolvedValue({
      success: true,
      planId: "plan-1",
      status: "active",
      revision: 1,
      wasNoOp: false,
    });

    render(<NutritionPlanPanel dogId="dog-XYZ" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareCreate).toHaveBeenCalled());
    const command = mutationMocks.prepareCreate.mock.calls[0][0];
    expect(command.dogId).toBe("dog-XYZ");
    expect(command.planData.timezone).toBe("America/Sao_Paulo");
    expect(command.planData.foodType).toBe("Ração Premium");
    expect(command.planData.mealsPerDay).toBe(command.planData.mealSchedule.length);
  });

  it("blocks submit while executing, so no concurrent CREATE is possible", async () => {
    mutationMocks.createState = { status: "executing", intent: { operationId: "op-A" } };
    mockCan.mockReturnValue(true);


    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));

    const submit = screen.getByTestId("create-plan-submit");
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
    expect(mutationMocks.executeCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid form locally without touching the mutation hook", async () => {

    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));

    // No food type, no grams.
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    expect(screen.getByTestId("create-plan-local-error")).toBeInTheDocument();
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
    expect(mutationMocks.executeCreate).not.toHaveBeenCalled();
  });
});

describe("WEB-01B.4 — retry reuses the prepared intent", () => {
  it("retry calls retryCreate and never re-prepares", async () => {
    mockCan.mockReturnValue(true);
    mutationMocks.createState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: {
        firebaseCode: "unavailable",
        message: "Serviço temporariamente indisponível.",
        retryable: true,
      },
    };


    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));
    fireEvent.click(screen.getByTestId("create-plan-retry"));

    expect(mutationMocks.retryCreate).toHaveBeenCalledTimes(1);
    // A new operationId would be a duplicate mutation, not a retry.
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
  });

  it("offers no retry for a non-retryable error", async () => {
    mockCan.mockReturnValue(true);
    mutationMocks.createState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: {
        firebaseCode: "permission-denied",
        domainCode: "permission-denied",
        message: "Você não tem permissão para gerenciar planos alimentares.",
        retryable: false,
      },
    };


    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));

    expect(screen.queryByTestId("create-plan-retry")).not.toBeInTheDocument();
  });
});

describe("WEB-01B.4 — domain error surfaces", () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    [
      "permission-denied",
      { firebaseCode: "permission-denied", domainCode: "permission-denied", retryable: false },
    ],
    [
      "active-plan-conflict",
      { firebaseCode: "failed-precondition", domainCode: "active-plan-conflict", retryable: false },
    ],
    [
      "idempotency-conflict",
      { firebaseCode: "aborted", domainCode: "idempotency-conflict", retryable: false },
    ],
    [
      "invalid-validity-window",
      { firebaseCode: "invalid-argument", domainCode: "invalid-validity-window", retryable: false },
    ],
  ];

  for (const [label, error] of cases) {
    it(`renders a safe message for ${label} and offers no automatic re-send`, async () => {
      mockCan.mockReturnValue(true);
      mutationMocks.createState = {
        status: "error",
        intent: { operationId: "op-A" },
        error: { ...error, message: `Mensagem segura para ${label}` },
      };


      render(<NutritionPlanPanel dogId="dog-1" />);
      fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));

      expect(screen.getByTestId("create-plan-error")).toHaveTextContent(
        `Mensagem segura para ${label}`,
      );
      // Non-retryable: no path that would mint a new operationId.
      expect(screen.queryByTestId("create-plan-retry")).not.toBeInTheDocument();
      expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
    });
  }

  it("never leaks internal details for internal-integrity-error", async () => {
    mockCan.mockReturnValue(true);
    mutationMocks.createState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: {
        firebaseCode: "internal",
        domainCode: "internal-integrity-error",
        message: "Falha interna de integridade. A operação não foi aplicada.",
        retryable: false,
        // The R1 normalizer already reduces details to { code }.
        details: { code: "internal-integrity-error" },
      },
    };


    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));

    const text = screen.getByTestId("create-plan-error").textContent ?? "";
    expect(text).not.toMatch(/receipt|stack|firestore|dogs\/|collection|at /i);
  });
});

describe("WEB-01B.4 — success handling", () => {
  it("reports success without claiming a duplicate creation", async () => {
    mockCan.mockReturnValue(true);
    mutationMocks.createState = {
      status: "success",
      intent: { operationId: "op-A" },
      result: { success: true, planId: "plan-1", status: "active", revision: 1, wasNoOp: false },
    };


    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));

    expect(screen.getByTestId("create-plan-success")).toBeInTheDocument();
    // Submit is withdrawn after success, so the same intent cannot be re-sent.
    expect(screen.queryByTestId("create-plan-submit")).not.toBeInTheDocument();
  });

  it("treats wasNoOp replay as success, not as an error", async () => {
    mockCan.mockReturnValue(true);
    mutationMocks.createState = {
      status: "success",
      intent: { operationId: "op-A" },
      result: { success: true, planId: "plan-1", status: "active", revision: 1, wasNoOp: true },
    };


    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));

    expect(screen.getByTestId("create-plan-success")).toBeInTheDocument();
    expect(screen.queryByTestId("create-plan-error")).not.toBeInTheDocument();
  });

  it("resets the mutation track on close, leaving the reader as the authority", async () => {
    mockCan.mockReturnValue(true);
    mutationMocks.createState = {
      status: "success",
      intent: { operationId: "op-A" },
      result: { success: true, planId: "plan-1", status: "active", revision: 1, wasNoOp: false },
    };


    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));
    fireEvent.click(screen.getByTestId("create-plan-close"));

    expect(mutationMocks.resetCreate).toHaveBeenCalled();
  });

  it("cannot be closed mid-flight, so a sent mutation keeps its surface", async () => {
    mockCan.mockReturnValue(true);
    mutationMocks.createState = { status: "executing", intent: { operationId: "op-A" } };


    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));
    fireEvent.click(screen.getByTestId("create-plan-close"));

    expect(mutationMocks.resetCreate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

/**
 * WEB-01B.6R — the backend said `success: true` and the client could not verify
 * the response.
 *
 * This is the one failure where "it threw" does not mean "it did not happen".
 * The service raises it only past the success gate, so a plan may already exist
 * while the reader still reports `empty`. Treating it as an ordinary error would
 * hand the CREATE button back and let a second, non-replay CREATE through — the
 * exact window B.4's latch was built to close.
 */
describe("WEB-01B.6R — CREATE potentially-committed outcome", () => {
  const invalidMutationResponse = {
    firebaseCode: "internal",
    message: "Falha ao criar plano nutricional",
    retryable: false,
    details: { code: "invalid-mutation-response" },
  };

  beforeEach(() => {
    mockCan.mockReturnValue(true);
  });

  it("engages the reconciliation latch while the reader still says empty", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    // The reader has not moved: still the pre-mutation `empty` snapshot.
    expect(screen.getByText(/Nenhum plano alimentar ativo/i)).toBeInTheDocument();
    // ...and the affordance is withheld anyway, because a plan may exist.
    await waitFor(() =>
      expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument(),
    );
  });

  it("does not start a second logical CREATE", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    // Exactly one prepare, one execute: no new operationId, no auto-retry.
    expect(mutationMocks.prepareCreate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.retryCreate).not.toHaveBeenCalled();
  });

  it("keeps the dialog open with sanitized copy, neither success nor plain failure", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);
    mutationMocks.createState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: invalidMutationResponse,
    };

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalled());

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // The uncertain surface replaces the ordinary error surface: "Falha ao criar"
    // would read as "nothing happened" and invite an unsafe retry.
    expect(screen.getByTestId("create-plan-outcome-uncertain")).toBeInTheDocument();
    expect(screen.queryByTestId("create-plan-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("create-plan-success")).not.toBeInTheDocument();
    // Non-retryable: retrying could mint a second mutation on an unknown state.
    expect(screen.queryByTestId("create-plan-retry")).not.toBeInTheDocument();
    // The raw response never reaches the operator.
    expect(screen.queryByText(/plan-/)).not.toBeInTheDocument();
  });

  it("engages the latch from a retry too — a replay implies something persisted", async () => {
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
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));
    fireEvent.click(screen.getByTestId("create-plan-retry"));

    await waitFor(() => expect(mutationMocks.retryCreate).toHaveBeenCalledTimes(1));

    // Same operationId reused, and no third attempt fired automatically.
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
    expect(mutationMocks.retryCreate).toHaveBeenCalledTimes(1);

    // A retry that lands in the uncertain state closes the door behind it: the
    // retry affordance is withdrawn even though the hook still reports the
    // original error as retryable, and submit is locked.
    expect(screen.queryByTestId("create-plan-retry")).not.toBeInTheDocument();
    const submit = screen.getByTestId("create-plan-submit");
    expect(submit).toBeDisabled();

    // Force both paths anyway — there must be no third attempt.
    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form")!);

    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
    expect(mutationMocks.retryCreate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.executeCreate).not.toHaveBeenCalled();
  });

  it("releases the latch once the reader leaves the empty snapshot", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("create-plan-close"));
    await waitFor(() =>
      expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument(),
    );

    // The reader speaks: a canonical plan now exists. Truth arrived from the
    // reader, never from the response we refused to trust.
    mockUseNutritionPlans.mockReturnValue(
      stateFor({
        status: "canonical",
        activePlan: {
          id: "plan-real",
          dogId: "dog-1",
          foodType: "Ração",
          amountGramsPerDay: 500,
          mealsPerDay: 2,
          mealSchedule: [],
          validFrom: new Date(),
          timezone: "America/Sao_Paulo",
          recordedBy: { uid: "u1", name: "Vet", internalRole: "Vet" },
          status: "active",
          schemaVersion: 1,
          revision: 1,
          supplements: [],
        } as never,
      }),
    );
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.queryByText(/Nenhum plano alimentar ativo/i)).not.toBeInTheDocument();
  });

  /*
   * The panel latch only governs the card behind the dialog. If the dialog that
   * is ALREADY OPEN keeps a live submit button, the operator never has to close
   * it — one more click mints a fresh operationId and a second logical CREATE,
   * while the first one's fate is still unknown. This asserts the lock inside the
   * dialog, which affordance-absence tests cannot reach.
   */
  it("locks its own submit — a second click cannot start another CREATE", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    // The dialog is still open, and the reader has not moved.
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const submit = screen.getByTestId("create-plan-submit");
    expect(submit).toBeDisabled();

    // Attempt it anyway: no second prepare, no second execute, no new operationId.
    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form")!);

    expect(mutationMocks.prepareCreate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.retryCreate).not.toHaveBeenCalled();
  });

  it("offers no retry affordance in the uncertain state", async () => {
    mutationMocks.executeCreate.mockRejectedValue({
      ...invalidMutationResponse,
      // Even if something upstream marked it retryable, retrying is unsafe here.
      retryable: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    expect(screen.queryByTestId("create-plan-retry")).not.toBeInTheDocument();
  });

  it("tells the operator the result is unconfirmed, not that it failed", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    const notice = screen.getByTestId("create-plan-outcome-uncertain");
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toMatch(/não foi possível confirmar/i);
    // Must not assert a definite failure — the plan may exist.
    expect(screen.queryByTestId("create-plan-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("create-plan-success")).not.toBeInTheDocument();
  });

  it("keeps the panel latch engaged after the dialog is closed", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    // Closing clears the dialog's local lock but must NOT clear the panel latch.
    fireEvent.click(screen.getByTestId("create-plan-close"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument();
  });

  it("does not leak the uncertain lock into a later legitimate CREATE", async () => {
    mutationMocks.executeCreate.mockRejectedValue(invalidMutationResponse);

    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("create-plan-close"));

    // Reader reconciles to a canonical plan, then back to empty later (plan
    // cancelled elsewhere). A fresh CREATE must be fully usable.
    mockUseNutritionPlans.mockReturnValue(
      stateFor({
        status: "canonical",
        activePlan: {
          id: "plan-real",
          dogId: "dog-1",
          foodType: "Ração",
          amountGramsPerDay: 500,
          mealsPerDay: 2,
          mealSchedule: [],
          validFrom: new Date(),
          timezone: "America/Sao_Paulo",
          recordedBy: { uid: "u1", name: "Vet", internalRole: "Vet" },
          status: "active",
          schemaVersion: 1,
          revision: 1,
          supplements: [],
        } as never,
      }),
    );
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    mockUseNutritionPlans.mockReturnValue(stateFor({ status: "empty", error: null }));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));
    fireEvent.change(screen.getByLabelText("Tipo de alimento"), {
      target: { value: "Ração Premium" },
    });
    fireEvent.change(screen.getByLabelText("Quantidade (g)"), { target: { value: "500" } });

    expect(screen.getByTestId("create-plan-submit")).not.toBeDisabled();
    expect(screen.queryByTestId("create-plan-outcome-uncertain")).not.toBeInTheDocument();
  });

  it("a normal backend rejection does NOT engage the latch", async () => {
    // permission-denied means the mutation provably never landed, so the `empty`
    // snapshot is still trustworthy and the affordance must survive.
    mutationMocks.executeCreate.mockRejectedValue({
      firebaseCode: "permission-denied",
      domainCode: "permission-denied",
      message: "Você não tem permissão para gerenciar planos alimentares.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("create-plan-close"));

    expect(screen.getByTestId("nutrition-create-plan-action")).toBeInTheDocument();
  });

  it("an unauthenticated rejection does NOT engage the latch either", async () => {
    // Another class-A case: the auth gate never reads plan state, so `empty` is
    // still a trustworthy basis for offering CREATE.
    mutationMocks.executeCreate.mockRejectedValue({
      firebaseCode: "unauthenticated",
      domainCode: "unauthenticated",
      message: "Autenticação obrigatória.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("create-plan-close"));

    expect(screen.getByTestId("nutrition-create-plan-action")).toBeInTheDocument();
  });
});

/**
 * WEB-01B.7R — `active-plan-conflict` contradicts the `empty` snapshot.
 *
 * The backend refused this CREATE because it holds an active plan where the reader
 * reported none. Nothing was written, but `empty` has stopped being grounds for
 * offering CREATE again.
 *
 * This test previously asserted the opposite, under the name "a revision-conflict
 * does NOT engage the latch either" — it used a class-B code as a class-A fixture
 * and so encoded the gap as intended behaviour.
 */
describe("WEB-01B.7R — CREATE stale reader authority", () => {
  const activePlanConflict = {
    firebaseCode: "failed-precondition",
    domainCode: "active-plan-conflict",
    message: "Já existe um plano ativo.",
    retryable: false,
  };

  beforeEach(() => {
    mockCan.mockReturnValue(true);
  });

  it("withholds CREATE while the reader still reports empty", async () => {
    mutationMocks.executeCreate.mockRejectedValue(activePlanConflict);

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("create-plan-close"));

    // The reader has not moved, but the backend already contradicted it.
    expect(screen.getByText(/Nenhum plano alimentar ativo/i)).toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument();
  });

  it("says the state changed, never that the plan may have been created", async () => {
    mutationMocks.executeCreate.mockRejectedValue(activePlanConflict);

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    const notice = screen.getByTestId("create-plan-reader-reconciliation");
    expect(notice.textContent).toMatch(/o estado dos planos mudou/i);
    expect(notice.textContent).toMatch(/não foi realizada/i);
    expect(screen.queryByTestId("create-plan-outcome-uncertain")).not.toBeInTheDocument();
    expect(screen.queryByTestId("create-plan-success")).not.toBeInTheDocument();
    expect(screen.queryByTestId("create-plan-error")).not.toBeInTheDocument();
  });

  it("locks its own submit — no second attempt against the contradicted snapshot", async () => {
    mutationMocks.executeCreate.mockRejectedValue(activePlanConflict);

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));

    const submit = screen.getByTestId("create-plan-submit");
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form")!);

    expect(mutationMocks.prepareCreate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.retryCreate).not.toHaveBeenCalled();
  });

  it("releases once the reader reports the plan the backend already had", async () => {
    mutationMocks.executeCreate.mockRejectedValue(activePlanConflict);

    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    fillMinimumValidForm();
    fireEvent.click(screen.getByTestId("create-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("create-plan-close"));

    mockUseNutritionPlans.mockReturnValue(
      stateFor({
        status: "canonical",
        activePlan: {
          id: "plan-existing",
          dogId: "dog-1",
          foodType: "Ração",
          amountGramsPerDay: 500,
          mealsPerDay: 2,
          mealSchedule: [],
          validFrom: new Date(),
          timezone: "America/Sao_Paulo",
          recordedBy: { uid: "u1", name: "Vet", internalRole: "Vet" },
          status: "active",
          schemaVersion: 1,
          revision: 1,
          supplements: [],
        } as never,
      }),
    );
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.queryByText(/Nenhum plano alimentar ativo/i)).not.toBeInTheDocument();
  });
});

/**
 * WEB-01B.7R — retry-intent ownership inside the open dialog.
 *
 * A retryable failure leaves ONE unresolved intent. Retry replays it with the same
 * operationId; the normal submit would mint a second one beside it. Closing
 * abandons the intent, which is the accepted Web v1 trade-off.
 */
describe("WEB-01B.7R — CREATE retry intent ownership", () => {
  const transportFailure = {
    firebaseCode: "unavailable",
    message: "Serviço temporariamente indisponível.",
    retryable: true,
  };

  beforeEach(() => {
    mockCan.mockReturnValue(true);
    mutationMocks.createState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: transportFailure,
    };
  });

  it("withdraws the normal submit while Retry owns the intent", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));

    expect(screen.getByTestId("create-plan-retry")).toBeInTheDocument();
    expect(screen.queryByTestId("create-plan-submit")).not.toBeInTheDocument();
  });

  it("cannot mint a second operationId through a programmatic submit", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));

    const form = screen.getByTestId("create-plan-retry").closest("form")!;
    fireEvent.submit(form);

    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
    expect(mutationMocks.executeCreate).not.toHaveBeenCalled();
  });

  it("freezes the form so it cannot show values Retry will not send", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));

    expect(screen.getByLabelText("Tipo de alimento")).toBeDisabled();
    expect(screen.getByLabelText("Quantidade (g)")).toBeDisabled();
  });

  it("states that Retry repeats the previous attempt and closing ends it", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));

    const notice = screen.getByTestId("create-plan-retry-ownership");
    expect(notice.textContent).toMatch(/repetirá exatamente esta tentativa/i);
    expect(notice.textContent).toMatch(/será encerrada/i);
  });

  it("Retry calls retryCreate, never prepareCreate", async () => {
    mutationMocks.retryCreate.mockResolvedValue({
      success: true,
      planId: "plan-1",
      status: "active",
      revision: 1,
      supersededPlanId: null,
      wasNoOp: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));
    fireEvent.click(screen.getByTestId("create-plan-retry"));

    await waitFor(() => expect(mutationMocks.retryCreate).toHaveBeenCalledTimes(1));
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
  });
});
