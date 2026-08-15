/**
 * Pure aggregation and computation utilities for Training Reports.
 *
 * All functions are synchronous and accept plain data structures.
 * No Firestore SDK calls — only data transformation.
 */

import type {
  CurrentStateMetrics,
  DogActivity,
  DurationMetrics,
  EvaluationMetrics,
  IndividualTimelineEvent,
  RejectedModuleSummary,
  ResolvedReportWindow,
  SessionMetrics,
  TrainingReportPeriod,
} from "../types/training-reports";

// ─── Period Resolution ──────────────────────────────────────────────────────────

/**
 * Resolve the start date for a given report period.
 * Returns null for "all" (no lower bound).
 *
 * @param period  The period key.
 * @param now     Reference date for the calculation (enables deterministic testing).
 */
export function resolveReportStartDate(
  period: TrainingReportPeriod,
  now: Date = new Date(),
): Date | null {
  if (period === "all") return null;
  const days =
    period === "7d" ? 7 : period === "30d" ? 30 : period === "60d" ? 60 : period === "90d" ? 90 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Validate that a value is a usable `Date` for Firestore temporal filters.
 *
 * The Firestore Web SDK accepts a JavaScript `Date` for `where(field, ">=", value)`
 * constraints on timestamp fields. Passing `undefined`, `null`, or `Invalid Date`
 * causes serialization failures (e.g. `Cannot read properties of undefined (reading
 * 'toMillis')`) before the request reaches the backend.
 *
 * Returns true only when:
 *   - the value is an instance of `Date`; AND
 *   - `getTime()` returns a finite number.
 */
export function isValidReportDate(value: unknown): value is Date {
  return (
    value instanceof Date &&
    Number.isFinite(value.getTime())
  );
}

/**
 * Resolve a report period into an explicit window contract.
 *
 * This is the single source of truth for "should the temporal `where`
 * filter be applied?". It intentionally separates the three valid outcomes:
 *
 *   - all      → caller MUST skip `where`.
 *   - bounded  → caller MUST apply `where(field, ">=", start)`.
 *   - invalid  → caller MUST NOT call `getDocs`. The query would either
 *                degrade into "everything" (silent corruption) or fail at
 *                the SDK serializer with a `toMillis` TypeError. Both are
 *                unacceptable for a time-bounded period.
 *
 * The `now` argument enables deterministic testing.
 */
export function resolveReportWindow(
  period: TrainingReportPeriod,
  now: Date = new Date(),
): ResolvedReportWindow {
  if (period === "all") return { kind: "all" };

  const days =
    period === "7d" ? 7 :
    period === "30d" ? 30 :
    period === "60d" ? 60 :
    period === "90d" ? 90 :
    null;

  if (days === null) {
    return { kind: "invalid", reason: "periodo desconhecido" };
  }

  if (!isValidReportDate(now)) {
    return { kind: "invalid", reason: "data de referencia invalida" };
  }

  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  if (!isValidReportDate(start)) {
    return { kind: "invalid", reason: "data inicial invalida" };
  }

  return { kind: "bounded", start };
}

/**
 * Friendly, user-visible error message for a configured-period failure.
 * The technical reason is intentionally hidden from the UI.
 */
export const INVALID_PERIOD_USER_MESSAGE =
  "Não foi possível aplicar o período selecionado.";

// ─── Normalization ─────────────────────────────────────────────────────────────

/**
 * Normalize a modality value to its canonical form.
 * Delegates to the shared k9-modalities module.
 */
export function normalizeModality(value: string): string {
  // Lazy import to avoid circular dependency issues at module load time.
  return _canonicalModality(value);
}

let _canonicalModality: (v: string) => string = (v: string) => v;

/** Inject the actual normalization function (called once from the provider). */
export function setModalityNormalizer(fn: (v: string) => string): void {
  _canonicalModality = fn;
}

// ─── Current State ─────────────────────────────────────────────────────────────

/**
 * Compute current-state snapshot metrics from progress documents.
 *
 * progressEntries: Array of { dogId, modality, status }
 *   status values recognized: "in_formation", "operational" (with normalization)
 */
export function computeCurrentStateMetrics(
  progressEntries: Array<{ dogId: string; modality: string; status: string }>,
  activePrograms: number,
  totalModules: number,
): CurrentStateMetrics {
  const byDogModality = new Map<string, typeof progressEntries[number]>();

  for (const entry of progressEntries) {
    const key = `${entry.dogId}:${entry.modality}`;
    const existing = byDogModality.get(key);
    if (!existing || statusPriority(entry.status) > statusPriority(existing.status)) {
      byDogModality.set(key, entry);
    }
  }

  const entries = Array.from(byDogModality.values());

  const inFormation = entries.filter((e) =>
    isInFormationStatus(e.status),
  );
  const operational = entries.filter((e) =>
    isOperationalStatus(e.status),
  );

  const dogsInFormation = new Set(inFormation.map((e) => e.dogId)).size;
  const dogsTechnicallyTrained = new Set(operational.map((e) => e.dogId)).size;

  return {
    dogsInFormation,
    formationsInProgress: inFormation.length,
    dogsTechnicallyTrained,
    modalitiesConcluded: operational.length,
    pendingRequests: 0, // filled by provider
    activePrograms,
    totalModules,
  };
}

function statusPriority(status: string): number {
  const s = status.toLowerCase().replace(/[_\s-]/g, "");
  if (s === "operational" || s === "operacional") return 3;
  if (s === "information" || s === "emformacao" || s === "formation") return 2;
  return 1;
}

export function isInFormationStatus(status: string): boolean {
  const s = status.toLowerCase().replace(/[_\s-]/g, "");
  return (
    s === "in_formation" ||
    s === "information" ||
    s === "em_formacao" ||
    s === "emformacao" ||
    s === "formacao" ||
    s === "formation"
  );
}

export function isOperationalStatus(status: string): boolean {
  const s = status.toLowerCase().replace(/[_\s-]/g, "");
  return s === "operational" || s === "operacional";
}

// ─── Session Metrics ────────────────────────────────────────────────────────────

/**
 * Parse a session document (raw Firestore data + metadata).
 */
export type RawSession = {
  dogId: string;
  dogName: string;
  id: string;
  modality: string;
  startedAt: Date | null;
  durationS: number | null;
  _invalid?: boolean;
};

/**
 * Compute session metrics from parsed sessions.
 * Sessions must already be deduplicated by dogId+id.
 *
 * @param sessions        Parsed sessions (may be filtered by modality already).
 * @param periodStart     Lower bound date, or null for "all".
 * @param modalityFilter Canonical modality to scope sessions (null = all).
 */
export function computeSessionMetrics(
  sessions: RawSession[],
  periodStart: Date | null,
  modalityFilter: string | null,
): SessionMetrics {
  // Apply period filter
  const inPeriod = periodStart
    ? sessions.filter((s) => s.startedAt && s.startedAt >= periodStart)
    : sessions;

  // Apply modality filter
  const filtered = modalityFilter
    ? inPeriod.filter((s) => s.modality === modalityFilter)
    : inPeriod;

  // Deduplicate by dogId+id (should already be done by loader)
  const seen = new Set<string>();
  const unique = filtered.filter((s) => {
    const key = `${s.dogId}/${s.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const sessionsInPeriod = unique.length;

  const dogIds = new Set<string>();
  const modalities = new Set<string>();
  const daysSet = new Set<string>();
  const sessionsByDog = new Map<string, number>();
  const lastSessionByDog = new Map<string, Date | null>();

  for (const s of unique) {
    dogIds.add(s.dogId);
    modalities.add(s.modality);
    sessionsByDog.set(
      s.dogId,
      (sessionsByDog.get(s.dogId) ?? 0) + 1,
    );

    const existing = lastSessionByDog.get(s.dogId);
    if (
      s.startedAt &&
      (!existing || s.startedAt > existing)
    ) {
      lastSessionByDog.set(s.dogId, s.startedAt);
    }

    if (s.startedAt) {
      const dayKey = dateToDayKey(s.startedAt);
      daysSet.add(dayKey);
    }
  }

  // First and last within the period (already filtered)
  const sorted = [...unique]
    .filter((s) => s.startedAt != null)
    .sort((a, b) => b.startedAt!.getTime() - a.startedAt!.getTime());

  return {
    sessionsInPeriod,
    distinctDogsTrained: dogIds.size,
    distinctModalitiesTrained: modalities.size,
    distinctTrainingDays: daysSet.size,
    sessionsByDog: Object.fromEntries(sessionsByDog),
    sessionsByModality: Object.fromEntries(
      [...unique.reduce((acc, s) => {
        acc.set(s.modality, (acc.get(s.modality) ?? 0) + 1);
        return acc;
      }, new Map<string, number>())],
    ),
    lastSessionByDog: Object.fromEntries(lastSessionByDog),
    firstSessionInPeriod: sorted.length > 0 ? sorted[sorted.length - 1]!.startedAt : null,
    lastSessionInPeriod: sorted.length > 0 ? sorted[0]!.startedAt : null,
  };
}

function dateToDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ─── Duration ──────────────────────────────────────────────────────────────────

/**
 * Technical ceiling for a plausible single training session (seconds).
 * Values above this are counted as suspicious but NOT summed into total duration.
 * This limit is for data-quality reporting only — sessions are never silently dropped.
 */
export const MAX_REASONABLE_SESSION_DURATION_SECONDS = 4 * 60 * 60; // 4 hours

/**
 * Check whether a duration value is valid for reporting.
 * Valid = number, finite, greater than zero.
 */
export function isValidDuration(durationS: number | null): boolean {
  return (
    typeof durationS === "number" &&
    Number.isFinite(durationS) &&
    durationS > 0
  );
}

/**
 * Check whether a valid duration value exceeds the reasonable ceiling.
 * Such values are flagged as suspicious but still counted in coverage.
 */
export function isSuspiciousDuration(durationS: number): boolean {
  return durationS > MAX_REASONABLE_SESSION_DURATION_SECONDS;
}

/**
 * Compute duration metrics from a list of sessions.
 * @param sessions Sessions (already filtered by period/modality).
 */
export function computeDurationMetrics(sessions: RawSession[]): DurationMetrics {
  let registeredDurationSeconds = 0;
  let sessionsWithDuration = 0;
  let sessionsWithoutDuration = 0;
  let invalidDurationCount = 0;
  let suspiciousDurationCount = 0;

  for (const s of sessions) {
    if (s._invalid) {
      invalidDurationCount++;
      continue;
    }
    if (s.durationS == null) {
      sessionsWithoutDuration++;
      continue;
    }
    if (!isValidDuration(s.durationS)) {
      invalidDurationCount++;
      continue;
    }
    if (isSuspiciousDuration(s.durationS)) {
      // Count as "with duration" for coverage, but do NOT sum into total
      sessionsWithDuration++;
      suspiciousDurationCount++;
      continue;
    }
    sessionsWithDuration++;
    registeredDurationSeconds += s.durationS;
  }

  const total = sessions.length;
  const durationCoveragePercentage =
    total > 0 ? Math.round((sessionsWithDuration / total) * 100) : 0;

  return {
    registeredDurationSeconds,
    sessionsWithDuration,
    sessionsWithoutDuration,
    durationCoveragePercentage,
    invalidDurationCount,
    suspiciousDurationCount,
  };
}

// ─── Dog Activity ──────────────────────────────────────────────────────────────

export type DogWithProgress = {
  dogId: string;
  dogName: string;
  /** Modality to scope last-session lookup (null = any modality). */
  scopeModality: string | null;
  /** All canonical modalities with progress for this dog. */
  modalities: string[];
};

/**
 * Compute dog activity for all dogs with progress.
 *
 * @param dogsWithProgress  Dogs that have at least one progress document.
 * @param lastSessionByDog Latest session date per dog (modality-scoped).
 * @param now              Reference date for days-since calculation.
 */
export function computeDogActivity(
  dogsWithProgress: DogWithProgress[],
  lastSessionByDog: Record<string, Date | null>,
  now: Date = new Date(),
): DogActivity[] {
  return dogsWithProgress.map((dog) => {
    const lastSessionAt = lastSessionByDog[dog.dogId] ?? null;

    if (!lastSessionAt) {
      return {
        dogId: dog.dogId,
        dogName: dog.dogName,
        modality: dog.scopeModality,
        modalities: dog.modalities,
        lastSessionAt: null,
        daysSinceLastSession: null,
        neverTrained: true,
        inactiveOver7Days: false,
        inactiveOver30Days: false,
        inactiveOver60Days: false,
        inactiveOver90Days: false,
      };
    }

    const diffMs = now.getTime() - lastSessionAt.getTime();
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    return {
      dogId: dog.dogId,
      dogName: dog.dogName,
      modality: dog.scopeModality,
      modalities: dog.modalities,
      lastSessionAt,
      daysSinceLastSession: days,
      neverTrained: false,
      inactiveOver7Days: days > 7,
      inactiveOver30Days: days > 30,
      inactiveOver60Days: days > 60,
      inactiveOver90Days: days > 90,
    };
  });
}

// ─── Evaluation Metrics ────────────────────────────────────────────────────────

export type RawPromotion = {
  id: string;
  dogId: string;
  dogName: string;
  modality: string;
  /** May include "unsupported" when a document has a status not recognized as pending/approved/rejected. */
  status: "pending" | "approved" | "rejected" | "unsupported";
  /** requested_at has priority over created_at. */
  requestedAt: Date | null;
  /** decided_at is the authoritative decision date. */
  decidedAt: Date | null;
  /** Source module name (for rejected-by-module aggregation). */
  moduleName: string | null;
  moduleId: string | null;
  programId: string;
  programVersion: string;
};

/**
 * Compute evaluation metrics.
 *
 * - Pending: always counted regardless of period.
 * - Approved/Rejected: counted only when decidedAt falls within the period.
 * - Decision time: computed from requestedAt (priority) or createdAt to decidedAt.
 * - Documents with unexpected status (not approved/rejected/pending) are counted
 *   separately as unsupportedDecidedStatusCount and excluded from all metrics.
 */
export function computeEvaluationMetrics(
  promotions: RawPromotion[],
  periodStart: Date | null,
): EvaluationMetrics {
  const pending = promotions.filter((p) => p.status === "pending");

  // Documents that were loaded by decided_at query but have unexpected status.
  // These are counted for quality reporting but NOT included in any metric.
  const unsupported = promotions.filter((p) => {
    if (p.status === "pending") return false;
    if (p.status === "approved" || p.status === "rejected") return false;
    return true;
  });

  const decided = promotions.filter((p) => p.status === "approved" || p.status === "rejected");

  const decidedInPeriod = periodStart
    ? decided.filter((p) => p.decidedAt && p.decidedAt >= periodStart)
    : decided;

  const approvedInPeriod = decidedInPeriod.filter((p) => p.status === "approved").length;
  const rejectedInPeriod = decidedInPeriod.filter((p) => p.status === "rejected").length;

  // Count invalid dates for pending promotions (no requestedAt)
  let invalidDateCount = 0;
  for (const p of pending) {
    if (!p.requestedAt) {
      invalidDateCount++;
    }
  }

  // Compute decision times only for requests with valid dates
  const decisionTimes: number[] = [];

  for (const p of promotions) {
    if (p.status === "pending") continue;
    if (p.status !== "approved" && p.status !== "rejected") continue; // skip unsupported
    if (!p.decidedAt || !p.requestedAt) {
      invalidDateCount++;
      continue;
    }
    const diffMs = p.decidedAt.getTime() - p.requestedAt.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) {
      invalidDateCount++;
      continue;
    }
    decisionTimes.push(diffMs / 1000); // seconds
  }

  const avgDecisionTimeSeconds =
    decisionTimes.length > 0
      ? Math.round(
          (decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length) * 10,
        ) / 10
      : null;

  const medianDecisionTimeSeconds =
    decisionTimes.length > 0
      ? (() => {
          const sorted = [...decisionTimes].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 === 0
            ? Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10
            : Math.round(sorted[mid]! * 10) / 10;
        })()
      : null;

  // Oldest pending request
  let oldestPendingAgeSeconds: number | null = null;
  const now = new Date();
  for (const p of pending) {
    if (!p.requestedAt) continue;
    const age = (now.getTime() - p.requestedAt.getTime()) / 1000;
    if (
      oldestPendingAgeSeconds === null ||
      age > oldestPendingAgeSeconds
    ) {
      oldestPendingAgeSeconds = Math.round(age);
    }
  }

  return {
    pendingCount: pending.length,
    approvedInPeriod,
    rejectedInPeriod,
    decidedInPeriod: decidedInPeriod.length,
    averageDecisionTimeSeconds: avgDecisionTimeSeconds,
    medianDecisionTimeSeconds,
    oldestPendingAgeSeconds,
    invalidDateCount,
    unsupportedDecidedStatusCount: unsupported.length,
  };
}

// ─── Rejected by Module ────────────────────────────────────────────────────────

/**
 * Aggregate rejected promotion requests by training program + version + module.
 *
 * @param rejected  Only rejected requests (should be filtered by caller).
 * @param moduleLookup  Map of programId:programVersion:moduleId → module display name.
 */
export function computeRejectedByModule(
  rejected: RawPromotion[],
  moduleLookup: Map<string, string>,
): RejectedModuleSummary[] {
  const byKey = new Map<string, RejectedModuleSummary>();

  for (const req of rejected) {
    const key = `${req.programId}:${req.programVersion}:${req.moduleId ?? "unknown"}`;

    let entry = byKey.get(key);
    if (!entry) {
      // Resolve display name with priority: request.moduleName → matrix lookup → fallback
      const matrixName = moduleLookup.get(key);
      const moduleName =
        req.moduleName ??
        matrixName ??
        "Módulo não identificado";

      entry = {
        moduleKey: key,
        moduleId: req.moduleId ?? "unknown",
        moduleName,
        programId: req.programId,
        programVersion: req.programVersion,
        rejectedCount: 0,
        distinctDogsCount: 0,
        requestIds: [],
      };
      byKey.set(key, entry);
    }

    entry.rejectedCount++;
    entry.requestIds.push(req.id);

    // Track distinct dogs per module using a temporary Set on the entry.
    const existingDogs = (entry as unknown as { _dogs: Set<string> })._dogs ?? new Set<string>();
    existingDogs.add(req.dogId);
    (entry as unknown as { _dogs: Set<string> })._dogs = existingDogs;
  }

  // Finalize distinct counts
  const results = Array.from(byKey.values()).map((entry) => {
    const dogs = (entry as unknown as { _dogs: Set<string> })._dogs;
    return {
      ...entry,
      distinctDogsCount: dogs?.size ?? 0,
    };
  });

  return results.sort((a, b) => b.rejectedCount - a.rejectedCount);
}

// ─── Individual Timeline ────────────────────────────────────────────────────────

export type TimelineSource =
  | { type: "session"; id: string; dogId: string; modality: string; date: Date | null }
  | { type: "module_completed"; id: string; dogId: string; modality: string; date: Date | null; moduleName: string }
  | { type: "promotion_requested"; id: string; dogId: string; modality: string; date: Date | null }
  | { type: "promotion_approved"; id: string; dogId: string; modality: string; date: Date | null }
  | { type: "promotion_rejected"; id: string; dogId: string; modality: string; date: Date | null }
  | { type: "modality_completed"; id: string; dogId: string; modality: string; date: Date | null };

function timelineTitle(source: TimelineSource): string {
  switch (source.type) {
    case "session": return "Sessão de treinamento";
    case "module_completed": return `Módulo concluído — ${source.moduleName}`;
    case "promotion_requested": return "Solicitação de avaliação";
    case "promotion_approved": return "Avaliação aprovada";
    case "promotion_rejected": return "Avaliação rejeitada";
    case "modality_completed": return "Formação técnica concluída";
  }
}

function timelineSubtitle(source: TimelineSource): string | null {
  switch (source.type) {
    case "session": return null;
    case "module_completed": return null;
    case "promotion_requested": return "Solicitada";
    case "promotion_approved": return "Aprovada";
    case "promotion_rejected": return "Rejeitada";
    case "modality_completed": return null;
  }
}

/**
 * Build timeline events from raw sources.
 * Events without a valid date are OMITTED (not invented).
 * Results are sorted descending by date (most recent first).
 */
export function buildIndividualTimelines(
  sources: TimelineSource[],
): Record<string, IndividualTimelineEvent[]> {
  const events: IndividualTimelineEvent[] = [];

  for (const src of sources) {
    if (!src.date) continue; // Omit events without a real date

    const eventTypeMap: Record<TimelineSource["type"], IndividualTimelineEvent["eventType"]> = {
      session: "session",
      module_completed: "module_completed",
      promotion_requested: "promotion_requested",
      promotion_approved: "promotion_approved",
      promotion_rejected: "promotion_rejected",
      modality_completed: "modality_completed",
    };

    let sourceRoute: string | undefined;
    if (src.type === "session") {
      sourceRoute = `/training/sessions/${src.id}`;
    }

    events.push({
      id: `${src.type}:${src.id}`,
      dogId: src.dogId,
      modality: src.modality,
      occurredAt: src.date,
      eventType: eventTypeMap[src.type],
      title: timelineTitle(src),
      subtitle: timelineSubtitle(src),
      sourceId: src.id,
      sourceRoute,
      metadata: {},
    });
  }

  // Sort descending
  events.sort((a, b) =>
    (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0),
  );

  // Group by dogId
  const byDog = new Map<string, IndividualTimelineEvent[]>();
  for (const event of events) {
    const list = byDog.get(event.dogId) ?? [];
    list.push(event);
    byDog.set(event.dogId, list);
  }

  return Object.fromEntries(byDog);
}

// ─── Data Quality ──────────────────────────────────────────────────────────────

/**
 * Severity for a data quality warning.
 * - error: query failed (rare in this list — usually surfaced via data.error)
 * - attention: truncation, suspicious data, invalid dates, unsupported statuses
 * - info: incomplete coverage (e.g. missing durations, short history)
 */
export type DataQualitySeverity = "error" | "attention" | "info";

export interface CategorizedWarning {
  message: string;
  severity: DataQualitySeverity;
}

/**
 * Generate categorized warnings based on actual data characteristics.
 * Returns warnings already grouped by severity so the UI can render them
 * with the right visual treatment.
 */
export function generateCategorizedWarnings(
  sessionsTruncated: boolean,
  invalidSessionCount: number,
  suspiciousDurationCount: number,
  invalidEvaluationDateCount: number,
  pendingEvaluationsTruncated: boolean,
  decidedEvaluationsTruncated: boolean,
  earliestLoadedSession: Date | null,
  latestLoadedSession: Date | null,
  unsupportedDecidedStatusCount: number = 0,
): CategorizedWarning[] {
  const warnings: CategorizedWarning[] = [];

  // ── Attention: truncation ─────────────────────────────────────────────
  if (sessionsTruncated) {
    warnings.push({
      message:
        "Algumas sessões podem não ter sido carregadas devido ao limite de consulta.",
      severity: "attention",
    });
  }

  if (pendingEvaluationsTruncated) {
    warnings.push({
      message: "Há mais solicitações pendentes do que o limite carregado.",
      severity: "attention",
    });
  }

  if (decidedEvaluationsTruncated) {
    warnings.push({
      message:
        "Algumas avaliações decididas podem não ter sido carregadas devido ao limite da consulta.",
      severity: "attention",
    });
  }

  // ── Attention: data integrity ─────────────────────────────────────────
  if (suspiciousDurationCount > 0) {
    warnings.push({
      message: `${suspiciousDurationCount} sessão(ões) com duração suspeita acima do limite técnico.`,
      severity: "attention",
    });
  }

  if (invalidEvaluationDateCount > 0) {
    warnings.push({
      message: "Existem registros com datas inválidas.",
      severity: "attention",
    });
  }

  if (unsupportedDecidedStatusCount > 0) {
    warnings.push({
      message: `${unsupportedDecidedStatusCount} decisão(ões) com status não reconhecido e não incluída(s) nas métricas.`,
      severity: "attention",
    });
  }

  // ── Info: coverage gaps ──────────────────────────────────────────────
  if (earliestLoadedSession && latestLoadedSession) {
    const diffDays = Math.floor(
      (latestLoadedSession.getTime() - earliestLoadedSession.getTime()) /
        (24 * 60 * 60 * 1000),
    );
    if (diffDays < 14) {
      warnings.push({
        message:
          "O histórico carregado pode não incluir as sessões mais antigas.",
        severity: "info",
      });
    }
  }

  if (invalidSessionCount > 0) {
    warnings.push({
      message: `${invalidSessionCount} sessão(ões) não pôde(ram) ser processada(s).`,
      severity: "attention",
    });
  }

  return warnings;
}

/**
 * Generate human-readable warnings based on actual data characteristics.
 * Kept for backward compatibility — returns plain strings (attention/info only).
 */
export function generateDataQualityWarnings(
  sessionsTruncated: boolean,
  invalidSessionCount: number,
  suspiciousDurationCount: number,
  invalidEvaluationDateCount: number,
  pendingEvaluationsTruncated: boolean,
  decidedEvaluationsTruncated: boolean,
  earliestLoadedSession: Date | null,
  latestLoadedSession: Date | null,
  unsupportedDecidedStatusCount: number = 0,
): string[] {
  return generateCategorizedWarnings(
    sessionsTruncated,
    invalidSessionCount,
    suspiciousDurationCount,
    invalidEvaluationDateCount,
    pendingEvaluationsTruncated,
    decidedEvaluationsTruncated,
    earliestLoadedSession,
    latestLoadedSession,
    unsupportedDecidedStatusCount,
  ).map((w) => w.message);
}
