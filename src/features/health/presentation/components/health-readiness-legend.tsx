/**
 * K9 Ops Web — Health Web v1 HW-3C
 * Status legend for /health/readiness (mockup HW-M02 footer row).
 *
 * Explains the operational vocabulary AND the ordering rule, so status is never
 * conveyed by colour alone.
 */

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { OFFICIAL_READINESS_STATUSES, READINESS_STATUS_LABELS } from "../../domain/readiness-types";
import type { ReadinessStatus } from "../../domain/readiness-types";

const DOT_COLORS: Record<ReadinessStatus, string> = {
  operational: "bg-emerald-400",
  operational_attention: "bg-amber-400",
  fit_with_restrictions: "bg-indigo-400",
  temporarily_unfit: "bg-red-400",
  not_evaluated: "bg-slate-400",
};

export function HealthReadinessLegend() {
  return (
    <div
      className="flex flex-col gap-3 text-[11px] text-muted-foreground lg:flex-row lg:items-center lg:justify-between"
      data-testid="health-readiness-legend"
    >
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {OFFICIAL_READINESS_STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", DOT_COLORS[status])}
              aria-hidden="true"
            />
            <span>{READINESS_STATUS_LABELS[status]}</span>
          </li>
        ))}
      </ul>

      <p className="flex items-start gap-1.5 lg:max-w-md">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          A ordenação por prioridade considera o estado operacional, as restrições ativas e a
          atualização da projeção canônica.
        </span>
      </p>
    </div>
  );
}
