"use client";

import { useMemo } from "react";
import { Activity, Award, Dog, GitBranch } from "lucide-react";

import { cn } from "@/lib/utils";

import type {
  CurrentStateMetrics,
  SessionMetrics,
  EvaluationMetrics,
  EvaluationAccessState,
} from "../../types/training-reports";

// ─── Duration formatter ─────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "Sem dados suficientes";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

const toneClasses = {
  cyan: "from-cyan-300/20 text-cyan-200 shadow-cyan-500/10",
  green: "from-emerald-400/20 text-emerald-300 shadow-emerald-500/10",
  yellow: "from-amber-300/20 text-amber-200 shadow-amber-500/10",
  red: "from-red-400/20 text-red-300 shadow-red-500/10",
  slate: "from-slate-400/15 text-slate-300 shadow-slate-500/10",
};

type KpiTone = keyof typeof toneClasses;

interface KpiCardProps {
  accent?: KpiTone;
  className?: string;
  description: string;
  icon: typeof Dog;
  label: string;
  sub?: string;
  truncated?: boolean;
  value: number | string;
}

function KpiCard({
  accent = "cyan",
  className,
  description,
  icon: Icon,
  label,
  sub,
  truncated,
  value,
}: KpiCardProps) {
  const accessibleLabel = truncated
    ? `${label}: pelo menos ${value}`
    : `${label}: ${value}`;

  return (
    <article
      aria-label={accessibleLabel}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-cyan-300/10",
        "bg-slate-950/55 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]",
        "backdrop-blur-xl transition duration-300",
        "hover:-translate-y-0.5 hover:border-cyan-300/25",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent opacity-80",
          toneClasses[accent],
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <p className="font-mono text-3xl font-black text-white">
              {truncated ? (
                <>
                  <span aria-hidden="true">≥</span>
                  {value}
                </>
              ) : (
                value
              )}
            </p>
          </div>
          {truncated ? (
            <p
              className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-300/80"
              data-testid="truncation-caption"
            >
              Pelo menos {value}
            </p>
          ) : null}
          {sub ? (
            <p className="mt-1 text-xs text-slate-400">{sub}</p>
          ) : null}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/5 shadow-lg">
          <Icon className="h-4 w-4 text-cyan-300" />
        </div>
      </div>
      <p className="relative mt-3 text-xs leading-5 text-slate-400">
        {description}
      </p>
    </article>
  );
}

// ─── Secondary Indicators ───────────────────────────────────────────────────────

interface SecondaryIndicatorsProps {
  currentState: CurrentStateMetrics;
  evaluationMetrics: EvaluationMetrics;
  pendingTruncated: boolean;
}

function SecondaryIndicators({
  currentState,
  evaluationMetrics,
  pendingTruncated,
}: SecondaryIndicatorsProps) {
  const items = useMemo(() => {
    const result: Array<{ label: string; value: string; tone: KpiTone }> = [];

    // Pending evaluations
    const pending = evaluationMetrics.pendingCount;
    if (pending > 0) {
      result.push({
        label: "Pendente(s)",
        value: pendingTruncated ? `Pelo menos ${pending}` : String(pending),
        tone: "yellow",
      });
    }

    // Avg decision time
    const avg = evaluationMetrics.averageDecisionTimeSeconds;
    if (avg !== null && avg > 0) {
      result.push({
        label: "Tempo médio para decisão",
        value: formatDuration(avg),
        tone: "slate",
      });
    }

    // Dogs technically trained
    if (currentState.dogsTechnicallyTrained > 0) {
      result.push({
        label: "Técnicos",
        value: String(currentState.dogsTechnicallyTrained),
        tone: "green",
      });
    }

    // Modalities concluded
    if (currentState.modalitiesConcluded > 0) {
      result.push({
        label: "Concluídas",
        value: String(currentState.modalitiesConcluded),
        tone: "green",
      });
    }

    return result;
  }, [currentState, evaluationMetrics, pendingTruncated]);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2",
            "bg-slate-900/30 text-xs",
            item.tone === "yellow"
              ? "border-amber-300/20 text-amber-200"
              : item.tone === "green"
                ? "border-emerald-400/20 text-emerald-300"
                : "border-slate-400/20 text-slate-300",
          )}
          key={item.label}
        >
          <span className="font-mono font-bold text-white">{item.value}</span>
          <span className="text-slate-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Loaded Period Label ───────────────────────────────────────────────────────

interface LoadedPeriodLabelProps {
  earliestLoadedSession: Date | null;
  latestLoadedSession: Date | null;
  sessionsTruncated: boolean;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function LoadedPeriodLabel({
  earliestLoadedSession,
  latestLoadedSession,
  sessionsTruncated,
}: LoadedPeriodLabelProps) {
  if (!earliestLoadedSession && !latestLoadedSession) return null;

  return (
    <p className="text-[10px] text-slate-600">
      {sessionsTruncated ? (
        <>Período conhecido nos registros carregados</>
      ) : (
        <>
          Período carregado: {formatDate(earliestLoadedSession)} a{" "}
          {formatDate(latestLoadedSession)}
        </>
      )}
    </p>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

export function ReportKpisSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          className="h-36 animate-pulse rounded-2xl border border-cyan-300/5 bg-slate-900/40"
          key={i}
        />
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

interface ReportKpisProps {
  currentState?: CurrentStateMetrics;
  sessionMetrics?: SessionMetrics;
  evaluationMetrics?: EvaluationMetrics;
  sessionsTruncated?: boolean;
  pendingTruncated?: boolean;
  decidedTruncated?: boolean;
  earliestLoadedSession?: Date | null;
  latestLoadedSession?: Date | null;
  /** When true, sessions query failed — show "Indisponível" instead of 0. */
  sessionsUnavailable?: boolean;
  /** When true, sessions loaded partially — do not assert 0 as confident. */
  sessionsPartial?: boolean;
  /** @deprecated Use evaluationAccess instead. */
  evaluationsUnavailable?: boolean;
  /**
   * Evaluation access state:
   * - "allowed": show metrics normally.
   * - "restricted": show "Acesso restrito" (no permission, not an error).
   * - "error": show "Indisponível" (query failed).
   */
  evaluationAccess?: EvaluationAccessState;
  /** Show skeleton cards instead of real values. */
  loading?: boolean;
}

export function ReportKpis({
  currentState,
  sessionMetrics,
  evaluationMetrics,
  sessionsTruncated,
  pendingTruncated,
  decidedTruncated,
  earliestLoadedSession,
  latestLoadedSession,
  sessionsUnavailable = false,
  sessionsPartial = false,
  evaluationsUnavailable = false,
  evaluationAccess,
  loading = false,
}: ReportKpisProps) {
  if (loading) return <ReportKpisSkeleton />;

  // Resolve evaluation state: new prop takes precedence over deprecated boolean
  const evalState: EvaluationAccessState = evaluationAccess
    ?? (evaluationsUnavailable ? "error" : "allowed");
  const evalIsUnavailable = evalState !== "allowed";

  // Use empty objects with defaults for safe access
  const cs = currentState ?? {
    dogsInFormation: 0,
    formationsInProgress: 0,
    dogsTechnicallyTrained: 0,
    modalitiesConcluded: 0,
    pendingRequests: 0,
    activePrograms: 0,
    totalModules: 0,
  };
  const sm = sessionMetrics ?? {
    sessionsInPeriod: 0,
    distinctDogsTrained: 0,
    distinctTrainingDays: 0,
  };
  const em = evaluationMetrics ?? {
    pendingCount: 0,
    approvedInPeriod: 0,
    rejectedInPeriod: 0,
    decidedInPeriod: 0,
    averageDecisionTimeSeconds: null,
    medianDecisionTimeSeconds: null,
    oldestPendingAgeSeconds: null,
    invalidDateCount: 0,
    unsupportedDecidedStatusCount: 0,
  };

  // Session sub-description
  const sessionSub = (() => {
    const parts: string[] = [];
    if (sm.distinctDogsTrained > 0) {
      parts.push(
        `${sm.distinctDogsTrained} ${
          sm.distinctDogsTrained === 1 ? "cão" : "cães"
        } treinado${sm.distinctDogsTrained === 1 ? "" : "s"}`,
      );
    }
    if (sm.distinctTrainingDays > 0) {
      parts.push(
        `${sm.distinctTrainingDays} ${
          sm.distinctTrainingDays === 1 ? "dia" : "dias"
        } de atividade`,
      );
    }
    return parts.join(" · ");
  })();

  // Evaluation sub-description
  const evalSub = (() => {
    const parts: string[] = [];
    if (em.approvedInPeriod > 0) {
      parts.push(`${em.approvedInPeriod} aprovadas`);
    }
    if (em.rejectedInPeriod > 0) {
      parts.push(`${em.rejectedInPeriod} rejeitadas`);
    }
    return parts.join(" · ");
  })();

  return (
    <div className="space-y-4">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Dogs in formation */}
        <KpiCard
          accent="cyan"
          description="Cães distintos com formação técnica em andamento."
          icon={Dog}
          label="Cães em formação"
          value={cs.dogsInFormation}
        />

        {/* Formations in progress */}
        <KpiCard
          accent="cyan"
          description="Modalidades de formação atualmente em andamento."
          icon={GitBranch}
          label="Formações em progresso"
          sub={
            cs.dogsInFormation > 0 &&
            cs.formationsInProgress > cs.dogsInFormation
              ? `${cs.formationsInProgress} modalidades em ${cs.dogsInFormation} ${cs.dogsInFormation === 1 ? "cão" : "cães"}`
              : undefined
          }
          value={cs.formationsInProgress}
        />

        {/* Sessions in period */}
        <KpiCard
          accent={sessionsUnavailable ? "red" : sessionsPartial && sm.sessionsInPeriod === 0 ? "yellow" : "slate"}
          description={
            sessionsUnavailable
              ? "Não foi possível carregar os registros de sessões."
              : sessionsPartial && sm.sessionsInPeriod === 0
                ? "Nenhuma sessão foi recuperada entre as consultas concluídas."
                : "Registros encontrados no período selecionado."
          }
          icon={Activity}
          label="Sessões no período"
          sub={
            sessionsUnavailable
              ? "Indisponível"
              : sessionsPartial && sm.sessionsInPeriod === 0
                ? "Dados parciais"
                : sessionsPartial
                  ? `Pelo menos ${sm.sessionsInPeriod}`
                  : (sessionSub || undefined)
          }
          truncated={!sessionsUnavailable && !sessionsPartial && sessionsTruncated}
          value={
            sessionsUnavailable
              ? "—"
              : sessionsPartial && sm.sessionsInPeriod === 0
                ? "—"
                : sessionsPartial
                  ? `≥${sm.sessionsInPeriod}`
                  : sm.sessionsInPeriod
          }
        />

        {/* Evaluations decided */}
        <KpiCard
          accent={
            evalIsUnavailable
              ? evalState === "restricted" ? "slate" : "red"
              : em.decidedInPeriod === 0
                ? "slate"
                : em.rejectedInPeriod > em.approvedInPeriod
                  ? "yellow"
                  : "cyan"
          }
          description={
            evalState === "restricted"
              ? "Seu perfil não possui permissão para consultar avaliações."
              : evalState === "error"
                ? "Não foi possível carregar as decisões."
                : "Decisões registradas no período selecionado."
          }
          icon={Award}
          label="Avaliações decididas"
          sub={
            evalState === "restricted"
              ? "Acesso restrito"
              : evalState === "error"
                ? "Indisponível"
                : (evalSub || undefined)
          }
          truncated={!evalIsUnavailable && decidedTruncated}
          value={evalIsUnavailable ? "—" : em.decidedInPeriod}
        />
      </div>

      {/* Secondary indicators */}
      <SecondaryIndicators
        currentState={cs}
        evaluationMetrics={em}
        pendingTruncated={pendingTruncated ?? false}
      />

      {/* Loaded period info */}
      <LoadedPeriodLabel
        earliestLoadedSession={earliestLoadedSession ?? null}
        latestLoadedSession={latestLoadedSession ?? null}
        sessionsTruncated={sessionsTruncated ?? false}
      />
    </div>
  );
}
