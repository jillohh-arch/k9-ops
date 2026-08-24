/**
 * Health Routes Tests
 *
 * Tests for the route definitions:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §9 (Route Map)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §11 (Route Architecture)
 *
 * HW-2 Official Routes:
 * /health, /health/readiness, /health/schedule, /health/clinical,
 * /health/nutrition, /health/history, /health/reports
 *
 * NOTE: /health/audit and /health/documents removed from HW-2 (no documentary justification)
 */
import { describe, expect, it } from "vitest";
import {
  paths,
  HEALTH_NAV_ITEMS,
  isHealthRoute,
  getHealthNavKey,
} from "@/features/health/domain/paths";

describe("Health Routes", () => {
  describe("paths — HW-2 Official Routes", () => {
    it("has health module root", () => {
      expect(paths.health).toBe("/health");
    });

    it("has readiness routes", () => {
      expect(paths.health_readiness).toBe("/health/readiness");
      expect(paths.health_readiness_dog("dog-123")).toBe("/health/readiness/dog-123");
      expect(paths.health_readiness_dog("dog with spaces")).toBe("/health/readiness/dog%20with%20spaces");
    });

    it("has schedule routes", () => {
      expect(paths.health_schedule).toBe("/health/schedule");
      expect(paths.health_schedule_dog("dog-123")).toBe("/health/schedule/dogs/dog-123");
    });

    it("has clinical routes", () => {
      expect(paths.health_clinical).toBe("/health/clinical");
      expect(paths.health_clinical_case("case-123")).toBe("/health/clinical/case-123");
      expect(paths.health_clinical_dog("dog-123")).toBe("/health/clinical/dogs/dog-123");
    });

    it("has nutrition routes", () => {
      expect(paths.health_nutrition).toBe("/health/nutrition");
      expect(paths.health_nutrition_dog("dog-123")).toBe("/health/nutrition/dogs/dog-123");
    });

    it("has history routes", () => {
      expect(paths.health_history).toBe("/health/history");
      expect(paths.health_history_dog("dog-123")).toBe("/health/history/dogs/dog-123");
    });

    it("has reports routes", () => {
      expect(paths.health_reports).toBe("/health/reports");
    });

    it("does NOT have audit routes in HW-2", () => {
      // /health/audit removed — no documentary justification
      expect((paths as Record<string, unknown>).health_audit).toBeUndefined();
    });
  });

  describe("HEALTH_NAV_ITEMS", () => {
    it("has 7 navigation items", () => {
      expect(HEALTH_NAV_ITEMS).toHaveLength(7);
    });

    it("has correct nav item keys", () => {
      const keys = HEALTH_NAV_ITEMS.map((item) => item.key);
      expect(keys).toContain("overview");
      expect(keys).toContain("readiness");
      expect(keys).toContain("schedule");
      expect(keys).toContain("clinical");
      expect(keys).toContain("nutrition");
      expect(keys).toContain("history");
      expect(keys).toContain("reports");
    });

    it("does NOT have audit in nav items", () => {
      const keys = HEALTH_NAV_ITEMS.map((item) => item.key);
      expect(keys).not.toContain("audit");
    });

    it("has labels for all nav items", () => {
      HEALTH_NAV_ITEMS.forEach((item) => {
        expect(item.label).toBeDefined();
        expect(item.label.length).toBeGreaterThan(0);
      });
    });

    it("has valid hrefs for all nav items", () => {
      HEALTH_NAV_ITEMS.forEach((item) => {
        expect(item.href).toBeDefined();
        expect(item.href.startsWith("/health")).toBe(true);
      });
    });
  });

  describe("isHealthRoute", () => {
    it("returns true for health routes", () => {
      expect(isHealthRoute("/health")).toBe(true);
      expect(isHealthRoute("/health/readiness")).toBe(true);
      expect(isHealthRoute("/health/schedule/dogs/dog-123")).toBe(true);
      expect(isHealthRoute("/health/clinical/case-123")).toBe(true);
    });

    it("returns false for non-health routes", () => {
      expect(isHealthRoute("/")).toBe(false);
      expect(isHealthRoute("/k9")).toBe(false);
      expect(isHealthRoute("/k9/dog-123")).toBe(false);
      expect(isHealthRoute("/dashboard")).toBe(false);
    });
  });

  describe("getHealthNavKey", () => {
    it("returns correct nav key for exact matches", () => {
      expect(getHealthNavKey("/health")).toBe("overview");
      expect(getHealthNavKey("/health/readiness")).toBe("readiness");
      expect(getHealthNavKey("/health/schedule")).toBe("schedule");
      expect(getHealthNavKey("/health/clinical")).toBe("clinical");
      expect(getHealthNavKey("/health/nutrition")).toBe("nutrition");
      expect(getHealthNavKey("/health/history")).toBe("history");
      expect(getHealthNavKey("/health/reports")).toBe("reports");
    });

    it("returns correct nav key for sub-routes", () => {
      expect(getHealthNavKey("/health/readiness/dog-123")).toBe("readiness");
      expect(getHealthNavKey("/health/schedule/dogs/dog-123")).toBe("schedule");
      expect(getHealthNavKey("/health/clinical/case-123")).toBe("clinical");
      expect(getHealthNavKey("/health/nutrition/dogs/dog-123")).toBe("nutrition");
      expect(getHealthNavKey("/health/history/dogs/dog-123")).toBe("history");
      expect(getHealthNavKey("/health/reports/export")).toBe("reports");
    });

    it("returns null for non-HW-2 routes", () => {
      expect(getHealthNavKey("/health/audit")).toBeNull();
      expect(getHealthNavKey("/health/documents")).toBeNull();
      expect(getHealthNavKey("/health/other")).toBeNull();
    });
  });
});
