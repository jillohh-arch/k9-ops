/**
 * Schedule Page
 *
 * Route: /health/schedule
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §15 (Agenda)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.3 (Preventive Schedule)
 */
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { LoadingState } from "@/features/health/presentation/components/health-technical-states";

export default function HealthSchedulePage() {
  return (
    <HealthModuleShell
      title="Agenda"
      description="Planejamento preventivo e operacional"
      activeNavKey="schedule"
    >
      {/* TODO HW-4: Implement Schedule content */}
      <LoadingState message="Carregando agenda..." />
    </HealthModuleShell>
  );
}
