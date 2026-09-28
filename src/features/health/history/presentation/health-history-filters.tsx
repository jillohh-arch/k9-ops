"use client";

/**
 * K9 Ops Web — Health Web v1 F30 History
 * Filter controls for the Health History timeline.
 */

import { Search, X, RefreshCw, Stethoscope, Calendar, ShieldAlert, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  HEALTH_HISTORY_CATEGORY_OPTIONS,
  HEALTH_HISTORY_PERIOD_OPTIONS,
  type HealthHistoryCategory,
  type HealthHistoryFilter,
  type HealthHistoryPeriod,
} from "../domain/health-history-types";

interface HealthHistoryFiltersProps {
  filter: HealthHistoryFilter;
  countsByCategory: Record<"clinical" | "schedule" | "restriction", number>;
  totalCount: number;
  onCategoryChange: (category: HealthHistoryCategory) => void;
  onPeriodChange: (period: HealthHistoryPeriod) => void;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  disabled?: boolean;
}

export function HealthHistoryFilters({
  filter,
  countsByCategory,
  totalCount,
  onCategoryChange,
  onPeriodChange,
  onSearchChange,
  onRefresh,
  disabled = false,
}: HealthHistoryFiltersProps) {
  const getCategoryCount = (key: HealthHistoryCategory) => {
    if (key === "all") return totalCount;
    return countsByCategory[key] ?? 0;
  };

  const getCategoryIcon = (key: HealthHistoryCategory) => {
    switch (key) {
      case "clinical":
        return <Stethoscope className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />;
      case "schedule":
        return <Calendar className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />;
      case "restriction":
        return <ShieldAlert className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />;
      default:
        return <Layers className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />;
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-4" data-testid="health-history-filters">
      {/* Top row: Search input and Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={filter.search}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={disabled}
            placeholder="Filtrar por K9, título, ator ou resumo..."
            className="h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
            data-testid="health-history-search-input"
          />
          {filter.search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              title="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Period selection */}
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-950/60 p-1">
          {HEALTH_HISTORY_PERIOD_OPTIONS.map((opt) => {
            const active = filter.period === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onPeriodChange(opt.key)}
                disabled={disabled}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  active
                    ? "bg-cyan-500/20 text-cyan-300 shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
                title={opt.description}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Refresh button */}
        <Button
          variant="secondary"
          onClick={onRefresh}
          disabled={disabled}
          className="h-9 gap-2 text-xs"
          data-testid="health-history-refresh-btn"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", disabled && "animate-spin")} aria-hidden="true" />
          <span>Atualizar</span>
        </Button>
      </div>

      {/* Bottom row: Category filter tabs */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
        <span className="text-xs font-medium text-slate-400">Categoria:</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {HEALTH_HISTORY_CATEGORY_OPTIONS.map((cat) => {
            const active = filter.category === cat.key;
            const count = getCategoryCount(cat.key);
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => onCategoryChange(cat.key)}
                disabled={disabled}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                    : "bg-slate-950/40 text-slate-400 hover:bg-slate-800/60 hover:text-white"
                )}
              >
                {getCategoryIcon(cat.key)}
                <span>{cat.label}</span>
                <Badge tone={active ? "cyan" : "slate"} className="text-[10px] px-1.5 py-0">
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
