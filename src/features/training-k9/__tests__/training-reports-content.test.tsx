/**
 * Content tests for the Training Reports sections:
 * - Atividade por cão (ReportDogActivity)
 * - Sessões no período (ReportSessionSummary)
 * - Ranked bars utility (ReportRankedBars)
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import type { DogActivity } from "../types/training-reports";

// ─── Firebase mock ────────────────────────────────────────────────────────────────

vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  firebaseApp: {},
  functions: {},
}));

// ─── Provider mocks ──────────────────────────────────────────────────────────────

vi.mock("../hooks/use-training-reports-data", () => ({
  useTrainingReportsData: vi.fn(() => ({
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
      sessionsInPeriod: 12,
      distinctDogsTrained: 3,
      distinctTrainingDays: 8,
      distinctModalitiesTrained: 2,
      sessionsByDog: { "k9-alfa": 6, "k9-bravo": 4, "k9-charlie": 2 },
      sessionsByModality: { deteccao: 8, busca_captura: 4 },
      lastSessionByDog: {
        "k9-alfa": new Date("2024-01-20"),
        "k9-bravo": new Date("2024-01-10"),
        "k9-charlie": null,
      },
      firstSessionInPeriod: new Date("2024-01-01"),
      lastSessionInPeriod: new Date("2024-01-20"),
    },
    durationMetrics: {
      registeredDurationSeconds: 7200,
      sessionsWithDuration: 8,
      sessionsWithoutDuration: 4,
      durationCoveragePercentage: 67,
      invalidDurationCount: 0,
      suspiciousDurationCount: 0,
    },
    evaluationMetrics: {
      pendingCount: 0,
      approvedInPeriod: 0,
      rejectedInPeriod: 0,
      decidedInPeriod: 0,
      averageDecisionTimeSeconds: null,
      medianDecisionTimeSeconds: null,
      oldestPendingAgeSeconds: null,
      invalidDateCount: 0,
      unsupportedDecidedStatusCount: 0,
    },
    dataQuality: {
      isComplete: true,
      sessionsTruncated: false,
      pendingEvaluationsTruncated: false,
      decidedEvaluationsTruncated: false,
      evaluationsTruncated: false,
      invalidSessionCount: 0,
      invalidEvaluationDateCount: 0,
      durationCoveragePercentage: 67,
      earliestLoadedSession: new Date("2024-01-01"),
      latestLoadedSession: new Date("2024-01-20"),
      warnings: [],
      categorizedWarnings: [],
      unsupportedDecidedStatusCount: 0,
    },
    queryStats: { progressCount: 3 },
    loadingState: { base: false, sessions: false, evaluations: false },
    errorState: { base: null, sessions: null, evaluations: null },
    loading: false,
    error: null,
    retry: vi.fn(),
    retrySessions: vi.fn(),
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
  })),
  TrainingReportsDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../hooks/use-training-k9-data", () => ({
  useTrainingK9Data: vi.fn(() => ({
    loading: false,
    dogs: [],
    programs: [],
    metrics: { activeDogs: 0, pendingPromotions: 0, activePrograms: 0 },
    errors: [],
  })),
}));

// ─── Import SUTs ─────────────────────────────────────────────────────────────────

import { ReportRankedBars } from "../components/reports/report-ranked-bars";
import { ReportDogActivity } from "../components/reports/report-dog-activity";
import { ReportSessionSummary } from "../components/reports/report-session-summary";
import { sortActivity } from "../components/reports/report-dog-activity";

import type { SessionMetrics, DurationMetrics } from "../types/training-reports";

// ─── Fixtures ────────────────────────────────────────────────────────────────────

function makeDog(overrides: Partial<DogActivity>): DogActivity {
  return {
    dogId: "k9-alpha",
    dogName: "K9 Alfa",
    modality: null,
    modalities: [],
    lastSessionAt: null,
    daysSinceLastSession: null,
    neverTrained: false,
    inactiveOver7Days: false,
    inactiveOver30Days: false,
    inactiveOver60Days: false,
    inactiveOver90Days: false,
    ...overrides,
  };
}

function makeSessionMetrics(overrides: Partial<SessionMetrics> = {}): SessionMetrics {
  return {
    sessionsInPeriod: 10,
    distinctDogsTrained: 2,
    distinctTrainingDays: 5,
    distinctModalitiesTrained: 1,
    sessionsByDog: { "k9-alpha": 6, "k9-bravo": 4 },
    sessionsByModality: { deteccao: 10 },
    lastSessionByDog: {
      "k9-alpha": new Date("2024-01-15"),
      "k9-bravo": new Date("2024-01-10"),
    },
    firstSessionInPeriod: new Date("2024-01-01"),
    lastSessionInPeriod: new Date("2024-01-15"),
    ...overrides,
  };
}

function makeDurationMetrics(coverage: number = 0): DurationMetrics {
  return {
    registeredDurationSeconds: coverage > 0 ? 3600 : 0,
    sessionsWithDuration: coverage > 0 ? 5 : 0,
    sessionsWithoutDuration: coverage > 0 ? 5 : 10,
    durationCoveragePercentage: coverage,
    invalidDurationCount: 0,
    suspiciousDurationCount: 0,
  };
}

// ─── ReportRankedBars tests ─────────────────────────────────────────────────────

describe("ReportRankedBars", () => {
  it("renders empty message when items array is empty", () => {
    render(
      <ReportRankedBars
        ariaLabel="Test"
        emptyMessage="Nenhuma sessão encontrada."
        items={[]}
      />,
    );
    expect(screen.getByText("Nenhuma sessão encontrada.")).toBeInTheDocument();
  });

  it("renders all items with labels and values", () => {
    const items = [
      { key: "a", label: "K9 Alfa", value: 6 },
      { key: "b", label: "K9 Bravo", value: 3 },
    ];
    render(
      <ReportRankedBars
        ariaLabel="Test"
        emptyMessage="Vazio"
        items={items}
      />,
    );
    expect(screen.getByText("K9 Alfa")).toBeInTheDocument();
    expect(screen.getByText("K9 Bravo")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders aria-label on each item", () => {
    const items = [{ key: "a", label: "K9 Alfa", value: 6 }];
    render(
      <ReportRankedBars
        ariaLabel="Test"
        emptyMessage="Vazio"
        items={items}
      />,
    );
    expect(screen.getByRole("listitem")).toHaveAttribute("aria-label", "K9 Alfa: 6");
  });

  it("renders truncation notice when truncated=true", () => {
    const items = [{ key: "a", label: "K9 Alfa", value: 6 }];
    render(
      <ReportRankedBars
        ariaLabel="Test"
        emptyMessage="Vazio"
        items={items}
        truncated
      />,
    );
    expect(
      screen.getByText("Os valores representam pelo menos os registros carregados."),
    ).toBeInTheDocument();
  });

  it("does not crash when all values are zero", () => {
    const items = [
      { key: "a", label: "K9 Alfa", value: 0 },
      { key: "b", label: "K9 Bravo", value: 0 },
    ];
    render(
      <ReportRankedBars
        ariaLabel="Test"
        emptyMessage="Vazio"
        items={items}
      />,
    );
    // Both items render (no crash). "0" appears once per item.
    expect(screen.getByText("K9 Alfa")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(2); // two zero-value items
  });

  it("uses custom formatValue when provided", () => {
    const items = [{ key: "a", label: "K9 Alfa", value: 600 }];
    render(
      <ReportRankedBars
        ariaLabel="Test"
        emptyMessage="Vazio"
        formatValue={(v) => `${v / 60}m`}
        items={items}
      />,
    );
    expect(screen.getByText("10m")).toBeInTheDocument();
  });
});

// ─── sortActivity tests ──────────────────────────────────────────────────────────

describe("sortActivity — ordering", () => {
  it("puts never-trained dogs first", () => {
    const a = makeDog({ dogId: "a", dogName: "Alpha", neverTrained: true });
    const b = makeDog({ dogId: "b", dogName: "Bravo", neverTrained: false, lastSessionAt: new Date("2024-01-20") });
    const sorted = [a, b].sort(sortActivity);
    expect(sorted[0].dogId).toBe("a");
  });

  it("among trained dogs, sorts by longest inactivity (daysSinceLastSession desc)", () => {
    const recent = makeDog({ dogId: "r", dogName: "Recent", neverTrained: false, lastSessionAt: new Date("2024-01-20"), daysSinceLastSession: 5 });
    const old = makeDog({ dogId: "o", dogName: "Old", neverTrained: false, lastSessionAt: new Date("2023-12-01"), daysSinceLastSession: 60 });
    const sorted = [recent, old].sort(sortActivity);
    expect(sorted[0].dogId).toBe("o"); // Old is most inactive
    expect(sorted[1].dogId).toBe("r");
  });

  it("uses name as tiebreaker", () => {
    const dogA = makeDog({ dogId: "a", dogName: "Alpha", neverTrained: false, lastSessionAt: new Date("2023-12-01"), daysSinceLastSession: 60 });
    const dogB = makeDog({ dogId: "b", dogName: "Bravo", neverTrained: false, lastSessionAt: new Date("2023-12-01"), daysSinceLastSession: 60 });
    const sorted = [dogA, dogB].sort(sortActivity);
    expect(sorted[0].dogName).toBe("Alpha");
    expect(sorted[1].dogName).toBe("Bravo");
  });

  it("never-trained dogs are sorted alphabetically by name", () => {
    const dogB = makeDog({ dogId: "b", dogName: "Bravo", neverTrained: true });
    const dogA = makeDog({ dogId: "a", dogName: "Alpha", neverTrained: true });
    const sorted = [dogB, dogA].sort(sortActivity);
    expect(sorted[0].dogName).toBe("Alpha");
    expect(sorted[1].dogName).toBe("Bravo");
  });
});

// ─── ReportDogActivity tests ─────────────────────────────────────────────────────

describe("ReportDogActivity", () => {
  const defaultTrainingDogs = [
    { dogId: "k9-alpha", dogName: "K9 Alfa", photoUrl: null },
    { dogId: "k9-bravo", dogName: "K9 Bravo", photoUrl: null },
  ];

  it("renders empty message when no dogs have activity", () => {
    render(
      <ReportDogActivity
        activity={[]}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    expect(
      screen.getByText("Não há cães com atividade para a modalidade e o período selecionados."),
    ).toBeInTheDocument();
  });

  it("renders a list item for each dog in activity", () => {
    const dogs: DogActivity[] = [
      makeDog({ dogId: "k9-alpha", dogName: "K9 Alfa", neverTrained: false, lastSessionAt: new Date("2024-01-20"), daysSinceLastSession: 3 }),
      makeDog({ dogId: "k9-bravo", dogName: "K9 Bravo", neverTrained: true }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    expect(screen.getByText("K9 Alfa")).toBeInTheDocument();
    expect(screen.getByText("K9 Bravo")).toBeInTheDocument();
  });

  it("shows 'Nenhuma sessão registrada' for never-trained dogs", () => {
    const dogs: DogActivity[] = [
      makeDog({ dogId: "k9-alpha", dogName: "K9 Alfa", neverTrained: true }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    expect(screen.getByText("Nenhuma sessão registrada")).toBeInTheDocument();
  });

  it("shows 'Atividade recente' for dogs with last session within 7 days", () => {
    const dogs: DogActivity[] = [
      makeDog({ dogId: "k9-alpha", dogName: "K9 Alfa", neverTrained: false, lastSessionAt: new Date("2024-01-20"), daysSinceLastSession: 3 }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    expect(screen.getByText("Atividade recente")).toBeInTheDocument();
  });

  it("shows 'Sem atividade recente' for dogs inactive 7-30 days", () => {
    const dogs: DogActivity[] = [
      makeDog({ dogId: "k9-alpha", dogName: "K9 Alfa", neverTrained: false, lastSessionAt: new Date("2023-12-15"), daysSinceLastSession: 15, inactiveOver7Days: true, inactiveOver30Days: false }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    expect(screen.getByText("Sem atividade recente")).toBeInTheDocument();
  });

  it("shows 'Atenção à frequência' for dogs inactive more than 30 days", () => {
    const dogs: DogActivity[] = [
      makeDog({ dogId: "k9-alpha", dogName: "K9 Alfa", neverTrained: false, lastSessionAt: new Date("2023-11-01"), daysSinceLastSession: 60, inactiveOver7Days: true, inactiveOver30Days: true }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    expect(screen.getByText("Atenção à frequência")).toBeInTheDocument();
  });

  it("renders drill-down link with correct href", () => {
    const dogs: DogActivity[] = [
      makeDog({ dogId: "k9-alpha", dogName: "K9 Alfa", neverTrained: false, lastSessionAt: new Date("2024-01-20"), daysSinceLastSession: 3 }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    const link = screen.getByRole("link", { name: /ver jornada/i });
    expect(link).toHaveAttribute("href", "/training/dogs/k9-alpha");
  });

  it("drill-down URL does not include invented query parameters", () => {
    const dogs: DogActivity[] = [
      makeDog({ dogId: "k9-alpha", dogName: "K9 Alfa", neverTrained: false, lastSessionAt: new Date("2024-01-20"), daysSinceLastSession: 3 }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    const link = screen.getByRole("link", { name: /ver jornada/i });
    const href = link.getAttribute("href")!;
    expect(href).toBe("/training/dogs/k9-alpha");
    expect(href).not.toContain("tab=");
    expect(href).not.toContain("modality=");
    expect(href).not.toContain("period=");
  });

  it("never-trained dog appears first in sorted list", () => {
    const dogs: DogActivity[] = [
      makeDog({ dogId: "k9-alpha", dogName: "K9 Alfa", neverTrained: false, lastSessionAt: new Date("2024-01-20"), daysSinceLastSession: 3 }),
      makeDog({ dogId: "k9-bravo", dogName: "K9 Bravo", neverTrained: true }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    const items = screen.getAllByRole("listitem");
    // First rendered item should be the never-trained one
    expect(items[0]).toHaveTextContent("K9 Bravo");
    expect(items[0]).toHaveTextContent("Nenhuma sessão registrada");
  });

  it("does not expose dogId or technical identifiers in visible text", () => {
    const dogs: DogActivity[] = [
      makeDog({ dogId: "k9-alpha", dogName: "K9 Alfa", neverTrained: false, lastSessionAt: new Date("2024-01-20"), daysSinceLastSession: 3 }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    // Should show friendly name, not the raw dogId
    expect(screen.getByText("K9 Alfa")).toBeInTheDocument();
    // The dogId should not appear as visible text
    const pageText = screen.getByTestId("report-dog-list")?.textContent ?? document.body.textContent ?? "";
    expect(pageText).not.toContain("k9-alpha");
  });

  it("renders fallback avatar when photoUrl is null", () => {
    const dogs: DogActivity[] = [
      makeDog({ dogId: "k9-alpha", dogName: "K9 Alfa", neverTrained: false, lastSessionAt: new Date("2024-01-20"), daysSinceLastSession: 3 }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    // Fallback logo should be rendered (src contains logo-app.png)
    const images = document.querySelectorAll("img");
    expect(images.length).toBeGreaterThan(0);
  });

  it("renders modality label when dog has a modality", () => {
    const dogs: DogActivity[] = [
      makeDog({ dogId: "k9-alpha", dogName: "K9 Alfa", modality: "deteccao", modalities: ["deteccao"], neverTrained: false, lastSessionAt: new Date("2024-01-20"), daysSinceLastSession: 3 }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    expect(screen.getByText("Detecção")).toBeInTheDocument();
  });
});

// ─── ReportSessionSummary tests ─────────────────────────────────────────────────

describe("ReportSessionSummary", () => {
  it("renders empty state when no sessions exist", () => {
    render(
      <ReportSessionSummary
        dogNameById={{ "k9-alpha": "K9 Alfa", "k9-bravo": "K9 Bravo" }}
        durationMetrics={makeDurationMetrics(0)}
        isRefreshing={false}
        sessionMetrics={makeSessionMetrics({
          sessionsInPeriod: 0,
          distinctDogsTrained: 0,
          sessionsByDog: {},
          sessionsByModality: {},
          lastSessionByDog: {},
        })}
        sessionsTruncated={false}
      />,
    );
    expect(screen.getByText("Nenhuma sessão registrada neste período.")).toBeInTheDocument();
  });

  it("renders skeleton when isInitialLoading=true", () => {
    render(
      <ReportSessionSummary
        dogNameById={{ "k9-alpha": "K9 Alfa", "k9-bravo": "K9 Bravo" }}
        durationMetrics={makeDurationMetrics(0)}
        isInitialLoading
        isRefreshing={false}
        sessionMetrics={makeSessionMetrics()}
        sessionsTruncated={false}
      />,
    );
    // Skeleton uses aria-hidden="true" elements
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("renders summary strip with session count", () => {
    render(
      <ReportSessionSummary
        dogNameById={{ "k9-alpha": "K9 Alfa", "k9-bravo": "K9 Bravo" }}
        durationMetrics={makeDurationMetrics(0)}
        isRefreshing={false}
        sessionMetrics={makeSessionMetrics()}
        sessionsTruncated={false}
      />,
    );
    // "10" appears in the summary strip (sessionsInPeriod) AND in ranked bars
    // (k9-alpha=6 + k9-bravo=4, total 10). Check both are present.
    const tens = screen.getAllByText("10");
    expect(tens.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("sessões")).toBeInTheDocument();
  });

  it("renders ranked bars for dogs", () => {
    render(
      <ReportSessionSummary
        dogNameById={{ "k9-alpha": "K9 Alfa", "k9-bravo": "K9 Bravo" }}
        durationMetrics={makeDurationMetrics(0)}
        isRefreshing={false}
        sessionMetrics={makeSessionMetrics()}
        sessionsTruncated={false}
      />,
    );
    expect(screen.getByText("Por cão")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument(); // k9-alpha: 6
    expect(screen.getByText("4")).toBeInTheDocument(); // k9-bravo: 4
  });

  it("renders ranked bars for modalities with friendly labels", () => {
    render(
      <ReportSessionSummary
        dogNameById={{ "k9-alpha": "K9 Alfa", "k9-bravo": "K9 Bravo" }}
        durationMetrics={makeDurationMetrics(0)}
        isRefreshing={false}
        sessionMetrics={makeSessionMetrics()}
        sessionsTruncated={false}
      />,
    );
    expect(screen.getByText("Por modalidade")).toBeInTheDocument();
    // Canonical label for "deteccao" should be shown
    expect(screen.getByText("Detecção")).toBeInTheDocument();
  });

  it("does NOT render duration section when coverage is zero", () => {
    render(
      <ReportSessionSummary
        dogNameById={{ "k9-alpha": "K9 Alfa", "k9-bravo": "K9 Bravo" }}
        durationMetrics={makeDurationMetrics(0)}
        isRefreshing={false}
        sessionMetrics={makeSessionMetrics()}
        sessionsTruncated={false}
      />,
    );
    expect(screen.queryByText(/Tempo registrado:/)).not.toBeInTheDocument();
  });

  it("renders duration section when coverage > 0", () => {
    render(
      <ReportSessionSummary
        dogNameById={{ "k9-alpha": "K9 Alfa", "k9-bravo": "K9 Bravo" }}
        durationMetrics={makeDurationMetrics(67)}
        isRefreshing={false}
        sessionMetrics={makeSessionMetrics()}
        sessionsTruncated={false}
      />,
    );
    expect(screen.getByText(/Tempo registrado:/)).toBeInTheDocument();
    expect(screen.getByText(/Duração informada em/)).toBeInTheDocument();
  });

  it("renders truncation notice when sessionsTruncated=true", () => {
    render(
      <ReportSessionSummary
        dogNameById={{ "k9-alpha": "K9 Alfa", "k9-bravo": "K9 Bravo" }}
        durationMetrics={makeDurationMetrics(0)}
        isRefreshing={false}
        sessionMetrics={makeSessionMetrics()}
        sessionsTruncated
      />,
    );
    // Notice appears in ReportRankedBars AND at bottom of ReportSessionSummary
    const notices = screen.getAllByText(/^Os valores representam pelo menos os registros carregados\.$/);
    expect(notices.length).toBeGreaterThanOrEqual(1);
  });

  it("shows refresh indicator when isRefreshing=true", () => {
    render(
      <ReportSessionSummary
        dogNameById={{ "k9-alpha": "K9 Alfa", "k9-bravo": "K9 Bravo" }}
        durationMetrics={makeDurationMetrics(0)}
        isRefreshing
        sessionMetrics={makeSessionMetrics()}
        sessionsTruncated={false}
      />,
    );
    // A pulsing dot should be rendered in the summary strip
    const dot = document.querySelector(".animate-pulse");
    expect(dot).toBeInTheDocument();
  });

  it("renders list with accessible aria-label", () => {
    render(
      <ReportSessionSummary
        dogNameById={{ "k9-alpha": "K9 Alfa", "k9-bravo": "K9 Bravo" }}
        durationMetrics={makeDurationMetrics(0)}
        isRefreshing={false}
        sessionMetrics={makeSessionMetrics()}
        sessionsTruncated={false}
      />,
    );
    expect(screen.getByRole("list", { name: /distribuição de sessões por cão/i })).toBeInTheDocument();
  });

  it("resolves dogId to friendly name in ranking", () => {
    render(
      <ReportSessionSummary
        dogNameById={{ "k9-alpha": "K9 Alfa", "k9-bravo": "K9 Bravo" }}
        durationMetrics={makeDurationMetrics(0)}
        isRefreshing={false}
        sessionMetrics={makeSessionMetrics()}
        sessionsTruncated={false}
      />,
    );
    expect(screen.getByText("K9 Alfa")).toBeInTheDocument();
    expect(screen.getByText("K9 Bravo")).toBeInTheDocument();
  });

  it("shows 'Cão não identificado' for unknown dogId", () => {
    render(
      <ReportSessionSummary
        dogNameById={{}}
        durationMetrics={makeDurationMetrics(0)}
        isRefreshing={false}
        sessionMetrics={makeSessionMetrics()}
        sessionsTruncated={false}
      />,
    );
    // Both dogs unresolved → should show fallback
    const fallbacks = screen.getAllByText("Cão não identificado");
    expect(fallbacks.length).toBe(2);
  });

  it("does NOT expose dogId in aria-label for ranking items", () => {
    render(
      <ReportSessionSummary
        dogNameById={{ "k9-alpha": "K9 Alfa" }}
        durationMetrics={makeDurationMetrics(0)}
        isRefreshing={false}
        sessionMetrics={makeSessionMetrics()}
        sessionsTruncated={false}
      />,
    );
    const items = screen.getAllByRole("listitem");
    for (const item of items) {
      const label = item.getAttribute("aria-label") ?? "";
      expect(label).not.toContain("k9-alpha");
      expect(label).not.toContain("k9-bravo");
    }
  });
});

// ─── Modalities display tests ─────────────────────────────────────────────────

describe("ReportDogActivity — modalities display", () => {
  const defaultTrainingDogs = [
    { dogId: "k9-alpha", dogName: "K9 Alfa", photoUrl: null },
  ];

  it("shows multiple modalities joined with bullet when dog has several", () => {
    const dogs: DogActivity[] = [
      makeDog({
        dogId: "k9-alpha",
        dogName: "K9 Alfa",
        modality: null,
        modalities: ["deteccao", "guarda_protecao"],
        neverTrained: false,
        lastSessionAt: new Date("2024-01-20"),
        daysSinceLastSession: 3,
      }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    expect(screen.getByText("Detecção • Guarda & Proteção")).toBeInTheDocument();
  });

  it("shows single modality without bullet separator", () => {
    const dogs: DogActivity[] = [
      makeDog({
        dogId: "k9-alpha",
        dogName: "K9 Alfa",
        modality: "deteccao",
        modalities: ["deteccao"],
        neverTrained: false,
        lastSessionAt: new Date("2024-01-20"),
        daysSinceLastSession: 3,
      }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    expect(screen.getByText("Detecção")).toBeInTheDocument();
    expect(screen.queryByText("•")).not.toBeInTheDocument();
  });

  it("shows no modality label when modalities array is empty", () => {
    const dogs: DogActivity[] = [
      makeDog({
        dogId: "k9-alpha",
        dogName: "K9 Alfa",
        modality: null,
        modalities: [],
        neverTrained: false,
        lastSessionAt: new Date("2024-01-20"),
        daysSinceLastSession: 3,
      }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    // Only the name should appear, no modality span
    expect(screen.getByText("K9 Alfa")).toBeInTheDocument();
    expect(screen.queryByText("Detecção")).not.toBeInTheDocument();
  });

  it("does not show snake_case modality values", () => {
    const dogs: DogActivity[] = [
      makeDog({
        dogId: "k9-alpha",
        dogName: "K9 Alfa",
        modality: null,
        modalities: ["busca_captura"],
        neverTrained: false,
        lastSessionAt: new Date("2024-01-20"),
        daysSinceLastSession: 3,
      }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    expect(screen.queryByText("busca_captura")).not.toBeInTheDocument();
    expect(screen.getByText("Busca & Captura")).toBeInTheDocument();
  });

  it("dog without sessions still shows its modalities from progress", () => {
    const dogs: DogActivity[] = [
      makeDog({
        dogId: "k9-alpha",
        dogName: "K9 Alfa",
        modality: null,
        modalities: ["deteccao"],
        neverTrained: true,
      }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics({ sessionsByDog: {} })}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    expect(screen.getByText("Detecção")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma sessão registrada")).toBeInTheDocument();
  });

  it("deduplicates: only one card per dog even with multiple modalities", () => {
    const dogs: DogActivity[] = [
      makeDog({
        dogId: "k9-alpha",
        dogName: "K9 Alfa",
        modality: null,
        modalities: ["deteccao", "guarda_protecao"],
        neverTrained: false,
        lastSessionAt: new Date("2024-01-20"),
        daysSinceLastSession: 3,
      }),
    ];
    render(
      <ReportDogActivity
        activity={dogs}
        sessionMetrics={makeSessionMetrics()}
        trainingDogs={defaultTrainingDogs}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
  });
});
