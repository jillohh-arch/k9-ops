/**
 * K9 Ops Web — Health Web v1 / WEB-01B.4
 * CREATE against the REAL mutation hook.
 *
 * The other B.4 flow test mocks `useNutritionPlanMutations`, which cannot prove
 * that the dialog's `prepareCreate(command); await executeCreate();` actually
 * works against the real WEB-01B.3 state machine. If the hook only published the
 * prepared intent through React state, `executeCreate` would find `idle` and
 * throw `no-prepared-intent` — and a mocked hook would never notice.
 *
 * Here the hook is REAL and only the transport (the mutation service) is mocked,
 * so the same-turn prepare -> execute contract is exercised end to end without
 * touching Firebase.
 *
 * Also covers the post-success reconciliation window with the real hook driving
 * the dialog state.
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

const mockCan = vi.fn(() => true);
vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can: mockCan }),
}));

const mockUseNutritionPlans = vi.fn();
vi.mock("../hooks/use-nutrition-plans", () => ({
  useNutritionPlans: (dogId: string) => mockUseNutritionPlans(dogId),
}));

/**
 * Transport boundary only. The hook, its state machine and its operationId
 * lifecycle are the real implementation.
 */
const serviceMocks = vi.hoisted(() => ({
  executeCreate: vi.fn(),
  generateOperationId: vi.fn(),
}));

vi.mock("../data/nutrition-plan-mutation-service", async () => {
  const actual = await vi.importActual<
    typeof import("../data/nutrition-plan-mutation-service")
  >("../data/nutrition-plan-mutation-service");
  return {
    ...actual,
    // Real builders, real error classifiers; only the callable round trip is faked.
    executeCreateNutritionPlan: serviceMocks.executeCreate,
    generateNutritionPlanOperationId: serviceMocks.generateOperationId,
  };
});

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

const canonicalState = stateFor({
  status: "canonical",
  activePlan: {
    id: "plan-1",
    dogId: "dog-1",
    foodType: "Ração Premium",
    amountGramsPerDay: 500,
    mealsPerDay: 1,
    mealSchedule: [],
    validFrom: new Date(),
    timezone: "America/Sao_Paulo",
    recordedBy: { uid: "u1", name: "Vet", internalRole: "Vet" },
    status: "active",
    schemaVersion: 1,
    revision: 1,
    supplements: [],
  } as never,
});

function fillAndSubmit() {
  fireEvent.click(screen.getByTestId("nutrition-create-plan-action"));
  fireEvent.change(screen.getByLabelText("Tipo de alimento"), {
    target: { value: "Ração Premium" },
  });
  fireEvent.change(screen.getByLabelText("Quantidade (g)"), {
    target: { value: "500" },
  });
  fireEvent.click(screen.getByTestId("create-plan-submit"));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(true);
  mockUseNutritionPlans.mockReturnValue(stateFor({ status: "empty", error: null }));
  serviceMocks.generateOperationId.mockReturnValue("op-real-1");
  serviceMocks.executeCreate.mockResolvedValue({
    success: true,
    planId: "plan-new-1",
    status: "active",
    revision: 1,
    supersededPlanId: null,
    wasNoOp: false,
  });
});

describe("WEB-01B.4 — prepare -> execute against the real hook", () => {
  it("reaches the transport in the same turn, with no re-render in between", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    fillAndSubmit();

    // If the prepared intent were only in React state, executeCreate would have
    // thrown no-prepared-intent and never reached the transport.
    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));

    const [, request] = serviceMocks.executeCreate.mock.calls[0];
    expect(request.operationId).toBe("op-real-1");
    expect(request.dogId).toBe("dog-1");
  });

  it("mints exactly one operationId for one logical submit", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    fillAndSubmit();

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
  });

  it("sends the real builder's wire shape, snake_case inside planData", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    fillAndSubmit();

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalled());
    const [, request] = serviceMocks.executeCreate.mock.calls[0];

    expect(request.planData.food_type).toBe("Ração Premium");
    expect(request.planData.amount_grams_per_day).toBe(500);
    expect(request.planData.meals_per_day).toBe(1);
    expect(request.planData.timezone).toBe("America/Sao_Paulo");
    // CREATE, not REPLACE: no expectation pair.
    expect(request.expectedActivePlanId).toBeUndefined();
    expect(request.expectedActiveRevision).toBeUndefined();
  });

  it("surfaces success through the real state machine", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByTestId("create-plan-success")).toBeInTheDocument(),
    );
    // Submit withdrawn: the same intent cannot be re-sent.
    expect(screen.queryByTestId("create-plan-submit")).not.toBeInTheDocument();
  });

  it("a retryable failure keeps the same operationId on retry", async () => {
    serviceMocks.executeCreate.mockRejectedValueOnce({
      firebaseCode: "unavailable",
      message: "Serviço temporariamente indisponível.",
      retryable: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByTestId("create-plan-retry")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("create-plan-retry"));

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(2));

    const first = serviceMocks.executeCreate.mock.calls[0][1];
    const second = serviceMocks.executeCreate.mock.calls[1][1];
    expect(second.operationId).toBe(first.operationId);
    // A retry is a replay, never a new logical operation.
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
  });
});

describe("WEB-01B.4 — post-success reconciliation window", () => {
  it("does not offer CREATE again while the reader still reports empty", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    fillAndSubmit();

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));

    // Close the dialog; the reader has NOT emitted the new plan yet.
    fireEvent.click(screen.getByTestId("create-plan-close"));

    expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument();
    // No second logical operation was ever prepared.
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
    expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1);
  });

  it("releases the latch once the reader reconciles to canonical", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    fillAndSubmit();

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("create-plan-close"));
    expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument();

    // Realtime reader catches up.
    mockUseNutritionPlans.mockReturnValue(canonicalState);
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    // Canonical never offers CREATE anyway (that would be REPLACE), and the
    // plan is now visible.
    expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument();
    expect(screen.getByTestId("nutrition-canonical-card")).toBeInTheDocument();
  });

  it("releases the latch if the reader reconciles to an error instead", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    fillAndSubmit();
    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("create-plan-close"));

    mockUseNutritionPlans.mockReturnValue(
      stateFor({ status: "error", reason: "firestore-read-error", error: "permission-denied" }),
    );
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    // Error state is shown rather than a stale empty with a hidden button.
    expect(screen.getByText(/Não foi possível/i)).toBeInTheDocument();
  });

  it("a latch from one K9 never suppresses CREATE for another", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    fillAndSubmit();
    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("create-plan-close"));
    expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument();

    // Route changes to a different K9 whose plan is genuinely absent.
    mockUseNutritionPlans.mockReturnValue(
      stateFor({ status: "empty", dogId: "dog-2", error: null }),
    );
    rerender(<NutritionPlanPanel dogId="dog-2" />);

    expect(screen.getByTestId("nutrition-create-plan-action")).toBeInTheDocument();
  });

  it("an idempotent replay also latches, since the plan is confirmed", async () => {
    serviceMocks.executeCreate.mockResolvedValue({
      success: true,
      planId: "plan-new-1",
      status: "active",
      revision: 1,
      supersededPlanId: null,
      wasNoOp: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByTestId("create-plan-success")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("create-plan-close"));

    expect(screen.queryByTestId("nutrition-create-plan-action")).not.toBeInTheDocument();
  });

  it("a failed CREATE does NOT latch, so the operator can try again", async () => {
    serviceMocks.executeCreate.mockRejectedValue({
      firebaseCode: "invalid-argument",
      domainCode: "validation",
      message: "Dados inválidos.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByTestId("create-plan-error")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("create-plan-close"));

    // Nothing was created, so the affordance must remain available.
    expect(screen.getByTestId("nutrition-create-plan-action")).toBeInTheDocument();
  });
});
