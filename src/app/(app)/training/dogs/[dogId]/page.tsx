"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowLeft, CheckCircle2, Clock, Lock, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { paths } from "@/lib/routes/paths";
import { canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { usePromotionRequests } from "@/features/training/hooks/use-promotion-requests";
import { useTrainingK9Data } from "@/features/training-k9/hooks/use-training-k9-data";

import {
  TrainingK9Empty,
  TrainingK9Error,
  TrainingK9Skeleton,
} from "@/features/training-k9/components/training-k9-shell";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

function friendlyModality(raw: string): string {
  return canônicalModalityLabel(raw);
}

function friendlyModuleName(raw: string | null, program: { modules: Array<{ id: string; title: string }> } | null): string {
  if (!raw) return "Módulo não identificado";
  if (program) {
    const match = program.modules.find((m) => m.id === raw || m.title === raw);
    if (match) return match.title;
  }
  const num = Number(raw.replace(/\D/g, ""));
  if (Number.isFinite(num) && num > 0) return `Módulo ${num}`;
  if (raw.includes("_")) {
    return raw
      .replaceAll("_", " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return raw;
}

function timeAgoLabel(date: Date | null): string {
  if (!date) return "";
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type JourneyModuleStatus =
  | "completed"
  | "current"
  | "awaiting_evaluation"
  | "locked";

interface JourneyModule {
  id: string;
  milestoneCount: number;
  milestonesAchieved: number;
  order: number;
  status: JourneyModuleStatus;
  title: string;
}

// ─── Journey Component ────────────────────────────────────────────────────────

const journeyStyles: Record<JourneyModuleStatus, { border: string; bg: string; icon: typeof CheckCircle2; iconColor: string }> = {
  completed: { bg: "bg-emerald-400/10", border: "border-emerald-400/30", icon: CheckCircle2, iconColor: "text-emerald-400" },
  current: { bg: "bg-cyan-300/10", border: "border-cyan-300/30", icon: Clock, iconColor: "text-cyan-300" },
  awaiting_evaluation: { bg: "bg-amber-400/10", border: "border-amber-400/30", icon: AlertTriangle, iconColor: "text-amber-300" },
  locked: { bg: "bg-slate-800/50", border: "border-slate-600/20", icon: Lock, iconColor: "text-slate-500" },
};

const journeyStatusLabels: Record<JourneyModuleStatus, string> = {
  completed: "Concluído",
  current: "Em andamento",
  awaiting_evaluation: "Aguardando avaliação",
  locked: "Bloqueado",
};

function ModuleJourney({ modules }: { modules: JourneyModule[] }) {
  return (
    <div className="space-y-3">
      {modules.map((mod, idx) => {
        const style = journeyStyles[mod.status];
        const Icon = style.icon;
        const isLast = idx === modules.length - 1;

        return (
          <div key={mod.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                  style.border,
                  style.bg,
                )}
              >
                <Icon className={cn("h-4 w-4", style.iconColor)} />
              </div>
              {!isLast ? (
                <div className="my-1 w-px flex-1 bg-slate-700/50" />
              ) : null}
            </div>

            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">{mod.title}</p>
                {mod.status === "current" ? (
                  <Badge tone="cyan" className="text-[9px]">Em andamento</Badge>
                ) : mod.status === "awaiting_evaluation" ? (
                  <Badge tone="yellow" className="text-[9px]">Aguardando avaliação</Badge>
                ) : mod.status === "completed" ? (
                  <Badge tone="green" className="text-[9px]">Concluído</Badge>
                ) : null}
              </div>
              {mod.status !== "locked" ? (
                <p className="mt-1 text-xs text-slate-400">
                  {mod.milestonesAchieved} de {mod.milestoneCount} marcos concluídos
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  {journeyStatusLabels.locked}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Current Module Panel ─────────────────────────────────────────────────────

function CurrentModulePanel({
  moduleName,
  modulePosition,
  milestonesAchieved,
  milestoneCount,
  pendingEvaluations,
}: {
  milestoneCount: number;
  milestonesAchieved: number;
  moduleName: string;
  modulePosition: number;
  pendingEvaluations: number;
}) {
  const hasTotal = milestoneCount > 0;
  const nextStep =
    pendingEvaluations > 0
      ? "Avaliação do instrutor"
      : hasTotal && milestonesAchieved >= milestoneCount
        ? "Solicitar evolução"
        : "Continuar treinamento";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-base font-bold text-white">
          {moduleName}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Posição {modulePosition} na matriz
        </p>
      </div>

      <div className="space-y-2">
        {hasTotal ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Marcos concluídos</span>
              <span className="font-mono text-sm font-bold text-white">
                {milestonesAchieved} / {milestoneCount}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 shadow-[0_0_12px_rgba(77,208,225,0.4)] transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((milestonesAchieved / milestoneCount) * 100))}%` }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-400">Marcos concluídos</span>
            <span className="font-mono text-sm font-bold text-white">
              {milestonesAchieved}
            </span>
          </div>
        )}

        {pendingEvaluations > 0 ? (
          <p className="text-xs font-semibold text-amber-300">
            {pluralize(pendingEvaluations, "avaliação aguardando análise", "avaliações aguardando análise")}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.03] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Próximo passo
        </p>
        <p className="mt-1 text-sm text-slate-300">
          {nextStep}
        </p>
      </div>
    </div>
  );
}

// ─── No Matrix State ──────────────────────────────────────────────────────────

function NoMatrixState({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-400/10 bg-slate-900/30 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-600/30 bg-slate-800/60">
        <Lock className="h-5 w-5 text-slate-500" />
      </div>
      <div>
        <p className="text-sm font-bold text-white">
          Nenhuma matriz de treinamento atribuída
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Vincule o K9 a uma matriz para iniciar o acompanhamento da evolução.
        </p>
      </div>
      {canEdit ? (
        <Link
          className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-200 transition hover:bg-cyan-300/20"
          href={paths.trainingMatrices}
        >
          Atribuir matriz
        </Link>
      ) : null}
    </div>
  );
}

// ─── Evaluation History ───────────────────────────────────────────────────────

interface HistoryItem {
  createdAt: Date | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  handlerName: string | null;
  id: string;
  modalityLabel: string;
  moduleLabel: string | null;
  nextModuleLabel: string | null;
  status: string;
}

function EvaluationHistory({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Nenhuma avaliação registrada para este K9.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.slice(0, 10).map((item) => (
        <div
          className="rounded-xl border border-cyan-200/8 bg-slate-900/40 px-4 py-3"
          key={item.id}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                {item.modalityLabel}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                {item.moduleLabel && item.nextModuleLabel ? (
                  <span>{item.moduleLabel} → {item.nextModuleLabel}</span>
                ) : item.moduleLabel ? (
                  <span>{item.moduleLabel}</span>
                ) : null}
                {item.handlerName ? (
                  <span>· {item.handlerName}</span>
                ) : null}
              </div>
              {item.decisionReason ? (
                <p className="mt-1 truncate text-xs text-slate-500">
                  {item.decisionReason}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Badge
                tone={
                  item.status === "approved"
                    ? "green"
                    : item.status === "rejected"
                      ? "red"
                      : "yellow"
                }
                className="text-[10px]"
              >
                {item.status === "approved"
                  ? "Aprovado"
                  : item.status === "rejected"
                    ? "Rejeitado"
                    : "Pendente"}
              </Badge>
              {item.createdAt ? (
                <span className="text-[10px] text-slate-500">
                  {timeAgoLabel(item.createdAt)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DogTrainingDetailPage() {
  const params = useParams<{ dogId: string }>();
  const dogId = params.dogId;

  const data = useTrainingK9Data();
  const { can } = useAccessControl();
  const { requests, loading: requestsLoading } = usePromotionRequests();

  const canEdit = can("training", "edit") || can("training_matrix", "edit");

  const dog = useMemo(
    () => data.dogs.find((d) => d.dogId === dogId),
    [data.dogs, dogId],
  );

  const primaryCell = useMemo(() => {
    if (!dog) return null;
    return dog.cells.find((c) => c.status !== "not_started") ?? null;
  }, [dog]);

  const program = useMemo(() => {
    if (!primaryCell) return null;
    return data.programs.find((p) => p.modality === primaryCell.modality) ?? null;
  }, [data.programs, primaryCell]);

  const hasMatrix = primaryCell !== null;

  const dogRequests = useMemo(
    () => requests.filter((r) => r.dog_id === dogId),
    [dogId, requests],
  );

  const journey = useMemo((): JourneyModule[] => {
    if (!program || !primaryCell) return [];

    const completedCount = primaryCell.completedModules;
    const sortedModules = [...program.modules].sort((a, b) => a.order - b.order);

    // Filter promotions relevant to this specific modality and pending status
    const relevantPendingPromotions = dogRequests.filter(
      (r) =>
        r.status === "pending" &&
        (r.modality === primaryCell.modality ||
          r.modality === program.modality),
    );

    return sortedModules.map((mod, idx): JourneyModule => {
      let status: JourneyModuleStatus = "locked";

      if (idx < completedCount) {
        status = "completed";
      } else if (idx === completedCount) {
        // Check if there's a pending promotion specifically for this module
        const hasPendingForModule = relevantPendingPromotions.some(
          (r) =>
            r.current_module_id === mod.id ||
            r.current_module_name === mod.title ||
            (r.current_module_id === null && r.current_module_name === null),
        );
        status = hasPendingForModule ? "awaiting_evaluation" : "current";
      }

      return {
        id: mod.id,
        milestoneCount: mod.milestoneCount,
        milestonesAchieved:
          status === "completed"
            ? mod.milestoneCount
            : status === "current" || status === "awaiting_evaluation"
              ? primaryCell.achievedMilestonesCount
              : 0,
        order: mod.order,
        status,
        title: mod.title,
      };
    });
  }, [dogRequests, primaryCell, program]);

  const currentModule = useMemo(() => {
    return journey.find((m) => m.status === "current" || m.status === "awaiting_evaluation") ?? null;
  }, [journey]);

  const historyItems = useMemo((): HistoryItem[] => {
    return dogRequests.map((r): HistoryItem => ({
      createdAt: r.created_at,
      decidedAt: r.decided_at,
      decisionReason: r.decision_reason ?? r.rejection_reason ?? null,
      handlerName: r.handler_name || null,
      id: r.id,
      modalityLabel: friendlyModality(r.modality),
      moduleLabel: r.current_module_name
        ? friendlyModuleName(r.current_module_name, program)
        : null,
      nextModuleLabel: r.next_module_name
        ? friendlyModuleName(r.next_module_name, program)
        : null,
      status: r.status,
    }));
  }, [dogRequests, program]);

  if (data.loading) {
    return <TrainingK9Skeleton />;
  }

  if (data.errors.length > 0) {
    return <TrainingK9Error errors={data.errors} />;
  }

  if (!dog) {
    return (
      <TrainingK9Empty
        title="K9 não encontrado"
        description="O cão solicitado não foi localizado nos registros de treinamento."
      />
    );
  }

  const statusBadgeTone = dog.operationalCount > 0
    ? "green" as const
    : dog.inFormationCount > 0
      ? "cyan" as const
      : dog.pendingPromotions > 0
        ? "yellow" as const
        : "slate" as const;

  const statusBadgeLabel = dog.operationalCount > 0
    ? "Operacional"
    : dog.inFormationCount > 0
      ? "Em formação"
      : dog.pendingPromotions > 0
        ? "Aguardando avaliação"
        : hasMatrix
          ? "Treinamento iniciado"
          : "Sem matriz atribuída";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-cyan-300"
        href={`${paths.training}?tab=dogs`}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Cães em Treinamento
      </Link>

      {/* Dog header */}
      <div className="rounded-2xl border border-cyan-200/10 bg-slate-950/60 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">{dog.dogName}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {hasMatrix
                ? `${program?.label ?? friendlyModality(primaryCell!.modality)}${currentModule ? ` · ${currentModule.title}` : ""}`
                : "Sem matriz atribuída"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dog.pendingPromotions > 0 ? (
              <Badge tone="yellow">
                {pluralize(dog.pendingPromotions, "avaliação pendente", "avaliações pendentes")}
              </Badge>
            ) : null}
            <Badge tone={statusBadgeTone}>
              {statusBadgeLabel}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content — depends on whether a matrix is assigned */}
      {hasMatrix ? (
        <>
          {/* Content grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Journey */}
            <section className="rounded-[1.75rem] border border-cyan-200/10 bg-slate-950/60 p-5">
              <h2 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                Jornada de Módulos
              </h2>
              {journey.length > 0 ? (
                <ModuleJourney modules={journey} />
              ) : (
                <TrainingK9Empty
                  title="Módulos não configurados"
                  description="A matriz atribuída ainda não possui módulos definidos."
                />
              )}
            </section>

            {/* Current module details */}
            <section className="rounded-[1.75rem] border border-cyan-200/10 bg-slate-950/60 p-5">
              <h2 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                Módulo Atual
              </h2>
              {currentModule ? (
                <CurrentModulePanel
                  milestoneCount={currentModule.milestoneCount}
                  milestonesAchieved={currentModule.milestonesAchieved}
                  moduleName={currentModule.title}
                  modulePosition={journey.indexOf(currentModule) + 1}
                  pendingEvaluations={dog.pendingPromotions}
                />
              ) : (
                <TrainingK9Empty
                  title="Nenhum módulo ativo"
                  description="Todos os módulos foram concluídos ou a jornada ainda não foi iniciada."
                />
              )}
            </section>
          </div>

          {/* Evaluation history */}
          <section className="rounded-[1.75rem] border border-cyan-200/10 bg-slate-950/60 p-5">
            <h2 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
              Histórico de Evoluções
            </h2>
            {requestsLoading ? (
              <div className="h-20 animate-pulse rounded-xl bg-slate-900/50" />
            ) : (
              <EvaluationHistory items={historyItems} />
            )}
          </section>
        </>
      ) : (
        <>
          <NoMatrixState canEdit={canEdit} />

          {/* Show history below even without matrix, if any records exist */}
          {!requestsLoading && historyItems.length > 0 ? (
            <section className="rounded-[1.75rem] border border-cyan-200/10 bg-slate-950/60 p-5">
              <h2 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                Histórico de Evoluções
              </h2>
              <EvaluationHistory items={historyItems} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
