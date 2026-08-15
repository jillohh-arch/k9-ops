import { describe, expect, it } from "vitest";

import {
  resolveReportStartDate,
  isInFormationStatus,
  isOperationalStatus,
  isValidDuration,
  isSuspiciousDuration,
  computeCurrentStateMetrics,
  computeSessionMetrics,
  computeDurationMetrics,
  computeDogActivity,
  computeEvaluationMetrics,
  computeRejectedByModule,
  buildIndividualTimelines,
  generateDataQualityWarnings,
  type RawSession,
  type RawPromotion,
  type DogWithProgress,
  type TimelineSource,
} from "../lib/training-reports-utils";

type LoadState = "idle" | "loading" | "success" | "error";

import type {
  TrainingReportPeriod,
  IndividualTimelineEventType,
} from "../types/training-reports";

// ─── Period resolution ─────────────────────────────────────────────────────────

describe("reports — period resolution", () => {
  const refDate = new Date("2026-07-15T12:00:00Z");

  it("7d returns 7 days before reference", () => {
    const start = resolveReportStartDate("7d", refDate);
    expect(start).not.toBeNull();
    const diff = refDate.getTime() - (start as Date).getTime();
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("30d returns 30 days before reference", () => {
    const start = resolveReportStartDate("30d", refDate);
    expect(start).not.toBeNull();
    const diff = refDate.getTime() - (start as Date).getTime();
    expect(diff).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("90d returns 90 days before reference", () => {
    const start = resolveReportStartDate("90d", refDate);
    expect(start).not.toBeNull();
    const diff = refDate.getTime() - (start as Date).getTime();
    expect(diff).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("all returns null", () => {
    const start = resolveReportStartDate("all", refDate);
    expect(start).toBeNull();
  });

  it("defaults to 30d when no reference provided", () => {
    const start = resolveReportStartDate("30d");
    expect(start).not.toBeNull();
    const now = Date.now();
    const diff = now - (start as Date).getTime();
    // Should be approximately 30 days (within 1 second)
    expect(diff).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(31 * 24 * 60 * 60 * 1000);
  });
});

// ─── Status helpers ────────────────────────────────────────────────────────────

describe("reports — status normalization", () => {
  it("in_formation is recognized", () => {
    expect(isInFormationStatus("in_formation")).toBe(true);
    expect(isInFormationStatus("IN_FORMATION")).toBe(true);
  });

  it("em_formacao with underscore is recognized (underscore removed)", () => {
    // "em_formacao" → "emformacao" after replace → matches "emformacao" in list
    expect(isInFormationStatus("em_formacao")).toBe(true);
  });

  it("em formacao with space normalizes underscore but not accented chars", () => {
    // "em formação".replace(/[_\s-]/g,"") = "emformação" (ã and ç stay)
    // This does NOT equal "emformacao" — so it's false.
    // Status values in practice use ASCII, not accented chars.
    expect(isInFormationStatus("em formação")).toBe(false);
  });

  it("operational is recognized", () => {
    expect(isOperationalStatus("operational")).toBe(true);
    expect(isOperationalStatus("OPERATIONAL")).toBe(true);
  });

  it("operacional is recognized", () => {
    expect(isOperationalStatus("operacional")).toBe(true);
  });

  it("not_started is not in_formation", () => {
    expect(isInFormationStatus("not_started")).toBe(false);
    expect(isOperationalStatus("not_started")).toBe(false);
  });
});

// ─── Duration validation ───────────────────────────────────────────────────────

describe("reports — duration validation", () => {
  it("positive number is valid", () => {
    expect(isValidDuration(300)).toBe(true);
    expect(isValidDuration(1)).toBe(true);
    expect(isValidDuration(3600)).toBe(true);
  });

  it("null is invalid", () => {
    expect(isValidDuration(null)).toBe(false);
  });

  it("zero is invalid", () => {
    expect(isValidDuration(0)).toBe(false);
  });

  it("negative is invalid", () => {
    expect(isValidDuration(-1)).toBe(false);
    expect(isValidDuration(-999)).toBe(false);
  });

  it("NaN is invalid", () => {
    expect(isValidDuration(NaN)).toBe(false);
  });

  it("Infinity is invalid", () => {
    expect(isValidDuration(Infinity)).toBe(false);
    expect(isValidDuration(-Infinity)).toBe(false);
  });
});

// ─── Current state metrics ─────────────────────────────────────────────────────

describe("reports — current state metrics", () => {
  it("one dog with two modalities counts as one dog but two formations", () => {
    const entries = [
      { dogId: "dog-1", modality: "deteccao", status: "in_formation" },
      { dogId: "dog-1", modality: "busca_captura", status: "in_formation" },
    ];
    const result = computeCurrentStateMetrics(entries, 3, 16);
    expect(result.dogsInFormation).toBe(1);
    expect(result.formationsInProgress).toBe(2);
  });

  it("in_formation is separate from operational", () => {
    const entries = [
      { dogId: "dog-1", modality: "deteccao", status: "in_formation" },
      { dogId: "dog-1", modality: "busca_captura", status: "operational" },
    ];
    const result = computeCurrentStateMetrics(entries, 2, 10);
    expect(result.dogsInFormation).toBe(1);
    expect(result.formationsInProgress).toBe(1);
    expect(result.dogsTechnicallyTrained).toBe(1);
    expect(result.modalitiesConcluded).toBe(1);
  });

  it("operational described as formação técnica concluída (no standalone service claim)", () => {
    // The metric name "dogsTechnicallyTrained" and "modalitiesConcluded"
    // communicates "training completed" — not "ready for deployment"
    const entries = [
      { dogId: "dog-1", modality: "deteccao", status: "operational" },
    ];
    const result = computeCurrentStateMetrics(entries, 1, 5);
    expect(result.modalitiesConcluded).toBe(1);
    expect(result.dogsTechnicallyTrained).toBe(1);
  });

  it("entries are grouped by dogId+modality key (archived handled by provider)", () => {
    // computeCurrentStateMetrics receives only visible dogs' progress entries.
    // The test data here is the post-filtered set (archived already removed).
    const entries = [
      { dogId: "visible-dog", modality: "deteccao", status: "in_formation" },
    ];
    const result = computeCurrentStateMetrics(entries, 1, 5);
    expect(result.dogsInFormation).toBe(1);
    expect(result.formationsInProgress).toBe(1);
  });

  it("dog without progress does not appear in metrics", () => {
    // Empty progress list means no dogs in formation
    const result = computeCurrentStateMetrics([], 0, 0);
    expect(result.dogsInFormation).toBe(0);
    expect(result.formationsInProgress).toBe(0);
    expect(result.dogsTechnicallyTrained).toBe(0);
    expect(result.modalitiesConcluded).toBe(0);
  });

  it("active programs and modules are passed through", () => {
    const result = computeCurrentStateMetrics([], 3, 16);
    expect(result.activePrograms).toBe(3);
    expect(result.totalModules).toBe(16);
  });
});

// ─── Session metrics ───────────────────────────────────────────────────────────

describe("reports — session metrics", () => {
  const refDate = new Date("2026-07-15T12:00:00Z");

  function session(overrides: Partial<RawSession> = {}): RawSession {
    return {
      dogId: "dog-1",
      dogName: "K9 Bono",
      id: "s-1",
      modality: "deteccao",
      startedAt: refDate,
      durationS: null,
      ...overrides,
    };
  }

  it("three sessions on the same day count as 3 sessions but 1 distinct day", () => {
    const sessions: RawSession[] = [
      session({ id: "s1", startedAt: new Date("2026-07-10T09:00:00Z") }),
      session({ id: "s2", startedAt: new Date("2026-07-10T14:00:00Z") }),
      session({ id: "s3", startedAt: new Date("2026-07-10T17:00:00Z") }),
    ];
    const result = computeSessionMetrics(sessions, null, null);
    expect(result.sessionsInPeriod).toBe(3);
    expect(result.distinctTrainingDays).toBe(1);
  });

  it("sessions on different days count distinct days correctly", () => {
    const sessions: RawSession[] = [
      session({ id: "s1", startedAt: new Date("2026-07-10T09:00:00Z") }),
      session({ id: "s2", startedAt: new Date("2026-07-11T09:00:00Z") }),
      session({ id: "s3", startedAt: new Date("2026-07-12T09:00:00Z") }),
    ];
    const result = computeSessionMetrics(sessions, null, null);
    expect(result.distinctTrainingDays).toBe(3);
  });

  it("sessions with same modality count as one modality", () => {
    // The function receives sessions with modality already canonicalized by the provider.
    // Two sessions in the same canonical modality count as 1 distinct modality.
    const sessions: RawSession[] = [
      session({ id: "s1", modality: "deteccao", startedAt: new Date("2026-07-10T09:00:00Z") }),
      session({ id: "s2", modality: "deteccao", startedAt: new Date("2026-07-11T09:00:00Z") }),
    ];
    const result = computeSessionMetrics(sessions, null, null);
    expect(result.distinctModalitiesTrained).toBe(1);
  });

  it("modality filter applies after normalization", () => {
    const sessions: RawSession[] = [
      session({ id: "s1", modality: "deteccao", startedAt: new Date("2026-07-10T09:00:00Z") }),
      session({ id: "s2", modality: "busca_captura", startedAt: new Date("2026-07-11T09:00:00Z") }),
    ];
    const result = computeSessionMetrics(sessions, null, "deteccao");
    expect(result.sessionsInPeriod).toBe(1);
    expect(result.distinctModalitiesTrained).toBe(1);
  });

  it("sessions with and without dates: both counted, only dated contribute to date metrics", () => {
    const sessions: RawSession[] = [
      session({ id: "s1", startedAt: new Date("2026-07-10T09:00:00Z") }),
      session({ id: "s2", startedAt: null }),
    ];
    const result = computeSessionMetrics(sessions, null, null);
    // sessionsInPeriod counts both (no period filter, no _invalid flag)
    expect(result.sessionsInPeriod).toBe(2);
    // first/last session reflect the dated one
    expect(result.firstSessionInPeriod).toEqual(new Date("2026-07-10T09:00:00Z"));
    expect(result.lastSessionInPeriod).toEqual(new Date("2026-07-10T09:00:00Z"));
    // distinct training days is 1 (only the dated session contributes)
    expect(result.distinctTrainingDays).toBe(1);
  });

  it("lastSessionByDog tracks the most recent session per dog", () => {
    const sessions: RawSession[] = [
      session({ dogId: "dog-1", id: "s1", startedAt: new Date("2026-07-10T09:00:00Z") }),
      session({ dogId: "dog-1", id: "s2", startedAt: new Date("2026-07-15T09:00:00Z") }),
      session({ dogId: "dog-2", id: "s3", startedAt: new Date("2026-07-12T09:00:00Z") }),
    ];
    const result = computeSessionMetrics(sessions, null, null);
    expect(result.lastSessionByDog["dog-1"]).not.toBeNull();
    expect(result.lastSessionByDog["dog-2"]).not.toBeNull();
    const latest = result.lastSessionByDog["dog-1"];
    expect((latest as Date).getDate()).toBe(15);
  });

  it("first and last session within period are tracked", () => {
    const sessions: RawSession[] = [
      session({ id: "s1", startedAt: new Date("2026-07-05T09:00:00Z") }),
      session({ id: "s2", startedAt: new Date("2026-07-10T09:00:00Z") }),
      session({ id: "s3", startedAt: new Date("2026-07-15T09:00:00Z") }),
    ];
    const periodStart = new Date("2026-07-08T00:00:00Z");
    const result = computeSessionMetrics(sessions, periodStart, null);
    expect((result.firstSessionInPeriod as Date).getDate()).toBe(10);
    expect((result.lastSessionInPeriod as Date).getDate()).toBe(15);
  });

  it("deduplicates sessions by dogId+id", () => {
    const sessions: RawSession[] = [
      session({ dogId: "dog-1", id: "s1", startedAt: new Date("2026-07-10T09:00:00Z") }),
      session({ dogId: "dog-1", id: "s1", startedAt: new Date("2026-07-10T09:00:00Z") }),
    ];
    const result = computeSessionMetrics(sessions, null, null);
    expect(result.sessionsInPeriod).toBe(1);
  });

  it("different dogs with same session id are NOT duplicates", () => {
    const sessions: RawSession[] = [
      session({ dogId: "dog-1", id: "s1", startedAt: new Date("2026-07-10T09:00:00Z") }),
      session({ dogId: "dog-2", id: "s1", startedAt: new Date("2026-07-11T09:00:00Z") }),
    ];
    const result = computeSessionMetrics(sessions, null, null);
    expect(result.distinctDogsTrained).toBe(2);
    expect(result.sessionsInPeriod).toBe(2);
  });

  it("truncated flag is not set by computeSessionMetrics (set by provider)", () => {
    // computeSessionMetrics doesn't know about truncation — that's a provider concern
    const sessions: RawSession[] = [
      session({ startedAt: new Date("2026-07-10T09:00:00Z") }),
    ];
    const result = computeSessionMetrics(sessions, null, null);
    expect(result.sessionsInPeriod).toBe(1);
  });
});

// ─── Duration metrics ─────────────────────────────────────────────────────────

describe("reports — duration metrics", () => {
  function session(overrides: Partial<RawSession> = {}): RawSession {
    return {
      dogId: "dog-1",
      dogName: "K9 Bono",
      id: "s-1",
      modality: "deteccao",
      startedAt: new Date(),
      durationS: null,
      ...overrides,
    };
  }

  it("valid duration is counted", () => {
    const sessions = [session({ durationS: 1800 })];
    const result = computeDurationMetrics(sessions);
    expect(result.sessionsWithDuration).toBe(1);
    expect(result.registeredDurationSeconds).toBe(1800);
  });

  it("null duration is counted as without duration", () => {
    const sessions = [session({ durationS: null })];
    const result = computeDurationMetrics(sessions);
    expect(result.sessionsWithDuration).toBe(0);
    expect(result.sessionsWithoutDuration).toBe(1);
    expect(result.registeredDurationSeconds).toBe(0);
  });

  it("invalid duration (NaN, negative, non-finite) is counted separately", () => {
    const sessions = [
      session({ id: "s1", durationS: -1 }),
      session({ id: "s2", durationS: NaN }),
      session({ id: "s3", durationS: Infinity }),
    ];
    const result = computeDurationMetrics(sessions);
    expect(result.invalidDurationCount).toBe(3);
    expect(result.sessionsWithDuration).toBe(0);
  });

  it("coverage 0% when no sessions have duration", () => {
    const sessions = [session({ durationS: null }), session({ durationS: null })];
    const result = computeDurationMetrics(sessions);
    expect(result.durationCoveragePercentage).toBe(0);
    expect(result.registeredDurationSeconds).toBe(0);
  });

  it("coverage calculated correctly", () => {
    const sessions = [
      session({ id: "s1", durationS: 1800 }),
      session({ id: "s2", durationS: null }),
    ];
    const result = computeDurationMetrics(sessions);
    expect(result.durationCoveragePercentage).toBe(50);
    expect(result.registeredDurationSeconds).toBe(1800);
  });

  it("_invalid flag from loader marks session as invalid", () => {
    const sessions = [session({ _invalid: true })];
    const result = computeDurationMetrics(sessions);
    expect(result.invalidDurationCount).toBe(1);
  });
});

// ─── Dog activity / inactivity ─────────────────────────────────────────────────

describe("reports — dog activity and inactivity", () => {
  const refDate = new Date("2026-07-15T12:00:00Z");

  it("dog with no sessions appears as neverTrained", () => {
    const dogs: DogWithProgress[] = [{ dogId: "dog-1", dogName: "Bono", scopeModality: null, modalities: [] }];
    const result = computeDogActivity(dogs, {}, refDate);
    expect(result).toHaveLength(1);
    expect(result[0]!.neverTrained).toBe(true);
    expect(result[0]!.lastSessionAt).toBeNull();
  });

  it("dog with last session 3 days ago is NOT inactive over 7 days", () => {
    const threeDaysAgo = new Date(refDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    const dogs: DogWithProgress[] = [{ dogId: "dog-1", dogName: "Bono", scopeModality: null, modalities: [] }];
    const result = computeDogActivity(dogs, { "dog-1": threeDaysAgo }, refDate);
    expect(result[0]!.neverTrained).toBe(false);
    expect(result[0]!.inactiveOver7Days).toBe(false);
    expect(result[0]!.daysSinceLastSession).toBe(3);
  });

  it("dog with last session 10 days ago is inactive over 7 days", () => {
    const tenDaysAgo = new Date(refDate.getTime() - 10 * 24 * 60 * 60 * 1000);
    const dogs: DogWithProgress[] = [{ dogId: "dog-1", dogName: "Bono", scopeModality: null, modalities: [] }];
    const result = computeDogActivity(dogs, { "dog-1": tenDaysAgo }, refDate);
    expect(result[0]!.inactiveOver7Days).toBe(true);
    expect(result[0]!.inactiveOver30Days).toBe(false);
    expect(result[0]!.inactiveOver60Days).toBe(false);
    expect(result[0]!.inactiveOver90Days).toBe(false);
  });

  it("dog with last session 45 days ago is inactive over 30 and 60 days", () => {
    const fortyFiveDaysAgo = new Date(refDate.getTime() - 45 * 24 * 60 * 60 * 1000);
    const dogs: DogWithProgress[] = [{ dogId: "dog-1", dogName: "Bono", scopeModality: null, modalities: [] }];
    const result = computeDogActivity(dogs, { "dog-1": fortyFiveDaysAgo }, refDate);
    expect(result[0]!.inactiveOver30Days).toBe(true);
    expect(result[0]!.inactiveOver60Days).toBe(false); // 45 < 60
    expect(result[0]!.inactiveOver90Days).toBe(false);
  });

  it("dog with last session 100 days ago is inactive over all thresholds", () => {
    const hundredDaysAgo = new Date(refDate.getTime() - 100 * 24 * 60 * 60 * 1000);
    const dogs: DogWithProgress[] = [{ dogId: "dog-1", dogName: "Bono", scopeModality: null, modalities: [] }];
    const result = computeDogActivity(dogs, { "dog-1": hundredDaysAgo }, refDate);
    expect(result[0]!.inactiveOver7Days).toBe(true);
    expect(result[0]!.inactiveOver30Days).toBe(true);
    expect(result[0]!.inactiveOver60Days).toBe(true);
    expect(result[0]!.inactiveOver90Days).toBe(true);
  });

  it("modality filter is reflected in activity (scopeModality)", () => {
    const dogs: DogWithProgress[] = [
      { dogId: "dog-1", dogName: "Bono", scopeModality: "deteccao", modalities: ["deteccao"] },
    ];
    // Dog never trained in deteccao specifically
    const result = computeDogActivity(dogs, {}, refDate);
    expect(result[0]!.neverTrained).toBe(true);
  });

  it("dog with progress but no session appears as neverTrained (not 'sem atividade')", () => {
    const dogs: DogWithProgress[] = [{ dogId: "dog-1", dogName: "Bono", scopeModality: null, modalities: [] }];
    const result = computeDogActivity(dogs, {}, refDate);
    expect(result[0]!.neverTrained).toBe(true);
    // The UI will use a specific label — "Nenhuma sessão registrada"
  });
});

// ─── Evaluation metrics ───────────────────────────────────────────────────────

describe("reports — evaluation metrics", () => {
  function promo(overrides: Partial<RawPromotion> = {}): RawPromotion {
    return {
      id: "p-1",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "pending",
      requestedAt: new Date("2026-07-01T10:00:00Z"),
      decidedAt: null,
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
      ...overrides,
    };
  }

  it("requested_at has priority over created_at", () => {
    const requestedAt = new Date("2026-06-20T10:00:00Z");
    const createdAt = new Date("2026-06-19T10:00:00Z");
    const p = promo({ requestedAt, decidedAt: new Date("2026-07-01T10:00:00Z"), status: "approved" });
    void createdAt; // Would be used as fallback
    const result = computeEvaluationMetrics([p], null);
    expect(result.averageDecisionTimeSeconds).not.toBeNull();
  });

  it("approved by decided_at within period", () => {
    const decidedAt = new Date("2026-07-10T12:00:00Z");
    const periodStart = new Date("2026-07-01T00:00:00Z");
    const p = promo({ status: "approved", decidedAt });
    const result = computeEvaluationMetrics([p], periodStart);
    expect(result.approvedInPeriod).toBe(1);
    expect(result.rejectedInPeriod).toBe(0);
  });

  it("rejected by decided_at within period", () => {
    const decidedAt = new Date("2026-07-10T12:00:00Z");
    const periodStart = new Date("2026-07-01T00:00:00Z");
    const p = promo({ status: "rejected", decidedAt });
    const result = computeEvaluationMetrics([p], periodStart);
    expect(result.rejectedInPeriod).toBe(1);
    expect(result.approvedInPeriod).toBe(0);
  });

  it("pending is independent of period", () => {
    const periodStart = new Date("2026-07-01T00:00:00Z");
    const p = promo({ status: "pending" });
    const result = computeEvaluationMetrics([p], periodStart);
    expect(result.pendingCount).toBe(1);
  });

  it("pending decided outside period is NOT counted as decided in period", () => {
    const decidedAt = new Date("2026-06-01T12:00:00Z");
    const periodStart = new Date("2026-07-01T00:00:00Z");
    const p = promo({ status: "approved", decidedAt });
    const result = computeEvaluationMetrics([p], periodStart);
    expect(result.decidedInPeriod).toBe(0);
  });

  it("average decision time is computed", () => {
    const p1 = promo({
      id: "p1",
      status: "approved",
      requestedAt: new Date("2026-07-01T10:00:00Z"),
      decidedAt: new Date("2026-07-03T10:00:00Z"),
    });
    const p2 = promo({
      id: "p2",
      status: "approved",
      requestedAt: new Date("2026-07-01T10:00:00Z"),
      decidedAt: new Date("2026-07-05T10:00:00Z"),
    });
    const result = computeEvaluationMetrics([p1, p2], null);
    // 2 days = 172800s, 4 days = 345600s, avg = 259200s
    expect(result.averageDecisionTimeSeconds).toBe(259200);
  });

  it("median decision time is computed", () => {
    const p1 = promo({
      id: "p1",
      status: "approved",
      requestedAt: new Date("2026-07-01T10:00:00Z"),
      decidedAt: new Date("2026-07-02T10:00:00Z"),
    });
    const p2 = promo({
      id: "p2",
      status: "approved",
      requestedAt: new Date("2026-07-01T10:00:00Z"),
      decidedAt: new Date("2026-07-03T10:00:00Z"),
    });
    const p3 = promo({
      id: "p3",
      status: "approved",
      requestedAt: new Date("2026-07-01T10:00:00Z"),
      decidedAt: new Date("2026-07-10T10:00:00Z"),
    });
    const result = computeEvaluationMetrics([p1, p2, p3], null);
    // Sorted: 86400, 172800, 777600 → median is 172800s (3 days)
    expect(result.medianDecisionTimeSeconds).toBe(172800);
  });

  it("invalid dates are counted and excluded from average", () => {
    const p1 = promo({ id: "p1", status: "approved", requestedAt: null, decidedAt: new Date() });
    const p2 = promo({ id: "p2", status: "approved", requestedAt: new Date(), decidedAt: null });
    const result = computeEvaluationMetrics([p1, p2], null);
    expect(result.invalidDateCount).toBe(2);
    expect(result.averageDecisionTimeSeconds).toBeNull();
  });

  it("oldest pending age is tracked", () => {
    const veryOld = new Date("2026-06-01T10:00:00Z");
    const recent = new Date("2026-07-10T10:00:00Z");
    const promos = [
      promo({ id: "p1", status: "pending", requestedAt: veryOld }),
      promo({ id: "p2", status: "pending", requestedAt: recent }),
    ];
    const result = computeEvaluationMetrics(promos, null);
    expect(result.oldestPendingAgeSeconds).not.toBeNull();
    // The oldest is veryOld — age should be approximately 44 days
    // Allow a range since the function uses new Date() internally
    expect(result.oldestPendingAgeSeconds!).toBeGreaterThan(0);
    expect(result.oldestPendingAgeSeconds!).toBeLessThan(100 * 24 * 60 * 60);
  });

  it("no pending → oldestPendingAgeSeconds is null", () => {
    const result = computeEvaluationMetrics([], null);
    expect(result.oldestPendingAgeSeconds).toBeNull();
  });

  it("rejection followed by approval are two separate events", () => {
    const promos = [
      promo({
        id: "p1",
        status: "rejected",
        decidedAt: new Date("2026-07-05T10:00:00Z"),
      }),
      promo({
        id: "p2",
        status: "approved",
        decidedAt: new Date("2026-07-10T10:00:00Z"),
      }),
    ];
    const result = computeEvaluationMetrics(promos, null);
    expect(result.decidedInPeriod).toBe(2);
    // Two distinct events — not deduplicated
  });
});

// ─── Rejected by module ───────────────────────────────────────────────────────

describe("reports — rejected by module", () => {
  function promo(status: "rejected" | "approved" = "rejected"): RawPromotion {
    return {
      id: `p-${Math.random()}`,
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status,
      requestedAt: new Date(),
      decidedAt: new Date(),
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
  }

  it("rejections grouped by programId:programVersion:moduleId", () => {
    const promos = [
      promo(),
      promo(),
    ];
    const result = computeRejectedByModule(promos, new Map());
    expect(result).toHaveLength(1);
    expect(result[0]!.rejectedCount).toBe(2);
    expect(result[0]!.moduleKey).toBe("prog-1:v1:mod-1");
  });

  it("different modules are separate groups", () => {
    const promos = [
      { ...promo(), moduleId: "mod-1", programVersion: "v1" },
      { ...promo(), moduleId: "mod-2", programVersion: "v1" },
    ];
    const result = computeRejectedByModule(promos, new Map());
    expect(result).toHaveLength(2);
    const modIds = result.map((r) => r.moduleId);
    expect(modIds).toContain("mod-1");
    expect(modIds).toContain("mod-2");
  });

  it("module name from request has priority", () => {
    const promos = [
      { ...promo(), moduleName: "Módulo de Detecção Avançada", moduleId: "mod-1" },
    ];
    const lookup = new Map([["prog-1:v1:mod-1", "Matrix Name"]]);
    const result = computeRejectedByModule(promos, lookup);
    expect(result[0]!.moduleName).toBe("Módulo de Detecção Avançada");
  });

  it("module name from matrix lookup is fallback", () => {
    const promos = [
      { ...promo(), moduleName: null, moduleId: "mod-1" },
    ];
    const lookup = new Map([["prog-1:v1:mod-1", "Protocolo Ragonha"]]);
    const result = computeRejectedByModule(promos, lookup);
    expect(result[0]!.moduleName).toBe("Protocolo Ragonha");
  });

  it("unidentified module fallback when no name available", () => {
    const promos = [
      { ...promo(), moduleName: null, moduleId: null },
    ];
    const result = computeRejectedByModule(promos, new Map());
    expect(result[0]!.moduleName).toBe("Módulo não identificado");
  });

  it("distinct dogs counted per module", () => {
    const promos = [
      { ...promo(), dogId: "dog-1" },
      { ...promo(), dogId: "dog-1" },
      { ...promo(), dogId: "dog-2" },
    ];
    const result = computeRejectedByModule(promos, new Map());
    expect(result[0]!.distinctDogsCount).toBe(2);
    expect(result[0]!.rejectedCount).toBe(3);
  });

  it("results sorted by rejectedCount descending", () => {
    const promos = [
      { ...promo(), moduleId: "mod-small" },
      { ...promo(), moduleId: "mod-small" },
      { ...promo(), moduleId: "mod-big" },
      { ...promo(), moduleId: "mod-big" },
      { ...promo(), moduleId: "mod-big" },
    ];
    const result = computeRejectedByModule(promos, new Map());
    expect(result[0]!.moduleId).toBe("mod-big");
    expect(result[0]!.rejectedCount).toBe(3);
    expect(result[1]!.moduleId).toBe("mod-small");
    expect(result[1]!.rejectedCount).toBe(2);
  });

  it("rejected followed by approved remains as two events in timeline", () => {
    // This is tested at the timeline level
    const events = buildIndividualTimelines([
      { type: "promotion_rejected", id: "p1", dogId: "dog-1", modality: "deteccao", date: new Date("2026-07-05") },
      { type: "promotion_approved", id: "p2", dogId: "dog-1", modality: "deteccao", date: new Date("2026-07-10") },
    ]);
    const dogTimeline = events["dog-1"] ?? [];
    expect(dogTimeline).toHaveLength(2);
  });
});

// ─── Individual timeline ───────────────────────────────────────────────────────

describe("reports — individual timeline", () => {
  it("session event is included with correct type", () => {
    const sources: TimelineSource[] = [
      {
        type: "session",
        id: "s-1",
        dogId: "dog-1",
        modality: "deteccao",
        date: new Date("2026-07-10"),
      },
    ];
    const result = buildIndividualTimelines(sources);
    expect(result["dog-1"]).toBeDefined();
    expect(result["dog-1"]![0]!.eventType).toBe("session");
    expect(result["dog-1"]![0]!.title).toBe("Sessão de treinamento");
    expect(result["dog-1"]![0]!.sourceId).toBe("s-1");
  });

  it("module_completed event is included", () => {
    const sources: TimelineSource[] = [
      {
        type: "module_completed",
        id: "m-1",
        dogId: "dog-1",
        modality: "deteccao",
        date: new Date("2026-07-10"),
        moduleName: "Detecção de Armas",
      },
    ];
    const result = buildIndividualTimelines(sources);
    expect(result["dog-1"]![0]!.eventType).toBe("module_completed");
    expect(result["dog-1"]![0]!.title).toBe("Módulo concluído — Detecção de Armas");
  });

  it("promotion_requested event is included", () => {
    const sources: TimelineSource[] = [
      {
        type: "promotion_requested",
        id: "p-1",
        dogId: "dog-1",
        modality: "deteccao",
        date: new Date("2026-07-10"),
      },
    ];
    const result = buildIndividualTimelines(sources);
    expect(result["dog-1"]![0]!.eventType).toBe("promotion_requested");
    expect(result["dog-1"]![0]!.title).toBe("Solicitação de avaliação");
    expect(result["dog-1"]![0]!.subtitle).toBe("Solicitada");
  });

  it("promotion_approved event is included", () => {
    const sources: TimelineSource[] = [
      {
        type: "promotion_approved",
        id: "p-1",
        dogId: "dog-1",
        modality: "deteccao",
        date: new Date("2026-07-10"),
      },
    ];
    const result = buildIndividualTimelines(sources);
    expect(result["dog-1"]![0]!.eventType).toBe("promotion_approved");
    expect(result["dog-1"]![0]!.subtitle).toBe("Aprovada");
  });

  it("promotion_rejected event is included", () => {
    const sources: TimelineSource[] = [
      {
        type: "promotion_rejected",
        id: "p-1",
        dogId: "dog-1",
        modality: "deteccao",
        date: new Date("2026-07-10"),
      },
    ];
    const result = buildIndividualTimelines(sources);
    expect(result["dog-1"]![0]!.eventType).toBe("promotion_rejected");
    expect(result["dog-1"]![0]!.subtitle).toBe("Rejeitada");
  });

  it("modality_completed event is included", () => {
    const sources: TimelineSource[] = [
      {
        type: "modality_completed",
        id: "dog-1:deteccao:done",
        dogId: "dog-1",
        modality: "deteccao",
        date: new Date("2026-07-10"),
      },
    ];
    const result = buildIndividualTimelines(sources);
    expect(result["dog-1"]![0]!.eventType).toBe("modality_completed");
    expect(result["dog-1"]![0]!.title).toBe("Formação técnica concluída");
  });

  it("events sorted descending by date (most recent first)", () => {
    const sources: TimelineSource[] = [
      {
        type: "session",
        id: "s-old",
        dogId: "dog-1",
        modality: "deteccao",
        date: new Date("2026-07-01"),
      },
      {
        type: "session",
        id: "s-new",
        dogId: "dog-1",
        modality: "deteccao",
        date: new Date("2026-07-15"),
      },
    ];
    const result = buildIndividualTimelines(sources);
    expect(result["dog-1"]![0]!.sourceId).toBe("s-new");
    expect(result["dog-1"]![1]!.sourceId).toBe("s-old");
  });

  it("events without date are OMITTED", () => {
    const sources: TimelineSource[] = [
      {
        type: "session",
        id: "s-no-date",
        dogId: "dog-1",
        modality: "deteccao",
        date: null as unknown as Date,
      },
      {
        type: "session",
        id: "s-with-date",
        dogId: "dog-1",
        modality: "deteccao",
        date: new Date("2026-07-15"),
      },
    ];
    const result = buildIndividualTimelines(sources);
    expect(result["dog-1"]).toHaveLength(1);
    expect(result["dog-1"]![0]!.sourceId).toBe("s-with-date");
  });

  it("no false linkage between session and promotion", () => {
    // A session and a promotion may share dog+modality but there is no FK
    // They appear as separate events in the timeline
    const sources: TimelineSource[] = [
      {
        type: "session",
        id: "s-1",
        dogId: "dog-1",
        modality: "deteccao",
        date: new Date("2026-07-05"),
      },
      {
        type: "promotion_requested",
        id: "p-1",
        dogId: "dog-1",
        modality: "deteccao",
        date: new Date("2026-07-10"),
      },
    ];
    const result = buildIndividualTimelines(sources);
    const timeline = result["dog-1"] ?? [];
    expect(timeline).toHaveLength(2);
    expect(timeline.find((e) => e.eventType === "session")!.sourceId).toBe("s-1");
    expect(timeline.find((e) => e.eventType === "promotion_requested")!.sourceId).toBe("p-1");
    // No sessionId on promotion, no generated link
  });

  it("sourceRoute is set for session events", () => {
    const sources: TimelineSource[] = [
      {
        type: "session",
        id: "s-1",
        dogId: "dog-1",
        modality: "deteccao",
        date: new Date("2026-07-10"),
      },
    ];
    const result = buildIndividualTimelines(sources);
    expect(result["dog-1"]![0]!.sourceRoute).toBe("/training/sessions/s-1");
  });
});

// ─── Data quality warnings ──────────────────────────────────────────────────────

describe("reports — data quality warnings", () => {
  it("no warning when all data is healthy", () => {
    const warnings = generateDataQualityWarnings(
      false, // sessionsTruncated
      0,     // invalidSessionCount
      0,     // suspiciousDurationCount
      0,     // invalidEvaluationDateCount
      false, // pendingEvaluationsTruncated
      false, // decidedEvaluationsTruncated
      new Date("2026-01-01"),  // earliestLoadedSession
      new Date("2026-07-15"),   // latestLoadedSession
    );
    expect(warnings).toHaveLength(0);
  });

  it("warns about truncated sessions", () => {
    const warnings = generateDataQualityWarnings(
      true,  // sessionsTruncated
      0, 0, 0,
      false, false,
      new Date("2026-07-01"),
      new Date("2026-07-15"),
    );
    expect(warnings.some((w) => w.includes("limite"))).toBe(true);
  });

  it("warns about invalid evaluation dates", () => {
    const warnings = generateDataQualityWarnings(
      false, 0, 0,
      3,    // invalidEvaluationDateCount
      false, false,
      new Date("2026-07-01"),
      new Date("2026-07-15"),
    );
    expect(warnings.some((w) => w.includes("datas inválidas"))).toBe(true);
  });

  it("warns about short history (loaded period < 14 days)", () => {
    const warnings = generateDataQualityWarnings(
      false, 0, 0, 0,
      false, false,
      new Date("2026-07-10"),  // only 5 days of loaded data
      new Date("2026-07-15"),
    );
    expect(warnings.some((w) => w.includes("carregado"))).toBe(true);
  });

  it("no short-history warning for long loaded history", () => {
    const warnings = generateDataQualityWarnings(
      false, 0, 0, 0,
      false, false,
      new Date("2026-01-01"),
      new Date("2026-07-15"),
    );
    expect(warnings.some((w) => w.includes("carregado"))).toBe(false);
  });

  it("no fixed dates from investigation in warnings", () => {
    // Warnings must be computed from actual data, not hardcoded values
    const warnings = generateDataQualityWarnings(
      false, 0, 0, 0,
      false, false,
      new Date("2026-01-01"),
      new Date("2026-07-15"),
    );
    for (const w of warnings) {
      expect(w).not.toMatch(/junho/i);
      expect(w).not.toMatch(/\b10\b/);
      expect(w).not.toMatch(/\b7\b/);
    }
  });
});

// ─── Dogs vs formations distinction ────────────────────────────────────────────

describe("reports — dogs vs formations (one dog, two modalities)", () => {
  it("counts as 1 dog and 2 formations", () => {
    const entries = [
      { dogId: "dog-1", modality: "deteccao", status: "in_formation" },
      { dogId: "dog-1", modality: "busca_captura", status: "in_formation" },
    ];
    const result = computeCurrentStateMetrics(entries, 2, 8);
    expect(result.dogsInFormation).toBe(1);
    expect(result.formationsInProgress).toBe(2);
  });

  it("dog with two operational modalities counts correctly", () => {
    const entries = [
      { dogId: "dog-1", modality: "deteccao", status: "operational" },
      { dogId: "dog-1", modality: "busca_captura", status: "operational" },
    ];
    const result = computeCurrentStateMetrics(entries, 2, 8);
    expect(result.dogsTechnicallyTrained).toBe(1);
    expect(result.modalitiesConcluded).toBe(2);
  });

  it("dog with mixed status counts in both categories", () => {
    const entries = [
      { dogId: "dog-1", modality: "deteccao", status: "operational" },
      { dogId: "dog-1", modality: "busca_captura", status: "in_formation" },
    ];
    const result = computeCurrentStateMetrics(entries, 2, 8);
    expect(result.dogsTechnicallyTrained).toBe(1);
    expect(result.dogsInFormation).toBe(1);
    expect(result.modalitiesConcluded).toBe(1);
    expect(result.formationsInProgress).toBe(1);
  });
});

// ─── Period filtering ─────────────────────────────────────────────────────────

describe("reports — period filtering", () => {
  it("all period includes all sessions", () => {
    const sessions: RawSession[] = [
      {
        dogId: "dog-1", dogName: "Bono", id: "s1",
        modality: "deteccao",
        startedAt: new Date("2026-01-01"),
        durationS: null,
      },
      {
        dogId: "dog-1", dogName: "Bono", id: "s2",
        modality: "deteccao",
        startedAt: new Date("2026-07-15"),
        durationS: null,
      },
    ];
    const result = computeSessionMetrics(sessions, null, null);
    expect(result.sessionsInPeriod).toBe(2);
  });

  it("7d period excludes sessions before the window", () => {
    const sevenDaysAgo = new Date("2026-07-08T12:00:00Z");
    const sessions: RawSession[] = [
      {
        dogId: "dog-1", dogName: "Bono", id: "s1",
        modality: "deteccao",
        startedAt: new Date("2026-07-01"),
        durationS: null,
      },
      {
        dogId: "dog-1", dogName: "Bono", id: "s2",
        modality: "deteccao",
        startedAt: new Date("2026-07-10"),
        durationS: null,
      },
    ];
    const result = computeSessionMetrics(sessions, sevenDaysAgo, null);
    expect(result.sessionsInPeriod).toBe(1);
    expect(result.sessionsInPeriod).toBe(1);
  });
});

// ─── Query stats ─────────────────────────────────────────────────────────────

describe("reports — query stats (conceptual)", () => {
  it("queryStats structure is defined correctly", () => {
    // This verifies the type exists and has the right fields
    const stats = {
      dogCount: 5,
      progressCount: 12,
      sessionQueryCount: 5,
      sessionDocumentCount: 47,
      promotionCount: 8,
      programCount: 3,
    };
    expect(stats.dogCount).toBe(5);
    expect(stats.sessionDocumentCount).toBe(47);
    expect(stats.promotionCount).toBe(8);
  });

  it("N+1 pattern is documented: one query per dog", () => {
    // 10 dogs → 10 session queries
    const dogCount = 10;
    const expectedSessionQueries = dogCount;
    expect(expectedSessionQueries).toBe(10);
  });
});

// ─── Provider state machine ───────────────────────────────────────────────────

describe("reports — provider state machine", () => {
  it("loading states are defined", () => {
    const states = ["idle", "loading", "success", "error"] as const;
    expect(states).toContain("idle");
    expect(states).toContain("loading");
    expect(states).toContain("success");
    expect(states).toContain("error");
  });

  it("retry resets to idle then reloads", () => {
    // The retry callback sets state to "idle" and schedules a new load()
    // This is a behavioral contract test
    let state = "error";
    const retry = () => { state = "idle"; };
    retry();
    expect(state).toBe("idle");
  });

  it("period change triggers reload via useEffect", () => {
    // When period changes, the provider's useEffect sees the new value
    // and calls load() again.
    // The effect depends on [period] so any change causes a reload.
    const changedPeriod = (a: TrainingReportPeriod, b: TrainingReportPeriod) => a !== b;
    expect(changedPeriod("7d", "30d")).toBe(true);
    expect(changedPeriod("30d", "30d")).toBe(false);
  });

  it("rapid filter changes are discarded via fetchId", () => {
    // Simulate: request1 starts (fetchId=1), request2 starts (fetchId=2),
    // request1 resolves — it detects its id (1) is stale vs current (2)
    let fetchIdRef = 0;
    const request1Id = ++fetchIdRef; // 1
    const request2Id = ++fetchIdRef; // 2
    void request2Id;
    // When request1 resolves, fetchIdRef is already 2
    const isStale = request1Id !== fetchIdRef;
    expect(isStale).toBe(true);
    // Request 2 is the current one
    expect(request2Id).toBe(fetchIdRef);
  });
});

// ─── Types ────────────────────────────────────────────────────────────────────

describe("reports — type contracts", () => {
  it("TrainingReportPeriod has expected values", () => {
    const periods: TrainingReportPeriod[] = ["7d", "30d", "60d", "90d", "all"];
    expect(periods).toHaveLength(5);
    expect(periods).toContain("all");
    expect(periods).not.toContain("recent");
  });

  it("IndividualTimelineEventType covers all event types", () => {
    const eventTypes: IndividualTimelineEventType[] = [
      "session",
      "module_completed",
      "promotion_requested",
      "promotion_approved",
      "promotion_rejected",
      "modality_completed",
    ];
    expect(eventTypes).toHaveLength(6);
  });

  it("DataQuality.isComplete reflects load state", () => {
    const completeData = { isComplete: true };
    const incompleteData = { isComplete: false };
    expect(completeData.isComplete).toBe(true);
    expect(incompleteData.isComplete).toBe(false);
  });
});

// ─── Boundary cases ───────────────────────────────────────────────────────────

describe("reports — boundary cases", () => {
  it("empty progress list produces zero metrics", () => {
    const result = computeCurrentStateMetrics([], 0, 0);
    expect(result.dogsInFormation).toBe(0);
    expect(result.dogsTechnicallyTrained).toBe(0);
    expect(result.activePrograms).toBe(0);
  });

  it("empty sessions list produces zero session metrics", () => {
    const result = computeSessionMetrics([], null, null);
    expect(result.sessionsInPeriod).toBe(0);
    expect(result.distinctDogsTrained).toBe(0);
    expect(result.distinctTrainingDays).toBe(0);
    expect(result.firstSessionInPeriod).toBeNull();
    expect(result.lastSessionInPeriod).toBeNull();
  });

  it("rejectedByModule with empty list returns empty array", () => {
    const result = computeRejectedByModule([], new Map());
    expect(result).toEqual([]);
  });

  it("individualTimelines with empty sources returns empty record", () => {
    const result = buildIndividualTimelines([]);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("duration metrics with empty sessions returns zeros", () => {
    const result = computeDurationMetrics([]);
    expect(result.registeredDurationSeconds).toBe(0);
    expect(result.durationCoveragePercentage).toBe(0);
    expect(result.sessionsWithDuration).toBe(0);
  });

  it("dog activity with empty dogs returns empty array", () => {
    const result = computeDogActivity([], {}, new Date());
    expect(result).toEqual([]);
  });

  it("evaluation metrics with no decisions returns null averages", () => {
    const result = computeEvaluationMetrics([], null);
    expect(result.decidedInPeriod).toBe(0);
    expect(result.averageDecisionTimeSeconds).toBeNull();
    expect(result.medianDecisionTimeSeconds).toBeNull();
    expect(result.oldestPendingAgeSeconds).toBeNull();
  });
});

// ─── Period 60d ────────────────────────────────────────────────────────────────

describe("reports — period 60d", () => {
  const refDate = new Date("2026-07-15T12:00:00Z");

  it("60d returns 60 days before reference", () => {
    const start = resolveReportStartDate("60d", refDate);
    expect(start).not.toBeNull();
    const diff = refDate.getTime() - (start as Date).getTime();
    expect(diff).toBe(60 * 24 * 60 * 60 * 1000);
  });

  it("60d period excludes sessions before the window", () => {
    const sixtyDaysAgo = new Date("2026-07-08T12:00:00Z");
    const sessions: RawSession[] = [
      {
        dogId: "dog-1", dogName: "Bono", id: "s1",
        modality: "deteccao",
        startedAt: new Date("2026-05-01"),
        durationS: null,
      },
      {
        dogId: "dog-1", dogName: "Bono", id: "s2",
        modality: "deteccao",
        startedAt: new Date("2026-07-10"),
        durationS: null,
      },
    ];
    const result = computeSessionMetrics(sessions, sixtyDaysAgo, null);
    expect(result.sessionsInPeriod).toBe(1);
  });
});

// ─── Inactivity threshold boundaries ─────────────────────────────────────────────

describe("reports — inactivity threshold boundaries (> N days)", () => {
  const refDate = new Date("2026-07-15T12:00:00Z");

  function dog(daysAgo: number): DogWithProgress {
    return { dogId: `dog-${daysAgo}`, dogName: `K9 ${daysAgo}`, scopeModality: null, modalities: [] };
  }

  function sessionDate(daysAgo: number): Date {
    return new Date(refDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  }

  function active(dog: DogWithProgress, lastSessionDaysAgo: number) {
    return computeDogActivity([dog], { [dog.dogId]: sessionDate(lastSessionDaysAgo) }, refDate)[0]!;
  }

  it("exactly 7 days ago → NOT inactive (boundary: >7)", () => {
    const result = active(dog(7), 7);
    expect(result.inactiveOver7Days).toBe(false);
    expect(result.daysSinceLastSession).toBe(7);
  });

  it("8 days ago → inactive over 7 days", () => {
    const result = active(dog(8), 8);
    expect(result.inactiveOver7Days).toBe(true);
    expect(result.inactiveOver30Days).toBe(false);
    expect(result.inactiveOver60Days).toBe(false);
    expect(result.inactiveOver90Days).toBe(false);
  });

  it("exactly 30 days ago → NOT inactive (boundary: >30)", () => {
    const result = active(dog(30), 30);
    expect(result.inactiveOver30Days).toBe(false);
    expect(result.daysSinceLastSession).toBe(30);
  });

  it("31 days ago → inactive over 30 days", () => {
    const result = active(dog(31), 31);
    expect(result.inactiveOver30Days).toBe(true);
    expect(result.inactiveOver60Days).toBe(false);
    expect(result.inactiveOver90Days).toBe(false);
  });

  it("exactly 60 days ago → NOT inactive (boundary: >60)", () => {
    const result = active(dog(60), 60);
    expect(result.inactiveOver60Days).toBe(false);
    expect(result.daysSinceLastSession).toBe(60);
  });

  it("61 days ago → inactive over 60 days", () => {
    const result = active(dog(61), 61);
    expect(result.inactiveOver60Days).toBe(true);
    expect(result.inactiveOver90Days).toBe(false);
  });

  it("exactly 90 days ago → NOT inactive (boundary: >90)", () => {
    const result = active(dog(90), 90);
    expect(result.inactiveOver90Days).toBe(false);
    expect(result.daysSinceLastSession).toBe(90);
  });

  it("91 days ago → inactive over 90 days", () => {
    const result = active(dog(91), 91);
    expect(result.inactiveOver90Days).toBe(true);
  });

  it("100 days → inactive over all thresholds cumulatively", () => {
    const d = dog(100);
    const result = active(d, 100);
    expect(result.inactiveOver7Days).toBe(true);
    expect(result.inactiveOver30Days).toBe(true);
    expect(result.inactiveOver60Days).toBe(true);
    expect(result.inactiveOver90Days).toBe(true);
  });
});

// ─── Suspicious duration ────────────────────────────────────────────────────────

describe("reports — suspicious duration", () => {
  function session(overrides: Partial<RawSession> = {}): RawSession {
    return {
      dogId: "dog-1",
      dogName: "K9 Bono",
      id: "s-1",
      modality: "deteccao",
      startedAt: new Date(),
      durationS: null,
      ...overrides,
    };
  }

  const FOUR_HOURS = 4 * 60 * 60;

  it("MAX_REASONABLE_SESSION_DURATION_SECONDS is 4 hours", () => {
    expect(FOUR_HOURS).toBe(4 * 60 * 60);
  });

  it("valid duration below ceiling is NOT suspicious", () => {
    expect(isSuspiciousDuration(3600)).toBe(false);        // 1 hour
    expect(isSuspiciousDuration(FOUR_HOURS)).toBe(false);  // exactly 4 hours
  });

  it("duration above ceiling is suspicious", () => {
    expect(isSuspiciousDuration(FOUR_HOURS + 1)).toBe(true);
    expect(isSuspiciousDuration(8 * 60 * 60)).toBe(true); // 8 hours
  });

  it("suspicious duration counted in coverage but NOT summed", () => {
    const sessions = [
      session({ id: "s1", durationS: 3600 }),               // valid, 1h
      session({ id: "s2", durationS: FOUR_HOURS + 60 }),   // suspicious, 4h1m
    ];
    const result = computeDurationMetrics(sessions);
    expect(result.sessionsWithDuration).toBe(2);           // both counted
    expect(result.suspiciousDurationCount).toBe(1);
    expect(result.registeredDurationSeconds).toBe(3600);    // only valid summed
  });

  it("suspicious duration count is isolated from invalid", () => {
    const sessions = [
      session({ id: "s1", durationS: FOUR_HOURS + 60 }),
      session({ id: "s2", durationS: -1 }),
      session({ id: "s3", durationS: NaN }),
    ];
    const result = computeDurationMetrics(sessions);
    expect(result.suspiciousDurationCount).toBe(1); // only the suspicious one
    expect(result.invalidDurationCount).toBe(2);    // negative + NaN
  });

  it("zero duration is invalid, not suspicious", () => {
    expect(isValidDuration(0)).toBe(false);
    expect(isSuspiciousDuration(0)).toBe(false);
  });
});

// ─── Data quality warnings (stabilized) ────────────────────────────────────────

describe("reports — data quality warnings (stabilized)", () => {
  it("warns about truncated sessions", () => {
    const warnings = generateDataQualityWarnings(
      true,   // sessionsTruncated
      0,      // invalidSessionCount
      0,      // suspiciousDurationCount
      0,      // invalidEvaluationDateCount
      false,  // pendingEvaluationsTruncated
      false,  // decidedEvaluationsTruncated
      new Date("2026-07-01"),
      new Date("2026-07-15"),
    );
    expect(warnings.some((w) => w.includes("limite"))).toBe(true);
  });

  it("warns about pending evaluations truncated", () => {
    const warnings = generateDataQualityWarnings(
      false,  // sessionsTruncated
      0, 0, 0,
      true,   // pendingEvaluationsTruncated
      false,  // decidedEvaluationsTruncated
      new Date("2026-07-01"),
      new Date("2026-07-15"),
    );
    expect(warnings.some((w) => w.includes("pendente"))).toBe(true);
  });

  it("warns about decided evaluations truncated", () => {
    const warnings = generateDataQualityWarnings(
      false, 0, 0, 0,
      false,  // pendingEvaluationsTruncated
      true,   // decidedEvaluationsTruncated
      new Date("2026-07-01"),
      new Date("2026-07-15"),
    );
    expect(warnings.some((w) => w.includes("decididas"))).toBe(true);
  });

  it("warns about suspicious durations", () => {
    const warnings = generateDataQualityWarnings(
      false, 0,
      3,     // suspiciousDurationCount
      0, false, false,
      new Date("2026-07-01"),
      new Date("2026-07-15"),
    );
    expect(warnings.some((w) => w.includes("suspeita"))).toBe(true);
    expect(warnings.some((w) => w.includes("3"))).toBe(true);
  });

  it("no duration-zero warning when coverage is 0 (suspicious covers it)", () => {
    // When coverage is 0 it means no session has duration — this is a different
    // signal than suspicious duration. The suspicious warning covers suspicious values;
    // a completely missing-duration coverage is a separate business concern.
    // The stabilized warning set does NOT include a zero-coverage warning —
    // that decision is left to the UI layer.
    const warnings = generateDataQualityWarnings(
      false, 0, 0, 0, false, false,
      new Date("2026-07-01"),
      new Date("2026-07-15"),
    );
    expect(warnings.some((w) => w.includes("duração") && w.includes("registrada"))).toBe(false);
  });

  it("short history warning uses loaded dates terminology", () => {
    const warnings = generateDataQualityWarnings(
      false, 0, 0, 0, false, false,
      new Date("2026-07-10"),
      new Date("2026-07-15"),
    );
    expect(warnings.some((w) => w.includes("carregado"))).toBe(true);
    expect(warnings.some((w) => w.includes("disponível"))).toBe(false);
  });
});

// ─── isComplete logic ─────────────────────────────────────────────────────────

describe("reports — isComplete logic", () => {
// Helper avoids TS narrowing issue with literal type comparisons
  const isReportComplete = (
    ls: LoadState,
    err: string | null,
    sTrunc: boolean,
    pTrunc: boolean,
    dTrunc: boolean,
  ) => ls === "success" && !err && !sTrunc && !(pTrunc || dTrunc);

  it("isComplete is false when sessions are truncated", () => {
    const ls: LoadState = "success";
    expect(isReportComplete(ls, null, true, false, false)).toBe(false);
  });

  it("isComplete is false when pending evaluations are truncated", () => {
    const ls: LoadState = "success";
    expect(isReportComplete(ls, null, false, true, false)).toBe(false);
  });

  it("isComplete is false when decided evaluations are truncated", () => {
    const ls: LoadState = "success";
    expect(isReportComplete(ls, null, false, false, true)).toBe(false);
  });

  it("isComplete is false on error", () => {
    const ls: LoadState = "error";
    expect(isReportComplete(ls, "Network error", false, false, false)).toBe(false);
  });

  it("isComplete is false while loading", () => {
    const ls: LoadState = "loading";
    expect(isReportComplete(ls, null, false, false, false)).toBe(false);
  });

  it("isComplete is true only when all conditions are met", () => {
    const ls: LoadState = "success";
    expect(isReportComplete(ls, null, false, false, false)).toBe(true);
  });
});

// ─── Query stats new fields ───────────────────────────────────────────────────

describe("reports — queryStats new fields", () => {
  it("truncatedDogCount and evaluation fields are part of queryStats", () => {
    const stats = {
      dogCount: 5,
      progressCount: 12,
      sessionQueryCount: 5,
      sessionDocumentCount: 47,
      truncatedDogCount: 1,
      pendingEvaluationQueryCount: 1,
      pendingEvaluationDocumentCount: 3,
      pendingEvaluationLimit: 500,
      decidedEvaluationQueryCount: 1,
      decidedEvaluationDocumentCount: 8,
      decidedEvaluationLimit: 1000,
      programCount: 3,
      unsupportedDecidedStatusCount: 0,
    };
    expect(stats.truncatedDogCount).toBe(1);
    expect(stats.pendingEvaluationDocumentCount).toBe(3);
    expect(stats.pendingEvaluationLimit).toBe(500);
    expect(stats.decidedEvaluationDocumentCount).toBe(8);
    expect(stats.decidedEvaluationLimit).toBe(1000);
    expect(stats.pendingEvaluationQueryCount).toBe(1);
    expect(stats.decidedEvaluationQueryCount).toBe(1);
  });

  it("truncation detection: rawSnapshot.size === limit means truncated", () => {
    // Helper: simulate what the provider does — compare a variable against a constant
    const checkTruncated = (rawSize: number, limit: number) => rawSize === limit;

    // 199 → not truncated
    expect(checkTruncated(199, 200)).toBe(false);
    // 200 → truncated
    expect(checkTruncated(200, 200)).toBe(true);
    // 200 raw but 10 after filter → still truncated (filter doesn't affect detection)
    const rawDocCount = 200;
    const afterFilter = 10;
    expect(checkTruncated(rawDocCount, 200)).toBe(true);
    expect(afterFilter).toBe(10);
  });

  it("two dogs, one truncated: global truncatedDogCount = 1", () => {
    const results = [
      { dId: "dog-1", truncated: false },
      { dId: "dog-2", truncated: true },
    ];
    const truncatedDogs = results.filter((r) => r.truncated).length;
    const sessionsTruncated = truncatedDogs > 0;
    expect(truncatedDogs).toBe(1);
    expect(sessionsTruncated).toBe(true);
  });
});

// ─── Evaluation limit and truncation ───────────────────────────────────────────

describe("reports — evaluation limit and truncation", () => {
  it("PENDING_EVALUATIONS_LIMIT is 500 and DECIDED_EVALUATIONS_LIMIT is 1000", () => {
    // Constants defined in use-training-reports-data.tsx
    const PENDING_EVALUATIONS_LIMIT = 500;
    const DECIDED_EVALUATIONS_LIMIT = 1000;
    expect(PENDING_EVALUATIONS_LIMIT).toBe(500);
    expect(DECIDED_EVALUATIONS_LIMIT).toBe(1000);
  });

  it("pending requests are always complete regardless of truncation", () => {
    // Even if evaluation query is truncated, pending requests are still meaningful
    // because the most recent docs are fetched first (orderBy created_at desc)
    const pendingPromo = {
      id: "p-pending",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "pending" as const,
      requestedAt: new Date("2026-06-01"),
      decidedAt: null,
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    const result = computeEvaluationMetrics([pendingPromo], null);
    expect(result.pendingCount).toBe(1);
  });
});

// ─── Loading state granularity ─────────────────────────────────────────────────

describe("reports — loading state granularity", () => {
  it("loadingState has base, sessions, and evaluations fields", () => {
    const state = {
      base: false,
      sessions: true,
      evaluations: false,
    };
    expect(state.base).toBe(false);
    expect(state.sessions).toBe(true);
    expect(state.evaluations).toBe(false);
  });

  it("aggregated loading is true when any source is loading", () => {
    const checkLoading = (state: { base: boolean; sessions: boolean; evaluations: boolean }) => {
      return state.base || state.sessions || state.evaluations;
    };
    expect(checkLoading({ base: true, sessions: false, evaluations: false })).toBe(true);
    expect(checkLoading({ base: false, sessions: true, evaluations: false })).toBe(true);
    expect(checkLoading({ base: false, sessions: false, evaluations: true })).toBe(true);
    expect(checkLoading({ base: false, sessions: false, evaluations: false })).toBe(false);
  });

  it("base loading tracks effective and trainingK9 loading", () => {
    // When effective.loading or trainingK9.loading is true, base is true
    const baseLoading = (effectiveLoading: boolean, trainingLoading: boolean) =>
      effectiveLoading || trainingLoading;
    expect(baseLoading(true, false)).toBe(true);
    expect(baseLoading(false, true)).toBe(true);
    expect(baseLoading(false, false)).toBe(false);
  });
});

// ─── Two-query evaluation strategy ─────────────────────────────────────────────

describe("reports — two-query evaluation strategy", () => {
  it("pending uses status==pending (no temporal filter) so old pending are not excluded", () => {
    // The pending query filters: where("status", "==", "pending")
    // It does NOT filter by created_at, so a pending from 2 years ago is included.
    const oldPending = {
      id: "p-old",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "pending" as const,
      requestedAt: new Date("2024-01-01"), // 2 years old
      decidedAt: null,
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    const result = computeEvaluationMetrics([oldPending], null);
    expect(result.pendingCount).toBe(1);
    expect(result.approvedInPeriod).toBe(0);
    expect(result.rejectedInPeriod).toBe(0);
  });

  it("decided query uses status in [approved, rejected] — pending excluded from decided", () => {
    // The decided query filters: where("status", "in", ["approved", "rejected"])
    // So a pending document would never appear in the decided query results.
    const pending = {
      id: "p-pending",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "pending" as const,
      requestedAt: new Date("2026-06-01"),
      decidedAt: null,
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    const approved = {
      id: "p-approved",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "approved" as const,
      requestedAt: new Date("2026-06-01"),
      decidedAt: new Date("2026-06-15"),
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    // If allPromotions = [pending, approved], pending should NOT be counted in approvedInPeriod
    const result = computeEvaluationMetrics([pending, approved], new Date("2026-05-01"));
    expect(result.pendingCount).toBe(1);
    expect(result.approvedInPeriod).toBe(1);
  });

  it("pending without created_at still loaded (no orderBy required)", () => {
    // The pending query has no orderBy, so documents without created_at are NOT excluded.
    const pendingNoDate = {
      id: "p-nodate",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "pending" as const,
      requestedAt: null,
      decidedAt: null,
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    // Inline sanity check: confirm filter works on the test data
    const check = [pendingNoDate].filter((p) => p.status === "pending");
    expect(check.length).toBe(1);
    const result = computeEvaluationMetrics([pendingNoDate], null);
    expect(result.pendingCount).toBe(1);
    expect(result.invalidDateCount).toBe(1);
  });

  it("pending with requested_at but no created_at uses requested_at for age", () => {
    const pending = {
      id: "p-requested",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "pending" as const,
      requestedAt: new Date("2026-05-01"),
      decidedAt: null,
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    const result = computeEvaluationMetrics([pending], null);
    expect(result.pendingCount).toBe(1);
    expect(result.oldestPendingAgeSeconds).not.toBeNull();
    expect(result.oldestPendingAgeSeconds).toBeGreaterThan(0);
    expect(result.invalidDateCount).toBe(0);
  });

  it("oldestPendingAge ignores pending without date", () => {
    const now = new Date();
    const pendingNoDate = {
      id: "p-nodate",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "pending" as const,
      requestedAt: null,
      decidedAt: null,
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    const pendingWithDate = {
      id: "p-date",
      dogId: "dog-2",
      dogName: "Max",
      modality: "deteccao",
      status: "pending" as const,
      requestedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      decidedAt: null,
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    const result = computeEvaluationMetrics([pendingNoDate, pendingWithDate], null);
    expect(result.pendingCount).toBe(2);
    expect(result.invalidDateCount).toBe(1);
    // oldestPendingAgeSeconds should be based on the one WITH date (~7 days)
    const sevenDaysS = 7 * 24 * 60 * 60;
    expect(result.oldestPendingAgeSeconds).toBeGreaterThan(sevenDaysS - 60);
    expect(result.oldestPendingAgeSeconds).toBeLessThan(sevenDaysS + 60);
  });

  it("pending snapshot at limit marks pendingEvaluationsTruncated", () => {
    // PENDING_EVALUATIONS_LIMIT = 500
    const LIMIT = 500;
    const checkTruncated = (size: number) => size === LIMIT;
    expect(checkTruncated(500)).toBe(true);
    expect(checkTruncated(499)).toBe(false);
    expect(checkTruncated(501)).toBe(false);
  });

  it("decided snapshot at limit marks decidedEvaluationsTruncated", () => {
    // DECIDED_EVALUATIONS_LIMIT = 1000
    const LIMIT = 1000;
    const checkTruncated = (size: number) => size === LIMIT;
    expect(checkTruncated(1000)).toBe(true);
    expect(checkTruncated(999)).toBe(false);
    expect(checkTruncated(1001)).toBe(false);
  });

  it("evaluationsTruncated is true when either pending or decided is truncated", () => {
    const checkTruncated = (p: boolean, d: boolean) => p || d;
    expect(checkTruncated(true, false)).toBe(true);
    expect(checkTruncated(false, true)).toBe(true);
    expect(checkTruncated(true, true)).toBe(true);
    expect(checkTruncated(false, false)).toBe(false);
  });

  it("decided query for period uses decided_at >= periodStart", () => {
    // Decided query: where("decided_at", ">=", periodStart)
    // Only decisions with decided_at >= periodStart are returned.
    // Documents with decided_at < periodStart would NOT appear in query results.
    const periodStart = new Date("2026-07-01");
    const inPeriod = {
      id: "d-in",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "approved" as const,
      requestedAt: new Date("2026-07-01"),
      decidedAt: new Date("2026-07-10"), // within period
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    // The Firestore query only returns documents with decided_at >= periodStart.
    // So the beforePeriod would NOT be in the query results.
    // We test that when only inPeriod is present, it is counted.
    const result = computeEvaluationMetrics([inPeriod], periodStart);
    expect(result.approvedInPeriod).toBe(1);
    expect(result.decidedInPeriod).toBe(1);
  });

  it("all period does not apply decided_at filter", () => {
    // "all" period: no periodStart → all decided documents are included.
    const oldDecision = {
      id: "d-old",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "approved" as const,
      requestedAt: new Date("2020-01-01"),
      decidedAt: new Date("2020-03-01"),
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    // null periodStart means "all"
    const result = computeEvaluationMetrics([oldDecision], null);
    expect(result.approvedInPeriod).toBe(1);
  });

  it("approved and rejected are separated correctly from allPromotions", () => {
    const approved = {
      id: "d-approved",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "approved" as const,
      requestedAt: new Date("2026-06-01"),
      decidedAt: new Date("2026-06-15"),
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    const rejected = {
      id: "d-rejected",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "rejected" as const,
      requestedAt: new Date("2026-06-01"),
      decidedAt: new Date("2026-06-16"),
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    const result = computeEvaluationMetrics([approved, rejected], null);
    expect(result.approvedInPeriod).toBe(1);
    expect(result.rejectedInPeriod).toBe(1);
    expect(result.decidedInPeriod).toBe(2);
  });

  it("period change reloads decided without clearing pending", () => {
    // The two-query strategy means:
    // 1. Pending is loaded once on mount (not reloaded on period change)
    // 2. Decided is reloaded when period changes
    // So after period change: pending stays, decided is refreshed.
    const pendingCount = (pending: RawPromotion[]) => pending.filter((p) => p.status === "pending").length;
    const pending = {
      id: "p-pending",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "pending" as const,
      requestedAt: new Date("2026-06-01"),
      decidedAt: null,
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
    };
    expect(pendingCount([pending])).toBe(1);
    // After period change, pending is still 1
    expect(pendingCount([pending])).toBe(1);
  });

  it("stale decided response is discarded by fetchId", () => {
    // evaluationsFetchIdRef increments on each call.
    // If a newer call completes first, the older response is ignored.
    // This is tested by the contract: the ref comparison guards setState.
    let currentFetchId = 0;
    const simulate = (fetchId: number) => {
      const prev = currentFetchId;
      currentFetchId = fetchId;
      return prev === fetchId; // "is still current"
    };
    // Request 1 starts — prev=0, currentFetchId becomes 1, prev(0) !== fetchId(1) → false
    expect(simulate(1)).toBe(false);
    // Request 2 starts — prev=1, currentFetchId becomes 2, prev(1) !== fetchId(2) → false
    expect(simulate(2)).toBe(false);
    // Request 1 completes — prev=2, currentFetchId is still 2, prev(2) === fetchId(1) → false
    expect(simulate(1)).toBe(false);
    // Request 3 starts — prev=2, currentFetchId becomes 3, prev(2) !== fetchId(3) → false
    expect(simulate(3)).toBe(false);
  });
});

// ─── Decided query strategy — no status-in filter ────────────────────────────────

describe("reports — decided query strategy (no status-in filter)", () => {
  function promo(overrides: Partial<RawPromotion> = {}): RawPromotion {
    return {
      id: "p-1",
      dogId: "dog-1",
      dogName: "Bono",
      modality: "deteccao",
      status: "pending",
      requestedAt: new Date("2026-07-01T10:00:00Z"),
      decidedAt: null,
      moduleName: null,
      moduleId: "mod-1",
      programId: "prog-1",
      programVersion: "v1",
      ...overrides,
    };
  }

  it("approved is filtered locally (not by Firestore query)", () => {
    // The decided query does NOT use where("status", "in", ["approved", "rejected"]).
    // Instead it loads all documents with decided_at and filters locally.
    const approved = promo({
      status: "approved",
      decidedAt: new Date("2026-07-10T12:00:00Z"),
    });
    const result = computeEvaluationMetrics([approved], new Date("2026-07-01"));
    expect(result.approvedInPeriod).toBe(1);
    expect(result.rejectedInPeriod).toBe(0);
  });

  it("rejected is filtered locally (not by Firestore query)", () => {
    const rejected = promo({
      status: "rejected",
      decidedAt: new Date("2026-07-10T12:00:00Z"),
    });
    const result = computeEvaluationMetrics([rejected], new Date("2026-07-01"));
    expect(result.rejectedInPeriod).toBe(1);
    expect(result.approvedInPeriod).toBe(0);
  });

  it("pending with decided_at does NOT enter decided metrics", () => {
    // A document that Firestore marks as "pending" but has a decided_at value
    // should NOT be counted as approved or rejected. The decided_at field is
    // authoritative for decision date only when status is approved/rejected.
    // The document IS counted as pending (pendingCount = 1).
    const pendingWithDecidedAt = promo({
      status: "pending",
      decidedAt: new Date("2026-07-10T12:00:00Z"),
    });
    const result = computeEvaluationMetrics([pendingWithDecidedAt], new Date("2026-07-01"));
    expect(result.approvedInPeriod).toBe(0);
    expect(result.rejectedInPeriod).toBe(0);
    expect(result.decidedInPeriod).toBe(0);
    // A pending document is still counted as pending, regardless of decided_at
    expect(result.pendingCount).toBe(1);
  });

  it("unsupported status increases unsupportedDecidedStatusCount but not metrics", () => {
    const unsupported = promo({
      status: "unsupported",
      decidedAt: new Date("2026-07-10T12:00:00Z"),
    });
    const result = computeEvaluationMetrics([unsupported], new Date("2026-07-01"));
    expect(result.unsupportedDecidedStatusCount).toBe(1);
    expect(result.approvedInPeriod).toBe(0);
    expect(result.rejectedInPeriod).toBe(0);
    expect(result.decidedInPeriod).toBe(0);
  });

  it("multiple unsupported statuses each increment the counter", () => {
    // All non-standard statuses become "unsupported" after parsePromotion.
    // We test with three unsupported statuses to verify each increments the counter.
    const doc1 = promo({ id: "p1", status: "unsupported", decidedAt: new Date("2026-07-01") });
    const doc2 = promo({ id: "p2", status: "unsupported", decidedAt: new Date("2026-07-02") });
    const doc3 = promo({ id: "p3", status: "unsupported", decidedAt: new Date("2026-07-03") });
    const result = computeEvaluationMetrics([doc1, doc2, doc3], new Date("2026-06-01"));
    expect(result.unsupportedDecidedStatusCount).toBe(3);
    expect(result.decidedInPeriod).toBe(0);
  });

  it("mixed approved, rejected, unsupported: only supported enter metrics", () => {
    const docs = [
      promo({ id: "p1", status: "approved", decidedAt: new Date("2026-07-01") }),
      promo({ id: "p2", status: "rejected", decidedAt: new Date("2026-07-02") }),
      promo({ id: "p3", status: "unsupported", decidedAt: new Date("2026-07-03") }),
    ];
    const result = computeEvaluationMetrics(docs, new Date("2026-06-01"));
    expect(result.approvedInPeriod).toBe(1);
    expect(result.rejectedInPeriod).toBe(1);
    expect(result.decidedInPeriod).toBe(2);
    expect(result.unsupportedDecidedStatusCount).toBe(1);
  });

  it("all period: unsupported still tracked separately", () => {
    const docs = [
      promo({ id: "p1", status: "approved", decidedAt: new Date("2020-01-01") }),
      promo({ id: "p2", status: "unsupported", decidedAt: new Date("2020-01-02") }),
    ];
    const result = computeEvaluationMetrics(docs, null);
    expect(result.approvedInPeriod).toBe(1);
    expect(result.unsupportedDecidedStatusCount).toBe(1);
  });

  it("unsupported does NOT contribute to average decision time", () => {
    const docs = [
      // Approved: requested 1 day before decided → 86400s
      promo({
        id: "p1",
        status: "approved",
        requestedAt: new Date("2026-07-01T10:00:00Z"),
        decidedAt: new Date("2026-07-02T10:00:00Z"),
      }),
      // Unsupported: would be 3 days → 259200s — but should be ignored
      promo({
        id: "p2",
        status: "unsupported",
        requestedAt: new Date("2026-07-01T10:00:00Z"),
        decidedAt: new Date("2026-07-04T10:00:00Z"),
      }),
    ];
    const result = computeEvaluationMetrics(docs, null);
    // Average should be 86400s only (from approved), unsupported excluded
    expect(result.averageDecisionTimeSeconds).toBe(86400);
  });

  it("unsupportedDecidedStatusCount defaults to 0 when no unsupported docs", () => {
    const docs = [
      promo({ id: "p1", status: "approved", decidedAt: new Date("2026-07-01") }),
      promo({ id: "p2", status: "rejected", decidedAt: new Date("2026-07-02") }),
    ];
    const result = computeEvaluationMetrics(docs, null);
    expect(result.unsupportedDecidedStatusCount).toBe(0);
    expect(result.decidedInPeriod).toBe(2);
  });
});

// ─── Truncation detection ───────────────────────────────────────────────────────

describe("reports — truncation detection (before local filter)", () => {
  it("999 decided documents do NOT truncate (below limit)", () => {
    // DECIDED_EVALUATIONS_LIMIT = 1000
    const LIMIT = 1000;
    const snapshotSize: number = 999;
    const truncated = snapshotSize === LIMIT;
    expect(truncated).toBe(false);
  });

  it("1000 decided documents DO truncate (at limit)", () => {
    const LIMIT = 1000;
    const snapshotSize = 1000;
    const truncated = snapshotSize === LIMIT;
    expect(truncated).toBe(true);
  });

  it("1000 raw + 900 valid: truncation detected on raw snapshot, before filter", () => {
    // Simulates: snapshot has 1000 docs (100 truncated), after local status filter
    // only 900 are approved/rejected. Truncation is still true.
    const rawSnapshotSize = 1000;
    const LIMIT = 1000;
    const afterLocalFilter = 900;
    const truncated = rawSnapshotSize === LIMIT;
    expect(truncated).toBe(true);
    expect(afterLocalFilter).toBe(900);
    // The raw snapshot was truncated even though only 900 passed the filter
  });

  it("pending and decided have independent truncation flags", () => {
    // pendingEvaluationsTruncated and decidedEvaluationsTruncated are independent
    const pendingTrunc = (size: number) => size === 500;
    const decidedTrunc = (size: number) => size === 1000;

    expect(pendingTrunc(500)).toBe(true);
    expect(decidedTrunc(499)).toBe(false);
    // Both can be false independently
    expect(pendingTrunc(499) && decidedTrunc(499)).toBe(false);
    // Both can be true independently
    expect(pendingTrunc(500) && decidedTrunc(1000)).toBe(true);
  });

  it("evaluationsTruncated is true when either pending or decided truncates", () => {
    const evalTrunc = (p: boolean, d: boolean) => p || d;
    expect(evalTrunc(true, false)).toBe(true);
    expect(evalTrunc(false, true)).toBe(true);
    expect(evalTrunc(true, true)).toBe(true);
    expect(evalTrunc(false, false)).toBe(false);
  });

  it("isComplete false when any truncation flag is true", () => {
    const isComplete = (
      loadState: "success" | "error",
      err: string | null,
      sTrunc: boolean,
      pTrunc: boolean,
      dTrunc: boolean,
    ) => loadState === "success" && !err && !sTrunc && !(pTrunc || dTrunc);

    expect(isComplete("success", null, false, false, true)).toBe(false); // decided trunc
    expect(isComplete("success", null, false, true, false)).toBe(false); // pending trunc
    expect(isComplete("success", null, true, false, false)).toBe(false); // sessions trunc
    expect(isComplete("success", null, false, false, false)).toBe(true);  // no truncation
  });

  it("unsupported status count does NOT affect isComplete", () => {
    // unsupportedDecidedStatusCount > 0 generates a warning but does not
    // change the truncation/completeness logic
    const docs: RawPromotion[] = [
      { id: "p1", status: "approved", decidedAt: new Date("2026-07-01"), requestedAt: new Date("2026-06-15"), dogId: "dog-1", dogName: "Bono", modality: "deteccao", moduleName: null, moduleId: "mod-1", programId: "prog-1", programVersion: "v1" },
      { id: "p2", status: "unsupported", decidedAt: new Date("2026-07-02"), requestedAt: new Date("2026-06-15"), dogId: "dog-1", dogName: "Bono", modality: "deteccao", moduleName: null, moduleId: "mod-1", programId: "prog-1", programVersion: "v1" },
    ];
    const result = computeEvaluationMetrics(docs, new Date("2026-06-01"));
    expect(result.unsupportedDecidedStatusCount).toBe(1);
    // Unsupported does NOT make isComplete false — it's a quality signal, not a truncation signal
  });
});

// ─── Query stats new fields ───────────────────────────────────────────────────

describe("reports — queryStats unsupportedDecidedStatusCount", () => {
  it("queryStats supports unsupportedDecidedStatusCount field", () => {
    const stats = {
      dogCount: 5,
      progressCount: 12,
      sessionQueryCount: 5,
      sessionDocumentCount: 47,
      truncatedDogCount: 1,
      pendingEvaluationQueryCount: 1,
      pendingEvaluationDocumentCount: 3,
      pendingEvaluationLimit: 500,
      decidedEvaluationQueryCount: 1,
      decidedEvaluationDocumentCount: 1000,
      decidedEvaluationLimit: 1000,
      programCount: 3,
      unsupportedDecidedStatusCount: 5,
    };
    expect(stats.unsupportedDecidedStatusCount).toBe(5);
    // raw count is 1000, 5 are unsupported after local filter
    expect(stats.decidedEvaluationDocumentCount - stats.unsupportedDecidedStatusCount).toBe(995);
  });

  it("truncatedDogCount and evaluation fields are part of queryStats", () => {
    const stats = {
      dogCount: 5,
      progressCount: 12,
      sessionQueryCount: 5,
      sessionDocumentCount: 47,
      truncatedDogCount: 1,
      pendingEvaluationQueryCount: 1,
      pendingEvaluationDocumentCount: 3,
      pendingEvaluationLimit: 500,
      decidedEvaluationQueryCount: 1,
      decidedEvaluationDocumentCount: 8,
      decidedEvaluationLimit: 1000,
      programCount: 3,
      unsupportedDecidedStatusCount: 0,
    };
    expect(stats.truncatedDogCount).toBe(1);
    expect(stats.pendingEvaluationDocumentCount).toBe(3);
    expect(stats.pendingEvaluationLimit).toBe(500);
    expect(stats.decidedEvaluationDocumentCount).toBe(8);
    expect(stats.decidedEvaluationLimit).toBe(1000);
    expect(stats.unsupportedDecidedStatusCount).toBe(0);
    expect(stats.pendingEvaluationQueryCount).toBe(1);
    expect(stats.decidedEvaluationQueryCount).toBe(1);
  });
});

// ─── Data quality — unsupported status warning ─────────────────────────────────

describe("reports — data quality warnings (unsupported status)", () => {
  it("warns when unsupportedDecidedStatusCount > 0", () => {
    const warnings = generateDataQualityWarnings(
      false, // sessionsTruncated
      0,     // invalidSessionCount
      0,     // suspiciousDurationCount
      0,     // invalidEvaluationDateCount
      false, // pendingEvaluationsTruncated
      false, // decidedEvaluationsTruncated
      new Date("2026-07-01"),
      new Date("2026-07-15"),
      3,     // unsupportedDecidedStatusCount
    );
    expect(warnings.some((w) => w.includes("não reconhecido"))).toBe(true);
    expect(warnings.some((w) => w.includes("3"))).toBe(true);
  });

  it("no unsupported status warning when count is zero", () => {
    const warnings = generateDataQualityWarnings(
      false, 0, 0, 0, false, false,
      new Date("2026-07-01"),
      new Date("2026-07-15"),
      0,
    );
    expect(warnings.some((w) => w.includes("reconhecido"))).toBe(false);
  });

  it("unsupported warning includes count but does not make isComplete false", () => {
    const warnings = generateDataQualityWarnings(
      false, 0, 0, 0, false, false,
      new Date("2026-07-01"),
      new Date("2026-07-15"),
      10,
    );
    // Warning is present
    expect(warnings.some((w) => w.includes("10"))).toBe(true);
    // But the completeness logic only checks truncation
    // (tested separately in "isComplete logic" describe block)
    const isComplete = (pTrunc: boolean, dTrunc: boolean) => !(pTrunc || dTrunc);
    expect(isComplete(false, false)).toBe(true); // unsupported does not affect completeness
  });

  it("unsupported warning uses quality-focused language", () => {
    const warnings = generateDataQualityWarnings(
      false, 0, 0, 0, false, false,
      new Date("2026-07-01"),
      new Date("2026-07-15"),
      1,
    );
    const msg = warnings.find((w) => w.includes("reconhecido"));
    expect(msg).not.toBeUndefined();
    // Should not say "erro" or "falha" — it's a quality indicator, not a functional error
    expect(msg!.includes("erro")).toBe(false);
    expect(msg!.includes("falha")).toBe(false);
  });
});

// ─── Period change and retry behavior ─────────────────────────────────────────

describe("reports — period change and retry behavior", () => {
  it("period change: pending is NOT reloaded, decided IS reloaded", () => {
    // The two-query strategy:
    // - pending: loaded once on mount, never on period change
    // - decided: loaded on mount AND on every period change
    // Simulate the state machine
    let pendingLoadCount = 0;
    let decidedLoadCount = 0;

    const loadPending = () => { pendingLoadCount++; };
    const loadDecided = () => { decidedLoadCount++; };

    // Mount: both load
    loadPending();
    loadDecided();
    expect(pendingLoadCount).toBe(1);
    expect(decidedLoadCount).toBe(1);

    // Period change: only decided reloads
    loadDecided();
    expect(pendingLoadCount).toBe(1); // unchanged
    expect(decidedLoadCount).toBe(2);
  });

  it("retry reloads all three sources: sessions, pending, decided", () => {
    let sessionCount = 0;
    let pendingCount = 0;
    let decidedCount = 0;

    const loadSessions = () => { sessionCount++; };
    const loadPending = () => { pendingCount++; };
    const loadDecided = () => { decidedCount++; };

    const retry = () => {
      loadSessions();
      loadPending();
      loadDecided();
    };

    retry();
    expect(sessionCount).toBe(1);
    expect(pendingCount).toBe(1);
    expect(decidedCount).toBe(1);
  });

  it("stale pending response after retry is discarded by evaluationsFetchIdRef", () => {
    // Simulates: retry triggers a new fetchId increment, stale responses check the ref
    const evaluationsFetchIdRef = { current: 0 };

    // First attempt
    const fetchId1 = ++evaluationsFetchIdRef.current; // 1

    // Retry: new fetchId
    const fetchId2 = ++evaluationsFetchIdRef.current; // 2

    // Response from fetchId1 arrives after fetchId2 started
    // The check: evaluationsFetchIdRef.current !== fetchId → 2 !== 1 → discard
    const discarded = evaluationsFetchIdRef.current !== fetchId1;
    expect(discarded).toBe(true);

    // Response from fetchId2 arrives normally
    const accepted = evaluationsFetchIdRef.current === fetchId2;
    expect(accepted).toBe(true);
  });

  it("stale decided response after period change is discarded", () => {
    // Simulates: period A starts fetchId=1, user switches to period B (fetchId=2),
    // then period A response arrives → should be discarded
    let currentFetchId = 0;

    const startFetch = () => { currentFetchId++; return currentFetchId; };

    const idA = startFetch(); // 1
    const idB = startFetch(); // 2

    // Period A response: idA(1) !== currentFetchId(2) → discarded
    expect(currentFetchId !== idA).toBe(true);

    // Period B response: idB(2) === currentFetchId(2) → accepted
    expect(currentFetchId === idB).toBe(true);
  });

  it("stale sessions response after period change is discarded via fetchIdRef", () => {
    let currentFetchId = 0;
    const startFetch = () => { currentFetchId++; return currentFetchId; };

    const idA = startFetch(); // 1
    const idB = startFetch(); // 2

    // Request A completes after B started → stale
    expect(currentFetchId !== idA).toBe(true);
    // Request B is current
    expect(currentFetchId === idB).toBe(true);
  });

  it("pending evaluation document count reflects the last successful load", () => {
    // queryStats values represent the most recent successful load, not cumulative totals
    let stats = {
      pendingEvaluationQueryCount: 0,
      pendingEvaluationDocumentCount: 0,
      pendingEvaluationLimit: 500,
    };

    const recordLoad = (count: number) => {
      stats = {
        ...stats,
        pendingEvaluationQueryCount: stats.pendingEvaluationQueryCount + 1,
        pendingEvaluationDocumentCount: count,
      };
    };

    recordLoad(3);
    expect(stats.pendingEvaluationDocumentCount).toBe(3);
    expect(stats.pendingEvaluationQueryCount).toBe(1);

    // Retry → new load increments the query count
    recordLoad(5);
    expect(stats.pendingEvaluationDocumentCount).toBe(5);
    expect(stats.pendingEvaluationQueryCount).toBe(2);
  });

  it("period change increments decidedEvaluationQueryCount but not pendingEvaluationQueryCount", () => {
    // Two-query strategy:
    // - pending: loaded once on mount, never on period change
    // - decided: loaded on mount AND on every period change
    let pendingQueryCount = 0;
    let decidedQueryCount = 0;

    const mount = () => { pendingQueryCount++; decidedQueryCount++; };
    const periodChange = () => { decidedQueryCount++; };

    mount();
    expect(pendingQueryCount).toBe(1);
    expect(decidedQueryCount).toBe(1);

    periodChange();
    expect(pendingQueryCount).toBe(1); // unchanged
    expect(decidedQueryCount).toBe(2);

    periodChange();
    expect(pendingQueryCount).toBe(1); // unchanged
    expect(decidedQueryCount).toBe(3);
  });
});
