import { describe, expect, it } from "vitest";
import { createFixedBusinessClock, isBatchExpired } from "./business-clock";
import { calculateMaterialAvailable, deriveDeterministicPositionId, getMaterialStockState, verifyConservationInvariants } from "./projections";
import { validateBatchPayload, validateInventoryCountPayload, validateMovementCommon, validateTransferPayload } from "./validation";

const material = { id: "m", current_quantity: 12 };
const batches = [
  { id: "b1", material_id: "m", status: "active" as const, current_quantity: 5, expiration_date: "2026-10-05" },
  { id: "b2", material_id: "m", status: "blocked" as const, current_quantity: 4, expiration_date: "2026-10-10" },
  { id: "b3", material_id: "m", status: "active" as const, current_quantity: 3, expiration_date: "2026-10-04" },
];
const positions = batches.map((batch) => ({ id: deriveDeterministicPositionId("m", batch.id, "loc"), material_id: "m", batch_id: batch.id, quantity: batch.current_quantity }));

describe("F60 stock foundation", () => {
  it("conserves physical ON-HAND across material, batches and positions while AVAILABLE excludes blocked and expired", () => {
    expect(verifyConservationInvariants(material, batches, positions)).toEqual({ valid: true, errors: [] });
    expect(calculateMaterialAvailable(batches, "2026-10-05")).toBe(5);
    expect(getMaterialStockState(5, 5)).toBe("low_stock");
    expect(getMaterialStockState(0, 0)).toBe("out_of_stock");
  });

  it("rejects mismatched, orphan, cross-material, negative and nonfinite position quantities", () => {
    for (const modified of [
      positions.slice(1),
      [...positions, { id: "orphan", batch_id: "missing", material_id: "m", quantity: 1 }],
      [{ ...positions[0], material_id: "other" }, ...positions.slice(1)],
      [{ ...positions[0], quantity: -1 }, ...positions.slice(1)],
      [{ ...positions[0], quantity: Number.NaN }, ...positions.slice(1)],
    ]) {
      expect(verifyConservationInvariants(material, batches, modified).valid).toBe(false);
    }
  });

  it("uses São Paulo business date at UTC midnight and retains expiry-day eligibility", () => {
    expect(createFixedBusinessClock(new Date("2026-10-06T02:59:59Z")).today()).toBe("2026-10-05");
    expect(createFixedBusinessClock(new Date("2026-10-06T03:00:00Z")).today()).toBe("2026-10-06");
    expect(isBatchExpired("2026-10-05", "2026-10-05")).toBe(false);
    expect(calculateMaterialAvailable(batches, "2026-10-06")).toBe(0);
  });

  it("validates dates, finite quantities, distinct transfer locations and count discrepancy", () => {
    expect(validateBatchPayload({ material_id: "m", lot_number: "L", initial_quantity: Infinity, expiration_date: "2026-02-30" })).toHaveProperty("initial_quantity");
    expect(validateBatchPayload({ material_id: "m", lot_number: "L", initial_quantity: 2, expiration_date: "2026-02-30" })).toHaveProperty("expiration_date");
    expect(validateMovementCommon({ material_id: "m", batch_id: "b", quantity: Infinity, reason: "R", type: "entry" })).toHaveProperty("quantity");
    expect(validateTransferPayload({ material_id: "m", batch_id: "b", quantity: 1, reason: "R", origin_location_id: "loc", destination_location_id: "loc" })).toHaveProperty("destination_location_id");
    expect(validateInventoryCountPayload({ stock_position_id: "p", expected_quantity: 2, counted_quantity: 3 })).toHaveProperty("discrepancy_reason");
  });
});
