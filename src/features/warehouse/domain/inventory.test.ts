import { describe, expect, it } from "vitest";
import {
  calculateDiscrepancy,
  calculateInventoryProgress,
  deriveCountRowStatus,
  validateCountPayload,
  validateOpenInventoryPayload,
} from "./inventory";

describe("Physical Inventory Domain Logic", () => {
  describe("calculateDiscrepancy", () => {
    it("returns null if counted is null or undefined", () => {
      expect(calculateDiscrepancy(10, null)).toBeNull();
      expect(calculateDiscrepancy(10, undefined)).toBeNull();
    });

    it("calculates discrepancy rounded to 3 decimal places", () => {
      expect(calculateDiscrepancy(10, 10)).toBe(0);
      expect(calculateDiscrepancy(10, 8)).toBe(-2);
      expect(calculateDiscrepancy(10, 15)).toBe(5);
      expect(calculateDiscrepancy(10.123, 10.456)).toBe(0.333);
      expect(calculateDiscrepancy(10.1005, 10.1009)).toBe(0);
    });
  });

  describe("deriveCountRowStatus", () => {
    it("returns pending if counted_quantity is null or undefined", () => {
      expect(deriveCountRowStatus({ expected_quantity: 10, counted_quantity: null })).toBe("pending");
      expect(deriveCountRowStatus({ expected_quantity: 10, counted_quantity: undefined })).toBe("pending");
    });

    it("returns matching if diff is 0", () => {
      expect(deriveCountRowStatus({ expected_quantity: 10, counted_quantity: 10 })).toBe("matching");
      expect(deriveCountRowStatus({ expected_quantity: 10, counted_quantity: 10, discrepancy: 0 })).toBe("matching");
    });

    it("returns shortage if diff is negative", () => {
      expect(deriveCountRowStatus({ expected_quantity: 10, counted_quantity: 7 })).toBe("shortage");
      expect(deriveCountRowStatus({ expected_quantity: 10, counted_quantity: 8, discrepancy: -2 })).toBe("shortage");
    });

    it("returns surplus if diff is positive", () => {
      expect(deriveCountRowStatus({ expected_quantity: 10, counted_quantity: 13 })).toBe("surplus");
      expect(deriveCountRowStatus({ expected_quantity: 10, counted_quantity: 12, discrepancy: 2 })).toBe("surplus");
    });
  });

  describe("calculateInventoryProgress", () => {
    it("returns correct totals and breakdown", () => {
      const counts = [
        { expected_quantity: 10, counted_quantity: null }, // pending
        { expected_quantity: 5, counted_quantity: 5 }, // matching
        { expected_quantity: 20, counted_quantity: 15 }, // shortage (divergent)
        { expected_quantity: 8, counted_quantity: 12 }, // surplus (divergent)
      ];

      const progress = calculateInventoryProgress(counts);
      expect(progress).toEqual({
        total: 4,
        counted: 3,
        pending: 1,
        matching: 1,
        divergent: 2,
      });
    });

    it("Case 1 (Partial Count): 5 positions, 3 counted, 2 pending, 1 divergence -> total 5, counted 3, pending 2, divergent 1", () => {
      const counts = [
        { expected_quantity: 20, counted_quantity: 20 }, // counted, matching
        { expected_quantity: 10, counted_quantity: 10 }, // counted, matching
        { expected_quantity: 5, counted_quantity: 0 },  // counted zero, divergent
        { expected_quantity: 8, counted_quantity: null }, // pending
        { expected_quantity: 12, counted_quantity: null }, // pending
      ];

      const progress = calculateInventoryProgress(counts);
      expect(progress).toEqual({
        total: 5,
        counted: 3,
        pending: 2,
        matching: 2,
        divergent: 1,
      });
    });

    it("Case 2 (Complete Count): 5 positions, 5 counted, 0 pending, 1 divergence -> total 5, counted 5, pending 0, divergent 1", () => {
      const counts = [
        { expected_quantity: 20, counted_quantity: 20 }, // matching
        { expected_quantity: 10, counted_quantity: 10 }, // matching
        { expected_quantity: 5, counted_quantity: 0 },  // counted zero, divergent
        { expected_quantity: 8, counted_quantity: 8 },  // matching
        { expected_quantity: 12, counted_quantity: 12 }, // matching
      ];

      const progress = calculateInventoryProgress(counts);
      expect(progress).toEqual({
        total: 5,
        counted: 5,
        pending: 0,
        matching: 4,
        divergent: 1,
      });
    });

    it("Case 3 (Counted Zero vs Uncounted): counted_quantity: 0 is distinct from null/undefined (pending)", () => {
      const countedZero = { expected_quantity: 5, counted_quantity: 0 };
      const uncountedNull = { expected_quantity: 5, counted_quantity: null };
      const uncountedUndefined = { expected_quantity: 5, counted_quantity: undefined };

      expect(deriveCountRowStatus(countedZero)).toBe("shortage");
      expect(deriveCountRowStatus(uncountedNull)).toBe("pending");
      expect(deriveCountRowStatus(uncountedUndefined)).toBe("pending");

      const progress = calculateInventoryProgress([countedZero, uncountedNull, uncountedUndefined]);
      expect(progress.counted).toBe(1);
      expect(progress.pending).toBe(2);
      expect(progress.divergent).toBe(1);
    });

    it("handles empty counts array", () => {
      expect(calculateInventoryProgress([])).toEqual({
        total: 0,
        counted: 0,
        pending: 0,
        matching: 0,
        divergent: 0,
      });
    });
  });

  describe("validateCountPayload", () => {
    it("rejects invalid, negative, or missing counted_quantity", () => {
      expect(validateCountPayload({})).toHaveProperty("counted_quantity");
      expect(validateCountPayload({ counted_quantity: -1 })).toHaveProperty("counted_quantity");
      expect(validateCountPayload({ counted_quantity: "5" as unknown as number })).toHaveProperty("counted_quantity");
      expect(validateCountPayload({ counted_quantity: NaN })).toHaveProperty("counted_quantity");
    });

    it("accepts counted_quantity 0 without error when expected is 0", () => {
      expect(validateCountPayload({ expected_quantity: 0, counted_quantity: 0 })).toEqual({});
    });

    it("requires discrepancy_reason when counted diverges from expected", () => {
      const errors = validateCountPayload({ expected_quantity: 10, counted_quantity: 5 });
      expect(errors).toHaveProperty("discrepancy_reason");

      const valid = validateCountPayload({
        expected_quantity: 10,
        counted_quantity: 5,
        discrepancy_reason: "Avaria no armazenamento",
      });
      expect(valid).toEqual({});
    });

    it("allows matching count without discrepancy_reason", () => {
      const errors = validateCountPayload({ expected_quantity: 10, counted_quantity: 10 });
      expect(errors).toEqual({});
    });
  });

  describe("validateOpenInventoryPayload", () => {
    it("requires non-empty title", () => {
      expect(validateOpenInventoryPayload({ scope_type: "full_warehouse" })).toHaveProperty("title");
      expect(validateOpenInventoryPayload({ title: "  ", scope_type: "full_warehouse" })).toHaveProperty("title");
    });

    it("validates scope_type", () => {
      expect(validateOpenInventoryPayload({ title: "Inv 1", scope_type: "invalid" as unknown as "full_warehouse" })).toHaveProperty("scope_type");
    });

    it("requires scope_ref_id for by_location and by_category", () => {
      expect(validateOpenInventoryPayload({ title: "Inv Loc", scope_type: "by_location" })).toHaveProperty("scope_ref_id");
      expect(validateOpenInventoryPayload({ title: "Inv Cat", scope_type: "by_category" })).toHaveProperty("scope_ref_id");

      expect(
        validateOpenInventoryPayload({
          title: "Inv Loc",
          scope_type: "by_location",
          scope_ref_id: "loc_123",
        }),
      ).toEqual({});

      expect(
        validateOpenInventoryPayload({
          title: "Inv Cat",
          scope_type: "by_category",
          scope_ref_id: "cat_456",
        }),
      ).toEqual({});
    });

    it("allows full_warehouse without scope_ref_id", () => {
      expect(
        validateOpenInventoryPayload({
          title: "Geral Q4",
          scope_type: "full_warehouse",
        }),
      ).toEqual({});
    });
  });
});
