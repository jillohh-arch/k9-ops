/**
 * Health Permissions Tests
 *
 * Tests for permission evaluation:
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §32 (Authorization Architecture)
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §39 (Permissions and Visibility)
 */
import { describe, expect, it } from "vitest";
import {
  evaluateCapability,
  canReadHealth,
  isAuthenticated,
  hasLegacyHealthView,
  getLegacyReadCapabilities,
  createSessionWithCapability,
  createLegacyViewSession,
  createNoSession,
  createWriteLegacySession,
  EMPTY_SESSION,
  type SessionCapabilities,
  type PermissionGranted,
  type PermissionDenied,
} from "@/features/health/domain/permissions";

describe("Health Permissions", () => {
  describe("evaluateCapability", () => {
    describe("no session", () => {
      it("denies health.read when no session", () => {
        const session = createNoSession();
        const result = evaluateCapability(session, "health.read");
        expect(result.granted).toBe(false);
        const denied = result as PermissionDenied;
        expect(denied.reason).toBe("no_session");
      });

      it("denies any capability when no session", () => {
        const session = createNoSession();
        const result = evaluateCapability(session, "health.audit");
        expect(result.granted).toBe(false);
        const denied = result as PermissionDenied;
        expect(denied.reason).toBe("no_session");
      });
    });

    describe("health.read capability", () => {
      it("grants health.read with explicit capability", () => {
        const session = createSessionWithCapability("health.read");
        const result = evaluateCapability(session, "health.read");
        expect(result.granted).toBe(true);
        const granted = result as PermissionGranted;
        expect(granted.source).toBe("explicit");
      });

      it("grants health.read with legacy health.view", () => {
        const session = createLegacyViewSession();
        const result = evaluateCapability(session, "health.read");
        expect(result.granted).toBe(true);
        const granted = result as PermissionGranted;
        expect(granted.source).toBe("legacy_adapter");
      });

      it("denies health.read without explicit or legacy", () => {
        const session: SessionCapabilities = {
          sessionId: "test-123",
          legacyPermissions: [],
          explicitCapabilities: [],
        };
        const result = evaluateCapability(session, "health.read");
        expect(result.granted).toBe(false);
        const denied = result as PermissionDenied;
        expect(denied.reason).toBe("capability_not_granted");
      });
    });

    describe("write capabilities (fail-closed)", () => {
      it("denies record_routine without explicit grant", () => {
        const session = createLegacyViewSession();
        const result = evaluateCapability(session, "health.record_routine");
        expect(result.granted).toBe(false);
        const denied = result as PermissionDenied;
        expect(denied.reason).toBe("capability_not_granted");
      });

      it("denies create_treatment without explicit grant", () => {
        const session = createLegacyViewSession();
        const result = evaluateCapability(session, "health.create_treatment");
        expect(result.granted).toBe(false);
        const denied = result as PermissionDenied;
        expect(denied.reason).toBe("capability_not_granted");
      });

      it("denies manage_schedule without explicit grant", () => {
        const session = createLegacyViewSession();
        const result = evaluateCapability(session, "health.manage_schedule");
        expect(result.granted).toBe(false);
        const denied = result as PermissionDenied;
        expect(denied.reason).toBe("capability_not_granted");
      });

      it("denies audit without explicit grant", () => {
        const session = createLegacyViewSession();
        const result = evaluateCapability(session, "health.audit");
        expect(result.granted).toBe(false);
        const denied = result as PermissionDenied;
        expect(denied.reason).toBe("capability_not_granted");
      });

      it("grants record_routine with explicit capability", () => {
        const session = createSessionWithCapability("health.record_routine");
        const result = evaluateCapability(session, "health.record_routine");
        expect(result.granted).toBe(true);
        const granted = result as PermissionGranted;
        expect(granted.source).toBe("explicit");
      });

      it("grants manage_nutrition_plan with explicit capability", () => {
        const session = createSessionWithCapability("health.manage_nutrition_plan");
        const result = evaluateCapability(session, "health.manage_nutrition_plan");
        expect(result.granted).toBe(true);
        const granted = result as PermissionGranted;
        expect(granted.source).toBe("explicit");
      });
    });

    describe("legacy adapter constraints", () => {
      it("does NOT grant write capabilities via legacy adapter", () => {
        const session = createWriteLegacySession();
        // Legacy create/edit should NOT grant write capabilities
        const createResult = evaluateCapability(session, "health.record_routine");
        expect(createResult.granted).toBe(false);

        const editResult = evaluateCapability(session, "health.create_treatment");
        expect(editResult.granted).toBe(false);

        const scheduleResult = evaluateCapability(session, "health.manage_schedule");
        expect(scheduleResult.granted).toBe(false);
      });

      it("still grants health.read with legacy write permissions", () => {
        const session = createWriteLegacySession();
        const result = evaluateCapability(session, "health.read");
        expect(result.granted).toBe(true);
        const granted = result as PermissionGranted;
        expect(granted.source).toBe("legacy_adapter");
      });
    });
  });

  describe("canReadHealth", () => {
    it("returns true for session with health.read", () => {
      const session = createSessionWithCapability("health.read");
      expect(canReadHealth(session)).toBe(true);
    });

    it("returns true for session with legacy view", () => {
      const session = createLegacyViewSession();
      expect(canReadHealth(session)).toBe(true);
    });

    it("returns false for no session", () => {
      const session = createNoSession();
      expect(canReadHealth(session)).toBe(false);
    });

    it("returns false for session without health access", () => {
      const session: SessionCapabilities = {
        sessionId: "test-123",
        legacyPermissions: [],
        explicitCapabilities: ["health.manage_schedule"], // Some other capability
      };
      expect(canReadHealth(session)).toBe(false);
    });
  });

  describe("isAuthenticated", () => {
    it("returns true for authenticated session", () => {
      const session = createSessionWithCapability("health.read");
      expect(isAuthenticated(session)).toBe(true);
    });

    it("returns false for no session", () => {
      const session = createNoSession();
      expect(isAuthenticated(session)).toBe(false);
    });
  });

  describe("hasLegacyHealthView", () => {
    it("returns true for session with legacy health.view", () => {
      const session = createLegacyViewSession();
      expect(hasLegacyHealthView(session)).toBe(true);
    });

    it("returns false for session without legacy view", () => {
      const session = createSessionWithCapability("health.read");
      expect(hasLegacyHealthView(session)).toBe(false);
    });

    it("returns false for no session", () => {
      const session = createNoSession();
      expect(hasLegacyHealthView(session)).toBe(false);
    });
  });

  describe("getLegacyReadCapabilities", () => {
    it("returns health.read for legacy view session", () => {
      const session = createLegacyViewSession();
      const caps = getLegacyReadCapabilities(session);
      expect(caps).toContain("health.read");
      expect(caps).toHaveLength(1);
    });

    it("returns empty for no legacy view", () => {
      const session = createSessionWithCapability("health.read");
      const caps = getLegacyReadCapabilities(session);
      expect(caps).toHaveLength(0);
    });

    it("returns empty for no session", () => {
      const session = createNoSession();
      const caps = getLegacyReadCapabilities(session);
      expect(caps).toHaveLength(0);
    });
  });

  describe("EMPTY_SESSION", () => {
    it("has null sessionId", () => {
      expect(EMPTY_SESSION.sessionId).toBeNull();
    });

    it("has empty legacy permissions", () => {
      expect(EMPTY_SESSION.legacyPermissions).toHaveLength(0);
    });

    it("has empty explicit capabilities", () => {
      expect(EMPTY_SESSION.explicitCapabilities).toHaveLength(0);
    });
  });

  describe("fail-closed behavior", () => {
    it("denies capability not in session", () => {
      const session = createSessionWithCapability("health.read");
      // This capability is not in our session
      const result = evaluateCapability(session, "health.audit");
      expect(result.granted).toBe(false);
      const denied = result as PermissionDenied;
      expect(denied.reason).toBe("capability_not_granted");
    });

    it("no implicit grants from session existing", () => {
      const session: SessionCapabilities = {
        sessionId: "test-123",
        legacyPermissions: [],
        explicitCapabilities: [],
      };
      // Empty session should deny health.read
      expect(canReadHealth(session)).toBe(false);
      // But isAuthenticated returns true because session exists
      expect(isAuthenticated(session)).toBe(true);
    });
  });
});
