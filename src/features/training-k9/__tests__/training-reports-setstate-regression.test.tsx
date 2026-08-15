/**
 * Regression tests for the setState-during-render bug.
 *
 * The bug: when the period filter changed (e.g. 30d → 7d), ReportsTabInner
 * called data.setPeriod(...) directly in the component body. React detected
 * the resulting state update inside another component's render and threw
 * "Cannot update a component (TrainingReportsDataProvider) while rendering
 * a different component (ReportsTabInner)".
 *
 * Strategy: mock the entire useTrainingReportsData module so we can drive
 * the provider's external state directly. We don't load the real provider —
 * we only exercise the ReportsTabInner component via the public ReportsTab
 * export, wrapping it in a stub provider that doesn't require a real context.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// ─── Firebase mock ────────────────────────────────────────────────────────────────

vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  firebaseApp: {},
  functions: {},
}));

// ─── Provider mock: intercept setters and expose controlled data ──────────────

const setPeriodSpy = vi.fn();
const setModalitySpy = vi.fn();
const setDogIdSpy = vi.fn();
const retrySpy = vi.fn();

let mockFilters = { period: "30d", modality: null as string | null, dogId: null as string | null };
let mockLoadingState = { base: false, sessions: false, evaluations: false };
let mockTrainingK9Loading = false;
let mockDogs: Array<{
  dogId: string;
  dogName: string;
  cells: Array<{ modality: string; source: string }>;
}> = [];

vi.mock("../hooks/use-training-reports-data", () => {
  // Stub provider that just renders children. The real context is unused
  // because we override useTrainingReportsData below.
  return {
    useTrainingReportsData: vi.fn(() => ({
      filters: mockFilters,
      setPeriod: setPeriodSpy,
      setModality: setModalitySpy,
      setDogId: setDogIdSpy,
      currentState: {
        dogsInFormation: 2,
        formationsInProgress: 3,
        dogsTechnicallyTrained: 1,
        modalitiesConcluded: 1,
        pendingRequests: 0,
        activePrograms: 1,
        totalModules: 4,
      },
      sessionMetrics: {
        sessionsInPeriod: 10,
        distinctDogsTrained: 2,
        distinctTrainingDays: 6,
        distinctModalitiesTrained: 1,
        sessionsByDog: { "dog-1": 6, "dog-2": 4 },
        sessionsByModality: { deteccao: 10 },
        lastSessionByDog: { "dog-1": new Date("2024-01-15"), "dog-2": new Date("2024-01-10") },
        firstSessionInPeriod: new Date("2024-01-01"),
        lastSessionInPeriod: new Date("2024-01-15"),
      },
      evaluationMetrics: {
        pendingCount: 0,
        approvedInPeriod: 0,
        rejectedInPeriod: 0,
        decidedInPeriod: 0,
        averageDecisionTimeSeconds: null,
      },
      dataQuality: {
        isComplete: true,
        sessionsTruncated: false,
        pendingEvaluationsTruncated: false,
        decidedEvaluationsTruncated: false,
        evaluationsTruncated: false,
        invalidSessionCount: 0,
        invalidEvaluationDateCount: 0,
        durationCoveragePercentage: 100,
        earliestLoadedSession: null,
        latestLoadedSession: null,
        warnings: [],
        categorizedWarnings: [],
        unsupportedDecidedStatusCount: 0,
      },
      queryStats: { progressCount: 3 },
      loadingState: mockLoadingState,
      errorState: { base: null, sessions: null, evaluations: null },
      loading: false,
      error: null,
      retry: retrySpy,
      retrySessions: retrySpy,
      rejectedByModule: [],
      individualTimelines: {},
      durationMetrics: {
        registeredDurationSeconds: 0,
        sessionsWithDuration: 0,
        sessionsWithoutDuration: 10,
        durationCoveragePercentage: 0,
        invalidDurationCount: 0,
        suspiciousDurationCount: 0,
      },
      activitySummary: {
        dogsWithProgress: [],
        dogsNeverTrained: [],
        dogsInactiveOver7Days: [],
        dogsInactiveOver30Days: [],
        dogsInactiveOver60Days: [],
        dogsInactiveOver90Days: [],
      },
    })),
    TrainingReportsDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("../hooks/use-training-k9-data", () => ({
  useTrainingK9Data: vi.fn(() => ({
    loading: mockTrainingK9Loading,
    dogs: mockDogs,
    programs: [],
    metrics: { activeDogs: 0, pendingPromotions: 0, activePrograms: 0 },
    errors: [],
  })),
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

function resetNavigation() {
  navigationMock.params.clear();
  navigationMock.routerPush.mockClear();
  navigationMock.routerReplace.mockClear();
}
function setUrl(params: Record<string, string>) {
  navigationMock.params.clear();
  for (const [k, v] of Object.entries(params)) navigationMock.params.set(k, v);
}

// ─── Import SUT ─────────────────────────────────────────────────────────────────

import { ReportsTab } from "../components/reports-tab";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function renderReportsTab() {
  return render(<ReportsTab />);
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe("ReportsTab — setState-during-render regression", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetNavigation();
    setPeriodSpy.mockClear();
    setModalitySpy.mockClear();
    setDogIdSpy.mockClear();
    retrySpy.mockClear();
    // Reset mock state
    mockFilters = { period: "30d", modality: null, dogId: null };
    mockLoadingState = { base: false, sessions: false, evaluations: false };
    mockTrainingK9Loading = false;
    mockDogs = [
      {
        dogId: "dog-1",
        dogName: "K9 Alfa",
        cells: [
          { modality: "deteccao", source: "in_formation" },
          { modality: "busca_captura", source: "operational" },
        ],
      },
    ];
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does NOT throw React's setState-during-render error on initial render", () => {
    setUrl({ tab: "reports" });
    renderReportsTab();

    const errorMessages = consoleErrorSpy.mock.calls.map((call) => String(call[0]));
    const hasRenderError = errorMessages.some((m) =>
      m.includes("Cannot update a component"),
    );
    expect(hasRenderError).toBe(false);
  });

  it("does NOT call setPeriod/setModality during initial render", () => {
    setUrl({ tab: "reports" });
    renderReportsTab();

    expect(setPeriodSpy).not.toHaveBeenCalled();
    expect(setModalitySpy).not.toHaveBeenCalled();
  });

  it("changing period from 30d to 7d does NOT throw setState-during-render", async () => {
    setUrl({ tab: "reports", reportPeriod: "30d" });
    const { rerender } = renderReportsTab();

    setUrl({ tab: "reports", reportPeriod: "7d" });
    await act(async () => {
      rerender(<ReportsTab />);
    });

    await act(async () => {
      rerender(<ReportsTab />);
    });

    const errorMessages = consoleErrorSpy.mock.calls.map((call) => String(call[0]));
    const hasRenderError = errorMessages.some((m) =>
      m.includes("Cannot update a component"),
    );
    expect(hasRenderError).toBe(false);
  });

  it("changing period via select calls router.push", async () => {
    setUrl({ tab: "reports" });
    renderReportsTab();

    const select = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: "7d" } });
    });

    expect(navigationMock.routerPush).toHaveBeenCalled();
    const url = navigationMock.routerPush.mock.calls[0][0] as string;
    expect(url).toContain("reportPeriod=7d");
  });

  it("changing modality via select updates URL via push and preserves tab=reports", async () => {
    setUrl({ tab: "reports", reportPeriod: "30d" });
    renderReportsTab();

    const modalitySelect = screen.getByLabelText("Filtrar por modalidade") as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(modalitySelect, { target: { value: "deteccao" } });
    });

    expect(navigationMock.routerPush).toHaveBeenCalled();
    const url = navigationMock.routerPush.mock.calls[0][0] as string;
    expect(url).toContain("reportModality=deteccao");
    expect(url).toContain("tab=reports");
    expect(url).toContain("reportPeriod=30d");
  });

  it("URL change from 30d to 7d propagates to provider via useEffect", async () => {
    setUrl({ tab: "reports", reportPeriod: "30d" });
    mockFilters = { period: "30d", modality: null, dogId: null };
    const { rerender } = renderReportsTab();

    expect(setPeriodSpy).not.toHaveBeenCalled();

    setUrl({ tab: "reports", reportPeriod: "7d" });
    await act(async () => {
      rerender(<ReportsTab />);
    });

    // Provider's mock filters are still "30d" — the effect should call setPeriod
    expect(setPeriodSpy).toHaveBeenCalledWith("7d");
  });

  it("changing from 30d to 7d to 90d back/forward preserves UI state without errors", async () => {
    setUrl({ tab: "reports", reportPeriod: "30d" });
    const { rerender } = renderReportsTab();

    // 30d → 7d
    setUrl({ tab: "reports", reportPeriod: "7d" });
    await act(async () => {
      rerender(<ReportsTab />);
    });

    let select = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    expect(select.value).toBe("7d");

    // 7d → 90d
    setUrl({ tab: "reports", reportPeriod: "90d" });
    await act(async () => {
      rerender(<ReportsTab />);
    });

    select = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    expect(select.value).toBe("90d");

    // Back to 7d
    setUrl({ tab: "reports", reportPeriod: "7d" });
    await act(async () => {
      rerender(<ReportsTab />);
    });

    select = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    expect(select.value).toBe("7d");

    const errorMessages = consoleErrorSpy.mock.calls.map((call) => String(call[0]));
    const hasRenderError = errorMessages.some((m) =>
      m.includes("Cannot update a component"),
    );
    expect(hasRenderError).toBe(false);
  });

  it("selecting 7d with modality=deteccao preserves modality in URL", async () => {
    setUrl({ tab: "reports", reportPeriod: "30d", reportModality: "deteccao" });
    renderReportsTab();

    const select = screen.getByLabelText("Filtrar por período") as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: "7d" } });
    });

    const url = navigationMock.routerPush.mock.calls[0][0] as string;
    expect(url).toContain("reportPeriod=7d");
    expect(url).toContain("reportModality=deteccao");
    expect(url).toContain("tab=reports");
  });
});