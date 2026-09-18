/**
 * K9 Ops Web — Health Web v1 HW-8 Nutrition / CT3.AUTH-HEALTH-01
 * Unit & Integration Test Suite for Strict Nutrition Read Authority
 *
 * Enforces the strict capability boundary (CT3.AUTH-HEALTH-01):
 * - F10 persisted grant permissions.health.view == true satisfies domain capability health.read.
 * - health.view === false or absent is explicitly REJECTED.
 * - Profile status MUST be "active".
 * - Fail-closed: while status !== "allowed", 0 reads may be executed.
 * - NO generic admin or instructor bypass.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook, render, screen, act } from "@testing-library/react";

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
  can: (module: string, action?: string) => boolean;
};

const accessState = vi.hoisted(() => ({
  current: {
    status: "ready",
    profile: {
      status: "active",
      permissions: { health: { view: true } },
      scope: "global",
    },
    can: () => false,
  } as MockAccess,
}));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => accessState.current,
}));

const mockGetDoc = vi.fn();
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  doc: vi.fn((_db, ...parts) => ({ path: parts.join("/"), id: parts[parts.length - 1] })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  collection: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
}));

vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
}));

vi.mock("../../presentation/hooks/load-readiness-scope", () => ({
  loadReadinessScope: vi.fn(),
  toDogIdentity: (id: string, data: Record<string, unknown> | null | undefined) => ({
    id,
    name: (data?.name as string) ?? "Mock Dog",
    registrationNumber: (data?.rg as string) ?? "K9-00",
  }),
}));

vi.mock("../hooks/use-nutrition-plans", () => ({
  useNutritionPlans: () => ({
    status: "empty",
    dogId: "test-dog",
    activePlan: null,
    plans: [],
    legacyPlan: null,
    error: null,
    integrityConflict: null,
    reason: null,
  }),
}));

import {
  NUTRITION_READ_CAPABILITY,
  useNutritionReadAuthority,
} from "../hooks/use-nutrition-read-authority";
import { NutritionLandingView } from "../presentation/nutrition-landing-view";
import { NutritionDogView } from "../presentation/nutrition-dog-view";
import { loadReadinessScope } from "../../presentation/hooks/load-readiness-scope";
import { aggregateReadinessListItem } from "../../domain/readiness-aggregator";
import type { DogIdentityReadModel } from "../../domain/readiness-types";

function activeProfile(
  health: Record<string, unknown> | null,
  scope = "own_records",
) {
  return {
    status: "active",
    scope,
    permissions: health ? { health } : {},
  };
}

function withAccess(value: Partial<MockAccess>) {
  accessState.current = {
    status: value.status ?? "ready",
    profile: value.profile ?? null,
    can: value.can ?? (() => false),
  };
  return renderHook(() => useNutritionReadAuthority());
}

describe("useNutritionReadAuthority", () => {
  describe("required capability", () => {
    it("is always the canonical health.read", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ view: true }),
      });

      expect(result.current.requiredCapability).toBe("health.read");
      expect(result.current.requiredCapability).toBe(NUTRITION_READ_CAPABILITY);
    });

    it("reports the capability even while forbidden", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile(null),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.requiredCapability).toBe("health.read");
    });
  });

  describe("A. unresolved profile (loading)", () => {
    it("AccessStatus loading yields loading, never a denial", () => {
      const { result } = withAccess({
        status: "loading",
        profile: null,
      });

      expect(result.current.status).toBe("loading");
      expect(result.current.canRead).toBe(false);
      expect(result.current.hasLegacyViewOnly).toBe(false);
    });

    it("loading does not grant read even when profile carries health.view", () => {
      const { result } = withAccess({
        status: "loading",
        profile: activeProfile({ view: true }),
      });

      expect(result.current.status).toBe("loading");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("B. profile inactive", () => {
    it("inactive profile with health.view=true is FORBIDDEN", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "inactive",
          scope: "global",
          permissions: { health: { view: true } },
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
          scope: "global",
          permissions: { health: { view: true } },
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
        profile: activeProfile({ view: true }),
      });

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);
      expect(result.current.hasLegacyViewOnly).toBe(false);
    });

    it("allowed with scope=global when health.view=true", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ view: true }, "global"),
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
        profile: activeProfile({ view: false }),
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
          scope: "global",
          role: "admin",
          permissions: {
            admin: { manage: true },
          },
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
          scope: "global",
          role: "admin",
          permissions: { admin: { superuser: true } },
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
      expect(result.current.hasLegacyViewOnly).toBe(false);
    });

    it("null/empty permissions is FORBIDDEN", () => {
      const { result } = withAccess({
        status: "ready",
        profile: { status: "active", permissions: {} },
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
    it("administrator profile with health.view=true is ALLOWED", () => {
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
    it("operador_k9 profile with health.view=true is ALLOWED", () => {
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
        profile: activeProfile({ view: "true" }),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });

    it("number 1 does NOT grant read", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ view: 1 }),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("G. Nutrition Landing read ordering & authority integration", () => {
    it("unauthorized user (health.view absent) triggers 0 loadReadinessScope calls and renders ForbiddenState", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: activeProfile(null, "global"),
        can: () => false,
      };

      render(<NutritionLandingView />);

      expect(loadReadinessScope).not.toHaveBeenCalled();
      expect(screen.getByTestId("nutrition-landing-forbidden")).toBeInTheDocument();
      expect(screen.getByText("Acesso proibido")).toBeInTheDocument();
    });

    it("unresolved profile (loading) triggers 0 loadReadinessScope calls and renders LoadingState", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "loading",
        profile: activeProfile({ view: true }),
        can: () => false,
      };

      render(<NutritionLandingView />);

      expect(loadReadinessScope).not.toHaveBeenCalled();
      expect(screen.getByText("Verificando permissões...")).toBeInTheDocument();
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
        profile: activeProfile({ view: true }),
        can: () => false,
      };

      await act(async () => {
        render(<NutritionLandingView />);
      });

      expect(loadReadinessScope).toHaveBeenCalledTimes(1);
    });

    it("transition allowed -> forbidden immediately resets state and renders ForbiddenState", async () => {
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

      accessState.current = {
        status: "ready",
        profile: activeProfile({ view: true }),
        can: () => false,
      };

      let rerenderFn: ((ui: React.ReactElement) => void) | undefined;
      await act(async () => {
        const { rerender } = render(<NutritionLandingView />);
        rerenderFn = rerender;
      });

      // Transition to forbidden
      accessState.current = {
        status: "ready",
        profile: activeProfile({ view: false }),
        can: () => false,
      };

      await act(async () => {
        rerenderFn?.(<NutritionLandingView />);
      });

      expect(screen.getByTestId("nutrition-landing-forbidden")).toBeInTheDocument();
      expect(screen.queryByText("Rex")).not.toBeInTheDocument();
    });
  });

  describe("H. Nutrition Dog View read ordering & authority integration", () => {
    it("unauthorized user (health.view absent) triggers 0 getDoc calls and renders ForbiddenState", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: activeProfile(null, "global"),
        can: () => false,
      };

      render(<NutritionDogView dogId="k9-1" />);

      expect(mockGetDoc).not.toHaveBeenCalled();
      expect(screen.getByTestId("nutrition-dog-forbidden")).toBeInTheDocument();
      expect(screen.getByText("Acesso proibido")).toBeInTheDocument();
    });

    it("unresolved profile (loading) triggers 0 getDoc calls and renders LoadingState", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "loading",
        profile: activeProfile({ view: true }),
        can: () => false,
      };

      render(<NutritionDogView dogId="k9-1" />);

      expect(mockGetDoc).not.toHaveBeenCalled();
      expect(screen.getByText("Verificando permissões...")).toBeInTheDocument();
    });

    it("canonical allowed user (health.view=true) initiates getDoc", async () => {
      vi.clearAllMocks();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: "k9-1",
        data: () => ({ name: "Rex", rg: "K9-01" }),
      });

      accessState.current = {
        status: "ready",
        profile: activeProfile({ view: true }),
        can: () => false,
      };

      await act(async () => {
        render(<NutritionDogView dogId="k9-1" />);
      });

      expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });
  });
});
