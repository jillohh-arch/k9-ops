"use client";

/**
 * K9 Ops Web — Health Web v1 HW-6A.I2
 * STRICT canonical Clinical read authority boundary.
 *
 * WHY THIS EXISTS (I2 §9, §10, §13, §14):
 * The Health shell (`app/(app)/health/layout.tsx`) grants entry through a
 * LEGACY COMPATIBILITY adapter: it seeds `legacyPermissions: ["health.view"]`
 * and `evaluateCapability` accepts `health.view` as a substitute for
 * `health.read`. That adapter is correct for the Health hub, but it is NOT
 * Clinical authority. A profile holding only `health.view` can therefore cross
 * the shell and reach this feature.
 *
 * Clinical read requires the EXPLICIT canonical capability, mirroring Front 20
 * `hasClinicalReadAuthority()` (firestore.rules @ f98952c), which reads the
 * live access profile grant with NO admin bypass.
 *
 * HARD RULES ENFORCED HERE:
 * - Authority is `profile.permissions.health.read === true`, read RAW off the
 *   access-control profile. Nothing else grants it.
 * - `health.view` NEVER grants Clinical read.
 * - `hasAccessPermission(...)` is deliberately NOT used: its `health` +
 *   `view` branch treats canonical read as satisfying legacy view, and routing
 *   Clinical authority through a shared compatibility helper would couple this
 *   boundary to a decision it must not inherit.
 * - `evaluateCapability(...)` is deliberately NOT used: it can resolve a grant
 *   from `legacyPermissions`.
 * - NO client-side admin/role bypass. An administrator profile is authorized
 *   only if it actually carries `health.read`.
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
   * True when the profile carries the LEGACY `health.view` grant while lacking
   * canonical `health.read`. Diagnostic only: it never softens the decision,
   * but it lets a consumer explain WHY access stops here after the shell
   * already let the user in.
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
    const hasCanonicalRead = health?.read === true;
    const hasLegacyView = health?.view === true;

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
        hasLegacyViewOnly: hasLegacyView && !hasCanonicalRead,
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
