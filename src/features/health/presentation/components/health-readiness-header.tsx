/**
 * K9 Ops Web — Health Web v1 HW-3C
 * Header for the Readiness Workforce View (/health/readiness)
 *
 * Follows approved mockup HW-M02-READINESS-v1.png: title + subtitle on the left,
 * scope badges and "Voltar à visão geral" on the right.
 */

import Link from "next/link";
import { Activity, ArrowLeft, ShieldAlert, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthReadinessHeaderProps {
  /** K9s with a valid canonical projection (NOT the total in scope). */
  validProjections: number;
  attentionRequiredCount: number;
  /** Most recent readiness projection timestamp across the scope. */
  lastUpdatedLabel: string | null;
}

export function HealthReadinessHeader({
  validProjections,
  attentionRequiredCount,
  lastUpdatedLabel,
}: HealthReadinessHeaderProps) {
  return (
    /*
     * Same header grammar homologated in /health (radial cyan wash over layered
     * navy, single halo orb, icon tile, uppercase micro-label), but tightened:
     * this is a triage surface, so padding and type scale stay one step denser
     * than the overview and the metrics/back action sit inline.
     */
    <header
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-cyan-200/12 p-5",
        "bg-[radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(8,19,32,0.96),rgba(4,10,20,0.92))]",
        "shadow-[0_26px_90px_rgba(0,0,0,0.24)]",
      )}
      data-testid="health-readiness-header"
    >
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.18)]">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              Prontidão do efetivo
            </p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
              Prontidão do Efetivo K9
            </h1>
            <p className="mt-1.5 max-w-3xl text-xs leading-5 text-slate-400 sm:text-sm">
              Monitoramento consolidado do estado operacional, restrições e qualidade das
              projeções de saúde.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-cyan-200/12 bg-[#0b1628]/82 px-3 py-1.5 text-xs font-medium">
            <span className="text-muted-foreground">Leituras válidas:</span>
            <span className="font-bold tabular-nums text-foreground">{validProjections}</span>
          </div>

          {attentionRequiredCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-3 py-1.5 text-xs font-medium text-amber-200">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
              <span>Requer atenção:</span>
              <span className="font-bold tabular-nums">{attentionRequiredCount}</span>
            </div>
          )}

          {lastUpdatedLabel && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Atualizado {lastUpdatedLabel}</span>
            </div>
          )}

          <Link
            href="/health"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Voltar à visão geral</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
