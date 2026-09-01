"use client";

/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — RD-I6
 * Schedule presentation — flat operational list foundation.
 *
 * RESPONSIBILITY:
 * - Consume the frozen orchestration facade (`useSchedule`).
 * - Render ONE truthful technical screen per read state.
 * - State institutional coverage loss instead of implying completeness.
 * - Render every composed entry exactly once, in the order received.
 *
 * ── WHAT THIS SLICE DELIBERATELY DOES NOT DO ───────────────────────────────
 * No sections, no date grouping, no filters, no tabs, no "visão de próximos"
 * and no "visão de atrasados". `HEALTH_WEB_INFORMATION_ARCHITECTURE.md` §15.2
 * asks for those, but they are a later slice with their own UX contract. This
 * slice replaces a permanently-spinning placeholder with a truthful list.
 *
 * In particular there is NO display-window section here. `displayWindow` is
 * carried on every composed entry and is intentionally UNUSED by this view:
 * introducing a window section requires the frozen membership predicate
 * (`inDisplayWindow === true` AND status not terminal) plus its own DST killer.
 * Nothing here may filter on `inDisplayWindow`.
 *
 * ── TIMEZONE IS THE ITEM'S, NEVER THE BROWSER'S (load-bearing) ─────────────
 * Every temporal decision upstream (RD-I2) was computed in the item's own
 * timezone. If this view rendered timestamps through a browser-local helper, a
 * badge reading "Hoje" could sit beside a date reading tomorrow — the display
 * analogue of conflating the two 7-day concepts. So the primary timestamp is
 * always formatted with `timeZone: item.timezone`, and formatting FAILS CLOSED:
 * an absent date, an absent zone or an unusable zone renders as unavailable,
 * never as a browser-local guess and never by dropping the row.
 *
 * ── NO CURRENT CLOCK ───────────────────────────────────────────────────────
 * Formatting an existing `Date` is allowed; reading the present is not. There
 * is no `new Date()` / `Date.now()` here. RD-I5 remains the sole wall-clock
 * authority, and temporal classification stays fixed for its published cycle.
 *
 * NON-RESPONSIBILITY:
 * - No Firestore, no scope loader, no composition, no RD-I2 evaluators.
 * - No permission derivation; `useSchedule()` owns authority.
 * - No coverage recomputation; visible row count is NOT institutional truth.
 */

import type { ReadStateError } from "../../domain/read-states";
import { SCHEDULE_STATUS_LABELS } from "../../domain/read-states";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
} from "../../presentation/components/health-technical-states";
import type { ComposedScheduleEntry } from "../composition/schedule-composition";
import type { ScheduleScopeCoverage } from "../data/schedule-scope-loader";
import { useSchedule } from "../hooks/use-schedule";

/** Shown when the item's own date/time cannot be rendered truthfully. */
const UNAVAILABLE_DATETIME = "Data/hora indisponível";

/** Shown when RD-I2 could not derive a temporal status for the item. */
const UNAVAILABLE_STATUS = "Status indisponível";

/**
 * Formats the item's scheduled instant IN THE ITEM'S OWN TIMEZONE.
 *
 * Fail-closed by contract: a missing date, a missing zone, an invalid `Date` or
 * an `Intl` rejection all yield the unavailable label. There is deliberately NO
 * browser-timezone fallback — silently re-basing the timestamp on the viewer's
 * machine would let the displayed time contradict the item's own badge.
 */
function formatScheduledFor(
  scheduledFor: Date | null,
  timezone: string | null,
): string {
  if (!scheduledFor || !timezone) return UNAVAILABLE_DATETIME;
  if (Number.isNaN(scheduledFor.getTime())) return UNAVAILABLE_DATETIME;

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      // LOAD-BEARING: the item's zone is the authority, not the runtime's.
      timeZone: timezone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(scheduledFor);
  } catch {
    // An unusable IANA identifier reaches here. The row still renders.
    return UNAVAILABLE_DATETIME;
  }
}

/**
 * Canonical status label.
 *
 * Uses the single frozen `SCHEDULE_STATUS_LABELS` map — no second label map
 * exists anywhere. A `null` status (temporal derivation unavailable) becomes an
 * explicit unavailable label, NEVER a fabricated "Programado".
 */
function statusLabel(entry: ComposedScheduleEntry): string {
  const status = entry.temporal.temporalStatus;
  if (!status) return UNAVAILABLE_STATUS;
  return SCHEDULE_STATUS_LABELS[status];
}

/**
 * Producer-invariant narrowing for the shared `refreshing` contract, whose
 * `previousData` is typed `unknown`.
 *
 * A contract violation degrades to the skeleton — a transient "still working" —
 * rather than an EMPTY LIST, which would read as a truthful zero nobody proved.
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
      className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3"
      role="status"
      aria-live="polite"
      data-testid="schedule-coverage-notice"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300/85">
          Cobertura parcial
        </p>
        <p className="mt-1 text-sm font-semibold leading-snug text-amber-100">
          A agenda está incompleta e não representa todo o efetivo.
        </p>
        {parts.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Não incluído: {parts.join(" · ")}.
          </p>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/** One operational row. Renders only fields the frozen model supports. */
function ScheduleRow({ composed }: { composed: ComposedScheduleEntry }) {
  // `composed.entry` is the frozen RD-I3 list entry; `composed.temporal` and
  // `composed.displayWindow` are the RD-I4 annotations beside it.
  const item = composed.entry.item;

  return (
    <li
      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3"
      data-testid="schedule-row"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-foreground">
          {item.title ?? "Sem título"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <span data-testid="schedule-row-dog">{composed.entry.dog.name}</span>
          {item.scheduleType && (
            <>
              {" · "}
              <span data-testid="schedule-row-type">{item.scheduleType}</span>
            </>
          )}
        </p>
        <p
          className="mt-1 text-xs text-muted-foreground"
          data-testid="schedule-row-datetime"
        >
          {formatScheduledFor(item.scheduledFor, item.timezone)}
        </p>
      </div>
      <span
        className="shrink-0 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-foreground"
        data-testid="schedule-row-status"
      >
        {statusLabel(composed)}
      </span>
    </li>
  );
}

/**
 * The flat operational list.
 *
 * Order is the frozen RD-I3 order (`scheduledFor` ASC, nulls last, then
 * `scheduleId`, then `dogId`), preserved by RD-I4/RD-I5 and consumed here with
 * `map` ONLY. This view never sorts, never groups and never filters — including
 * no terminal filtering: a `completed` or `cancelled` item stays in the list
 * with its canonical badge.
 */
function ScheduleList({ entries }: { entries: ComposedScheduleEntry[] }) {
  return (
    <ul className="flex flex-col gap-2" data-testid="schedule-list">
      {entries.map((composed) => (
        <ScheduleRow key={composed.entry.entryId} composed={composed} />
      ))}
    </ul>
  );
}

/**
 * Agenda screen.
 *
 * The ladder is authority-and-coverage first: a denial, a technical failure and
 * an incomplete read are each stated as themselves. None of them may render as
 * "nenhum agendamento", and emptiness is NEVER inferred from row count.
 */
export function ScheduleView() {
  const { state, coverage, authorityStatus, refresh } = useSchedule();

  switch (state.status) {
    // Authority unresolved or the read is in flight: never an answer.
    case "idle":
    case "loading":
      return <LoadingState message="Carregando agenda..." />;

    // Strict authority denial OR a scope-level Rules denial — not emptiness.
    case "forbidden":
      return (
        <ForbiddenState
          requiredCapability={state.requiredCapability}
          message={state.message}
        />
      );

    // Global technical failure — no state was presumed.
    case "error": {
      const errorState = state as ReadStateError;
      return (
        <ErrorState
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

    // Zero loaded entries. This is only an AUTHORITATIVE "nothing exists" when
    // the read actually covered the whole scope; otherwise the honest answer is
    // "incomplete", not "empty".
    case "empty":
      if (hasCoverageLoss(coverage)) {
        return (
          <ScheduleCoverageNotice coverage={coverage} onRetry={refresh} />
        );
      }
      return (
        <EmptyState
          title="Nenhum agendamento encontrado."
          description="Nenhum item de agenda existe para o efetivo autorizado."
        />
      );

    // A refresh is in flight over a previously trustworthy list: keep it
    // visible and mark the transient update, never blanking the screen.
    case "refreshing": {
      const previousEntries = isComposedEntryList(state.previousData)
        ? state.previousData
        : null;

      if (!previousEntries) {
        return <LoadingState message="Carregando agenda..." />;
      }

      return (
        <div className="flex flex-col gap-4">
          <p
            className="flex items-center gap-2 text-xs text-muted-foreground"
            role="status"
            aria-live="polite"
            data-testid="schedule-refreshing"
          >
            Atualizando agenda...
          </p>
          <ScheduleList entries={previousEntries} />
        </div>
      );
    }

    // Mixed coverage: some K9s were denied or failed, or some documents were
    // not fully trustworthy. The usable entries are shown, but the screen
    // states the incompleteness — never a clean success.
    case "partial":
      return (
        <div className="flex flex-col gap-4">
          <ScheduleCoverageNotice coverage={coverage} onRetry={refresh} />
          <ScheduleList entries={state.partialData} />
        </div>
      );

    case "success":
      return (
        <div className="flex flex-col gap-4">
          {/* Coverage can still be incomplete on a `success` read (e.g. a
              partial document); truthfulness is driven by coverage, not state. */}
          {hasCoverageLoss(coverage) && (
            <ScheduleCoverageNotice coverage={coverage} onRetry={refresh} />
          )}
          <ScheduleList entries={state.data} />
        </div>
      );

    default:
      // Any state not applicable to this global list is treated as a controlled
      // technical failure rather than being rendered as a (misleading) success.
      return (
        <ErrorState message="Estado de leitura não suportado nesta tela." />
      );
  }
}
