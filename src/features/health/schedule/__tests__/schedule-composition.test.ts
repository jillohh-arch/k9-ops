// @vitest-environment node
/**
 * HW-4.WEB-SCHED-RD-I4 — pure Schedule composition contract tests.
 *
 * The load-bearing properties:
 *
 *   1. DST TRIPWIRE   — the SAME composed entry must report
 *      `temporalStatus: "upcoming"` AND `inDisplayWindow: false`. Any code that
 *      derives one 7-day concept from the other fails this immediately.
 *   2. SOURCE STATE   — a view that would render empty must never rewrite a
 *      `partial` / `forbidden` / `error` source into `empty`, nor recompute
 *      coverage.
 *   3. NO FILTERING   — terminal, unavailable-temporal and non-`complete`
 *      quality entries are all annotated and kept.
 *   4. PURITY         — explicit `now`, no mutation, order preserved.
 *
 * Fixtures flow through the FROZEN parser and scope-loader shapes, so these
 * tests exercise the real integration contract rather than hand-built models.
 */
import { describe, expect, it } from "vitest";

import { parseScheduleItemWireDoc } from "../parser";
import type { ScheduleItemReadModel } from "../types";
// TYPE-ONLY import: the scope loader transitively imports the Firebase client,
// so importing any VALUE from it here would force an SDK stub and destroy the
// purity proof at the bottom of this file. Types are erased at compile time.
import type {
  ScheduleListEntry,
  ScheduleScopeCoverage,
  ScheduleScopeResult,
} from "../data/schedule-scope-loader";
import {
  composeScheduleEntry,
  composeScheduleScope,
  type ComposedScheduleEntry,
} from "../composition/schedule-composition";

const ts = (iso: string) => ({ toMillis: () => new Date(iso).getTime() });

function wire(dogId: string, overrides: Record<string, unknown> = {}) {
  return {
    dog_id: dogId,
    schedule_type: "vaccination",
    title: "Reforço V10",
    scheduled_for: ts("2026-09-10T13:00:00Z"),
    timezone: "UTC",
    lifecycle_status: "open",
    source_type: "preventive",
    created_at: ts("2026-08-20T10:00:00Z"),
    recorded_by: { uid: "u1", name: "Cond. Silva", internal_role: "condutor" },
    revision: 1,
    schema_version: 1,
    ...overrides,
  };
}

function itemOf(
  dogId: string,
  scheduleId: string,
  overrides: Record<string, unknown> = {}
): ScheduleItemReadModel {
  return parseScheduleItemWireDoc(wire(dogId, overrides), scheduleId, dogId);
}

/**
 * Local composite-key builder, mirroring the frozen RD-I3 format.
 *
 * Deliberately NOT imported from the scope loader: that module pulls in the
 * Firebase client. The key is non-authoritative (never parsed, never used for
 * authorization), so reproducing the format in a fixture is safe.
 */
function entryIdOf(dogId: string, scheduleId: string): string {
  return `${dogId}:${scheduleId}`;
}

function entryOf(
  dogId: string,
  scheduleId: string,
  overrides: Record<string, unknown> = {}
): ScheduleListEntry {
  return {
    entryId: entryIdOf(dogId, scheduleId),
    dogId,
    scheduleId,
    dog: { id: dogId, name: `Dog ${dogId}` } as ScheduleListEntry["dog"],
    item: itemOf(dogId, scheduleId, overrides),
  };
}

const COVERAGE: ScheduleScopeCoverage = {
  dogsInScope: 1,
  authorizedDogIds: ["k9-a"],
  forbiddenDogIds: [],
  failedDogIds: [],
  partialEntryIds: [],
  complete: true,
};

function coverage(overrides: Partial<ScheduleScopeCoverage> = {}): ScheduleScopeCoverage {
  return { ...COVERAGE, ...overrides };
}

function successScope(
  entries: ScheduleListEntry[],
  cov: ScheduleScopeCoverage = coverage()
): ScheduleScopeResult {
  return {
    state: { status: "success", data: entries, fetchedAt: new Date("2026-09-01T00:00:00Z") },
    coverage: cov,
  };
}

const NOW = new Date("2026-09-10T12:00:00Z");

describe("explicit now", () => {
  it("requires now as a parameter — no optional overload", () => {
    expect(composeScheduleScope).toHaveLength(2);
    expect(composeScheduleEntry).toHaveLength(2);
  });

  it("uses the supplied now, not the wall clock", () => {
    const entry = entryOf("k9-a", "s1");

    // Far-future now: the item is long past its deadline.
    const past = composeScheduleEntry(entry, new Date("2027-01-01T00:00:00Z"));
    expect(past.temporal.temporalStatus).toBe("overdue");

    // Far-past now: the item is outside the rolling window entirely.
    const future = composeScheduleEntry(entry, new Date("2026-01-01T00:00:00Z"));
    expect(future.temporal.temporalStatus).toBe("scheduled");
  });

  it("applies ONE now across every entry in a call", () => {
    // Both items share an instant; a per-entry clock could classify them apart.
    const entries = [entryOf("k9-a", "s1"), entryOf("k9-b", "s2")];
    const { state } = composeScheduleScope(successScope(entries), NOW);

    if (state.status === "success") {
      const statuses = state.data.map((c) => c.temporal.temporalStatus);
      expect(new Set(statuses).size).toBe(1);
      expect(statuses[0]).toBe("today");
    }
  });

  it("preserves RD-I2's own invalid-now handling instead of throwing", () => {
    const entry = entryOf("k9-a", "s1");
    const composed = composeScheduleEntry(entry, new Date("not-a-date"));

    expect(composed.temporal.temporalStatus).toBeNull();
    expect(composed.temporal.temporalAvailability).toBe("invalid_schedule_temporal_input");
    expect(composed.displayWindow.inDisplayWindow).toBeNull();
    expect(composed.entry).toBe(entry);
  });
});

describe("MANDATORY DST tripwire — the two 7-day concepts must not collapse", () => {
  /**
   * now       2026-03-02T04:30Z = 2026-03-01 23:30 EST  (local date 03-01)
   * scheduled 2026-03-08T07:15Z = 2026-03-08 03:15 EDT  (local date 03-08)
   *
   *   elapsed      146.75 h  <  168 h  → canonical `upcoming`
   *   local offset D+7       >  D+6    → NOT in the display window
   */
  const TZ = "America/New_York";
  const DST_NOW = new Date("2026-03-02T04:30:00.000Z");
  const SCHEDULED = "2026-03-08T07:15:00.000Z";

  function dstEntry(): ScheduleListEntry {
    return entryOf("k9-a", "s-dst", {
      timezone: TZ,
      scheduled_for: ts(SCHEDULED),
      created_at: ts("2026-02-01T10:00:00Z"),
    });
  }

  it("carries BOTH facts on the same composed entry", () => {
    const composed = composeScheduleEntry(dstEntry(), DST_NOW);

    // Canonical badge: inside the rolling 168h window.
    expect(composed.temporal.temporalStatus).toBe("upcoming");
    expect(composed.temporal.temporalAvailability).toBe("available");

    // Section membership: seven CIVIL days away, so outside D0…D+6.
    expect(composed.displayWindow.offsetDays).toBe(7);
    expect(composed.displayWindow.inDisplayWindow).toBe(false);
    expect(composed.displayWindow.availability).toBe("available");
  });

  it("proves the divergence explicitly", () => {
    const composed = composeScheduleEntry(dstEntry(), DST_NOW);

    const upcoming = composed.temporal.temporalStatus === "upcoming";
    const inWindow = composed.displayWindow.inDisplayWindow === true;

    // If either dimension were derived from the other, these would agree.
    expect(upcoming).toBe(true);
    expect(inWindow).toBe(false);
    expect(upcoming).not.toBe(inWindow);
  });

  it("survives composition through the full scope path", () => {
    const { state } = composeScheduleScope(successScope([dstEntry()]), DST_NOW);

    if (state.status === "success") {
      const [composed] = state.data;
      expect(composed.temporal.temporalStatus).toBe("upcoming");
      expect(composed.displayWindow.inDisplayWindow).toBe(false);
    }
  });

  it("confirms the fixture is genuinely inside the rolling window", () => {
    const elapsedH = (new Date(SCHEDULED).getTime() - DST_NOW.getTime()) / 3_600_000;
    expect(elapsedH).toBeCloseTo(146.75, 2);
    expect(elapsedH).toBeLessThan(168);
  });
});

describe("terminal items are annotated, never filtered", () => {
  it("keeps a completed item scheduled tomorrow with inDisplayWindow true", () => {
    const entry = entryOf("k9-a", "s-done", {
      lifecycle_status: "completed",
      scheduled_for: ts("2026-09-11T13:00:00Z"), // D+1 relative to NOW
    });

    const composed = composeScheduleEntry(entry, NOW);

    // Both dimensions coexist: terminal badge AND civil-window membership.
    expect(composed.temporal.temporalStatus).toBe("completed");
    expect(composed.displayWindow.inDisplayWindow).toBe(true);
    expect(composed.displayWindow.offsetDays).toBe(1);
  });

  it("keeps a cancelled item inside the window", () => {
    const entry = entryOf("k9-a", "s-cancel", {
      lifecycle_status: "cancelled",
      scheduled_for: ts("2026-09-12T13:00:00Z"),
    });

    const composed = composeScheduleEntry(entry, NOW);

    expect(composed.temporal.temporalStatus).toBe("cancelled");
    expect(composed.displayWindow.inDisplayWindow).toBe(true);
  });

  it("does not implement the future page terminal exclusion", () => {
    const entries = [
      entryOf("k9-a", "s-open", { scheduled_for: ts("2026-09-11T13:00:00Z") }),
      entryOf("k9-a", "s-done", {
        lifecycle_status: "completed",
        scheduled_for: ts("2026-09-11T13:00:00Z"),
      }),
    ];

    const { state } = composeScheduleScope(successScope(entries), NOW);

    // Composition annotates only; filtering terminal items is page policy.
    if (state.status === "success") {
      expect(state.data).toHaveLength(2);
      expect(state.data.every((c) => c.displayWindow.inDisplayWindow === true)).toBe(true);
    }
  });
});

describe("temporal unavailability is preserved", () => {
  it("dose without due_until stays incomplete with no fabricated deadline", () => {
    const entry = entryOf("k9-a", "s-dose", {
      schedule_type: "dose",
      due_until: undefined,
    });

    const composed = composeScheduleEntry(entry, NOW);

    expect(composed.temporal.temporalAvailability).toBe(
      "incomplete_schedule_temporal_config"
    );
    expect(composed.temporal.temporalStatus).toBeNull();
    expect(composed.temporal.effectiveDueUntil).toBeNull();
    // The record itself remains fully present.
    expect(composed.entry.item.scheduleType).toBe("dose");
  });

  it("keeps a dose entry in the composed collection", () => {
    const entries = [entryOf("k9-a", "s-dose", { schedule_type: "dose", due_until: undefined })];
    const { state } = composeScheduleScope(successScope(entries), NOW);

    if (state.status === "success") {
      expect(state.data).toHaveLength(1);
      expect(state.data[0].temporal.temporalStatus).toBeNull();
    }
  });

  it("preserves invalid temporal input without dropping the entry", () => {
    const entry = entryOf("k9-a", "s-bad-tz", { timezone: "Mars/Olympus" });

    const composed = composeScheduleEntry(entry, NOW);

    expect(composed.temporal.temporalAvailability).toBe("invalid_schedule_temporal_input");
    expect(composed.entry.scheduleId).toBe("s-bad-tz");
  });

  it("preserves arithmetic overflow as its own availability", () => {
    const MAX_DATE_MS = 8_640_000_000_000_000;
    const entry = entryOf("k9-a", "s-overflow", {
      scheduled_for: { toMillis: () => MAX_DATE_MS },
      due_until: undefined,
    });

    const composed = composeScheduleEntry(entry, new Date(0));

    expect(composed.temporal.temporalAvailability).toBe("temporal_arithmetic_overflow");
    expect(composed.temporal.temporalStatus).toBeNull();
  });
});

describe("display availability is never collapsed", () => {
  it("keeps null membership distinct from false", () => {
    const undeterminable = composeScheduleEntry(
      entryOf("k9-a", "s-bad-tz", { timezone: "Mars/Olympus" }),
      NOW
    );
    const outsideWindow = composeScheduleEntry(
      entryOf("k9-a", "s-far", { scheduled_for: ts("2026-12-01T13:00:00Z") }),
      NOW
    );

    // "cannot determine" must not become "definitely outside".
    expect(undeterminable.displayWindow.inDisplayWindow).toBeNull();
    expect(undeterminable.displayWindow.offsetDays).toBeNull();
    expect(undeterminable.displayWindow.availability).toBe("invalid_schedule_temporal_input");

    expect(outsideWindow.displayWindow.inDisplayWindow).toBe(false);
    expect(outsideWindow.displayWindow.availability).toBe("available");
  });

  it("does not coerce null offsetDays to 0", () => {
    const composed = composeScheduleEntry(
      entryOf("k9-a", "s-bad", { scheduled_for: "2026-09-10" }),
      NOW
    );

    expect(composed.displayWindow.offsetDays).not.toBe(0);
    expect(composed.displayWindow.offsetDays).toBeNull();
  });
});

describe("quality items are all composed", () => {
  it.each([
    ["legacy (absent persisted dog_id)", { dog_id: undefined }, "legacy"],
    ["degraded (future schema)", { schema_version: 2 }, "degraded"],
    ["partial (dog_id mismatch)", { dog_id: "other-dog" }, "partial"],
  ])("keeps a %s item and still derives temporal values", (_label, overrides, quality) => {
    const entry = entryOf("k9-a", "s-q", overrides);
    expect(entry.item.dataQuality).toBe(quality);

    const composed = composeScheduleEntry(entry, NOW);

    // No dataQuality gate: RD-I2 decides what is derivable.
    expect(composed.temporal.temporalAvailability).toBe("available");
    expect(composed.temporal.temporalStatus).toBe("today");
    expect(composed.displayWindow.inDisplayWindow).toBe(true);
  });

  it("composes a mixed-quality collection completely", () => {
    const entries = [
      entryOf("k9-a", "s1"),
      entryOf("k9-a", "s2", { dog_id: undefined }),
      entryOf("k9-a", "s3", { schema_version: 2 }),
      entryOf("k9-a", "s4", { dog_id: "other" }),
    ];

    const { state } = composeScheduleScope(successScope(entries), NOW);

    if (state.status === "success") {
      expect(state.data).toHaveLength(4);
    }
  });
});

describe("source ReadState preservation", () => {
  it("success stays success with composed data", () => {
    const { state } = composeScheduleScope(successScope([entryOf("k9-a", "s1")]), NOW);

    expect(state.status).toBe("success");
    if (state.status === "success") {
      expect(state.data).toHaveLength(1);
      expect(state.data[0].temporal).toBeDefined();
      expect(state.data[0].displayWindow).toBeDefined();
    }
  });

  it("partial stays partial and keeps its source lists", () => {
    const scope: ScheduleScopeResult = {
      state: {
        status: "partial",
        partialData: [entryOf("k9-a", "s1")],
        failedSources: ["dogs/k9-b"],
        successfulSources: ["dogs/k9-a"],
      },
      coverage: coverage({ complete: false, forbiddenDogIds: ["k9-b"], dogsInScope: 2 }),
    };

    const { state, coverage: cov } = composeScheduleScope(scope, NOW);

    expect(state.status).toBe("partial");
    if (state.status === "partial") {
      expect(state.partialData).toHaveLength(1);
      expect(state.failedSources).toEqual(["dogs/k9-b"]);
      expect(state.successfulSources).toEqual(["dogs/k9-a"]);
    }
    expect(cov.complete).toBe(false);
    expect(cov.forbiddenDogIds).toEqual(["k9-b"]);
  });

  it("forbidden is preserved verbatim and fabricates no data", () => {
    const scope: ScheduleScopeResult = {
      state: {
        status: "forbidden",
        requiredCapability: "health.read",
        message: "Nenhuma agenda autorizada para o perfil de acesso atual.",
      },
      coverage: coverage({ complete: false, authorizedDogIds: [], forbiddenDogIds: ["k9-a"] }),
    };

    const { state, coverage: cov } = composeScheduleScope(scope, NOW);

    expect(state.status).toBe("forbidden");
    if (state.status === "forbidden") {
      expect(state.requiredCapability).toBe("health.read");
      expect(state.message).toContain("Nenhuma agenda autorizada");
    }
    expect(cov.forbiddenDogIds).toEqual(["k9-a"]);
    expect(cov.complete).toBe(false);
  });

  it("error is preserved with its retryable flag", () => {
    const scope: ScheduleScopeResult = {
      state: {
        status: "error",
        code: "SCHEDULE_SCOPE_NO_AUTHORIZED_READ",
        message: "Falha",
        technicalDetails: "forbidden=1 failed=1 dogsInScope=2",
        retryable: true,
      },
      coverage: coverage({ complete: false, authorizedDogIds: [], failedDogIds: ["k9-b"] }),
    };

    const { state, coverage: cov } = composeScheduleScope(scope, NOW);

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.code).toBe("SCHEDULE_SCOPE_NO_AUTHORIZED_READ");
      expect(state.retryable).toBe(true);
    }
    expect(cov.failedDogIds).toEqual(["k9-b"]);
  });

  it("empty stays empty without a fabricated entry", () => {
    const scope: ScheduleScopeResult = {
      state: { status: "empty", query: "dogs" },
      coverage: coverage({ authorizedDogIds: ["k9-a"] }),
    };

    const { state } = composeScheduleScope(scope, NOW);

    expect(state.status).toBe("empty");
    if (state.status === "empty") {
      expect(state.query).toBe("dogs");
    }
  });

  it("does not throw on a zero-entry success", () => {
    const { state } = composeScheduleScope(successScope([]), NOW);

    expect(state.status).toBe("success");
    if (state.status === "success") {
      expect(state.data).toEqual([]);
    }
  });
});

describe("display emptiness NEVER erases source coverage loss", () => {
  it("keeps partial + incomplete coverage when nothing is in the window", () => {
    // Every entry is far outside D0…D+6, so an operational section would render
    // empty — but the source read was provably incomplete.
    const entries = [
      entryOf("k9-a", "s1", { scheduled_for: ts("2027-01-01T13:00:00Z") }),
      entryOf("k9-a", "s2", { scheduled_for: ts("2027-02-01T13:00:00Z") }),
    ];
    const scope: ScheduleScopeResult = {
      state: {
        status: "partial",
        partialData: entries,
        failedSources: ["dogs/k9-denied"],
        successfulSources: ["dogs/k9-a"],
      },
      coverage: coverage({
        complete: false,
        dogsInScope: 2,
        authorizedDogIds: ["k9-a"],
        forbiddenDogIds: ["k9-denied"],
      }),
    };

    const { state, coverage: cov } = composeScheduleScope(scope, NOW);

    // Not rewritten to `empty`.
    expect(state.status).toBe("partial");
    expect(state.status).not.toBe("empty");
    if (state.status === "partial") {
      expect(state.partialData).toHaveLength(2);
      // Zero display-window membership, yet entries and state survive.
      expect(state.partialData.every((c) => c.displayWindow.inDisplayWindow === false)).toBe(
        true
      );
    }
    expect(cov.complete).toBe(false);
    expect(cov.forbiddenDogIds).toEqual(["k9-denied"]);
  });

  it("keeps coverage loss when every entry has undeterminable membership", () => {
    const entries = [entryOf("k9-a", "s1", { timezone: "Mars/Olympus" })];
    const scope: ScheduleScopeResult = {
      state: {
        status: "partial",
        partialData: entries,
        failedSources: ["dogs/k9-x"],
        successfulSources: ["dogs/k9-a"],
      },
      coverage: coverage({ complete: false, failedDogIds: ["k9-x"] }),
    };

    const { state, coverage: cov } = composeScheduleScope(scope, NOW);

    expect(state.status).toBe("partial");
    expect(cov.complete).toBe(false);
    expect(cov.failedDogIds).toEqual(["k9-x"]);
  });
});

describe("coverage is forwarded unchanged", () => {
  it("returns the identical coverage object", () => {
    const cov = coverage({ complete: false, partialEntryIds: ["k9-a:s1"] });
    const scope = successScope([entryOf("k9-a", "s1")], cov);

    const result = composeScheduleScope(scope, NOW);

    // Same reference: nothing is recomputed.
    expect(result.coverage).toBe(cov);
  });

  it("never recomputes complete from display membership", () => {
    // Complete source coverage, but no entry lands in the window.
    const cov = coverage({ complete: true });
    const scope = successScope(
      [entryOf("k9-a", "s1", { scheduled_for: ts("2027-06-01T13:00:00Z") })],
      cov
    );

    const { state, coverage: out } = composeScheduleScope(scope, NOW);

    expect(out.complete).toBe(true);
    if (state.status === "success") {
      expect(state.data[0].displayWindow.inDisplayWindow).toBe(false);
    }
  });
});

describe("no section grouping", () => {
  it("returns a flat annotated collection with no group arrays", () => {
    const { state, ...rest } = composeScheduleScope(
      successScope([entryOf("k9-a", "s1")]),
      NOW
    );

    expect(Object.keys(rest)).toEqual(["coverage"]);
    if (state.status === "success") {
      const composed = state.data[0] as unknown as Record<string, unknown>;
      expect(Object.keys(composed).sort()).toEqual(["displayWindow", "entry", "temporal"]);
      for (const key of ["nextSevenDays", "today", "overdue", "pending", "completed"]) {
        expect(key in composed).toBe(false);
      }
    }
  });

  it("annotates each entry exactly once", () => {
    const entries = [entryOf("k9-a", "s1"), entryOf("k9-a", "s2"), entryOf("k9-b", "s3")];
    const { state } = composeScheduleScope(successScope(entries), NOW);

    if (state.status === "success") {
      expect(state.data).toHaveLength(3);
      const ids = state.data.map((c) => c.entry.entryId);
      expect(new Set(ids).size).toBe(3);
    }
  });
});

describe("ordering is preserved", () => {
  it("keeps the incoming RD-I3 order exactly", () => {
    // Deliberately NOT in scheduledFor order: composition must not re-sort.
    const entries = [
      entryOf("k9-a", "s-late", { scheduled_for: ts("2026-12-01T13:00:00Z") }),
      entryOf("k9-a", "s-early", { scheduled_for: ts("2026-09-11T13:00:00Z") }),
      entryOf("k9-a", "s-mid", { scheduled_for: ts("2026-10-01T13:00:00Z") }),
    ];

    const { state } = composeScheduleScope(successScope(entries), NOW);

    if (state.status === "success") {
      expect(state.data.map((c) => c.entry.scheduleId)).toEqual([
        "s-late",
        "s-early",
        "s-mid",
      ]);
    }
  });

  it("does not reorder by temporal status or window membership", () => {
    const entries = [
      entryOf("k9-a", "s-out", { scheduled_for: ts("2027-01-01T13:00:00Z") }),
      entryOf("k9-a", "s-in", { scheduled_for: ts("2026-09-11T13:00:00Z") }),
    ];

    const { state } = composeScheduleScope(successScope(entries), NOW);

    if (state.status === "success") {
      expect(state.data[0].displayWindow.inDisplayWindow).toBe(false);
      expect(state.data[1].displayWindow.inDisplayWindow).toBe(true);
      expect(state.data.map((c) => c.entry.scheduleId)).toEqual(["s-out", "s-in"]);
    }
  });
});

describe("immutability", () => {
  it("does not mutate the input scope, state, coverage or entries", () => {
    const entries = [entryOf("k9-a", "s1"), entryOf("k9-a", "s2")];
    const cov = coverage({ partialEntryIds: ["k9-a:s2"] });
    const scope = successScope(entries, cov);

    const scopeSnapshot = JSON.stringify(scope);
    const entriesRef = entries.slice();

    composeScheduleScope(scope, NOW);

    expect(JSON.stringify(scope)).toBe(scopeSnapshot);
    // Input array identity and membership untouched.
    expect(entries).toEqual(entriesRef);
    expect(cov.partialEntryIds).toEqual(["k9-a:s2"]);
  });

  it("carries the source entry by reference, unmodified", () => {
    const entry = entryOf("k9-a", "s1");
    const itemRef = entry.item;

    const composed = composeScheduleEntry(entry, NOW);

    expect(composed.entry).toBe(entry);
    expect(composed.entry.item).toBe(itemRef);
  });

  it("does not inject derived fields into the item or entry", () => {
    const entry = entryOf("k9-a", "s1");

    composeScheduleEntry(entry, NOW);

    const itemRecord = entry.item as unknown as Record<string, unknown>;
    const entryRecord = entry as unknown as Record<string, unknown>;
    expect("temporalStatus" in itemRecord).toBe(false);
    expect("inDisplayWindow" in itemRecord).toBe(false);
    expect("temporal" in entryRecord).toBe(false);
    expect("displayWindow" in entryRecord).toBe(false);
  });

  it("produces a new state object rather than editing the source", () => {
    const scope = successScope([entryOf("k9-a", "s1")]);
    const sourceState = scope.state;

    const { state } = composeScheduleScope(scope, NOW);

    expect(state).not.toBe(sourceState);
  });
});

describe("composed entry does not duplicate the item", () => {
  it("omits item from the temporal result", () => {
    const composed: ComposedScheduleEntry = composeScheduleEntry(entryOf("k9-a", "s1"), NOW);
    const temporalRecord = composed.temporal as unknown as Record<string, unknown>;

    // `item` lives only at entry.item; RD-I2 returns the same reference.
    expect("item" in temporalRecord).toBe(false);
    expect(Object.keys(composed.temporal).sort()).toEqual([
      "effectiveDueUntil",
      "temporalAvailability",
      "temporalStatus",
    ]);
  });

  it("forwards the frozen display-window shape verbatim", () => {
    const composed = composeScheduleEntry(entryOf("k9-a", "s1"), NOW);

    expect(Object.keys(composed.displayWindow).sort()).toEqual([
      "availability",
      "inDisplayWindow",
      "offsetDays",
    ]);
  });
});

describe("representative temporal wiring", () => {
  // Wiring proof only — the 83 RD-I2 tests already prove the algorithms.
  it.each([
    ["completed", { lifecycle_status: "completed" }, "completed"],
    ["cancelled", { lifecycle_status: "cancelled" }, "cancelled"],
    ["pending (now past scheduled)", { scheduled_for: ts("2026-09-10T06:00:00Z") }, "pending"],
    ["today (same local day, later)", { scheduled_for: ts("2026-09-10T20:00:00Z") }, "today"],
    ["upcoming (within 7d)", { scheduled_for: ts("2026-09-14T13:00:00Z") }, "upcoming"],
    ["scheduled (beyond 7d)", { scheduled_for: ts("2026-12-01T13:00:00Z") }, "scheduled"],
  ])("forwards %s unchanged from RD-I2", (_label, overrides, expected) => {
    const composed = composeScheduleEntry(entryOf("k9-a", "s1", overrides), NOW);
    expect(composed.temporal.temporalStatus).toBe(expected);
  });

  it("forwards overdue with the effective deadline", () => {
    const composed = composeScheduleEntry(
      entryOf("k9-a", "s1", { scheduled_for: ts("2026-09-01T13:00:00Z") }),
      NOW
    );

    expect(composed.temporal.temporalStatus).toBe("overdue");
    expect(composed.temporal.effectiveDueUntil).toBeInstanceOf(Date);
  });

  it.each([
    ["D0", "2026-09-10T23:00:00Z", 0, true],
    ["D+1", "2026-09-11T01:00:00Z", 1, true],
    ["D+6", "2026-09-16T23:00:00Z", 6, true],
    ["D+7", "2026-09-17T01:00:00Z", 7, false],
    ["D-1", "2026-09-09T23:00:00Z", -1, false],
  ])("forwards display membership %s unchanged", (_label, iso, offset, inWindow) => {
    const composed = composeScheduleEntry(
      entryOf("k9-a", "s1", { scheduled_for: ts(iso) }),
      NOW
    );

    expect(composed.displayWindow.offsetDays).toBe(offset);
    expect(composed.displayWindow.inDisplayWindow).toBe(inWindow);
  });
});

describe("no Firestore or React coupling", () => {
  it("composes without any client or SDK stub present", () => {
    // This suite intentionally mocks nothing: if the composition module reached
    // for `firebase/firestore` or `@/lib/firebase/client`, importing it here
    // would initialize the real SDK and this test would not be reachable.
    const composed = composeScheduleEntry(entryOf("k9-a", "s1"), NOW);
    expect(composed.entry.scheduleId).toBe("s1");
  });
});
