// @vitest-environment node
/**
 * HW-4.WEB-SCHED-RD-I2 — canonical temporal evaluator.
 *
 * Fixtures are produced by the FROZEN RD-I1 parser (@ 93c8fbe) rather than by
 * hand-built read models, so these tests exercise the real integration contract
 * and would catch a drift between parser output and evaluator expectations.
 *
 * `now` is always explicit — no wall-clock dependence, no fake timers.
 */
import { describe, expect, it } from "vitest";
import { parseScheduleItemWireDoc } from "../parser";
import type { ScheduleItemReadModel } from "../types";
import {
  SCHEDULE_GENERIC_TOLERANCE_MS,
  SCHEDULE_UPCOMING_WINDOW_MS,
  evaluateScheduleTemporalStatus,
} from "../temporal";

const DOG_ID = "dog-alpha";
const SCHEDULE_ID = "sched-001";
const UTC = "UTC";

/** Firestore Timestamp stand-in accepted by the frozen strict parser. */
const ts = (iso: string) => ({ toMillis: () => new Date(iso).getTime() });
const tsMs = (ms: number) => ({ toMillis: () => ms });

const SCHEDULED_ISO = "2026-09-10T13:00:00.000Z";
const SCHEDULED_MS = new Date(SCHEDULED_ISO).getTime();

function build(overrides: Record<string, unknown> = {}): ScheduleItemReadModel {
  return parseScheduleItemWireDoc(
    {
      dog_id: DOG_ID,
      schedule_type: "vaccination",
      title: "Reforço V10",
      scheduled_for: ts(SCHEDULED_ISO),
      timezone: UTC,
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

const at = (ms: number) => new Date(ms);

describe("terminal lifecycle precedence", () => {
  it("classifies completed without requiring any deadline", () => {
    const r = evaluateScheduleTemporalStatus(
      build({ lifecycle_status: "completed" }),
      at(SCHEDULED_MS)
    );
    expect(r.temporalStatus).toBe("completed");
    expect(r.temporalAvailability).toBe("available");
    expect(r.effectiveDueUntil).toBeNull();
  });

  it("classifies cancelled without requiring any deadline", () => {
    const r = evaluateScheduleTemporalStatus(
      build({ lifecycle_status: "cancelled" }),
      at(SCHEDULED_MS)
    );
    expect(r.temporalStatus).toBe("cancelled");
    expect(r.temporalAvailability).toBe("available");
  });

  it("classifies a terminal dose with no due_until — terminal precedes deadline", () => {
    // The load-bearing case: dose has no generic tolerance, so a non-terminal
    // dose would fail closed. Terminal precedence must short-circuit first.
    for (const lifecycle of ["completed", "cancelled"] as const) {
      const r = evaluateScheduleTemporalStatus(
        build({ schedule_type: "dose", lifecycle_status: lifecycle, due_until: undefined }),
        at(SCHEDULED_MS + 10 * SCHEDULE_GENERIC_TOLERANCE_MS)
      );
      expect(r.temporalStatus).toBe(lifecycle);
      expect(r.temporalAvailability).toBe("available");
    }
  });

  it("keeps terminal classification even when far past any plausible deadline", () => {
    const r = evaluateScheduleTemporalStatus(
      build({ lifecycle_status: "completed" }),
      at(SCHEDULED_MS + 365 * 24 * 3600 * 1000)
    );
    expect(r.temporalStatus).toBe("completed");
  });
});

describe("effective due_until resolution", () => {
  it("uses an explicit due_until verbatim, without adding the 24h tolerance", () => {
    const explicitIso = "2026-09-10T18:00:00.000Z"; // only 5h after scheduled
    const item = build({ due_until: ts(explicitIso) });
    const r = evaluateScheduleTemporalStatus(item, at(new Date(explicitIso).getTime() + 1));

    expect(r.effectiveDueUntil?.toISOString()).toBe(explicitIso);
    // Explicit deadline already passed → overdue. The 24h fallback would have
    // produced `pending` here, so this proves the fallback is NOT applied.
    expect(r.temporalStatus).toBe("overdue");
  });

  it("falls back to scheduledFor + 24h when due_until is truly absent", () => {
    const r = evaluateScheduleTemporalStatus(build({ due_until: undefined }), at(SCHEDULED_MS));
    expect(r.effectiveDueUntil?.getTime()).toBe(SCHEDULED_MS + SCHEDULE_GENERIC_TOLERANCE_MS);
  });

  it.each([
    "vaccination",
    "exam",
    "consultation",
    "weighing",
    "reevaluation",
    "deworming",
    "bath",
    "general",
  ])("applies the approved 24h fallback for type %s", (scheduleType) => {
    const item = build({ schedule_type: scheduleType, due_until: undefined });
    const r = evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS));

    expect(r.temporalAvailability).toBe("available");
    expect(r.effectiveDueUntil?.getTime()).toBe(SCHEDULED_MS + SCHEDULE_GENERIC_TOLERANCE_MS);

    // Just inside tolerance → pending; one ms past → overdue.
    const boundary = SCHEDULED_MS + SCHEDULE_GENERIC_TOLERANCE_MS;
    expect(evaluateScheduleTemporalStatus(item, at(boundary)).temporalStatus).toBe("pending");
    expect(evaluateScheduleTemporalStatus(item, at(boundary + 1)).temporalStatus).toBe("overdue");
  });
});

describe("malformed explicit due_until must not become the fallback", () => {
  it("fails closed instead of inventing a 24h deadline", () => {
    // The parser rejects a non-Timestamp due_until and records the issue, which
    // is how "corrupted" stays distinguishable from "absent".
    const item = build({ due_until: "2026-09-11T13:00:00Z" });
    expect(item.dueUntil).toBeNull();
    expect(item.issues.some((i) => i.field === "due_until")).toBe(true);

    const r = evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS));
    expect(r.temporalStatus).toBeNull();
    expect(r.temporalAvailability).toBe("invalid_schedule_temporal_input");
    expect(r.effectiveDueUntil).toBeNull();
    expect(r.item).toBe(item);
  });

  it("distinguishes corrupted from absent for the same null dueUntil", () => {
    const absent = build({ due_until: undefined });
    const corrupted = build({ due_until: 1789045200000 });

    expect(absent.dueUntil).toBeNull();
    expect(corrupted.dueUntil).toBeNull();

    expect(evaluateScheduleTemporalStatus(absent, at(SCHEDULED_MS)).temporalAvailability).toBe(
      "available"
    );
    expect(evaluateScheduleTemporalStatus(corrupted, at(SCHEDULED_MS)).temporalAvailability).toBe(
      "invalid_schedule_temporal_input"
    );
  });
});

describe("dose fail-closed", () => {
  const doseNoDeadline = () =>
    build({ schedule_type: "dose", lifecycle_status: "open", due_until: undefined });

  it("returns incomplete_schedule_temporal_config and no status", () => {
    const r = evaluateScheduleTemporalStatus(doseNoDeadline(), at(SCHEDULED_MS));

    expect(r.temporalStatus).toBeNull();
    expect(r.temporalAvailability).toBe("incomplete_schedule_temporal_config");
    expect(r.effectiveDueUntil).toBeNull();
  });

  it("NEVER hides the item — the record is valid, only enrichment is missing", () => {
    const item = doseNoDeadline();
    const r = evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS));

    expect(r.item).toBe(item);
    expect(r.item.scheduleType).toBe("dose");
    expect(r.item.title).toBe("Reforço V10");
    expect(r.item.dataQuality).toBe("complete");
  });

  it("never assumes 24h nor asserts any temporal label", () => {
    const item = doseNoDeadline();
    // Well past where a 24h tolerance would have made it overdue.
    const r = evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS + 5 * SCHEDULE_GENERIC_TOLERANCE_MS));

    expect(r.temporalStatus).not.toBe("overdue");
    expect(r.temporalStatus).not.toBe("pending");
    expect(r.temporalStatus).not.toBe("today");
    expect(r.temporalStatus).not.toBe("upcoming");
    expect(r.temporalStatus).not.toBe("scheduled");
    expect(r.temporalStatus).toBeNull();
  });
});

describe("dose with an explicit due_until behaves normally", () => {
  const DUE_ISO = "2026-09-10T19:00:00.000Z";
  const DUE_MS = new Date(DUE_ISO).getTime();
  const doseItem = () =>
    build({ schedule_type: "dose", due_until: ts(DUE_ISO) });

  it("classifies before / after scheduled / after due by precedence", () => {
    const before = evaluateScheduleTemporalStatus(doseItem(), at(SCHEDULED_MS - 3600_000));
    expect(before.temporalStatus).toBe("today"); // same UTC day, still future
    expect(before.temporalAvailability).toBe("available");

    const between = evaluateScheduleTemporalStatus(doseItem(), at(SCHEDULED_MS + 3600_000));
    expect(between.temporalStatus).toBe("pending");

    const after = evaluateScheduleTemporalStatus(doseItem(), at(DUE_MS + 1));
    expect(after.temporalStatus).toBe("overdue");
    expect(after.effectiveDueUntil?.getTime()).toBe(DUE_MS);
  });

  it("uses the explicit deadline rather than any generic tolerance", () => {
    const r = evaluateScheduleTemporalStatus(doseItem(), at(SCHEDULED_MS));
    expect(r.effectiveDueUntil?.getTime()).toBe(DUE_MS);
    expect(r.effectiveDueUntil?.getTime()).not.toBe(SCHEDULED_MS + SCHEDULE_GENERIC_TOLERANCE_MS);
  });
});

describe("canonical precedence boundaries", () => {
  const item = () => build({ due_until: undefined });
  const DUE_MS = SCHEDULED_MS + SCHEDULE_GENERIC_TOLERANCE_MS;

  it("now === effectiveDueUntil is NOT overdue (strict greater-than)", () => {
    const r = evaluateScheduleTemporalStatus(item(), at(DUE_MS));
    expect(r.temporalStatus).not.toBe("overdue");
    expect(r.temporalStatus).toBe("pending");
  });

  it("now one ms after effectiveDueUntil is overdue", () => {
    expect(evaluateScheduleTemporalStatus(item(), at(DUE_MS + 1)).temporalStatus).toBe("overdue");
  });

  it("now === scheduledFor is pending (inclusive)", () => {
    expect(evaluateScheduleTemporalStatus(item(), at(SCHEDULED_MS)).temporalStatus).toBe("pending");
  });

  it("pending WINS over today for a same-day earlier item", () => {
    // scheduled 13:00Z, evaluated 14:00Z the same local day.
    // Precedence 4 is tested before 5, so this is `pending`, never `today`.
    const r = evaluateScheduleTemporalStatus(item(), at(SCHEDULED_MS + 3600_000));
    expect(r.temporalStatus).toBe("pending");
    expect(r.temporalStatus).not.toBe("today");
  });

  it("today applies only when now is earlier on the same local date", () => {
    const r = evaluateScheduleTemporalStatus(item(), at(SCHEDULED_MS - 4 * 3600_000));
    expect(r.temporalStatus).toBe("today");
  });

  it("upcoming window start is inclusive", () => {
    const windowStart = SCHEDULED_MS - SCHEDULE_UPCOMING_WINDOW_MS;
    expect(evaluateScheduleTemporalStatus(item(), at(windowStart)).temporalStatus).toBe("upcoming");
  });

  it("one ms before the window start is scheduled", () => {
    const windowStart = SCHEDULED_MS - SCHEDULE_UPCOMING_WINDOW_MS;
    expect(evaluateScheduleTemporalStatus(item(), at(windowStart - 1)).temporalStatus).toBe(
      "scheduled"
    );
  });

  it("covers the full precedence ladder deterministically", () => {
    const windowStart = SCHEDULED_MS - SCHEDULE_UPCOMING_WINDOW_MS;
    const cases: Array<[number, string]> = [
      [windowStart - 86_400_000, "scheduled"],
      [windowStart, "upcoming"],
      [SCHEDULED_MS - 5 * 3600_000, "today"],
      [SCHEDULED_MS, "pending"],
      [DUE_MS, "pending"],
      [DUE_MS + 1, "overdue"],
    ];
    for (const [nowMs, expected] of cases) {
      expect(evaluateScheduleTemporalStatus(item(), at(nowMs)).temporalStatus).toBe(expected);
    }
  });

  it("never reports pending and overdue for the same instant", () => {
    for (const offset of [-1, 0, 1, 3600_000, SCHEDULE_GENERIC_TOLERANCE_MS + 1]) {
      const status = evaluateScheduleTemporalStatus(item(), at(SCHEDULED_MS + offset)).temporalStatus;
      expect(["pending", "overdue", "today", "upcoming", "scheduled"]).toContain(status);
    }
  });
});

describe("invalid temporal input fails closed", () => {
  it("rejects an invalid `now` without substituting the wall clock", () => {
    const r = evaluateScheduleTemporalStatus(build(), new Date("not-a-date"));
    expect(r.temporalStatus).toBeNull();
    expect(r.temporalAvailability).toBe("invalid_schedule_temporal_input");
  });

  it("fails closed on a malformed scheduledFor", () => {
    const item = build({ scheduled_for: "2026-09-10T13:00:00Z" });
    expect(item.scheduledFor).toBeNull();
    expect(evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS)).temporalAvailability).toBe(
      "invalid_schedule_temporal_input"
    );
  });

  it("fails closed on an unrecognized schedule_type", () => {
    const item = build({ schedule_type: "grooming" });
    expect(item.scheduleType).toBeNull();
    expect(evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS)).temporalAvailability).toBe(
      "invalid_schedule_temporal_input"
    );
  });

  it("fails closed on an unrecognized lifecycle_status", () => {
    const item = build({ lifecycle_status: "pending" });
    expect(item.lifecycleStatus).toBeNull();
    expect(evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS)).temporalAvailability).toBe(
      "invalid_schedule_temporal_input"
    );
  });

  it("fails closed on an invalid timezone", () => {
    const item = build({ timezone: "Mars/Olympus" });
    expect(item.timezone).toBeNull();
    expect(evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS)).temporalAvailability).toBe(
      "invalid_schedule_temporal_input"
    );
  });
});

describe("arithmetic overflow fails closed", () => {
  const MAX_DATE_MS = 8_640_000_000_000_000;

  it("returns temporal_arithmetic_overflow when the 24h fallback is unrepresentable", () => {
    // Parser accepts this instant as fully canonical, but +24h leaves the range.
    const item = build({ scheduled_for: tsMs(MAX_DATE_MS), due_until: undefined });
    expect(item.scheduledFor?.getTime()).toBe(MAX_DATE_MS);
    expect(item.dataQuality).toBe("complete");

    const r = evaluateScheduleTemporalStatus(item, at(0));
    expect(r.temporalStatus).toBeNull();
    expect(r.temporalAvailability).toBe("temporal_arithmetic_overflow");
    expect(r.effectiveDueUntil).toBeNull();
    expect(r.item).toBe(item);
  });

  it("never classifies from an Invalid Date", () => {
    const item = build({ scheduled_for: tsMs(MAX_DATE_MS), due_until: undefined });
    const r = evaluateScheduleTemporalStatus(item, at(MAX_DATE_MS));
    expect(r.temporalStatus).not.toBe("overdue");
    expect(r.temporalStatus).not.toBe("scheduled");
    expect(r.temporalStatus).toBeNull();
  });

  it("classifies a near-minimum scheduledFor without underflowing", () => {
    const MIN_DATE_MS = -8_640_000_000_000_000;
    const item = build({
      scheduled_for: tsMs(MIN_DATE_MS),
      due_until: tsMs(MIN_DATE_MS + 1000),
    });
    expect(item.scheduledFor?.getTime()).toBe(MIN_DATE_MS);

    // The `upcoming` window subtraction (scheduledFor - 7d) WOULD underflow
    // here, but it is unreachable: precedence 6 is only evaluated when
    // `now < scheduledFor`, and no valid Date exists below the minimum. So the
    // reachable outcome is `pending`, and the guard remains defensive depth.
    const r = evaluateScheduleTemporalStatus(item, at(MIN_DATE_MS));
    expect(r.temporalStatus).toBe("pending");
    expect(r.temporalAvailability).toBe("available");
  });

  it("underflow guard is unreachable by construction, not by luck", () => {
    const MIN_DATE_MS = -8_640_000_000_000_000;
    // Any valid `now` is >= MIN, so `now < scheduledFor === MIN` is impossible
    // and precedence 6 can never be reached with a minimum-valued scheduledFor.
    expect(Number.isFinite(new Date(MIN_DATE_MS - 1).getTime())).toBe(false);
  });

  it("still evaluates normally for instants far from the range limits", () => {
    const r = evaluateScheduleTemporalStatus(build({ due_until: undefined }), at(SCHEDULED_MS));
    expect(r.temporalAvailability).toBe("available");
  });
});

describe("partial documents with valid temporal fields", () => {
  it("derives a status despite an unrelated missing title", () => {
    const item = build({ title: undefined, due_until: undefined });
    expect(item.dataQuality).toBe("partial");

    const r = evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS));
    expect(r.temporalAvailability).toBe("available");
    expect(r.temporalStatus).toBe("pending");
  });

  it("derives a status despite an unrelated unknown source_type", () => {
    const item = build({ source_type: "imported_legacy", due_until: undefined });
    expect(item.dataQuality).toBe("partial");
    expect(evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS)).temporalStatus).toBe("pending");
  });

  it("derives a status despite an incomplete actor snapshot", () => {
    const item = build({ recorded_by: { uid: "only-uid" }, due_until: undefined });
    expect(item.dataQuality).toBe("partial");
    expect(evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS)).temporalStatus).toBe("pending");
  });

  it("derives a status for a legacy item missing dog_id", () => {
    const item = build({ dog_id: undefined, due_until: undefined });
    expect(item.dataQuality).toBe("legacy");
    expect(evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS)).temporalStatus).toBe("pending");
  });
});

describe("input immutability", () => {
  it("returns the same item reference and mutates nothing", () => {
    const item = build({ due_until: undefined });
    const snapshot = JSON.stringify(item);

    const r = evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS));

    expect(r.item).toBe(item);
    expect(JSON.stringify(item)).toBe(snapshot);
    expect("temporalStatus" in item).toBe(false);
    expect("effectiveDueUntil" in item).toBe(false);
  });

  it("does not mutate a dose item when evaluation is unavailable", () => {
    const item = build({ schedule_type: "dose", due_until: undefined });
    const snapshot = JSON.stringify(item);

    evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS));

    expect(JSON.stringify(item)).toBe(snapshot);
  });

  it("does not mutate a partial item", () => {
    const item = build({ title: undefined });
    const snapshot = JSON.stringify(item);
    evaluateScheduleTemporalStatus(item, at(SCHEDULED_MS));
    expect(JSON.stringify(item)).toBe(snapshot);
  });
});

describe("item timezone drives the local-day decision", () => {
  it("classifies today/upcoming according to the item's own zone", () => {
    // 2026-09-11T01:00Z is 2026-09-10 22:00 in America/Sao_Paulo (UTC-3).
    const spItem = parseScheduleItemWireDoc(
      {
        dog_id: DOG_ID,
        schedule_type: "vaccination",
        title: "T",
        scheduled_for: ts("2026-09-11T01:00:00Z"),
        timezone: "America/Sao_Paulo",
        lifecycle_status: "open",
        source_type: "preventive",
        created_at: ts("2026-08-20T10:00:00Z"),
        recorded_by: { uid: "u", name: "n", internal_role: "condutor" },
        revision: 1,
        schema_version: 1,
      },
      SCHEDULE_ID,
      DOG_ID
    );

    // now 2026-09-10T20:00Z = 17:00 local on 2026-09-10 → same local day.
    const r = evaluateScheduleTemporalStatus(spItem, new Date("2026-09-10T20:00:00Z"));
    expect(r.temporalStatus).toBe("today");
  });
});
