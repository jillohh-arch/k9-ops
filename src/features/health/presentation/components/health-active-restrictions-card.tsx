/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Active Operational Restrictions Card Component for Health Overview (/health)
 *
 * MANDATE §13:
 * - Read-only summary of active operational restrictions from authority `operational_restrictions`.
 * - NO release, edit, create, or cancel buttons!
 */

import { ShieldAlert, AlertCircle, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OperationalRestrictionReadModel } from "../../domain/readiness-types";

interface HealthActiveRestrictionsCardProps {
  restrictions: OperationalRestrictionReadModel[];
  /** False when any restrictions read failed — absence must not be affirmed. */
  coverageComplete?: boolean;
}

export function HealthActiveRestrictionsCard({
  restrictions,
  coverageComplete = true,
}: HealthActiveRestrictionsCardProps) {
  // Absence of restrictions may only be affirmed when every read succeeded.
  const cannotAffirmAbsence = restrictions.length === 0 && !coverageComplete;
  return (
    <div
      className="flex flex-col justify-between rounded-xl border border-border/60 bg-card p-5 shadow-sm"
      data-testid="health-active-restrictions-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-500" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">
            Restrições operacionais ativas
          </h3>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          {restrictions.length} {restrictions.length === 1 ? "restrição" : "restrições"}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {cannotAffirmAbsence ? (
          <div
            className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground"
            data-testid="health-restrictions-unavailable"
          >
            <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground">Restrições indisponíveis</span>
              <span>
                Não foi possível confirmar as restrições ativas com os dados disponíveis.
              </span>
            </div>
          </div>
        ) : restrictions.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Nenhuma restrição operacional ativa no efetivo.</span>
          </div>
        ) : (
          restrictions.map((r) => {
            const isAbsolute = r.type === "absolute";
            const isPartial = r.type === "partial";

            return (
              <div
                key={r.id}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-3 text-xs transition-colors",
                  isAbsolute
                    ? "border-red-500/30 bg-red-500/10"
                    : isPartial
                    ? "border-indigo-500/30 bg-indigo-500/10"
                    : "border-amber-500/30 bg-amber-500/10"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    K9: {r.dogId}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      isAbsolute
                        ? "bg-red-500/20 text-red-400"
                        : isPartial
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "bg-amber-500/20 text-amber-400"
                    )}
                  >
                    Restrição {r.type === "absolute" ? "Absoluta" : r.type === "partial" ? "Parcial" : "Atenção"}
                  </span>
                </div>

                <p className="text-muted-foreground">{r.description || r.reason}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                  {r.authorityLabel && (
                    <span>Autoridade: {r.authorityLabel}</span>
                  )}
                  {r.expectedEnd && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                      <span>
                        Previsão de término: {new Date(r.expectedEnd).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  )}
                  {r.isOverdueReevaluation && (
                    <span className="font-bold text-amber-500">
                      Reavaliação em atraso
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
