/**
 * HW-4.WEB-SCHED-RD-I4 — STRICT Schedule read authority: contract & security.
 *
 * The load-bearing security guarantee:
 *   `health.view` NEVER grants Schedule read authority. Only the RAW canonical
 *   `profile.permissions.health.read === true` does, with no admin/legacy
 *   bypass and no truthiness coercion.
 *
 * DELIBERATELY ABSENT: any test claiming this hook prevents a read from
 * starting. The hook is derivation-only; the "no read before allowed" timing
 * invariant belongs to the later orchestration layer that joins this hook with
 * `loadScheduleScope`. Asserting it here would be false attribution.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

type MockAccess = {
  profile: { status?: string; permissions?: Record<string, unknown> };
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
      profile: activeProfile({ health: { read: true } }),
    });

    expect(result.current.requiredCapability).toBe("health.read");
    expect(result.current.requiredCapability).not.toBe("health.view");
  });

  it("reports the capability even while forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true } }),
    });

    expect(result.current.requiredCapability).toBe("health.read");
  });
});

describe("A. unresolved profile", () => {
  it("AccessStatus loading yields loading, never a denial", () => {
    const { result } = withAccess({
      status: "loading",
      profile: activeProfile({ health: { read: true } }),
    });

    expect(result.current.status).toBe("loading");
    expect(result.current.canRead).toBe(false);
    // An unresolved profile must not render as forbidden.
    expect(result.current.status).not.toBe("forbidden");
  });

  it("loading does not grant read even when the profile already carries it", () => {
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

describe("B. canonical grant", () => {
  it("active profile + health.read === true yields allowed", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { read: true } }),
    });

    expect(result.current.status).toBe("allowed");
    expect(result.current.canRead).toBe(true);
    expect(result.current.hasLegacyViewOnly).toBe(false);
  });

  it("canRead is true ONLY for allowed", () => {
    const allowed = withAccess({
      status: "ready",
      profile: activeProfile({ health: { read: true } }),
    });
    expect(allowed.result.current.canRead).toBe(true);

    const denied = withAccess({
      status: "ready",
      profile: activeProfile({ health: { read: false } }),
    });
    expect(denied.result.current.canRead).toBe(false);
  });

  it("extra unrelated grants do not disturb the decision", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({
        health: { read: true, view: true, write: true },
        training: { read: true },
      }),
    });

    expect(result.current.status).toBe("allowed");
  });
});

describe("C/D. missing canonical grant", () => {
  it("health.read === false yields forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { read: false } }),
    });

    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
  });

  it("absent health.read yields forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: {} }),
    });

    expect(result.current.status).toBe("forbidden");
  });

  it("absent health module entirely yields forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ training: { read: true } }),
    });

    expect(result.current.status).toBe("forbidden");
  });

  it("absent permissions map yields forbidden", () => {
    const { result } = withAccess({ status: "ready", profile: { status: "active" } });

    expect(result.current.status).toBe("forbidden");
  });
});

describe("E. legacy health.view never grants", () => {
  it("health.view only yields forbidden with the diagnostic set", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true } }),
    });

    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
    // Diagnostic explains WHY access stops after the shell let the user in.
    expect(result.current.hasLegacyViewOnly).toBe(true);
  });

  it("health.view alongside health.read === false is still forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true, read: false } }),
    });

    expect(result.current.status).toBe("forbidden");
    expect(result.current.hasLegacyViewOnly).toBe(true);
  });

  it("the diagnostic is false when canonical read is present", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true, read: true } }),
    });

    expect(result.current.status).toBe("allowed");
    expect(result.current.hasLegacyViewOnly).toBe(false);
  });
});

describe("F. inactive profile", () => {
  it("inactive profile with health.read true is forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: { status: "inactive", permissions: { health: { read: true } } },
    });

    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
  });

  it("absent profile status is forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: { permissions: { health: { read: true } } },
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
  ])("health.read as %s does NOT grant read", (_label, value) => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { read: value } }),
    });

    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
  });

  it("only the literal boolean true grants", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { read: true } }),
    });

    expect(result.current.canRead).toBe(true);
  });
});

describe("I. no admin or role bypass", () => {
  it.each([
    ["admin role", { role: "admin" }],
    ["administrador role", { role: "administrador" }],
    ["isAdmin flag", { isAdmin: true }],
    ["superuser flag", { superuser: true }],
    ["internal_role", { internal_role: "admin" }],
    ["roles array", { roles: ["admin", "superuser"] }],
  ])("%s without health.read remains forbidden", (_label, extra) => {
    const { result } = withAccess({
      status: "ready",
      profile: { status: "active", permissions: { health: {} }, ...extra },
    });

    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
  });

  it("an admin-like profile is allowed only via literal health.read", () => {
    const { result } = withAccess({
      status: "ready",
      profile: {
        status: "active",
        permissions: { health: { read: true } },
        role: "admin",
      } as MockAccess["profile"],
    });

    expect(result.current.status).toBe("allowed");
  });
});

describe("J. fallback access status", () => {
  it("fallback without health.read is forbidden, NOT loading", () => {
    const { result } = withAccess({
      status: "fallback",
      profile: activeProfile({ health: {} }),
    });

    // A permanent spinner would be worse than an honest denial.
    expect(result.current.status).toBe("forbidden");
    expect(result.current.status).not.toBe("loading");
  });

  it("fallback WITH literal health.read is allowed", () => {
    const { result } = withAccess({
      status: "fallback",
      profile: activeProfile({ health: { read: true } }),
    });

    expect(result.current.status).toBe("allowed");
  });
});

describe("derivation-only surface", () => {
  // Structural evidence of scope: the hook exposes authority state and nothing
  // that could start, cancel or coordinate a read. This is NOT a claim that it
  // enforces read timing — that belongs to the orchestration gate.
  it("exposes exactly the four authority fields and no read/load function", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { read: true } }),
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
      profile: activeProfile({ health: { read: true } }),
    });
    const first = result.current;

    rerender();

    // Memoized on [profile, status]; identity stability matters for consumers
    // that will place this in an effect dependency list.
    expect(result.current).toBe(first);
  });
});
