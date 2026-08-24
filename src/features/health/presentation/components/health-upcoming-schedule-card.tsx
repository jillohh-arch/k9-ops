/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Upcoming Health Schedule Card Component for Health Overview (/health)
 *
 * MANDATE §15:
 * Read-only summary of upcoming schedule items or controlled partial fallback.
 */

import { CalendarDays, Clock, AlertCircle } from "lucide-react";

interface ScheduleItemSummary {
  id: string;
  dogName: string;
  title: string;
  type: string;
  date: Date;
  status: string;
}

interface HealthUpcomingScheduleCardProps {
  scheduleItems?: ScheduleItemSummary[];
  isUnavailable?: boolean;
}

export function HealthUpcomingScheduleCard({
  scheduleItems = [],
  isUnavailable = false,
}: HealthUpcomingScheduleCardProps) {
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="health-upcoming-schedule-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
              Próximos vencimentos
            </p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">
              Próximos vencimentos da agenda
            </h3>
          </div>
        </div>
        {!isUnavailable && (
          <span className="shrink-0 rounded-lg border border-border bg-muted/30 px-2 py-1 text-[11px] font-bold tabular-nums text-muted-foreground">
            {scheduleItems.length} {scheduleItems.length === 1 ? "item" : "itens"}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isUnavailable ? (
          /* Nested technical state: weaker border than the structural panel. */
          <div className="flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3.5 text-xs">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-300/10 text-amber-300">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/85">
                Integração pendente
              </span>
              <span className="leading-relaxed text-amber-100/80">
                Módulo de agenda em integração controlada para HW-3B.
              </span>
            </div>
          </div>
        ) : scheduleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-500/25 bg-slate-500/10 text-slate-300">
              <CalendarDays className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-xs text-muted-foreground">
              Nenhum evento futuro agendado no período.
            </p>
          </div>
        ) : (
          scheduleItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-foreground">{item.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  K9: {item.dogName}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-200/15 bg-cyan-300/[0.06] px-2 py-1 font-mono text-[11px] tabular-nums text-cyan-200">
                <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{new Date(item.date).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
