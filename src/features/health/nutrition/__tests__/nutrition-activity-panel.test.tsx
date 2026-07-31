import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NutritionActivityPanel,
  EXECUTION_WINDOW_MILLISECONDS,
  isWithinNutritionExecutionWindow,
} from "../components/nutrition-activity-panel";
import type {
  NutritionActivityHookState,
  NutritionActivity,
} from "../hooks/use-nutrition-activity";

const { mockUseNutritionActivity } = vi.hoisted(() => ({
  mockUseNutritionActivity: vi.fn(),
}));

vi.mock("@/features/effective/providers/entities-provider", () => ({
  useEntities: () => ({
    dogs: [{ _id: "dog-a", name: "Rex" }, { _id: "dog-b", name: "Lua" }],
    dogsLoading: false,
    error: null,
  }),
}));

vi.mock("../hooks/use-nutrition-activity", () => ({
  useNutritionActivity: mockUseNutritionActivity,
}));

function emptySources() {
  const source = () => ({
    loaded: false,
    validCount: 0,
    invalidCount: 0,
    error: null,
    records: [],
  });
  return {
    meal_logs: source(),
    supplement_logs: source(),
    feeding_events: source(),
  };
}

function record(overrides: Partial<NutritionActivity> = {}): NutritionActivity {
  return {
    id: "meal_logs:meal-1",
    dogId: "dog-a",
    documentId: "meal-1",
    source: "meal_logs",
    kind: "meal",
    origin: "canonical",
    occurredAt: new Date(),
    title: "Refeição · manhã",
    detail: "100 g oferecidos",
    responsible: "Condutor",
    status: "aceita",
    notes: "Sem intercorrências",
    planId: "plan-1",
    planned: true,
    mealOccurrenceId: "occ-1",
    coexistenceFingerprint: "fp",
    legacySource: null,
    legacyId: null,
    diagnosticReferences: [],
    ...overrides,
  };
}

function state(
  status: NutritionActivityHookState["status"],
  records: NutritionActivity[] = [],
): NutritionActivityHookState {
  const sources = emptySources();
  if (status === "idle" || status === "loading") {
    return { status, records, error: null, issues: [], sources, retry: vi.fn() };
  }
  return {
    status,
    records,
    error:
      status === "error" || status === "degraded"
        ? "Leitura parcial sanitizada."
        : null,
    issues:
      status === "degraded"
        ? [{ kind: "malformed-documents", source: "meal_logs", count: 1 }]
        : [],
    sources,
    retry: vi.fn(),
  };
}

describe("Nutrition activity read-only surfaces", () => {
  beforeEach(() => {
    mockUseNutritionActivity.mockReset();
  });

  it.each(["idle", "loading"] as const)("renders %s without operational writes", (status) => {
    mockUseNutritionActivity.mockReturnValue(state(status));
    render(<NutritionActivityPanel mode="execution" initialDogId="dog-a" />);
    expect(screen.getByText(/Consultando registros/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /criar|registrar/i })).not.toBeInTheDocument();
  });

  it("renders a true empty state only from explicit empty", () => {
    mockUseNutritionActivity.mockReturnValue(state("empty"));
    render(<NutritionActivityPanel mode="execution" initialDogId="dog-a" />);
    expect(screen.getByText("Nenhum registro encontrado")).toBeInTheDocument();
  });

  it("renders MealLog, SupplementLog and legacy origin as read-only", () => {
    mockUseNutritionActivity.mockReturnValue(
      state("ready", [
        record(),
        record({
          id: "supplement_logs:s-1",
          source: "supplement_logs",
          kind: "supplement",
          title: "Ômega 3",
          detail: "1 cápsula",
        }),
        record({
          id: "feeding_events:f-1",
          documentId: "f-1",
          source: "feeding_events",
          origin: "legacy",
          title: "Refeição · noite",
        }),
      ]),
    );
    render(<NutritionActivityPanel mode="execution" initialDogId="dog-a" />);
    expect(screen.getByText("Ômega 3")).toBeInTheDocument();
    expect(screen.getAllByText("Canônico")).toHaveLength(2);
    expect(screen.getByText("Legado")).toBeInTheDocument();
    expect(screen.getByText("Somente leitura")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /criar|registrar|salvar/i })).not.toBeInTheDocument();
  });

  it("keeps valid records visible with a degraded warning", () => {
    mockUseNutritionActivity.mockReturnValue(state("degraded", [record()]));
    render(<NutritionActivityPanel mode="execution" initialDogId="dog-a" />);
    expect(screen.getByText("Leitura nutricional parcial")).toBeInTheDocument();
    expect(screen.getByText("Refeição · manhã")).toBeInTheDocument();
  });

  it("renders a sanitized terminal error", () => {
    mockUseNutritionActivity.mockReturnValue(state("error"));
    render(<NutritionActivityPanel mode="history" initialDogId="dog-a" />);
    expect(screen.getByText("Falha na leitura nutricional")).toBeInTheDocument();
    expect(screen.queryByText(/doc-|payload|stack/i)).not.toBeInTheDocument();
  });

  it("filters history while preserving responsibility, notes and origin", () => {
    mockUseNutritionActivity.mockReturnValue(
      state("ready", [
        record(),
        record({
          id: "supplement_logs:s-1",
          source: "supplement_logs",
          kind: "supplement",
          title: "Ômega 3",
        }),
      ]),
    );
    render(<NutritionActivityPanel mode="history" initialDogId="dog-a" />);
    expect(screen.getAllByText("Responsável: Condutor")).toHaveLength(2);
    expect(screen.getAllByText("Sem intercorrências")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Suplementos" }));
    expect(screen.queryByText("Refeição · manhã")).not.toBeInTheDocument();
    expect(screen.getByText("Ômega 3")).toBeInTheDocument();
  });

  it("uses the URL dog selection and delegates changes to its owner", () => {
    mockUseNutritionActivity.mockReturnValue(state("empty"));
    const onDogIdChange = vi.fn();
    render(
      <NutritionActivityPanel
        mode="history"
        initialDogId="dog-b"
        onDogIdChange={onDogIdChange}
      />,
    );
    const selector = screen.getByLabelText("Selecionar K9 para atividade nutricional");
    expect(selector).toHaveValue("dog-b");
    fireEvent.change(selector, { target: { value: "dog-a" } });
    expect(onDogIdChange).toHaveBeenCalledWith("dog-a");
  });

  it("fails safe for an invalid or missing URL dogId", () => {
    mockUseNutritionActivity.mockReturnValue(state("idle"));
    render(<NutritionActivityPanel mode="execution" initialDogId="unknown" />);
    expect(screen.getByLabelText("Selecionar K9 para atividade nutricional")).toHaveValue("");
    expect(screen.getByText("K9 inválido")).toBeInTheDocument();
    expect(mockUseNutritionActivity).toHaveBeenCalledWith("");
  });

  it("uses an inclusive 168-hour execution window and excludes future records", () => {
    const now = Date.parse("2026-07-31T12:00:00.000Z");
    expect(
      isWithinNutritionExecutionWindow(
        new Date(now - EXECUTION_WINDOW_MILLISECONDS),
        now,
      ),
    ).toBe(true);
    expect(
      isWithinNutritionExecutionWindow(
        new Date(now - EXECUTION_WINDOW_MILLISECONDS - 1),
        now,
      ),
    ).toBe(false);
    expect(isWithinNutritionExecutionWindow(new Date(now + 1), now)).toBe(false);
  });

  it("does not show an empty/filter message when degraded has zero valid records", () => {
    mockUseNutritionActivity.mockReturnValue(state("degraded"));
    render(<NutritionActivityPanel mode="execution" initialDogId="dog-a" />);
    expect(screen.getByText("Leitura nutricional parcial")).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum registro/i)).not.toBeInTheDocument();
  });
});
