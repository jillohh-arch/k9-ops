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

      <div className="flex flex-col gap-3 border-b border-border/50 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted/50" />
          <div className="flex flex-col gap-2">
            <div className="h-5 w-64 rounded bg-muted/50" />
            <div className="h-3 w-80 rounded bg-muted/30" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-32 rounded-lg bg-muted/40" />
          <div className="h-8 w-40 rounded-lg bg-muted/30" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4"
          >
            <div className="h-7 w-10 rounded bg-muted/50" />
            <div className="h-3 w-28 rounded bg-muted/40" />
            <div className="h-2.5 w-20 rounded bg-muted/25" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="h-4 w-48 rounded bg-muted/50" />
        <div className="flex flex-wrap gap-2.5">
          <div className="h-9 w-full max-w-xs rounded-lg bg-muted/40" />
          <div className="h-9 w-32 rounded-lg bg-muted/30" />
          <div className="h-9 w-32 rounded-lg bg-muted/30" />
          <div className="h-9 w-36 rounded-lg bg-muted/30" />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-muted/50" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3 w-40 rounded bg-muted/40" />
              <div className="h-2.5 w-56 rounded bg-muted/25" />
            </div>
            <div className="h-6 w-24 shrink-0 rounded-full bg-muted/30" />
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
      className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card p-10 text-center"
      data-testid="health-readiness-empty"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
        <SearchX className="h-5 w-5" aria-hidden="true" />
      </div>
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
      className="flex flex-col items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/5 p-10 text-center"
      data-testid="health-readiness-error"
      role="alert"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
        <AlertOctagon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">
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
