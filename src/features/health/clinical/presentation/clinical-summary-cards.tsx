/**
 * K9 Ops Web — Health Web v1 HW-6A.I3
 * Clinical summary instruments (4 KPIs) for /health/clinical.
 *
 * MANDATES:
 * - Counts are derived EXCLUSIVELY from the cases currently composed by
 *   `useClinicalCases()`. Nothing is fetched, inferred or extrapolated.
 * - A KPI is never allowed to imply completeness it does not have:
 *     · `activeTreatmentsCount === null`  -> the SUM is marked incomplete.
 *     · `hasActiveRestriction === null`   -> counted as UNKNOWN, never as false.
 *   The card then states how many cases could not be accounted for, instead of
 *   silently publishing a smaller number as if it were the whole truth.
 * - Read-only: the cards are non-interactive in I3 (no filter-by-KPI, since the
 *   interaction boundary for this gate is presentation only).
 *
 * HW-6A.V1.RF4 §19 (VISUAL SCALE ONLY): the top-area typography was too small to
 * read comfortably at 100% zoom. Label, hint and coverage qualifier each gain a
 * step, the numeric value and its icon tile grow, and padding follows. The four
 * KPIs, their semantics, their colours and their incompleteness rules are FROZEN
 * and untouched — this is a typography lift, not a redesign.
 */

import {
  Activity,
  HelpCircle,
  Search,
  ShieldAlert,
  Syringe,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ClinicalCaseListEntry } from "../data/clinical-scope-loader";
import { CLINICAL_ACTIVE_STATUSES } from "./types";

export interface ClinicalSummaryCounts {
  /** Cases whose canonical status is one of the four "em acompanhamento". */
  monitoredCases: number;
  /** Cases whose canonical status is exactly `under_investigation`. */
  underInvestigation: number;
  /** Sum of KNOWN `activeTreatmentsCount` values. */
  activeTreatments: number;
  /** Cases whose `activeTreatmentsCount` is null — excluded from the sum. */
  activeTreatmentsUnknown: number;
  /** Cases with `hasActiveRestriction === true`. */
  withActiveRestriction: number;
  /** Cases whose `hasActiveRestriction` is null — neither with nor without. */
  restrictionUnknown: number;
}

/**
 * Derives the four KPIs from the composed list.
 *
 * Pure and total: it reports what the data supports and separately reports what
 * it could not determine.
 */
export function deriveClinicalSummary(
  entries: ClinicalCaseListEntry[],
): ClinicalSummaryCounts {
  let monitoredCases = 0;
  let underInvestigation = 0;
  let activeTreatments = 0;
  let activeTreatmentsUnknown = 0;
  let withActiveRestriction = 0;
  let restrictionUnknown = 0;

  for (const entry of entries) {
    const item = entry.case;

    if (
      item.clinicalStatus !== null &&
      CLINICAL_ACTIVE_STATUSES.includes(item.clinicalStatus)
    ) {
      monitoredCases += 1;
    }

    if (item.clinicalStatus === "under_investigation") {
      underInvestigation += 1;
    }

    // ABSENT !== 0: an unknown count is excluded from the sum and reported.
    if (item.activeTreatmentsCount === null) {
      activeTreatmentsUnknown += 1;
    } else {
      activeTreatments += item.activeTreatmentsCount;
    }

    // ABSENT !== false: only an explicit `true` counts as restricted.
    if (item.hasActiveRestriction === null) {
      restrictionUnknown += 1;
    } else if (item.hasActiveRestriction) {
      withActiveRestriction += 1;
    }
  }

  return {
    monitoredCases,
    underInvestigation,
    activeTreatments,
    activeTreatmentsUnknown,
    withActiveRestriction,
    restrictionUnknown,
  };
}

interface CardConfig {
  key: string;
  label: string;
  hint: string;
  value: number;
  icon: typeof Activity;
  textClass: string;
  borderClass: string;
  bgClass: string;
  tileClass: string;
  /** Rendered when the KPI provably does not cover every case in the list. */
  incompleteNote: string | null;
}

export function ClinicalSummaryCards({
  counts,
}: {
  counts: ClinicalSummaryCounts;
}) {
  const cards: CardConfig[] = [
    {
      key: "monitored",
      label: "Casos em acompanhamento",
      hint: "aberto, investigação, tratamento ou monitoramento",
      value: counts.monitoredCases,
      icon: Activity,
      textClass: "text-cyan-300",
      borderClass: "border-cyan-300/25",
      bgClass: "bg-cyan-300/10",
      tileClass: "border-cyan-300/25 bg-cyan-300/10 text-cyan-300",
      incompleteNote: null,
    },
    {
      key: "investigation",
      label: "Em investigação",
      hint: "status canônico em investigação",
      value: counts.underInvestigation,
      icon: Search,
      textClass: "text-indigo-300",
      borderClass: "border-indigo-500/25",
      bgClass: "bg-indigo-500/10",
      tileClass: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
      incompleteNote: null,
    },
    {
      key: "treatments",
      label: "Tratamentos ativos",
      hint: "soma dos totais informados por caso",
      value: counts.activeTreatments,
      icon: Syringe,
      textClass: "text-amber-400",
      borderClass: "border-amber-500/25",
      bgClass: "bg-amber-500/10",
      tileClass: "border-amber-500/25 bg-amber-500/10 text-amber-400",
      /*
       * A sum over a field that is absent on some cases is a PARTIAL sum.
       * Saying so is the only way the number stays honest.
       */
      incompleteNote:
        counts.activeTreatmentsUnknown > 0
          ? `Soma parcial: ${counts.activeTreatmentsUnknown} ${
              counts.activeTreatmentsUnknown === 1 ? "caso" : "casos"
            } sem total informado`
          : null,
    },
    {
      key: "restriction",
      label: "Com restrição ativa",
      hint: "restrição ativa afirmada no caso",
      value: counts.withActiveRestriction,
      icon: ShieldAlert,
      textClass: "text-red-400",
      borderClass: "border-red-500/25",
      bgClass: "bg-red-500/10",
      tileClass: "border-red-500/25 bg-red-500/10 text-red-400",
      /*
       * `null` is NOT "sem restrição". Cases without the flag are reported as
       * undetermined so the count is never mistaken for the full picture.
       */
      incompleteNote:
        counts.restrictionUnknown > 0
          ? `${counts.restrictionUnknown} ${
              counts.restrictionUnknown === 1 ? "caso" : "casos"
            } sem informação de restrição`
          : null,
    },
  ];

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      data-testid="clinical-summary-cards"
    >
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.key}
            /*
             * Non-interactive by mandate: an instrument, not a control. `article`
             * with an accessible name keeps it addressable by screen readers
             * without implying a click target.
             */
            role="group"
            aria-label={`${card.label}: ${card.value}. ${card.hint}.${
              card.incompleteNote ? ` ${card.incompleteNote}.` : ""
            }`}
            data-testid={`clinical-kpi-${card.key}`}
            className={cn(
              "relative flex flex-col overflow-hidden rounded-2xl border p-4 text-left lg:p-5",
              "bg-[#0b1628]/82 shadow-[0_18px_60px_rgba(0,0,0,0.22)]",
              card.borderClass,
            )}
          >
            <span
              className={cn("pointer-events-none absolute inset-0", card.bgClass)}
              aria-hidden="true"
            />

            <span className="relative flex items-start justify-between gap-2">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                  card.tileClass,
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "text-[28px] font-black leading-none tabular-nums tracking-tight",
                  card.textClass,
                )}
              >
                {card.value}
              </span>
            </span>

            <span className="relative mt-3 block">
              <span className="block text-[15px] font-semibold leading-snug text-foreground">
                {card.label}
              </span>
              <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
                {card.hint}
              </span>
            </span>

            {card.incompleteNote && (
              <span
                className="relative mt-2.5 flex items-start gap-1.5 border-t border-border/40 pt-2.5 text-[13px] leading-snug text-slate-300"
                data-testid={`clinical-kpi-${card.key}-incomplete`}
              >
                <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{card.incompleteNote}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
