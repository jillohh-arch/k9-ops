/**
 * K9 Ops Web — Health Web v1 HW-6A.I4A
 * Clinical CASE SUMMARY modal.
 *
 * SCOPE, stated as a boundary rather than a feature list: this modal SUMMARIZES a
 * case using ONLY fields already present on the composed `ClinicalCaseListEntry`.
 * It performs no read of its own — no Firestore, no callable, no reader, no
 * secondary fanout — because everything it shows was already loaded to render the
 * card behind it.
 *
 * The human-approved mockup ALSO drew Histórico/timeline, Tratamento,
 * Observações, Documentos and "Editar caso". Those are DELIBERATELY ABSENT:
 * - events/documents/amendments need their own read contract and performance
 *   review, so a timeline here would either be fabricated or would smuggle in an
 *   unreviewed fanout (I4A §21);
 * - HW-6A is read-only and no Clinical writer is released, so there is no edit
 *   action — and no DISABLED edit button either, because a greyed-out control
 *   still promises a capability that does not exist (I4A §22).
 *
 * Equally deliberate: no invented clinical prose. If the read model has no
 * narrative field, the modal shows no narrative. A plausible-sounding summary
 * would be indistinguishable from real clinical data to the reader.
 *
 * Accessibility comes from the shared `Dialog` primitive (role=dialog,
 * aria-modal, focus trap, Escape, labelled close control, focus return), which is
 * reused rather than reimplemented.
 */

import { Dog } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ClinicalCaseListEntry } from "../data/clinical-scope-loader";
import {
  ClinicalStatusChip,
  clinicalFlagDisplay,
  clinicalTreatmentDisplay,
  formatClinicalDate,
} from "./clinical-case-card";
import {
  CLINICAL_ABSENT_TITLE_LABEL,
  CLINICAL_NO_LATER_ACTIVITY_LABEL,
} from "./types";

/** A titled block of label/value pairs. */
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
      <div className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Fact({
  label,
  value,
  tone,
  numeric,
  testId,
}: {
  label: string;
  value: string;
  tone?: string;
  numeric?: boolean;
  testId?: string;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5" data-testid={testId}>
      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold",
          numeric && "tabular-nums",
          tone ?? "text-foreground",
        )}
      >
        {value}
      </span>
    </span>
  );
}

export function ClinicalCaseModal({
  entry,
  onClose,
}: {
  /** The selected case, or null when nothing is open. */
  entry: ClinicalCaseListEntry | null;
  onClose: () => void;
}) {
  // The primitive unmounts on `open={false}`; with no entry there is nothing to
  // describe, so the dialog is not rendered at all.
  if (!entry) return null;

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

  return (
    <Dialog
      open
      onClose={onClose}
      title="Resumo do caso clínico"
      description={`Resumo do caso clínico de ${dog.name}. Somente dados já disponíveis na leitura autorizada.`}
      className="max-w-3xl"
    >
      <div className="flex flex-col gap-6" data-testid="clinical-case-modal">
        {/* IDENTIFICAÇÃO DO K9 — the same identity treatment as the card. */}
        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-center"
          data-testid="clinical-modal-identity"
        >
          {dog.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dog.photoUrl}
              alt={`K9 ${dog.name}`}
              className="h-28 w-28 shrink-0 rounded-2xl border border-cyan-300/35 object-cover shadow-[0_0_0_1px_rgba(8,20,36,0.6),0_4px_18px_rgba(34,211,238,0.16)]"
              data-testid="clinical-modal-k9-photo"
            />
          ) : (
            <span
              className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.07] text-cyan-300/70"
              data-testid="clinical-modal-k9-photo-fallback"
              role="img"
              aria-label={`K9 ${dog.name} sem foto cadastrada`}
            >
              <Dog className="h-12 w-12" aria-hidden="true" />
            </span>
          )}

          <div className="flex min-w-0 flex-col gap-1.5">
            <span
              className="truncate text-2xl font-extrabold leading-tight tracking-tight text-cyan-100"
              data-testid="clinical-modal-k9-name"
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
              data-testid="clinical-modal-k9-registration"
            >
              {dog.registrationNumber
                ? `MAT. ${dog.registrationNumber}`
                : "MAT. não informada"}
            </span>
            <span className="mt-0.5">
              <ClinicalStatusChip status={item.clinicalStatus} />
            </span>
          </div>
        </div>

        {/* CASO CLÍNICO — the subject and when it opened. */}
        <Section title="Caso clínico" testId="clinical-modal-case-section">
          <span className="flex min-w-0 flex-col gap-0.5 sm:col-span-2">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
              Título
            </span>
            <span
              className={cn(
                "break-words text-base font-semibold leading-snug",
                titleIsAbsent ? "italic text-muted-foreground" : "text-foreground",
              )}
              data-testid="clinical-modal-case-title"
            >
              {title}
            </span>
          </span>
          <Fact label="Aberto em" value={formatClinicalDate(item.openedAt)} />
          {/*
            THE last-activity rule, restated here: this slot is lastEventAt only.
            openedAt is never promoted into it.
          */}
          <Fact
            label="Última atividade"
            value={
              item.lastEventAt
                ? formatClinicalDate(item.lastEventAt)
                : CLINICAL_NO_LATER_ACTIVITY_LABEL
            }
            tone={item.lastEventAt ? undefined : "text-slate-400"}
            testId="clinical-modal-last-activity"
          />
        </Section>

        {/* SITUAÇÃO ATUAL — the three tri-state clinical facts. */}
        <Section title="Situação atual" testId="clinical-modal-situation-section">
          <Fact
            label="Restrição ativa"
            value={restriction.text}
            tone={restriction.tone}
          />
          <Fact
            label="Agenda pendente"
            value={schedule.text}
            tone={schedule.tone}
          />
          <Fact
            label="Tratamentos ativos"
            value={treatments.text}
            tone={treatments.tone}
            numeric
          />
          {/*
            eventCount is a COUNT the read model already carries. It is rendered as
            a count and nothing more — it does not become a timeline, and `null`
            reads as "Não informado" rather than a false zero.
          */}
          <Fact
            label="Eventos registrados"
            value={
              item.eventCount === null ? "Não informado" : String(item.eventCount)
            }
            tone={item.eventCount === null ? "text-slate-400" : undefined}
            numeric
            testId="clinical-modal-event-count"
          />
        </Section>

        {/*
          The scope statement. It is here so the reader knows the modal is a
          SUMMARY of an authorized read — not a truncated view of something richer
          that failed to load.
        */}
        <p
          className="border-t border-border/40 pt-4 text-[13px] leading-snug text-muted-foreground"
          data-testid="clinical-modal-scope-note"
        >
          Resumo baseado apenas nos dados já disponíveis na leitura autorizada
          deste caso. Histórico de eventos, documentos e edição clínica não fazem
          parte desta visualização.
        </p>
      </div>
    </Dialog>
  );
}
