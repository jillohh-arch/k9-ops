// @vitest-environment node
/**
 * HW-4.WEB-SCHED-RD-I2 — Front30 "Próximos 7 dias" display window.
 *
 * This is PRESENTATION grouping (`D0 … D+6` local calendar dates), deliberately
 * distinct from the canonical Front20 `upcoming` status (rolling 168 hours).
 * The final block proves they legitimately DISAGREE across a real DST
 * transition — that divergence is the frozen contract, not a defect.
 *
 * Fixtures come from the FROZEN RD-I1 parser (@ 93c8fbe). `now` is explicit.
 */
import { describe, expect, it } from "vitest";
import { parseScheduleItemWireDoc } from "../parser";
import type { ScheduleItemReadModel } from "../types";
import {
  FRONT30_DISPLAY_WINDOW_DAYS,
  SCHEDULE_UPCOMING_WINDOW_MS,
  evaluateScheduleTemporalStatus,
  isInFront30DisplayWindow,
  localCalendarDate,
} from "../temporal";

const DOG_ID = "dog-alpha";
const SCHEDULE_ID = "sched-001";

const ts = (iso: string) => ({ toMillis: () => new Date(iso).getTime() });

function build(scheduledIso: string, timezone: string, overrides: Record<string, unknown> = {}): ScheduleItemReadModel {
  return parseScheduleItemWireDoc(
    {
      dog_id: DOG_ID,
      schedule_type: "vaccination",
      title: "Reforço V10",
      scheduled_for: ts(scheduledIso),
      timezone,
      lifecycle_status: "open",
      source_type: "preventive",
      created_at: ts("2026-08-20T10:00:00Z"),
      recorded_by: { uid: "u1", name: "Cond. Silva", internal_role: "condutor" },
      revision: 1,
      schema_version: 1,
      ...overrides,
    },
    SCHEDULE_ID,
    DOG_ID
  );
}

describe("window span", () => {
  it("spans exactly seven local calendar dates", () => {
    expect(FRONT30_DISPLAY_WINDOW_DAYS).toBe(7);
  });
});

describe("D0 … D+6 membership in UTC", () => {
  const NOW = new Date("2026-09-10T12:00:00Z"); // local date 2026-09-10

  it.each([
    ["D0  same date", "2026-09-10T23:00:00Z", 0, true],
    ["D+1", "2026-09-11T01:00:00Z", 1, true],
    ["D+6 last included", "2026-09-16T23:59:00Z", 6, true],
    ["D+7 first excluded", "2026-09-17T00:01:00Z", 7, false],
    ["D+30", "2026-10-10T12:00:00Z", 30, false],
    ["D-1 yesterday", "2026-09-09T23:00:00Z", -1, false],
    ["D-10", "2026-08-31T12:00:00Z", -10, false],
  ])("%s", (_label, scheduledIso, expectedOffset, expectedMember) => {
    const r = isInFront30DisplayWindow(build(scheduledIso, "UTC"), NOW);

    expect(r.availability).toBe("available");
    expect(r.offsetDays).toBe(expectedOffset);
    expect(r.inDisplayWindow).toBe(expectedMember);
  });

  it("includes an item earlier the same local day", () => {
    // Already pending/overdue by status, yet still in today's section.
    const item = build("2026-09-10T06:00:00Z", "UTC");
    const window = isInFront30DisplayWindow(item, NOW);
    const temporal = evaluateScheduleTemporalStatus(item, NOW);

    expect(window.inDisplayWindow).toBe(true);
    expect(window.offsetDays).toBe(0);
    expect(temporal.temporalStatus).toBe("pending");
  });
});

describe("membership uses the item's own timezone", () => {
  it("resolves a cross-midnight instant by local date, not UTC date", () => {
    // 2026-09-11T01:00Z is still 2026-09-10 22:00 in São Paulo (UTC-3).
    const scheduledIso = "2026-09-11T01:00:00Z";
    const now = new Date("2026-09-10T20:00:00Z"); // 17:00 local, 2026-09-10

    const sp = isInFront30DisplayWindow(build(scheduledIso, "America/Sao_Paulo"), now);
    expect(sp.offsetDays).toBe(0); // same local day in São Paulo

    const utc = isInFront30DisplayWindow(build(scheduledIso, "UTC"), now);
    expect(utc.offsetDays).toBe(1); // next day in UTC

    // Same instants, different zones, different section membership offsets.
    expect(sp.offsetDays).not.toBe(utc.offsetDays);
  });

  it("extracts local calendar dates through Intl", () => {
    const instant = new Date("2026-09-11T01:00:00Z");
    expect(localCalendarDate(instant, "UTC")).toEqual({ year: 2026, month: 9, day: 11 });
    expect(localCalendarDate(instant, "America/Sao_Paulo")).toEqual({
      year: 2026,
      month: 9,
      day: 10,
    });
    expect(localCalendarDate(instant, "Mars/Olympus")).toBeNull();
  });
});

/**
 * HW-4.WEB-SCHED-RD-I2.A1 / C1 — proleptic civil-day ordinal.
 *
 * `Date.UTC()` maps years 0–99 onto 1900–1999 while leaving years >= 100 alone,
 * which made the ordinal scale discontinuous at the 99/100 boundary: two
 * ADJACENT civil dates reported a difference of -693959 days. The instant is
 * reachable — the frozen parser accepts a year-1 `scheduled_for` as canonical —
 * so these fixtures exercise the public API, not a private helper.
 */
describe("proleptic civil-day ordinal across the year 0–99 coercion boundary", () => {
  it("treats 0099-12-31 -> 0100-01-01 as one day apart", () => {
    const now = new Date("0099-12-31T00:00:00Z");
    const item = build("0100-01-01T00:00:00Z", "UTC");

    // Both instants are genuinely valid and read back faithfully via Intl.
    expect(localCalendarDate(now, "UTC")).toEqual({ year: 99, month: 12, day: 31 });
    expect(localCalendarDate(new Date("0100-01-01T00:00:00Z"), "UTC")).toEqual({
      year: 100,
      month: 1,
      day: 1,
    });

    const r = isInFront30DisplayWindow(item, now);
    expect(r.availability).toBe("available");
    expect(r.offsetDays).toBe(1);
    expect(r.inDisplayWindow).toBe(true);
  });

  it("keeps adjacent year-1 dates one day apart", () => {
    const now = new Date("0001-01-01T00:00:00Z");
    const item = build("0001-01-02T00:00:00Z", "UTC");

    const r = isInFront30DisplayWindow(item, now);
    expect(r.offsetDays).toBe(1);
    expect(r.inDisplayWindow).toBe(true);
  });

  it("keeps a mid-coercion-band year adjacent pair correct", () => {
    const now = new Date("0050-06-15T00:00:00Z");
    const item = build("0050-06-16T00:00:00Z", "UTC");
    expect(isInFront30DisplayWindow(item, now).offsetDays).toBe(1);
  });

  it("excludes D+7 in the formerly-coerced year range", () => {
    // Proves the fix restores a real scale rather than merely returning 1.
    const now = new Date("0099-12-31T00:00:00Z");
    const d6 = build("0100-01-06T00:00:00Z", "UTC");
    const d7 = build("0100-01-07T00:00:00Z", "UTC");

    expect(isInFront30DisplayWindow(d6, now).offsetDays).toBe(6);
    expect(isInFront30DisplayWindow(d6, now).inDisplayWindow).toBe(true);
    expect(isInFront30DisplayWindow(d7, now).offsetDays).toBe(7);
    expect(isInFront30DisplayWindow(d7, now).inDisplayWindow).toBe(false);
  });

  it("keeps other era boundaries continuous", () => {
    const cases: Array<[string, string]> = [
      ["1899-12-31T00:00:00Z", "1900-01-01T00:00:00Z"],
      ["1969-12-31T00:00:00Z", "1970-01-01T00:00:00Z"], // epoch boundary
      ["2026-12-31T00:00:00Z", "2027-01-01T00:00:00Z"],
    ];
    for (const [nowIso, scheduledIso] of cases) {
      const r = isInFront30DisplayWindow(build(scheduledIso, "UTC"), new Date(nowIso));
      expect(r.offsetDays).toBe(1);
    }
  });
});

/**
 * HW-4.WEB-SCHED-RD-I2.A2 / C2 — era-aware civil date extraction.
 *
 * `Intl` reports an ERA-RELATIVE Gregorian year, so an era-blind reading made
 * 1 BCE and 1 CE both extract as `year: 1`. Those two instants are ONE day
 * apart, yet the ordinal difference came out as -364 while availability still
 * reported `available`.
 *
 * Instants are built with `setUTCFullYear` rather than parsed from short year
 * strings, so the astronomical year is unambiguous in the fixture itself.
 */
function atAstronomicalUtc(year: number, month: number, day: number): Date {
  const d = new Date(0);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCFullYear(year, month - 1, day);
  return d;
}

describe("era-relative year extraction across the BCE/CE boundary", () => {
  it("maps astronomical years onto the expected civil eras", () => {
    // Documents the premise the conversion relies on, in this ICU build.
    const eraOf = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        calendar: "gregory",
        year: "numeric",
        era: "short",
      })
        .formatToParts(d)
        .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});

    expect(eraOf(atAstronomicalUtc(1, 1, 1))).toMatchObject({ year: "1", era: "AD" });
    expect(eraOf(atAstronomicalUtc(0, 1, 1))).toMatchObject({ year: "1", era: "BC" });
    expect(eraOf(atAstronomicalUtc(-1, 1, 1))).toMatchObject({ year: "2", era: "BC" });
  });

  it("recovers the astronomical year from the era-relative value", () => {
    // 1 BCE -> 0, 2 BCE -> -1, 1 CE -> 1. Uses `1 - year`, not `-year`.
    expect(localCalendarDate(atAstronomicalUtc(0, 12, 31), "UTC")).toEqual({
      year: 0,
      month: 12,
      day: 31,
    });
    expect(localCalendarDate(atAstronomicalUtc(1, 1, 1), "UTC")).toEqual({
      year: 1,
      month: 1,
      day: 1,
    });
    expect(localCalendarDate(atAstronomicalUtc(-1, 12, 31), "UTC")).toEqual({
      year: -1,
      month: 12,
      day: 31,
    });
  });

  it("treats 1 BCE Dec 31 -> 1 CE Jan 1 as one day apart", () => {
    const now = atAstronomicalUtc(0, 12, 31);
    const scheduledInstant = atAstronomicalUtc(1, 1, 1);

    // The two instants really are adjacent days.
    expect((scheduledInstant.getTime() - now.getTime()) / 86_400_000).toBe(1);

    const item = build(scheduledInstant.toISOString(), "UTC");
    const r = isInFront30DisplayWindow(item, now);

    expect(r.availability).toBe("available");
    expect(r.offsetDays).toBe(1); // was -364 before C2
    expect(r.inDisplayWindow).toBe(true);
  });

  it("keeps an adjacent pair entirely inside BCE correct", () => {
    // astronomical -1 Dec 31 (2 BCE) -> astronomical 0 Jan 1 (1 BCE)
    const now = atAstronomicalUtc(-1, 12, 31);
    const scheduledInstant = atAstronomicalUtc(0, 1, 1);

    expect((scheduledInstant.getTime() - now.getTime()) / 86_400_000).toBe(1);

    const r = isInFront30DisplayWindow(build(scheduledInstant.toISOString(), "UTC"), now);
    expect(r.offsetDays).toBe(1);
    expect(r.inDisplayWindow).toBe(true);
  });

  it("keeps the window scale real across the era boundary", () => {
    // Guards against the fix merely returning 1 for any BCE/CE pair.
    const now = atAstronomicalUtc(0, 12, 31); // 1 BCE
    const d6 = atAstronomicalUtc(1, 1, 6); // 1 CE Jan 6
    const d7 = atAstronomicalUtc(1, 1, 7); // 1 CE Jan 7

    expect(isInFront30DisplayWindow(build(d6.toISOString(), "UTC"), now).offsetDays).toBe(6);
    expect(isInFront30DisplayWindow(build(d6.toISOString(), "UTC"), now).inDisplayWindow).toBe(
      true
    );
    expect(isInFront30DisplayWindow(build(d7.toISOString(), "UTC"), now).offsetDays).toBe(7);
    expect(isInFront30DisplayWindow(build(d7.toISOString(), "UTC"), now).inDisplayWindow).toBe(
      false
    );
  });

  it("stays monotonic backwards through BCE years", () => {
    // Extracted astronomical years must DECREASE as instants move earlier,
    // even though the era-relative numbers increase.
    const years = [-2, -1, 0, 1].map((y) => localCalendarDate(atAstronomicalUtc(y, 6, 15), "UTC"));
    expect(years.map((c) => c?.year)).toEqual([-2, -1, 0, 1]);
  });
});

describe("leap-day continuity", () => {
  it("treats 2028-02-29 -> 2028-03-01 as one day apart", () => {
    const now = new Date("2028-02-29T12:00:00Z");
    const item = build("2028-03-01T12:00:00Z", "UTC");

    const r = isInFront30DisplayWindow(item, now);
    expect(r.offsetDays).toBe(1);
    expect(r.inDisplayWindow).toBe(true);
  });

  it("spans a leap day correctly across the window", () => {
    const now = new Date("2028-02-26T12:00:00Z");
    const d6 = build("2028-03-03T12:00:00Z", "UTC"); // crosses 02-29
    expect(isInFront30DisplayWindow(d6, now).offsetDays).toBe(6);
    expect(isInFront30DisplayWindow(d6, now).inDisplayWindow).toBe(true);
  });
});

describe("DST safety", () => {
  it("counts a 23-hour spring-forward day as one calendar day", () => {
    // America/New_York springs forward 2026-03-08; that local day has 23 hours.
    const now = new Date("2026-03-07T17:00:00Z"); // 12:00 EST, 2026-03-07
    const next = build("2026-03-08T16:00:00Z", "America/New_York"); // 12:00 EDT, 03-08

    const r = isInFront30DisplayWindow(next, now);
    expect(r.offsetDays).toBe(1); // one calendar day despite 23 elapsed hours
    expect(r.inDisplayWindow).toBe(true);
  });

  it("counts a 25-hour fall-back day as one calendar day", () => {
    // America/New_York falls back 2026-11-01; that local day has 25 hours.
    const now = new Date("2026-10-31T16:00:00Z"); // 12:00 EDT, 10-31
    const next = build("2026-11-01T17:00:00Z", "America/New_York"); // 12:00 EST, 11-01

    const r = isInFront30DisplayWindow(next, now);
    expect(r.offsetDays).toBe(1);
    expect(r.inDisplayWindow).toBe(true);
  });

  it("keeps D+6 correct across a DST transition", () => {
    // now 2026-03-05 local; D+6 is 2026-03-11, crossing the 03-08 transition.
    const now = new Date("2026-03-05T17:00:00Z"); // 12:00 EST
    const d6 = build("2026-03-11T16:00:00Z", "America/New_York"); // 12:00 EDT, 03-11
    const d7 = build("2026-03-12T16:00:00Z", "America/New_York"); // 12:00 EDT, 03-12

    expect(isInFront30DisplayWindow(d6, now).offsetDays).toBe(6);
    expect(isInFront30DisplayWindow(d6, now).inDisplayWindow).toBe(true);
    expect(isInFront30DisplayWindow(d7, now).offsetDays).toBe(7);
    expect(isInFront30DisplayWindow(d7, now).inDisplayWindow).toBe(false);
  });
});

describe("canonical rolling status vs Front30 calendar window — EXPECTED divergence", () => {
  /**
   * Instants verified with Intl rather than assumed offsets:
   *
   *   now       2026-03-02T04:30Z = 2026-03-01 23:30 EST  (local date 03-01)
   *   scheduled 2026-03-08T07:15Z = 2026-03-08 03:15 EDT  (local date 03-08)
   *
   *   elapsed = 146.75 h  → INSIDE the rolling 168 h window → `upcoming`
   *   local offset = D+7  → OUTSIDE `D0 … D+6`             → not in section
   *
   * The DST transition is what lets 146.75 elapsed hours span 7 calendar days.
   */
  const TZ = "America/New_York";
  const NOW = new Date("2026-03-02T04:30:00Z");
  const SCHEDULED_ISO = "2026-03-08T07:15:00Z";

  it("confirms the fixture really is inside the rolling window", () => {
    const elapsed = new Date(SCHEDULED_ISO).getTime() - NOW.getTime();
    expect(elapsed).toBeLessThan(SCHEDULE_UPCOMING_WINDOW_MS);
    expect(elapsed / 3_600_000).toBeCloseTo(146.75, 2);
  });

  it("confirms the local calendar dates really are seven days apart", () => {
    expect(localCalendarDate(NOW, TZ)).toEqual({ year: 2026, month: 3, day: 1 });
    expect(localCalendarDate(new Date(SCHEDULED_ISO), TZ)).toEqual({
      year: 2026,
      month: 3,
      day: 8,
    });
  });

  it("canonical status is upcoming while display membership is false", () => {
    const item = build(SCHEDULED_ISO, TZ);

    const temporal = evaluateScheduleTemporalStatus(item, NOW);
    const window = isInFront30DisplayWindow(item, NOW);

    expect(temporal.temporalStatus).toBe("upcoming");
    expect(temporal.temporalAvailability).toBe("available");

    expect(window.offsetDays).toBe(7);
    expect(window.inDisplayWindow).toBe(false);

    // The two concepts disagree — and that is the frozen contract.
    expect(temporal.temporalStatus === "upcoming" && window.inDisplayWindow === false).toBe(true);
  });

  it("does not let display membership override the canonical badge", () => {
    const item = build(SCHEDULED_ISO, TZ);
    const temporal = evaluateScheduleTemporalStatus(item, NOW);

    // Status is derived independently of window membership.
    expect(temporal.temporalStatus).toBe("upcoming");
    expect(isInFront30DisplayWindow(item, NOW).inDisplayWindow).toBe(false);
  });
});

describe("invalid input fails closed", () => {
  const NOW = new Date("2026-09-10T12:00:00Z");

  it("returns unavailable for an invalid now", () => {
    const r = isInFront30DisplayWindow(build("2026-09-11T12:00:00Z", "UTC"), new Date("nope"));
    expect(r.inDisplayWindow).toBeNull();
    expect(r.offsetDays).toBeNull();
    expect(r.availability).toBe("invalid_schedule_temporal_input");
  });

  it("returns unavailable for a malformed scheduledFor", () => {
    const item = build("2026-09-11T12:00:00Z", "UTC", { scheduled_for: "2026-09-11" });
    expect(item.scheduledFor).toBeNull();

    const r = isInFront30DisplayWindow(item, NOW);
    expect(r.inDisplayWindow).toBeNull();
    expect(r.availability).toBe("invalid_schedule_temporal_input");
  });

  it("returns unavailable for an invalid timezone", () => {
    const item = build("2026-09-11T12:00:00Z", "Mars/Olympus");
    expect(item.timezone).toBeNull();

    const r = isInFront30DisplayWindow(item, NOW);
    expect(r.inDisplayWindow).toBeNull();
    expect(r.availability).toBe("invalid_schedule_temporal_input");
  });

  it("does not mutate the item", () => {
    const item = build("2026-09-11T12:00:00Z", "UTC");
    const snapshot = JSON.stringify(item);
    isInFront30DisplayWindow(item, NOW);
    expect(JSON.stringify(item)).toBe(snapshot);
    expect("inDisplayWindow" in item).toBe(false);
  });
});
