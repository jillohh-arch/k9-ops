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
  count: number;
  icon: typeof CheckCircle2;
  bgClass: string;
  borderClass: string;
  textClass: string;
  badgeClass: string;
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
      count: counts.operational,
      icon: CheckCircle2,
      bgClass: "bg-emerald-500/10",
      borderClass: "border-emerald-500/20",
      textClass: "text-emerald-500",
      badgeClass: "bg-emerald-500/20 text-emerald-400",
    },
    {
      key: "operational_attention",
      label: "Operacional com atenção",
      count: counts.operational_attention,
      icon: AlertTriangle,
      bgClass: "bg-amber-500/10",
      borderClass: "border-amber-500/20",
      textClass: "text-amber-500",
      badgeClass: "bg-amber-500/20 text-amber-400",
    },
    {
      key: "fit_with_restrictions",
      label: "Apto com restrições",
      count: counts.fit_with_restrictions,
      icon: AlertCircle,
      bgClass: "bg-indigo-500/10",
      borderClass: "border-indigo-500/20",
      textClass: "text-indigo-400",
      badgeClass: "bg-indigo-500/20 text-indigo-300",
    },
    {
      key: "temporarily_unfit",
      label: "Temporariamente inapto",
      count: counts.temporarily_unfit,
      icon: ShieldOff,
      bgClass: "bg-red-500/10",
      borderClass: "border-red-500/20",
      textClass: "text-red-500",
      badgeClass: "bg-red-500/20 text-red-400",
    },
    {
      key: "not_evaluated",
      label: "Não avaliado",
      count: counts.not_evaluated,
      icon: HelpCircle,
      bgClass: "bg-slate-500/10",
      borderClass: "border-slate-500/20",
      textClass: "text-slate-400",
      badgeClass: "bg-slate-500/20 text-slate-300",
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
              "flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200",
              card.bgClass,
              card.borderClass,
              isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:border-opacity-60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label={`${card.label}: ${card.count} cães`}
          >
            <div className="flex items-center justify-between gap-2">
              {/* Full semantic label must stay readable — no ellipsis truncation. */}
              <span className="text-xs font-medium leading-snug text-muted-foreground">
                {card.label}
              </span>
              <Icon className={cn("h-4 w-4 shrink-0", card.textClass)} aria-hidden="true" />
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <span className={cn("text-2xl font-bold tracking-tight", card.textClass)}>
                {card.count}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", card.badgeClass)}>
                K9s
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
