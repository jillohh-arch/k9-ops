/**
 * HW-4.WEB-SCHED-RD-I5 — useSchedule orchestration: authority gating, race
 * safety, and clock discipline.
 *
 * The load-bearing contracts, each an observable-behaviour killer rather than a
 * shape assertion:
 *
 *   NO UNAUTHORIZED READ — while authority is loading or forbidden, the scope
 *   loader is NEVER called. Proven by call count, not by rendered state.
 *
 *   ALLOWED A vs ALLOWED B — a superseded allowed cycle cannot overwrite the
 *   current one, even when it resolves LAST. This exceeds Clinical precedent.
 *
 *   AUTHORITY REVOCATION — a read started while allowed cannot surface after
 *   authority becomes forbidden. Security-relevant UI timing.
 *
 *   NOW AT RESOLUTION — `now` is captured when the scope result resolves, not
 *   when the request starts, and stays fixed for that cycle across re-renders.
 *
 * The real frozen `composeScheduleScope` is used (never mocked), so these tests
 * also prove the reader-to-composition wiring.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockAccess = {
  profile: { status?: string; permissions?: Record<string, unknown> };
  status: "fallback" | "loading" | "ready";
};

const accessState = vi.hoisted(() => ({ current: null as MockAccess | null }));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => accessState.current,
}));

vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
  firebaseApp: {},
}));

// The scope loader has its own suite. Here it is stubbed so the hook's gating,
// race behaviour and clock discipline are what is under test — including the
// assertion that it is NEVER CALLED while unauthorized.
const loaderMock = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../data/schedule-scope-loader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/schedule-scope-loader")>();
  return { ...actual, loadScheduleScope: () => loaderMock.load() };
});

import type { ReadState } from "../../domain/read-states";
import { parseScheduleItemWireDoc } from "../parser";
import type {
  ScheduleListEntry,
  ScheduleScopeCoverage,
} from "../data/schedule-scope-loader";
import { useSchedule } from "../hooks/use-schedule";

const ts = (iso: string) => ({ toMillis: () => new Date(iso).getTime() });

function coverage(overrides: Partial<ScheduleScopeCoverage> = {}): ScheduleScopeCoverage {
  return {
    dogsInScope: 1,
    authorizedDogIds: ["k9-a"],
    forbiddenDogIds: [],
    failedDogIds: [],
    partialEntryIds: [],
    complete: true,
    ...overrides,
  };
}

/** A real parsed entry, so composition operates on genuine read models. */
function entry(scheduleId: string, scheduledForIso = "2026-09-10T13:00:00Z"): ScheduleListEntry {
  return {
    entryId: `k9-a:${scheduleId}`,
    dogId: "k9-a",
    scheduleId,
    dog: { id: "k9-a", name: "Apollo" } as ScheduleListEntry["dog"],
    item: parseScheduleItemWireDoc(
      {
        dog_id: "k9-a",
        schedule_type: "vaccination",
        title: "Reforço V10",
        scheduled_for: ts(scheduledForIso),
        timezone: "UTC",
        lifecycle_status: "open",
        source_type: "preventive",
        created_at: ts("2026-08-20T10:00:00Z"),
        recorded_by: { uid: "u1", name: "Cond. Silva", internal_role: "condutor" },
        revision: 1,
        schema_version: 1,
      },
      scheduleId,
      "k9-a"
    ),
  };
}

function resolveWith(
  state: ReadState<ScheduleListEntry[]>,
  cov: ScheduleScopeCoverage = coverage()
) {
  loaderMock.load.mockResolvedValue({ state, coverage: cov });
}

/** A loader promise the test releases by hand, for deterministic races. */
function deferLoader(): (value: unknown) => void {
  let release: (value: unknown) => void = () => {};
  loaderMock.load.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    })
  );
  return (value: unknown) => release(value);
}

const allowedAccess: MockAccess = {
  status: "ready",
  profile: { status: "active", permissions: { health: { read: true } } },
};

const loadingAccess: MockAccess = {
  status: "loading",
  profile: { status: "active", permissions: { health: { read: true } } },
};

const legacyViewOnlyAccess: MockAccess = {
  status: "ready",
  profile: { status: "active", permissions: { health: { view: true } } },
};

beforeEach(() => {
  loaderMock.load.mockReset();
  accessState.current = allowedAccess;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("no unauthorized read", () => {
  it("1. authority loading -> loading state and ZERO reads", async () => {
    accessState.current = loadingAccess;
    resolveWith({ status: "empty", query: "dogs" });

    const { result } = renderHook(() => useSchedule());

    expect(result.current.state.status).toBe("loading");
    expect(result.current.authorityStatus).toBe("loading");
    // The load-bearing assertion: observed by call count.
    expect(loaderMock.load).not.toHaveBeenCalled();
  });

  it("2. health.view without health.read -> forbidden AND ZERO reads", async () => {
    accessState.current = legacyViewOnlyAccess;
    resolveWith({ status: "success", data: [entry("s1")], fetchedAt: new Date() });

    const { result } = renderHook(() => useSchedule());

    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));

    expect(loaderMock.load).not.toHaveBeenCalled();
    expect(result.current.authorityStatus).toBe("forbidden");
    if (result.current.state.status !== "forbidden") throw new Error("expected forbidden");
    expect(result.current.state.requiredCapability).toBe("health.read");
    expect(result.current.state.requiredCapability).not.toBe("health.view");
  });

  it("3. a denial is never presented as emptiness", async () => {
    accessState.current = legacyViewOnlyAccess;

    const { result } = renderHook(() => useSchedule());

    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));
    expect(result.current.state.status).not.toBe("empty");
    expect(result.current.state.status).not.toBe("success");
  });

  it("4. authority loading -> forbidden keeps read count at zero", async () => {
    accessState.current = loadingAccess;
    resolveWith({ status: "success", data: [entry("s1")], fetchedAt: new Date() });

    const { result, rerender } = renderHook(() => useSchedule());
    expect(loaderMock.load).not.toHaveBeenCalled();

    accessState.current = legacyViewOnlyAccess;
    rerender();

    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));
    expect(loaderMock.load).not.toHaveBeenCalled();
  });
});

describe("authority transitions", () => {
  it("5. initial allowed starts the permitted read", async () => {
    resolveWith({ status: "success", data: [entry("s1"), entry("s2")], fetchedAt: new Date() });

    const { result } = renderHook(() => useSchedule());

    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(loaderMock.load).toHaveBeenCalledTimes(1);
    if (result.current.state.status !== "success") throw new Error("expected success");
    expect(result.current.state.data).toHaveLength(2);
  });

  it("6. loading -> allowed reads only AFTER the grant", async () => {
    accessState.current = loadingAccess;
    resolveWith({ status: "success", data: [entry("s1")], fetchedAt: new Date() });

    const { result, rerender } = renderHook(() => useSchedule());
    // Before the transition: provably no read.
    expect(loaderMock.load).not.toHaveBeenCalled();

    accessState.current = allowedAccess;
    rerender();

    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(loaderMock.load).toHaveBeenCalledTimes(1);
  });

  it("7. forbidden -> allowed reads only after the grant", async () => {
    accessState.current = legacyViewOnlyAccess;
    resolveWith({ status: "success", data: [entry("s1")], fetchedAt: new Date() });

    const { result, rerender } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));
    expect(loaderMock.load).not.toHaveBeenCalled();

    accessState.current = allowedAccess;
    rerender();

    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(loaderMock.load).toHaveBeenCalledTimes(1);
  });

  it("8. allowed -> loading dominates a pending read", async () => {
    const release = deferLoader();

    const { result, rerender } = renderHook(() => useSchedule());
    await waitFor(() => expect(loaderMock.load).toHaveBeenCalledTimes(1));

    accessState.current = loadingAccess;
    rerender();

    expect(result.current.state.status).toBe("loading");

    await act(async () => {
      release({
        state: { status: "success", data: [entry("late")], fetchedAt: new Date() },
        coverage: coverage(),
      });
    });

    // Authority-first ladder: a late allowed result cannot outrank loading.
    expect(result.current.state.status).toBe("loading");
  });
});

describe("KILLER — authority revocation in flight", () => {
  it("9. a read started while allowed never surfaces after revocation", async () => {
    const release = deferLoader();

    const { result, rerender } = renderHook(() => useSchedule());
    await waitFor(() => expect(loaderMock.load).toHaveBeenCalledTimes(1));

    // Authority is revoked while cycle A is still pending.
    accessState.current = legacyViewOnlyAccess;
    rerender();

    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));

    await act(async () => {
      release({
        state: { status: "success", data: [entry("secret")], fetchedAt: new Date() },
        coverage: coverage(),
      });
    });

    // The security invariant: revoked authority wins, data never appears.
    expect(result.current.state.status).toBe("forbidden");
    expect(result.current.authorityStatus).toBe("forbidden");
    expect(JSON.stringify(result.current.state)).not.toContain("secret");
    // The revocation itself must not have triggered a new read.
    expect(loaderMock.load).toHaveBeenCalledTimes(1);
  });
});

describe("KILLER — allowed A vs allowed B", () => {
  it("10. a superseded allowed cycle cannot overwrite the current one", async () => {
    // Cycle A: pending.
    let releaseA: (value: unknown) => void = () => {};
    let releaseB: (value: unknown) => void = () => {};
    loaderMock.load
      .mockReturnValueOnce(new Promise((r) => { releaseA = r; }))
      .mockReturnValueOnce(new Promise((r) => { releaseB = r; }));

    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(loaderMock.load).toHaveBeenCalledTimes(1));

    // refresh() supersedes A with cycle B.
    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(loaderMock.load).toHaveBeenCalledTimes(2));

    // B resolves first and becomes authoritative.
    await act(async () => {
      releaseB({
        state: { status: "success", data: [entry("from-B")], fetchedAt: new Date() },
        coverage: coverage({ dogsInScope: 2 }),
      });
    });

    await waitFor(() => expect(result.current.state.status).toBe("success"));
    if (result.current.state.status !== "success") throw new Error("expected success");
    expect(result.current.state.data[0].entry.scheduleId).toBe("from-B");

    // A resolves LATE. It must be discarded.
    await act(async () => {
      releaseA({
        state: { status: "success", data: [entry("from-A")], fetchedAt: new Date() },
        coverage: coverage({ dogsInScope: 99 }),
      });
    });

    // The killer: identity must still belong to B.
    if (result.current.state.status !== "success") throw new Error("expected success");
    expect(result.current.state.data).toHaveLength(1);
    expect(result.current.state.data[0].entry.scheduleId).toBe("from-B");
    expect(result.current.state.data[0].entry.scheduleId).not.toBe("from-A");
    expect(result.current.coverage.dogsInScope).toBe(2);
    expect(result.current.coverage.dogsInScope).not.toBe(99);
  });
});

describe("KILLER — now captured at scope-result resolution", () => {
  it("11. composition reflects the clock at RESOLUTION, not at request start", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // T0: the item is 4 days out -> `upcoming`, and inside D0…D+6.
    vi.setSystemTime(new Date("2026-09-06T12:00:00Z"));

    const release = deferLoader();

    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(loaderMock.load).toHaveBeenCalledTimes(1));

    // T1: the clock crosses to the scheduled day while the read is in flight.
    vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));

    await act(async () => {
      release({
        state: { status: "success", data: [entry("s1", "2026-09-10T13:00:00Z")], fetchedAt: new Date() },
        coverage: coverage(),
      });
    });

    await waitFor(() => expect(result.current.state.status).toBe("success"));
    if (result.current.state.status !== "success") throw new Error("expected success");

    // T1-derived: same local day, still future -> `today`.
    // An implementation capturing `now` BEFORE the await would say `upcoming`.
    expect(result.current.state.data[0].temporal.temporalStatus).toBe("today");
    expect(result.current.state.data[0].temporal.temporalStatus).not.toBe("upcoming");
    expect(result.current.state.data[0].displayWindow.offsetDays).toBe(0);
  });
});

describe("KILLER — temporal result stable per cycle", () => {
  it("12. advancing the clock without a new cycle does not recompose", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));

    resolveWith({
      status: "success",
      data: [entry("s1", "2026-09-10T13:00:00Z")],
      fetchedAt: new Date(),
    });

    const { result, rerender } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.state.status).toBe("success"));
    if (result.current.state.status !== "success") throw new Error("expected success");
    expect(result.current.state.data[0].temporal.temporalStatus).toBe("today");

    // T2: days later. No refresh, no authority change, no remount.
    vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
    rerender();

    // Bounded temporal staleness is the frozen v1 contract: still T1-derived.
    if (result.current.state.status !== "success") throw new Error("expected success");
    expect(result.current.state.data[0].temporal.temporalStatus).toBe("today");
    expect(result.current.state.data[0].temporal.temporalStatus).not.toBe("overdue");
    // And no read was triggered merely because the clock moved.
    expect(loaderMock.load).toHaveBeenCalledTimes(1);
  });
});

describe("typed loader states pass through composition", () => {
  it("13. success is composed with temporal and display annotations", async () => {
    resolveWith({ status: "success", data: [entry("s1")], fetchedAt: new Date() });

    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.state.status).toBe("success"));

    if (result.current.state.status !== "success") throw new Error("expected success");
    const composed = result.current.state.data[0];
    // Proves reader -> composition wiring, using the REAL composition module.
    expect(composed.entry.scheduleId).toBe("s1");
    expect(composed.temporal).toBeDefined();
    expect(composed.temporal.temporalAvailability).toBeDefined();
    expect(composed.displayWindow).toBeDefined();
    expect(Object.keys(composed).sort()).toEqual(["displayWindow", "entry", "temporal"]);
  });

  it("14. a TRUE empty scope is not reinterpreted", async () => {
    resolveWith({ status: "empty", query: "dogs" }, coverage({ authorizedDogIds: ["k9-a"] }));

    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.state.status).toBe("empty"));

    expect(result.current.state.status).not.toBe("success");
    expect(result.current.coverage.complete).toBe(true);
  });

  it("15. partial forwards composed entries AND exact coverage", async () => {
    resolveWith(
      {
        status: "partial",
        partialData: [entry("s1")],
        failedSources: ["dogs/k9-b"],
        successfulSources: ["dogs/k9-a"],
      },
      coverage({ complete: false, dogsInScope: 2, forbiddenDogIds: ["k9-b"] })
    );

    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.state.status).toBe("partial"));

    if (result.current.state.status !== "partial") throw new Error("expected partial");
    expect(result.current.state.partialData).toHaveLength(1);
    expect(result.current.state.partialData[0].temporal).toBeDefined();
    expect(result.current.state.failedSources).toEqual(["dogs/k9-b"]);
    // Coverage forwarded verbatim — never recomputed from display membership.
    expect(result.current.coverage.complete).toBe(false);
    expect(result.current.coverage.forbiddenDogIds).toEqual(["k9-b"]);
    expect(result.current.coverage.dogsInScope).toBe(2);
  });

  it("16. a scope-level forbidden is forwarded with authorityStatus allowed", async () => {
    resolveWith(
      {
        status: "forbidden",
        requiredCapability: "health.read",
        message: "Nenhuma agenda autorizada para o perfil de acesso atual.",
      },
      coverage({ complete: false, authorizedDogIds: [], forbiddenDogIds: ["k9-a"] })
    );

    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));

    // Origin is recoverable WITHOUT a new discriminator:
    // authority allowed + state forbidden => the loader produced the denial.
    expect(result.current.authorityStatus).toBe("allowed");
    expect(loaderMock.load).toHaveBeenCalledTimes(1);
    expect(result.current.coverage.forbiddenDogIds).toEqual(["k9-a"]);
  });

  it("17. a global error state is forwarded with its retryable flag", async () => {
    resolveWith(
      {
        status: "error",
        code: "SCHEDULE_SCOPE_NO_AUTHORIZED_READ",
        message: "Falha",
        technicalDetails: "forbidden=1 failed=1 dogsInScope=2",
        retryable: true,
      },
      coverage({ complete: false, authorizedDogIds: [], failedDogIds: ["k9-b"] })
    );

    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.state.status).toBe("error"));

    if (result.current.state.status !== "error") throw new Error("expected error");
    expect(result.current.state.code).toBe("SCHEDULE_SCOPE_NO_AUTHORIZED_READ");
    expect(result.current.state.retryable).toBe(true);
    expect(result.current.coverage.failedDogIds).toEqual(["k9-b"]);
  });

  it("18. an unexpected loader rejection becomes a controlled retryable error", async () => {
    loaderMock.load.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.state.status).toBe("error"));

    if (result.current.state.status !== "error") throw new Error("expected error");
    expect(result.current.state.code).toBe("SCHEDULE_SCOPE_UNEXPECTED_ERROR");
    expect(result.current.state.retryable).toBe(true);
    expect(result.current.coverage.complete).toBe(false);
  });
});

describe("refresh", () => {
  it("19. refresh() re-reads and keeps the previous composed list visible", async () => {
    resolveWith({ status: "success", data: [entry("s1")], fetchedAt: new Date() });

    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.state.status).toBe("success"));

    // Next cycle stays pending so `refreshing` is observable.
    const release = deferLoader();

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.state.status).toBe("refreshing"));
    // Narrow a LOCAL binding rather than `result.current.state`: narrowing the
    // latter persists for the rest of the block and would hide the post-`act`
    // transition asserted below.
    const refreshingState = result.current.state;
    if (refreshingState.status !== "refreshing") throw new Error("expected refreshing");
    // previousData is ALREADY ComposedScheduleEntry[] — no downgrade to RD-I3.
    const previous = refreshingState.previousData as Array<{
      entry: { scheduleId: string };
      temporal: unknown;
      displayWindow: unknown;
    }>;
    expect(previous).toHaveLength(1);
    expect(previous[0].entry.scheduleId).toBe("s1");
    expect(previous[0].temporal).toBeDefined();
    expect(previous[0].displayWindow).toBeDefined();

    await act(async () => {
      release({
        state: { status: "success", data: [entry("s2")], fetchedAt: new Date() },
        coverage: coverage(),
      });
    });

    await waitFor(() => expect(result.current.state.status).toBe("success"));
    // Fresh binding: the `refreshing` guard above narrowed `result.current.state`
    // for the rest of the block, and TS cannot see that `result.current` changed.
    const settled = result.current.state;
    if (settled.status !== "success") throw new Error("expected success");
    expect(settled.data[0].entry.scheduleId).toBe("s2");
    expect(loaderMock.load).toHaveBeenCalledTimes(2);
  });

  it("20. refresh() while forbidden performs ZERO reads", async () => {
    accessState.current = legacyViewOnlyAccess;

    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));

    await act(async () => {
      result.current.refresh();
    });

    // refresh is never an authority escape.
    expect(loaderMock.load).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("forbidden");
  });

  it("21. refresh() while authority is loading performs ZERO reads", async () => {
    accessState.current = loadingAccess;

    const { result } = renderHook(() => useSchedule());
    expect(loaderMock.load).not.toHaveBeenCalled();

    await act(async () => {
      result.current.refresh();
    });

    expect(loaderMock.load).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("loading");
  });
});

describe("coverage", () => {
  it("22. coverage is safe to read in every state and empty until known", async () => {
    accessState.current = legacyViewOnlyAccess;

    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));

    // Not-yet-known coverage, NOT "provably complete and empty".
    expect(result.current.coverage).toBeDefined();
    expect(result.current.coverage.complete).toBe(false);
    expect(result.current.coverage.dogsInScope).toBe(0);
    expect(result.current.coverage.authorizedDogIds).toEqual([]);
  });

  it("23. coverage while authority is loading is empty and complete false", () => {
    accessState.current = loadingAccess;

    const { result } = renderHook(() => useSchedule());

    expect(result.current.coverage.complete).toBe(false);
    expect(result.current.coverage.partialEntryIds).toEqual([]);
  });
});

describe("unmount safety", () => {
  it("24. a read resolving after unmount does not publish", async () => {
    const release = deferLoader();

    const { result, unmount } = renderHook(() => useSchedule());
    await waitFor(() => expect(loaderMock.load).toHaveBeenCalledTimes(1));

    unmount();

    await act(async () => {
      release({
        state: { status: "success", data: [entry("late")], fetchedAt: new Date() },
        coverage: coverage(),
      });
    });

    expect(result.current.state.status).not.toBe("success");
  });
});
