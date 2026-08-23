"use client";

/**
 * K9 Ops Web — Health Web v1 HW-6A.I3
 * /health/clinical — Clinical case list main screen.
 *
 * This page only wires the Health module shell to the Clinical presentation
 * view. It adds NO route, NO data access and NO logic of its own: the view owns
 * the read state, the technical states and the list. Read-only by construction.
 */

import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { ClinicalView } from "@/features/health/clinical/presentation/clinical-view";

export default function HealthClinicalPage() {
  return (
    <HealthModuleShell
      title="Clínico"
      description="Casos clínicos e acompanhamento"
      activeNavKey="clinical"
    >
      <ClinicalView />
    </HealthModuleShell>
  );
}
