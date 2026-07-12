"use client";

/**
 * Hook for the Avaliações tab.
 *
 * Source: top-level `promotion_requests` collection (canonical, written by mobile).
 * Strategy: one-shot getDocs (same as usePromotionRequests), permission-gated.
 *
 * Permissions for reading:
 *   can("training", "approve") || can("training", "audit") ||
 *   can("training_matrix", "approve") || can("training_matrix", "audit")
 *
 * Permissions for deciding:
 *   can("training", "approve") || can("training_matrix", "approve")
 */

import {
  collection,
  getDocs,
  orderBy,
  query,
  type Timestamp,
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

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { canônicalModality, canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import { useEffectiveData } from "@/features/effective/hooks/use-effective-data";
import { db } from "@/lib/firebase/client";

// ─── Constants ────────────────────────────────────────────────────────────────

export type EvaluationSubtab = "pending" | "approved" | "rejected";

export const EVALUATION_SUBTABS: Array<{ label: string; value: EvaluationSubtab }> = [
  { label: "Pendentes", value: "pending" },
  { label: "Aprovadas", value: "approved" },
  { label: "Rejeitadas", value: "rejected" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type PromotionStatus = "pending" | "approved" | "rejected";

export type AuditEntry = {
  action: string;
  at: Date | null;
  by: string | null;
  note?: string;
};

export type EvaluationRequest = {
  id: string;
  auditTrail: AuditEntry[];
  conductorName: string;
  conductorRa: string;
  createdAt: Date | null;
  currentModuleId: string | null;
  currentModuleName: string | null;
  decidedAt: Date | null;
  decisionBy: string | null;
  decisionReason: string | null;
  dogId: string;
  dogName: string;
  dogPhotoUrl: string | null;
  modality: string;
  modalityLabel: string;
  nextModuleId: string | null;
  nextModuleName: string | null;
  status: PromotionStatus;
  waitingDays: number | null;
};

export type EvaluationMetrics = {
  approved: number;
  avgDecisionDays: number | null;
  pending: number;
  waitingOver7Days: number;
};

export type EvaluationsData = {
  canDecide: boolean;
  error: string | null;
  loading: boolean;
  metrics: EvaluationMetrics;
  refresh: () => void;
  refreshing: boolean;
  requests: EvaluationRequest[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseAuditTrail(raw: unknown): AuditEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: Record<string, unknown>) => ({
    action: String(entry.action ?? ""),
    at: toDate(entry.at),
    by: typeof entry.by === "string" ? entry.by : null,
    note: typeof entry.note === "string" ? entry.note : undefined,
  }));
}

function daysBetween(from: Date | null, to: Date): number | null {
  if (!from) return null;
  const diff = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

function friendlyModuleName(id: string | null, name: string | null): string | null {
  if (name) return name;
  if (!id) return null;
  const num = Number(id.replace(/\D/g, ""));
  return Number.isFinite(num) && num > 0 ? `Módulo ${num}` : id.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Context ─────────────────────────────────────────────────────────────────

const EvaluationsContext = createContext<EvaluationsData | null>(null);

export function useEvaluationsData(): EvaluationsData {
  const ctx = useContext(EvaluationsContext);
  if (!ctx) throw new Error("useEvaluationsData must be used within EvaluationsProvider");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function EvaluationsProvider({ children }: { children: ReactNode }) {
  const { can } = useAccessControl();
  const effective = useEffectiveData();

  const canRead = can("training", "approve") || can("training", "audit") ||
    can("training_matrix", "approve") || can("training_matrix", "audit");
  const canDecide = can("training", "approve") || can("training_matrix", "approve");

  const [rawRecords, setRawRecords] = useState<EvaluationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const dogMap = useMemo(
    () => new Map(effective.dogs.map((d) => [d.id, d])),
    [effective.dogs],
  );

  const load = useCallback(async () => {
    if (!canRead) {
      setRawRecords([]);
      setLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      const q = query(
        collection(db, "promotion_requests"),
        orderBy("created_at", "desc"),
      );
      const snapshot = await getDocs(q);
      if (!mountedRef.current) return;

      const now = new Date();
      const parsed: EvaluationRequest[] = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const rawModality = typeof data.modality === "string" ? data.modality : "";
        const modality = canônicalModality(rawModality);
        const createdAt = toDate(data.created_at);
        const decidedAt = toDate(data.decided_at);
        const dog = dogMap.get(String(data.dog_id ?? ""));
        const status = (["pending", "approved", "rejected"].includes(data.status as string)
          ? data.status : "pending") as PromotionStatus;

        return {
          id: d.id,
          auditTrail: parseAuditTrail(data.audit_trail),
          conductorName: String(data.handler_name ?? ""),
          conductorRa: String(data.handler_ra ?? ""),
          createdAt,
          currentModuleId: typeof data.current_module_id === "string" ? data.current_module_id : null,
          currentModuleName: friendlyModuleName(
            typeof data.current_module_id === "string" ? data.current_module_id : null,
            typeof data.current_module_name === "string" ? data.current_module_name : null,
          ),
          decidedAt,
          decisionBy: typeof data.decision_by === "string" ? data.decision_by : null,
          decisionReason: typeof data.decision_reason === "string" ? data.decision_reason
            : typeof data.rejection_reason === "string" ? data.rejection_reason
            : typeof data.reason === "string" ? data.reason : null,
          dogId: String(data.dog_id ?? ""),
          dogName: dog?.name ?? String(data.dog_name ?? `K9 ${data.dog_id ?? ""}`),
          dogPhotoUrl: (dog as Record<string, unknown> | undefined)?.photoUrl as string | null ?? null,
          modality,
          modalityLabel: canônicalModalityLabel(modality),
          nextModuleId: typeof data.next_module_id === "string" ? data.next_module_id : null,
          nextModuleName: friendlyModuleName(
            typeof data.next_module_id === "string" ? data.next_module_id : null,
            typeof data.next_module_name === "string" ? data.next_module_name : null,
          ),
          status,
          waitingDays: status === "pending" ? daysBetween(createdAt, now) : null,
        };
      });

      setRawRecords(parsed);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Erro ao carregar avaliações.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [canRead, dogMap]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (effective.loading) return;
    Promise.resolve().then(() => load());
  }, [effective.loading, load]);

  const data = useMemo((): EvaluationsData => {
    const pending = rawRecords.filter((r) => r.status === "pending");
    const approved = rawRecords.filter((r) => r.status === "approved");
    const waitingOver7 = pending.filter((r) => r.waitingDays !== null && r.waitingDays > 7);

    const decisionsWithBothDates = rawRecords.filter(
      (r) => r.status !== "pending" && r.createdAt && r.decidedAt,
    );
    let avgDecisionDays: number | null = null;
    if (decisionsWithBothDates.length > 0) {
      const totalDays = decisionsWithBothDates.reduce((sum, r) => {
        const days = daysBetween(r.createdAt, r.decidedAt!);
        return sum + (days ?? 0);
      }, 0);
      avgDecisionDays = Math.round((totalDays / decisionsWithBothDates.length) * 10) / 10;
    }

    return {
      canDecide,
      error,
      loading: loading || effective.loading,
      metrics: {
        approved: approved.length,
        avgDecisionDays,
        pending: pending.length,
        waitingOver7Days: waitingOver7.length,
      },
      refresh: load,
      refreshing,
      requests: rawRecords,
    };
  }, [canDecide, error, loading, effective.loading, load, rawRecords, refreshing]);

  return (
    <EvaluationsContext.Provider value={data}>
      {children}
    </EvaluationsContext.Provider>
  );
}
