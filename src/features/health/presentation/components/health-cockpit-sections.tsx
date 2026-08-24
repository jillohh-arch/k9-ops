/**
 * K9 Ops Web — Health Web v1 HW-3D
 * Cockpit sections for /health/readiness/[dogId] (SCR-03).
 *
 * Visual priority follows the approved screen model:
 *   1 readiness (header) -> 2 restrictions -> 3 pendencies/evidence
 *   -> 4 cases/treatments -> 5 schedule -> 6 preventive -> 7 nutrition -> 8 history
 *
 * MANDATES:
 * - Read-only. No control here mutates anything.
 * - Successful-empty and unavailable are DIFFERENT states and look different.
 * - Nothing is diagnosed: values are shown, never interpreted clinically.
 * - Absence of restrictions may only be affirmed when the read actually succeeded.
 */

import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  Scale,
  Syringe,
  Utensils,
  Stethoscope,
  CalendarDays,
  History,
  Clock,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { paths } from "../../domain/paths";
import type {
  EvidenceAvailability,
  OperationalRestrictionReadModel,
} from "../../domain/readiness-types";

/* ============================================================================
 * Shared shells
 * ========================================================================== */

/** Structural cockpit panel: strong outer border, layered navy surface. */
function CockpitPanel({
  microLabel,
  title,
  icon: Icon,
  tone = "cyan",
  action,
  children,
  className,
  testId,
}: {
  microLabel: string;
  title: string;
  icon: typeof ShieldAlert;
  tone?: "cyan" | "red";
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      className={cn(
        "relative flex flex-col overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]",
        className,
      )}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
              tone === "red"
                ? "border-red-500/25 bg-red-500/10 text-red-400"
                : "border-cyan-300/25 bg-cyan-300/10 text-cyan-300",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
              {microLabel}
            </p>
            <h2 className="mt-1 text-sm font-semibold text-foreground">{title}</h2>
          </div>
        </div>
        {action}
      </div>

      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Controlled unavailable state.
 *
 * Deliberately distinct from a successful empty result: this says the fact could
 * not be read, so no zero and no reassuring green is shown.
 */
function UnavailableEvidence({ reason }: { reason: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs text-muted-foreground">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-500/25 bg-slate-500/10 text-slate-300">
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Evidência indisponível
        </span>
        <span className="leading-relaxed">{reason}</span>
      </div>
    </div>
  );
}

/** Compact metric tile used across the evidence regions. */
function EvidenceTile({
  icon: Icon,
  label,
  value,
  detail,
  tone = "slate",
}: {
  icon: typeof Scale;
  label: string;
  value: string;
  detail?: string | null;
  tone?: "slate" | "emerald" | "amber" | "cyan";
}) {
  const tones = {
    slate: "border-slate-500/25 bg-slate-500/10 text-slate-300",
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-400",
    cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-300",
  } as const;

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
          tones[tone],
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
        {detail && (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{detail}</p>
        )}
      </div>
    </div>
  );
}

/** Provenance note: states that a value came from the readiness projection. */
function ProjectionProvenance() {
  return (
    <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
      <FileText className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
      <span>
        Valores provenientes do resumo projetado da prontidão canônica, não da leitura
        detalhada de cada fonte.
      </span>
    </p>
  );
}

const dateFmt = (d: Date) => d.toLocaleDateString("pt-BR");

/* ============================================================================
 * 2. Active restrictions — second visual priority
 * ========================================================================== */

const RESTRICTION_STYLES = {
  absolute: {
    label: "Restrição absoluta",
    border: "border-red-500/30",
    wash: "bg-red-500/[0.08]",
    badge: "border-red-500/25 bg-red-500/15 text-red-300",
  },
  partial: {
    label: "Restrição parcial",
    border: "border-indigo-500/30",
    wash: "bg-indigo-500/[0.08]",
    badge: "border-indigo-500/25 bg-indigo-500/15 text-indigo-300",
  },
  attention: {
    label: "Restrição de atenção",
    border: "border-amber-500/30",
    wash: "bg-amber-500/[0.08]",
    badge: "border-amber-500/25 bg-amber-500/15 text-amber-300",
  },
} as const;

export function CockpitRestrictions({
  restrictions,
  coverageComplete,
}: {
  restrictions: OperationalRestrictionReadModel[];
  /** False when the restrictions read failed — absence must not be affirmed. */
  coverageComplete: boolean;
}) {
  const cannotAffirmAbsence = restrictions.length === 0 && !coverageComplete;

  return (
    <CockpitPanel
      microLabel="Restrições ativas"
      title="Restrições operacionais ativas"
      icon={ShieldAlert}
      tone={restrictions.length > 0 ? "red" : "cyan"}
      testId="cockpit-restrictions"
      action={
        /*
         * A count is an affirmative claim. When the canonical restrictions read
         * failed, "0 restrições" would assert an absence nobody verified, so the
         * badge reports the technical state instead.
         */
        cannotAffirmAbsence ? (
          <span className="shrink-0 rounded-lg border border-slate-500/25 bg-slate-500/10 px-2 py-1 text-[11px] font-bold text-slate-300">
            Indisponível
          </span>
        ) : (
          <span className="shrink-0 rounded-lg border border-border bg-muted/30 px-2 py-1 text-[11px] font-bold tabular-nums text-muted-foreground">
            {restrictions.length}{" "}
            {restrictions.length === 1 ? "restrição" : "restrições"}
          </span>
        )
      }
    >
      {cannotAffirmAbsence ? (
        <UnavailableEvidence reason="Não foi possível confirmar as restrições ativas com os dados disponíveis." />
      ) : restrictions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.16)]">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Nenhuma restrição operacional ativa
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Este K9 não possui bloqueio clínico ou limitação operacional registrada.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {restrictions.map((r) => {
            const style = RESTRICTION_STYLES[r.type] ?? RESTRICTION_STYLES.attention;

            return (
              <li
                key={r.id}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-3.5 text-xs",
                  style.border,
                  style.wash,
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]",
                      style.badge,
                    )}
                  >
                    {style.label}
                  </span>
                  {/*
                    Only canonical lifecycle status ends a restriction. A past
                    expected_end is surfaced as an overdue re-evaluation, never as
                    "ended".
                  */}
                  {r.isOverdueReevaluation && (
                    <span className="text-[11px] font-bold text-amber-400">
                      Reavaliação em atraso
                    </span>
                  )}
                </div>

                <p className="text-sm font-semibold leading-snug text-foreground">
                  {r.description || r.reason}
                </p>

                {r.restrictedActivities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.restrictedActivities.map((activity) => (
                      <span
                        key={activity}
                        className="rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {activity}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                  <span>Emitida em {dateFmt(r.issuedAt)}</span>
                  {r.expectedEnd && <span>Previsão: {dateFmt(r.expectedEnd)}</span>}
                  {r.authorityLabel && <span>Autoridade: {r.authorityLabel}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CockpitPanel>
  );
}

/* ============================================================================
 * 3. Pendencies / completeness — projected facts only
 * ========================================================================== */

export function CockpitCompleteness({
  completeness,
}: {
  completeness: {
    hasRecentWeight: boolean;
    hasActiveNutrition: boolean;
    hasVaccinationCurrent: boolean;
    hasRecentExam: boolean;
  } | null;
}) {
  return (
    <CockpitPanel
      microLabel="Cobertura das evidências"
      title="Evidências que sustentam a prontidão"
      icon={FileText}
      testId="cockpit-completeness"
    >
      {completeness === null ? (
        <UnavailableEvidence reason="Cobertura das evidências não disponível nesta projeção." />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[
              { label: "Peso recente", ok: completeness.hasRecentWeight },
              { label: "Vacinação em dia", ok: completeness.hasVaccinationCurrent },
              { label: "Nutrição ativa", ok: completeness.hasActiveNutrition },
              { label: "Exame recente", ok: completeness.hasRecentExam },
            ].map((fact) => (
              <li
                key={fact.label}
                className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[11px] font-black",
                    fact.ok
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                      : "border-amber-500/25 bg-amber-500/10 text-amber-400",
                  )}
                  aria-hidden="true"
                >
                  {fact.ok ? "✓" : "!"}
                </span>
                <span className="text-xs font-medium text-foreground">{fact.label}</span>
                {/* Text carries the state too: never colour alone. */}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {fact.ok ? "registrado" : "pendente"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            A prontidão não é presumida: ela depende das evidências registradas pela
            projeção canônica.
          </p>
        </>
      )}
    </CockpitPanel>
  );
}

/* ============================================================================
 * 4-7. Preventive / clinical / nutrition evidence
 * ========================================================================== */

export function CockpitPreventiveEvidence({
  weightEvidence,
  vaccinationEvidence,
  nutritionSummary,
  dogId,
}: {
  weightEvidence: EvidenceAvailability;
  vaccinationEvidence: EvidenceAvailability;
  nutritionSummary: EvidenceAvailability;
  /*
   * Optional on purpose (NUT-WEB-5B): when present, the existing nutrition
   * evidence gains a link to the Nutrition vertical of the SAME K9. Absent, the
   * panel renders exactly as before — no caller is forced to change, and the
   * cockpit gains no capability requirement or command.
   */
  dogId?: string;
}) {
  const weight = weightEvidence.data as
    | { kg: number; measuredAt: Date; bcs?: number | null }
    | null
    | undefined;
  const vaccination = vaccinationEvidence.data as
    | { type: string; date: Date; nextDue?: Date | null }
    | null
    | undefined;
  const nutrition = nutritionSummary.data as
    | { active: boolean; foodType: string | null; amountGrams: number | null }
    | null
    | undefined;

  const anyAvailable =
    weightEvidence.available || vaccinationEvidence.available || nutritionSummary.available;

  return (
    <CockpitPanel
      microLabel="Evidências preventivas"
      title="Peso, vacinação e nutrição"
      icon={Scale}
      testId="cockpit-preventive"
    >
      <div className="flex flex-col gap-2.5">
        {weightEvidence.available && weight ? (
          <EvidenceTile
            icon={Scale}
            label="Peso"
            /* Value only — no underweight/overweight interpretation. */
            value={`${weight.kg} kg`}
            detail={`Medido em ${dateFmt(weight.measuredAt)}${
              weight.bcs != null ? ` · ECC ${weight.bcs}` : ""
            }`}
            tone="cyan"
          />
        ) : (
          <UnavailableEvidence reason={weightEvidence.reason} />
        )}

        {vaccinationEvidence.available && vaccination ? (
          <EvidenceTile
            icon={Syringe}
            label="Vacinação"
            value={vaccination.type}
            detail={`Aplicada em ${dateFmt(vaccination.date)}${
              vaccination.nextDue ? ` · próxima em ${dateFmt(vaccination.nextDue)}` : ""
            }`}
            tone="emerald"
          />
        ) : (
          <UnavailableEvidence reason={vaccinationEvidence.reason} />
        )}

        {nutritionSummary.available && nutrition ? (
          <EvidenceTile
            icon={Utensils}
            label="Plano alimentar"
            value={nutrition.active ? "Plano ativo" : "Sem plano ativo"}
            detail={[
              nutrition.foodType,
              nutrition.amountGrams != null ? `${nutrition.amountGrams} g/dia` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            tone={nutrition.active ? "emerald" : "amber"}
          />
        ) : (
          <UnavailableEvidence reason={nutritionSummary.reason} />
        )}

        {dogId ? (
          <Link
            href={paths.health_nutrition_dog(dogId)}
            className={cn(
              "inline-flex items-center gap-1.5 self-start rounded-xl border border-border bg-background/60 px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            data-testid="cockpit-to-nutrition-link"
          >
            <Utensils className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Abrir nutrição deste K9</span>
          </Link>
        ) : null}
      </div>

      {anyAvailable && <ProjectionProvenance />}
    </CockpitPanel>
  );
}

export function CockpitClinicalContext({
  clinicalSummary,
  scheduleSummary,
}: {
  clinicalSummary: EvidenceAvailability;
  scheduleSummary: EvidenceAvailability;
}) {
  const clinical = clinicalSummary.data as
    | {
        activeCases: number;
        activeTreatments: number;
        lastExam?: { type: string; date: Date; status: string } | null;
        lastConsultation?: {
          date: Date;
          professional: string | null;
          caseId: string | null;
        } | null;
      }
    | null
    | undefined;
  const schedule = scheduleSummary.data as
    | { pending: number; overdue: number }
    | null
    | undefined;

  return (
    <CockpitPanel
      microLabel="Contexto clínico"
      title="Casos, tratamentos e agenda"
      icon={Stethoscope}
      testId="cockpit-clinical"
    >
      <div className="flex flex-col gap-2.5">
        {clinicalSummary.available && clinical ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <EvidenceTile
              icon={Stethoscope}
              label="Casos ativos"
              value={String(clinical.activeCases)}
              detail={
                clinical.lastConsultation
                  ? `Última consulta em ${dateFmt(clinical.lastConsultation.date)}`
                  : null
              }
              tone={clinical.activeCases > 0 ? "amber" : "slate"}
            />
            <EvidenceTile
              icon={Clock}
              label="Tratamentos ativos"
              value={String(clinical.activeTreatments)}
              detail={
                clinical.lastExam
                  ? `Último exame: ${clinical.lastExam.type} (${dateFmt(clinical.lastExam.date)})`
                  : null
              }
              tone={clinical.activeTreatments > 0 ? "amber" : "slate"}
            />
          </div>
        ) : (
          <UnavailableEvidence reason={clinicalSummary.reason} />
        )}

        {scheduleSummary.available && schedule ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <EvidenceTile
              icon={CalendarDays}
              label="Agenda pendente"
              value={String(schedule.pending)}
              tone={schedule.pending > 0 ? "cyan" : "slate"}
            />
            <EvidenceTile
              icon={CalendarDays}
              label="Agenda em atraso"
              value={String(schedule.overdue)}
              tone={schedule.overdue > 0 ? "amber" : "slate"}
            />
          </div>
        ) : (
          <UnavailableEvidence reason={scheduleSummary.reason} />
        )}
      </div>

      {(clinicalSummary.available || scheduleSummary.available) && <ProjectionProvenance />}
    </CockpitPanel>
  );
}

/* ============================================================================
 * 8. History / timeline
 * ========================================================================== */

export function CockpitTimeline({
  timelineSummary,
}: {
  timelineSummary: EvidenceAvailability;
}) {
  return (
    <CockpitPanel
      microLabel="Histórico"
      title="Timeline de saúde"
      icon={History}
      testId="cockpit-timeline"
    >
      {timelineSummary.available ? (
        <p className="text-xs text-muted-foreground">
          Nenhum registro recente no período consultado.
        </p>
      ) : (
        /*
          health_timeline is a server-generated projection with no reader in this
          version. It is NOT rebuilt here by concatenating raw collections.
        */
        <UnavailableEvidence reason={timelineSummary.reason} />
      )}
    </CockpitPanel>
  );
}
