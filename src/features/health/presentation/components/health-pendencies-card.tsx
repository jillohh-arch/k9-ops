/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Readiness Pendencies Summary Card for Health Overview (/health)
 *
 * MANDATE §14:
 * Derived facts produced by backend summary completeness fields.
 * Read-only summary of gaps affecting readiness.
 */

import { AlertCircle, Scale, Syringe, Stethoscope, Utensils, CheckCircle2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendenciesSummary } from "../hooks/use-health-overview";

interface HealthPendenciesCardProps {
  pendencies: PendenciesSummary;
}

export function HealthPendenciesCard({ pendencies }: HealthPendenciesCardProps) {
  /**
   * MANDATE: "no pendency detected" is an affirmative claim.
   * It may only be rendered when completeness was actually evaluated for the whole scope.
   * Zero pendencies over incomplete coverage means UNKNOWN, not NONE.
   */
  const noCoverage = pendencies.totalPendencies === 0 && !pendencies.coverageComplete;
  /** Known gaps exist, but some K9s could not be evaluated: report facts + caveat. */
  const partialCoverage = pendencies.totalPendencies > 0 && !pendencies.coverageComplete;

  const items = [
    {
      label: "Pesagens em atraso (> 90 dias)",
      count: pendencies.weightGap,
      icon: Scale,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Vacinações pendentes ou vencidas",
      count: pendencies.vaccineGap,
      icon: Syringe,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      label: "Consultas em atraso (> 180 dias)",
      count: pendencies.consultGap,
      icon: Stethoscope,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    {
      label: "Planos alimentares ausentes",
      count: pendencies.nutritionGap,
      icon: Utensils,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="health-pendencies-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-400">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
              Cobertura das evidências
            </p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">
              Pendências que afetam a prontidão
            </h3>
          </div>
        </div>
        {noCoverage ? (
          <span className="shrink-0 rounded-lg border border-slate-500/25 bg-slate-500/10 px-2 py-1 text-[11px] font-bold text-slate-300">
            Indisponível
          </span>
        ) : (
          <span className="shrink-0 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] font-bold tabular-nums text-amber-300">
            {pendencies.totalPendencies} pendências
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {noCoverage ? (
          /* Nested technical state: deliberately weaker border than the panel. */
          <div
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs text-muted-foreground"
            data-testid="health-pendencies-unavailable"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-500/25 bg-slate-500/10 text-slate-300">
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Cobertura parcial
              </span>
              <span className="font-semibold text-foreground">Pendências indisponíveis</span>
              <span className="leading-relaxed">
                Não foi possível avaliar todas as pendências com os dados disponíveis.
              </span>
            </div>
          </div>
        ) : pendencies.totalPendencies === 0 ? (
          <div
            className="flex flex-col gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400"
            data-testid="health-pendencies-none"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Nenhuma pendência técnica de completude detectada no efetivo.</span>
            </div>
          </div>
        ) : (
          items.map((item) => {
            const Icon = item.icon;
            const hasPendencies = item.count > 0;

            return (
              <div
                key={item.label}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-2.5 text-xs transition-colors",
                  hasPendencies
                    ? "border-border/60 bg-muted/20"
                    : "border-border/30 bg-muted/10 opacity-60"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", item.bg)}>
                    <Icon className={cn("h-3.5 w-3.5", item.color)} aria-hidden="true" />
                  </div>
                  <span className="font-medium text-foreground">{item.label}</span>
                </div>

                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    hasPendencies
                      ? `${item.bg} ${item.color}`
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.count} {item.count === 1 ? "cão" : "cães"}
                </span>
              </div>
            );
          })
        )}

        {partialCoverage && (
          <p
            className="text-[11px] leading-relaxed text-muted-foreground"
            data-testid="health-pendencies-partial-note"
          >
            Cobertura parcial: {pendencies.unevaluatedCount}{" "}
            {pendencies.unevaluatedCount === 1 ? "K9 não pôde" : "K9s não puderam"} ser avaliado
            {pendencies.unevaluatedCount === 1 ? "" : "s"} com os dados disponíveis.
          </p>
        )}
      </div>
    </div>
  );
}
