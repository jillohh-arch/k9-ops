"use client";

/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — RD-I4 / CT3.AUTH-HEALTH-01
 * STRICT canonical Schedule read authority boundary.
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
 * - `hasAccessPermission(...)` is deliberately NOT used: routing Schedule
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
 *
 * ── DERIVATION-ONLY (load-bearing scope boundary) ──────────────────────────
 * This hook DERIVES authority and nothing else. It performs no Firestore
 * access, starts no read, coordinates no loading and cancels nothing. It
 * therefore CANNOT enforce "no read before allowed" on its own — that timing
 * invariant belongs to the later orchestration layer that joins this hook with
 * `loadScheduleScope` (mirroring how `use-clinical-cases.ts` owns the gate for
 * Clinical, not `use-clinical-read-authority.ts`).
 *
 * Consumers MUST treat `status !== "allowed"` as "no Schedule read may start".
 */

import { useMemo } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { SCHEDULE_READ_CAPABILITY } from "../data/schedule-reader";

/**
 * Tri-state authority. `loading` is distinct from `forbidden` on purpose:
 * an unresolved profile must never render as a denial, and must never be
 * treated as permission to read either.
 */
export type ScheduleReadAuthorityStatus = "loading" | "allowed" | "forbidden";

export interface ScheduleReadAuthority {
  status: ScheduleReadAuthorityStatus;
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
 *
 * Intentionally duplicated from the frozen Clinical boundary, whose equivalent
 * helper is module-private. Exporting from Clinical to deduplicate would mean
 * editing a frozen surface for no behavioural gain.
 */
function rawHealthPermissions(permissions: unknown): Record<string, unknown> | null {
  if (!permissions || typeof permissions !== "object") return null;
  const health = (permissions as Record<string, unknown>).health;
  if (!health || typeof health !== "object") return null;
  return health as Record<string, unknown>;
}

/**
 * Strict canonical Schedule read authority.
 *
 * Contract: while `status !== "allowed"`, NO Schedule read may be started.
 */
export function useScheduleReadAuthority(): ScheduleReadAuthority {
  const { profile, status } = useAccessControl();

  return useMemo<ScheduleReadAuthority>(() => {
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
        requiredCapability: SCHEDULE_READ_CAPABILITY,
        hasLegacyViewOnly: false,
      };
    }

    // An inactive profile can never carry Schedule authority, regardless of
    // which grants its permission map still lists.
    const profileActive = profile?.status === "active";

    if (!profileActive || !hasCanonicalRead) {
      return {
        status: "forbidden",
        canRead: false,
        requiredCapability: SCHEDULE_READ_CAPABILITY,
        hasLegacyViewOnly: false,
      };
    }

    return {
      status: "allowed",
      canRead: true,
      requiredCapability: SCHEDULE_READ_CAPABILITY,
      hasLegacyViewOnly: false,
    };
  }, [profile, status]);
}
