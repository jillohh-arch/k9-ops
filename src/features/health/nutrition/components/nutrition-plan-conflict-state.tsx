"use client";

import { AlertTriangle, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface IntegrityConflictInfo {
  message: string;
  activePlansCount: number;
  activePlanIds: string[];
}

interface NutritionPlanConflictStateProps {
  conflict: IntegrityConflictInfo | null;
  dogName?: string;
}

export function NutritionPlanConflictState({
  conflict,
  dogName,
}: NutritionPlanConflictStateProps) {
  const count = conflict?.activePlansCount ?? 0;
  const planIds = conflict?.activePlanIds ?? [];

  return (
    <div
      data-testid="nutrition-plan-conflict-state"
      className="space-y-6 rounded-[1.75rem] border border-red-500/40 bg-red-950/20 p-8 shadow-[0_24px_70px_rgba(239,68,68,0.1)]"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-red-200">
              Conflito de integridade
            </h3>
            <Badge tone="red">
              INTEGRITY CONFLICT
            </Badge>
          </div>
          <p className="text-sm text-red-300/80">
            {dogName
              ? `Foram identificados múltiplos planos alimentares ativos para o K9 ${dogName}. Não é possível determinar com segurança qual plano está vigente.`
              : "Foram identificados múltiplos planos alimentares ativos para este K9. Não é possível determinar com segurança qual plano está vigente."}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-red-500/20 bg-slate-950/60 p-5 text-sm">
        <div className="font-semibold text-slate-200">
          Detalhes da Inconsistência:
        </div>
        <ul className="mt-2 space-y-1 text-xs text-slate-300">
          <li>
            • <span className="font-medium text-red-300">Planos ativos encontrados:</span> {count}
          </li>
          {planIds.length > 0 && (
            <li>
              • <span className="font-medium text-red-300">IDs dos planos em conflito:</span>{" "}
              <code className="font-mono text-amber-200">{planIds.join(", ")}</code>
            </li>
          )}
          <li>
            • <span className="font-medium text-red-300">Ação requerida:</span> O sistema interrompeu a seleção automática para impedir inconsistências alimentares no canil.
          </li>
        </ul>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
        <ShieldX className="h-5 w-5 shrink-0 text-amber-400" />
        <span>
          Ações de gestão suspensas temporariamente para este K9. Entre em contato com a equipe de administração do K9 Ops para auditoria e resolução do registro duplicado.
        </span>
      </div>
    </div>
  );
}
