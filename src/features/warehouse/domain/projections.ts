/**
 * K9 Ops — F60 Almoxarifado V1
 * Domain Projections, State Derivations & Invariants Checks
 */

import {
  ConsumableMaterial,
  DerivedBatchTemporalState,
  DerivedCustodyDueState,
  DerivedMaterialStockState,
  EquipmentCustody,
  StockBatch,
  StockPosition,
} from "./contracts";
import { daysDifference, isBatchExpired } from "./business-clock";

/**
 * Derives the deterministic ID for a StockPosition.
 * Enforces uniqueness of batch_id + location_id.
 */
export function deriveDeterministicPositionId(
  materialId: string,
  batchId: string,
  locationId: string,
): string {
  const sanitize = (val: string) => val.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return `pos_${sanitize(materialId)}_${sanitize(batchId)}_${sanitize(locationId)}`;
}

/**
 * Computes temporal validity state of a batch for a given business today (YYYY-MM-DD).
 * Rule:
 * - If today > expiration_date -> "expired"
 * - If today <= expiration_date AND difference <= warningDays -> "expiring_soon"
 * - Else -> "valid"
 */
export function getBatchTemporalState(
  batch: Pick<StockBatch, "expiration_date">,
  businessToday: string,
  warningDays = 30,
): DerivedBatchTemporalState {
  if (isBatchExpired(batch.expiration_date, businessToday)) {
    return "expired";
  }
  const diff = daysDifference(batch.expiration_date, businessToday);
  if (diff >= 0 && diff <= warningDays) {
    return "expiring_soon";
  }
  return "valid";
}

/**
 * Determines whether a batch is eligible for normal operational consumption.
 * Must be active (not depleted, not blocked) and not expired.
 */
export function isBatchEligibleForConsumption(
  batch: Pick<StockBatch, "status" | "expiration_date" | "current_quantity">,
  businessToday: string,
): boolean {
  if (batch.status === "blocked" || batch.status === "depleted") {
    return false;
  }
  if (batch.current_quantity <= 0) {
    return false;
  }
  return !isBatchExpired(batch.expiration_date, businessToday);
}

/**
 * Computes AVAILABLE quantity for a material from its batches.
 * AVAILABLE = sum of current_quantity of eligible (valid, active, non-blocked) batches.
 */
export function calculateMaterialAvailable(
  batches: Array<Pick<StockBatch, "status" | "expiration_date" | "current_quantity">>,
  businessToday: string,
): number {
  return batches.reduce((sum, batch) => {
    if (isBatchEligibleForConsumption(batch, businessToday)) {
      return sum + Math.max(0, batch.current_quantity);
    }
    return sum;
  }, 0);
}

/**
 * Derives operational stock situation for a material based on AVAILABLE quantity.
 */
export function getMaterialStockState(
  availableQuantity: number,
  minimumQuantity: number,
): DerivedMaterialStockState {
  if (availableQuantity <= 0) {
    return "out_of_stock";
  }
  if (availableQuantity <= minimumQuantity) {
    return "low_stock";
  }
  return "regular";
}

/**
 * Computes derived due state for an EquipmentCustody.
 * Derived from canonical current instant.
 */
export function getCustodyDueState(
  custody: Pick<EquipmentCustody, "status" | "expected_return_at">,
  nowInstant: Date,
): DerivedCustodyDueState {
  if (custody.status !== "active" || !custody.expected_return_at) {
    return "on_time";
  }
  const returnTime = custody.expected_return_at.getTime();
  const nowTime = nowInstant.getTime();

  if (nowTime > returnTime) {
    return "overdue";
  }

  // Check if expected return falls on today (within 24 hours / same calendar day window)
  const diffHours = (returnTime - nowTime) / (1000 * 60 * 60);
  if (diffHours >= 0 && diffHours <= 12) {
    return "due_today";
  }

  return "on_time";
}

/**
 * Validates canonical conservation invariants:
 * 1. SUM(Position.quantity for batch) == Batch.current_quantity
 * 2. SUM(Batch.current_quantity for material) == Material.current_quantity
 * 3. All quantities >= 0.
 */
export function verifyConservationInvariants(
  material: Pick<ConsumableMaterial, "id" | "current_quantity">,
  batches: Array<Pick<StockBatch, "id" | "material_id" | "current_quantity">>,
  positions: Array<Pick<StockPosition, "id" | "batch_id" | "material_id" | "quantity">>,
): { errors: string[]; valid: boolean } {
  const errors: string[] = [];

  // Material non-negativity
  if (!Number.isFinite(material.current_quantity) || material.current_quantity < 0) {
    errors.push(
      `Material ${material.id} has negative current_quantity: ${material.current_quantity}`,
    );
  }

  // Batches for this material
  const materialBatches = batches.filter((b) => b.material_id === material.id);
  const sumBatches = materialBatches.reduce((acc, b) => {
    if (!Number.isFinite(b.current_quantity) || b.current_quantity < 0) {
      errors.push(`Batch ${b.id} has negative current_quantity: ${b.current_quantity}`);
    }
    return acc + b.current_quantity;
  }, 0);

  // Precision rounding to avoid floating point drift
  const round = (num: number) => Math.round(num * 1000) / 1000;

  if (round(sumBatches) !== round(material.current_quantity)) {
    errors.push(
      `Material ${material.id} ON-HAND sum mismatch: material.current_quantity is ${material.current_quantity}, but sum of batches is ${sumBatches}`,
    );
  }

  for (const position of positions) {
    if (position.material_id === material.id && !materialBatches.some((batch) => batch.id === position.batch_id)) {
      errors.push(`Position ${position.id} references an unknown batch ${position.batch_id}`);
    }
    if (materialBatches.some((batch) => batch.id === position.batch_id) && position.material_id !== material.id) {
      errors.push(`Position ${position.id} belongs to a different material`);
    }
  }

  // Check each batch matches sum of its positions
  for (const batch of materialBatches) {
    const batchPositions = positions.filter((p) => p.batch_id === batch.id && p.material_id === material.id);
    const sumPositions = batchPositions.reduce((acc, p) => {
      if (!Number.isFinite(p.quantity) || p.quantity < 0) {
        errors.push(`Position ${p.id} has negative quantity: ${p.quantity}`);
      }
      return acc + p.quantity;
    }, 0);

    if (round(sumPositions) !== round(batch.current_quantity)) {
      errors.push(
        `Batch ${batch.id} position sum mismatch: batch.current_quantity is ${batch.current_quantity}, but sum of positions is ${sumPositions}`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
