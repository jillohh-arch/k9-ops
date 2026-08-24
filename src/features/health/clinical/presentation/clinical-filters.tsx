/**
 * K9 Ops Web — Health Web v1 HW-6A.I3
 * Clinical list filter bar for /health/clinical.
 *
 * MANDATES:
 * - Filters operate over the ALREADY-composed result; no control refetches.
 * - The K9 scope selector is populated from the CURRENT result only — it can
 *   never name a dog the reader did not return.
 * - Tri-state flag filters expose "Indisponível" as a first-class option so a
 *   `null` flag is filterable as its own answer, distinct from `false`/`0`.
 * - Native <select>/<input> carry the keyboard and screen-reader contract; only
 *   the surface is restyled (same grammar as the Readiness filter bar).
 *
 * HW-6A.V1.RF (presentation only): at tablet-ish width (~900-1024px) the six
 * controls no longer cram into one horizontal row. Search takes a full-width
 * first row and the five selectors reflow into a compact grid; the dense
 * horizontal arrangement returns at xl. No filter semantics change. (RF §14-§15)
 *
 * HW-6A.V1.RF4 §20 (VISUAL SCALE ONLY): the eyebrow, heading, description, the six
 * control labels and the control values themselves were all too small to read at
 * 100% zoom. Each gains a step and the controls grow from h-9 to h-10 to match.
 * FROZEN and untouched: every filter predicate, every option value and label, the
 * search source, the control order, and the RF/RF2 responsive + search-width
 * contract (`xl:basis-[17rem] xl:min-w-[17rem]`).
 */

import { RotateCcw, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CLINICAL_CASE_STATUS_LABELS,
  type ClinicalCaseStatus,
} from "../../domain/read-states";
import {
  CLINICAL_UNRECOGNIZED_STATUS_LABEL,
  type ClinicalDogOption,
  type ClinicalFlagFilter,
  type ClinicalListFilters,
  type ClinicalStatusFilter,
  type ClinicalTreatmentFilter,
} from "./types";

interface ClinicalFiltersProps {
  filters: ClinicalListFilters;
  dogOptions: ClinicalDogOption[];
  onChange: (next: Partial<ClinicalListFilters>) => void;
  onReset: () => void;
  filtersActive: boolean;
  resultCount: number;
}

/** Canonical statuses in a fixed presentation order. */
const STATUS_ORDER: readonly ClinicalCaseStatus[] = [
  "open",
  "under_investigation",
  "under_treatment",
  "monitoring",
  "discharged",
  "cancelled",
] as const;

const FLAG_LABELS: Record<ClinicalFlagFilter, string> = {
  all: "Todas",
  with: "Com",
  without: "Sem",
  unavailable: "Indisponível",
};

const TREATMENT_LABELS: Record<ClinicalTreatmentFilter, string> = {
  all: "Todos",
  with: "Com tratamento ativo",
  without: "Sem tratamento ativo",
  unavailable: "Indisponível",
};

const selectClass = cn(
  "h-10 w-full rounded-lg border border-cyan-200/12 bg-[#0b1628] px-2.5 text-sm font-semibold text-foreground lg:w-auto",
  "transition-colors hover:border-cyan-200/25",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

const filterLabelClass =
  "text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground";

export function ClinicalFilters({
  filters,
  dogOptions,
  onChange,
  onReset,
  filtersActive,
  resultCount,
}: ClinicalFiltersProps) {
  return (
    <div className="flex flex-col gap-3.5" data-testid="clinical-filters">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
            Filtros clínicos
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">
            Casos clínicos do efetivo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lista consolidada dos casos clínicos abertos e encerrados no escopo autorizado.
          </p>
        </div>
        <span
          className="rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-[13px] font-bold tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
        </span>
      </div>

      <div
        className={cn(
          "flex flex-col gap-2.5 rounded-2xl border bg-[#0b1628]/82 p-3 xl:flex-row xl:flex-wrap xl:items-end",
          filtersActive ? "border-cyan-300/25" : "border-cyan-200/12",
        )}
        data-testid="clinical-filters-controls"
      >
        {/*
          Search owns a full-width first row until xl, where it rejoins the band.

          RF2 §6: at xl the old `flex-1` + `max-w-xs` contract let search be
          COMPRESSED by the selector band — measured at ~197px on a 1366px
          laptop, narrower than on tablet. It now carries a real minimum
          (`xl:basis-[17rem] xl:min-w-[17rem]` = 272px, inside the 260-300px
          target) and no longer flexes below it. When the row runs out of space
          the selector band wraps instead, which §7 explicitly prefers over
          crushing controls. Tablet full-width behaviour below xl is untouched.
        */}
        <div className="min-w-0 xl:min-w-[17rem] xl:basis-[17rem] xl:grow-0">
          <label className="sr-only" htmlFor="clinical-search">
            Buscar por K9 ou título do caso
          </label>
          <span className={cn(filterLabelClass, "block")} aria-hidden="true">
            Buscar
          </span>
          <div className="relative mt-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/70"
              aria-hidden="true"
            />
            <input
              id="clinical-search"
              type="search"
              value={filters.search}
              onChange={(event) => onChange({ search: event.target.value })}
              placeholder="Buscar por K9 ou título do caso..."
              className={cn(
                "h-10 w-full rounded-lg border border-cyan-200/12 bg-[#0b1628] pl-9 pr-2.5 text-sm text-foreground",
                "transition-colors hover:border-cyan-200/25",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            />
          </div>
        </div>

        {/*
          Tablet reflow: a 2-up/3-up grid so no selector is squeezed to an
          unreadable width; flex-wrap band from lg upward. (RF §14)
        */}
        <div
          className="grid grid-cols-2 items-end gap-2.5 sm:grid-cols-3 lg:flex lg:flex-wrap"
          data-testid="clinical-filters-selectors"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <label className="sr-only" htmlFor="clinical-dog">
              K9:
            </label>
            <span className={filterLabelClass} aria-hidden="true">
              K9
            </span>
            <select
              id="clinical-dog"
              value={filters.dogId}
              onChange={(event) => onChange({ dogId: event.target.value })}
              className={selectClass}
            >
              <option value="all">Todos os K9</option>
              {dogOptions.map((dog) => (
                <option key={dog.dogId} value={dog.dogId}>
                  {dog.name} ({dog.caseCount})
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <label className="sr-only" htmlFor="clinical-status">
              Status:
            </label>
            <span className={filterLabelClass} aria-hidden="true">
              Status
            </span>
            <select
              id="clinical-status"
              value={filters.status}
              onChange={(event) =>
                onChange({ status: event.target.value as ClinicalStatusFilter })
              }
              className={selectClass}
            >
              <option value="all">Todos</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {CLINICAL_CASE_STATUS_LABELS[status]}
                </option>
              ))}
              {/* Unrecognized status is findable, not hidden. */}
              <option value="unknown">{CLINICAL_UNRECOGNIZED_STATUS_LABEL}</option>
            </select>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <label className="sr-only" htmlFor="clinical-restriction">
              Restrição:
            </label>
            <span className={filterLabelClass} aria-hidden="true">
              Restrição
            </span>
            <select
              id="clinical-restriction"
              value={filters.restriction}
              onChange={(event) =>
                onChange({ restriction: event.target.value as ClinicalFlagFilter })
              }
              className={selectClass}
            >
              {(Object.keys(FLAG_LABELS) as ClinicalFlagFilter[]).map((key) => (
                <option key={key} value={key}>
                  {FLAG_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <label className="sr-only" htmlFor="clinical-treatment">
              Tratamento ativo:
            </label>
            <span className={filterLabelClass} aria-hidden="true">
              Tratamento
            </span>
            <select
              id="clinical-treatment"
              value={filters.treatment}
              onChange={(event) =>
                onChange({ treatment: event.target.value as ClinicalTreatmentFilter })
              }
              className={selectClass}
            >
              {(Object.keys(TREATMENT_LABELS) as ClinicalTreatmentFilter[]).map((key) => (
                <option key={key} value={key}>
                  {TREATMENT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <label className="sr-only" htmlFor="clinical-schedule">
              Agenda pendente:
            </label>
            <span className={filterLabelClass} aria-hidden="true">
              Agenda
            </span>
            <select
              id="clinical-schedule"
              value={filters.schedule}
              onChange={(event) =>
                onChange({ schedule: event.target.value as ClinicalFlagFilter })
              }
              className={selectClass}
            >
              {(Object.keys(FLAG_LABELS) as ClinicalFlagFilter[]).map((key) => (
                <option key={key} value={key}>
                  {FLAG_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={onReset}
              className={cn(
                "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.08] px-3.5 text-sm font-semibold text-cyan-200 transition-colors lg:w-auto",
                "hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
