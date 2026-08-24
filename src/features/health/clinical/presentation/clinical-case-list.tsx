/**
 * K9 Ops Web — Health Web v1 HW-6A.I3
 * Grouped Clinical case list for /health/clinical.
 *
 * MANDATES:
 * - Groups render in the fixed order EM ACOMPANHAMENTO -> ENCERRADOS ->
 *   ESTADO NÃO RECONHECIDO. An empty group is not rendered at all.
 * - Within a group the I2 composition order (activity desc, null anchors last)
 *   is PRESERVED verbatim. This component never re-sorts.
 * - "Nenhum resultado para os filtros" and "Nenhum caso clínico registrado" are
 *   DIFFERENT statements and never share copy: one is a filtering outcome, the
 *   other is a claim about the institution.
 * - `unrecognized` is a technical bucket for `clinicalStatus === null`, held
 *   visible so an unparseable case can never disappear from the list.
 *
 * HW-6A.V1.RF4 §21 (VISUAL SCALE ONLY): a modest typography and spacing lift on the
 * group header so it is not dwarfed by the rescaled rows beneath it. Group
 * semantics, order, membership and counts are FROZEN and untouched.
 *
 * HW-6A.I4A §9/§14: the group CONTENT changed from a divided row stack to a
 * responsive CARD GRID. Everything about GROUPING is unchanged — order,
 * membership, counts, unknown visibility, the two distinct empty statements — and
 * the I2 composition order still survives verbatim inside each group, because the
 * grid renders `group.entries` in place without sorting.
 *
 * HW-6A.I4B §3/§4: each card now carries TWO sibling actions instead of one, so
 * this component threads a second callback (`onOpenK9`) and a second emphasis key
 * (`selectedDogId`) straight through to the card. It adds NO interaction of its
 * own: the group header remains inert, and grouping semantics are again untouched.
 */

import { FileQuestion, HelpCircle, SearchX } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ClinicalCaseListEntry } from "../data/clinical-scope-loader";
import { ClinicalCaseCard } from "./clinical-case-card";
import {
  CLINICAL_ACTIVE_STATUSES,
  CLINICAL_CLOSED_STATUSES,
  type ClinicalGroupKey,
} from "./types";

export interface ClinicalCaseGroup {
  key: ClinicalGroupKey;
  entries: ClinicalCaseListEntry[];
}

const GROUP_ORDER: readonly ClinicalGroupKey[] = [
  "active",
  "closed",
  "unrecognized",
] as const;

const GROUP_LABELS: Record<ClinicalGroupKey, string> = {
  active: "Em acompanhamento",
  closed: "Encerrados",
  unrecognized: "Estado não reconhecido",
};

const GROUP_HINTS: Record<ClinicalGroupKey, string> = {
  active: "Casos aberto, em investigação, em tratamento ou em monitoramento.",
  closed: "Casos encerrados ou cancelados.",
  /*
   * Deliberately technical wording: these cases are not in a clinical stage —
   * their canonical status value was not recognized by the parser.
   */
  unrecognized:
    "Casos cujo status canônico não pôde ser reconhecido. Nenhuma etapa clínica foi presumida.",
};

/**
 * Buckets entries into the three presentation groups, preserving input order.
 *
 * Pure: the caller's ordering (from the I2 loader) is the ordering inside each
 * group, because array iteration is stable and nothing is sorted here.
 */
export function groupClinicalEntries(
  entries: ClinicalCaseListEntry[],
): ClinicalCaseGroup[] {
  const buckets: Record<ClinicalGroupKey, ClinicalCaseListEntry[]> = {
    active: [],
    closed: [],
    unrecognized: [],
  };

  for (const entry of entries) {
    const status = entry.case.clinicalStatus;

    if (status === null) {
      buckets.unrecognized.push(entry);
    } else if (CLINICAL_ACTIVE_STATUSES.includes(status)) {
      buckets.active.push(entry);
    } else if (CLINICAL_CLOSED_STATUSES.includes(status)) {
      buckets.closed.push(entry);
    } else {
      // Defensive: a canonical status added upstream without a group mapping
      // surfaces as unrecognized rather than vanishing from the list.
      buckets.unrecognized.push(entry);
    }
  }

  return GROUP_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
    key,
    entries: buckets[key],
  }));
}

interface ClinicalCaseListProps {
  entries: ClinicalCaseListEntry[];
  /** True when filters are narrowing the list — changes the empty statement. */
  filtersActive: boolean;
  onResetFilters: () => void;
  /** Opens the case summary modal for one card (I4A §16). */
  onOpenCase: (entry: ClinicalCaseListEntry) => void;
  /** Opens VISÃO CLÍNICA DO K9 for one card's K9 (I4B §7). */
  onOpenK9: (entry: ClinicalCaseListEntry) => void;
  /** entryId of the case whose modal is open, for visual emphasis only. */
  selectedEntryId?: string | null;
  /** dogId of the K9 whose modal is open, for visual emphasis only (I4B §24). */
  selectedDogId?: string | null;
}

export function ClinicalCaseList({
  entries,
  filtersActive,
  onResetFilters,
  onOpenCase,
  onOpenK9,
  selectedEntryId = null,
  selectedDogId = null,
}: ClinicalCaseListProps) {
  if (entries.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 px-6 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
        data-testid={
          filtersActive ? "clinical-filter-empty" : "clinical-scope-empty"
        }
      >
        <span
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl border",
            filtersActive
              ? "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-300"
              : "border-slate-500/25 bg-slate-500/10 text-slate-300",
          )}
        >
          {filtersActive ? (
            <SearchX className="h-7 w-7" aria-hidden="true" />
          ) : (
            <FileQuestion className="h-7 w-7" aria-hidden="true" />
          )}
        </span>

        <p
          className={cn(
            "mt-3.5 text-[10px] font-black uppercase tracking-[0.22em]",
            filtersActive ? "text-cyan-300/80" : "text-slate-400",
          )}
        >
          {filtersActive ? "Filtros clínicos" : "Escopo clínico"}
        </p>

        <p className="mt-1.5 text-sm font-semibold text-foreground">
          {filtersActive
            ? "Nenhum caso corresponde aos filtros aplicados."
            : "Nenhum caso clínico registrado no escopo autorizado."}
        </p>

        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          {filtersActive
            ? "Os casos continuam disponíveis: apenas os filtros atuais não retornaram resultados."
            : "A leitura foi concluída e não encontrou casos clínicos. Nenhuma falha técnica ocorreu."}
        </p>

        {filtersActive && (
          <button
            type="button"
            onClick={onResetFilters}
            className={cn(
              "mt-4 inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-3.5 py-1.5 text-xs font-semibold text-cyan-200 transition-colors",
              "hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            Limpar filtros
          </button>
        )}
      </div>
    );
  }

  const groups = groupClinicalEntries(entries);

  return (
    <div className="flex flex-col gap-4" data-testid="clinical-case-list">
      {groups.map((group) => {
        const headingId = `clinical-group-${group.key}`;

        return (
          <section
            key={group.key}
            aria-labelledby={headingId}
            data-testid={`clinical-group-${group.key}`}
            className="overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/40 bg-muted/20 px-5 py-4">
              <div className="min-w-0">
                <h3
                  id={headingId}
                  className={cn(
                    "text-[11px] font-black uppercase tracking-[0.22em]",
                    group.key === "unrecognized"
                      ? "text-slate-400"
                      : "text-cyan-300/90",
                  )}
                >
                  {group.key === "unrecognized" && (
                    <HelpCircle
                      className="mr-1 inline h-3.5 w-3.5 align-[-0.1em]"
                      aria-hidden="true"
                    />
                  )}
                  {GROUP_LABELS[group.key]}
                </h3>
                <p className="mt-1 max-w-xl text-[13px] leading-snug text-muted-foreground">
                  {GROUP_HINTS[group.key]}
                </p>
              </div>
              <span className="shrink-0 rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-[13px] font-bold tabular-nums text-muted-foreground">
                {group.entries.length}{" "}
                {group.entries.length === 1 ? "caso" : "casos"}
              </span>
            </div>

            {/*
              I4A §9/§27 — responsive card grid.

              `auto-fill` + `minmax(280px, 1fr)` is deliberate rather than a fixed
              column count per breakpoint: the grid fits as many ~280-340px cards
              as the CONTENT width actually allows, which is what keeps readability
              ahead of card count (§9). The mock's six narrow columns are NOT
              forced — at a typical laptop content width this yields 3, at wide
              desktop 4, at tablet 2, and 1 on small, satisfying §27 without
              shrinking typography back down.
            */}
            <ul
              className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]"
              data-testid={`clinical-group-${group.key}-grid`}
            >
              {group.entries.map((entry) => (
                <ClinicalCaseCard
                  key={entry.entryId}
                  entry={entry}
                  onOpenCase={onOpenCase}
                  onOpenK9={onOpenK9}
                  caseSelected={selectedEntryId === entry.entryId}
                  k9Selected={selectedDogId === entry.dogId}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
