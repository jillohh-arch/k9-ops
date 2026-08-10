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
    <div
      className="flex flex-col gap-4 border-b border-border/50 pb-6 lg:flex-row lg:items-center lg:justify-between"
      data-testid="health-readiness-header"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Activity className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Prontidão do Efetivo K9
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Monitoramento consolidado do estado operacional, restrições e qualidade das
            projeções de saúde.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium">
          <span className="text-muted-foreground">Leituras válidas:</span>
          <span className="font-semibold text-foreground">{validProjections}</span>
        </div>

        {attentionRequiredCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-500">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Requer atenção:</span>
            <span className="font-bold">{attentionRequiredCount}</span>
          </div>
        )}

        {lastUpdatedLabel && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Atualizado {lastUpdatedLabel}</span>
          </div>
        )}

        <Link
          href="/health"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Voltar à visão geral</span>
        </Link>
      </div>
    </div>
  );
}
