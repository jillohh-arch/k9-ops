import { describe, expect, it } from "vitest";
import {
  allocateFefo,
  sortBatchesByFefo,
  suggestFefoBatch,
  validateFefoOverride,
} from "./fefo";
import { StockBatch, StockPosition } from "./contracts";
import { isBatchExpired } from "./business-clock";

describe("FEFO Domain Engine", () => {
  const mockBatches: StockBatch[] = [
    {
      id: "b-far",
      material_id: "mat-1",
      material_name: "Ração Premier",
      lot_number: "LT-FAR",
      initial_quantity: 10,
      current_quantity: 10,
      expiration_date: "2026-12-01",
      received_at: new Date("2026-01-01"),
      status: "active",
    },
    {
      id: "b-soon",
      material_id: "mat-1",
      material_name: "Ração Premier",
      lot_number: "LT-SOON",
      initial_quantity: 5,
      current_quantity: 5,
      expiration_date: "2026-10-15",
      received_at: new Date("2026-01-02"),
      status: "active",
    },
    {
      id: "b-expired",
      material_id: "mat-1",
      material_name: "Ração Premier",
      lot_number: "LT-EXP",
      initial_quantity: 4,
      current_quantity: 4,
      expiration_date: "2026-10-01",
      received_at: new Date("2025-10-01"),
      status: "active",
    },
    {
      id: "b-blocked",
      material_id: "mat-1",
      material_name: "Ração Premier",
      lot_number: "LT-BLK",
      initial_quantity: 8,
      current_quantity: 8,
      expiration_date: "2026-10-10",
      received_at: new Date("2026-01-01"),
      status: "blocked",
    },
    {
      id: "b-depleted",
      material_id: "mat-1",
      material_name: "Ração Premier",
      lot_number: "LT-DEP",
      initial_quantity: 10,
      current_quantity: 0,
      expiration_date: "2026-10-08",
      received_at: new Date("2026-01-01"),
      status: "depleted",
    },
  ];

  const today = "2026-10-06";

  it("sorts batches ascending by expiration_date excluding expired, blocked and depleted", () => {
    const sorted = sortBatchesByFefo(mockBatches, today);
    // b-expired (2026-10-01 < today) is excluded
    // b-blocked is excluded
    // b-depleted is excluded
    expect(sorted.map((b) => b.id)).toEqual(["b-soon", "b-far"]);
  });

  it("suggests the batch with nearest expiration eligible at location", () => {
    const suggested = suggestFefoBatch(mockBatches, today);
    expect(suggested?.id).toBe("b-soon");

    // Location constraint
    const positions: StockPosition[] = [
      {
        id: "p1",
        material_id: "mat-1",
        batch_id: "b-far",
        lot_number: "LT-FAR",
        location_id: "loc-vtr",
        location_name: "Viatura 01",
        quantity: 3,
        unit: "kg",
        updated_at: new Date(),
        schema_version: 1,
      },
    ];

    // At loc-vtr, only b-far is present
    const suggestedAtLoc = suggestFefoBatch(mockBatches, today, {
      locationId: "loc-vtr",
      positions,
    });
    expect(suggestedAtLoc?.id).toBe("b-far");
  });

  it("calculates deterministic multi-batch allocation when quantity exceeds first batch", () => {
    // b-soon has 5, b-far has 10. Request 7.
    const result = allocateFefo({
      batches: mockBatches,
      requestedQuantity: 7,
      businessToday: today,
    });

    expect(result.fulfilled).toBe(true);
    expect(result.allocatedTotal).toBe(7);
    expect(result.remainingQuantity).toBe(0);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]).toMatchObject({
      batchId: "b-soon",
      allocatedQuantity: 5,
    });
    expect(result.allocations[1]).toMatchObject({
      batchId: "b-far",
      allocatedQuantity: 2,
    });
  });

  it("indicates unfulfilled allocation if total eligible stock is insufficient", () => {
    // Total eligible is 5 + 10 = 15. Request 20.
    const result = allocateFefo({
      batches: mockBatches,
      requestedQuantity: 20,
      businessToday: today,
    });

    expect(result.fulfilled).toBe(false);
    expect(result.allocatedTotal).toBe(15);
    expect(result.remainingQuantity).toBe(5);
  });

  it("validates FEFO override requiring a non-empty justification", () => {
    // Same as recommendation: valid without justification
    expect(
      validateFefoOverride({
        selectedBatchId: "b-soon",
        recommendedBatchId: "b-soon",
      }),
    ).toEqual({ valid: true });

    // Different batch without justification: invalid
    const invalidEmpty = validateFefoOverride({
      selectedBatchId: "b-far",
      recommendedBatchId: "b-soon",
      overrideReason: "",
    });
    expect(invalidEmpty.valid).toBe(false);
    expect(invalidEmpty.error).toBeDefined();

    // Too short justification: invalid
    const invalidShort = validateFefoOverride({
      selectedBatchId: "b-far",
      recommendedBatchId: "b-soon",
      overrideReason: "abc",
    });
    expect(invalidShort.valid).toBe(false);

    // Valid justification
    const validWithReason = validateFefoOverride({
      selectedBatchId: "b-far",
      recommendedBatchId: "b-soon",
      overrideReason: "Reserva operacional para instrução",
    });
    expect(validWithReason.valid).toBe(true);
  });

  describe("Temporal Expiration Boundaries (Phase 15)", () => {
    it("strictly validates yesterday, today and tomorrow expiration boundaries", () => {
      // Ontem: vencido
      expect(isBatchExpired("2026-10-05", today)).toBe(true);
      // Hoje: VÁLIDO o dia todo (isBatchExpired === false)
      expect(isBatchExpired("2026-10-06", today)).toBe(false);
      // Amanhã: VÁLIDO
      expect(isBatchExpired("2026-10-07", today)).toBe(false);
    });
  });
});
