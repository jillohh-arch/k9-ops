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

/*
 * Native <select> kept deliberately: it carries keyboard and screen-reader
 * behaviour a custom dropdown would have to re-implement, and no existing K9 Ops
 * component provides an equivalent contract. Only the surface is restyled.
 * `bg-[#0b1628]` (opaque) rather than an alpha navy, because the popup list
 * inherits this background in most browsers and must stay legible.
 */
const selectClass = cn(
  "h-9 rounded-lg border border-cyan-200/12 bg-[#0b1628] px-2.5 text-xs font-semibold text-foreground",
  "transition-colors hover:border-cyan-200/25",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

/** Uppercase operational micro-label for each control. */
const filterLabelClass =
  "text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground";

export function HealthReadinessFilters({
  filters,
  onChange,
  onReset,
  filtersActive,
  resultCount,
}: HealthReadinessFiltersProps) {
  return (
    <div className="flex flex-col gap-3.5" data-testid="health-readiness-filters">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
            Filtros operacionais
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            Efetivo monitorado
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Lista consolidada dos K9s e das condições que influenciam sua prontidão operacional.
          </p>
        </div>
        <span
          className="rounded-lg border border-border bg-muted/30 px-2 py-1 text-[11px] font-bold tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
        </span>
      </div>

      {/*
        Operational filtering surface: one layered navy bar holding search plus
        every control, so the toolbar reads as a single instrument instead of
        loose browser form fields. Active state is marked by a cyan edge.
      */}
      <div
        className={cn(
          "flex flex-col gap-2.5 rounded-2xl border bg-[#0b1628]/82 p-3 lg:flex-row lg:flex-wrap lg:items-end",
          filtersActive ? "border-cyan-300/25" : "border-cyan-200/12",
        )}
      >
        <div className="min-w-0 flex-1 lg:max-w-xs">
          {/*
            The full descriptive text stays the control's accessible name; the
            short uppercase word is decorative only, so screen readers still get
            "Buscar por K9, matrícula ou condutor".
          */}
          <label className="sr-only" htmlFor="readiness-search">
            Buscar por K9, matrícula ou condutor
          </label>
          <span className={cn(filterLabelClass, "block")} aria-hidden="true">
            Buscar
          </span>
          <div className="relative mt-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-300/70"
              aria-hidden="true"
            />
            <input
              id="readiness-search"
              type="search"
              value={filters.search}
              onChange={(event) => onChange({ search: event.target.value })}
              placeholder="Buscar por K9, matrícula ou condutor..."
              className={cn(
                "h-9 w-full rounded-lg border border-cyan-200/12 bg-[#0b1628] pl-8 pr-2.5 text-xs text-foreground",
                "transition-colors hover:border-cyan-200/25",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2.5">
          <div className="flex flex-col gap-1">
            {/*
              Accessible name stays "Status:" (locked by the a11y tests); the
              visible chip is a substring of it, so WCAG 2.5.3 Label in Name holds.
            */}
            <label className="sr-only" htmlFor="readiness-status">
              Status:
            </label>
            <span className={filterLabelClass} aria-hidden="true">
              Status
            </span>
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

          <div className="flex flex-col gap-1">
            <label className="sr-only" htmlFor="readiness-quality">
              Leitura:
            </label>
            <span className={filterLabelClass} aria-hidden="true">
              Leitura
            </span>
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

          <div className="flex flex-col gap-1">
            <label className="sr-only" htmlFor="readiness-restrictions">
              Restrições:
            </label>
            <span className={filterLabelClass} aria-hidden="true">
              Restrições
            </span>
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

          <div className="flex flex-col gap-1">
            <label className="sr-only" htmlFor="readiness-sort">
              Ordenação:
            </label>
            <span className={filterLabelClass} aria-hidden="true">
              Ordenação
            </span>
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
                "inline-flex h-9 items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.08] px-3 text-xs font-semibold text-cyan-200 transition-colors",
                "hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
