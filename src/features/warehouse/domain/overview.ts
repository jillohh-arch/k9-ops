/**
 * K9 Ops — F60 Almoxarifado V1
 * Warehouse Overview & Operational Alerts Projection
 *
 * Implements in-memory read-model derivations from canonical F60 records:
 * - Material stock states & batch expirations
 * - Equipment lifecycle & custody overdue derivations
 * - Physical inventory states & snapshot attention alerts
 * - Deterministic alert ordering & deduplication
 * - Overall operational status (normal | warning | attention)
 *
 * All temporal derivations use canonical business clock (America/Sao_Paulo).
 * Alerts and overview metrics are PROJECTIONS and NOT persisted in Firestore.
 */

import {
  ConsumableMaterial,
  Equipment,
  EquipmentCustody,
  InventorySession,
  StockBatch,
  StockMovement,
} from "./contracts";
import {
  BusinessClock,
  defaultBusinessClock,
  formatCanonicalBusinessDate,
  isBatchExpired,
} from "./business-clock";
import {
  calculateMaterialAvailable,
  getBatchTemporalState,
} from "./projections";
import { isCustodyOverdue } from "./custody";

export type AlertSeverity = "critical" | "warning" | "info";

export type AlertKind =
  | "out_of_stock"
  | "expired_batch_with_on_hand"
  | "overdue_custody"
  | "inventory_snapshot_failed"
  | "low_stock"
  | "expiring_soon"
  | "damaged_equipment"
  | "maintenance_equipment"
  | "active_inventory"
  | "inventory_snapshot_building";

export interface WarehouseOperationalAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  description: string;
  entity_type: "material" | "batch" | "equipment" | "custody" | "inventory_session";
  entity_id?: string;
  href: string;
  occurred_or_due_at?: string;
}

export type OverallOperationalStatus = "normal" | "warning" | "attention";

export interface WarehouseOverviewMaterialsSummary {
  active_materials: number;
  out_of_stock: number;
  low_stock: number;
  expired_batches_with_stock: number;
  expiring_soon_batches_with_stock: number;
}

export interface WarehouseOverviewEquipmentSummary {
  total_active: number;
  available: number;
  in_custody: number;
  maintenance: number;
  damaged: number;
}

export interface WarehouseOverviewCustodySummary {
  active: number;
  overdue: number;
}

export interface InventorySessionSummary {
  id: string;
  title: string;
  scope_type: string;
  scope_ref_id?: string | null;
  status: string;
  snapshot_status: "building" | "complete" | "failed";
  opened_by_name: string;
  opened_at?: Date | null;
  total_items?: number;
  counted_items?: number;
}

export interface WarehouseOverviewInventorySummary {
  active_session: InventorySessionSummary | null;
  attention_required: boolean;
}

export interface WarehouseRecentMovement {
  id: string;
  type: string;
  material_name: string;
  quantity: number;
  unit: string;
  lot_number?: string | null;
  origin_location_name?: string | null;
  destination_location_name?: string | null;
  performed_by_name?: string | null;
  performed_at?: Date | null;
}

export interface WarehouseOverview {
  generated_at: string;
  overall_status: OverallOperationalStatus;
  materials: WarehouseOverviewMaterialsSummary;
  equipment: WarehouseOverviewEquipmentSummary;
  custody: WarehouseOverviewCustodySummary;
  inventory: WarehouseOverviewInventorySummary;
  alerts: WarehouseOperationalAlert[];
  recent_movements: WarehouseRecentMovement[];
}

export interface WarehouseOverviewSourceData {
  materials: ConsumableMaterial[];
  batches: StockBatch[];
  equipment: Equipment[];
  custodies: EquipmentCustody[];
  movements: StockMovement[];
  sessions: InventorySession[];
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * Derives the complete operational overview and prioritized alerts for the F60 warehouse.
 * Pure function: zero side-effects, zero writes.
 */
export function deriveWarehouseOverview(
  data: WarehouseOverviewSourceData,
  options?: {
    clock?: BusinessClock;
    now?: Date;
  },
): WarehouseOverview {
  const clock = options?.clock || defaultBusinessClock;
  const now = options?.now || clock.now();
  const businessToday = formatCanonicalBusinessDate(now);

  const rawMaterials = data.materials || [];
  const rawBatches = data.batches || [];
  const rawEquipment = data.equipment || [];
  const rawCustodies = data.custodies || [];
  const rawMovements = data.movements || [];
  const rawSessions = data.sessions || [];

  const alerts: WarehouseOperationalAlert[] = [];

  // Group batches by material_id
  const batchesByMaterial = new Map<string, StockBatch[]>();
  for (const batch of rawBatches) {
    const list = batchesByMaterial.get(batch.material_id) || [];
    list.push(batch);
    batchesByMaterial.set(batch.material_id, list);
  }

  // --- 1. MATERIALS & BATCHES ---
  const activeMaterials = rawMaterials.filter((m) => m.active);
  let outOfStockCount = 0;
  let lowStockCount = 0;

  for (const material of activeMaterials) {
    const mBatches = batchesByMaterial.get(material.id) || [];
    const available = calculateMaterialAvailable(mBatches, businessToday);
    const minQty = Number(material.minimum_quantity ?? 0);

    // Out of stock takes strict precedence over low stock
    if (available <= 0) {
      outOfStockCount++;
      alerts.push({
        id: `alert-out-of-stock-${material.id}`,
        kind: "out_of_stock",
        severity: "critical",
        title: `Material sem estoque disponível: ${material.name}`,
        description: `Saldo disponível é 0 ${material.unit} (Estoque físico ON-HAND: ${material.current_quantity ?? 0} ${material.unit}).`,
        entity_type: "material",
        entity_id: material.id,
        href: `/warehouse/materials/${material.id}`,
      });
    } else if (available <= minQty) {
      lowStockCount++;
      alerts.push({
        id: `alert-low-stock-${material.id}`,
        kind: "low_stock",
        severity: "warning",
        title: `Estoque baixo: ${material.name}`,
        description: `Disponível: ${available} ${material.unit} (Mínimo definido: ${minQty} ${material.unit}).`,
        entity_type: "material",
        entity_id: material.id,
        href: `/warehouse/materials/${material.id}`,
      });
    }
  }

  // Batch Alerts (only batches with current_quantity > 0 generate alerts!)
  let expiredBatchesWithStockCount = 0;
  let expiringSoonBatchesWithStockCount = 0;

  for (const batch of rawBatches) {
    const qty = Number(batch.current_quantity ?? 0);
    if (qty <= 0) {
      continue; // Depleted batches NEVER generate operational alerts!
    }

    if (isBatchExpired(batch.expiration_date, businessToday)) {
      expiredBatchesWithStockCount++;
      alerts.push({
        id: `alert-expired-batch-${batch.id}`,
        kind: "expired_batch_with_on_hand",
        severity: "critical",
        title: `Lote vencido em estoque físico: Lote ${batch.lot_number}`,
        description: `${batch.material_name || "Material"} - ${qty} unidades vencidas em ${batch.expiration_date}.`,
        entity_type: "batch",
        entity_id: batch.id,
        href: `/warehouse/batches`,
        occurred_or_due_at: batch.expiration_date,
      });
    } else if (getBatchTemporalState(batch, businessToday) === "expiring_soon") {
      expiringSoonBatchesWithStockCount++;
      alerts.push({
        id: `alert-expiring-soon-${batch.id}`,
        kind: "expiring_soon",
        severity: "warning",
        title: `Lote próximo do vencimento: Lote ${batch.lot_number}`,
        description: `${batch.material_name || "Material"} - Vence em ${batch.expiration_date} (${qty} unidades restantes).`,
        entity_type: "batch",
        entity_id: batch.id,
        href: `/warehouse/batches`,
        occurred_or_due_at: batch.expiration_date,
      });
    }
  }

  // --- 2. EQUIPMENT ---
  // Retired equipment is strictly excluded from total_active!
  const activeEquipment = rawEquipment.filter((e) => e.active && e.status !== "retired");
  const availableEqCount = activeEquipment.filter((e) => e.status === "available").length;
  const inCustodyEqCount = activeEquipment.filter((e) => e.status === "in_custody").length;
  const maintenanceEqCount = activeEquipment.filter((e) => e.status === "maintenance").length;
  const damagedEqCount = activeEquipment.filter((e) => e.status === "damaged").length;

  for (const eq of activeEquipment) {
    if (eq.status === "damaged") {
      alerts.push({
        id: `alert-damaged-eq-${eq.id}`,
        kind: "damaged_equipment",
        severity: "warning",
        title: `Equipamento danificado: ${eq.name} (${eq.identifier_code})`,
        description: `Equipamento registrado como danificado. Requer avaliação ou envio para manutenção.`,
        entity_type: "equipment",
        entity_id: eq.id,
        href: `/warehouse/equipment/${eq.id}`,
      });
    } else if (eq.status === "maintenance") {
      alerts.push({
        id: `alert-maintenance-eq-${eq.id}`,
        kind: "maintenance_equipment",
        severity: "warning",
        title: `Equipamento em manutenção: ${eq.name} (${eq.identifier_code})`,
        description: `Equipamento sob manutenção/reparo temporário.`,
        entity_type: "equipment",
        entity_id: eq.id,
        href: `/warehouse/equipment/${eq.id}`,
      });
    }
  }

  // --- 3. CUSTODIES ---
  const activeCustodies = rawCustodies.filter((c) => c.status === "active");
  let overdueCustodiesCount = 0;

  for (const custody of activeCustodies) {
    if (isCustodyOverdue(custody, now)) {
      overdueCustodiesCount++;
      const returnDateStr = custody.expected_return_at
        ? formatCanonicalBusinessDate(custody.expected_return_at)
        : "";
      alerts.push({
        id: `alert-overdue-custody-${custody.id}`,
        kind: "overdue_custody",
        severity: "critical",
        title: `Cautela atrasada: ${custody.equipment_name} (${custody.equipment_code})`,
        description: `Policial: ${custody.borrower_name} (${custody.borrower_ra}) - Previsão de retorno era ${returnDateStr}.`,
        entity_type: "custody",
        entity_id: custody.id,
        href: `/warehouse/custody`,
        occurred_or_due_at: returnDateStr,
      });
    }
  }

  // --- 4. PHYSICAL INVENTORY ---
  const activeSessions = rawSessions.filter(
    (s) => s.status === "in_progress" || s.status === "reconciling",
  );
  let activeSessionSummary: InventorySessionSummary | null = null;
  let attentionRequired = false;

  if (activeSessions.length > 0) {
    const s = activeSessions[0];
    const snapshotStatus =
      (s as unknown as { snapshot_status?: InventorySessionSummary["snapshot_status"] }).snapshot_status ||
      "complete";

    activeSessionSummary = {
      id: s.id,
      title: s.title,
      scope_type: s.scope_type,
      scope_ref_id: s.scope_ref_id || null,
      status: s.status,
      snapshot_status: snapshotStatus,
      opened_by_name: s.opened_by_name,
      opened_at: s.opened_at,
      total_items: s.total_items,
      counted_items: s.counted_items,
    };

    if (snapshotStatus === "failed") {
      attentionRequired = true;
      alerts.push({
        id: `alert-inv-failed-${s.id}`,
        kind: "inventory_snapshot_failed",
        severity: "critical",
        title: `Falha na montagem de inventário: ${s.title}`,
        description: `A construção do snapshot de posições falhou. A sessão requer cancelamento ou intervenção.`,
        entity_type: "inventory_session",
        entity_id: s.id,
        href: `/warehouse/inventory/${s.id}`,
      });
    } else if (snapshotStatus === "building") {
      alerts.push({
        id: `alert-inv-building-${s.id}`,
        kind: "inventory_snapshot_building",
        severity: "info",
        title: `Inventário em inicialização: ${s.title}`,
        description: `Snapshot de posições físicas sendo construído. Aguarde a finalização antes de iniciar a contagem.`,
        entity_type: "inventory_session",
        entity_id: s.id,
        href: `/warehouse/inventory/${s.id}`,
      });
    } else {
      alerts.push({
        id: `alert-inv-active-${s.id}`,
        kind: "active_inventory",
        severity: "info",
        title: `Inventário físico em andamento: ${s.title}`,
        description: `Escopo: ${s.scope_type}. Aberto por ${s.opened_by_name}.`,
        entity_type: "inventory_session",
        entity_id: s.id,
        href: `/warehouse/inventory/${s.id}`,
      });
    }
  }

  // --- 5. ALERT ORDERING & BOUNDS ---
  alerts.sort((a, b) => {
    const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rankDiff !== 0) return rankDiff;
    if (a.occurred_or_due_at && b.occurred_or_due_at) {
      const dateCompare = a.occurred_or_due_at.localeCompare(b.occurred_or_due_at);
      if (dateCompare !== 0) return dateCompare;
    }
    return a.title.localeCompare(b.title);
  });

  const boundedAlerts = alerts.slice(0, 20);

  // --- 6. OVERALL OPERATIONAL STATUS ---
  let overallStatus: OverallOperationalStatus = "normal";
  if (alerts.some((a) => a.severity === "critical")) {
    overallStatus = "attention";
  } else if (alerts.some((a) => a.severity === "warning")) {
    overallStatus = "warning";
  }

  // --- 7. RECENT MOVEMENTS (bounded to 10 latest) ---
  const sortedMovements = [...rawMovements].sort((a, b) => {
    const timeA = a.performed_at ? new Date(a.performed_at).getTime() : 0;
    const timeB = b.performed_at ? new Date(b.performed_at).getTime() : 0;
    return timeB - timeA;
  });

  const recentMovements: WarehouseRecentMovement[] = sortedMovements.slice(0, 10).map((m) => ({
    id: m.id,
    type: m.type,
    material_name: m.material_name,
    quantity: m.quantity,
    unit: m.unit,
    lot_number: m.lot_number,
    origin_location_name: m.origin_location_name,
    destination_location_name: m.destination_location_name,
    performed_by_name: m.performed_by_name,
    performed_at: m.performed_at,
  }));

  return {
    generated_at: now.toISOString(),
    overall_status: overallStatus,
    materials: {
      active_materials: activeMaterials.length,
      out_of_stock: outOfStockCount,
      low_stock: lowStockCount,
      expired_batches_with_stock: expiredBatchesWithStockCount,
      expiring_soon_batches_with_stock: expiringSoonBatchesWithStockCount,
    },
    equipment: {
      total_active: activeEquipment.length,
      available: availableEqCount,
      in_custody: inCustodyEqCount,
      maintenance: maintenanceEqCount,
      damaged: damagedEqCount,
    },
    custody: {
      active: activeCustodies.length,
      overdue: overdueCustodiesCount,
    },
    inventory: {
      active_session: activeSessionSummary,
      attention_required: attentionRequired,
    },
    alerts: boundedAlerts,
    recent_movements: recentMovements,
  };
}
