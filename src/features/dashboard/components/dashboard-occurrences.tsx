import {
  Activity,
  CalendarDays,
  CheckCircle2,
  FileSignature,
  ListChecks,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { OccurrenceMetrics } from "./dashboard-types";
import { formatCount, toneClasses } from "./dashboard-utils";

export interface DashboardOccurrencesProps {
  metrics: OccurrenceMetrics;
  periodLabel: string;
  loading: boolean;
  error: string | null;
}

export function DashboardOccurrences({
  metrics,
  periodLabel,
  loading,
  error,
}: DashboardOccurrencesProps) {
  return (
    <article className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">
                Ocorrências do período
              </h2>
              <p className="mt-0.5 text-sm text-slate-400">
                Volume, andamento e naturezas registradas.
              </p>
            </div>
          </div>
        </div>

        <Badge tone="cyan">{periodLabel}</Badge>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Registradas",
            value: metrics.total,
            detail: "no período",
            icon: ListChecks,
            tone: "cyan",
          },
          {
            label: "Finalizadas",
            value: metrics.finalized,
            detail: "concluidas",
            icon: CheckCircle2,
            tone: "emerald",
          },
          {
            label: "Em andamento",
            value: metrics.open,
            detail: "abertas ou finalizando",
            icon: Activity,
            tone: "blue",
          },
          {
            label: "Assinaturas",
            value: metrics.awaitingSignatures,
            detail: "aguardando equipe",
            icon: FileSignature,
            tone: "amber",
          },
        ].map((metric) => (
          <div
            className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
            key={metric.label}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-300">
                {metric.label}
              </p>
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border",
                  toneClasses(metric.tone),
                )}
              >
                <metric.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 font-mono text-3xl font-black text-white">
              {loading ? "..." : error ? "--" : formatCount(metric.value)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
          </div>
        ))}
      </div>

      {metrics.natures.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-slate-300">
            Naturezas mais frequentes
          </p>
          <div className="mt-3 space-y-2">
            {metrics.natures.map((nature) => (
              <div key={nature.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{nature.label}</span>
                  <span className="font-mono text-white">
                    {formatCount(nature.value)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-600"
                    style={{ width: `${nature.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
