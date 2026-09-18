/**
 * HW-4.WEB-SCHED-RD-I4 / CT3.AUTH-HEALTH-01 — STRICT Schedule read authority: contract & security.
 *
 * The load-bearing security guarantee (CT3.AUTH-HEALTH-01):
 *   F10 persisted grant `permissions.health.view === true` satisfies the F20
 *   semantic/domain capability `health.read`. Only the RAW canonical
 *   `profile.permissions.health.view === true` grants read, with no admin bypass.
 *
 * DELIBERATELY ABSENT: any test claiming this hook prevents a read from
 * starting. The hook is derivation-only; the "no read before allowed" timing
 * invariant belongs to the later orchestration layer that joins this hook with
 * `loadScheduleScope`. Asserting it here would be false attribution.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

type MockAccess = {
  profile: {
    status?: string;
    permissions?: Record<string, unknown>;
    role?: string;
    roles?: string[];
  };
  status: "fallback" | "loading" | "ready";
};

const accessState = vi.hoisted(() => ({ current: null as MockAccess | null }));

vi.mock("@/features/access/providers/access-control-provider", () => ({
  useAccessControl: () => accessState.current,
}));

// The hook pulls SCHEDULE_READ_CAPABILITY from the reader, which transitively
// imports the Firebase client. Stub it so no real SDK is initialized.
vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
  firebaseApp: {},
}));

import { useScheduleReadAuthority } from "../hooks/use-schedule-read-authority";

function withAccess(value: MockAccess) {
  accessState.current = value;
  return renderHook(() => useScheduleReadAuthority());
}

function activeProfile(permissions: Record<string, unknown>) {
  return { status: "active", permissions };
}

describe("required capability", () => {
  it("is always the canonical health.read", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true } }),
    });

    expect(result.current.requiredCapability).toBe("health.read");
    expect(result.current.requiredCapability).not.toBe("health.view");
  });

  it("reports the capability even while forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: false } }),
    });

    expect(result.current.requiredCapability).toBe("health.read");
  });
});

describe("A. unresolved profile", () => {
  it("AccessStatus loading yields loading, never a denial", () => {
    const { result } = withAccess({
      status: "loading",
      profile: activeProfile({ health: { view: true } }),
    });

    expect(result.current.status).toBe("loading");
    expect(result.current.canRead).toBe(false);
    // An unresolved profile must not render as forbidden.
    expect(result.current.status).not.toBe("forbidden");
  });

  it("loading does not grant read even when the profile already carries it", () => {
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
  it("active profile + health.view === true yields allowed with health.read capability", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true } }),
    });

    expect(result.current.status).toBe("allowed");
    expect(result.current.canRead).toBe(true);
    expect(result.current.hasLegacyViewOnly).toBe(false);
  });

  it("canRead is true ONLY for allowed", () => {
    const allowed = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true } }),
    });
    expect(allowed.result.current.canRead).toBe(true);

    const denied = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: false } }),
    });
    expect(denied.result.current.canRead).toBe(false);
  });

  it("extra unrelated grants do not disturb the decision", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({
        health: { view: true, write: true },
        training: { view: true },
      }),
    });

    expect(result.current.status).toBe("allowed");
  });
});

describe("C/D. missing canonical grant", () => {
  // CASE 2: health.view == false/absent -> DENY
  it("health.view === false yields forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: false } }),
    });

    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
  });

  it("absent health.view yields forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: {} }),
    });

    expect(result.current.status).toBe("forbidden");
  });

  it("absent health module entirely yields forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ training: { view: true } }),
    });

    expect(result.current.status).toBe("forbidden");
  });

  it("absent permissions map yields forbidden", () => {
    const { result } = withAccess({ status: "ready", profile: { status: "active" } });

    expect(result.current.status).toBe("forbidden");
  });
});

describe("F. inactive profile", () => {
  // CASE 3: profile inactive -> DENY
  it("inactive profile with health.view true is forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: { status: "inactive", permissions: { health: { view: true } } },
    });

    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
  });

  it("absent profile status is forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: { permissions: { health: { view: true } } },
    });

    expect(result.current.status).toBe("forbidden");
  });
});

describe("G/H. literal boolean strictness", () => {
  it.each([
    ["string 'true'", "true"],
    ["number 1", 1],
    ["string '1'", "1"],
    ["empty object", {}],
    ["empty array", []],
    ["null", null],
    ["undefined", undefined],
    ["string 'yes'", "yes"],
  ])("health.view as %s does NOT grant read", (_label, value) => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: value } }),
    });

    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
  });

  it("only the literal boolean true grants", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true } }),
    });

    expect(result.current.canRead).toBe(true);
  });
});

describe("I. no admin or role bypass", () => {
  // CASE 6: no generic admin bypass
  it.each([
    ["admin role", { role: "admin" }],
    ["administrador role", { role: "administrador" }],
    ["isAdmin flag", { isAdmin: true }],
    ["superuser flag", { superuser: true }],
    ["internal_role", { internal_role: "admin" }],
    ["roles array", { roles: ["admin", "superuser"] }],
  ])("%s without health.view remains forbidden", (_label, extra) => {
    const { result } = withAccess({
      status: "ready",
      profile: { status: "active", permissions: { health: {} }, ...extra },
    });

    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
  });

  // CASE 4: administrator profile using health.view -> ALLOW
  it("an administrator profile with health.view === true is allowed", () => {
    const { result } = withAccess({
      status: "ready",
      profile: {
        status: "active",
        permissions: { health: { view: true } },
        role: "admin",
      },
    });

    expect(result.current.status).toBe("allowed");
    expect(result.current.canRead).toBe(true);
  });

  // CASE 5: operador_k9 profile using health.view -> ALLOW
  it("an operador_k9 profile with health.view === true is allowed", () => {
    const { result } = withAccess({
      status: "ready",
      profile: {
        status: "active",
        permissions: { health: { view: true, create: true, edit: true } },
        role: "condutor",
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

  it("instructor qualification alongside health.view === true is allowed", () => {
    const { result } = withAccess({
      status: "ready",
      profile: {
        status: "active",
        permissions: { health: { view: true } },
        roles: ["condutor", "instrutor_k9"],
      },
    });

    expect(result.current.status).toBe("allowed");
    expect(result.current.canRead).toBe(true);
  });
});

describe("J. fallback access status", () => {
  it("fallback without health.view is forbidden, NOT loading", () => {
    const { result } = withAccess({
      status: "fallback",
      profile: activeProfile({ health: {} }),
    });

    // A permanent spinner would be worse than an honest denial.
    expect(result.current.status).toBe("forbidden");
    expect(result.current.status).not.toBe("loading");
  });

  it("fallback WITH literal health.view is allowed", () => {
    const { result } = withAccess({
      status: "fallback",
      profile: activeProfile({ health: { view: true } }),
    });

    expect(result.current.status).toBe("allowed");
  });
});

describe("derivation-only surface", () => {
  it("exposes exactly the four authority fields and no read/load function", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true } }),
    });

    expect(Object.keys(result.current).sort()).toEqual([
      "canRead",
      "hasLegacyViewOnly",
      "requiredCapability",
      "status",
    ]);
  });

  it("takes no arguments", () => {
    expect(useScheduleReadAuthority).toHaveLength(0);
  });

  it("returns a stable result for unchanged access state", () => {
    const { result, rerender } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true } }),
    });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
