/**
 * K9 Ops Web — Health Web v1 / WEB-01B.6
 * Structural REPLACE against the REAL mutation hook.
 *
 * Mirrors the B.4/B.5 real-hook tests: the hook, its state machine and its
 * operationId lifecycle are the real WEB-01B.3 implementation; only the transport
 * (executeCreateNutritionPlan) is mocked. A hook that only published the prepared
 * intent through React state would make executeCreate throw no-prepared-intent,
 * which a mocked hook could never reveal.
 *
 * Everything here is unprovable with a mocked hook, which is why it is a separate
 * layer (§45):
 *
 *   - the same-turn prepare -> execute contract
 *   - one operationId per logical REPLACE, preserved across retry
 *   - the expectation pair surviving a retry unchanged
 *   - `isBusy` gating, which requires real "executing" state
 *   - the post-success seam, where the reader still shows the superseded plan
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
vi.mock("@/lib/firebase/client", () => ({ db: {}, auth: {}, storage: {}, functions: {} }));

const mockCan = vi.fn(() => true);
vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can: mockCan }),
}));

const mockUseNutritionPlans = vi.fn();
vi.mock("../hooks/use-nutrition-plans", () => ({
  useNutritionPlans: (dogId: string) => mockUseNutritionPlans(dogId),
}));

const serviceMocks = vi.hoisted(() => ({
  executeCreate: vi.fn(),
  executeCancel: vi.fn(),
  executeUpdate: vi.fn(),
  generateOperationId: vi.fn(),
}));

vi.mock("../data/nutrition-plan-mutation-service", async () => {
  const actual = await vi.importActual<
    typeof import("../data/nutrition-plan-mutation-service")
  >("../data/nutrition-plan-mutation-service");
  return {
    ...actual,
    // Real builders (including the expectation-pair validation) and real error
    // classifiers; only the callable round trips are faked.
    executeCreateNutritionPlan: serviceMocks.executeCreate,
    executeCancelNutritionPlan: serviceMocks.executeCancel,
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

function editFoodType(value: string) {
  fireEvent.change(screen.getByLabelText("Tipo de alimento"), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(true);
  mockUseNutritionPlans.mockReturnValue(canonicalState(3));
  serviceMocks.generateOperationId.mockReturnValue("op-replace-1");
  serviceMocks.executeCreate.mockResolvedValue({
    success: true,
    planId: "plan-2",
    status: "active",
    revision: 1,
    supersededPlanId: "plan-1",
    wasNoOp: false,
  });
});

describe("WEB-01B.6 — prepare -> execute against the real hook", () => {
  it("reaches the transport in the same turn, with no re-render in between", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));

    const [, request] = serviceMocks.executeCreate.mock.calls[0];
    expect(request.operationId).toBe("op-replace-1");
    expect(request.dogId).toBe("dog-1");
  });

  it("sends the expectation pair through the REAL builder", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalled());
    const [, request] = serviceMocks.executeCreate.mock.calls[0];

    // The builder throws on a partial pair, so reaching the transport at all
    // proves both halves were present.
    expect(request.expectedActivePlanId).toBe("plan-1");
    expect(request.expectedActiveRevision).toBe(3);
  });

  it("sends the structural payload in the backend's wire shape", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalled());
    const [, request] = serviceMocks.executeCreate.mock.calls[0];

    expect(request.planData.food_type).toBe("Ração Hipoalergênica");
    expect(request.planData.amount_grams_per_day).toBe(500);
    expect(request.planData.meals_per_day).toBe(2);
    expect(request.planData.meal_schedule).toHaveLength(2);
    // Administrative values carried onto the new plan, not dropped.
    expect(request.planData.special_instructions).toBe("Servir morno");
  });

  it("mints exactly one operationId per logical submit", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
  });

  it("does not send twice for one logical submit", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    const submit = screen.getByTestId("replace-plan-submit");
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalled());
    // Real "executing" state engages isBusy, which a mocked hook cannot reproduce.
    expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1);
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
  });

  it("NEVER invokes the CANCEL transport while replacing", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));

    // A client-side cancel-then-create would leave a window with zero or two
    // active plans and lose the backend's atomic supersede.
    expect(serviceMocks.executeCancel).not.toHaveBeenCalled();
    expect(serviceMocks.executeUpdate).not.toHaveBeenCalled();
  });
});

describe("WEB-01B.6 — retry replays the same operation", () => {
  it("a retryable failure keeps the operationId AND the expectation pair", async () => {
    serviceMocks.executeCreate.mockRejectedValueOnce({
      firebaseCode: "unavailable",
      message: "Serviço temporariamente indisponível.",
      retryable: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("replace-plan-retry")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("replace-plan-retry"));

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(2));

    const first = serviceMocks.executeCreate.mock.calls[0][1];
    const second = serviceMocks.executeCreate.mock.calls[1][1];
    expect(second.operationId).toBe(first.operationId);
    expect(second.expectedActivePlanId).toBe(first.expectedActivePlanId);
    expect(second.expectedActiveRevision).toBe(first.expectedActiveRevision);
    // A replay, not a second replacement.
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
  });

  it("retry sends the identical planData, not a rebuilt payload", async () => {
    serviceMocks.executeCreate.mockRejectedValueOnce({
      firebaseCode: "unavailable",
      message: "Serviço temporariamente indisponível.",
      retryable: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("replace-plan-retry")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("replace-plan-retry"));
    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(2));

    expect(serviceMocks.executeCreate.mock.calls[1][1].planData).toEqual(
      serviceMocks.executeCreate.mock.calls[0][1].planData,
    );
  });

  /*
   * WEB-01B.7R updated the premise of the two tests below, not their guarantees.
   *
   * Both codes are class-B on the REPLACE path: `active-plan-conflict` means the
   * plan we named is no longer the active one (engine 1602, 1610-1619) and
   * `revision-conflict` means the expected revision is not current (engine 1533).
   * Either way the mutation was rejected AND the expectation pair is proven stale,
   * so the reconciliation surface is correct and the ordinary error surface is not.
   *
   * Every original no-retry invariant is preserved; the authority assertions are
   * added on top.
   */
  it("does not auto-retry an active-plan-conflict and requires reader reconciliation", async () => {
    serviceMocks.executeCreate.mockRejectedValue({
      firebaseCode: "failed-precondition",
      domainCode: "active-plan-conflict",
      message: "O plano ativo foi alterado por outra operação.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("replace-plan-reader-reconciliation")).toBeInTheDocument(),
    );

    // ── Original invariants, unchanged ──────────────────────────────────────
    // One attempt, no retry affordance, no second operationId, no fallback to a
    // plain CREATE (§22).
    expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("replace-plan-retry")).not.toBeInTheDocument();
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);

    // ── New authority assertions ────────────────────────────────────────────
    expect(screen.queryByTestId("replace-plan-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("replace-plan-outcome-uncertain")).not.toBeInTheDocument();
    expect(screen.queryByTestId("replace-plan-success")).not.toBeInTheDocument();

    // No second replacement reachable against the contradicted expectation pair.
    const submit = screen.getByTestId("replace-plan-submit");
    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest("form")!);
    expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1);
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);

    // The old active snapshot is no longer actionable.
    fireEvent.click(screen.getByTestId("replace-plan-close"));
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
  });

  it("does not auto-retry a revision-conflict and requires reader reconciliation", async () => {
    serviceMocks.executeCreate.mockRejectedValue({
      firebaseCode: "failed-precondition",
      domainCode: "revision-conflict",
      message: "O plano foi alterado por outra operação.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("replace-plan-reader-reconciliation")).toBeInTheDocument(),
    );

    // ── Original invariants, unchanged ──────────────────────────────────────
    expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("replace-plan-retry")).not.toBeInTheDocument();

    // ── New authority assertions ────────────────────────────────────────────
    expect(screen.queryByTestId("replace-plan-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("replace-plan-outcome-uncertain")).not.toBeInTheDocument();
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("replace-plan-close"));
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
  });
});

describe("WEB-01B.6 — post-success temporal seam", () => {
  it("withholds EDIT and REPLACE while the reader still reports the superseded plan", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));

    // Close while the reader is still on plan-1 revision 3; the backend already
    // superseded it and activated plan-2.
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
    expect(screen.getByTestId("nutrition-canonical-card")).toBeInTheDocument();
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
  });

  it("releases the latch once the reader reports the new plan", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();

    // Firestore delivers the whole transaction to the single-collection listener
    // in one snapshot, so the reader moves straight from plan-1/3 to plan-2/1.
    mockUseNutritionPlans.mockReturnValue(
      canonicalState(1, { id: "plan-2", foodType: "Ração Hipoalergênica" }),
    );
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
  });

  it("a second REPLACE after reconciliation expects the NEW plan and revision", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    mockUseNutritionPlans.mockReturnValue(
      canonicalState(1, { id: "plan-2", foodType: "Ração Hipoalergênica" }),
    );
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    serviceMocks.generateOperationId.mockReturnValue("op-replace-2");
    openReplace();
    expect(screen.getByTestId("replace-plan-expected-id")).toHaveTextContent("plan-2");
    expect(screen.getByTestId("replace-plan-expected-revision")).toHaveTextContent("1");

    editFoodType("Ração Renal");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(2));
    const second = serviceMocks.executeCreate.mock.calls[1][1];
    expect(second.expectedActivePlanId).toBe("plan-2");
    expect(second.expectedActiveRevision).toBe(1);
    // A new logical operation, therefore a new operationId.
    expect(second.operationId).toBe("op-replace-2");
  });

  it("does not fabricate the new plan into the read model", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(serviceMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    // The response named plan-2, but the reader has not confirmed it. The card
    // must keep showing what the reader actually holds (§28).
    expect(screen.getByText("Ração Premium")).toBeInTheDocument();
    expect(screen.queryByText("Ração Hipoalergênica")).not.toBeInTheDocument();
  });

  it("an idempotent replay also latches", async () => {
    serviceMocks.executeCreate.mockResolvedValue({
      success: true,
      planId: "plan-2",
      status: "active",
      revision: 1,
      supersededPlanId: "plan-1",
      wasNoOp: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("replace-plan-success")).toBeInTheDocument());
    expect(screen.getByTestId("replace-plan-replay")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("replace-plan-close"));
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
  });

  it("a failed REPLACE does NOT latch, so the operator can correct and retry", async () => {
    serviceMocks.executeCreate.mockRejectedValue({
      firebaseCode: "invalid-argument",
      domainCode: "validation",
      message: "Dados inválidos.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("replace-plan-error")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
  });
});

describe("WEB-01B.6 — supersededPlanId correlation", () => {
  it("confirms the supersede silently when it matches the expectation", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("replace-plan-success")).toBeInTheDocument());
    expect(
      screen.queryByTestId("replace-plan-supersede-mismatch"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("replace-plan-supersede-unconfirmed"),
    ).not.toBeInTheDocument();
  });

  it("surfaces a mismatch when the backend superseded a different plan", async () => {
    serviceMocks.executeCreate.mockResolvedValue({
      success: true,
      planId: "plan-2",
      status: "active",
      revision: 1,
      supersededPlanId: "plan-99",
      wasNoOp: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("replace-plan-supersede-mismatch")).toBeInTheDocument(),
    );
    // §28 — fail closed. The source repo displayed supersededPlanId without
    // comparing it, so this would have read as a plain success. The routine
    // success banner must NOT appear, and the alarm must be an alert.
    expect(screen.queryByTestId("replace-plan-success")).not.toBeInTheDocument();
    expect(screen.getByTestId("replace-plan-supersede-mismatch")).toHaveAttribute(
      "role",
      "alert",
    );
  });

  it("reports an omitted supersededPlanId as unconfirmed, not as a mismatch", async () => {
    serviceMocks.executeCreate.mockResolvedValue({
      success: true,
      planId: "plan-2",
      status: "active",
      revision: 1,
      wasNoOp: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("replace-plan-success")).toBeInTheDocument());
    // The field is optional in the contract; absence is not an integrity alarm.
    expect(screen.getByTestId("replace-plan-supersede-unconfirmed")).toBeInTheDocument();
    expect(
      screen.queryByTestId("replace-plan-supersede-mismatch"),
    ).not.toBeInTheDocument();
  });

  it("still latches on a mismatch — the transaction happened either way", async () => {
    serviceMocks.executeCreate.mockResolvedValue({
      success: true,
      planId: "plan-2",
      status: "active",
      revision: 1,
      supersededPlanId: "plan-99",
      wasNoOp: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() =>
      expect(screen.getByTestId("replace-plan-supersede-mismatch")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    // Whatever the backend actually did, the plan on screen is no longer
    // trustworthy authority, so no further action may be started against it.
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
  });
});

describe("WEB-01B.6 — stale plan while the dialog is open", () => {
  it("blocks submit when the reader advanced the revision underneath the form", () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");

    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("replace-plan-stale")).toBeInTheDocument();
    expect(screen.getByTestId("replace-plan-submit")).toBeDisabled();
    expect(serviceMocks.executeCreate).not.toHaveBeenCalled();
    expect(serviceMocks.generateOperationId).not.toHaveBeenCalled();
  });

  it("blocks submit when another actor replaced the plan entirely", () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openReplace();
    editFoodType("Ração Hipoalergênica");

    // A different plan is now active — our expectation pair is meaningless.
    mockUseNutritionPlans.mockReturnValue(canonicalState(1, { id: "plan-7" }));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("replace-plan-stale")).toBeInTheDocument();
    expect(screen.getByTestId("replace-plan-submit")).toBeDisabled();
    expect(serviceMocks.executeCreate).not.toHaveBeenCalled();
  });
});
