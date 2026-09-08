"use client";

/**
 * K9 Ops Web — Health Web v1 HW-5 Readiness
 * Strict canonical Readiness read authority hook.
 *
 * Enforces the strict capability boundary:
 * - `health.read === true` is the ONLY capability that grants Readiness read authority.
 * - `health.view === true` without `health.read === true` is explicitly REJECTED (hasLegacyViewOnly).
 * - Profile status MUST be "active".
 * - Fail-closed: while status !== "allowed", NO Readiness data reads may be started.
 */

import { useMemo } from "react";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import type { HealthCapability } from "../../domain/capabilities";

export const READINESS_READ_CAPABILITY: HealthCapability = "health.read";

export interface ReadinessReadAuthority {
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

export function useReadinessReadAuthority(): ReadinessReadAuthority {
  const { profile, status } = useAccessControl();

  return useMemo<ReadinessReadAuthority>(() => {
    const health = rawHealthPermissions(profile?.permissions);
    // Strict identity check: only literal boolean true grants read.
    const hasCanonicalRead = health?.read === true;
    const hasLegacyView = health?.view === true;

    if (status === "loading") {
      return {
        status: "loading",
        canRead: false,
        requiredCapability: READINESS_READ_CAPABILITY,
        hasLegacyViewOnly: false,
      };
    }

    const profileActive = profile?.status === "active";

    if (!profileActive || !hasCanonicalRead) {
      return {
        status: "forbidden",
        canRead: false,
        requiredCapability: READINESS_READ_CAPABILITY,
        hasLegacyViewOnly: hasLegacyView && !hasCanonicalRead,
      };
    }

    return {
      status: "allowed",
      canRead: true,
      requiredCapability: READINESS_READ_CAPABILITY,
      hasLegacyViewOnly: false,
    };
  }, [profile, status]);
}
