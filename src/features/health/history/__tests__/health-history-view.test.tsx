import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HealthHistoryView } from "../presentation/health-history-view";
import { useHealthHistoryData } from "../hooks/use-health-history-data";
import type { HealthHistoryAggregate, HealthTimelineItem } from "../domain/health-history-types";

vi.mock("../hooks/use-health-history-data", () => ({
  useHealthHistoryData: vi.fn(),
}));

describe("HealthHistoryView Presentation Component", () => {
  const mockItem: HealthTimelineItem = {
    id: "clinical:case-1",
    dogId: "dog-1",
    dogName: "Atlas",
    dogRegistrationNumber: "RG-500",
    category: "clinical",
    title: "Lesão Articular",
    summary: "Caso clínico sob tratamento veterinário.",
    effectiveDate: new Date("2026-09-18T10:00:00.000Z"),
    registrationDate: new Date("2026-09-18T10:00:00.000Z"),
    actor: "Vet Marcos",
    professional: "Dr. Marcos",
    source: "canonical",
    sourceEntity: "clinical_case",
    status: "under_treatment",
    statusLabel: "Em Tratamento",
    impact: "high",
    link: "/health/clinical/case-1",
    dataQuality: "complete",
  };

  const mockAggregate: HealthHistoryAggregate = {
    allItems: [mockItem],
    filteredItems: [mockItem],
    totalCount: 1,
    countsByCategory: { clinical: 1, schedule: 0, restriction: 0 },
    referenceDate: new Date("2026-09-20T12:00:00.000Z"),
    isPartial: false,
    filter: { category: "all", period: "all", search: "" },
    coverageSummary: { totalDogsInScope: 1, complete: true, notes: [] },
  };

  it("renders LoadingState when state is loading", () => {
    vi.mocked(useHealthHistoryData).mockReturnValue({
      state: { status: "loading" },
      authorityStatus: "allowed",
      filter: { category: "all", period: "all", search: "" },
      setCategory: vi.fn(),
      setPeriod: vi.fn(),
      setSearch: vi.fn(),
      resetFilters: vi.fn(),
      refresh: vi.fn(),
    });

    render(<HealthHistoryView />);
    expect(screen.getByText(/Carregando histórico do domínio Health.../i)).toBeDefined();
  });

  it("renders ForbiddenState when authorityStatus is forbidden", () => {
    vi.mocked(useHealthHistoryData).mockReturnValue({
      state: { status: "forbidden", requiredCapability: "health.read", message: "Acesso não autorizado." },
      authorityStatus: "forbidden",
      filter: { category: "all", period: "all", search: "" },
      setCategory: vi.fn(),
      setPeriod: vi.fn(),
      setSearch: vi.fn(),
      resetFilters: vi.fn(),
      refresh: vi.fn(),
    });

    render(<HealthHistoryView />);
    expect(screen.getByText(/Acesso proibido/i)).toBeDefined();
    expect(screen.getByText(/Capacidade requerida: health.read/i)).toBeDefined();
  });

  it("renders ErrorState with retry button when state is error", () => {
    const refreshMock = vi.fn();
    vi.mocked(useHealthHistoryData).mockReturnValue({
      state: { status: "error", code: "HISTORY_LOAD_FAILED", message: "Falha de rede ao consultar histórico.", retryable: true },
      authorityStatus: "allowed",
      filter: { category: "all", period: "all", search: "" },
      setCategory: vi.fn(),
      setPeriod: vi.fn(),
      setSearch: vi.fn(),
      resetFilters: vi.fn(),
      refresh: refreshMock,
    });

    render(<HealthHistoryView />);
    expect(screen.getByText(/Erro ao carregar/i)).toBeDefined();
    expect(screen.getByText(/Falha de rede ao consultar histórico./i)).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: /Tentar novamente/i });
    fireEvent.click(retryBtn);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("renders EmptyState when scope is genuinely empty", () => {
    vi.mocked(useHealthHistoryData).mockReturnValue({
      state: { status: "empty", query: "health-history" },
      authorityStatus: "allowed",
      filter: { category: "all", period: "all", search: "" },
      setCategory: vi.fn(),
      setPeriod: vi.fn(),
      setSearch: vi.fn(),
      resetFilters: vi.fn(),
      refresh: vi.fn(),
    });

    render(<HealthHistoryView />);
    expect(screen.getByText(/Nenhum registro no histórico/i)).toBeDefined();
  });

  it("renders timeline item and filters on successful records", () => {
    vi.mocked(useHealthHistoryData).mockReturnValue({
      state: { status: "success", data: mockAggregate, fetchedAt: new Date() },
      authorityStatus: "allowed",
      filter: { category: "all", period: "all", search: "" },
      setCategory: vi.fn(),
      setPeriod: vi.fn(),
      setSearch: vi.fn(),
      resetFilters: vi.fn(),
      refresh: vi.fn(),
    });

    render(<HealthHistoryView />);
    expect(screen.getByTestId("health-history-filters")).toBeDefined();
    expect(screen.getByText("Atlas")).toBeDefined();
    expect(screen.getByText("Lesão Articular")).toBeDefined();
    expect(screen.getByText("RG-500")).toBeDefined();
  });

  it("renders partial coverage warning banner when state is partial", () => {
    const partialAggregate: HealthHistoryAggregate = {
      ...mockAggregate,
      isPartial: true,
      coverageSummary: {
        totalDogsInScope: 2,
        complete: false,
        notes: ["Casos clínicos com cobertura parcial em alguns cães"],
      },
    };

    vi.mocked(useHealthHistoryData).mockReturnValue({
      state: { status: "partial", partialData: partialAggregate, failedSources: ["clinical"], successfulSources: ["schedule", "readiness"] },
      authorityStatus: "allowed",
      filter: { category: "all", period: "all", search: "" },
      setCategory: vi.fn(),
      setPeriod: vi.fn(),
      setSearch: vi.fn(),
      resetFilters: vi.fn(),
      refresh: vi.fn(),
    });

    render(<HealthHistoryView />);
    expect(screen.getByTestId("history-partial-warning")).toBeDefined();
    expect(screen.getByText(/Casos clínicos com cobertura parcial em alguns cães/i)).toBeDefined();
  });

  it("renders filter-empty state with reset button when filters match 0 items", () => {
    const emptyFilterAggregate: HealthHistoryAggregate = {
      ...mockAggregate,
      filteredItems: [],
    };
    const resetMock = vi.fn();

    vi.mocked(useHealthHistoryData).mockReturnValue({
      state: { status: "success", data: emptyFilterAggregate, fetchedAt: new Date() },
      authorityStatus: "allowed",
      filter: { category: "all", period: "all", search: "termo-inexistente" },
      setCategory: vi.fn(),
      setPeriod: vi.fn(),
      setSearch: vi.fn(),
      resetFilters: resetMock,
      refresh: vi.fn(),
    });

    render(<HealthHistoryView />);
    expect(screen.getByTestId("history-filter-empty")).toBeDefined();
    expect(screen.getByText(/Nenhum evento corresponde aos filtros/i)).toBeDefined();

    const resetBtn = screen.getByTestId("history-reset-filters-btn");
    fireEvent.click(resetBtn);
    expect(resetMock).toHaveBeenCalledTimes(1);
  });
});
