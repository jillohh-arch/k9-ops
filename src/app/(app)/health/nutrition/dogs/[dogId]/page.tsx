/**
 * Nutrition Individual Page
 *
 * Route: /health/nutrition/dogs/[dogId]
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §20 (Nutrição)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §20 (Nutrition Architecture)
 *
 * The route param is the ONLY source of individual dog context — never a query
 * string, localStorage or a global selected dog. Follows the readiness cockpit
 * pattern: server page resolves the route param, the client view owns the reads.
 *
 * Read authorization comes from the Health layout boundary (`health.read`); no
 * new capability is introduced here. Read-only: no mutations in this phase.
 */
import { NutritionDogView } from "@/features/health/nutrition/presentation/nutrition-dog-view";

interface Props {
  params: Promise<{ dogId: string }>;
}

export default async function NutritionDogPage({ params }: Props) {
  const { dogId } = await params;
  const decodedDogId = decodeURIComponent(dogId);

  return <NutritionDogView dogId={decodedDogId} />;
}
