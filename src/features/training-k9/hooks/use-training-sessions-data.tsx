"use client";

/**
 * On-demand hook for the Sessões tab.
 *
 * Strategy: paginated queries (getDocs) with cursor-based "load more".
 *
 * Source: dogs/{dogId}/training_sessions (canonical, written by mobile).
 * Top-level `trainings` and `training_sessions` are legacy/mirrored and NOT loaded.
 *
 * Temporal field: `started_at` (Firestore Timestamp).
 * Documents without `started_at` are NOT returned by orderBy queries — this is
 * a known Firestore behavior. We do NOT pretend client-side fallbacks cover them.
 *
 * Query per dog (initial page):
 *   collection(`dogs/${dogId}/training_sessions`)
 *   .where('started_at', '>=', periodStart)   // omitted for "recent"
 *   .orderBy('started_at', 'desc')
 *   .limit(PAGE_SIZE)
 *
 * Load more (cursor):
 *   .startAfter(lastDoc)
 *   .limit(PAGE_SIZE)
 *
 * Concurrency: queries are batched in groups of CONCURRENCY_LIMIT to avoid
 * overwhelming the Firestore SDK with 100+ simultaneous requests.
 *
 * Scalability (initial fetch, PAGE_SIZE=20):
 *   10 dogs  → 2 batches (5 per batch), max 200 docs
 *   50 dogs  → 5 batches, max 1000 docs
 *   100 dogs → 10 batches, max 2000 docs
 *
 * KPI honesty: when any dog returns exactly PAGE_SIZE docs, the KPI values
 * are marked as truncated (the displayed count is a lower bound).
 */

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type DocumentSnapshot,
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

import { canônicalModality, canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import { useEffectiveData, type EffectiveDog, type EffectiveUser } from "@/features/effective/hooks/use-effective-data";
import { db } from "@/lib/firebase/client";
import { useTrainingK9Data } from "./use-training-k9-data";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const CONCURRENCY_LIMIT = 10;

export type PeriodKey = "7d" | "30d" | "90d" | "recent";

export const PERIOD_OPTIONS: Array<{ label: string; value: PeriodKey }> = [
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Últimos 90 dias", value: "90d" },
  { label: "Mais recentes", value: "recent" },
];

const DEFAULT_PERIOD: PeriodKey = "30d";

function periodStartDate(period: PeriodKey): Date | null {
  if (period === "recent") return null;
  const now = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrainingSession = {
  conductorName: string | null;
  conductorRa: string | null;
  date: Date | null;
  distanceM: number | null;
  dogId: string;
  dogName: string;
  durationS: number | null;
  events: string[];
  id: string;
  matrixLabel: string | null;
  modality: string;
  modalityLabel: string;
  moduleId: string | null;
  moduleLabel: string | null;
  phase: string | null;
  phaseLabel: string;
  result: string | null;
  sourcePath: string;
};

export type SessionsMetrics = {
  dogsWithSessions: number;
  modalitiesUsed: number;
  sessionsLoaded: number;
  sessionsWithDuration: number;
  totalDurationS: number;
  truncated: boolean;
};

export type TrainingSessionsData = {
  effectiveDogs: EffectiveDog[];
  errors: string[];
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  metrics: SessionsMetrics;
  period: PeriodKey;
  refreshing: boolean;
  sessions: TrainingSession[];
  setPeriod: (p: PeriodKey) => void;
  users: EffectiveUser[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateValue(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (v && typeof v === "object" && "toDate" in v) {
    const fn = (v as { toDate?: unknown }).toDate;
    if (typeof fn === "function") {
      const d = fn.call(v);
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
  }
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function text(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" || typeof v === "number") {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return null;
}

function numberValue(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function eventNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => {
      if (typeof e === "string") return e;
      if (e && typeof e === "object") {
        return String((e as Record<string, unknown>).type ?? (e as Record<string, unknown>).event_type ?? (e as Record<string, unknown>).name ?? "");
      }
      return "";
    })
    .filter((s) => s.length > 0);
}

function isDeleted(r: DocumentData) {
  return r.deleted_at != null || r.deletedAt != null || r.archived_at != null;
}

function phaseLabel(phase: string | null): string {
  if (!phase) return "Não informada";
  const p = phase.toLowerCase().trim();
  if (p === "formation" || p === "formacao") return "Formação";
  if (p === "maintenance" || p === "manutencao") return "Manutenção";
  if (p === "evaluation" || p === "avaliacao") return "Avaliação";
  if (p === "warm_up" || p === "aquecimento") return "Aquecimento";
  return phase.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Run async tasks in batches to limit concurrency. */
async function batchedAll<T>(tasks: Array<() => Promise<T>>, batchSize: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }
  return results;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const TrainingSessionsContext = createContext<TrainingSessionsData | null>(null);

export function useTrainingSessionsData(): TrainingSessionsData {
  const ctx = useContext(TrainingSessionsContext);
  if (!ctx) throw new Error("useTrainingSessionsData must be used within TrainingSessionsProvider");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

type RawRecord = DocumentData & { _id: string; _path: string; _dogId: string };

type DogCursor = {
  dogId: string;
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
};

export function TrainingSessionsProvider({ children }: { children: ReactNode }) {
  const effective = useEffectiveData();
  const trainingData = useTrainingK9Data();

  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const [records, setRecords] = useState<RawRecord[]>([]);
  const [cursors, setCursors] = useState<DogCursor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  const buildConstraints = useCallback((periodKey: PeriodKey, cursor: DocumentSnapshot | null): QueryConstraint[] => {
    const startDate = periodStartDate(periodKey);
    const constraints: QueryConstraint[] = [];

    if (startDate) {
      constraints.push(where("started_at", ">=", Timestamp.fromDate(startDate)));
    }

    constraints.push(orderBy("started_at", "desc"));

    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    constraints.push(limit(PAGE_SIZE));

    return constraints;
  }, []);

  const fetchPage = useCallback(async (
    dogIds: string[],
    periodKey: PeriodKey,
    existingCursors: DogCursor[],
    isLoadMore: boolean,
  ) => {
    const fetchId = ++fetchIdRef.current;

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setRefreshing(true);
    }

    const errorList: string[] = [];
    const cursorMap = new Map(existingCursors.map((c) => [c.dogId, c]));

    const dogsToFetch = isLoadMore
      ? dogIds.filter((id) => cursorMap.get(id)?.hasMore !== false)
      : dogIds;

    const tasks = dogsToFetch.map((dogId) => async () => {
      try {
        const cursor = isLoadMore ? (cursorMap.get(dogId)?.lastDoc ?? null) : null;
        const colRef = collection(db, `dogs/${dogId}/training_sessions`);
        const constraints = buildConstraints(periodKey, cursor);
        const q = query(colRef, ...constraints);
        const snapshot = await getDocs(q);

        const docs: RawRecord[] = snapshot.docs.map((d) => ({
          ...d.data(),
          _id: d.id,
          _path: d.ref.path,
          _dogId: dogId,
        }));

        const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
        const hasMore = snapshot.docs.length === PAGE_SIZE;

        return { dogId, docs, lastDoc, hasMore, error: null };
      } catch (err) {
        const msg = `dogs/${dogId}: ${err instanceof Error ? err.message : "erro"}`;
        return { dogId, docs: [] as RawRecord[], lastDoc: null, hasMore: false, error: msg };
      }
    });

    const results = await batchedAll(tasks, CONCURRENCY_LIMIT);

    if (!mountedRef.current || fetchId !== fetchIdRef.current) return;

    const newCursors: DogCursor[] = [];
    const newRecords: RawRecord[] = isLoadMore ? [...records] : [];

    for (const r of results) {
      if (r.error) errorList.push(r.error);
      newRecords.push(...r.docs);
      newCursors.push({ dogId: r.dogId, hasMore: r.hasMore, lastDoc: r.lastDoc });
    }

    if (isLoadMore) {
      const existingMap = new Map(existingCursors.map((c) => [c.dogId, c]));
      for (const nc of newCursors) {
        existingMap.set(nc.dogId, nc);
      }
      setCursors(Array.from(existingMap.values()));
    } else {
      setCursors(newCursors);
    }

    setRecords(newRecords);
    setErrors(errorList);
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
  }, [buildConstraints, records]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (effective.loading) return;
    const dogIds = effective.dogs.map((d) => d.id).filter(Boolean).sort();
    Promise.resolve().then(() => fetchPage(dogIds, period, [], false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective.dogs, effective.loading, period]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading) return;
    const dogIds = effective.dogs.map((d) => d.id).filter(Boolean).sort();
    fetchPage(dogIds, period, cursors, true);
  }, [cursors, effective.dogs, fetchPage, loading, loadingMore, period]);

  const hasMore = useMemo(() => cursors.some((c) => c.hasMore), [cursors]);
  const truncated = useMemo(() => cursors.some((c) => c.hasMore), [cursors]);

  const data = useMemo((): TrainingSessionsData => {
    const userMap = new Map(effective.users.map((u) => [u.ra, u]));
    const dogMap = new Map(effective.dogs.map((d) => [d.id, d]));

    const seen = new Set<string>();
    const sessions: TrainingSession[] = records
      .filter((r) => !isDeleted(r))
      .map((r): TrainingSession | null => {
        const uniqueKey = `${r._dogId}/${r._id}`;
        if (seen.has(uniqueKey)) return null;
        seen.add(uniqueKey);

        const track = asRecord(r.track);
        const dogId = r._dogId;

        const rawModality = text(r.modality, r.modality_id, r.trainingType, r.training_type, r.type);
        const modality = rawModality ? canônicalModality(rawModality) : "treino_geral";
        const date = dateValue(r.started_at ?? r.startedAt ?? r.performed_at ?? r.performedAt ?? r.date ?? r.created_at ?? r.createdAt);

        const handlerRa = text(r.handlerId, r.handler_id, r.performed_by, r.conductor_ra);
        const dog = dogMap.get(dogId);
        const conductor = handlerRa ? userMap.get(handlerRa) : (dog?.conductorRa ? userMap.get(dog.conductorRa) : null);

        const moduleId = text(r.module_id, r.moduleId);
        const program = trainingData.programs.find((p) => p.modality === modality);
        let moduleLabel: string | null = null;
        if (moduleId && program) {
          const mod = program.modules.find((m) => m.id === moduleId || m.title === moduleId);
          moduleLabel = mod?.title ?? null;
        }
        if (!moduleLabel && moduleId) {
          const num = Number(moduleId.replace(/\D/g, ""));
          moduleLabel = Number.isFinite(num) && num > 0 ? `Módulo ${num}` : null;
        }

        const rawPhase = text(r.phase, r.training_phase, r.trainingPhase);

        return {
          conductorName: conductor?.fullName ?? conductor?.callsign ?? null,
          conductorRa: handlerRa,
          date,
          distanceM: numberValue(r.distance_m ?? r.distanceM ?? track?.distance_m ?? track?.distanceM),
          dogId,
          dogName: dog?.name ?? `K9 ${dogId}`,
          durationS: numberValue(r.duration_s ?? r.durationS ?? track?.duration_s ?? track?.durationS),
          events: eventNames(r.events ?? track?.events),
          id: r._id,
          matrixLabel: program?.label ?? null,
          modality,
          modalityLabel: canônicalModalityLabel(modality),
          moduleId,
          moduleLabel,
          phase: rawPhase,
          phaseLabel: phaseLabel(rawPhase),
          result: text(r.result, r.outcome),
          sourcePath: r._path,
        };
      })
      .filter((s): s is TrainingSession => s !== null)
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

    const dogsWithSessions = new Set(sessions.map((s) => s.dogId)).size;
    const modalitiesUsed = new Set(sessions.map((s) => s.modality)).size;
    const sessionsWithDuration = sessions.filter((s) => s.durationS && s.durationS > 0).length;
    const totalDurationS = sessions.reduce((sum, s) => sum + (s.durationS ?? 0), 0);

    return {
      effectiveDogs: effective.dogs,
      errors,
      hasMore,
      loading: loading || effective.loading,
      loadingMore,
      loadMore,
      metrics: {
        dogsWithSessions,
        modalitiesUsed,
        sessionsLoaded: sessions.length,
        sessionsWithDuration,
        totalDurationS,
        truncated,
      },
      period,
      refreshing,
      sessions,
      setPeriod,
      users: effective.users,
    };
  }, [effective, errors, hasMore, loading, loadMore, loadingMore, period, records, refreshing, trainingData.programs, truncated]);

  return (
    <TrainingSessionsContext.Provider value={data}>
      {children}
    </TrainingSessionsContext.Provider>
  );
}
