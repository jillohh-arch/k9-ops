"use client";

/**
 * K9 Ops Web — Health Web v1 HW-8 Overview / CT3.AUTH-HEALTH-01
 * Strict canonical Health Overview read authority hook.
 *
 * RATIFIED CONTRACT CT3.AUTH-HEALTH-01:
 * - F10 persisted authorization contract: `permissions.health.view == true`
 *   satisfies the F20 semantic/domain capability `health.read`.
 * - `health.read` remains a valid F20 DOMAIN CAPABILITY name.
 * - No `read` action is added to F10 schema. The runtime adapter is:
 *   F10 `health.view === true` => canonical domain read authority (`health.read`).
 * - Profile status MUST be "active".
 * - Fail-closed: while status !== "allowed", NO Overview data reads may be started.
 * - NO client-side admin/role bypass. An administrator profile is authorized
 *   only if it actually carries `health.view === true`.
 */

import { useMemo } from "react";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import type { HealthCapability } from "../../domain/capabilities";

export const OVERVIEW_READ_CAPABILITY: HealthCapability = "health.read";

export interface HealthOverviewReadAuthority {
  status: "loading" | "allowed" | "forbidden";
  canRead: boolean;
  requiredCapability: HealthCapability;
  hasLegacyViewOnly: boolean;
}

function rawHealthPermissions(
  permissions: unknown,
): Record<string, unknown> | null {
  if (!permissions || typeof permissions !== "object") return null;
  const health = (permissions as Record<string, unknown>).health;
  if (!health || typeof health !== "object") return null;
  return health as Record<string, unknown>;
}

export function useHealthOverviewReadAuthority(): HealthOverviewReadAuthority {
  const { profile, status } = useAccessControl();

  return useMemo<HealthOverviewReadAuthority>(() => {
    const health = rawHealthPermissions(profile?.permissions);
    // Strict identity check: only literal boolean true grants read.
    // CT3.AUTH-HEALTH-01: F10 persisted grant health.view satisfies domain health.read.
    const hasCanonicalRead = health?.view === true;

    if (status === "loading") {
      return {
        status: "loading",
        canRead: false,
        requiredCapability: OVERVIEW_READ_CAPABILITY,
        hasLegacyViewOnly: false,
      };
    }

    const profileActive = profile?.status === "active";

    if (!profileActive || !hasCanonicalRead) {
      return {
        status: "forbidden",
        canRead: false,
        requiredCapability: OVERVIEW_READ_CAPABILITY,
        hasLegacyViewOnly: false,
      };
    }

    return {
      status: "allowed",
      canRead: true,
      requiredCapability: OVERVIEW_READ_CAPABILITY,
      hasLegacyViewOnly: false,
    };
  }, [profile, status]);
}
