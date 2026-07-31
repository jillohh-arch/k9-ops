import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NutritionPlanPage from "@/app/(app)/health/nutrition/page";

let mockParams = new URLSearchParams();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockParams,
}));

vi.mock("../components/nutrition-overview", () => ({
  NutritionOverview: () => <div>OVERVIEW_SURFACE</div>,
}));
vi.mock("../components/nutrition-plan-management", () => ({
  NutritionPlanManagement: ({
    initialDogId,
    onDogIdChange,
  }: {
    initialDogId?: string;
    onDogIdChange: (dogId: string) => void;
  }) => (
    <div>
      PLANS_SURFACE:{initialDogId ?? "none"}
      <button onClick={() => onDogIdChange("dog-b")}>PLANS_SELECT_DOG_B</button>
      <button onClick={() => onDogIdChange("")}>PLANS_CLEAR_DOG</button>
    </div>
  ),
}));
vi.mock("../components/nutrition-activity-panel", () => ({
  NutritionActivityPanel: ({
    mode,
    initialDogId,
    onDogIdChange,
  }: {
    mode: string;
    initialDogId?: string;
    onDogIdChange: (dogId: string) => void;
  }) => (
    <div>
      ACTIVITY_SURFACE:{mode}:{initialDogId ?? "none"}
      <button onClick={() => onDogIdChange("dog-b")}>SELECT_DOG_B</button>
      <button onClick={() => onDogIdChange("")}>CLEAR_DOG</button>
    </div>
  ),
}));

describe("nutrition URL source of truth", () => {
  beforeEach(() => {
    mockParams = new URLSearchParams();
    mockReplace.mockReset();
  });

  it("hydrates tab and dogId directly from the URL", () => {
    mockParams = new URLSearchParams("tab=execution&dogId=dog-a");
    render(<NutritionPlanPage />);
    expect(screen.getByText("ACTIVITY_SURFACE:execution:dog-a")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Execução" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("follows back/forward URL snapshots instead of retaining local state", () => {
    mockParams = new URLSearchParams("tab=execution&dogId=dog-a");
    const view = render(<NutritionPlanPage />);
    mockParams = new URLSearchParams("tab=history&dogId=dog-b");
    view.rerender(<NutritionPlanPage />);
    expect(screen.getByText("ACTIVITY_SURFACE:history:dog-b")).toBeInTheDocument();
  });

  it("canonicalizes an invalid tab safely", async () => {
    mockParams = new URLSearchParams("tab=not-real&dogId=dog-a");
    render(<NutritionPlanPage />);
    expect(screen.getByText("OVERVIEW_SURFACE")).toBeInTheDocument();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/health/nutrition?tab=overview&dogId=dog-a",
      ),
    );
  });

  it("does not invent a previous dog when dogId is absent", () => {
    mockParams = new URLSearchParams("tab=history");
    render(<NutritionPlanPage />);
    expect(screen.getByText("ACTIVITY_SURFACE:history:none")).toBeInTheDocument();
  });

  it("preserves dogId when switching tabs", () => {
    mockParams = new URLSearchParams("tab=overview&dogId=dog-a");
    render(<NutritionPlanPage />);
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    expect(mockReplace).toHaveBeenCalledWith(
      "/health/nutrition?tab=history&dogId=dog-a",
    );
  });

  it("writes K9 selection and clearing only through the URL", () => {
    mockParams = new URLSearchParams("tab=history&dogId=dog-a");
    render(<NutritionPlanPage />);
    fireEvent.click(screen.getByRole("button", { name: "SELECT_DOG_B" }));
    expect(mockReplace).toHaveBeenCalledWith(
      "/health/nutrition?tab=history&dogId=dog-b",
    );
    fireEvent.click(screen.getByRole("button", { name: "CLEAR_DOG" }));
    expect(mockReplace).toHaveBeenCalledWith("/health/nutrition?tab=history");
  });

  it("supports direct refresh of plans with a trimmed dogId", () => {
    mockParams = new URLSearchParams("tab=plans&dogId=%20dog-a%20");
    render(<NutritionPlanPage />);
    expect(screen.getByText("PLANS_SURFACE:dog-a")).toBeInTheDocument();
  });

  it("keeps plan selection controlled by the URL", () => {
    mockParams = new URLSearchParams("tab=plans&dogId=dog-a");
    render(<NutritionPlanPage />);
    fireEvent.click(screen.getByRole("button", { name: "PLANS_SELECT_DOG_B" }));
    expect(mockReplace).toHaveBeenCalledWith(
      "/health/nutrition?tab=plans&dogId=dog-b",
    );
    fireEvent.click(screen.getByRole("button", { name: "PLANS_CLEAR_DOG" }));
    expect(mockReplace).toHaveBeenCalledWith("/health/nutrition?tab=plans");
  });
});
