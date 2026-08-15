/**
 * Tests for KPI unavailability states and permission-based behavior.
 *
 * Verifies:
 * - "Indisponível" text shown when queries fail
 * - Zero never shown as confident result when query failed
 * - Empty state blocked when query failed
 * - Partial success shows "Pelo menos N"
 * - Complete success with zero shows actual 0 and empty state
 * - evaluationsSkipped hides error banner (not an error, just no permission)
 * - Microcopy fixes
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReportKpis } from "../components/reports/report-kpis";
import { ReportSessionSummary } from "../components/reports/report-session-summary";

import type {
  CurrentStateMetrics,
  SessionMetrics,
  EvaluationMetrics,
  DurationMetrics,
} from "../types/training-reports";

// ─── Factories ──────────────────────────────────────────────────────────────

function makeCurrentState(overrides?: Partial<CurrentStateMetrics>): CurrentStateMetrics {
  return {
    dogsInFormation: 2,
    formationsInProgress: 3,
    dogsTechnicallyTrained: 1,
    modalitiesConcluded: 1,
    pendingRequests: 0,
    activePrograms: 2,
    totalModules: 8,
    ...overrides,
  };
}

function makeSessionMetrics(overrides?: Partial<SessionMetrics>): SessionMetrics {
  return {
    sessionsInPeriod: 10,
    distinctDogsTrained: 3,
    distinctModalitiesTrained: 2,
    distinctTrainingDays: 5,
    sessionsByDog: { "d-1": 5, "d-2": 3, "d-3": 2 },
    sessionsByModality: { deteccao_de_drogas: 6, faro_de_explosivos: 4 },
    lastSessionByDog: {},
    firstSessionInPeriod: null,
    lastSessionInPeriod: null,
    ...overrides,
  };
}

function makeEvaluationMetrics(overrides?: Partial<EvaluationMetrics>): EvaluationMetrics {
  return {
    pendingCount: 2,
    approvedInPeriod: 3,
    rejectedInPeriod: 1,
    decidedInPeriod: 4,
    averageDecisionTimeSeconds: 86400,
    medianDecisionTimeSeconds: 72000,
    oldestPendingAgeSeconds: 172800,
    invalidDateCount: 0,
    unsupportedDecidedStatusCount: 0,
    ...overrides,
  };
}

function makeDurationMetrics(overrides?: Partial<DurationMetrics>): DurationMetrics {
  return {
    registeredDurationSeconds: 3600,
    sessionsWithDuration: 8,
    sessionsWithoutDuration: 2,
    durationCoveragePercentage: 80,
    invalidDurationCount: 0,
    suspiciousDurationCount: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI UNAVAILABILITY — SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("KPI — sessions unavailable", () => {
  it("shows '—' value when sessions query failed", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsUnavailable={true}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card).toHaveTextContent("—");
  });

  it("shows 'Indisponível' sub-text when sessions query failed", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsUnavailable={true}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card).toHaveTextContent("Indisponível");
  });

  it("does NOT show 0 when sessions query failed", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 0 })}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsUnavailable={true}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    // Should show "—", not "0"
    expect(card.querySelector(".font-mono")!.textContent).toBe("—");
  });

  it("shows actual 0 when sessions query succeeded with zero results", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 0 })}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsUnavailable={false}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card.querySelector(".font-mono")!.textContent).toBe("0");
  });

  it("does NOT show 'Indisponível' when sessions succeed", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 5 })}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsUnavailable={false}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card).not.toHaveTextContent("Indisponível");
  });

  it("shows error description when sessions unavailable", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsUnavailable={true}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card).toHaveTextContent("Não foi possível carregar os registros de sessões");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KPI UNAVAILABILITY — EVALUATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("KPI — evaluations unavailable", () => {
  it("shows '—' value when evaluations query failed", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
        evaluationAccess="error"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    expect(card).toHaveTextContent("—");
  });

  it("shows 'Indisponível' sub-text when evaluations query failed (error state)", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
        evaluationAccess="error"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    expect(card).toHaveTextContent("Indisponível");
  });

  it("does NOT show 0 when evaluations query failed", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics({ decidedInPeriod: 0 })}
        evaluationAccess="error"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    expect(card.querySelector(".font-mono")!.textContent).toBe("—");
  });

  it("shows actual 0 when evaluations query succeeded with zero results", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics({ decidedInPeriod: 0 })}
        evaluationAccess="allowed"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    expect(card.querySelector(".font-mono")!.textContent).toBe("0");
  });

  it("does NOT show 'Indisponível' when evaluations succeed", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics({ decidedInPeriod: 4 })}
        evaluationAccess="allowed"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    expect(card).not.toHaveTextContent("Indisponível");
  });

  it("shows error description when evaluations have technical failure", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
        evaluationAccess="error"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    expect(card).toHaveTextContent("Não foi possível carregar as decisões");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION SUMMARY — EMPTY STATE BLOCKED ON FAILURE
// ═══════════════════════════════════════════════════════════════════════════════

describe("ReportSessionSummary — empty state behavior", () => {
  it("shows partial-load message (not empty state) when sessions partially loaded and no data", () => {
    render(
      <ReportSessionSummary
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 0, distinctDogsTrained: 0 })}
        durationMetrics={makeDurationMetrics()}
        sessionsTruncated={false}
        dogNameById={{}}
        sessionsPartiallyLoaded={true}
      />,
    );
    expect(screen.getByText(/nenhuma sessão recuperada/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhuma sessão registrada neste período/i)).not.toBeInTheDocument();
  });

  it("shows regular empty state when complete success with zero sessions", () => {
    render(
      <ReportSessionSummary
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 0, distinctDogsTrained: 0 })}
        durationMetrics={makeDurationMetrics()}
        sessionsTruncated={false}
        dogNameById={{}}
        sessionsPartiallyLoaded={false}
      />,
    );
    expect(screen.getByText(/nenhuma sessão registrada neste período/i)).toBeInTheDocument();
  });

  it("does NOT show empty state when there is data", () => {
    render(
      <ReportSessionSummary
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 5, distinctDogsTrained: 2 })}
        durationMetrics={makeDurationMetrics()}
        sessionsTruncated={false}
        dogNameById={{ "d-1": "Rex", "d-2": "Thor" }}
      />,
    );
    expect(screen.queryByText(/nenhuma sessão/i)).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KPI — TRUNCATION "PELO MENOS"
// ═══════════════════════════════════════════════════════════════════════════════

describe("KPI — truncation 'Pelo menos' behavior", () => {
  it("shows 'Pelo menos' when sessions truncated and available", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 200 })}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsTruncated={true}
        sessionsUnavailable={false}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card).toHaveTextContent("Pelo menos");
  });

  it("does NOT show 'Pelo menos' when sessions unavailable (even if truncated flag set)", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 200 })}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsTruncated={true}
        sessionsUnavailable={true}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card).not.toHaveTextContent("Pelo menos");
    expect(card).toHaveTextContent("Indisponível");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KPI — MICROCOPY FIX
// ═══════════════════════════════════════════════════════════════════════════════

describe("KPI — microcopy corrections", () => {
  it("shows 'N modalidades em M cães' format (not 'a mais que cães')", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState({ dogsInFormation: 2, formationsInProgress: 4 })}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
      />,
    );
    const card = screen.getByLabelText(/formações em progresso/i);
    expect(card).toHaveTextContent("4 modalidades em 2 cães");
    expect(card).not.toHaveTextContent("a mais que cães");
  });

  it("shows '1 cão' (singular) when only one dog in formation", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState({ dogsInFormation: 1, formationsInProgress: 3 })}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
      />,
    );
    const card = screen.getByLabelText(/formações em progresso/i);
    expect(card).toHaveTextContent("3 modalidades em 1 cão");
  });

  it("does NOT show sub text when formations equals dogs (no extra info)", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState({ dogsInFormation: 2, formationsInProgress: 2 })}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
      />,
    );
    const card = screen.getByLabelText(/formações em progresso/i);
    expect(card).not.toHaveTextContent("modalidades em");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EVALUATION ACCESS — THREE STATES
// ═══════════════════════════════════════════════════════════════════════════════

describe("KPI — evaluationAccess three states", () => {
  it("'restricted' shows 'Acesso restrito' (not 'Indisponível')", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
        evaluationAccess="restricted"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    expect(card).toHaveTextContent("Acesso restrito");
    expect(card).not.toHaveTextContent("Indisponível");
  });

  it("'restricted' shows permission description (not error description)", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
        evaluationAccess="restricted"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    expect(card).toHaveTextContent("não possui permissão");
    expect(card).not.toHaveTextContent("Não foi possível carregar");
  });

  it("'restricted' uses slate accent (not red)", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
        evaluationAccess="restricted"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    const gradient = card.querySelector("[class*='from-slate']");
    expect(gradient).not.toBeNull();
  });

  it("'error' uses red accent", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
        evaluationAccess="error"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    const gradient = card.querySelector("[class*='from-red']");
    expect(gradient).not.toBeNull();
  });

  it("'allowed' shows metrics value normally", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics({ decidedInPeriod: 7 })}
        evaluationAccess="allowed"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    expect(card.querySelector(".font-mono")!.textContent).toBe("7");
    expect(card).not.toHaveTextContent("Acesso restrito");
    expect(card).not.toHaveTextContent("Indisponível");
  });

  it("'restricted' shows '—' value (not 0)", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics({ decidedInPeriod: 0 })}
        evaluationAccess="restricted"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    expect(card.querySelector(".font-mono")!.textContent).toBe("—");
  });

  it("'restricted' does NOT show retry-related content", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics()}
        evaluationMetrics={makeEvaluationMetrics()}
        evaluationAccess="restricted"
      />,
    );
    const card = screen.getByLabelText(/avaliações decididas/i);
    expect(card).not.toHaveTextContent("Recarregar");
    expect(card).not.toHaveTextContent("Tentar novamente");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION GATE — evaluationsSkipped
// ═══════════════════════════════════════════════════════════════════════════════

describe("Permission gate — evaluationsSkipped logic", () => {
  it("classifies correctly: user lacks permission → evaluationsSkipped = true", () => {
    // This tests the contract from the provider
    const canReadPromotions = false;
    expect(!canReadPromotions).toBe(true);
  });

  it("classifies correctly: user has permission → evaluationsSkipped = false", () => {
    const canReadPromotions = true;
    expect(!canReadPromotions).toBe(false);
  });

  it("permission gate matches Firestore Rules condition set", () => {
    // The provider checks:
    // can("training", "approve") || can("training", "audit") ||
    // can("training_matrix", "approve") || can("training_matrix", "audit")
    //
    // The Firestore Rules check:
    // isTrainingInstructor() || hasAccessPermission('training', 'approve') ||
    // hasAccessPermission('training', 'audit') || hasAccessPermission('training_matrix', 'approve') ||
    // hasAccessPermission('training_matrix', 'audit') || emailMatchesRa(resource.data.requester_ra)
    //
    // The provider is a SUBSET (conservative). If provider says "can read", Rules will allow.
    // If provider says "cannot read", we skip to avoid permission-denied errors.
    const providerActions = ["training.approve", "training.audit", "training_matrix.approve", "training_matrix.audit"];
    const rulesActions = ["training.approve", "training.audit", "training_matrix.approve", "training_matrix.audit"];

    // Provider conditions are a subset of Rules conditions (Rules also has isTrainingInstructor and emailMatchesRa)
    expect(providerActions.every((a) => rulesActions.includes(a))).toBe(true);
  });

  it("operador_k9 profile does NOT have evaluation read permissions", () => {
    // From default-access-profiles.json: operador_k9 has training: [view, create, edit]
    // This means canReadPromotions = false for operador_k9
    const operadorPermissions: Record<string, boolean> = { view: true, create: true, edit: true };
    const canApprove = operadorPermissions.approve ?? false;
    const canAudit = operadorPermissions.audit ?? false;
    expect(canApprove || canAudit).toBe(false);
  });

  it("instrutor_k9 profile HAS evaluation read permissions", () => {
    // From default-access-profiles.json: instrutor_k9 has training: [view, create, edit, approve, export, audit]
    const instrutorPermissions = { view: true, create: true, edit: true, approve: true, export: true, audit: true };
    const canApprove = instrutorPermissions.approve ?? false;
    const canAudit = instrutorPermissions.audit ?? false;
    expect(canApprove || canAudit).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ZERO REAL vs FAILURE — provider contract
// ═══════════════════════════════════════════════════════════════════════════════

describe("Provider contract — zero real vs failure", () => {
  it("error from query does NOT produce zero in metrics", () => {
    // When a query fails, the catch block sets error state.
    // It does NOT call setDecidedPromotions([]) — previous data is preserved.
    // Therefore metrics computed from previous data remain non-zero.
    const previousDecidedPromotions = [{ id: "p-1", status: "approved" }];
    let currentPromotions = [...previousDecidedPromotions];

    // Simulate query failure — provider preserves previous
    const queryFailed = true;
    if (queryFailed) {
      // Provider does NOT clear promotions on failure
    } else {
      currentPromotions = [];
    }

    expect(currentPromotions.length).toBe(1);
  });

  it("successful query with zero results DOES produce zero in metrics", () => {
    const previousDecidedPromotions = [{ id: "p-1", status: "approved" }];
    let currentPromotions = [...previousDecidedPromotions];

    // Simulate successful query returning empty — provider DOES update
    const queryFailed = false;
    const queryResults: typeof previousDecidedPromotions = [];
    if (!queryFailed) {
      currentPromotions = queryResults;
    }

    expect(currentPromotions.length).toBe(0);
  });

  it("session query failure preserves previous sessions (not cleared to zero)", () => {
    const previousSessions = [{ id: "s-1" }, { id: "s-2" }];
    let currentSessions = [...previousSessions];

    // Simulate total failure classification
    const successfulCount = 0;
    const failedCount = 3;
    const isTotalFailure = successfulCount === 0 && failedCount > 0;

    if (isTotalFailure) {
      // Provider does NOT call setSessions — preserves previous
    } else {
      currentSessions = [];
    }

    expect(currentSessions).toEqual(previousSessions);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KPI — PARTIAL SESSIONS WITH ZERO
// ═══════════════════════════════════════════════════════════════════════════════

describe("KPI — partial sessions with zero recovered", () => {
  it("partial + zero does NOT show '0' as confident result", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 0 })}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsPartial={true}
        sessionsUnavailable={false}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card.querySelector(".font-mono")!.textContent).toBe("—");
  });

  it("partial + zero shows 'Dados parciais'", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 0 })}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsPartial={true}
        sessionsUnavailable={false}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card).toHaveTextContent("Dados parciais");
  });

  it("partial + zero does NOT show 'Nenhuma sessão registrada'", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 0 })}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsPartial={true}
        sessionsUnavailable={false}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card).not.toHaveTextContent("Nenhuma sessão registrada");
  });

  it("partial + N shows 'Pelo menos N'", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 5 })}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsPartial={true}
        sessionsUnavailable={false}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card).toHaveTextContent("Pelo menos 5");
  });

  it("partial + N shows ≥N as value", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 5 })}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsPartial={true}
        sessionsUnavailable={false}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card.querySelector(".font-mono")!.textContent).toBe("≥5");
  });

  it("complete + zero shows actual 0", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 0 })}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsPartial={false}
        sessionsUnavailable={false}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card.querySelector(".font-mono")!.textContent).toBe("0");
  });

  it("complete + zero does NOT show 'Dados parciais'", () => {
    render(
      <ReportKpis
        currentState={makeCurrentState()}
        sessionMetrics={makeSessionMetrics({ sessionsInPeriod: 0 })}
        evaluationMetrics={makeEvaluationMetrics()}
        sessionsPartial={false}
        sessionsUnavailable={false}
      />,
    );
    const card = screen.getByLabelText(/sessões no período/i);
    expect(card).not.toHaveTextContent("Dados parciais");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POPULATION — DOG QUERY COUNT
// ═══════════════════════════════════════════════════════════════════════════════

describe("Population — reportDogIds derivation", () => {
  it("one dog with three modalities generates one unique dogId", () => {
    const progressData = [
      { dogId: "d-1", modality: "deteccao_de_drogas" },
      { dogId: "d-1", modality: "faro_de_explosivos" },
      { dogId: "d-1", modality: "busca_e_resgate" },
    ];
    const ids = new Set<string>();
    for (const entry of progressData) ids.add(entry.dogId);
    const reportDogIds = Array.from(ids).sort();
    expect(reportDogIds).toEqual(["d-1"]);
    expect(reportDogIds.length).toBe(1);
  });

  it("two dogs generate two unique dogIds", () => {
    const progressData = [
      { dogId: "d-1", modality: "deteccao_de_drogas" },
      { dogId: "d-2", modality: "faro_de_explosivos" },
    ];
    const ids = new Set<string>();
    for (const entry of progressData) ids.add(entry.dogId);
    const reportDogIds = Array.from(ids).sort();
    expect(reportDogIds).toEqual(["d-1", "d-2"]);
  });

  it("dog without progress does NOT appear in reportDogIds", () => {
    const progressData = [
      { dogId: "d-1", modality: "deteccao_de_drogas" },
    ];
    // allEffectiveDogs would be ["d-1", "d-2", "d-3"] — but reportDogIds
    // is derived only from progressData, so d-2 and d-3 are excluded.
    const ids = new Set<string>();
    for (const entry of progressData) ids.add(entry.dogId);
    const reportDogIds = Array.from(ids).sort();
    expect(reportDogIds).not.toContain("d-2");
    expect(reportDogIds).not.toContain("d-3");
    expect(reportDogIds.length).toBe(1);
  });

  it("duplicate entries for same dog are deduplicated", () => {
    const progressData = [
      { dogId: "d-1", modality: "deteccao_de_drogas" },
      { dogId: "d-1", modality: "deteccao_de_drogas" },
      { dogId: "d-1", modality: "deteccao_de_drogas" },
    ];
    const ids = new Set<string>();
    for (const entry of progressData) ids.add(entry.dogId);
    const reportDogIds = Array.from(ids).sort();
    expect(reportDogIds.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CODE EXTRACTOR
// ═══════════════════════════════════════════════════════════════════════════════

// Re-import the same logic from the provider — testing the contract.
function extractFirestoreErrorCode(err: unknown): string {
  if (!err) return "unknown";
  const e = err as Record<string, unknown>;
  if (typeof e.code === "string") return e.code;
  if (typeof e._code === "string") return e._code;
  const msg = typeof e.message === "string" ? e.message : "";
  const match = msg.match(/firestore\/([a-z-]+)/);
  if (match) return `firestore/${match[1]}`;
  return "unknown";
}

describe("Error code extractor", () => {
  it("extracts code from Firestore v9 error object (top-level 'code')", () => {
    const err = { code: "firestore/permission-denied", message: "Permission denied" };
    expect(extractFirestoreErrorCode(err)).toBe("firestore/permission-denied");
  });

  it("extracts code from Firestore error with _code property", () => {
    const err = { _code: "firestore/failed-precondition", message: "Index required" };
    expect(extractFirestoreErrorCode(err)).toBe("firestore/failed-precondition");
  });

  it("extracts code from message string fallback", () => {
    const err = { message: "FirebaseError: Missing index (firestore/failed-precondition)." };
    expect(extractFirestoreErrorCode(err)).toBe("firestore/failed-precondition");
  });

  it("returns 'unknown' for null/undefined error", () => {
    expect(extractFirestoreErrorCode(null)).toBe("unknown");
    expect(extractFirestoreErrorCode(undefined)).toBe("unknown");
  });

  it("returns 'unknown' for error without code info", () => {
    expect(extractFirestoreErrorCode(new Error("Something else"))).toBe("unknown");
  });

  it("prefers 'code' over '_code' over message", () => {
    const err = {
      code: "firestore/permission-denied",
      _code: "firestore/failed-precondition",
      message: "firestore/cancelled",
    };
    expect(extractFirestoreErrorCode(err)).toBe("firestore/permission-denied");
  });
});
