/**
 * K9 Ops Web — Health Web v1 / WEB-01B.2
 * Nutrition read-only presentation contract.
 *
 * Covers the mapping from the read model to the rendered state, with special
 * attention to the mandatory priority `error > empty`: a read failure must
 * never be presented as "no plan registered".
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LegacyNutritionPlanView, NutritionPlan, NutritionPlanState } from "../types";
import { resolveNutritionView } from "../presentation/nutrition-read-state-view";

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
// `functions` is required since WEB-01B.4: the panel reaches the mutation hook
// to decide the CREATE affordance. No callable is ever invoked here.
vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
}));

// Default for the pre-existing WEB-01B.2 read-only assertions: no management
// capability, so no write affordance can appear in any of them.
vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({ can: () => false }),
}));

const mockUseNutritionPlans = vi.fn();
vi.mock("../hooks/use-nutrition-plans", () => ({
  useNutritionPlans: (dogId: string) => mockUseNutritionPlans(dogId),
}));

// Imported after the mock so the panel picks up the mocked hook.
const { NutritionPlanPanel } = await import("../presentation/nutrition-plan-panel");
const { NutritionPlanCanonicalCard } = await import(
  "../presentation/nutrition-plan-canonical-card"
);

function baseState(overrides: Partial<NutritionPlanState>): NutritionPlanState {
  return {
    status: "empty",
    dogId: "dog-1",
    activePlan: null,
    plans: [],
    legacyPlan: null,
    error: null,
    integrityConflict: null,
    parsingErrors: [],
    ...overrides,
  };
}

const canonicalPlan: NutritionPlan = {
  id: "plan-1",
  dogId: "dog-1",
  foodType: "Ração Premium Trabalho",
  amountGramsPerDay: 420,
  mealsPerDay: 2,
  mealSchedule: [
    { id: "s1", period: "morning", scheduledTime: "07:00", targetGrams: 210 },
    { id: "s2", period: "evening", scheduledTime: "18:00", targetGrams: 210 },
  ],
  validFrom: new Date("2026-07-01T00:00:00Z"),
  timezone: "America/Sao_Paulo",
  recordedBy: { uid: "u1", name: "Cap. Silva", internalRole: "veterinario" },
  status: "active",
  schemaVersion: 1,
  revision: 3,
};

const legacyPlan: LegacyNutritionPlanView = {
  id: "leg-1",
  dogId: "dog-1",
  foodType: "Ração Antiga",
  amountGramsPerDay: 380,
  mealsPerDay: 2,
  vigentFrom: new Date("2025-03-01T00:00:00Z"),
  legacySource: "nutritional_prescriptions",
  legacyId: "leg-1",
};

describe("WEB-01B.2 — resolveNutritionView priority", () => {
  it("loading maps to loading", () => {
    expect(resolveNutritionView(baseState({ status: "loading" })).kind).toBe("loading");
  });

  it("canonical maps to canonical", () => {
    expect(
      resolveNutritionView(baseState({ status: "canonical", activePlan: canonicalPlan })).kind,
    ).toBe("canonical");
  });

  it("legacy maps to legacy", () => {
    expect(
      resolveNutritionView(
        baseState({ status: "legacy", activePlan: legacyPlan, legacyPlan }),
      ).kind,
    ).toBe("legacy");
  });

  it("conflict maps to conflict", () => {
    expect(resolveNutritionView(baseState({ status: "conflict" })).kind).toBe("conflict");
  });

  it("degraded maps to degraded, not error", () => {
    expect(
      resolveNutritionView(baseState({ status: "degraded", reason: "partial-parsing-errors" }))
        .kind,
    ).toBe("degraded");
  });

  it("empty with error === null maps to empty", () => {
    expect(resolveNutritionView(baseState({ status: "empty", error: null })).kind).toBe("empty");
  });

  // Inherited ambiguous contract: invalid dogId yields empty + non-null error.
  it("empty with NON-NULL error maps to ERROR, never empty", () => {
    const decision = resolveNutritionView(
      baseState({ status: "empty", error: "dogId inválido" }),
    );
    expect(decision.kind).toBe("error");
    expect(decision.kind).not.toBe("empty");
  });

  // WEB-01B.1R fail-closed legacy listener failure.
  it("error/firestore-read-error maps to error", () => {
    expect(
      resolveNutritionView(
        baseState({
          status: "error",
          reason: "firestore-read-error",
          error: "Erro ao ler nutritional_prescriptions: permission-denied",
        }),
      ).kind,
    ).toBe("error");
  });

  it("never leaks the raw backend message into the operator copy", () => {
    const raw = "Erro ao ler nutritional_prescriptions: permission-denied";
    const decision = resolveNutritionView(
      baseState({ status: "error", reason: "firestore-read-error", error: raw }),
    );
    expect(decision.message).not.toContain("nutritional_prescriptions");
    expect(decision.message).not.toContain("permission-denied");
  });
});

describe("WEB-01B.2 — NutritionPlanPanel rendering", () => {
  it("renders LoadingState while loading", () => {
    mockUseNutritionPlans.mockReturnValue(baseState({ status: "loading" }));
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.getByText(/Carregando plano alimentar/i)).toBeInTheDocument();
  });

  it("renders the canonical plan", () => {
    mockUseNutritionPlans.mockReturnValue(
      baseState({ status: "canonical", activePlan: canonicalPlan, plans: [canonicalPlan] }),
    );
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.getByTestId("nutrition-canonical-card")).toBeInTheDocument();
    expect(screen.getByText("Ração Premium Trabalho")).toBeInTheDocument();
    expect(screen.getByText("420 g")).toBeInTheDocument();
  });

  it("renders the legacy view with a legacy indicator", () => {
    mockUseNutritionPlans.mockReturnValue(
      baseState({ status: "legacy", activePlan: legacyPlan, legacyPlan }),
    );
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.getByTestId("nutrition-legacy-card")).toBeInTheDocument();
    expect(screen.getByText(/Registro legado/i)).toBeInTheDocument();
  });

  it("renders the conflict state without picking a plan", () => {
    mockUseNutritionPlans.mockReturnValue(
      baseState({
        status: "conflict",
        reason: "multiple-active-plans",
        plans: [canonicalPlan],
        integrityConflict: {
          message: "Existem múltiplos planos ativos",
          activePlansCount: 2,
          activePlanIds: ["plan-1", "plan-2"],
        },
      }),
    );
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.getByText(/Conflito de dados/i)).toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-canonical-card")).not.toBeInTheDocument();
  });

  it("renders the degraded state", () => {
    mockUseNutritionPlans.mockReturnValue(
      baseState({ status: "degraded", reason: "malformed-canonical-document" }),
    );
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.getByText(/não puderam ser carregados/i)).toBeInTheDocument();
  });

  it("renders the empty state only for proven absence", () => {
    mockUseNutritionPlans.mockReturnValue(baseState({ status: "empty", error: null }));
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.getByText(/Nenhum plano alimentar ativo/i)).toBeInTheDocument();
  });

  it("renders ERROR (not empty) when a legacy listener failed", () => {
    mockUseNutritionPlans.mockReturnValue(
      baseState({
        status: "error",
        reason: "firestore-read-error",
        error: "Erro ao ler nutritional_prescriptions: permission-denied",
      }),
    );
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum plano alimentar/i)).not.toBeInTheDocument();
  });

  it("renders ERROR (not empty) for the inherited empty+error contract", () => {
    mockUseNutritionPlans.mockReturnValue(
      baseState({ status: "empty", error: "dogId inválido" }),
    );
    render(<NutritionPlanPanel dogId="dog-1" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum plano alimentar ativo/i)).not.toBeInTheDocument();
  });

  it("never exposes Firestore collections or codes in the rendered output", () => {
    mockUseNutritionPlans.mockReturnValue(
      baseState({
        status: "error",
        reason: "firestore-read-error",
        error: "Erro ao ler nutritional_prescriptions: permission-denied",
      }),
    );
    const { container } = render(<NutritionPlanPanel dogId="dog-1" />);
    expect(container.textContent).not.toContain("nutritional_prescriptions");
    expect(container.textContent).not.toContain("permission-denied");
  });

  // WEB-01B.2 §30 — the read-only surface must expose no management affordances.
  it("exposes ZERO mutation affordances in every renderable state", () => {
    const states: NutritionPlanState[] = [
      baseState({ status: "canonical", activePlan: canonicalPlan }),
      baseState({ status: "legacy", activePlan: legacyPlan, legacyPlan }),
      baseState({ status: "empty", error: null }),
      baseState({ status: "conflict" }),
      baseState({ status: "degraded" }),
    ];

    for (const state of states) {
      mockUseNutritionPlans.mockReturnValue(state);
      const { container, unmount } = render(<NutritionPlanPanel dogId="dog-1" />);
      const text = container.textContent ?? "";
      expect(text).not.toMatch(/Novo plano/i);
      expect(text).not.toMatch(/Criar plano/i);
      expect(text).not.toMatch(/Editar/i);
      expect(text).not.toMatch(/Substituir/i);
      expect(text).not.toMatch(/Cancelar/i);
      unmount();
    }
  });

  it("passes the received dogId straight to the read hook", () => {
    mockUseNutritionPlans.mockReturnValue(baseState({ status: "loading" }));
    render(<NutritionPlanPanel dogId="dog-XYZ-42" />);
    expect(mockUseNutritionPlans).toHaveBeenCalledWith("dog-XYZ-42");
  });
});

/**
 * WEB-01 VISUAL CORRECTIONS V1 — MAJOR-V2.
 *
 * The browser measured scrollWidth 429 against clientWidth 375 at 390x844: the
 * badge and the three action buttons sat in one unbreakable flex row, pushing
 * "Cancelar plano" off-screen.
 *
 * The card is rendered directly here rather than through the panel, because this is
 * a pure presentation concern — no capability, no read state, no reconciliation.
 * jsdom cannot measure the overflow itself, so these assertions pin the layout
 * mechanism that removes it; the real browser retest is the authority.
 */
describe("WEB-01 VISUAL — canonical card action layout", () => {
  function renderWithActions() {
    return render(
      <NutritionPlanCanonicalCard
        plan={canonicalPlan}
        action={
          <>
            <button type="button">Editar</button>
            <button type="button">Substituir plano</button>
            <button type="button">Cancelar plano</button>
          </>
        }
      />,
    );
  }

  it("allows the action group to wrap instead of forcing one long line", () => {
    renderWithActions();
    const actions = screen.getByTestId("nutrition-canonical-actions");
    expect(actions.className).toMatch(/flex-wrap/);
  });

  it("stacks the badge above the actions on narrow widths and restores the row at sm", () => {
    renderWithActions();
    const group = screen.getByTestId("nutrition-canonical-actions").parentElement!;
    // Column by default (narrow), row from the sm breakpoint up.
    expect(group.className).toMatch(/\bflex-col\b/);
    expect(group.className).toMatch(/sm:flex-row/);
  });

  it("keeps every action label intact — no truncation, no overflow menu", () => {
    renderWithActions();
    const actions = screen.getByTestId("nutrition-canonical-actions");
    expect(actions.textContent).toContain("Editar");
    expect(actions.textContent).toContain("Substituir plano");
    expect(actions.textContent).toContain("Cancelar plano");
    expect(actions.className).not.toMatch(/truncate|overflow-hidden/);
  });

  it("renders no action container when the caller passes no actions", () => {
    render(<NutritionPlanCanonicalCard plan={canonicalPlan} />);
    expect(screen.queryByTestId("nutrition-canonical-actions")).not.toBeInTheDocument();
  });
});
