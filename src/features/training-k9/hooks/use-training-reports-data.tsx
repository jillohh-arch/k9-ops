"use client";

/**
 * Data provider for the Training Reports tab.
 *
 * Sources (all canonical, no legacy):
 *   dogs/{dogId}/training          — progress (in_formation / operational)
 *   dogs/{dogId}/training_sessions — sessions (getDocs, one-shot)
 *   promotion_requests             — evaluations (getDocs, one-shot, two queries)
 *   training_programs/{id}/modules — for module name lookup
 *
 * Evaluation query strategy:
 * - Pending: where("status", "==", "pending"), no temporal orderBy, limit PENDING_LIMIT.
 *   Loaded once on mount; NOT reloaded on period changes.
 * - Decided: where("decided_at", ">=", periodStart), orderBy("decided_at", "desc"),
 *   limit DECIDED_LIMIT. Reloaded when period changes.
 * - This separation ensures old pending requests are never excluded by the decided limit.
 *
 * Session truncation detection:
 * - Per-dog, before local filters, rawSnapshot.size === limitPerDog.
 *
 * Architectural notes:
 * - NOT a listener — sessions and evaluations are loaded on-demand (one-shot).
 * - Uses fetchIdRef to discard stale requests during rapid filter changes.
 * - currentState is stable across period changes — only session/decide metrics reload.
 * - Suspicious durations (above technical ceiling) are flagged but NOT summed.
 */

import {
  collection,
  getDocs,
  query,
  where as firestoreWhere,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
  type QueryConstraint,
} from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { canônicalModality } from "@/features/effective/lib/k9-modalities";
import { useEffectiveData } from "@/features/effective/hooks/use-effective-data";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { db } from "@/lib/firebase/client";

import { useTrainingK9Data } from "./use-training-k9-data";

import {
  setModalityNormalizer,
  resolveReportWindow,
  computeCurrentStateMetrics,
  computeSessionMetrics,
  computeDurationMetrics,
  computeDogActivity,
  computeEvaluationMetrics,
  computeRejectedByModule,
  buildIndividualTimelines,
  generateCategorizedWarnings,
  INVALID_PERIOD_USER_MESSAGE,
  type RawSession,
  type RawPromotion,
  type DogWithProgress,
  type TimelineSource,
} from "../lib/training-reports-utils";

import {
  buildSessionQueryConstraints,
  buildDecidedEvaluationQueryConstraints,
  type ConstraintFactory,
} from "../lib/training-reports-query-builders";

import type {
  TrainingReportPeriod,
  TrainingReportsData,
  CurrentStateMetrics,
  SessionMetrics,
  DurationMetrics,
  ActivitySummary,
  EvaluationMetrics,
  RejectedModuleSummary,
  IndividualTimelineEvent,
  DataQuality,
  QueryStats,
  LoadingState,
  SessionLoadStatus,
  LoadedFilters,
  EvaluationAccessState,
  ResolvedReportWindow,
} from "../types/training-reports";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Safety limit for session documents loaded per dog. */
export const SESSIONS_PER_DOG_LIMIT = 200;

/**
 * Limit for pending-evaluations query.
 * Pending requests are few (typically 0–10); 500 provides substantial headroom.
 */
export const PENDING_EVALUATIONS_LIMIT = 500;

/**
 * Limit for decided-evaluations query.
 * 1000 allows covering extended periods without excessive reads.
 */
export const DECIDED_EVALUATIONS_LIMIT = 1000;

const DEFAULT_PERIOD: TrainingReportPeriod = "30d";

/**
 * Factory that adapts the real Firestore SDK constraint factories to the
 * `ConstraintFactory` shape consumed by `buildSessionQueryConstraints`
 * and `buildDecidedEvaluationQueryConstraints`.
 */
const firestoreConstraintFactory: ConstraintFactory = {
  where: (field, op, value) => firestoreWhere(field, op, value),
  orderBy: (field, direction) => firestoreOrderBy(field, direction),
  limit: (count) => firestoreLimit(count),
};

// ─── Context ─────────────────────────────────────────────────────────────────

const TrainingReportsContext = createContext<TrainingReportsData | null>(null);

export function useTrainingReportsData(): TrainingReportsData {
  const ctx = useContext(TrainingReportsContext);
  if (!ctx) {
    throw new Error(
      "useTrainingReportsData must be used within TrainingReportsDataProvider",
    );
  }
  return ctx;
}

// ─── Internal types ───────────────────────────────────────────────────────────

type DogWithProgressEntry = {
  dogId: string;
  dogName: string;
  modality: string;
  status: string;
  completedModules: number;
  currentModule: string | null;
  operationalSince: Date | null;
  completedModulesList: Array<{ moduleId: string; completedAt: Date | null }>;
};

type LoadState = "idle" | "loading" | "success" | "error";

// ─── Provider ────────────────────────────────────────────────────────────────

interface TrainingReportsProviderProps {
  children: ReactNode;
}

export function TrainingReportsDataProvider({ children }: TrainingReportsProviderProps) {
  // ── Base data sources ─────────────────────────────────────────────────────

  const effective = useEffectiveData();
  const trainingK9 = useTrainingK9Data();
  const { can } = useAccessControl();

  // Permission gate — matches the same check used by use-training-k9-data and
  // the Firestore Security Rules for promotion_requests reads.
  const canReadPromotions =
    can("training", "approve") || can("training", "audit") ||
    can("training_matrix", "approve") || can("training_matrix", "audit");

  // ── Filters ───────────────────────────────────────────────────────────────

  const [period, setPeriodState] = useState<TrainingReportPeriod>(DEFAULT_PERIOD);
  const [modality, setModalityState] = useState<string | null>(null);
  const [dogId, setDogIdState] = useState<string | null>(null);

  // Stable setter identities — wrapped in useCallback so downstream
  // useEffects that depend on them don't re-fire on every render.
  const setPeriod = useCallback((p: TrainingReportPeriod) => {
    setPeriodState(p);
  }, []);
  const setModality = useCallback((m: string | null) => {
    setModalityState(m);
  }, []);
  const setDogId = useCallback((id: string | null) => {
    setDogIdState(id);
  }, []);

  // ── Reports load state ───────────────────────────────────────────────────

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);
  const evaluationsFetchIdRef = useRef(0);

  // ── Granular loading ──────────────────────────────────────────────────────

  const [loadingState, setLoadingState] = useState<LoadingState>({
    base: true,
    sessions: false,
    evaluations: false,
  });

  // Track pending/decided loading independently to avoid race conditions
  const pendingLoadingRef = useRef(false);
  const decidedLoadingRef = useRef(false);

  const updateEvaluationsLoading = useCallback((pending: boolean, decided: boolean) => {
    pendingLoadingRef.current = pending;
    decidedLoadingRef.current = decided;
    setLoadingState((prev) => ({
      ...prev,
      evaluations: pending || decided,
    }));
  }, []);

  // ── Granular errors ───────────────────────────────────────────────────────

  const [sessionError, setSessionError] = useState<string | null>(null);
  const [pendingEvaluationsError, setPendingEvaluationsError] = useState<string | null>(null);
  const [decidedEvaluationsError, setDecidedEvaluationsError] = useState<string | null>(null);

  // ── Session load status ───────────────────────────────────────────────────

  const [sessionLoadStatus, setSessionLoadStatus] = useState<SessionLoadStatus>("idle");
  const [loadedFilters, setLoadedFilters] = useState<LoadedFilters>(null);
  const [successfulSessionQueryCount, setSuccessfulSessionQueryCount] = useState(0);
  const [failedSessionQueryCount, setFailedSessionQueryCount] = useState(0);

  // ── Loaded data ───────────────────────────────────────────────────────────

  const [sessions, setSessions] = useState<RawSession[]>([]);
  const [sessionStatusByDog, setSessionStatusByDog] = useState<Record<string, "loaded" | "failed">>({});
  const [pendingPromotions, setPendingPromotions] = useState<RawPromotion[]>([]);
  const [decidedPromotions, setDecidedPromotions] = useState<RawPromotion[]>([]);
  const [programs, setPrograms] = useState<
    Array<{ id: string; modality: string; modules: Array<{ id: string; title: string }> }>
  >([]);

  // ── Truncation state ─────────────────────────────────────────────────────

  const [sessionsTruncated, setSessionsTruncated] = useState(false);
  const [pendingTruncated, setPendingTruncated] = useState(false);
  const [decidedTruncated, setDecidedTruncated] = useState(false);
  const [truncatedDogCount, setTruncatedDogCount] = useState(0);

  // ── Query stats ───────────────────────────────────────────────────────────

  const [queryStatsBase, setQueryStatsBase] = useState<QueryStats>({
    dogCount: 0,
    progressCount: 0,
    sessionQueryCount: 0,
    sessionDocumentCount: 0,
    truncatedDogCount: 0,
    pendingEvaluationQueryCount: 0,
    pendingEvaluationDocumentCount: 0,
    pendingEvaluationLimit: PENDING_EVALUATIONS_LIMIT,
    decidedEvaluationQueryCount: 0,
    decidedEvaluationDocumentCount: 0,
    decidedEvaluationLimit: DECIDED_EVALUATIONS_LIMIT,
    programCount: 0,
    unsupportedDecidedStatusCount: 0,
  });

  // ── Inject normalizer ───────────────────────────────────────────────────

  useEffect(() => {
    setModalityNormalizer(canônicalModality);
  }, []);

  // ── Parse date helper ────────────────────────────────────────────────────

  const parseDate = useCallback((value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    // Firestore Timestamp: try toDate() if present.
    if (typeof (value as { toDate?: unknown }).toDate === "function") {
      try {
        const fn = (value as { toDate: () => unknown }).toDate;
        const result = fn();
        if (result instanceof Date && Number.isFinite(result.getTime())) {
          return result;
        }
      } catch {
        // Fall through to the structural fallback below.
      }
    }
    // Firestore Timestamp-shaped object: extract seconds + nanoseconds manually.
    // This guards against a bundler dropping the prototype's toDate/toMillis
    // methods while still leaving the public fields intact.
    if (typeof value === "object") {
      const v = value as { seconds?: unknown; nanoseconds?: unknown; _seconds?: unknown };
      const secondsRaw =
        typeof v.seconds === "number"
          ? v.seconds
          : typeof v._seconds === "number"
            ? v._seconds
            : null;
      const nanosRaw =
        typeof v.nanoseconds === "number"
          ? v.nanoseconds
          : 0;
      if (secondsRaw != null) {
        const ms = secondsRaw * 1000 + Math.floor(nanosRaw / 1_000_000);
        const d = new Date(ms);
        if (Number.isFinite(d.getTime())) return d;
      }
    }
    if (typeof value === "string" || typeof value === "number") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }, []);

  // ── Parse promotion helper ────────────────────────────────────────────────

  const parsePromotion = useCallback(
    (docId: string, data: Record<string, unknown>, dogMap: Map<string, { name: string }>): RawPromotion => {
      const dogIdRaw = String(data.dog_id ?? "");
      const dog = dogMap.get(dogIdRaw);

      const rawModality =
        typeof data.modality === "string"
          ? data.modality
          : typeof data.modality_id === "string"
            ? data.modality_id
            : "";
      const modality = canônicalModality(rawModality);

      const requestedAt = parseDate(data.requested_at ?? data.created_at);
      const decidedAt = parseDate(data.decided_at);

      const rawStatus = String(data.status ?? "");
      // Preserve the actual status — do not normalize unknown status to "pending".
      // This allows the decided-query loader to detect unsupported statuses.
      const status: "pending" | "approved" | "rejected" | "unsupported" =
        ["pending", "approved", "rejected"].includes(rawStatus)
          ? (rawStatus as "pending" | "approved" | "rejected")
          : "unsupported";

      const currentModuleId: string | null =
        typeof data.current_module_id === "string" ? data.current_module_id : null;
      const currentModuleName: string | null =
        typeof data.current_module_name === "string" ? data.current_module_name : null;

      return {
        id: docId,
        dogId: dogIdRaw,
        dogName: dog?.name ?? String(data.dog_name ?? `K9 ${dogIdRaw}`),
        modality,
        status,
        requestedAt,
        decidedAt,
        moduleName: currentModuleName,
        moduleId: currentModuleId,
        programId: String(data.program_id ?? ""),
        programVersion: String(data.program_version ?? ""),
      };
    },
    [parseDate],
  );

  // ── Build progress entries ────────────────────────────────────────────────

  const progressData = useMemo((): DogWithProgressEntry[] => {
    if (trainingK9.loading) return [];

    const entries: DogWithProgressEntry[] = [];
    for (const dog of trainingK9.dogs) {
      for (const cell of dog.cells) {
        if (cell.source === "none") continue;
        entries.push({
          dogId: dog.dogId,
          dogName: dog.dogName,
          modality: cell.modality,
          status: cell.status,
          completedModules: cell.completedModules,
          currentModule: cell.currentModule,
          operationalSince: null,
          completedModulesList: [],
        });
      }
    }
    return entries;
  }, [trainingK9.dogs, trainingK9.loading]);

  // ── Progress entries as plain aggregates ─────────────────────────────────

  const progressEntries = useMemo(
    () => progressData.map((e) => ({ dogId: e.dogId, modality: e.modality, status: e.status })),
    [progressData],
  );

  // ── Dogs with progress (unique) ───────────────────────────────────────────

  const dogsWithProgress = useMemo((): DogWithProgress[] => {
    // Collect all modalities per dog from progress entries
    const modalitiesByDog = new Map<string, Set<string>>();
    const nameByDog = new Map<string, string>();
    for (const entry of progressData) {
      nameByDog.set(entry.dogId, entry.dogName);
      if (!modalitiesByDog.has(entry.dogId)) {
        modalitiesByDog.set(entry.dogId, new Set());
      }
      modalitiesByDog.get(entry.dogId)!.add(entry.modality);
    }

    const result: DogWithProgress[] = [];
    for (const [dogId, mods] of modalitiesByDog) {
      const allModalities = Array.from(mods).sort();
      // When a modality filter is active, only include dogs that have progress
      // in that modality, and scope modalities to only the filtered one.
      if (modality) {
        if (!mods.has(modality)) continue;
        result.push({
          dogId,
          dogName: nameByDog.get(dogId) ?? dogId,
          scopeModality: modality,
          modalities: [modality],
        });
      } else {
        result.push({
          dogId,
          dogName: nameByDog.get(dogId) ?? dogId,
          scopeModality: null,
          modalities: allModalities,
        });
      }
    }
    return result;
  }, [progressData, modality]);

  // ── Report dog IDs (unique, only dogs with progress) ──────────────────────
  // This is the population that should be queried for sessions — not all
  // effective dogs. A dog with 3 modalities generates ONE query, not three.

  const reportDogIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of progressData) {
      ids.add(entry.dogId);
    }
    return Array.from(ids).sort();
  }, [progressData]);

  // ── Programs/modules ──────────────────────────────────────────────────────

  useEffect(() => {
    if (trainingK9.loading) return;
    const progData = trainingK9.programs.map((p) => ({
      id: p.id,
      modality: p.modality,
      modules: p.modules.map((m) => ({ id: m.id, title: m.title })),
    }));
    setPrograms(progData); // eslint-disable-line react-hooks/set-state-in-effect
  }, [trainingK9.programs, trainingK9.loading]);

  // ── Modules lookup ────────────────────────────────────────────────────────

  const moduleNameLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const program of programs) {
      for (const mod of program.modules) {
        lookup.set(`${program.id}::${mod.id}`, mod.title);
      }
    }
    return lookup;
  }, [programs]);

  // ── Load pending evaluations (once on mount) ──────────────────────────────

  const loadPendingEvaluations = useCallback(async () => {
    const fetchId = ++evaluationsFetchIdRef.current;
    updateEvaluationsLoading(true, decidedLoadingRef.current);

    try {
      const q = query(
        collection(db, "promotion_requests"),
        firestoreWhere("status", "==", "pending"),
        firestoreLimit(PENDING_EVALUATIONS_LIMIT),
      );
      const snapshot = await getDocs(q);

      if (evaluationsFetchIdRef.current !== fetchId) return;

      const truncated = snapshot.size === PENDING_EVALUATIONS_LIMIT;
      setPendingTruncated(truncated);

      const dogMap = new Map(effective.dogs.map((d) => [d.id, d]));
      const parsed = snapshot.docs.map((doc) =>
        parsePromotion(doc.id, doc.data() as Record<string, unknown>, dogMap),
      );

      setPendingPromotions(parsed);
      setPendingEvaluationsError(null);
      updateEvaluationsLoading(false, decidedLoadingRef.current);
      setQueryStatsBase((prev) => ({
        ...prev,
        pendingEvaluationQueryCount: prev.pendingEvaluationQueryCount + 1,
        pendingEvaluationDocumentCount: snapshot.size,
      }));
    } catch {
      if (evaluationsFetchIdRef.current !== fetchId) return;
      setPendingEvaluationsError("Não foi possível carregar as avaliações pendentes.");
      updateEvaluationsLoading(false, decidedLoadingRef.current);
    }
  }, [effective.dogs, parsePromotion, updateEvaluationsLoading]);

  // ── Load decided evaluations (on mount + period change) ─────────────────────
  //
  // Strategy: query only by decided_at (no status filter) so we don't require
  // a composite index. Documents are then filtered locally by status.
  // Unsupported statuses are tracked separately and excluded from metrics.

  const loadDecidedEvaluations = useCallback(
    async (window: ResolvedReportWindow) => {
      const fetchId = ++evaluationsFetchIdRef.current;
      updateEvaluationsLoading(pendingLoadingRef.current, true);

      // Use the same builder the provider depends on — no inline logic.
      const built = buildDecidedEvaluationQueryConstraints(
        window,
        DECIDED_EVALUATIONS_LIMIT,
        firestoreConstraintFactory,
      );

      if (!built.ok) {
        // Period is bounded but invalid: refuse to call getDocs, surface a
        // friendly error, preserve the previous decided promotions, and
        // finalize loading. Per Bug 6.4.11 we must NOT degrade to "all".
        if (evaluationsFetchIdRef.current !== fetchId) return;
        setDecidedEvaluationsError(INVALID_PERIOD_USER_MESSAGE);
        updateEvaluationsLoading(pendingLoadingRef.current, false);
        return;
      }

      try {
        const q = query(
          collection(db, "promotion_requests"),
          ...(built.constraints as QueryConstraint[]),
        );
        const snapshot = await getDocs(q);

        if (evaluationsFetchIdRef.current !== fetchId) return;

        const truncated = snapshot.size === DECIDED_EVALUATIONS_LIMIT;
        setDecidedTruncated(truncated);

        const dogMap = new Map(effective.dogs.map((d) => [d.id, d]));
        const parsed = snapshot.docs.map((doc) =>
          parsePromotion(doc.id, doc.data() as Record<string, unknown>, dogMap),
        );

        const supported = parsed.filter(
          (p) => p.status === "approved" || p.status === "rejected",
        );
        const unsupportedCount = parsed.length - supported.length;

        setDecidedPromotions(supported);
        setDecidedEvaluationsError(null);
        updateEvaluationsLoading(pendingLoadingRef.current, false);
        setQueryStatsBase((prev) => ({
          ...prev,
          decidedEvaluationQueryCount: prev.decidedEvaluationQueryCount + 1,
          decidedEvaluationDocumentCount: snapshot.size,
          unsupportedDecidedStatusCount: unsupportedCount,
        }));
      } catch {
        if (evaluationsFetchIdRef.current !== fetchId) return;
        setDecidedEvaluationsError("Não foi possível carregar as avaliações decididas.");
        updateEvaluationsLoading(pendingLoadingRef.current, false);
      }
    },
    [effective.dogs, parsePromotion, updateEvaluationsLoading],
  );

  // ── Session loader ────────────────────────────────────────────────────────

  const loadSessions = useCallback(
    async (opts: {
      window: ResolvedReportWindow;
      dogIds: string[];
      modalityFilter: string | null;
      dogIdFilter: string | null;
    }) => {
      const fetchId = ++fetchIdRef.current;
      const { window, dogIds, dogIdFilter } = opts;

      // Use the same builder the provider depends on — no inline logic.
      const built = buildSessionQueryConstraints(
        window,
        SESSIONS_PER_DOG_LIMIT,
        firestoreConstraintFactory,
      );

      setLoadingState((prev) => ({ ...prev, sessions: true }));

      // Hard-fail path: when the period is bounded but invalid, we refuse to
      // call getDocs, surface the friendly error, preserve prior data, and
      // mark the session load as failed. We never degrade to "all".
      if (!built.ok) {
        if (fetchIdRef.current !== fetchId) return;
        setSessionError(INVALID_PERIOD_USER_MESSAGE);
        setSessionLoadStatus("failed");
        setSessionsTruncated(false);
        setTruncatedDogCount(0);
        setSuccessfulSessionQueryCount(0);
        setFailedSessionQueryCount(0);
        setSessionStatusByDog({});
        setLoadingState((prev) => ({ ...prev, sessions: false }));
        return;
      }

      // Clear previous error only when we will actually attempt the query.
      setSessionError(null);

      let attemptedSessionQueryCount = 0;
      let successfulSessionQueryCount = 0;
      let failedSessionQueryCount = 0;
      let sessionDocumentCount = 0;
      let anyTruncated = false;
      let truncatedDogs = 0;
      const allSessions: RawSession[] = [];
      const allResults: Array<{ dId: string; success: boolean }> = [];

      const dogsToQuery = dogIdFilter
        ? dogIds.filter((id) => id === dogIdFilter)
        : dogIds;

      attemptedSessionQueryCount = dogsToQuery.length;

      const constraints = built.constraints as QueryConstraint[];

      const BATCH = 10;
      for (let i = 0; i < dogsToQuery.length; i += BATCH) {
        if (fetchIdRef.current !== fetchId) return;

        const batch = dogsToQuery.slice(i, i + BATCH);
        const batchResults = await Promise.all(
          batch.map(async (dId) => {
            try {
              const colRef = collection(db, `dogs/${dId}/training_sessions`);
              const q = query(colRef, ...constraints);
              const snapshot = await getDocs(q);

              const dog = effective.dogs.find((d) => d.id === dId);
              const rawSize = snapshot.size;

              const truncated = rawSize === SESSIONS_PER_DOG_LIMIT;
              if (truncated) {
                anyTruncated = true;
                truncatedDogs++;
              }

              const parsedSessions: RawSession[] = snapshot.docs.map((doc) => {
                const data = doc.data() as Record<string, unknown>;
                const startedAt = parseDate(data.started_at);

                let durationS: number | null = null;
                const rawDur =
                  data.duration_s ??
                  data.durationS ??
                  (data.track && typeof data.track === "object"
                    ? (data.track as Record<string, unknown>).duration_s
                    : null);
                if (typeof rawDur === "number" && Number.isFinite(rawDur)) {
                  durationS = rawDur;
                }

                const rawModality =
                  typeof data.modality === "string"
                    ? data.modality
                    : typeof data.modality_id === "string"
                      ? data.modality_id
                      : typeof data.trainingType === "string"
                        ? data.trainingType
                        : "";
                const modality = canônicalModality(rawModality || "treino_geral");

                return {
                  dogId: dId,
                  dogName: dog?.name ?? `K9 ${dId}`,
                  id: doc.id,
                  modality,
                  startedAt,
                  durationS,
                  _invalid: !startedAt && !data.created_at,
                };
              });

              sessionDocumentCount += snapshot.docs.length;
              successfulSessionQueryCount++;
              return { dId, sessions: parsedSessions, success: true };
            } catch {
              failedSessionQueryCount++;
              return { dId, sessions: [] as RawSession[], success: false };
            }
          }),
        );

        for (const result of batchResults) {
          allSessions.push(...result.sessions);
          allResults.push({ dId: result.dId, success: result.success });
        }
      }

      if (fetchIdRef.current !== fetchId) return;

      // Classify load result based on batch success counts
      let status: SessionLoadStatus;
      let errorMessage: string | null = null;

      if (failedSessionQueryCount === 0) {
        // All queries succeeded
        status = "complete";
        errorMessage = null;
        setSessions(allSessions);
      } else if (successfulSessionQueryCount === 0 && failedSessionQueryCount > 0) {
        // Total failure
        status = "failed";
        errorMessage = "Não foi possível carregar os registros de sessões.";
        // Preserve previous sessions if any (stale data scenario)
      } else if (successfulSessionQueryCount > 0 && failedSessionQueryCount > 0) {
        // Partial success
        status = "partial";
        errorMessage = "Alguns registros de sessões não puderam ser carregados.";
        setSessions(allSessions); // Use what we got
      } else {
        // Fallback (should not happen)
        status = "complete";
        errorMessage = null;
        setSessions(allSessions);
      }

      setSessionError(errorMessage);
      setSessionLoadStatus(status);
      setSessionsTruncated(anyTruncated);
      setTruncatedDogCount(truncatedDogs);
      setSuccessfulSessionQueryCount(successfulSessionQueryCount);
      setFailedSessionQueryCount(failedSessionQueryCount);

      // Track per-dog session status
      const statusByDog: Record<string, "loaded" | "failed"> = {};
      for (const result of allResults) {
        statusByDog[result.dId] = result.success ? "loaded" : "failed";
      }
      setSessionStatusByDog(statusByDog);

      // Mark filters as loaded on any success
      if (successfulSessionQueryCount > 0) {
        setLoadedFilters({ period, modality: opts.modalityFilter, dogId: dogIdFilter });
      }

      setLoadingState((prev) => ({ ...prev, sessions: false }));
      setQueryStatsBase((prev) => ({
        ...prev,
        sessionQueryCount: attemptedSessionQueryCount,
        sessionDocumentCount,
        truncatedDogCount: truncatedDogs,
      }));
    },
    [effective.dogs, parseDate, period],
  );

  // ── Auto-load when base data is ready ────────────────────────────────────

  const evaluationsLoadedRef = useRef(false);

  useEffect(() => {
    const baseLoading = effective.loading || trainingK9.loading;
    setLoadingState((prev) => ({ ...prev, base: baseLoading })); // eslint-disable-line react-hooks/set-state-in-effect

    if (loadState === "idle" && !baseLoading) {
      // Load sessions and evaluations in parallel
      const window = resolveReportWindow(period, new Date());

      setLoadState("loading");

      // Load evaluations only when the user has permission to read promotion_requests.
      // Without this gate, Firestore rules will deny the query and the UI would
      // show a misleading "Indisponível" error for users who simply don't have access.
      if (canReadPromotions) {
        // Load pending once
        if (!evaluationsLoadedRef.current) {
          evaluationsLoadedRef.current = true;
          loadPendingEvaluations();
        }

        // Load decided for current period
        loadDecidedEvaluations(window);
      }

      loadSessions({
        window,
        dogIds: reportDogIds,
        modalityFilter: modality,
        dogIdFilter: dogId,
      });

      Promise.resolve()
        .then(() => {
          if (fetchIdRef.current >= 0) {
            setLoadState("success");
            setLoadError(null);
          }
        })
        .catch((err) => {
          setLoadError(err instanceof Error ? err.message : "Erro ao carregar dados.");
          setLoadState("error");
        });
    }
  }, [effective.loading, trainingK9.loading, loadState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reload on filter changes ──────────────────────────────────────────────

  useEffect(() => {
    if (loadState === "success" || loadState === "error") {
      const window = resolveReportWindow(period, new Date());

      loadSessions({ // eslint-disable-line react-hooks/set-state-in-effect
        window,
        dogIds: reportDogIds,
        modalityFilter: modality,
        dogIdFilter: dogId,
      });

      // Reload decided evaluations when period changes (only with permission)
      if (canReadPromotions) {
        loadDecidedEvaluations(window);
      }
    }
  }, [period, modality, dogId, reportDogIds, canReadPromotions, loadSessions, loadDecidedEvaluations, loadState]);

  // ── Retry ────────────────────────────────────────────────────────────────

  const retry = useCallback(() => {
    evaluationsLoadedRef.current = false;
    setLoadState("idle");
    setTimeout(() => {
      const baseLoading = effective.loading || trainingK9.loading;
      if (!baseLoading) {
        const window = resolveReportWindow(period, new Date());

        setLoadState("loading");
        if (canReadPromotions) {
          loadPendingEvaluations();
          loadDecidedEvaluations(window);
        }
        loadSessions({
          window,
          dogIds: reportDogIds,
          modalityFilter: modality,
          dogIdFilter: dogId,
        });

        Promise.resolve()
          .then(() => {
            setLoadState("success");
            setLoadError(null);
          })
          .catch((err) => {
            setLoadError(err instanceof Error ? err.message : "Erro ao carregar dados.");
            setLoadState("error");
          });
      }
    }, 0);
  }, [effective.loading, trainingK9.loading, period, modality, dogId, reportDogIds, canReadPromotions, loadSessions, loadPendingEvaluations, loadDecidedEvaluations]);

  // ── Retry sessions only ──────────────────────────────────────────────────

  const retrySessions = useCallback(() => {
    const window = resolveReportWindow(period, new Date());
    loadSessions({
      window,
      dogIds: reportDogIds,
      modalityFilter: modality,
      dogIdFilter: dogId,
    });
  }, [reportDogIds, period, modality, dogId, loadSessions]);

  // ── Retry evaluations only ────────────────────────────────────────────────

  const retryEvaluations = useCallback(() => {
    const window = resolveReportWindow(period, new Date());
    loadPendingEvaluations();
    loadDecidedEvaluations(window);
  }, [period, loadPendingEvaluations, loadDecidedEvaluations]);

  // ── Period start (recomputed) ───────────────────────────────────────────

  const periodStart = useMemo((): Date | null => {
    const w = resolveReportWindow(period, new Date());
    return w.kind === "bounded" ? w.start : null;
  }, [period]);

  // ── Filtered sessions ───────────────────────────────────────────────────

  const filteredSessions = useMemo(() => {
    let result = sessions;
    if (modality) result = result.filter((s) => s.modality === modality);
    if (dogId) result = result.filter((s) => s.dogId === dogId);
    return result;
  }, [sessions, modality, dogId]);

  // ── Session metrics ─────────────────────────────────────────────────────

  const sessionMetrics = useMemo((): SessionMetrics => {
    return computeSessionMetrics(filteredSessions, periodStart, modality);
  }, [filteredSessions, periodStart, modality]);

  // ── Duration metrics ────────────────────────────────────────────────────

  const durationMetrics = useMemo((): DurationMetrics => {
    return computeDurationMetrics(filteredSessions);
  }, [filteredSessions]);

  // ── Dog activity ───────────────────────────────────────────────────────

  const activitySummary = useMemo((): ActivitySummary => {
    const activity = computeDogActivity(
      dogsWithProgress,
      sessionMetrics.lastSessionByDog,
      new Date(),
    );
    return {
      dogsWithProgress: activity,
      dogsNeverTrained: activity.filter((a) => a.neverTrained),
      dogsInactiveOver7Days: activity.filter((a) => a.inactiveOver7Days && !a.neverTrained),
      dogsInactiveOver30Days: activity.filter((a) => a.inactiveOver30Days && !a.neverTrained),
      dogsInactiveOver60Days: activity.filter((a) => a.inactiveOver60Days && !a.neverTrained),
      dogsInactiveOver90Days: activity.filter((a) => a.inactiveOver90Days && !a.neverTrained),
    };
  }, [dogsWithProgress, sessionMetrics.lastSessionByDog]);

  // ── All promotions (pending + decided) ──────────────────────────────────

  const allPromotions = useMemo((): RawPromotion[] => {
    return [...pendingPromotions, ...decidedPromotions];
  }, [pendingPromotions, decidedPromotions]);

  // ── Evaluation metrics ─────────────────────────────────────────────────

  const evaluationMetrics = useMemo((): EvaluationMetrics => {
    return computeEvaluationMetrics(allPromotions, periodStart);
  }, [allPromotions, periodStart]);

  // ── Rejected by module ────────────────────────────────────────────────

  const rejectedByModule = useMemo((): RejectedModuleSummary[] => {
    const rejected = decidedPromotions.filter((p) => p.status === "rejected");
    return computeRejectedByModule(rejected, moduleNameLookup);
  }, [decidedPromotions, moduleNameLookup]);

  // ── Individual timelines ───────────────────────────────────────────────

  const individualTimelines = useMemo((): Record<string, IndividualTimelineEvent[]> => {
    const sources: TimelineSource[] = [];

    // Sessions
    for (const s of sessions) {
      if (modality && s.modality !== modality) continue;
      if (dogId && s.dogId !== dogId) continue;
      if (!s.startedAt) continue;
      sources.push({
        type: "session",
        id: s.id,
        dogId: s.dogId,
        modality: s.modality,
        date: s.startedAt,
      });
    }

    // Module completions
    for (const entry of progressData) {
      if (modality && entry.modality !== modality) continue;
      if (dogId && entry.dogId !== dogId) continue;
      for (const mod of entry.completedModulesList) {
        if (mod.completedAt) {
          sources.push({
            type: "module_completed",
            id: `${entry.dogId}:${entry.modality}:${mod.moduleId}`,
            dogId: entry.dogId,
            modality: entry.modality,
            date: mod.completedAt,
            moduleName: mod.moduleId,
          });
        }
      }
    }

    // Promotion events — pending
    for (const promo of pendingPromotions) {
      if (modality && promo.modality !== modality) continue;
      if (dogId && promo.dogId !== dogId) continue;
      if (promo.requestedAt) {
        sources.push({
          type: "promotion_requested",
          id: promo.id,
          dogId: promo.dogId,
          modality: promo.modality,
          date: promo.requestedAt,
        });
      }
    }

    // Promotion events — decided
    for (const promo of decidedPromotions) {
      if (modality && promo.modality !== modality) continue;
      if (dogId && promo.dogId !== dogId) continue;
      if (promo.decidedAt) {
        sources.push({
          type:
            promo.status === "approved" ? "promotion_approved" : "promotion_rejected",
          id: promo.id,
          dogId: promo.dogId,
          modality: promo.modality,
          date: promo.decidedAt,
        });
      }

      // Modality completed event
      const progressEntry = progressData.find(
        (e) => e.dogId === promo.dogId && e.modality === promo.modality,
      );
      if (
        progressEntry &&
        progressEntry.status.toLowerCase().replace(/[_\s-]/g, "") === "operational"
      ) {
        const completedDate = progressEntry.operationalSince ?? promo.decidedAt;
        if (completedDate) {
          sources.push({
            type: "modality_completed",
            id: `${promo.dogId}:${promo.modality}:done`,
            dogId: promo.dogId,
            modality: promo.modality,
            date: completedDate,
          });
        }
      }
    }

    return buildIndividualTimelines(sources);
  }, [sessions, progressData, pendingPromotions, decidedPromotions, modality, dogId]);

  // ── Data quality ───────────────────────────────────────────────────────

  const earliestLoadedSession = useMemo((): Date | null => {
    let earliest: Date | null = null;
    for (const s of sessions) {
      if (s.startedAt && (!earliest || s.startedAt < earliest)) {
        earliest = s.startedAt;
      }
    }
    return earliest;
  }, [sessions]);

  const latestLoadedSession = useMemo((): Date | null => {
    let latest: Date | null = null;
    for (const s of sessions) {
      if (s.startedAt && (!latest || s.startedAt > latest)) {
        latest = s.startedAt;
      }
    }
    return latest;
  }, [sessions]);

  const evaluationsTruncated = pendingTruncated || decidedTruncated;

  const dataQuality = useMemo((): DataQuality => {
    const invalidSessions = filteredSessions.filter((s) => !!s._invalid).length;
    const isComplete =
      loadState === "success" &&
      !loadError &&
      sessionLoadStatus === "complete" &&
      !sessionsTruncated &&
      !evaluationsTruncated &&
      !pendingEvaluationsError &&
      !decidedEvaluationsError;

    const categorized = generateCategorizedWarnings(
      sessionsTruncated,
      invalidSessions,
      durationMetrics.suspiciousDurationCount,
      evaluationMetrics.invalidDateCount,
      pendingTruncated,
      decidedTruncated,
      earliestLoadedSession,
      latestLoadedSession,
      evaluationMetrics.unsupportedDecidedStatusCount,
    );

    return {
      isComplete,
      sessionsTruncated,
      pendingEvaluationsTruncated: pendingTruncated,
      decidedEvaluationsTruncated: decidedTruncated,
      evaluationsTruncated,
      invalidSessionCount: invalidSessions,
      invalidEvaluationDateCount: evaluationMetrics.invalidDateCount,
      durationCoveragePercentage: durationMetrics.durationCoveragePercentage,
      earliestLoadedSession,
      latestLoadedSession,
      warnings: categorized.map((w) => w.message),
      categorizedWarnings: categorized,
      unsupportedDecidedStatusCount: evaluationMetrics.unsupportedDecidedStatusCount,
    };
  }, [
    loadState,
    loadError,
    sessionLoadStatus,
    sessionsTruncated,
    pendingTruncated,
    decidedTruncated,
    pendingEvaluationsError,
    decidedEvaluationsError,
    filteredSessions,
    evaluationMetrics.invalidDateCount,
    evaluationMetrics.unsupportedDecidedStatusCount,
    durationMetrics.durationCoveragePercentage,
    durationMetrics.suspiciousDurationCount,
    earliestLoadedSession,
    latestLoadedSession,
    evaluationsTruncated,
  ]);

  // ── Current state metrics ──────────────────────────────────────────────

  const currentState = useMemo((): CurrentStateMetrics => {
    const metrics = computeCurrentStateMetrics(
      progressEntries,
      trainingK9.programs.filter((p) => p.active).length,
      trainingK9.programs.reduce((sum, p) => sum + p.moduleCount, 0),
    );

    return {
      ...metrics,
      pendingRequests: pendingPromotions.length,
    };
  }, [progressEntries, trainingK9.programs, pendingPromotions.length]);

  // ── Query stats ───────────────────────────────────────────────────────

  const finalQueryStats = useMemo((): QueryStats => ({
    ...queryStatsBase,
    dogCount: dogsWithProgress.length,
    progressCount: progressData.length,
    truncatedDogCount,
  }), [queryStatsBase, dogsWithProgress.length, progressData.length, truncatedDogCount]);

  // ── Loading state ────────────────────────────────────────────────────

  const loading = loadState === "idle" || loadState === "loading";

  // ── Final data ──────────────────────────────────────────────────────

  // ── Aggregated evaluation error ──────────────────────────────────────────

  const aggregatedEvaluationError = useMemo(() => {
    return pendingEvaluationsError ?? decidedEvaluationsError ?? null;
  }, [pendingEvaluationsError, decidedEvaluationsError]);

  const data: TrainingReportsData = useMemo(
    () => ({
      filters: { period, modality, dogId },
      setPeriod,
      setModality,
      setDogId,
      currentState,
      sessionMetrics,
      durationMetrics,
      activitySummary,
      evaluationMetrics,
      rejectedByModule,
      individualTimelines,
      dataQuality,
      queryStats: finalQueryStats,
      loadingState,
      errorState: {
        base: loadError && !sessionError && !aggregatedEvaluationError ? loadError : null,
        sessions: sessionError,
        pendingEvaluations: pendingEvaluationsError,
        decidedEvaluations: decidedEvaluationsError,
        evaluations: aggregatedEvaluationError,
      },
      sessionLoadStatus,
      loadedFilters,
      successfulSessionQueryCount,
      failedSessionQueryCount,
      loading,
      error: loadError ?? sessionError ?? aggregatedEvaluationError,
      retry,
      retrySessions,
      retryEvaluations,
      evaluationsSkipped: !canReadPromotions,
      evaluationAccess: ((): EvaluationAccessState => {
        if (!canReadPromotions) return "restricted";
        if (aggregatedEvaluationError) return "error";
        return "allowed";
      })(),
      sessionStatusByDog,
    }),
    [
      period,
      modality,
      dogId,
      currentState,
      sessionMetrics,
      durationMetrics,
      activitySummary,
      evaluationMetrics,
      rejectedByModule,
      individualTimelines,
      dataQuality,
      finalQueryStats,
      loadingState,
      sessionLoadStatus,
      loadedFilters,
      successfulSessionQueryCount,
      failedSessionQueryCount,
      loading,
      loadError,
      sessionError,
      pendingEvaluationsError,
      decidedEvaluationsError,
      aggregatedEvaluationError,
      canReadPromotions,
      sessionStatusByDog,
      retry,
      retrySessions,
      retryEvaluations,
      setPeriod,
      setModality,
      setDogId,
    ],
  );

  return (
    <TrainingReportsContext.Provider value={data}>
      {children}
    </TrainingReportsContext.Provider>
  );
}
