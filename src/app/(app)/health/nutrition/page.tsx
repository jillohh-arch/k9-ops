/**
 * Nutrition Page
 *
 * Route: /health/nutrition
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §20 (Nutrição)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §20 (Nutrition Architecture)
 *
 * Submodule entry point (WEB-01B.2): lists the accessible K9s and navigates to
 * /health/nutrition/dogs/[dogId], which is the canonical individual context.
 * Plan management is not embedded here.
 *
 * Read authorization comes from the Health layout boundary (`health.read`); no
 * new capability is introduced here. Read-only: no mutations in this phase.
 */
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { NutritionLandingView } from "@/features/health/nutrition/presentation/nutrition-landing-view";

export default function HealthNutritionPage() {
  return (
    <HealthModuleShell
      title="Nutrição"
      description="Planos alimentares do efetivo"
      activeNavKey="nutrition"
    >
      <NutritionLandingView />
    </HealthModuleShell>
  );
}
