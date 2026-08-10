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

export function HealthOverviewHeader({
  totalMonitored,
  attentionRequiredCount,
}: HealthOverviewHeaderProps) {
  return (
    <div
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-6"
      data-testid="health-overview-header"
    >
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Saúde e Prontidão do Efetivo K9
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Visão geral da saúde operacional, evidências clínicas e pontos que impactam a prontidão dos cães.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium">
          {/*
            `totalMonitored` counts ONLY K9s with a valid canonical projection,
            not the total in scope (that appears as "Ver todos (n)").
            Label states that meaning explicitly.
          */}
          <span className="text-muted-foreground">Leituras válidas:</span>
          <span className="font-semibold text-foreground">{totalMonitored}</span>
        </div>

        {attentionRequiredCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-500">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Requer atenção:</span>
            <span className="font-bold">{attentionRequiredCount}</span>
          </div>
        )}

        <Link
          href="/health/readiness"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow transition-colors",
            "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="Ver prontidão do efetivo"
        >
          <span>Ver prontidão</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
