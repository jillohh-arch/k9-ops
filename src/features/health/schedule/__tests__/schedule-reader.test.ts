// @vitest-environment node
/**
 * HW-4.WEB-SCHED-RD-I3 — Per-Dog Schedule Reader contract & security tests.
 *
 * The load-bearing properties here are NOT "did getDocs get called":
 *
 *   1. COMPLETENESS  — items.length === snapshot.size, exactly, for every
 *      successful read, including snapshots mixing document qualities.
 *   2. DISTINCTION   — empty, forbidden and error can never collapse.
 *   3. NEVER-REJECT  — every expected failure resolves as a typed ReadState,
 *      which is what makes the scope loader's Promise.all fan-out safe.
 *
 * Security assertions: the NESTED path is used, and collectionGroup never is.
 *
 * No network, no emulator, no clock dependence.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Avoid initializing the real Firebase SDK.
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

// Hoisted mock state (the `mock` prefix allows Vitest hoisting).
const mockState: {
  collectionCalls: string[][];
  collectionGroupCalls: string[];
  getDocsCalls: number;
  snapshot: MockSnapshot | null;
  error: unknown;
} = {
  collectionCalls: [],
  collectionGroupCalls: [],
  getDocsCalls: 0,
  snapshot: null,
  error: null,
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
  getDocs: vi.fn(async () => {
    mockState.getDocsCalls += 1;
    if (mockState.error) throw mockState.error;
    return mockState.snapshot;
  }),
  query: vi.fn((ref: unknown) => ref),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ __path: segments.join("/") })),
  getDoc: vi.fn(),
}));

import { collectionGroup, orderBy, where } from "firebase/firestore";
import {
  SCHEDULE_COLLECTION,
  SCHEDULE_READ_CAPABILITY,
  readScheduleForDog,
} from "../data/schedule-reader";

const DOG_ID = "k9-apollo";

/** Firestore Timestamp stand-in accepted by the frozen strict parser. */
const ts = (iso: string) => ({ toMillis: () => new Date(iso).getTime() });

/** A fully canonical wire document. */
function completeWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    dog_id: DOG_ID,
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

function setSnapshot(docs: Array<[string, Record<string, unknown>]>) {
  mockState.snapshot = snapshotOf(docs);
  mockState.error = null;
}

beforeEach(() => {
  mockState.collectionCalls = [];
  mockState.collectionGroupCalls = [];
  mockState.getDocsCalls = 0;
  mockState.snapshot = null;
  mockState.error = null;
  vi.clearAllMocks();
});

describe("path and SDK usage", () => {
  it("reads the nested per-dog path exactly once", async () => {
    setSnapshot([["s1", completeWire()]]);

    await readScheduleForDog(DOG_ID);

    expect(mockState.collectionCalls).toEqual([["dogs", DOG_ID, SCHEDULE_COLLECTION]]);
    expect(mockState.getDocsCalls).toBe(1);
  });

  it("NEVER uses collectionGroup", async () => {
    setSnapshot([["s1", completeWire()]]);

    await readScheduleForDog(DOG_ID);

    expect(mockState.collectionGroupCalls).toEqual([]);
    expect(collectionGroup).not.toHaveBeenCalled();
  });

  it("applies no where/orderBy filter — the read must be unfiltered", async () => {
    setSnapshot([["s1", completeWire()]]);

    await readScheduleForDog(DOG_ID);

    // Filtering at query level could silently omit legacy/partial documents.
    expect(where).not.toHaveBeenCalled();
    expect(orderBy).not.toHaveBeenCalled();
  });

  it("rejects an empty dogId without touching Firestore", async () => {
    const state = await readScheduleForDog("");

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.code).toBe("INVALID_DOG_ID");
      expect(state.retryable).toBe(false);
    }
    expect(mockState.collectionCalls).toEqual([]);
    expect(mockState.getDocsCalls).toBe(0);
  });
});

describe("completeness invariant — items.length === snapshot.size", () => {
  it("accounts for every document in a known-total snapshot", async () => {
    const docs: Array<[string, Record<string, unknown>]> = Array.from({ length: 7 }, (_, i) => [
      `s${i + 1}`,
      completeWire({ title: `Item ${i + 1}` }),
    ]);
    setSnapshot(docs);

    const state = await readScheduleForDog(DOG_ID);

    expect(state.status).toBe("success");
    if (state.status === "success") {
      // Exact equality, not "greater than zero".
      expect(state.data).toHaveLength(7);
      expect(state.data).toHaveLength(mockState.snapshot!.size);
    }
  });

  it("accounts for every document when qualities are MIXED", async () => {
    setSnapshot([
      ["s-complete", completeWire()],
      ["s-legacy", completeWire({ dog_id: undefined })],
      ["s-partial", completeWire({ dog_id: "other-dog" })],
      ["s-degraded", completeWire({ schema_version: 2 })],
    ]);

    const state = await readScheduleForDog(DOG_ID);

    // One partial document downgrades the state, but nothing is dropped.
    expect(state.status).toBe("partial");
    if (state.status === "partial") {
      expect(state.partialData).toHaveLength(4);
      expect(state.partialData).toHaveLength(mockState.snapshot!.size);
    }
  });

  it("uses the Firestore document id as scheduleId", async () => {
    setSnapshot([
      ["doc-alpha", completeWire()],
      ["doc-beta", completeWire()],
    ]);

    const state = await readScheduleForDog(DOG_ID);

    if (state.status === "success") {
      expect(state.data.map((i) => i.scheduleId)).toEqual(["doc-alpha", "doc-beta"]);
    }
  });

  it("propagates the STRUCTURAL dogId, ignoring any payload dog_id", async () => {
    setSnapshot([["s1", completeWire({ dog_id: "payload-dog" })]]);

    const state = await readScheduleForDog(DOG_ID);

    if (state.status === "partial") {
      const [item] = state.partialData;
      expect(item.dogId).toBe(DOG_ID); // structural authority
      expect(item.persistedDogId).toBe("payload-dog"); // preserved, not authoritative
    }
  });
});

describe("quality preservation", () => {
  it("keeps a legacy item (absent persisted dog_id) and stays success", async () => {
    setSnapshot([["s1", completeWire({ dog_id: undefined })]]);

    const state = await readScheduleForDog(DOG_ID);

    // legacy alone is NOT coverage loss.
    expect(state.status).toBe("success");
    if (state.status === "success") {
      expect(state.data).toHaveLength(1);
      expect(state.data[0].dataQuality).toBe("legacy");
      expect(state.data[0].persistedDogId).toBeNull();
    }
  });

  it("keeps a degraded item (future schema) and stays success", async () => {
    setSnapshot([["s1", completeWire({ schema_version: 2 })]]);

    const state = await readScheduleForDog(DOG_ID);

    // degraded alone is NOT coverage loss.
    expect(state.status).toBe("success");
    if (state.status === "success") {
      expect(state.data[0].dataQuality).toBe("degraded");
    }
  });

  it("downgrades to partial only for a genuine document defect", async () => {
    setSnapshot([
      ["s-ok", completeWire()],
      ["s-bad", completeWire({ title: undefined })],
    ]);

    const state = await readScheduleForDog(DOG_ID);

    expect(state.status).toBe("partial");
    if (state.status === "partial") {
      expect(state.partialData).toHaveLength(2);
      expect(state.failedSources).toHaveLength(1);
      expect(state.failedSources[0]).toContain("s-bad");
      expect(state.successfulSources).toHaveLength(1);
      expect(state.successfulSources[0]).toContain("s-ok");
    }
  });

  it("never discards a structurally unusable document", async () => {
    // A non-object payload still yields a model from the frozen parser.
    setSnapshot([
      ["s-ok", completeWire()],
      ["s-junk", null as unknown as Record<string, unknown>],
    ]);

    const state = await readScheduleForDog(DOG_ID);

    expect(state.status).toBe("partial");
    if (state.status === "partial") {
      expect(state.partialData).toHaveLength(2);
      expect(state.partialData.map((i) => i.scheduleId)).toContain("s-junk");
    }
  });
});

describe("empty", () => {
  it("returns empty for a successful zero-document query", async () => {
    setSnapshot([]);

    const state = await readScheduleForDog(DOG_ID);

    expect(state.status).toBe("empty");
    if (state.status === "empty") {
      expect(state.query).toBe(`dogs/${DOG_ID}/${SCHEDULE_COLLECTION}`);
    }
  });

  it("empty is NOT forbidden and NOT error", async () => {
    setSnapshot([]);

    const state = await readScheduleForDog(DOG_ID);

    expect(state.status).not.toBe("forbidden");
    expect(state.status).not.toBe("error");
  });
});

describe("permission denial", () => {
  it.each([
    ["SDK code", { code: "permission-denied", message: "x" }],
    ["namespaced code", { code: "firestore/permission-denied", message: "x" }],
    ["hyphenated message only", { message: "PERMISSION-DENIED: nope" }],
    ["underscore message only", { message: "PERMISSION_DENIED" }],
    ["insufficient permissions message", { message: "Missing or insufficient permissions." }],
  ])("maps %s to forbidden", async (_label, error) => {
    mockState.error = error;

    const state = await readScheduleForDog(DOG_ID);

    expect(state.status).toBe("forbidden");
    if (state.status === "forbidden") {
      expect(state.requiredCapability).toBe(SCHEDULE_READ_CAPABILITY);
    }
  });

  it("a denial NEVER becomes empty", async () => {
    mockState.error = { code: "permission-denied", message: "denied" };

    const state = await readScheduleForDog(DOG_ID);

    expect(state.status).not.toBe("empty");
    expect(state.status).toBe("forbidden");
  });

  it("requires the explicit health.read capability", () => {
    expect(SCHEDULE_READ_CAPABILITY).toBe("health.read");
    expect(SCHEDULE_READ_CAPABILITY).not.toBe("health.view");
  });
});

describe("technical failure", () => {
  it("maps a generic exception to retryable error", async () => {
    mockState.error = new Error("network unreachable");

    const state = await readScheduleForDog(DOG_ID);

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.code).toBe("FIRESTORE_READ_ERROR");
      expect(state.retryable).toBe(true);
    }
  });

  it("a technical failure is NOT empty and NOT forbidden", async () => {
    mockState.error = new Error("unavailable");

    const state = await readScheduleForDog(DOG_ID);

    expect(state.status).not.toBe("empty");
    expect(state.status).not.toBe("forbidden");
  });
});

describe("never-reject contract", () => {
  // This is what makes the scope loader's Promise.all fan-out safe: a rejecting
  // reader would let one dog's failure erase every successful dog.
  it("resolves (does not reject) on permission denial", async () => {
    mockState.error = { code: "permission-denied", message: "denied" };

    await expect(readScheduleForDog(DOG_ID)).resolves.toMatchObject({ status: "forbidden" });
  });

  it("resolves (does not reject) on a technical exception", async () => {
    mockState.error = new Error("boom");

    await expect(readScheduleForDog(DOG_ID)).resolves.toMatchObject({ status: "error" });
  });

  it("resolves (does not reject) on a non-Error thrown value", async () => {
    mockState.error = "a bare string";

    await expect(readScheduleForDog(DOG_ID)).resolves.toMatchObject({ status: "error" });
  });

  it("resolves (does not reject) for an invalid dogId", async () => {
    await expect(readScheduleForDog("")).resolves.toMatchObject({ status: "error" });
  });
});

describe("no temporal coupling", () => {
  it("returns items without any temporal derivation field", async () => {
    setSnapshot([["s1", completeWire()]]);

    const state = await readScheduleForDog(DOG_ID);

    if (state.status === "success") {
      const item = state.data[0] as unknown as Record<string, unknown>;
      expect("temporalStatus" in item).toBe(false);
      expect("effectiveDueUntil" in item).toBe(false);
      expect("inDisplayWindow" in item).toBe(false);
    }
  });

  it("takes no clock argument", () => {
    // A `now` parameter would make set completeness depend on time.
    expect(readScheduleForDog).toHaveLength(1);
  });
});
