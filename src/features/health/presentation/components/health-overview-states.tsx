/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Technical States Components for Health Overview (/health)
 *
 * Implements Loading, Empty, and Error presentation states according to §17 - §20:
 * - Loading: Skeleton, stable layout, NO false 0s rendered.
 * - Empty: "Nenhum K9 monitorado", "Não há K9s disponíveis para monitoramento no escopo atual desta unidade."
 * - Error: "Não foi possível carregar a prontidão", "Nenhum estado operacional foi presumido.", "Tentar novamente" action.
 */

import { AlertOctagon, Dog, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function HealthOverviewSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 animate-pulse"
      data-testid="health-overview-skeleton"
    >
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted" />
          <div className="flex flex-col gap-2">
            <div className="h-6 w-64 rounded bg-muted" />
            <div className="h-4 w-96 rounded bg-muted/60" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-32 rounded-lg bg-muted" />
          <div className="h-8 w-28 rounded-lg bg-muted" />
        </div>
      </div>

      {/* 5 Cards Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-xl border border-border/40 bg-card p-4 h-24"
          >
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-7 w-12 rounded bg-muted mt-3" />
          </div>
        ))}
      </div>

      {/* Middle Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-56 rounded-xl border border-border/40 bg-card p-5" />
        <div className="h-56 rounded-xl border border-border/40 bg-card p-5" />
      </div>

      {/* List Skeleton */}
      <div className="h-72 rounded-xl border border-border/40 bg-card p-5" />
    </div>
  );
}

export function HealthOverviewEmpty() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card p-12 text-center shadow-sm"
      data-testid="health-overview-empty"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-4">
        <Dog className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        Nenhum K9 monitorado
      </h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-md">
        Não há K9s disponíveis para monitoramento no escopo atual desta unidade.
      </p>
    </div>
  );
}

interface HealthOverviewErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function HealthOverviewError({
  message,
  onRetry,
}: HealthOverviewErrorProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 p-10 text-center shadow-sm"
      data-testid="health-overview-error"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400 mb-3">
        <AlertOctagon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-red-400">
        Não foi possível carregar a prontidão
      </h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-md">
        Nenhum estado operacional foi presumido.
        {message && <span className="block mt-1 font-mono text-[11px] text-red-400/80">{message}</span>}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/20 px-3.5 py-1.5 text-xs font-medium text-red-300 shadow-sm transition-colors",
            "hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tentar novamente</span>
        </button>
      )}
    </div>
  );
}
