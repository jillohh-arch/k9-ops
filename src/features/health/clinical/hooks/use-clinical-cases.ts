"use client";

/**
 * K9 Ops Web — Health Web v1 HW-6A.I2
 * Clinical case list hook — authority-gated, race-safe scope orchestration.
 *
 * RESPONSIBILITY (I2 §5, §7, §12):
 * - Coordinate the strict authority boundary (`useClinicalReadAuthority`) with
 *   the institutional scope composition (`loadClinicalScope`).
 * - Expose ONE truthful read state for the whole global list, plus coverage.
 * - Guarantee that NO Clinical read is ever started while authority is not
 *   `allowed` (loading or forbidden). This is the §11 security invariant.
 * - Be robust to unmount, authority change and refresh churn: a read that
 *   resolves for a superseded cycle is discarded, never published.
 *
 * DESIGN NOTE (why no setState in the effect body):
 * `loading`, `refreshing` and `forbidden` are DERIVED from authority plus the
 * current read cycle during render. The effect only ever publishes an async
 * result. This keeps the gate a pure function of authority — a forbidden
 * profile cannot transiently render as "loading a list" — and satisfies
 * react-hooks/set-state-in-effect.
 *
 * NON-RESPONSIBILITY:
 * - No UI, no display strings, no ordering decisions (the loader owns those).
 * - One-shot deterministic reads only; no listeners.
 */

import { useCallback, useEffect, useState } from "react";

import type { ReadState } from "../../domain/read-states";
import {
  loadClinicalScope,
  type ClinicalCaseListEntry,
  type ClinicalScopeCoverage,
} from "../data/clinical-scope-loader";
import { CLINICAL_READ_CAPABILITY } from "../data/clinical-cases-reader";
import {
  useClinicalReadAuthority,
  type ClinicalReadAuthorityStatus,
} from "./use-clinical-read-authority";

export interface UseClinicalCasesResult {
  /** Canonical technical state over the composed global Clinical list. */
  state: ReadState<ClinicalCaseListEntry[]>;
  /** Coverage accounting; safe to read in every state (empty until known). */
  coverage: ClinicalScopeCoverage;
  /** Mirror of the authority gate, so a consumer can distinguish causes. */
  authorityStatus: ClinicalReadAuthorityStatus;
  /** Re-runs the one-shot scope read. No-op unless authority is `allowed`. */
  refresh: () => void;
}

const EMPTY_COVERAGE: ClinicalScopeCoverage = {
  dogsInScope: 0,
  authorizedDogIds: [],
  forbiddenDogIds: [],
  failedDogIds: [],
  partialEntryIds: [],
  complete: false,
};

/** Forbidden state derived purely from authority — costs ZERO Firestore reads. */
const FORBIDDEN_STATE: ReadState<ClinicalCaseListEntry[]> = {
  status: "forbidden",
  requiredCapability: CLINICAL_READ_CAPABILITY,
  message:
    "Leitura de casos clínicos não autorizada para o perfil de acesso atual.",
};

const LOADING_STATE: ReadState<ClinicalCaseListEntry[]> = { status: "loading" };

/** A published read, tagged with the cycle that requested it. */
interface ScopeCycleResult {
  cycleKey: string;
  state: ReadState<ClinicalCaseListEntry[]>;
  coverage: ClinicalScopeCoverage;
}

/**
 * Identifies one read cycle. Any change (authority transition or refresh)
 * produces a new key, which invalidates a previously published result.
 */
function toCycleKey(
  authorityStatus: ClinicalReadAuthorityStatus,
  nonce: number,
): string {
  return `${authorityStatus}#${nonce}`;
}

/**
 * Global Clinical case list hook.
 *
 * State progression:
 *   authority loading   -> { status: "loading" }, NO read
 *   authority forbidden -> { status: "forbidden" }, NO read (§11)
 *   authority allowed   -> loading -> loader state (success / empty / partial /
 *                          forbidden / error)
 *   refresh() over a resolved list -> { status: "refreshing", previousData }
 */
export function useClinicalCases(): UseClinicalCasesResult {
  const { status: authorityStatus, canRead } = useClinicalReadAuthority();

  const [result, setResult] = useState<ScopeCycleResult | null>(null);
  // A refresh carries the list that should stay visible while it runs, captured
  // in the event handler (never in an effect).
  const [refreshCycle, setRefreshCycle] = useState<{
    nonce: number;
    previousData: ClinicalCaseListEntry[] | null;
  }>({ nonce: 0, previousData: null });

  const cycleKey = toCycleKey(authorityStatus, refreshCycle.nonce);

  useEffect(() => {
    // §11: while authority is unresolved or denied, no read is even attempted.
    if (authorityStatus !== "allowed") {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const scope = await loadClinicalScope();
        if (cancelled) return;
        setResult({ cycleKey, state: scope.state, coverage: scope.coverage });
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        setResult({
          cycleKey,
          state: {
            status: "error",
            code: "CLINICAL_SCOPE_UNEXPECTED_ERROR",
            message: `Falha inesperada ao compor a lista clínica: ${message}`,
            technicalDetails: String(err),
            retryable: true,
          },
          coverage: EMPTY_COVERAGE,
        });
      }
    })();

    // Unmount, authority change or refresh supersedes this cycle.
    return () => {
      cancelled = true;
    };
  }, [authorityStatus, cycleKey]);

  // --- Derived, authority-first state ---------------------------------------

  let state: ReadState<ClinicalCaseListEntry[]>;
  let coverage: ClinicalScopeCoverage;

  if (authorityStatus === "loading") {
    state = LOADING_STATE;
    coverage = EMPTY_COVERAGE;
  } else if (!canRead) {
    state = FORBIDDEN_STATE;
    coverage = EMPTY_COVERAGE;
  } else if (result && result.cycleKey === cycleKey) {
    state = result.state;
    coverage = result.coverage;
  } else if (refreshCycle.previousData) {
    // A refresh in flight keeps the previously trustworthy list visible.
    state = { status: "refreshing", previousData: refreshCycle.previousData };
    coverage = EMPTY_COVERAGE;
  } else {
    state = LOADING_STATE;
    coverage = EMPTY_COVERAGE;
  }

  const currentData =
    state.status === "success"
      ? state.data
      : state.status === "partial"
        ? state.partialData
        : null;

  const refresh = useCallback(() => {
    // Guard mirrors the effect: refreshing while unauthorized must not read.
    if (!canRead) return;
    setRefreshCycle((prev) => ({
      nonce: prev.nonce + 1,
      previousData: currentData,
    }));
  }, [canRead, currentData]);

  return { state, coverage, authorityStatus, refresh };
}
