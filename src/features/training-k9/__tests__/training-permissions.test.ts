import { describe, expect, it } from "vitest";

import {
  hasAccessPermission,
  type AccessPermissionMap,
} from "@/lib/permissions/access-control";

function makeProfile(permissions: AccessPermissionMap) {
  return { permissions, status: "active" as const };
}

describe("Training module permissions (OR logic)", () => {
  describe("sidebar and route access", () => {
    it("grants access with only training permission", () => {
      const profile = makeProfile({ training: { view: true } });
      const modules = ["training", "training_matrix"] as const;
      const canAccess = modules.some((m) => hasAccessPermission(profile, m, "view"));
      expect(canAccess).toBe(true);
    });

    it("grants access with only training_matrix permission", () => {
      const profile = makeProfile({ training_matrix: { view: true } });
      const modules = ["training", "training_matrix"] as const;
      const canAccess = modules.some((m) => hasAccessPermission(profile, m, "view"));
      expect(canAccess).toBe(true);
    });

    it("grants access with both permissions", () => {
      const profile = makeProfile({
        training: { view: true },
        training_matrix: { view: true },
      });
      const modules = ["training", "training_matrix"] as const;
      const canAccess = modules.some((m) => hasAccessPermission(profile, m, "view"));
      expect(canAccess).toBe(true);
    });

    it("blocks access with no training permissions", () => {
      const profile = makeProfile({ dashboard: { view: true } });
      const modules = ["training", "training_matrix"] as const;
      const canAccess = modules.some((m) => hasAccessPermission(profile, m, "view"));
      expect(canAccess).toBe(false);
    });

    it("blocks access for inactive profile even with permissions", () => {
      const profile = { permissions: { training: { view: true } }, status: "inactive" as const };
      const modules = ["training", "training_matrix"] as const;
      const canAccess = modules.some((m) => hasAccessPermission(profile, m, "view"));
      expect(canAccess).toBe(false);
    });
  });

  describe("action-specific permissions", () => {
    it("allows matrix edit only with edit permission", () => {
      const profileWithEdit = makeProfile({ training: { view: true, edit: true } });
      const profileViewOnly = makeProfile({ training: { view: true } });

      const canEdit = (p: ReturnType<typeof makeProfile>) =>
        hasAccessPermission(p, "training", "edit") ||
        hasAccessPermission(p, "training_matrix", "edit");

      expect(canEdit(profileWithEdit)).toBe(true);
      expect(canEdit(profileViewOnly)).toBe(false);
    });

    it("allows evaluation approval only with approve permission", () => {
      const profileWithApprove = makeProfile({ training: { view: true, approve: true } });
      const profileViewOnly = makeProfile({ training: { view: true } });

      const canApprove = (p: ReturnType<typeof makeProfile>) =>
        hasAccessPermission(p, "training", "approve") ||
        hasAccessPermission(p, "training_matrix", "approve");

      expect(canApprove(profileWithApprove)).toBe(true);
      expect(canApprove(profileViewOnly)).toBe(false);
    });

    it("allows approve via training_matrix module", () => {
      const profile = makeProfile({ training_matrix: { view: true, approve: true } });

      const canApprove =
        hasAccessPermission(profile, "training", "approve") ||
        hasAccessPermission(profile, "training_matrix", "approve");

      expect(canApprove).toBe(true);
    });
  });
});
