import { describe, expect, it } from "vitest";
import {
  CANONICAL_CUSTODY_PURPOSES,
  CANONICAL_CUSTODY_STATUSES,
  CANONICAL_EQUIPMENT_CONDITIONS,
  CANONICAL_EQUIPMENT_STATUSES,
  deriveCustodyDueState,
  isCustodyOverdue,
  validateConditionStatusConsistency,
} from "./custody";
import {
  validateEquipmentPayload,
  validateOpenCustodyPayload,
  validateReturnCustodyPayload,
} from "./validation";

describe("Equipment & Custody Domain Rules (F60)", () => {
  describe("Canonical Constants", () => {
    it("preserves canonical statuses without decommissioned", () => {
      expect(CANONICAL_EQUIPMENT_STATUSES).toEqual([
        "available",
        "in_custody",
        "maintenance",
        "damaged",
        "retired",
      ]);
      expect(CANONICAL_EQUIPMENT_STATUSES).not.toContain("decommissioned");
    });

    it("defines canonical conditions", () => {
      expect(CANONICAL_EQUIPMENT_CONDITIONS).toEqual(["new", "good", "fair", "damaged"]);
    });

    it("defines canonical custody purposes and statuses", () => {
      expect(CANONICAL_CUSTODY_PURPOSES).toEqual([
        "daily_duty",
        "training",
        "operation",
        "permanent_assignment",
      ]);
      expect(CANONICAL_CUSTODY_STATUSES).toEqual(["active", "returned", "cancelled"]);
    });
  });

  describe("deriveCustodyDueState & isCustodyOverdue", () => {
    // Reference instant: 2026-10-06T15:00:00-03:00 (18:00 UTC) -> SP date 2026-10-06
    const now = new Date("2026-10-06T18:00:00Z");

    it("marks active custody as overdue when now > expected_return_at", () => {
      const past = new Date("2026-10-06T17:59:59Z");
      const custody = { status: "active" as const, expected_return_at: past };
      expect(isCustodyOverdue(custody, now)).toBe(true);
      expect(deriveCustodyDueState(custody, now)).toBe("overdue");
    });

    it("marks active custody as due_today when expected_return_at is later today in São Paulo", () => {
      // 2026-10-06 20:00 UTC is 17:00 SP, same business day
      const laterToday = new Date("2026-10-06T20:00:00Z");
      const custody = { status: "active" as const, expected_return_at: laterToday };
      expect(isCustodyOverdue(custody, now)).toBe(false);
      expect(deriveCustodyDueState(custody, now)).toBe("due_today");
    });

    it("marks active custody as on_time when expected_return_at is in a future date", () => {
      // 2026-10-07 12:00 UTC
      const tomorrow = new Date("2026-10-07T12:00:00Z");
      const custody = { status: "active" as const, expected_return_at: tomorrow };
      expect(isCustodyOverdue(custody, now)).toBe(false);
      expect(deriveCustodyDueState(custody, now)).toBe("on_time");
    });

    it("returns on_time and false for overdue when custody has no expected_return_at", () => {
      const custody = { status: "active" as const, expected_return_at: null };
      expect(isCustodyOverdue(custody, now)).toBe(false);
      expect(deriveCustodyDueState(custody, now)).toBe("on_time");
    });

    it("returns on_time and false for overdue when custody is returned or cancelled, even if past", () => {
      const past = new Date("2026-10-05T12:00:00Z");
      expect(isCustodyOverdue({ status: "returned", expected_return_at: past }, now)).toBe(false);
      expect(deriveCustodyDueState({ status: "returned", expected_return_at: past }, now)).toBe("on_time");

      expect(isCustodyOverdue({ status: "cancelled", expected_return_at: past }, now)).toBe(false);
      expect(deriveCustodyDueState({ status: "cancelled", expected_return_at: past }, now)).toBe("on_time");
    });
  });

  describe("validateConditionStatusConsistency", () => {
    it("disallows damaged condition with available status", () => {
      const result = validateConditionStatusConsistency("damaged", "available");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("danificado não pode estar com status 'disponível'");
    });

    it("allows damaged condition with maintenance, damaged, or retired status", () => {
      expect(validateConditionStatusConsistency("damaged", "maintenance").valid).toBe(true);
      expect(validateConditionStatusConsistency("damaged", "damaged").valid).toBe(true);
      expect(validateConditionStatusConsistency("damaged", "retired").valid).toBe(true);
    });

    it("requires active custody when status is in_custody", () => {
      const invalid = validateConditionStatusConsistency("good", "in_custody", { hasActiveCustody: false });
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain("só pode estar com status 'em cautela' se houver uma cautela ativa");

      const valid = validateConditionStatusConsistency("good", "in_custody", { hasActiveCustody: true });
      expect(valid.valid).toBe(true);
    });

    it("disallows active custody on retired equipment", () => {
      const result = validateConditionStatusConsistency("fair", "retired", { hasActiveCustody: true });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("baixado/aposentado não pode possuir cautela ativa");
    });

    it("validates healthy equipment with available status", () => {
      expect(validateConditionStatusConsistency("new", "available").valid).toBe(true);
      expect(validateConditionStatusConsistency("good", "available").valid).toBe(true);
      expect(validateConditionStatusConsistency("fair", "available").valid).toBe(true);
    });
  });

  describe("Validation Payloads for Equipment & Custody", () => {
    it("validateEquipmentPayload rejects slashes in identifier_code and requires core fields", () => {
      expect(
        validateEquipmentPayload({
          name: "Coleira K9",
          identifier_code: "EQP/2026",
          category_id: "cat-1",
          condition: "good",
          current_location_id: "loc-1",
        }),
      ).toHaveProperty("identifier_code");

      expect(
        validateEquipmentPayload({
          name: "Coleira K9",
          identifier_code: "EQP\\2026",
          category_id: "cat-1",
          condition: "good",
          current_location_id: "loc-1",
        }),
      ).toHaveProperty("identifier_code");

      expect(
        validateEquipmentPayload({
          name: "",
          identifier_code: "",
          category_id: "",
          condition: "unknown",
          current_location_id: "",
        }),
      ).toEqual({
        name: expect.any(String),
        identifier_code: expect.any(String),
        category_id: expect.any(String),
        condition: expect.any(String),
        current_location_id: expect.any(String),
      });

      expect(
        validateEquipmentPayload({
          name: "Guia Longa 10m",
          identifier_code: "EQP-GL-001",
          category_id: "cat-equip",
          condition: "good",
          current_location_id: "loc-almox",
        }),
      ).toEqual({});
    });

    it("validateOpenCustodyPayload validates required borrower, equipment, purpose and date format", () => {
      expect(
        validateOpenCustodyPayload({
          equipment_id: "",
          borrower_ra: "",
          borrower_name: "",
          purpose: "invalid_purpose",
        }),
      ).toEqual({
        equipment_id: expect.any(String),
        borrower_ra: expect.any(String),
        borrower_name: expect.any(String),
        purpose: expect.any(String),
      });

      expect(
        validateOpenCustodyPayload({
          equipment_id: "eq-1",
          borrower_ra: "12345",
          borrower_name: "Sd Silva",
          purpose: "daily_duty",
          expected_return_at: "not-a-date",
        }),
      ).toHaveProperty("expected_return_at");

      expect(
        validateOpenCustodyPayload({
          equipment_id: "eq-1",
          borrower_ra: "12345",
          borrower_name: "Sd Silva",
          purpose: "daily_duty",
          expected_return_at: "2026-10-06T20:00:00Z",
        }),
      ).toEqual({});
    });

    it("validateReturnCustodyPayload requires notes for damaged condition and checks target_equipment_status compatibility", () => {
      expect(
        validateReturnCustodyPayload({
          custody_id: "c-1",
          condition_at_return: "damaged",
          return_notes: "",
        }),
      ).toHaveProperty("return_notes");

      expect(
        validateReturnCustodyPayload({
          custody_id: "c-1",
          condition_at_return: "damaged",
          return_notes: "Mosquetão quebrado",
          target_equipment_status: "available",
        }),
      ).toHaveProperty("target_equipment_status");

      expect(
        validateReturnCustodyPayload({
          custody_id: "c-1",
          condition_at_return: "good",
          target_equipment_status: "retired",
        }),
      ).toHaveProperty("target_equipment_status");

      expect(
        validateReturnCustodyPayload({
          custody_id: "c-1",
          condition_at_return: "damaged",
          return_notes: "Mosquetão quebrado",
          target_equipment_status: "maintenance",
        }),
      ).toEqual({});

      expect(
        validateReturnCustodyPayload({
          custody_id: "c-1",
          condition_at_return: "good",
          target_equipment_status: "available",
        }),
      ).toEqual({});
    });
  });

  describe("Temporal Custody Overdue Boundaries (Phase 15)", () => {
    const dueInstant = new Date("2026-10-06T15:00:00.000Z");

    it("verifies before due is not overdue", () => {
      const beforeInstant = new Date("2026-10-06T14:59:59.999Z");
      expect(isCustodyOverdue({ status: "active", expected_return_at: dueInstant }, beforeInstant)).toBe(false);
    });

    it("verifies exactly at expected_return_at is NOT overdue", () => {
      expect(isCustodyOverdue({ status: "active", expected_return_at: dueInstant }, dueInstant)).toBe(false);
    });

    it("verifies strictly after expected_return_at is overdue", () => {
      const afterInstant = new Date("2026-10-06T15:00:00.001Z");
      expect(isCustodyOverdue({ status: "active", expected_return_at: dueInstant }, afterInstant)).toBe(true);
    });
  });
});
