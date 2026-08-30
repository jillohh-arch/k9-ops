// @vitest-environment node
/**
 * HW-4.WEB-SCHED-RD-I3 — Schedule scope loader contract tests.
 *
 * The three load-bearing properties, each the set-shaped analogue of the
 * boundary defects found in the parser and temporal slices:
 *
 *   1. KNOWN TOTAL      — entries.length equals a total known INDEPENDENTLY of
 *      the code under test (7 + 3 = 10), not merely "non-empty".
 *   2. ERROR ISOLATION  — one dog's denial or failure never erases another dog's
 *      results, and attribution is exact per K9.
 *   3. ORDER INDEPENDENCE — the deterministic order is produced by the sort
 *      contract, not by mock insertion order.
 *
 * No network, no emulator, no clock dependence.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({
  db: { __mockDb: true },
  auth: {},
  storage: {},
  functions: {},
  firebaseApp: {},
}));

interface MockDoc {
  id: string;
  data: () => Record<string, unknown>;
}

interface MockSnapshot {
  empty: boolean;
  size: number;
  docs: MockDoc[];
}

/** Per-path scripted outcomes: either a snapshot or an error to throw. */
const mockState: {
  collectionCalls: string[][];
  collectionGroupCalls: string[];
  /** keyed by joined path, e.g. "dogs" or "dogs/k9-a/health_schedule" */
  snapshots: Map<string, MockSnapshot>;
  errors: Map<string, unknown>;
} = {
  collectionCalls: [],
  collectionGroupCalls: [],
  snapshots: new Map(),
  errors: new Map(),
};

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => {
    mockState.collectionCalls.push(segments);
    return { __path: segments.join("/") };
  }),
  collectionGroup: vi.fn((_db: unknown, id: string) => {
    mockState.collectionGroupCalls.push(id);
    return { __collectionGroup: id };
  }),
  getDocs: vi.fn(async (ref: { __path: string }) => {
    const path = ref.__path;
    if (mockState.errors.has(path)) throw mockState.errors.get(path);
    const snap = mockState.snapshots.get(path);
    if (!snap) return { empty: true, size: 0, docs: [] };
    return snap;
  }),
  query: vi.fn((ref: unknown) => ref),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ __path: segments.join("/") })),
  getDoc: vi.fn(),
}));

import { collectionGroup } from "firebase/firestore";
import {
  loadScheduleScope,
  scheduleEntryId,
  sortScheduleListEntries,
  type ScheduleListEntry,
} from "../data/schedule-scope-loader";
import type { ScheduleItemReadModel } from "../types";

const ts = (iso: string) => ({ toMillis: () => new Date(iso).getTime() });

function completeWire(
  dogId: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    dog_id: dogId,
    schedule_type: "vaccination",
    title: "Reforço V10",
    scheduled_for: ts("2026-09-10T13:00:00Z"),
    timezone: "America/Sao_Paulo",
    lifecycle_status: "open",
    source_type: "preventive",
    created_at: ts("2026-08-20T10:00:00Z"),
    recorded_by: { uid: "u1", name: "Cond. Silva", internal_role: "condutor" },
    revision: 1,
    schema_version: 1,
    ...overrides,
  };
}

function snapshotOf(docs: Array<[string, Record<string, unknown>]>): MockSnapshot {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map(([id, data]) => ({ id, data: () => data })),
  };
}

/** Registers the institutional catalog. */
function setCatalog(dogIds: string[]) {
  mockState.snapshots.set(
    "dogs",
    snapshotOf(dogIds.map((id) => [id, { name: `Dog ${id}` }]))
  );
}

function setDogSchedule(dogId: string, docs: Array<[string, Record<string, unknown>]>) {
  mockState.snapshots.set(`dogs/${dogId}/health_schedule`, snapshotOf(docs));
}

function setDogError(dogId: string, error: unknown) {
  mockState.errors.set(`dogs/${dogId}/health_schedule`, error);
}

/** N canonical documents for a dog, with distinct ids. */
function nDocs(dogId: string, n: number): Array<[string, Record<string, unknown>]> {
  return Array.from({ length: n }, (_, i) => [
    `${dogId}-s${i + 1}`,
    completeWire(dogId, { title: `Item ${i + 1}` }),
  ]);
}

const DENIED = { code: "permission-denied", message: "denied" };

beforeEach(() => {
  mockState.collectionCalls = [];
  mockState.collectionGroupCalls = [];
  mockState.snapshots = new Map();
  mockState.errors = new Map();
  vi.clearAllMocks();
});

describe("known total", () => {
  it("returns exactly 7 + 3 = 10 entries with exact attribution", async () => {
    setCatalog(["k9-a", "k9-b", "k9-c"]);
    setDogSchedule("k9-a", nDocs("k9-a", 7));
    setDogSchedule("k9-b", nDocs("k9-b", 3));
    setDogError("k9-c", DENIED);

    const { state, coverage } = await loadScheduleScope();

    // Total known independently of the implementation.
    expect(state.status).toBe("partial");
    if (state.status === "partial") {
      expect(state.partialData).toHaveLength(10);
    }

    expect(coverage.dogsInScope).toBe(3);
    expect(coverage.authorizedDogIds).toEqual(["k9-a", "k9-b"]);
    expect(coverage.forbiddenDogIds).toEqual(["k9-c"]);
    expect(coverage.failedDogIds).toEqual([]);
    expect(coverage.partialEntryIds).toEqual([]);
    expect(coverage.complete).toBe(false);
  });

  it("accounts for every raw document per dog", async () => {
    setCatalog(["k9-a", "k9-b"]);
    setDogSchedule("k9-a", nDocs("k9-a", 7));
    setDogSchedule("k9-b", nDocs("k9-b", 3));

    const { state } = await loadScheduleScope();

    expect(state.status).toBe("success");
    if (state.status === "success") {
      expect(state.data).toHaveLength(10);
      expect(state.data.filter((e) => e.dogId === "k9-a")).toHaveLength(7);
      expect(state.data.filter((e) => e.dogId === "k9-b")).toHaveLength(3);
    }
  });

  it("never uses collectionGroup", async () => {
    setCatalog(["k9-a"]);
    setDogSchedule("k9-a", nDocs("k9-a", 2));

    await loadScheduleScope();

    expect(mockState.collectionGroupCalls).toEqual([]);
    expect(collectionGroup).not.toHaveBeenCalled();
  });

  it("reads the catalog once and each dog once", async () => {
    setCatalog(["k9-a", "k9-b"]);
    setDogSchedule("k9-a", nDocs("k9-a", 1));
    setDogSchedule("k9-b", nDocs("k9-b", 1));

    await loadScheduleScope();

    const paths = mockState.collectionCalls.map((s) => s.join("/"));
    expect(paths.filter((p) => p === "dogs")).toHaveLength(1);
    expect(paths.filter((p) => p === "dogs/k9-a/health_schedule")).toHaveLength(1);
    expect(paths.filter((p) => p === "dogs/k9-b/health_schedule")).toHaveLength(1);
  });
});

describe("empty vs denied vs failed — no collapse", () => {
  it("keeps the three outcomes distinct and exactly attributed", async () => {
    setCatalog(["k9-a", "k9-b", "k9-c"]);
    setDogSchedule("k9-a", []); // successful zero-document read
    setDogError("k9-b", DENIED); // permission denied
    setDogError("k9-c", new Error("unavailable")); // technical failure

    const { coverage } = await loadScheduleScope();

    expect(coverage.authorizedDogIds).toEqual(["k9-a"]);
    expect(coverage.forbiddenDogIds).toEqual(["k9-b"]);
    expect(coverage.failedDogIds).toEqual(["k9-c"]);

    // Each dog appears in exactly one bucket.
    expect(coverage.forbiddenDogIds).not.toContain("k9-a");
    expect(coverage.failedDogIds).not.toContain("k9-b");
    expect(coverage.authorizedDogIds).not.toContain("k9-c");
    expect(coverage.complete).toBe(false);
  });

  it("a successful empty dog does NOT reduce completeness", async () => {
    setCatalog(["k9-a", "k9-b"]);
    setDogSchedule("k9-a", []);
    setDogSchedule("k9-b", []);

    const { state, coverage } = await loadScheduleScope();

    expect(state.status).toBe("empty");
    expect(coverage.authorizedDogIds).toEqual(["k9-a", "k9-b"]);
    expect(coverage.forbiddenDogIds).toEqual([]);
    expect(coverage.failedDogIds).toEqual([]);
    expect(coverage.partialEntryIds).toEqual([]);
    expect(coverage.complete).toBe(true);
  });

  it("all dogs denied yields global forbidden, never empty", async () => {
    setCatalog(["k9-a", "k9-b"]);
    setDogError("k9-a", DENIED);
    setDogError("k9-b", DENIED);

    const { state, coverage } = await loadScheduleScope();

    expect(state.status).toBe("forbidden");
    expect(state.status).not.toBe("empty");
    expect(coverage.forbiddenDogIds).toEqual(["k9-a", "k9-b"]);
    expect(coverage.complete).toBe(false);
  });

  it("no authorized read with a technical failure yields error", async () => {
    setCatalog(["k9-a", "k9-b"]);
    setDogError("k9-a", DENIED);
    setDogError("k9-b", new Error("boom"));

    const { state, coverage } = await loadScheduleScope();

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.code).toBe("SCHEDULE_SCOPE_NO_AUTHORIZED_READ");
      expect(state.retryable).toBe(true);
      // Diagnostics are counts only — no raw Firebase messages, no K9 names.
      expect(state.technicalDetails).toContain("forbidden=1");
      expect(state.technicalDetails).toContain("failed=1");
      expect(state.technicalDetails).not.toContain("boom");
    }
    expect(coverage.forbiddenDogIds).toEqual(["k9-a"]);
    expect(coverage.failedDogIds).toEqual(["k9-b"]);
  });

  it("coverage is present even when the global state is forbidden", async () => {
    setCatalog(["k9-a"]);
    setDogError("k9-a", DENIED);

    const { coverage } = await loadScheduleScope();

    expect(coverage).toBeDefined();
    expect(coverage.dogsInScope).toBe(1);
  });
});

describe("error isolation", () => {
  it("one denied dog does not erase successful dogs", async () => {
    setCatalog(["k9-a", "k9-denied", "k9-b"]);
    setDogSchedule("k9-a", nDocs("k9-a", 4));
    setDogError("k9-denied", DENIED);
    setDogSchedule("k9-b", nDocs("k9-b", 2));

    const { state, coverage } = await loadScheduleScope();

    if (state.status === "partial") {
      expect(state.partialData).toHaveLength(6);
    }
    expect(coverage.authorizedDogIds).toEqual(["k9-a", "k9-b"]);
    expect(coverage.forbiddenDogIds).toEqual(["k9-denied"]);
  });

  it("one failed dog does not erase successful dogs", async () => {
    setCatalog(["k9-a", "k9-failed"]);
    setDogSchedule("k9-a", nDocs("k9-a", 5));
    setDogError("k9-failed", new Error("transport"));

    const { state, coverage } = await loadScheduleScope();

    if (state.status === "partial") {
      expect(state.partialData).toHaveLength(5);
    }
    expect(coverage.authorizedDogIds).toEqual(["k9-a"]);
    expect(coverage.failedDogIds).toEqual(["k9-failed"]);
  });

  it("two simultaneous failures stay attributable to exact ids", async () => {
    setCatalog(["k9-a", "k9-x", "k9-y"]);
    setDogSchedule("k9-a", nDocs("k9-a", 1));
    setDogError("k9-x", DENIED);
    setDogError("k9-y", new Error("boom"));

    const { coverage } = await loadScheduleScope();

    expect(coverage.forbiddenDogIds).toEqual(["k9-x"]);
    expect(coverage.failedDogIds).toEqual(["k9-y"]);
    expect(coverage.authorizedDogIds).toEqual(["k9-a"]);
  });

  it("observes every fan-out outcome, not just the first failure", async () => {
    setCatalog(["k9-a", "k9-b", "k9-c", "k9-d"]);
    setDogError("k9-a", DENIED);
    setDogError("k9-b", new Error("e1"));
    setDogError("k9-c", DENIED);
    setDogSchedule("k9-d", nDocs("k9-d", 3));

    const { coverage } = await loadScheduleScope();

    expect(coverage.forbiddenDogIds).toEqual(["k9-a", "k9-c"]);
    expect(coverage.failedDogIds).toEqual(["k9-b"]);
    expect(coverage.authorizedDogIds).toEqual(["k9-d"]);
    expect(coverage.dogsInScope).toBe(4);
  });
});

describe("document quality and completeness", () => {
  it("a partial item keeps its dog authorized but makes complete false", async () => {
    setCatalog(["k9-a"]);
    setDogSchedule("k9-a", [
      ["s-ok", completeWire("k9-a")],
      ["s-bad", completeWire("k9-a", { dog_id: "other-dog" })], // path mismatch
    ]);

    const { state, coverage } = await loadScheduleScope();

    expect(state.status).toBe("partial");
    if (state.status === "partial") {
      expect(state.partialData).toHaveLength(2);
    }
    expect(coverage.authorizedDogIds).toEqual(["k9-a"]);
    expect(coverage.partialEntryIds).toEqual([scheduleEntryId("k9-a", "s-bad")]);
    expect(coverage.complete).toBe(false);
  });

  it("keeps a path-mismatched item under the STRUCTURAL dogId", async () => {
    setCatalog(["k9-a"]);
    setDogSchedule("k9-a", [["s-bad", completeWire("k9-a", { dog_id: "elsewhere" })]]);

    const { state } = await loadScheduleScope();

    if (state.status === "partial") {
      const [entry] = state.partialData;
      expect(entry.dogId).toBe("k9-a"); // never relocated to persistedDogId
      expect(entry.item.persistedDogId).toBe("elsewhere");
    }
  });

  it("legacy and degraded items keep complete === true", async () => {
    setCatalog(["k9-a"]);
    setDogSchedule("k9-a", [
      ["s-complete", completeWire("k9-a")],
      ["s-legacy", completeWire("k9-a", { dog_id: undefined })],
      ["s-degraded", completeWire("k9-a", { schema_version: 2 })],
    ]);

    const { state, coverage } = await loadScheduleScope();

    expect(state.status).toBe("success");
    if (state.status === "success") {
      expect(state.data).toHaveLength(3);
      const qualities = state.data.map((e) => e.item.dataQuality).sort();
      expect(qualities).toEqual(["complete", "degraded", "legacy"]);
    }
    expect(coverage.partialEntryIds).toEqual([]);
    expect(coverage.complete).toBe(true);
  });

  it("keeps a legacy item with no persisted dog_id", async () => {
    setCatalog(["k9-a"]);
    setDogSchedule("k9-a", [["s-legacy", completeWire("k9-a", { dog_id: undefined })]]);

    const { state } = await loadScheduleScope();

    if (state.status === "success") {
      expect(state.data).toHaveLength(1);
      expect(state.data[0].item.persistedDogId).toBeNull();
      expect(state.data[0].dogId).toBe("k9-a");
    }
  });
});

describe("catalog edge cases", () => {
  it("an empty catalog yields empty with complete true", async () => {
    setCatalog([]);

    const { state, coverage } = await loadScheduleScope();

    expect(state.status).toBe("empty");
    expect(coverage.dogsInScope).toBe(0);
    expect(coverage.complete).toBe(true);
  });

  it("a denied catalog read yields forbidden, not empty", async () => {
    mockState.errors.set("dogs", DENIED);

    const { state, coverage } = await loadScheduleScope();

    expect(state.status).toBe("forbidden");
    expect(state.status).not.toBe("empty");
    expect(coverage.complete).toBe(false);
  });

  it("a failed catalog read yields retryable error", async () => {
    mockState.errors.set("dogs", new Error("offline"));

    const { state } = await loadScheduleScope();

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.code).toBe("SCHEDULE_SCOPE_READ_ERROR");
      expect(state.retryable).toBe(true);
    }
  });

  it("takes no arguments — authority is a later layer's concern", () => {
    expect(loadScheduleScope).toHaveLength(0);
  });
});

describe("composite identity", () => {
  it("distinguishes the same scheduleId across different dogs", async () => {
    setCatalog(["k9-a", "k9-b"]);
    setDogSchedule("k9-a", [["shared-id", completeWire("k9-a")]]);
    setDogSchedule("k9-b", [["shared-id", completeWire("k9-b")]]);

    const { state } = await loadScheduleScope();

    if (state.status === "success") {
      expect(state.data).toHaveLength(2);
      const ids = state.data.map((e) => e.entryId);
      expect(new Set(ids).size).toBe(2);
      expect(ids).toContain("k9-a:shared-id");
      expect(ids).toContain("k9-b:shared-id");

      // Structured fields remain the authority; the composite is never parsed.
      for (const entry of state.data) {
        expect(entry.scheduleId).toBe("shared-id");
        expect(["k9-a", "k9-b"]).toContain(entry.dogId);
      }
    }
  });
});

/** Minimal entry factory for pure sort tests. */
function entry(dogId: string, scheduleId: string, scheduledForIso: string | null): ScheduleListEntry {
  return {
    entryId: scheduleEntryId(dogId, scheduleId),
    dogId,
    scheduleId,
    dog: { id: dogId } as ScheduleListEntry["dog"],
    item: {
      scheduledFor: scheduledForIso ? new Date(scheduledForIso) : null,
    } as ScheduleItemReadModel,
  };
}

describe("deterministic ordering", () => {
  it("sorts by scheduledFor ASC — earliest first", () => {
    // Deliberately shuffled: input order must NOT equal expected output.
    const input = [
      entry("k9-b", "s3", "2026-09-20T10:00:00Z"),
      entry("k9-a", "s1", "2026-09-05T10:00:00Z"),
      entry("k9-c", "s2", "2026-09-12T10:00:00Z"),
    ];

    const sorted = sortScheduleListEntries(input);

    expect(sorted.map((e) => e.scheduleId)).toEqual(["s1", "s2", "s3"]);
    // Confirm the fixture was genuinely out of order.
    expect(input.map((e) => e.scheduleId)).not.toEqual(["s1", "s2", "s3"]);
  });

  it("is ASC, not DESC (Agenda is forward-looking, unlike an activity log)", () => {
    const sorted = sortScheduleListEntries([
      entry("k9-a", "late", "2027-01-01T00:00:00Z"),
      entry("k9-a", "early", "2026-01-01T00:00:00Z"),
    ]);

    expect(sorted[0].scheduleId).toBe("early");
  });

  it("breaks ties on scheduleId then dogId", () => {
    const sameInstant = "2026-09-10T13:00:00Z";
    const sorted = sortScheduleListEntries([
      entry("k9-z", "s-b", sameInstant),
      entry("k9-a", "s-b", sameInstant),
      entry("k9-m", "s-a", sameInstant),
    ]);

    expect(sorted.map((e) => `${e.scheduleId}/${e.dogId}`)).toEqual([
      "s-a/k9-m",
      "s-b/k9-a",
      "s-b/k9-z",
    ]);
  });

  it("sinks null scheduledFor to the end without dropping it", () => {
    const input = [
      entry("k9-a", "n1", null),
      entry("k9-b", "s2", "2026-09-12T10:00:00Z"),
      entry("k9-c", "n2", null),
      entry("k9-d", "s1", "2026-09-05T10:00:00Z"),
    ];

    const sorted = sortScheduleListEntries(input);

    expect(sorted).toHaveLength(4); // nothing dropped
    expect(sorted.map((e) => e.scheduleId)).toEqual(["s1", "s2", "n1", "n2"]);
  });

  it("orders null-vs-null by scheduleId then dogId", () => {
    const sorted = sortScheduleListEntries([
      entry("k9-z", "n-b", null),
      entry("k9-a", "n-b", null),
      entry("k9-m", "n-a", null),
    ]);

    expect(sorted.map((e) => `${e.scheduleId}/${e.dogId}`)).toEqual([
      "n-a/k9-m",
      "n-b/k9-a",
      "n-b/k9-z",
    ]);
  });

  it("is pure — does not mutate its input", () => {
    const input = [
      entry("k9-b", "s2", "2026-09-20T10:00:00Z"),
      entry("k9-a", "s1", "2026-09-05T10:00:00Z"),
    ];
    const before = input.map((e) => e.scheduleId);

    sortScheduleListEntries(input);

    expect(input.map((e) => e.scheduleId)).toEqual(before);
  });

  it("applies the order to the composed scope result", async () => {
    setCatalog(["k9-b", "k9-a"]);
    // Later instant registered on the first dog, so catalog order != final order.
    setDogSchedule("k9-b", [
      ["z-later", completeWire("k9-b", { scheduled_for: ts("2026-12-01T10:00:00Z") })],
    ]);
    setDogSchedule("k9-a", [
      ["a-earlier", completeWire("k9-a", { scheduled_for: ts("2026-09-01T10:00:00Z") })],
    ]);

    const { state } = await loadScheduleScope();

    if (state.status === "success") {
      expect(state.data.map((e) => e.scheduleId)).toEqual(["a-earlier", "z-later"]);
    }
  });
});

describe("no temporal coupling", () => {
  it("produces entries with no temporal derivation fields", async () => {
    setCatalog(["k9-a"]);
    setDogSchedule("k9-a", nDocs("k9-a", 1));

    const { state } = await loadScheduleScope();

    if (state.status === "success") {
      const entryRecord = state.data[0] as unknown as Record<string, unknown>;
      expect("temporalStatus" in entryRecord).toBe(false);
      expect("inDisplayWindow" in entryRecord).toBe(false);
      const itemRecord = state.data[0].item as unknown as Record<string, unknown>;
      expect("temporalStatus" in itemRecord).toBe(false);
      expect("effectiveDueUntil" in itemRecord).toBe(false);
    }
  });

  it("emits no temporalUnavailableEntryIds in coverage", async () => {
    setCatalog(["k9-a"]);
    setDogSchedule("k9-a", nDocs("k9-a", 1));

    const { coverage } = await loadScheduleScope();
    const record = coverage as unknown as Record<string, unknown>;

    expect("temporalUnavailableEntryIds" in record).toBe(false);
    expect("legacyEntryIds" in record).toBe(false);
    expect("degradedEntryIds" in record).toBe(false);
  });
});
