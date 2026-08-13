/**
 * K9 Ops Web — Health Web v1 / WEB-01B.7
 * Rendered CANCEL flow, with the mutation hook mocked.
 *
 * The real-hook guarantees (same-turn prepare→execute, operationId reuse, double
 * submit) are proven separately in nutrition-cancel-real-hook.test.tsx. This layer
 * covers what the operator can actually reach: the affordance, the mandatory
 * reason, the frozen snapshot, stale detection, error surfaces, the uncertain
 * outcome lock and the panel reconciliation latch.
 *
 * The source suite for CANCEL (c686ac9) contained 120 `expect(true).toBe(true)`
 * placeholders with zero renders, so nothing there could be ported. This is a
 * Foundation-specific replacement.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isValidCancelReason,
  shouldShowNutritionCancelStale,
} from "../presentation/nutrition-plan-cancel-dialog";
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
    // Real slots: the REPLACE form seeds from these, and the cross-latch test
    // below submits that form. An empty schedule would block its submit for the
    // wrong reason and prove nothing about CANCEL.
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

const INVALID_RESPONSE = {
  firebaseCode: "internal",
  message: "Falha ao cancelar plano nutricional",
  retryable: false,
  details: { code: "invalid-mutation-response" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mutationMocks.createState = { status: "idle" };
  mutationMocks.updateState = { status: "idle" };
  mutationMocks.cancelState = { status: "idle" };
  mutationMocks.executeCancel.mockResolvedValue({
    success: true,
    planId: "plan-1",
    status: "cancelled",
    revision: 4,
    wasNoOp: false,
  });
  mockUseNutritionPlans.mockReturnValue(canonicalState(3));
  mockCan.mockReturnValue(true);
});

// =============================================================================
// PURE HELPERS
// =============================================================================

describe("WEB-01B.7 — isValidCancelReason", () => {
  it("rejects an empty reason", () => {
    expect(isValidCancelReason("")).toBe(false);
  });

  it("rejects whitespace-only reasons", () => {
    expect(isValidCancelReason("   ")).toBe(false);
    expect(isValidCancelReason("\t")).toBe(false);
    expect(isValidCancelReason("\n\n")).toBe(false);
    expect(isValidCancelReason(" \t \n ")).toBe(false);
  });

  it("accepts a real reason", () => {
    expect(isValidCancelReason("Suspensão clínica da dieta")).toBe(true);
  });

  it("accepts a reason padded with whitespace", () => {
    expect(isValidCancelReason("  motivo  ")).toBe(true);
  });
});

describe("WEB-01B.7 — shouldShowNutritionCancelStale", () => {
  const base = {
    mutationStatus: "idle",
    planId: "plan-1",
    planRevision: 3,
    planStatus: "active",
    initialPlanId: "plan-1",
    initialRevision: 3,
  };

  it("is not stale when the reader matches the frozen snapshot", () => {
    expect(shouldShowNutritionCancelStale(base)).toBe(false);
  });

  it("is stale when the revision advanced", () => {
    expect(shouldShowNutritionCancelStale({ ...base, planRevision: 4 })).toBe(true);
  });

  it("is stale when the plan was swapped", () => {
    expect(shouldShowNutritionCancelStale({ ...base, planId: "plan-2" })).toBe(true);
  });

  it("is stale when the plan stopped being active", () => {
    // Cancelled or superseded elsewhere — either way there is nothing to cancel.
    expect(shouldShowNutritionCancelStale({ ...base, planStatus: "cancelled" })).toBe(true);
    expect(shouldShowNutritionCancelStale({ ...base, planStatus: "superseded" })).toBe(true);
  });

  it("stops reporting stale once the mutation resolved", () => {
    // After success the result itself explains the change; the warning would be
    // noise contradicting the success surface.
    expect(
      shouldShowNutritionCancelStale({
        ...base,
        planRevision: 4,
        mutationStatus: "success",
      }),
    ).toBe(false);
  });
});

// =============================================================================
// AFFORDANCE
// =============================================================================

describe("WEB-01B.7 — CANCEL affordance on the rendered surface", () => {
  it("shows CANCEL on a canonical active plan with manage capability", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.getByTestId("nutrition-cancel-plan-action")).toBeInTheDocument();
  });

  it("hides CANCEL without manage_nutrition_plan, plan still readable", () => {
    mockCan.mockReturnValue(false);
    render(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
    expect(screen.getByTestId("nutrition-canonical-card")).toBeInTheDocument();
  });

  it("asks for exactly health.manage_nutrition_plan", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(mockCan).toHaveBeenCalledWith("health", "manage_nutrition_plan");
    for (const call of mockCan.mock.calls) {
      expect(call[1]).not.toBe("view");
      expect(call[1]).not.toBe("read");
      expect(call[1]).not.toBe("edit");
    }
  });

  it("a read-only capability yields no CANCEL affordance", () => {
    mockCan.mockImplementation((_m: string, action: string) => action === "read");
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
  });

  it("withdraws an open dialog if the capability is revoked", () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    mockCan.mockReturnValue(false);
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-plan-submit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
  });

  it("offers no CANCEL on empty, legacy, conflict, degraded or error", () => {
    const states: Array<[string, NutritionPlanState]> = [
      ["empty", { ...canonicalState(3), status: "empty", activePlan: null } as never],
      ["legacy", { ...canonicalState(3), status: "legacy" } as never],
      ["conflict", { ...canonicalState(3), status: "conflict", activePlan: null } as never],
      ["degraded", { ...canonicalState(3), status: "degraded", activePlan: null } as never],
      [
        "error",
        {
          ...canonicalState(3),
          status: "error",
          activePlan: null,
          error: "firestore",
        } as never,
      ],
    ];

    for (const [, state] of states) {
      mockUseNutritionPlans.mockReturnValue(state);
      const { unmount } = render(<NutritionPlanPanel dogId="dog-1" />);
      expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
      unmount();
    }
  });
});

// =============================================================================
// REASON + PAYLOAD
// =============================================================================

describe("WEB-01B.7 — mandatory reason", () => {
  it("blocks submit with no reason", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();

    expect(screen.getByTestId("cancel-plan-submit")).toBeDisabled();
    expect(mutationMocks.prepareCancel).not.toHaveBeenCalled();
  });

  it("blocks submit with a whitespace-only reason", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("    ");

    expect(screen.getByTestId("cancel-plan-submit")).toBeDisabled();
    expect(mutationMocks.prepareCancel).not.toHaveBeenCalled();
  });

  it("blocks submit with tabs and newlines only", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("\t\n  \n");

    expect(screen.getByTestId("cancel-plan-submit")).toBeDisabled();
    expect(mutationMocks.prepareCancel).not.toHaveBeenCalled();
  });

  it("enables submit once a real reason is given", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Suspensão clínica");

    expect(screen.getByTestId("cancel-plan-submit")).not.toBeDisabled();
  });

  it("never pre-fills a reason", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();

    // A fabricated default would be recorded in history as if the operator wrote it.
    expect((screen.getByTestId("cancel-plan-reason") as HTMLTextAreaElement).value).toBe("");
  });

  it("sends the trimmed reason", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("   Mudança de dieta prescrita   ");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareCancel).toHaveBeenCalledTimes(1));
    expect(mutationMocks.prepareCancel.mock.calls[0][0].reason).toBe(
      "Mudança de dieta prescrita",
    );
  });
});

describe("WEB-01B.7 — submit pipeline", () => {
  it("sends dogId, frozen planId and frozen expectedRevision", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareCancel).toHaveBeenCalledTimes(1));
    expect(mutationMocks.prepareCancel.mock.calls[0][0]).toEqual({
      dogId: "dog-1",
      planId: "plan-1",
      expectedRevision: 3,
      reason: "Motivo válido",
    });
  });

  it("calls prepareCancel once then executeCancel once, in order", async () => {
    const order: string[] = [];
    mutationMocks.prepareCancel.mockImplementation(() => order.push("prepare"));
    mutationMocks.executeCancel.mockImplementation(async () => {
      order.push("execute");
      return {
        success: true,
        planId: "plan-1",
        status: "cancelled",
        revision: 4,
        wasNoOp: false,
      };
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));
    expect(order).toEqual(["prepare", "execute"]);
    expect(mutationMocks.prepareCancel).toHaveBeenCalledTimes(1);
  });

  it("never touches the CREATE, UPDATE or REPLACE tracks", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalled());
    expect(mutationMocks.prepareCreate).not.toHaveBeenCalled();
    expect(mutationMocks.executeCreate).not.toHaveBeenCalled();
    expect(mutationMocks.prepareUpdate).not.toHaveBeenCalled();
    expect(mutationMocks.executeUpdate).not.toHaveBeenCalled();
  });

  it("blocks submit while executing", () => {
    mutationMocks.cancelState = { status: "executing", intent: { operationId: "op-A" } };
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();

    expect(screen.getByTestId("cancel-plan-submit")).toBeDisabled();
  });

  it("cannot be closed mid-flight", () => {
    mutationMocks.cancelState = { status: "executing", intent: { operationId: "op-A" } };
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fireEvent.click(screen.getByTestId("cancel-plan-close"));

    expect(mutationMocks.resetCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("resets the mutation track on close", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fireEvent.click(screen.getByTestId("cancel-plan-close"));

    expect(mutationMocks.resetCancel).toHaveBeenCalled();
  });
});

// =============================================================================
// FROZEN SNAPSHOT + STALE
// =============================================================================

describe("WEB-01B.7 — frozen snapshot and stale guard", () => {
  it("shows the frozen revision, not the live one", () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    expect(screen.getByTestId("cancel-plan-expected-revision").textContent).toBe("3");

    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    // Still 3: the operation belongs to the snapshot the operator reviewed.
    expect(screen.getByTestId("cancel-plan-expected-revision").textContent).toBe("3");
  });

  it("blocks submit when the reader advances the revision", () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");

    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("cancel-plan-stale")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-plan-submit")).toBeDisabled();
  });

  it("blocks submit when the reader swaps the plan", () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");

    mockUseNutritionPlans.mockReturnValue(canonicalState(1, { id: "plan-2" }));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("cancel-plan-submit")).toBeDisabled();
  });

  it("does not silently refresh expectedRevision when stale", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");

    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.submit(screen.getByTestId("cancel-plan-submit").closest("form")!);

    // No transport at all, and certainly not with a refreshed revision 4.
    expect(mutationMocks.prepareCancel).not.toHaveBeenCalled();
    expect(mutationMocks.executeCancel).not.toHaveBeenCalled();
  });
});

// =============================================================================
// ERRORS
// =============================================================================

describe("WEB-01B.7 — error surfaces", () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    [
      "permission-denied",
      {
        firebaseCode: "permission-denied",
        domainCode: "permission-denied",
        message: "Você não tem permissão para gerenciar planos alimentares.",
        retryable: false,
      },
    ],
    [
      "revision-conflict",
      {
        firebaseCode: "failed-precondition",
        domainCode: "revision-conflict",
        message: "A revisão do plano mudou. Recarregue antes de cancelar.",
        retryable: false,
      },
    ],
    [
      "plan-not-found",
      {
        firebaseCode: "not-found",
        domainCode: "plan-not-found",
        message: "Plano não encontrado.",
        retryable: false,
      },
    ],
    [
      "already-cancelled",
      {
        firebaseCode: "failed-precondition",
        domainCode: "already-cancelled",
        message: "Este plano já está cancelado.",
        retryable: false,
      },
    ],
    [
      "invalid-lifecycle",
      {
        firebaseCode: "failed-precondition",
        domainCode: "invalid-lifecycle",
        message: "Transição de ciclo de vida inválida.",
        retryable: false,
      },
    ],
    [
      "idempotency-conflict",
      {
        firebaseCode: "failed-precondition",
        domainCode: "idempotency-conflict",
        message: "Outra operação já usou este identificador.",
        retryable: false,
      },
    ],
    [
      "internal-integrity-error",
      {
        firebaseCode: "internal",
        domainCode: "internal-integrity-error",
        message: "Não foi possível concluir a operação.",
        retryable: false,
      },
    ],
  ];

  for (const [label, error] of cases) {
    it(`${label} shows safe copy and offers no automatic re-send`, () => {
      mutationMocks.cancelState = {
        status: "error",
        intent: { operationId: "op-A" },
        error,
      };
      render(<NutritionPlanPanel dogId="dog-1" />);
      openCancel();

      expect(screen.getByTestId("cancel-plan-error")).toBeInTheDocument();
      expect(screen.queryByTestId("cancel-plan-retry")).not.toBeInTheDocument();
      expect(screen.queryByTestId("cancel-plan-success")).not.toBeInTheDocument();
      // Never a raw backend detail.
      const text = screen.getByTestId("cancel-plan-error").textContent ?? "";
      expect(text).not.toMatch(/nutrition_plans|firestore|stack/i);
    });
  }

  it("already-cancelled is an error, never a fabricated success", () => {
    // The reader is the authority on the plan's status. Turning this into an
    // idempotent success would assert a cancellation this client never observed.
    mutationMocks.cancelState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: {
        firebaseCode: "failed-precondition",
        domainCode: "already-cancelled",
        message: "Este plano já está cancelado.",
        retryable: false,
      },
    };
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();

    expect(screen.getByTestId("cancel-plan-error")).toBeInTheDocument();
    expect(screen.queryByTestId("cancel-plan-success")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-plan-outcome-uncertain")).not.toBeInTheDocument();
  });

  it("a retryable error offers retry and reuses the intent", async () => {
    mutationMocks.cancelState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: {
        firebaseCode: "unavailable",
        message: "Serviço temporariamente indisponível.",
        retryable: true,
      },
    };
    mutationMocks.retryCancel.mockResolvedValue({
      success: true,
      planId: "plan-1",
      status: "cancelled",
      revision: 4,
      wasNoOp: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fireEvent.click(screen.getByTestId("cancel-plan-retry"));

    await waitFor(() => expect(mutationMocks.retryCancel).toHaveBeenCalledTimes(1));
    // Retry never re-prepares: that would mint a new operationId.
    expect(mutationMocks.prepareCancel).not.toHaveBeenCalled();
  });

  it("editing the reason after a retryable failure cannot change what retry sends", async () => {
    mutationMocks.cancelState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: {
        firebaseCode: "unavailable",
        message: "Serviço temporariamente indisponível.",
        retryable: true,
      },
    };
    mutationMocks.retryCancel.mockResolvedValue({
      success: true,
      planId: "plan-1",
      status: "cancelled",
      revision: 4,
      wasNoOp: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("motivo totalmente diferente");
    fireEvent.click(screen.getByTestId("cancel-plan-retry"));

    await waitFor(() => expect(mutationMocks.retryCancel).toHaveBeenCalledTimes(1));
    // retryCancel takes no payload — the hook replays the frozen intent, so the
    // edited textarea cannot reach the backend under the same operationId.
    expect(mutationMocks.retryCancel).toHaveBeenCalledWith();
    expect(mutationMocks.prepareCancel).not.toHaveBeenCalled();
  });
});

// =============================================================================
// CONFIRMED SUCCESS + LATCH
// =============================================================================

describe("WEB-01B.7 — confirmed success and the reconciliation latch", () => {
  it("shows success and withdraws submit", () => {
    mutationMocks.cancelState = {
      status: "success",
      intent: { operationId: "op-A" },
      result: {
        success: true,
        planId: "plan-1",
        status: "cancelled",
        revision: 4,
        wasNoOp: false,
      },
    };
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();

    expect(screen.getByTestId("cancel-plan-success")).toBeInTheDocument();
    expect(screen.queryByTestId("cancel-plan-submit")).not.toBeInTheDocument();
  });

  it("treats a wasNoOp replay as success, not as an error", () => {
    mutationMocks.cancelState = {
      status: "success",
      intent: { operationId: "op-A" },
      result: {
        success: true,
        planId: "plan-1",
        status: "cancelled",
        revision: 4,
        wasNoOp: true,
      },
    };
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();

    expect(screen.getByTestId("cancel-plan-success")).toBeInTheDocument();
    expect(screen.queryByTestId("cancel-plan-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-plan-outcome-uncertain")).not.toBeInTheDocument();
  });

  it("withholds all three actions while the reader still shows the plan active", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("cancel-plan-close"));

    // The backend cancelled plan-1 rev 3; the reader still reports it active.
    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
    // Still readable.
    expect(screen.getByTestId("nutrition-canonical-card")).toBeInTheDocument();
  });

  it("never fabricates the cancelled status or the bumped revision", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("cancel-plan-close"));

    // The card still shows what the READER says: revision 3, active.
    const card = screen.getByTestId("nutrition-canonical-card").textContent ?? "";
    expect(card).not.toMatch(/cancelad/i);
  });

  it("releases once the reader leaves the cancelled snapshot", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("cancel-plan-close"));
    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();

    // The reader reconciles to proven absence — the natural post-cancel state,
    // proven in nutrition-cancel-eligibility.test.ts.
    mockUseNutritionPlans.mockReturnValue({
      ...canonicalState(3),
      status: "empty",
      activePlan: null,
      plans: [],
      error: null,
    } as never);
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    // Latch released, and the reader now authorizes CREATE.
    expect(screen.getByTestId("nutrition-create-plan-action")).toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
  });

  it("releases to the successor's actions if the reader reports a new active plan", async () => {
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("cancel-plan-close"));

    mockUseNutritionPlans.mockReturnValue(canonicalState(1, { id: "plan-2" }));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("nutrition-cancel-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
  });

  /*
   * WEB-01B.7R corrects this test's premise.
   *
   * It previously used `revision-conflict` as the "normal rejection" fixture. That
   * was wrong: a revision-conflict is the backend telling us the revision on
   * screen is not current, which is precisely a reason to withhold actions. The
   * genuine class-A example is `permission-denied` — it can refuse a perfectly
   * current snapshot, because the auth gate never reads plan state.
   */
  it("a class-A rejection does NOT engage the latch", async () => {
    mutationMocks.executeCancel.mockRejectedValue({
      firebaseCode: "permission-denied",
      domainCode: "permission-denied",
      message: "Você não tem permissão para gerenciar planos alimentares.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("cancel-plan-close"));

    // The refusal said nothing about plan state, so the screen is still authoritative.
    expect(screen.getByTestId("nutrition-cancel-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
  });
});

/**
 * WEB-01B.7R — a refusal that contradicts the screen.
 *
 * Distinct from both other families. Nothing was written (unlike a confirmed
 * cancellation) and nothing MAY have been written (unlike an uncertain outcome) —
 * but the plan on screen is not what the backend holds, so acting on it again can
 * only be refused again.
 *
 * `already-cancelled` is the sharpest case: the backend states outright that the
 * plan the reader still shows as active has already been ended.
 */
describe("WEB-01B.7R — CANCEL stale reader authority", () => {
  const CLASS_B_CASES: Array<[string, string]> = [
    ["already-cancelled", "Este plano nutricional já foi cancelado."],
    ["revision-conflict", "A revisão do plano mudou."],
    ["invalid-lifecycle", "O plano não está ativo."],
    ["plan-not-found", "O plano não foi encontrado."],
  ];

  function rejectWith(domainCode: string, message: string) {
    mutationMocks.executeCancel.mockRejectedValue({
      firebaseCode: domainCode === "plan-not-found" ? "not-found" : "failed-precondition",
      domainCode,
      message,
      retryable: false,
    });
  }

  it.each(CLASS_B_CASES)(
    "%s withholds all three actions until the reader reconciles",
    async (domainCode, message) => {
      rejectWith(domainCode, message);

      render(<NutritionPlanPanel dogId="dog-1" />);
      openCancel();
      fillReason("Motivo válido");
      fireEvent.click(screen.getByTestId("cancel-plan-submit"));

      await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTestId("cancel-plan-close"));

      expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
      expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
      expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
      // Still readable — the operator sees the plan, just no actions against it.
      expect(screen.getByTestId("nutrition-canonical-card")).toBeInTheDocument();
    },
  );

  it("says the state changed, never that the cancellation may have completed", async () => {
    rejectWith("already-cancelled", "Este plano nutricional já foi cancelado.");

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));

    const notice = screen.getByTestId("cancel-plan-reader-reconciliation");
    expect(notice.textContent).toMatch(/o estado deste plano mudou/i);
    expect(notice.textContent).toMatch(/não foi realizada/i);
    // The uncertain wording would be a lie here: the backend explicitly refused.
    expect(screen.queryByTestId("cancel-plan-outcome-uncertain")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-plan-success")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-plan-error")).not.toBeInTheDocument();
  });

  it("locks its own submit — no second attempt against the contradicted snapshot", async () => {
    rejectWith("revision-conflict", "A revisão do plano mudou.");

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));

    const submit = screen.getByTestId("cancel-plan-submit");
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form")!);

    expect(mutationMocks.prepareCancel).toHaveBeenCalledTimes(1);
    expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1);
    expect(mutationMocks.retryCancel).not.toHaveBeenCalled();
    expect(screen.queryByTestId("cancel-plan-retry")).not.toBeInTheDocument();
  });

  it("releases once the reader leaves the contradicted snapshot", async () => {
    rejectWith("already-cancelled", "Este plano nutricional já foi cancelado.");

    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("cancel-plan-close"));
    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();

    // The reader catches up with what the backend already knew: no active plan.
    mockUseNutritionPlans.mockReturnValue({
      ...canonicalState(3),
      status: "empty",
      activePlan: null,
      plans: [],
      error: null,
    } as never);
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.queryByTestId("nutrition-canonical-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("nutrition-create-plan-action")).toBeInTheDocument();
  });
});

// =============================================================================
// UNCERTAIN OUTCOME (WEB-01B.6R pattern applied to CANCEL)
// =============================================================================

describe("WEB-01B.7 — CANCEL potentially-committed outcome", () => {
  it("engages the latch and withholds all three actions", async () => {
    mutationMocks.executeCancel.mockRejectedValue(INVALID_RESPONSE);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("cancel-plan-close"));

    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
  });

  it("locks its own submit — a second click cannot start another CANCEL", async () => {
    mutationMocks.executeCancel.mockRejectedValue(INVALID_RESPONSE);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));

    // Dialog still open, reader still A/rev3.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const submit = screen.getByTestId("cancel-plan-submit");
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form")!);

    expect(mutationMocks.prepareCancel).toHaveBeenCalledTimes(1);
    expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1);
    expect(mutationMocks.retryCancel).not.toHaveBeenCalled();
  });

  it("tells the operator the result is unconfirmed, not that it failed", async () => {
    mutationMocks.executeCancel.mockRejectedValue(INVALID_RESPONSE);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));

    const notice = screen.getByTestId("cancel-plan-outcome-uncertain");
    expect(notice.textContent).toMatch(/não foi possível confirmar/i);
    // "Falha ao cancelar" would imply the plan is still active.
    expect(screen.queryByTestId("cancel-plan-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-plan-success")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-plan-retry")).not.toBeInTheDocument();
  });

  it("closes the reason field so it cannot imply a different retry payload", async () => {
    mutationMocks.executeCancel.mockRejectedValue(INVALID_RESPONSE);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("cancel-plan-reason")).toBeDisabled();
  });

  it("engages the latch from a retry too, with no third attempt", async () => {
    mutationMocks.cancelState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: {
        firebaseCode: "unavailable",
        message: "Serviço temporariamente indisponível.",
        retryable: true,
      },
    };
    mutationMocks.retryCancel.mockRejectedValue(INVALID_RESPONSE);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fireEvent.click(screen.getByTestId("cancel-plan-retry"));

    await waitFor(() => expect(mutationMocks.retryCancel).toHaveBeenCalledTimes(1));

    // Retry withdrawn and submit locked, even though the hook error is retryable.
    expect(screen.queryByTestId("cancel-plan-retry")).not.toBeInTheDocument();
    const submit = screen.getByTestId("cancel-plan-submit");
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form")!);

    expect(mutationMocks.retryCancel).toHaveBeenCalledTimes(1);
    expect(mutationMocks.prepareCancel).not.toHaveBeenCalled();
    expect(mutationMocks.executeCancel).not.toHaveBeenCalled();
  });

  it("keeps the panel latch engaged after the dialog is closed", async () => {
    mutationMocks.executeCancel.mockRejectedValue(INVALID_RESPONSE);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId("cancel-plan-close"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
  });

  it("does not leak the uncertain lock into a later legitimate CANCEL", async () => {
    mutationMocks.executeCancel.mockRejectedValue(INVALID_RESPONSE);

    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("cancel-plan-close"));

    // Reader reports a successor; a fresh CANCEL must be fully usable.
    mockUseNutritionPlans.mockReturnValue(canonicalState(1, { id: "plan-2" }));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    openCancel();
    fillReason("Novo motivo");

    expect(screen.getByTestId("cancel-plan-submit")).not.toBeDisabled();
    expect(screen.queryByTestId("cancel-plan-outcome-uncertain")).not.toBeInTheDocument();
    expect(screen.getByTestId("cancel-plan-reason")).not.toBeDisabled();
  });
});

// =============================================================================
// CROSS-LATCHES (§40)
// =============================================================================

describe("WEB-01B.7 — cross-latch blocking", () => {
  it("a pending UPDATE withholds CANCEL", async () => {
    mutationMocks.executeUpdate.mockResolvedValue({
      success: true,
      planId: "plan-1",
      status: "active",
      revision: 4,
      wasNoOp: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-edit-plan-action"));
    fireEvent.change(screen.getByLabelText("Instruções especiais"), {
      target: { value: "Nova instrução" },
    });
    fireEvent.click(screen.getByTestId("edit-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    // The revision on screen is already superseded, so it cannot serve as
    // expectedRevision for a cancellation.
    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
  });

  it("a pending REPLACE withholds CANCEL", async () => {
    mutationMocks.executeCreate.mockResolvedValue({
      success: true,
      planId: "plan-2",
      status: "active",
      revision: 1,
      supersededPlanId: "plan-1",
      wasNoOp: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    fireEvent.click(screen.getByTestId("nutrition-replace-plan-action"));
    fireEvent.click(screen.getByTestId("replace-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCreate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("replace-plan-close"));

    // The plan on screen is already superseded; there is nothing left to cancel.
    expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
  });

  it("a pending CANCEL withholds EDIT and REPLACE", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();
    fillReason("Motivo válido");
    fireEvent.click(screen.getByTestId("cancel-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeCancel).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("cancel-plan-close"));

    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
  });
});

// =============================================================================
// COPY
// =============================================================================

describe("WEB-01B.7 — lifecycle copy, never deletion", () => {
  it("never uses deletion language", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();

    const text = screen.getByRole("dialog").textContent ?? "";
    expect(text).not.toMatch(/excluir|excluído|apagar|deletar|remover permanentemente/i);
  });

  it("states that the plan is preserved in history", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();

    const impact = screen.getByTestId("cancel-plan-impact").textContent ?? "";
    expect(impact).toMatch(/não é apagado/i);
    expect(impact).toMatch(/histórico/i);
  });

  it("states that no successor plan is created automatically", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openCancel();

    const impact = screen.getByTestId("cancel-plan-impact").textContent ?? "";
    expect(impact).toMatch(/nenhum plano novo é criado/i);
  });

  it("labels the card action 'Cancelar plano'", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.getByTestId("nutrition-cancel-plan-action").textContent).toBe(
      "Cancelar plano",
    );
  });
});
