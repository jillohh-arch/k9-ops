/**
 * Clinical Page
 *
 * Route: /health/clinical
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §16 (Clínico)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.4 (Clinical Cases)
 */
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { LoadingState } from "@/features/health/presentation/components/health-technical-states";

export default function HealthClinicalPage() {
  return (
    <HealthModuleShell
      title="Clínico"
      description="Casos clínicos e acompanhamento"
      activeNavKey="clinical"
    >
      {/* TODO Future: Implement Clinical content */}
      <LoadingState message="Carregando casos clínicos..." />
    </HealthModuleShell>
  );
}
