/**
 * Audit Page
 *
 * Route: /health/audit
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §26 (Auditoria)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.14 (Audit)
 */
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { LoadingState } from "@/features/health/presentation/components/health-technical-states";

export default function HealthAuditPage() {
  return (
    <HealthModuleShell
      title="Auditoria"
      description="Trilha de ações do domínio Health"
    >
      {/* TODO Future: Implement Audit content */}
      <LoadingState message="Carregando auditoria..." />
    </HealthModuleShell>
  );
}
