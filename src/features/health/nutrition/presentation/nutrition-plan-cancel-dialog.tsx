"use client";

/**
 * K9 Ops Web — Health Web v1 / WEB-01B.7
 * Lifecycle CANCEL for the active NutritionPlan.
 *
 * CANCEL IS NOT A DELETE. The backend keeps the same document and moves it
 * `active → cancelled` with `revision + 1` and the operator's reason recorded
 * (engine 1736-1770). Months later it must still be answerable which plan
 * existed, when it was ended, and why — so nothing here removes anything, and
 * the copy never says "excluir".
 *
 * No successor is created. After the reader reconciles, the read model decides
 * what the screen shows; this dialog makes no claim about what comes next.
 *
 * Transport is the canonical `healthNutritionCancelPlan` callable reached through
 * `useNutritionPlanMutations`. No Firestore access and no `httpsCallable` here.
 *
 * Inherits the WEB-01B.6R uncertain-outcome discipline: if the backend answers
 * `success: true` and the client cannot verify the response, the cancellation may
 * already be persisted, so this dialog locks its own submit instead of inviting a
 * retry that could act on an unknown state.
 */

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { isPotentiallyCommittedOutcome } from "../data/nutrition-plan-mutation-service";
import { requiresNutritionReaderReconciliation } from "../errors/nutrition-mutation-errors";
import { useNutritionPlanMutations } from "../hooks/use-nutrition-plan-mutations";
import type { NutritionPlan } from "../types";

/**
 * PURE — the reader moved the plan out from under an open dialog.
 *
 * Exported so the behaviour is testable without mounting, mirroring the
 * B.5/B.6 helpers. Also treats a plan that stopped being `active` as stale: it
 * may have been cancelled or superseded elsewhere, and either way the frozen
 * `expectedRevision` no longer describes something cancellable.
 */
export function shouldShowNutritionCancelStale(input: {
  mutationStatus: string;
  planId: string;
  planRevision: number;
  planStatus: string;
  initialPlanId: string;
  initialRevision: number;
}): boolean {
  // Once the mutation resolved, its own result explains any change.
  if (input.mutationStatus !== "idle" && input.mutationStatus !== "ready") return false;
  return (
    input.planId !== input.initialPlanId ||
    input.planRevision !== input.initialRevision ||
    input.planStatus !== "active"
  );
}

/**
 * PURE — a reason is mandatory and whitespace is not a reason.
 *
 * The backend rejects an empty `reason` (`buildCancelNutritionPlanRequest` throws
 * locally before transport), so this is validated here to give the operator a
 * direct answer instead of a round trip.
 */
export function isValidCancelReason(reason: string): boolean {
  return reason.trim().length > 0;
}

export interface NutritionPlanCancelDialogProps {
  dogId: string;
  plan: NutritionPlan;
  open: boolean;
  onClose: () => void;
  /**
   * Fired once the backend confirmed the cancellation, BEFORE the realtime reader
   * reports it. The caller withholds EDIT/REPLACE/CANCEL while the read model
   * still shows the plan as active, so no action is offered against a plan that is
   * already ended. Also fires for an idempotent replay (`wasNoOp`), which is a
   * confirmed cancellation just the same.
   *
   * Reports the FROZEN snapshot, not a synthesized `cancelled` state: the panel
   * needs to know which snapshot is now stale, nothing more.
   *
   * Success-only. Never fired for an unverifiable response — see
   * `onCancelOutcomeUncertain`.
   */
  onCancelled?: (staleSnapshot: { planId: string; staleRevision: number }) => void;
  /**
   * Fired when the backend answered `success: true` but the client could not
   * verify the response (`invalid-mutation-response`).
   *
   * Same payload as `onCancelled` and deliberately a different callback: we do NOT
   * know the plan was cancelled. We know it MAY have been, which is enough to stop
   * offering actions against the snapshot on screen.
   */
  onCancelOutcomeUncertain?: (staleSnapshot: {
    planId: string;
    staleRevision: number;
  }) => void;
  /**
   * Fired when the backend REFUSED this cancellation with an error that proves the
   * snapshot on screen is obsolete (`already-cancelled`, `revision-conflict`,
   * `invalid-lifecycle`, `plan-not-found`).
   *
   * A third distinct family, deliberately not folded into either of the others:
   * nothing was written (unlike a confirmed cancellation) and nothing MAY have
   * been written (unlike an uncertain outcome) — but the plan the operator is
   * looking at is not what the backend holds, so acting on it again can only be
   * refused again.
   */
  onCancelReaderReconciliationRequired?: (staleSnapshot: {
    planId: string;
    staleRevision: number;
  }) => void;
}

export function NutritionPlanCancelDialog({
  dogId,
  plan,
  open,
  onClose,
  onCancelled,
  onCancelOutcomeUncertain,
  onCancelReaderReconciliationRequired,
}: NutritionPlanCancelDialogProps) {
  const { cancelState, prepareCancel, executeCancel, retryCancel, resetCancel } =
    useNutritionPlanMutations();

  /*
   * Snapshot frozen when the dialog opens. `planId` and `expectedRevision` come
   * from here, never from the live plan: if another operator advances the plan
   * while this is open, reading `plan.revision` at submit time would silently
   * cancel a revision the operator never reviewed.
   */
  const [initialPlanId, setInitialPlanId] = useState(plan.id);
  const [initialRevision, setInitialRevision] = useState(plan.revision);

  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  /*
   * The backend answered `success: true` and we could not verify the response.
   * Locks this dialog's own submit so a second click cannot mint a new
   * operationId while the first cancellation's fate is unknown. Cleared on close,
   * while the panel latch survives until the reader reconciles.
   */
  const [outcomeUncertain, setOutcomeUncertain] = useState(false);

  /*
   * The backend REFUSED this cancellation and, in doing so, proved the plan on
   * screen is not what we thought — `already-cancelled`, `revision-conflict`,
   * `invalid-lifecycle` or `plan-not-found`.
   *
   * Nothing was written, so this is NOT the uncertain-outcome case and must never
   * borrow its wording. But the snapshot the operator is looking at has just been
   * contradicted, so another attempt against it can only be refused again.
   */
  const [readerReconciliationRequired, setReaderReconciliationRequired] =
    useState(false);

  // Re-freeze on open, synchronously — no effect cascade.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setInitialPlanId(plan.id);
      setInitialRevision(plan.revision);
      setReason("");
      setLocalError(null);
      setOutcomeUncertain(false);
      setReaderReconciliationRequired(false);
    }
  }

  const isBusy = cancelState.status === "preparing" || cancelState.status === "executing";
  const isSuccess = cancelState.status === "success";
  // Neither an uncertain outcome nor a stale-authority refusal is an ordinary
  // error: each gets its own surface below, with its own wording.
  const isError =
    cancelState.status === "error" && !outcomeUncertain && !readerReconciliationRequired;

  /*
   * WEB-01B.7R retry-intent ownership.
   *
   * A retryable failure leaves exactly ONE unresolved intent, owned by this open
   * dialog. While it exists, Retry is the only way to re-send: the normal submit
   * would call `prepareCancel` again and mint a second operationId alongside an
   * unresolved first one.
   *
   * Closing abandons that intent — an accepted Web v1 trade-off, because every
   * backend path (`revision-conflict` / `already-cancelled`) refuses a duplicate.
   */
  const hasRetryableIntent =
    cancelState.status === "error" &&
    !outcomeUncertain &&
    !readerReconciliationRequired &&
    !("kind" in cancelState.error) &&
    cancelState.error.retryable;

  const isStale = shouldShowNutritionCancelStale({
    mutationStatus: cancelState.status,
    planId: plan.id,
    planRevision: plan.revision,
    planStatus: plan.status,
    initialPlanId,
    initialRevision,
  });

  const reasonValid = isValidCancelReason(reason);

  const handleClose = useCallback(() => {
    // Closing mid-flight would leave a sent mutation without a surface to report
    // on, and the hook's stale-completion guard would discard the result. All
    // close paths (Escape, backdrop, X, Voltar) funnel through here.
    if (isBusy) return;
    // Only the dialog's local locks are cleared. The panel latches are the
    // caller's state and stay engaged, so closing cannot buy back the CANCEL
    // action. A retryable intent is deliberately abandoned here (Web v1 policy):
    // the backend refuses any duplicate, so reopening is safe.
    setOutcomeUncertain(false);
    setReaderReconciliationRequired(false);
    resetCancel();
    setLocalError(null);
    onClose();
  }, [isBusy, onClose, resetCancel]);

  /**
   * Latches the caller against the frozen snapshot when the outcome is unknowable.
   *
   * Normal rejections fall through untouched: the backend refused, so the plan on
   * screen is still the live authority and freezing the UI would penalize an
   * operation that provably never landed.
   */
  const reportUncertainOutcome = (error: unknown) => {
    if (isPotentiallyCommittedOutcome(error)) {
      setOutcomeUncertain(true);
      onCancelOutcomeUncertain?.({
        planId: initialPlanId,
        staleRevision: initialRevision,
      });
      return;
    }
    // Refused, but the refusal contradicted the screen. Same latch as a confirmed
    // cancellation, different reason and different words.
    if (requiresNutritionReaderReconciliation(error)) {
      setReaderReconciliationRequired(true);
      onCancelReaderReconciliationRequired?.({
        planId: initialPlanId,
        staleRevision: initialRevision,
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy) return;
    /*
     * Belt and braces: the button is disabled, but a submit can also arrive from
     * Enter or programmatically, and past here we would mint a new operationId.
     *
     * Three separate reasons to refuse, all guarded before `prepareCancel`:
     * the outcome is unknown; the screen was contradicted; or an unresolved
     * retryable intent already exists and Retry owns it.
     */
    if (outcomeUncertain) return;
    if (readerReconciliationRequired) return;
    if (hasRetryableIntent) return;

    setLocalError(null);

    if (isStale) {
      // The frozen revision no longer describes what the reader shows. Fail
      // closed: no transport, no silently refreshed expectation.
      setLocalError(
        "O plano vigente mudou enquanto este cancelamento estava aberto. Feche e revise o estado atual.",
      );
      return;
    }

    if (!reasonValid) {
      setLocalError("Informe o motivo do cancelamento.");
      return;
    }

    try {
      // planId, expectedRevision and reason are frozen together by prepareCancel;
      // retry re-sends that same intent untouched.
      prepareCancel({
        dogId,
        planId: initialPlanId,
        expectedRevision: initialRevision,
        reason: reason.trim(),
      });
      await executeCancel();
      // Only after the backend confirmed. Reports the snapshot that is now stale,
      // never a fabricated cancelled/revision+1 state.
      onCancelled?.({ planId: initialPlanId, staleRevision: initialRevision });
    } catch (error) {
      // Normalized into cancelState by the hook. If the backend claimed success
      // and we could not verify it, the plan may already be cancelled.
      reportUncertainOutcome(error);
    }
  };

  const handleRetry = async () => {
    // Once the outcome is uncertain, no further attempt is safe — not even a
    // same-operationId replay, which would return the same unverifiable payload.
    if (outcomeUncertain) return;
    // Nor once the screen was contradicted: replaying the same stale expectation
    // can only be refused again.
    if (readerReconciliationRequired) return;
    try {
      // Same prepared intent: same operationId, same planId, same expectedRevision
      // and the SAME reason frozen at prepare time. Editing the textarea after a
      // failure cannot alter what a retry sends.
      await retryCancel();
      onCancelled?.({ planId: initialPlanId, staleRevision: initialRevision });
    } catch (error) {
      // A replay only exists because a first attempt persisted something.
      reportUncertainOutcome(error);
    }
  };

  // Same condition as `hasRetryableIntent`, kept as the render-side name.
  const retryable = hasRetryableIntent;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Cancelar plano alimentar"
      description="Encerrar o plano vigente, preservando o histórico"
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/*
          States plainly what cancelling does, because "cancelar" can read as
          "delete". Every line here is backed by the audited backend behaviour:
          same document, status cancelled, revision + 1, no successor created.
        */}
        <div
          data-testid="cancel-plan-impact"
          className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4 text-[11px] leading-relaxed text-amber-100/90"
        >
          <p className="font-semibold text-amber-100">O que acontece ao cancelar</p>
          <ul className="mt-2 space-y-1">
            <li>O plano não é apagado e permanece no histórico.</li>
            <li>O plano deixa de ser a referência nutricional vigente.</li>
            <li>Nenhum plano novo é criado automaticamente.</li>
            <li>O K9 pode ficar sem plano vigente até que outro seja registrado.</li>
          </ul>
        </div>

        {isSuccess && (
          <p
            data-testid="cancel-plan-success"
            role="status"
            className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200"
          >
            Plano alimentar cancelado com sucesso.
          </p>
        )}

        {isStale && !isSuccess && (
          <p
            data-testid="cancel-plan-stale"
            role="alert"
            className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-200"
          >
            O plano vigente mudou enquanto este cancelamento estava aberto. Feche e
            revise o estado atual.
          </p>
        )}

        {localError && (
          <p
            data-testid="cancel-plan-local-error"
            role="alert"
            className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-200"
          >
            {localError}
          </p>
        )}

        {/*
          Neither the success nor the error surface. "Falha ao cancelar" reads as
          "the plan is still active", which invites exactly the retry that could
          act on a plan already ended. The copy states what we know — unconfirmed —
          and asks the operator to wait. No backend details, no revision.
        */}
        {outcomeUncertain && (
          <p
            data-testid="cancel-plan-outcome-uncertain"
            role="alert"
            className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100"
          >
            Não foi possível confirmar o resultado desta operação. O cancelamento
            pode ter sido concluído. Aguarde a atualização das informações antes de
            tentar novamente.
          </p>
        )}

        {/*
          A THIRD wording, not a variant of the other two.
          The backend refused this cancellation, so saying it "pode ter sido
          concluído" would be false — but it refused precisely because the plan is
          no longer what this screen shows. So: no failure blame, no success
          implication, just "the state changed, wait for the refresh".
        */}
        {readerReconciliationRequired && (
          <p
            data-testid="cancel-plan-reader-reconciliation"
            role="alert"
            className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100"
          >
            O estado deste plano mudou e esta operação não foi realizada. Aguarde a
            atualização das informações antes de tentar novamente.
          </p>
        )}

        {isError && (
          <div
            data-testid="cancel-plan-error"
            role="alert"
            className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"
          >
            {/* Safe copy only; R1 already sanitized internal-integrity details. */}
            <p>{cancelState.error.message}</p>
            {retryable && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  onClick={handleRetry}
                  data-testid="cancel-plan-retry"
                >
                  Tentar novamente
                </Button>
                {/*
                  States the ownership rule plainly, because the operator cannot
                  see it: Retry replays the frozen intent (same operationId, same
                  reason), and closing gives that attempt up. Without this the
                  frozen-and-disabled reason field would look like a bug.
                */}
                <p
                  data-testid="cancel-plan-retry-ownership"
                  className="mt-2 text-[11px] leading-relaxed text-red-200/80"
                >
                  Tentar novamente repetirá exatamente esta tentativa, com o mesmo
                  motivo. Se fechar esta janela, a tentativa atual será encerrada.
                </p>
              </>
            )}
          </div>
        )}

        {/* The snapshot this cancellation belongs to, not the live plan. */}
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Plano
            </dt>
            <dd data-testid="cancel-plan-food-type" className="text-sm">
              {plan.foodType || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Revisão vigente
            </dt>
            <dd data-testid="cancel-plan-expected-revision" className="text-sm">
              {initialRevision}
            </dd>
          </div>
        </dl>

        <div>
          <Label htmlFor="cancel-plan-reason">
            Motivo do cancelamento <span aria-hidden="true">*</span>
          </Label>
          <textarea
            id="cancel-plan-reason"
            value={reason}
            /*
              Disabled once the outcome is uncertain as well: the reason belongs to
              the intent already sent, and editing it here could imply it would
              change what a retry submits. It cannot — the hook holds the frozen
              intent — so the field is closed rather than misleading.
            */
            /*
              Frozen while a retryable intent exists (WEB-01B.7R). Retry replays
              the reason captured at prepare time, so leaving this editable would
              show one reason while sending another — and this value lands in the
              plan's audit history. Also closed for the two terminal states.
            */
            disabled={
              isBusy ||
              isStale ||
              isSuccess ||
              outcomeUncertain ||
              readerReconciliationRequired ||
              hasRetryableIntent
            }
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder="Registre por que este plano deixa de ser a referência vigente. O motivo fica no histórico do plano."
            className="mt-1 w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm"
            data-testid="cancel-plan-reason"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Obrigatório. O motivo é registrado junto ao plano cancelado.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isBusy}
            data-testid="cancel-plan-close"
          >
            Voltar
          </Button>
          {/*
            Withdrawn entirely while Retry owns an unresolved intent: two live
            paths would let the operator create a second operationId beside a
            first one whose fate is still unknown.
          */}
          {!isSuccess && !hasRetryableIntent && (
            <Button
              type="submit"
              variant="danger"
              disabled={
                isBusy ||
                isStale ||
                !reasonValid ||
                outcomeUncertain ||
                readerReconciliationRequired
              }
              data-testid="cancel-plan-submit"
            >
              {isBusy ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
