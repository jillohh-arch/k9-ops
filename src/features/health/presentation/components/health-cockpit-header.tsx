/**
 * K9 Ops Web — Health Web v1 HW-3D
 * Cockpit identity + primary readiness region for /health/readiness/[dogId].
 *
 * Follows HW-M03 composition and the visual language homologated in HW-UX-01:
 * layered navy, localized cyan illumination, icon tile, uppercase operational
 * micro-label, sentence-case entity name, controlled border hierarchy.
 *
 * Because this screen represents ONE K9, the photo is a real compositional
 * element rather than table metadata — but the region stays operationally dense,
 * not a cinematic hero.
 *
 * MANDATE: readiness is displayed, never computed. A missing projection is a
 * TECHNICAL state and must never render as the operational status
 * `not_evaluated`.
 */

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldOff,
  HelpCircle,
  Dog as DogIcon,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DogIdentityReadModel,
  QualityStateLabel,
  ReadinessStatus,
} from "../../domain/readiness-types";

/** Technical badge for a dog with NO valid canonical projection. */
const MISSING_PROJECTION_BADGE = {
  label: "Sem projeção válida",
  icon: HelpCircle,
  tile: "border-slate-500/25 bg-slate-500/10 text-slate-300",
  text: "text-slate-300",
  border: "border-slate-500/25",
  wash: "bg-slate-500/10",
} as const;

const STATUS_PRESENTATION: Record<
  ReadinessStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    tile: string;
    text: string;
    border: string;
    wash: string;
  }
> = {
  operational: {
    label: "Operacional",
    icon: CheckCircle2,
    tile: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    text: "text-emerald-400",
    border: "border-emerald-500/25",
    wash: "bg-emerald-500/10",
  },
  operational_attention: {
    label: "Operacional com atenção",
    icon: AlertTriangle,
    tile: "border-amber-500/25 bg-amber-500/10 text-amber-400",
    text: "text-amber-400",
    border: "border-amber-500/25",
    wash: "bg-amber-500/10",
  },
  fit_with_restrictions: {
    label: "Apto com restrições",
    icon: AlertCircle,
    tile: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
    text: "text-indigo-300",
    border: "border-indigo-500/25",
    wash: "bg-indigo-500/10",
  },
  temporarily_unfit: {
    label: "Temporariamente inapto",
    icon: ShieldOff,
    tile: "border-red-500/25 bg-red-500/10 text-red-400",
    text: "text-red-400",
    border: "border-red-500/25",
    wash: "bg-red-500/10",
  },
  not_evaluated: {
    label: "Não avaliado",
    icon: HelpCircle,
    tile: "border-slate-500/25 bg-slate-500/10 text-slate-300",
    text: "text-slate-300",
    border: "border-slate-500/25",
    wash: "bg-slate-500/10",
  },
};

/** Technical read quality — a separate dimension from operational status. */
const QUALITY_STYLES: Record<QualityStateLabel, string> = {
  Atualizada: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  Desatualizada: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  Parcial: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  Conflito: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-300",
  "Sem projeção válida": "border-slate-500/25 bg-slate-500/10 text-slate-300",
};

interface HealthCockpitHeaderProps {
  dog: DogIdentityReadModel;
  readinessStatus: ReadinessStatus;
  /** False when there is no valid canonical summary for this dog. */
  hasValidProjection: boolean;
  reason: string | null;
  qualityLabel: QualityStateLabel;
  readinessUpdatedAt: Date | null;
}

export function HealthCockpitHeader({
  dog,
  readinessStatus,
  hasValidProjection,
  reason,
  qualityLabel,
  readinessUpdatedAt,
}: HealthCockpitHeaderProps) {
  /*
   * INVARIANT: missing projection !== not_evaluated. Without a valid summary the
   * technical badge is shown; the operational label is never fabricated.
   */
  const presentation = hasValidProjection
    ? STATUS_PRESENTATION[readinessStatus] ?? MISSING_PROJECTION_BADGE
    : MISSING_PROJECTION_BADGE;
  const StatusIcon = presentation.icon;

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-cyan-200/12 p-5",
        "bg-[radial-gradient(circle_at_16%_8%,rgba(34,211,238,0.16),transparent_36%),linear-gradient(135deg,rgba(8,19,32,0.96),rgba(4,10,20,0.92))]",
        "shadow-[0_26px_90px_rgba(0,0,0,0.24)]",
      )}
      data-testid="health-cockpit-header"
    >
      <div
        className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        {/* K9 identity — institutional catalog, not a Health-owned model. */}
        <div className="flex items-start gap-4">
          {dog.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dog.photoUrl}
              alt={`Fotografia do K9 ${dog.name}`}
              className="h-24 w-24 shrink-0 rounded-2xl border border-cyan-200/20 object-cover shadow-[0_12px_36px_rgba(0,0,0,0.32)] sm:h-28 sm:w-28"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-muted/60 text-muted-foreground sm:h-28 sm:w-28">
              <DogIcon className="h-10 w-10" aria-hidden="true" />
            </div>
          )}

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              Prontidão operacional
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {dog.name}
            </h1>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              {dog.registrationNumber && (
                <span className="font-mono">MAT.: {dog.registrationNumber}</span>
              )}
              {dog.breed && <span>{dog.breed}</span>}
              {dog.conductor && (
                <span>Condutor: {dog.conductor.name ?? dog.conductor.ra}</span>
              )}
            </div>

            {/* Primary readiness instrument. */}
            <div
              className={cn(
                "mt-3.5 inline-flex items-center gap-2.5 rounded-2xl border px-3.5 py-2",
                presentation.border,
                presentation.wash,
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                  presentation.tile,
                )}
              >
                <StatusIcon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className={cn("text-sm font-black", presentation.text)}>
                {presentation.label}
              </span>
            </div>

            {/* Principal reason: visible without hunting the page. */}
            <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-300">
              {hasValidProjection
                ? reason || "Sem observações de prontidão."
                : "A prontidão operacional ainda não pôde ser determinada."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2.5 lg:items-end">
          <Link
            href="/health/readiness"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Voltar à prontidão do efetivo</span>
          </Link>

          {/*
            Technical quality is a DIFFERENT dimension from operational status:
            "Operacional com atenção" + "Parcial" are two independent facts.
          */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              Estado da leitura
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold",
                QUALITY_STYLES[qualityLabel],
              )}
            >
              <Activity className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{qualityLabel}</span>
            </span>
          </div>

          {/* Freshness comes from readiness_updated_at only. */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              {readinessUpdatedAt
                ? `Projeção atualizada em ${readinessUpdatedAt.toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}`
                : "Sem data de atualização da projeção"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
