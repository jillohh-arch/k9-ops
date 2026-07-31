/**
 * Health Module Layout
 *
 * Provides the HealthModuleShell wrapper for all /health/* routes.
 */
import { type ReactNode } from "react";
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { getHealthNavKey, type HealthNavItemKey } from "@/features/health/domain/paths";

interface HealthLayoutProps {
  children: ReactNode;
  params: Promise<{ dogId?: string }>;
}

const NAV_KEY_MAP: Record<string, HealthNavItemKey> = {
  "": "overview",
  "readiness": "readiness",
  "schedule": "schedule",
  "clinical": "clinical",
  "nutrition": "nutrition",
  "history": "history",
  "reports": "reports",
};

export default async function HealthLayout({ children, params }: HealthLayoutProps) {
  // Await params to get route information
  const { dogId } = await params;

  // Get current section from pathname
  // This is a workaround since we don't have direct access to pathname in server component
  // The actual active key detection happens in the client-side HealthSecondaryNavigation

  return (
    <HealthModuleShell
      showNavigation={!dogId}
      dogContext={dogId ? {
        id: dogId,
        name: "K9", // Will be populated from data
      } : undefined}
    >
      {children}
    </HealthModuleShell>
  );
}
