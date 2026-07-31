/**
 * Health Overview Page
 *
 * Route: /health
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §12 (Visão Geral)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.1 (Overview subdomain)
 */
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { LoadingState } from "@/features/health/presentation/components/health-technical-states";

export default function HealthOverviewPage() {
  return (
    <HealthModuleShell
      title="Saúde e Prontidão"
      description="Visão geral do efetivo K9"
    >
      {/* TODO HW-3: Implement Overview content */}
      <LoadingState message="Carregando visão geral..." />
    </HealthModuleShell>
  );
}
