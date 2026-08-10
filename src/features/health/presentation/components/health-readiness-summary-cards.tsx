/**
 * K9 Ops Web — Health Web v1 HW-3C
 * Five Operational Summary Cards for /health/readiness
 *
 * MANDATE §9:
 * Counts come EXCLUSIVELY from valid canonical projections.
 * No client inference (never "weight expired -> attention").
 * Missing/error/conflict without interpretable status must not inflate a card.
 */

import { CheckCircle2, AlertTriangle, AlertCircle, ShieldOff, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessStatusCounts, ReadinessStatusFilter } from "../hooks/readiness-view-model";
import type { ReadinessStatus } from "../../domain/readiness-types";

interface HealthReadinessSummaryCardsProps {
  counts: ReadinessStatusCounts;
  selectedStatus: ReadinessStatusFilter;
  onSelectStatus: (status: ReadinessStatusFilter) => void;
}

interface CardConfig {
  key: ReadinessStatus;
  label: string;
  /**
   * Short operational qualifier from the approved mockup.
   * NOTE: the mockup labels "Não avaliado" as "sem projeção válida"; that copy is
   * deliberately NOT reproduced because it conflates a valid Backend readiness
   * status with a technical read failure (HW-3B invariant).
   */
  hint: string;
  count: number;
  icon: typeof CheckCircle2;
  textClass: string;
  borderClass: string;
  bgClass: string;
}

export function HealthReadinessSummaryCards({
  counts,
  selectedStatus,
  onSelectStatus,
}: HealthReadinessSummaryCardsProps) {
  const cards: CardConfig[] = [
    {
      key: "operational",
      label: "Operacional",
      hint: "sem restrições",
      count: counts.operational,
      icon: CheckCircle2,
      textClass: "text-emerald-400",
      borderClass: "border-emerald-500/20",
      bgClass: "bg-emerald-500/10",
    },
    {
      key: "operational_attention",
      label: "Operacional com atenção",
      hint: "requer acompanhamento",
      count: counts.operational_attention,
      icon: AlertTriangle,
      textClass: "text-amber-400",
      borderClass: "border-amber-500/20",
      bgClass: "bg-amber-500/10",
    },
    {
      key: "fit_with_restrictions",
      label: "Apto com restrições",
      hint: "restrições operacionais ativas",
      count: counts.fit_with_restrictions,
      icon: AlertCircle,
      textClass: "text-indigo-300",
      borderClass: "border-indigo-500/20",
      bgClass: "bg-indigo-500/10",
    },
    {
      key: "temporarily_unfit",
      label: "Temporariamente inapto",
      hint: "afastados da atividade",
      count: counts.temporarily_unfit,
      icon: ShieldOff,
      textClass: "text-red-400",
      borderClass: "border-red-500/20",
      bgClass: "bg-red-500/10",
    },
    {
      key: "not_evaluated",
      label: "Não avaliado",
      hint: "avaliação não registrada",
      count: counts.not_evaluated,
      icon: HelpCircle,
      textClass: "text-slate-300",
      borderClass: "border-border/70",
      bgClass: "bg-muted/40",
    },
  ];

  return (
    // Responsive contract (HW-3B lesson): 1 -> 2 -> 3+2 -> 5 across only at xl.
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
      data-testid="health-readiness-summary-cards"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedStatus === card.key;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelectStatus(isSelected ? "all" : card.key)}
            aria-pressed={isSelected}
            aria-label={`${card.label}: ${card.count} K9s. ${card.hint}. Filtrar por este estado.`}
            className={cn(
              "flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              card.borderClass,
              card.bgClass,
              isSelected ? "ring-2 ring-ring" : "hover:brightness-125",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={cn("text-2xl font-bold tracking-tight", card.textClass)}>
                {card.count}
              </span>
              <Icon className={cn("h-4 w-4 shrink-0", card.textClass)} aria-hidden="true" />
            </div>

            <div className="flex flex-col gap-0.5">
              {/* Full semantic label — never truncated into ambiguity. */}
              <span className="text-xs font-semibold leading-snug text-foreground">
                {card.label}
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">{card.hint}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
