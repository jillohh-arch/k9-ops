"use client";

import { useState, useId } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNutritionPlanMutations } from "../hooks/use-nutrition-plan-mutations";
import type {
  CancelNutritionPlanCommand,
  NutritionMutationError,
  NutritionPlan,
} from "../types";

export interface NutritionPlanCancelDialogProps {
  /** O plano canônico ativo que será cancelado */
  plan: NutritionPlan;
  dogName?: string;
  open: boolean;
  onClose: () => void;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(date: Date | undefined | null): string {
  if (!date || isNaN(date.getTime())) return "--";
  return dateFormatter.format(date);
}

export function NutritionPlanCancelDialog({
  plan,
  dogName,
  open,
  onClose,
}: NutritionPlanCancelDialogProps) {
  const { cancelState, prepareCancel, executeCancel, retryCancel, resetCancel } =
    useNutritionPlanMutations();

  const idPrefix = useId();

  // ═══════════════════════════════════════════════════════════════════════════════
  // SNAPSHOT DO PLANO CANCELADO (Item 7, 11)
  // Capturado no momento da abertura do diálogo
  // ═══════════════════════════════════════════════════════════════════════════════
  const [snapshotPlanId, setSnapshotPlanId] = useState(plan.id);
  const [snapshotRevision, setSnapshotRevision] = useState(plan.revision);

  // ═══════════════════════════════════════════════════════════════════════════════
  // REASON (Item 9)
  // Motivo obrigatório, não pode ser apenas espaços
  // ═══════════════════════════════════════════════════════════════════════════════
  const [reason, setReason] = useState("");

  // Local validation error
  const [localError, setLocalError] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════════
  // RE-SYNC SNAPSHOT QUANDO DIALOG ABRE (Item 7, 8)
  // Padrão síncrono para evitar cascading renders do useEffect
  // ═══════════════════════════════════════════════════════════════════════════════
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setSnapshotPlanId(plan.id);
      setSnapshotRevision(plan.revision);
      setReason("");
      setLocalError(null);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STALE FORM DETECTION (Item 8)
  // Detecta quando o plano foi alterado enquanto o diálogo estava aberto
  // ═══════════════════════════════════════════════════════════════════════════════
  const isStale =
    plan.id !== snapshotPlanId ||
    plan.revision !== snapshotRevision ||
    plan.status !== "active";

  // ═══════════════════════════════════════════════════════════════════════════════
  // ERROR TYPE GUARDS (Item 17)
  // ═══════════════════════════════════════════════════════════════════════════════
  const isHookError = (err: unknown): err is NutritionMutationError => {
    return (
      err != null &&
      typeof err === "object" &&
      !("kind" in err) &&
      "domainCode" in err &&
      "firebaseCode" in err
    );
  };

  const hookError: NutritionMutationError | null =
    cancelState.status === "error" && isHookError(cancelState.error)
      ? cancelState.error
      : null;

  // ═══════════════════════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════════════════════
  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length > 0;

  const isExecuting = cancelState.status === "executing";
  const isSuccess = cancelState.status === "success";
  const hasHookError = cancelState.status === "error" && hookError !== null;

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONFLICT DETECTION (Item 16)
  // ═══════════════════════════════════════════════════════════════════════════════
  const isConflictError =
    hookError !== null &&
    hookError.domainCode === "nutrition_plan_conflict" &&
    hookError.firebaseCode === "failed-precondition";

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBMISSION (Item 12, 14)
  // Fluxo: motivo validado → stale check → prepareCancel → executeCancel
  // Retry: usa retryCancel(), NÃO prepareCancel novamente
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleConfirmCancel = async () => {
    setLocalError(null);

    // 1. Validar motivo (Item 9)
    if (!isReasonValid) {
      setLocalError("Informe o motivo do cancelamento.");
      return;
    }

    // 2. Stale form safety (Item 8)
    if (isStale) {
      setLocalError(
        "O plano ativo foi atualizado enquanto esta confirmação estava aberta. " +
          "Revise a versão atual antes de continuar."
      );
      return;
    }

    // 3. Preparar e executar
    const command: CancelNutritionPlanCommand = {
      dogId: plan.dogId,
      planId: snapshotPlanId,
      expectedRevision: snapshotRevision,
      reason: trimmedReason,
    };

    try {
      prepareCancel(command);
      await executeCancel();
    } catch {
      // Error is caught & normalized in hook cancelState
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RETRY (Item 14, 15)
  // Retry usa retryCancel(), preservando a mesma intenção
  // "Revisar dados" → resetCancel() + novo diálogo se reopened
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleRetry = async () => {
    try {
      await retryCancel();
    } catch {
      // Error handled in hook
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLOSE & RESET (Item 13)
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleClose = () => {
    if (isExecuting) {
      return; // Bloquear fechamento durante execução
    }
    resetCancel();
    setLocalError(null);
    onClose();
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={
        dogName
          ? `Cancelar Plano Alimentar — K9 ${dogName}`
          : "Cancelar Plano Alimentar"
      }
      description="Esta ação encerrará o plano como referência ativa. O histórico será preservado."
      className="max-w-lg"
    >
      <div className="space-y-6">
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* STALE FORM WARNING (Item 8) */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {isStale && (
          <div
            data-testid="cancel-stale-form-warning"
            className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 text-xs text-amber-200"
          >
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold text-amber-100">
                O plano ativo foi atualizado enquanto esta confirmação estava aberta.
              </strong>
              <div className="text-amber-300/90">
                Revise a versão atual antes de continuar.
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                className="mt-2 text-xs py-1 px-3 border-amber-500/30 text-amber-200"
              >
                Revisar versão atual
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* SUCCESS BANNER (Item 18) */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {isSuccess && (
          <div
            data-testid="cancel-plan-success-banner"
            className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-sm text-emerald-200"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-emerald-100">
                  Plano Cancelado com Sucesso!
                </div>
                <div className="text-xs text-emerald-300/80">
                  {cancelState.result?.wasNoOp
                    ? "Replay idêntico processado."
                    : "O plano deixou de ser a referência alimentar ativa do K9."}
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

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* CONFLICT ERROR (Item 16) */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {isConflictError && (
          <div
            data-testid="cancel-conflict-error"
            className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-xs text-red-200"
          >
            <XCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
            <div className="space-y-2">
              <div>
                <strong className="font-bold text-red-100">Conflito de Revisão</strong>
                <div className="text-red-300/80 mt-0.5">
                  O plano foi alterado por outro processo ou usuário. Revise a versão
                  atual antes de tentar cancelar novamente.
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                className="text-xs py-1.5 px-3 border-red-500/30 text-red-200"
              >
                Revisar versão atual
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* LOCAL ERROR */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {localError && !isStale && (
          <div
            data-testid="cancel-local-error"
            className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-200"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{localError}</span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* HOOK ERROR (não-conflito) (Item 17) */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {hasHookError && !isConflictError && hookError && (
          <div
            data-testid="cancel-hook-error"
            className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-xs text-red-200 space-y-3"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              <div>
                <div className="font-bold text-red-100">
                  Falha ao Cancelar Plano Alimentar
                </div>
                <div className="text-red-300/80 mt-0.5">
                  {hookError?.message || "Ocorreu um erro ao processar o cancelamento."}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-red-500/20 pt-3">
              {/* Retry button - Item 14 */}
              {hookError?.retryable && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleRetry}
                  disabled={isExecuting}
                  className="text-xs py-1.5 px-3"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Tentar novamente
                </Button>
              )}
              {/* Revisar dados - Item 15 */}
              <Button
                type="button"
                variant="ghost"
                onClick={() => resetCancel()}
                disabled={isExecuting}
                className="text-xs py-1.5 px-3 text-slate-300 hover:text-white"
              >
                Revisar dados
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* PLAN SUMMARY (Item 7) */}
        {/* Mostra dados de apresentação capturados no snapshot */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {!isSuccess && !isConflictError && (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span>Plano a ser Cancelado</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-500">Dieta</div>
                <div className="font-semibold text-slate-200">{plan.foodType || "—"}</div>
              </div>

              <div className="space-y-0.5">
                <div className="text-slate-500">Revisão</div>
                <div className="flex items-center gap-1.5">
                  <Badge tone="cyan" className="text-[10px]">
                    Rev. #{snapshotRevision}
                  </Badge>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Vigência</span>
                </div>
                <div className="text-slate-300">
                  {formatDate(plan.validFrom)} → {plan.validUntil ? formatDate(plan.validUntil) : "indefinido"}
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-slate-500">ID do Plano</div>
                <div className="font-mono text-slate-400 text-[10px] truncate">
                  {snapshotPlanId}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* IMPACT DISCLOSURE (Item 5) */}
        {/* Esclarece o que significa cancelar */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {!isSuccess && !isConflictError && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 space-y-2">
            <div className="flex items-start gap-2 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-1.5">
                <span className="font-bold text-amber-100">Impacto do Cancelamento:</span>
                <ul className="space-y-1 text-amber-300/90">
                  <li>• O plano não será apagado</li>
                  <li>• O histórico permanecerá preservado</li>
                  <li>• O plano deixará de ser a referência nutricional ativa</li>
                  <li>• Nenhum novo plano será criado automaticamente</li>
                  <li>• O K9 poderá ficar sem plano alimentar ativo até que outro seja criado</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* REASON INPUT (Item 9) */}
        {/* Campo obrigatório, sem pré-preenchimento */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {!isSuccess && !isConflictError && (
          <div className="space-y-2">
            <Label
              htmlFor={`${idPrefix}-cancel-reason`}
              className="text-xs font-semibold text-slate-200"
            >
              Motivo do cancelamento <span className="text-red-400">*</span>
            </Label>
            <Input
              id={`${idPrefix}-cancel-reason`}
              placeholder="Informe por que este plano deixará de ser utilizado como referência ativa."
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
              disabled={isExecuting || isStale}
              className="bg-slate-900/80 border-slate-700 text-slate-100 text-sm"
            />
            <p className="text-[11px] text-slate-500">
              Este motivo será registrado no histórico de auditoria do plano.
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* EXECUTING STATE */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {isExecuting && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <RefreshCw className="h-10 w-10 text-cyan-400 animate-spin" />
            <div className="text-center">
              <div className="text-sm font-bold text-slate-200">
                Cancelando Plano Alimentar...
              </div>
              <div className="text-xs text-slate-400 mt-1">
                O plano está sendo encerrado.
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* ACTION BUTTONS */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {!isSuccess && !isConflictError && !isExecuting && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="text-xs text-slate-400 hover:text-white"
            >
              Voltar
            </Button>

            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmCancel}
              disabled={!isReasonValid || isStale}
              className="text-xs font-bold"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              Confirmar cancelamento
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
