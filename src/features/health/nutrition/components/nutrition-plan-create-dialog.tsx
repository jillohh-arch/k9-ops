"use client";

import { useState, useId } from "react";
import {
  AlertCircle,
  Apple,
  CheckCircle2,
  Clock,
  Droplets,
  FileText,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
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
  NutritionPlanSupplementRegimen,
  ProfessionalIdentity,
} from "../types";

export interface NutritionPlanCreateDialogProps {
  dogId: string;
  dogName?: string;
  open: boolean;
  onClose: () => void;
  isLegacyContext?: boolean;
}

const PERIOD_LABELS: Record<MealPeriod, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Fim de tarde",
  night: "Noite",
  extra: "Extra",
};

export function NutritionPlanCreateDialog({
  dogId,
  dogName,
  open,
  onClose,
  isLegacyContext = false,
}: NutritionPlanCreateDialogProps) {
  const { createState, prepareCreate, executeCreate, retryCreate, resetCreate } =
    useNutritionPlanMutations();

  const idPrefix = useId();

  // Form State
  const [foodType, setFoodType] = useState("");
  const [amountGramsPerDay, setAmountGramsPerDay] = useState("");
  const [hydrationMl, setHydrationMl] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [timezone] = useState("America/Sao_Paulo");

  // Meal Schedule State
  const [mealSchedule, setMealSchedule] = useState<MealScheduleSlot[]>([
    {
      id: `${idPrefix}-slot-1`,
      period: "morning",
      scheduledTime: "07:00",
      targetGrams: 250,
    },
    {
      id: `${idPrefix}-slot-2`,
      period: "evening",
      scheduledTime: "19:00",
      targetGrams: 250,
    },
  ]);

  // Supplements State
  const [supplements, setSupplements] = useState<NutritionPlanSupplementRegimen[]>([]);

  // Professional Identity State
  const [showProfessional, setShowProfessional] = useState(false);
  const [profName, setProfName] = useState("");
  const [profRegType, setProfRegType] = useState("CRMV");
  const [profRegNum, setProfRegNum] = useState("");
  const [profClinic, setProfClinic] = useState("");
  const [profSpecialty, setProfSpecialty] = useState("");

  // Local validation error message
  const [localError, setLocalError] = useState<string | null>(null);

  // Computed sums
  const totalAmount = Number(amountGramsPerDay) || 0;
  const distributedAmount = mealSchedule.reduce(
    (sum, slot) => sum + (Number(slot.targetGrams) || 0),
    0
  );
  const isSumValid = totalAmount > 0 && distributedAmount === totalAmount;

  // Handle Dialog Close & Reset
  const handleClose = () => {
    if (createState.status === "executing") return;
    resetCreate();
    setLocalError(null);
    onClose();
  };

  // Add Meal Slot
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

  // Remove Meal Slot
  const handleRemoveMealSlot = (slotId: string) => {
    setMealSchedule(mealSchedule.filter((s) => s.id !== slotId));
  };

  // Update Meal Slot
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

  // Add Supplement
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

  // Remove Supplement
  const handleRemoveSupplement = (suppId: string) => {
    setSupplements(supplements.filter((s) => s.id !== suppId));
  };

  // Update Supplement - handles numeric dose and string fields
  const handleUpdateSupplement = (
    suppId: string,
    field: keyof NutritionPlanSupplementRegimen,
    value: string | number
  ) => {
    setSupplements(
      supplements.map((supp) => {
        if (supp.id !== suppId) return supp;
        // Convert dose to number
        if (field === "dose") {
          return { ...supp, [field]: typeof value === "number" ? value : Number(value) || 0 };
        }
        return { ...supp, [field]: value };
      })
    );
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

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

    // Hydration validation (optional >= 0)
    let parsedHydrationMl: number | null = null;
    if (hydrationMl.trim() !== "") {
      const num = Number(hydrationMl);
      if (isNaN(num) || num < 0) {
        setLocalError("A meta de hidratação deve ser maior ou igual a zero (ml/dia).");
        return;
      }
      parsedHydrationMl = num;
    }

    // Professional VO validation if provided
    let professional: ProfessionalIdentity | null = null;
    if (showProfessional || profName.trim() || profRegNum.trim()) {
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
        clinic: profClinic.trim() || null,
        specialty: profSpecialty.trim() || null,
      };
    }

    // Build Command — validFrom is captured exact instant upon submit preparation
    const command: CreateNutritionPlanCommand = {
      dogId,
      planData: {
        foodType: cleanFoodType,
        amountGramsPerDay: totalAmount,
        mealsPerDay: mealSchedule.length,
        timezone: timezone || "America/Sao_Paulo",
        validFrom: new Date().toISOString(),
        validUntil: null,
        mealSchedule,
        supplements: supplements.length > 0 ? supplements : undefined,
        hydrationMl: parsedHydrationMl,
        specialInstructions: specialInstructions.trim() || null,
        professional,
        sourceDocument: null,
        attachmentRefs: null,
      },
    };

    try {
      prepareCreate(command);
      await executeCreate();
    } catch {
      // Error is caught & normalized in hook createState
    }
  };

  const isExecuting = createState.status === "executing" || createState.status === "preparing";
  const isSuccess = createState.status === "success";
  const isError = createState.status === "error";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={dogName ? `Criar e Ativar Plano Alimentar — K9 ${dogName}` : "Criar e Ativar Plano Alimentar Canônico"}
      description="Formulário de cadastro e ativação de plano nutricional canônico K9"
      className="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(100vh-12rem)]">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-5 py-1 space-y-6 min-h-0">
        {/* Banner de Contexto Legado */}
        {isLegacyContext && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
            <Sparkles className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-bold text-amber-100">Transição de Registro Legado:</span>{" "}
              O plano legado continuará totalmente preservado em modo somente leitura. A criação desta nova estrutura canônica passará a ser a referência operacional ativa para este K9.
            </div>
          </div>
        )}

        {/* FEEDBACKS DE ESTADO (Sucesso, Erro Local, Erro de Hook) */}
        {isSuccess && (
          <div
            data-testid="create-plan-success-banner"
            className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-sm text-emerald-200"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-emerald-100">
                  Plano Alimentar Ativado com Sucesso!
                </div>
                <div className="text-xs text-emerald-300/80">
                  {createState.result?.wasNoOp
                    ? "Replay idêntico processado (ID de operação já ativo)."
                    : "O novo plano alimentar canônico foi registrado e ativado para este K9."}
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={handleClose}
              className="border-emerald-500/30 text-emerald-200"
            >
              Concluir
            </Button>
          </div>
        )}

        {localError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-200">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
            <span>{localError}</span>
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-xs text-red-200 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              <div>
                <div className="font-bold text-red-100">
                  Falha ao Criar Plano Alimentar
                </div>
                <div className="text-red-300/80 mt-0.5">
                  {createState.error?.message || "Ocorreu um erro ao processar a mutação."}
                </div>
              </div>
            </div>

            {/* Ações de Recuperação (Retry vs Edit Reset) */}
            <div className="flex items-center gap-3 border-t border-red-500/20 pt-3">
              {createState.error &&
                !("kind" in createState.error) &&
                createState.error.retryable && (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => retryCreate()}
                    disabled={isExecuting}
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
                disabled={isExecuting}
                className="text-xs py-1.5 px-3 text-slate-300 hover:text-white"
              >
                Revisar dados do formulário
              </Button>
            </div>
          </div>
        )}

        {/* FORMULÁRIO PRINCIPAL (Bloqueado em executing ou success) */}
        <fieldset disabled={isExecuting || isSuccess} className="space-y-6">
          {/* Seção 1: Dados Principais */}
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Apple className="h-4 w-4" />
              <span>Dieta & Meta Diária</span>
            </h4>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="foodType" className="text-xs text-slate-300">
                  Alimento / Dieta Prescrita <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="foodType"
                  placeholder="Ex: Ração Super Premium K9 High Energy"
                  value={foodType}
                  onChange={(e) => setFoodType(e.target.value)}
                  className="bg-slate-900/80 border-slate-800 text-slate-100"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="amountGramsPerDay" className="text-xs text-slate-300">
                  Quantidade Diária (g/dia) <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="amountGramsPerDay"
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
                <Label htmlFor="hydrationMl" className="text-xs text-slate-300">
                  Meta de Hidratação (ml/dia) <span className="text-slate-500">(opcional)</span>
                </Label>
                <Input
                  id="hydrationMl"
                  type="number"
                  min="0"
                  placeholder="Ex: 1500"
                  value={hydrationMl}
                  onChange={(e) => setHydrationMl(e.target.value)}
                  className="bg-slate-900/80 border-slate-800 text-slate-100 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Fuso Horário Operacional</Label>
                <Input
                  value={timezone}
                  disabled
                  className="bg-slate-950/60 border-slate-800 text-slate-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Cronograma de Refeições com Validação Contínua */}
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <Utensils className="h-4 w-4" />
                <span>Cronograma Diário de Refeições</span>
              </h4>

              <Button
                type="button"
                variant="secondary"
                onClick={handleAddMealSlot}
                className="text-xs border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Adicionar Refeição
              </Button>
            </div>

            {/* Barra de Validação Contínua de Soma */}
            {/* Só exibe quando amountGramsPerDay tem valor */}
            {Number(amountGramsPerDay) > 0 && (
            <div
              data-testid="meal-sum-validation-bar"
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 text-xs transition ${
                isSumValid
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
            )}

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

          {/* Seção 3: Suplementação (Opcional) */}
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <Droplets className="h-4 w-4" />
                <span>Regime de Suplementação (Opcional)</span>
              </h4>

              <Button
                type="button"
                variant="secondary"
                onClick={handleAddSupplement}
                className="text-xs border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10"
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

          {/* Seção 4: Orientações Especiais */}
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 space-y-3">
            <Label htmlFor="specialInstructions" className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Orientações Nutricionais Especiais</span>
              <span className="text-slate-500 font-normal normal-case tracking-normal">(opcional)</span>
            </Label>
            <textarea
              id="specialInstructions"
              rows={3}
              placeholder="Ex: Oferecer água fresca à vontade. Respeitar tempo de descanso pós-refeição antes do treino."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
          </div>

          {/* Seção 5: Profissional Responsável (Opcional Collapsible) */}
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2 cursor-pointer">
                <UserCheck className="h-4 w-4" />
                <span>Profissional Responsável (Opcional)</span>
              </Label>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowProfessional(!showProfessional)}
                className="text-xs text-slate-400 hover:text-white"
              >
                {showProfessional ? "Omitir profissional" : "Informar profissional"}
              </Button>
            </div>

            {showProfessional && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Label className="text-[10px] text-slate-400">Nome Completo</Label>
                    <Input
                      placeholder="Ex: Dr. Fernando Vet"
                      value={profName}
                      onChange={(e) => setProfName(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-400">Tipo de Registro</Label>
                    <Input
                      placeholder="Ex: CRMV, CRM, CRFA"
                      value={profRegType}
                      onChange={(e) => setProfRegType(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[10px] text-slate-400">Número do Registro</Label>
                    <Input
                      placeholder="Ex: SP-12345"
                      value={profRegNum}
                      onChange={(e) => setProfRegNum(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-400">Clínica / Unidade</Label>
                    <Input
                      placeholder="Ex: Hospital Vet K9"
                      value={profClinic}
                      onChange={(e) => setProfClinic(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-400">Especialidade</Label>
                    <Input
                      placeholder="Ex: Nutrição Canina"
                      value={profSpecialty}
                      onChange={(e) => setProfSpecialty(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </fieldset>

        {/* RODAPÉ E BOTÕES DE AÇÃO DO FORMULÁRIO */}
        </div>
        <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800 pt-5 px-5 pb-5 bg-[#081321]">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isExecuting}
            className="text-xs text-slate-400 hover:text-white"
          >
            Cancelar
          </Button>

          <div className="flex items-center gap-2">
            {!isSuccess && (
              <Button
                type="submit"
                variant="primary"
                disabled={isExecuting || !isSumValid || !foodType.trim() || totalAmount <= 0}
                className="text-xs font-bold px-6"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Criar e Ativar Plano
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        </form>
    </Dialog>
  );
}
