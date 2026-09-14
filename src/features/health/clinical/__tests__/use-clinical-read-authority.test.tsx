/**
 * K9 Ops Web — Health Web v1 HW-6A.I2 / CT3.AUTH-HEALTH-01
 * STRICT Clinical read authority — contract & security tests.
 *
 * The load-bearing security guarantee (CT3.AUTH-HEALTH-01):
 *   F10 persisted grant `permissions.health.view === true` satisfies the F20
 *   semantic/domain capability `health.read`. Only the RAW canonical
 *   `profile.permissions.health.view === true` grants read, with no admin bypass.
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

// The hook pulls CLINICAL_READ_CAPABILITY from the reader, which transitively
// imports the Firebase client. Stub it so no real SDK is initialized.
vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
  firebaseApp: {},
}));

import { useClinicalReadAuthority } from "../hooks/use-clinical-read-authority";

function withAccess(value: MockAccess) {
  accessState.current = value;
  return renderHook(() => useClinicalReadAuthority());
}

function activeProfile(permissions: Record<string, unknown>) {
  return { status: "active", permissions };
}

describe("HW-6A.I2 / CT3.AUTH-HEALTH-01 — useClinicalReadAuthority (strict canonical boundary)", () => {
  // 1
  it("1. required capability is always the canonical health.read", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true } }),
    });
    expect(result.current.requiredCapability).toBe("health.read");
  });

  // 2
  it("2. canonical health.view === true -> allowed with health.read capability", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true } }),
    });
    expect(result.current.status).toBe("allowed");
    expect(result.current.canRead).toBe(true);
    expect(result.current.hasLegacyViewOnly).toBe(false);
  });

  // 3 — THE security test
  it("3. health.view === false -> forbidden (never allowed)", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: false } }),
    });
    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
    expect(result.current.hasLegacyViewOnly).toBe(false);
  });

  // 4
  it("4. health module present but view absent -> forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: {} }),
    });
    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
  });

  // 5
  it("5. no health module at all -> forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ k9: { view: true } }),
    });
    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
    expect(result.current.hasLegacyViewOnly).toBe(false);
  });

  // 6
  it("6. authority status loading -> loading, canRead false, not a denial", () => {
    const { result } = withAccess({
      status: "loading",
      profile: activeProfile({ health: { view: true } }),
    });
    expect(result.current.status).toBe("loading");
    expect(result.current.canRead).toBe(false);
    // A yet-unknown authority must NOT render as forbidden.
    expect(result.current.status).not.toBe("forbidden");
  });

  // 7 — no admin bypass
  it("7. an administrator profile WITHOUT health.view is still forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: {
        status: "active",
        // Deliberately admin-flavoured but WITHOUT health.view.
        permissions: {
          access: { view: true, edit: true, audit: true },
          k9: { view: true, edit: true },
        },
      },
    });
    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
  });

  // 8 — strict boolean identity
  it("8. truthy-but-not-true view grants (e.g. \"true\", 1) do NOT authorize", () => {
    for (const truthy of ["true", 1, "view", {}]) {
      const { result } = withAccess({
        status: "ready",
        profile: activeProfile({ health: { view: truthy } }),
      });
      expect(result.current.canRead).toBe(false);
      expect(result.current.status).toBe("forbidden");
    }
  });

  // 9
  it("9. an inactive profile carrying health.view is forbidden", () => {
    const { result } = withAccess({
      status: "ready",
      profile: { status: "inactive", permissions: { health: { view: true } } },
    });
    expect(result.current.status).toBe("forbidden");
    expect(result.current.canRead).toBe(false);
  });

  // 10 — canonical view with extra permissions
  it("10. view:true with other health permissions -> allowed", () => {
    const { result } = withAccess({
      status: "ready",
      profile: activeProfile({ health: { view: true, edit: true, export: true } }),
    });
    expect(result.current.status).toBe("allowed");
    expect(result.current.canRead).toBe(true);
    expect(result.current.hasLegacyViewOnly).toBe(false);
  });

  // 11 — source guarantee: no compatibility helper / evaluateCapability
  it("11. does not route authority through evaluateCapability or hasAccessPermission", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(
      path.resolve(__dirname, "../hooks/use-clinical-read-authority.ts"),
      "utf8",
    );
    const firstImport = source.indexOf("\nimport ");
    const code = firstImport >= 0 ? source.slice(firstImport) : source;

    expect(code).not.toContain("hasAccessPermission");
    expect(code).not.toContain("evaluateCapability");
    // It must read the RAW permission map, keyed on canonical health.view (CT3.AUTH-HEALTH-01).
    expect(code).toContain("view");
  });
});
