"use client";

import { collection, onSnapshot, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { db } from "@/lib/firebase/client";
import type {
  ConsumableMaterial,
  Equipment,
  EquipmentCustody,
  InventoryItemCount,
  InventorySession,
  StockBatch,
  StockMovement,
  StockPosition,
  WarehouseLocation,
} from "../domain/contracts";
import {
  READONLY_WAREHOUSE_PERMISSIONS,
  type WarehousePermissions,
} from "./use-warehouse-permissions";

export type WarehouseData = {
  materials: ConsumableMaterial[];
  batches: StockBatch[];
  positions: StockPosition[];
  equipment: Equipment[];
  custodies: EquipmentCustody[];
  locations: WarehouseLocation[];
  movements: StockMovement[];
  sessions: InventorySession[];
  status: "loading" | "ready" | "forbidden" | "error";
  error: string | null;
  canAuditSessions?: boolean;
  permissions?: WarehousePermissions;
};

const empty: Omit<WarehouseData, "status" | "error" | "canAuditSessions"> = {
  materials: [],
  batches: [],
  positions: [],
  equipment: [],
  custodies: [],
  locations: [],
  movements: [],
  sessions: [],
};

export const warehouseCollections = {
  materials: "inventory_items",
  batches: "warehouse_batches",
  positions: "warehouse_positions",
  equipment: "warehouse_equipment",
  custodies: "warehouse_custodies",
  locations: "warehouse_locations",
  movements: "inventory_movements",
  sessions: "inventory_sessions",
} as const;

export function normalizeWarehouseRecord(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(normalizeWarehouseRecord);
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeWarehouseRecord(item)]));
  }
  return value;
}

export function useWarehouseData(): WarehouseData {
  const { can, status: accessStatus } = useAccessControl();
  const allowed = can("inventory", "view");
  const canAudit = can("inventory", "audit");
  const canCreate = can("inventory", "create");
  const canEdit = can("inventory", "edit");
  const permissions: WarehousePermissions = {
    canCreate,
    canEdit,
    canArchive: can("inventory", "archive"),
    canAudit,
    canExport: can("inventory", "export"),
    canReturnCustody: canCreate || canEdit,
  };
  const [state, setState] = useState<WarehouseData>({
    ...empty,
    status: "loading",
    error: null,
    canAuditSessions: canAudit,
  });

  useEffect(() => {
    if (accessStatus === "loading") return;
    if (!allowed) return;

    // Segregate collections based on inventory.audit permission (Option B)
    const collectionsToSubscribe = (
      Object.entries(warehouseCollections) as Array<[keyof typeof warehouseCollections, string]>
    ).filter(([key]) => key !== "sessions" || canAudit);

    const received = new Set<keyof typeof warehouseCollections>();
    let failed = false;

    const unsubscribes = collectionsToSubscribe.map(([key, path]) =>
      onSnapshot(
        collection(db, path),
        (snapshot) => {
          received.add(key);
          setState((previous) => ({
            ...previous,
            [key]: snapshot.docs.map((item) => ({
              ...(normalizeWarehouseRecord(item.data()) as Record<string, unknown>),
              id: item.id,
            })),
            status: failed
              ? "error"
              : received.size === collectionsToSubscribe.length
              ? "ready"
              : "loading",
            error: failed ? previous.error : null,
            canAuditSessions: canAudit,
          }));
        },
        (error) => {
          failed = true;
          setState((previous) => ({ ...previous, status: "error", error: error.message }));
        },
      ),
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [accessStatus, allowed, canAudit]);

  if (accessStatus === "loading") return { ...empty, status: "loading", error: null, canAuditSessions: false, permissions: READONLY_WAREHOUSE_PERMISSIONS };
  if (!allowed) return { ...empty, status: "forbidden", error: null, canAuditSessions: false, permissions: READONLY_WAREHOUSE_PERMISSIONS };
  if (!canAudit) return { ...state, sessions: [], canAuditSessions: false, permissions };
  return { ...state, canAuditSessions: true, permissions };
}

export type InventoryCountsData = {
  counts: InventoryItemCount[];
  status: "loading" | "ready" | "forbidden" | "error";
  error: string | null;
};

export function useInventoryCounts(sessionId: string | null | undefined): InventoryCountsData {
  const { can, status: accessStatus } = useAccessControl();
  const allowed = can("inventory", "view") && can("inventory", "audit");
  const [state, setState] = useState<InventoryCountsData>({
    counts: [],
    status: sessionId && allowed ? "loading" : allowed ? "ready" : "forbidden",
    error: null,
  });

  useEffect(() => {
    if (accessStatus === "loading") return;
    if (!allowed) return;
    if (!sessionId) return;

    let cancelled = false;

    const unsubscribe = onSnapshot(
      collection(db, "inventory_sessions", sessionId, "counts"),
      (snapshot) => {
        if (cancelled) return;
        const counts = snapshot.docs.map((doc) => ({
          ...(normalizeWarehouseRecord(doc.data()) as Record<string, unknown>),
          id: doc.id,
        })) as InventoryItemCount[];
        setState({ counts, status: "ready", error: null });
      },
      (error) => {
        if (cancelled) return;
        setState({ counts: [], status: "error", error: error.message });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId, accessStatus, allowed]);

  if (accessStatus === "loading") return { counts: [], status: "loading", error: null };
  if (!allowed) return { counts: [], status: "forbidden", error: null };
  if (!sessionId) return { counts: [], status: "ready", error: null };
  return state;
}
