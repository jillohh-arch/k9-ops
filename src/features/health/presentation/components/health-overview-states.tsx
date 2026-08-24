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
      {/* Header Skeleton — mirrors the real identity panel, not a bare rule. */}
      <div className="rounded-[2rem] border border-cyan-200/12 bg-[#0b1628]/60 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-muted" />
            <div className="flex flex-col gap-2">
              <div className="h-3 w-40 rounded bg-muted/60" />
              <div className="h-7 w-72 rounded bg-muted" />
              <div className="h-4 w-96 rounded bg-muted/60" />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-32 rounded-xl bg-muted" />
            <div className="h-9 w-28 rounded-xl bg-muted" />
          </div>
        </div>
      </div>

      {/*
        5 Cards Skeleton — same responsive contract as HealthStatusCards:
        2 cols (mobile) -> 3+2 (tablet, incl. 1024) -> 5 across (xl+).
      */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex h-28 flex-col justify-between rounded-2xl border border-cyan-200/12 bg-[#0b1628]/60 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="h-9 w-9 rounded-xl bg-muted" />
              <div className="h-8 w-8 rounded bg-muted" />
            </div>
            <div className="h-3 w-24 rounded bg-muted/60" />
          </div>
        ))}
      </div>

      {/* Middle Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-56 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/60 p-5" />
        <div className="h-56 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/60 p-5" />
      </div>

      {/* List Skeleton */}
      <div className="h-72 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/60 p-5" />
    </div>
  );
}

export function HealthOverviewEmpty() {
  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="health-overview-empty"
    >
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-300/[0.06] blur-3xl"
        aria-hidden="true"
      />
      <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-300">
        <Dog className="h-8 w-8" aria-hidden="true" />
      </div>
      <p className="relative text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">
        Efetivo monitorado
      </p>
      <h3 className="relative mt-1.5 text-base font-semibold text-foreground">
        Nenhum K9 monitorado
      </h3>
      <p className="relative mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
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
      className="flex flex-col items-center justify-center rounded-3xl border border-red-400/20 bg-red-400/[0.06] p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="health-overview-error"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/25 bg-red-400/10 text-red-300">
        <AlertOctagon className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300/80">
        Falha técnica de leitura
      </p>
      <h3 className="mt-1.5 text-base font-semibold text-red-200">
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
