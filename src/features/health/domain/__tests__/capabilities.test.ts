/**
 * Health Capabilities Tests
 *
 * Tests for capability definitions:
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §32 (Authorization Architecture)
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §39 (Permissions and Visibility)
 */
import { describe, expect, it } from "vitest";
import {
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
  LEGACY_TO_GRANULAR,
  type HealthCapability,
} from "@/features/health/domain/capabilities";

describe("Health Capabilities", () => {
  describe("HealthCapability type", () => {
    it("has health.read as core read capability", () => {
      const caps = Object.keys(CAPABILITY_GROUPS) as HealthCapability[];
      expect(caps).toContain("health.read");
    });

    it("has canonical record capabilities", () => {
      const caps = Object.keys(CAPABILITY_GROUPS) as HealthCapability[];
      expect(caps).toContain("health.record_routine");
      expect(caps).toContain("health.record_preventive");
      expect(caps).toContain("health.record_incident");
      expect(caps).toContain("health.record_clinical_document");
    });

    it("has canonical exam capabilities", () => {
      const caps = Object.keys(CAPABILITY_GROUPS) as HealthCapability[];
      expect(caps).toContain("health.request_exam");
      expect(caps).toContain("health.interpret_exam");
    });

    it("has canonical treatment capabilities", () => {
      const caps = Object.keys(CAPABILITY_GROUPS) as HealthCapability[];
      expect(caps).toContain("health.create_treatment");
      expect(caps).toContain("health.complete_treatment");
      expect(caps).toContain("health.administer_dose");
    });

    it("has canonical restriction capabilities", () => {
      const caps = Object.keys(CAPABILITY_GROUPS) as HealthCapability[];
      expect(caps).toContain("health.issue_restriction");
      expect(caps).toContain("health.release_restriction");
    });

    it("has canonical case lifecycle capabilities", () => {
      const caps = Object.keys(CAPABILITY_GROUPS) as HealthCapability[];
      expect(caps).toContain("health.discharge_case");
      expect(caps).toContain("health.reopen_case");
      expect(caps).toContain("health.cancel_case");
    });

    it("has canonical schedule capabilities", () => {
      const caps = Object.keys(CAPABILITY_GROUPS) as HealthCapability[];
      expect(caps).toContain("health.schedule_item");
      expect(caps).toContain("health.manage_schedule");
    });

    it("has canonical record correction capabilities", () => {
      const caps = Object.keys(CAPABILITY_GROUPS) as HealthCapability[];
      expect(caps).toContain("health.cancel_record");
      expect(caps).toContain("health.amend_record");
    });

    it("has nutrition capability", () => {
      const caps = Object.keys(CAPABILITY_GROUPS) as HealthCapability[];
      expect(caps).toContain("health.manage_nutrition_plan");
    });

    it("has audit capability", () => {
      const caps = Object.keys(CAPABILITY_GROUPS) as HealthCapability[];
      expect(caps).toContain("health.audit");
    });

    it("has total of 21 canonical capabilities for HW-2 Foundation", () => {
      const caps = Object.keys(CAPABILITY_GROUPS) as HealthCapability[];
      expect(caps).toHaveLength(21);
    });
  });

  describe("CAPABILITY_GROUPS", () => {
    it("has groups for all capabilities", () => {
      Object.entries(CAPABILITY_GROUPS).forEach(([capability, group]) => {
        expect(capability.startsWith("health.")).toBe(true);
        expect(group).toBeDefined();
        expect(["read", "record", "clinical", "exams", "treatments", "restrictions", "schedule", "nutrition", "audit"]).toContain(group);
      });
    });

    it("has read capability in read group", () => {
      const readCaps = Object.entries(CAPABILITY_GROUPS)
        .filter(([, group]) => group === "read")
        .map(([cap]) => cap as HealthCapability);

      expect(readCaps).toContain("health.read");
    });

    it("has record capabilities in record group", () => {
      const recordCaps = Object.entries(CAPABILITY_GROUPS)
        .filter(([, group]) => group === "record")
        .map(([cap]) => cap as HealthCapability);

      expect(recordCaps).toContain("health.record_routine");
      expect(recordCaps).toContain("health.record_preventive");
      expect(recordCaps).toContain("health.record_incident");
      expect(recordCaps).toContain("health.record_clinical_document");
      expect(recordCaps).toContain("health.cancel_record");
      expect(recordCaps).toContain("health.amend_record");
    });

    it("has schedule capabilities in schedule group", () => {
      const scheduleCaps = Object.entries(CAPABILITY_GROUPS)
        .filter(([, group]) => group === "schedule")
        .map(([cap]) => cap as HealthCapability);

      expect(scheduleCaps).toContain("health.schedule_item");
      expect(scheduleCaps).toContain("health.manage_schedule");
    });

    it("has clinical capabilities in clinical group", () => {
      const clinicalCaps = Object.entries(CAPABILITY_GROUPS)
        .filter(([, group]) => group === "clinical")
        .map(([cap]) => cap as HealthCapability);

      expect(clinicalCaps).toContain("health.discharge_case");
      expect(clinicalCaps).toContain("health.reopen_case");
      expect(clinicalCaps).toContain("health.cancel_case");
    });

    it("has nutrition capability in nutrition group", () => {
      const nutritionCaps = Object.entries(CAPABILITY_GROUPS)
        .filter(([, group]) => group === "nutrition")
        .map(([cap]) => cap as HealthCapability);

      expect(nutritionCaps).toContain("health.manage_nutrition_plan");
    });

    it("has audit capability in audit group", () => {
      const auditCaps = Object.entries(CAPABILITY_GROUPS)
        .filter(([, group]) => group === "audit")
        .map(([cap]) => cap as HealthCapability);

      expect(auditCaps).toContain("health.audit");
    });
  });

  describe("CAPABILITY_LABELS", () => {
    it("has labels for all capabilities", () => {
      Object.entries(CAPABILITY_GROUPS).forEach(([capability]) => {
        expect(CAPABILITY_LABELS[capability as HealthCapability]).toBeDefined();
        expect(typeof CAPABILITY_LABELS[capability as HealthCapability]).toBe("string");
      });
    });

    it("has non-empty labels", () => {
      Object.values(CAPABILITY_LABELS).forEach((label) => {
        expect(label.length).toBeGreaterThan(0);
      });
    });

    it("has descriptive labels", () => {
      expect(CAPABILITY_LABELS["health.read"]).toContain("Saúde");
      expect(CAPABILITY_LABELS["health.manage_nutrition_plan"]).toContain("Planos Alimentares");
    });
  });

  describe("LEGACY_TO_GRANULAR", () => {
    it("has all legacy keys defined", () => {
      expect(LEGACY_TO_GRANULAR["health.view"]).toBeDefined();
      expect(LEGACY_TO_GRANULAR["health.create"]).toBeDefined();
      expect(LEGACY_TO_GRANULAR["health.edit"]).toBeDefined();
      expect(LEGACY_TO_GRANULAR["health.archive"]).toBeDefined();
      expect(LEGACY_TO_GRANULAR["health.approve"]).toBeDefined();
      expect(LEGACY_TO_GRANULAR["health.export"]).toBeDefined();
      expect(LEGACY_TO_GRANULAR["health.audit"]).toBeDefined();
    });

    it("LEGACY ADAPTER: health.view maps to health.read (read-only)", () => {
      const viewCaps = LEGACY_TO_GRANULAR["health.view"];
      expect(viewCaps).toContain("health.read");
      expect(viewCaps).toHaveLength(1); // Only health.read
    });

    it("LEGACY ADAPTER: write actions map to empty (fail-closed)", () => {
      // Write actions require explicit capability grant
      // Legacy adapter does NOT grant write capabilities
      expect(LEGACY_TO_GRANULAR["health.create"]).toHaveLength(0);
      expect(LEGACY_TO_GRANULAR["health.edit"]).toHaveLength(0);
      expect(LEGACY_TO_GRANULAR["health.archive"]).toHaveLength(0);
      expect(LEGACY_TO_GRANULAR["health.approve"]).toHaveLength(0);
      expect(LEGACY_TO_GRANULAR["health.export"]).toHaveLength(0);
      expect(LEGACY_TO_GRANULAR["health.audit"]).toHaveLength(0);
    });

    it("has amend_record with correct semantic", () => {
      // amend_record means append-only correction/adendment, not direct edit
      const amendLabel = CAPABILITY_LABELS["health.amend_record"];
      expect(amendLabel).toContain("Correção");
      expect(amendLabel).toContain("Adendo");
      expect(amendLabel).toContain("Complemento");
    });
  });
});
