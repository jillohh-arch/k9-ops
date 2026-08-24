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
  tileClass: string;
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
      borderClass: "border-emerald-500/25",
      bgClass: "bg-emerald-500/10",
      tileClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    },
    {
      key: "operational_attention",
      label: "Operacional com atenção",
      hint: "requer acompanhamento",
      count: counts.operational_attention,
      icon: AlertTriangle,
      textClass: "text-amber-400",
      borderClass: "border-amber-500/25",
      bgClass: "bg-amber-500/10",
      tileClass: "border-amber-500/25 bg-amber-500/10 text-amber-400",
    },
    {
      key: "fit_with_restrictions",
      label: "Apto com restrições",
      hint: "restrições operacionais ativas",
      count: counts.fit_with_restrictions,
      icon: AlertCircle,
      textClass: "text-indigo-300",
      borderClass: "border-indigo-500/25",
      bgClass: "bg-indigo-500/10",
      tileClass: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
    },
    {
      key: "temporarily_unfit",
      label: "Temporariamente inapto",
      hint: "afastados da atividade",
      count: counts.temporarily_unfit,
      icon: ShieldOff,
      textClass: "text-red-400",
      borderClass: "border-red-500/25",
      bgClass: "bg-red-500/10",
      tileClass: "border-red-500/25 bg-red-500/10 text-red-400",
    },
    {
      key: "not_evaluated",
      label: "Não avaliado",
      hint: "avaliação não registrada",
      count: counts.not_evaluated,
      icon: HelpCircle,
      textClass: "text-slate-300",
      borderClass: "border-slate-500/25",
      bgClass: "bg-slate-500/10",
      tileClass: "border-slate-500/25 bg-slate-500/10 text-slate-300",
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
              // Same instrument grammar as /health, one step denser: p-3.5 and a
              // smaller tile, since this view is scanned while triaging.
              "group relative flex flex-col overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200",
              "bg-[#0b1628]/82 shadow-[0_18px_60px_rgba(0,0,0,0.22)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              card.borderClass,
              isSelected
                ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                : "hover:brightness-125",
            )}
          >
            {/* Semantic wash: each instrument keeps its own tonal surface. */}
            <span
              className={cn("pointer-events-none absolute inset-0", card.bgClass)}
              aria-hidden="true"
            />

            <span className="relative flex items-start justify-between gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                  card.tileClass,
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "text-2xl font-black leading-none tabular-nums tracking-tight",
                  card.textClass,
                )}
              >
                {card.count}
              </span>
            </span>

            <span className="relative mt-2.5 block">
              {/* Full semantic label — never truncated into ambiguity. */}
              <span className="block text-xs font-semibold leading-snug text-foreground">
                {card.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {card.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
