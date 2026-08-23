/**
 * K9 Ops Web — Health Web v1 HW-6A.I4B
 * A single Clinical case CARD.
 *
 * PRODUCT DECISION (I4A §1): Clinical cases are NOT table-like horizontal rows.
 * ONE CARD = ONE CLINICAL CASE, never one K9 profile — so the same K9 legitimately
 * appears on several cards when it has several cases.
 *
 * MANDATES (the two the Control Tower flagged as easy to get wrong):
 * 1. `null` is NEVER `false`/`0`. Restriction, pending schedule and active
 *    treatments each render three visibly distinct outcomes: affirmed-yes,
 *    affirmed-no, and NOT INFORMED. An absent flag is labelled, never dropped
 *    and never coloured as a reassuring "no".
 * 2. "Última atividade" is `lastEventAt` ONLY. `openedAt` is shown separately as
 *    "Aberto em" and is NEVER promoted into the last-activity slot. When
 *    `lastEventAt` is null the card says "Sem atividade posterior".
 *
 * INTERACTION BOUNDARY (I4B §3/§4/§5): the card now exposes TWO interactions, and
 * the load-bearing accessibility fact is that they are SIBLING controls, never
 * nested. The card is no longer a single `<button>` — that structure could not
 * host a second control without an invalid `<button>` inside a `<button>`. It is
 * now a NON-interactive `<article>` container holding two real, independent
 * `<button>`s:
 * - K9 IDENTITY ACTION (photo + name + MAT) -> opens VISÃO CLÍNICA DO K9;
 * - CASE ACTION (status + title + metadata) -> opens the existing CASE SUMMARY
 *   MODAL, unchanged from I4A.
 * Each is natively keyboard reachable and carries its own visible focus ring and
 * descriptive accessible name. Because they are siblings, there is no ambiguous
 * click target and no `stopPropagation` hack compensating for invalid structure.
 *
 * The display helpers are exported because both modals render the same clinical
 * facts. Sharing them keeps the null/false/0 discipline in ONE place —
 * duplicating it is exactly how a false "no" gets introduced later.
 */

import { Dog, HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CLINICAL_CASE_STATUS_LABELS,
  type ClinicalCaseStatus,
} from "../../domain/read-states";
import type { ClinicalCaseListEntry } from "../data/clinical-scope-loader";
import {
  CLINICAL_ABSENT_TITLE_LABEL,
  CLINICAL_NO_LATER_ACTIVITY_LABEL,
  CLINICAL_UNRECOGNIZED_STATUS_LABEL,
} from "./types";

type StatusTone = "cyan" | "indigo" | "amber" | "emerald" | "slate" | "unknown";

const STATUS_TONE: Record<ClinicalCaseStatus, StatusTone> = {
  open: "cyan",
  under_investigation: "indigo",
  under_treatment: "amber",
  monitoring: "cyan",
  discharged: "emerald",
  cancelled: "slate",
};

const TONE_CLASS: Record<StatusTone, string> = {
  cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  indigo: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  slate: "border-slate-500/25 bg-slate-500/10 text-slate-300",
  unknown: "border-slate-500/25 bg-slate-500/10 text-slate-300",
};

/**
 * Canonical status pill. An unrecognized status is a PARSE OUTCOME, not a
 * clinical stage: it stays visible, is named explicitly, and carries an icon so
 * it is never conveyed by colour alone.
 */
export function ClinicalStatusChip({
  status,
}: {
  status: ClinicalCaseStatus | null;
}) {
  if (status === null) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
          TONE_CLASS.unknown,
        )}
        data-testid="clinical-card-status-unknown"
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{CLINICAL_UNRECOGNIZED_STATUS_LABEL}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold",
        TONE_CLASS[STATUS_TONE[status]],
      )}
    >
      {CLINICAL_CASE_STATUS_LABELS[status]}
    </span>
  );
}

/** Formats a date for display, or a stable em dash placeholder. */
export function formatClinicalDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("pt-BR", { dateStyle: "short" });
}

export interface ClinicalFactDisplay {
  text: string;
  tone: string;
}

/**
 * Tri-state flag display: affirmed / affirmed-negative / not informed.
 * The three outcomes are textually distinct — never colour-only, never a silent
 * absence.
 */
export function clinicalFlagDisplay(
  value: boolean | null,
  affirmativeText: string,
  negativeText: string,
): ClinicalFactDisplay {
  if (value === null) return { text: "Não informado", tone: "text-slate-400" };
  return value
    ? { text: affirmativeText, tone: "text-amber-300" }
    : { text: negativeText, tone: "text-muted-foreground" };
}

/** Treatment count display with the same three-outcome discipline. */
export function clinicalTreatmentDisplay(
  count: number | null,
): ClinicalFactDisplay {
  if (count === null) return { text: "Não informado", tone: "text-slate-400" };
  if (count === 0) return { text: "Nenhum", tone: "text-muted-foreground" };
  return { text: String(count), tone: "text-amber-300" };
}

/** One label/value pair inside a card's metadata block. */
function CardFact({
  label,
  value,
  tone,
  className,
  testId,
  numeric,
}: {
  label: string;
  value: string;
  tone?: string;
  className?: string;
  testId?: string;
  numeric?: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 flex-col gap-0.5", className)} data-testid={testId}>
      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "truncate text-sm font-semibold",
          numeric && "tabular-nums",
          tone ?? "text-foreground",
        )}
      >
        {value}
      </span>
    </span>
  );
}

/**
 * K9 media area (I4A §10).
 *
 * Uses the institutional `dog.photoUrl` ONLY — no new read, no profile lookup,
 * no inference from Clinical data. The fallback occupies the SAME footprint as a
 * real photo, so a K9 without a picture never collapses into a tiny icon and
 * never gets a fabricated photograph.
 */
function CardMedia({ dog }: { dog: ClinicalCaseListEntry["dog"] }) {
  if (dog.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dog.photoUrl}
        alt={`K9 ${dog.name}`}
        className="aspect-[4/3] w-full object-cover"
        data-testid="clinical-card-k9-photo"
      />
    );
  }

  return (
    <span
      className="flex aspect-[4/3] w-full items-center justify-center bg-cyan-300/[0.06] text-cyan-300/60"
      data-testid="clinical-card-k9-photo-fallback"
      role="img"
      aria-label={`K9 ${dog.name} sem foto cadastrada`}
    >
      <Dog className="h-14 w-14" aria-hidden="true" />
    </span>
  );
}

export function ClinicalCaseCard({
  entry,
  onOpenCase,
  onOpenK9,
  caseSelected = false,
  k9Selected = false,
}: {
  entry: ClinicalCaseListEntry;
  /** Opens the case summary modal for THIS case (I4B §6). */
  onOpenCase: (entry: ClinicalCaseListEntry) => void;
  /** Opens VISÃO CLÍNICA DO K9 for this card's K9 (I4B §7). */
  onOpenK9: (entry: ClinicalCaseListEntry) => void;
  /** Visual emphasis while THIS card's case modal is open (I4A §24). */
  caseSelected?: boolean;
  /** Visual emphasis while the K9 modal for this card's K9 is open (I4B §24). */
  k9Selected?: boolean;
}) {
  const { dog, case: item } = entry;
  const title = item.title ?? CLINICAL_ABSENT_TITLE_LABEL;
  const titleIsAbsent = item.title === null;

  const restriction = clinicalFlagDisplay(
    item.hasActiveRestriction,
    "Com restrição",
    "Sem restrição",
  );
  const schedule = clinicalFlagDisplay(
    item.hasPendingSchedule,
    "Pendente",
    "Sem pendência",
  );
  const treatments = clinicalTreatmentDisplay(item.activeTreatmentsCount);

  const registrationLabel = dog.registrationNumber
    ? `MAT. ${dog.registrationNumber}`
    : "MAT. não informada";

  return (
    <li className="min-w-0">
      {/*
        I4B §4/§5 — the card is a NON-interactive container. Its two actions are
        the sibling <button>s below, never nested. `article` carries the card's
        border, surface and selection emphasis; it holds no handler and no
        tabindex, so it is not itself a control.
      */}
      <article
        data-testid="clinical-case-card"
        data-entry-id={entry.entryId}
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-2xl border transition-colors",
          "bg-[#0b1628]/82 shadow-[0_18px_60px_rgba(0,0,0,0.22)]",
          caseSelected || k9Selected
            ? "border-cyan-300/60 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_18px_60px_rgba(34,211,238,0.18)]"
            : "border-cyan-200/12",
        )}
      >
        {/*
          K9 IDENTITY ACTION (I4B §3B/§3C): photo + name + MAT are ONE coherent
          target that opens VISÃO CLÍNICA DO K9. `aria-haspopup="dialog"` states
          what activation does; `aria-expanded` reflects whether the K9 modal for
          this K9 is the one currently open.
        */}
        <button
          type="button"
          onClick={() => onOpenK9(entry)}
          aria-haspopup="dialog"
          aria-expanded={k9Selected}
          aria-label={`Visão clínica do K9 ${dog.name}`}
          data-testid="clinical-card-k9-action"
          className={cn(
            "group/k9 flex w-full cursor-pointer flex-col text-left transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            k9Selected ? "bg-cyan-300/[0.06]" : "hover:bg-cyan-300/[0.04]",
          )}
        >
          <CardMedia dog={dog} />

          {/* K9 identity: the card's anchor, read before the clinical subject. */}
          <span className="flex min-w-0 flex-col gap-0.5 px-4 pt-4">
            <span
              className="truncate text-[22px] font-extrabold leading-tight tracking-tight text-cyan-100"
              data-testid="clinical-card-k9-name"
            >
              {dog.name}
            </span>
            {/*
              Truthful identifier: the canonical registration when present, an
              explicit absence label otherwise. NEVER derived from caseId.
            */}
            <span
              className={cn(
                "truncate text-[13px] leading-tight tracking-wide",
                dog.registrationNumber
                  ? "font-mono font-semibold text-cyan-300/75"
                  : "italic text-slate-400",
              )}
              data-testid="clinical-card-k9-registration"
            >
              {registrationLabel}
            </span>
          </span>
        </button>

        {/*
          CASE ACTION (I4B §3A/§6): status + title + metadata open the EXISTING
          case summary modal, its data contract unchanged. Sibling of the K9
          action — activating it never opens the K9 view and vice versa.
        */}
        <button
          type="button"
          onClick={() => onOpenCase(entry)}
          aria-haspopup="dialog"
          aria-expanded={caseSelected}
          aria-label={`Caso clínico de ${dog.name}: ${title}`}
          data-testid="clinical-case-action"
          className={cn(
            "group/case flex min-w-0 flex-1 cursor-pointer flex-col gap-3 p-4 text-left transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            caseSelected ? "bg-cyan-300/[0.06]" : "hover:bg-cyan-300/[0.04]",
          )}
        >
          <ClinicalStatusChip status={item.clinicalStatus} />

          {/* The clinical subject wraps: meaning is never cut to keep cards even. */}
          <span
            className={cn(
              "min-w-0 break-words text-base font-semibold leading-snug lg:text-[17px]",
              titleIsAbsent ? "italic text-muted-foreground" : "text-foreground",
            )}
            data-testid="clinical-card-case-title"
          >
            {title}
          </span>

          {/*
            The five canonical facts, in their frozen order. Two columns keep them
            readable at card width instead of recreating micro-table typography.
          */}
          <span
            className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border/40 pt-3"
            data-testid="clinical-card-metadata"
          >
            <CardFact label="Aberto em" value={formatClinicalDate(item.openedAt)} />
            {/*
              THE last-activity rule: this slot is lastEventAt only. openedAt is
              never substituted here; its absence reads "Sem atividade posterior".
            */}
            <CardFact
              label="Última atividade"
              value={
                item.lastEventAt
                  ? formatClinicalDate(item.lastEventAt)
                  : CLINICAL_NO_LATER_ACTIVITY_LABEL
              }
              tone={item.lastEventAt ? undefined : "text-slate-400"}
              testId="clinical-card-last-activity"
            />
            <CardFact
              label="Restrição ativa"
              value={restriction.text}
              tone={restriction.tone}
            />
            <CardFact
              label="Agenda pendente"
              value={schedule.text}
              tone={schedule.tone}
            />
            <CardFact
              label="Tratamentos ativos"
              value={treatments.text}
              tone={treatments.tone}
              className="col-span-2"
              numeric
            />
          </span>
        </button>
      </article>
    </li>
  );
}
