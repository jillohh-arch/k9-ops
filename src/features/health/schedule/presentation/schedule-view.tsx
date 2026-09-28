"use client";

/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — RD-I6 / UX-R1
 * Schedule presentation — polished operational view matching Visão Geral and Prontidão.
 *
 * RESPONSIBILITY:
 * - Consume the frozen orchestration facade (`useSchedule`).
 * - Render ONE truthful technical screen per read state.
 * - State institutional coverage loss instead of implying completeness.
 * - Render every composed entry exactly once, in the order received (when unfiltered).
 * - Render executive header with live truthful metrics.
 * - Render 5 operational summary cards with interactive client-side filter.
 * - Render high-density, accessible tactical cards for each schedule item.
 *
 * ── TIMEZONE IS THE ITEM'S, NEVER THE BROWSER'S (load-bearing) ─────────────
 * Every temporal decision upstream (RD-I2) was computed in the item's own
 * timezone. The primary timestamp is always formatted with `timeZone: item.timezone`,
 * and formatting FAILS CLOSED: an absent date, an absent zone or an unusable zone
 * renders as unavailable, never as a browser-local guess.
 *
 * ── NO CURRENT CLOCK ───────────────────────────────────────────────────────
 * Formatting an existing `Date` is allowed; reading the present is not. There
 * is no `new Date()` / `Date.now()` here. RD-I5 remains the sole wall-clock
 * authority, and temporal classification stays fixed for its published cycle.
 */

import { useMemo, useState } from "react";
import { AlertCircle, Filter, Search, X } from "lucide-react";
import type { ReadStateError } from "../../domain/read-states";
import { ForbiddenState } from "../../presentation/components/health-technical-states";
import type { ComposedScheduleEntry } from "../composition/schedule-composition";
import type { ScheduleScopeCoverage } from "../data/schedule-scope-loader";
import { useSchedule } from "../hooks/use-schedule";
import { ScheduleHeader } from "./schedule-header";
import {
  ScheduleSummaryCards,
  type ScheduleFilterType,
  type ScheduleSummaryCounts,
} from "./schedule-summary-cards";
import {
  ScheduleSkeleton,
  ScheduleEmpty,
  ScheduleError,
} from "./schedule-states";
import {
  ScheduleRow,
  ScheduleStatusBadge,
  formatScheduledFor,
  scheduleTypeLabel,
  statusLabel,
  SCHEDULE_TYPE_LABELS,
  STATUS_TONES,
  UNAVAILABLE_DATETIME,
  UNAVAILABLE_STATUS,
} from "./schedule-row";

// Re-export for any existing consumers or test suites
export {
  ScheduleRow,
  ScheduleStatusBadge,
  formatScheduledFor,
  scheduleTypeLabel,
  statusLabel,
  SCHEDULE_TYPE_LABELS,
  STATUS_TONES,
  UNAVAILABLE_DATETIME,
  UNAVAILABLE_STATUS,
};

/**
 * Producer-invariant narrowing for the shared `refreshing` contract, whose
 * `previousData` is typed `unknown`.
 */
function isComposedEntryList(value: unknown): value is ComposedScheduleEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (candidate) =>
        !!candidate &&
        typeof candidate === "object" &&
        "entry" in candidate &&
        "temporal" in candidate &&
        "displayWindow" in candidate,
    )
  );
}

/** True when the read could not cover the whole institutional scope. */
function hasCoverageLoss(coverage: ScheduleScopeCoverage): boolean {
  return (
    !coverage.complete ||
    coverage.forbiddenDogIds.length > 0 ||
    coverage.failedDogIds.length > 0 ||
    coverage.partialEntryIds.length > 0
  );
}

/**
 * Coverage-loss banner.
 *
 * States, in operator terms, exactly what the composed Agenda could NOT cover:
 * denied K9s and technically-failed K9s are reported separately, because a
 * denial and a transport failure are different facts.
 */
function ScheduleCoverageNotice({
  coverage,
  onRetry,
}: {
  coverage: ScheduleScopeCoverage;
  onRetry?: () => void;
}) {
  const forbidden = coverage.forbiddenDogIds.length;
  const failed = coverage.failedDogIds.length;
  const partialDocs = coverage.partialEntryIds.length;

  const parts: string[] = [];
  if (forbidden > 0) {
    parts.push(
      `${forbidden} ${forbidden === 1 ? "K9 não autorizado" : "K9 não autorizados"}`,
    );
  }
  if (failed > 0) {
    parts.push(`${failed} K9 com falha de leitura`);
  }
  if (partialDocs > 0) {
    parts.push(
      `${partialDocs} ${partialDocs === 1 ? "item com dados incompletos" : "itens com dados incompletos"}`,
    );
  }

  return (
    <div
      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4 shadow-sm"
      role="status"
      aria-live="polite"
      data-testid="schedule-coverage-notice"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/15 text-amber-300 mt-0.5">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300/90">
            Cobertura parcial
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug text-amber-100">
            A agenda está incompleta e não representa todo o efetivo.
          </p>
          {parts.length > 0 && (
            <p className="mt-1 text-xs text-amber-200/70">
              Não incluído: {parts.join(" · ")}.
            </p>
          )}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3.5 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/**
 * The flat operational list.
 * Preserves the frozen RD-I3 order unless client-side filtered.
 */
function ScheduleList({ entries }: { entries: ComposedScheduleEntry[] }) {
  return (
    <ul className="flex flex-col gap-3" data-testid="schedule-list">
      {entries.map((composed) => (
        <ScheduleRow key={composed.entry.entryId} composed={composed} />
      ))}
    </ul>
  );
}

/**
 * Computes truthful KPI counts from composed entries.
 */
function deriveCounts(entries: ComposedScheduleEntry[]): ScheduleSummaryCounts {
  let overdue = 0;
  let today = 0;
  let upcoming = 0;
  let completed = 0;
  let cancelled = 0;
  let unavailable = 0;

  for (const entry of entries) {
    const status = entry.temporal.temporalStatus;
    if (!status) {
      unavailable += 1;
    } else if (status === "overdue") {
      overdue += 1;
    } else if (status === "today") {
      today += 1;
    } else if (
      status === "upcoming" ||
      status === "scheduled" ||
      status === "pending"
    ) {
      upcoming += 1;
    } else if (status === "completed") {
      completed += 1;
    } else if (status === "cancelled") {
      cancelled += 1;
    }
  }

  return {
    total: entries.length,
    overdue,
    today,
    upcoming,
    completed,
    cancelled,
    unavailable,
  };
}

/**
 * Filter label mapping.
 */
const FILTER_LABELS: Record<ScheduleFilterType, string> = {
  all: "Todos",
  overdue: "Vencidos",
  today: "Para Hoje",
  upcoming: "Programados",
  completed: "Concluídos",
};

interface ScheduleSuccessContentProps {
  entries: ComposedScheduleEntry[];
  coverage: ScheduleScopeCoverage;
  refresh: () => void;
  isRefreshing?: boolean;
}

/**
 * Unconditional hooks holder for composed schedule lists.
 */
function ScheduleSuccessContent({
  entries,
  coverage,
  refresh,
  isRefreshing = false,
}: ScheduleSuccessContentProps) {
  const [activeFilter, setActiveFilter] = useState<ScheduleFilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const counts = useMemo(() => deriveCounts(entries), [entries]);

  const displayedEntries = useMemo(() => {
    let result = entries;

    if (activeFilter === "overdue") {
      result = result.filter((e) => e.temporal.temporalStatus === "overdue");
    } else if (activeFilter === "today") {
      result = result.filter((e) => e.temporal.temporalStatus === "today");
    } else if (activeFilter === "upcoming") {
      result = result.filter(
        (e) =>
          e.temporal.temporalStatus === "upcoming" ||
          e.temporal.temporalStatus === "scheduled" ||
          e.temporal.temporalStatus === "pending",
      );
    } else if (activeFilter === "completed") {
      result = result.filter((e) => e.temporal.temporalStatus === "completed");
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((e) => {
        const title = (e.entry.item.title ?? "").toLowerCase();
        const dog = e.entry.dog.name.toLowerCase();
        const type = e.entry.item.scheduleType
          ? scheduleTypeLabel(e.entry.item.scheduleType).toLowerCase()
          : "";
        return title.includes(q) || dog.includes(q) || type.includes(q);
      });
    }

    return result;
  }, [entries, activeFilter, searchQuery]);

  const isFiltered = activeFilter !== "all" || searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col gap-6" data-testid="schedule-view">
      {/* Identity Header */}
      <ScheduleHeader
        totalCount={counts.total}
        overdueCount={counts.overdue}
        todayCount={counts.today}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
      />

      {isRefreshing && (
        <p
          className="flex items-center gap-2 text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
          data-testid="schedule-refreshing"
        >
          Atualizando agenda...
        </p>
      )}

      {/* Coverage Notice if incomplete read */}
      {hasCoverageLoss(coverage) && (
        <ScheduleCoverageNotice coverage={coverage} onRetry={refresh} />
      )}

      {/* 5 Operational Summary Cards */}
      <ScheduleSummaryCards
        counts={counts}
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
      />

      {/* Search & Active Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-cyan-200/10 bg-[#0b1628]/60 p-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por título, cão ou tipo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-xl border border-slate-700/60 bg-slate-900/80 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
            aria-label="Buscar na agenda"
          />
        </div>

        <div className="flex items-center gap-2">
          {isFiltered && (
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 font-medium text-cyan-200">
                <Filter className="h-3 w-3" aria-hidden="true" />
                <span>
                  {FILTER_LABELS[activeFilter]} ({displayedEntries.length} de {entries.length})
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("all");
                  setSearchQuery("");
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                <span>Limpar</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter empty message or list */}
      {displayedEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-700/40 bg-card/40 p-8 text-center">
          <p className="text-sm font-medium text-slate-300">
            Nenhum procedimento corresponde aos filtros aplicados.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveFilter("all");
              setSearchQuery("");
            }}
            className="mt-1 text-xs font-semibold text-cyan-300 hover:underline"
          >
            Ver todos os {entries.length} procedimentos
          </button>
        </div>
      ) : (
        <ScheduleList entries={displayedEntries} />
      )}
    </div>
  );
}

/**
 * Main Agenda operational view.
 */
export function ScheduleView() {
  const { state, coverage, authorityStatus, refresh } = useSchedule();

  switch (state.status) {
    case "idle":
    case "loading":
      return <ScheduleSkeleton />;

    case "forbidden":
      return (
        <ForbiddenState
          requiredCapability={state.requiredCapability}
          message={state.message}
        />
      );

    case "error": {
      const errorState = state as ReadStateError;
      return (
        <ScheduleError
          code={errorState.code}
          message={errorState.message}
          retryable={errorState.retryable}
          onRetry={
            errorState.retryable && authorityStatus === "allowed"
              ? refresh
              : undefined
          }
        />
      );
    }

    case "empty":
      if (hasCoverageLoss(coverage)) {
        return (
          <div className="flex flex-col gap-6" data-testid="schedule-view">
            <ScheduleCoverageNotice coverage={coverage} onRetry={refresh} />
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-6" data-testid="schedule-view">
          <ScheduleEmpty onRetry={refresh} />
        </div>
      );

    case "refreshing": {
      const previousEntries = isComposedEntryList(state.previousData)
        ? state.previousData
        : null;

      if (!previousEntries) {
        return <ScheduleSkeleton />;
      }

      return (
        <ScheduleSuccessContent
          entries={previousEntries}
          coverage={coverage}
          refresh={refresh}
          isRefreshing={true}
        />
      );
    }

    case "partial":
      return (
        <ScheduleSuccessContent
          entries={state.partialData}
          coverage={coverage}
          refresh={refresh}
        />
      );

    case "success":
      return (
        <ScheduleSuccessContent
          entries={state.data}
          coverage={coverage}
          refresh={refresh}
        />
      );

    default:
      return (
        <ScheduleError
          message="Estado de leitura não suportado nesta tela."
          retryable={false}
        />
      );
  }
}