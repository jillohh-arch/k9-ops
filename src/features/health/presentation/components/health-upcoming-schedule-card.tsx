/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Upcoming Health Schedule Card Component for Health Overview (/health)
 *
 * MANDATE §15:
 * Read-only summary of upcoming schedule items or controlled partial fallback.
 */

import { Calendar, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
      className="flex flex-col justify-between rounded-xl border border-border/60 bg-card p-5 shadow-sm"
      data-testid="health-upcoming-schedule-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">
            Próximos vencimentos da agenda
          </h3>
        </div>
        {!isUnavailable && (
          <span className="text-xs text-muted-foreground">
            {scheduleItems.length} {scheduleItems.length === 1 ? "item" : "itens"}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {isUnavailable ? (
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-500">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Módulo de agenda em integração controlada para HW-3B.</span>
          </div>
        ) : scheduleItems.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Nenhum evento futuro agendado no período.
          </div>
        ) : (
          scheduleItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{item.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  K9: {item.dogName}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px]">
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
