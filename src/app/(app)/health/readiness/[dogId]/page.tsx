/**
 * Readiness Cockpit Page
 *
 * Route: /health/readiness/[dogId]
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §14 (Cockpit individual)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.2 (Readiness)
 */
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { LoadingState } from "@/features/health/presentation/components/health-technical-states";

interface Props {
  params: Promise<{ dogId: string }>;
}

export default async function ReadinessCockpitPage({ params }: Props) {
  const { dogId } = await params;
  const decodedDogId = decodeURIComponent(dogId);

  return (
    <HealthModuleShell
      title="Prontidão do K9"
      description={`Detalhes de ${decodedDogId}`}
      dogContext={{
        id: decodedDogId,
        name: decodedDogId,
      }}
      showNavigation={true}
    >
      {/* TODO HW-3: Implement individual readiness cockpit */}
      <LoadingState message={`Carregando prontidão de ${decodedDogId}...`} />
    </HealthModuleShell>
  );
}
