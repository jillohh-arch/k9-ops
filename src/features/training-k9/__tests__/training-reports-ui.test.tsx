/**
 * UI tests for the Training Reports tab components.
 *
 * These tests verify the display logic of:
 * - KPI formatting (truncation, sub-descriptions)
 * - Data quality warning display
 * - Section shell rendering
 * - Filter behavior (via static imports)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ─── Firebase mock ────────────────────────────────────────────────────────────────

vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  firebaseApp: {},
  functions: {},
}));

// ─── Next.js mocks ──────────────────────────────────────────────────────────────

const navigationMock = vi.hoisted(() => {
  const params = new Map<string, string>();
  const routerPush = vi.fn();
  const routerReplace = vi.fn();
  const searchParams = {
    get: (key: string) => params.get(key) ?? null,
    toString: () => {
      const qs = new URLSearchParams();
      for (const [k, v] of params.entries()) qs.set(k, v);
      return qs.toString();
    },
  };
  return { params, routerPush, routerReplace, searchParams };
});

vi.mock("next/navigation", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useSearchParams: vi.fn(() => navigationMock.searchParams),
    usePathname: vi.fn(() => "/training"),
    useRouter: vi.fn(() => ({
      push: (...args: unknown[]) => navigationMock.routerPush(...args),
      replace: (...args: unknown[]) => navigationMock.routerReplace(...args),
    })),
  };
});

// Helpers for tests to simulate URL changes
function resetNavigation() {
  navigationMock.params.clear();
  navigationMock.routerPush.mockClear();
  navigationMock.routerReplace.mockClear();
}
function setUrl(params: Record<string, string>) {
  navigationMock.params.clear();
  for (const [k, v] of Object.entries(params)) navigationMock.params.set(k, v);
}

// ─── Direct imports for unit testing ───────────────────────────────────────────

import { ReportKpis } from "../components/reports/report-kpis";
import { ReportDataQuality } from "../components/reports/report-data-quality";
import { ReportSectionShell } from "../components/reports/report-section-shell";
import { ReportFilters, ReportFiltersSkeleton } from "../components/reports/report-filters";
import { ReportErrorState } from "../components/reports-tab";

// ─── Mock factories ─────────────────────────────────────────────────────────────

function mockCurrentState(overrides = {}) {
  return {
    dogsInFormation: 2,
    formationsInProgress: 3,
    dogsTechnicallyTrained: 1,
    modalitiesConcluded: 1,
    pendingRequests: 5,
    activePrograms: 2,
    totalModules: 8,
    ...overrides,
  };
}

function mockSessionMetrics(overrides = {}) {
  return {
    sessionsInPeriod: 10,
    distinctDogsTrained: 2,
    distinctModalitiesTrained: 2,
    distinctTrainingDays: 6,
    sessionsByDog: { "dog-1": 5, "dog-2": 5 },
    sessionsByModality: { deteccao: 6, busca_captura: 4 },
    lastSessionByDog: {
      "dog-1": new Date("2026-06-25"),
      "dog-2": new Date("2026-06-24"),
    },
    firstSessionInPeriod: new Date("2026-06-01"),
    lastSessionInPeriod: new Date("2026-06-25"),
    ...overrides,
  };
}

function mockEvaluationMetrics(overrides = {}) {
  return {
    pendingCount: 3,
    approvedInPeriod: 4,
    rejectedInPeriod: 2,
    decidedInPeriod: 6,
    averageDecisionTimeSeconds: 259200, // 3 days
    medianDecisionTimeSeconds: 172800, // 2 days
    oldestPendingAgeSeconds: 604800, // 7 days
    invalidDateCount: 0,
    unsupportedDecidedStatusCount: 0,
    ...overrides,
  };
}

// ─── KPI Card Tests ─────────────────────────────────────────────────────────────

describe("ReportKpis", () => {
  const defaultProps = () => ({
    currentState: mockCurrentState(),
    sessionMetrics: mockSessionMetrics(),
    evaluationMetrics: mockEvaluationMetrics(),
    sessionsTruncated: false,
    pendingTruncated: false,
    decidedTruncated: false,
    earliestLoadedSession: null,
    latestLoadedSession: null,
  });

  it("renders all four main KPIs", () => {
    render(<ReportKpis {...defaultProps()} />);

    expect(screen.getByText("Cães em formação")).toBeInTheDocument();
    expect(screen.getByText("Formações em progresso")).toBeInTheDocument();
    expect(screen.getByText("Sessões no período")).toBeInTheDocument();
    expect(screen.getByText("Avaliações decididas")).toBeInTheDocument();
  });

  it("shows dogs count in first KPI", () => {
    render(<ReportKpis {...defaultProps()} currentState={mockCurrentState({ dogsInFormation: 5 })} />);

    const articles = screen.getAllByRole("article");
    expect(articles[0]).toHaveAttribute("aria-label", "Cães em formação: 5");
  });

  it("shows dogs and days info as sub-description", () => {
    render(<ReportKpis {...defaultProps()} />);

    expect(screen.getByText(/2 cães treinado/)).toBeInTheDocument();
    expect(screen.getByText(/6 dias de atividade/)).toBeInTheDocument();
  });

  it("shows approved and rejected counts as sub-description", () => {
    render(<ReportKpis {...defaultProps()} />);

    expect(screen.getByText(/4 aprovadas/)).toBeInTheDocument();
    expect(screen.getByText(/2 rejeitadas/)).toBeInTheDocument();
  });

  it("shows secondary indicators when pending exists", () => {
    render(<ReportKpis {...defaultProps()} evaluationMetrics={mockEvaluationMetrics({ pendingCount: 3 })} />);

    expect(screen.getByText("Pendente(s)")).toBeInTheDocument();
  });

  it("shows truncated pending with 'Pelo menos' prefix", () => {
    render(
      <ReportKpis
        {...defaultProps()}
        evaluationMetrics={mockEvaluationMetrics({ pendingCount: 3 })}
        pendingTruncated
      />,
    );

    expect(screen.getByText("Pelo menos 3")).toBeInTheDocument();
  });

  it("shows average decision time when available", () => {
    render(<ReportKpis {...defaultProps()} />);

    expect(screen.getByText("Tempo médio para decisão")).toBeInTheDocument();
  });

  it("does not label decision time with a bare generic 'Tempo médio'", () => {
    // averageDecisionTimeSeconds measures decided_at - (requested_at ?? created_at),
    // so a bare "Tempo médio" would read as average session/training time.
    render(<ReportKpis {...defaultProps()} />);

    expect(screen.queryByText("Tempo médio")).not.toBeInTheDocument();
  });

  it("renders skeleton when loading prop is true", () => {
    render(<ReportKpis loading />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows loaded period info when sessions loaded", () => {
    render(
      <ReportKpis
        {...defaultProps()}
        earliestLoadedSession={new Date("2026-06-01")}
        latestLoadedSession={new Date("2026-06-26")}
      />,
    );

    // Just verify that period info is shown - exact date format depends on locale
    expect(screen.getByText(/Período carregado/)).toBeInTheDocument();
  });

  it("shows different label when sessions truncated", () => {
    render(
      <ReportKpis
        {...defaultProps()}
        sessionsTruncated
        earliestLoadedSession={new Date("2026-06-01")}
        latestLoadedSession={new Date("2026-06-26")}
      />,
    );

    expect(screen.getByText(/Período conhecido nos registros carregados/)).toBeInTheDocument();
  });

  it("one dog with two formations shows 1 cão and 2 formações", () => {
    render(
      <ReportKpis
        {...defaultProps()}
        currentState={mockCurrentState({ dogsInFormation: 1, formationsInProgress: 2 })}
      />,
    );

    const articles = screen.getAllByRole("article");
    expect(articles[0]).toHaveAttribute("aria-label", "Cães em formação: 1");
    expect(articles[1]).toHaveAttribute("aria-label", "Formações em progresso: 2");
  });

  it("truncated sessions show '≥' prefix", () => {
    render(
      <ReportKpis
        {...defaultProps()}
        sessionMetrics={mockSessionMetrics({ sessionsInPeriod: 200 })}
        sessionsTruncated
      />,
    );

    const sessionsCard = screen
      .getAllByRole("article")
      .find((a) => a.getAttribute("aria-label")?.includes("Sessões"));
    expect(sessionsCard?.innerHTML).toContain("≥");
  });

  it("dogs technically trained shown in secondary indicators", () => {
    render(
      <ReportKpis
        {...defaultProps()}
        currentState={mockCurrentState({ dogsTechnicallyTrained: 1 })}
      />,
    );

    expect(screen.getByText("Técnicos")).toBeInTheDocument();
  });

  it("modalities concluded shown in secondary indicators", () => {
    render(
      <ReportKpis
        {...defaultProps()}
        currentState={mockCurrentState({ modalitiesConcluded: 2 })}
      />,
    );

    expect(screen.getByText("Concluídas")).toBeInTheDocument();
  });
});

// ─── Data Quality Tests ─────────────────────────────────────────────────────────

describe("ReportDataQuality", () => {
  it("renders nothing when no warnings", () => {
    const { container } = render(<ReportDataQuality warnings={[]} />);
    expect(container.querySelector('[role="note"]')).not.toBeInTheDocument();
  });

  it("renders warnings when provided", () => {
    render(
      <ReportDataQuality warnings={["Nenhuma sessão possui duração registrada."]} />,
    );

    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma sessão possui duração registrada.")).toBeInTheDocument();
  });

  it("renders multiple warnings as list", () => {
    render(
      <ReportDataQuality
        warnings={[
          "Nenhuma sessão possui duração registrada.",
          "Algumas sessões podem não ter sido carregadas.",
        ]}
      />,
    );

    expect(screen.getByText(/Nenhuma sessão possui duração registrada/)).toBeInTheDocument();
    expect(screen.getByText(/Algumas sessões podem não ter sido carregadas/)).toBeInTheDocument();
  });

  it("has accessible note role", () => {
    render(<ReportDataQuality warnings={["Some warning message here"]} />);
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("truncation warning is displayed", () => {
    render(
      <ReportDataQuality
        warnings={["Algumas sessões podem não ter sido carregadas devido ao limite da consulta."]}
      />,
    );

    expect(screen.getByText(/limite da consulta/)).toBeInTheDocument();
  });

  it("unknown status warning is displayed", () => {
    render(
      <ReportDataQuality
        warnings={["Algumas decisões possuem status não reconhecido e não foram incluídas nas métricas."]}
      />,
    );

    expect(screen.getByText(/status não reconhecido/)).toBeInTheDocument();
  });
});

// ─── Section Shell Tests ─────────────────────────────────────────────────────────

describe("ReportSectionShell", () => {
  it("renders title and children", () => {
    render(
      <ReportSectionShell title="Test Section">
        <p>Test content</p>
      </ReportSectionShell>,
    );

    expect(screen.getByText("Test Section")).toBeInTheDocument();
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders pending state with badge", () => {
    render(
      <ReportSectionShell title="Future Section" pending>
        <p>Should not show</p>
      </ReportSectionShell>,
    );

    // Use heading query to avoid duplicate text
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Future Section");
    expect(screen.getByText("Próxima etapa")).toBeInTheDocument();
    expect(screen.queryByText("Should not show")).not.toBeInTheDocument();
  });

  it("renders empty state when no children and not pending", () => {
    render(<ReportSectionShell title="Empty Section" />);

    expect(
      screen.getByText("Nenhum dado disponível para os filtros selecionados."),
    ).toBeInTheDocument();
  });

  it("section has correct heading hierarchy", () => {
    render(<ReportSectionShell title="My Section" />);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("My Section");
  });
});

// ─── ReportFilters Tests ─────────────────────────────────────────────────────────

// Mock paths
vi.mock("@/lib/routes/paths", () => ({
  paths: { training: "/training" },
}));

describe("ReportFilters", () => {
  const mockSetPeriod = vi.fn();
  const mockSetModality = vi.fn();

  beforeEach(() => {
    mockSetPeriod.mockClear();
    mockSetModality.mockClear();
  });

  it("renders with period and modality selectors", () => {
    render(
      <ReportFilters
        availableModalities={["deteccao", "busca_captura"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    expect(screen.getByLabelText("Filtrar por período")).toBeInTheDocument();
    expect(screen.getByLabelText("Filtrar por modalidade")).toBeInTheDocument();
  });

  it("has accessible labels", () => {
    render(
      <ReportFilters
        availableModalities={["deteccao"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    const periodSelect = screen.getByLabelText("Filtrar por período");
    const modalitySelect = screen.getByLabelText("Filtrar por modalidade");

    expect(periodSelect).toBeInstanceOf(HTMLSelectElement);
    expect(modalitySelect).toBeInstanceOf(HTMLSelectElement);
  });

  it("shows all period options", () => {
    render(
      <ReportFilters
        availableModalities={[]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    const periodSelect = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    const options = Array.from(periodSelect.options).map((o) => o.textContent);

    expect(options).toContain("Últimos 7 dias");
    expect(options).toContain("Últimos 30 dias");
    expect(options).toContain("Últimos 60 dias");
    expect(options).toContain("Últimos 90 dias");
    expect(options).toContain("Todo o histórico");
  });

  it("shows all modalities from available list", () => {
    render(
      <ReportFilters
        availableModalities={["deteccao", "busca_captura"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    const modalitySelect = screen.getByLabelText("Filtrar por modalidade") as HTMLSelectElement;
    const options = Array.from(modalitySelect.options).map((o) => o.textContent);

    expect(options).toContain("Todas as modalidades");
    expect(options).toContain("Detecção");
    expect(options).toContain("Busca & Captura");
  });
});

// ─── Error State Tests ───────────────────────────────────────────────────────────

describe("ReportErrorState", () => {
  const mockRetry = vi.fn();

  beforeEach(() => {
    mockRetry.mockClear();
  });

  it("renders error message", () => {
    render(<ReportErrorState error="Connection failed" onRetry={mockRetry} />);

    expect(
      screen.getByText("Não foi possível carregar todos os dados dos relatórios."),
    ).toBeInTheDocument();
  });

  it("retry button calls onRetry", async () => {
    render(<ReportErrorState error="Connection failed" onRetry={mockRetry} />);

    const retryButton = screen.getByRole("button", { name: "Tentar novamente" });
    expect(retryButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(retryButton);
    });

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it("retry button is keyboard accessible", () => {
    render(<ReportErrorState error="Connection failed" onRetry={mockRetry} />);

    const retryButton = screen.getByRole("button", { name: "Tentar novamente" });

    expect(retryButton).not.toBeDisabled();
    expect(retryButton).toHaveAttribute("type", "button");
  });
});

// ─── Loading Skeleton Tests ──────────────────────────────────────────────────────

describe("ReportFiltersSkeleton", () => {
  it("renders skeleton elements", () => {
    render(<ReportFiltersSkeleton />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

// ─── Query params integration tests ─────────────────────────────────────────────

describe("ReportFilters — query params sync", () => {
  const mockSetPeriodLocal = vi.fn();
  const mockSetModalityLocal = vi.fn();

  beforeEach(() => {
    mockSetPeriodLocal.mockClear();
    mockSetModalityLocal.mockClear();
  });

  it("changing period calls onPeriodChange handler", () => {
    render(
      <ReportFilters
        availableModalities={["deteccao"]}
        onPeriodChange={mockSetPeriodLocal}
        onModalityChange={mockSetModalityLocal}
      />,
    );

    const select = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "90d" } });

    expect(mockSetPeriodLocal).toHaveBeenCalledWith("90d");
  });

  it("changing modality calls onModalityChange handler", () => {
    render(
      <ReportFilters
        availableModalities={["deteccao", "busca_captura"]}
        onPeriodChange={mockSetPeriodLocal}
        onModalityChange={mockSetModalityLocal}
      />,
    );

    const select = screen.getByLabelText("Filtrar por modalidade") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "deteccao" } });

    expect(mockSetModalityLocal).toHaveBeenCalledWith("deteccao");
  });

  it("selecting 'all' modality passes null to handler", () => {
    render(
      <ReportFilters
        availableModalities={["deteccao"]}
        onPeriodChange={mockSetPeriodLocal}
        onModalityChange={mockSetModalityLocal}
      />,
    );

    const select = screen.getByLabelText("Filtrar por modalidade") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "all" } });

    expect(mockSetModalityLocal).toHaveBeenCalledWith(null);
  });

  it("selecting non-default period passes the value to handler", () => {
    render(
      <ReportFilters
        availableModalities={[]}
        onPeriodChange={mockSetPeriodLocal}
        onModalityChange={mockSetModalityLocal}
      />,
    );

    const select = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "7d" } });

    expect(mockSetPeriodLocal).toHaveBeenCalledWith("7d");
  });
});

// ─── Truncation language ────────────────────────────────────────────────────────

describe("KPI truncation language", () => {
  it("shows ≥ visually but 'Pelo menos' in aria-label", () => {
    render(
      <ReportKpis
        currentState={mockCurrentState()}
        sessionMetrics={mockSessionMetrics({ sessionsInPeriod: 200 })}
        evaluationMetrics={mockEvaluationMetrics()}
        sessionsTruncated
        decidedTruncated={false}
        earliestLoadedSession={null}
        latestLoadedSession={null}
      />,
    );

    const sessionsCard = screen
      .getAllByRole("article")
      .find((a) => a.getAttribute("aria-label")?.includes("Sessões"));

    expect(sessionsCard).toHaveAttribute(
      "aria-label",
      "Sessões no período: pelo menos 200",
    );
    expect(sessionsCard?.textContent).toContain("200");
  });

  it("uses regular label when not truncated", () => {
    render(
      <ReportKpis
        currentState={mockCurrentState()}
        sessionMetrics={mockSessionMetrics({ sessionsInPeriod: 10 })}
        evaluationMetrics={mockEvaluationMetrics()}
        sessionsTruncated={false}
        decidedTruncated={false}
        earliestLoadedSession={null}
        latestLoadedSession={null}
      />,
    );

    const sessionsCard = screen
      .getAllByRole("article")
      .find((a) => a.getAttribute("aria-label")?.includes("Sessões"));

    expect(sessionsCard).toHaveAttribute("aria-label", "Sessões no período: 10");
  });
});

// ─── Zero values ────────────────────────────────────────────────────────────────

describe("KPI zero values", () => {
  it("renders explicit 0 for dogs in formation", () => {
    render(
      <ReportKpis
        currentState={mockCurrentState({ dogsInFormation: 0, formationsInProgress: 0 })}
        sessionMetrics={mockSessionMetrics({ sessionsInPeriod: 0 })}
        evaluationMetrics={mockEvaluationMetrics({ decidedInPeriod: 0 })}
        earliestLoadedSession={null}
        latestLoadedSession={null}
      />,
    );

    const articles = screen.getAllByRole("article");
    expect(articles[0]).toHaveAttribute("aria-label", "Cães em formação: 0");
    expect(articles[1]).toHaveAttribute("aria-label", "Formações em progresso: 0");
    expect(articles[2]).toHaveAttribute("aria-label", "Sessões no período: 0");
    expect(articles[3]).toHaveAttribute("aria-label", "Avaliações decididas: 0");
  });
});

// ─── Severity in quality warnings ───────────────────────────────────────────────

describe("ReportDataQuality severity", () => {
  it("renders error severity with red border", () => {
    render(
      <ReportDataQuality
        categorizedWarnings={[
          { message: "Falha na consulta.", severity: "error" },
        ]}
      />,
    );

    expect(screen.getByText("Falha na consulta.")).toBeInTheDocument();
    // Error should have red styling
    const container = screen.getByRole("note");
    expect(container.innerHTML).toMatch(/red/);
  });

  it("renders attention severity with amber styling", () => {
    render(
      <ReportDataQuality
        categorizedWarnings={[
          { message: "Truncamento detectado.", severity: "attention" },
        ]}
      />,
    );

    expect(screen.getByText("Truncamento detectado.")).toBeInTheDocument();
  });

  it("renders info severity with cyan/slate styling", () => {
    render(
      <ReportDataQuality
        categorizedWarnings={[
          { message: "Histórico curto.", severity: "info" },
        ]}
      />,
    );

    expect(screen.getByText("Histórico curto.")).toBeInTheDocument();
  });

  it("falls back to attention severity when given plain warnings", () => {
    render(<ReportDataQuality warnings={["Algum aviso genérico."]} />);

    expect(screen.getByText("Algum aviso genérico.")).toBeInTheDocument();
  });
});

// ─── Section shell empty messages ────────────────────────────────────────────────

describe("ReportSectionShell empty messages", () => {
  it("renders custom emptyMessage when no children", () => {
    render(
      <ReportSectionShell
        emptyMessage="Nenhuma atividade encontrada para os filtros selecionados."
        title="Atividade por cão"
      />,
    );

    expect(
      screen.getByText("Nenhuma atividade encontrada para os filtros selecionados."),
    ).toBeInTheDocument();
  });

  it("renders default emptyMessage when none provided", () => {
    render(<ReportSectionShell title="Empty Section" />);

    expect(
      screen.getByText("Nenhum dado disponível para os filtros selecionados."),
    ).toBeInTheDocument();
  });
});

// ─── Navigation history tests (push vs replace) ────────────────────────────────

describe("ReportFilters — navigation history", () => {
  const mockSetPeriod = vi.fn();
  const mockSetModality = vi.fn();

  beforeEach(() => {
    resetNavigation();
    mockSetPeriod.mockClear();
    mockSetModality.mockClear();
  });

  it("changing period calls router.push, not replace", () => {
    setUrl({ tab: "reports" });
    render(
      <ReportFilters
        availableModalities={["deteccao"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    const select = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "60d" } });

    expect(navigationMock.routerPush).toHaveBeenCalledTimes(1);
    expect(navigationMock.routerReplace).not.toHaveBeenCalled();
    expect(navigationMock.routerPush).toHaveBeenCalledWith(
      "/training?tab=reports&reportPeriod=60d",
      { scroll: false },
    );
  });

  it("changing modality calls router.push, not replace", () => {
    setUrl({ tab: "reports" });
    render(
      <ReportFilters
        availableModalities={["deteccao", "busca_captura"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    const select = screen.getByLabelText("Filtrar por modalidade") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "deteccao" } });

    expect(navigationMock.routerPush).toHaveBeenCalledTimes(1);
    expect(navigationMock.routerReplace).not.toHaveBeenCalled();
    expect(navigationMock.routerPush).toHaveBeenCalledWith(
      expect.stringContaining("/training?"),
      { scroll: false },
    );
    expect(navigationMock.routerPush).toHaveBeenCalledWith(
      expect.stringContaining("reportModality=deteccao"),
      { scroll: false },
    );
    expect(navigationMock.routerPush).toHaveBeenCalledWith(
      expect.stringContaining("tab=reports"),
      { scroll: false },
    );
  });

  it("preserves tab=reports and other params when changing period", () => {
    setUrl({ tab: "reports", reportModality: "deteccao", foo: "bar" });
    render(
      <ReportFilters
        availableModalities={["deteccao"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    const select = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "90d" } });

    const url = navigationMock.routerPush.mock.calls[0][0] as string;
    expect(url).toContain("tab=reports");
    expect(url).toContain("reportModality=deteccao");
    expect(url).toContain("foo=bar");
    expect(url).toContain("reportPeriod=90d");
  });

  it("selecting default period (30d) deletes reportPeriod from URL", () => {
    setUrl({ tab: "reports", reportPeriod: "7d" });
    render(
      <ReportFilters
        availableModalities={[]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    const select = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "30d" } });

    const url = navigationMock.routerPush.mock.calls[0][0] as string;
    expect(url).not.toContain("reportPeriod");
  });

  it("selecting 'all' modality deletes reportModality from URL", () => {
    setUrl({ tab: "reports", reportModality: "deteccao" });
    render(
      <ReportFilters
        availableModalities={["deteccao"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    const select = screen.getByLabelText("Filtrar por modalidade") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "all" } });

    const url = navigationMock.routerPush.mock.calls[0][0] as string;
    expect(url).not.toContain("reportModality");
  });

  it("hydrates period from URL", () => {
    setUrl({ tab: "reports", reportPeriod: "60d" });
    render(
      <ReportFilters
        availableModalities={[]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    const select = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    expect(select.value).toBe("60d");
  });

  it("hydrates modality from URL when valid", () => {
    setUrl({ tab: "reports", reportModality: "deteccao" });
    render(
      <ReportFilters
        availableModalities={["deteccao", "busca_captura"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    const select = screen.getByLabelText("Filtrar por modalidade") as HTMLSelectElement;
    expect(select.value).toBe("deteccao");
  });

  it("falls back to default 30d when URL has invalid period (no push)", () => {
    setUrl({ tab: "reports", reportPeriod: "invalid" });
    render(
      <ReportFilters
        availableModalities={[]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    const select = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    expect(select.value).toBe("30d");
    // Normalization happens silently via replace, no push
    expect(navigationMock.routerPush).not.toHaveBeenCalled();
  });

  it("silently removes invalid modality via replace, no push", () => {
    setUrl({ tab: "reports", reportModality: "inexistente" });
    render(
      <ReportFilters
        availableModalities={["deteccao"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    const select = screen.getByLabelText("Filtrar por modalidade") as HTMLSelectElement;
    expect(select.value).toBe("all");
    expect(navigationMock.routerPush).not.toHaveBeenCalled();
    expect(navigationMock.routerReplace).toHaveBeenCalled();
  });

  it("simulates back navigation: URL change updates select and provider", () => {
    setUrl({ tab: "reports", reportPeriod: "30d" });
    const { rerender } = render(
      <ReportFilters
        availableModalities={["deteccao"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    expect(
      (screen.getByLabelText("Filtrar por período") as HTMLSelectElement).value,
    ).toBe("30d");

    // Simulate user going back to 7d
    setUrl({ tab: "reports", reportPeriod: "7d" });
    rerender(
      <ReportFilters
        availableModalities={["deteccao"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    expect(
      (screen.getByLabelText("Filtrar por período") as HTMLSelectElement).value,
    ).toBe("7d");
  });

  it("simulates forward navigation: URL change updates select again", () => {
    setUrl({ tab: "reports", reportPeriod: "30d" });
    const { rerender } = render(
      <ReportFilters
        availableModalities={["deteccao"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    // Simulate forward to 60d
    setUrl({ tab: "reports", reportPeriod: "60d" });
    rerender(
      <ReportFilters
        availableModalities={["deteccao"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    expect(
      (screen.getByLabelText("Filtrar por período") as HTMLSelectElement).value,
    ).toBe("60d");

    // Then forward to 90d
    setUrl({ tab: "reports", reportPeriod: "90d" });
    rerender(
      <ReportFilters
        availableModalities={["deteccao"]}
        onPeriodChange={mockSetPeriod}
        onModalityChange={mockSetModality}
      />,
    );

    expect(
      (screen.getByLabelText("Filtrar por período") as HTMLSelectElement).value,
    ).toBe("90d");
  });
});

// ─── Visible truncation language ────────────────────────────────────────────────

describe("KPI visible truncation", () => {
  it("renders visible 'Pelo menos' caption when truncated", () => {
    render(
      <ReportKpis
        currentState={mockCurrentState()}
        sessionMetrics={mockSessionMetrics({ sessionsInPeriod: 200 })}
        evaluationMetrics={mockEvaluationMetrics()}
        sessionsTruncated
        earliestLoadedSession={null}
        latestLoadedSession={null}
      />,
    );

    // Visible caption
    expect(screen.getByText(/Pelo menos 200/)).toBeInTheDocument();
  });

  it("does NOT render 'Pelo menos' caption when not truncated", () => {
    render(
      <ReportKpis
        currentState={mockCurrentState()}
        sessionMetrics={mockSessionMetrics({ sessionsInPeriod: 10 })}
        evaluationMetrics={mockEvaluationMetrics()}
        sessionsTruncated={false}
        earliestLoadedSession={null}
        latestLoadedSession={null}
      />,
    );

    expect(screen.queryByText(/Pelo menos/)).not.toBeInTheDocument();
  });

  it("renders visible truncation caption for decided evaluations", () => {
    render(
      <ReportKpis
        currentState={mockCurrentState()}
        sessionMetrics={mockSessionMetrics()}
        evaluationMetrics={mockEvaluationMetrics({ decidedInPeriod: 1000 })}
        decidedTruncated
        earliestLoadedSession={null}
        latestLoadedSession={null}
      />,
    );

    expect(screen.getByText(/Pelo menos 1000/)).toBeInTheDocument();
  });
});
