/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — RD-I2
 * Temporal derivation for `health_schedule` items + Front30 display window.
 *
 * CONTRACT AUTHORITY: HEALTH_V1_FIRESTORE_SCHEMA.md §2.14 (frozen by
 * FRONT20-SCHED-CONTRACT-R2 @ b3838cd) and the Front20 reference evaluator
 * `lib/features/health/domain/health_schedule_item.dart`.
 *
 * INPUT IS IMMUTABLE. `ScheduleItemReadModel` comes from the frozen RD-I1
 * parser (@ 93c8fbe) and is never mutated or extended here; every temporal
 * value lives beside it in the result envelope.
 *
 * ── TWO DISTINCT "7 DAYS" ──────────────────────────────────────────────────
 * These are DIFFERENT computations and must never be collapsed:
 *
 *   1. `ScheduleTemporalStatus.upcoming` — CANONICAL Front20 domain state.
 *      A ROLLING 168-hour span measured back from `scheduledFor`.
 *
 *   2. `isInFront30DisplayWindow()` — Front30 PRESENTATION grouping.
 *      Local CALENDAR dates `D0 … D+6` inclusive, in the item's timezone.
 *
 * They legitimately disagree near DST transitions and around midnight. The
 * canonical status is the item's badge; display-window membership only selects
 * which UI section lists it, and never overrides the badge.
 *
 * ── ABSENT vs MALFORMED `due_until` ────────────────────────────────────────
 * `item.dueUntil === null` is ambiguous on its own: the field may have been
 * genuinely absent, or present-but-rejected by the strict parser. Only TRUE
 * absence permits the approved generic tolerance. A corrupted explicit deadline
 * must never be silently replaced by an invented one, so this module consults
 * `item.issues` to tell the two apart.
 *
 * SCOPE: pure derivation only. No Firestore, no network, no UI, no implicit
 * clock — `now` is always supplied by the caller.
 */

import type { ScheduleItemReadModel, ScheduleType } from "./types";

/**
 * Canonical derived temporal states (§2.14 precedence). NEVER persisted —
 * `lifecycle_status` is the only persisted state field.
 */
export type ScheduleTemporalStatus =
  | "completed"
  | "cancelled"
  | "overdue"
  | "pending"
  | "today"
  | "upcoming"
  | "scheduled";

/**
 * Whether a temporal status could be derived, and if not, why.
 *
 * These describe the READ outcome, not the document: an item whose temporal
 * enrichment is unavailable may still be a perfectly valid persisted record.
 *
 * - `available`                        — status derived.
 * - `invalid_schedule_temporal_input`  — a temporal prerequisite is missing or
 *   malformed (bad `scheduledFor`, unrecognized type/lifecycle, invalid
 *   timezone, invalid `now`, or an explicit-but-corrupted `due_until`).
 * - `incomplete_schedule_temporal_config` — mirrors the Front20 domain error of
 *   the same name: the type has no generic tolerance and the item carries no
 *   explicit `due_until`. Approved for `dose` by human decision (HW-4A.2B).
 * - `temporal_arithmetic_overflow`     — duration arithmetic left the
 *   representable `Date` range; never classified from an invalid instant.
 */
export type ScheduleTemporalAvailability =
  | "available"
  | "invalid_schedule_temporal_input"
  | "incomplete_schedule_temporal_config"
  | "temporal_arithmetic_overflow";

/**
 * Temporal derivation result.
 *
 * `item` is ALWAYS present, including every unavailable case: an item is never
 * hidden because its temporal enrichment could not be computed.
 */
export interface ScheduleTemporalResult {
  item: ScheduleItemReadModel;
  temporalStatus: ScheduleTemporalStatus | null;
  temporalAvailability: ScheduleTemporalAvailability;
  /** Effective deadline actually used for the `overdue` decision. */
  effectiveDueUntil: Date | null;
}

/** Approved generic post-due tolerance (HW-4A.2B, human decisions 1 and 2). */
export const SCHEDULE_GENERIC_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/** Canonical rolling `upcoming` window: Duration(days: 7) before scheduledFor. */
export const SCHEDULE_UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Front30 display window span: D0 plus the next six local calendar dates. */
export const FRONT30_DISPLAY_WINDOW_DAYS = 7;

/**
 * Schedule types with NO generic tolerance.
 *
 * `dose` is excluded by approved human decision: inventing a 24h pharmacological
 * tolerance would be a clinical assertion without authority. Without an explicit
 * `due_until`, a dose item's deadline is simply not derivable.
 */
const TYPES_WITHOUT_GENERIC_TOLERANCE: ReadonlySet<ScheduleType> = new Set<ScheduleType>([
  "dose",
]);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * Duration arithmetic that fails closed.
 *
 * A valid `Date` plus a valid duration is NOT necessarily a valid `Date`: the
 * representable range is ±8.64e15 ms, and exceeding it yields an Invalid Date
 * whose `getTime()` is NaN. Both the intermediate sum and the resulting instant
 * are therefore range-checked. No wrap, clamp, Infinity or fallback.
 */
function addMillisSafe(base: Date, deltaMs: number): Date | null {
  const sum = base.getTime() + deltaMs;
  if (!Number.isFinite(sum)) return null;
  const result = new Date(sum);
  return Number.isFinite(result.getTime()) ? result : null;
}

/** A local calendar date in some IANA zone. */
interface LocalCalendarDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Extracts the LOCAL calendar date of an instant in the given IANA zone.
 *
 * Uses `formatToParts` rather than a formatted string so the numeric parts are
 * read directly instead of being scraped from locale-dependent text.
 *
 * The `era` part is REQUIRED, not decorative. `Intl` reports an ERA-RELATIVE
 * Gregorian year, so without it two different civil years collapse onto the same
 * number and the year stops being injective:
 *
 *   0000-12-31 (1 BCE) -> year "1"
 *   0001-01-01 (1 CE)  -> year "1"
 *
 * Those instants are exactly one day apart, yet an era-blind reading made the
 * civil-day ordinal differ by -364 (audited in HW-4.WEB-SCHED-RD-I2.A2). BCE
 * years also count UPWARD as time runs backward, so the ambiguity is not a
 * constant offset that could be corrected downstream.
 *
 * The returned `year` is therefore the ASTRONOMICAL year that `Date` and
 * `setUTCFullYear` use, converted from the era-relative value.
 *
 * `calendar: "gregory"` is pinned so the parts are proleptic Gregorian
 * regardless of any locale default, and the locale is fixed for the same reason.
 */
export function localCalendarDate(
  instant: Date,
  timeZone: string
): LocalCalendarDate | null {
  if (!isValidDate(instant)) return null;

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      calendar: "gregory",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      era: "short",
    }).formatToParts(instant);
  } catch {
    return null;
  }

  const readNumber = (type: Intl.DateTimeFormatPartTypes): number | null => {
    const part = parts.find((candidate) => candidate.type === type);
    if (!part) return null;
    const value = Number(part.value);
    return Number.isInteger(value) ? value : null;
  };

  const eraRelativeYear = readNumber("year");
  const month = readNumber("month");
  const day = readNumber("day");
  if (eraRelativeYear === null || month === null || day === null) return null;

  // Era is explicitly requested, so an absent or unrecognized value is an
  // extraction failure — never an excuse to assume the common era.
  const eraPart = parts.find((candidate) => candidate.type === "era");
  if (!eraPart) return null;

  const era = eraPart.value.trim().toUpperCase();
  const isCommonEra = era === "AD" || era === "CE";
  const isBeforeCommonEra = era === "BC" || era === "BCE";
  if (!isCommonEra && !isBeforeCommonEra) return null;

  // Gregorian era-relative year -> astronomical year.
  //   1 CE  -> 1        1 BCE -> 0
  //   2 CE  -> 2        2 BCE -> -1
  // Note `1 - year`, NOT `-year`: there is no astronomical year 0 in the
  // era-relative numbering, so negating would be off by one.
  const year = isBeforeCommonEra ? 1 - eraRelativeYear : eraRelativeYear;

  return { year, month, day };
}

/**
 * Stable PROLEPTIC GREGORIAN day ordinal for a local calendar date.
 *
 * A UTC midnight anchor is used purely as a calendar ruler — the date parts were
 * already resolved in the item's timezone, so day differences depend only on the
 * civil calendar, never on elapsed hours. That is what keeps the Front30 window
 * DST-safe: a local day spanning 23 or 25 hours still counts as exactly one.
 *
 * `Date.UTC()` CANNOT be used here. It applies the legacy ECMAScript coercion
 * that maps years 0–99 onto 1900–1999, while years >= 100 are left alone, so the
 * ordinal scale is discontinuous across that boundary:
 *
 *   Date.UTC(99, 11, 31) -> 1999-12-31   ordinal   10956
 *   Date.UTC(100, 0, 1)  -> 0100-01-01   ordinal -683003
 *
 * That produced a difference of -693959 days between two ADJACENT civil dates
 * (audited in HW-4.WEB-SCHED-RD-I2.A1), and the instant is reachable: the frozen
 * parser accepts a year-1 `scheduled_for` as fully canonical.
 *
 * `setUTCFullYear` performs no such coercion, so the year is honoured verbatim
 * and the ordinal stays continuous. Verified: 0099-12-31 -> 0100-01-01 yields 1,
 * with modern, leap-day and epoch-boundary results identical to before.
 */
function calendarDayOrdinal(date: LocalCalendarDate): number | null {
  const anchor = new Date(0);
  anchor.setUTCHours(0, 0, 0, 0);
  anchor.setUTCFullYear(date.year, date.month - 1, date.day);

  const millis = anchor.getTime();
  if (!Number.isFinite(millis)) return null;

  const ordinal = millis / MS_PER_DAY;
  return Number.isInteger(ordinal) ? ordinal : null;
}

/**
 * True when the parser rejected a PRESENT `due_until`.
 *
 * Distinguishes "field absent" from "field corrupted" — the parser records the
 * latter as an issue on `due_until`, so `dueUntil === null` alone is ambiguous.
 */
function hasRejectedExplicitDueUntil(item: ScheduleItemReadModel): boolean {
  return item.issues.some((issue) => issue.field === "due_until");
}

/** Availability outcome for the effective-deadline resolution step. */
type DeadlineResolution =
  | { kind: "resolved"; effectiveDueUntil: Date }
  | { kind: "unavailable"; availability: ScheduleTemporalAvailability };

/**
 * Resolves `effective_due_until = due_until ?? scheduledFor + tolerance(type)`.
 *
 * An explicit valid `due_until` is authoritative for EVERY type, `dose`
 * included; the generic tolerance is only ever a fallback for true absence.
 */
function resolveEffectiveDueUntil(
  item: ScheduleItemReadModel,
  scheduledFor: Date,
  scheduleType: ScheduleType
): DeadlineResolution {
  if (isValidDate(item.dueUntil)) {
    return { kind: "resolved", effectiveDueUntil: item.dueUntil };
  }

  // Present-but-rejected: an explicitly corrupted deadline must NOT silently
  // become an invented one.
  if (hasRejectedExplicitDueUntil(item)) {
    return { kind: "unavailable", availability: "invalid_schedule_temporal_input" };
  }

  if (TYPES_WITHOUT_GENERIC_TOLERANCE.has(scheduleType)) {
    return { kind: "unavailable", availability: "incomplete_schedule_temporal_config" };
  }

  const fallback = addMillisSafe(scheduledFor, SCHEDULE_GENERIC_TOLERANCE_MS);
  if (fallback === null) {
    return { kind: "unavailable", availability: "temporal_arithmetic_overflow" };
  }

  return { kind: "resolved", effectiveDueUntil: fallback };
}

function unavailable(
  item: ScheduleItemReadModel,
  availability: ScheduleTemporalAvailability
): ScheduleTemporalResult {
  return { item, temporalStatus: null, temporalAvailability: availability, effectiveDueUntil: null };
}

/**
 * Derives the canonical temporal status of a schedule item at `now`.
 *
 * Precedence (§2.14 — FIRST matching condition wins):
 *   1. lifecycle completed              → completed   (terminal)
 *   2. lifecycle cancelled              → cancelled   (terminal)
 *   3. now >  effectiveDueUntil         → overdue     (STRICT >)
 *   4. now >= scheduledFor              → pending     (inclusive)
 *   5. same local calendar day          → today
 *   6. now >= scheduledFor - 7 days     → upcoming    (rolling 168h)
 *   7. otherwise                        → scheduled
 *
 * Because 4 precedes 5, an item scheduled earlier the same local day is
 * `pending`, never `today`. There is no state in which an item is both
 * `pending` and `overdue`.
 *
 * Terminal states bypass deadline resolution entirely, so a completed or
 * cancelled `dose` with no `due_until` still classifies normally.
 *
 * `now` MUST be supplied: this module never reads the wall clock.
 */
export function evaluateScheduleTemporalStatus(
  item: ScheduleItemReadModel,
  now: Date
): ScheduleTemporalResult {
  // An invalid reference instant is never replaced with the current time.
  if (!isValidDate(now)) {
    return unavailable(item, "invalid_schedule_temporal_input");
  }

  // --- terminal lifecycle: precedence 1 and 2 -------------------------------
  if (item.lifecycleStatus === "completed") {
    return {
      item,
      temporalStatus: "completed",
      temporalAvailability: "available",
      effectiveDueUntil: null,
    };
  }
  if (item.lifecycleStatus === "cancelled") {
    return {
      item,
      temporalStatus: "cancelled",
      temporalAvailability: "available",
      effectiveDueUntil: null,
    };
  }

  // --- temporal prerequisites for a non-terminal item ----------------------
  // Deliberately field-specific: an unrelated defect such as a missing title or
  // an unknown source_type does NOT suppress a derivable temporal status.
  if (item.lifecycleStatus !== "open") {
    return unavailable(item, "invalid_schedule_temporal_input");
  }
  if (!isValidDate(item.scheduledFor)) {
    return unavailable(item, "invalid_schedule_temporal_input");
  }
  if (item.scheduleType === null) {
    return unavailable(item, "invalid_schedule_temporal_input");
  }
  if (item.timezone === null) {
    return unavailable(item, "invalid_schedule_temporal_input");
  }

  const scheduledFor = item.scheduledFor;
  const timezone = item.timezone;

  const deadline = resolveEffectiveDueUntil(item, scheduledFor, item.scheduleType);
  if (deadline.kind === "unavailable") {
    return unavailable(item, deadline.availability);
  }
  const effectiveDueUntil = deadline.effectiveDueUntil;

  // --- precedence 3: overdue (STRICT greater-than) --------------------------
  if (now.getTime() > effectiveDueUntil.getTime()) {
    return {
      item,
      temporalStatus: "overdue",
      temporalAvailability: "available",
      effectiveDueUntil,
    };
  }

  // --- precedence 4: pending (inclusive) -----------------------------------
  if (now.getTime() >= scheduledFor.getTime()) {
    return {
      item,
      temporalStatus: "pending",
      temporalAvailability: "available",
      effectiveDueUntil,
    };
  }

  // From here `now < scheduledFor`.

  // --- precedence 5: today (same local calendar date, item's timezone) -----
  const nowLocal = localCalendarDate(now, timezone);
  const scheduledLocal = localCalendarDate(scheduledFor, timezone);
  if (nowLocal === null || scheduledLocal === null) {
    return unavailable(item, "invalid_schedule_temporal_input");
  }

  if (
    nowLocal.year === scheduledLocal.year &&
    nowLocal.month === scheduledLocal.month &&
    nowLocal.day === scheduledLocal.day
  ) {
    return {
      item,
      temporalStatus: "today",
      temporalAvailability: "available",
      effectiveDueUntil,
    };
  }

  // --- precedence 6: upcoming (rolling 168h, window start inclusive) -------
  const windowStart = addMillisSafe(scheduledFor, -SCHEDULE_UPCOMING_WINDOW_MS);
  if (windowStart === null) {
    return unavailable(item, "temporal_arithmetic_overflow");
  }

  if (now.getTime() >= windowStart.getTime()) {
    return {
      item,
      temporalStatus: "upcoming",
      temporalAvailability: "available",
      effectiveDueUntil,
    };
  }

  // --- precedence 7: scheduled --------------------------------------------
  return {
    item,
    temporalStatus: "scheduled",
    temporalAvailability: "available",
    effectiveDueUntil,
  };
}

/** Why Front30 display-window membership could not be decided, when it could not. */
export type ScheduleDisplayWindowAvailability =
  | "available"
  | "invalid_schedule_temporal_input";

/**
 * Front30 "Próximos 7 dias" section membership.
 *
 * PRESENTATION ONLY — this is NOT `ScheduleTemporalStatus.upcoming` and must
 * never override the item's canonical badge.
 *
 * Membership is decided on LOCAL CALENDAR DATES in the item's own timezone:
 * `D0 … D+6` inclusive, where `D0` is the local date of `now`. It is NOT a
 * rolling 168-hour span, and `D+6` is NOT computed by adding `6 * 24h` to an
 * instant — that would drift by an hour across a DST transition. Day ordinals
 * are compared instead, so a 23- or 25-hour local day still counts as one day.
 */
export interface ScheduleDisplayWindowResult {
  /** True when the item's local scheduled date falls in `D0 … D+6`. */
  inDisplayWindow: boolean | null;
  /** Signed day offset from `D0`; negative for past dates. */
  offsetDays: number | null;
  availability: ScheduleDisplayWindowAvailability;
}

export function isInFront30DisplayWindow(
  item: ScheduleItemReadModel,
  now: Date
): ScheduleDisplayWindowResult {
  if (!isValidDate(now) || !isValidDate(item.scheduledFor) || item.timezone === null) {
    return {
      inDisplayWindow: null,
      offsetDays: null,
      availability: "invalid_schedule_temporal_input",
    };
  }

  const nowLocal = localCalendarDate(now, item.timezone);
  const scheduledLocal = localCalendarDate(item.scheduledFor, item.timezone);
  if (nowLocal === null || scheduledLocal === null) {
    return {
      inDisplayWindow: null,
      offsetDays: null,
      availability: "invalid_schedule_temporal_input",
    };
  }

  const nowOrdinal = calendarDayOrdinal(nowLocal);
  const scheduledOrdinal = calendarDayOrdinal(scheduledLocal);
  if (nowOrdinal === null || scheduledOrdinal === null) {
    return {
      inDisplayWindow: null,
      offsetDays: null,
      availability: "invalid_schedule_temporal_input",
    };
  }

  const offsetDays = scheduledOrdinal - nowOrdinal;

  return {
    inDisplayWindow: offsetDays >= 0 && offsetDays <= FRONT30_DISPLAY_WINDOW_DAYS - 1,
    offsetDays,
    availability: "available",
  };
}
