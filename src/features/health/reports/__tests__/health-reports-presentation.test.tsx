/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Presentation components contract tests.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HealthReportsPeriodSelector } from "../presentation/health-reports-period-selector";
import { HealthReportsCoverageBanner } from "../presentation/health-reports-coverage-banner";
import { HealthReportsKpiGrid } from "../presentation/health-reports-kpi-grid";
import { HealthReportsClinicalTable } from "../presentation/health-reports-clinical-table";
import { HealthReportsScheduleTable } from "../presentation/health-reports-schedule-table";
import { HealthReportsExportToolbar } from "../presentation/health-reports-export-toolbar";
import type {
  HealthReportsAggregate,
  HealthReportsCoverageSummary,
  ReadinessReportMetrics,
  ClinicalReportMetrics,
  ScheduleReportMetrics,
  ReportExportAuthority,
} from "../domain/health-reports-types";
import type { ClinicalCaseListEntry } from "../../clinical/data/clinical-scope-loader";
import type { ComposedScheduleEntry } from "../../schedule/composition/schedule-composition";

describe("HealthReportsPeriodSelector", () => {
  it("renders all canonical period options and responds to user click", () => {
    const onChange = vi.fn();
    render(<HealthReportsPeriodSelector value="7d" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Hoje" })).toBeDefined();
    expect(screen.getByRole("button", { name: "7 dias" })).toBeDefined();
    expect(screen.getByRole("button", { name: "30 dias" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "30 dias" }));
    expect(onChange).toHaveBeenCalledWith("30d");
  });

  it("disables buttons when disabled prop is true", () => {
    const onChange = vi.fn();
    render(<HealthReportsPeriodSelector value="today" onChange={onChange} disabled />);

    const btn = screen.getByRole("button", { name: "Hoje" });
    expect(btn.hasAttribute("disabled")).toBe(true);
  });
});

describe("HealthReportsCoverageBanner", () => {
  it("renders 100% complete state when all subsystems have complete coverage", () => {
    const summary: HealthReportsCoverageSummary = {
      isAllComplete: true,
      forbiddenDogsCount: 0,
      failedDogsCount: 0,
      totalDogsInScope: 12,
      notes: [],
    };

    render(<HealthReportsCoverageBanner summary={summary} />);
    expect(screen.getByText(/Cobertura de Dados Completa/i)).toBeDefined();
    expect(screen.getByText(/Auditado 100%/i)).toBeDefined();
  });

  it("renders partial warning banner with breakdown when forbidden or failed dogs exist", () => {
    const summary: HealthReportsCoverageSummary = {
      isAllComplete: false,
      forbiddenDogsCount: 2,
      failedDogsCount: 1,
      totalDogsInScope: 12,
      notes: ["1 cão com projeção degradada"],
    };

    render(<HealthReportsCoverageBanner summary={summary} />);
    expect(screen.getByText(/Atenção: Cobertura Institucional Parcial/i)).toBeDefined();
    expect(screen.getByText(/2 cão\(ões\) com leitura negada/i)).toBeDefined();
    expect(screen.getByText(/1 cão\(ões\) com erro/i)).toBeDefined();
    expect(screen.getByText(/1 cão com projeção degradada/i)).toBeDefined();
  });
});

describe("HealthReportsKpiGrid", () => {
  const readiness: ReadinessReportMetrics = {
    totalDogsInScope: 10,
    evaluatedCount: 10,
    unevaluatedCount: 0,
    isCoverageComplete: true,
    statusCounts: {
      operational: 8,
      operational_attention: 1,
      fit_with_restrictions: 1,
      temporarily_unfit: 0,
      not_evaluated: 0,
    },
    activeRestrictionsCount: 2,
    restrictionsCoverageComplete: true,
    restrictionsByType: {
      absolute: 1,
      partial: 1,
      attention: 0,
    },
    dogsWithRestrictionsCount: 1,
  };

  const clinical: ClinicalReportMetrics = {
    totalCases: 5,
    activeCasesCount: 3,
    closedCasesCount: 2,
    casesOpenedInPeriodCount: 1,
    casesByStatus: {
      open: 1,
      under_investigation: 1,
      under_treatment: 1,
      monitoring: 0,
      discharged: 2,
      cancelled: 0,
    },
    unrecognizedStatusCount: 0,
    casesWithActiveRestrictionCount: 1,
    casesWithPendingScheduleCount: 2,
    coverage: {
      dogsInScope: 10,
      authorizedDogIds: ["dog-1"],
      forbiddenDogIds: [],
      failedDogIds: [],
      partialEntryIds: [],
      complete: true,
    },
    isTruthfulZero: false,
  };

  const schedule: ScheduleReportMetrics = {
    totalItems: 8,
    itemsInPeriodCount: 4,
    overdueCount: 1,
    pendingCount: 1,
    todayCount: 2,
    upcomingCount: 0,
    scheduledCount: 4,
    completedCount: 0,
    cancelledCount: 0,
    itemsByTypeInPeriod: {
      vaccination: 2,
      deworming: 2,
      dose: 0,
      exam: 0,
      consultation: 0,
      weighing: 0,
      reevaluation: 0,
      bath: 0,
      general: 0,
    },
    temporalUnavailableCount: 0,
    coverage: {
      dogsInScope: 10,
      authorizedDogIds: ["dog-1"],
      forbiddenDogIds: [],
      failedDogIds: [],
      partialEntryIds: [],
      complete: true,
    },
    isTruthfulZero: false,
  };

  const mockAggregate: HealthReportsAggregate = {
    period: "7d",
    referenceDate: new Date("2025-02-15T12:00:00Z"),
    readiness,
    clinical,
    schedule,
    filteredClinicalCases: [],
    filteredScheduleItems: [],
    coverageSummary: {
      isAllComplete: true,
      forbiddenDogsCount: 0,
      failedDogsCount: 0,
      totalDogsInScope: 10,
      notes: [],
    },
  };

  it("renders all 4 executive cards with accurate operational numbers", () => {
    render(<HealthReportsKpiGrid aggregate={mockAggregate} />);

    expect(screen.getByText("Prontidão da Tropa")).toBeDefined();
    expect(screen.getByText("Restrições Ativas")).toBeDefined();
    expect(screen.getByText("Casos Clínicos")).toBeDefined();
    expect(screen.getByText("Agenda de Procedimentos")).toBeDefined();

    expect(screen.getByText("8")).toBeDefined(); // Operational count
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1); // Restrictions count / today count
    expect(screen.getByText("3")).toBeDefined(); // Active cases
    expect(screen.getByText("4")).toBeDefined(); // Items in period
  });

  it("truthfully identifies degraded projections without conflating with not_evaluated", () => {
    const degradedAggregate: HealthReportsAggregate = {
      ...mockAggregate,
      readiness: {
        ...readiness,
        evaluatedCount: 8,
        unevaluatedCount: 2,
        isCoverageComplete: false,
      },
    };

    render(<HealthReportsKpiGrid aggregate={degradedAggregate} />);

    expect(screen.getByText(/2 sem projeção válida/i)).toBeDefined();
  });
});

describe("HealthReportsClinicalTable", () => {
  const cases: ClinicalCaseListEntry[] = [
    {
      entryId: "dog-1:c-1",
      dogId: "dog-1",
      caseId: "c-1",
      dog: {
        id: "dog-1",
        name: "Thor",
        registrationNumber: "K9-01",
        breed: "Pastor Belga Malinois",
        photoUrl: null,
        dateOfBirth: null,
        sex: "male",
        conductor: null,
        specialties: [],
      },
      case: {
        dogId: "dog-1",
        caseId: "c-1",
        title: "Dermatite Atópica",
        openedAt: new Date("2025-02-10T10:00:00Z"),
        openedBy: null,
        recordedBy: null,
        openingEventId: null,
        openingType: null,
        primaryProfessional: null,
        closedAt: null,
        closedBy: null,
        closureType: null,
        closureReason: null,
        clinicalStatus: "under_treatment",
        rawClinicalStatus: "under_treatment",
        dataQuality: "complete",
        schemaVersion: 1,
        issues: [],
        hasActiveRestriction: true,
        hasPendingSchedule: false,
        activeTreatmentsCount: 1,
        lastEventAt: null,
        eventCount: 1,
      },
    },
    {
      entryId: "dog-2:c-2",
      dogId: "dog-2",
      caseId: "c-2",
      dog: {
        id: "dog-2",
        name: "Ares",
        registrationNumber: "K9-02",
        breed: "Pastor Alemão",
        photoUrl: null,
        dateOfBirth: null,
        sex: "male",
        conductor: null,
        specialties: [],
      },
      case: {
        dogId: "dog-2",
        caseId: "c-2",
        title: "Rotina Preventiva",
        openedAt: new Date("2025-02-12T10:00:00Z"),
        openedBy: null,
        recordedBy: null,
        openingEventId: null,
        openingType: null,
        primaryProfessional: null,
        closedAt: null,
        closedBy: null,
        closureType: null,
        closureReason: null,
        clinicalStatus: "monitoring",
        rawClinicalStatus: "monitoring",
        dataQuality: "complete",
        schemaVersion: 1,
        issues: [],
        hasActiveRestriction: false,
        hasPendingSchedule: true,
        activeTreatmentsCount: 0,
        lastEventAt: null,
        eventCount: 1,
      },
    },
  ];

  it("renders clinical cases with dog names, titles and badges", () => {
    render(<HealthReportsClinicalTable cases={cases} periodLabel="7 dias" />);

    expect(screen.getByText("Thor")).toBeDefined();
    expect(screen.getByText("Dermatite Atópica")).toBeDefined();
    expect(screen.getByText("Ares")).toBeDefined();
    expect(screen.getByText("Rotina Preventiva")).toBeDefined();
  });

  it("filters cases dynamically by search term", () => {
    render(<HealthReportsClinicalTable cases={cases} periodLabel="7 dias" />);

    const input = screen.getByPlaceholderText(/Buscar por cão ou caso/i);
    fireEvent.change(input, { target: { value: "Ares" } });

    expect(screen.getByText("Ares")).toBeDefined();
    expect(screen.queryByText("Thor")).toBeNull();
  });
});

describe("HealthReportsScheduleTable", () => {
  const items: ComposedScheduleEntry[] = [
    {
      entry: {
        entryId: "dog-1:s-1",
        dogId: "dog-1",
        scheduleId: "s-1",
        dog: {
          id: "dog-1",
          name: "Thor",
          registrationNumber: "K9-01",
          breed: "Pastor Belga Malinois",
          photoUrl: null,
          dateOfBirth: null,
          sex: "male",
          conductor: null,
          specialties: [],
        },
        item: {
          dogId: "dog-1",
          scheduleId: "s-1",
          persistedDogId: "dog-1",
          scheduleType: "vaccination",
          rawScheduleType: "vaccination",
          title: "Vacina Antirrábica",
          scheduledFor: new Date("2025-03-01T14:00:00Z"),
          dueUntil: new Date("2025-03-01T18:00:00Z"),
          timezone: "America/Sao_Paulo",
          lifecycleStatus: "open",
          rawLifecycleStatus: "open",
          sourceType: "preventive",
          rawSourceType: "preventive",
          sourceId: null,
          caseId: null,
          completedAt: null,
          completedBy: null,
          cancelledAt: null,
          cancelledBy: null,
          cancelReason: null,
          createdAt: new Date("2025-03-01T10:00:00Z"),
          recordedBy: null,
          dataQuality: "complete",
          schemaVersion: 1,
          revision: 1,
          revisionSource: "canonical",
          issues: [],
          notes: null,
          migrationBatchId: null,
        },
      },
      temporal: {
        temporalStatus: "today",
        temporalAvailability: "available",
        effectiveDueUntil: new Date("2025-03-01T18:00:00Z"),
      },
      displayWindow: {
        inDisplayWindow: true,
        offsetDays: 0,
        availability: "available",
      },
    },
  ];

  it("renders scheduled procedure details and formatted date", () => {
    render(<HealthReportsScheduleTable items={items} periodLabel="Hoje" />);

    expect(screen.getByText("Thor")).toBeDefined();
    expect(screen.getByText("Vacina Antirrábica")).toBeDefined();
    expect(screen.getByText("Vacinação")).toBeDefined();
    expect(screen.getByText("Hoje")).toBeDefined();
  });
});

describe("HealthReportsExportToolbar", () => {
  const aggregate: HealthReportsAggregate = {
    period: "7d",
    referenceDate: new Date("2025-02-15T12:00:00Z"),
    readiness: {
      totalDogsInScope: 1,
      evaluatedCount: 1,
      unevaluatedCount: 0,
      isCoverageComplete: true,
      statusCounts: {
        operational: 1,
        operational_attention: 0,
        fit_with_restrictions: 0,
        temporarily_unfit: 0,
        not_evaluated: 0,
      },
      activeRestrictionsCount: 0,
      restrictionsCoverageComplete: true,
      restrictionsByType: { absolute: 0, partial: 0, attention: 0 },
      dogsWithRestrictionsCount: 0,
    },
    clinical: {
      totalCases: 0,
      activeCasesCount: 0,
      closedCasesCount: 0,
      casesOpenedInPeriodCount: 0,
      casesByStatus: {
        open: 0,
        under_investigation: 0,
        under_treatment: 0,
        monitoring: 0,
        discharged: 0,
        cancelled: 0,
      },
      unrecognizedStatusCount: 0,
      casesWithActiveRestrictionCount: 0,
      casesWithPendingScheduleCount: 0,
      coverage: {
        dogsInScope: 1,
        authorizedDogIds: ["dog-1"],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
      isTruthfulZero: true,
    },
    schedule: {
      totalItems: 0,
      itemsInPeriodCount: 0,
      overdueCount: 0,
      pendingCount: 0,
      todayCount: 0,
      upcomingCount: 0,
      scheduledCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      itemsByTypeInPeriod: {
        dose: 0,
        vaccination: 0,
        exam: 0,
        consultation: 0,
        weighing: 0,
        reevaluation: 0,
        deworming: 0,
        bath: 0,
        general: 0,
      },
      temporalUnavailableCount: 0,
      coverage: {
        dogsInScope: 1,
        authorizedDogIds: ["dog-1"],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
      isTruthfulZero: true,
    },
    filteredClinicalCases: [],
    filteredScheduleItems: [],
    coverageSummary: {
      isAllComplete: true,
      forbiddenDogsCount: 0,
      failedDogsCount: 0,
      totalDogsInScope: 1,
      notes: [],
    },
  };

  it("blocks export and displays lock warning when exportAuthority.canExport is false", () => {
    const authority: ReportExportAuthority = {
      canExport: false,
      reason: "Exportação desabilitada: aguardando ratificação de política institucional (F10).",
      hasCanonicalRead: true,
      hasExportCapability: true,
      isPolicyRatified: false,
    };

    render(
      <HealthReportsExportToolbar
        aggregate={aggregate}
        exportAuthority={authority}
      />
    );

    expect(screen.getByText(/Exportação desabilitada/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /CSV/i })).toBeNull();
  });

  it("renders CSV, XLSX, and PDF export buttons when authorized", () => {
    const authority: ReportExportAuthority = {
      canExport: true,
      hasCanonicalRead: true,
      hasExportCapability: true,
      isPolicyRatified: true,
    };

    render(
      <HealthReportsExportToolbar
        aggregate={aggregate}
        exportAuthority={authority}
      />
    );

    expect(screen.getByRole("button", { name: /CSV/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /XLSX/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /PDF/i })).toBeDefined();
  });
});
