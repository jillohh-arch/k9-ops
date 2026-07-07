"use client";

import {
  collection,
  getDocs,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { db } from "@/lib/firebase/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PromotionStatus = "pending" | "approved" | "rejected";

export type PromotionAuditEntry = {
  action: string;
  at: Date | null;
  by: string | null;
  note?: string;
};

export type PromotionRequest = {
  id: string;
  dog_id: string;
  dog_name: string;
  handler_ra: string;
  handler_name: string;
  modality: string;
  current_module_id: string | null;
  current_module_name: string | null;
  next_module_id: string | null;
  next_module_name: string | null;
  status: PromotionStatus;
  reason: string | null;
  rejection_reason: string | null;
  decision_reason: string | null;
  approved_by: string | null;
  rejected_by: string | null;
  decision_by: string | null;
  decision: string | null;
  decided_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
  audit_trail: PromotionAuditEntry[];
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function parseAuditTrail(raw: unknown): PromotionAuditEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: Record<string, unknown>) => ({
    action: String(entry.action ?? ""),
    at: toDate(entry.at),
    by: typeof entry.by === "string" ? entry.by : null,
    note: typeof entry.note === "string" ? entry.note : undefined,
  }));
}

function parseDoc(id: string, data: Record<string, unknown>): PromotionRequest {
  return {
    id,
    dog_id: String(data.dog_id ?? ""),
    dog_name: String(data.dog_name ?? ""),
    handler_ra: String(data.handler_ra ?? ""),
    handler_name: String(data.handler_name ?? ""),
    modality: String(data.modality ?? ""),
    current_module_id:
      typeof data.current_module_id === "string" ? data.current_module_id : null,
    current_module_name:
      typeof data.current_module_name === "string"
        ? data.current_module_name
        : null,
    next_module_id:
      typeof data.next_module_id === "string" ? data.next_module_id : null,
    next_module_name:
      typeof data.next_module_name === "string" ? data.next_module_name : null,
    status: (["pending", "approved", "rejected"].includes(
      data.status as string,
    )
      ? data.status
      : "pending") as PromotionStatus,
    reason: typeof data.reason === "string" ? data.reason : null,
    rejection_reason:
      typeof data.rejection_reason === "string" ? data.rejection_reason : null,
    decision_reason:
      typeof data.decision_reason === "string" ? data.decision_reason : null,
    approved_by:
      typeof data.approved_by === "string" ? data.approved_by : null,
    rejected_by:
      typeof data.rejected_by === "string" ? data.rejected_by : null,
    decision_by:
      typeof data.decision_by === "string" ? data.decision_by : null,
    decision:
      typeof data.decision === "string" ? data.decision : null,
    decided_at: toDate(data.decided_at),
    created_at: toDate(data.created_at),
    updated_at: toDate(data.updated_at),
    audit_trail: parseAuditTrail(data.audit_trail),
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePromotionRequests() {
  const [requests, setRequests] = useState<PromotionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setRefreshing(true);
    const q = query(
      collection(db, "promotion_requests"),
      orderBy("created_at", "desc"),
    );
    try {
      const snapshot = await getDocs(q);
      if (!mountedRef.current) return;
      const parsed = snapshot.docs.map((doc) =>
        parseDoc(doc.id, doc.data() as Record<string, unknown>),
      );
      setRequests(parsed);
      setLoading(false);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Erro ao carregar");
      setLoading(false);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const grouped = useMemo(() => {
    const pending = requests.filter((r) => r.status === "pending");
    const approved = requests.filter((r) => r.status === "approved");
    const rejected = requests.filter((r) => r.status === "rejected");
    return { pending, approved, rejected };
  }, [requests]);

  return {
    requests,
    pending: grouped.pending,
    approved: grouped.approved,
    rejected: grouped.rejected,
    pendingCount: grouped.pending.length,
    loading,
    error,
    refresh: load,
    refreshing,
  };
}
