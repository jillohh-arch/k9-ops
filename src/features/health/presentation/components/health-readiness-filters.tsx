/**
 * K9 Ops Web — Health Web v1 HW-3C
 * Filter bar for /health/readiness
 *
 * MANDATE §11/§12:
 * - Filters operate over already-composed read models (no refetch by label text).
 * - Technical quality values map 1:1 onto the homologated QualityStateLabel union.
 * - Keyboard accessible, visible focus, explicit labels for screen readers.
 */

import { Search, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { OFFICIAL_READINESS_STATUSES, READINESS_STATUS_LABELS } from "../../domain/readiness-types";
import type { QualityStateLabel } from "../../domain/readiness-types";
import type {
  ReadinessFilters,
  ReadinessQualityFilter,
  ReadinessRestrictionsFilter,
  ReadinessSortMode,
  ReadinessStatusFilter,
} from "../hooks/readiness-view-model";

interface HealthReadinessFiltersProps {
  filters: ReadinessFilters;
  onChange: (next: Partial<ReadinessFilters>) => void;
  onReset: () => void;
  filtersActive: boolean;
  resultCount: number;
}

/** Homologated technical quality vocabulary — no parallel terms invented. */
const QUALITY_OPTIONS: readonly QualityStateLabel[] = [
  "Atualizada",
  "Desatualizada",
  "Parcial",
  "Conflito",
  "Sem projeção válida",
] as const;

const SORT_LABELS: Record<ReadinessSortMode, string> = {
  priority: "Prioridade",
  name: "Nome do K9",
  updated: "Última atualização",
};

const RESTRICTION_LABELS: Record<ReadinessRestrictionsFilter, string> = {
  all: "Todas",
  with: "Com restrições ativas",
  without: "Sem restrições ativas",
};

const selectClass = cn(
  "h-9 rounded-lg border border-border/70 bg-background px-2.5 text-xs font-medium text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

export function HealthReadinessFilters({
  filters,
  onChange,
  onReset,
  filtersActive,
  resultCount,
}: HealthReadinessFiltersProps) {
  return (
    <div className="flex flex-col gap-3" data-testid="health-readiness-filters">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Efetivo monitorado
          </h2>
          <p className="text-xs text-muted-foreground">
            Lista consolidada dos K9s e das condições que influenciam sua prontidão operacional.
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground" aria-live="polite">
          {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor="readiness-search">
            Buscar por K9, matrícula ou condutor
          </label>
          <input
            id="readiness-search"
            type="search"
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Buscar por K9, matrícula ou condutor..."
            className={cn(
              "h-9 w-full rounded-lg border border-border/70 bg-background pl-8 pr-2.5 text-xs text-foreground",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="readiness-status">
              Status:
            </label>
            <select
              id="readiness-status"
              value={filters.status}
              onChange={(event) =>
                onChange({ status: event.target.value as ReadinessStatusFilter })
              }
              className={selectClass}
            >
              <option value="all">Todos</option>
              {OFFICIAL_READINESS_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {READINESS_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="readiness-quality">
              Leitura:
            </label>
            <select
              id="readiness-quality"
              value={filters.quality}
              onChange={(event) =>
                onChange({ quality: event.target.value as ReadinessQualityFilter })
              }
              className={selectClass}
            >
              <option value="all">Todas</option>
              {QUALITY_OPTIONS.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="readiness-restrictions">
              Restrições:
            </label>
            <select
              id="readiness-restrictions"
              value={filters.restrictions}
              onChange={(event) =>
                onChange({ restrictions: event.target.value as ReadinessRestrictionsFilter })
              }
              className={selectClass}
            >
              {(Object.keys(RESTRICTION_LABELS) as ReadinessRestrictionsFilter[]).map((key) => (
                <option key={key} value={key}>
                  {RESTRICTION_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="readiness-sort">
              Ordenação:
            </label>
            <select
              id="readiness-sort"
              value={filters.sort}
              onChange={(event) => onChange({ sort: event.target.value as ReadinessSortMode })}
              className={selectClass}
            >
              {(Object.keys(SORT_LABELS) as ReadinessSortMode[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={onReset}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
