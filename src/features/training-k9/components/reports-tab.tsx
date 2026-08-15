"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTrainingReportsData } from "../hooks/use-training-reports-data";
import { useTrainingK9Data } from "../hooks/use-training-k9-data";

import {
  ReportFilters,
  ReportFiltersSkeleton,
} from "./reports/report-filters";
import {
  ReportKpis,
  ReportKpisSkeleton,
} from "./reports/report-kpis";
import {
  ReportDataQuality,
  QueryStatusIndicator,
} from "./reports/report-data-quality";
import { ReportSectionShell } from "./reports/report-section-shell";
import { ReportSectionError } from "./reports/report-section-error";
import { ReportDogActivity } from "./reports/report-dog-activity";
import { ReportSessionSummary } from "./reports/report-session-summary";

import {
  REPORT_PERIOD_OPTIONS,
  DEFAULT_REPORT_PERIOD,
  type TrainingReportPeriod,
} from "../types/training-reports";

// ─── Error state ───────────────────────────────────────────────────────────────

export function ReportErrorState({
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6">
      <h3 className="text-sm font-bold text-red-300">
        Não foi possível carregar todos os dados dos relatórios.
      </h3>
      <p className="mt-1 text-xs text-red-300/70">
        Revise sua conexão e tente novamente.
      </p>
      <button
        className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-1.5 text-xs font-bold text-red-200 transition hover:bg-red-400/20"
        onClick={onRetry}
        type="button"
      >
        Tentar novamente
      </button>
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

export function NoFormationsEmpty() {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-cyan-200/8 bg-slate-950/50 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/5">
        <svg
          aria-hidden="true"
          className="h-7 w-7 text-cyan-300/50"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-bold text-white">
        Nenhuma formação configurada
      </h3>
      <p className="mt-2 max-w-sm text-sm text-slate-400">
        Os relatórios serão exibidos quando houver cães vinculados a uma matriz
        de treinamento.
      </p>
    </div>
  );
}

// ─── Inner component (reads URL params) ───────────────────────────────────────

function ReportsTabInner() {
  const data = useTrainingReportsData();
  const trainingK9 = useTrainingK9Data();
  const searchParams = useSearchParams();

  // Derive validated values from URL (no side effects).
  const rawPeriod = searchParams.get("reportPeriod");
  const validPeriod: TrainingReportPeriod = REPORT_PERIOD_OPTIONS.some(
    (o) => o.value === rawPeriod,
  )
    ? (rawPeriod as TrainingReportPeriod)
    : DEFAULT_REPORT_PERIOD;

  const rawModality = searchParams.get("reportModality");

  // Derived available modalities from training data — the canonical list.
  const availableModalities = useMemo(() => {
    const mods = new Set<string>();
    for (const dog of trainingK9.dogs) {
      for (const cell of dog.cells) {
        if (cell.source !== "none" && cell.modality) {
          mods.add(cell.modality);
        }
      }
    }
    return Array.from(mods).sort();
  }, [trainingK9.dogs]);

  // Whether the modality list is stable enough to make authoritative
  // decisions. Until base data finishes loading, we must NOT remove a
  // modality that the user previously selected — it might simply be
  // unavailable in the partial data snapshot.
  const modalityListReady =
    !trainingK9.loading && !data.loadingState.base;

  // The modality coming from the URL is "trusted" only if:
  //   - it is null (all); or
  //   - it appears in the canonical list; or
  //   - the canonical list is not yet ready (we must not lose the user's
  //     selection just because base data is still loading).
  const modalityFromUrlIsValid =
    !rawModality ||
    availableModalities.includes(rawModality) ||
    !modalityListReady;

  // ── URL → provider sync (effects only, never during render) ──────────
  // Sync the period from URL.
  useEffect(() => {
    if (data.filters.period !== validPeriod) {
      data.setPeriod(validPeriod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validPeriod]);

  // Sync the modality from URL — only when the URL value is valid.
  // We never call setModality during render, even for invalid values.
  useEffect(() => {
    if (!modalityFromUrlIsValid) return;
    if (rawModality && data.filters.modality !== rawModality) {
      data.setModality(rawModality);
    } else if (!rawModality && data.filters.modality !== null) {
      data.setModality(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawModality, modalityFromUrlIsValid]);

  // ── Base loading ──────────────────────────────────────────────────────────
  if (data.loadingState.base) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white">
            Relatórios de Treinamento
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Acompanhe atividade, evolução técnica e avaliações dos cães em
            formação.
          </p>
        </div>
        <ReportFiltersSkeleton />
        <ReportKpisSkeleton />
      </div>
    );
  }

  // ── Base error (only base — session/evaluation errors are handled locally) ─
  if (data.errorState.base) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white">
            Relatórios de Treinamento
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Acompanhe atividade, evolução técnica e avaliações dos cães em
            formação.
          </p>
        </div>
        <ReportFilters
          availableModalities={availableModalities}
          modalityListReady={modalityListReady}
          onModalityChange={data.setModality}
          onPeriodChange={data.setPeriod}
        />
        <ReportErrorState error={data.errorState.base} onRetry={data.retry} />
      </div>
    );
  }

  // ── No progress at all ──────────────────────────────────────────────────
  // Only when no dog has any progress document (in_formation OR operational).
  // Sessions/evaluations history without progress still counts as "configured".
  if (
    data.queryStats.progressCount === 0 &&
    !data.loadingState.base &&
    !data.loadingState.sessions
  ) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white">
            Relatórios de Treinamento
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Acompanhe atividade, evolução técnica e avaliações dos cães em
            formação.
          </p>
        </div>
        <ReportFilters
          availableModalities={availableModalities}
          modalityListReady={modalityListReady}
          onModalityChange={data.setModality}
          onPeriodChange={data.setPeriod}
        />
        <NoFormationsEmpty />
      </div>
    );
  }

  // ── Normal state ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">
          Relatórios de Treinamento
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Acompanhe atividade, evolução técnica e avaliações dos cães com
          formação configurada.
        </p>
      </div>

      {/* Filters */}
      <ReportFilters
        availableModalities={availableModalities}
        modalityListReady={modalityListReady}
        onModalityChange={data.setModality}
        onPeriodChange={data.setPeriod}
      />

      {/* Status indicator */}
      <QueryStatusIndicator
        hasError={!!data.errorState.base}
        isBaseLoading={data.loadingState.base}
        isLoading={data.loading}
      />

      {/* Evaluation error indicator — only for actual query failures, not permission skips */}
      {data.errorState.evaluations && !data.evaluationsSkipped && (
        <div
          className="rounded-xl border border-orange-400/20 bg-orange-400/5 px-4 py-3"
          data-testid="evaluation-error-warning"
          role="status"
        >
          <p className="text-xs font-medium text-orange-200">
            Não foi possível carregar algumas avaliações.
          </p>
          <p className="mt-0.5 text-xs text-orange-200/60">
            Os indicadores de avaliações podem estar incompletos.
          </p>
          <button
            className="mt-2 rounded-lg border border-orange-400/25 bg-orange-400/10 px-2.5 py-1 text-xs font-bold text-orange-200 transition hover:bg-orange-400/20"
            onClick={data.retryEvaluations}
            type="button"
          >
            Recarregar avaliações
          </button>
        </div>
      )}

      {/* Quality warnings */}
      {data.dataQuality.categorizedWarnings.length > 0 && (
        <ReportDataQuality
          categorizedWarnings={data.dataQuality.categorizedWarnings}
        />
      )}

      {/* KPIs */}
      <ReportKpis
        currentState={data.currentState}
        earliestLoadedSession={data.dataQuality.earliestLoadedSession}
        evaluationMetrics={data.evaluationMetrics}
        evaluationAccess={data.evaluationAccess}
        latestLoadedSession={data.dataQuality.latestLoadedSession}
        pendingTruncated={data.dataQuality.pendingEvaluationsTruncated}
        sessionsUnavailable={data.sessionLoadStatus === "failed"}
        sessionsPartial={data.sessionLoadStatus === "partial"}
        sessionsTruncated={data.dataQuality.sessionsTruncated}
        sessionMetrics={data.sessionMetrics}
        decidedTruncated={data.dataQuality.decidedEvaluationsTruncated}
      />

      {/* Activity + Sessions — two columns */}
      {data.sessionLoadStatus === "partial" && (
        <div
          className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3"
          data-testid="partial-sessions-warning"
          role="status"
        >
          <p className="text-xs font-medium text-amber-200">
            Alguns registros de sessões não puderam ser carregados.
          </p>
          <p className="mt-0.5 text-xs text-amber-200/60">
            Os valores exibidos representam apenas os registros recuperados.
          </p>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <ReportSectionShell title="Atividade por cão">
          {data.sessionLoadStatus === "failed" ? (
            <ReportSectionError
              description="Tente novamente para consultar a atividade do período selecionado."
              hasStaleData={data.sessionMetrics.sessionsInPeriod > 0}
              onRetry={data.retrySessions}
              staleDescription="Os dados exibidos podem não refletir o filtro mais recente."
              title="Não foi possível carregar as sessões"
            />
          ) : (
            <ReportDogActivity
              activity={data.activitySummary.dogsWithProgress}
              sessionMetrics={data.sessionMetrics}
              trainingDogs={trainingK9.dogs.map((d) => ({
                dogId: d.dogId,
                dogName: d.dogName,
                photoUrl: d.photoUrl,
              }))}
            />
          )}
        </ReportSectionShell>
        <ReportSectionShell title="Sessões no período">
          {data.sessionLoadStatus === "failed" ? (
            <ReportSectionError
              description="Tente novamente para consultar os registros de sessões."
              hasStaleData={data.sessionMetrics.sessionsInPeriod > 0}
              onRetry={data.retrySessions}
              staleDescription="Os valores exibidos podem corresponder a um filtro anterior."
              title="Não foi possível carregar os registros de sessões"
            />
          ) : (
            <ReportSessionSummary
              dogNameById={Object.fromEntries(
                trainingK9.dogs.map((d) => [d.dogId, d.dogName]),
              )}
              durationMetrics={data.durationMetrics}
              isRefreshing={data.loadingState.sessions}
              sessionMetrics={data.sessionMetrics}
              sessionsPartiallyLoaded={data.sessionLoadStatus === "partial"}
              sessionsTruncated={data.dataQuality.sessionsTruncated}
            />
          )}
        </ReportSectionShell>
      </div>
    </div>
  );
}

// ─── Public export ─────────────────────────────────────────────────────────────

export function ReportsTab() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-white">
              Relatórios de Treinamento
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Acompanhe atividade, evolução técnica e avaliações dos cães em
              formação.
            </p>
          </div>
          <ReportFiltersSkeleton />
          <ReportKpisSkeleton />
        </div>
      }
    >
      <ReportsTabInner />
    </Suspense>
  );
}
