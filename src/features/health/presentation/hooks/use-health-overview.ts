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
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { readCanonicalHealthSummary } from "../../data/readers/summary-reader";
import { readCanonicalOperationalRestrictions } from "../../data/readers/restrictions-reader";
import {
  aggregateReadinessListItem,
  normalizeRestrictionDoc,
} from "../../domain/readiness-aggregator";
import {
  OFFICIAL_READINESS_STATUSES,
  READINESS_STATUS_LABELS,
  READINESS_STATUS_PRIORITY,
  type CanonicalHealthSummaryDoc,
  type CanonicalRestrictionDoc,
  type DogIdentityReadModel,
  type OperationalRestrictionReadModel,
  type ReadinessListItem,
  type ReadinessStatus,
} from "../../domain/readiness-types";
import type { ReadState } from "../../domain/read-states";

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
  status: "loading" | "success" | "empty" | "error" | "partial";
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

export function useHealthOverview(): HealthOverviewState {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReadinessListItem[]>([]);
  const [activeRestrictions, setActiveRestrictions] = useState<OperationalRestrictionReadModel[]>([]);
  const [isPartial, setIsPartial] = useState<boolean>(false);
  /**
   * False when at least one restrictions read failed, so "no active restrictions"
   * cannot be affirmed for the whole scope.
   */
  const [restrictionsCoverageComplete, setRestrictionsCoverageComplete] = useState<boolean>(true);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);

  const refetch = useCallback(async () => {
    setReloadTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    async function loadOverview() {
      try {
        const dogsRef = collection(db, "dogs");
        const dogsSnap = await getDocs(dogsRef);

        if (!isSubscribed) return;

        if (dogsSnap.empty) {
          setItems([]);
          setActiveRestrictions([]);
          setLoading(false);
          return;
        }

        const rawDogs = dogsSnap.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: String(data.name ?? data.nome ?? `K9-${docSnap.id}`),
            registrationNumber: typeof data.registrationNumber === "string" ? data.registrationNumber : typeof data.rg === "string" ? data.rg : null,
            photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : typeof data.profileImageUrl === "string" ? data.profileImageUrl : null,
            breed: typeof data.breed === "string" ? data.breed : typeof data.raca === "string" ? data.raca : null,
            sex: typeof data.sex === "string" ? data.sex : typeof data.sexo === "string" ? data.sexo : null,
            dateOfBirth: null,
            conductor: data.conductorRa
              ? {
                  ra: String(data.conductorRa),
                  name: typeof data.conductorName === "string" ? data.conductorName : null,
                }
              : null,
            specialties: [],
          } as DogIdentityReadModel;
        });

        let encounteredPartial = false;
        let restrictionsFullyRead = true;
        const allItems: ReadinessListItem[] = [];
        const allActiveRestrictions: OperationalRestrictionReadModel[] = [];

        await Promise.all(
          rawDogs.map(async (dog) => {
            const summaryState = await readCanonicalHealthSummary(dog.id);
            let summary: CanonicalHealthSummaryDoc | null = null;
            const dataQuality: ReadState = summaryState;

            if (summaryState.status === "success") {
              summary = summaryState.data;
            } else if (summaryState.status === "error" || summaryState.status === "partial") {
              encounteredPartial = true;
            }

            let restrictions: CanonicalRestrictionDoc[] = [];
            const restrictionsState = await readCanonicalOperationalRestrictions(dog.id);
            if (restrictionsState.status === "success") {
              restrictions = restrictionsState.data;
              const normalized = restrictions.map((r) => normalizeRestrictionDoc(r));
              allActiveRestrictions.push(...normalized);
            } else if (restrictionsState.status === "error") {
              encounteredPartial = true;
              restrictionsFullyRead = false;
            }

            const listItem = aggregateReadinessListItem({
              dog,
              summary,
              restrictions,
              dataQuality,
            });

            allItems.push(listItem);
          })
        );

        if (!isSubscribed) return;

        setItems(allItems);
        setActiveRestrictions(allActiveRestrictions);
        setIsPartial(encounteredPartial);
        setRestrictionsCoverageComplete(restrictionsFullyRead);
        setLoading(false);
      } catch (err: unknown) {
        if (!isSubscribed) return;
        const msg = err instanceof Error ? err.message : "Erro desconhecido ao carregar prontidão canônica";
        setError(msg);
        setLoading(false);
      }
    }

    void loadOverview();

    return () => {
      isSubscribed = false;
    };
  }, [reloadTrigger]);

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

  let overallStatus: HealthOverviewState["status"] = "success";
  if (loading) {
    overallStatus = "loading";
  } else if (error) {
    overallStatus = "error";
  } else if (items.length === 0) {
    overallStatus = "empty";
  } else if (isPartial) {
    overallStatus = "partial";
  }

  return {
    status: overallStatus,
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
