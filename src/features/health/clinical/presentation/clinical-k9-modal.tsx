/**
 * K9 Ops Web — Health Web v1 HW-6A.I4B
 * VISÃO CLÍNICA DO K9 — the second (and only other) contextual interaction on the
 * Clinical screen.
 *
 * WHAT THIS IS: a K9-anchored reading of the Clinical cases ALREADY LOADED for
 * that K9 in the current authorized scope. One card is one case; this view is the
 * other axis — all the cases of one K9, together.
 *
 * WHAT THIS IS NOT (I4B §7): it is NOT the Efetivo K9 profile. It does not
 * navigate, it does not link to /dogs, and it does not attempt to be a K9
 * datasheet. Breed, sex, birth date, conductor and specialties are deliberately
 * NOT rendered here even though they happen to be present on the loaded identity
 * — showing them would quietly turn a clinical view into a profile view.
 *
 * ZERO NEW READS (I4B §8): every value below comes from the SAME composed
 * `ClinicalCaseListEntry[]` that rendered the cards behind it. No Firestore, no
 * callable, no reader, no per-case fanout. Readiness, Nutrition, Agenda,
 * documents, events and cross-vertical restrictions are ABSENT ON PURPOSE
 * (I4B §11): each needs its own read contract and performance review, so
 * including them here would either fabricate data or smuggle in an unreviewed
 * N+1.
 *
 * TRUTHFULNESS RULES THAT SHAPE THE LAYOUT:
 * 1. NO K9-LEVEL INFERENCE FROM CASE FLAGS. `hasActiveRestriction` and friends
 *    are per-case tri-states, and two cases can legitimately disagree
 *    (`true` + `null`). Collapsing them into "este K9 tem restrição" would invent
 *    a fact no document states. So the signals block reports explicit COUNTS
 *    OVER CASES — afirmado / negado / não informado — and every label speaks
 *    about CASES, never about the K9.
 * 2. "Última atividade" is `lastEventAt` only, here as everywhere. `openedAt`
 *    is never promoted into it.
 * 3. An unrecognized status stays visible as its own bucket. A case whose status
 *    the parser refused can never disappear from the K9's own view.
 *
 * The case list inside this dialog is INFORMATIONAL, not interactive: it opens no
 * second modal and offers no drill-in, because I4B §16 allows exactly one
 * contextual modal open at a time. The close control is the only control.
 *
 * Accessibility comes from the shared `Dialog` primitive, reused unmodified.
 */

import { Dog } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ClinicalCaseListEntry } from "../data/clinical-scope-loader";
import { groupClinicalEntries } from "./clinical-case-list";
import {
  ClinicalStatusChip,
  formatClinicalDate,
} from "./clinical-case-card";
import {
  CLINICAL_ABSENT_TITLE_LABEL,
  CLINICAL_NO_LATER_ACTIVITY_LABEL,
  type ClinicalGroupKey,
} from "./types";

/** Group headings inside the K9 view — K9-scoped wording, not list-scoped. */
const K9_GROUP_LABELS: Record<ClinicalGroupKey, string> = {
  active: "Casos em acompanhamento",
  closed: "Casos encerrados",
  unrecognized: "Casos com estado não reconhecido",
};

/**
 * The K9 context for the open modal, derived from the authorized dataset.
 *
 * `dog` is taken from the loaded entries rather than passed in separately: the
 * identity shown is provably the identity the current authorized read returned.
 */
export interface ClinicalK9Context {
  dogId: string;
  dog: ClinicalCaseListEntry["dog"];
  entries: ClinicalCaseListEntry[];
}

/**
 * Resolves the K9 context for `dogId` out of the authorized entry list.
 *
 * Returns `null` when the K9 is not (or no longer) present in the dataset — which
 * is what makes this view unable to outlive its own authority (I4B §17/§18). A
 * forbidden, errored or emptied scope passes an empty list here, so the dialog
 * closes itself instead of holding stale clinical data on screen.
 */
export function deriveClinicalK9Context(
  dogId: string | null,
  entries: ClinicalCaseListEntry[],
): ClinicalK9Context | null {
  if (!dogId) return null;

  const dogEntries = entries.filter((entry) => entry.dogId === dogId);
  if (dogEntries.length === 0) return null;

  return { dogId, dog: dogEntries[0].dog, entries: dogEntries };
}

export interface ClinicalFlagTally {
  affirmed: number;
  negated: number;
  unknown: number;
}

/**
 * Counts a tri-state case flag across cases WITHOUT collapsing it.
 *
 * The three buckets are returned separately precisely so the UI can never
 * present "not informed" as an affirmed negative.
 */
export function tallyClinicalFlag(
  entries: ClinicalCaseListEntry[],
  pick: (entry: ClinicalCaseListEntry) => boolean | null,
): ClinicalFlagTally {
  const tally: ClinicalFlagTally = { affirmed: 0, negated: 0, unknown: 0 };

  for (const entry of entries) {
    const value = pick(entry);
    if (value === null) tally.unknown += 1;
    else if (value) tally.affirmed += 1;
    else tally.negated += 1;
  }

  return tally;
}

/** A titled block. */
function Section({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section data-testid={testId}>
      <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
        {title}
      </h3>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/** One count in the scope block. `numeric` keeps digits aligned. */
function CountFact({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: number;
  tone?: string;
  testId?: string;
}) {
  return (
    <span
      className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border/50 bg-muted/20 px-3 py-2"
      data-testid={testId}
    >
      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-xl font-extrabold tabular-nums leading-none",
          tone ?? "text-foreground",
        )}
      >
        {value}
      </span>
    </span>
  );
}

/**
 * A tri-state tally row.
 *
 * All three counts are always rendered, including zeros, so the reader can see
 * that "não informado: 0" is a proven statement rather than a missing line. The
 * label speaks about CASES — never about the K9 — because a K9-level claim is
 * exactly the inference this component exists to avoid.
 */
function TallyRow({
  label,
  tally,
  affirmedLabel,
  negatedLabel,
  testId,
}: {
  label: string;
  tally: ClinicalFlagTally;
  affirmedLabel: string;
  negatedLabel: string;
  testId?: string;
}) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/40 py-2 last:border-b-0"
      data-testid={testId}
    >
      <span className="text-[13px] font-semibold text-foreground">{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px]">
        <span
          className={cn(
            "font-semibold tabular-nums",
            tally.affirmed > 0 ? "text-amber-300" : "text-muted-foreground",
          )}
        >
          {tally.affirmed} {affirmedLabel}
        </span>
        <span className="font-semibold tabular-nums text-muted-foreground">
          {tally.negated} {negatedLabel}
        </span>
        {/*
          Never coloured as a reassuring "no": an absent flag is its own outcome
          and is named as such.
        */}
        <span className="font-semibold tabular-nums text-slate-400">
          {tally.unknown} não informado
        </span>
      </span>
    </div>
  );
}

/** One informational case line. Not a control: this view opens nothing. */
function CaseLine({ entry }: { entry: ClinicalCaseListEntry }) {
  const item = entry.case;
  const title = item.title ?? CLINICAL_ABSENT_TITLE_LABEL;
  const titleIsAbsent = item.title === null;

  return (
    <li
      className="flex flex-col gap-1.5 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5"
      data-testid="clinical-k9-case-line"
      data-entry-id={entry.entryId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span
          className={cn(
            "min-w-0 break-words text-sm font-semibold leading-snug",
            titleIsAbsent ? "italic text-muted-foreground" : "text-foreground",
          )}
          data-testid="clinical-k9-case-title"
        >
          {title}
        </span>
        <ClinicalStatusChip status={item.clinicalStatus} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
        <span className="text-muted-foreground">
          Aberto em{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatClinicalDate(item.openedAt)}
          </span>
        </span>
        {/*
          THE last-activity rule, restated: `lastEventAt` only. `openedAt` above
          is a separate fact and is never promoted into this slot.
        */}
        <span
          className="text-muted-foreground"
          data-testid="clinical-k9-case-last-activity"
        >
          Última atividade{" "}
          <span
            className={cn(
              "font-semibold",
              item.lastEventAt
                ? "tabular-nums text-foreground"
                : "text-slate-400",
            )}
          >
            {item.lastEventAt
              ? formatClinicalDate(item.lastEventAt)
              : CLINICAL_NO_LATER_ACTIVITY_LABEL}
          </span>
        </span>
      </div>
    </li>
  );
}

export function ClinicalK9Modal({
  context,
  onClose,
}: {
  /** The K9 context, or null when the K9 view is closed / no longer authorized. */
  context: ClinicalK9Context | null;
  onClose: () => void;
}) {
  // Nothing to describe and nothing to show: the dialog is not rendered at all.
  if (!context) return null;

  const { dog, entries } = context;

  /*
   * Groups are reused from the LIST, not re-derived: the K9 view and the list
   * must never disagree about which bucket a case is in. `groupClinicalEntries`
   * also preserves the incoming composition order, so the cases appear here in
   * the same order they appear on screen.
   */
  const groups = groupClinicalEntries(entries);
  const countFor = (key: ClinicalGroupKey) =>
    groups.find((group) => group.key === key)?.entries.length ?? 0;

  const activeCount = countFor("active");
  const closedCount = countFor("closed");
  const unrecognizedCount = countFor("unrecognized");

  const restrictionTally = tallyClinicalFlag(
    entries,
    (entry) => entry.case.hasActiveRestriction,
  );
  const scheduleTally = tallyClinicalFlag(
    entries,
    (entry) => entry.case.hasPendingSchedule,
  );
  /*
   * A COUNT, not a boolean: `0` is an affirmed "nenhum tratamento" and `null` is
   * "não informado". Mapping it through the same tri-state tally keeps those two
   * outcomes apart instead of both reading as zero.
   */
  const treatmentTally = tallyClinicalFlag(entries, (entry) => {
    const count = entry.case.activeTreatmentsCount;
    return count === null ? null : count > 0;
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Visão clínica do K9"
      description={`Visão clínica de ${dog.name} sobre os casos já carregados na leitura autorizada. Não inclui prontidão, nutrição ou agenda.`}
      className="max-w-3xl"
    >
      <div className="flex flex-col gap-6" data-testid="clinical-k9-modal">
        {/*
          IDENTITY — the same treatment as the card and the case modal, and
          deliberately no more than that: name, MAT and photo. This is a clinical
          view anchored on a K9, not a K9 datasheet (§7).
        */}
        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-center"
          data-testid="clinical-k9-modal-identity"
        >
          {dog.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dog.photoUrl}
              alt={`K9 ${dog.name}`}
              className="h-28 w-28 shrink-0 rounded-2xl border border-cyan-300/35 object-cover shadow-[0_0_0_1px_rgba(8,20,36,0.6),0_4px_18px_rgba(34,211,238,0.16)]"
              data-testid="clinical-k9-modal-photo"
            />
          ) : (
            <span
              className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.07] text-cyan-300/70"
              data-testid="clinical-k9-modal-photo-fallback"
              role="img"
              aria-label={`K9 ${dog.name} sem foto cadastrada`}
            >
              <Dog className="h-12 w-12" aria-hidden="true" />
            </span>
          )}

          <div className="flex min-w-0 flex-col gap-1.5">
            <span
              className="truncate text-2xl font-extrabold leading-tight tracking-tight text-cyan-100"
              data-testid="clinical-k9-modal-name"
            >
              {dog.name}
            </span>
            <span
              className={cn(
                "truncate text-[13px] leading-tight tracking-wide",
                dog.registrationNumber
                  ? "font-mono font-semibold text-cyan-300/75"
                  : "italic text-slate-400",
              )}
              data-testid="clinical-k9-modal-registration"
            >
              {dog.registrationNumber
                ? `MAT. ${dog.registrationNumber}`
                : "MAT. não informada"}
            </span>
          </div>
        </div>

        {/*
          CASOS CLÍNICOS NO ESCOPO — pure counts of list membership. No inference:
          a case is counted in exactly the bucket the list already put it in.
        */}
        <Section
          title="Casos clínicos no escopo autorizado"
          testId="clinical-k9-modal-scope-section"
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <CountFact
              label="Total"
              value={entries.length}
              testId="clinical-k9-count-total"
            />
            <CountFact
              label="Em acompanhamento"
              value={activeCount}
              tone={activeCount > 0 ? "text-cyan-200" : undefined}
              testId="clinical-k9-count-active"
            />
            <CountFact
              label="Encerrados"
              value={closedCount}
              testId="clinical-k9-count-closed"
            />
            {/*
              The unrecognized count is rendered ONLY when it is non-zero: it is a
              technical parse outcome, and advertising a permanent "0" would
              present a parser defect as a routine clinical metric. When it IS
              non-zero it can never be hidden.
            */}
            {unrecognizedCount > 0 && (
              <CountFact
                label="Não reconhecidos"
                value={unrecognizedCount}
                tone="text-slate-300"
                testId="clinical-k9-count-unrecognized"
              />
            )}
          </div>
        </Section>

        {/*
          SINAIS CLÍNICOS — counts OVER CASES, never a K9-level verdict. See the
          file header: two cases may disagree, and `null` is a third answer.
        */}
        <Section
          title="Sinais clínicos nos casos carregados"
          testId="clinical-k9-modal-signals-section"
        >
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-1">
            <TallyRow
              label="Casos com restrição clínica ativa"
              tally={restrictionTally}
              affirmedLabel="com restrição"
              negatedLabel="sem restrição"
              testId="clinical-k9-tally-restriction"
            />
            <TallyRow
              label="Casos com agenda clínica pendente"
              tally={scheduleTally}
              affirmedLabel="pendente"
              negatedLabel="sem pendência"
              testId="clinical-k9-tally-schedule"
            />
            <TallyRow
              label="Casos com tratamento ativo"
              tally={treatmentTally}
              affirmedLabel="com tratamento"
              negatedLabel="sem tratamento"
              testId="clinical-k9-tally-treatment"
            />
          </div>
          <p className="mt-2 text-xs leading-snug text-muted-foreground">
            Contagens por CASO. Nenhuma conclusão sobre o K9 é derivada destes
            números.
          </p>
        </Section>

        {/*
          The cases themselves, in the list's own group order. Informational:
          no drill-in, so only one contextual modal is ever open (§16).
        */}
        {groups.map((group) => (
          <Section
            key={group.key}
            title={K9_GROUP_LABELS[group.key]}
            testId={`clinical-k9-modal-group-${group.key}`}
          >
            <ul className="flex flex-col gap-2">
              {group.entries.map((entry) => (
                <CaseLine key={entry.entryId} entry={entry} />
              ))}
            </ul>
          </Section>
        ))}

        {/*
          The scope statement. It names what is absent so the reader knows this is
          a bounded clinical view — not a richer screen that failed to load.
        */}
        <p
          className="border-t border-border/40 pt-4 text-[13px] leading-snug text-muted-foreground"
          data-testid="clinical-k9-modal-scope-note"
        >
          Visão baseada apenas nos casos clínicos já carregados na leitura
          autorizada deste K9. Prontidão, nutrição, agenda, histórico de eventos e
          documentos não fazem parte desta visualização.
        </p>
      </div>
    </Dialog>
  );
}
