/**
 * K9 Ops Web — Health Web v1 / WEB-01B.5
 * Administrative UPDATE against the REAL mutation hook.
 *
 * Mirrors the B.4 real-hook test: the hook, its state machine and its
 * operationId/expectedRevision lifecycle are the real WEB-01B.3 implementation;
 * only the transport (executeUpdateNutritionPlan) is mocked. A hook that only
 * published the prepared intent through React state would make executeUpdate
 * throw no-prepared-intent, which a mocked hook could never reveal.
 *
 * The centrepiece is the UPDATE temporal seam: after success, two revisions
 * coexist for a moment — the one the backend just confirmed and the older one
 * the reader is still showing. EDIT must not reopen against the stale one.
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

const serviceMocks = vi.hoisted(() => ({
  executeUpdate: vi.fn(),
  generateOperationId: vi.fn(),
}));

vi.mock("../data/nutrition-plan-mutation-service", async () => {
  const actual = await vi.importActual<
    typeof import("../data/nutrition-plan-mutation-service")
  >("../data/nutrition-plan-mutation-service");
  return {
    ...actual,
    // Real builders and error classifiers; only the callable round trip is faked.
    executeUpdateNutritionPlan: serviceMocks.executeUpdate,
    generateNutritionPlanOperationId: serviceMocks.generateOperationId,
  };
});

const { NutritionPlanPanel } = await import("../presentation/nutrition-plan-panel");

function planAt(revision: number, overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    dogId: "dog-1",
    foodType: "Ração Premium",
    amountGramsPerDay: 500,
    mealsPerDay: 2,
    mealSchedule: [],
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

function openEdit() {
  fireEvent.click(screen.getByTestId("nutrition-edit-plan-action"));
}

function editInstructions(value: string) {
  fireEvent.change(screen.getByLabelText("Instruções especiais"), {
    target: { value },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(true);
  mockUseNutritionPlans.mockReturnValue(canonicalState(3));
  serviceMocks.generateOperationId.mockReturnValue("op-update-1");
  serviceMocks.executeUpdate.mockResolvedValue({
    success: true,
    planId: "plan-1",
    status: "active",
    revision: 4,
    wasNoOp: false,
  });
});

describe("WEB-01B.5 — prepare -> execute against the real hook", () => {
  it("reaches the transport in the same turn, with no re-render in between", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeUpdate).toHaveBeenCalledTimes(1));

    const [, request] = serviceMocks.executeUpdate.mock.calls[0];
    expect(request.operationId).toBe("op-update-1");
    expect(request.planId).toBe("plan-1");
    expect(request.dogId).toBe("dog-1");
  });

  it("sends the revision that was displayed when the dialog opened", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeUpdate).toHaveBeenCalled());
    const [, request] = serviceMocks.executeUpdate.mock.calls[0];
    expect(request.expectedRevision).toBe(3);
  });

  it("mints exactly one operationId per logical submit", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeUpdate).toHaveBeenCalledTimes(1));
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
  });

  it("sends ONLY administrative fields through the real builder", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Somente administrativo");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeUpdate).toHaveBeenCalled());
    const [, request] = serviceMocks.executeUpdate.mock.calls[0];

    expect(request.planData.special_instructions).toBe("Somente administrativo");
    // Structural fields must be absent from the wire payload entirely.
    for (const forbidden of [
      "food_type",
      "amount_grams_per_day",
      "meals_per_day",
      "timezone",
      "valid_from",
      "valid_until",
      "meal_schedule",
      "supplements",
      "hydration_ml",
    ]) {
      expect(request.planData).not.toHaveProperty(forbidden);
    }
  });

  it("a retryable failure keeps the same operationId AND the same expectedRevision", async () => {
    serviceMocks.executeUpdate.mockRejectedValueOnce({
      firebaseCode: "unavailable",
      message: "Serviço temporariamente indisponível.",
      retryable: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("edit-plan-retry")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("edit-plan-retry"));

    await waitFor(() => expect(serviceMocks.executeUpdate).toHaveBeenCalledTimes(2));

    const first = serviceMocks.executeUpdate.mock.calls[0][1];
    const second = serviceMocks.executeUpdate.mock.calls[1][1];
    expect(second.operationId).toBe(first.operationId);
    expect(second.expectedRevision).toBe(first.expectedRevision);
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
  });

  it("does not auto-retry a revision-conflict", async () => {
    serviceMocks.executeUpdate.mockRejectedValue({
      firebaseCode: "failed-precondition",
      domainCode: "revision-conflict",
      message: "O plano foi alterado por outra operação.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("edit-plan-error")).toBeInTheDocument());

    // One attempt only, no retry affordance, no second operationId.
    expect(serviceMocks.executeUpdate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("edit-plan-retry")).not.toBeInTheDocument();
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
  });
});

describe("WEB-01B.5 — post-success revision seam", () => {
  it("does not reopen EDIT while the reader still reports the superseded revision", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeUpdate).toHaveBeenCalledTimes(1));

    // Close while the reader is still on revision 3; the backend confirmed 4.
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
    // The plan itself remains readable.
    expect(screen.getByTestId("nutrition-canonical-card")).toBeInTheDocument();
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
  });

  it("releases the latch once the reader reports the new revision", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));
    await waitFor(() => expect(serviceMocks.executeUpdate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("edit-plan-close"));
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();

    // Realtime reader catches up to revision 4.
    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
  });

  it("a second UPDATE after reconciliation uses the NEW revision", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Primeira alteração");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));
    await waitFor(() => expect(serviceMocks.executeUpdate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    serviceMocks.generateOperationId.mockReturnValue("op-update-2");
    openEdit();
    expect(screen.getByTestId("edit-plan-expected-revision")).toHaveTextContent("4");

    editInstructions("Segunda alteração");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeUpdate).toHaveBeenCalledTimes(2));
    const second = serviceMocks.executeUpdate.mock.calls[1][1];
    expect(second.expectedRevision).toBe(4);
    // A new logical operation, therefore a new operationId.
    expect(second.operationId).toBe("op-update-2");
  });

  it("releases the latch if the reader leaves canonical entirely", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));
    await waitFor(() => expect(serviceMocks.executeUpdate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("edit-plan-close"));

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

    // Error surface, not a stale canonical card with a hidden button.
    expect(screen.queryByTestId("nutrition-canonical-card")).not.toBeInTheDocument();
  });

  it("a latch from one K9 never suppresses EDIT for another", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));
    await waitFor(() => expect(serviceMocks.executeUpdate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("edit-plan-close"));
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();

    // Route changes to a different K9 that also has a canonical plan.
    const other = canonicalState(2);
    (other as unknown as { dogId: string }).dogId = "dog-2";
    mockUseNutritionPlans.mockReturnValue(other);
    rerender(<NutritionPlanPanel dogId="dog-2" />);

    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
  });

  it("an idempotent replay also latches", async () => {
    serviceMocks.executeUpdate.mockResolvedValue({
      success: true,
      planId: "plan-1",
      status: "active",
      revision: 4,
      wasNoOp: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("edit-plan-success")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
  });

  it("a failed UPDATE does NOT latch, so the operator can correct and retry", async () => {
    serviceMocks.executeUpdate.mockRejectedValue({
      firebaseCode: "invalid-argument",
      domainCode: "validation",
      message: "Dados inválidos.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("edit-plan-error")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
  });
});

describe("WEB-01B.5 — stale plan while the dialog is open", () => {
  it("blocks submit when the reader advanced the revision underneath the form", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");

    // Another actor changed the plan while this dialog was open.
    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("edit-plan-stale")).toBeInTheDocument();
    expect(screen.getByTestId("edit-plan-submit")).toBeDisabled();
    expect(serviceMocks.executeUpdate).not.toHaveBeenCalled();
  });
});
