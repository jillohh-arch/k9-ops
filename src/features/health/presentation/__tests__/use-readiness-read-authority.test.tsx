/**
 * HW-5.WEB-READINESS.FIX1 / CT3.AUTH-HEALTH-01 — STRICT Readiness read authority: contract & security.
 *
 * Load-bearing security guarantee (CT3.AUTH-HEALTH-01):
 *   F10 persisted grant `permissions.health.view === true` satisfies domain
 *   capability `health.read`. Only the RAW canonical `profile.permissions.health.view === true`
 *   grants read, with no generic role/admin/scope bypass and no truthiness coercion.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

type MockAccess = {
  profile: {
    status?: string;
    permissions?: Record<string, unknown>;
    scope?: string;
    role?: string;
    roles?: string[];
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
        profile: activeProfile({ health: { view: true } }),
      });

      expect(result.current.requiredCapability).toBe(READINESS_READ_CAPABILITY);
      expect(result.current.requiredCapability).toBe("health.read");
      expect(result.current.requiredCapability).not.toBe("health.view");
    });

    it("reports the capability even while forbidden", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: false } }),
      });

      expect(result.current.requiredCapability).toBe("health.read");
      expect(result.current.status).toBe("forbidden");
    });
  });

  describe("A. unresolved profile (loading)", () => {
    it("AccessStatus loading yields loading, never a denial", () => {
      const { result } = withAccess({
        status: "loading",
        profile: activeProfile({ health: { view: true } }),
      });

      expect(result.current.status).toBe("loading");
      expect(result.current.canRead).toBe(false);
      expect(result.current.status).not.toBe("forbidden");
    });

    it("loading does not grant read even when profile carries health.view", () => {
      const { result } = withAccess({
        status: "loading",
        profile: activeProfile({ health: { view: true } }),
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

  describe("B. canonical grant (CT3.AUTH-HEALTH-01)", () => {
    // CASE 1: health.view == true, health.read absent -> ALLOW semantic health.read
    it("grants read when profile is active and health.view === true", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: true } }, "own_records"),
      });

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);
      expect(result.current.hasLegacyViewOnly).toBe(false);
    });

    it("allows with global scope when health.view === true", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: true } }, "global"),
      });

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);
    });
  });

  describe("C. missing canonical grant", () => {
    // CASE 2: health.view == false/absent -> DENY
    it("rejects active profile with health.view === false", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: false } }),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
      expect(result.current.hasLegacyViewOnly).toBe(false);
    });

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

    it("rejects truthy non-boolean view value ('true', 1)", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: "true" } }),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("D. inactive profile", () => {
    // CASE 3: profile inactive -> DENY
    it("rejects inactive profile even if health.view === true", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "inactive",
          permissions: { health: { view: true } },
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("E. role and admin contracts", () => {
    // CASE 6: no generic admin bypass
    it("rejects administrator without health.view (no generic admin bypass)", () => {
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

    // CASE 4: administrator profile using health.view -> ALLOW
    it("allows administrator profile with health.view === true", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "active",
          role: "admin",
          permissions: { health: { view: true } },
        },
      });

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);
    });

    // CASE 5: operador_k9 profile using health.view -> ALLOW
    it("allows operador_k9 profile with health.view === true", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "active",
          role: "condutor",
          permissions: { health: { view: true, create: true, edit: true } },
        },
      });

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);
    });

    // CASE 7: Instructor qualification does not affect Health base authorization
    it("instructor qualification alone without health.view remains forbidden", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "active",
          permissions: { health: {} },
          roles: ["condutor", "instrutor_k9"],
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("F. authority transition safety", () => {
    it("transitions from allowed to forbidden cleanly when profile switches", () => {
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: true } }),
      };

      const { result, rerender } = renderHook(() => useReadinessReadAuthority());

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);

      // Transition to forbidden
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: false } }, "global"),
      };

      rerender();

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("G. cockpit read ordering & authority integration", () => {
    it("unauthorized user (health.view absent) is forbidden and causes 0 cockpit loader calls", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: {} }, "global"),
      };

      const { result } = renderHook(() => useReadinessCockpit("stg-dog-001"));

      expect(result.current.status).toBe("forbidden");
      expect(result.current.cockpit).toBeNull();
      expect(loadReadinessCockpit).toHaveBeenCalledTimes(0);
    });

    it("inactive profile with health.view=true is forbidden and causes 0 cockpit loader calls", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: {
          status: "inactive",
          permissions: { health: { view: true } },
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

    it("canonical allowed user (health.view=true) initiates cockpit data load", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: true } }),
      };

      renderHook(() => useReadinessCockpit("stg-dog-001"));

      expect(loadReadinessCockpit).toHaveBeenCalledTimes(1);
      expect(loadReadinessCockpit).toHaveBeenCalledWith("stg-dog-001");
    });

    it("authority transition safety — switching to forbidden clears cockpit and prevents stale data", async () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: true } }),
      };

      const { result, rerender } = renderHook(() => useReadinessCockpit("stg-dog-001"));

      expect(loadReadinessCockpit).toHaveBeenCalledTimes(1);

      // Switch to forbidden
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: false } }, "global"),
      };

      rerender();

      expect(result.current.status).toBe("forbidden");
      expect(result.current.cockpit).toBeNull();
      expect(loadReadinessCockpit).toHaveBeenCalledTimes(1);
    });
  });
});
