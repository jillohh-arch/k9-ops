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

  it("canonical active offers no REPLACE/EDIT/CANCEL either (deferred phases)", () => {
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
    expect(text).not.toMatch(/Substituir/i);
    expect(text).not.toMatch(/Cancelar plano/i);
    expect(text).not.toMatch(/Novo plano/i);
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
