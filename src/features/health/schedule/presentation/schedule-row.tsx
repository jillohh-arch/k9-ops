"use client";

/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — UX-R1
 * Individual Schedule Item Card / Row
 *
 * Visual hierarchy:
 * 1. Title (first <p> tag, critical for test anchor)
 * 2. Scheduled datetime (timezone-safe formatted)
 * 3. K9 canine identity badge + type + dueUntil note
 * 4. Distinct status badge & left-edge tactical indicator
 */

import { Clock, Dog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SCHEDULE_STATUS_LABELS } from "../../domain/read-states";
import type { ComposedScheduleEntry } from "../composition/schedule-composition";
import type { ScheduleType } from "../types";

/** Shown when the item's own date/time cannot be rendered truthfully. */
export const UNAVAILABLE_DATETIME = "Data/hora indisponível";

/** Shown when RD-I2 could not derive a temporal status for the item. */
export const UNAVAILABLE_STATUS = "Status indisponível";

export const SCHEDULE_TYPE_LABELS = {
  dose: "Dose",
  vaccination: "Vacinação",
  exam: "Exame",
  consultation: "Consulta",
  weighing: "Pesagem",
  reevaluation: "Reavaliação",
  deworming: "Vermifugação",
  bath: "Banho",
  general: "Geral",
} satisfies Record<ScheduleType, string>;

export const STATUS_TONES = {
  overdue: "red",
  pending: "yellow",
  today: "cyan",
  upcoming: "green",
  scheduled: "slate",
  completed: "slate",
  cancelled: "slate",
} as const satisfies Record<keyof typeof SCHEDULE_STATUS_LABELS, string>;

const TERMINAL_STATUSES = new Set(["completed", "cancelled"]);

/** Formats timestamp in the item's own timezone. Fails closed. */
export function formatScheduledFor(
  scheduledFor: Date | null,
  timezone: string | null,
): string {
  if (!scheduledFor || !timezone) return UNAVAILABLE_DATETIME;
  if (Number.isNaN(scheduledFor.getTime())) return UNAVAILABLE_DATETIME;

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(scheduledFor);
  } catch {
    return UNAVAILABLE_DATETIME;
  }
}

/** Canonical status label. */
export function statusLabel(entry: ComposedScheduleEntry): string {
  const status = entry.temporal.temporalStatus;
  if (!status) return UNAVAILABLE_STATUS;
  return SCHEDULE_STATUS_LABELS[status];
}

/** Status badge. */
export function ScheduleStatusBadge({ entry }: { entry: ComposedScheduleEntry }) {
  const status = entry.temporal.temporalStatus;
  const tone = status ? STATUS_TONES[status] : "slate";
  const isTerminal = !!status && TERMINAL_STATUSES.has(status);

  return (
    <Badge
      tone={tone}
      className={isTerminal ? "opacity-70" : undefined}
      data-testid="schedule-row-status"
      data-status={status ?? "unavailable"}
    >
      {statusLabel(entry)}
    </Badge>
  );
}

/** Presentation label for the canonical schedule type. */
export function scheduleTypeLabel(scheduleType: string): string {
  return (
    SCHEDULE_TYPE_LABELS[scheduleType as ScheduleType] ?? scheduleType
  );
}

function getStatusIndicatorClasses(status: string | null): string {
  switch (status) {
    case "overdue":
      return "border-l-4 border-l-red-500/90 border-cyan-200/10 hover:border-red-400/40 bg-[radial-gradient(ellipse_at_top_left,rgba(239,68,68,0.06),transparent_50%),#0b1628]/70";
    case "today":
      return "border-l-4 border-l-cyan-400/90 border-cyan-200/10 hover:border-cyan-400/40 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.08),transparent_50%),#0b1628]/70";
    case "pending":
      return "border-l-4 border-l-amber-400/90 border-cyan-200/10 hover:border-amber-400/40 bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.06),transparent_50%),#0b1628]/70";
    case "upcoming":
      return "border-l-4 border-l-emerald-500/70 border-cyan-200/10 hover:border-emerald-400/30 bg-[#0b1628]/70";
    case "completed":
      return "border-l-4 border-l-slate-600/60 border-cyan-200/5 opacity-80 bg-[#0b1628]/40";
    case "cancelled":
      return "border-l-4 border-l-slate-700/50 border-cyan-200/5 opacity-65 bg-[#0b1628]/30";
    default:
      return "border-l-4 border-l-slate-500/40 border-cyan-200/10 bg-[#0b1628]/70";
  }
}

interface ScheduleRowProps {
  composed: ComposedScheduleEntry;
}

export function ScheduleRow({ composed }: ScheduleRowProps) {
  const item = composed.entry.item;
  const status = composed.temporal.temporalStatus;

  return (
    <li
      className={cn(
        "group relative flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:p-5 transition-all shadow-sm",
        getStatusIndicatorClasses(status),
      )}
      data-testid="schedule-row"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* Content column */}
        <div className="min-w-0 flex-1">
          {/* Hierarchy: WHAT (title) — must be the FIRST <p> tag in the row */}
          <p className="text-base font-bold text-white tracking-tight leading-snug group-hover:text-cyan-200 transition-colors">
            {item.title ?? "Sem título"}
          </p>

          {/* WHEN: Scheduled instant in item's timezone */}
          <p
            className="mt-1.5 flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-200/90"
            data-testid="schedule-row-datetime"
          >
            <Clock className="h-3.5 w-3.5 text-cyan-400/80 shrink-0" aria-hidden="true" />
            <span>{formatScheduledFor(item.scheduledFor, item.timezone)}</span>
            {item.dueUntil && (
              <span className="text-slate-400 ml-2 font-sans text-[11px]">
                (Limite: {formatScheduledFor(item.dueUntil, item.timezone)})
              </span>
            )}
          </p>

          {/* WHO & TYPE & METADATA */}
          <p className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200/15 bg-cyan-300/[0.06] px-2.5 py-1 text-xs font-semibold text-slate-200">
              <Dog className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
              <span data-testid="schedule-row-dog">{composed.entry.dog.name}</span>
              {composed.entry.dog.registrationNumber && (
                <span className="text-[10px] text-cyan-300/70 font-mono">
                  ({composed.entry.dog.registrationNumber})
                </span>
              )}
            </span>

            {item.scheduleType && (
              <>
                <span className="text-slate-600">·</span>
                <span
                  data-testid="schedule-row-type"
                  className="inline-flex items-center rounded-lg border border-slate-700/50 bg-slate-800/40 px-2 py-0.5 text-xs font-medium text-slate-300"
                >
                  {scheduleTypeLabel(item.scheduleType)}
                </span>
              </>
            )}

            {item.notes && (
              <span className="hidden sm:inline text-xs text-slate-400 line-clamp-1 max-w-md">
                · {item.notes}
              </span>
            )}
          </p>
        </div>

        {/* Status Badge */}
        <div className="shrink-0 flex items-center sm:self-start">
          <ScheduleStatusBadge entry={composed} />
        </div>
      </div>
    </li>
  );
}
