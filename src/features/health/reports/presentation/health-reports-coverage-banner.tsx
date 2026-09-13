"use client";

/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Truthful coverage & data quality indicator for reporting scopes.
 *
 * Enforces ZERO vs UNKNOWN semantics:
 * When coverage is degraded or partial, informs the operator which scopes
 * are incomplete rather than pretending missing data is zero.
 */

import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HealthReportsCoverageSummary } from "../domain/health-reports-types";

interface HealthReportsCoverageBannerProps {
  summary: HealthReportsCoverageSummary;
}

export function HealthReportsCoverageBanner({
  summary,
}: HealthReportsCoverageBannerProps) {
  if (summary.isAllComplete) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <span>
            <strong>Cobertura de Dados Completa:</strong> Todos os{" "}
            {summary.totalDogsInScope} cães do escopo institucional foram avaliados com sucesso.
          </span>
        </div>
        <Badge tone="green">Auditado 100%</Badge>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200"
      role="alert"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <span>Atenção: Cobertura Institucional Parcial</span>
        </div>
        <Badge tone="yellow">Dados Parciais</Badge>
      </div>

      <p className="text-amber-300/90">
        Alguns registros não puderam ser verificados em sua totalidade. Métrica &quot;0&quot; em áreas
        afetadas representa cobertura indeterminada (desconhecida), não ausência comprovada.
      </p>

      {summary.notes.length > 0 && (
        <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
          {summary.notes.map((note, idx) => (
            <li key={idx}>{note}</li>
          ))}
        </ul>
      )}

      {(summary.forbiddenDogsCount > 0 || summary.failedDogsCount > 0) && (
        <div className="mt-1 flex items-center gap-2 text-slate-400">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
          <span>
            {summary.forbiddenDogsCount > 0 &&
              `${summary.forbiddenDogsCount} cão(ões) com leitura negada por regras de segurança. `}
            {summary.failedDogsCount > 0 &&
              `${summary.failedDogsCount} cão(ões) com erro de conexão temporário.`}
          </span>
        </div>
      )}
    </div>
  );
}
