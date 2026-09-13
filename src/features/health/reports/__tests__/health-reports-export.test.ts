import { describe, expect, it, vi } from "vitest";
import {
  executeHealthReportExport,
  formatHealthReportExportData,
} from "../lib/health-reports-export";
import type {
  HealthReportsAggregate,
  ReportExportAuthority,
} from "../domain/health-reports-types";
import { exportToCsv } from "@/lib/export/export-csv";
import { exportToXlsx } from "@/lib/export/export-xlsx";
import { exportToPdf } from "@/lib/export/export-pdf";

vi.mock("@/lib/export/export-csv", () => ({
  exportToCsv: vi.fn(),
}));

vi.mock("@/lib/export/export-xlsx", () => ({
  exportToXlsx: vi.fn(),
}));

vi.mock("@/lib/export/export-pdf", () => ({
  exportToPdf: vi.fn(),
}));

describe("F30 Health Reports Export Module", () => {
  const mockAggregate: HealthReportsAggregate = {
    period: "7d",
    referenceDate: new Date("2026-09-12T12:00:00.000Z"),
    readiness: {
      totalDogsInScope: 10,
      evaluatedCount: 10,
      unevaluatedCount: 0,
      isCoverageComplete: true,
      statusCounts: {
        operational: 7,
        operational_attention: 1,
        fit_with_restrictions: 1,
        temporarily_unfit: 1,
        not_evaluated: 0,
      },
      activeRestrictionsCount: 2,
      restrictionsCoverageComplete: true,
      restrictionsByType: { absolute: 1, partial: 1, attention: 0 },
      dogsWithRestrictionsCount: 2,
    },
    clinical: {
      totalCases: 3,
      activeCasesCount: 2,
      closedCasesCount: 1,
      casesOpenedInPeriodCount: 1,
      casesByStatus: {
        open: 1,
        under_treatment: 1,
        discharged: 1,
        under_investigation: 0,
        monitoring: 0,
        cancelled: 0,
      },
      unrecognizedStatusCount: 0,
      casesWithActiveRestrictionCount: 1,
      casesWithPendingScheduleCount: 1,
      coverage: {
        dogsInScope: 10,
        authorizedDogIds: ["d1", "d2"],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
      isTruthfulZero: false,
    },
    schedule: {
      totalItems: 5,
      itemsInPeriodCount: 3,
      overdueCount: 1,
      pendingCount: 0,
      todayCount: 1,
      upcomingCount: 2,
      scheduledCount: 1,
      completedCount: 0,
      cancelledCount: 0,
      itemsByTypeInPeriod: {
        vaccination: 1,
        exam: 1,
        dose: 1,
        consultation: 0,
        weighing: 0,
        reevaluation: 0,
        deworming: 0,
        bath: 0,
        general: 0,
      },
      temporalUnavailableCount: 0,
      coverage: {
        dogsInScope: 10,
        authorizedDogIds: ["d1"],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
      isTruthfulZero: false,
    },
    filteredClinicalCases: [
      {
        entryId: "dog-1:c1",
        dogId: "dog-1",
        caseId: "c1",
        dog: {
          id: "dog-1",
          name: "Thor",
          registrationNumber: "RG-100",
          photoUrl: null,
          breed: "Pastor Belga Malinois",
          sex: "Macho",
          dateOfBirth: null,
          conductor: null,
          specialties: [],
        },
        case: {
          dogId: "dog-1",
          caseId: "c1",
          clinicalStatus: "under_treatment",
          rawClinicalStatus: "under_treatment",
          title: "Lesão Podal",
          openedAt: new Date("2026-09-10T10:00:00.000Z"),
          openedBy: null,
          recordedBy: null,
          openingEventId: null,
          openingType: null,
          primaryProfessional: null,
          closedAt: null,
          closedBy: null,
          closureType: null,
          closureReason: null,
          hasActiveRestriction: true,
          hasPendingSchedule: true,
          activeTreatmentsCount: 1,
          lastEventAt: null,
          eventCount: 2,
          schemaVersion: 1,
          dataQuality: "complete",
          issues: [],
        },
      },
    ],
    filteredScheduleItems: [],
    coverageSummary: {
      isAllComplete: true,
      forbiddenDogsCount: 0,
      failedDogsCount: 0,
      totalDogsInScope: 10,
      notes: [],
    },
  };

  it("formats data for KPI summary dataset accurately", () => {
    const data = formatHealthReportExportData("kpi_summary", mockAggregate);
    expect(data.headers).toContain("Indicador");
    expect(data.rows.length).toBeGreaterThan(5);
    expect(data.title).toContain("K9 OPS");
  });

  it("formats clinical dataset correctly", () => {
    const data = formatHealthReportExportData("clinical", mockAggregate);
    expect(data.headers).toContain("Cão");
    expect(data.headers).toContain("Status Clínico");
    expect(data.rows[0][0]).toBe("Thor");
    expect(data.rows[0][1]).toBe("Lesão Podal");
    expect(data.rows[0][2]).toBe("Em Tratamento");
  });

  it("throws error and fails closed if canExport is false (even with health.read + reports.export present)", () => {
    const unratifiedAuthority: ReportExportAuthority = {
      canExport: false,
      reason: "Exportação desabilitada: aguardando ratificação de política institucional (F10).",
      hasCanonicalRead: true,
      hasExportCapability: true,
      isPolicyRatified: false,
    };

    expect(() =>
      executeHealthReportExport(
        "clinical",
        "csv",
        mockAggregate,
        unratifiedAuthority
      )
    ).toThrowError(/ratificação de política institucional \(F10\)/);

    expect(exportToCsv).not.toHaveBeenCalled();
    expect(exportToXlsx).not.toHaveBeenCalled();
    expect(exportToPdf).not.toHaveBeenCalled();
  });

  it("executes CSV, XLSX, and PDF exports when canExport is true (upon hypothetical future ratification)", () => {
    const ratifiedAuthority: ReportExportAuthority = {
      canExport: true,
      hasCanonicalRead: true,
      hasExportCapability: true,
      isPolicyRatified: true,
    };

    executeHealthReportExport("clinical", "csv", mockAggregate, ratifiedAuthority);
    expect(exportToCsv).toHaveBeenCalledTimes(1);

    executeHealthReportExport("clinical", "xlsx", mockAggregate, ratifiedAuthority);
    expect(exportToXlsx).toHaveBeenCalledTimes(1);

    executeHealthReportExport("clinical", "pdf", mockAggregate, ratifiedAuthority);
    expect(exportToPdf).toHaveBeenCalledTimes(1);
  });
});
