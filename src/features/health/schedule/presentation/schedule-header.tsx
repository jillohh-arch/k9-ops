"use client";

/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — UX-R1
 * Header component for Health Agenda (/health/schedule)
 *
 * Follows K9 Ops design language established in:
 * - HealthOverviewHeader (/health)
 * - HealthReadinessHeader (/health/readiness)
 *
 * Visual hierarchy:
 * - Dark premium navy gradient with cyan radial wash
 * - Tactical calendar icon tile with cyan glow
 * - Micro-label uppercase tracking-[0.24em]
 * - Clear title and operational subtitle
 * - Truthful metric chips: total scheduled, overdue alert, today execution
 * - Action buttons: refresh and link to overview
 */

import Link from "next/link";
import {
  CalendarDays,
  Clock,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduleHeaderProps {
  totalCount: number;
  overdueCount: number;
  todayCount: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function ScheduleHeader({
  totalCount,
  overdueCount,
  todayCount,
  onRefresh,
  isRefreshing = false,
}: ScheduleHeaderProps) {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-cyan-200/12 p-5 sm:p-6",
        "bg-[radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(8,19,32,0.96),rgba(4,10,20,0.92))]",
        "shadow-[0_26px_90px_rgba(0,0,0,0.24)]",
      )}
      data-testid="schedule-header"
    >
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        {/* Identity & description */}
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.18)]">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              Agenda operacional
            </p>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Agenda de Procedimentos e Cuidados K9
            </h1>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400 sm:text-sm">
              Planejamento preventivo, cuidados de rotina e compromissos veterinários do efetivo canino.
            </p>
          </div>
        </div>

        {/* Truthful metrics and actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Total scheduled */}
          <div className="flex items-center gap-2 rounded-xl border border-cyan-200/12 bg-[#0b1628]/82 px-3 py-2 text-xs font-medium">
            <span className="text-muted-foreground">Total na agenda:</span>
            <span
              className="font-bold tabular-nums text-foreground"
              data-testid="schedule-header-total"
            >
              {totalCount}
            </span>
          </div>

          {/* Overdue alert chip */}
          {overdueCount > 0 && (
            <div
              className="flex items-center gap-1.5 rounded-xl border border-red-400/25 bg-red-400/[0.08] px-3 py-2 text-xs font-medium text-red-200 shadow-[0_0_15px_rgba(248,113,113,0.15)]"
              data-testid="schedule-header-overdue"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden="true" />
              <span>Vencidos:</span>
              <span className="font-bold tabular-nums text-red-300">{overdueCount}</span>
            </div>
          )}

          {/* Today chip */}
          {todayCount > 0 && (
            <div
              className="flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-2 text-xs font-medium text-cyan-200 shadow-[0_0_15px_rgba(34,211,238,0.12)]"
              data-testid="schedule-header-today"
            >
              <Clock className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
              <span>Para hoje:</span>
              <span className="font-bold tabular-nums text-cyan-100">{todayCount}</span>
            </div>
          )}

          {/* Refresh action */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
              aria-label="Atualizar agenda"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
                aria-hidden="true"
              />
              <span>{isRefreshing ? "Atualizando..." : "Atualizar"}</span>
            </button>
          )}

          {/* Overview link */}
          <Link
            href="/health"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3.5 py-2 text-xs font-semibold text-cyan-200 shadow-sm transition-colors",
              "hover:bg-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label="Ver visão geral de saúde"
          >
            <span>Visão Geral</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
