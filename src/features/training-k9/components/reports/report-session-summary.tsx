"use client";

import { ReportRankedBars } from "./report-ranked-bars";
import { canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import type {
  DurationMetrics,
  SessionMetrics,
} from "../../types/training-reports";

interface ReportSessionSummaryProps {
  sessionMetrics: SessionMetrics;
  durationMetrics: DurationMetrics;
  sessionsTruncated: boolean;
  /** Map dogId → friendly name for the ranking. */
  dogNameById: Record<string, string>;
  /** True while session data is being refreshed (but previous data may exist). */
  isRefreshing?: boolean;
  /** True when this is the first load with no data at all. */
  isInitialLoading?: boolean;
  /** True when some session queries failed — prevents showing empty state as confirmed. */
  sessionsPartiallyLoaded?: boolean;
}

function SummaryStrip({
  sessionsInPeriod,
  distinctDogsTrained,
  distinctTrainingDays,
  distinctModalitiesTrained,
  isRefreshing,
}: {
  sessionsInPeriod: number;
  distinctDogsTrained: number;
  distinctTrainingDays: number;
  distinctModalitiesTrained: number;
  isRefreshing: boolean;
}) {
  const items = [
    {
      label: "Registros",
      value: sessionsInPeriod,
      suffix: sessionsInPeriod === 1 ? "sessão" : "sessões",
    },
    {
      label: "Cães",
      value: distinctDogsTrained,
      suffix: distinctDogsTrained === 1 ? "treinado" : "treinados",
    },
    {
      label: "Dias",
      value: distinctTrainingDays,
      suffix: distinctTrainingDays === 1 ? "com treino" : "com treino",
    },
    {
      label: "Modalidades",
      value: distinctModalitiesTrained,
      suffix: distinctModalitiesTrained === 1 ? "ativa" : "ativas",
    },
  ];

  return (
    <div
      aria-label="Resumo das sessões no período"
      className="mb-4 flex flex-wrap gap-4"
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          {isRefreshing && (
            <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-cyan-400/40" aria-hidden="true" />
          )}
          <span className="text-base font-black text-white tabular-nums">
            {item.value}
          </span>
          <span className="text-[11px] text-slate-500">
            {item.suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

function SessionSummarySkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="mb-4 flex flex-wrap gap-4">
        {[80, 60, 60, 80].map((w, i) => (
          <div key={i} className="h-5 animate-pulse rounded bg-slate-800" style={{ width: w }} />
        ))}
      </div>
      <div className="space-y-2">
        {[100, 75, 50, 40].map((w, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-slate-800" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function ReportSessionSummary({
  sessionMetrics,
  durationMetrics,
  sessionsTruncated,
  dogNameById,
  isRefreshing = false,
  isInitialLoading = false,
  sessionsPartiallyLoaded = false,
}: ReportSessionSummaryProps) {
  if (isInitialLoading) {
    return <SessionSummarySkeleton />;
  }

  const hasData =
    sessionMetrics.sessionsInPeriod > 0 ||
    sessionMetrics.distinctDogsTrained > 0;

  if (!hasData) {
    if (sessionsPartiallyLoaded) {
      return (
        <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-amber-300/10 bg-slate-900/20 p-4 text-center">
          <p className="text-xs text-amber-200/70">
            Nenhuma sessão recuperada entre os registros carregados.
          </p>
        </div>
      );
    }
    return (
      <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-cyan-300/5 bg-slate-900/20 p-4 text-center">
        <p className="text-xs text-slate-600">
          Nenhuma sessão registrada neste período.
        </p>
      </div>
    );
  }

  // ── Ranked by dog ──────────────────────────────────────────────────────────
  const dogEntries = Object.entries(sessionMetrics.sessionsByDog)
    .map(([dogId, count]) => ({
      key: dogId,
      label: dogNameById[dogId] ?? "Cão não identificado",
      value: count,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));

  // ── Ranked by modality ─────────────────────────────────────────────────────
  const modalityEntries = Object.entries(sessionMetrics.sessionsByModality)
    .map(([mod, count]) => ({
      key: mod,
      label: canônicalModalityLabel(mod),
      value: count,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <SummaryStrip
        sessionsInPeriod={sessionMetrics.sessionsInPeriod}
        distinctDogsTrained={sessionMetrics.distinctDogsTrained}
        distinctTrainingDays={sessionMetrics.distinctTrainingDays}
        distinctModalitiesTrained={sessionMetrics.distinctModalitiesTrained}
        isRefreshing={isRefreshing}
      />

      {/* Distribution by dog */}
      <div>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Por cão
        </h3>
        <ReportRankedBars
          ariaLabel="Distribuição de sessões por cão"
          emptyMessage="Nenhuma sessão por cão."
          items={dogEntries}
          truncated={sessionsTruncated}
        />
      </div>

      {/* Distribution by modality */}
      {modalityEntries.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Por modalidade
          </h3>
          <ReportRankedBars
            ariaLabel="Distribuição de sessões por modalidade"
            emptyMessage="Nenhuma sessão por modalidade."
            items={modalityEntries}
            truncated={sessionsTruncated}
          />
        </div>
      )}

      {/* Duration indicator — only when coverage > 0 */}
      {durationMetrics.durationCoveragePercentage > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
          <p className="text-[11px] text-slate-500">
            Tempo registrado:{" "}
            <span className="font-semibold text-slate-400">
              {formatDuration(durationMetrics.registeredDurationSeconds)}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Duração informada em{" "}
            {durationMetrics.sessionsWithDuration} de{" "}
            {durationMetrics.sessionsWithDuration + durationMetrics.sessionsWithoutDuration}{" "}
            sessões.
          </p>
        </div>
      )}

      {/* Truncation notice */}
      {sessionsTruncated && (
        <p className="text-[11px] text-slate-500">
          Os valores representam pelo menos os registros carregados.
        </p>
      )}
    </div>
  );
}
