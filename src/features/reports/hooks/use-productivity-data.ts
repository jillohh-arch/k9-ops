"use client";

import {
  collection,
  collectionGroup,
  getDocs,
  type Query,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DashboardPeriodDays } from "@/features/dashboard/providers/dashboard-period-provider";
import { db } from "@/lib/firebase/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConductorMetrics = {
  avgOccurrencesPerShift: number;
  id: string;
  name: string;
  occurrences: number;
  shiftHours: number;
  trainingSessions: number;
};

export type BinomialMetrics = {
  conductorName: string;
  dogName: string;
  id: string;
  occurrences: number;
  readinessScore: number;
  trainingSessions: number;
};

export type ProductivitySummary = {
  avgOccurrencesPerShift: number;
  totalOccurrences: number;
  totalShiftHours: number;
  totalTrainingSessions: number;
};

export type ProductivityData = {
  binomialMetrics: BinomialMetrics[];
  conductorRanking: ConductorMetrics[];
  loading: boolean;
  summary: ProductivitySummary;
  topConductors: ConductorMetrics[];
};

// ─── Helpers ────────────────────────────────────────────────────────────────

type RawRecord = Record<string, unknown> & { _id: string };

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return null;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : null;
    }
  }
  return null;
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(
      value
        .replace(/[^\d,.-]/g, "")
        .replace(/\.(?=\d{3}(\D|$))/g, "")
        .replace(",", "."),
    );
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function periodStart(days: DashboardPeriodDays) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function recordDate(record: RawRecord) {
  return dateValue(
    record.started_at ??
      record.startedAt ??
      record.performed_at ??
      record.performedAt ??
      record.created_at ??
      record.createdAt ??
      record.updated_at ??
      record.updatedAt ??
      record.date,
  );
}

function inPeriod(record: RawRecord, start: Date) {
  const date = recordDate(record);
  return date != null && date >= start;
}

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const parsed = normalized(value);
  if (["true", "1", "sim", "ativo", "active"].includes(parsed)) return true;
  if (["false", "0", "nao", "inativo", "inactive"].includes(parsed))
    return false;
  return fallback;
}

function isDeleted(record: RawRecord) {
  return (
    record.deleted_at != null ||
    record.deletedAt != null ||
    record.archived_at != null ||
    booleanValue(record.deleted, false)
  );
}

function visible(records: RawRecord[]) {
  return records.filter((record) => !isDeleted(record));
}

function isActive(record: RawRecord) {
  const status = normalized(record.status ?? record.state);
  if (status) {
    return [
      "active",
      "ativo",
      "available",
      "disponível",
      "em serviço",
      "em_servico",
      "operational",
      "operacional",
    ].includes(status);
  }
  return booleanValue(record.active, true);
}

function conductorIdOf(record: RawRecord) {
  return (
    text(
      record.conductor_ra,
      record.conductorRa,
      record.handler_id,
      record.handlerId,
      record.userId,
      record.user_id,
      record.conductor_id,
      record.conductorId,
      record.operatorId,
      record.operator_id,
      record.ra,
    ) ?? ""
  );
}

function dogIdOf(record: RawRecord) {
  return (
    text(record.dog_id, record.dogId, record.k9_id, record.k9Id) ?? ""
  );
}

function binomialKey(record: RawRecord) {
  return (
    text(
      record.binomial_id,
      record.binomialId,
      record.binomio_id,
    ) ?? ""
  );
}

const DEFAULT_SHIFT_HOURS = 8;

// ─── Source definitions ─────────────────────────────────────────────────────

type SourceKey =
  | "activeShifts"
  | "binomials"
  | "dogs"
  | "occurrences"
  | "trainingSessions"
  | "users";

type SourceState = {
  loading: boolean;
  records: RawRecord[];
};

type Sources = Record<SourceKey, SourceState>;

const sourceDefinitions: Array<{
  group?: boolean;
  key: SourceKey;
  path: string;
}> = [
  { key: "activeShifts", path: "active_shifts" },
  { key: "binomials", path: "binomials" },
  { key: "dogs", path: "dogs" },
  { key: "occurrences", path: "occurrences" },
  { group: true, key: "trainingSessions", path: "training_sessions" },
  { key: "users", path: "users" },
];

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useProductivityData(
  periodDays: DashboardPeriodDays,
): ProductivityData & { refresh: () => void; refreshing: boolean } {
  const [sources, setSources] = useState<Sources>(() => {
    const initial = {} as Sources;
    for (const { key } of sourceDefinitions) {
      initial[key] = { loading: true, records: [] };
    }
    return initial;
  });
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    if (!db) return;
    setRefreshing(true);
    setSources(() => {
      const reset = {} as Sources;
      for (const { key } of sourceDefinitions) {
        reset[key] = { loading: true, records: [] };
      }
      return reset;
    });

    const promises = sourceDefinitions.map(async ({ group, key, path }) => {
      const ref: Query = group
        ? collectionGroup(db, path)
        : collection(db, path);
      try {
        const snapshot = await getDocs(ref);
        const records = snapshot.docs.map((doc) => ({
          _id: doc.id,
          ...doc.data(),
        })) as RawRecord[];
        if (mountedRef.current) {
          setSources((prev) => ({
            ...prev,
            [key]: { loading: false, records },
          }));
        }
      } catch {
        if (mountedRef.current) {
          setSources((prev) => ({
            ...prev,
            [key]: { loading: false, records: [] },
          }));
        }
      }
    });

    Promise.all(promises).then(() => {
      if (mountedRef.current) setRefreshing(false);
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    queueMicrotask(() => { load(); });
    return () => { mountedRef.current = false; };
  }, [load]);

  const refresh = useCallback(() => { load(); }, [load]);

  const computed = useMemo(() => {
    const isLoading = sourceDefinitions.some(
      ({ key }) => sources[key].loading,
    );

    if (isLoading) {
      return {
        binomialMetrics: [],
        conductorRanking: [],
        loading: true,
        summary: {
          avgOccurrencesPerShift: 0,
          totalOccurrences: 0,
          totalShiftHours: 0,
          totalTrainingSessions: 0,
        },
        topConductors: [],
      };
    }

    const start = periodStart(periodDays);

    const users = visible(sources.users.records);
    const dogs = visible(sources.dogs.records);
    const binomials = visible(sources.binomials.records);
    const occurrences = visible(sources.occurrences.records).filter((r) =>
      inPeriod(r, start),
    );
    const trainingSessions = visible(
      sources.trainingSessions.records,
    ).filter((r) => inPeriod(r, start));
    const shifts = visible(sources.activeShifts.records).filter((r) =>
      inPeriod(r, start),
    );

    // ─── Build user lookup ─────────────────────────────────────────────
    const userMap = new Map<string, string>();
    for (const user of users) {
      const id =
        text(user.ra, user._id) ?? user._id;
      const name =
        text(user.name, user.nome, user.fullName, user.full_name) ??
        id;
      userMap.set(id, name);
    }

    // ─── Build dog lookup ──────────────────────────────────────────────
    const dogMap = new Map<string, string>();
    for (const dog of dogs) {
      const id = dog._id;
      const name =
        text(dog.name, dog.nome, dog.callSign, dog.call_sign) ?? id;
      dogMap.set(id, name);
    }

    // ─── Conductor metrics ─────────────────────────────────────────────
    const conductorOccurrences = new Map<string, number>();
    const conductorTrainings = new Map<string, number>();
    const conductorShifts = new Map<string, number>();

    for (const occ of occurrences) {
      const cid = conductorIdOf(occ);
      if (cid) {
        conductorOccurrences.set(
          cid,
          (conductorOccurrences.get(cid) ?? 0) + 1,
        );
      }
    }

    for (const session of trainingSessions) {
      const cid = conductorIdOf(session);
      if (cid) {
        conductorTrainings.set(
          cid,
          (conductorTrainings.get(cid) ?? 0) + 1,
        );
      }
    }

    for (const shift of shifts) {
      const cid = conductorIdOf(shift);
      if (cid) {
        conductorShifts.set(cid, (conductorShifts.get(cid) ?? 0) + 1);
      }
    }

    // Build combined conductor set
    const conductorIds = new Set<string>([
      ...conductorOccurrences.keys(),
      ...conductorTrainings.keys(),
      ...conductorShifts.keys(),
    ]);

    // If no conductor-level data, fall back to active users
    if (conductorIds.size === 0) {
      for (const user of users.filter(isActive)) {
        const id = text(user.ra, user._id) ?? user._id;
        conductorIds.add(id);
      }
    }

    const conductorRanking: ConductorMetrics[] = Array.from(conductorIds)
      .map((id) => {
        const shiftsCount = conductorShifts.get(id) ?? 0;
        const shiftHours = shiftsCount > 0
          ? shiftsCount * DEFAULT_SHIFT_HOURS
          : DEFAULT_SHIFT_HOURS;
        const occ = conductorOccurrences.get(id) ?? 0;
        return {
          avgOccurrencesPerShift:
            shiftsCount > 0
              ? Math.round((occ / shiftsCount) * 100) / 100
              : occ,
          id,
          name: userMap.get(id) ?? id,
          occurrences: occ,
          shiftHours,
          trainingSessions: conductorTrainings.get(id) ?? 0,
        };
      })
      .filter(
        (c) =>
          c.occurrences > 0 ||
          c.trainingSessions > 0,
      )
      .sort((a, b) => {
        const scoreA = a.occurrences + a.trainingSessions;
        const scoreB = b.occurrences + b.trainingSessions;
        return scoreB - scoreA;
      });

    // ─── Binomial metrics ──────────────────────────────────────────────
    const binomialOccurrences = new Map<string, number>();
    const binomialTrainings = new Map<string, number>();

    for (const occ of occurrences) {
      const bid = binomialKey(occ);
      if (bid) {
        binomialOccurrences.set(
          bid,
          (binomialOccurrences.get(bid) ?? 0) + 1,
        );
      }
    }

    for (const session of trainingSessions) {
      const bid = binomialKey(session);
      if (bid) {
        binomialTrainings.set(
          bid,
          (binomialTrainings.get(bid) ?? 0) + 1,
        );
      }
    }

    const binomialMetrics: BinomialMetrics[] = binomials
      .filter(isActive)
      .map((b) => {
        const bid = b._id;
        const cid = conductorIdOf(b);
        const did = dogIdOf(b);
        const readiness = numberValue(
          b.readiness_score ?? b.readinessScore ?? b.score ?? b.prontidao,
        );

        return {
          conductorName: (userMap.get(cid) ?? cid) || "Condutor",
          dogName: (dogMap.get(did) ?? did) || "K9",
          id: bid,
          occurrences: binomialOccurrences.get(bid) ?? 0,
          readinessScore: readiness > 0 ? Math.min(readiness, 100) : 75,
          trainingSessions: binomialTrainings.get(bid) ?? 0,
        };
      })
      .sort((a, b) => {
        const scoreA = a.occurrences + a.trainingSessions;
        const scoreB = b.occurrences + b.trainingSessions;
        return scoreB - scoreA;
      });

    // ─── Summary ───────────────────────────────────────────────────────
    const totalOccurrences = occurrences.length;
    const totalTrainingSessions = trainingSessions.length;
    const totalShiftHours = shifts.length > 0
      ? shifts.length * DEFAULT_SHIFT_HOURS
      : conductorRanking.length * DEFAULT_SHIFT_HOURS;
    const avgOccurrencesPerShift =
      shifts.length > 0
        ? Math.round((totalOccurrences / shifts.length) * 100) / 100
        : conductorRanking.length > 0
          ? Math.round(
              (totalOccurrences / conductorRanking.length) * 100,
            ) / 100
          : 0;

    return {
      binomialMetrics,
      conductorRanking,
      loading: false,
      summary: {
        avgOccurrencesPerShift,
        totalOccurrences,
        totalShiftHours,
        totalTrainingSessions,
      },
      topConductors: conductorRanking.slice(0, 10),
    };
  }, [periodDays, sources]);

  return { ...computed, refresh, refreshing };
}
