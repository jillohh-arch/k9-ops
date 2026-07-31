/**
 * Health Capabilities Tests
 *
 * Tests for capability definitions:
 * - HEALTH_WEB_BASELINE.md §14 (Granular Capabilities)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §24 (Authorization Architecture)
 */
import { describe, expect, it } from "vitest";
import {
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
  LEGACY_TO_GRANULAR,
  type HealthCapability,
} from "@/features/health/domain/capabilities";

describe("Health Capabilities", () => {
  describe("CAPABILITY_GROUPS", () => {
    it("has groups for all capabilities", () => {
      Object.entries(CAPABILITY_GROUPS).forEach(([capability, group]) => {
        expect(capability.startsWith("health.")).toBe(true);
        expect(group).toBeDefined();
        expect(["read", "schedule", "clinical", "restrictions", "treatments", "exams", "nutrition", "documents", "transcription", "export", "audit"]).toContain(group);
      });
    });

    it("has read capabilities in read group", () => {
      const readCaps = Object.entries(CAPABILITY_GROUPS)
        .filter(([, group]) => group === "read")
        .map(([cap]) => cap as HealthCapability);

      expect(readCaps).toContain("health.view_overview");
      expect(readCaps).toContain("health.view_readiness");
      expect(readCaps).toContain("health.view_schedule");
      expect(readCaps).toContain("health.view_clinical");
      expect(readCaps).toContain("health.view_nutrition");
      expect(readCaps).toContain("health.view_history");
      expect(readCaps).toContain("health.view_reports");
    });

    it("has schedule capabilities in schedule group", () => {
      const scheduleCaps = Object.entries(CAPABILITY_GROUPS)
        .filter(([, group]) => group === "schedule")
        .map(([cap]) => cap as HealthCapability);

      expect(scheduleCaps).toContain("health.manage_schedule");
      expect(scheduleCaps).toContain("health.manage_schedule_create");
    });

    it("has clinical capabilities in clinical group", () => {
      const clinicalCaps = Object.entries(CAPABILITY_GROUPS)
        .filter(([, group]) => group === "clinical")
        .map(([cap]) => cap as HealthCapability);

      expect(clinicalCaps).toContain("health.manage_clinical_case");
      expect(clinicalCaps).toContain("health.manage_clinical_case_open");
      expect(clinicalCaps).toContain("health.manage_clinical_case_close");
    });

    it("has nutrition capabilities in nutrition group", () => {
      const nutritionCaps = Object.entries(CAPABILITY_GROUPS)
        .filter(([, group]) => group === "nutrition")
        .map(([cap]) => cap as HealthCapability);

      expect(nutritionCaps).toContain("health.manage_nutrition_plan");
      expect(nutritionCaps).toContain("health.manage_nutrition_plan_create");
      expect(nutritionCaps).toContain("health.manage_nutrition_plan_update");
      expect(nutritionCaps).toContain("health.manage_nutrition_plan_replace");
      expect(nutritionCaps).toContain("health.manage_nutrition_plan_cancel");
    });

    it("has audit capabilities in audit group", () => {
      const auditCaps = Object.entries(CAPABILITY_GROUPS)
        .filter(([, group]) => group === "audit")
        .map(([cap]) => cap as HealthCapability);

      expect(auditCaps).toContain("health.audit_health");
      expect(auditCaps).toContain("health.audit_view_restricted");
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
      expect(CAPABILITY_LABELS["health.view_overview"]).toContain("Visão Geral");
      expect(CAPABILITY_LABELS["health.manage_nutrition_plan"]).toContain("Planos Alimentares");
      expect(CAPABILITY_LABELS["health.manage_clinical_case"]).toContain("Casos Clínicos");
    });
  });

  describe("LEGACY_TO_GRANULAR", () => {
    it("maps legacy permissions to granular capabilities", () => {
      expect(LEGACY_TO_GRANULAR["health.view"]).toBeDefined();
      expect(LEGACY_TO_GRANULAR["health.create"]).toBeDefined();
      expect(LEGACY_TO_GRANULAR["health.edit"]).toBeDefined();
      expect(LEGACY_TO_GRANULAR["health.export"]).toBeDefined();
      expect(LEGACY_TO_GRANULAR["health.audit"]).toBeDefined();
    });

    it("maps health.view to read capabilities", () => {
      const viewCaps = LEGACY_TO_GRANULAR["health.view"];
      expect(viewCaps).toContain("health.view_overview");
      expect(viewCaps).toContain("health.view_readiness");
      expect(viewCaps).toContain("health.view_schedule");
      expect(viewCaps).toContain("health.view_clinical");
    });

    it("maps health.create to create capabilities", () => {
      const createCaps = LEGACY_TO_GRANULAR["health.create"];
      expect(createCaps).toContain("health.manage_schedule_create");
      expect(createCaps).toContain("health.manage_clinical_case_open");
      expect(createCaps).toContain("health.manage_nutrition_plan_create");
    });

    it("maps health.edit to update capabilities", () => {
      const editCaps = LEGACY_TO_GRANULAR["health.edit"];
      expect(editCaps).toContain("health.manage_schedule_update");
      expect(editCaps).toContain("health.manage_nutrition_plan_update");
    });

    it("maps health.approve to close capabilities", () => {
      const approveCaps = LEGACY_TO_GRANULAR["health.approve"];
      expect(approveCaps).toContain("health.manage_clinical_case_close");
      expect(approveCaps).toContain("health.manage_restriction_close");
    });

    it("has audit for health.audit legacy", () => {
      const auditCaps = LEGACY_TO_GRANULAR["health.audit"];
      expect(auditCaps).toContain("health.audit_health");
    });
  });
});
