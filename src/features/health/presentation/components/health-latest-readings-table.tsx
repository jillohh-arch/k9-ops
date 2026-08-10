/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Latest Readings Table Component for Health Overview (/health)
 *
 * MANDATE §16:
 * Displays latest reading per K9: identity, status, reason, readiness_updated_at, quality state, and "Fonte: Canônica".
 * NO raw technical enums or raw Firestore paths in UI.
 */

import { Dog, CheckCircle2, AlertTriangle, AlertCircle, ShieldOff, HelpCircle, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessListItem, ReadinessStatus } from "../../domain/readiness-types";

interface HealthLatestReadingsTableProps {
  items: ReadinessListItem[];
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

export function HealthLatestReadingsTable({
  items,
}: HealthLatestReadingsTableProps) {
  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm overflow-hidden"
      data-testid="health-latest-readings-table"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Última leitura por K9
          </h3>
          <p className="text-xs text-muted-foreground">
            Registro consolidado da projeção de prontidão canônica por cão.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Database className="h-3 w-3 text-primary" aria-hidden="true" />
          <span>Fonte: Canônica</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/60 bg-muted/30 text-[11px] uppercase font-semibold text-muted-foreground">
            <tr>
              <th className="py-2.5 px-3">Cão / Matrícula</th>
              <th className="py-2.5 px-3">Status Operacional</th>
              <th className="py-2.5 px-3">Motivo da Prontidão</th>
              <th className="py-2.5 px-3">Atualizado em</th>
              <th className="py-2.5 px-3">Qualidade da Leitura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  Nenhuma leitura canônica disponível.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const badge = STATUS_BADGES[item.readinessStatus as ReadinessStatus] ?? STATUS_BADGES.not_evaluated;
                const StatusIcon = badge.icon;
                const dateStr = item.updatedAt
                  ? new Date(item.updatedAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "—";

                return (
                  <tr key={item.dog.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <Dog className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                        <span className="font-semibold text-foreground">{item.dog.name}</span>
                        {item.dog.registrationNumber && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({item.dog.registrationNumber})
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3">
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
                    </td>

                    <td className="py-3 px-3 text-muted-foreground max-w-xs truncate">
                      {item.reason || "Nenhuma avaliação registrada"}
                    </td>

                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                      {dateStr}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[10px] font-semibold",
                          item.qualityLabel === "Atualizada"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : item.qualityLabel === "Parcial"
                            ? "bg-amber-500/10 text-amber-400"
                            : item.qualityLabel === "Desatualizada"
                            ? "bg-orange-500/10 text-orange-400"
                            : "bg-red-500/10 text-red-400"
                        )}
                      >
                        {item.qualityLabel}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
