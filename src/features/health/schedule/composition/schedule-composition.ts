/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — RD-I4
 * PURE Schedule composition over the frozen RD-I3 scope result.
 *
 * RESPONSIBILITY: annotate. Nothing else.
 *
 * Each loaded `ScheduleListEntry` is paired with its two INDEPENDENT temporal
 * derivations, both produced by the frozen RD-I2 evaluators against ONE
 * explicitly supplied `now`:
 *
 *   temporal      — canonical Front20 status (the item's badge)
 *   displayWindow — Front30 "Próximos 7 dias" civil-date membership
 *
 * ── THE TWO 7-DAY CONCEPTS MUST NEVER BE CONFLATED ─────────────────────────
 * `temporal.temporalStatus === "upcoming"` is a ROLLING 168-hour window
 * measured back from `scheduledFor`. `displayWindow.inDisplayWindow` is a LOCAL
 * CALENDAR range `D0…D+6` in the item's own timezone. They legitimately
 * disagree — provably so across a DST transition, where 146.75 elapsed hours
 * can span seven calendar days.
 *
 * Neither value is ever derived from the other. This module calls both frozen
 * evaluators independently and forwards both results verbatim.
 *
 * ── WHAT THIS MODULE MUST NOT DO ───────────────────────────────────────────
 * - No Firestore, no `db`, no `getDocs`, no `loadScheduleScope`.
 * - No React: no hooks, no `useMemo`, no `"use client"`.
 * - No implicit clock: `now` is a required parameter. There is no default, no
 *   optional overload and no internal `new Date()` / `Date.now()`.
 * - No temporal logic of its own. RD-I2 is the sole temporal authority; no
 *   deadline, today, upcoming, DST or calendar arithmetic is reimplemented.
 * - No UI section arrays (`nextSevenDays`, `today`, `overdue`, …). Grouping is
 *   page policy, decided later.
 * - No terminal filtering. A `completed` item scheduled tomorrow composes as
 *   `temporalStatus: "completed"` WITH `inDisplayWindow: true`. The future page
 *   predicate excludes terminal items from the operational section; that
 *   exclusion is deliberately NOT implemented here.
 * - No `dataQuality` gate. `partial` / `legacy` / `degraded` items are all
 *   composed; RD-I2's own field-specific logic decides what is derivable.
 * - No mutation of the input scope, its state, its coverage or its entries.
 * - No reinterpretation of source state from display membership: a section that
 *   would render empty must never turn a `partial` / `forbidden` / `error`
 *   source into `empty`.
 */

import type { ReadState } from "../../domain/read-states";
import type {
  ScheduleDisplayWindowResult,
  ScheduleTemporalResult,
} from "../temporal";
import { evaluateScheduleTemporalStatus, isInFront30DisplayWindow } from "../temporal";
import type {
  ScheduleListEntry,
  ScheduleScopeCoverage,
  ScheduleScopeResult,
} from "../data/schedule-scope-loader";

/**
 * Canonical temporal derivation, minus `item`.
 *
 * `item` is dropped deliberately rather than duplicated: RD-I2 returns it BY
 * REFERENCE, unmodified, so it is the very same object already reachable at
 * `entry.item`. Carrying it twice would invite the two paths to be treated as
 * independent copies.
 */
export type ComposedScheduleTemporal = Omit<ScheduleTemporalResult, "item">;

/**
 * One loaded Schedule entry plus its two independent derivations.
 *
 * The frozen RD-I2 result types are reused directly rather than re-declared, so
 * the unions cannot drift from their authority.
 */
export interface ComposedScheduleEntry {
  /** The frozen RD-I3 list entry, unmodified and by reference. */
  entry: ScheduleListEntry;
  /** Canonical badge dimension. */
  temporal: ComposedScheduleTemporal;
  /** Front30 civil-date section-membership dimension. */
  displayWindow: ScheduleDisplayWindowResult;
}

export interface ComposedScheduleScope {
  /** Source ReadState with composed entries substituted in place. */
  state: ReadState<ComposedScheduleEntry[]>;
  /** Source coverage, semantically unchanged. */
  coverage: ScheduleScopeCoverage;
}

/**
 * Composes a single entry against an explicit `now`.
 *
 * Both evaluators receive the SAME `now` instance, so the two dimensions can
 * never disagree because of clock drift between calls.
 *
 * `now` validity is NOT re-checked here: RD-I2 already reports an invalid
 * instant as `invalid_schedule_temporal_input` per entry, and duplicating that
 * validation would create a second, competing temporal authority.
 */
export function composeScheduleEntry(
  entry: ScheduleListEntry,
  now: Date
): ComposedScheduleEntry {
  // `item` is discarded from the temporal result; it is the same object as
  // `entry.item`, which the composed entry already carries.
  const { item: _item, ...temporal } = evaluateScheduleTemporalStatus(entry.item, now);

  // Independent second evaluation. NEVER inferred from `temporal` above.
  const displayWindow = isInFront30DisplayWindow(entry.item, now);

  return { entry, temporal, displayWindow };
}

/** Order-preserving map. `.map` keeps the frozen RD-I3 ordering intact. */
function composeEntries(
  entries: ScheduleListEntry[],
  now: Date
): ComposedScheduleEntry[] {
  return entries.map((entry) => composeScheduleEntry(entry, now));
}

/**
 * Composes the whole scope result.
 *
 * The SOURCE ReadState variant is preserved exactly; only the entry collection
 * inside it is replaced with composed entries. Coverage is forwarded by
 * reference — `complete`, `authorizedDogIds`, `forbiddenDogIds`, `failedDogIds`
 * and `partialEntryIds` are never recomputed, because display membership says
 * nothing about whether the underlying read was complete.
 *
 * Every data-carrying variant is handled EXPLICITLY. RD-I3 only ever emits
 * `success` / `empty` / `partial` / `forbidden` / `error`, but `ReadState` is a
 * 15-variant union: a blanket pass-through would leave UNCOMPOSED entries
 * sitting in a field whose type claims they are composed, which the compiler
 * could not catch. The remaining variants carry no typed entry collection and
 * are forwarded unchanged.
 */
export function composeScheduleScope(
  scope: ScheduleScopeResult,
  now: Date
): ComposedScheduleScope {
  const { state, coverage } = scope;

  switch (state.status) {
    case "success":
      return {
        state: { ...state, data: composeEntries(state.data, now) },
        coverage,
      };

    case "partial":
      return {
        state: { ...state, partialData: composeEntries(state.partialData, now) },
        coverage,
      };

    case "degraded":
      return {
        state: { ...state, data: composeEntries(state.data, now) },
        coverage,
      };

    case "stale":
      return {
        state: { ...state, data: composeEntries(state.data, now) },
        coverage,
      };

    case "legacy":
      return {
        state: { ...state, data: composeEntries(state.data, now) },
        coverage,
      };

    case "conflict":
      // Only `data1` is typed as the entry collection; `data2` is `unknown` in
      // `ReadState<ComposedScheduleEntry[]>` and is forwarded untouched.
      return {
        state: { ...state, data1: composeEntries(state.data1, now) },
        coverage,
      };

    // Variants below carry NO typed entry collection: idle, loading,
    // refreshing (`previousData: unknown`), empty, unauthorized, forbidden,
    // notFound, error. Their authority/transport meaning is preserved exactly —
    // a denial or failure must never be rewritten as an empty view.
    default:
      return { state, coverage };
  }
}
