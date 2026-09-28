"use client";

/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — UX-R1
 * Five Operational Summary Cards for /health/schedule
 *
 * MANDATE:
 * - Counts are derived EXCLUSIVELY from loaded entries.
 * - Zero fabricated data, zero fake statistics.
 * - Interactive filter toggling (client-side in-memory).
 * - Avoids conflicting section-heading labels (e.g. preserves presentation contracts).
 */

import {
  CalendarClock,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ScheduleFilterType =
  | "all"
  | "overdue"
  | "today"
  | "upcoming"
  | "completed";

export interface ScheduleSummaryCounts {
  total: number;
  overdue: number;
  today: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  unavailable: number;
}

interface ScheduleSummaryCardsProps {
  counts: ScheduleSummaryCounts;
  activeFilter: ScheduleFilterType;
  onSelectFilter: (filter: ScheduleFilterType) => void;
}

interface CardDefinition {
  key: ScheduleFilterType;
  label: string;
  hint: string;
  count: number;
  icon: typeof CalendarClock;
  textClass: string;
  borderClass: string;
  bgClass: string;
  tileClass: string;
}

export function ScheduleSummaryCards({
  counts,
  activeFilter,
  onSelectFilter,
}: ScheduleSummaryCardsProps) {
  const cards: CardDefinition[] = [
    {
      key: "all",
      label: "Total Geral",
      hint: "itens na agenda",
      count: counts.total,
      icon: CalendarClock,
      textClass: "text-cyan-300",
      borderClass: "border-cyan-500/25",
      bgClass: "bg-cyan-500/10",
      tileClass: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
    },
    {
      key: "overdue",
      label: "Vencidos",
      hint: counts.overdue > 0 ? "requer ação imediata" : "em dia",
      count: counts.overdue,
      icon: AlertTriangle,
      textClass: counts.overdue > 0 ? "text-red-400 font-extrabold" : "text-slate-400",
      borderClass: counts.overdue > 0 ? "border-red-500/40" : "border-slate-700/40",
      bgClass: counts.overdue > 0 ? "bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.12)]" : "bg-card/40",
      tileClass: counts.overdue > 0 ? "border-red-500/30 bg-red-500/15 text-red-400" : "border-slate-700 bg-slate-800/40 text-slate-400",
    },
    {
      key: "today",
      label: "Para Hoje",
      hint: "execução do dia",
      count: counts.today,
      icon: Clock,
      textClass: counts.today > 0 ? "text-cyan-300 font-bold" : "text-slate-400",
      borderClass: counts.today > 0 ? "border-cyan-400/35" : "border-slate-700/40",
      bgClass: counts.today > 0 ? "bg-cyan-400/[0.08]" : "bg-card/40",
      tileClass: counts.today > 0 ? "border-cyan-400/30 bg-cyan-400/15 text-cyan-300" : "border-slate-700 bg-slate-800/40 text-slate-400",
    },
    {
      key: "upcoming",
      label: "Programados",
      hint: "próximos compromissos",
      count: counts.upcoming,
      icon: Calendar,
      textClass: "text-emerald-400",
      borderClass: "border-emerald-500/25",
      bgClass: "bg-emerald-500/10",
      tileClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    },
    {
      key: "completed",
      label: "Concluídos",
      hint: "histórico de execução",
      count: counts.completed,
      icon: CheckCircle2,
      textClass: "text-slate-300",
      borderClass: "border-slate-600/30",
      bgClass: "bg-slate-800/20",
      tileClass: "border-slate-600/30 bg-slate-700/20 text-slate-400",
    },
  ];

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
      data-testid="schedule-summary-cards"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = activeFilter === card.key;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelectFilter(isSelected && card.key !== "all" ? "all" : card.key)}
            className={cn(
              "group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              card.borderClass,
              card.bgClass,
              isSelected
                ? "ring-2 ring-cyan-400 border-cyan-400/50 bg-[#0f213a]/90 shadow-[0_0_25px_rgba(34,211,238,0.18)]"
                : "hover:border-cyan-300/30 hover:bg-[#0c182b]/80",
            )}
            data-testid={`schedule-summary-card-${card.key}`}
            aria-pressed={isSelected}
          >
            {/* Top row: Icon tile + Count */}
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
                  card.tileClass,
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>

              <span
                className={cn(
                  "text-2xl font-black tracking-tight tabular-nums",
                  card.textClass,
                )}
              >
                {card.count}
              </span>
            </div>

            {/* Bottom row: Label + Hint */}
            <div className="mt-3">
              <p className="text-xs font-bold text-foreground group-hover:text-cyan-200 transition-colors">
                {card.label}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                {card.hint}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
