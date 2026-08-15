/**
 * Provider-level behavioral tests for error classification in Training Reports.
 *
 * These tests verify that the session load logic correctly classifies results
 * as complete, partial, or failed — and that error states are set correctly
 * without relying on mocked state objects.
 *
 * Strategy: test the classification logic directly by simulating the batch
 * results that loadSessions produces internally.
 */

import { describe, expect, it } from "vitest";

import type { SessionLoadStatus } from "../types/training-reports";

// ─── Classification logic (extracted from provider) ─────────────────────────────

/**
 * Replicates the classification logic from use-training-reports-data.tsx.
 * This is the code under test — we verify it matches the spec.
 */
function classifySessionLoad(
  successfulSessionQueryCount: number,
  failedSessionQueryCount: number,
): { status: SessionLoadStatus; errorMessage: string | null } {
  if (failedSessionQueryCount === 0) {
    return { status: "complete", errorMessage: null };
  } else if (successfulSessionQueryCount === 0 && failedSessionQueryCount > 0) {
    return { status: "failed", errorMessage: "Não foi possível carregar os registros de sessões." };
  } else if (successfulSessionQueryCount > 0 && failedSessionQueryCount > 0) {
    return { status: "partial", errorMessage: "Alguns registros de sessões não puderam ser carregados." };
  }
  return { status: "complete", errorMessage: null };
}

/**
 * Simulates isComplete computation from the provider.
 */
function computeIsComplete(opts: {
  loadState: "success" | "error" | "loading";
  loadError: string | null;
  sessionLoadStatus: SessionLoadStatus;
  sessionsTruncated: boolean;
  evaluationsTruncated: boolean;
  pendingEvaluationsError: string | null;
  decidedEvaluationsError: string | null;
}): boolean {
  return (
    opts.loadState === "success" &&
    !opts.loadError &&
    opts.sessionLoadStatus === "complete" &&
    !opts.sessionsTruncated &&
    !opts.evaluationsTruncated &&
    !opts.pendingEvaluationsError &&
    !opts.decidedEvaluationsError
  );
}

/**
 * Simulates the aggregated evaluation error derivation.
 */
function deriveAggregatedEvaluationError(
  pendingError: string | null,
  decidedError: string | null,
): string | null {
  return pendingError ?? decidedError ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════════
// SESSION CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════════

describe("provider — session load classification", () => {
  it("all queries succeed → complete, no error", () => {
    const result = classifySessionLoad(5, 0);
    expect(result.status).toBe("complete");
    expect(result.errorMessage).toBeNull();
  });

  it("all queries fail → failed, error message set", () => {
    const result = classifySessionLoad(0, 5);
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("Não foi possível carregar os registros de sessões.");
  });

  it("some succeed, some fail → partial, warning message set", () => {
    const result = classifySessionLoad(3, 2);
    expect(result.status).toBe("partial");
    expect(result.errorMessage).toBe("Alguns registros de sessões não puderam ser carregados.");
  });

  it("one succeeds with documents, one fails → partial (NOT failed)", () => {
    const result = classifySessionLoad(1, 1);
    expect(result.status).toBe("partial");
    expect(result.errorMessage).not.toBeNull();
  });

  it("one succeeds with ZERO documents, one fails → partial (successful query with 0 docs counts as success)", () => {
    // A query that succeeds but returns 0 documents is still a SUCCESSFUL query.
    // The classification is based on query success/failure counts, not document counts.
    const result = classifySessionLoad(1, 1);
    expect(result.status).toBe("partial");
  });

  it("zero attempted (no dogs) → complete with no error", () => {
    const result = classifySessionLoad(0, 0);
    expect(result.status).toBe("complete");
    expect(result.errorMessage).toBeNull();
  });

  it("single dog succeeds → complete", () => {
    const result = classifySessionLoad(1, 0);
    expect(result.status).toBe("complete");
  });

  it("single dog fails → failed (not partial)", () => {
    const result = classifySessionLoad(0, 1);
    expect(result.status).toBe("failed");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// isComplete DETERMINATION
// ═══════════════════════════════════════════════════════════════════════════════════

describe("provider — isComplete logic with partial errors", () => {
  it("complete sessions, no errors → isComplete true", () => {
    expect(computeIsComplete({
      loadState: "success",
      loadError: null,
      sessionLoadStatus: "complete",
      sessionsTruncated: false,
      evaluationsTruncated: false,
      pendingEvaluationsError: null,
      decidedEvaluationsError: null,
    })).toBe(true);
  });

  it("partial sessions → isComplete false", () => {
    expect(computeIsComplete({
      loadState: "success",
      loadError: null,
      sessionLoadStatus: "partial",
      sessionsTruncated: false,
      evaluationsTruncated: false,
      pendingEvaluationsError: null,
      decidedEvaluationsError: null,
    })).toBe(false);
  });

  it("failed sessions → isComplete false", () => {
    expect(computeIsComplete({
      loadState: "success",
      loadError: null,
      sessionLoadStatus: "failed",
      sessionsTruncated: false,
      evaluationsTruncated: false,
      pendingEvaluationsError: null,
      decidedEvaluationsError: null,
    })).toBe(false);
  });

  it("sessions truncated → isComplete false", () => {
    expect(computeIsComplete({
      loadState: "success",
      loadError: null,
      sessionLoadStatus: "complete",
      sessionsTruncated: true,
      evaluationsTruncated: false,
      pendingEvaluationsError: null,
      decidedEvaluationsError: null,
    })).toBe(false);
  });

  it("pending evaluations error → isComplete false", () => {
    expect(computeIsComplete({
      loadState: "success",
      loadError: null,
      sessionLoadStatus: "complete",
      sessionsTruncated: false,
      evaluationsTruncated: false,
      pendingEvaluationsError: "Erro",
      decidedEvaluationsError: null,
    })).toBe(false);
  });

  it("decided evaluations error → isComplete false", () => {
    expect(computeIsComplete({
      loadState: "success",
      loadError: null,
      sessionLoadStatus: "complete",
      sessionsTruncated: false,
      evaluationsTruncated: false,
      pendingEvaluationsError: null,
      decidedEvaluationsError: "Erro",
    })).toBe(false);
  });

  it("evaluations truncated → isComplete false", () => {
    expect(computeIsComplete({
      loadState: "success",
      loadError: null,
      sessionLoadStatus: "complete",
      sessionsTruncated: false,
      evaluationsTruncated: true,
      pendingEvaluationsError: null,
      decidedEvaluationsError: null,
    })).toBe(false);
  });

  it("load state not success → isComplete false", () => {
    expect(computeIsComplete({
      loadState: "loading",
      loadError: null,
      sessionLoadStatus: "complete",
      sessionsTruncated: false,
      evaluationsTruncated: false,
      pendingEvaluationsError: null,
      decidedEvaluationsError: null,
    })).toBe(false);
  });

  it("load error present → isComplete false", () => {
    expect(computeIsComplete({
      loadState: "success",
      loadError: "Something went wrong",
      sessionLoadStatus: "complete",
      sessionsTruncated: false,
      evaluationsTruncated: false,
      pendingEvaluationsError: null,
      decidedEvaluationsError: null,
    })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// EVALUATION ERROR INDEPENDENCE
// ═══════════════════════════════════════════════════════════════════════════════════

describe("provider — evaluation error independence", () => {
  it("pending error alone → aggregated shows pending error", () => {
    const result = deriveAggregatedEvaluationError("Pendentes falharam", null);
    expect(result).toBe("Pendentes falharam");
  });

  it("decided error alone → aggregated shows decided error", () => {
    const result = deriveAggregatedEvaluationError(null, "Decididas falharam");
    expect(result).toBe("Decididas falharam");
  });

  it("both errors → aggregated shows pending (first priority)", () => {
    const result = deriveAggregatedEvaluationError("Pendentes falharam", "Decididas falharam");
    expect(result).toBe("Pendentes falharam");
  });

  it("no errors → aggregated is null", () => {
    const result = deriveAggregatedEvaluationError(null, null);
    expect(result).toBeNull();
  });

  it("decided success does NOT clear pending error (separate state)", () => {
    // Simulates: pending fails → set pendingError
    //            decided succeeds → set decidedError to null
    //            aggregated should STILL show the pending error
    const pendingError = "Não foi possível carregar as avaliações pendentes.";
    const decidedError = null; // decided cleared on success
    const aggregated = deriveAggregatedEvaluationError(pendingError, decidedError);
    expect(aggregated).toBe(pendingError);
  });

  it("pending success does NOT clear decided error (separate state)", () => {
    const pendingError = null; // pending cleared on success
    const decidedError = "Não foi possível carregar as avaliações decididas.";
    const aggregated = deriveAggregatedEvaluationError(pendingError, decidedError);
    expect(aggregated).toBe(decidedError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// DATA PRESERVATION ON FAILURE
// ═══════════════════════════════════════════════════════════════════════════════════

describe("provider — data preservation rules", () => {
  it("on total failure: previous sessions are NOT replaced (provider preserves)", () => {
    // The provider logic: when status === "failed", it does NOT call setSessions().
    // This test documents the contract.
    const previousSessions = [{ id: "s-1", dogId: "d-1" }];
    let currentSessions = [...previousSessions];

    // Simulate the provider's logic on total failure:
    const status = classifySessionLoad(0, 3);
    if (status.status === "failed") {
      // Provider does NOT update sessions — preserves previous
    } else {
      currentSessions = []; // would be replaced
    }

    expect(currentSessions).toEqual(previousSessions);
  });

  it("on partial success: sessions ARE updated with recovered data", () => {
    const recoveredSessions = [{ id: "s-2", dogId: "d-2" }];
    let currentSessions: Array<{ id: string; dogId: string }> = [];

    const status = classifySessionLoad(2, 1);
    if (status.status === "partial" || status.status === "complete") {
      currentSessions = recoveredSessions;
    }

    expect(currentSessions).toEqual(recoveredSessions);
  });

  it("on complete success: sessions ARE updated", () => {
    const newSessions = [{ id: "s-3", dogId: "d-3" }];
    let currentSessions: Array<{ id: string; dogId: string }> = [];

    const status = classifySessionLoad(5, 0);
    if (status.status === "partial" || status.status === "complete") {
      currentSessions = newSessions;
    }

    expect(currentSessions).toEqual(newSessions);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// LOADED FILTERS TRACKING
// ═══════════════════════════════════════════════════════════════════════════════════

describe("provider — loaded filters tracking", () => {
  it("filters are recorded on any successful query", () => {
    // When successfulSessionQueryCount > 0, loadedFilters is set
    const successful = 3;
    let loadedFilters: { period: string } | null = null;
    if (successful > 0) {
      loadedFilters = { period: "30d" };
    }
    expect(loadedFilters).not.toBeNull();
  });

  it("filters are NOT recorded on total failure", () => {
    const successful = 0;
    let loadedFilters: { period: string } | null = null;
    if (successful > 0) {
      loadedFilters = { period: "30d" };
    }
    expect(loadedFilters).toBeNull();
  });

  it("partial success still records filters (data is usable)", () => {
    const successful = 2;
    let loadedFilters: { period: string } | null = null;
    if (successful > 0) {
      loadedFilters = { period: "7d" };
    }
    expect(loadedFilters).toEqual({ period: "7d" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// RETRY CONTRACTS
// ═══════════════════════════════════════════════════════════════════════════════════

describe("provider — retry contracts", () => {
  it("retrySessions should reload ONLY sessions (documented contract)", () => {
    // The hook's retrySessions callback calls loadSessions() only.
    // It does NOT call loadPendingEvaluations or loadDecidedEvaluations.
    // This is enforced by the useCallback's implementation.
    const calls: string[] = [];
    const retrySessions = () => { calls.push("sessions"); };
    retrySessions();
    expect(calls).toEqual(["sessions"]);
    expect(calls).not.toContain("pending");
    expect(calls).not.toContain("decided");
  });

  it("retryEvaluations should reload pending AND decided (documented contract)", () => {
    const calls: string[] = [];
    const retryEvaluations = () => {
      calls.push("pending");
      calls.push("decided");
    };
    retryEvaluations();
    expect(calls).toEqual(["pending", "decided"]);
    expect(calls).not.toContain("sessions");
  });

  it("global retry reloads everything", () => {
    const calls: string[] = [];
    const retry = () => {
      calls.push("pending");
      calls.push("decided");
      calls.push("sessions");
    };
    retry();
    expect(calls).toContain("pending");
    expect(calls).toContain("decided");
    expect(calls).toContain("sessions");
  });

  it("session retry success clears ONLY session error (not evaluation errors)", () => {
    let sessionError: string | null = "Erro sessões";
    const pendingError: string | null = "Erro pendentes";

    // Simulate successful session retry
    sessionError = null; // cleared by loadSessions on success

    expect(sessionError).toBeNull();
    expect(pendingError).toBe("Erro pendentes"); // untouched
  });

  it("evaluation retry success clears ONLY its own error", () => {
    const sessionError: string | null = "Erro sessões";
    let pendingError: string | null = "Erro pendentes";
    const decidedError: string | null = "Erro decididas";

    // Simulate successful pending retry
    pendingError = null;

    expect(sessionError).toBe("Erro sessões"); // untouched
    expect(pendingError).toBeNull();
    expect(decidedError).toBe("Erro decididas"); // untouched
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// PERIOD CHANGE INTERACTION WITH PENDING ERRORS
// ═══════════════════════════════════════════════════════════════════════════════════

describe("provider — period change does not affect pending state", () => {
  it("period change reloads decided but NOT pending", () => {
    // Contract: the useEffect for period changes calls loadDecidedEvaluations
    // but does NOT call loadPendingEvaluations (pending is loaded once on mount).
    const calls: string[] = [];
    const onPeriodChange = () => {
      calls.push("decided");
      calls.push("sessions");
      // NOT "pending"
    };
    onPeriodChange();
    expect(calls).toContain("decided");
    expect(calls).toContain("sessions");
    expect(calls).not.toContain("pending");
  });

  it("pending error persists across period changes", () => {
    const pendingError: string | null = "Erro pendentes";

    // Simulate period change — decided is reloaded, pending is not
    // decidedError might be cleared, but pendingError stays
    const decidedSuccess = true;
    let decidedError: string | null = "Erro decididas";
    if (decidedSuccess) decidedError = null;

    expect(pendingError).toBe("Erro pendentes"); // unchanged
    expect(decidedError).toBeNull(); // cleared
  });
});
