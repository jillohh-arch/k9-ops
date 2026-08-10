/**
 * K9 Ops Web — Health Web v1 HW-3C
 * Loading / empty / error states for /health/readiness
 *
 * MANDATE §21/§22/§23:
 * - Skeleton must NOT render 0 as a real count while loading.
 * - Skeleton must NOT render "Não avaliado" as a placeholder.
 * - Empty scope is a TRUE empty state, not a projection failure.
 */

import { AlertOctagon, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

/** Stable skeleton matching the readiness layout: header, 5 cards, filters, rows. */
export function HealthReadinessSkeleton() {
  return (
    <div
      className="flex animate-pulse flex-col gap-6"
      data-testid="health-readiness-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando prontidão do efetivo K9...</span>

      {/* Skeleton mirrors the real structure: identity panel, then instruments. */}
      <div className="rounded-[2rem] border border-cyan-200/12 bg-[#0b1628]/60 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-muted/50" />
            <div className="flex flex-col gap-2">
              <div className="h-2.5 w-36 rounded bg-muted/30" />
              <div className="h-6 w-64 rounded bg-muted/50" />
              <div className="h-3 w-80 rounded bg-muted/30" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-32 rounded-xl bg-muted/40" />
            <div className="h-9 w-40 rounded-xl bg-muted/30" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex h-[104px] flex-col justify-between rounded-2xl border border-cyan-200/12 bg-[#0b1628]/60 p-3.5"
          >
            <div className="flex items-start justify-between">
              <div className="h-8 w-8 rounded-lg bg-muted/50" />
              <div className="h-7 w-8 rounded bg-muted/40" />
            </div>
            <div className="h-3 w-24 rounded bg-muted/30" />
          </div>
        ))}
      </div>

      {/* Toolbar skeleton: one surface holding search + controls. */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-cyan-200/12 bg-[#0b1628]/60 p-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="h-9 w-full rounded-lg bg-muted/40 lg:max-w-xs" />
        <div className="flex flex-wrap gap-2.5">
          <div className="h-9 w-32 rounded-lg bg-muted/30" />
          <div className="h-9 w-32 rounded-lg bg-muted/30" />
          <div className="h-9 w-36 rounded-lg bg-muted/30" />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/60 p-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-muted/50" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3 w-40 rounded bg-muted/40" />
              <div className="h-2.5 w-56 rounded bg-muted/25" />
            </div>
            <div className="h-6 w-24 shrink-0 rounded-lg bg-muted/30" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** TRUE empty scope: zero K9s institutionally available, not a read failure. */
export function HealthReadinessEmpty() {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="health-readiness-empty"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-500/25 bg-slate-500/10 text-slate-300">
        <SearchX className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
        Efetivo monitorado
      </p>
      <h3 className="text-sm font-semibold text-foreground">
        Nenhum K9 disponível no escopo atual.
      </h3>
      <p className="max-w-md text-xs text-muted-foreground">
        Não há caninos vinculados a esta unidade para monitoramento de prontidão.
      </p>
    </div>
  );
}

interface HealthReadinessErrorProps {
  message?: string;
  onRetry?: () => void;
}

/** Global controlled error: institutional dog list could not be obtained. */
export function HealthReadinessError({ message, onRetry }: HealthReadinessErrorProps) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-3xl border border-red-400/20 bg-red-400/[0.06] p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="health-readiness-error"
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/25 bg-red-400/10 text-red-300">
        <AlertOctagon className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300/80">
        Falha técnica de leitura
      </p>
      <h3 className="text-sm font-semibold text-red-200">
        Não foi possível carregar a prontidão do efetivo.
      </h3>
      <p className="max-w-md text-xs text-muted-foreground">
        Nenhum estado operacional foi presumido. {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-1 inline-flex items-center rounded-lg border border-border/70 bg-background px-3.5 py-1.5 text-xs font-medium text-foreground",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
