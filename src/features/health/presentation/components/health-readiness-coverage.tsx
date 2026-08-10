/**
 * K9 Ops Web — Health Web v1 HW-3C
 * Technical read coverage panel for /health/readiness ("Sobre a prontidão").
 *
 * MANDATE §10:
 * Describes the QUALITY OF THE READ, never health itself.
 * Explicitly NOT a health score and NOT a percentage.
 */

import { ShieldCheck, Clock, AlertTriangle, HelpCircle, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessCoverage } from "../hooks/readiness-view-model";

interface HealthReadinessCoverageProps {
  coverage: ReadinessCoverage;
}

export function HealthReadinessCoveragePanel({ coverage }: HealthReadinessCoverageProps) {
  const indicators = [
    {
      key: "valid",
      label: coverage.validProjections === 1 ? "projeção válida" : "projeções válidas",
      count: coverage.validProjections,
      icon: ShieldCheck,
      color: "text-emerald-400",
      tile: "border-emerald-500/25 bg-emerald-500/10",
    },
    {
      key: "partial",
      label: coverage.partialReads === 1 ? "leitura parcial" : "leituras parciais",
      count: coverage.partialReads,
      icon: AlertTriangle,
      color: "text-amber-400",
      tile: "border-amber-500/25 bg-amber-500/10",
    },
    {
      key: "stale",
      label: coverage.staleReads === 1 ? "leitura desatualizada" : "leituras desatualizadas",
      count: coverage.staleReads,
      icon: Clock,
      color: "text-orange-400",
      tile: "border-orange-500/25 bg-orange-500/10",
    },
    {
      key: "missing",
      label: coverage.missingProjections === 1 ? "sem projeção válida" : "sem projeção válida",
      count: coverage.missingProjections,
      icon: HelpCircle,
      color: "text-muted-foreground",
      tile: "border-slate-500/25 bg-slate-500/10",
    },
    {
      key: "conflict",
      label: coverage.conflicts === 1 ? "conflito identificado" : "conflitos identificados",
      count: coverage.conflicts,
      icon: GitCompareArrows,
      color: "text-fuchsia-300",
      tile: "border-fuchsia-500/25 bg-fuchsia-500/10",
    },
  ];

  return (
    /*
      Technical-system panel, deliberately NOT styled like the readiness
      instruments above: these numbers describe read quality, not operational
      status, so the surface stays neutral navy with slate/cyan micro-labelling.
    */
    <div
      className="relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] lg:flex-row lg:items-center lg:justify-between"
      data-testid="health-readiness-coverage"
    >
      <div className="relative flex items-start gap-3 lg:max-w-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
            Cobertura das projeções
          </p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">Sobre a prontidão</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            A prontidão provém da projeção canônica do Backend e não é calculada nesta
            navegação. Os indicadores abaixo descrevem a qualidade da leitura, não a saúde
            do efetivo.
          </p>
        </div>
      </div>

      <dl className="relative grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {indicators.map((indicator) => {
          const Icon = indicator.icon;

          return (
            <div
              key={indicator.key}
              className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-2"
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                  indicator.tile,
                )}
              >
                <Icon className={cn("h-4 w-4", indicator.color)} aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-col">
                <dd
                  className={cn(
                    "text-lg font-black leading-none tabular-nums",
                    indicator.color,
                  )}
                >
                  {indicator.count}
                </dd>
                <dt className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {indicator.label}
                </dt>
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
