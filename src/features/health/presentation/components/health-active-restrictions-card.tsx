/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Active Operational Restrictions Card Component for Health Overview (/health)
 *
 * MANDATE §13:
 * - Read-only summary of active operational restrictions from authority `operational_restrictions`.
 * - NO release, edit, create, or cancel buttons!
 */

import { ShieldAlert, ShieldCheck, AlertCircle, Clock, HelpCircle } from "lucide-react";
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
      className="relative flex flex-col overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="health-active-restrictions-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-400">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
              Restrições ativas
            </p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">
              Restrições operacionais ativas
            </h3>
          </div>
        </div>
        <span className="shrink-0 rounded-lg border border-border bg-muted/30 px-2 py-1 text-[11px] font-bold tabular-nums text-muted-foreground">
          {restrictions.length} {restrictions.length === 1 ? "restrição" : "restrições"}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {cannotAffirmAbsence ? (
          /* Nested technical state: weaker border than the structural panel. */
          <div
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs text-muted-foreground"
            data-testid="health-restrictions-unavailable"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-500/25 bg-slate-500/10 text-slate-300">
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Cobertura parcial
              </span>
              <span className="font-semibold text-foreground">Restrições indisponíveis</span>
              <span className="leading-relaxed">
                Não foi possível confirmar as restrições ativas com os dados disponíveis.
              </span>
            </div>
          </div>
        ) : restrictions.length === 0 ? (
          /*
           * Designed empty state (HW-M01): a shield anchors the panel instead of
           * leaving a large blank region. Affirmative only because every read
           * succeeded — see `cannotAffirmAbsence` above.
           */
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.16)]">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              {/* Exact runtime claim — asserted by the degraded-semantics tests. */}
              <p className="text-sm font-semibold text-foreground">
                Nenhuma restrição operacional ativa no efetivo.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Nenhum K9 possui bloqueio clínico ou limitação operacional.
              </p>
            </div>
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
