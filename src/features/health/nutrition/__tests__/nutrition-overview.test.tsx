import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NutritionOverview } from "../components/nutrition-overview";

const { mockUseNutritionPlans, mockEntities } = vi.hoisted(() => ({
  mockUseNutritionPlans: vi.fn(),
  mockEntities: {
    dogs: [{ _id: "dog-a", name: "Rex" }],
    dogsLoading: false,
    error: null as string | null,
  },
}));

vi.mock("@/features/effective/providers/entities-provider", () => ({
  useEntities: () => mockEntities,
}));
vi.mock("../hooks/use-nutrition-plans", () => ({
  useNutritionPlans: mockUseNutritionPlans,
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const baseState = {
  dogId: "dog-a",
  generation: 1,
  activePlan: null,
  plans: [],
  legacyPlan: null,
  error: null,
  integrityConflict: null,
  parsingErrors: [],
};

describe("Nutrition overview explicit states", () => {
  beforeEach(() => {
    mockEntities.dogs = [{ _id: "dog-a", name: "Rex" }];
    mockEntities.dogsLoading = false;
    mockEntities.error = null;
    mockUseNutritionPlans.mockReset();
  });

  it("renders entities loading", () => {
    mockEntities.dogsLoading = true;
    render(<NutritionOverview />);
    expect(screen.getByText(/Consultando efetivo K9/)).toBeInTheDocument();
  });

  it("renders true empty entities", () => {
    mockEntities.dogs = [];
    render(<NutritionOverview />);
    expect(screen.getByText("Nenhum K9 ativo disponível")).toBeInTheDocument();
  });

  it("renders an active canonical plan", () => {
    mockUseNutritionPlans.mockReturnValue({
      ...baseState,
      status: "canonical",
      activePlan: { foodType: "Ração operacional" },
    });
    render(<NutritionOverview />);
    expect(screen.getByText("Plano ativo")).toBeInTheDocument();
    expect(screen.getByText("Ração operacional")).toBeInTheDocument();
  });

  it("renders an integrity conflict without inventing an active plan", () => {
    mockUseNutritionPlans.mockReturnValue({ ...baseState, status: "conflict" });
    render(<NutritionOverview />);
    expect(screen.getByText("Conflito de integridade")).toBeInTheDocument();
    expect(screen.queryByText("Plano ativo")).not.toBeInTheDocument();
  });

  it.each(["degraded", "error"] as const)(
    "renders insufficient/unavailable data for %s",
    (status) => {
      mockUseNutritionPlans.mockReturnValue({ ...baseState, status });
      render(<NutritionOverview />);
      expect(screen.getByText("Leitura indisponível")).toBeInTheDocument();
      expect(screen.queryByText("Sem plano ativo")).not.toBeInTheDocument();
    },
  );

  it("renders the entities error surface", () => {
    mockEntities.error = "indisponível";
    render(<NutritionOverview />);
    expect(screen.getByText(/Não foi possível consultar o efetivo K9/)).toBeInTheDocument();
  });
});
