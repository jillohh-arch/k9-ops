"use client";

/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Schedule reporting table.
 *
 * Displays scheduled procedures and healthcare agenda within the active period.
 */

import { useMemo, useState } from "react";
import { Search, Calendar, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ComposedScheduleEntry } from "../../schedule/composition/schedule-composition";
import type { ScheduleType } from "../../schedule/types";
import {
  SCHEDULE_STATUS_LABELS,
  type ScheduleStatus,
} from "../../domain/read-states";

interface HealthReportsScheduleTableProps {
  items: ComposedScheduleEntry[];
  periodLabel: string;
}

const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  dose: "Dose",
  vaccination: "Vacinação",
  exam: "Exame",
  consultation: "Consulta",
  weighing: "Pesagem",
  reevaluation: "Reavaliação",
  deworming: "Vermifugação",
  bath: "Banho",
  general: "Geral",
};

const STATUS_TONES: Record<ScheduleStatus, "red" | "yellow" | "cyan" | "green" | "slate"> = {
  overdue: "red",
  pending: "yellow",
  today: "cyan",
  upcoming: "green",
  scheduled: "slate",
  completed: "slate",
  cancelled: "slate",
};

function formatScheduledDate(date: Date | null, timezone: string | null): string {
  if (!date) return "Data não informada";
  if (Number.isNaN(date.getTime())) return "Data inválida";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone || "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toLocaleDateString("pt-BR");
  }
}

export function HealthReportsScheduleTable({
  items,
  periodLabel,
}: HealthReportsScheduleTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (c) =>
        c.entry.dog.name.toLowerCase().includes(term) ||
        (c.entry.item.title && c.entry.item.title.toLowerCase().includes(term)) ||
        c.entry.dogId.toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  return (
    <Card className="border-white/10 bg-slate-900/80">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
            <Calendar className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            Agenda e Procedimentos Programados
          </CardTitle>
          <p className="text-xs text-slate-400">
            Procedimentos com vencimento ou agendamento no período ({periodLabel})
          </p>
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <Input
            placeholder="Buscar por cão ou procedimento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="border-b border-white/10 bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3">Cão</th>
                <th scope="col" className="px-4 py-3">Tipo</th>
                <th scope="col" className="px-4 py-3">Procedimento</th>
                <th scope="col" className="px-4 py-3">Data Prevista</th>
                <th scope="col" className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Nenhum procedimento na agenda encontrado para os critérios selecionados.
                  </td>
                </tr>
              ) : (
                filtered.map((composed) => {
                  const entry = composed.entry;
                  const it = entry.item;
                  const typeLabel = it.scheduleType
                    ? SCHEDULE_TYPE_LABELS[it.scheduleType] ?? it.rawScheduleType ?? "Procedimento"
                    : it.rawScheduleType ?? "Procedimento";

                  const status = composed.temporal.temporalStatus;
                  const statusLabel = status
                    ? SCHEDULE_STATUS_LABELS[status] ?? status
                    : "Indisponível";
                  const tone = status ? STATUS_TONES[status] ?? "slate" : "slate";

                  return (
                    <tr
                      key={entry.entryId}
                      className="transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 font-semibold text-white">
                        <div>{entry.dog.name}</div>
                        {entry.dog.registrationNumber && (
                          <div className="text-[10px] text-slate-400">
                            {entry.dog.registrationNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="slate">{typeLabel}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">
                          {it.title ?? "Sem descrição"}
                        </div>
                        {it.dueUntil && (
                          <div className="text-[10px] text-slate-400">
                            Limite: {formatScheduledDate(it.dueUntil, it.timezone)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {formatScheduledDate(it.scheduledFor, it.timezone)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge tone={tone}>
                          {status === "overdue" && (
                            <AlertCircle className="mr-1 inline h-3 w-3" />
                          )}
                          {statusLabel}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
