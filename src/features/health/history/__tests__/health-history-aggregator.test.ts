import { describe, expect, it } from "vitest";
import {
  aggregateHealthHistory,
  filterTimelineItems,
  mapClinicalCaseToTimelineItem,
  mapRestrictionToTimelineItem,
  mapScheduleItemToTimelineItem,
} from "../domain/health-history-aggregator";
import type {
  HealthHistoryFilter,
  HealthTimelineItem,
} from "../domain/health-history-types";
import type { ClinicalCaseListEntry, ClinicalScopeResult } from "../../clinical/data/clinical-scope-loader";
import type { ScheduleListEntry, ScheduleScopeResult } from "../../schedule/data/schedule-scope-loader";
import type { ReadinessScope } from "../../presentation/hooks/load-readiness-scope";
import type { ReadinessListItem } from "../../domain/readiness-types";

describe("Health History Domain Aggregators & Filtering", () => {
  const referenceDate = new Date("2026-09-20T12:00:00.000Z");

  const mockDog = {
    id: "dog-1",
    name: "Rex",
    registrationNumber: "RG-1234",
    photoUrl: null,
    breed: "Pastor Alemão",
    sex: "Macho",
    dateOfBirth: new Date("2021-01-01"),
    conductor: { ra: "RA-999", name: "Guarda Silva" },
    specialties: [],
  };

  const mockClinicalEntry: ClinicalCaseListEntry = {
    entryId: "dog-1:c1",
    dogId: "dog-1",
    caseId: "c1",
    dog: mockDog,
    case: {
      dogId: "dog-1",
      caseId: "c1",
      clinicalStatus: "under_treatment",
      rawClinicalStatus: "under_treatment",
      title: "Otite Canina",
      openedAt: new Date("2026-09-18T10:00:00.000Z"),
      openedBy: { uid: "u1", name: "Vet Ana", internalRole: "veterinarian" },
      recordedBy: { uid: "u1", name: "Vet Ana", internalRole: "veterinarian" },
      openingEventId: null,
      openingType: null,
      primaryProfessional: { name: "Dra. Ana Silva", crmv: null, clinic: null },
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
  };

  const mockScheduleEntry: ScheduleListEntry = {
    entryId: "dog-1:s1",
    dogId: "dog-1",
    scheduleId: "s1",
    dog: mockDog,
    item: {
      dogId: "dog-1",
      scheduleId: "s1",
      persistedDogId: "dog-1",
      scheduleType: "vaccination",
      rawScheduleType: "vaccination",
      title: "Vacina Antirrábica",
      scheduledFor: new Date("2026-09-21T08:00:00.000Z"),
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
      createdAt: new Date("2026-09-10T08:00:00.000Z"),
      recordedBy: { uid: "u2", name: "Op Carlos", internalRole: "operator" },
      revision: 1,
      revisionSource: "canonical",
      schemaVersion: 1,
      notes: null,
      migrationBatchId: null,
      dataQuality: "complete",
      issues: [],
    },
  };

  const mockRestriction = {
    id: "r1",
    dogId: "dog-1",
    type: "partial" as const,
    status: "active" as const,
    reason: "Repouso pós-procedimento",
    description: "Sem salto durante 5 dias",
    restrictedActivities: ["jumping"],
    issuedAt: new Date("2026-09-19T14:00:00.000Z"),
    recordedBy: { ra: "RA-999", name: "Guarda Silva", role: "operator" },
    professional: { name: "Dr. Roberto" },
    sourceDocument: null,
    expectedEnd: new Date("2026-09-24T14:00:00.000Z"),
    actualEnd: null,
    authorityLabel: "Dr. Roberto",
    sourceDocumentUrl: null,
    clinicalCaseId: "c1",
    isOverdueReevaluation: false,
  };

  it("maps a clinical case to a truthful HealthTimelineItem", () => {
    const item = mapClinicalCaseToTimelineItem(mockClinicalEntry);
    expect(item.id).toBe("clinical:c1");
    expect(item.dogName).toBe("Rex");
    expect(item.category).toBe("clinical");
    expect(item.title).toBe("Otite Canina");
    expect(item.impact).toBe("high"); // because hasActiveRestriction is true
    expect(item.actor).toBe("Vet Ana");
    expect(item.professional).toBe("Dra. Ana Silva");
    expect(item.effectiveDate).toEqual(mockClinicalEntry.case.openedAt);
  });

  it("maps a schedule item to a truthful HealthTimelineItem", () => {
    const item = mapScheduleItemToTimelineItem(mockScheduleEntry);
    expect(item.id).toBe("schedule:s1");
    expect(item.dogName).toBe("Rex");
    expect(item.category).toBe("schedule");
    expect(item.title).toBe("Vacina Antirrábica");
    expect(item.statusLabel).toBe("Agendado");
    expect(item.source).toBe("canonical");
  });

  it("maps an operational restriction to a truthful HealthTimelineItem", () => {
    const mockReadinessItem: ReadinessListItem = {
      dog: mockDog,
      summary: null,
      readinessStatus: "fit_with_restrictions",
      readinessLabel: "Apto com restrições",
      reason: null,
      activeRestrictionsSummary: [],
      updatedAt: null,
      freshness: {
        evaluatedAt: referenceDate,
        readinessUpdatedAt: null,
        lastEvaluatedAt: null,
        updatedAt: null,
        ageMs: null,
        maxAgeMs: 86400000,
        isStale: false,
        isFutureAnomaly: false,
        hasValidTimestamp: false,
        status: "fresh",
      },
      dataQuality: { status: "success", data: null, fetchedAt: referenceDate },
      qualityLabel: "Atualizada",
      conflict: null,
      projectionMetadata: null,
      cockpitAvailable: true,
    };

    const scope: ReadinessScope = {
      items: [mockReadinessItem],
      activeRestrictions: [mockRestriction],
      isPartial: false,
      restrictionsCoverageComplete: true,
      scopeEmpty: false,
    };

    const item = mapRestrictionToTimelineItem(mockRestriction, scope);
    expect(item.id).toBe("restriction:r1");
    expect(item.dogName).toBe("Rex");
    expect(item.category).toBe("restriction");
    expect(item.impact).toBe("high");
    expect(item.actor).toBe("Guarda Silva");
  });

  it("aggregates and stably sorts items in descending chronological order", () => {
    const mockReadinessItem: ReadinessListItem = {
      dog: mockDog,
      summary: null,
      readinessStatus: "operational",
      readinessLabel: "Operacional",
      reason: null,
      activeRestrictionsSummary: [],
      updatedAt: null,
      freshness: {
        evaluatedAt: referenceDate,
        readinessUpdatedAt: null,
        lastEvaluatedAt: null,
        updatedAt: null,
        ageMs: null,
        maxAgeMs: 86400000,
        isStale: false,
        isFutureAnomaly: false,
        hasValidTimestamp: false,
        status: "fresh",
      },
      dataQuality: { status: "success", data: null, fetchedAt: referenceDate },
      qualityLabel: "Atualizada",
      conflict: null,
      projectionMetadata: null,
      cockpitAvailable: true,
    };

    const readinessScope: ReadinessScope = {
      items: [mockReadinessItem],
      activeRestrictions: [mockRestriction], // 2026-09-19
      isPartial: false,
      restrictionsCoverageComplete: true,
      scopeEmpty: false,
    };

    const clinicalResult: ClinicalScopeResult = {
      state: { status: "success", data: [mockClinicalEntry], fetchedAt: referenceDate }, // 2026-09-18
      coverage: {
        dogsInScope: 1,
        authorizedDogIds: ["dog-1"],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
    };

    const scheduleResult: ScheduleScopeResult = {
      state: { status: "success", data: [mockScheduleEntry], fetchedAt: referenceDate }, // 2026-09-21
      coverage: {
        dogsInScope: 1,
        authorizedDogIds: ["dog-1"],
        forbiddenDogIds: [],
        failedDogIds: [],
        partialEntryIds: [],
        complete: true,
      },
    };

    const filter: HealthHistoryFilter = {
      category: "all",
      period: "all",
      search: "",
    };

    const aggregate = aggregateHealthHistory(
      readinessScope,
      clinicalResult,
      scheduleResult,
      filter,
      referenceDate
    );

    expect(aggregate.totalCount).toBe(3);
    // Descending order: schedule (09-21), restriction (09-19), clinical (09-18)
    expect(aggregate.filteredItems[0].category).toBe("schedule");
    expect(aggregate.filteredItems[1].category).toBe("restriction");
    expect(aggregate.filteredItems[2].category).toBe("clinical");
  });

  it("filters items by category correctly", () => {
    const items: HealthTimelineItem[] = [
      mapClinicalCaseToTimelineItem(mockClinicalEntry),
      mapScheduleItemToTimelineItem(mockScheduleEntry),
    ];

    const filterClinical: HealthHistoryFilter = {
      category: "clinical",
      period: "all",
      search: "",
    };

    const filtered = filterTimelineItems(items, filterClinical, referenceDate);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].category).toBe("clinical");
  });

  it("filters items by search query across dog name and title", () => {
    const items: HealthTimelineItem[] = [
      mapClinicalCaseToTimelineItem(mockClinicalEntry),
      mapScheduleItemToTimelineItem(mockScheduleEntry),
    ];

    const filterSearch: HealthHistoryFilter = {
      category: "all",
      period: "all",
      search: "Otite",
    };

    const filtered = filterTimelineItems(items, filterSearch, referenceDate);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("Otite Canina");
  });
});
