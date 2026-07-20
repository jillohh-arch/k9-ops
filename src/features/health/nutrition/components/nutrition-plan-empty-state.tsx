"use client";

import { UtensilsCrossed, ShieldAlert } from "lucide-react";

interface NutritionPlanEmptyStateProps {
  dogName?: string;
  canManage?: boolean;
}

export function NutritionPlanEmptyState({
  dogName,
  canManage = false,
}: NutritionPlanEmptyStateProps) {
  return (
    <div
      data-testid="nutrition-plan-empty-state"
      className="flex flex-col items-center justify-center rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/72 p-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
        <UtensilsCrossed className="h-8 w-8" />
      </div>

      <h3 className="mt-5 text-xl font-bold text-slate-100">
        Nenhum Plano Alimentar Ativo
      </h3>

      <p className="mt-2 max-w-md text-sm text-slate-400">
        {dogName
          ? `O K9 ${dogName} ainda não possui um plano alimentar canônico ou legado cadastrado no sistema.`
          : "Este K9 ainda não possui um plano alimentar canônico ou legado cadastrado no sistema."}
      </p>

      {canManage ? (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-300">
          <span>Modo Gestão Ativo — As funcionalidades de criação de plano alimentar estão sendo preparadas.</span>
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs text-slate-400">
          <ShieldAlert className="h-4 w-4 text-amber-400" />
          <span>Modo Somente Leitura — Requer permissão health.manage_nutrition_plan para cadastrar</span>
        </div>
      )}
    </div>
  );
}
