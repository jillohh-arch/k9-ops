/**
 * K9 Ops Web — Health Web v1 HW-6A.I3
 * Clinical main screen — the first visual slice of the Clinical vertical.
 *
 * RESPONSIBILITY:
 * - Consume `useClinicalCases()` EXCLUSIVELY. This view performs no Firestore
 *   read, no callable and no direct database-client access — it is pure
 *   presentation over a composed read state.
 * - Map the hook's canonical `ReadState` onto the seven truthful screens:
 *   loading, refreshing, forbidden, error, partial, empty, success. A denial is
 *   never emptiness; a technical failure is never emptiness; partial coverage is
 *   never a clean success.
 * - Apply local, in-memory filtering over the already-composed list, and split
 *   a FILTER-empty result (some cases exist, none match) from a GLOBAL-empty
 *   scope (no cases exist at all).
 *
 * INTERACTION BOUNDARY (I4A + I4B): this screen opens exactly TWO interactions,
 * both contextual modals over data ALREADY LOADED, and never both at once:
 * - CASE AREA -> CASE SUMMARY MODAL (I4A, unchanged);
 * - K9 IDENTITY (photo + name + MAT) -> VISÃO CLÍNICA DO K9 (I4B).
 * Each modal reads from the SAME composed entries the cards were rendered from, so
 * opening either triggers no additional read. Still no write and no navigation —
 * in particular the K9 action does NOT lead to the Efetivo K9 profile (I4B §7).
 */

"use client";

import { useMemo, useState } from "react";

import type { ReadStateError } from "../../domain/read-states";
import { useClinicalCases } from "../hooks/use-clinical-cases";
import type { ClinicalCaseListEntry } from "../data/clinical-scope-loader";
import { ClinicalCaseList } from "./clinical-case-list";
import { ClinicalCaseModal } from "./clinical-case-modal";
import {
  ClinicalK9Modal,
  deriveClinicalK9Context,
} from "./clinical-k9-modal";
import { ClinicalFilters } from "./clinical-filters";
import {
  ClinicalSummaryCards,
  deriveClinicalSummary,
} from "./clinical-summary-cards";
import {
  ClinicalError,
  ClinicalForbidden,
  ClinicalListSkeleton,
} from "./clinical-states";
import {
  DEFAULT_CLINICAL_FILTERS,
  isClinicalFiltersActive,
  type ClinicalDogOption,
  type ClinicalListFilters,
} from "./types";

/**
 * Applies the active filters to a composed list, IN MEMORY.
 *
 * Every predicate distinguishes `null` from `false`/`0`: the "unavailable"
 * options match only a genuinely absent flag, and "without" matches only an
 * affirmed negative.
 */
function applyFilters(
  entries: ClinicalCaseListEntry[],
  filters: ClinicalListFilters,
): ClinicalCaseListEntry[] {
  const search = filters.search.trim().toLowerCase();

  return entries.filter((entry) => {
    const item = entry.case;

    if (search) {
      const haystack = `${entry.dog.name} ${item.title ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    if (filters.dogId !== "all" && entry.dogId !== filters.dogId) {
      return false;
    }

    if (filters.status !== "all") {
      if (filters.status === "unknown") {
        if (item.clinicalStatus !== null) return false;
      } else if (item.clinicalStatus !== filters.status) {
        return false;
      }
    }

    if (filters.restriction !== "all") {
      const flag = item.hasActiveRestriction;
      if (filters.restriction === "with" && flag !== true) return false;
      if (filters.restriction === "without" && flag !== false) return false;
      if (filters.restriction === "unavailable" && flag !== null) return false;
    }

    if (filters.schedule !== "all") {
      const flag = item.hasPendingSchedule;
      if (filters.schedule === "with" && flag !== true) return false;
      if (filters.schedule === "without" && flag !== false) return false;
      if (filters.schedule === "unavailable" && flag !== null) return false;
    }

    if (filters.treatment !== "all") {
      const count = item.activeTreatmentsCount;
      if (filters.treatment === "with" && !(count !== null && count > 0)) {
        return false;
      }
      if (filters.treatment === "without" && count !== 0) return false;
      if (filters.treatment === "unavailable" && count !== null) return false;
    }

    return true;
  });
}

/**
 * HW-6A.I3.F1 — Clinical-local narrowing for `ReadStateRefreshing.previousData`.
 *
 * WHY THIS EXISTS
 * The SHARED `ReadStateRefreshing` (domain/read-states.ts) types `previousData`
 * as `unknown` and is NOT generic, unlike `ReadStateSuccess<T>`/
 * `ReadStatePartial<T>`. So `ReadState<ClinicalCaseListEntry[]>` cannot carry
 * the element type through its refreshing arm. Widening that shared contract is
 * out of scope for this gate, so the Clinical vertical re-establishes its own
 * invariant HERE, locally.
 *
 * PROVEN PRODUCER INVARIANT (F1 §3)
 * `refreshing` has exactly ONE producer in the whole Clinical vertical:
 * `useClinicalCases()` (hooks/use-clinical-cases.ts:165). It publishes
 * `previousData: refreshCycle.previousData`, where `refreshCycle` is
 * `useState<{ nonce: number; previousData: ClinicalCaseListEntry[] | null }>`
 * and the branch is guarded by `else if (refreshCycle.previousData)`, i.e. the
 * value is a non-null `ClinicalCaseListEntry[]`. Its only writer is `refresh()`,
 * which stores `currentData` — derived exclusively from `state.data`
 * (`ReadStateSuccess<ClinicalCaseListEntry[]>`) or `state.partialData`
 * (`ReadStatePartial<ClinicalCaseListEntry[]>`). The data layer
 * (loader/reader) NEVER emits `refreshing`. The chain is therefore
 * statically `ClinicalCaseListEntry[]` end to end.
 *
 * Rather than assert that invariant blindly, this is a real runtime type guard:
 * it is cheap, it cannot lie, and it lets the view degrade truthfully instead of
 * rendering a fabricated empty list if the contract is ever violated upstream.
 */
function isClinicalEntryList(value: unknown): value is ClinicalCaseListEntry[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (typeof item !== "object" || item === null) return false;
      const entry = item as Partial<ClinicalCaseListEntry>;
      return (
        typeof entry.entryId === "string" &&
        typeof entry.dogId === "string" &&
        typeof entry.caseId === "string" &&
        typeof entry.dog === "object" &&
        entry.dog !== null &&
        typeof entry.case === "object" &&
        entry.case !== null
      );
    })
  );
}

/** K9 options for the scope selector — derived from the CURRENT result only. */
function deriveDogOptions(entries: ClinicalCaseListEntry[]): ClinicalDogOption[] {
  const byDog = new Map<string, ClinicalDogOption>();

  for (const entry of entries) {
    const existing = byDog.get(entry.dogId);
    if (existing) {
      existing.caseCount += 1;
    } else {
      byDog.set(entry.dogId, {
        dogId: entry.dogId,
        name: entry.dog.name,
        caseCount: 1,
      });
    }
  }

  return [...byDog.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Renders the KPI + filter + list stack shared by success/partial/refreshing. */
function ClinicalListShell({
  entries,
  filters,
  onChangeFilters,
  onResetFilters,
}: {
  entries: ClinicalCaseListEntry[];
  filters: ClinicalListFilters;
  onChangeFilters: (next: Partial<ClinicalListFilters>) => void;
  onResetFilters: () => void;
}) {
  const filtersActive = isClinicalFiltersActive(filters);
  const dogOptions = useMemo(() => deriveDogOptions(entries), [entries]);
  const filtered = useMemo(
    () => applyFilters(entries, filters),
    [entries, filters],
  );
  // KPIs summarize the FILTERED view so the numbers always match what is shown.
  const summary = useMemo(() => deriveClinicalSummary(filtered), [filtered]);

  /*
   * I4A §16/§18 — the open case is held as an ID, not as a captured entry.
   *
   * Storing the entry object would let the modal keep rendering a case that a
   * filter change, a refresh or a coverage change has since removed from the
   * authorized list — showing data the current read no longer supports. Resolving
   * the ID against the CURRENT filtered list each render means a case that leaves
   * the list closes its own modal instead of going stale.
   */
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const selectedEntry =
    filtered.find((entry) => entry.entryId === selectedEntryId) ?? null;

  /*
   * HW-6A.I4B.F1 — STALE CASE SELECTION INVALIDATION.
   *
   * Resolving the ID each render already closes the modal the instant its case
   * leaves `filtered` (a filter/search/refresh drop): `selectedEntry` is null,
   * so `ClinicalCaseModal` renders nothing. But the ID SURVIVED that close. If
   * the same case later re-enters `filtered` — the user clears the search, a
   * refresh restores it — `selectedEntry` would resolve non-null again and the
   * modal would REOPEN with no user action. A modal that closed because its
   * selection became invalid must not resurrect on its own (I4B.R1 blocker).
   *
   * The fix is to invalidate the stale ID at the moment the selection stops
   * resolving. This is React's documented "adjust state during render" pattern,
   * not an effect: the guard `selectedEntryId !== null && selectedEntry === null`
   * makes it self-terminating (clearing the ID falsifies the guard, so no loop),
   * it commits no DOM between renders (no flash), and it triggers no read. It is
   * deliberately NOT a `useEffect` — set-state-in-effect is a lint error here and
   * an effect would clear one render LATE, leaving a one-frame resurrection.
   */
  if (selectedEntryId !== null && selectedEntry === null) {
    setSelectedEntryId(null);
  }

  /*
   * I4B §7/§10/§16/§17/§18 — the open K9 view is held as a dogId, resolved each
   * render against the PRE-FILTER authorized `entries`, not `filtered`.
   *
   * §10: the K9's clinical view is about that K9's cases in the AUTHORIZED SCOPE,
   * so a status/search filter narrowing the visible cards must NOT silently shrink
   * the K9's own case list. §17/§18: resolving against `entries` (the authorized
   * dataset) means a K9 that leaves the authorized scope — a refresh dropping it,
   * a coverage change, a move to forbidden/empty — closes its own view instead of
   * holding stale clinical data. `deriveClinicalK9Context` returns null when the
   * K9 is absent, which unmounts the dialog.
   */
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const k9Context = deriveClinicalK9Context(selectedDogId, entries);

  /*
   * HW-6A.I4B.F1 — STALE K9 SELECTION INVALIDATION.
   *
   * Same non-resurrection invariant as the case selection, but keyed to the
   * K9's own contract: `k9Context` is derived from PRE-FILTER `entries`, so it
   * goes null ONLY when the dog leaves the authorized/composed dataset (a
   * refresh dropping it, a coverage change, a move to forbidden/empty) — NEVER
   * merely because a UI filter hid the dog's visible cards. Clearing on
   * `k9Context === null` therefore preserves the I4B pre-filter distinction:
   * filtering all of a dog's cards out of the grid keeps the K9 view open
   * because the dog is still in `entries`. Only a genuine dataset departure
   * invalidates the selection, and once invalidated the dog reappearing does
   * not reopen the view — a fresh K9 activation is required.
   */
  if (selectedDogId !== null && k9Context === null) {
    setSelectedDogId(null);
  }

  /*
   * §16 — exactly one contextual modal open at a time. Opening one action closes
   * the other: they are mutually exclusive, never stacked.
   */
  const openCase = (entry: ClinicalCaseListEntry) => {
    setSelectedDogId(null);
    setSelectedEntryId(entry.entryId);
  };
  const openK9 = (entry: ClinicalCaseListEntry) => {
    setSelectedEntryId(null);
    setSelectedDogId(entry.dogId);
  };

  return (
    <div className="flex flex-col gap-6">
      <ClinicalSummaryCards counts={summary} />
      <ClinicalFilters
        filters={filters}
        dogOptions={dogOptions}
        onChange={onChangeFilters}
        onReset={onResetFilters}
        filtersActive={filtersActive}
        resultCount={filtered.length}
      />
      <ClinicalCaseList
        entries={filtered}
        filtersActive={filtersActive}
        onResetFilters={onResetFilters}
        onOpenCase={openCase}
        onOpenK9={openK9}
        selectedEntryId={selectedEntry?.entryId ?? null}
        selectedDogId={k9Context?.dogId ?? null}
      />
      <ClinicalCaseModal
        entry={selectedEntry}
        onClose={() => setSelectedEntryId(null)}
      />
      <ClinicalK9Modal
        context={k9Context}
        onClose={() => setSelectedDogId(null)}
      />
    </div>
  );
}

export function ClinicalView() {
  const { state, coverage, authorityStatus, refresh } = useClinicalCases();
  const [filters, setFilters] = useState<ClinicalListFilters>(
    DEFAULT_CLINICAL_FILTERS,
  );

  const changeFilters = (next: Partial<ClinicalListFilters>) =>
    setFilters((prev) => ({ ...prev, ...next }));
  const resetFilters = () => setFilters(DEFAULT_CLINICAL_FILTERS);

  switch (state.status) {
    // Authority unresolved or list read in flight: a skeleton, never an answer.
    case "idle":
    case "loading":
      return <ClinicalListSkeleton />;

    // Strict authority denial OR a scope-level Rules denial — not emptiness.
    case "forbidden":
      return (
        <ClinicalForbidden
          requiredCapability={state.requiredCapability}
          message={state.message}
        />
      );

    // Global technical failure — no state was presumed.
    case "error": {
      const errorState = state as ReadStateError;
      return (
        <ClinicalError
          code={errorState.code}
          message={errorState.message}
          onRetry={authorityStatus === "allowed" ? refresh : undefined}
        />
      );
    }

    // Proven institutional zero — distinct from a filter-empty result inside
    // the list. No coverage loss, so this is a truthful "nothing exists".
    case "empty":
      return (
        <ClinicalListShell
          entries={[]}
          filters={filters}
          onChangeFilters={changeFilters}
          onResetFilters={resetFilters}
        />
      );

    // A refresh is in flight over a previously trustworthy list: keep it visible
    // and mark the transient update, never blanking the screen.
    case "refreshing": {
      // The shared refreshing contract carries `unknown`; the Clinical producer
      // invariant (see isClinicalEntryList) narrows it back to the entry list.
      // A contract violation degrades to the skeleton — a transient "still
      // working" — rather than a FALSE EMPTY LIST, which would read as a
      // truthful zero the reader never proved.
      const previousEntries = isClinicalEntryList(state.previousData)
        ? state.previousData
        : null;

      if (!previousEntries) {
        return <ClinicalListSkeleton />;
      }

      return (
        <div className="flex flex-col gap-4">
          <p
            className="flex items-center gap-2 text-xs text-muted-foreground"
            role="status"
            aria-live="polite"
            data-testid="clinical-refreshing"
          >
            Atualizando casos clínicos...
          </p>
          <ClinicalListShell
            entries={previousEntries}
            filters={filters}
            onChangeFilters={changeFilters}
            onResetFilters={resetFilters}
          />
        </div>
      );
    }

    // Mixed coverage: some K9s were denied or failed. The trustworthy cases are
    // shown, but the screen states the incompleteness — never a clean success.
    case "partial":
      return (
        <div className="flex flex-col gap-4">
          <ClinicalCoverageNotice coverage={coverage} onRetry={refresh} />
          <ClinicalListShell
            entries={state.partialData}
            filters={filters}
            onChangeFilters={changeFilters}
            onResetFilters={resetFilters}
          />
        </div>
      );

    case "success":
      return (
        <ClinicalListShell
          entries={state.data}
          filters={filters}
          onChangeFilters={changeFilters}
          onResetFilters={resetFilters}
        />
      );

    default:
      // Any state not applicable to this global list is treated as a controlled
      // technical failure rather than being rendered as a (misleading) success.
      return (
        <ClinicalError message="Estado de leitura não suportado nesta tela." />
      );
  }
}

/**
 * Partial-coverage banner.
 *
 * States, in operator terms, exactly what the composed list could NOT cover:
 * denied K9s and technically-failed K9s are reported separately, because a
 * denial and a transport failure are different facts.
 */
function ClinicalCoverageNotice({
  coverage,
  onRetry,
}: {
  coverage: {
    forbiddenDogIds: string[];
    failedDogIds: string[];
    partialEntryIds: string[];
  };
  onRetry?: () => void;
}) {
  const forbidden = coverage.forbiddenDogIds.length;
  const failed = coverage.failedDogIds.length;
  const partialDocs = coverage.partialEntryIds.length;

  const parts: string[] = [];
  if (forbidden > 0) {
    parts.push(`${forbidden} ${forbidden === 1 ? "K9 não autorizado" : "K9 não autorizados"}`);
  }
  if (failed > 0) {
    parts.push(`${failed} ${failed === 1 ? "K9 com falha de leitura" : "K9 com falha de leitura"}`);
  }
  if (partialDocs > 0) {
    parts.push(
      `${partialDocs} ${partialDocs === 1 ? "caso com dados incompletos" : "casos com dados incompletos"}`,
    );
  }

  return (
    <div
      className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3"
      role="status"
      aria-live="polite"
      data-testid="clinical-partial-notice"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300/85">
          Cobertura parcial
        </p>
        <p className="mt-1 text-sm font-semibold leading-snug text-amber-100">
          A lista está incompleta e não representa todo o efetivo.
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
          Recarregar
        </button>
      )}
    </div>
  );
}
