"use client";

/**
 * K9 Ops Web — Health Web v1 HW-6A.I2 / CT3.AUTH-HEALTH-01
 * STRICT canonical Clinical read authority boundary.
 *
 * RATIFIED CONTRACT CT3.AUTH-HEALTH-01:
 * - F10 persisted authorization contract: `permissions.health.view == true`
 *   satisfies the F20 semantic/domain capability `health.read`.
 * - `health.read` remains a valid F20 DOMAIN CAPABILITY name.
 * - No `read` action is added to F10 schema. The runtime adapter is:
 *   F10 `health.view === true` => canonical domain read authority (`health.read`).
 *
 * HARD RULES ENFORCED HERE:
 * - Authority is `profile.permissions.health.view === true`, read RAW off the
 *   access-control profile. Nothing else grants it.
 * - `hasAccessPermission(...)` is deliberately NOT used: routing Clinical
 *   authority through a shared compatibility helper would couple this boundary
 *   to decisions it must not inherit.
 * - `evaluateCapability(...)` is deliberately NOT used: it can resolve a grant
 *   from `legacyPermissions`.
 * - NO client-side admin/role bypass. An administrator profile is authorized
 *   only if it actually carries `health.view === true`.
 * - Firestore Rules remain the FINAL per-dog authority. This hook is a
 *   fail-closed pre-gate that prevents a guaranteed-denied fan-out; it never
 *   claims to be sufficient.
 * - Read-only: this hook performs no Firestore access of its own.
 */

import { useMemo } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { CLINICAL_READ_CAPABILITY } from "../data/clinical-cases-reader";

/**
 * Tri-state authority. `loading` is distinct from `forbidden` on purpose:
 * an unresolved profile must never render as a denial, and must never be
 * treated as permission to read either.
 */
export type ClinicalReadAuthorityStatus = "loading" | "allowed" | "forbidden";

export interface ClinicalReadAuthority {
  status: ClinicalReadAuthorityStatus;
  /** True ONLY for `status === "allowed"`. The single gate for any read. */
  canRead: boolean;
  /** Canonical capability required — always `health.read`. */
  requiredCapability: string;
  /**
   * Diagnostic flag preserved for interface compatibility under CT3.AUTH-HEALTH-01.
   * Under ratified CT3.AUTH-HEALTH-01, health.view satisfies canonical health.read,
   * so this is always false.
   */
  hasLegacyViewOnly: boolean;
}

/**
 * Reads the raw `health` permission map off the canonical access profile.
 * Returns null when the profile shape carries no health module at all.
 */
function rawHealthPermissions(
  permissions: unknown,
): Record<string, unknown> | null {
  if (!permissions || typeof permissions !== "object") return null;
  const health = (permissions as Record<string, unknown>).health;
  if (!health || typeof health !== "object") return null;
  return health as Record<string, unknown>;
}

/**
 * Strict canonical Clinical read authority.
 *
 * Contract: while `status !== "allowed"`, NO Clinical read may be started.
 */
export function useClinicalReadAuthority(): ClinicalReadAuthority {
  const { profile, status } = useAccessControl();

  return useMemo<ClinicalReadAuthority>(() => {
    const health = rawHealthPermissions(profile?.permissions);
    // Strict identity check: only the literal boolean true grants read.
    // Truthy strings, 1, or "true" are NOT canonical grants.
    // CT3.AUTH-HEALTH-01: F10 persisted grant health.view satisfies domain health.read.
    const hasCanonicalRead = health?.view === true;

    if (status === "loading") {
      // Authority is not yet knowable. Fail closed WITHOUT rendering a denial.
      return {
        status: "loading",
        canRead: false,
        requiredCapability: CLINICAL_READ_CAPABILITY,
        hasLegacyViewOnly: false,
      };
    }

    // An inactive profile can never carry Clinical authority, regardless of
    // which grants its permission map still lists.
    const profileActive = profile?.status === "active";

    if (!profileActive || !hasCanonicalRead) {
      return {
        status: "forbidden",
        canRead: false,
        requiredCapability: CLINICAL_READ_CAPABILITY,
        hasLegacyViewOnly: false,
      };
    }

    return {
      status: "allowed",
      canRead: true,
      requiredCapability: CLINICAL_READ_CAPABILITY,
      hasLegacyViewOnly: false,
    };
  }, [profile, status]);
}
