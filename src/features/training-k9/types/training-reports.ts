/**
 * Data-layer types for Training Reports.
 *
 * These types are independent of raw Firestore documents — they represent
 * the domain model that the future UI tab will consume.
 *
 * NOT included: UI components, chart data structures, export formats, or
 * presentation-level types.
 */

// ─── Period ───────────────────────────────────────────────────────────────────

/**
 * Report period options.
 * "all" is the full-history option; "30d" is the default.
 */
export type TrainingReportPeriod = "7d" | "30d" | "60d" | "90d" | "all";

export const REPORT_PERIOD_OPTIONS: Array<{ label: string; value: TrainingReportPeriod }> = [
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Últimos 60 dias", value: "60d" },
  { label: "Últimos 90 dias", value: "90d" },
  { label: "Todo o histórico", value: "all" },
];

export const DEFAULT_REPORT_PERIOD: TrainingReportPeriod = "30d";

// ─── Active Filters ───────────────────────────────────────────────────────────

/**
 * Active filters applied to the report.
 */
export type TrainingReportFilters = {
  period: TrainingReportPeriod;
  modality: string | null;   // canonical modality value, or null = all
  dogId: string | null;     // individual dog scope, or null = all
};

// ─── Current State (snapshot) ────────────────────────────────────────────────

/**
 * Counts that represent the current snapshot of the training program,
 * regardless of the selected period.
 */
export type CurrentStateMetrics = {
  /** Dogs in formation in at least one modality. */
  dogsInFormation: number;
  /** Formations (dog×modality) currently in formation. */
  formationsInProgress: number;
  /** Dogs with at least one operational modality. */
  dogsTechnicallyTrained: number;
  /** Modalities (dog×modality) with status operational. */
  modalitiesConcluded: number;
  /** Promotion requests awaiting decision. */
  pendingRequests: number;
  /** Active training programs. */
  activePrograms: number;
  /** Total modules across active programs. */
  totalModules: number;
};

// ─── Session Metrics ──────────────────────────────────────────────────────────

export type SessionMetrics = {
  /** Sessions with started_at within the period. */
  sessionsInPeriod: number;
  /** Distinct dog IDs with at least one session in period. */
  distinctDogsTrained: number;
  /** Distinct canonical modalities with at least one session in period. */
  distinctModalitiesTrained: number;
  /** Days that have at least one session (date-level deduplication). */
  distinctTrainingDays: number;
  /** Session count per dog. */
  sessionsByDog: Record<string, number>;
  /** Session count per canonical modality. */
  sessionsByModality: Record<string, number>;
  /** Latest session date per dog. */
  lastSessionByDog: Record<string, Date | null>;
  /** First session date within the period (null if no sessions in period). */
  firstSessionInPeriod: Date | null;
  /** Last session date within the period (null if no sessions in period). */
  lastSessionInPeriod: Date | null;
};

// ─── Duration ────────────────────────────────────────────────────────────────

export type DurationMetrics = {
  /** Sum of all valid duration_s values (seconds). */
  registeredDurationSeconds: number;
  /** Sessions with a valid, positive duration. */
  sessionsWithDuration: number;
  /** Sessions without duration_s or with invalid value. */
  sessionsWithoutDuration: number;
  /** Percentage of sessions with duration (0–100). */
  durationCoveragePercentage: number;
  /** Duration values that are NaN, negative, zero, or non-finite. */
  invalidDurationCount: number;
  /** Duration values above the technical ceiling (included in coverage, excluded from sum). */
  suspiciousDurationCount: number;
};

// ─── Dog Activity ─────────────────────────────────────────────────────────────

/**
 * Activity state for a single dog (computed from sessions in scope).
 * Computed ONLY for dogs that have at least one progress document.
 */
export type DogActivity = {
  dogId: string;
  dogName: string;
  modality: string | null;  // null = last session in any modality
  /** All canonical modalities with progress for this dog. */
  modalities: string[];
  /** Last session date for this dog (or null if no sessions). */
  lastSessionAt: Date | null;
  /** Days since lastSessionAt (null if never trained). */
  daysSinceLastSession: number | null;
  /** True when dog has progress but zero sessions. */
  neverTrained: boolean;
  inactiveOver7Days: boolean;
  inactiveOver30Days: boolean;
  inactiveOver60Days: boolean;
  inactiveOver90Days: boolean;
};

// ─── Activity Summary ────────────────────────────────────────────────────────

export type ActivitySummary = {
  /** All dogs with at least one progress document in scope. */
  dogsWithProgress: DogActivity[];
  /** Dogs with no sessions despite having progress. */
  dogsNeverTrained: DogActivity[];
  /** Dogs inactive for more than 7 days. */
  dogsInactiveOver7Days: DogActivity[];
  /** Dogs inactive for more than 30 days. */
  dogsInactiveOver30Days: DogActivity[];
  /** Dogs inactive for more than 60 days. */
  dogsInactiveOver60Days: DogActivity[];
  /** Dogs inactive for more than 90 days. */
  dogsInactiveOver90Days: DogActivity[];
};

// ─── Evaluation Metrics ──────────────────────────────────────────────────────

export type EvaluationMetrics = {
  /** Pending requests loaded from the pending query (always shown, period-independent). */
  pendingCount: number;
  /** Approved requests decided within the period (from the decided query). */
  approvedInPeriod: number;
  /** Rejected requests decided within the period (from the decided query). */
  rejectedInPeriod: number;
  /** Total decided within the period. */
  decidedInPeriod: number;
  /** Average time from request to decision (seconds). */
  averageDecisionTimeSeconds: number | null;
  /** Median time from request to decision (seconds). */
  medianDecisionTimeSeconds: number | null;
  /** Age of the oldest pending request (seconds, null if none). */
  oldestPendingAgeSeconds: number | null;
  /** Requests with invalid or missing requested_at / decided_at dates. */
  invalidDateCount: number;
  /** Decided documents with status other than approved/rejected (not counted in metrics). */
  unsupportedDecidedStatusCount: number;
};

// ─── Rejected by Module ──────────────────────────────────────────────────────

export type RejectedModuleSummary = {
  /** Composite key: programId:programVersion:moduleId */
  moduleKey: string;
  moduleId: string;
  /** Display name (from request, matrix, or fallback). */
  moduleName: string;
  programId: string;
  programVersion: string;
  rejectedCount: number;
  /** Dogs that had at least one rejection in this module. */
  distinctDogsCount: number;
  /** IDs of the rejected requests. */
  requestIds: string[];
};

// ─── Individual Timeline ─────────────────────────────────────────────────────

export type IndividualTimelineEvent = {
  /** Unique key within the dog's timeline (used for React keys). */
  id: string;
  dogId: string;
  /** Canonical modality value. */
  modality: string;
  /** Event date from the canonical source field. */
  occurredAt: Date | null;
  eventType: IndividualTimelineEventType;
  title: string;
  subtitle: string | null;
  /** Source document ID. */
  sourceId: string;
  /** Optional route to navigate to the source (e.g. /training/sessions/id). */
  sourceRoute?: string;
  /** Minimal extra metadata. */
  metadata: Record<string, unknown>;
};

export type IndividualTimelineEventType =
  | "session"
  | "module_completed"
  | "promotion_requested"
  | "promotion_approved"
  | "promotion_rejected"
  | "modality_completed";

// ─── Data Quality ─────────────────────────────────────────────────────────────

export type DataQuality = {
  /**
   * True when all data sources returned complete results.
   * Requires: success state, no error, no sessions truncated, no evaluations truncated.
   */
  isComplete: boolean;
  /** True when at least one dog reached the per-dog session limit. */
  sessionsTruncated: boolean;
  /** True when the pending-evaluations query hit its limit. */
  pendingEvaluationsTruncated: boolean;
  /** True when the decided-evaluations query hit its limit. */
  decidedEvaluationsTruncated: boolean;
  /**
   * True when either pending or decided evaluations were truncated.
   * Convenience alias for the completeness check.
   */
  evaluationsTruncated: boolean;
  /** Sessions that could not be parsed or were skipped. */
  invalidSessionCount: number;
  /** Evaluations with invalid requested_at or decided_at dates. */
  invalidEvaluationDateCount: number;
  /** Percentage of sessions with duration_s (0–100). */
  durationCoveragePercentage: number;
  /** Earliest session date among LOADED sessions (may not be the earliest available). */
  earliestLoadedSession: Date | null;
  /** Latest session date among LOADED sessions. */
  latestLoadedSession: Date | null;
  /** Human-readable warnings derived from actual data. */
  warnings: string[];
  /** Categorized warnings with severity (error | attention | info). */
  categorizedWarnings: Array<{
    message: string;
    severity: "error" | "attention" | "info";
  }>;
  /** Decided documents with a status not recognized as approved/rejected. */
  unsupportedDecidedStatusCount: number;
};

// ─── Query Stats ─────────────────────────────────────────────────────────────

/**
 * Debug/test metadata about the number of Firestore operations performed.
 * NOT shown in the UI.
 */
export type QueryStats = {
  /** Dogs that had at least one progress document (scope of session queries). */
  dogCount: number;
  /** Progress documents considered. */
  progressCount: number;
  /** Number of session subcollection queries executed. */
  sessionQueryCount: number;
  /** Number of session documents loaded (before deduplication). */
  sessionDocumentCount: number;
  /** Dogs whose session query hit the per-dog limit. */
  truncatedDogCount: number;
  /** Number of pending-evaluations Firestore queries executed (always 1 on a normal load). */
  pendingEvaluationQueryCount: number;
  /** Pending evaluations returned by the pending query. */
  pendingEvaluationDocumentCount: number;
  /** Explicit limit applied to the pending-evaluations query. */
  pendingEvaluationLimit: number;
  /** Number of decided-evaluations Firestore queries executed (1 on load, +1 on each period change). */
  decidedEvaluationQueryCount: number;
  /** Decided evaluations returned by the decided query (before local status filtering). */
  decidedEvaluationDocumentCount: number;
  /** Explicit limit applied to the decided-evaluations query. */
  decidedEvaluationLimit: number;
  /** Training programs loaded. */
  programCount: number;
  /** Decided documents with status other than approved/rejected (not included in decidedEvaluationDocumentCount after filtering). */
  unsupportedDecidedStatusCount: number;
};

// ─── Combined Provider API ───────────────────────────────────────────────────

export type TrainingReportsFilters = {
  period: TrainingReportPeriod;
  modality: string | null;
  dogId: string | null;
};

export type TrainingReportsData = {
  /** Current active filters. */
  filters: TrainingReportsFilters;

  /** Update the report period (triggers session reload). */
  setPeriod: (period: TrainingReportPeriod) => void;
  /** Update the modality filter (null = all). */
  setModality: (modality: string | null) => void;
  /** Update the dog filter (null = all). */
  setDogId: (dogId: string | null) => void;

  /** Snapshot metrics (always available, period-independent). */
  currentState: CurrentStateMetrics;
  /** Session metrics (recomputed when period or modality changes). */
  sessionMetrics: SessionMetrics;
  /** Duration metrics (derived from sessionMetrics). */
  durationMetrics: DurationMetrics;
  /** Dog activity metrics (derived from sessionMetrics). */
  activitySummary: ActivitySummary;
  /** Evaluation metrics (pending is always shown; decided is period-filtered). */
  evaluationMetrics: EvaluationMetrics;
  /** Rejected requests grouped by module. */
  rejectedByModule: RejectedModuleSummary[];
  /** Timeline events per dog (computed for dogs in scope). */
  individualTimelines: Record<string, IndividualTimelineEvent[]>;

  /** Data quality metadata. */
  dataQuality: DataQuality;
  /** Firestore query statistics (for debug/test). */
  queryStats: QueryStats;

  /** Granular loading state per data source. */
  loadingState: LoadingState;
  /** Granular error state per data source. */
  errorState: ErrorState;
  /** Session load completion status. */
  sessionLoadStatus: SessionLoadStatus;
  /** Filters that were active when data was last successfully loaded. */
  loadedFilters: LoadedFilters;
  /** Number of session queries that succeeded. */
  successfulSessionQueryCount: number;
  /** Number of session queries that failed. */
  failedSessionQueryCount: number;
  /** Aggregated loading (true while any critical source is loading). */
  loading: boolean;
  /** Error message (null when no error). */
  error: string | null;
  /** Retry function — refetches only the reports data. */
  retry: () => void;
  /** Retry only sessions (cheaper than full retry). */
  retrySessions: () => void;
  /** Retry only evaluations (pending + decided). */
  retryEvaluations: () => void;
  /** True when evaluations are not loaded because user lacks permission (not an error). */
  evaluationsSkipped: boolean;
  /**
   * Evaluation access classification:
   * - "allowed": user has permission, queries are executed normally.
   * - "restricted": user lacks permission, queries are NOT executed (not an error).
   * - "error": user has permission but queries failed (technical error).
   */
  evaluationAccess: EvaluationAccessState;
  /** Per-dog session load status. "loaded" = query succeeded (even if 0 docs), "failed" = query errored. */
  sessionStatusByDog: Record<string, "loaded" | "failed">;
};

// ─── Loading State ───────────────────────────────────────────────────────────

export type LoadingState = {
  /** Base data (effective dogs + training K9) still loading. */
  base: boolean;
  /** Session data is being fetched. */
  sessions: boolean;
  /** Evaluation data is being fetched. */
  evaluations: boolean;
};

// ─── Error State ────────────────────────────────────────────────────────────

export type ErrorState = {
  /** Base data failure (dogs, progress, programs). */
  base: string | null;
  /** Session query failure (aggregated from pending/decided). */
  sessions: string | null;
  /** Pending evaluations query failure. */
  pendingEvaluations: string | null;
  /** Decided evaluations query failure. */
  decidedEvaluations: string | null;
  /** Aggregated evaluation error (derived from pending/decided). */
  evaluations: string | null;
};

// ─── Evaluation Access ──────────────────────────────────────────────────────

/**
 * Evaluation access classification.
 * - "allowed": user has permission, queries are executed normally.
 * - "restricted": user lacks permission, queries are NOT executed (not an error).
 * - "error": user has permission but queries failed (technical error).
 */
export type EvaluationAccessState = "allowed" | "restricted" | "error";

// ─── Session Load Status ─────────────────────────────────────────────────────

export type SessionLoadStatus =
  | "idle"
  | "loading"
  | "complete"
  | "partial"
  | "failed";

// ─── Resolved Report Window ──────────────────────────────────────────────────

/**
 * Explicit contract returned by `resolveReportWindow`.
 *
 * - "all"      → caller MUST skip the temporal `where` filter.
 * - "bounded"  → caller MUST apply `where(field, ">=", start)`.
 * - "invalid"  → caller MUST NOT call `getDocs`; surface local error,
 *                preserve previously loaded data, and mark the load as
 *                failed (per Bug 6.4.11).
 */
export type ResolvedReportWindow =
  | { kind: "all" }
  | { kind: "bounded"; start: Date }
  | { kind: "invalid"; reason: string };

/**
 * Result of a constraint builder for the session or decided-evaluations query.
 *
 * - ok: true  → caller applies `query(collectionRef, ...constraints)`.
 * - ok: false → caller surfaces the local error and does NOT call `getDocs`.
 */
export type ConstraintBuildResult =
  | { ok: true; constraints: unknown[] }
  | { ok: false; error: "invalid-period"; reason: string };

// ─── Filter State ────────────────────────────────────────────────────────────

/**
 * Tracks which filters were active when data was last successfully loaded.
 * Used to detect stale data when filters change before load completes.
 */
export type LoadedFilters = {
  period: TrainingReportPeriod;
  modality: string | null;
  dogId: string | null;
} | null;
