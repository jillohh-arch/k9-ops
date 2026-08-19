/**
 * K9 Ops Web — Health Web v1 HW-3C
 * Read-Only Presentation Hook for the Readiness Workforce View (/health/readiness)
 *
 * Implements data composition for the readiness list according to:
 * - HW-3C Directives
 * - Approved Mockup HW-M02-READINESS-v1.png
 * - HEALTH_WEB_READINESS_POLICY.md §21-§26
 *
 * CRITICAL MANDATES:
 * - Read-only: strictly NO Firestore mutations or write callables.
 * - Reuses the single canonical composition path (loadReadinessScope).
 * - All presentation rules live in readiness-view-model.ts (pure, unit-tested).
 * - INVARIANT: missing projection !== not_evaluated.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadReadinessScope } from "./load-readiness-scope";
import {
  DEFAULT_READINESS_FILTERS,
  areReadinessFiltersActive,
  computeReadinessCoverage,
  countReadinessStatuses,
  filterAndSortReadinessItems,
  type ReadinessCoverage,
  type ReadinessFilters,
  type ReadinessStatusCounts,
} from "./readiness-view-model";
import type { ReadinessListItem } from "../../domain/readiness-types";

export type {
  ReadinessCoverage,
  ReadinessFilters,
  ReadinessQualityFilter,
  ReadinessRestrictionsFilter,
  ReadinessSortMode,
  ReadinessStatusCounts,
  ReadinessStatusFilter,
} from "./readiness-view-model";
export { DEFAULT_READINESS_FILTERS } from "./readiness-view-model";

export interface HealthReadinessState {
  status: "loading" | "success" | "empty" | "error" | "partial";
  /** All composed items in scope (unfiltered). */
  items: ReadinessListItem[];
  /** Items after filters + search, in the active sort order. */
  visibleItems: ReadinessListItem[];
  statusCounts: ReadinessStatusCounts;
  coverage: ReadinessCoverage;
  attentionRequiredCount: number;
  filters: ReadinessFilters;
  setFilters: (next: Partial<ReadinessFilters>) => void;
  resetFilters: () => void;
  /** True when any filter/search deviates from the default. */
  filtersActive: boolean;
  errorMessage: string | null;
  refetch: () => Promise<void>;
}

export function useHealthReadiness(): HealthReadinessState {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReadinessListItem[]>([]);
  const [isPartial, setIsPartial] = useState<boolean>(false);
  const [scopeEmpty, setScopeEmpty] = useState<boolean>(false);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);
  const [filters, setFiltersState] = useState<ReadinessFilters>(DEFAULT_READINESS_FILTERS);

  const refetch = useCallback(async () => {
    setReloadTrigger((prev) => prev + 1);
  }, []);

  const setFilters = useCallback((next: Partial<ReadinessFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_READINESS_FILTERS);
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    async function loadReadiness() {
      try {
        const scope = await loadReadinessScope();

        if (!isSubscribed) return;

        setItems(scope.items);
        setIsPartial(scope.isPartial);
        setScopeEmpty(scope.scopeEmpty);
        setLoading(false);
      } catch (err: unknown) {
        if (!isSubscribed) return;
        // Institutional dog list unavailable -> global controlled error.
        const msg =
          err instanceof Error
            ? err.message
            : "Erro desconhecido ao carregar a prontidão do efetivo";
        setError(msg);
        setLoading(false);
      }
    }

    void loadReadiness();

    return () => {
      isSubscribed = false;
    };
  }, [reloadTrigger]);

  const statusCounts = useMemo(() => countReadinessStatuses(items), [items]);
  const coverage = useMemo(() => computeReadinessCoverage(items), [items]);
  const visibleItems = useMemo(
    () => filterAndSortReadinessItems(items, filters),
    [items, filters],
  );

  const attentionRequiredCount =
    statusCounts.operational_attention +
    statusCounts.fit_with_restrictions +
    statusCounts.temporarily_unfit;

  let overallStatus: HealthReadinessState["status"] = "success";
  if (loading) {
    overallStatus = "loading";
  } else if (error) {
    overallStatus = "error";
  } else if (scopeEmpty || items.length === 0) {
    overallStatus = "empty";
  } else if (isPartial) {
    overallStatus = "partial";
  }

  return {
    status: overallStatus,
    items,
    visibleItems,
    statusCounts,
    coverage,
    attentionRequiredCount,
    filters,
    setFilters,
    resetFilters,
    filtersActive: areReadinessFiltersActive(filters),
    errorMessage: error,
    refetch,
  };
}
