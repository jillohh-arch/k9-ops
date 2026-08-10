/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Priority K9 List Component for Health Overview (/health)
 *
 * MANDATE §12:
 * - Priority order: temporarily_unfit (0) > fit_with_restrictions (1) > operational_attention (2) > not_evaluated (3) > operational (4).
 * - Read-only link "Ver cockpit" -> /health/readiness/[dogId].
 * - ZERO mutations.
 */

import Link from "next/link";
import { Dog, ArrowUpRight, ShieldAlert, CheckCircle2, AlertTriangle, AlertCircle, ShieldOff, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessListItem, ReadinessStatus } from "../../domain/readiness-types";

interface HealthPriorityK9ListProps {
  items: ReadinessListItem[];
  selectedStatus?: ReadinessStatus | null;
}

const STATUS_BADGES: Record<
  ReadinessStatus,
  { label: string; bg: string; text: string; border: string; icon: typeof CheckCircle2 }
> = {
  operational: {
    label: "Operacional",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    icon: CheckCircle2,
  },
  operational_attention: {
    label: "Operacional com atenção",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    icon: AlertTriangle,
  },
  fit_with_restrictions: {
    label: "Apto com restrições",
    bg: "bg-indigo-500/10",
    text: "text-indigo-300",
    border: "border-indigo-500/20",
    icon: AlertCircle,
  },
  temporarily_unfit: {
    label: "Temporariamente inapto",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
    icon: ShieldOff,
  },
  not_evaluated: {
    label: "Não avaliado",
    bg: "bg-slate-500/10",
    text: "text-slate-300",
    border: "border-slate-500/20",
    icon: HelpCircle,
  },
};

export function HealthPriorityK9List({
  items,
  selectedStatus,
}: HealthPriorityK9ListProps) {
  const filteredItems = selectedStatus
    ? items.filter((item) => item.readinessStatus === selectedStatus)
    : items;

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm"
      data-testid="health-priority-k9-list"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Situação dos K9s
          </h3>
          <p className="text-xs text-muted-foreground">
            Listagem priorizada dos cães por nível de atenção clínica e operacional.
          </p>
        </div>

        <Link
          href="/health/readiness"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <span>Ver todos ({items.length})</span>
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-2 flex flex-col divide-y divide-border/40">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Nenhum K9 encontrado para o filtro selecionado.
          </div>
        ) : (
          filteredItems.map((item) => {
            const badge = STATUS_BADGES[item.readinessStatus as ReadinessStatus] ?? STATUS_BADGES.not_evaluated;
            const StatusIcon = badge.icon;
            const summary = item.summary;

            return (
              <div
                key={item.dog.id}
                className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Dog Identity & Status */}
                <div className="flex items-start gap-3">
                  {item.dog.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.dog.photoUrl}
                      alt={item.dog.name}
                      className="h-10 w-10 rounded-full object-cover shrink-0 border border-border"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground shrink-0 border border-border">
                      <Dog className="h-5 w-5" aria-hidden="true" />
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {item.dog.name}
                      </span>
                      {item.dog.registrationNumber && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          ({item.dog.registrationNumber})
                        </span>
                      )}

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          badge.bg,
                          badge.text,
                          badge.border
                        )}
                      >
                        <StatusIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    {/* Reason */}
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.reason || "Sem observações de prontidão."}
                    </p>

                    {/* Quick Evidence Summaries */}
                    {summary && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground/80 mt-0.5">
                        {summary.lastWeight && (
                          <span>Peso: {summary.lastWeight.kg} kg</span>
                        )}
                        {summary.lastVaccination && (
                          <span>Vacina: {summary.lastVaccination.type}</span>
                        )}
                        {summary.lastExam && (
                          <span>Exame: {summary.lastExam.type}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Read-Only Action */}
                <div className="flex items-center justify-end sm:justify-center shrink-0">
                  <Link
                    href={`/health/readiness/${item.dog.id}`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors",
                      "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    aria-label={`Ver cockpit do K9 ${item.dog.name}`}
                  >
                    <span>Ver cockpit</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
