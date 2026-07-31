"use client";

import type { ReactNode } from "react";

import { K9OpsLoadingScreen } from "@/components/feedback/k9-ops-loading-screen";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useAuth } from "@/features/auth/providers/auth-provider";
import type { HealthCapability } from "@/features/health/domain/capabilities";
import {
  HealthPermissionBoundary,
  evaluateCapability,
  type SessionCapabilities,
} from "@/features/health/domain/permissions";

const canonicalCapabilities = new Set<HealthCapability>([
  "health.read",
  "health.record_routine",
  "health.record_preventive",
  "health.record_incident",
  "health.record_clinical_document",
  "health.request_exam",
  "health.interpret_exam",
  "health.create_treatment",
  "health.administer_dose",
  "health.complete_treatment",
  "health.issue_restriction",
  "health.release_restriction",
  "health.discharge_case",
  "health.reopen_case",
  "health.cancel_case",
  "health.schedule_item",
  "health.manage_schedule",
  "health.cancel_record",
  "health.amend_record",
  "health.manage_nutrition_plan",
  "health.audit",
]);

function toHealthSession(
  sessionId: string | null,
  permissions: Record<string, boolean> | undefined,
): SessionCapabilities {
  const explicitCapabilities = Object.entries(permissions ?? {})
    .filter(([, enabled]) => enabled === true)
    .map(([action]) => `health.${action}`)
    .filter((capability): capability is HealthCapability =>
      canonicalCapabilities.has(capability as HealthCapability),
    );

  return {
    sessionId,
    explicitCapabilities,
    legacyPermissions: permissions?.view === true ? ["health.view"] : [],
  };
}

export default function HealthLayout({ children }: { children: ReactNode }) {
  const { profile: authProfile } = useAuth();
  const { profile, status } = useAccessControl();

  if (status === "loading") {
    return <K9OpsLoadingScreen stage="validatingAccess" progress={0.72} />;
  }

  const healthPermissions = profile.permissions.health as
    | Record<string, boolean>
    | undefined;
  const session = toHealthSession(authProfile?.uid ?? null, healthPermissions);
  const decision = evaluateCapability(session, "health.read");
  const source = decision.granted ? decision.source : "none";

  return (
    <div
      data-health-has-canonical-read={String(
        session.explicitCapabilities.includes("health.read"),
      )}
      data-health-has-legacy-view={String(
        session.legacyPermissions.includes("health.view"),
      )}
      data-health-permission-source={source}
      data-testid="health-permission-boundary"
    >
      <HealthPermissionBoundary
        requiredCapability="health.read"
        session={session}
      >
        {children}
      </HealthPermissionBoundary>
    </div>
  );
}
