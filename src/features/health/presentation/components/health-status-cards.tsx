/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Five Status Cards Component for Health Overview (/health)
 *
 * MANDATE §10:
 * Each number MUST be calculated as COUNT of readiness_status coming from valid projections.
 * Missing or error projections MUST NOT be counted as "not_evaluated".
 */

import { CheckCircle2, AlertTriangle, AlertCircle, ShieldOff, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusCounts } from "../hooks/use-health-overview";
import type { ReadinessStatus } from "../../domain/readiness-types";

interface HealthStatusCardsProps {
  counts: StatusCounts;
  selectedStatus?: ReadinessStatus | null;
  onSelectStatus?: (status: ReadinessStatus | null) => void;
}

interface CardConfig {
  key: ReadinessStatus;
  label: string;
  /**
   * Restates what the canonical status already means — it adds no new fact and
   * is never derived from data. HW-M01 labels this card "sem projeção válida",
   * but that phrase is reserved for K9s with NO valid projection; `not_evaluated`
   * is itself a valid canonical status, so a distinct wording is used to keep the
   * two states from reading as the same thing.
   */
  description: string;
  count: number;
  icon: typeof CheckCircle2;
  bgClass: string;
  borderClass: string;
  textClass: string;
  tileClass: string;
}

export function HealthStatusCards({
  counts,
  selectedStatus,
  onSelectStatus,
}: HealthStatusCardsProps) {
  const cards: CardConfig[] = [
    {
      key: "operational",
      label: "Operacional",
      description: "apto sem restrições",
      count: counts.operational,
      icon: CheckCircle2,
      bgClass: "bg-emerald-500/10",
      borderClass: "border-emerald-500/25",
      textClass: "text-emerald-400",
      tileClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    },
    {
      key: "operational_attention",
      label: "Operacional com atenção",
      description: "requer acompanhamento",
      count: counts.operational_attention,
      icon: AlertTriangle,
      bgClass: "bg-amber-500/10",
      borderClass: "border-amber-500/25",
      textClass: "text-amber-400",
      tileClass: "border-amber-500/25 bg-amber-500/10 text-amber-400",
    },
    {
      key: "fit_with_restrictions",
      label: "Apto com restrições",
      description: "restrições operacionais ativas",
      count: counts.fit_with_restrictions,
      icon: AlertCircle,
      bgClass: "bg-indigo-500/10",
      borderClass: "border-indigo-500/25",
      textClass: "text-indigo-300",
      tileClass: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
    },
    {
      key: "temporarily_unfit",
      label: "Temporariamente inapto",
      description: "afastados da atividade",
      count: counts.temporarily_unfit,
      icon: ShieldOff,
      bgClass: "bg-red-500/10",
      borderClass: "border-red-500/25",
      textClass: "text-red-400",
      tileClass: "border-red-500/25 bg-red-500/10 text-red-400",
    },
    {
      key: "not_evaluated",
      label: "Não avaliado",
      description: "avaliação não registrada",
      count: counts.not_evaluated,
      icon: HelpCircle,
      bgClass: "bg-slate-500/10",
      borderClass: "border-slate-500/25",
      textClass: "text-slate-300",
      tileClass: "border-slate-500/25 bg-slate-500/10 text-slate-300",
    },
  ];

  return (
    // Responsive contract: 2 cols (mobile) -> 3+2 (tablet, incl. 1024) -> 5 across (xl+).
    // md:grid-cols-5 previously squeezed all five labels into one row at tablet width.
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
      data-testid="health-status-cards"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedStatus === card.key;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelectStatus?.(isSelected ? null : card.key)}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200",
              "bg-[#0b1628]/82 shadow-[0_18px_60px_rgba(0,0,0,0.22)]",
              card.borderClass,
              isSelected
                ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                : "hover:brightness-125",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label={`${card.label}: ${card.count} cães`}
            aria-pressed={isSelected}
          >
            {/* Semantic wash: gives each instrument its own tonal surface. */}
            <span
              className={cn("pointer-events-none absolute inset-0", card.bgClass)}
              aria-hidden="true"
            />

            <span className="relative flex items-start justify-between gap-2">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                  card.tileClass,
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "text-3xl font-black leading-none tabular-nums tracking-tight",
                  card.textClass,
                )}
              >
                {card.count}
              </span>
            </span>

            <span className="relative mt-3 block">
              {/* Full semantic label must stay readable — no ellipsis truncation. */}
              <span className="block text-xs font-semibold leading-snug text-foreground">
                {card.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {card.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
