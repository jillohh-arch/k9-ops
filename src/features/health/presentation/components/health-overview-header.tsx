/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Header component for Health Overview (/health)
 */

import Link from "next/link";
import { Activity, ShieldAlert, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthOverviewHeaderProps {
  totalMonitored: number;
  attentionRequiredCount: number;
}

/**
 * Overview identity region.
 *
 * Composition follows HW-M01-OVERVIEW-v1: a single header carrying the module
 * title plus inline operational metrics and the readiness CTA. The surface uses
 * the established K9 Ops header grammar (radial cyan wash over layered navy,
 * one soft halo orb) so the module reads as part of the product without turning
 * into a hero band — operational density is preserved.
 */
export function HealthOverviewHeader({
  totalMonitored,
  attentionRequiredCount,
}: HealthOverviewHeaderProps) {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-cyan-200/12 p-6",
        "bg-[radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(8,19,32,0.96),rgba(4,10,20,0.92))]",
        "shadow-[0_26px_90px_rgba(0,0,0,0.24)]",
      )}
      data-testid="health-overview-header"
    >
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.18)]">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              Prontidão operacional
            </p>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Saúde e Prontidão do Efetivo K9
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Visão geral da saúde operacional, evidências clínicas e pontos que impactam a prontidão dos cães.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-cyan-200/12 bg-[#0b1628]/82 px-3 py-2 text-xs font-medium">
            {/*
              `totalMonitored` counts ONLY K9s with a valid canonical projection,
              not the total in scope (that appears as "Ver todos (n)").
              Label states that meaning explicitly.
            */}
            <span className="text-muted-foreground">Leituras válidas:</span>
            <span className="font-bold tabular-nums text-foreground">{totalMonitored}</span>
          </div>

          {attentionRequiredCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs font-medium text-amber-200">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
              <span>Requer atenção:</span>
              <span className="font-bold tabular-nums">{attentionRequiredCount}</span>
            </div>
          )}

          <Link
            href="/health/readiness"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground",
              "shadow-[0_0_20px_rgba(77,208,225,0.22)] transition-colors",
              "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label="Ver prontidão do efetivo"
          >
            <span>Ver prontidão</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
