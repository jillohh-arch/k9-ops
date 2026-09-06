/**
 * Clinical Events & Amendments Reader Unit Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Avoid initializing real Firebase SDK
vi.mock("@/lib/firebase/client", () => ({
  db: { __mockDb: true },
}));

interface MockDoc {
  id: string;
  data: () => Record<string, unknown>;
}

interface MockSnapshot {
  empty: boolean;
  docs: MockDoc[];
}

const mockState: {
  collectionCalls: string[][];
  orderByCalls: [string, string][];
  snapshot: MockSnapshot | null;
  error: unknown;
} = {
  collectionCalls: [],
  orderByCalls: [],
  snapshot: null,
  error: null,
};

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => {
    mockState.collectionCalls.push(segments);
    return { __path: segments.join("/") };
  }),
  getDocs: vi.fn(async () => {
    if (mockState.error) throw mockState.error;
    return mockState.snapshot;
  }),
  query: vi.fn((ref: unknown) => ref),
  orderBy: vi.fn((field: string, direction: string) => {
    mockState.orderByCalls.push([field, direction]);
    return { field, direction };
  }),
}));

import {
  readClinicalEventsForCase,
  readClinicalAmendmentsForEvent,
} from "../data/clinical-events-reader";

const DOG_ID = "k9-apollo";
const CASE_ID = "case-123";
const EVENT_ID = "event-456";

function mockDoc(id: string, data: Record<string, unknown>): MockDoc {
  return { id, data: () => data };
}

function setSnapshot(docs: MockDoc[]) {
  mockState.snapshot = { empty: docs.length === 0, docs };
}

function permissionDeniedError(): Error & { code: string } {
  const err = new Error("FirebaseError: Missing or insufficient permissions.");
  (err as Error & { code: string }).code = "permission-denied";
  return err as Error & { code: string };
}

describe("ClinicalEventsReader (Front 30)", () => {
  beforeEach(() => {
    mockState.collectionCalls = [];
    mockState.orderByCalls = [];
    mockState.snapshot = null;
    mockState.error = null;
    vi.clearAllMocks();
  });

  describe("readClinicalEventsForCase", () => {
    it("reads via canonical nested path with occurred_at desc ordering", async () => {
      setSnapshot([
        mockDoc("evt-1", {
          event_type: "consultation",
          status: "final",
          occurred_at: "2026-09-02T10:00:00.000Z",
          recorded_at: "2026-09-02T10:05:00.000Z",
          recorded_by: { uid: "u1", name: "Sgt. Silva", internal_role: "condutor_k9" },
          payload_type: "consultation",
          payload_version: 1,
          schema_version: 1,
          revision: 1,
        }),
      ]);

      const res = await readClinicalEventsForCase(DOG_ID, CASE_ID);

      expect(res.status).toBe("success");
      if (res.status === "success") {
        expect(res.data).toHaveLength(1);
        expect(res.data[0].id).toBe("evt-1");
      }

      // Check collection path
      expect(mockState.collectionCalls).toEqual([
        ["dogs", DOG_ID, "clinical_cases", CASE_ID, "clinical_events"],
      ]);

      // Check query ordering
      expect(mockState.orderByCalls).toContainEqual(["occurred_at", "desc"]);
    });

    it("returns empty state when no events exist", async () => {
      setSnapshot([]);

      const res = await readClinicalEventsForCase(DOG_ID, CASE_ID);

      expect(res.status).toBe("empty");
      if (res.status === "empty") {
        expect(res.query).toBe(
          `dogs/${DOG_ID}/clinical_cases/${CASE_ID}/clinical_events`
        );
      }
    });

    it("maps permission-denied to forbidden state with health.read capability", async () => {
      mockState.error = permissionDeniedError();

      const res = await readClinicalEventsForCase(DOG_ID, CASE_ID);

      expect(res.status).toBe("forbidden");
      if (res.status === "forbidden") {
        expect(res.requiredCapability).toBe("health.read");
      }
    });

    it("maps transport failure to error state with retryable: true", async () => {
      mockState.error = new Error("Network offline");

      const res = await readClinicalEventsForCase(DOG_ID, CASE_ID);

      expect(res.status).toBe("error");
      if (res.status === "error") {
        expect(res.retryable).toBe(true);
        expect(res.code).toBe("FIRESTORE_READ_ERROR");
      }
    });

    it("degrades to partial state when a sibling document is malformed without discarding valid sibling", async () => {
      setSnapshot([
        mockDoc("evt-good", {
          event_type: "consultation",
          status: "final",
          occurred_at: "2026-09-02T10:00:00.000Z",
          recorded_at: "2026-09-02T10:05:00.000Z",
          recorded_by: { uid: "u1", name: "Sgt. Silva", internal_role: "condutor_k9" },
          payload_type: "consultation",
          payload_version: 1,
          schema_version: 1,
          revision: 1,
        }),
        mockDoc("evt-degraded", {
          // missing event_type and status
          occurred_at: "2026-09-01T10:00:00.000Z",
          recorded_at: "2026-09-01T10:05:00.000Z",
          recorded_by: { uid: "u1", name: "Sgt. Silva", internal_role: "condutor_k9" },
          payload_type: "consultation",
          payload_version: 1,
          schema_version: 1,
          revision: 1,
        }),
      ]);

      const res = await readClinicalEventsForCase(DOG_ID, CASE_ID);

      expect(res.status).toBe("partial");
      if (res.status === "partial") {
        expect(res.partialData).toHaveLength(2);
        expect(res.successfulSources).toContain(
          `dogs/${DOG_ID}/clinical_cases/${CASE_ID}/clinical_events/evt-good`
        );
        expect(res.failedSources).toContain(
          `dogs/${DOG_ID}/clinical_cases/${CASE_ID}/clinical_events/evt-degraded`
        );
      }
    });
  });

  describe("readClinicalAmendmentsForEvent", () => {
    it("reads via canonical subcollection path with recorded_at asc ordering", async () => {
      setSnapshot([
        mockDoc("amend-1", {
          type: "addendum",
          reason: "Adição de observação pós-consulta",
          recorded_at: "2026-09-02T12:00:00.000Z",
          recorded_by: { uid: "u1", name: "Sgt. Silva", internal_role: "condutor_k9" },
        }),
      ]);

      const res = await readClinicalAmendmentsForEvent(
        DOG_ID,
        CASE_ID,
        EVENT_ID
      );

      expect(res.status).toBe("success");
      if (res.status === "success") {
        expect(res.data).toHaveLength(1);
        expect(res.data[0].id).toBe("amend-1");
        expect(res.data[0].type).toBe("addendum");
      }

      expect(mockState.collectionCalls).toEqual([
        [
          "dogs",
          DOG_ID,
          "clinical_cases",
          CASE_ID,
          "clinical_events",
          EVENT_ID,
          "clinical_amendments",
        ],
      ]);
      expect(mockState.orderByCalls).toContainEqual(["recorded_at", "asc"]);
    });

    it("returns empty when no amendments exist", async () => {
      setSnapshot([]);

      const res = await readClinicalAmendmentsForEvent(
        DOG_ID,
        CASE_ID,
        EVENT_ID
      );

      expect(res.status).toBe("empty");
      if (res.status === "empty") {
        expect(res.query).toBe(
          `dogs/${DOG_ID}/clinical_cases/${CASE_ID}/clinical_events/${EVENT_ID}/clinical_amendments`
        );
      }
    });

    it("maps permission denied on amendments to forbidden", async () => {
      mockState.error = permissionDeniedError();

      const res = await readClinicalAmendmentsForEvent(
        DOG_ID,
        CASE_ID,
        EVENT_ID
      );

      expect(res.status).toBe("forbidden");
    });
  });
});
