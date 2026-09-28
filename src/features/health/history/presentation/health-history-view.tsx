"use client";

/**
 * K9 Ops Web — Health Web v1 F30 History
 * Main history view orchestrating timeline presentation, category/period filters,
 * technical states, and longitudinal item rendering.
 */

import { AlertTriangle, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
} from "../../presentation/components/health-technical-states";
import { useHealthHistoryData } from "../hooks/use-health-history-data";
import { HealthHistoryFilters } from "./health-history-filters";
import { HealthHistoryTimelineItem } from "./health-history-timeline-item";

export function HealthHistoryView() {
  const {
    state,
    authorityStatus,
    filter,
    setCategory,
    setPeriod,
    setSearch,
    resetFilters,
    refresh,
  } = useHealthHistoryData();

  // 1. Gated authority check
  if (authorityStatus === "forbidden" || state.status === "forbidden") {
    return (
      <ForbiddenState
        requiredCapability="health.read"
        message="Acesso não autorizado: a visualização do histórico exige a capacidade institucional health.read."
      />
    );
  }

  // 2. Loading state
  if (state.status === "loading") {
    return (
      <LoadingState
        message="Carregando histórico do domínio Health..."
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
        title="Nenhum registro no histórico"
        description="Não foram encontrados eventos de saúde registrados para o efetivo canino."
      />
    );
  }

  // 5. Success / Partial states
  if (state.status !== "success" && state.status !== "partial") {
    return null;
  }

  const aggregate = state.status === "success" ? state.data : state.partialData;
  const isPartial = state.status === "partial";

  return (
    <div className="flex flex-col gap-6" data-testid="health-history-view">
      {/* Filters Toolbar */}
      <HealthHistoryFilters
        filter={filter}
        countsByCategory={aggregate.countsByCategory}
        totalCount={aggregate.totalCount}
        onCategoryChange={setCategory}
        onPeriodChange={setPeriod}
        onSearchChange={setSearch}
        onRefresh={refresh}
      />

      {/* Partial Coverage Warning */}
      {isPartial && aggregate.coverageSummary.notes.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300"
          role="status"
          data-testid="history-partial-warning"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Cobertura parcial dos dados históricos:</span>
            <ul className="list-inside list-disc text-amber-200/90">
              {aggregate.coverageSummary.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Timeline items list or filter-empty state */}
      {aggregate.filteredItems.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-slate-900/40 py-16 text-center"
          data-testid="history-filter-empty"
        >
          <div className="rounded-full bg-slate-800 p-3 text-slate-400">
            <FilterX className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Nenhum evento corresponde aos filtros</h3>
            <p className="mt-1 text-xs text-slate-400">
              Tente alterar o período selecionado, a categoria ou limpar a busca textual.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={resetFilters}
            className="mt-2 h-8 text-xs"
            data-testid="history-reset-filters-btn"
          >
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="relative flex flex-col pt-2" data-testid="history-timeline-list">
          {aggregate.filteredItems.map((item) => (
            <HealthHistoryTimelineItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
