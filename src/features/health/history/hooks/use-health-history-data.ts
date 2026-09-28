/**
 * K9 Ops Web — Health Web v1 F30 History
 * Canonical hook for Health History data composition & authority gating.
 *
 * HARD SECURITY & INTEGRITY INVARIANTS:
 * - Gated strictly on canonical Health read authority: health.view === true satisfies domain health.read (CT3.AUTH-HEALTH-01).
 * - While authority is not `allowed`, ZERO Firestore queries are made.
 * - Composes the 3 frozen institutional scope loaders in parallel:
 *   1. `loadReadinessScope`
 *   2. `loadClinicalScope`
 *   3. `loadScheduleScope`
 * - Race-safe: superseded cycles are discarded.
 * - Truthful empty states: distinguishes scope-empty from filter-empty.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import type { ReadState } from "../../domain/read-states";
import {
  loadReadinessScope,
  type ReadinessScope,
} from "../../presentation/hooks/load-readiness-scope";
import {
  loadClinicalScope,
  type ClinicalScopeResult,
} from "../../clinical/data/clinical-scope-loader";
import {
  loadScheduleScope,
  type ScheduleScopeResult,
} from "../../schedule/data/schedule-scope-loader";
import { aggregateHealthHistory } from "../domain/health-history-aggregator";
import type {
  HealthHistoryAggregate,
  HealthHistoryAuthorityStatus,
  HealthHistoryCategory,
  HealthHistoryFilter,
  HealthHistoryPeriod,
} from "../domain/health-history-types";

export interface UseHealthHistoryDataResult {
  /** Canonical read state for the history aggregate */
  state: ReadState<HealthHistoryAggregate>;
  /** Authority status for health.read */
  authorityStatus: HealthHistoryAuthorityStatus;
  /** Active filters */
  filter: HealthHistoryFilter;
  /** Sets active category filter */
  setCategory: (category: HealthHistoryCategory) => void;
  /** Sets active period filter */
  setPeriod: (period: HealthHistoryPeriod) => void;
  /** Sets search query */
  setSearch: (search: string) => void;
  /** Resets filters to default */
  resetFilters: () => void;
  /** Re-triggers loading cycle */
  refresh: () => void;
}

function rawHealthPermissions(
  permissions: unknown
): Record<string, unknown> | null {
  if (!permissions || typeof permissions !== "object") return null;
  const health = (permissions as Record<string, unknown>).health;
  if (!health || typeof health !== "object") return null;
  return health as Record<string, unknown>;
}

interface LoadedHistoryCycleData {
  cycleKey: string;
  readinessScope: ReadinessScope;
  clinicalResult: ClinicalScopeResult;
  scheduleResult: ScheduleScopeResult;
  loadedAt: Date;
}

const DEFAULT_FILTER: HealthHistoryFilter = {
  category: "all",
  period: "all",
  search: "",
};

export function useHealthHistoryData(): UseHealthHistoryDataResult {
  const { profile, status: accessStatus } = useAccessControl();
  const [filter, setFilter] = useState<HealthHistoryFilter>(DEFAULT_FILTER);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [loadedData, setLoadedData] = useState<LoadedHistoryCycleData | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    setReloadTrigger((prev) => prev + 1);
  }, []);

  const setCategory = useCallback((category: HealthHistoryCategory) => {
    setFilter((prev) => ({ ...prev, category }));
  }, []);

  const setPeriod = useCallback((period: HealthHistoryPeriod) => {
    setFilter((prev) => ({ ...prev, period }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setFilter((prev) => ({ ...prev, search }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilter(DEFAULT_FILTER);
  }, []);

  // Strict authority derivation
  const authorityStatus = useMemo<HealthHistoryAuthorityStatus>(() => {
    if (accessStatus === "loading") {
      return "loading";
    }

    const profileActive = profile?.status === "active";
    const health = rawHealthPermissions(profile?.permissions);

    // CT3.AUTH-HEALTH-01: F10 persisted grant health.view === true satisfies
    // canonical domain read authority health.read.
    const hasCanonicalRead = health?.view === true;

    if (!profileActive || !hasCanonicalRead) {
      return "forbidden";
    }

    return "allowed";
  }, [accessStatus, profile]);

  const cycleKey = `${authorityStatus}#${reloadTrigger}`;

  useEffect(() => {
    if (authorityStatus !== "allowed") {
      return;
    }

    let active = true;

    const runCycle = async () => {
      try {
        const now = new Date();

        // Run all three canonical scope loaders in parallel
        const [readinessScope, clinicalResult, scheduleResult] =
          await Promise.all([
            loadReadinessScope(),
            loadClinicalScope(),
            loadScheduleScope(),
          ]);

        if (!active) return;

        setLoadedData({
          cycleKey,
          readinessScope,
          clinicalResult,
          scheduleResult,
          loadedAt: now,
        });
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    runCycle();

    return () => {
      active = false;
    };
  }, [authorityStatus, cycleKey]);

  // Compute read state
  const state = useMemo<ReadState<HealthHistoryAggregate>>(() => {
    if (authorityStatus === "loading") {
      return { status: "loading" };
    }

    if (authorityStatus === "forbidden") {
      return {
        status: "forbidden",
        requiredCapability: "health.read",
        message: "Acesso ao histórico de saúde não autorizado para este perfil.",
      };
    }

    if (loadError) {
      return {
        status: "error",
        code: "HISTORY_LOAD_FAILED",
        message: loadError.message || "Erro ao carregar dados do histórico de saúde.",
        technicalDetails: loadError.stack,
        retryable: true,
      };
    }

    if (!loadedData || loadedData.cycleKey !== cycleKey) {
      return { status: "loading" };
    }

    const now = loadedData.loadedAt;
    const aggregate = aggregateHealthHistory(
      loadedData.readinessScope,
      loadedData.clinicalResult,
      loadedData.scheduleResult,
      filter,
      now
    );

    // If there are zero events in the entire scope
    if (aggregate.totalCount === 0) {
      return {
        status: "empty",
        query: "health-history",
      };
    }

    if (aggregate.isPartial) {
      const failedSources: string[] = [];
      const successfulSources: string[] = [];
      if (loadedData.readinessScope.isPartial) {
        failedSources.push("readiness");
      } else {
        successfulSources.push("readiness");
      }
      if (!loadedData.clinicalResult.coverage.complete) {
        failedSources.push("clinical");
      } else {
        successfulSources.push("clinical");
      }
      if (!loadedData.scheduleResult.coverage.complete) {
        failedSources.push("schedule");
      } else {
        successfulSources.push("schedule");
      }

      return {
        status: "partial",
        partialData: aggregate,
        failedSources,
        successfulSources,
      };
    }

    return {
      status: "success",
      data: aggregate,
      fetchedAt: now,
    };
  }, [authorityStatus, loadError, loadedData, cycleKey, filter]);

  return {
    state,
    authorityStatus,
    filter,
    setCategory,
    setPeriod,
    setSearch,
    resetFilters,
    refresh,
  };
}
