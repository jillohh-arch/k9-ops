"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Info,
  Lock,
  RefreshCw,
  ShieldAlert,
  UserCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNutritionPlanMutations } from "../hooks/use-nutrition-plan-mutations";
import type {
  NutritionPlan,
  NutritionPlanUpdateChanges,
  UpdateNutritionPlanCommand,
} from "../types";

export interface NutritionPlanEditDialogProps {
  plan: NutritionPlan;
  dogName?: string;
  open: boolean;
  onClose: () => void;
}

export function NutritionPlanEditDialog({
  plan,
  dogName,
  open,
  onClose,
}: NutritionPlanEditDialogProps) {
  const { updateState, prepareUpdate, executeUpdate, retryUpdate, resetUpdate } =
    useNutritionPlanMutations();

  // Snapshot initial plan snapshot upon opening
  const [initialPlanId, setInitialPlanId] = useState(plan.id);
  const [initialRevision, setInitialRevision] = useState(plan.revision);

  // Form State
  const [specialInstructions, setSpecialInstructions] = useState(
    plan.specialInstructions || ""
  );
  const [showProfessional, setShowProfessional] = useState(Boolean(plan.professional));
  const [profName, setProfName] = useState(plan.professional?.name || "");
  const [profRegType, setProfRegType] = useState(
    plan.professional?.registration_type || plan.professional?.registrationType || "CRMV"
  );
  const [profRegNum, setProfRegNum] = useState(
    plan.professional?.registration_number || plan.professional?.registrationNumber || ""
  );
  const [profClinic, setProfClinic] = useState(plan.professional?.clinic || "");
  const [profSpecialty, setProfSpecialty] = useState(plan.professional?.specialty || "");

  // Local Validation Error
  const [localError, setLocalError] = useState<string | null>(null);

  // Re-sync initial snapshot when open prop changes (React state adjustment pattern)
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setInitialPlanId(plan.id);
      setInitialRevision(plan.revision);
      setSpecialInstructions(plan.specialInstructions || "");
      setShowProfessional(Boolean(plan.professional));
      setProfName(plan.professional?.name || "");
      setProfRegType(
        plan.professional?.registration_type || plan.professional?.registrationType || "CRMV"
      );
      setProfRegNum(
        plan.professional?.registration_number || plan.professional?.registrationNumber || ""
      );
      setProfClinic(plan.professional?.clinic || "");
      setProfSpecialty(plan.professional?.specialty || "");
      setLocalError(null);
    }
  }

  // Stale Form Detection (Listener updated plan/revision while dialog was open)
  const isStale = plan.id !== initialPlanId || plan.revision !== initialRevision;

  // Handle Dialog Close & Reset
  const handleClose = () => {
    if (updateState.status === "executing") return;
    resetUpdate();
    setLocalError(null);
    onClose();
  };

  // Build minimal patch comparing current state to initial snapshot
  const buildPatch = (): { patch: NutritionPlanUpdateChanges; hasChanges: boolean } => {
    const patch: NutritionPlanUpdateChanges = {};
    let hasChanges = false;

    // 1. specialInstructions comparison
    const initialInstructions = (plan.specialInstructions || "").trim();
    const currentInstructions = specialInstructions.trim();
    if (currentInstructions !== initialInstructions) {
      patch.specialInstructions = currentInstructions.length > 0 ? currentInstructions : null;
      hasChanges = true;
    }

    // 2. professional comparison
    const initialProf = plan.professional;
    if (!showProfessional) {
      if (initialProf != null) {
        patch.professional = null;
        hasChanges = true;
      }
    } else {
      const currentName = profName.trim();
      const currentRegType = profRegType.trim();
      const currentRegNum = profRegNum.trim();
      const currentClinic = profClinic.trim() || null;
      const currentSpecialty = profSpecialty.trim() || null;

      const initialName = (initialProf?.name || "").trim();
      const initialRegType = (
        initialProf?.registration_type ||
        initialProf?.registrationType ||
        ""
      ).trim();
      const initialRegNum = (
        initialProf?.registration_number ||
        initialProf?.registrationNumber ||
        ""
      ).trim();
      const initialClinic = (initialProf?.clinic || "").trim() || null;
      const initialSpecialty = (initialProf?.specialty || "").trim() || null;

      if (
        currentName !== initialName ||
        currentRegType !== initialRegType ||
        currentRegNum !== initialRegNum ||
        currentClinic !== initialClinic ||
        currentSpecialty !== initialSpecialty ||
        initialProf == null
      ) {
        patch.professional = {
          name: currentName,
          registration_type: currentRegType,
          registration_number: currentRegNum,
          clinic: currentClinic,
          specialty: currentSpecialty,
        };
        hasChanges = true;
      }
    }

    // Note: sourceDocument and attachmentRefs are omitted from patch to preserve existing values

    return { patch, hasChanges };
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (isStale) {
      setLocalError(
        `O plano foi atualizado em segundo plano (Revisão #${plan.revision}). Feche e reabra a edição para carregar as informações mais recentes.`
      );
      return;
    }

    // Validate professional VO if enabled
    if (showProfessional) {
      if (!profName.trim()) {
        setLocalError("Informe o nome do profissional responsável.");
        return;
      }
      if (!profRegType.trim()) {
        setLocalError("Informe o tipo de registro do profissional.");
        return;
      }
      if (!profRegNum.trim()) {
        setLocalError("Informe o número de registro do profissional.");
        return;
      }
    }

    const { patch, hasChanges } = buildPatch();

    if (!hasChanges) {
      setLocalError("Nenhuma alteração foi realizada nos dados administrativos.");
      return;
    }

    const command: UpdateNutritionPlanCommand = {
      dogId: plan.dogId,
      planId: plan.id,
      expectedRevision: initialRevision,
      changes: patch,
    };

    try {
      prepareUpdate(command);
      await executeUpdate();
    } catch {
      // Error is caught & normalized in hook updateState
    }
  };

  const isExecuting = updateState.status === "executing" || updateState.status === "preparing";
  const isSuccess = updateState.status === "success";
  const isError = updateState.status === "error";

  // Conflict detection
  const isConflict =
    isError &&
    updateState.error &&
    !("kind" in updateState.error) &&
    (updateState.error.domainCode === "nutrition_plan_conflict" ||
      updateState.error.firebaseCode === "failed-precondition");

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={
        dogName
          ? `Editar Dados Administrativos — K9 ${dogName}`
          : "Editar Dados Administrativos do Plano"
      }
      description="Edição de informações administrativas do plano alimentar ativo sem alteração estrutural"
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Banner de Esclarecimento da Fronteira Administrativa */}
        <div className="flex items-start gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-950/40 p-4 text-xs text-cyan-200">
          <Info className="h-5 w-5 shrink-0 text-cyan-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-cyan-100">Escopo da Edição Administrativa:</span>{" "}
            <span>
              Dados nutricionais estruturais não podem ser alterados nesta edição.
              Para modificá-los, será necessário substituir o plano alimentar atual.
            </span>
          </div>
        </div>

        {/* Alerta de Formulário Desatualizado (Stale Form) */}
        {isStale && (
          <div
            data-testid="stale-form-warning"
            className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 text-xs text-amber-200"
          >
            <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <strong className="font-bold text-amber-100">
                Plano Atualizado em Segundo Plano!
              </strong>
              <div className="text-amber-300/90 mt-0.5">
                A revisão deste plano foi alterada para Rev. #{plan.revision} por outro processo. Por segurança, a submissão foi bloqueada. Feche e abra este formulário novamente para carregar os dados mais recentes.
              </div>
            </div>
          </div>
        )}

        {/* FEEDBACKS DE ESTADO (Sucesso, Erro Local, Erro de Hook) */}
        {isSuccess && (
          <div
            data-testid="update-plan-success-banner"
            className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-sm text-emerald-200"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-emerald-100">
                  Dados Administrativos Atualizados com Sucesso!
                </div>
                <div className="text-xs text-emerald-300/80">
                  {updateState.result?.wasNoOp
                    ? "Replay idêntico processado (ID de operação já executado)."
                    : `As alterações foram registradas (Nova Revisão #${updateState.result?.revision ?? plan.revision + 1}).`}
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
                  {isConflict
                    ? "Conflito de revisão"
                    : "Falha ao Atualizar Dados Administrativos"}
                </div>
                <div className="text-red-300/80 mt-0.5">
                  {isConflict
                    ? "O plano foi atualizado por outro processo ou usuário. Recarregue os dados antes de tentar novamente."
                    : updateState.error?.message || "Ocorreu um erro ao processar a mutação."}
                </div>
              </div>
            </div>

            {/* Ações de Recuperação */}
            <div className="flex items-center gap-3 border-t border-red-500/20 pt-3">
              {isConflict ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  className="text-xs py-1.5 px-3 text-cyan-300 hover:text-white"
                >
                  Revisar Versão Atual
                </Button>
              ) : (
                <>
                  {updateState.error &&
                    !("kind" in updateState.error) &&
                    updateState.error.retryable && (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => retryUpdate()}
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
                    onClick={() => resetUpdate()}
                    disabled={isExecuting}
                    className="text-xs py-1.5 px-3 text-slate-300 hover:text-white"
                  >
                    Revisar dados do formulário
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* CAMPOS EDITÁVEIS ADMINISTRATIVOS */}
        <fieldset disabled={isExecuting || isSuccess || isStale} className="space-y-6">
          {/* Seção 1: Resumo Somente Leitura da Estrutura Ativa */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Lock className="h-3.5 w-3.5" />
                Estrutura Nutricional Inalterável Neste Fluxo
              </span>
              <Badge tone="cyan">Rev. #{initialRevision}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              <div>
                <span className="text-slate-400">Dieta:</span>{" "}
                <strong className="text-slate-200">{plan.foodType || "--"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Quantidade Diária:</span>{" "}
                <strong className="font-mono text-slate-200">{plan.amountGramsPerDay} g/dia</strong>
              </div>
            </div>
          </div>

          {/* Seção 2: Orientações Nutricionais Especiais */}
          <div className="space-y-2">
            <Label htmlFor="specialInstructions" className="text-xs text-slate-300 flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              <span>Orientações Nutricionais Especiais</span>
              <span className="text-slate-500">(opcional — texto em branco remove orientação)</span>
            </Label>
            <textarea
              id="specialInstructions"
              rows={4}
              placeholder="Ex: Oferecer água fresca à vontade. Respeitar tempo de descanso pós-refeição antes do treino."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-100 focus:outline-none"
            />
          </div>

          {/* Seção 3: Profissional Responsável (Collapsible) */}
          <div className="border-t border-slate-800/80 pt-5 space-y-3">
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
                {showProfessional ? "Remover profissional do plano" : "Informar profissional"}
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

        {/* RODAPÉ E BOTÕES DE AÇÃO */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800 pt-5">
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
                disabled={isExecuting || isStale}
                className="text-xs font-bold px-6"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Salvando Alterações...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Salvar Alterações
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
