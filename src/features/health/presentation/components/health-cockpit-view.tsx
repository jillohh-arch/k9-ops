"use client";

/**
 * K9 Ops Web — Health Web v1 HW-3D
 * Client view for the individual readiness cockpit (/health/readiness/[dogId]).
 *
 * The cockpit is a COMPOSITION of several sources, so a failure in one source
 * degrades only that block: successfully read sections stay visible.
 */

import Link from "next/link";
import { AlertOctagon, ArrowLeft, Dog as DogIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReadinessCockpit } from "../hooks/use-readiness-cockpit";
import { ForbiddenState } from "./health-technical-states";
import { HealthCockpitHeader } from "./health-cockpit-header";
import {
  CockpitClinicalContext,
  CockpitCompleteness,
  CockpitPreventiveEvidence,
  CockpitRestrictions,
  CockpitTimeline,
} from "./health-cockpit-sections";

const backLink = cn(
  "mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors",
  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

export function HealthCockpitView({ dogId }: { dogId: string }) {
  const { status, cockpit, restrictionsCoverageComplete, errorMessage, refetch } =
    useReadinessCockpit(dogId);

  if (status === "loading") {
    return <CockpitSkeleton />;
  }

  if (status === "forbidden") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-border/60 bg-card/40 p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
        data-testid="cockpit-forbidden"
      >
        <ForbiddenState
          requiredCapability="health.read"
          message="Leitura do cockpit de prontidão não autorizada para o perfil de acesso atual."
        />
        <Link href="/health/readiness" className={backLink}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Voltar à prontidão do efetivo</span>
        </Link>
      </div>
    );
  }

  /*
   * Not found and "exists but out of scope" are deliberately indistinguishable,
   * so scope membership is never revealed. No silent redirect to another K9.
   */
  if (status === "not_found") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
        data-testid="cockpit-not-found"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-500/25 bg-slate-500/10 text-slate-300">
          <DogIcon className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
          Efetivo monitorado
        </p>
        <h1 className="text-sm font-semibold text-foreground">K9 não encontrado</h1>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          O K9 solicitado não está disponível no escopo atual.
        </p>
        <Link href="/health/readiness" className={backLink}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Voltar à prontidão do efetivo</span>
        </Link>
      </div>
    );
  }

  if (status === "error" || cockpit === null) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-red-400/20 bg-red-400/[0.06] p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
        data-testid="cockpit-error"
        role="alert"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/25 bg-red-400/10 text-red-300">
          <AlertOctagon className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300/80">
          Falha técnica de leitura
        </p>
        <h1 className="text-sm font-semibold text-red-200">
          Não foi possível carregar a prontidão deste K9.
        </h1>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          Nenhum estado operacional foi presumido. {errorMessage}
        </p>
        <button
          type="button"
          onClick={refetch}
          className={cn(
            "mt-1 inline-flex items-center gap-1.5 rounded-xl border border-red-400/25 bg-red-400/10 px-3.5 py-1.5 text-xs font-semibold text-red-200 transition-colors",
            "hover:bg-red-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tentar novamente</span>
        </button>
      </div>
    );
  }

  const summary = cockpit.summary;
  /*
   * A valid canonical projection is exactly "the summary was read successfully"
   * (same rule as readiness-view-model's hasValidProjection). Without it the
   * header shows the TECHNICAL state, never the operational `not_evaluated`.
   */
  const projectionValid = summary !== null;

  return (
    <div className="flex flex-col gap-6" data-testid="health-cockpit">
      {/* 1. Identity + readiness (highest priority). */}
      <HealthCockpitHeader
        dog={cockpit.dog}
        readinessStatus={cockpit.readinessStatus}
        hasValidProjection={projectionValid}
        reason={cockpit.reason}
        qualityLabel={cockpit.qualityLabel}
        readinessUpdatedAt={summary?.readinessUpdatedAt ?? null}
      />

      {/* Technical conflict stays visible; it is never resolved client-side. */}
      {cockpit.conflict?.hasConflict && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/[0.06] px-4 py-3"
          role="status"
          data-testid="cockpit-conflict"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300">
            <AlertOctagon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-300/85">
              Conflito de dados
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-fuchsia-100">
              {cockpit.conflict.description ??
                "Inconsistência entre a projeção de prontidão e as restrições canônicas."}
            </p>
          </div>
        </div>
      )}

      {/* 2. Restrictions. */}
      <CockpitRestrictions
        restrictions={cockpit.restrictions}
        coverageComplete={restrictionsCoverageComplete}
      />

      {/* 3. Evidence coverage. */}
      <CockpitCompleteness completeness={summary?.dataCompleteness ?? null} />

      {/* 4-7. Preventive + clinical context. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CockpitPreventiveEvidence
          weightEvidence={cockpit.weightEvidence}
          vaccinationEvidence={cockpit.vaccinationEvidence}
          nutritionSummary={cockpit.nutritionSummary}
          dogId={dogId}
        />
        <CockpitClinicalContext
          clinicalSummary={cockpit.clinicalSummary}
          scheduleSummary={cockpit.scheduleSummary}
        />
      </div>

      {/* 8. History. */}
      <CockpitTimeline timelineSummary={cockpit.timelineSummary} />
    </div>
  );
}

/** Skeleton mirrors the cockpit hierarchy — never fake values. */
function CockpitSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 animate-pulse"
      data-testid="cockpit-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando prontidão do K9...</span>

      <div className="rounded-[2rem] border border-cyan-200/12 bg-[#0b1628]/60 p-5">
        <div className="flex items-start gap-4">
          <div className="h-24 w-24 shrink-0 rounded-2xl bg-muted/50 sm:h-28 sm:w-28" />
          <div className="flex flex-col gap-2">
            <div className="h-2.5 w-36 rounded bg-muted/30" />
            <div className="h-7 w-48 rounded bg-muted/50" />
            <div className="h-3 w-64 rounded bg-muted/30" />
            <div className="mt-2 h-10 w-56 rounded-2xl bg-muted/40" />
          </div>
        </div>
      </div>

      <div className="h-48 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/60 p-5" />
      <div className="h-40 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/60 p-5" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="h-56 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/60 p-5" />
        <div className="h-56 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/60 p-5" />
      </div>
    </div>
  );
}
