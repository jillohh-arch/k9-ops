"use client";

import { UtensilsCrossed, ShieldAlert, ShieldCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NutritionPlanEmptyStateProps {
  dogName?: string;
  canManage?: boolean;
  onOpenCreate?: () => void;
}

export function NutritionPlanEmptyState({
  dogName,
  canManage = false,
  onOpenCreate,
}: NutritionPlanEmptyStateProps) {
  return (
    <div
      data-testid="nutrition-plan-empty-state"
      className="flex flex-col items-center justify-center rounded-[1.75rem] border border-cyan-500/20 bg-slate-950/80 p-12 text-center shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-md"
    >
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-[0_0_40px_rgba(6,182,212,0.15)]">
          <UtensilsCrossed className="h-10 w-10" />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-cyan-500/40 bg-slate-900 text-cyan-400">
          <Plus className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <h3 className="text-2xl font-bold text-slate-100 tracking-tight">
          Nenhum Plano Alimentar Ativo
        </h3>
        <p className="max-w-md text-sm text-slate-400 leading-relaxed">
          {dogName
            ? `O K9 ${dogName} ainda não possui um plano alimentar canônico ou legado cadastrado no sistema.`
            : "Este K9 ainda não possui um plano alimentar canônico ou legado cadastrado no sistema."}
        </p>
      </div>

      {canManage && onOpenCreate ? (
        <div className="mt-8 flex flex-col items-center gap-4">
          <Button
            variant="primary"
            onClick={onOpenCreate}
            className="text-xs font-bold px-8 py-2.5 shadow-lg shadow-cyan-500/20"
          >
            <Plus className="mr-2 h-4 w-4" />
            Criar Plano Alimentar
          </Button>
          <span className="text-[11px] text-slate-500 max-w-xs">
            Cadastre nova dieta canônica e cronograma de refeições para este K9
          </span>
        </div>
      ) : canManage ? (
        <div className="mt-8 flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-xs font-semibold text-cyan-300">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Modo Gestão Ativo — Opção de criação pronta para acionamento</span>
        </div>
      ) : (
        <div className="mt-8 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3 text-xs text-slate-400">
          <ShieldAlert className="h-4 w-4 text-amber-400" />
          <span>Modo Somente Leitura — Requer permissão health.manage_nutrition_plan para cadastrar</span>
        </div>
      )}
    </div>
  );
}
