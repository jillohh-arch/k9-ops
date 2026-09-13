"use client";

/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Main reporting view orchestrating period filtering, technical states,
 * truthful KPIs, fail-closed export, and clinical/schedule data grids.
 */

import { useState } from "react";
import { RefreshCw, Stethoscope, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
} from "../../presentation/components/health-technical-states";
import { useHealthReportsData } from "../hooks/use-health-reports-data";
import { HealthReportsPeriodSelector } from "./health-reports-period-selector";
import { HealthReportsCoverageBanner } from "./health-reports-coverage-banner";
import { HealthReportsKpiGrid } from "./health-reports-kpi-grid";
import { HealthReportsClinicalTable } from "./health-reports-clinical-table";
import { HealthReportsScheduleTable } from "./health-reports-schedule-table";
import { HealthReportsExportToolbar } from "./health-reports-export-toolbar";

export function HealthReportsView() {
  const {
    state,
    authorityStatus,
    exportAuthority,
    period,
    setPeriod,
    refresh,
  } = useHealthReportsData();

  const [activeTab, setActiveTab] = useState<"clinical" | "schedule">("clinical");

  // 1. Gated authority check
  if (authorityStatus === "forbidden" || state.status === "forbidden") {
    return (
      <ForbiddenState
        requiredCapability="health.read"
        message="Acesso não autorizado: a visualização de relatórios exige a capacidade institucional health.read."
      />
    );
  }

  // 2. Loading state
  if (state.status === "loading") {
    return (
      <LoadingState
        message="Consolidando dados operacionais dos relatórios de saúde..."
        size="lg"
      />
    );
  }

  // 3. Technical Error
  if (state.status === "error") {
    return (
      <ErrorState
        code={state.code}
        message={state.message}
        onRetry={refresh}
      />
    );
  }

  // 4. Genuine Empty Scope
  if (state.status === "empty") {
    return (
      <EmptyState
        title="Nenhum registro encontrado"
        description="O escopo de cães do canil está vazio ou não possui registros de saúde no período."
      />
    );
  }

  // 5. Success / Partial states
  if (state.status !== "success" && state.status !== "partial") {
    return null;
  }

  const aggregate = state.status === "success" ? state.data : state.partialData;
  const isRefreshing = false;
  const periodLabel =
    period === "today" ? "Hoje" : period === "7d" ? "7 dias" : "30 dias";

  return (
    <div className="flex flex-col gap-6" data-testid="health-reports-view">
      {/* Top Controls: Period selector + Refresh button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <HealthReportsPeriodSelector
          value={period}
          onChange={setPeriod}
          disabled={isRefreshing}
        />

        <Button
          variant="secondary"
          onClick={refresh}
          disabled={isRefreshing}
          className="h-9 gap-2 text-xs"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            aria-hidden="true"
          />
          <span>{isRefreshing ? "Atualizando..." : "Atualizar"}</span>
        </Button>
      </div>

      {/* Fail-closed Export Toolbar */}
      <HealthReportsExportToolbar
        aggregate={aggregate}
        exportAuthority={exportAuthority}
      />

      {/* Truthful Coverage & Quality Banner */}
      <HealthReportsCoverageBanner summary={aggregate.coverageSummary} />

      {/* Executive Operational KPIs Grid */}
      <HealthReportsKpiGrid aggregate={aggregate} />

      {/* Tabs navigation for relevant tables */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("clinical")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition sm:text-sm",
            activeTab === "clinical"
              ? "bg-cyan-500/20 text-cyan-300 shadow-sm"
              : "text-slate-400 hover:text-white"
          )}
        >
          <Stethoscope className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <span>Casos Clínicos</span>
          <Badge tone="slate">
            {aggregate.filteredClinicalCases.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("schedule")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition sm:text-sm",
            activeTab === "schedule"
              ? "bg-cyan-500/20 text-cyan-300 shadow-sm"
              : "text-slate-400 hover:text-white"
          )}
        >
          <Calendar className="h-4 w-4 text-cyan-400" aria-hidden="true" />
          <span>Agenda e Procedimentos</span>
          <Badge tone="slate">
            {aggregate.filteredScheduleItems.length}
          </Badge>
        </button>
      </div>

      {/* Active Tab View */}
      {activeTab === "clinical" ? (
        <HealthReportsClinicalTable
          cases={aggregate.filteredClinicalCases}
          periodLabel={periodLabel}
        />
      ) : (
        <HealthReportsScheduleTable
          items={aggregate.filteredScheduleItems}
          periodLabel={periodLabel}
        />
      )}
    </div>
  );
}
