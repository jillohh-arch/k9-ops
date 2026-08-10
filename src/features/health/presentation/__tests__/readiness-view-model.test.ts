/**
 * K9 Ops Web — Health Web v1 HW-3C
 * Unit tests for the pure readiness view-model logic.
 *
 * Covers the §28 synthetic scope and, above all, the §12 filter regression:
 *
 *   filter "Não avaliado"        -> ONLY valid not_evaluated projections
 *   filter "Sem projeção válida" -> ONLY missing/invalid projections
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_READINESS_FILTERS,
  areReadinessFiltersActive,
  computeReadinessCoverage,
  countReadinessStatuses,
  filterAndSortReadinessItems,
  hasValidProjection,
  matchesReadinessSearch,
  type ReadinessFilters,
} from "../hooks/readiness-view-model";
import { aggregateReadinessListItem } from "../../domain/readiness-aggregator";
import type {
  CanonicalHealthSummaryDoc,
  CanonicalRestrictionDoc,
  DogIdentityReadModel,
  ReadinessListItem,
  ReadinessStatus,
} from "../../domain/readiness-types";

const NOW = new Date();
const OLDER = new Date(NOW.getTime() - 60 * 60 * 1000);

function dog(
  id: string,
  name: string,
  registration: string,
  conductor?: string,
): DogIdentityReadModel {
  return {
    id,
    name,
    registrationNumber: registration,
    photoUrl: null,
    breed: null,
    sex: null,
    dateOfBirth: null,
    conductor: conductor ? { ra: "691755", name: conductor } : null,
    specialties: [],
  };
}

function summary(
  dogId: string,
  readinessStatus: ReadinessStatus,
  updatedAt: Date,
): CanonicalHealthSummaryDoc {
  return {
    dogId,
    readinessStatus,
    readinessLabel: readinessStatus,
    readinessReason: "Motivo canônico",
    readinessUpdatedAt: updatedAt,
    lastEvaluatedAt: updatedAt,
    updatedAt,
    evaluatedBy: "function_v1",
    activeRestrictions: [],
    restrictionCount: { absolute: 0, partial: 0, attention: 0 },
    dataCompleteness: null,
    activeCasesCount: 0,
    activeTreatmentsCount: 0,
    pendingScheduleCount: 0,
    overdueScheduleCount: 0,
    schemaVersion: 1,
    rawWireDoc: {},
  } as CanonicalHealthSummaryDoc;
}

const activeRestriction = (dogId: string): CanonicalRestrictionDoc =>
  ({
    id: `r-${dogId}`,
    dogId,
    level: "partial",
    status: "active",
    description: "Restrição parcial vigente",
    activitiesRestricted: ["mordida"],
    issuedAt: NOW,
    recordedBy: null,
    professional: null,
    sourceDocument: null,
    expectedEnd: null,
    actualEnd: null,
    caseId: null,
  }) as unknown as CanonicalRestrictionDoc;

// §28 synthetic scope -------------------------------------------------------

/** Dog A: operational, fresh. */
const dogA = (): ReadinessListItem =>
  aggregateReadinessListItem({
    dog: dog("k9-a", "Apolo", "123456", "Castro Silva"),
    summary: summary("k9-a", "operational", NOW),
    restrictions: [],
  });

/** Dog B: operational_attention, fresh. */
const dogB = (): ReadinessListItem =>
  aggregateReadinessListItem({
    dog: dog("k9-b", "Bono", "111222", "Ragonha"),
    summary: summary("k9-b", "operational_attention", NOW),
    restrictions: [],
  });

/** Dog C: fit_with_restrictions, partial read, WITH an active restriction. */
const dogC = (): ReadinessListItem =>
  aggregateReadinessListItem({
    dog: dog("k9-c", "Cesar", "333444"),
    summary: {
      ...summary("k9-c", "fit_with_restrictions", OLDER),
      restrictionCount: { absolute: 0, partial: 1, attention: 0 },
    },
    restrictions: [activeRestriction("k9-c")],
    dataQuality: {
      status: "partial",
      partialData: {},
      failedSources: ["clinical_cases"],
      successfulSources: ["health_summary"],
    },
  });

/** Dog D: VALID not_evaluated projection. */
const dogD = (): ReadinessListItem =>
  aggregateReadinessListItem({
    dog: dog("k9-d", "Duke", "555666"),
    summary: summary("k9-d", "not_evaluated", NOW),
    restrictions: [],
  });

/** Dog E: MISSING health_summary. */
const dogE = (): ReadinessListItem =>
  aggregateReadinessListItem({
    dog: dog("k9-e", "Eros", "777888"),
    summary: null,
    restrictions: [],
    dataQuality: { status: "empty", query: "dogs/k9-e/health_summary/current" },
  });

const scope = (): ReadinessListItem[] => [dogA(), dogB(), dogC(), dogD(), dogE()];

function withFilters(overrides: Partial<ReadinessFilters>): ReadinessFilters {
  return { ...DEFAULT_READINESS_FILTERS, ...overrides };
}

// ---------------------------------------------------------------------------

describe("HW-3C view-model — §28 synthetic scope", () => {
  it("proves the expected operational card counts over 5 dogs", () => {
    const items = scope();

    expect(items).toHaveLength(5);
    expect(countReadinessStatuses(items)).toEqual({
      operational: 1,
      operational_attention: 1,
      fit_with_restrictions: 1,
      temporarily_unfit: 0,
      not_evaluated: 1,
    });
  });

  it("reports one missing projection in technical coverage", () => {
    const coverage = computeReadinessCoverage(scope());

    expect(coverage.totalInScope).toBe(5);
    expect(coverage.validProjections).toBe(4);
    expect(coverage.missingProjections).toBe(1);
    expect(coverage.partialReads).toBe(1);
    expect(coverage.conflicts).toBe(0);
  });

  it("identifies valid vs missing projections", () => {
    expect(hasValidProjection(dogA())).toBe(true);
    expect(hasValidProjection(dogE())).toBe(false);
  });
});

describe("HW-3C view-model — §12 filter semantics (critical regression)", () => {
  it("filter not_evaluated returns ONLY Dog D, never the missing projection", () => {
    const result = filterAndSortReadinessItems(scope(), withFilters({ status: "not_evaluated" }));

    expect(result).toHaveLength(1);
    expect(result[0].dog.id).toBe("k9-d");
    expect(result.some((item) => item.dog.id === "k9-e")).toBe(false);
  });

  it("filter 'Sem projeção válida' returns ONLY Dog E", () => {
    const result = filterAndSortReadinessItems(
      scope(),
      withFilters({ quality: "Sem projeção válida" }),
    );

    expect(result).toHaveLength(1);
    expect(result[0].dog.id).toBe("k9-e");
  });

  it("every operational status filter excludes the missing projection", () => {
    const statuses: ReadinessStatus[] = [
      "operational",
      "operational_attention",
      "fit_with_restrictions",
      "temporarily_unfit",
      "not_evaluated",
    ];

    for (const status of statuses) {
      const result = filterAndSortReadinessItems(scope(), withFilters({ status }));
      expect(result.some((item) => item.summary === null)).toBe(false);
    }
  });

  it("filter Parcial selects the partial read without treating it as conflict", () => {
    const result = filterAndSortReadinessItems(scope(), withFilters({ quality: "Parcial" }));

    expect(result).toHaveLength(1);
    expect(result[0].dog.id).toBe("k9-c");
    expect(result[0].readinessStatus).toBe("fit_with_restrictions");
    expect(result[0].conflict?.hasConflict ?? false).toBe(false);

    // And no conflict exists anywhere in this scope.
    expect(filterAndSortReadinessItems(scope(), withFilters({ quality: "Conflito" }))).toHaveLength(0);
  });

  it("restrictions filter uses canonical active restrictions", () => {
    const withRestrictions = filterAndSortReadinessItems(
      scope(),
      withFilters({ restrictions: "with" }),
    );
    expect(withRestrictions).toHaveLength(1);
    expect(withRestrictions[0].dog.id).toBe("k9-c");

    const without = filterAndSortReadinessItems(scope(), withFilters({ restrictions: "without" }));
    expect(without).toHaveLength(4);
  });
});

describe("HW-3C view-model — search", () => {
  it("matches by dog name, registration and conductor", () => {
    expect(matchesReadinessSearch(dogA(), "apolo")).toBe(true);
    expect(matchesReadinessSearch(dogA(), "123456")).toBe(true);
    expect(matchesReadinessSearch(dogA(), "Castro")).toBe(true);
    expect(matchesReadinessSearch(dogA(), "Bono")).toBe(false);
  });

  it("an empty term matches everything", () => {
    expect(matchesReadinessSearch(dogA(), "")).toBe(true);
    expect(matchesReadinessSearch(dogA(), "   ")).toBe(true);
    expect(filterAndSortReadinessItems(scope(), withFilters({ search: "  " }))).toHaveLength(5);
  });

  it("search narrows the visible list", () => {
    const result = filterAndSortReadinessItems(scope(), withFilters({ search: "Duke" }));

    expect(result).toHaveLength(1);
    expect(result[0].dog.id).toBe("k9-d");
  });

  it("search combines with the status filter", () => {
    const result = filterAndSortReadinessItems(
      scope(),
      withFilters({ status: "operational", search: "Bono" }),
    );

    // Bono is operational_attention, so the intersection is empty.
    expect(result).toHaveLength(0);
  });
});

describe("HW-3C view-model — ordering (§13)", () => {
  it("default priority keeps technical problems visible and never buries them", () => {
    const order = filterAndSortReadinessItems(scope(), DEFAULT_READINESS_FILTERS).map(
      (item) => item.dog.id,
    );

    // Missing projection first (technical), then temporarily_unfit > fit_with_restrictions
    // > operational_attention > not_evaluated > operational.
    expect(order).toEqual(["k9-e", "k9-c", "k9-b", "k9-d", "k9-a"]);
  });

  it("respects the documented priority weights among valid projections", () => {
    const valid = [dogA(), dogB(), dogC(), dogD()];
    const order = filterAndSortReadinessItems(valid, DEFAULT_READINESS_FILTERS).map(
      (item) => item.readinessStatus,
    );

    expect(order).toEqual([
      "fit_with_restrictions",
      "operational_attention",
      "not_evaluated",
      "operational",
    ]);
  });

  it("sorts by name deterministically", () => {
    const order = filterAndSortReadinessItems(scope(), withFilters({ sort: "name" })).map(
      (item) => item.dog.name,
    );

    expect(order).toEqual(["Apolo", "Bono", "Cesar", "Duke", "Eros"]);
  });

  it("sorts by last update, keeping unknown timestamps visible at the end", () => {
    const order = filterAndSortReadinessItems(scope(), withFilters({ sort: "updated" })).map(
      (item) => item.dog.id,
    );

    // Dog C is older; Dog E has no valid timestamp and must not disappear.
    expect(order[order.length - 1]).toBe("k9-e");
    expect(order).toContain("k9-c");
    expect(order).toHaveLength(5);
  });

  it("does not mutate readiness status to achieve ordering", () => {
    const items = scope();
    const before = items.map((item) => item.readinessStatus);

    filterAndSortReadinessItems(items, DEFAULT_READINESS_FILTERS);

    expect(items.map((item) => item.readinessStatus)).toEqual(before);
    // And the input array itself is not reordered in place.
    expect(items.map((item) => item.dog.id)).toEqual(["k9-a", "k9-b", "k9-c", "k9-d", "k9-e"]);
  });
});

describe("HW-3C view-model — filter state", () => {
  it("defaults are considered inactive", () => {
    expect(areReadinessFiltersActive(DEFAULT_READINESS_FILTERS)).toBe(false);
  });

  it("any deviation marks filters active", () => {
    expect(areReadinessFiltersActive(withFilters({ status: "operational" }))).toBe(true);
    expect(areReadinessFiltersActive(withFilters({ quality: "Parcial" }))).toBe(true);
    expect(areReadinessFiltersActive(withFilters({ restrictions: "with" }))).toBe(true);
    expect(areReadinessFiltersActive(withFilters({ search: "Apolo" }))).toBe(true);
    expect(areReadinessFiltersActive(withFilters({ sort: "name" }))).toBe(true);
    // Whitespace-only search is not a real filter.
    expect(areReadinessFiltersActive(withFilters({ search: "   " }))).toBe(false);
  });

  it("resetting to defaults restores the full scope", () => {
    const narrowed = filterAndSortReadinessItems(scope(), withFilters({ status: "operational" }));
    expect(narrowed).toHaveLength(1);

    expect(filterAndSortReadinessItems(scope(), DEFAULT_READINESS_FILTERS)).toHaveLength(5);
  });

  it("an empty scope yields zero counts and zero coverage without throwing", () => {
    expect(countReadinessStatuses([])).toEqual({
      operational: 0,
      operational_attention: 0,
      fit_with_restrictions: 0,
      temporarily_unfit: 0,
      not_evaluated: 0,
    });
    expect(computeReadinessCoverage([])).toEqual({
      totalInScope: 0,
      validProjections: 0,
      partialReads: 0,
      missingProjections: 0,
      staleReads: 0,
      conflicts: 0,
    });
    expect(filterAndSortReadinessItems([], DEFAULT_READINESS_FILTERS)).toEqual([]);
  });
});
