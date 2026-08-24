/**
 * K9 Ops Web — Health Web v1 HW-6A.I2
 * Clinical scope composition — global state semantics & security tests.
 *
 * The load-bearing guarantees (§7, §15, §16, §17, §18):
 *  - PERMISSION_DENIED anywhere in the fan-out NEVER becomes global EMPTY.
 *  - Mixed coverage is PARTIAL and preserves every trustworthy case.
 *  - The composition reads ONLY `dogs` + `dogs/{dogId}/clinical_cases`.
 *  - The frozen I1 read model is never mutated.
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

const mockState = vi.hoisted(() => ({
  collectionCalls: [] as string[][],
  collectionGroupCalls: [] as string[],
  /** Snapshot returned for the institutional `dogs` read. */
  dogs: null as { empty: boolean; docs: MockDoc[] } | null,
  dogsError: null as unknown,
}));

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
    if (mockState.dogsError) throw mockState.dogsError;
    return mockState.dogs;
  }),
  doc: vi.fn(),
  getDoc: vi.fn(),
  query: vi.fn((ref: unknown) => ref),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
}));

// The per-dog reader is the FROZEN I1 unit. It is stubbed here so this suite
// tests composition semantics, not Firestore transport (already covered by the
// I1 reader suite).
const readerMock = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../data/clinical-cases-reader", async () => {
  const actual = await vi.importActual<
    typeof import("../data/clinical-cases-reader")
  >("../data/clinical-cases-reader");
  return {
    ...actual,
    readClinicalCasesForDog: (dogId: string) => readerMock.read(dogId),
  };
});

import { collectionGroup } from "firebase/firestore";
import type { ReadState } from "../../domain/read-states";
import type { ClinicalCaseReadModel } from "../types";
import {
  clinicalEntryId,
  loadClinicalScope,
  sortClinicalListEntries,
  type ClinicalCaseListEntry,
} from "../data/clinical-scope-loader";

function setDogs(ids: Array<[string, Record<string, unknown>]>) {
  mockState.dogs = {
    empty: ids.length === 0,
    docs: ids.map(([id, data]) => ({ id, data: () => data })),
  };
}

function caseModel(
  dogId: string,
  caseId: string,
  overrides: Partial<ClinicalCaseReadModel> = {},
): ClinicalCaseReadModel {
  return {
    dogId,
    caseId,
    clinicalStatus: "under_treatment",
    rawClinicalStatus: "under_treatment",
    title: `Caso ${caseId}`,
    openedAt: new Date("2026-08-01T10:00:00.000Z"),
    openedBy: { uid: "uid-a", name: "Sgt. Lima", internalRole: "handler" },
    recordedBy: { uid: "uid-b", name: "Cabo Souza", internalRole: "operator" },
    openingEventId: "evt-1",
    openingType: "consultation",
    primaryProfessional: null,
    closedAt: null,
    closedBy: null,
    closureType: null,
    closureReason: null,
    hasActiveRestriction: null,
    hasPendingSchedule: null,
    activeTreatmentsCount: null,
    lastEventAt: null,
    eventCount: null,
    schemaVersion: 1,
    dataQuality: "complete",
    issues: [],
    ...overrides,
  };
}

function successState(cases: ClinicalCaseReadModel[]): ReadState<ClinicalCaseReadModel[]> {
  return { status: "success", data: cases, fetchedAt: new Date() };
}

function emptyState(dogId: string): ReadState<ClinicalCaseReadModel[]> {
  return { status: "empty", query: `dogs/${dogId}/clinical_cases` };
}

function forbiddenState(): ReadState<ClinicalCaseReadModel[]> {
  return {
    status: "forbidden",
    requiredCapability: "health.read",
    message: "denied",
  };
}

function errorState(): ReadState<ClinicalCaseReadModel[]> {
  return {
    status: "error",
    code: "FIRESTORE_READ_ERROR",
    message: "unavailable",
    retryable: true,
  };
}

function partialState(
  dogId: string,
  cases: ClinicalCaseReadModel[],
): ReadState<ClinicalCaseReadModel[]> {
  return {
    status: "partial",
    partialData: cases,
    failedSources: [`dogs/${dogId}/clinical_cases/bad`],
    successfulSources: [],
  };
}

/** Routes per-dog reads by dogId. */
function routeReads(routes: Record<string, ReadState<ClinicalCaseReadModel[]>>) {
  readerMock.read.mockImplementation(async (dogId: string) => {
    const route = routes[dogId];
    if (!route) throw new Error(`unexpected dogId read: ${dogId}`);
    return route;
  });
}

function permissionDenied(): Error & { code: string } {
  const err = new Error("Missing or insufficient permissions.") as Error & {
    code: string;
  };
  err.code = "permission-denied";
  return err;
}

beforeEach(() => {
  mockState.collectionCalls = [];
  mockState.collectionGroupCalls = [];
  mockState.dogs = null;
  mockState.dogsError = null;
  readerMock.read.mockReset();
  vi.clearAllMocks();
});

describe("HW-6A.I2 — Clinical scope composition", () => {
  // 1
  it("1. reads the institutional dogs collection exactly once", async () => {
    setDogs([["k9-a", { nome: "Apollo" }]]);
    routeReads({ "k9-a": successState([caseModel("k9-a", "c1")]) });

    await loadClinicalScope();

    const dogsReads = mockState.collectionCalls.filter(
      (segments) => segments.length === 1 && segments[0] === "dogs",
    );
    expect(dogsReads).toHaveLength(1);
  });

  // 2
  it("2. delegates one per-dog read per K9 in scope, and nothing more", async () => {
    setDogs([
      ["k9-a", { nome: "Apollo" }],
      ["k9-b", { nome: "Bono" }],
      ["k9-c", { nome: "Cora" }],
    ]);
    routeReads({
      "k9-a": emptyState("k9-a"),
      "k9-b": emptyState("k9-b"),
      "k9-c": emptyState("k9-c"),
    });

    await loadClinicalScope();

    expect(readerMock.read).toHaveBeenCalledTimes(3);
    expect(readerMock.read.mock.calls.map((c) => c[0]).sort()).toEqual([
      "k9-a",
      "k9-b",
      "k9-c",
    ]);
  });

  // 3
  it("3. NEVER uses collectionGroup", async () => {
    setDogs([["k9-a", {}]]);
    routeReads({ "k9-a": successState([caseModel("k9-a", "c1")]) });

    await loadClinicalScope();

    expect(mockState.collectionGroupCalls).toEqual([]);
    expect(vi.mocked(collectionGroup)).not.toHaveBeenCalled();
  });

  // 4
  it("4. performs NO secondary read beyond dogs + per-dog cases", async () => {
    setDogs([["k9-a", {}]]);
    routeReads({ "k9-a": successState([caseModel("k9-a", "c1")]) });

    await loadClinicalScope();

    // The only collection() the loader itself opens is `dogs`.
    for (const segments of mockState.collectionCalls) {
      expect(segments).toEqual(["dogs"]);
    }
    for (const forbidden of [
      "events",
      "treatments",
      "operational_restrictions",
      "health_schedule",
      "health_documents",
      "users",
      "health_summary",
    ]) {
      expect(mockState.collectionCalls.flat()).not.toContain(forbidden);
    }
  });

  // 5
  it("5. a genuinely empty institution -> empty with complete coverage", async () => {
    setDogs([]);

    const { state, coverage } = await loadClinicalScope();

    expect(state.status).toBe("empty");
    expect(coverage.dogsInScope).toBe(0);
    expect(coverage.complete).toBe(true);
    // No Clinical read is needed to prove an empty institution.
    expect(readerMock.read).not.toHaveBeenCalled();
  });

  // 6
  it("6. full coverage with cases -> success, sorted, no coverage loss", async () => {
    setDogs([
      ["k9-a", { nome: "Apollo" }],
      ["k9-b", { nome: "Bono" }],
    ]);
    routeReads({
      "k9-a": successState([caseModel("k9-a", "c1")]),
      "k9-b": successState([caseModel("k9-b", "c2")]),
    });

    const { state, coverage } = await loadClinicalScope();

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("expected success");
    expect(state.data).toHaveLength(2);
    expect(coverage.complete).toBe(true);
    expect(coverage.forbiddenDogIds).toEqual([]);
    expect(coverage.failedDogIds).toEqual([]);
    expect(coverage.authorizedDogIds.sort()).toEqual(["k9-a", "k9-b"]);
  });

  // 7
  it("7. full coverage, every authorized read empty -> TRUE empty", async () => {
    setDogs([
      ["k9-a", {}],
      ["k9-b", {}],
    ]);
    routeReads({ "k9-a": emptyState("k9-a"), "k9-b": emptyState("k9-b") });

    const { state, coverage } = await loadClinicalScope();

    expect(state.status).toBe("empty");
    expect(coverage.complete).toBe(true);
    expect(coverage.authorizedDogIds).toHaveLength(2);
  });

  // 8 — THE central security semantic
  it("8. authorized-empty + one forbidden -> PARTIAL, never empty", async () => {
    setDogs([
      ["k9-a", {}],
      ["k9-b", {}],
    ]);
    routeReads({ "k9-a": emptyState("k9-a"), "k9-b": forbiddenState() });

    const { state, coverage } = await loadClinicalScope();

    expect(state.status).toBe("partial");
    expect(state.status).not.toBe("empty");
    if (state.status !== "partial") throw new Error("expected partial");
    expect(state.partialData).toEqual([]);
    expect(coverage.forbiddenDogIds).toEqual(["k9-b"]);
    expect(coverage.complete).toBe(false);
  });

  // 9
  it("9. cases + one forbidden -> PARTIAL preserving every trustworthy case", async () => {
    setDogs([
      ["k9-a", {}],
      ["k9-b", {}],
    ]);
    routeReads({
      "k9-a": successState([caseModel("k9-a", "c1"), caseModel("k9-a", "c2")]),
      "k9-b": forbiddenState(),
    });

    const { state, coverage } = await loadClinicalScope();

    expect(state.status).toBe("partial");
    if (state.status !== "partial") throw new Error("expected partial");
    expect(state.partialData).toHaveLength(2);
    expect(state.failedSources.some((s) => s.startsWith("forbidden:"))).toBe(true);
    expect(coverage.forbiddenDogIds).toEqual(["k9-b"]);
  });

  // 10
  it("10. cases + one technical failure -> PARTIAL, failure attributed", async () => {
    setDogs([
      ["k9-a", {}],
      ["k9-b", {}],
    ]);
    routeReads({
      "k9-a": successState([caseModel("k9-a", "c1")]),
      "k9-b": errorState(),
    });

    const { state, coverage } = await loadClinicalScope();

    expect(state.status).toBe("partial");
    if (state.status !== "partial") throw new Error("expected partial");
    expect(state.failedSources.some((s) => s.startsWith("error:"))).toBe(true);
    expect(coverage.failedDogIds).toEqual(["k9-b"]);
    expect(coverage.forbiddenDogIds).toEqual([]);
  });

  // 11
  it("11. authorized-empty + one technical failure -> PARTIAL, never empty", async () => {
    setDogs([
      ["k9-a", {}],
      ["k9-b", {}],
    ]);
    routeReads({ "k9-a": emptyState("k9-a"), "k9-b": errorState() });

    const { state } = await loadClinicalScope();

    expect(state.status).toBe("partial");
    expect(state.status).not.toBe("empty");
  });

  // 12
  it("12. a partial DOCUMENT degrades the global list to PARTIAL", async () => {
    setDogs([["k9-a", {}]]);
    routeReads({
      "k9-a": partialState("k9-a", [
        caseModel("k9-a", "good"),
        caseModel("k9-a", "bad", {
          dataQuality: "partial",
          clinicalStatus: null,
          rawClinicalStatus: "not_a_status",
        }),
      ]),
    });

    const { state, coverage } = await loadClinicalScope();

    expect(state.status).toBe("partial");
    if (state.status !== "partial") throw new Error("expected partial");
    // Both preserved — a malformed sibling never discards a valid case.
    expect(state.partialData).toHaveLength(2);
    expect(coverage.partialEntryIds).toEqual(["k9-a:bad"]);
    expect(coverage.complete).toBe(false);
  });

  // 13
  it("13. EVERY read denied and no authorized result -> FORBIDDEN", async () => {
    setDogs([
      ["k9-a", {}],
      ["k9-b", {}],
    ]);
    routeReads({ "k9-a": forbiddenState(), "k9-b": forbiddenState() });

    const { state, coverage } = await loadClinicalScope();

    expect(state.status).toBe("forbidden");
    if (state.status !== "forbidden") throw new Error("expected forbidden");
    expect(state.requiredCapability).toBe("health.read");
    expect(state.requiredCapability).not.toBe("health.view");
    expect(coverage.forbiddenDogIds).toHaveLength(2);
    expect(coverage.authorizedDogIds).toEqual([]);
  });

  // 14
  it("14. every read a technical failure -> ERROR, not forbidden, not empty", async () => {
    setDogs([
      ["k9-a", {}],
      ["k9-b", {}],
    ]);
    routeReads({ "k9-a": errorState(), "k9-b": errorState() });

    const { state } = await loadClinicalScope();

    expect(state.status).toBe("error");
    if (state.status !== "error") throw new Error("expected error");
    expect(state.code).toBe("CLINICAL_SCOPE_NO_AUTHORIZED_READ");
    expect(state.retryable).toBe(true);
  });

  // 15
  it("15. mixed denials + failures with no authorized result -> ERROR", async () => {
    setDogs([
      ["k9-a", {}],
      ["k9-b", {}],
    ]);
    routeReads({ "k9-a": forbiddenState(), "k9-b": errorState() });

    const { state, coverage } = await loadClinicalScope();

    // Not FORBIDDEN: the denial is not the whole explanation.
    expect(state.status).toBe("error");
    expect(state.status).not.toBe("empty");
    expect(coverage.forbiddenDogIds).toEqual(["k9-a"]);
    expect(coverage.failedDogIds).toEqual(["k9-b"]);
  });

  // 16
  it("16. institutional scope denial -> global FORBIDDEN, zero case reads", async () => {
    mockState.dogsError = permissionDenied();

    const { state } = await loadClinicalScope();

    expect(state.status).toBe("forbidden");
    if (state.status !== "forbidden") throw new Error("expected forbidden");
    expect(state.requiredCapability).toBe("health.read");
    expect(readerMock.read).not.toHaveBeenCalled();
  });

  // 17
  it("17. institutional scope technical failure -> global retryable ERROR", async () => {
    mockState.dogsError = new Error("unavailable: backend did not respond");

    const { state } = await loadClinicalScope();

    expect(state.status).toBe("error");
    if (state.status !== "error") throw new Error("expected error");
    expect(state.code).toBe("CLINICAL_SCOPE_READ_ERROR");
    expect(state.retryable).toBe(true);
    expect(readerMock.read).not.toHaveBeenCalled();
  });

  // 18
  it("18. sorts by lastEventAt ?? openedAt DESC", async () => {
    setDogs([["k9-a", {}]]);
    routeReads({
      "k9-a": successState([
        caseModel("k9-a", "older", { openedAt: new Date("2026-08-01T00:00:00Z") }),
        caseModel("k9-a", "newest", {
          openedAt: new Date("2026-07-01T00:00:00Z"),
          lastEventAt: new Date("2026-08-20T00:00:00Z"),
        }),
        caseModel("k9-a", "middle", { openedAt: new Date("2026-08-10T00:00:00Z") }),
      ]),
    });

    const { state } = await loadClinicalScope();

    if (state.status !== "success") throw new Error("expected success");
    expect(state.data.map((e) => e.caseId)).toEqual(["newest", "middle", "older"]);
  });

  // 19
  it("19. openedAt is used ONLY as a sort anchor, never as lastEventAt", async () => {
    setDogs([["k9-a", {}]]);
    const openedAt = new Date("2026-08-05T00:00:00Z");
    routeReads({ "k9-a": successState([caseModel("k9-a", "c1", { openedAt })]) });

    const { state } = await loadClinicalScope();

    if (state.status !== "success") throw new Error("expected success");
    // No display value was synthesized: lastEventAt stays truthfully null.
    expect(state.data[0].case.lastEventAt).toBeNull();
    expect(state.data[0].case.openedAt).toEqual(openedAt);
  });

  // 20
  it("20. cases with no usable anchor sink last instead of being dropped", async () => {
    setDogs([["k9-a", {}]]);
    routeReads({
      "k9-a": partialState("k9-a", [
        caseModel("k9-a", "no-anchor", { openedAt: null, dataQuality: "partial" }),
        caseModel("k9-a", "anchored", { openedAt: new Date("2026-08-01T00:00:00Z") }),
      ]),
    });

    const { state } = await loadClinicalScope();

    if (state.status !== "partial") throw new Error("expected partial");
    expect(state.partialData.map((e) => e.caseId)).toEqual(["anchored", "no-anchor"]);
    expect(state.partialData).toHaveLength(2);
  });

  // 21
  it("21. ordering is deterministic on ties (caseId then dogId)", async () => {
    const sameInstant = new Date("2026-08-15T00:00:00Z");
    const build = (dogId: string, caseId: string): ClinicalCaseListEntry => ({
      entryId: clinicalEntryId(dogId, caseId),
      dogId,
      caseId,
      dog: { id: dogId } as ClinicalCaseListEntry["dog"],
      case: caseModel(dogId, caseId, { lastEventAt: sameInstant }),
    });

    const forward = sortClinicalListEntries([
      build("k9-z", "c-b"),
      build("k9-a", "c-a"),
      build("k9-b", "c-a"),
    ]);
    const reversed = sortClinicalListEntries([
      build("k9-b", "c-a"),
      build("k9-a", "c-a"),
      build("k9-z", "c-b"),
    ]);

    expect(forward.map((e) => e.entryId)).toEqual([
      "k9-a:c-a",
      "k9-b:c-a",
      "k9-z:c-b",
    ]);
    expect(reversed.map((e) => e.entryId)).toEqual(forward.map((e) => e.entryId));
  });

  // 22
  it("22. entry identity is dogId + caseId, compatible with `${dogId}:${caseId}`", async () => {
    setDogs([
      ["k9-a", {}],
      ["k9-b", {}],
    ]);
    // The SAME caseId under two dogs must remain two distinct list entries.
    routeReads({
      "k9-a": successState([caseModel("k9-a", "shared-id")]),
      "k9-b": successState([caseModel("k9-b", "shared-id")]),
    });

    const { state } = await loadClinicalScope();

    if (state.status !== "success") throw new Error("expected success");
    const ids = state.data.map((e) => e.entryId).sort();
    expect(ids).toEqual(["k9-a:shared-id", "k9-b:shared-id"]);
    expect(new Set(ids).size).toBe(2);
    expect(clinicalEntryId("k9-a", "shared-id")).toBe("k9-a:shared-id");
  });

  // 23
  it("23. composes institutional identity from dogs/{dogId} without mutating the case", async () => {
    setDogs([["k9-a", { nome: "Apollo", rg: "RG-77", raca: "Pastor Belga" }]]);
    const original = caseModel("k9-a", "c1");
    const snapshot = JSON.stringify(original);
    routeReads({ "k9-a": successState([original]) });

    const { state } = await loadClinicalScope();

    if (state.status !== "success") throw new Error("expected success");
    const entry = state.data[0];
    // Identity lives beside the case, mapped by the shared institutional mapper.
    expect(entry.dog.id).toBe("k9-a");
    expect(entry.dog.name).toBe("Apollo");
    expect(entry.dog.registrationNumber).toBe("RG-77");
    expect(entry.dog.breed).toBe("Pastor Belga");
    // The frozen I1 read model is carried unchanged.
    expect(entry.case).toBe(original);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  // 24 — static source guarantee
  it("24. imports no write API, no callable, and no collectionGroup", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(
      path.resolve(__dirname, "../data/clinical-scope-loader.ts"),
      "utf8",
    );
    const firstImport = source.indexOf("\nimport ");
    const code = firstImport >= 0 ? source.slice(firstImport) : source;

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
    for (const callableApi of ["httpsCallable", "getFunctions", "firebase/functions"]) {
      expect(code).not.toContain(callableApi);
    }
    expect(code).not.toContain("collectionGroup");
    // One-shot reads only: no listener may be attached in the list path.
    expect(code).not.toContain("onSnapshot");
    // And the forbidden Readiness fan-out is never invoked.
    expect(code).not.toContain("loadReadinessScope(");
  });
});
