/**
 * K9 Ops Web — Health Web v1 HW-8 Nutrition
 * Unit & Integration Test Suite for Strict Nutrition Read Authority
 *
 * Enforces the strict capability boundary:
 * - \health.read === true\ is the ONLY capability that grants Nutrition read authority.
 * - \health.view === true\ without \health.read === true\ is explicitly REJECTED.
 * - Profile status MUST be "active".
 * - Fail-closed: while status !== "allowed", 0 reads may be executed.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook, render, screen, act } from "@testing-library/react";

type MockAccess = {
  profile: {
    status?: string;
    permissions?: Record<string, unknown>;
    scope?: string;
    role?: string;
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
      permissions: { health: { read: true } },
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
        profile: activeProfile({ read: true }),
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

    it("loading does not grant read even when profile carries health.read", () => {
      const { result } = withAccess({
        status: "loading",
        profile: activeProfile({ read: true }),
      });

      expect(result.current.status).toBe("loading");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("B. profile inactive", () => {
    it("inactive profile with health.read=true is FORBIDDEN", () => {
      const { result } = withAccess({
        status: "ready",
        profile: {
          status: "inactive",
          scope: "global",
          permissions: { health: { read: true } },
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
          scope: "global",
          permissions: { health: { read: true } },
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
        profile: activeProfile({ read: true }),
      });

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);
      expect(result.current.hasLegacyViewOnly).toBe(false);
    });

    it("allowed with scope=global when health.read=true", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ read: true }, "global"),
      });

      expect(result.current.status).toBe("allowed");
      expect(result.current.canRead).toBe(true);
    });
  });

  describe("D. PERMANENT SECURITY KILLER: health.view only is REJECTED", () => {
    it("active profile with health.view=true and NO health.read is FORBIDDEN", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ view: true }),
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
          scope: "global",
          permissions: {
            health: { view: true },
            admin: { manage: true },
          },
        },
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
      expect(result.current.hasLegacyViewOnly).toBe(true);
    });

    it("rejects health.view=true when health.read=false", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ view: true, read: false }),
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
          scope: "global",
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
  });

  describe("F. truthiness vs strict boolean identity", () => {
    it("string 'true' does NOT grant read", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ read: "true" }),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });

    it("number 1 does NOT grant read", () => {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ read: 1 }),
      });

      expect(result.current.status).toBe("forbidden");
      expect(result.current.canRead).toBe(false);
    });
  });

  describe("G. Nutrition Landing read ordering & authority integration", () => {
    it("unauthorized user (health.view only) triggers 0 loadReadinessScope calls and renders ForbiddenState", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: activeProfile({ view: true }, "global"),
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
        profile: activeProfile({ read: true }),
        can: () => false,
      };

      render(<NutritionLandingView />);

      expect(loadReadinessScope).not.toHaveBeenCalled();
      expect(screen.getByText("Verificando permissões...")).toBeInTheDocument();
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
        profile: activeProfile({ read: true }),
        can: () => false,
      };

      await act(async () => {
        render(<NutritionLandingView />);
      });

      expect(loadReadinessScope).toHaveBeenCalledTimes(1);
    });

    it("transition allowed -> forbidden immediately resets state and renders ForbiddenState", async () => {
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

      accessState.current = {
        status: "ready",
        profile: activeProfile({ read: true }),
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
        profile: activeProfile({ view: true }),
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
    it("unauthorized user (health.view only) triggers 0 getDoc calls and renders ForbiddenState", () => {
      vi.clearAllMocks();
      accessState.current = {
        status: "ready",
        profile: activeProfile({ view: true }, "global"),
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
        profile: activeProfile({ read: true }),
        can: () => false,
      };

      render(<NutritionDogView dogId="k9-1" />);

      expect(mockGetDoc).not.toHaveBeenCalled();
      expect(screen.getByText("Verificando permissões...")).toBeInTheDocument();
    });

    it("canonical allowed user (health.read=true) initiates getDoc", async () => {
      vi.clearAllMocks();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: "k9-1",
        data: () => ({ name: "Rex", rg: "K9-01" }),
      });

      accessState.current = {
        status: "ready",
        profile: activeProfile({ read: true }),
        can: () => false,
      };

      await act(async () => {
        render(<NutritionDogView dogId="k9-1" />);
      });

      expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });
  });
});
