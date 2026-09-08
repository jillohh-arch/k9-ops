"use client";

/**
 * K9 Ops Web — Readiness Workforce View
 * Route: /health/readiness (HW-3C)
 *
 * Implements the canonical readiness list according to:
 * - HW-3C Directives
 * - Approved Mockup HW-M02-READINESS-v1.png
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §13 (Prontidão)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.2 (Readiness subdomain)
 *
 * CRITICAL MANDATES:
 * - Read-only: strictly NO Firestore mutations or write callables.
 * - This page does NOT decide readiness; it presents, filters and explains the
 *   Backend projections.
 * - Summary cards count only valid projections.
 * - INVARIANT: missing projection !== not_evaluated.
 */

import { useMemo } from "react";
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import {
  HealthReadinessHeader,
  HealthReadinessSummaryCards,
  HealthReadinessFilters,
  HealthReadinessTable,
  HealthReadinessLegend,
  HealthReadinessCoveragePanel,
  HealthReadinessSkeleton,
  HealthReadinessEmpty,
  HealthReadinessError,
} from "@/features/health/presentation/components";
import { ForbiddenState } from "@/features/health/presentation/components/health-technical-states";
import { useHealthReadiness } from "@/features/health/presentation/hooks/use-health-readiness";

/** Relative label for the most recent canonical readiness projection in scope. */
function formatLastUpdated(timestamps: Array<Date | null>): string | null {
  const valid = timestamps.filter((value): value is Date => value instanceof Date);
  if (valid.length === 0) return null;

  const latest = valid.reduce((acc, current) => (current > acc ? current : acc));
  const ageMs = Date.now() - latest.getTime();

  // A future timestamp is a technical anomaly; do not present it as freshness.
  if (ageMs < 0) return null;

  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;

  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export default function HealthReadinessPage() {
  const {
    status,
    items,
    visibleItems,
    statusCounts,
    coverage,
    attentionRequiredCount,
    filters,
    setFilters,
    resetFilters,
    filtersActive,
    errorMessage,
    refetch,
  } = useHealthReadiness();

  const lastUpdatedLabel = useMemo(
    () => formatLastUpdated(items.map((item) => item.updatedAt)),
    [items],
  );

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
      title="Prontidão"
      description="Estado operacional de todos os K9s"
      activeNavKey="readiness"
      technicalState={technicalState}
      /*
       * HealthReadinessHeader below is the page's full identity region (HW-M02
       * composes a single header), so the shell's own title row is suppressed to
       * avoid two stacked readiness titles. Same treatment as /health.
       */
      hideModuleHeading
    >
      <div className="flex flex-col gap-6" data-testid="health-readiness-container">
        {status === "forbidden" && (
          <ForbiddenState
            requiredCapability="health.read"
            message="Leitura da prontidão não autorizada para o perfil de acesso atual."
          />
        )}

        {status === "loading" && <HealthReadinessSkeleton />}

        {status === "empty" && <HealthReadinessEmpty />}

        {status === "error" && (
          <HealthReadinessError message={errorMessage ?? undefined} onRetry={refetch} />
        )}

        {(status === "success" || status === "partial") && (
          <>
            {/* 1. Header */}
            <HealthReadinessHeader
              validProjections={coverage.validProjections}
              attentionRequiredCount={attentionRequiredCount}
              lastUpdatedLabel={lastUpdatedLabel}
            />

            {/* 2. Five operational summary cards (also act as status filters) */}
            <HealthReadinessSummaryCards
              counts={statusCounts}
              selectedStatus={filters.status}
              onSelectStatus={(next) => setFilters({ status: next })}
            />

            {/* 3. "Efetivo monitorado": filters + list + legend */}
            <div className="flex flex-col gap-4">
              <HealthReadinessFilters
                filters={filters}
                onChange={setFilters}
                onReset={resetFilters}
                filtersActive={filtersActive}
                resultCount={visibleItems.length}
              />

              <HealthReadinessTable
                items={visibleItems}
                filtersActive={filtersActive}
                onResetFilters={resetFilters}
              />

              <HealthReadinessLegend />
            </div>

            {/* 4. Technical read coverage ("Sobre a prontidão") */}
            <HealthReadinessCoveragePanel coverage={coverage} />
          </>
        )}
      </div>
    </HealthModuleShell>
  );
}
