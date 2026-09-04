/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Read-Only Presentation Hook for Health Overview (/health)
 *
 * Implements data composition for Health Overview according to:
 * - HW-3B Directives
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §12
 * - HEALTH_WEB_READINESS_POLICY.md §21-§26
 *
 * CRITICAL MANDATES:
 * - Read-only: strictly NO Firestore mutations or HTTP callables for write.
 * - Reuses canonical readiness foundation (readCanonicalHealthSummary, aggregateReadinessListItem).
 * - Counts 5 readiness status cards ONLY from valid projections.
 * - Missing/error projections do NOT count as "not_evaluated".
 * - Sorts priority K9 list by: temporarily_unfit > fit_with_restrictions > operational_attention > not_evaluated > operational.
 * - Preserves partial !== conflict distinction.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadReadinessScope } from "./load-readiness-scope";
import {
  useHealthOverviewReadAuthority,
  type HealthOverviewReadAuthority,
} from "./use-health-overview-read-authority";
import {
  OFFICIAL_READINESS_STATUSES,
  READINESS_STATUS_LABELS,
  READINESS_STATUS_PRIORITY,
  type OperationalRestrictionReadModel,
  type ReadinessListItem,
  type ReadinessStatus,
} from "../../domain/readiness-types";

export interface StatusCounts {
  operational: number;
  operational_attention: number;
  fit_with_restrictions: number;
  temporarily_unfit: number;
  not_evaluated: number;
}

export interface DonutSegment {
  status: ReadinessStatus;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface PendenciesSummary {
  weightGap: number;
  vaccineGap: number;
  consultGap: number;
  nutritionGap: number;
  totalPendencies: number;
  /**
   * K9s in scope whose completeness data could actually be evaluated.
   * MANDATE: absence of pendencies may only be affirmed over evaluated K9s.
   */
  evaluatedCount: number;
  /** K9s in scope with no interpretable completeness data (missing/degraded projection). */
  unevaluatedCount: number;
  /**
   * True only when every K9 in scope was successfully evaluated.
   * When false, "zero pendencies" is UNKNOWN, not proven.
   */
  coverageComplete: boolean;
}

export interface HealthOverviewState {
  status: "loading" | "success" | "empty" | "error" | "partial" | "forbidden";
  authority: HealthOverviewReadAuthority;
  items: ReadinessListItem[];
  statusCounts: StatusCounts;
  donutData: DonutSegment[];
  priorityK9s: ReadinessListItem[];
  activeRestrictions: OperationalRestrictionReadModel[];
  /** False when any restrictions read failed — absence cannot be affirmed. */
  restrictionsCoverageComplete: boolean;
  pendencies: PendenciesSummary;
  /** K9s with a valid canonical projection (NOT the total in scope). */
  totalMonitored: number;
  attentionRequiredCount: number;
  errorMessage: string | null;
  refetch: () => Promise<void>;
}

const STATUS_COLORS: Record<ReadinessStatus, string> = {
  operational: "#10b981", // Emerald 500
  operational_attention: "#f59e0b", // Amber 500
  fit_with_restrictions: "#6366f1", // Indigo 500
  temporarily_unfit: "#ef4444", // Red 500
  not_evaluated: "#64748b", // Slate 500
};

interface ScopeLoadedResult {
  cycleKey: string;
  items: ReadinessListItem[];
  activeRestrictions: OperationalRestrictionReadModel[];
  isPartial: boolean;
  restrictionsCoverageComplete: boolean;
  error: string | null;
}

const EMPTY_ITEMS: ReadinessListItem[] = [];
const EMPTY_RESTRICTIONS: OperationalRestrictionReadModel[] = [];

export function useHealthOverview(): HealthOverviewState {
  const authority = useHealthOverviewReadAuthority();
  const [dataResult, setDataResult] = useState<ScopeLoadedResult | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);

  const refetch = useCallback(async () => {
    setReloadTrigger((prev) => prev + 1);
  }, []);

  const cycleKey = `${authority.status}#${reloadTrigger}`;

  useEffect(() => {
    if (authority.status !== "allowed") {
      return;
    }

    let isSubscribed = true;

    async function loadOverview() {
      try {
        const scope = await loadReadinessScope();
        if (!isSubscribed) return;

        setDataResult({
          cycleKey,
          items: scope.items,
          activeRestrictions: scope.activeRestrictions,
          isPartial: scope.isPartial,
          restrictionsCoverageComplete: scope.restrictionsCoverageComplete,
          error: null,
        });
      } catch (err: unknown) {
        if (!isSubscribed) return;

        const message =
          err instanceof Error
            ? err.message
            : "Falha ao carregar visão geral de saúde";

        setDataResult({
          cycleKey,
          items: [],
          activeRestrictions: [],
          isPartial: false,
          restrictionsCoverageComplete: false,
          error: message,
        });
      }
    }

    void loadOverview();

    return () => {
      isSubscribed = false;
    };
  }, [authority.status, cycleKey]);

  const hasValidData =
    authority.status === "allowed" && dataResult?.cycleKey === cycleKey;

  const items = hasValidData && dataResult ? dataResult.items : EMPTY_ITEMS;
  const activeRestrictions =
    hasValidData && dataResult ? dataResult.activeRestrictions : EMPTY_RESTRICTIONS;
  const isPartial =
    hasValidData && dataResult ? dataResult.isPartial : false;
  const restrictionsCoverageComplete =
    hasValidData && dataResult ? dataResult.restrictionsCoverageComplete : true;
  const error =
    hasValidData && dataResult ? dataResult.error : null;

  // 3. Compute 5 status card counts (STRICT MANDATE §10)
  const statusCounts = useMemo<StatusCounts>(() => {
    const counts: StatusCounts = {
      operational: 0,
      operational_attention: 0,
      fit_with_restrictions: 0,
      temporarily_unfit: 0,
      not_evaluated: 0,
    };

    for (const item of items) {
      if (item.summary && OFFICIAL_READINESS_STATUSES.includes(item.readinessStatus)) {
        counts[item.readinessStatus] += 1;
      }
    }

    return counts;
  }, [items]);

  // 4. Compute Donut Chart Segment Distribution
  const totalMonitored = items.filter((i) => i.summary !== null).length;

  const donutData = useMemo<DonutSegment[]>(() => {
    if (totalMonitored === 0) return [];

    return OFFICIAL_READINESS_STATUSES.map((status) => {
      const count = statusCounts[status];
      const percentage = totalMonitored > 0 ? Math.round((count / totalMonitored) * 100) : 0;
      return {
        status,
        label: READINESS_STATUS_LABELS[status],
        count,
        percentage,
        color: STATUS_COLORS[status],
      };
    }).filter((seg) => seg.count > 0);
  }, [statusCounts, totalMonitored]);

  // 5. Compute Priority K9 List ("Situação dos K9s")
  const priorityK9s = useMemo<ReadinessListItem[]>(() => {
    return [...items].sort((a, b) => {
      const prioA = READINESS_STATUS_PRIORITY[a.readinessStatus] ?? 99;
      const prioB = READINESS_STATUS_PRIORITY[b.readinessStatus] ?? 99;

      if (prioA !== prioB) return prioA - prioB;

      return a.dog.name.localeCompare(b.dog.name, "pt-BR");
    });
  }, [items]);

  // 6. Compute Readiness Pendencies Summary
  const pendencies = useMemo<PendenciesSummary>(() => {
    let weightGap = 0;
    let vaccineGap = 0;
    let consultGap = 0;
    let nutritionGap = 0;
    let evaluatedCount = 0;

    for (const item of items) {
      // Completeness is only evaluable over a valid projection carrying dataCompleteness.
      const comp = item.summary?.dataCompleteness;
      const isEvaluable =
        item.summary !== null && item.readinessStatus !== "not_evaluated" && Boolean(comp);

      if (!isEvaluable) {
        continue;
      }

      evaluatedCount += 1;

      if (comp) {
        if (!comp.hasRecentWeight) weightGap += 1;
        if (!comp.hasVaccinationCurrent) vaccineGap += 1;
        if (!comp.hasActiveNutrition) nutritionGap += 1;
      }

      if (!item.summary?.lastConsultation) {
        consultGap += 1;
      }
    }

    return {
      weightGap,
      vaccineGap,
      consultGap,
      nutritionGap,
      totalPendencies: weightGap + vaccineGap + consultGap + nutritionGap,
      evaluatedCount,
      unevaluatedCount: items.length - evaluatedCount,
      // Absence of pendencies is only PROVEN when every K9 in scope was evaluated.
      coverageComplete: items.length > 0 && evaluatedCount === items.length,
    };
  }, [items]);

  const attentionRequiredCount =
    statusCounts.operational_attention +
    statusCounts.fit_with_restrictions +
    statusCounts.temporarily_unfit;

  let overallStatus: HealthOverviewState["status"] = "loading";
  if (authority.status === "loading") {
    overallStatus = "loading";
  } else if (authority.status === "forbidden") {
    overallStatus = "forbidden";
  } else if (!dataResult || dataResult.cycleKey !== cycleKey) {
    overallStatus = "loading";
  } else if (error) {
    overallStatus = "error";
  } else if (items.length === 0) {
    overallStatus = "empty";
  } else if (isPartial) {
    overallStatus = "partial";
  } else {
    overallStatus = "success";
  }

  return {
    status: overallStatus,
    authority,
    items,
    statusCounts,
    donutData,
    priorityK9s,
    activeRestrictions,
    restrictionsCoverageComplete,
    pendencies,
    totalMonitored,
    attentionRequiredCount,
    errorMessage: error,
    refetch,
  };
}
