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
   */
  onCreated?: () => void;
}

export function NutritionPlanCreateDialog({
  dogId,
  dogName,
  open,
  onClose,
  onCreated,
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

  const isBusy =
    createState.status === "preparing" || createState.status === "executing";
  const isSuccess = createState.status === "success";
  const isError = createState.status === "error";

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
    resetCreate();
    onClose();
  }, [isBusy, onClose, resetCreate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy) return;

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
    } catch {
      // Normalized into createState by the hook.
    }
  };

  const handleRetry = async () => {
    try {
      // Same prepared intent, same operationId — the backend treats it as a
      // replay instead of a second plan.
      await retryCreate();
      onCreated?.();
    } catch {
      // Normalized into createState by the hook.
    }
  };

  const retryable =
    createState.status === "error" &&
    !("kind" in createState.error) &&
    createState.error.retryable;

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
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={handleRetry}
                data-testid="create-plan-retry"
              >
                Tentar novamente
              </Button>
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
              disabled={isBusy}
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
              disabled={isBusy}
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
                    disabled={isBusy}
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
                    disabled={isBusy}
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
                    disabled={isBusy}
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
                    disabled={isBusy || slots.length <= 1}
                    onClick={() => removeSlot(slot.id)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between">
            <Button type="button" variant="secondary" onClick={addSlot} disabled={isBusy}>
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
                disabled={isBusy}
                onChange={(event) => setProfName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="nutrition-prof-reg-type">Tipo de registro</Label>
              <Input
                id="nutrition-prof-reg-type"
                value={profRegType}
                disabled={isBusy}
                onChange={(event) => setProfRegType(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="nutrition-prof-reg-num">Número do registro</Label>
              <Input
                id="nutrition-prof-reg-num"
                value={profRegNum}
                disabled={isBusy}
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
            disabled={isBusy}
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
          {!isSuccess && (
            <Button type="submit" disabled={isBusy} data-testid="create-plan-submit">
              {isBusy ? "Registrando..." : "Registrar plano"}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
