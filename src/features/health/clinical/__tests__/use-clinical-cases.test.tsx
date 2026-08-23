/**
 * K9 Ops Web — Health Web v1 HW-6A.I2
 * useClinicalCases — authority gating, state truthfulness, race safety.
 *
 * THE mandatory security test (§11): a profile holding legacy `health.view`
 * without canonical `health.read` resolves to FORBIDDEN and performs ZERO
 * Clinical scope reads.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

// The scope loader is exercised directly by its own suite. Here it is stubbed
// so the hook's gating and race behaviour are what is under test — including
// the assertion that it is NEVER CALLED while unauthorized.
const loaderMock = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../data/clinical-scope-loader", () => ({
  loadClinicalScope: () => loaderMock.load(),
}));

import type { ReadState } from "../../domain/read-states";
import type {
  ClinicalCaseListEntry,
  ClinicalScopeCoverage,
} from "../data/clinical-scope-loader";
import { useClinicalCases } from "../hooks/use-clinical-cases";

function coverage(
  overrides: Partial<ClinicalScopeCoverage> = {},
): ClinicalScopeCoverage {
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

function entry(caseId: string): ClinicalCaseListEntry {
  return {
    entryId: `k9-a:${caseId}`,
    dogId: "k9-a",
    caseId,
    dog: { id: "k9-a", name: "Apollo" } as ClinicalCaseListEntry["dog"],
    case: { dogId: "k9-a", caseId } as ClinicalCaseListEntry["case"],
  };
}

function resolveWith(
  state: ReadState<ClinicalCaseListEntry[]>,
  cov: ClinicalScopeCoverage = coverage(),
) {
  loaderMock.load.mockResolvedValue({ state, coverage: cov });
}

const allowedAccess: MockAccess = {
  status: "ready",
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

describe("HW-6A.I2 — useClinicalCases", () => {
  // 1 — THE mandatory §11 security test
  it("1. health.view without health.read -> forbidden AND ZERO scope reads", async () => {
    accessState.current = legacyViewOnlyAccess;
    resolveWith({ status: "success", data: [entry("c1")], fetchedAt: new Date() });

    const { result } = renderHook(() => useClinicalCases());

    await waitFor(() => {
      expect(result.current.state.status).toBe("forbidden");
    });

    // The load-bearing assertion of this whole slice.
    expect(loaderMock.load).not.toHaveBeenCalled();
    expect(result.current.authorityStatus).toBe("forbidden");
    if (result.current.state.status !== "forbidden") throw new Error("expected forbidden");
    expect(result.current.state.requiredCapability).toBe("health.read");
    expect(result.current.state.requiredCapability).not.toBe("health.view");
  });

  // 2
  it("2. a denial is never presented as emptiness", async () => {
    accessState.current = legacyViewOnlyAccess;

    const { result } = renderHook(() => useClinicalCases());

    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));
    expect(result.current.state.status).not.toBe("empty");
    expect(result.current.state.status).not.toBe("success");
  });

  // 3
  it("3. while authority is loading -> loading, and no read is started", async () => {
    accessState.current = {
      status: "loading",
      profile: { status: "active", permissions: { health: { read: true } } },
    };
    resolveWith({ status: "empty", query: "dogs/*/clinical_cases" });

    const { result } = renderHook(() => useClinicalCases());

    expect(result.current.state.status).toBe("loading");
    expect(result.current.authorityStatus).toBe("loading");
    expect(loaderMock.load).not.toHaveBeenCalled();
  });

  // 4
  it("4. authorized -> starts exactly one scope read and publishes success", async () => {
    resolveWith({ status: "success", data: [entry("c1"), entry("c2")], fetchedAt: new Date() });

    const { result } = renderHook(() => useClinicalCases());

    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(loaderMock.load).toHaveBeenCalledTimes(1);
    if (result.current.state.status !== "success") throw new Error("expected success");
    expect(result.current.state.data).toHaveLength(2);
    expect(result.current.authorityStatus).toBe("allowed");
  });

  // 5
  it("5. forwards a TRUE empty scope without reinterpreting it", async () => {
    resolveWith(
      { status: "empty", query: "dogs/*/clinical_cases" },
      coverage({ complete: true }),
    );

    const { result } = renderHook(() => useClinicalCases());

    await waitFor(() => expect(result.current.state.status).toBe("empty"));
    expect(result.current.coverage.complete).toBe(true);
  });

  // 6
  it("6. forwards partial coverage together with its accounting", async () => {
    resolveWith(
      {
        status: "partial",
        partialData: [entry("c1")],
        failedSources: ["forbidden:dogs/k9-b/clinical_cases"],
        successfulSources: ["dogs/k9-a/clinical_cases"],
      },
      coverage({ dogsInScope: 2, forbiddenDogIds: ["k9-b"], complete: false }),
    );

    const { result } = renderHook(() => useClinicalCases());

    await waitFor(() => expect(result.current.state.status).toBe("partial"));
    if (result.current.state.status !== "partial") throw new Error("expected partial");
    expect(result.current.state.partialData).toHaveLength(1);
    expect(result.current.coverage.forbiddenDogIds).toEqual(["k9-b"]);
    expect(result.current.coverage.complete).toBe(false);
  });

  // 7
  it("7. forwards a scope-level forbidden from the loader", async () => {
    resolveWith(
      {
        status: "forbidden",
        requiredCapability: "health.read",
        message: "denied",
      },
      coverage({ authorizedDogIds: [], forbiddenDogIds: ["k9-a"], complete: false }),
    );

    const { result } = renderHook(() => useClinicalCases());

    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));
    // Authority passed the pre-gate; Rules are still the final authority.
    expect(result.current.authorityStatus).toBe("allowed");
    expect(loaderMock.load).toHaveBeenCalledTimes(1);
  });

  // 8
  it("8. forwards a global error state", async () => {
    resolveWith({
      status: "error",
      code: "CLINICAL_SCOPE_READ_ERROR",
      message: "boom",
      retryable: true,
    });

    const { result } = renderHook(() => useClinicalCases());

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    if (result.current.state.status !== "error") throw new Error("expected error");
    expect(result.current.state.retryable).toBe(true);
  });

  // 9
  it("9. a thrown loader rejection becomes a controlled retryable error", async () => {
    loaderMock.load.mockRejectedValue(new Error("unexpected"));

    const { result } = renderHook(() => useClinicalCases());

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    if (result.current.state.status !== "error") throw new Error("expected error");
    expect(result.current.state.code).toBe("CLINICAL_SCOPE_UNEXPECTED_ERROR");
    expect(result.current.state.status).not.toBe("empty");
  });

  // 10
  it("10. refresh() re-reads and keeps the previous list visible", async () => {
    resolveWith({ status: "success", data: [entry("c1")], fetchedAt: new Date() });

    const { result } = renderHook(() => useClinicalCases());
    await waitFor(() => expect(result.current.state.status).toBe("success"));

    // Hold the second read open so the refreshing state is observable.
    let release: (value: unknown) => void = () => {};
    loaderMock.load.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.state.status).toBe("refreshing"));
    if (result.current.state.status !== "refreshing") throw new Error("expected refreshing");
    expect(result.current.state.previousData).toHaveLength(1);

    await act(async () => {
      release({
        state: { status: "success", data: [entry("c1"), entry("c2")], fetchedAt: new Date() },
        coverage: coverage(),
      });
    });

    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(loaderMock.load).toHaveBeenCalledTimes(2);
  });

  // 11
  it("11. refresh() while forbidden performs no read", async () => {
    accessState.current = legacyViewOnlyAccess;

    const { result } = renderHook(() => useClinicalCases());
    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));

    act(() => result.current.refresh());

    expect(loaderMock.load).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe("forbidden");
  });

  // 12
  it("12. a read resolving after unmount does not publish (no stale write)", async () => {
    let release: (value: unknown) => void = () => {};
    loaderMock.load.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useClinicalCases());
    await waitFor(() => expect(loaderMock.load).toHaveBeenCalledTimes(1));

    unmount();

    // Resolving now must be discarded rather than applied to a dead hook.
    await act(async () => {
      release({
        state: { status: "success", data: [entry("late")], fetchedAt: new Date() },
        coverage: coverage(),
      });
    });

    expect(result.current.state.status).not.toBe("success");
  });

  // 13
  it("13. an authority transition supersedes an in-flight read", async () => {
    // First render is authority-loading: nothing is read.
    accessState.current = {
      status: "loading",
      profile: { status: "active", permissions: { health: { read: true } } },
    };
    resolveWith({ status: "success", data: [entry("c1")], fetchedAt: new Date() });

    const { result, rerender } = renderHook(() => useClinicalCases());
    expect(loaderMock.load).not.toHaveBeenCalled();

    // Authority resolves to forbidden -> still zero reads, forbidden state.
    accessState.current = legacyViewOnlyAccess;
    rerender();

    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));
    expect(loaderMock.load).not.toHaveBeenCalled();

    // Authority then resolves to allowed -> exactly one read now runs.
    accessState.current = allowedAccess;
    rerender();

    await waitFor(() => expect(result.current.state.status).toBe("success"));
    expect(loaderMock.load).toHaveBeenCalledTimes(1);
  });

  // 14
  it("14. coverage is safe to read in every state", async () => {
    accessState.current = legacyViewOnlyAccess;

    const { result } = renderHook(() => useClinicalCases());

    await waitFor(() => expect(result.current.state.status).toBe("forbidden"));
    expect(result.current.coverage.dogsInScope).toBe(0);
    expect(result.current.coverage.forbiddenDogIds).toEqual([]);
    expect(result.current.coverage.complete).toBe(false);
  });

  // 15 — static source guarantee
  it("15. the hook implements no write, callable, listener or UI concern", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(
      path.resolve(__dirname, "../hooks/use-clinical-cases.ts"),
      "utf8",
    );
    const firstImport = source.indexOf("\nimport ");
    const code = firstImport >= 0 ? source.slice(firstImport) : source;

    for (const forbidden of [
      "setDoc",
      "addDoc",
      "updateDoc",
      "deleteDoc",
      "httpsCallable",
      "onSnapshot",
      "collectionGroup",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });
});
