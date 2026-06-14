"use client";

import Link from "next/link";
import { ChevronRight, Flag, Info, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/form/form-primitives";
import { canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import type { CurriculumModule } from "@/features/training-curriculums/hooks/use-training-curriculums";
import type {
  TrainingDogSummary,
  TrainingMatrixCell,
  TrainingSessionSummary,
  TrainingTone,
} from "@/features/training/hooks/use-training-data";
import { formatDateShort } from "@/lib/format";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

import type { CritérionStatus, ModalityView } from "./training-matrix-types";
import { toneClasses } from "./training-matrix-constants";
import { CritérionCard, ReadinessSummary } from "./training-matrix-criteria";
import { EmptyState, ProgressBar } from "./training-matrix-primitives";
import { countEventsMatched, hasRealValue } from "./training-matrix-utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

function isPositiveResult(result: unknown): boolean {
  const value = String(result ?? "").toLowerCase();
  return value === "sucesso" || value === "aprovado" || value === "positivo";
}

// ─── PendingItem ────────────────────────────────────────────────────────────

function PendingItem({
  detail,
  icon: Icon,
  label,
  tone,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: TrainingTone;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border p-4",
        toneClasses[tone],
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-0.5 text-xs text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

// ─── HistoryChart ───────────────────────────────────────────────────────────

export function HistoryChart({
  sessions,
}: {
  sessions: TrainingSessionSummary[];
}) {
  const recent = [...sessions]
    .filter((session) => session.date)
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))
    .slice(-6);
  const points = recent.map((session, index) => {
    const cumulative = recent
      .slice(0, index + 1)
      .filter((item) => isPositiveResult(item.result)).length;
    const value = ((cumulative / (index + 1)) || 0) * 100;
    const x = recent.length === 1 ? 50 : (index / (recent.length - 1)) * 100;
    const y = 100 - value;
    return { date: session.date, value, x, y };
  });
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <Panel
      action={<Badge tone="slate">últimas {recent.length || 0}</Badge>}
      title="Histórico de progresso do módulo"
    >
      {recent.length ? (
        <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
          <svg
            className="h-44 w-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <line
              stroke="rgba(34,211,238,0.22)"
              strokeDasharray="4 4"
              strokeWidth="0.8"
              x1="0"
              x2="100"
              y1="20"
              y2="20"
            />
            <polyline
              fill="none"
              points={path}
              stroke="rgb(34,211,238)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.6"
            />
            {points.map((point, index) => (
              <circle
                cx={point.x}
                cy={point.y}
                fill="#081320"
                key={`${point.x}-${index}`}
                r="2.4"
                stroke="rgb(34,211,238)"
                strokeWidth="1.5"
              />
            ))}
          </svg>
          <div className="mt-3 flex justify-between text-xs text-slate-500">
            {points.map((point, index) => (
              <span key={`${point.x}-${index}`}>{formatDateShort(point.date)}</span>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState label="O histórico aparecerá após as primeiras sessões registradas." />
      )}
    </Panel>
  );
}

// ─── MatrixGrid ─────────────────────────────────────────────────────────────

export function MatrixGrid({
  canEditCurriculums,
  cell,
  criteria,
  currentModule,
  program,
  ready,
  score,
  selectedDog,
  selectedModality,
  sessions,
}: {
  canEditCurriculums: boolean;
  cell: TrainingMatrixCell;
  criteria: CritérionStatus[];
  currentModule: CurriculumModule | null;
  program: { label: string } | null;
  ready: boolean;
  score: number;
  selectedDog: TrainingDogSummary | undefined;
  selectedModality: ModalityView;
  sessions: TrainingSessionSummary[];
}) {
  const pending = criteria.filter((item) => !item.ok);
  const eventCoverage = currentModule
    ? countEventsMatched(sessions, currentModule.criteria.requiredEvents)
    : 0;
  const eventsOk =
    !currentModule ||
    !currentModule.criteria.requiredEvents.length ||
    eventCoverage >= currentModule.criteria.requiredEvents.length;

  return (
    <div className="grid gap-5 2xl:grid-cols-[1.25fr_0.65fr]">
      <div className="space-y-5">
        <Panel
          action={
            ready ? (
              <Badge tone="green">apto a evoluir</Badge>
            ) : (
              <Badge tone="red">ainda não apto</Badge>
            )
          }
          subtitle={`${currentModule?.title ?? "Sem módulo atual"} · ${cell.statusLabel}`}
          title={`${selectedDog?.dogName ?? "K9"} · ${
            program?.label ?? canônicalModalityLabel(selectedModality.value)
          }`}
        >
          {currentModule ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {criteria
                .filter((c) => hasRealValue(c.current))
                .map((criterion) => (
                  <CritérionCard
                    criterion={criterion}
                    key={criterion.label}
                  />
                ))}
            </div>
          ) : (
            <EmptyState label="Cadastre um currículo para calcular a prontidão desta modalidade." />
          )}
        </Panel>

        <Panel title="Pendências para evolução">
          {currentModule ? (
            <div className="grid gap-3 md:grid-cols-2">
              {pending.map((item) => (
                <PendingItem
                  detail={`${item.current} de ${item.target}`}
                  icon={item.icon}
                  key={item.label}
                  label={item.missingLabel}
                  tone={item.tone === "emerald" ? "amber" : item.tone}
                />
              ))}
              {!eventsOk ? (
                <PendingItem
                  detail={`${eventCoverage} de ${currentModule.criteria.requiredEvents.length} eventos esperados`}
                  icon={Flag}
                  label="eventos obrigatórios pendentes"
                  tone="blue"
                />
              ) : null}
              {cell.pendingPromotions > 0 ? (
                <PendingItem
                  detail="solicitação aguardando decisão"
                  icon={UserCheck}
                  label="validação do Instrutor K9"
                  tone="amber"
                />
              ) : null}
              {!pending.length && eventsOk && cell.pendingPromotions === 0 ? (
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] p-4 text-emerald-200 md:col-span-2">
                  Todos os critérios calculados foram atendidos.
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState label="Cadastre critérios no currículo para gerar as pendências de evolução." />
          )}
        </Panel>

        <Panel
          action={
            <Link
              className="text-sm font-semibold text-cyan-200"
              href={paths.trainingCurriculums}
            >
              {canEditCurriculums ? "editar critérios" : "ver critérios"}
            </Link>
          }
          title="Critérios avaliados recentemente"
        >
          {currentModule ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Critério</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Meta mínima</th>
                    <th className="px-3 py-2">Resultado</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Última avaliação</th>
                  </tr>
                </thead>
                <tbody>
                  {currentModule.milestones.map((milestone) => {
                    const achieved =
                      cell.achievedMilestonesCount >= milestone.order;
                    return (
                      <tr key={milestone.id}>
                        <td className="rounded-l-2xl border-y border-l border-white/10 bg-white/[0.035] px-3 py-3 font-semibold text-white">
                          {milestone.title}
                        </td>
                        <td className="border-y border-white/10 bg-white/[0.035] px-3 py-3 text-slate-300">
                          Marco {milestone.required ? "obrigatório" : "bonus"}
                        </td>
                        <td className="border-y border-white/10 bg-white/[0.035] px-3 py-3 text-slate-300">
                          Concluido
                        </td>
                        <td className="border-y border-white/10 bg-white/[0.035] px-3 py-3 text-slate-300">
                          {achieved ? "Concluido" : "Pendente"}
                        </td>
                        <td className="border-y border-white/10 bg-white/[0.035] px-3 py-3">
                          <Badge tone={achieved ? "green" : "yellow"}>
                            {achieved ? "concluido" : "em andamento"}
                          </Badge>
                        </td>
                        <td className="rounded-r-2xl border-y border-r border-white/10 bg-white/[0.035] px-3 py-3 font-mono text-slate-400">
                          {formatDateShort(cell.lastSessionAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="Sem critérios para listar." />
          )}
        </Panel>
      </div>

      <div className="space-y-5">
        <ReadinessSummary isReady={ready} score={score} />
        <HistoryChart sessions={sessions} />
        <Panel title="Sobre a prontidão">
          <div className="flex gap-3 text-sm leading-6 text-slate-400">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
            <p>
              A evolução depende do atendimento aos critérios mínimos do
              módulo vigente: marcos obrigatórios, sessões completas, sucesso,
              distância, eventos esperados e avaliação do Instrutor K9.
            </p>
          </div>
          <Link
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
            href={paths.training}
          >
            Ver painel de treinamentos <ChevronRight className="h-4 w-4" />
          </Link>
        </Panel>
      </div>
    </div>
  );
}
