/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * HealthReportsView integration and lifecycle tests.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { HealthReportsView } from "../presentation/health-reports-view";
import type { UseHealthReportsDataResult } from "../hooks/use-health-reports-data";
import type { HealthReportsAggregate } from "../domain/health-reports-types";

const mockUseHealthReportsData = vi.fn();
vi.mock("../hooks/use-health-reports-data", () => ({
  useHealthReportsData: () => mockUseHealthReportsData(),
}));

describe("HealthReportsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders ForbiddenState when user lacks health.read permission", () => {
    const hookResult: UseHealthReportsDataResult = {
      state: {
        status: "forbidden",
        requiredCapability: "health.read",
        message: "exige a capacidade institucional health.read",
      },
      authorityStatus: "forbidden",
      exportAuthority: { canExport: false, hasCanonicalRead: false, hasExportCapability: false },
      period: "7d",
      setPeriod: vi.fn(),
      refresh: vi.fn(),
    };
    mockUseHealthReportsData.mockReturnValue(hookResult);

    render(<HealthReportsView />);
    expect(screen.getByText(/Acesso proibido/i)).toBeDefined();
    expect(screen.getByText(/exige a capacidade institucional health.read/i)).toBeDefined();
  });

  it("renders LoadingState while loading data", () => {
    const hookResult: UseHealthReportsDataResult = {
      state: { status: "loading" },
      authorityStatus: "allowed",
      exportAuthority: { canExport: false, hasCanonicalRead: true, hasExportCapability: false },
      period: "7d",
      setPeriod: vi.fn(),
      refresh: vi.fn(),
    };
    mockUseHealthReportsData.mockReturnValue(hookResult);

    render(<HealthReportsView />);
    expect(screen.getByText(/Consolidando dados operacionais dos relatórios de saúde.../i)).toBeDefined();
  });

  it("renders ErrorState on technical failure and allows retry", () => {
    const refresh = vi.fn();
    const hookResult: UseHealthReportsDataResult = {
      state: {
        status: "error",
        code: "UNAVAILABLE",
        message: "Conexão com Firestore interrompida",
        retryable: true,
      },
      authorityStatus: "allowed",
      exportAuthority: { canExport: false, hasCanonicalRead: true, hasExportCapability: false },
      period: "7d",
      setPeriod: vi.fn(),
      refresh,
    };
    mockUseHealthReportsData.mockReturnValue(hookResult);

    render(<HealthReportsView />);
    expect(screen.getByText(/Erro ao carregar/i)).toBeDefined();
    expect(screen.getByText(/Conexão com Firestore interrompida/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("renders EmptyState when institutional scope is empty", () => {
    const hookResult: UseHealthReportsDataResult = {
      state: { status: "empty", query: "health-reports" },
      authorityStatus: "allowed",
      exportAuthority: { canExport: false, hasCanonicalRead: true, hasExportCapability: false },
      period: "7d",
      setPeriod: vi.fn(),
      refresh: vi.fn(),
    };
    mockUseHealthReportsData.mockReturnValue(hookResult);

    render(<HealthReportsView />);
    expect(screen.getByText(/Nenhum registro encontrado/i)).toBeDefined();
  });

  it("renders complete dashboard with tabs and allows tab navigation on success", () => {
    const setPeriod = vi.fn();
    const refresh = vi.fn();

    const mockAggregate: HealthReportsAggregate = {
      period: "7d",
      referenceDate: new Date("2025-02-15T12:00:00Z"),
      readiness: {
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
        activeRestrictionsCount: 1,
        restrictionsCoverageComplete: true,
        restrictionsByType: { absolute: 1, partial: 0, attention: 0 },
        dogsWithRestrictionsCount: 1,
      },
      clinical: {
        totalCases: 2,
        activeCasesCount: 2,
        closedCasesCount: 0,
        casesOpenedInPeriodCount: 1,
        casesByStatus: {
          open: 1,
          under_investigation: 0,
          under_treatment: 1,
          monitoring: 0,
          discharged: 0,
          cancelled: 0,
        },
        unrecognizedStatusCount: 0,
        casesWithActiveRestrictionCount: 1,
        casesWithPendingScheduleCount: 0,
        coverage: {
          dogsInScope: 10,
          authorizedDogIds: ["dog-1"],
          forbiddenDogIds: [],
          failedDogIds: [],
          partialEntryIds: [],
          complete: true,
        },
        isTruthfulZero: false,
      },
      schedule: {
        totalItems: 3,
        itemsInPeriodCount: 2,
        overdueCount: 0,
        pendingCount: 1,
        todayCount: 1,
        upcomingCount: 0,
        scheduledCount: 1,
        completedCount: 0,
        cancelledCount: 0,
        itemsByTypeInPeriod: {
          dose: 0,
          vaccination: 1,
          exam: 0,
          consultation: 0,
          weighing: 0,
          reevaluation: 0,
          deworming: 1,
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
      },
      filteredClinicalCases: [
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
            title: "Dermatite",
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
      ],
      filteredScheduleItems: [
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
              title: "Vacinação Anual",
              scheduledFor: new Date("2025-02-15T14:00:00Z"),
              dueUntil: new Date("2025-02-15T18:00:00Z"),
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
              createdAt: new Date("2025-02-15T10:00:00Z"),
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
            effectiveDueUntil: new Date("2025-02-15T18:00:00Z"),
          },
          displayWindow: {
            inDisplayWindow: true,
            offsetDays: 0,
            availability: "available",
          },
        },
      ],
      coverageSummary: {
        isAllComplete: true,
        forbiddenDogsCount: 0,
        failedDogsCount: 0,
        totalDogsInScope: 10,
        notes: [],
      },
    };

    const hookResult: UseHealthReportsDataResult = {
      state: { status: "success", data: mockAggregate, fetchedAt: new Date() },
      authorityStatus: "allowed",
      exportAuthority: { canExport: true, hasCanonicalRead: true, hasExportCapability: true },
      period: "7d",
      setPeriod,
      refresh,
    };
    mockUseHealthReportsData.mockReturnValue(hookResult);

    render(<HealthReportsView />);

    // Check main sections
    expect(screen.getByTestId("health-reports-view")).toBeDefined();
    expect(screen.getByText(/Prontidão da Tropa/i)).toBeDefined();
    expect(screen.getByText(/Cobertura de Dados Completa/i)).toBeDefined();

    // Clinical tab should be active by default
    expect(screen.getByText("Dermatite")).toBeDefined();

    // Click on Agenda tab
    const agendaTabBtn = screen.getByRole("button", { name: /Agenda e Procedimentos/i });
    fireEvent.click(agendaTabBtn);

    // Agenda table is now visible
    expect(screen.getByText("Vacinação Anual")).toBeDefined();

    // Changing period
    const todayBtn = screen.getByRole("button", { name: "Hoje" });
    fireEvent.click(todayBtn);
    expect(setPeriod).toHaveBeenCalledWith("today");
  });
});
