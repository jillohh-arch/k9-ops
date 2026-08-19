/**
 * K9 Ops Web — Health Web v1 / WEB-01B.7
 * Lifecycle CANCEL against the REAL mutation hook.
 *
 * Mirrors the B.4/B.5/B.6 real-hook tests: the hook, its state machine and its
 * operationId lifecycle are the real WEB-01B.3 implementation; only the transport
 * (`executeCancelNutritionPlan`) is mocked. A hook that only published the
 * prepared intent through React state would make `executeCancel` throw
 * no-prepared-intent, and a mocked hook could never reveal that.
 *
 * This layer owns the guarantees the flow layer cannot see: same-turn
 * prepare→execute, one operationId per logical intent, retry replaying the frozen
 * intent (including the reason), and double submit.
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

// Needed by the last suite, which delegates to the REAL executor so the real
// correlation gate runs; only the callable round trip is faked.
const mockHttpsCallable = vi.hoisted(() => vi.fn());
vi.mock("firebase/functions", () => ({ httpsCallable: mockHttpsCallable }));

const mockCan = vi.fn(() => true);
vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can: mockCan }),
}));

const mockUseNutritionPlans = vi.fn();
vi.mock("../hooks/use-nutrition-plans", () => ({
  useNutritionPlans: (dogId: string) => mockUseNutritionPlans(dogId),
}));

const serviceMocks = vi.hoisted(() => ({
  executeCancel: vi.fn(),
  generateOperationId: vi.fn(),
}));

vi.mock("../data/nutrition-plan-mutation-service", async () => {
  const actual = await vi.importActual<
    typeof import("../data/nutrition-plan-mutation-service")
  >("../data/nutrition-plan-mutation-service");
  return {
    ...actual,
    // Real builders, real error classifiers, real correlation. Only the callable
    // round trip is faked.
    executeCancelNutritionPlan: serviceMocks.executeCancel,
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

function openCancel() {
  fireEvent.click(screen.getByTestId("nutrition-cancel-plan-action"));
}

function fillReason(value: string) {
  fireEvent.change(screen.getByTestId("cancel-plan-reason"), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(true);
  mockUseNutritionPlans.mockReturnValue(canonicalState(3));
  serviceMocks.generateOperationId.mockReturnValue("op-cancel-1");
  serviceMocks.executeCancel.mockResolvedValue({
    success: true,
    planId: "plan-1",
    status: "cancelled",
    revision: 4,
    wasNoOp: false,
  });
});

describe("WEB-01B.7 — prepare -> execute against the real hook", () => {
  it("reaches the transport in the same turn, with no re-render in between", async () => {
    // The real hook publishes the prepared intent to a ref synchronously. If it
    // relied on React state, executeCancel would throw no-prepared-intent here.
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Suspensão clínica da dieta");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeCancel).toHaveBeenCalledTimes(1));

    const [, request] = serviceMocks.executeCancel.mock.calls[0];
    expect(request.operationId).toBe("op-cancel-1");
    expect(request.dogId).toBe("dog-1");
    expect(request.planId).toBe("plan-1");
  });

  it("sends the revision that was displayed when the dialog opened", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeCancel).toHaveBeenCalled());
    const [, request] = serviceMocks.executeCancel.mock.calls[0];
    expect(request.expectedRevision).toBe(3);
  });

  it("sends the trimmed reason through the real builder", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("   Mudança de dieta prescrita   ");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeCancel).toHaveBeenCalled());
    const [, request] = serviceMocks.executeCancel.mock.calls[0];
    expect(request.reason).toBe("Mudança de dieta prescrita");
  });

  it("generates exactly one operationId for one logical intent", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(serviceMocks.executeCancel).toHaveBeenCalledTimes(1));
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
  });

  it("never reaches the transport with an empty reason", async () => {
    // The real `buildCancelNutritionPlanRequest` throws on an empty reason. The
    // dialog blocks first, so that throw is never even needed — proven here by the
    // transport staying untouched.
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fireEvent.submit(screen.getByTestId("cancel-plan-submit").closest("form")!);

    expect(serviceMocks.executeCancel).not.toHaveBeenCalled();
    expect(serviceMocks.generateOperationId).not.toHaveBeenCalled();
  });
});

describe("WEB-01B.7 — retry replays the frozen intent", () => {
  it("retry reuses the same operationId and never mints a new one", async () => {
    serviceMocks.executeCancel.mockRejectedValueOnce({
      firebaseCode: "unavailable",
      message: "Serviço temporariamente indisponível.",
      retryable: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo original");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("cancel-plan-retry")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("cancel-plan-retry"));

    await waitFor(() => expect(serviceMocks.executeCancel).toHaveBeenCalledTimes(2));

    const first = serviceMocks.executeCancel.mock.calls[0][1];
    const second = serviceMocks.executeCancel.mock.calls[1][1];
    expect(second.operationId).toBe(first.operationId);
    // One intent, one id — the backend can treat the retry as a safe replay.
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);
  });

  it("retry re-sends the SAME reason even after the operator edits the field", async () => {
    // The frozen intent lives in the hook. Editing the textarea after a failure
    // must not change what the retry submits under the same operationId.
    serviceMocks.executeCancel.mockRejectedValueOnce({
      firebaseCode: "unavailable",
      message: "Serviço temporariamente indisponível.",
      retryable: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo original");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("cancel-plan-retry")).toBeInTheDocument());
    fillReason("motivo totalmente diferente");
    fireEvent.click(screen.getByTestId("cancel-plan-retry"));

    await waitFor(() => expect(serviceMocks.executeCancel).toHaveBeenCalledTimes(2));

    const second = serviceMocks.executeCancel.mock.calls[1][1];
    expect(second.reason).toBe("Motivo original");
  });

  it("retry re-sends the same planId and expectedRevision", async () => {
    serviceMocks.executeCancel.mockRejectedValueOnce({
      firebaseCode: "unavailable",
      message: "Serviço temporariamente indisponível.",
      retryable: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo original");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("cancel-plan-retry")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("cancel-plan-retry"));

    await waitFor(() => expect(serviceMocks.executeCancel).toHaveBeenCalledTimes(2));

    const second = serviceMocks.executeCancel.mock.calls[1][1];
    expect(second.planId).toBe("plan-1");
    expect(second.expectedRevision).toBe(3);
  });
});

describe("WEB-01B.7 — double submit against the real hook", () => {
  it("a second click while executing cannot send a second cancellation", async () => {
    // Held in an object: a bare `let` assigned only inside the promise callback
    // gets narrowed to `null` by control-flow analysis, so the later call fails
    // to typecheck.
    const pending: { release?: (value: unknown) => void } = {};
    serviceMocks.executeCancel.mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.release = resolve;
        }),
    );

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");

    const submit = screen.getByTestId("cancel-plan-submit");
    fireEvent.click(submit);
    await waitFor(() => expect(serviceMocks.executeCancel).toHaveBeenCalledTimes(1));

    // In flight: the button is disabled and a forced submit is refused.
    expect(screen.getByTestId("cancel-plan-submit")).toBeDisabled();
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));
    fireEvent.submit(submit.closest("form")!);

    expect(serviceMocks.executeCancel).toHaveBeenCalledTimes(1);
    expect(serviceMocks.generateOperationId).toHaveBeenCalledTimes(1);

    pending.release?.({
      success: true,
      planId: "plan-1",
      status: "cancelled",
      revision: 4,
      wasNoOp: false,
    });
    await waitFor(() =>
      expect(screen.queryByTestId("cancel-plan-submit")).not.toBeInTheDocument(),
    );
  });

  it("submit is withdrawn after success, so the same intent cannot be re-sent", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(screen.getByTestId("cancel-plan-success")).toBeInTheDocument());

    expect(screen.queryByTestId("cancel-plan-submit")).not.toBeInTheDocument();
    expect(serviceMocks.executeCancel).toHaveBeenCalledTimes(1);
  });
});

describe("WEB-01B.7 — real correlation reaches the uncertain path", () => {
  it("an unverifiable success:true locks the dialog through the real service gate", async () => {
    // The real `assertCancelCorrelation` is in play here (only the callable is
    // mocked), so this proves the whole chain: impossible payload -> service
    // rejection -> uncertain outcome -> dialog lock.
    const actual = await vi.importActual<
      typeof import("../data/nutrition-plan-mutation-service")
    >("../data/nutrition-plan-mutation-service");

    serviceMocks.executeCancel.mockImplementation(async (functions, request) =>
      // Delegate to the REAL executor with a callable that answers a
      // semantically impossible payload: revision must be expectedRevision + 1.
      actual.executeCancelNutritionPlan(functions, request),
    );

    mockHttpsCallable.mockReturnValue(
      vi.fn().mockResolvedValue({
        data: {
          success: true,
          planId: "plan-1",
          status: "cancelled",
          revision: 99,
          supersededPlanId: null,
          wasNoOp: false,
        },
      }),
    );

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("cancel-plan-outcome-uncertain")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("cancel-plan-submit")).toBeDisabled();
    expect(screen.queryByTestId("cancel-plan-success")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-plan-error")).not.toBeInTheDocument();
  });
});
