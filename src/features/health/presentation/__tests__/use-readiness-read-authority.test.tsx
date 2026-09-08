/**
 * HW-5.WEB-READINESS.FIX1 — STRICT Readiness read authority: contract & security.
 *
 * Load-bearing security guarantee:
 *   `health.view` NEVER grants Readiness read authority. Only the RAW canonical
 *   `profile.permissions.health.read === true` does, with no role/admin/scope
 *   bypass and no truthiness coercion.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

type MockAccess = {
  profile: { status?: string; permissions?: Record<string, unknown>; scope?: string } | null;
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

vi.mock("../hooks/load-readiness-cockpit", () => ({
  loadReadinessCockpit: vi.fn(),
}));

import {
  useReadinessReadAuthority,
  READINESS_READ_CAPABILITY,
} from "../hooks/use-readiness-read-authority";
import { useReadinessCockpit } from "../hooks/use-readiness-cockpit";
import { loadReadinessCockpit } from "../hooks/load-readiness-cockpit";

function withAccess(value: MockAccess) {
  accessState.current = value;
  return renderHook(() => useReadinessReadAuthority());
}

function activeProfile(permissions: Record<string, unknown>, scope: string = "own_records") {
  return { status: "active", permissions, scope };
}

describe("useReadinessReadAuthority", () => {
  describe("required capability", () => {
    it("is always the canonical health.read", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { read: true } }),
      });

      expect(result.current.requiredCapability).toBe(READINESS_READ_CAPABILITY);
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

    it("loading reports no legacy diagnostic", () => {
      const { result } = withAccess({
        status: "loading",
        profile: activeProfile({ health: { view: true } }),
      });

      expect(result.current.hasLegacyViewOnly).toBe(false);
    });
  });

  describe("B. killer test — gestor / legacy view only", () => {
    it("rejects active gestor with health.view=true and health.read absent", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: true } }, "global"),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
      expect(result.current.hasLegacyViewOnly).toBe(true);
    });

    it("global scope does NOT bypass the health.read requirement", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "active",
          scope: "global",
          permissions: { health: { view: true } },
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("C. active profile without canonical read", () => {
    it("rejects active profile with empty health permissions", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: {} }),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
      expect(result.current.hasLegacyViewOnly).toBe(false);
    });

    it("rejects active profile without permissions map", () => {
      const { result } = withAccess({
        status: "ready",
        profile: { status: "active" },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
      expect(result.current.hasLegacyViewOnly).toBe(false);
    });

    it("rejects truthy non-boolean read value ('true', 1)", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { read: "true" } }),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("D. inactive profile", () => {
    it("rejects inactive profile even if health.read === true", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "inactive",
          permissions: { health: { read: true } },
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("E. canonical allowed", () => {
    it("grants read when profile is active and health.read === true", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { read: true } }, "own_records"),
      });

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);
      expect(result.current.hasLegacyViewOnly).toBe(false);
    });
  });

  describe("F. authority transition safety", () => {
    it("transitions from allowed to forbidden cleanly when profile switches", () => {
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { read: true } }),
      };

      const { result, rerender } = renderHook(() => useReadinessReadAuthority());

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);

      // Transition to legacy-view-only gestor
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: true } }, "global"),
      };

      rerender();

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
      expect(result.current.hasLegacyViewOnly).toBe(true);
    });
  });

  describe("G. cockpit read ordering & authority integration", () => {
    it("KILLER CASE — gestor (health.view=true, health.read absent) is forbidden and causes 0 cockpit loader calls", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: true } }, "global"),
      };

      const { result } = renderHook(() => useReadinessCockpit("stg-dog-001"));

      expect(result.current.status).toBe("forbidden");
      expect(result.current.cockpit).toBeNull();
      expect(loadReadinessCockpit).toHaveBeenCalledTimes(0);
    });

    it("inactive profile with health.read=true is forbidden and causes 0 cockpit loader calls", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: {
          status: "inactive",
          permissions: { health: { read: true } },
        },
      };

      const { result } = renderHook(() => useReadinessCockpit("stg-dog-001"));

      expect(result.current.status).toBe("forbidden");
      expect(result.current.cockpit).toBeNull();
      expect(loadReadinessCockpit).toHaveBeenCalledTimes(0);
    });

    it("loading authority yields loading status and causes 0 cockpit loader calls", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "loading",
        profile: null,
      };

      const { result } = renderHook(() => useReadinessCockpit("stg-dog-001"));

      expect(result.current.status).toBe("loading");
      expect(result.current.cockpit).toBeNull();
      expect(loadReadinessCockpit).toHaveBeenCalledTimes(0);
    });

    it("canonical allowed user (health.read=true) initiates cockpit data load", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { read: true } }),
      };

      renderHook(() => useReadinessCockpit("stg-dog-001"));

      expect(loadReadinessCockpit).toHaveBeenCalledTimes(1);
      expect(loadReadinessCockpit).toHaveBeenCalledWith("stg-dog-001");
    });

    it("authority transition safety — switching to forbidden clears cockpit and prevents stale data", async () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { read: true } }),
      };

      const { result, rerender } = renderHook(() => useReadinessCockpit("stg-dog-001"));

      expect(loadReadinessCockpit).toHaveBeenCalledTimes(1);

      // Switch to forbidden gestor
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: true } }, "global"),
      };

      rerender();

      expect(result.current.status).toBe("forbidden");
      expect(result.current.cockpit).toBeNull();
      expect(loadReadinessCockpit).toHaveBeenCalledTimes(1);
    });
  });
});

