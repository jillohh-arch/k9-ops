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
 * - Gated by strict canonical read authority (useReadinessReadAuthority).
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
import { useReadinessReadAuthority } from "./use-readiness-read-authority";

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
  status: "loading" | "success" | "empty" | "error" | "partial" | "forbidden";
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

interface ScopeLoadedResult {
  cycleKey: string;
  items: ReadinessListItem[];
  isPartial: boolean;
  scopeEmpty: boolean;
  error: string | null;
}

export function useHealthReadiness(): HealthReadinessState {
  const authority = useReadinessReadAuthority();
  const [dataResult, setDataResult] = useState<ScopeLoadedResult | null>(null);
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

  const cycleKey = `${authority.status}#${reloadTrigger}`;

  useEffect(() => {
    // While authority is unresolved or denied, no read is even attempted.
    if (authority.status !== "allowed") {
      return;
    }

    let isSubscribed = true;

    async function loadReadiness() {
      try {
        const scope = await loadReadinessScope();

        if (!isSubscribed) return;

        setDataResult({
          cycleKey,
          items: scope.items,
          isPartial: scope.isPartial,
          scopeEmpty: scope.scopeEmpty,
          error: null,
        });
      } catch (err: unknown) {
        if (!isSubscribed) return;
        // Institutional dog list unavailable -> global controlled error.
        const msg =
          err instanceof Error
            ? err.message
            : "Erro desconhecido ao carregar a prontidão do efetivo";
        setDataResult({
          cycleKey,
          items: [],
          isPartial: false,
          scopeEmpty: false,
          error: msg,
        });
      }
    }

    void loadReadiness();

    return () => {
      isSubscribed = false;
    };
  }, [authority.status, cycleKey]);

  // Derived, authority-first state:
  // If authority is not allowed, or dataResult belongs to a superseded cycle,
  // data is strictly neutralized to guarantee no stale leakage.
  const hasValidData =
    authority.status === "allowed" && dataResult?.cycleKey === cycleKey;
  const items = useMemo(
    () => (hasValidData && dataResult ? dataResult.items : []),
    [hasValidData, dataResult],
  );
  const error = hasValidData ? dataResult.error : null;
  const isPartial = hasValidData ? dataResult.isPartial : false;
  const scopeEmpty = hasValidData ? dataResult.scopeEmpty : false;

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
  if (authority.status === "forbidden") {
    overallStatus = "forbidden";
  } else if (authority.status === "loading" || !hasValidData) {
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
