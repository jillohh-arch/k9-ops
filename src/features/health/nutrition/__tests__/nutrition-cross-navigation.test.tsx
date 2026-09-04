/**
 * K9 Ops Web — Health Web v1 / NUT-WEB-5B
 * Bidirectional Health shell navigation between Nutrition and Readiness.
 *
 * Locks the contract that Nutrition per-dog and the readiness cockpit can reach
 * each other for the SAME K9, and — just as important — that this is a READ
 * AFFORDANCE ONLY:
 *
 *   - hrefs always come from the canonical `paths` builders, never from manual
 *     concatenation, so dogId encoding has a single authority;
 *   - the links require no capability (not health.view / health.read /
 *     health.edit / manage_nutrition_plan);
 *   - no management/mutation control is introduced on either side.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { paths } from "../../domain/paths";
import type { DogIdentityReadModel } from "../../domain/readiness-types";
import type { NutritionDogContextState } from "../presentation/use-nutrition-dog-context";

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

/*
 * Deliberately the most hostile permission profile: `can()` always false. If a
 * cross-navigation link still renders, it is proven to be independent of every
 * capability — which is exactly the contract.
 */
vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => ({
    can: () => false,
    status: "ready",
    profile: {
      status: "active",
      permissions: { health: { read: true } },
    },
  }),
}));

const mockDogContext = vi.fn();
vi.mock("../presentation/use-nutrition-dog-context", () => ({
  useNutritionDogContext: (dogId: string) => mockDogContext(dogId),
}));

const mockUseNutritionPlans = vi.fn((dogId: string) => ({
  status: "empty",
  dogId,
  activePlan: null,
  plans: [],
  legacyPlan: null,
  error: null,
  integrityConflict: null,
  reason: null,
}));
vi.mock("../hooks/use-nutrition-plans", () => ({
  useNutritionPlans: (dogId: string) => mockUseNutritionPlans(dogId),
}));

const { NutritionDogView } = await import("../presentation/nutrition-dog-view");
const { CockpitPreventiveEvidence } = await import(
  "../../presentation/components/health-cockpit-sections"
);

function dogIdentity(id: string): DogIdentityReadModel {
  return { id, name: `K9 ${id}`, photoUrl: null } as DogIdentityReadModel;
}

function contextFor(id: string): NutritionDogContextState {
  return { status: "success", dog: dogIdentity(id), errorMessage: null };
}

const UNAVAILABLE = { available: false, reason: "NO_PROJECTION", data: null } as never;

describe("NUT-WEB-5B — Nutrition per-dog -> readiness cockpit", () => {
  it("A. links to the cockpit of the same K9, preserving dogId", () => {
    mockDogContext.mockReturnValue(contextFor("dog-77"));
    render(<NutritionDogView dogId="dog-77" />);

    const link = screen.getByTestId("nutrition-to-cockpit-link");
    expect(link).toHaveAttribute("href", paths.health_readiness_dog("dog-77"));
    expect(link).toHaveAttribute("href", "/health/readiness/dog-77");
  });

  it("C. encodes a dogId that needs escaping, via the path authority", () => {
    mockDogContext.mockReturnValue(contextFor("dog/42"));
    render(<NutritionDogView dogId="dog/42" />);

    const link = screen.getByTestId("nutrition-to-cockpit-link");
    expect(link).toHaveAttribute("href", "/health/readiness/dog%2F42");
    expect(link).toHaveAttribute("href", paths.health_readiness_dog("dog/42"));
  });

  it("F. renders the link with no capability granted", () => {
    // The access-control mock denies everything; the link must still be there.
    mockDogContext.mockReturnValue(contextFor("dog-77"));
    render(<NutritionDogView dogId="dog-77" />);
    expect(screen.getByTestId("nutrition-to-cockpit-link")).toBeInTheDocument();
  });

  it("is a semantic link, keyboard reachable, not a clickable div", () => {
    mockDogContext.mockReturnValue(contextFor("dog-77"));
    render(<NutritionDogView dogId="dog-77" />);

    const link = screen.getByRole("link", { name: /ver prontidão deste k9/i });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href");
    // A real anchor with href is focusable without any tabindex hack.
    expect(link).not.toHaveAttribute("tabindex", "-1");
  });

  it("does not offer cross-navigation when the K9 context is unresolved", () => {
    mockDogContext.mockReturnValue({
      status: "not_found",
      dog: null,
      errorMessage: null,
    } satisfies NutritionDogContextState);
    render(<NutritionDogView dogId="ghost" />);

    expect(screen.queryByTestId("nutrition-to-cockpit-link")).not.toBeInTheDocument();
    expect(screen.getByTestId("nutrition-dog-not-found")).toBeInTheDocument();
  });
});

describe("NUT-WEB-5B — readiness cockpit -> Nutrition per-dog", () => {
  it("B. links to Nutrition of the same K9, preserving dogId", () => {
    render(
      <CockpitPreventiveEvidence
        weightEvidence={UNAVAILABLE}
        vaccinationEvidence={UNAVAILABLE}
        nutritionSummary={UNAVAILABLE}
        dogId="dog-77"
      />,
    );

    const link = screen.getByTestId("cockpit-to-nutrition-link");
    expect(link).toHaveAttribute("href", paths.health_nutrition_dog("dog-77"));
    expect(link).toHaveAttribute("href", "/health/nutrition/dogs/dog-77");
  });

  it("C. encodes a dogId that needs escaping, via the path authority", () => {
    render(
      <CockpitPreventiveEvidence
        weightEvidence={UNAVAILABLE}
        vaccinationEvidence={UNAVAILABLE}
        nutritionSummary={UNAVAILABLE}
        dogId="dog/42"
      />,
    );

    const link = screen.getByTestId("cockpit-to-nutrition-link");
    expect(link).toHaveAttribute("href", "/health/nutrition/dogs/dog%2F42");
    expect(link).toHaveAttribute("href", paths.health_nutrition_dog("dog/42"));
  });

  it("E. introduces no management action in the cockpit", () => {
    render(
      <CockpitPreventiveEvidence
        weightEvidence={UNAVAILABLE}
        vaccinationEvidence={UNAVAILABLE}
        nutritionSummary={UNAVAILABLE}
        dogId="dog-77"
      />,
    );

    // The cockpit stays strictly read-only: navigation yes, commands no.
    expect(screen.queryByRole("button")).toBeNull();
    for (const label of [
      /criar plano/i,
      /novo plano/i,
      /editar/i,
      /substituir/i,
      /cancelar plano/i,
    ]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it("stays backwards compatible when no dogId is provided", () => {
    // The pre-existing callers pass no dogId; the panel must render as before.
    render(
      <CockpitPreventiveEvidence
        weightEvidence={UNAVAILABLE}
        vaccinationEvidence={UNAVAILABLE}
        nutritionSummary={UNAVAILABLE}
      />,
    );
    expect(screen.queryByTestId("cockpit-to-nutrition-link")).not.toBeInTheDocument();
  });

  it("is a semantic link, keyboard reachable, not a clickable div", () => {
    render(
      <CockpitPreventiveEvidence
        weightEvidence={UNAVAILABLE}
        vaccinationEvidence={UNAVAILABLE}
        nutritionSummary={UNAVAILABLE}
        dogId="dog-77"
      />,
    );

    const link = screen.getByRole("link", { name: /abrir nutrição deste k9/i });
    expect(link.tagName).toBe("A");
    expect(link).not.toHaveAttribute("tabindex", "-1");
  });
});

describe("NUT-WEB-5B — bidirectional contract", () => {
  it("round-trips the same dogId through both canonical builders", () => {
    for (const dogId of ["dog-77", "dog/42", "dog 7", "cão-ç"]) {
      const toNutrition = paths.health_nutrition_dog(dogId);
      const toReadiness = paths.health_readiness_dog(dogId);

      // Neither builder leaks a raw unsafe segment, and both are reversible.
      expect(decodeURIComponent(toNutrition.split("/").pop()!)).toBe(dogId);
      expect(decodeURIComponent(toReadiness.split("/").pop()!)).toBe(dogId);
      expect(toNutrition).not.toContain("?dogId=");
      expect(toReadiness).not.toContain("?dogId=");
    }
  });
});
