"use client";

/**
 * K9 Ops Web — Health Web v1 / WEB-01B.4
 * Create NutritionPlan dialog — the first write surface of Health Web v1.
 *
 * Adapted from the pre-Foundation `nutrition-plan-create-dialog`. Dropped from
 * the original: `useEntities`, the internal dog selector, the parallel access
 * control and the management orchestrator. `dogId` arrives as a prop, because
 * the canonical individual context is the route param — this dialog never
 * resolves dog identity.
 *
 * Mutation goes exclusively through `useNutritionPlanMutations`, never through
 * the transport directly: the operationId lifecycle, retry semantics and state
 * machine live in the hook (WEB-01B.3). The dialog owns form state and
 * validation only.
 *
 * Authorization is decided by the caller (capability x read state); this
 * component is not a second authorization boundary.
 */

import { useCallback, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isPotentiallyCommittedOutcome } from "../data/nutrition-plan-mutation-service";
import { requiresNutritionReaderReconciliation } from "../errors/nutrition-mutation-errors";
import { useNutritionPlanMutations } from "../hooks/use-nutrition-plan-mutations";
import type { CreateNutritionPlanCommand, ProfessionalIdentity } from "../mutation-types";
import type { MealPeriod } from "../types";

/**
 * Institutional timezone, preserved from the pre-Foundation dialog rather than
 * read from the browser: the plan's meal schedule is an operational contract for
 * the kennel, so it must not shift with whatever machine happens to open the
 * form.
 */
const PLAN_TIMEZONE = "America/Sao_Paulo";

const PERIOD_OPTIONS: Array<{ value: MealPeriod; label: string }> = [
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noite" },
  { value: "night", label: "Madrugada" },
  { value: "extra", label: "Extra" },
];

interface SlotDraft {
  id: string;
  period: MealPeriod;
  scheduledTime: string;
  targetGrams: string;
}

function emptySlot(index: number): SlotDraft {
  return {
    id: `slot-${index}`,
    period: "morning",
    scheduledTime: "08:00",
    targetGrams: "",
  };
}

export interface NutritionPlanCreateDialogProps {
  dogId: string;
  dogName?: string | null;
  open: boolean;
  onClose: () => void;
  /**
   * Fired once the backend confirmed the plan, BEFORE the realtime reader has
   * caught up. The caller uses this to withhold the CREATE affordance until the
   * read model reconciles, so a second (non-replay) CREATE is unreachable in
   * that window. Also fires for an idempotent replay (`wasNoOp`), which is a
   * confirmed plan just the same.
   *
   * Success-only: it asserts the plan EXISTS. Never fired for an unverifiable
   * response — see `onCreateOutcomeUncertain`.
   */
  onCreated?: () => void;
  /**
   * Fired when the backend answered `success: true` but the client could not
   * verify the response (`invalid-mutation-response`).
   *
   * Deliberately separate from `onCreated`: we do NOT know that a plan exists.
   * What we do know is that one MAY exist, so the pre-mutation `empty` snapshot
   * can no longer be trusted to authorize a second CREATE. The caller withholds
   * the affordance on exactly the same terms as a confirmed create, but without
   * any claim that the mutation landed.
   */
  onCreateOutcomeUncertain?: () => void;
  /**
   * Fired when the backend REFUSED this creation with `active-plan-conflict` — it
   * holds an active plan where the reader reported none.
   *
   * A third distinct family: nothing was written (unlike a confirmed create) and
   * nothing MAY have been written (unlike an uncertain outcome) — but the `empty`
   * snapshot that authorized this CREATE has been contradicted, so it must stop
   * authorizing another one until the reader catches up.
   */
  onCreateReaderReconciliationRequired?: () => void;
}

export function NutritionPlanCreateDialog({
  dogId,
  dogName,
  open,
  onClose,
  onCreated,
  onCreateOutcomeUncertain,
  onCreateReaderReconciliationRequired,
}: NutritionPlanCreateDialogProps) {
  const { createState, prepareCreate, executeCreate, retryCreate, resetCreate } =
    useNutritionPlanMutations();

  const [foodType, setFoodType] = useState("");
  const [hydrationMl, setHydrationMl] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [slots, setSlots] = useState<SlotDraft[]>([emptySlot(1)]);
  const [profName, setProfName] = useState("");
  const [profRegType, setProfRegType] = useState("");
  const [profRegNum, setProfRegNum] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  /*
   * The backend answered `success: true` and we could not verify the response.
   *
   * The panel latch withholds the CREATE action on the card, but the card is
   * behind this dialog — which stays open so the operator can read what happened.
   * Without a lock here the submit button is simply live again (the hook state is
   * `error`, so `isBusy` is false), and one more click would mint a NEW
   * operationId: a second logical CREATE while the first one's fate is unknown.
   *
   * Local to the dialog on purpose. It is cleared on close, while the panel latch
   * survives and keeps the action withheld until the reader reconciles.
   */
  const [outcomeUncertain, setOutcomeUncertain] = useState(false);

  /*
   * The backend REFUSED this creation with `active-plan-conflict` — it sees an
   * active plan where the reader reported none (engine 1595).
   *
   * Nothing was written, so this is NOT the uncertain-outcome case and must not
   * borrow its wording. But the `empty` snapshot that authorized this CREATE has
   * just been contradicted, so another attempt against it can only be refused.
   */
  const [readerReconciliationRequired, setReaderReconciliationRequired] =
    useState(false);

  const isBusy =
    createState.status === "preparing" || createState.status === "executing";
  const isSuccess = createState.status === "success";
  // Neither an uncertain outcome nor a stale-authority refusal is an ordinary
  // error: each gets its own surface below, with its own wording.
  const isError =
    createState.status === "error" && !outcomeUncertain && !readerReconciliationRequired;

  /*
   * WEB-01B.7R retry-intent ownership: a retryable failure leaves exactly ONE
   * unresolved intent, owned by this open dialog. Retry replays it; the normal
   * submit would mint a second operationId beside it. Closing abandons it, which
   * is safe because the backend refuses any duplicate.
   */
  const hasRetryableIntent =
    createState.status === "error" &&
    !outcomeUncertain &&
    !readerReconciliationRequired &&
    !("kind" in createState.error) &&
    createState.error.retryable;

  const totalGrams = useMemo(
    () =>
      slots.reduce((sum, slot) => {
        const parsed = Number(slot.targetGrams);
        return sum + (Number.isFinite(parsed) ? parsed : 0);
      }, 0),
    [slots],
  );

  const addSlot = useCallback(() => {
    setSlots((current) => [...current, emptySlot(current.length + 1)]);
  }, []);

  const removeSlot = useCallback((id: string) => {
    setSlots((current) =>
      current.length <= 1 ? current : current.filter((slot) => slot.id !== id),
    );
  }, []);

  const updateSlot = useCallback(
    (id: string, patch: Partial<SlotDraft>) => {
      setSlots((current) =>
        current.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)),
      );
    },
    [],
  );

  const handleClose = useCallback(() => {
    // Closing mid-flight would leave a sent mutation without a surface to report
    // on, and the hook's stale-completion guard would discard the result.
    if (isBusy) return;
    // Only the dialog's local locks are cleared. The panel latch is the caller's
    // state and stays engaged, so closing this cannot buy back the CREATE action.
    // A retryable intent is deliberately abandoned here (Web v1 policy): the
    // backend's no-active-plan precondition refuses any duplicate.
    setOutcomeUncertain(false);
    setReaderReconciliationRequired(false);
    resetCreate();
    onClose();
  }, [isBusy, onClose, resetCreate]);

  /**
   * Latches the caller when the outcome is unknowable from the response.
   *
   * Normal rejections (permission, conflict, validation, transport) fall through
   * untouched: the backend refused, so the snapshot on screen is still the truth
   * and freezing the UI would punish an operation that never happened.
   */
  const reportUncertainOutcome = (error: unknown) => {
    if (isPotentiallyCommittedOutcome(error)) {
      setOutcomeUncertain(true);
      onCreateOutcomeUncertain?.();
      return;
    }
    // Refused, but the refusal contradicted the `empty` snapshot. Same latch as a
    // confirmed create, different reason and different words.
    if (requiresNutritionReaderReconciliation(error)) {
      setReaderReconciliationRequired(true);
      onCreateReaderReconciliationRequired?.();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy) return;
    /*
     * Belt and braces: the button is disabled or withdrawn, but a form submit can
     * also arrive from Enter or programmatically, and past here we would mint a new
     * operationId.
     *
     * Three separate reasons to refuse: the outcome is unknown; the `empty`
     * snapshot was contradicted; or an unresolved retryable intent already exists
     * and Retry owns it.
     */
    if (outcomeUncertain) return;
    if (readerReconciliationRequired) return;
    if (hasRetryableIntent) return;

    setLocalError(null);

    const cleanFoodType = foodType.trim();
    if (!cleanFoodType) {
      setLocalError("Informe o tipo de alimento do plano.");
      return;
    }

    if (slots.length === 0) {
      setLocalError("Cadastre pelo menos uma refeição no cronograma.");
      return;
    }

    const mealSchedule = slots.map((slot) => ({
      id: slot.id,
      period: slot.period,
      scheduledTime: slot.scheduledTime,
      targetGrams: Number(slot.targetGrams),
    }));

    if (mealSchedule.some((slot) => !Number.isFinite(slot.targetGrams) || slot.targetGrams <= 0)) {
      setLocalError("Cada refeição precisa de uma quantidade maior que zero.");
      return;
    }

    if (mealSchedule.some((slot) => !slot.scheduledTime.trim())) {
      setLocalError("Cada refeição precisa de um horário.");
      return;
    }

    let parsedHydrationMl: number | null = null;
    if (hydrationMl.trim() !== "") {
      const parsed = Number(hydrationMl);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setLocalError("A meta de hidratação deve ser maior ou igual a zero (ml/dia).");
        return;
      }
      parsedHydrationMl = parsed;
    }

    let professional: ProfessionalIdentity | null = null;
    if (profName.trim() || profRegType.trim() || profRegNum.trim()) {
      if (!profName.trim()) {
        setLocalError("Informe o nome do profissional responsável.");
        return;
      }
      if (!profRegType.trim()) {
        setLocalError("Informe o tipo de registro do profissional.");
        return;
      }
      if (!profRegNum.trim()) {
        setLocalError("Informe o número do registro profissional.");
        return;
      }
      professional = {
        name: profName.trim(),
        registration_type: profRegType.trim(),
        registration_number: profRegNum.trim(),
        clinic: null,
        specialty: null,
      };
    }

    const command: CreateNutritionPlanCommand = {
      dogId,
      planData: {
        foodType: cleanFoodType,
        amountGramsPerDay: totalGrams,
        mealsPerDay: mealSchedule.length,
        timezone: PLAN_TIMEZONE,
        validFrom: new Date().toISOString(),
        validUntil: null,
        mealSchedule,
        supplements: undefined,
        hydrationMl: parsedHydrationMl,
        specialInstructions: specialInstructions.trim() || null,
        professional,
        sourceDocument: null,
        attachmentRefs: null,
      },
    };

    try {
      // prepare mints the operationId once and freezes the intent; execute sends
      // that frozen intent. Retry must reuse it, never re-prepare.
      // The hook publishes the prepared intent to a ref synchronously, so it is
      // available to executeCreate in this same turn without a re-render.
      prepareCreate(command);
      await executeCreate();
      // Only after the backend confirmed. Latches the caller against a second
      // CREATE until the reader reconciles.
      onCreated?.();
    } catch (error) {
      // Normalized into createState by the hook. One class of failure still has
      // to latch: the backend said success and we could not verify it, so a plan
      // may exist even though this threw.
      reportUncertainOutcome(error);
    }
  };

  const handleRetry = async () => {
    // Once the outcome is uncertain, no further attempt is safe — not even a
    // same-operationId replay, which would return the same unverifiable payload.
    if (outcomeUncertain) return;
    // Nor once the `empty` snapshot was contradicted: replaying it can only be
    // refused again.
    if (readerReconciliationRequired) return;
    try {
      // Same prepared intent, same operationId — the backend treats it as a
      // replay instead of a second plan.
      await retryCreate();
      onCreated?.();
    } catch (error) {
      // A replay can come back unverifiable too, and a replay only exists
      // because something was persisted. Same latch.
      reportUncertainOutcome(error);
    }
  };

  // Same condition as `hasRetryableIntent`, kept as the render-side name.
  const retryable = hasRetryableIntent;

  /*
   * One shared lock for every form input.
   *
   * While Retry owns an unresolved intent the form must not be editable: Retry
   * replays the values frozen at prepare time, so an edited field would display
   * one payload while sending another. The two terminal states lock it for the
   * same reason — nothing typed here can reach the backend any more.
   */
  const formLocked =
    isBusy || outcomeUncertain || readerReconciliationRequired || hasRetryableIntent;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Novo plano alimentar"
      description={
        dogName
          ? `Criar plano alimentar canônico para ${dogName}`
          : "Criar plano alimentar canônico"
      }
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {isSuccess && (
          <p
            data-testid="create-plan-success"
            role="status"
            className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200"
          >
            Plano alimentar confirmado com sucesso.
          </p>
        )}

        {localError && (
          <p
            data-testid="create-plan-local-error"
            role="alert"
            className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-200"
          >
            {localError}
          </p>
        )}

        {/*
          Deliberately neither the success nor the error surface.
          "Falha ao criar" would be a lie in the direction that causes damage: it
          reads as "nothing happened", which invites exactly the retry that could
          create a second plan. The copy states what we actually know — the result
          is unconfirmed — and tells the operator to wait for the data to refresh.
          No backend details, no planId, no revision.
        */}
        {outcomeUncertain && (
          <p
            data-testid="create-plan-outcome-uncertain"
            role="alert"
            className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100"
          >
            Não foi possível confirmar o resultado desta operação. O plano pode ter
            sido criado. Aguarde a atualização das informações antes de tentar
            novamente.
          </p>
        )}

        {/*
          A THIRD wording, not a variant of the other two.
          The backend refused this creation, so "o plano pode ter sido criado" would
          be false — but it refused because an active plan already exists where this
          screen showed none. No failure blame, no success implication.
        */}
        {readerReconciliationRequired && (
          <p
            data-testid="create-plan-reader-reconciliation"
            role="alert"
            className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100"
          >
            O estado dos planos mudou e esta operação não foi realizada. Aguarde a
            atualização das informações antes de tentar novamente.
          </p>
        )}

        {isError && (
          <div
            data-testid="create-plan-error"
            role="alert"
            className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"
          >
            {/*
             * Safe copy only. For internal-integrity-error the R1 normalizer
             * already strips backend details, so nothing internal can surface.
             */}
            <p>{createState.error.message}</p>
            {retryable && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  onClick={handleRetry}
                  data-testid="create-plan-retry"
                >
                  Tentar novamente
                </Button>
                {/*
                  States the ownership rule plainly, because the operator cannot
                  see it: Retry replays the frozen intent (same operationId, same
                  values), and closing gives that attempt up.
                */}
                <p
                  data-testid="create-plan-retry-ownership"
                  className="mt-2 text-[11px] leading-relaxed text-red-200/80"
                >
                  Tentar novamente repetirá exatamente esta tentativa, com os mesmos
                  dados. Se fechar esta janela, a tentativa atual será encerrada.
                </p>
              </>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nutrition-food-type">Tipo de alimento</Label>
            {/*
              No `required` attribute: native constraint validation would block
              submit before handleSubmit runs, making our own validation copy
              unreachable. Validation lives in one place instead.
            */}
            <Input
              id="nutrition-food-type"
              value={foodType}
              onChange={(event) => setFoodType(event.target.value)}
              disabled={formLocked}
            />
          </div>
          <div>
            <Label htmlFor="nutrition-hydration">Hidratação (ml/dia)</Label>
            <Input
              id="nutrition-hydration"
              type="number"
              min={0}
              value={hydrationMl}
              onChange={(event) => setHydrationMl(event.target.value)}
              disabled={formLocked}
            />
          </div>
        </div>

        <fieldset className="rounded-2xl border border-border/60 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Grade de refeições
          </legend>

          <ul className="mt-2 space-y-3">
            {slots.map((slot) => (
              <li key={slot.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <div>
                  <Label htmlFor={`${slot.id}-period`}>Período</Label>
                  <select
                    id={`${slot.id}-period`}
                    value={slot.period}
                    disabled={formLocked}
                    onChange={(event) =>
                      updateSlot(slot.id, { period: event.target.value as MealPeriod })
                    }
                    className="h-10 w-full rounded-xl border border-border/60 bg-background/40 px-3 text-sm"
                  >
                    {PERIOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor={`${slot.id}-time`}>Horário</Label>
                  <Input
                    id={`${slot.id}-time`}
                    type="time"
                    value={slot.scheduledTime}
                    disabled={formLocked}
                    onChange={(event) =>
                      updateSlot(slot.id, { scheduledTime: event.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`${slot.id}-grams`}>Quantidade (g)</Label>
                  <Input
                    id={`${slot.id}-grams`}
                    type="number"
                    min={1}
                    value={slot.targetGrams}
                    disabled={formLocked}
                    onChange={(event) =>
                      updateSlot(slot.id, { targetGrams: event.target.value })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Remover refeição"
                    disabled={formLocked || slots.length <= 1}
                    onClick={() => removeSlot(slot.id)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between">
            <Button type="button" variant="secondary" onClick={addSlot} disabled={formLocked}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Adicionar refeição
            </Button>
            <p className="text-xs text-muted-foreground">
              Total diário: <strong data-testid="create-plan-total">{totalGrams}</strong> g
            </p>
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-border/60 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Profissional responsável (opcional)
          </legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="nutrition-prof-name">Nome</Label>
              <Input
                id="nutrition-prof-name"
                value={profName}
                disabled={formLocked}
                onChange={(event) => setProfName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="nutrition-prof-reg-type">Tipo de registro</Label>
              <Input
                id="nutrition-prof-reg-type"
                value={profRegType}
                disabled={formLocked}
                onChange={(event) => setProfRegType(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="nutrition-prof-reg-num">Número do registro</Label>
              <Input
                id="nutrition-prof-reg-num"
                value={profRegNum}
                disabled={formLocked}
                onChange={(event) => setProfRegNum(event.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <div>
          <Label htmlFor="nutrition-instructions">Instruções especiais</Label>
          <textarea
            id="nutrition-instructions"
            value={specialInstructions}
            disabled={formLocked}
            onChange={(event) => setSpecialInstructions(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm"
          />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Fuso horário do plano: {PLAN_TIMEZONE}
        </p>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isBusy}
            data-testid="create-plan-close"
          >
            Fechar
          </Button>
          {/*
            Withdrawn entirely while Retry owns an unresolved intent: two live
            paths would let the operator create a second operationId beside a
            first one whose fate is still unknown.
          */}
          {!isSuccess && !hasRetryableIntent && (
            <Button
              type="submit"
              disabled={isBusy || outcomeUncertain || readerReconciliationRequired}
              data-testid="create-plan-submit"
            >
              {isBusy ? "Registrando..." : "Registrar plano"}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
