"use client";

import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  Dog,
  Flag,
  GraduationCap,
  Info,
  Ruler,
  ShieldCheck,
  Target,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import {
  useTrainingCurriculums,
  type CurriculumProgram,
} from "@/features/training-curriculums/hooks/use-training-curriculums";
import { hasRealValue } from "@/features/training/components/training-matrix-utils";
import {
  useTrainingData,
  type TrainingDogSummary,
  type TrainingMatrixCell,
  type TrainingSessionSummary,
  type TrainingTone,
} from "@/features/training/hooks/use-training-data";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

type ModalityView = {
  icon: LucideIcon;
  label: string;
  tone: TrainingTone;
  value: string;
};

type CritérionStatus = {
  current: string;
  detail: string;
  icon: LucideIcon;
  label: string;
  missingLabel: string;
  ok: boolean;
  progress: number;
  target: string;
  tone: TrainingTone;
};

const modalityViews: ModalityView[] = [
  {
    icon: Target,
    label: "Busca & Captura",
    tone: "cyan",
    value: "busca_captura",
  },
  {
    icon: Crosshair,
    label: "Detecção",
    tone: "emerald",
    value: "deteccao",
  },
  {
    icon: ShieldCheck,
    label: "Guarda & Proteção",
    tone: "amber",
    value: "guarda_protecao",
  },
  {
    icon: Dog,
    label: "Obediência",
    tone: "violet",
    value: "obediencia",
  },
];

const toneClasses: Record<TrainingTone, string> = {
  amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  blue: "border-blue-300/25 bg-blue-300/10 text-blue-100",
  cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  red: "border-red-300/25 bg-red-300/10 text-red-100",
  slate: "border-slate-300/15 bg-slate-400/10 text-slate-200",
  violet: "border-violet-300/25 bg-violet-300/10 text-violet-100",
};

const gradientClasses: Record<TrainingTone, string> = {
  amber: "from-amber-300 to-orange-400",
  blue: "from-blue-300 to-blue-500",
  cyan: "from-cyan-200 to-cyan-500",
  emerald: "from-emerald-300 to-green-500",
  red: "from-red-300 to-red-500",
  slate: "from-slate-300 to-slate-500",
  violet: "from-violet-300 to-fuchsia-500",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

function formatDate(value: Date | null) {
  return value ? dateFormatter.format(value) : "--";
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatDistance(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "--";
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(value)} m`;
}

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isPositiveResult(value: string | null) {
  const parsed = normalized(value);
  return [
    "aprovado",
    "complete",
    "completa",
    "completed",
    "concluida",
    "concluido",
    "success",
    "sucesso",
  ].some((item) => parsed.includes(item));
}

function currentModuleOrder(value: string | null) {
  if (!value) return null;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function progressWidth(value: number) {
  if (value <= 0) return "0%";
  return `${Math.max(6, Math.min(100, value))}%`;
}

function successRate(sessions: TrainingSessionSummary[]) {
  if (!sessions.length) return 0;
  return (
    (sessions.filter((session) => isPositiveResult(session.result)).length /
      sessions.length) *
    100
  );
}

function bestDistance(sessions: TrainingSessionSummary[]) {
  return Math.max(0, ...sessions.map((session) => session.distanceM ?? 0));
}

function coveredEvents(
  sessions: TrainingSessionSummary[],
  requiredEvents: string[],
) {
  if (!requiredEvents.length) return requiredEvents.length;
  const seen = new Set(
    sessions
      .flatMap((session) => session.events)
      .map((event) => normalized(event)),
  );
  return requiredEvents.filter((event) => seen.has(normalized(event))).length;
}

function scorePart(value: number, target: number | null) {
  if (!target || target <= 0) return null;
  return Math.min(100, (value / target) * 100);
}

function programForModality(
  programs: CurriculumProgram[],
  modality: string,
) {
  return (
    programs.find((program) => program.modality === modality && program.active) ??
    programs.find((program) => program.modality === modality) ??
    null
  );
}

function moduleForCell(
  program: CurriculumProgram | null,
  cell: TrainingMatrixCell,
) {
  if (!program?.modules.length) return null;
  const order = currentModuleOrder(cell.currentModule);
  if (order != null) {
    return (
      program.modules.find((module) => module.order === order) ??
      program.modules[order - 1] ??
      program.modules[0]
    );
  }
  return program.modules[cell.completedModules] ?? program.modules[0];
}

function emptyCell(modality: ModalityView): TrainingMatrixCell {
  return {
    achievedMilestonesCount: 0,
    completedModules: 0,
    currentModule: null,
    label: modality.label,
    lastSessionAt: null,
    modality: modality.value,
    pendingPromotions: 0,
    programVersion: null,
    sessionCount: 0,
    source: "none",
    status: "not_started",
    statusLabel: "Não iniciado",
    tone: "slate",
  };
}

function cellForDog(dog: TrainingDogSummary, modality: ModalityView) {
  return (
    dog.cells.find((cell) => cell.modality === modality.value) ??
    emptyCell(modality)
  );
}

function Panel({
  action,
  children,
  className,
  subtitle,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-cyan-200/15 bg-black/16 px-5 py-7 text-center text-sm text-slate-400">
      {label}
    </div>
  );
}

function ProgressBar({
  className,
  value,
}: {
  className?: string;
  value: number;
}) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-slate-800">
      <span
        className={cn(
          "block h-full rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.42)]",
          className,
        )}
        style={{ width: progressWidth(value) }}
      />
    </span>
  );
}

function CritérionCard({ criterion }: { criterion: CritérionStatus }) {
  const Icon = criterion.icon;
  const hasTarget =
    criterion.target &&
    hasRealValue(criterion.target) &&
    criterion.target !== "--";

  const borderTone = criterion.ok ? criterion.tone : "amber";

  const glowClasses: Record<string, string> = {
    amber: "shadow-[0_0_24px_rgba(251,191,36,0.28)]",
    blue: "shadow-[0_0_24px_rgba(96,165,250,0.28)]",
    cyan: "shadow-[0_0_24px_rgba(34,211,238,0.28)]",
    emerald: "shadow-[0_0_24px_rgba(52,211,153,0.28)]",
    red: "shadow-[0_0_24px_rgba(248,113,113,0.28)]",
    slate: "",
    violet: "shadow-[0_0_24px_rgba(167,139,250,0.28)]",
  };

  return (
    <article
      className={cn(
        "rounded-[1.25rem] border p-4 transition",
        toneClasses[borderTone],
        criterion.ok && glowClasses[borderTone],
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
            toneClasses[criterion.ok ? criterion.tone : "amber"],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            {criterion.label}
          </p>
          <p className="mt-2 font-mono text-4xl font-black leading-none text-white">
            {hasRealValue(criterion.current) ? criterion.current : "—"}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">{criterion.detail}</p>
          <div className="mt-3">
            <ProgressBar
              className={cn(
                "h-2.5 bg-gradient-to-r",
                gradientClasses[criterion.ok ? criterion.tone : "amber"],
              )}
              value={criterion.progress}
            />
          </div>
          <p className="mt-2 text-xs">
            {hasTarget ? (
              <span className="text-emerald-300/70">Meta: {criterion.target}</span>
            ) : (
              <span className="text-slate-600">Sem meta</span>
            )}
          </p>
        </div>
      </div>
      {criterion.ok ? (
        <div className="mt-3 flex items-center gap-1.5 text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">Cumprido</span>
        </div>
      ) : null}
    </article>
  );
}

function ReadinessSummary({
  isReady,
  score,
}: {
  isReady: boolean;
  score: number;
}) {
  return (
    <Panel title="Quando ficara apto">
      <div className="rounded-[1.5rem] border border-white/10 bg-black/18 p-8 text-center">
        <span
          className={cn(
            "mx-auto flex h-20 w-20 items-center justify-center rounded-full border",
            isReady ? toneClasses.emerald : toneClasses.amber,
          )}
        >
          {isReady ? (
            <CheckCircle2 className="h-9 w-9" />
          ) : (
            <AlertTriangle className="h-9 w-9" />
          )}
        </span>
        <p
          className={cn(
            "mt-5 text-2xl font-black",
            isReady ? "text-emerald-300" : "text-amber-200",
          )}
        >
          {isReady ? "Apto a evoluir" : "Ainda não apto"}
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
          {isReady
            ? "Todos os critérios mínimos foram atendidos; a evolução depende da avaliação do Instrutor K9."
            : "Algum criterio curricular ainda precisa ser cumprido antes da solicitação de evolução."}
        </p>
        <p className="mt-4 font-mono text-3xl font-black text-white">
          {formatPercent(score)}
        </p>
      </div>
    </Panel>
  );
}

function HistoryChart({ sessions }: { sessions: TrainingSessionSummary[] }) {
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
              <span key={`${point.x}-${index}`}>{formatDate(point.date)}</span>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState label="Ainda não há sessões para desenhar o histórico." />
      )}
    </Panel>
  );
}

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
      <Icon className="h-6 w-6 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block font-black text-white">{label}</span>
        <span className="mt-1 block text-sm text-slate-400">{detail}</span>
      </span>
      <ChevronRight className="h-5 w-5 opacity-60" />
    </div>
  );
}

export default function TrainingMatrixPage() {
  const training = useTrainingData();
  const curriculums = useTrainingCurriculums();
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [selectedModalityValue, setSelectedModalityValue] =
    useState("busca_captura");

  const modalities = useMemo(
    () => [
      ...modalityViews,
      ...curriculums.programs
        .filter(
          (program) =>
            !modalityViews.some((modality) => modality.value === program.modality),
        )
        .map(
          (program): ModalityView => ({
            icon: GraduationCap,
            label: program.label,
            tone: "blue",
            value: program.modality,
          }),
        ),
    ],
    [curriculums.programs],
  );

  const selectedDog =
    training.dogs.find((dog) => dog.dogId === selectedDogId) ??
    training.dogs[0] ??
    null;
  const selectedModality =
    modalities.find((modality) => modality.value === selectedModalityValue) ??
    modalities[0];
  const program = programForModality(
    curriculums.programs,
    selectedModality.value,
  );
  const cell = selectedDog
    ? cellForDog(selectedDog, selectedModality)
    : emptyCell(selectedModality);
  const currentModule = moduleForCell(program, cell);
  const sessions = useMemo(
    () =>
      selectedDog
        ? training.sessions.filter(
            (session) =>
              session.dogId === selectedDog.dogId &&
              session.modality === selectedModality.value,
          )
        : [],
    [selectedDog, selectedModality.value, training.sessions],
  );

  const criteria = useMemo<CritérionStatus[]>(() => {
    if (!currentModule) return [];
    const achievedMilestones = Math.min(
      currentModule.requiredMilestoneCount,
      cell.achievedMilestonesCount,
    );
    const sessionTarget = currentModule.criteria.minSessions;
    const rateTarget =
      currentModule.criteria.minSuccessRate == null
        ? null
        : currentModule.criteria.minSuccessRate <= 1
          ? currentModule.criteria.minSuccessRate * 100
          : currentModule.criteria.minSuccessRate;
    const distanceTarget = currentModule.criteria.minDistanceM;
    const distance = bestDistance(sessions);
    const rate = successRate(sessions);

    return [
      {
        current: `${achievedMilestones} / ${currentModule.requiredMilestoneCount || "--"}`,
        detail: `${Math.round(scorePart(achievedMilestones, currentModule.requiredMilestoneCount) ?? 0)}% concluído`,
        icon: Flag,
        label: "Marcos obrigatórios",
        missingLabel: "marco obrigatório pendente",
        ok:
          currentModule.requiredMilestoneCount === 0 ||
          achievedMilestones >= currentModule.requiredMilestoneCount,
        progress:
          scorePart(achievedMilestones, currentModule.requiredMilestoneCount) ??
          0,
        target: String(currentModule.requiredMilestoneCount),
        tone: "violet",
      },
      {
        current: `${sessions.length} / ${sessionTarget || "--"}`,
        detail: `${Math.round(scorePart(sessions.length, sessionTarget) ?? 0)}% concluído`,
        icon: CalendarDays,
        label: "Sessões completas",
        missingLabel: "sessão completa pendente",
        ok: sessionTarget <= 0 || sessions.length >= sessionTarget,
        progress: scorePart(sessions.length, sessionTarget) ?? 0,
        target: String(sessionTarget),
        tone: "blue",
      },
      {
        current: formatPercent(rate),
        detail: rateTarget == null ? "sem meta mínima" : `Meta mínima: ${formatPercent(rateTarget)}`,
        icon: Target,
        label: "Sucesso medio",
        missingLabel: "pontos percentuais de sucesso",
        ok: rateTarget == null || rate >= rateTarget,
        progress:
          rateTarget == null ? 100 : Math.min(100, (rate / Math.max(1, rateTarget)) * 100),
        target: rateTarget == null ? "--" : formatPercent(rateTarget),
        tone: "emerald",
      },
      {
        current: formatDistance(distance),
        detail: `Meta mínima: ${formatDistance(distanceTarget)}`,
        icon: Ruler,
        label: "Distância mínima",
        missingLabel: "distância mínima pendente",
        ok: distanceTarget == null || distance >= distanceTarget,
        progress: scorePart(distance, distanceTarget) ?? 100,
        target: formatDistance(distanceTarget),
        tone: "amber",
      },
    ];
  }, [cell.achievedMilestonesCount, currentModule, sessions]);

  const eventCoverage = currentModule
    ? coveredEvents(sessions, currentModule.criteria.requiredEvents)
    : 0;
  const eventsOk =
    !currentModule ||
    !currentModule.criteria.requiredEvents.length ||
    eventCoverage >= currentModule.criteria.requiredEvents.length;
  const ready =
    criteria.every((item) => item.ok) &&
    eventsOk &&
    cell.pendingPromotions === 0 &&
    Boolean(currentModule);
  const score = criteria.length
    ? criteria.reduce((total, item) => total + item.progress, 0) /
      criteria.length
    : 0;
  const pending = criteria.filter((item) => !item.ok);
  const errors = [...training.errors, ...curriculums.errors];
  const ModalityIcon = selectedModality.icon;

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-cyan-200/12 bg-[#081320]/82 p-5 shadow-[0_26px_90px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              Treinamentos
            </p>
            <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">
              Prontidão K9
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Avaliação de evolução por modalidade com base nas métricas
              curriculares, sessões e progresso canonico.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 transition hover:bg-cyan-300/[0.12]"
              href={paths.training}
            >
              voltar aos treinos
            </Link>
            <Link
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 transition hover:bg-cyan-300/[0.12]"
              href={paths.trainingCurriculums}
            >
              currículos
            </Link>
          </div>
        </div>
      </header>

      {errors.length ? (
        <div className="rounded-[1.5rem] border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">Algumas leituras foram bloqueadas.</p>
              <p className="mt-1 text-amber-100/75">{errors.join(" | ")}</p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/72 p-5 md:grid-cols-[1fr_1fr] xl:grid-cols-[1.2fr_0.8fr]">
        <div className="flex items-center gap-4">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
            <Dog className="h-10 w-10" />
          </span>
          <div>
            <select
              className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-2xl font-black text-white outline-none"
              onChange={(event) => setSelectedDogId(event.target.value)}
              value={selectedDog?.dogId ?? ""}
            >
              {training.dogs.map((dog) => (
                <option className="bg-slate-950" key={dog.dogId} value={dog.dogId}>
                  {dog.dogName}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-slate-400">
              {selectedDog?.status ?? "Nenhum K9 carregado"}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
            Modalidade
          </p>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/18 p-2">
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl border",
                toneClasses[selectedModality.tone],
              )}
            >
              <ModalityIcon className="h-5 w-5" />
            </span>
            <select
              className="min-w-0 flex-1 bg-transparent font-semibold text-white outline-none"
              onChange={(event) => setSelectedModalityValue(event.target.value)}
              value={selectedModality.value}
            >
              {modalities.map((modality) => (
                <option
                  className="bg-slate-950"
                  key={modality.value}
                  value={modality.value}
                >
                  {modality.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

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
              <EmptyState label="Não há currículo/módulo para calcular a prontidão dessa modalidade." />
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
              <EmptyState label="Cadastre critérios no currículo para gerar pendências." />
            )}
          </Panel>

          <Panel
            action={<Link className="text-sm font-semibold text-cyan-200" href={paths.trainingCurriculums}>editar critérios</Link>}
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
                            Concluído
                          </td>
                          <td className="border-y border-white/10 bg-white/[0.035] px-3 py-3 text-slate-300">
                            {achieved ? "Concluído" : "Pendente"}
                          </td>
                          <td className="border-y border-white/10 bg-white/[0.035] px-3 py-3">
                            <Badge tone={achieved ? "green" : "yellow"}>
                              {achieved ? "concluído" : "em andamento"}
                            </Badge>
                          </td>
                          <td className="rounded-r-2xl border-y border-r border-white/10 bg-white/[0.035] px-3 py-3 font-mono text-slate-400">
                            {formatDate(cell.lastSessionAt)}
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

      {(training.loading || curriculums.loading) ? (
        <div className="fixed bottom-5 right-5 rounded-full border border-cyan-300/20 bg-slate-950/90 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          sincronizando
        </div>
      ) : null}
    </div>
  );
}
