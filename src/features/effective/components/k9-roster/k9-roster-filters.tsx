"use client";

import { Grid2X2, List, Search, X } from "lucide-react";

import {
  K9_ROSTER_GROUP_LABEL,
  K9_ROSTER_GROUP_ORDER,
} from "@/features/effective/lib/k9-roster-classification";
import type { RosterFilters } from "@/features/effective/lib/k9-roster-filters";
import { cn } from "@/lib/utils";

export type K9RosterFiltersProps = {
  filters: RosterFilters;
  handlerOptions: Array<{ label: string; value: string }>;
  hasActiveFilters: boolean;
  onChange: (patch: Partial<RosterFilters>) => void;
  onClear: () => void;
  onViewMode: (mode: "grid" | "list") => void;
  specialtyOptions: Array<{ label: string; value: string }>;
  statusOptions: Array<{ label: string; value: string }>;
  viewMode: "grid" | "list";
};

function Select({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="h-10 min-w-0 rounded-xl border border-white/10 bg-[#081320] px-3 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function K9RosterFilters({
  filters,
  handlerOptions,
  hasActiveFilters,
  onChange,
  onClear,
  onViewMode,
  specialtyOptions,
  statusOptions,
  viewMode,
}: K9RosterFiltersProps) {
  return (
    <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/80 p-3">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
        <label className="relative flex h-10 min-w-0 flex-1 items-center">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-500"
          />
          <span className="sr-only">Buscar K9</span>
          <input
            className="h-full w-full rounded-xl border border-white/10 bg-[#081320] pl-10 pr-3 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Buscar K9, matrícula, condutor, especialidade..."
            type="search"
            value={filters.search}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            ariaLabel="Filtrar por status administrativo"
            onChange={(value) => onChange({ status: value })}
            options={[{ label: "Status: Todos", value: "all" }, ...statusOptions]}
            value={filters.status}
          />
          {/*
            "Situação" = grupo derivado da classificação (pronto/formação/
            indisponível/sem classificação). Distinto de "Status", que é o
            campo administrativo cru persistido em `dogs` (Ativo, Licenca,
            Aposentado). Ver finding UX no relatório da rodada.
          */}
          <Select
            ariaLabel="Filtrar por situação operacional"
            onChange={(value) => onChange({ employment: value })}
            options={[
              { label: "Situação: Todas", value: "all" },
              ...K9_ROSTER_GROUP_ORDER.map((group) => ({
                label: K9_ROSTER_GROUP_LABEL[group],
                value: group,
              })),
            ]}
            value={filters.employment}
          />
          <Select
            ariaLabel="Filtrar por especialidade"
            onChange={(value) => onChange({ specialty: value })}
            options={[
              { label: "Especialidade: Todas", value: "all" },
              ...specialtyOptions,
            ]}
            value={filters.specialty}
          />
          <Select
            ariaLabel="Filtrar por operador"
            onChange={(value) => onChange({ handler: value })}
            options={[
              { label: "Operador: Todos", value: "all" },
              ...handlerOptions,
            ]}
            value={filters.handler}
          />

          {hasActiveFilters ? (
            <button
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
              onClick={onClear}
              type="button"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          ) : null}

          <div
            className="flex h-10 items-center gap-1 rounded-xl border border-white/10 bg-[#081320] p-1"
            role="group"
            aria-label="Modo de exibição"
          >
            {(
              [
                { icon: Grid2X2, label: "Exibir em grade", mode: "grid" },
                { icon: List, label: "Exibir em lista", mode: "list" },
              ] as const
            ).map((option) => (
              <button
                aria-label={option.label}
                aria-pressed={viewMode === option.mode}
                className={cn(
                  "flex h-full items-center rounded-lg px-2.5 text-slate-500 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
                  viewMode === option.mode &&
                    "bg-cyan-300/12 text-cyan-200",
                )}
                key={option.mode}
                onClick={() => onViewMode(option.mode)}
                type="button"
              >
                <option.icon aria-hidden className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
