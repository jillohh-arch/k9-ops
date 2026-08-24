/**
 * K9 Ops Web — Health Web v1 HW-6A.I1
 * Per-Dog ClinicalCase Reader — Contract & Security Tests
 *
 * Covers the 13 mandatory reader scenarios of the HW-6A.I1 contract §15.
 *
 * The two load-bearing security assertions:
 *  - the reader uses the NESTED path dogs/{dogId}/clinical_cases;
 *  - collectionGroup("clinical_cases") is NEVER used.
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
  docs: MockDoc[];
}

// Hoisted mock state (the `mock` prefix allows Vitest hoisting).
const mockState: {
  collectionCalls: string[][];
  collectionGroupCalls: string[];
  snapshot: MockSnapshot | null;
  error: unknown;
} = {
  collectionCalls: [],
  collectionGroupCalls: [],
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
    if (mockState.error) throw mockState.error;
    return mockState.snapshot;
  }),
  query: vi.fn((ref: unknown) => ref),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ __path: segments.join("/") })),
  getDoc: vi.fn(),
}));

import { collectionGroup } from "firebase/firestore";
import {
  CLINICAL_CASES_COLLECTION,
  CLINICAL_READ_CAPABILITY,
  readClinicalCasesForDog,
} from "../data/clinical-cases-reader";

const DOG_ID = "k9-apollo";

function completeWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    clinical_status: "under_treatment",
    title: "Otite bilateral",
    opened_at: "2026-08-10T14:32:00.000Z",
    opened_by: { uid: "uid-opener", name: "Sgt. Lima", internal_role: "handler" },
    recorded_by: { uid: "uid-recorder", name: "Cabo Souza", internal_role: "operator" },
    opening_event_id: "evt-001",
    opening_type: "consultation",
    schema_version: 1,
    ...overrides,
  };
}

function mockDoc(id: string, data: Record<string, unknown>): MockDoc {
  return { id, data: () => data };
}

function setSnapshot(docs: MockDoc[]) {
  mockState.snapshot = { empty: docs.length === 0, docs };
}

/** A FirebaseError-shaped permission denial. */
function permissionDeniedError(): Error & { code: string } {
  const err = new Error(
    "FirebaseError: Missing or insufficient permissions."
  ) as Error & { code: string };
  err.code = "permission-denied";
  return err;
}

beforeEach(() => {
  mockState.collectionCalls = [];
  mockState.collectionGroupCalls = [];
  mockState.snapshot = null;
  mockState.error = null;
  vi.clearAllMocks();
});

describe("HW-6A.I1 — per-dog ClinicalCase reader contract", () => {
  // 1
  it("1. uses the nested dogs/{dogId}/clinical_cases path", async () => {
    setSnapshot([mockDoc("case-001", completeWire())]);

    await readClinicalCasesForDog(DOG_ID);

    expect(mockState.collectionCalls).toHaveLength(1);
    expect(mockState.collectionCalls[0]).toEqual(["dogs", DOG_ID, "clinical_cases"]);
    expect(CLINICAL_CASES_COLLECTION).toBe("clinical_cases");
  });

  // 2
  it("2. NEVER uses collectionGroup (security/authority contract)", async () => {
    setSnapshot([mockDoc("case-001", completeWire())]);

    await readClinicalCasesForDog(DOG_ID);

    expect(mockState.collectionGroupCalls).toEqual([]);
    expect(vi.mocked(collectionGroup)).not.toHaveBeenCalled();
  });

  // 3
  it("3. a populated list of valid cases -> success", async () => {
    setSnapshot([
      mockDoc("case-001", completeWire()),
      mockDoc("case-002", completeWire({ clinical_status: "monitoring" })),
    ]);

    const state = await readClinicalCasesForDog(DOG_ID);

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("expected success");
    expect(state.data).toHaveLength(2);
    expect(state.data.map((c) => c.caseId)).toEqual(["case-001", "case-002"]);
    expect(state.fetchedAt).toBeInstanceOf(Date);
  });

  // 4
  it("4. a valid query with zero documents -> empty", async () => {
    setSnapshot([]);

    const state = await readClinicalCasesForDog(DOG_ID);

    expect(state.status).toBe("empty");
    if (state.status !== "empty") throw new Error("expected empty");
    expect(state.query).toBe(`dogs/${DOG_ID}/clinical_cases`);
  });

  // 5
  it("5. PERMISSION_DENIED -> forbidden with health.read as required capability", async () => {
    mockState.error = permissionDeniedError();

    const state = await readClinicalCasesForDog(DOG_ID);

    expect(state.status).toBe("forbidden");
    if (state.status !== "forbidden") throw new Error("expected forbidden");
    expect(state.requiredCapability).toBe("health.read");
    expect(CLINICAL_READ_CAPABILITY).toBe("health.read");
    // Legacy health.view is never accepted as Clinical authority.
    expect(state.requiredCapability).not.toBe("health.view");
  });

  // 6
  it("6. PERMISSION_DENIED is NEVER translated into empty", async () => {
    mockState.error = permissionDeniedError();

    const state = await readClinicalCasesForDog(DOG_ID);

    expect(state.status).not.toBe("empty");
    expect(state.status).not.toBe("success");
    expect(state.status).toBe("forbidden");
  });

  it("6b. recognizes a permission denial carried only in the message", async () => {
    mockState.error = new Error("7 PERMISSION_DENIED: Missing or insufficient permissions.");

    const state = await readClinicalCasesForDog(DOG_ID);

    expect(state.status).toBe("forbidden");
  });

  // 7
  it("7. a generic Firestore failure -> retryable error", async () => {
    const err = new Error("unavailable: backend did not respond") as Error & { code: string };
    err.code = "unavailable";
    mockState.error = err;

    const state = await readClinicalCasesForDog(DOG_ID);

    expect(state.status).toBe("error");
    if (state.status !== "error") throw new Error("expected error");
    expect(state.code).toBe("FIRESTORE_READ_ERROR");
    expect(state.retryable).toBe(true);
    // A transport failure must never masquerade as an authorization outcome.
    expect(state.status).not.toBe("forbidden");
  });

  // 8
  it("8. valid + malformed docs -> partial preserving every valid sibling", async () => {
    setSnapshot([
      mockDoc("case-valid", completeWire()),
      mockDoc("case-bad", completeWire({ clinical_status: "not_a_status" })),
    ]);

    const state = await readClinicalCasesForDog(DOG_ID);

    expect(state.status).toBe("partial");
    if (state.status !== "partial") throw new Error("expected partial");
    expect(state.partialData).toHaveLength(2);

    const valid = state.partialData.find((c) => c.caseId === "case-valid");
    const bad = state.partialData.find((c) => c.caseId === "case-bad");

    expect(valid?.dataQuality).toBe("complete");
    expect(valid?.title).toBe("Otite bilateral");
    expect(bad?.dataQuality).toBe("partial");
    expect(bad?.clinicalStatus).toBeNull();
    expect(bad?.rawClinicalStatus).toBe("not_a_status");

    expect(state.failedSources).toContain(`dogs/${DOG_ID}/clinical_cases/case-bad`);
    expect(state.successfulSources).toContain(`dogs/${DOG_ID}/clinical_cases/case-valid`);
  });

  // 9
  it("9. passes the structural dogId into every parsed read model", async () => {
    setSnapshot([mockDoc("case-001", completeWire()), mockDoc("case-002", completeWire())]);

    const state = await readClinicalCasesForDog(DOG_ID);

    if (state.status !== "success") throw new Error("expected success");
    for (const c of state.data) {
      expect(c.dogId).toBe(DOG_ID);
    }
  });

  it("9b. ignores any payload dog_id in favour of the structural path dogId", async () => {
    setSnapshot([mockDoc("case-001", completeWire({ dog_id: "k9-IMPOSTOR" }))]);

    const state = await readClinicalCasesForDog(DOG_ID);

    if (state.status !== "success") throw new Error("expected success");
    expect(state.data[0].dogId).toBe(DOG_ID);
    expect(state.data[0].dogId).not.toBe("k9-IMPOSTOR");
  });

  // 10
  it("10. caseId comes from the Firestore document ID", async () => {
    setSnapshot([mockDoc("firestore-doc-id-xyz", completeWire({ case_id: "payload-id" }))]);

    const state = await readClinicalCasesForDog(DOG_ID);

    if (state.status !== "success") throw new Error("expected success");
    expect(state.data[0].caseId).toBe("firestore-doc-id-xyz");
    expect(state.data[0].caseId).not.toBe("payload-id");
  });

  // 11 & 12 & 13 — static source guarantees
  it("11-13. imports no write API, no callable, and no event/doc/amendment reads", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(
      path.resolve(__dirname, "../data/clinical-cases-reader.ts"),
      "utf8"
    );

    // Strip the leading documentation block so prose mentions of forbidden
    // concepts (e.g. "no setDoc") cannot satisfy or break the assertions.
    const firstImport = source.indexOf("\nimport ");
    const code = firstImport >= 0 ? source.slice(firstImport) : source;

    // 11. no write API
    for (const writeApi of [
      "setDoc",
      "addDoc",
      "updateDoc",
      "deleteDoc",
      "writeBatch",
      "runTransaction",
      "serverTimestamp",
    ]) {
      expect(code).not.toContain(writeApi);
    }

    // 12. no callable
    for (const callableApi of ["httpsCallable", "getFunctions", "firebase/functions"]) {
      expect(code).not.toContain(callableApi);
    }

    // 13. no event / exam / amendment / document subcollection reads
    for (const forbiddenPath of [
      '"events"',
      '"exams"',
      '"amendments"',
      '"health_documents"',
    ]) {
      expect(code).not.toContain(forbiddenPath);
    }

    // And the collectionGroup prohibition at source level.
    expect(code).not.toContain("collectionGroup");
  });

  // --- Additional guardrails -------------------------------------------------

  it("rejects an empty dogId without touching Firestore", async () => {
    const state = await readClinicalCasesForDog("");

    expect(state.status).toBe("error");
    if (state.status !== "error") throw new Error("expected error");
    expect(state.code).toBe("INVALID_DOG_ID");
    expect(state.retryable).toBe(false);
    expect(mockState.collectionCalls).toEqual([]);
  });

  it("does not sort or fabricate activity ordering (deferred to composition)", async () => {
    // case-002 has a newer last_event_at but must NOT be reordered here.
    setSnapshot([
      mockDoc("case-001", completeWire({ last_event_at: "2026-08-11T10:00:00.000Z" })),
      mockDoc("case-002", completeWire({ last_event_at: "2026-08-21T10:00:00.000Z" })),
    ]);

    const state = await readClinicalCasesForDog(DOG_ID);

    if (state.status !== "success") throw new Error("expected success");
    expect(state.data.map((c) => c.caseId)).toEqual(["case-001", "case-002"]);
  });
});
