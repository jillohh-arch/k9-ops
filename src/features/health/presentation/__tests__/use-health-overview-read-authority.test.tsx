/**
 * HW-8.WEB-AUTH-HARDENING.FIX1 — STRICT Health Overview read authority: contract & security.
 *
 * Load-bearing security guarantee:
 *   `health.view` NEVER grants Health Overview read authority. Only the RAW canonical
 *   `profile.permissions.health.read === true` does, with no role/admin/scope
 *   bypass and no truthiness coercion.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

type MockAccess = {
  profile: {
    status?: string;
    permissions?: Record<string, unknown>;
    scope?: string;
    role?: string;
    [key: string]: unknown;
  } | null;
  status: "fallback" | "loading" | "ready";
};

const accessState = vi.hoisted(() => ({ current: null as MockAccess | null }));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => accessState.current,
}));

// Stub Firebase client so no real SDK is initialized
vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
  firebaseApp: {},
}));

vi.mock("../hooks/load-readiness-scope", () => ({
  loadReadinessScope: vi.fn(),
}));

import {
  useHealthOverviewReadAuthority,
  OVERVIEW_READ_CAPABILITY,
} from "../hooks/use-health-overview-read-authority";
import { useHealthOverview } from "../hooks/use-health-overview";
import { loadReadinessScope } from "../hooks/load-readiness-scope";

function withAccess(value: MockAccess) {
  accessState.current = value;
  return renderHook(() => useHealthOverviewReadAuthority());
}

function activeProfile(permissions: Record<string, unknown>, scope: string = "own_records") {
  return { status: "active", permissions, scope };
}

describe("useHealthOverviewReadAuthority", () => {
  describe("required capability", () => {
    it("is always the canonical health.read", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { read: true } }),
      });

      expect(result.current.requiredCapability).toBe(OVERVIEW_READ_CAPABILITY);
      expect(result.current.requiredCapability).toBe("health.read");
      expect(result.current.requiredCapability).not.toBe("health.view");
    });

    it("reports the capability even while forbidden", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: true } }),
      });

      expect(result.current.requiredCapability).toBe("health.read");
      expect(result.current.status).toBe("forbidden");
    });
  });

  describe("A. unresolved profile (loading)", () => {
    it("AccessStatus loading yields loading, never a denial", () => {
      const { result } = withAccess({
        status: "loading",
        profile: activeProfile({ health: { read: true } }),
      });

      expect(result.current.status).toBe("loading");
      expect(result.current.canRead).toBe(false);
      expect(result.current.status).not.toBe("forbidden");
    });

    it("loading does not grant read even when profile carries health.read", () => {
      const { result } = withAccess({
        status: "loading",
        profile: activeProfile({ health: { read: true } }),
      });

      expect(result.current.canRead).toBe(false);
    });
  });

  describe("B. profile inactive", () => {
    it("inactive profile with health.read=true is FORBIDDEN", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "inactive",
          permissions: { health: { read: true } },
          scope: "global",
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });

    it("suspended profile with health.read=true is FORBIDDEN", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "suspended",
          permissions: { health: { read: true } },
          scope: "global",
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("C. canonical active health.read (allowed)", () => {
    it("active profile with explicit health.read=true is ALLOWED", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { read: true } }, "own_records"),
      });

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);
      expect(result.current.hasLegacyViewOnly).toBe(false);
    });

    it("allowed with scope=global when health.read=true", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { read: true } }, "global"),
      });

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);
    });
  });

  describe("D. PERMANENT SECURITY KILLER: health.view only is REJECTED", () => {
    it("active profile with health.view=true and NO health.read is FORBIDDEN", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: true } }, "global"),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
      expect(result.current.hasLegacyViewOnly).toBe(true);
    });

    it("rejects health.view even with admin/gestor profile and scope=global", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "active",
          role: "gestor",
          scope: "global",
          permissions: { health: { view: true } },
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
      expect(result.current.hasLegacyViewOnly).toBe(true);
    });

    it("rejects health.view=true when health.read=false", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: true, read: false } }, "global"),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
      expect(result.current.hasLegacyViewOnly).toBe(true);
    });
  });

  describe("E. no role/admin/scope bypass", () => {
    it("admin profile without health.read is FORBIDDEN", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "active",
          role: "admin",
          scope: "global",
          permissions: { other: { manage: true } },
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });

    it("null/empty permissions is FORBIDDEN", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({}),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });

    it("null profile is FORBIDDEN when status is ready", () => {
      const { result } = withAccess({
        status: "ready",
        profile: null,
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("F. truthiness vs strict boolean identity", () => {
    it("string 'true' does NOT grant read", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { read: "true" } }),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });

    it("number 1 does NOT grant read", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { read: 1 } }),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("G. Overview read ordering & authority integration", () => {
    it("unauthorized user (health.view only) triggers 0 loadReadinessScope calls", async () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: true } }, "global"),
      };

      const { result } = renderHook(() => useHealthOverview());

      expect(result.current.status).toBe("forbidden");
      expect(loadReadinessScope).not.toHaveBeenCalled();
      expect(result.current.items).toEqual([]);
      expect(result.current.activeRestrictions).toEqual([]);
    });

    it("unresolved profile (loading) triggers 0 loadReadinessScope calls", async () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "loading",
        profile: activeProfile({ health: { read: true } }),
      };

      const { result } = renderHook(() => useHealthOverview());

      expect(result.current.status).toBe("loading");
      expect(loadReadinessScope).not.toHaveBeenCalled();
      expect(result.current.items).toEqual([]);
      expect(result.current.activeRestrictions).toEqual([]);
    });

    it("canonical allowed user (health.read=true) initiates loadReadinessScope", async () => {
      vi.clearAllMocks();
      vi.mocked(loadReadinessScope).mockResolvedValueOnce({
        items: [],
        activeRestrictions: [],
        isPartial: false,
        restrictionsCoverageComplete: true,
      });

      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { read: true } }),
      };

      await act(async () => {
        renderHook(() => useHealthOverview());
      });

      expect(loadReadinessScope).toHaveBeenCalledTimes(1);
    });

    it("transition allowed -> forbidden immediately clears items and activeRestrictions", async () => {
      vi.clearAllMocks();
      vi.mocked(loadReadinessScope).mockResolvedValueOnce({
        items: [
          {
            dog: { id: "k9-1", name: "Rex", microchip: "123", registrationNumber: "R1" },
            summary: null,
            readinessStatus: "not_evaluated",
            dataQuality: "missing",
            activeRestrictionsCount: 0,
            hasConflict: false,
          },
        ],
        activeRestrictions: [],
        isPartial: false,
        restrictionsCoverageComplete: true,
      });

      // 1. Mount allowed
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { read: true } }),
      };

      const { result, rerender } = renderHook(() => useHealthOverview());

      // 2. Transition to forbidden
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: true } }),
      };

      rerender();

      expect(result.current.status).toBe("forbidden");
      expect(result.current.items).toEqual([]);
      expect(result.current.activeRestrictions).toEqual([]);
    });
  });
});
