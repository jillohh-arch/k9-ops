/**
 * Readiness Page
 *
 * Route: /health/readiness
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §13 (Prontidão)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.2 (Readiness subdomain)
 */
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { LoadingState } from "@/features/health/presentation/components/health-technical-states";

export default function HealthReadinessPage() {
  return (
    <HealthModuleShell
      title="Prontidão"
      description="Estado operacional de todos os K9s"
      activeNavKey="readiness"
    >
      {/* TODO HW-3: Implement Readiness content */}
      <LoadingState message="Carregando prontidão..." />
    </HealthModuleShell>
  );
}
