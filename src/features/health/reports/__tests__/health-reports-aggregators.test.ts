import { describe, expect, it } from "vitest";
import {
  aggregateClinical,
  aggregateHealthReports,
  aggregateReadiness,
  aggregateSchedule,
  isCaseOpenedInPeriod,
  isScheduleItemInPeriod,
} from "../domain/health-reports-aggregators";
import type { ReadinessScope } from "../../presentation/hooks/load-readiness-scope";
import type {
  ReadinessListItem,
  OperationalRestrictionReadModel,
  DogIdentityReadModel,
} from "../../domain/readiness-types";
import type {
  ClinicalCaseListEntry,
  ClinicalScopeResult,
} from "../../clinical/data/clinical-scope-loader";
import type { ComposedScheduleEntry } from "../../schedule/composition/schedule-composition";
import type { ScheduleScopeCoverage } from "../../schedule/data/schedule-scope-loader";

const baseDog: DogIdentityReadModel = {
  id: "dog-1",
  name: "Rex",
  registrationNumber: "RG-001",
  photoUrl: null,
  breed: "Pastor Alemão",
  sex: "Macho",
  dateOfBirth: null,
  conductor: null,
  specialties: [],
};

describe("F30 Health Reports Pure Aggregators", () => {
  describe("aggregateReadiness", () => {
    it("aggregates canonical readiness statuses only from valid projections", () => {
      const scope: ReadinessScope = {
        items: [
          {
            dog: { ...baseDog, id: "dog-1" },
            summary: null,
            readinessStatus: "operational",
            readinessLabel: "Operacional",
            reason: null,
            activeRestrictionsSummary: [],
            updatedAt: new Date(),
            freshness: {} as any,
            dataQuality: { status: "success", data: null as any, fetchedAt: new Date() },
            qualityLabel: "Atualizada",
            conflict: null,
            projectionMetadata: null,
            cockpitAvailable: true,
          },
          {
            dog: { ...baseDog, id: "dog-2" },
            summary: null,
            readinessStatus: "temporarily_unfit",
            readinessLabel: "Inapto",
            reason: "Tratamento",
            activeRestrictionsSummary: [],
            updatedAt: new Date(),
            freshness: {} as any,
            dataQuality: { status: "success", data: null as any, fetchedAt: new Date() },
            qualityLabel: "Atualizada",
            conflict: null,
            projectionMetadata: null,
            cockpitAvailable: true,
          },
        ],
        activeRestrictions: [],
        isPartial: false,
        restrictionsCoverageComplete: true,
        scopeEmpty: false,
      };

      const metrics = aggregateReadiness(scope);
      expect(metrics.totalDogsInScope).toBe(2);
      expect(metrics.evaluatedCount).toBe(2);
      expect(metrics.unevaluatedCount).toBe(0);
      expect(metrics.statusCounts.operational).toBe(1);
      expect(metrics.statusCounts.temporarily_unfit).toBe(1);
      expect(metrics.statusCounts.not_evaluated).toBe(0);
      expect(metrics.isCoverageComplete).toBe(true);
    });

    it("NEVER collapses missing/degraded projection into not_evaluated", () => {
      const scope: ReadinessScope = {
        items: [
          {
            dog: { ...baseDog, id: "dog-missing-projection" },
            summary: null,
            readinessStatus: "not_evaluated", // Default fallback in reader
            readinessLabel: "Não avaliado",
            reason: null,
            activeRestrictionsSummary: [],
            updatedAt: null,
            freshness: {} as any,
            dataQuality: { status: "error", code: "NOT_FOUND", message: "Missing doc", retryable: false },
            qualityLabel: "Sem projeção válida",
            conflict: null,
            projectionMetadata: null,
            cockpitAvailable: false,
          },
        ],
        activeRestrictions: [],
        isPartial: true,
        restrictionsCoverageComplete: true,
        scopeEmpty: false,
      };

      const metrics = aggregateReadiness(scope);
      expect(metrics.totalDogsInScope).toBe(1);
      expect(metrics.evaluatedCount).toBe(0);
      expect(metrics.unevaluatedCount).toBe(1);
      // Crucial test: not_evaluated must remain 0 because projection failed
      expect(metrics.statusCounts.not_evaluated).toBe(0);
      expect(metrics.isCoverageComplete).toBe(false);
    });

    it("tracks active restrictions and restrictionsCoverageComplete accurately", () => {
      const restriction: OperationalRestrictionReadModel = {
        id: "res-1",
        dogId: "dog-1",
        type: "absolute",
        status: "active",
        reason: "Cirurgia",
        description: "Repouso absoluto",
        restrictedActivities: ["running"],
        issuedAt: new Date(),
        recordedBy: null,
        professional: null,
        sourceDocument: null,
        expectedEnd: null,
        actualEnd: null,
        authorityLabel: "Vet",
        sourceDocumentUrl: null,
        clinicalCaseId: "case-1",
        isOverdueReevaluation: false,
      };

      const scope: ReadinessScope = {
        items: [
          {
            dog: { ...baseDog, id: "dog-1" },
            summary: null,
            readinessStatus: "fit_with_restrictions",
            readinessLabel: "Apto com restrições",
            reason: null,
            activeRestrictionsSummary: [restriction],
            updatedAt: new Date(),
            freshness: {} as any,
            dataQuality: { status: "success", data: null as any, fetchedAt: new Date() },
            qualityLabel: "Atualizada",
            conflict: null,
            projectionMetadata: null,
            cockpitAvailable: true,
          },
        ],
        activeRestrictions: [restriction],
        isPartial: false,
        restrictionsCoverageComplete: false, // E.g., one dog's restriction read failed
        scopeEmpty: false,
      };

      const metrics = aggregateReadiness(scope);
      expect(metrics.activeRestrictionsCount).toBe(1);
      expect(metrics.restrictionsCoverageComplete).toBe(false);
      expect(metrics.restrictionsByType.absolute).toBe(1);
      expect(metrics.dogsWithRestrictionsCount).toBe(1);
      expect(metrics.isCoverageComplete).toBe(false);
    });
  });

  describe("Clinical aggregators", () => {
    const now = new Date("2026-09-12T12:00:00.000Z");

    it("evaluates isCaseOpenedInPeriod correctly for today, 7d, and 30d", () => {
      const todayCase: ClinicalCaseListEntry = {
        entryId: "dog-1:c1",
        dogId: "dog-1",
        caseId: "c1",
        dog: baseDog,
        case: {
          dogId: "dog-1",
          caseId: "c1",
          clinicalStatus: "open",
          rawClinicalStatus: "open",
          title: "Otite",
          openedAt: new Date("2026-09-12T08:00:00.000Z"),
          openedBy: null,
          recordedBy: null,
          openingEventId: null,
          openingType: null,
          primaryProfessional: null,
          closedAt: null,
          closedBy: null,
          closureType: null,
          closureReason: null,
          hasActiveRestriction: false,
          hasPendingSchedule: false,
          activeTreatmentsCount: 0,
          lastEventAt: null,
          eventCount: 1,
          schemaVersion: 1,
          dataQuality: "complete",
          issues: [],
        },
      };

      const threeDaysAgoCase: ClinicalCaseListEntry = {
        ...todayCase,
        entryId: "dog-1:c2",
        case: {
          ...todayCase.case,
          caseId: "c2",
          openedAt: new Date("2026-09-09T10:00:00.000Z"),
        },
      };

      const fortyDaysAgoCase: ClinicalCaseListEntry = {
        ...todayCase,
        entryId: "dog-1:c3",
        case: {
          ...todayCase.case,
          caseId: "c3",
          openedAt: new Date("2026-08-01T10:00:00.000Z"),
        },
      };

      expect(isCaseOpenedInPeriod(todayCase, "today", now)).toBe(true);
      expect(isCaseOpenedInPeriod(threeDaysAgoCase, "today", now)).toBe(false);
      expect(isCaseOpenedInPeriod(threeDaysAgoCase, "7d", now)).toBe(true);
      expect(isCaseOpenedInPeriod(fortyDaysAgoCase, "7d", now)).toBe(false);
      expect(isCaseOpenedInPeriod(fortyDaysAgoCase, "30d", now)).toBe(false);
    });

    it("tracks active vs closed cases and detects truthful zero vs unproven zero", () => {
      const resultCompleteZero: ClinicalScopeResult = {
        state: { status: "success", data: [], fetchedAt: new Date() },
        coverage: {
          dogsInScope: 5,
          authorizedDogIds: ["d1", "d2", "d3", "d4", "d5"],
          forbiddenDogIds: [],
          failedDogIds: [],
          partialEntryIds: [],
          complete: true,
        },
      };

      const aggComplete = aggregateClinical(resultCompleteZero, "7d", now);
      expect(aggComplete.metrics.totalCases).toBe(0);
      expect(aggComplete.metrics.isTruthfulZero).toBe(true);

      const resultPartialZero: ClinicalScopeResult = {
        state: { status: "partial", partialData: [], failedSources: ["d3", "d4", "d5"], successfulSources: ["d1", "d2"] },
        coverage: {
          dogsInScope: 5,
          authorizedDogIds: ["d1", "d2"],
          forbiddenDogIds: ["d3", "d4"],
          failedDogIds: ["d5"],
          partialEntryIds: [],
          complete: false,
        },
      };

      const aggPartial = aggregateClinical(resultPartialZero, "7d", now);
      expect(aggPartial.metrics.totalCases).toBe(0);
      // MUST NOT be truthful zero because 3 dogs could not be read
      expect(aggPartial.metrics.isTruthfulZero).toBe(false);
    });
  });

  describe("Schedule aggregators", () => {
    const now = new Date("2026-09-12T12:00:00.000Z");

    it("evaluates isScheduleItemInPeriod and status counts correctly", () => {
      const entryToday: ComposedScheduleEntry = {
        entry: {
          entryId: "dog-1:s1",
          dogId: "dog-1",
          scheduleId: "s1",
          dog: baseDog,
          item: {
            dogId: "dog-1",
            scheduleId: "s1",
            persistedDogId: "dog-1",
            scheduleType: "vaccination",
            rawScheduleType: "vaccination",
            title: "Vacina Raiva",
            scheduledFor: new Date("2026-09-12T15:00:00.000Z"),
            dueUntil: null,
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
            createdAt: new Date(),
            recordedBy: null,
            revision: 1,
            revisionSource: "canonical",
            schemaVersion: 1,
            notes: null,
            migrationBatchId: null,
            dataQuality: "complete",
            issues: [],
          },
        },
        temporal: {
          temporalStatus: "today",
          temporalAvailability: "available",
          effectiveDueUntil: new Date("2026-09-13T15:00:00.000Z"),
        },
        displayWindow: {
          inDisplayWindow: true,
          offsetDays: 0,
          availability: "available",
        },
      };

      const entryOverdue: ComposedScheduleEntry = {
        ...entryToday,
        entry: {
          ...entryToday.entry,
          entryId: "dog-1:s2",
          item: {
            ...entryToday.entry.item,
            scheduleId: "s2",
            scheduledFor: new Date("2026-09-10T10:00:00.000Z"),
          },
        },
        temporal: {
          temporalStatus: "overdue",
          temporalAvailability: "available",
          effectiveDueUntil: new Date("2026-09-11T10:00:00.000Z"),
        },
        displayWindow: {
          inDisplayWindow: false,
          offsetDays: -2,
          availability: "available",
        },
      };

      expect(isScheduleItemInPeriod(entryToday, "today", now)).toBe(true);
      expect(isScheduleItemInPeriod(entryOverdue, "today", now)).toBe(false);

      const coverage: ScheduleScopeCoverage = {
        dogsInScope: 1,
        authorizedDogIds: ["dog-1"],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      };

      const { metrics, filteredItems } = aggregateSchedule(
        [entryToday, entryOverdue],
        coverage,
        "today",
        now
      );

      expect(metrics.totalItems).toBe(2);
      expect(metrics.itemsInPeriodCount).toBe(1);
      expect(metrics.overdueCount).toBe(1);
      expect(metrics.todayCount).toBe(1);
      // Overdue is included in filteredItems because it is actionable
      expect(filteredItems.length).toBe(2);
      expect(filteredItems[0].temporal.temporalStatus).toBe("overdue");
      expect(filteredItems[1].temporal.temporalStatus).toBe("today");
    });
  });

  describe("aggregateHealthReports", () => {
    it("synthesizes notes and coverage summary correctly", () => {
      const now = new Date("2026-09-12T12:00:00.000Z");

      const readinessScope: ReadinessScope = {
        items: [],
        activeRestrictions: [],
        isPartial: false,
        restrictionsCoverageComplete: true,
        scopeEmpty: true,
      };

      const clinicalResult: ClinicalScopeResult = {
        state: { status: "success", data: [], fetchedAt: new Date() },
        coverage: {
          dogsInScope: 0,
          authorizedDogIds: [],
          forbiddenDogIds: [],
          failedDogIds: [],
          partialEntryIds: [],
          complete: true,
        },
      };

      const scheduleCoverage: ScheduleScopeCoverage = {
        dogsInScope: 0,
        authorizedDogIds: [],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      };

      const aggregate = aggregateHealthReports(
        readinessScope,
        clinicalResult,
        [],
        scheduleCoverage,
        "today",
        now
      );

      expect(aggregate.coverageSummary.isAllComplete).toBe(true);
      expect(aggregate.coverageSummary.notes.length).toBe(0);
      expect(aggregate.readiness.totalDogsInScope).toBe(0);
      expect(aggregate.clinical.totalCases).toBe(0);
      expect(aggregate.schedule.totalItems).toBe(0);
    });
  });
});
