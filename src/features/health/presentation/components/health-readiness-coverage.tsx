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
      bg: "bg-emerald-500/10",
    },
    {
      key: "partial",
      label: coverage.partialReads === 1 ? "leitura parcial" : "leituras parciais",
      count: coverage.partialReads,
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      key: "stale",
      label: coverage.staleReads === 1 ? "leitura desatualizada" : "leituras desatualizadas",
      count: coverage.staleReads,
      icon: Clock,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
    {
      key: "missing",
      label: coverage.missingProjections === 1 ? "sem projeção válida" : "sem projeção válida",
      count: coverage.missingProjections,
      icon: HelpCircle,
      color: "text-muted-foreground",
      bg: "bg-muted/40",
    },
    {
      key: "conflict",
      label: coverage.conflicts === 1 ? "conflito identificado" : "conflitos identificados",
      count: coverage.conflicts,
      icon: GitCompareArrows,
      color: "text-fuchsia-300",
      bg: "bg-fuchsia-500/10",
    },
  ];

  return (
    <div
      className="flex flex-col gap-5 rounded-xl border border-border/60 bg-card p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between"
      data-testid="health-readiness-coverage"
    >
      <div className="flex items-start gap-3 lg:max-w-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Sobre a prontidão</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            A prontidão provém da projeção canônica do Backend e não é calculada nesta
            navegação. Os indicadores abaixo descrevem a qualidade da leitura, não a saúde
            do efetivo.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {indicators.map((indicator) => {
          const Icon = indicator.icon;

          return (
            <div key={indicator.key} className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  indicator.bg,
                )}
              >
                <Icon className={cn("h-4 w-4", indicator.color)} aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <dd className={cn("text-lg font-bold leading-none", indicator.color)}>
                  {indicator.count}
                </dd>
                <dt className="text-[11px] leading-snug text-muted-foreground">
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
