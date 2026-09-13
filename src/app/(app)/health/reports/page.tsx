"use client";

/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * /health/reports — Reports & Analytics executive screen.
 *
 * Route: /health/reports
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §25 (Relatórios)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.13 (Reports)
 */

import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { HealthReportsView } from "@/features/health/reports/presentation/health-reports-view";

export default function HealthReportsPage() {
  return (
    <HealthModuleShell
      title="Relatórios"
      description="Análises operacionais e exportações autorizadas"
      activeNavKey="reports"
    >
      <HealthReportsView />
    </HealthModuleShell>
  );
}
