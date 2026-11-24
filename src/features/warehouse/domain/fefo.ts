/**
 * K9 Ops — F60 Almoxarifado V1
 * FEFO (First Expired, First Out) Domain Engine
 *
 * Enforces FEFO batch sorting, eligible batch recommendation,
 * deterministic multi-batch allocation and override validation.
 */

import { StockBatch, StockPosition } from "./contracts";
import { isBatchExpired } from "./business-clock";

export interface FefoAllocationItem {
  batchId: string;
  lotNumber: string;
  expirationDate: string;
  allocatedQuantity: number;
  availableInBatch: number;
  positionId?: string;
  locationId?: string;
  locationName?: string;
}

export interface FefoAllocationResult {
  fulfilled: boolean;
  requestedQuantity: number;
  allocatedTotal: number;
  remainingQuantity: number;
  allocations: FefoAllocationItem[];
}

/**
 * Filter and sort batches by FEFO rules:
 * 1. Exclude depleted (current_quantity <= 0 or status === "depleted")
 * 2. Exclude blocked (status === "blocked")
 * 3. Exclude expired relative to businessToday
 * 4. Sort ascending by expiration_date (YYYY-MM-DD string comparison is lexicographically equivalent to chronological)
 * 5. Tie-breaker: sort ascending by received_at, then by lot_number
 */
export function sortBatchesByFefo<T extends Pick<StockBatch, "status" | "expiration_date" | "current_quantity"> & { received_at?: Date | null; lot_number?: string }>(
  batches: T[],
  businessToday: string,
): T[] {
  return batches
    .filter((batch) => {
      if (batch.status === "blocked" || batch.status === "depleted") {
        return false;
      }
      if (batch.current_quantity <= 0) {
        return false;
      }
      if (isBatchExpired(batch.expiration_date, businessToday)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.expiration_date !== b.expiration_date) {
        return a.expiration_date.localeCompare(b.expiration_date);
      }
      const timeA = a.received_at ? new Date(a.received_at).getTime() : 0;
      const timeB = b.received_at ? new Date(b.received_at).getTime() : 0;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return (a.lot_number || "").localeCompare(b.lot_number || "");
    });
}

/**
 * Suggests the single best FEFO batch for consumption at a specific location or globally.
 * Returns null if no eligible batch is found.
 */
export function suggestFefoBatch(
  batches: StockBatch[],
  businessToday: string,
  options?: {
    locationId?: string;
    positions?: StockPosition[];
  },
): StockBatch | null {
  let eligibleBatches = sortBatchesByFefo(batches, businessToday);

  if (options?.locationId && options.positions) {
    const locId = options.locationId;
    const positionsAtLoc = options.positions.filter(
      (pos) => pos.location_id === locId && pos.quantity > 0,
    );
    const batchIdsAtLoc = new Set(positionsAtLoc.map((pos) => pos.batch_id));
    eligibleBatches = eligibleBatches.filter((b) => batchIdsAtLoc.has(b.id));
  }

  return eligibleBatches[0] ?? null;
}

/**
 * Deterministic multi-batch allocation helper using FEFO ordering.
 * Given a requested quantity, consumes from the earliest expiring eligible batches
 * until the quantity is met or stock is exhausted.
 */
export function allocateFefo(params: {
  batches: StockBatch[];
  requestedQuantity: number;
  businessToday: string;
  locationId?: string;
  positions?: StockPosition[];
}): FefoAllocationResult {
  const { batches, requestedQuantity, businessToday, locationId, positions } = params;

  if (requestedQuantity <= 0) {
    return {
      fulfilled: false,
      requestedQuantity,
      allocatedTotal: 0,
      remainingQuantity: requestedQuantity,
      allocations: [],
    };
  }

  // If location-constrained, determine available quantity per batch at that location
  const positionsMap = new Map<string, StockPosition>();
  if (locationId && positions) {
    for (const pos of positions) {
      if (pos.location_id === locationId && pos.quantity > 0) {
        positionsMap.set(pos.batch_id, pos);
      }
    }
  }

  const sorted = sortBatchesByFefo(batches, businessToday).filter((batch) => {
    if (locationId && positions) {
      return positionsMap.has(batch.id);
    }
    return true;
  });

  const allocations: FefoAllocationItem[] = [];
  let needed = requestedQuantity;

  for (const batch of sorted) {
    if (needed <= 0) break;

    const maxAvailable = locationId && positions
      ? (positionsMap.get(batch.id)?.quantity ?? 0)
      : batch.current_quantity;

    if (maxAvailable <= 0) continue;

    const toAllocate = Math.min(needed, maxAvailable);
    const pos = positionsMap.get(batch.id);

    allocations.push({
      batchId: batch.id,
      lotNumber: batch.lot_number,
      expirationDate: batch.expiration_date,
      allocatedQuantity: toAllocate,
      availableInBatch: maxAvailable,
      positionId: pos?.id,
      locationId: pos?.location_id,
      locationName: pos?.location_name,
    });

    needed -= toAllocate;
  }

  const allocatedTotal = requestedQuantity - needed;

  return {
    fulfilled: needed === 0,
    requestedQuantity,
    allocatedTotal,
    remainingQuantity: Math.max(0, needed),
    allocations,
  };
}

/**
 * Validates FEFO override.
 * If the selected batch is NOT the recommended FEFO batch,
 * a non-empty override justification is strictly required.
 */
export function validateFefoOverride(params: {
  selectedBatchId: string;
  recommendedBatchId: string | null;
  overrideReason?: string | null;
}): { valid: boolean; error?: string } {
  const { selectedBatchId, recommendedBatchId, overrideReason } = params;

  if (!recommendedBatchId) {
    return { valid: true };
  }

  if (selectedBatchId === recommendedBatchId) {
    return { valid: true };
  }

  // Operator chose a different batch than recommended FEFO
  if (!overrideReason || typeof overrideReason !== "string" || !overrideReason.trim()) {
    return {
      valid: false,
      error: "O lote selecionado difere da recomendação FEFO (menor validade). Uma justificativa é obrigatória.",
    };
  }

  if (overrideReason.trim().length < 5) {
    return {
      valid: false,
      error: "A justificativa de override FEFO deve ter pelo menos 5 caracteres.",
    };
  }

  return { valid: true };
}
