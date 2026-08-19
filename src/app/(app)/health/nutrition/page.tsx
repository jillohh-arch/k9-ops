/**
 * Nutrition Page
 *
 * Route: /health/nutrition
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §20 (Nutrição)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §20 (Nutrition Architecture)
 *
 * Note: HW-5 (Nutrition Integration) will integrate existing nutrition features
 */
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { LoadingState } from "@/features/health/presentation/components/health-technical-states";

export default function HealthNutritionPage() {
  return (
    <HealthModuleShell
      title="Nutrição"
      description="Gestão de planos alimentares"
      activeNavKey="nutrition"
    >
      {/* TODO HW-5: Integrate existing nutrition features */}
      <LoadingState message="Carregando nutrição..." />
    </HealthModuleShell>
  );
}
