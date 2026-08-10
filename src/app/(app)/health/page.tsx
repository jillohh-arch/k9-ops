"use client";

/**
 * K9 Ops Web — Health Overview Page
 * Route: /health (HW-3B)
 *
 * Implements canonical Health Overview according to:
 * - HW-3B Directives
 * - Approved Mockup HW-M01-OVERVIEW-v1.png
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §12
 *
 * CRITICAL MANDATES:
 * - Read-only: strictly NO Firestore mutations or HTTP callables for write.
 * - Reuses canonical readiness foundation.
 * - Zero score, zero client-side readiness calculation, zero local clinical fallback.
 * - 5 Status Cards count only valid projections.
 */

import { useState } from "react";
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { useHealthOverview } from "@/features/health/presentation/hooks/use-health-overview";
import {
  HealthOverviewHeader,
  HealthStatusCards,
  HealthReadinessChart,
  HealthPendenciesCard,
  HealthPriorityK9List,
  HealthActiveRestrictionsCard,
  HealthUpcomingScheduleCard,
  HealthLatestReadingsTable,
  HealthOverviewSkeleton,
  HealthOverviewEmpty,
  HealthOverviewError,
} from "@/features/health/presentation/components";
import type { ReadinessStatus } from "@/features/health/domain/readiness-types";

export default function HealthOverviewPage() {
  const {
    status,
    items,
    statusCounts,
    donutData,
    priorityK9s,
    activeRestrictions,
    pendencies,
    totalMonitored,
    attentionRequiredCount,
    errorMessage,
    refetch,
  } = useHealthOverview();

  const [selectedStatus, setSelectedStatus] = useState<ReadinessStatus | null>(null);

  const technicalState =
    status === "partial"
      ? {
          status: "partial" as const,
          message: "Leitura parcialmente degradada. Mantendo projeções válidas exibidas.",
          computedAt: new Date(),
        }
      : undefined;

  return (
    <HealthModuleShell
      title="Saúde e Prontidão"
      description="Visão geral do efetivo K9"
      activeNavKey="overview"
      technicalState={technicalState}
    >
      <div className="flex flex-col gap-6" data-testid="health-overview-container">
        {status === "loading" && <HealthOverviewSkeleton />}

        {status === "empty" && <HealthOverviewEmpty />}

        {status === "error" && (
          <HealthOverviewError message={errorMessage ?? undefined} onRetry={refetch} />
        )}

        {(status === "success" || status === "partial") && (
          <>
            {/* 1. Header Bar */}
            <HealthOverviewHeader
              totalMonitored={totalMonitored}
              attentionRequiredCount={attentionRequiredCount}
            />

            {/* 2. Five Status Cards */}
            <HealthStatusCards
              counts={statusCounts}
              selectedStatus={selectedStatus}
              onSelectStatus={setSelectedStatus}
            />

            {/* 3. Middle Grid: Donut Chart + Pendencies */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <HealthReadinessChart
                donutData={donutData}
                totalMonitored={totalMonitored}
              />
              <HealthPendenciesCard pendencies={pendencies} />
            </div>

            {/* 4. Priority K9 List ("Situação dos K9s") */}
            <HealthPriorityK9List
              items={priorityK9s}
              selectedStatus={selectedStatus}
            />

            {/* 5. Active Restrictions + Upcoming Schedule */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <HealthActiveRestrictionsCard restrictions={activeRestrictions} />
              <HealthUpcomingScheduleCard isUnavailable={true} />
            </div>

            {/* 6. Latest Readings Table */}
            <HealthLatestReadingsTable items={items} />
          </>
        )}
      </div>
    </HealthModuleShell>
  );
}
