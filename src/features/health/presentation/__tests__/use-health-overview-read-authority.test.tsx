/**
 * HW-8.WEB-AUTH-HARDENING.FIX1 / CT3.AUTH-HEALTH-01 — STRICT Health Overview read authority: contract & security.
 *
 * Load-bearing security guarantee (CT3.AUTH-HEALTH-01):
 *   F10 persisted grant `permissions.health.view === true` satisfies domain
 *   capability `health.read`. Only the RAW canonical `profile.permissions.health.view === true`
 *   grants read, with no generic role/admin/scope bypass and no truthiness coercion.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

type MockAccess = {
  profile: {
    status?: string;
    permissions?: Record<string, unknown>;
    scope?: string;
    role?: string;
    roles?: string[];
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
import { aggregateReadinessListItem } from "../../domain/readiness-aggregator";
import type { DogIdentityReadModel } from "../../domain/readiness-types";

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
        profile: activeProfile({ health: { view: true } }),
      });

      expect(result.current.requiredCapability).toBe(OVERVIEW_READ_CAPABILITY);
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
  });

  describe("B. profile inactive", () => {
    it("inactive profile with health.view=true is FORBIDDEN", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "inactive",
          permissions: { health: { view: true } },
          scope: "global",
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });

    it("suspended profile with health.view=true is FORBIDDEN", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "suspended",
          permissions: { health: { view: true } },
          scope: "global",
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("C. canonical active health.view (allowed)", () => {
    // CASE 1: health.view == true, health.read absent -> ALLOW semantic health.read
    it("active profile with explicit health.view=true is ALLOWED", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: true } }, "own_records"),
      });

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);
      expect(result.current.hasLegacyViewOnly).toBe(false);
    });

    it("allowed with scope=global when health.view=true", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: true } }, "global"),
      });

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);
    });
  });

  describe("D. health.view false or absent is REJECTED", () => {
    // CASE 2: health.view == false/absent -> DENY
    it("active profile with health.view=false is FORBIDDEN", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: false } }, "global"),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
      expect(result.current.hasLegacyViewOnly).toBe(false);
    });

    it("rejects absent health.view even with admin/gestor profile and scope=global", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "active",
          role: "gestor",
          scope: "global",
          permissions: { other: { manage: true } },
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("E. no role/admin/scope bypass", () => {
    // CASE 6: no generic admin bypass
    it("admin profile without health.view is FORBIDDEN", () => {
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

  describe("F. truthiness vs strict boolean identity", () => {
    it("string 'true' does NOT grant read", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: "true" } }),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });

    it("number 1 does NOT grant read", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: 1 } }),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("G. Overview read ordering & authority integration", () => {
    it("unauthorized user (health.view absent) triggers 0 loadReadinessScope calls", async () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: {} }, "global"),
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
        profile: activeProfile({ health: { view: true } }),
      };

      const { result } = renderHook(() => useHealthOverview());

      expect(result.current.status).toBe("loading");
      expect(loadReadinessScope).not.toHaveBeenCalled();
      expect(result.current.items).toEqual([]);
      expect(result.current.activeRestrictions).toEqual([]);
    });

    it("canonical allowed user (health.view=true) initiates loadReadinessScope", async () => {
      vi.clearAllMocks();
      vi.mocked(loadReadinessScope).mockResolvedValueOnce({
        items: [],
        activeRestrictions: [],
        isPartial: false,
        restrictionsCoverageComplete: true,
        scopeEmpty: true,
      });

      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: true } }),
      };

      await act(async () => {
        renderHook(() => useHealthOverview());
      });

      expect(loadReadinessScope).toHaveBeenCalledTimes(1);
    });

    it("transition allowed -> forbidden immediately clears items and activeRestrictions", async () => {
      vi.clearAllMocks();
      const testDog: DogIdentityReadModel = {
        id: "k9-1",
        name: "Rex",
        registrationNumber: "R1",
        photoUrl: null,
        breed: null,
        sex: null,
        dateOfBirth: null,
        conductor: null,
        specialties: [],
      };
      const testItem = aggregateReadinessListItem({
        dog: testDog,
        summary: null,
        restrictions: [],
      });

      vi.mocked(loadReadinessScope).mockResolvedValueOnce({
        items: [testItem],
        activeRestrictions: [],
        isPartial: false,
        restrictionsCoverageComplete: true,
        scopeEmpty: false,
      });

      // 1. Mount allowed
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: true } }),
      };

      const { result, rerender } = renderHook(() => useHealthOverview());

      // 2. Transition to forbidden
      accessState.current = {
        status: "ready",
        profile: activeProfile({ health: { view: false } }),
      };

      rerender();

      expect(result.current.status).toBe("forbidden");
      expect(result.current.items).toEqual([]);
      expect(result.current.activeRestrictions).toEqual([]);
    });
  });
});
