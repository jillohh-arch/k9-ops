"use client";

import { useState, useId } from "react";
import {
  AlertCircle,
  Apple,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Droplets,
  Info,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserCheck,
  Utensils,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNutritionPlanMutations } from "../hooks/use-nutrition-plan-mutations";
import type {
  CreateNutritionPlanCommand,
  MealPeriod,
  MealScheduleSlot,
  NutritionPlan,
  NutritionPlanSupplementRegimen,
  ProfessionalIdentity,
} from "../types";

export interface NutritionPlanReplaceDialogProps {
  /** O plano canônico ativo que será substituído */
  plan: NutritionPlan;
  dogName?: string;
  open: boolean;
  onClose: () => void;
}

type DialogPhase = "editing" | "reviewing" | "executing";

const PERIOD_LABELS: Record<MealPeriod, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Fim de tarde",
  night: "Noite",
  extra: "Extra",
};

export function NutritionPlanReplaceDialog({
  plan,
  dogName,
  open,
  onClose,
}: NutritionPlanReplaceDialogProps) {
  const { createState, prepareCreate, executeCreate, retryCreate, resetCreate } =
    useNutritionPlanMutations();

  const idPrefix = useId();

  // ═══════════════════════════════════════════════════════════════════════════════
  // DIALOG PHASE (Item 1 - Confirmação Explícita)
  // editing → reviewing → executing
  // ═══════════════════════════════════════════════════════════════════════════════
  const [phase, setPhase] = useState<DialogPhase>("editing");

  // ═══════════════════════════════════════════════════════════════════════════════
  // SNAPSHOT DO PLANO SUBSTITUÍDO (Item 7)
  // ═══════════════════════════════════════════════════════════════════════════════
  const [snapshotPlanId, setSnapshotPlanId] = useState(plan.id);
  const [snapshotRevision, setSnapshotRevision] = useState(plan.revision);
  const [snapshotData, setSnapshotData] = useState<{
    specialInstructions?: string | null;
    professional?: ProfessionalIdentity | null;
    sourceDocument?: { health_document_id: string; description?: string | null } | null;
    attachmentRefs?: string[] | null;
    supplements: NutritionPlanSupplementRegimen[];
    timezone: string;
    validUntil: string | null;
  } | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════════
  // FORM STATE — PREFILL COM DADOS ESTRUTURAIS DO PLANO ATUAL (Item 13)
  // ═══════════════════════════════════════════════════════════════════════════════
  const [foodType, setFoodType] = useState(plan.foodType || "");
  const [amountGramsPerDay, setAmountGramsPerDay] = useState(
    String(plan.amountGramsPerDay || "")
  );
  const [hydrationMl, setHydrationMl] = useState(
    plan.hydrationMl != null ? String(plan.hydrationMl) : ""
  );
  const [timezone, setTimezone] = useState(plan.timezone || "America/Sao_Paulo");

  // ═══════════════════════════════════════════════════════════════════════════════
  // MEAL SCHEDULE — PRESERVA IDs EXISTENTES (Item 14)
  // ═══════════════════════════════════════════════════════════════════════════════
  const [mealSchedule, setMealSchedule] = useState<MealScheduleSlot[]>(() => {
    if (plan.mealSchedule && plan.mealSchedule.length > 0) {
      return plan.mealSchedule.map((slot) => ({
        id: slot.id || `${idPrefix}-slot-${Date.now()}-${Math.random()}`,
        period: slot.period,
        scheduledTime: slot.scheduledTime,
        targetGrams: slot.targetGrams,
      }));
    }
    return [
      {
        id: `${idPrefix}-slot-1`,
        period: "morning" as MealPeriod,
        scheduledTime: "07:00",
        targetGrams: 250,
      },
    ];
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUPPLEMENTS — PRESERVA IDs E CAMPOS OCULTOS (Item 17)
  // ═══════════════════════════════════════════════════════════════════════════════
  const [supplements, setSupplements] = useState<NutritionPlanSupplementRegimen[]>(() => {
    if (plan.supplements && plan.supplements.length > 0) {
      return plan.supplements.map((supp) => ({
        id: supp.id || `${idPrefix}-supp-${Date.now()}-${Math.random()}`,
        name: supp.name,
        dose: supp.dose,
        unit: supp.unit,
        frequency: supp.frequency,
        instructions: supp.instructions,
        validFrom: supp.validFrom,
        validUntil: supp.validUntil,
      }));
    }
    return [];
  });

  // Local validation error
  const [localError, setLocalError] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════════════════════
  const totalAmount = Number(amountGramsPerDay) || 0;
  const distributedAmount = mealSchedule.reduce(
    (sum, slot) => sum + (Number(slot.targetGrams) || 0),
    0
  );
  const isSumValid = totalAmount > 0 && distributedAmount === totalAmount;
  const mealsPerDay = mealSchedule.length;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RE-SYNC SNAPSHOT QUANDO DIALOG ABRE (Item 7, 8)
  // ═══════════════════════════════════════════════════════════════════════════════
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setPhase("editing");
      setSnapshotPlanId(plan.id);
      setSnapshotRevision(plan.revision);
      setSnapshotData({
        specialInstructions: plan.specialInstructions ?? null,
        professional: plan.professional
          ? {
              name: plan.professional.name || "",
              registration_type:
                plan.professional.registration_type ||
                plan.professional.registrationType ||
                "",
              registration_number:
                plan.professional.registration_number ||
                plan.professional.registrationNumber ||
                "",
              clinic: plan.professional.clinic ?? null,
              specialty: plan.professional.specialty ?? null,
            }
          : null,
        sourceDocument: plan.sourceDocument?.id
          ? {
              health_document_id: plan.sourceDocument.id,
              description: plan.sourceDocument.name ?? null,
            }
          : null,
        attachmentRefs: plan.attachmentRefs && plan.attachmentRefs.length > 0
          ? plan.attachmentRefs
          : null,
        supplements: plan.supplements || [],
        timezone: plan.timezone || "America/Sao_Paulo",
        validUntil:
          plan.validUntil instanceof Date
            ? plan.validUntil.toISOString()
            : plan.validUntil
            ? String(plan.validUntil)
            : null,
      });
      setFoodType(plan.foodType || "");
      setAmountGramsPerDay(String(plan.amountGramsPerDay || ""));
      setHydrationMl(plan.hydrationMl != null ? String(plan.hydrationMl) : "");
      setTimezone(plan.timezone || "America/Sao_Paulo");
      setMealSchedule(() => {
        if (plan.mealSchedule && plan.mealSchedule.length > 0) {
          return plan.mealSchedule.map((slot) => ({
            id: slot.id || `${idPrefix}-slot-${Date.now()}-${Math.random()}`,
            period: slot.period,
            scheduledTime: slot.scheduledTime,
            targetGrams: slot.targetGrams,
          }));
        }
        return [
          {
            id: `${idPrefix}-slot-1`,
            period: "morning" as MealPeriod,
            scheduledTime: "07:00",
            targetGrams: 250,
          },
        ];
      });
      setSupplements(() => {
        if (plan.supplements && plan.supplements.length > 0) {
          return plan.supplements.map((supp) => ({
            id: supp.id || `${idPrefix}-supp-${Date.now()}-${Math.random()}`,
            name: supp.name,
            dose: supp.dose,
            unit: supp.unit,
            frequency: supp.frequency,
            instructions: supp.instructions,
            validFrom: supp.validFrom,
            validUntil: supp.validUntil,
          }));
        }
        return [];
      });
      setLocalError(null);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STALE FORM DETECTION — CRÍTICO (Item 8)
  // ═══════════════════════════════════════════════════════════════════════════════
  const isStale =
    plan.id !== snapshotPlanId ||
    plan.revision !== snapshotRevision ||
    plan.status !== "active";

  // ═══════════════════════════════════════════════════════════════════════════════
  // DETECÇÃO DE ALTERAÇÃO ESTRUTURAL REAL (Item 22, 23)
  // ═══════════════════════════════════════════════════════════════════════════════
  const hasStructuralChange = (): boolean => {
    if (!snapshotData) return true;

    const originalSupps = snapshotData.supplements || [];

    if ((plan.foodType || "").trim() !== foodType.trim()) return true;
    if ((plan.amountGramsPerDay || 0) !== totalAmount) return true;
    if (plan.mealSchedule?.length !== mealSchedule.length) return true;

    for (const currentSlot of mealSchedule) {
      const originalSlot = plan.mealSchedule?.find((s) => s.id === currentSlot.id);
      if (!originalSlot) return true;
      if (
        originalSlot.period !== currentSlot.period ||
        originalSlot.scheduledTime !== currentSlot.scheduledTime ||
        originalSlot.targetGrams !== currentSlot.targetGrams
      ) {
        return true;
      }
    }

    if ((plan.hydrationMl || 0) !== (Number(hydrationMl) || 0)) return true;

    // Timezone agora é editável e conta como alteração estrutural (Item 2)
    if ((plan.timezone || "") !== timezone) return true;

    if (originalSupps.length !== supplements.length) return true;
    for (const currentSupp of supplements) {
      const originalSupp = originalSupps.find((s) => s.id === currentSupp.id);
      if (!originalSupp) return true;
      if (
        originalSupp.name !== currentSupp.name ||
        originalSupp.dose !== currentSupp.dose ||
        originalSupp.unit !== currentSupp.unit ||
        originalSupp.frequency !== currentSupp.frequency ||
        originalSupp.instructions !== currentSupp.instructions
      ) {
        return true;
      }
    }

    return false;
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // MEAL SLOT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleAddMealSlot = () => {
    const nextPeriod: MealPeriod =
      mealSchedule.length === 0
        ? "morning"
        : mealSchedule.length === 1
        ? "evening"
        : mealSchedule.length === 2
        ? "afternoon"
        : "extra";

    const nextTime =
      nextPeriod === "morning"
        ? "07:00"
        : nextPeriod === "afternoon"
        ? "12:00"
        : nextPeriod === "evening"
        ? "19:00"
        : "21:00";

    const newSlot: MealScheduleSlot = {
      id: `${idPrefix}-slot-${Date.now()}-${mealSchedule.length + 1}`,
      period: nextPeriod,
      scheduledTime: nextTime,
      targetGrams: 0,
    };
    setMealSchedule([...mealSchedule, newSlot]);
  };

  const handleRemoveMealSlot = (slotId: string) => {
    setMealSchedule(mealSchedule.filter((s) => s.id !== slotId));
  };

  const handleUpdateMealSlot = (
    slotId: string,
    field: keyof MealScheduleSlot,
    value: string | number
  ) => {
    setMealSchedule(
      mealSchedule.map((slot) => {
        if (slot.id !== slotId) return slot;
        return { ...slot, [field]: value };
      })
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUPPLEMENT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleAddSupplement = () => {
    const newSupp: NutritionPlanSupplementRegimen = {
      id: `${idPrefix}-supp-${Date.now()}-${supplements.length + 1}`,
      name: "",
      dose: 1,
      unit: "tablet",
      frequency: "1x ao dia",
      instructions: "",
    };
    setSupplements([...supplements, newSupp]);
  };

  const handleRemoveSupplement = (suppId: string) => {
    setSupplements(supplements.filter((s) => s.id !== suppId));
  };

  const handleUpdateSupplement = (
    suppId: string,
    field: keyof NutritionPlanSupplementRegimen,
    value: string | number
  ) => {
    setSupplements(
      supplements.map((supp) => {
        if (supp.id !== suppId) return supp;
        if (field === "dose") {
          return { ...supp, [field]: typeof value === "number" ? value : Number(value) || 0 };
        }
        return { ...supp, [field]: value };
      })
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // PHASE TRANSITIONS (Item 1)
  // ═══════════════════════════════════════════════════════════════════════════════

  // Avançar para revisão (NÃO prepara intenção)
  const handleAdvanceToReview = () => {
    setLocalError(null);

    // Stale form safety
    if (isStale) {
      setLocalError(
        "O plano ativo foi atualizado enquanto esta edição estava aberta. Revise a versão atual antes de continuar."
      );
      return;
    }

    // Validations
    const cleanFoodType = foodType.trim();
    if (!cleanFoodType) {
      setLocalError("Informe o tipo de alimento / dieta.");
      return;
    }

    if (totalAmount <= 0) {
      setLocalError("A quantidade diária deve ser maior que zero (g/dia).");
      return;
    }

    if (mealSchedule.length === 0) {
      setLocalError("Cadastre pelo menos uma refeição no cronograma.");
      return;
    }

    if (!isSumValid) {
      setLocalError("A distribuição das refeições deve totalizar a quantidade diária do plano.");
      return;
    }

    // Hydration validation
    if (hydrationMl.trim() !== "") {
      const num = Number(hydrationMl);
      if (isNaN(num) || num < 0) {
        setLocalError("A meta de hidratação deve ser maior ou igual a zero (ml/dia).");
        return;
      }
    }

    // Structural change detection
    if (!hasStructuralChange()) {
      setLocalError("Nenhuma alteração estrutural foi realizada.");
      return;
    }

    // Avança para revisão (NÃO captura validFrom ainda)
    setPhase("reviewing");
  };

  // Voltar para edição (NÃO prepara intenção)
  const handleBackToEditing = () => {
    setPhase("editing");
    setLocalError(null);
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONFIRMAÇÃO FINAL (executa preparação)
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleConfirmReplacement = async () => {
    setLocalError(null);
    setPhase("executing");

    // 1. Capturar validFrom UMA vez - no momento da confirmação
    const newValidFrom = new Date().toISOString();

    // 2. Verificar validUntil contra esse EXATO validFrom (Item 1 - race condition)
    if (snapshotData?.validUntil) {
      const preservedUntilMs = new Date(snapshotData.validUntil).getTime();
      const newFromMs = new Date(newValidFrom).getTime();

      // Se validUntil já venceu ou coincide com o novo validFrom, BLOQUEAR
      if (preservedUntilMs <= newFromMs) {
        const expiredDate = new Date(snapshotData.validUntil).toLocaleString("pt-BR");
        setLocalError(
          `O plano atual possui término de vigência em ${expiredDate}, que não é compatível com o momento da substituição. ` +
            `Revise a versão atual antes de prosseguir.`
        );
        setPhase("editing");
        return;
      }
    }

    const cleanFoodType = foodType.trim();

    // Preserva campos administrativos do snapshot
    const preservedSpecialInstructions = snapshotData?.specialInstructions ?? null;
    const preservedProfessional = snapshotData?.professional ?? null;
    const preservedSourceDocument = snapshotData?.sourceDocument ?? null;
    const preservedAttachmentRefs = snapshotData?.attachmentRefs ?? null;

    // Build supplements payload
    const supplementsPayload: NutritionPlanSupplementRegimen[] = supplements
      .filter((s) => s.name.trim() !== "")
      .map((s) => ({
        id: s.id,
        name: s.name.trim(),
        dose: typeof s.dose === 'number' ? s.dose : Number(s.dose) || 0,
        unit: s.unit,
        frequency: s.frequency.trim(),
        instructions: s.instructions?.trim() || undefined,
        validFrom: s.validFrom,
        validUntil: s.validUntil,
      }));

    // 3. Calcular validUntil apenas se válido (usando o mesmo newValidFrom)
    let validUntil: string | null = null;
    if (snapshotData?.validUntil) {
      const preservedUntilMs = new Date(snapshotData.validUntil).getTime();
      const newFromMs = new Date(newValidFrom).getTime();
      if (preservedUntilMs > newFromMs) {
        validUntil = new Date(snapshotData.validUntil).toISOString();
      }
      // Se preservedUntilMs <= newFromMs, validUntil permanece null (plano sem término definido)
    }

    const command: CreateNutritionPlanCommand = {
      dogId: plan.dogId,
      planData: {
        foodType: cleanFoodType,
        amountGramsPerDay: totalAmount,
        mealsPerDay,
        timezone,
        validFrom: newValidFrom,
        validUntil,
        mealSchedule,
        supplements: supplementsPayload.length > 0 ? supplementsPayload : undefined,
        hydrationMl: Number(hydrationMl) || null,
        specialInstructions: preservedSpecialInstructions,
        professional: preservedProfessional,
        sourceDocument: preservedSourceDocument,
        attachmentRefs: preservedAttachmentRefs,
      },
    };

    try {
      prepareCreate(command);
      await executeCreate();
    } catch {
      // Error is caught & normalized in hook createState
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLOSE & RESET
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleClose = () => {
    if (phase === "executing" && (createState.status === "executing" || createState.status === "preparing")) {
      return;
    }
    resetCreate();
    setLocalError(null);
    setPhase("editing");
    onClose();
  };

  const isSuccess = createState.status === "success";
  const isError = createState.status === "error";

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={
        dogName
          ? `Substituir Plano Alimentar — K9 ${dogName}`
          : "Substituir Plano Alimentar"
      }
      description={
        phase === "reviewing"
          ? "Revise as alterações antes de confirmar a substituição."
          : "Criar nova versão do plano nutricional. O plano atual será preservado no histórico."
      }
      className="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Banner Esclarecedor */}
        <div className="flex items-start gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-950/40 p-4 text-xs text-cyan-200">
          <Info className="h-5 w-5 shrink-0 text-cyan-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-cyan-100">Substituição Estrutural:</span>{" "}
            <span>
              Esta ação criará uma nova versão do plano alimentar. O plano atual será preservado
              no histórico e marcado como substituído. Campos administrativos serão mantidos.
            </span>
          </div>
        </div>

        {/* Stale Form Warning */}
        {isStale && (
          <div
            data-testid="replace-stale-form-warning"
            className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 text-xs text-amber-200"
          >
            <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <strong className="font-bold text-amber-100">
                O plano ativo foi atualizado enquanto esta edição estava aberta.
              </strong>
              <div className="text-amber-300/90 mt-0.5">
                Revise a versão atual antes de continuar.
              </div>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {isSuccess && (
          <div
            data-testid="replace-plan-success-banner"
            className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-sm text-emerald-200"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-emerald-100">
                  Plano Substituído com Sucesso!
                </div>
                <div className="text-xs text-emerald-300/80">
                  {createState.result?.wasNoOp
                    ? "Replay idêntico processado."
                    : "Uma nova versão do plano alimentar foi criada e ativada."}
                  {createState.result?.supersededPlanId && (
                    <span className="ml-2 text-emerald-400/80">
                      Plano anterior: {createState.result.supersededPlanId}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              className="border-emerald-500/30 text-emerald-200"
            >
              Concluir
            </Button>
          </div>
        )}

        {/* Local Error */}
        {localError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-200">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
            <span>{localError}</span>
          </div>
        )}

        {/* Hook Error */}
        {isError && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-xs text-red-200 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              <div>
                <div className="font-bold text-red-100">
                  Falha ao Substituir Plano Alimentar
                </div>
                <div className="text-red-300/80 mt-0.5">
                  {createState.error?.message || "Ocorreu um erro ao processar a mutação."}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-red-500/20 pt-3">
              {createState.error &&
                !("kind" in createState.error) &&
                createState.error.retryable && (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => retryCreate()}
                    disabled={phase === "executing"}
                    className="text-xs py-1.5 px-3"
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Tentar novamente (Mesma intenção)
                  </Button>
                )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => resetCreate()}
                disabled={phase === "executing"}
                className="text-xs py-1.5 px-3 text-slate-300 hover:text-white"
              >
                Revisar dados do formulário
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* PHASE: REVIEWING — RESUMO DAS ALTERAÇÕES */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {phase === "reviewing" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/60 p-5">
              <h4 className="text-sm font-bold text-cyan-200 mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                Resumo das Alterações Estruturais
              </h4>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-4 py-2 border-b border-slate-800">
                  <span className="text-slate-400">Campo</span>
                  <span className="text-slate-400">Valor Atual</span>
                  <span className="text-slate-400">Novo Valor</span>
                </div>

                <div className="grid grid-cols-3 gap-4 py-2">
                  <span className="text-slate-300 font-medium">Alimento/Dieta</span>
                  <span className="text-slate-400 font-mono truncate">{plan.foodType || "—"}</span>
                  <span className="text-cyan-300 font-mono truncate">{foodType}</span>
                </div>

                <div className="grid grid-cols-3 gap-4 py-2 border-b border-slate-800">
                  <span className="text-slate-300 font-medium">Quantidade Diária</span>
                  <span className="text-slate-400 font-mono">{plan.amountGramsPerDay}g</span>
                  <span className="text-cyan-300 font-mono">{totalAmount}g</span>
                </div>

                <div className="grid grid-cols-3 gap-4 py-2">
                  <span className="text-slate-300 font-medium">Refeições/Dia</span>
                  <span className="text-slate-400 font-mono">{plan.mealSchedule?.length || 0}</span>
                  <span className="text-cyan-300 font-mono">{mealsPerDay}</span>
                </div>

                <div className="grid grid-cols-3 gap-4 py-2">
                  <span className="text-slate-300 font-medium">Hidratação</span>
                  <span className="text-slate-400 font-mono">
                    {plan.hydrationMl ? `${plan.hydrationMl}ml` : "—"}
                  </span>
                  <span className="text-cyan-300 font-mono">
                    {hydrationMl ? `${hydrationMl}ml` : "—"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 py-2 border-b border-slate-800">
                  <span className="text-slate-300 font-medium">Timezone</span>
                  <span className="text-slate-400 font-mono text-[10px]">
                    {plan.timezone || "—"}
                  </span>
                  <span className="text-cyan-300 font-mono text-[10px]">{timezone}</span>
                </div>

                <div className="grid grid-cols-3 gap-4 py-2">
                  <span className="text-slate-300 font-medium">Suplementos</span>
                  <span className="text-slate-400 font-mono">
                    {plan.supplements?.length || 0}
                  </span>
                  <span className="text-cyan-300 font-mono">{supplements.length}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-start gap-3 text-xs text-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-100">Impacto da Substituição:</strong>
                    <ul className="mt-1 space-y-1 text-amber-300/80">
                      <li>• O plano atual será preservado no histórico e marcado como substituído</li>
                      <li>• Uma nova versão do plano será criada e ativada a partir de agora</li>
                      <li>• Campos administrativos serão mantidos na nova versão</li>
                    </ul>
                  </div>
                </div>
              </div>

              {snapshotData?.validUntil && (
                <div className="mt-3 flex items-center gap-2 text-xs text-cyan-300">
                  <Clock className="h-4 w-4" />
                  <span>
                    Vigência atual: até{" "}
                    {new Date(snapshotData.validUntil).toLocaleString("pt-BR")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* FORMULÁRIO — SOMENTE EM EDITING */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {phase === "editing" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdvanceToReview();
            }}
            className="space-y-6"
          >
            <fieldset disabled={isSuccess || isStale} className="space-y-6">
              {/* Seção 1: Dados Principais */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Apple className="h-4 w-4" />
                  <span>Dieta & Meta Diária</span>
                </h4>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="replaceFoodType" className="text-xs text-slate-300">
                      Alimento / Dieta Prescrita <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="replaceFoodType"
                      placeholder="Ex: Ração Super Premium K9 High Energy"
                      value={foodType}
                      onChange={(e) => setFoodType(e.target.value)}
                      className="bg-slate-900/80 border-slate-800 text-slate-100"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="replaceAmountGramsPerDay" className="text-xs text-slate-300">
                      Quantidade Diária (g/dia) <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="replaceAmountGramsPerDay"
                      type="number"
                      min="1"
                      placeholder="Ex: 500"
                      value={amountGramsPerDay}
                      onChange={(e) => setAmountGramsPerDay(e.target.value)}
                      className="bg-slate-900/80 border-slate-800 text-slate-100 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="replaceHydrationMl" className="text-xs text-slate-300">
                      Meta de Hidratação (ml/dia) <span className="text-slate-500">(opcional)</span>
                    </Label>
                    <Input
                      id="replaceHydrationMl"
                      type="number"
                      min="0"
                      placeholder="Ex: 1500"
                      value={hydrationMl}
                      onChange={(e) => setHydrationMl(e.target.value)}
                      className="bg-slate-900/80 border-slate-800 text-slate-100 font-mono"
                    />
                  </div>

                  {/* Timezone - Input IANA validado pelo backend */}
                  <div className="space-y-1.5">
                    <Label htmlFor="replaceTimezone" className="text-xs text-slate-300">
                      Fuso Horário IANA <span className="text-slate-500">(ex: America/Sao_Paulo)</span>
                    </Label>
                    <Input
                      id="replaceTimezone"
                      placeholder="America/Sao_Paulo"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="bg-slate-900/80 border-slate-800 text-slate-100 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 2: Cronograma de Refeições */}
              <div className="space-y-3 border-t border-slate-800/80 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                    <Utensils className="h-4 w-4" />
                    <span>Cronograma Diário de Refeições</span>
                  </h4>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddMealSlot}
                    className="text-xs"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Adicionar Refeição
                  </Button>
                </div>

                {/* Barra de Validação Contínua de Soma */}
                <div
                  data-testid="meal-sum-validation-bar"
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 text-xs transition ${
                    totalAmount > 0 && isSumValid
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-slate-400">Meta Diária:</span>{" "}
                      <strong className="font-mono text-slate-100">{totalAmount} g</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Distribuído:</span>{" "}
                      <strong className="font-mono text-slate-100">{distributedAmount} g</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isSumValid ? (
                      <Badge tone="green" className="text-[11px]">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Distribuição Completa (100%)
                      </Badge>
                    ) : (
                      <Badge tone="yellow" className="text-[11px]">
                        {distributedAmount < totalAmount
                          ? `Faltam ${totalAmount - distributedAmount} g`
                          : `Excesso de ${distributedAmount - totalAmount} g`}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Lista de Refeições */}
                <div className="space-y-2.5">
                  {mealSchedule.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3"
                    >
                      <div className="w-full sm:w-1/3">
                        <Label className="text-[10px] text-slate-400">Período</Label>
                        <select
                          value={slot.period}
                          onChange={(e) =>
                            handleUpdateMealSlot(slot.id, "period", e.target.value as MealPeriod)
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-slate-100 focus:outline-none"
                        >
                          {(Object.keys(PERIOD_LABELS) as MealPeriod[]).map((p) => (
                            <option key={p} value={p}>
                              {PERIOD_LABELS[p]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full sm:w-1/3">
                        <Label className="text-[10px] text-slate-400">Horário Programado</Label>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <Input
                            type="time"
                            value={slot.scheduledTime}
                            onChange={(e) =>
                              handleUpdateMealSlot(slot.id, "scheduledTime", e.target.value)
                            }
                            className="bg-slate-900 border-slate-700 text-xs py-1.5"
                          />
                        </div>
                      </div>

                      <div className="w-full sm:w-1/3">
                        <Label className="text-[10px] text-slate-400">Quantidade (g)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={slot.targetGrams || ""}
                          onChange={(e) =>
                            handleUpdateMealSlot(
                              slot.id,
                              "targetGrams",
                              Number(e.target.value) || 0
                            )
                          }
                          className="bg-slate-900 border-slate-700 text-xs py-1.5 font-mono"
                        />
                      </div>

                      <div className="flex items-end justify-end sm:self-end pb-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleRemoveMealSlot(slot.id)}
                          disabled={mealSchedule.length <= 1}
                          className="text-slate-500 hover:text-red-400 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seção 3: Suplementação */}
              <div className="space-y-3 border-t border-slate-800/80 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                    <Droplets className="h-4 w-4" />
                    <span>Regime de Suplementação (Opcional)</span>
                  </h4>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddSupplement}
                    className="text-xs"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Adicionar Suplemento
                  </Button>
                </div>

                {supplements.length > 0 && (
                  <div className="space-y-3">
                    {supplements.map((supp) => (
                      <div
                        key={supp.id}
                        className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="sm:col-span-2">
                            <Label className="text-[10px] text-slate-400">Nome do Suplemento</Label>
                            <Input
                              placeholder="Ex: Ômega 3 K9"
                              value={supp.name}
                              onChange={(e) =>
                                handleUpdateSupplement(supp.id, "name", e.target.value)
                              }
                              className="bg-slate-900 border-slate-700 text-xs"
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] text-slate-400">Dose</Label>
                            <Input
                              type="number"
                              placeholder="Ex: 2"
                              value={supp.dose}
                              min={0.1}
                              step={0.1}
                              onChange={(e) =>
                                handleUpdateSupplement(supp.id, "dose", parseFloat(e.target.value) || 0)
                              }
                              className="bg-slate-900 border-slate-700 text-xs"
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] text-slate-400">Unidade</Label>
                            <select
                              value={supp.unit}
                              onChange={(e) =>
                                handleUpdateSupplement(supp.id, "unit", e.target.value)
                              }
                              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1.5 text-xs"
                            >
                              <option value="mg">mg</option>
                              <option value="g">g</option>
                              <option value="ml">ml</option>
                              <option value="scoop">Medida</option>
                              <option value="tablet">Comprimido</option>
                              <option value="drop">Gota</option>
                              <option value="other">Outro</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                          <div className="sm:col-span-2">
                            <Label className="text-[10px] text-slate-400">Frequência</Label>
                            <Input
                              placeholder="Ex: 1x ao dia"
                              value={supp.frequency}
                              onChange={(e) =>
                                handleUpdateSupplement(supp.id, "frequency", e.target.value)
                              }
                              className="bg-slate-900 border-slate-700 text-xs"
                            />
                          </div>

                          <div className="sm:col-span-2 flex items-center justify-between gap-2">
                            <div className="w-full">
                              <Label className="text-[10px] text-slate-400">Instruções</Label>
                              <Input
                                placeholder="Ex: Junto à refeição da manhã"
                                value={supp.instructions || ""}
                                onChange={(e) =>
                                  handleUpdateSupplement(supp.id, "instructions", e.target.value)
                                }
                                className="bg-slate-900 border-slate-700 text-xs"
                              />
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleRemoveSupplement(supp.id)}
                              className="text-slate-500 hover:text-red-400 h-9 w-9 p-0 mt-4 shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Seção 4: Campos Administrativos Preservados (Info) */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <UserCheck className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Campos administrativos preservados do plano anterior</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
                  {snapshotData?.specialInstructions && (
                    <div>
                      <span className="text-slate-500">Instruções Especiais:</span>{" "}
                      <span className="text-slate-300 truncate block">
                        {String(snapshotData.specialInstructions).substring(0, 50)}...
                      </span>
                    </div>
                  )}
                  {snapshotData?.professional && (
                    <div>
                      <span className="text-slate-500">Profissional:</span>{" "}
                      <span className="text-slate-300">
                        {snapshotData.professional.name || "--"}
                      </span>
                    </div>
                  )}
                  {snapshotData?.sourceDocument && (
                    <div>
                      <span className="text-slate-500">Documento de Origem:</span>{" "}
                      <span className="text-slate-300">
                        {snapshotData.sourceDocument.health_document_id.substring(0, 20)}...
                      </span>
                    </div>
                  )}
                  {!snapshotData?.specialInstructions &&
                    !snapshotData?.professional &&
                    !snapshotData?.sourceDocument && (
                      <div className="text-slate-500 italic">
                        Nenhum campo administrativo para preservar
                      </div>
                    )}
                </div>
              </div>
            </fieldset>

            {/* Botões de edição */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800 pt-5">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                variant="primary"
                disabled={isStale || !isSumValid || !foodType.trim() || totalAmount <= 0}
                className="text-xs font-bold px-6"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Revisar Substituição
              </Button>
            </div>
          </form>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* PHASE: EXECUTING — DURANTE EXECUÇÃO */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {phase === "executing" && !isSuccess && !isError && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <RefreshCw className="h-12 w-12 text-cyan-400 animate-spin" />
            <div className="text-center">
              <div className="text-sm font-bold text-slate-200">
                Substituindo Plano Alimentar...
              </div>
              <div className="text-xs text-slate-400 mt-1">
                A nova versão está sendo criada e ativada.
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* RODAPÉ — REVISÃO E CONFIRMAÇÃO */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {phase === "reviewing" && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800 pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBackToEditing}
              disabled={createState.status === "executing"}
              className="text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Voltar e Editar
            </Button>

            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmReplacement}
              disabled={createState.status === "executing"}
              className="text-xs font-bold px-6"
            >
              {createState.status === "executing" ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Substituindo...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Confirmar Substituição
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
