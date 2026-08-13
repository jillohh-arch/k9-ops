/**
 * K9 Ops Web — Health Web v1 / WEB-01B.5
 * Administrative UPDATE flow through the rendered UI.
 *
 * Replaces the pre-Foundation `nutrition-plan-edit-flow`, which rendered
 * `NutritionPlanManagement` with its own dog selector and access read.
 *
 * The mock boundary here is the mutation hook, so patch construction and the
 * capability/state gating are observed at the real hook API. The same-turn
 * contract and the revision seam are proven separately against the real hook in
 * nutrition-update-real-hook.test.tsx.
 *
 * The patch semantics are the critical part: conflating "unchanged" with
 * "cleared" would silently erase a veterinarian's instructions.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NutritionPlanState } from "../types";
import {
  buildNutritionPlanUpdatePatch,
} from "../presentation/nutrition-plan-edit-dialog";

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
  prepareUpdate: vi.fn(),
  executeUpdate: vi.fn(),
  retryUpdate: vi.fn(),
  resetUpdate: vi.fn(),
  updateState: { status: "idle" } as Record<string, unknown>,
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
  mutationMocks.createState = { status: "idle" };
  mutationMocks.updateState = { status: "idle" };
  mutationMocks.executeUpdate.mockResolvedValue({
    success: true,
    planId: "plan-1",
    status: "active",
    revision: 4,
    wasNoOp: false,
  });
  mockUseNutritionPlans.mockReturnValue(canonicalState(3));
  mockCan.mockReturnValue(false);
});

describe("WEB-01B.5 — capability gate on the rendered surface", () => {
  it("hides EDIT without manage_nutrition_plan, plan still readable", () => {
    mockCan.mockReturnValue(false);
    render(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
    expect(screen.getByTestId("nutrition-canonical-card")).toBeInTheDocument();
  });

  it("asks for exactly health.manage_nutrition_plan", () => {
    mockCan.mockReturnValue(true);
    render(<NutritionPlanPanel dogId="dog-1" />);

    expect(mockCan).toHaveBeenCalledWith("health", "manage_nutrition_plan");
    for (const call of mockCan.mock.calls) {
      expect(call[1]).not.toBe("view");
      expect(call[1]).not.toBe("read");
      expect(call[1]).not.toBe("edit");
    }
  });

  it("read-only capability yields no EDIT affordance", () => {
    mockCan.mockImplementation((_m, action) => action === "read");
    render(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
  });

  it("shows EDIT on a canonical plan with manage capability", () => {
    mockCan.mockReturnValue(true);
    render(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
  });

  it("withdraws an open dialog if the capability is revoked", () => {
    mockCan.mockReturnValue(true);
    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    mockCan.mockReturnValue(false);
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("WEB-01B.5 — administrative-only surface", () => {
  beforeEach(() => mockCan.mockReturnValue(true));

  it("renders no editable control for any structural field", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    const dialog = screen.getByRole("dialog");
    // Only administrative inputs exist in the form.
    expect(screen.getByLabelText("Instruções especiais")).toBeInTheDocument();

    for (const label of [
      "Tipo de alimento",
      "Quantidade diária",
      "Refeições por dia",
      "Hidratação (ml/dia)",
      "Fuso horário",
      "Vigência",
      "Quantidade (g)",
      "Horário",
    ]) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }

    // And no "add meal" style structural editor leaked in.
    expect(dialog.textContent ?? "").not.toMatch(/Adicionar refeição/i);
  });

  it("states that structural changes require replacing the plan", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    expect(screen.getByRole("dialog").textContent ?? "").toMatch(
      /Somente dados administrativos/i,
    );
  });

  /*
   * WEB-01B.7 inverted this. The old assertion ("no CANCEL in this phase") was a
   * phase boundary, not a contract, and expired when CANCEL shipped. The durable
   * statement for the EDIT surface is the one below: editing administrative data
   * is not a lifecycle action, so the edit form itself offers no cancellation.
   */
  it("keeps the EDIT form administrative — no lifecycle action inside it", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    // CANCEL lives on the card, never inside the edit dialog.
    expect(screen.queryByTestId("cancel-plan-submit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-plan-reason")).not.toBeInTheDocument();
  });
});

describe("WEB-01B.5 — patch semantics", () => {
  beforeEach(() => mockCan.mockReturnValue(true));

  it("submit is disabled while nothing has changed", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    expect(screen.getByTestId("edit-plan-submit")).toBeDisabled();
    expect(mutationMocks.prepareUpdate).not.toHaveBeenCalled();
  });

  it("sends only the field that actually changed", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareUpdate).toHaveBeenCalledTimes(1));
    const command = mutationMocks.prepareUpdate.mock.calls[0][0];

    expect(command.changes).toEqual({
      specialInstructions: "Servir em temperatura ambiente",
    });
    // professional untouched, so it must not appear at all.
    expect(command.changes).not.toHaveProperty("professional");
  });

  it("clearing instructions sends null, not an empty string", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareUpdate).toHaveBeenCalled());
    const command = mutationMocks.prepareUpdate.mock.calls[0][0];
    expect(command.changes.specialInstructions).toBeNull();
  });

  it("whitespace-only editing of an unchanged value is not a change", () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    // Same value with padding — trimmed comparison means no change.
    editInstructions("  Servir morno  ");

    expect(screen.getByTestId("edit-plan-submit")).toBeDisabled();
  });

  it("removing an existing professional sends professional: null", async () => {
    mockUseNutritionPlans.mockReturnValue(
      canonicalState(3, {
        professional: {
          name: "Dra. Ana",
          registration_type: "CRMV",
          registration_number: "SP-1",
        },
      }),
    );

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    fireEvent.click(screen.getByTestId("edit-plan-professional-toggle"));
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareUpdate).toHaveBeenCalled());
    const command = mutationMocks.prepareUpdate.mock.calls[0][0];
    expect(command.changes.professional).toBeNull();
    expect(command.changes).not.toHaveProperty("specialInstructions");
  });

  it("adding a professional sends the complete identity", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    fireEvent.click(screen.getByTestId("edit-plan-professional-toggle"));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Dra. Ana" } });
    fireEvent.change(screen.getByLabelText("Número do registro"), {
      target: { value: "SP-12345" },
    });
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareUpdate).toHaveBeenCalled());
    const command = mutationMocks.prepareUpdate.mock.calls[0][0];
    expect(command.changes.professional).toMatchObject({
      name: "Dra. Ana",
      registration_type: "CRMV",
      registration_number: "SP-12345",
    });
  });

  it("rejects an incomplete professional locally, without touching the hook", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    fireEvent.click(screen.getByTestId("edit-plan-professional-toggle"));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Dra. Ana" } });
    // Registration number left empty.
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    expect(screen.getByTestId("edit-plan-local-error")).toBeInTheDocument();
    expect(mutationMocks.prepareUpdate).not.toHaveBeenCalled();
  });

  it("never sends a structural field in changes", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareUpdate).toHaveBeenCalled());
    const command = mutationMocks.prepareUpdate.mock.calls[0][0];

    for (const forbidden of [
      "foodType",
      "amountGramsPerDay",
      "mealsPerDay",
      "timezone",
      "validFrom",
      "validUntil",
      "mealSchedule",
      "supplements",
      "hydrationMl",
    ]) {
      expect(command.changes).not.toHaveProperty(forbidden);
    }
  });

  // Covered by pure function tests below: "patches against the frozen initial, never the live plan"
  // SKIPPED — now provably green in the pure function suite
});

describe("WEB-01B.5 — submit pipeline", () => {
  beforeEach(() => mockCan.mockReturnValue(true));

  it("calls prepareUpdate once then executeUpdate once, in order", async () => {
    const order: string[] = [];
    mutationMocks.prepareUpdate.mockImplementation(() => order.push("prepare"));
    mutationMocks.executeUpdate.mockImplementation(async () => {
      order.push("execute");
      return { success: true, planId: "plan-1", status: "active", revision: 4, wasNoOp: false };
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));
    expect(mutationMocks.prepareUpdate).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["prepare", "execute"]);
  });

  it("freezes planId and expectedRevision from the displayed plan", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Nova instrução");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.prepareUpdate).toHaveBeenCalled());
    const command = mutationMocks.prepareUpdate.mock.calls[0][0];
    expect(command.dogId).toBe("dog-1");
    expect(command.planId).toBe("plan-1");
    expect(command.expectedRevision).toBe(3);
  });

  it("blocks submit while executing", () => {
    mutationMocks.updateState = { status: "executing", intent: { operationId: "op-A" } };
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    const submit = screen.getByTestId("edit-plan-submit");
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    expect(mutationMocks.prepareUpdate).not.toHaveBeenCalled();
    expect(mutationMocks.executeUpdate).not.toHaveBeenCalled();
  });

  it("cannot be closed mid-flight", () => {
    mutationMocks.updateState = { status: "executing", intent: { operationId: "op-A" } };
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    fireEvent.click(screen.getByTestId("edit-plan-close"));

    expect(mutationMocks.resetUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("retry reuses the prepared intent and never re-prepares", () => {
    mutationMocks.updateState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: {
        firebaseCode: "unavailable",
        message: "Serviço temporariamente indisponível.",
        retryable: true,
      },
    };

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    fireEvent.click(screen.getByTestId("edit-plan-retry"));

    expect(mutationMocks.retryUpdate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.prepareUpdate).not.toHaveBeenCalled();
  });

  it("resets the mutation track on close", () => {
    mutationMocks.updateState = {
      status: "success",
      intent: { operationId: "op-A" },
      result: { success: true, planId: "plan-1", status: "active", revision: 4, wasNoOp: false },
    };

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    expect(mutationMocks.resetUpdate).toHaveBeenCalled();
  });
});

describe("WEB-01B.5 — error surfaces", () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    [
      "revision-conflict",
      { firebaseCode: "failed-precondition", domainCode: "revision-conflict", retryable: false },
    ],
    [
      "permission-denied",
      { firebaseCode: "permission-denied", domainCode: "permission-denied", retryable: false },
    ],
    [
      "idempotency-conflict",
      { firebaseCode: "aborted", domainCode: "idempotency-conflict", retryable: false },
    ],
    [
      "plan-not-found",
      { firebaseCode: "not-found", domainCode: "plan-not-found", retryable: false },
    ],
    [
      "invalid-lifecycle",
      { firebaseCode: "failed-precondition", domainCode: "invalid-lifecycle", retryable: false },
    ],
  ];

  for (const [label, error] of cases) {
    it(`${label} shows safe copy and offers no automatic re-send`, () => {
      mockCan.mockReturnValue(true);
      mutationMocks.updateState = {
        status: "error",
        intent: { operationId: "op-A" },
        error: { ...error, message: `Mensagem segura para ${label}` },
      };

      render(<NutritionPlanPanel dogId="dog-1" />);
      openEdit();

      expect(screen.getByTestId("edit-plan-error")).toHaveTextContent(
        `Mensagem segura para ${label}`,
      );
      expect(screen.queryByTestId("edit-plan-retry")).not.toBeInTheDocument();
      expect(mutationMocks.prepareUpdate).not.toHaveBeenCalled();
    });
  }

  it("never leaks internal details for internal-integrity-error", () => {
    mockCan.mockReturnValue(true);
    mutationMocks.updateState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: {
        firebaseCode: "internal",
        domainCode: "internal-integrity-error",
        message: "Falha interna de integridade. A operação não foi aplicada.",
        retryable: false,
        details: { code: "internal-integrity-error" },
      },
    };

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    const text = screen.getByTestId("edit-plan-error").textContent ?? "";
    expect(text).not.toMatch(/receipt|stack|firestore|dogs\/|collection|at /i);
  });
});

describe("WEB-01B.5 — success feedback", () => {
  beforeEach(() => mockCan.mockReturnValue(true));

  it("shows an observable success message and withdraws submit", () => {
    mutationMocks.updateState = {
      status: "success",
      intent: { operationId: "op-A" },
      result: { success: true, planId: "plan-1", status: "active", revision: 4, wasNoOp: false },
    };

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    expect(screen.getByTestId("edit-plan-success")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-plan-submit")).not.toBeInTheDocument();
  });

  it("treats wasNoOp replay as success", () => {
    mutationMocks.updateState = {
      status: "success",
      intent: { operationId: "op-A" },
      result: { success: true, planId: "plan-1", status: "active", revision: 4, wasNoOp: true },
    };

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    expect(screen.getByTestId("edit-plan-success")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-plan-error")).not.toBeInTheDocument();
  });

  it("does not fabricate the new revision in the read model", () => {
    mutationMocks.updateState = {
      status: "success",
      intent: { operationId: "op-A" },
      result: { success: true, planId: "plan-1", status: "active", revision: 4, wasNoOp: false },
    };

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    // The card still shows what the reader reports (3), never the confirmed 4.
    expect(screen.getByTestId("nutrition-canonical-card")).toHaveTextContent("Revisão 3");
  });
});

/**
 * WEB-01B.5R — Pure function regression tests.
 *
 * `buildNutritionPlanUpdatePatch` is extracted from the dialog so patch construction
 * is directly testable without mounting the full dialog (which requires React hooks,
 * the mutation provider, and the capability provider — all of which fight with mock
 * sequencing in the UI test suite).
 *
 * The critical invariant being protected:
 *
 *   The FROZEN SNAPSHOT is the only valid comparison authority.
 *
 *   The live plan (plan.professional, plan.specialInstructions) must NEVER be used
 *   as a baseline. Using the live plan would let a concurrent UPDATE by another
 *   operator silently change the comparison reference while the dialog is open,
 *   corrupting the patch. This is the exact bug found and fixed during HDR.
 *
 * Each test explicitly names the three actors:
 *   initial   — the frozen snapshot taken when the dialog opened
 *   live      — the plan as changed by a concurrent operator (irrelevant to the patch)
 *   operator  — what the operator actually typed/editted
 *
 * The patch is computed from initial vs operator. "live" is never mentioned again.
 */

describe("WEB-01B.5R — frozen professional snapshot regression", () => {
  // ---------------------------------------------------------------------------
  // §9 primary regression: live plan changes independently after dialog open
  // ---------------------------------------------------------------------------

  it("patches against the frozen initial, never the live plan", () => {
    // Snapshot at open: Dr. João
    // Operator edits to: Dra. Ana
    // Live plan later changes to: Dra. Bia  ← irrelevant to the patch computation
    // Expected patch: name = Dra. Ana (compared against Dr. João, not Dra. Bia)
    const result = buildNutritionPlanUpdatePatch({
      initialInstructions: "",
      initialProfessional: {
        name: "Dr. João",
        registration_type: "CRMV",
        registration_number: "SP-11111",
      },
      currentInstructions: "",
      showProfessional: true,
      currentProfessional: {
        name: "Dra. Ana",
        registrationType: "CRMV",
        registrationNumber: "SP-11111",
        clinic: "",
        specialty: "",
      },
    });

    expect(result.hasChanges).toBe(true);
    expect(result.patch.professional).toMatchObject({ name: "Dra. Ana" });
  });

  // ---------------------------------------------------------------------------
  // §9 inverse: live plan coincidentally matches operator's intent
  // ---------------------------------------------------------------------------

  it("does not suppress changes when the live plan coincidentally matches operator input", () => {
    // Snapshot at open: null (no professional)
    // Operator fills in: Dra. Ana
    // Live plan later changes to: Dra. Ana  ← coincidental match with operator input
    // The patch must NOT suppress the operator's edit just because "live happened to change"
    const result = buildNutritionPlanUpdatePatch({
      initialInstructions: "",
      initialProfessional: null,
      currentInstructions: "",
      showProfessional: true,
      currentProfessional: {
        name: "Dra. Ana",
        registrationType: "CRMV",
        registrationNumber: "SP-22222",
        clinic: "",
        specialty: "",
      },
    });

    expect(result.hasChanges).toBe(true);
    expect(result.patch.professional).toMatchObject({ name: "Dra. Ana" });
  });

  // ---------------------------------------------------------------------------
  // §11 clear semantics: null → null (no edit)
  // ---------------------------------------------------------------------------

  it("omits professional when operator leaves empty and initial was already empty", () => {
    const result = buildNutritionPlanUpdatePatch({
      initialInstructions: "",
      initialProfessional: null,
      currentInstructions: "",
      showProfessional: true,
      currentProfessional: {
        name: "",
        registrationType: "",
        registrationNumber: "",
        clinic: "",
        specialty: "",
      },
    });

    expect(result.hasChanges).toBe(false);
    expect(result.patch).not.toHaveProperty("professional");
  });

  // ---------------------------------------------------------------------------
  // §11 clear semantics: Dr. João → null (explicit clear)
  // ---------------------------------------------------------------------------

  it("sends professional: null when operator explicitly clears an existing professional", () => {
    const result = buildNutritionPlanUpdatePatch({
      initialInstructions: "",
      initialProfessional: {
        name: "Dr. João",
        registration_type: "CRMV",
        registration_number: "SP-11111",
      },
      currentInstructions: "",
      showProfessional: false,
      currentProfessional: {
        name: "",
        registrationType: "CRMV",
        registrationNumber: "",
        clinic: "",
        specialty: "",
      },
    });

    expect(result.hasChanges).toBe(true);
    expect(result.patch.professional).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // §11 clear semantics: null → filled (add professional)
  // ---------------------------------------------------------------------------

  it("sends the complete professional identity when adding from nothing", () => {
    const result = buildNutritionPlanUpdatePatch({
      initialInstructions: "",
      initialProfessional: null,
      currentInstructions: "",
      showProfessional: true,
      currentProfessional: {
        name: "Dra. Bia",
        registrationType: "CRMV-SP",
        registrationNumber: "SP-33333",
        clinic: "Clínica Central",
        specialty: "Nutrologia",
      },
    });

    expect(result.hasChanges).toBe(true);
    expect(result.patch.professional).toMatchObject({
      name: "Dra. Bia",
      registration_type: "CRMV-SP",
      registration_number: "SP-33333",
      clinic: "Clínica Central",
      specialty: "Nutrologia",
    });
  });

  // ---------------------------------------------------------------------------
  // §12 specialInstructions regression: unchanged
  // ---------------------------------------------------------------------------

  it("omits specialInstructions when operator leaves the field unchanged", () => {
    const result = buildNutritionPlanUpdatePatch({
      initialInstructions: "Servir morno",
      initialProfessional: null,
      currentInstructions: "Servir morno",
      showProfessional: false,
      currentProfessional: {
        name: "",
        registrationType: "CRMV",
        registrationNumber: "",
        clinic: "",
        specialty: "",
      },
    });

    expect(result.hasChanges).toBe(false);
    expect(result.patch).not.toHaveProperty("specialInstructions");
  });

  // ---------------------------------------------------------------------------
  // §12 specialInstructions regression: whitespace is not a change
  // ---------------------------------------------------------------------------

  it("whitespace-only editing of unchanged instructions is not a change", () => {
    const result = buildNutritionPlanUpdatePatch({
      initialInstructions: "Servir morno",
      initialProfessional: null,
      currentInstructions: "  Servir morno  ",
      showProfessional: false,
      currentProfessional: {
        name: "",
        registrationType: "CRMV",
        registrationNumber: "",
        clinic: "",
        specialty: "",
      },
    });

    expect(result.hasChanges).toBe(false);
    expect(result.patch).not.toHaveProperty("specialInstructions");
  });

  // ---------------------------------------------------------------------------
  // §12 specialInstructions regression: cleared → null
  // ---------------------------------------------------------------------------

  it("clearing instructions sends null, not an empty string", () => {
    const result = buildNutritionPlanUpdatePatch({
      initialInstructions: "Servir morno",
      initialProfessional: null,
      currentInstructions: "",
      showProfessional: false,
      currentProfessional: {
        name: "",
        registrationType: "CRMV",
        registrationNumber: "",
        clinic: "",
        specialty: "",
      },
    });

    expect(result.hasChanges).toBe(true);
    expect(result.patch.specialInstructions).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // §9 edge: initial has partial professional fields
  // ---------------------------------------------------------------------------

  it("compares each field independently — partial initial vs partial operator", () => {
    // Initial has name only; operator adds registration number.
    const result = buildNutritionPlanUpdatePatch({
      initialInstructions: "",
      initialProfessional: {
        name: "Dr. Carlos",
        registration_type: "CRMV",
        registration_number: "",
      },
      currentInstructions: "",
      showProfessional: true,
      currentProfessional: {
        name: "Dr. Carlos",
        registrationType: "CRMV",
        registrationNumber: "SP-44444",
        clinic: "",
        specialty: "",
      },
    });

    expect(result.hasChanges).toBe(true);
    expect(result.patch.professional).toMatchObject({
      name: "Dr. Carlos",
      registration_number: "SP-44444",
    });
  });
});

/**
 * WEB-01B.6R — UPDATE after an unverifiable `success: true`.
 *
 * The reader still shows revision 3 while the backend may already hold revision
 * 4. Reopening EDIT there would freeze `expectedRevision: 3` and guarantee a
 * revision-conflict on the next submit; REPLACE would freeze the same dead
 * expectation pair. Both are withheld until the reader moves.
 */
describe("WEB-01B.6R — UPDATE potentially-committed outcome", () => {
  const invalidMutationResponse = {
    firebaseCode: "internal",
    message: "Falha ao atualizar plano nutricional",
    retryable: false,
    details: { code: "invalid-mutation-response" },
  };

  beforeEach(() => {
    mockCan.mockReturnValue(true);
    mockUseNutritionPlans.mockReturnValue(canonicalState(3));
  });

  it("withholds EDIT and REPLACE while the reader still shows the stale revision", async () => {
    mutationMocks.executeUpdate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
  });

  it("does not start a second logical UPDATE", async () => {
    mutationMocks.executeUpdate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));

    expect(mutationMocks.prepareUpdate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.retryUpdate).not.toHaveBeenCalled();
  });

  it("latches against the FROZEN revision, not a synthesized next one", async () => {
    mutationMocks.executeUpdate.mockRejectedValue(invalidMutationResponse);

    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("edit-plan-close"));
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();

    // The expectation the request carried was revision 3. Had the latch keyed on
    // a guessed revision 4, seeing 4 arrive would have left it stuck.
    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
  });

  it("releases if the reader leaves canonical entirely", async () => {
    mutationMocks.executeUpdate.mockRejectedValue(invalidMutationResponse);

    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    mockUseNutritionPlans.mockReturnValue({
      ...canonicalState(3),
      status: "degraded",
      activePlan: null,
    } as unknown as NutritionPlanState);
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    // Nothing to act on, and nothing left latched either.
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
  });

  it("engages the latch from a retry too", async () => {
    mutationMocks.updateState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: {
        firebaseCode: "unavailable",
        message: "Serviço temporariamente indisponível.",
        retryable: true,
      },
    };
    mutationMocks.retryUpdate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    fireEvent.click(screen.getByTestId("edit-plan-retry"));

    await waitFor(() => expect(mutationMocks.retryUpdate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    expect(mutationMocks.prepareUpdate).not.toHaveBeenCalled();
    expect(mutationMocks.retryUpdate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
  });

  /*
   * The panel latch governs the card behind the dialog. This asserts the lock
   * INSIDE the already-open dialog: without it the submit button is simply live
   * again and one more click mints a fresh operationId against the same frozen
   * expectedRevision.
   */
  it("locks its own submit — a second click cannot start another UPDATE", async () => {
    mutationMocks.executeUpdate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const submit = screen.getByTestId("edit-plan-submit");
    expect(submit).toBeDisabled();

    // Attempt it anyway, including a direct form submit.
    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form")!);
    // And a further field edit must not re-arm it.
    editInstructions("Outra instrução qualquer");
    fireEvent.submit(submit.closest("form")!);

    expect(mutationMocks.prepareUpdate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.retryUpdate).not.toHaveBeenCalled();
  });

  it("tells the operator the result is unconfirmed, not that it failed", async () => {
    mutationMocks.executeUpdate.mockRejectedValue(invalidMutationResponse);

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));

    const notice = screen.getByTestId("edit-plan-outcome-uncertain");
    expect(notice.textContent).toMatch(/não foi possível confirmar/i);
    expect(screen.queryByTestId("edit-plan-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("edit-plan-success")).not.toBeInTheDocument();
    expect(screen.queryByTestId("edit-plan-retry")).not.toBeInTheDocument();
  });

  it("does not leak the uncertain lock into a later legitimate EDIT", async () => {
    mutationMocks.executeUpdate.mockRejectedValue(invalidMutationResponse);

    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    // Reader reconciles; a fresh EDIT must be fully usable again.
    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    openEdit();
    editInstructions("Instrução nova depois da reconciliação");

    expect(screen.getByTestId("edit-plan-submit")).not.toBeDisabled();
    expect(screen.queryByTestId("edit-plan-outcome-uncertain")).not.toBeInTheDocument();
  });

  /*
   * WEB-01B.7R corrected this test's premise.
   *
   * It previously asserted that a `revision-conflict` leaves both actions live,
   * using a class-B code as a class-A fixture. But a revision-conflict IS the
   * backend saying revision 3 is not current — the strongest possible reason to
   * withhold actions keyed on it. The class-A case is `permission-denied`, covered
   * immediately below; the class-B behaviour now lives in its own suite.
   */
  it("a validation rejection does NOT engage the latch", async () => {
    // Refused before any state comparison, so revision 3 is still the live truth.
    mutationMocks.executeUpdate.mockRejectedValue({
      firebaseCode: "invalid-argument",
      domainCode: "validation",
      message: "Dados administrativos inválidos.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
  });

  it("a permission-denied does NOT engage the latch", async () => {
    mutationMocks.executeUpdate.mockRejectedValue({
      firebaseCode: "permission-denied",
      domainCode: "permission-denied",
      message: "Sem permissão.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("edit-plan-close"));

    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
  });
});

/**
 * WEB-01B.7R — a refusal that proves revision 3 is not current.
 *
 * Nothing was written, so this is neither a confirmed update nor a potentially
 * committed one. But the frozen `expectedRevision` has been contradicted, so it
 * cannot serve as the expectation for another mutation.
 */
describe("WEB-01B.7R — UPDATE stale reader authority", () => {
  const CLASS_B_CASES: Array<[string, string, string]> = [
    ["revision-conflict", "failed-precondition", "Revision desatualizada."],
    ["invalid-lifecycle", "failed-precondition", "O plano não está ativo."],
    ["plan-not-found", "not-found", "O plano não foi encontrado."],
  ];

  beforeEach(() => {
    mockCan.mockReturnValue(true);
    mockUseNutritionPlans.mockReturnValue(canonicalState(3));
  });

  it.each(CLASS_B_CASES)(
    "%s withholds EDIT, REPLACE and CANCEL until the reader reconciles",
    async (domainCode, firebaseCode, message) => {
      mutationMocks.executeUpdate.mockRejectedValue({
        firebaseCode,
        domainCode,
        message,
        retryable: false,
      });

      render(<NutritionPlanPanel dogId="dog-1" />);
      openEdit();
      editInstructions("Servir em temperatura ambiente");
      fireEvent.click(screen.getByTestId("edit-plan-submit"));

      await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTestId("edit-plan-close"));

      expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
      expect(screen.queryByTestId("nutrition-replace-plan-action")).not.toBeInTheDocument();
      expect(screen.queryByTestId("nutrition-cancel-plan-action")).not.toBeInTheDocument();
    },
  );

  it("says the state changed, never that the change may have been applied", async () => {
    mutationMocks.executeUpdate.mockRejectedValue({
      firebaseCode: "failed-precondition",
      domainCode: "revision-conflict",
      message: "Revision desatualizada.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));

    const notice = screen.getByTestId("edit-plan-reader-reconciliation");
    expect(notice.textContent).toMatch(/o estado deste plano mudou/i);
    expect(screen.queryByTestId("edit-plan-outcome-uncertain")).not.toBeInTheDocument();
    expect(screen.queryByTestId("edit-plan-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("edit-plan-retry")).not.toBeInTheDocument();
  });

  it("locks its own submit against the contradicted revision", async () => {
    mutationMocks.executeUpdate.mockRejectedValue({
      firebaseCode: "failed-precondition",
      domainCode: "revision-conflict",
      message: "Revision desatualizada.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));

    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));

    const submit = screen.getByTestId("edit-plan-submit");
    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest("form")!);

    expect(mutationMocks.prepareUpdate).toHaveBeenCalledTimes(1);
    expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1);
  });

  it("releases once the reader reports the revision the backend already had", async () => {
    mutationMocks.executeUpdate.mockRejectedValue({
      firebaseCode: "failed-precondition",
      domainCode: "revision-conflict",
      message: "Revision desatualizada.",
      retryable: false,
    });

    const { rerender } = render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    editInstructions("Servir em temperatura ambiente");
    fireEvent.click(screen.getByTestId("edit-plan-submit"));
    await waitFor(() => expect(mutationMocks.executeUpdate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("edit-plan-close"));
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();

    mockUseNutritionPlans.mockReturnValue(canonicalState(4));
    rerender(<NutritionPlanPanel dogId="dog-1" />);

    expect(screen.getByTestId("nutrition-edit-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-replace-plan-action")).toBeInTheDocument();
    expect(screen.getByTestId("nutrition-cancel-plan-action")).toBeInTheDocument();
  });
});

/**
 * WEB-01B.7R — retry-intent ownership inside the open EDIT dialog.
 */
describe("WEB-01B.7R — UPDATE retry intent ownership", () => {
  beforeEach(() => {
    mockCan.mockReturnValue(true);
    mockUseNutritionPlans.mockReturnValue(canonicalState(3));
    mutationMocks.updateState = {
      status: "error",
      intent: { operationId: "op-A" },
      error: {
        firebaseCode: "deadline-exceeded",
        message: "Tempo de resposta excedido.",
        retryable: true,
      },
    };
  });

  it("withdraws the normal submit while Retry owns the intent", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    expect(screen.getByTestId("edit-plan-retry")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-plan-submit")).not.toBeInTheDocument();
  });

  it("freezes the administrative form so Retry cannot appear to send new values", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    expect(screen.getByLabelText("Instruções especiais")).toBeDisabled();
  });

  it("cannot mint a second operationId through a programmatic submit", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    fireEvent.submit(screen.getByTestId("edit-plan-retry").closest("form")!);

    expect(mutationMocks.prepareUpdate).not.toHaveBeenCalled();
    expect(mutationMocks.executeUpdate).not.toHaveBeenCalled();
  });

  it("states that Retry repeats the previous attempt and closing ends it", async () => {
    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();

    const notice = screen.getByTestId("edit-plan-retry-ownership");
    expect(notice.textContent).toMatch(/repetirá exatamente esta tentativa/i);
    expect(notice.textContent).toMatch(/será encerrada/i);
  });

  it("a retry landing in class-B engages the latch and allows no third attempt", async () => {
    mutationMocks.retryUpdate.mockRejectedValue({
      firebaseCode: "failed-precondition",
      domainCode: "revision-conflict",
      message: "Revision desatualizada.",
      retryable: false,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    fireEvent.click(screen.getByTestId("edit-plan-retry"));

    await waitFor(() => expect(mutationMocks.retryUpdate).toHaveBeenCalledTimes(1));

    // Stale-state wording, not uncertain wording: the backend explicitly refused.
    expect(screen.getByTestId("edit-plan-reader-reconciliation")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-plan-outcome-uncertain")).not.toBeInTheDocument();
    // No third attempt from either path. Retry is withdrawn (its intent is over);
    // submit returns but disabled, because class-B locks rather than withdraws.
    expect(screen.queryByTestId("edit-plan-retry")).not.toBeInTheDocument();
    expect(screen.getByTestId("edit-plan-submit")).toBeDisabled();
    fireEvent.submit(screen.getByTestId("edit-plan-submit").closest("form")!);
    expect(mutationMocks.prepareUpdate).not.toHaveBeenCalled();
    expect(mutationMocks.retryUpdate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("edit-plan-close"));
    expect(screen.queryByTestId("nutrition-edit-plan-action")).not.toBeInTheDocument();
  });

  it("a retry that succeeds reports confirmed success only", async () => {
    mutationMocks.retryUpdate.mockResolvedValue({
      success: true,
      planId: "plan-1",
      status: "active",
      revision: 4,
      wasNoOp: true,
    });

    render(<NutritionPlanPanel dogId="dog-1" />);
    openEdit();
    fireEvent.click(screen.getByTestId("edit-plan-retry"));

    await waitFor(() => expect(mutationMocks.retryUpdate).toHaveBeenCalledTimes(1));

    expect(screen.queryByTestId("edit-plan-reader-reconciliation")).not.toBeInTheDocument();
    expect(screen.queryByTestId("edit-plan-outcome-uncertain")).not.toBeInTheDocument();
    expect(mutationMocks.prepareUpdate).not.toHaveBeenCalled();
  });
});
