"use client";

/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — RD-I5
 * Schedule read orchestration — authority-gated, race-safe, clock-explicit.
 *
 * RESPONSIBILITY:
 * - Coordinate the strict authority boundary (`useScheduleReadAuthority`) with
 *   the institutional scope read (`loadScheduleScope`) and the pure temporal
 *   composition (`composeScheduleScope`).
 * - Expose ONE truthful read state over the composed Agenda, plus coverage.
 * - Guarantee that NO Schedule read is ever started while authority is not
 *   `allowed` (loading or forbidden).
 * - Be robust to unmount, authority change and refresh churn: a read that
 *   resolves for a superseded cycle is discarded, never published.
 *
 * This is the FIRST layer where authority, reader and composition meet, and
 * therefore the first place the read-timing invariant is provable at all:
 * RD-I4's authority hook only derives, and RD-I3's loader only reads when
 * called.
 *
 * DESIGN NOTE (why no setState in the effect body):
 * `loading`, `refreshing` and `forbidden` are DERIVED from authority plus the
 * current read cycle during render. The effect only ever publishes an async
 * result. This keeps the gate a pure function of authority — a forbidden
 * profile cannot transiently render as "loading an agenda" — and satisfies
 * react-hooks/set-state-in-effect.
 *
 * ── SINGLE WALL-CLOCK SITE (load-bearing) ──────────────────────────────────
 * Agenda v1 authorizes exactly ONE current-clock capture, and it lives here:
 * immediately AFTER the scope read resolves, immediately BEFORE composing.
 *
 *   read starts -> Firestore fan-out -> scope result known
 *     -> capture ONE `now` -> compose the whole scope with it -> publish
 *
 * Capturing at request start would let a slow read publish an already-stale
 * classification; capturing during render would turn every re-render into an
 * implicit temporal reevaluation. Neither is permitted.
 *
 * RD-I2 and RD-I4 stay clock-explicit; no consumer downstream reads the clock.
 *
 * ── NO TIMER IN V1 ─────────────────────────────────────────────────────────
 * Temporal classification is fixed for a published cycle. There is no
 * `setInterval`, no midnight watcher, no clock tick. A new temporal evaluation
 * happens only through a NEW cycle: `refresh()`, an authority transition that
 * permits a new read, or remount. Bounded temporal staleness while the page
 * stays open is EXPECTED v1 behaviour, consistent with the frozen one-shot
 * `getDocs` + explicit-refresh architecture.
 *
 * NON-RESPONSIBILITY:
 * - No UI, no sections, no "Próximos 7 dias", no terminal filtering, no
 *   ordering decisions (RD-I3 owns order, RD-I4 owns annotation).
 * - No Firestore access of its own; `loadScheduleScope` is the only read.
 * - No permission logic; `useScheduleReadAuthority` is the only authority.
 * - One-shot deterministic reads only; no listeners.
 */

import { useCallback, useEffect, useState } from "react";

import type { ReadState } from "../../domain/read-states";
import {
  loadScheduleScope,
  type ScheduleScopeCoverage,
} from "../data/schedule-scope-loader";
import { SCHEDULE_READ_CAPABILITY } from "../data/schedule-reader";
import {
  composeScheduleScope,
  type ComposedScheduleEntry,
} from "../composition/schedule-composition";
import {
  useScheduleReadAuthority,
  type ScheduleReadAuthorityStatus,
} from "./use-schedule-read-authority";

export interface UseScheduleResult {
  /** Canonical technical state over the composed global Agenda. */
  state: ReadState<ComposedScheduleEntry[]>;
  /** Coverage accounting; safe to read in every state (empty until known). */
  coverage: ScheduleScopeCoverage;
  /** Mirror of the authority gate, so a consumer can distinguish causes. */
  authorityStatus: ScheduleReadAuthorityStatus;
  /** Re-runs the one-shot scope read. No-op unless authority is `allowed`. */
  refresh: () => void;
}

/**
 * Coverage before any institutional read has succeeded.
 *
 * `complete: false` means "coverage is NOT YET KNOWN" — never "the scope is
 * provably complete and empty".
 */
const EMPTY_COVERAGE: ScheduleScopeCoverage = {
  dogsInScope: 0,
  authorizedDogIds: [],
  forbiddenDogIds: [],
  failedDogIds: [],
  partialEntryIds: [],
  complete: false,
};

/** Forbidden state derived purely from authority — costs ZERO Firestore reads. */
const FORBIDDEN_STATE: ReadState<ComposedScheduleEntry[]> = {
  status: "forbidden",
  requiredCapability: SCHEDULE_READ_CAPABILITY,
  message: "Leitura da agenda não autorizada para o perfil de acesso atual.",
};

const LOADING_STATE: ReadState<ComposedScheduleEntry[]> = { status: "loading" };

/** A published read, tagged with the cycle that requested it. */
interface ScheduleCycleResult {
  cycleKey: string;
  state: ReadState<ComposedScheduleEntry[]>;
  coverage: ScheduleScopeCoverage;
}

/**
 * Identifies one read cycle. Any change (authority transition or refresh)
 * produces a new key, which invalidates a previously published result.
 */
function toCycleKey(authorityStatus: ScheduleReadAuthorityStatus, nonce: number): string {
  return `${authorityStatus}#${nonce}`;
}

/**
 * Global Agenda hook.
 *
 * State progression:
 *   authority loading   -> { status: "loading" }, NO read
 *   authority forbidden -> { status: "forbidden" }, NO read
 *   authority allowed   -> loading -> composed loader state (success / empty /
 *                          partial / forbidden / error)
 *   refresh() over a resolved list -> { status: "refreshing", previousData }
 */
export function useSchedule(): UseScheduleResult {
  const { status: authorityStatus, canRead } = useScheduleReadAuthority();

  const [result, setResult] = useState<ScheduleCycleResult | null>(null);
  // A refresh carries the list that should stay visible while it runs, captured
  // in the event handler (never in an effect).
  const [refreshCycle, setRefreshCycle] = useState<{
    nonce: number;
    previousData: ComposedScheduleEntry[] | null;
  }>({ nonce: 0, previousData: null });

  const cycleKey = toCycleKey(authorityStatus, refreshCycle.nonce);

  useEffect(() => {
    // While authority is unresolved or denied, no read is even attempted.
    if (authorityStatus !== "allowed") {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const scope = await loadScheduleScope();
        if (cancelled) return;

        // THE single authorized wall-clock capture: after the read resolved,
        // before composing. One `now` serves every entry in this cycle.
        const now = new Date();
        const composed = composeScheduleScope(scope, now);

        setResult({ cycleKey, state: composed.state, coverage: composed.coverage });
      } catch (err: unknown) {
        if (cancelled) return;
        // Defensive only: `loadScheduleScope` normally RESOLVES typed states
        // (including forbidden/error). This handles a contract violation.
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        setResult({
          cycleKey,
          state: {
            status: "error",
            code: "SCHEDULE_SCOPE_UNEXPECTED_ERROR",
            message: `Falha inesperada ao compor a agenda: ${message}`,
            technicalDetails: String(err),
            retryable: true,
          },
          coverage: EMPTY_COVERAGE,
        });
      }
    })();

    // Unmount, authority change or refresh supersedes this cycle.
    return () => {
      cancelled = true;
    };
  }, [authorityStatus, cycleKey]);

  // --- Derived, authority-first state ---------------------------------------
  // Authority is consulted BEFORE any stored async result, so a late
  // previously-allowed read can never outrank current forbidden/loading.

  let state: ReadState<ComposedScheduleEntry[]>;
  let coverage: ScheduleScopeCoverage;

  if (authorityStatus === "loading") {
    state = LOADING_STATE;
    coverage = EMPTY_COVERAGE;
  } else if (!canRead) {
    state = FORBIDDEN_STATE;
    coverage = EMPTY_COVERAGE;
  } else if (result && result.cycleKey === cycleKey) {
    // Second stale guard: a result published by a superseded cycle is ignored
    // even if its effect's `cancelled` flag never fired.
    state = result.state;
    coverage = result.coverage;
  } else if (refreshCycle.previousData) {
    // A refresh in flight keeps the previously trustworthy list visible.
    state = { status: "refreshing", previousData: refreshCycle.previousData };
    coverage = EMPTY_COVERAGE;
  } else {
    state = LOADING_STATE;
    coverage = EMPTY_COVERAGE;
  }

  // Already `ComposedScheduleEntry[]` — no re-load, no re-composition, and no
  // downgrade to RD-I3 entries while a refresh runs.
  const currentData =
    state.status === "success"
      ? state.data
      : state.status === "partial"
        ? state.partialData
        : null;

  const refresh = useCallback(() => {
    // Guard mirrors the effect: refreshing while unauthorized must not read.
    if (!canRead) return;
    setRefreshCycle((prev) => ({
      nonce: prev.nonce + 1,
      previousData: currentData,
    }));
  }, [canRead, currentData]);

  return { state, coverage, authorityStatus, refresh };
}
