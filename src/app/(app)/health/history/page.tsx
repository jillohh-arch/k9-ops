/**
 * History Page
 *
 * Route: /health/history
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §24 (Histórico)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.12 (Timeline)
 */
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { HealthHistoryView } from "@/features/health/history/presentation/health-history-view";

export default function HealthHistoryPage() {
  return (
    <HealthModuleShell
      title="Histórico"
      description="Timeline unificada do domínio Health"
      activeNavKey="history"
    >
      <HealthHistoryView />
    </HealthModuleShell>
  );
}
