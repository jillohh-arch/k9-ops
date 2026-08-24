/**
 * Readiness Cockpit Page
 *
 * Route: /health/readiness/[dogId]
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §14 (Cockpit individual)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.2 (Readiness)
 * - Approved mockups HW-M03 (desktop) / HW-M06 (tablet)
 *
 * Read authorization comes from the Health layout boundary (`health.read`); no
 * new capability is introduced here.
 */
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { HealthCockpitView } from "@/features/health/presentation/components/health-cockpit-view";

interface Props {
  params: Promise<{ dogId: string }>;
}

export default async function ReadinessCockpitPage({ params }: Props) {
  const { dogId } = await params;
  const decodedDogId = decodeURIComponent(dogId);

  return (
    <HealthModuleShell
      title="Prontidão do K9"
      activeNavKey="readiness"
      /*
       * The cockpit renders its own full identity region (dog photo, name,
       * matrícula, readiness), so the shell's title row and its dogContext card
       * are both suppressed — otherwise the page would stack two competing
       * identity blocks, the duplication HW-UX-01 removed from /health and
       * /health/readiness. The raw dogId is never shown as a display name.
       */
      hideModuleHeading
      showNavigation
    >
      <HealthCockpitView dogId={decodedDogId} />
    </HealthModuleShell>
  );
}
