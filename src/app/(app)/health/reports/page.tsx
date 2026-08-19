/**
 * Reports Page
 *
 * Route: /health/reports
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §25 (Relatórios)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.13 (Reports)
 */
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { LoadingState } from "@/features/health/presentation/components/health-technical-states";

export default function HealthReportsPage() {
  return (
    <HealthModuleShell
      title="Relatórios"
      description="Análises e exportações autorizadas"
      activeNavKey="reports"
    >
      {/* TODO Future: Implement Reports content */}
      <LoadingState message="Carregando relatórios..." />
    </HealthModuleShell>
  );
}
