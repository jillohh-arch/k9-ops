import { describe, expect, it } from "vitest";

import {
  getDefaultAccessProfile,
  hasAccessPermission,
  type AccessProfile,
} from "../access-control";
import {
  evaluateCapability,
  type SessionCapabilities,
} from "@/features/health/domain/permissions";

/**
 * NUT-WEB-4C — Nutrition permission compatibility contract.
 *
 * Two distinct authorization layers exist, in OPPOSITE directions, and both are
 * asserted here because a regression in either one silently changes who can
 * administer a NutritionPlan:
 *
 * 1. `hasAccessPermission` (profile/action, src/lib/permissions) — the module
 *    grid used by the access editor. Its Health adapter reads
 *    `read -> satisfies view`, so canonical-only profiles keep the legacy
 *    module affordances.
 * 2. `evaluateCapability` (session/capability, features/health/domain) — the
 *    Health read boundary used by the /health layout. Its adapter reads
 *    `legacy health.view -> satisfies health.read`, which is the temporary
 *    read compatibility the HW-5 decision preserves until NUT-WEB-6.
 *
 * The invariant both layers must uphold: read compatibility never becomes write
 * authority. `manage_nutrition_plan` is granted by explicit grant only.
 *
 * These are client-side affordance guards. The backend callable remains the
 * final authority for every NutritionPlan write.
 */

function healthProfile(
  health: Record<string, boolean>,
  status: AccessProfile["status"] = "active",
): Pick<AccessProfile, "permissions" | "status"> {
  return { permissions: { health }, status };
}

function healthSession(
  permissions: Record<string, boolean>,
  sessionId: string | null = "session-nut-4c",
): SessionCapabilities {
  return {
    sessionId,
    explicitCapabilities: Object.entries(permissions)
      .filter(([, enabled]) => enabled === true)
      .map(([action]) => `health.${action}`)
      .filter(
        (capability) =>
          capability === "health.read" ||
          capability === "health.manage_nutrition_plan",
      ) as SessionCapabilities["explicitCapabilities"],
    legacyPermissions: permissions.view === true ? ["health.view"] : [],
  };
}

describe("NUT-WEB-4C — Health read compatibility", () => {
  // Scenario A: canonical read, no legacy view.
  it("A. allows Health read with health.read alone", () => {
    expect(
      evaluateCapability(healthSession({ read: true }), "health.read").granted,
    ).toBe(true);
    expect(hasAccessPermission(healthProfile({ read: true }), "health", "read")).toBe(
      true,
    );
  });

  // Scenario B: legacy view only — temporary compatibility, deferred to NUT-WEB-6.
  it("B. allows Health read with legacy health.view alone (temporary)", () => {
    const decision = evaluateCapability(
      healthSession({ view: true }),
      "health.read",
    );
    expect(decision.granted).toBe(true);
    expect(decision.granted && decision.source).toBe("legacy_adapter");
  });

  // Scenario C: neither — fail closed.
  it("C. denies Health read without health.read and without health.view", () => {
    expect(
      evaluateCapability(healthSession({}), "health.read").granted,
    ).toBe(false);
    expect(
      evaluateCapability(
        healthSession({ read: false, view: false }),
        "health.read",
      ).granted,
    ).toBe(false);
    expect(
      hasAccessPermission(healthProfile({ read: false, view: false }), "health", "read"),
    ).toBe(false);
  });
});

describe("NUT-WEB-4C — Nutrition management authority", () => {
  // Scenario D: explicit grant is the only path to management.
  it("D. allows nutrition management with explicit manage_nutrition_plan", () => {
    expect(
      evaluateCapability(
        healthSession({ manage_nutrition_plan: true }),
        "health.manage_nutrition_plan",
      ).granted,
    ).toBe(true);
    expect(
      hasAccessPermission(
        healthProfile({ manage_nutrition_plan: true }),
        "health",
        "manage_nutrition_plan",
      ),
    ).toBe(true);
  });

  // Scenario E: legacy read compatibility must NOT leak into writes.
  it("E. denies nutrition management when only health.view is present", () => {
    const session = healthSession({ view: true });
    expect(evaluateCapability(session, "health.read").granted).toBe(true);
    expect(
      evaluateCapability(session, "health.manage_nutrition_plan").granted,
    ).toBe(false);
    expect(
      hasAccessPermission(
        healthProfile({ view: true }),
        "health",
        "manage_nutrition_plan",
      ),
    ).toBe(false);
  });

  // Scenario F: canonical read is not write authority either.
  it("F. denies nutrition management when only health.read is present", () => {
    const session = healthSession({ read: true });
    expect(evaluateCapability(session, "health.read").granted).toBe(true);
    expect(
      evaluateCapability(session, "health.manage_nutrition_plan").granted,
    ).toBe(false);
    expect(
      hasAccessPermission(
        healthProfile({ read: true }),
        "health",
        "manage_nutrition_plan",
      ),
    ).toBe(false);
  });

  // Scenario G: health.edit is expressly forbidden as a fallback.
  it("G. denies nutrition management from health.edit", () => {
    const profile = healthProfile({ view: true, read: true, edit: true });
    expect(hasAccessPermission(profile, "health", "edit")).toBe(true);
    expect(
      hasAccessPermission(profile, "health", "manage_nutrition_plan"),
    ).toBe(false);
    expect(
      evaluateCapability(
        healthSession({ view: true, read: true, edit: true }),
        "health.manage_nutrition_plan",
      ).granted,
    ).toBe(false);
  });

  // Scenario H: invalid/inactive/indeterminate session or profile → fail closed.
  it("H. fails closed for inactive profile and for absent session", () => {
    expect(
      hasAccessPermission(
        healthProfile({ manage_nutrition_plan: true }, "inactive"),
        "health",
        "manage_nutrition_plan",
      ),
    ).toBe(false);
    expect(
      hasAccessPermission(null, "health", "manage_nutrition_plan"),
    ).toBe(false);
    expect(
      hasAccessPermission(undefined, "health", "read"),
    ).toBe(false);

    const noSession = evaluateCapability(
      healthSession({ manage_nutrition_plan: true }, null),
      "health.manage_nutrition_plan",
    );
    expect(noSession.granted).toBe(false);
    expect(!noSession.granted && noSession.reason).toBe("no_session");
  });

  // Scenario I: unknown capabilities gain nothing via alias or fallback.
  it("I. denies unknown capabilities and grants no write by alias", () => {
    const profile = healthProfile({
      view: true,
      read: true,
      future_health_action: true,
    });
    expect(
      hasAccessPermission(profile, "health", "manage_nutrition_plan"),
    ).toBe(false);
    expect(
      hasAccessPermission(
        profile,
        "health",
        "totally_unknown_action" as never,
      ),
    ).toBe(false);

    // A session carrying an unrecognised capability string must not be
    // upgraded into nutrition management.
    const session: SessionCapabilities = {
      sessionId: "session-nut-4c",
      explicitCapabilities: [],
      legacyPermissions: [],
    };
    expect(
      evaluateCapability(session, "health.manage_nutrition_plan").granted,
    ).toBe(false);
  });
});

describe("NUT-WEB-4C — default profiles keep existing read access", () => {
  it("grants manage_nutrition_plan only to gestor and administrador", () => {
    const expected: Record<string, boolean> = {
      operador_k9: false,
      instrutor_k9: false,
      almoxarifado: false,
      gestor: true,
      administrador: true,
    };

    for (const [profileId, canManage] of Object.entries(expected)) {
      const profile = getDefaultAccessProfile(profileId)!;
      expect(
        hasAccessPermission(profile, "health", "manage_nutrition_plan"),
      ).toBe(canManage);
    }
  });

  it("never removes legacy health.view from a profile that already had it", () => {
    // The v6 policy is additive: every profile that had `view` keeps it, so no
    // reader loses access purely because canonical `read` was introduced.
    for (const profileId of [
      "operador_k9",
      "instrutor_k9",
      "gestor",
      "administrador",
    ]) {
      const profile = getDefaultAccessProfile(profileId)!;
      expect(hasAccessPermission(profile, "health", "view")).toBe(true);
      expect(hasAccessPermission(profile, "health", "read")).toBe(true);
    }
  });

  it("leaves a module without Health grants fully denied", () => {
    const almoxarifado = getDefaultAccessProfile("almoxarifado")!;
    expect(hasAccessPermission(almoxarifado, "health", "view")).toBe(false);
    expect(hasAccessPermission(almoxarifado, "health", "read")).toBe(false);
    expect(
      hasAccessPermission(almoxarifado, "health", "manage_nutrition_plan"),
    ).toBe(false);
  });
});
