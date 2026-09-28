"use client";

/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — UX-R1
 * Technical state components for /health/schedule:
 * - ScheduleSkeleton (animated loading skeleton)
 * - ScheduleEmpty (authoritative empty scope)
 * - ScheduleError (controlled technical error)
 */

import { AlertOctagon, CalendarX, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Loading skeleton matching the Agenda layout:
 * Header surface -> 5 summary cards -> row cards list.
 *
 * INVARIANT: Never renders 0 as a real count, never renders "Nenhum agendamento".
 */
export function ScheduleSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 animate-pulse"
      data-testid="schedule-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando agenda operacional...</span>

      {/* Header Skeleton */}
      <div className="rounded-[2rem] border border-cyan-200/12 bg-[#0b1628]/60 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-muted/50" />
            <div className="flex flex-col gap-2">
              <div className="h-2.5 w-36 rounded bg-muted/30" />
              <div className="h-7 w-72 rounded bg-muted/50" />
              <div className="h-3.5 w-96 max-w-full rounded bg-muted/30" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <div className="h-9 w-32 rounded-xl bg-muted/40" />
            <div className="h-9 w-28 rounded-xl bg-muted/30" />
          </div>
        </div>
      </div>

      {/* Summary Cards Skeleton (5 cards) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex h-24 flex-col justify-between rounded-2xl border border-cyan-200/12 bg-[#0b1628]/60 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="h-8 w-8 rounded-lg bg-muted/50" />
              <div className="h-7 w-8 rounded bg-muted/40" />
            </div>
            <div className="h-3 w-20 rounded bg-muted/30" />
          </div>
        ))}
      </div>

      {/* Row Cards Skeleton */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-2xl border border-cyan-200/10 bg-[#0b1628]/60 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-48 rounded bg-muted/50" />
              <div className="h-3 w-32 rounded bg-muted/30" />
              <div className="h-3 w-56 rounded bg-muted/20" />
            </div>
            <div className="h-6 w-24 shrink-0 rounded-full bg-muted/40 sm:self-center" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface ScheduleEmptyProps {
  onRetry?: () => void;
}

/**
 * Authoritative empty scope.
 * Only rendered when coverage is complete and zero schedule items exist.
 */
export function ScheduleEmpty({ onRetry }: ScheduleEmptyProps) {
  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="schedule-empty"
      role="status"
    >
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-300/[0.06] blur-3xl"
        aria-hidden="true"
      />
      <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
        <CalendarX className="h-8 w-8" aria-hidden="true" />
      </div>
      <p className="relative text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">
        Agenda operacional
      </p>
      <h3 className="relative mt-1.5 text-base font-semibold text-foreground">
        Nenhum agendamento encontrado.
      </h3>
      <p className="relative mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
        Nenhum item de agenda existe para o efetivo autorizado.
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "relative mt-5 inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-200 shadow-sm transition-colors",
            "hover:bg-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Atualizar agenda</span>
        </button>
      )}
    </div>
  );
}

interface ScheduleErrorProps {
  message: string;
  code?: string;
  retryable?: boolean;
  onRetry?: () => void;
}

/**
 * Controlled error state.
 * Rendered when technical scope read fails unrecoverably.
 */
export function ScheduleError({
  message,
  code,
  retryable = true,
  onRetry,
}: ScheduleErrorProps) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-3xl border border-red-400/20 bg-red-400/[0.06] p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="schedule-error"
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/25 bg-red-400/10 text-red-300 shadow-[0_0_18px_rgba(248,113,113,0.18)]">
        <AlertOctagon className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300/80">
        Falha técnica de leitura
      </p>
      <h3 className="text-sm font-semibold text-red-200">
        Erro ao carregar
      </h3>
      <p className="max-w-md text-xs text-muted-foreground">
        Nenhum estado operacional foi presumido. {message}
      </p>
      {code && (
        <p className="font-mono text-[11px] text-muted-foreground/80">
          Código: {code}
        </p>
      )}
      {retryable && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200 shadow-sm transition-colors",
            "hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tentar novamente</span>
        </button>
      )}
    </div>
  );
}
