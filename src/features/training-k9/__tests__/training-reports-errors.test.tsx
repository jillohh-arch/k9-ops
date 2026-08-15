/**
 * Behavioral tests for partial error handling in Training Reports.
 *
 * Tests the ACTUAL behavior of:
 * - Session load classification (complete / partial / failed)
 * - Preservation of previous data on failure
 * - Independent evaluation error states
 * - Retry isolation (sessions vs evaluations)
 * - UI response to error states
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ─── Firebase mock ────────────────────────────────────────────────────────────────

vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  firebaseApp: {},
  functions: {},
}));

// ─── Configurable mock state ─────────────────────────────────────────────────────

const retrySessionsSpy = vi.fn();
const retryEvaluationsSpy = vi.fn();
const retrySpy = vi.fn();

type MockErrorState = {
  base: string | null;
  sessions: string | null;
  pendingEvaluations: string | null;
  decidedEvaluations: string | null;
  evaluations: string | null;
};

type MockSessionLoadStatus = "idle" | "loading" | "complete" | "partial" | "failed";

let mockErrorState: MockErrorState = {
  base: null,
  sessions: null,
  pendingEvaluations: null,
  decidedEvaluations: null,
  evaluations: null,
};
let mockSessionLoadStatus: MockSessionLoadStatus = "complete";
let mockSessionsInPeriod = 10;
let mockLoadingState = { base: false, sessions: false, evaluations: false };
let mockIsComplete = true;
let mockSuccessfulSessionQueryCount = 5;
let mockFailedSessionQueryCount = 0;
let mockLoadedFilters: { period: string; modality: string | null; dogId: string | null } | null = {
  period: "30d",
  modality: null,
  dogId: null,
};

function mockDataFactory() {
  return {
    filters: { period: "30d", modality: null, dogId: null },
    setPeriod: vi.fn(),
    setModality: vi.fn(),
    setDogId: vi.fn(),
    currentState: {
      dogsInFormation: 3,
      formationsInProgress: 5,
      dogsTechnicallyTrained: 1,
      modalitiesConcluded: 1,
      pendingRequests: 0,
      activePrograms: 1,
      totalModules: 4,
    },
    sessionMetrics: {
      sessionsInPeriod: mockSessionsInPeriod,
      distinctDogsTrained: 2,
      distinctTrainingDays: 5,
      distinctModalitiesTrained: 1,
      sessionsByDog: { "k9-alpha": 6, "k9-bravo": 4 },
      sessionsByModality: { deteccao: 10 },
      lastSessionByDog: {},
      firstSessionInPeriod: new Date("2024-01-01"),
      lastSessionInPeriod: new Date("2024-01-20"),
    },
    durationMetrics: {
      registeredDurationSeconds: 3600,
      sessionsWithDuration: 5,
      sessionsWithoutDuration: 5,
      durationCoveragePercentage: 50,
      invalidDurationCount: 0,
      suspiciousDurationCount: 0,
    },
    evaluationMetrics: {
      pendingCount: 2,
      approvedInPeriod: 1,
      rejectedInPeriod: 0,
      decidedInPeriod: 1,
      averageDecisionTimeSeconds: null,
      medianDecisionTimeSeconds: null,
      oldestPendingAgeSeconds: null,
      invalidDateCount: 0,
      unsupportedDecidedStatusCount: 0,
    },
    dataQuality: {
      isComplete: mockIsComplete,
      sessionsTruncated: false,
      pendingEvaluationsTruncated: false,
      decidedEvaluationsTruncated: false,
      evaluationsTruncated: false,
      invalidSessionCount: 0,
      invalidEvaluationDateCount: 0,
      durationCoveragePercentage: 50,
      earliestLoadedSession: new Date("2024-01-01"),
      latestLoadedSession: new Date("2024-01-20"),
      warnings: [],
      categorizedWarnings: [],
      unsupportedDecidedStatusCount: 0,
    },
    queryStats: { progressCount: 5 },
    loadingState: mockLoadingState,
    errorState: mockErrorState,
    sessionLoadStatus: mockSessionLoadStatus,
    loadedFilters: mockLoadedFilters,
    successfulSessionQueryCount: mockSuccessfulSessionQueryCount,
    failedSessionQueryCount: mockFailedSessionQueryCount,
    loading: false,
    error: mockErrorState.base,
    retry: retrySpy,
    retrySessions: retrySessionsSpy,
    retryEvaluations: retryEvaluationsSpy,
    rejectedByModule: [],
    individualTimelines: {},
    activitySummary: {
      dogsWithProgress: [],
      dogsNeverTrained: [],
      dogsInactiveOver7Days: [],
      dogsInactiveOver30Days: [],
      dogsInactiveOver60Days: [],
      dogsInactiveOver90Days: [],
    },
  };
}

vi.mock("../hooks/use-training-reports-data", () => ({
  useTrainingReportsData: vi.fn(() => mockDataFactory()),
  TrainingReportsDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../hooks/use-training-k9-data", () => ({
  useTrainingK9Data: vi.fn(() => ({
    loading: false,
    dogs: [
      { dogId: "k9-alpha", dogName: "K9 Alfa", photoUrl: null, cells: [{ modality: "deteccao", source: "in_formation" }] },
      { dogId: "k9-bravo", dogName: "K9 Bravo", photoUrl: null, cells: [{ modality: "deteccao", source: "in_formation" }] },
    ],
    programs: [],
    metrics: { activeDogs: 2, pendingPromotions: 0, activePrograms: 1 },
    errors: [],
  })),
}));

// ─── Next.js mocks ──────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => ({
    get: () => null,
    toString: () => "",
  })),
  usePathname: vi.fn(() => "/training"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}));

// ─── Import SUT ─────────────────────────────────────────────────────────────────

import { ReportsTab, ReportErrorState } from "../components/reports-tab";

// ─── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockErrorState = { base: null, sessions: null, pendingEvaluations: null, decidedEvaluations: null, evaluations: null };
  mockSessionLoadStatus = "complete";
  mockSessionsInPeriod = 10;
  mockLoadingState = { base: false, sessions: false, evaluations: false };
  mockIsComplete = true;
  mockSuccessfulSessionQueryCount = 5;
  mockFailedSessionQueryCount = 0;
  mockLoadedFilters = { period: "30d", modality: null, dogId: null };
  retrySessionsSpy.mockClear();
  retryEvaluationsSpy.mockClear();
  retrySpy.mockClear();
});

// ═══════════════════════════════════════════════════════════════════════════════════
// SESSION ERROR SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════════

describe("ReportsTab — session total failure", () => {
  beforeEach(() => {
    mockSessionLoadStatus = "failed";
    mockErrorState = { ...mockErrorState, sessions: "Não foi possível carregar os registros de sessões." };
    mockSessionsInPeriod = 0;
    mockSuccessfulSessionQueryCount = 0;
    mockFailedSessionQueryCount = 5;
    mockIsComplete = false;
  });

  it("shows local error for sessions section", () => {
    render(<ReportsTab />);
    expect(screen.getByText("Não foi possível carregar as sessões")).toBeInTheDocument();
  });

  it("does NOT show global error state when only sessions failed", () => {
    render(<ReportsTab />);
    expect(screen.queryByText("Não foi possível carregar todos os dados dos relatórios.")).not.toBeInTheDocument();
  });

  it("does NOT show empty state message", () => {
    render(<ReportsTab />);
    expect(screen.queryByText("Nenhuma sessão registrada neste período.")).not.toBeInTheDocument();
  });

  it("KPIs for dogs and formations remain visible", () => {
    render(<ReportsTab />);
    expect(screen.getByText("Relatórios de Treinamento")).toBeInTheDocument();
  });

  it("retry button calls retrySessions, not full retry", () => {
    render(<ReportsTab />);
    const retryButtons = screen.getAllByRole("button", { name: /tentar novamente/i });
    fireEvent.click(retryButtons[0]);
    expect(retrySessionsSpy).toHaveBeenCalledTimes(1);
    expect(retrySpy).not.toHaveBeenCalled();
  });
});

describe("ReportsTab — session partial success", () => {
  beforeEach(() => {
    mockSessionLoadStatus = "partial";
    mockErrorState = { ...mockErrorState, sessions: "Alguns registros de sessões não puderam ser carregados." };
    mockSessionsInPeriod = 6;
    mockSuccessfulSessionQueryCount = 3;
    mockFailedSessionQueryCount = 2;
    mockIsComplete = false;
  });

  it("shows partial warning banner", () => {
    render(<ReportsTab />);
    expect(screen.getByTestId("partial-sessions-warning")).toBeInTheDocument();
    expect(screen.getByText("Alguns registros de sessões não puderam ser carregados.")).toBeInTheDocument();
  });

  it("shows caveat about partial data", () => {
    render(<ReportsTab />);
    expect(screen.getByText("Os valores exibidos representam apenas os registros recuperados.")).toBeInTheDocument();
  });

  it("does NOT show session error sections (data is usable)", () => {
    render(<ReportsTab />);
    expect(screen.queryByText("Não foi possível carregar as sessões")).not.toBeInTheDocument();
  });

  it("does NOT show global error state", () => {
    render(<ReportsTab />);
    expect(screen.queryByText("Não foi possível carregar todos os dados dos relatórios.")).not.toBeInTheDocument();
  });

  it("maintains KPIs and session ranking with recovered data", () => {
    render(<ReportsTab />);
    expect(screen.getByText("Relatórios de Treinamento")).toBeInTheDocument();
  });
});

describe("ReportsTab — session complete success", () => {
  it("does NOT show partial warning", () => {
    render(<ReportsTab />);
    expect(screen.queryByTestId("partial-sessions-warning")).not.toBeInTheDocument();
  });

  it("does NOT show session error section", () => {
    render(<ReportsTab />);
    expect(screen.queryByText("Não foi possível carregar as sessões")).not.toBeInTheDocument();
  });

  it("does NOT show global error", () => {
    render(<ReportsTab />);
    expect(screen.queryByText("Não foi possível carregar todos os dados dos relatórios.")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// EVALUATION ERROR SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════════

describe("ReportsTab — pending evaluations fail, decided succeed", () => {
  beforeEach(() => {
    mockErrorState = {
      ...mockErrorState,
      pendingEvaluations: "Não foi possível carregar as avaliações pendentes.",
      evaluations: "Não foi possível carregar as avaliações pendentes.",
    };
    mockIsComplete = false;
  });

  it("shows evaluation error warning", () => {
    render(<ReportsTab />);
    expect(screen.getByTestId("evaluation-error-warning")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível carregar algumas avaliações.")).toBeInTheDocument();
  });

  it("does NOT show global error", () => {
    render(<ReportsTab />);
    expect(screen.queryByText("Não foi possível carregar todos os dados dos relatórios.")).not.toBeInTheDocument();
  });

  it("retry evaluations button calls retryEvaluations", () => {
    render(<ReportsTab />);
    const btn = screen.getByRole("button", { name: /recarregar avaliações/i });
    fireEvent.click(btn);
    expect(retryEvaluationsSpy).toHaveBeenCalledTimes(1);
    expect(retrySessionsSpy).not.toHaveBeenCalled();
  });
});

describe("ReportsTab — decided evaluations fail, pending succeed", () => {
  beforeEach(() => {
    mockErrorState = {
      ...mockErrorState,
      decidedEvaluations: "Não foi possível carregar as avaliações decididas.",
      evaluations: "Não foi possível carregar as avaliações decididas.",
    };
    mockIsComplete = false;
  });

  it("shows evaluation error warning", () => {
    render(<ReportsTab />);
    expect(screen.getByTestId("evaluation-error-warning")).toBeInTheDocument();
  });

  it("does NOT show global error", () => {
    render(<ReportsTab />);
    expect(screen.queryByText("Não foi possível carregar todos os dados dos relatórios.")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// BASE ERROR
// ═══════════════════════════════════════════════════════════════════════════════════

describe("ReportsTab — base data error", () => {
  beforeEach(() => {
    mockErrorState = {
      ...mockErrorState,
      base: "Falha ao carregar dados base.",
    };
  });

  it("shows global error state", () => {
    render(<ReportsTab />);
    expect(screen.getByText("Não foi possível carregar todos os dados dos relatórios.")).toBeInTheDocument();
  });

  it("retry button calls full retry", () => {
    render(<ReportsTab />);
    const btn = screen.getByRole("button", { name: /tentar novamente/i });
    fireEvent.click(btn);
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// NO DUPLICATE ERRORS
// ═══════════════════════════════════════════════════════════════════════════════════

describe("ReportsTab — no duplicate error display", () => {
  it("session error does NOT trigger global error simultaneously", () => {
    mockErrorState = {
      base: null,
      sessions: "Não foi possível carregar os registros de sessões.",
      pendingEvaluations: null,
      decidedEvaluations: null,
      evaluations: null,
    };
    mockSessionLoadStatus = "failed";
    render(<ReportsTab />);

    // Global error banner should NOT appear
    expect(screen.queryByText("Não foi possível carregar todos os dados dos relatórios.")).not.toBeInTheDocument();
    // Local error SHOULD appear
    expect(screen.getByText("Não foi possível carregar as sessões")).toBeInTheDocument();
  });

  it("evaluation error does NOT trigger global error simultaneously", () => {
    mockErrorState = {
      base: null,
      sessions: null,
      pendingEvaluations: "Erro",
      decidedEvaluations: null,
      evaluations: "Erro",
    };
    render(<ReportsTab />);

    expect(screen.queryByText("Não foi possível carregar todos os dados dos relatórios.")).not.toBeInTheDocument();
    expect(screen.getByTestId("evaluation-error-warning")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// STALE DATA INDICATORS
// ═══════════════════════════════════════════════════════════════════════════════════

describe("ReportsTab — stale data from previous load", () => {
  it("session failure with previous data shows stale notice", () => {
    mockSessionLoadStatus = "failed";
    mockSessionsInPeriod = 8; // Previous data still present
    mockErrorState = { ...mockErrorState, sessions: "Erro" };
    render(<ReportsTab />);

    expect(screen.getByText(/dados exibidos podem não refletir/i)).toBeInTheDocument();
  });

  it("session failure with NO previous data does NOT show stale notice text", () => {
    mockSessionLoadStatus = "failed";
    mockSessionsInPeriod = 0;
    mockErrorState = { ...mockErrorState, sessions: "Erro" };
    render(<ReportsTab />);

    expect(screen.queryByText(/dados exibidos podem não refletir/i)).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// RETRY ISOLATION
// ═══════════════════════════════════════════════════════════════════════════════════

describe("ReportsTab — retry isolation", () => {
  it("retry sessions does NOT call retryEvaluations", () => {
    mockSessionLoadStatus = "failed";
    mockErrorState = { ...mockErrorState, sessions: "Erro" };
    render(<ReportsTab />);

    const retryButtons = screen.getAllByRole("button", { name: /tentar novamente/i });
    fireEvent.click(retryButtons[0]);

    expect(retrySessionsSpy).toHaveBeenCalledTimes(1);
    expect(retryEvaluationsSpy).not.toHaveBeenCalled();
  });

  it("retry evaluations does NOT call retrySessions", () => {
    mockErrorState = {
      ...mockErrorState,
      evaluations: "Erro",
      pendingEvaluations: "Erro",
    };
    render(<ReportsTab />);

    const btn = screen.getByRole("button", { name: /recarregar avaliações/i });
    fireEvent.click(btn);

    expect(retryEvaluationsSpy).toHaveBeenCalledTimes(1);
    expect(retrySessionsSpy).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// ReportErrorState component
// ═══════════════════════════════════════════════════════════════════════════════════

describe("ReportErrorState — component unit", () => {
  it("renders error title", () => {
    render(<ReportErrorState error="Test error" onRetry={vi.fn()} />);
    expect(screen.getByText("Não foi possível carregar todos os dados dos relatórios.")).toBeInTheDocument();
  });

  it("calls onRetry when button clicked", () => {
    const spy = vi.fn();
    render(<ReportErrorState error="Error" onRetry={spy} />);
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
