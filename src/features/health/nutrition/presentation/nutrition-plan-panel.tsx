"use client";

/**
 * K9 Ops Web — Health Web v1 / WEB-01B.2
 * Read-only Nutrition orchestrator for the individual K9 route.
 *
 * Deliberately NOT a port of the pre-Foundation `nutrition-plan-management`,
 * which owned `useAccessControl`, `useEntities`, its own dog selector and the
 * management actions — all of which collide with the Foundation. This component
 * does exactly three things:
 *
 *   receive dogId -> useNutritionPlans(dogId) -> map read model to UI
 *
 * No write authorization, no dog selector, no routing, no mutation state.
 * Read authorization comes from the Health layout boundary (`health.read`);
 * no parallel boundary is introduced here.
 */

import {
  ConflictState,
  EmptyState,
  ErrorState,
  LegacyState,
  LoadingState,
  PartialState,
} from "../../presentation/components/health-technical-states";
import { useNutritionPlans } from "../hooks/use-nutrition-plans";
import { NutritionPlanCanonicalCard } from "./nutrition-plan-canonical-card";
import { NutritionPlanLegacyCard } from "./nutrition-plan-legacy-card";
import { resolveNutritionView } from "./nutrition-read-state-view";
import type { LegacyNutritionPlanView, NutritionPlan } from "../types";

export function NutritionPlanPanel({ dogId }: { dogId: string }) {
  const state = useNutritionPlans(dogId);
  const decision = resolveNutritionView(state);

  switch (decision.kind) {
    case "loading":
      return <LoadingState message="Carregando plano alimentar..." />;

    /*
     * Covers both a canonical read failure and the WEB-01B.1R fail-closed
     * legacy listener failures, plus the inherited `empty` + non-null error
     * contract. A read failure must never be rendered as "no plan".
     */
    case "error":
      return (
        <ErrorState
          code="firestore-read-error"
          message={decision.message ?? ""}
          retryable={false}
        />
      );

    case "conflict":
      return <ConflictState conflictDescription={decision.message ?? ""} />;

    case "degraded":
      return (
        <PartialState failedSources={["Registros de nutrição"]}>
          <DegradedContent state={state} />
        </PartialState>
      );

    case "canonical":
      return <NutritionPlanCanonicalCard plan={state.activePlan as NutritionPlan} />;

    case "legacy":
      return (
        <LegacyState source={state.legacyPlan?.legacySource ?? "prescrição anterior"}>
          <NutritionPlanLegacyCard plan={state.activePlan as LegacyNutritionPlanView} />
        </LegacyState>
      );

    /*
     * Proven absence only: `empty` with error === null. No "Criar plano"
     * affordance in this phase, not even for a manager.
     */
    case "empty":
      return (
        <EmptyState
          title="Nenhum plano alimentar ativo"
          description="Este K9 não possui plano alimentar vigente registrado."
        />
      );
  }
}

/**
 * Degraded keeps whatever authority was still provable visible; when nothing
 * usable remains, it states that without inventing an absence. Raw
 * `parsingErrors` are never dumped into the interface.
 */
function DegradedContent({
  state,
}: {
  state: ReturnType<typeof useNutritionPlans>;
}) {
  const plan = state.activePlan;
  if (plan === null) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Não foi possível exibir o plano alimentar deste K9 com segurança.
      </p>
    );
  }
  if (state.legacyPlan !== null) {
    return <NutritionPlanLegacyCard plan={plan as LegacyNutritionPlanView} />;
  }
  return <NutritionPlanCanonicalCard plan={plan as NutritionPlan} />;
}
