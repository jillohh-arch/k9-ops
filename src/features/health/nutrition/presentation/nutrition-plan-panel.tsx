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

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
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
import { NutritionPlanCreateDialog } from "./nutrition-plan-create-dialog";
import { NutritionPlanLegacyCard } from "./nutrition-plan-legacy-card";
import { NutritionPlanEditDialog } from "./nutrition-plan-edit-dialog";
import { NutritionPlanReplaceDialog } from "./nutrition-plan-replace-dialog";
import {
  canOfferNutritionCreate,
  canOfferNutritionEdit,
  canOfferNutritionReplace,
  resolveNutritionView,
} from "./nutrition-read-state-view";
import type { LegacyNutritionPlanView, NutritionPlan } from "../types";

export function NutritionPlanPanel({
  dogId,
  dogName,
}: {
  dogId: string;
  dogName?: string | null;
}) {
  const state = useNutritionPlans(dogId);
  const decision = resolveNutritionView(state);

  /*
   * WEB-01B.4 — write authorization.
   *
   * `manage_nutrition_plan` must be granted explicitly on an active profile:
   * `hasAccessPermission` requires `permissions.health.manage_nutrition_plan
   * === true`, so the legacy `health.view -> health.read` adapter can never
   * satisfy it. Read access alone never yields a write affordance.
   */
  const { can } = useAccessControl();
  const canManage = can("health", "manage_nutrition_plan");
  const [createOpen, setCreateOpen] = useState(false);

  /*
   * WEB-01B.4 — post-success reconciliation latch.
   *
   * A successful CREATE returns before the realtime reader emits the new plan,
   * so for a few milliseconds the read model still says `empty`. Without this
   * latch the affordance would come straight back and a second CREATE — with a
   * NEW operationId, so not a replay — would be reachable against a K9 that
   * already has a plan. The backend would refuse it as active-plan-conflict,
   * but the operator should never be offered the action in the first place.
   *
   * Deliberately NOT a fabricated plan and NOT a cache write: the reader stays
   * the only authority. This only withholds the affordance until the reader
   * leaves the pre-mutation `empty` snapshot, in any direction (canonical,
   * legacy, conflict, degraded or error).
   *
   * WEB-01B.6R widened what engages this latch, not what it does. Three outcomes
   * are now distinguished at the dialog boundary:
   *
   *   SUCCESS            — response verified; the plan exists
   *   NORMAL FAILURE     — backend refused; the snapshot is still the truth
   *   OUTCOME UNCERTAIN  — backend said success, client could not verify it
   *
   * The first and third both engage the latch, because both mean the snapshot
   * on screen may already be obsolete. The second deliberately does not: freezing
   * the UI after a permission-denied or a revision-conflict would penalize an
   * operation that provably never landed.
   */
  const [pendingReconciliation, setPendingReconciliation] = useState(false);
  const [latchedDogId, setLatchedDogId] = useState(dogId);

  // Re-baseline during render when the route dog changes, so a latch from the
  // previous K9 never suppresses the affordance for the new one.
  if (dogId !== latchedDogId) {
    setLatchedDogId(dogId);
    setPendingReconciliation(false);
  }

  // The reader has moved on: the latch has served its purpose.
  if (pendingReconciliation && decision.kind !== "empty") {
    setPendingReconciliation(false);
  }

  // Capability AND a provably writable read state AND no mutation awaiting
  // reconciliation (see canOfferNutritionCreate).
  const offerCreate =
    canOfferNutritionCreate(decision, canManage) && !pendingReconciliation;

  /*
   * WEB-01B.5 — administrative UPDATE, with its own temporal seam.
   *
   * The CREATE seam was "the reader still says empty". The UPDATE seam is
   * different: two revisions coexist for a moment — the one the backend just
   * confirmed, and the older one the realtime reader is still showing. Reopening
   * EDIT in that window would freeze `expectedRevision` at the superseded value,
   * so the next submit would be refused as revision-conflict. Not data
   * corruption, but a guaranteed dead end offered to the operator.
   *
   * The latch is keyed on the exact snapshot it was created against
   * (planId + the revision the reader was showing), so it releases as soon as
   * the reader reports anything else. Same discipline as B.4: no fabricated
   * plan, no cache write, reader remains the authority.
   */
  const [editOpen, setEditOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{
    planId: string;
    staleRevision: number;
  } | null>(null);

  if (dogId !== latchedDogId) {
    setPendingUpdate(null);
  }

  const activeCanonical =
    decision.kind === "canonical" ? (state.activePlan as NutritionPlan) : null;

  // Release once the reader stops showing the superseded snapshot — whether it
  // advanced the revision, swapped the plan, or left canonical entirely.
  if (
    pendingUpdate !== null &&
    (activeCanonical === null ||
      activeCanonical.id !== pendingUpdate.planId ||
      activeCanonical.revision !== pendingUpdate.staleRevision)
  ) {
    setPendingUpdate(null);
  }

  /*
   * WEB-01B.6 — structural REPLACE, and the sharpest temporal seam so far.
   *
   * CREATE's seam was "the reader still says empty". UPDATE's was "the reader
   * still shows the superseded revision of the SAME plan". REPLACE's is worse:
   * the backend has already superseded plan A and activated plan B, but the
   * reader may still be showing A as active. In that window the interface is
   * asserting something false — A is not the active plan any more.
   *
   * Offering EDIT or REPLACE there would freeze an expectation pair against a
   * plan that is already `superseded`, so the next submit is a guaranteed
   * conflict. The pre-Foundation source left both actions live in exactly this
   * window; that gap is closed here.
   *
   * Keyed on the snapshot that DIED, so it releases as soon as the reader stops
   * showing it — whether it advances to plan B, leaves canonical, or reports a
   * conflict. `newPlanId` is retained only as reconciliation evidence: it is
   * never used to fabricate a card, seed the read model, or claim plan B exists
   * before the reader says so (§28). The reader stays the only authority.
   *
   * WEB-01B.6R makes `newPlanId` optional rather than required. An unverifiable
   * response cannot supply it — its `planId` is exactly the field we refused to
   * trust — and the latch never needed it: the release condition reads only the
   * superseded snapshot. Requiring it would have forced the uncertain path to
   * invent a value, which is the fabrication this whole discipline forbids.
   */
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [pendingReplace, setPendingReplace] = useState<{
    supersededPlanId: string;
    supersededRevision: number;
    newPlanId?: string;
  } | null>(null);

  if (dogId !== latchedDogId) {
    setPendingReplace(null);
  }

  if (
    pendingReplace !== null &&
    (activeCanonical === null ||
      activeCanonical.id !== pendingReplace.supersededPlanId ||
      activeCanonical.revision !== pendingReplace.supersededRevision)
  ) {
    setPendingReplace(null);
  }

  /*
   * Both latches gate both actions.
   *
   * A pending REPLACE withholds EDIT because the plan on screen is dead — there
   * is nothing valid to patch. A pending UPDATE withholds REPLACE because the
   * revision on screen is already superseded, so it cannot serve as
   * `expectedActiveRevision`. Either way the operator is not offered an action
   * the backend is certain to refuse.
   */
  const awaitingReconciliation = pendingUpdate !== null || pendingReplace !== null;

  const offerEdit = canOfferNutritionEdit(decision, canManage) && !awaitingReconciliation;
  const offerReplace =
    canOfferNutritionReplace(decision, canManage) && !awaitingReconciliation;

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

    /*
     * WEB-01B.5 / WEB-01B.6 — the only state offering administrative UPDATE and
     * structural REPLACE. No CANCEL affordance here: that is B.7.
     */
    case "canonical": {
      const plan = state.activePlan as NutritionPlan;
      return (
        <>
          <NutritionPlanCanonicalCard
            plan={plan}
            action={
              offerEdit || offerReplace ? (
                <>
                  {offerEdit && (
                    <Button
                      variant="secondary"
                      onClick={() => setEditOpen(true)}
                      data-testid="nutrition-edit-plan-action"
                    >
                      Editar
                    </Button>
                  )}
                  {offerReplace && (
                    <Button
                      variant="secondary"
                      onClick={() => setReplaceOpen(true)}
                      data-testid="nutrition-replace-plan-action"
                    >
                      Substituir plano
                    </Button>
                  )}
                </>
              ) : undefined
            }
          />
          {/*
            Gated on `canManage`, not on the full `offerEdit`/`offerReplace`:
            engaging either latch flips those to false, and an open dialog must
            not be torn down underneath a mutation in flight or reporting its
            result. A revoked capability does withdraw it.
          */}
          {editOpen && canManage && (
            <NutritionPlanEditDialog
              dogId={dogId}
              plan={plan}
              open={editOpen}
              onUpdated={() =>
                setPendingUpdate({ planId: plan.id, staleRevision: plan.revision })
              }
              /*
                Same latch, weaker premise. A confirmed UPDATE and an unverifiable
                one both mean the revision on screen may no longer be current, and
                that is the only thing this latch encodes. The dialog reports the
                snapshot it froze, so no resulting revision is invented.
              */
              onUpdateOutcomeUncertain={(stale) => setPendingUpdate(stale)}
              onClose={() => setEditOpen(false)}
            />
          )}
          {replaceOpen && canManage && (
            <NutritionPlanReplaceDialog
              dogId={dogId}
              plan={plan}
              open={replaceOpen}
              // The dialog reports the snapshot it actually sent expectations
              // for, which may already differ from the live plan.
              onReplaced={(outcome) => setPendingReplace(outcome)}
              /*
                Same latch, no `newPlanId`. The response was rejected, so it
                cannot say what replaced A — only that A may already be dead,
                which is what the release condition actually reads.
              */
              onReplaceOutcomeUncertain={(stale) =>
                setPendingReplace({
                  supersededPlanId: stale.planId,
                  supersededRevision: stale.staleRevision,
                })
              }
              onClose={() => setReplaceOpen(false)}
            />
          )}
        </>
      );
    }

    case "legacy":
      return (
        <LegacyState source={state.legacyPlan?.legacySource ?? "prescrição anterior"}>
          <NutritionPlanLegacyCard plan={state.activePlan as LegacyNutritionPlanView} />
        </LegacyState>
      );

    /*
     * Proven absence only: `empty` here already guarantees error === null, so
     * this is the single state where CREATE is offered (WEB-01B.4). The action
     * is composed through EmptyState's existing `action` prop — the shared
     * Foundation primitive is not modified for Nutrition.
     */
    case "empty":
      return (
        <>
          <EmptyState
            title="Nenhum plano alimentar ativo"
            description="Este K9 não possui plano alimentar vigente registrado."
            action={
              offerCreate ? (
                <Button
                  onClick={() => setCreateOpen(true)}
                  data-testid="nutrition-create-plan-action"
                >
                  Novo plano alimentar
                </Button>
              ) : undefined
            }
          />
          {/*
            Gated on `canManage`, NOT on the full `offerCreate`: engaging the
            reconciliation latch flips `offerCreate` to false, and an open dialog
            must not be torn down underneath a mutation that is in flight or
            reporting its result. Capability is different — if the write grant is
            revoked while the dialog is open, the surface goes away. The backend
            remains the final authority either way.
          */}
          {createOpen && canManage && (
            <NutritionPlanCreateDialog
              dogId={dogId}
              dogName={dogName}
              open={createOpen}
              onCreated={() => setPendingReconciliation(true)}
              /*
                Same latch, weaker premise: a plan MAY now exist. Either way the
                `empty` snapshot has stopped being trustworthy grounds for a
                second CREATE, which is all this latch withholds.
              */
              onCreateOutcomeUncertain={() => setPendingReconciliation(true)}
              onClose={() => setCreateOpen(false)}
            />
          )}
        </>
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
