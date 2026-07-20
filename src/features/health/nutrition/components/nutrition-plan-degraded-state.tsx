"use client";

import { AlertTriangle } from "lucide-react";

interface ParsingErrorItem {
  documentId: string;
  error: string;
  collection: string;
  rawStatus?: string;
}

interface NutritionPlanDegradedStateProps {
  reason?: string;
  parsingErrors?: ParsingErrorItem[];
}

export function NutritionPlanDegradedState({
  reason,
  parsingErrors = [],
}: NutritionPlanDegradedStateProps) {
  return (
    <div
      data-testid="nutrition-plan-degraded-state"
      className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 shadow-sm"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
      <div className="space-y-1">
        <div className="font-bold text-amber-100">
          Modo de Leitura Parcial (Degradado)
        </div>
        <p className="text-amber-200/80 leading-relaxed">
          {reason
            ? `Leitura degradada: ${reason}. Os dados disponíveis estão sendo exibidos abaixo.`
            : "Algumas fontes de dados secundárias contêm inconsistências ou erros de leitura. As informações válidas disponíveis continuam visíveis."}
        </p>
        {parsingErrors.length > 0 && (
          <div className="mt-2 text-[11px] font-mono text-amber-300">
            Erros parciais de leitura: {parsingErrors.length} documento(s) com erro.
          </div>
        )}
      </div>
    </div>
  );
}
