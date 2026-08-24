/**
 * K9 Ops Web — Health Web v1 HW-3C
 * Pure view-model logic for the Readiness Workforce View (/health/readiness).
 *
 * Deliberately FREE of Firebase/React imports so the readiness presentation
 * rules are directly unit-testable without initializing a Firebase app.
 *
 * CRITICAL MANDATES:
 * - Zero readiness calculation: status always comes from the Backend projection.
 * - INVARIANT: missing projection !== not_evaluated.
 * - partial !== conflict.
 */

import {
  OFFICIAL_READINESS_STATUSES,
  READINESS_STATUS_PRIORITY,
  type QualityStateLabel,
  type ReadinessListItem,
  type ReadinessStatus,
} from "../../domain/readiness-types";

/** Counts for the five operational summary cards. */
export interface ReadinessStatusCounts {
  operational: number;
  operational_attention: number;
  fit_with_restrictions: number;
  temporarily_unfit: number;
  not_evaluated: number;
}

/**
 * Technical read coverage. Describes the QUALITY OF THE READ, never health.
 * Deliberately NOT a score and NOT a percentage.
 */
export interface ReadinessCoverage {
  totalInScope: number;
  validProjections: number;
  partialReads: number;
  missingProjections: number;
  staleReads: number;
  conflicts: number;
}

export type ReadinessStatusFilter = "all" | ReadinessStatus;

/** Maps 1:1 onto the homologated QualityStateLabel union — no new vocabulary. */
export type ReadinessQualityFilter = "all" | QualityStateLabel;

export type ReadinessRestrictionsFilter = "all" | "with" | "without";

export type ReadinessSortMode = "priority" | "name" | "updated";

export interface ReadinessFilters {
  status: ReadinessStatusFilter;
  quality: ReadinessQualityFilter;
  restrictions: ReadinessRestrictionsFilter;
  search: string;
  sort: ReadinessSortMode;
}

export const DEFAULT_READINESS_FILTERS: ReadinessFilters = {
  status: "all",
  quality: "all",
  restrictions: "all",
  search: "",
  sort: "priority",
};

/**
 * A K9 has an interpretable projection only when a canonical summary was read.
 * This single gate protects the core invariant across counts, filters and rows.
 */
export function hasValidProjection(item: ReadinessListItem): boolean {
  return item.summary !== null;
}

/** MANDATE §9: counts come exclusively from valid canonical projections. */
export function countReadinessStatuses(items: ReadinessListItem[]): ReadinessStatusCounts {
  const counts: ReadinessStatusCounts = {
    operational: 0,
    operational_attention: 0,
    fit_with_restrictions: 0,
    temporarily_unfit: 0,
    not_evaluated: 0,
  };

  for (const item of items) {
    if (hasValidProjection(item) && OFFICIAL_READINESS_STATUSES.includes(item.readinessStatus)) {
      counts[item.readinessStatus] += 1;
    }
  }

  return counts;
}

/** MANDATE §10: technical coverage, never a health score. */
export function computeReadinessCoverage(items: ReadinessListItem[]): ReadinessCoverage {
  let validProjections = 0;
  let partialReads = 0;
  let missingProjections = 0;
  let staleReads = 0;
  let conflicts = 0;

  for (const item of items) {
    if (!hasValidProjection(item)) {
      missingProjections += 1;
      continue;
    }

    validProjections += 1;

    if (item.qualityLabel === "Parcial") partialReads += 1;
    if (item.qualityLabel === "Desatualizada") staleReads += 1;
    if (item.conflict?.hasConflict) conflicts += 1;
  }

  return {
    totalInScope: items.length,
    validProjections,
    partialReads,
    missingProjections,
    staleReads,
    conflicts,
  };
}

export function matchesReadinessSearch(item: ReadinessListItem, term: string): boolean {
  const needle = term.trim().toLocaleLowerCase("pt-BR");
  if (!needle) return true;

  const haystack = [
    item.dog.name,
    item.dog.registrationNumber ?? "",
    item.dog.conductor?.name ?? "",
    item.dog.conductor?.ra ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");

  return haystack.includes(needle);
}

/**
 * Applies filters then ordering over already-composed read models.
 * Never refetches and never mutates status to achieve ordering.
 */
export function filterAndSortReadinessItems(
  items: ReadinessListItem[],
  filters: ReadinessFilters,
): ReadinessListItem[] {
  const filtered = items.filter((item) => {
    const valid = hasValidProjection(item);

    // §12 REGRESSION GUARD: an operational status filter may only match a K9
    // whose VALID summary carries that status. A missing projection must never
    // surface under "Não avaliado".
    if (filters.status !== "all") {
      if (!valid || item.readinessStatus !== filters.status) {
        return false;
      }
    }

    // Technical quality filter reuses the homologated label, so
    // "Sem projeção válida" selects exactly the missing projections.
    if (filters.quality !== "all" && item.qualityLabel !== filters.quality) {
      return false;
    }

    if (filters.restrictions !== "all") {
      const hasRestrictions = item.activeRestrictionsSummary.length > 0;
      if (filters.restrictions === "with" && !hasRestrictions) return false;
      if (filters.restrictions === "without" && hasRestrictions) return false;
    }

    return matchesReadinessSearch(item, filters.search);
  });

  const sorted = [...filtered];

  if (filters.sort === "name") {
    sorted.sort((a, b) => a.dog.name.localeCompare(b.dog.name, "pt-BR"));
    return sorted;
  }

  if (filters.sort === "updated") {
    sorted.sort((a, b) => {
      const aTime = a.updatedAt?.getTime() ?? null;
      const bTime = b.updatedAt?.getTime() ?? null;
      // Unknown timestamps stay visible at the end rather than being buried.
      if (aTime === null && bTime === null) {
        return a.dog.name.localeCompare(b.dog.name, "pt-BR");
      }
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      return bTime - aTime;
    });
    return sorted;
  }

  // Default: operational priority (§13). Items without a valid projection are a
  // TECHNICAL problem and stay near the top instead of being buried; their
  // status is never mutated to achieve ordering.
  sorted.sort((a, b) => {
    const aValid = hasValidProjection(a);
    const bValid = hasValidProjection(b);

    if (aValid !== bValid) {
      return aValid ? 1 : -1;
    }

    if (!aValid && !bValid) {
      return a.dog.name.localeCompare(b.dog.name, "pt-BR");
    }

    const prioA = READINESS_STATUS_PRIORITY[a.readinessStatus] ?? 99;
    const prioB = READINESS_STATUS_PRIORITY[b.readinessStatus] ?? 99;

    if (prioA !== prioB) return prioA - prioB;

    return a.dog.name.localeCompare(b.dog.name, "pt-BR");
  });

  return sorted;
}

export function areReadinessFiltersActive(filters: ReadinessFilters): boolean {
  return (
    filters.status !== "all" ||
    filters.quality !== "all" ||
    filters.restrictions !== "all" ||
    filters.search.trim() !== "" ||
    filters.sort !== DEFAULT_READINESS_FILTERS.sort
  );
}
