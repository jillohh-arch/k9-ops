"use client";

import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarDays,
  Crosshair,
  Dog,
  Footprints,
  GraduationCap,
  ShieldCheck,
  Target,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { canonicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import {
  useTrainingCurriculums,
  type CurriculumModule,
  type CurriculumProgram,
} from "@/features/training-curriculums/hooks/use-training-curriculums";
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

type ReadinessItem = {
  cell: TrainingMatrixCell;
  dog: TrainingDogSummary;
  missing: string[];
  module: CurriculumModule | null;
  program: CurriculumProgram | null;
  score: number;
  sessions: TrainingSessionSummary[];
};

const baseModalities: ModalityView[] = [
  {
    icon: Target,
    label: "Busca & Captura",
    tone: "cyan",
    value: "busca_captura",
  },
  {
    icon: Crosshair,
    label: "Deteccao",
    tone: "emerald",
    value: "deteccao",
  },
  {
    icon: ShieldCheck,
    label: "Guarda & Protecao",
    tone: "amber",
    value: "guarda_protecao",
  },
  {
    icon: Dog,
    label: "Obediencia",
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

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
  style: "percent",
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number) {
  return percentFormatter.format(Math.max(0, value) / 100);
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

function scorePart(value: number, target: number | null) {
  if (!target || target <= 0) return null;
  return Math.min(100, (value / target) * 100);
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
    statusLabel: "Nao iniciado",
    tone: "slate",
  };
}

function cellForDog(dog: TrainingDogSummary, modality: ModalityView) {
  return (
    dog.cells.find((cell) => cell.modality === modality.value) ??
    emptyCell(modality)
  );
}

function readinessFor(
  dog: TrainingDogSummary,
  modality: ModalityView,
  program: CurriculumProgram | null,
  sessions: TrainingSessionSummary[],
): ReadinessItem {
  const cell = cellForDog(dog, modality);
  const currentModule = moduleForCell(program, cell);
  const missing: string[] = [];

  if (normalized(cell.status).includes("operational")) {
    return { cell, dog, missing, module: currentModule, program, score: 100, sessions };
  }

  if (!currentModule) {
    return {
      cell,
      dog,
      missing: ["Curriculo sem modulo atual"],
      module: currentModule,
      program,
      score: cell.source === "none" && sessions.length === 0 ? 0 : 35,
      sessions,
    };
  }

  const parts: number[] = [];
  const requiredMilestones = Math.max(0, currentModule.requiredMilestoneCount);
  const achievedMilestones = Math.min(
    requiredMilestones,
    cell.achievedMilestonesCount,
  );
  const milestoneScore =
    requiredMilestones > 0
      ? scorePart(achievedMilestones, requiredMilestones)
      : null;
  if (milestoneScore != null) {
    parts.push(milestoneScore);
    if (milestoneScore < 100) missing.push("Marcos obrigatorios");
  }

  const sessionScore = scorePart(sessions.length, currentModule.criteria.minSessions);
  if (sessionScore != null) {
    parts.push(sessionScore);
    if (sessionScore < 100) missing.push("Sessoes completas");
  }

  if (currentModule.criteria.minSuccessRate != null) {
    const target =
      currentModule.criteria.minSuccessRate <= 1
        ? currentModule.criteria.minSuccessRate * 100
        : currentModule.criteria.minSuccessRate;
    const rate = successRate(sessions);
    parts.push(Math.min(100, (rate / Math.max(1, target)) * 100));
    if (rate < target) missing.push("Sucesso minimo");
  }

  const distanceScore = scorePart(
    bestDistance(sessions),
    currentModule.criteria.minDistanceM,
  );
  if (distanceScore != null) {
    parts.push(distanceScore);
    if (distanceScore < 100) missing.push("Distancia minima");
  }

  if (currentModule.criteria.requiredEvents.length) {
    const eventScore = scorePart(
      coveredEvents(sessions, currentModule.criteria.requiredEvents),
      currentModule.criteria.requiredEvents.length,
    );
    if (eventScore != null) {
      parts.push(eventScore);
      if (eventScore < 100) missing.push("Eventos esperados");
    }
  }

  if (cell.pendingPromotions > 0) {
    parts.push(100);
    missing.push("Validacao do Instrutor K9");
  }

  const score = parts.length
    ? parts.reduce((total, part) => total + part, 0) / parts.length
    : cell.source === "none" && sessions.length === 0
      ? 0
      : 50;

  return { cell, dog, missing, module: currentModule, program, score, sessions };
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

function MetricCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: TrainingTone;
  value: string;
}) {
  return (
    <article
      className={cn(
        "relative min-h-32 overflow-hidden rounded-[1.45rem] border p-5",
        toneClasses[tone],
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_18%,rgba(255,255,255,0.14),transparent_24%)]" />
      <div className="relative flex items-start justify-between gap-5">
        <div>
          <p className="text-sm font-semibold text-slate-200">{label}</p>
          <p className="mt-4 font-mono text-4xl font-black text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055]">
          <Icon className="h-6 w-6" />
        </span>
      </div>
    </article>
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-cyan-200/15 bg-black/16 px-5 py-7 text-center text-sm text-slate-400">
      {label}
    </div>
  );
}

function ModalityReadinessRow({
  modality,
  score,
}: {
  modality: ModalityView;
  score: number;
}) {
  const Icon = modality.icon;

  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/16 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl border",
          toneClasses[modality.tone],
        )}
      >
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <div className="flex items-center justify-between gap-4">
          <p className="font-black text-white">{modality.label}</p>
          <span className="font-mono text-lg font-black text-white sm:hidden">
            {formatPercent(score)}
          </span>
        </div>
        <div className="mt-2">
          <ProgressBar
            className={cn("bg-gradient-to-r", gradientClasses[modality.tone])}
            value={score}
          />
        </div>
      </div>
      <div className="hidden min-w-28 text-right sm:block">
        <p className="font-mono text-2xl font-black text-white">
          {formatPercent(score)}
        </p>
        <p className="mt-1 text-xs text-emerald-300">criterios reais</p>
      </div>
    </div>
  );
}

function CriticalCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: TrainingTone;
  value: number;
}) {
  return (
    <article
      className={cn(
        "group rounded-[1.35rem] border p-4 transition hover:border-cyan-200/30",
        toneClasses[tone],
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <Icon className="h-7 w-7" />
        <ArrowRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-1 group-hover:opacity-90" />
      </div>
      <p className="mt-5 text-sm font-black text-white">{label}</p>
      <p className="mt-1 font-mono text-3xl font-black text-white">
        {formatNumber(value)}
      </p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </article>
  );
}

function MatrixRow({
  focus,
  module,
}: {
  focus: ReadinessItem | null;
  module: CurriculumModule;
}) {
  const cell = focus?.cell;
  const sessions = focus?.sessions ?? [];
  const isCompleted = Boolean(cell && cell.completedModules >= module.order);
  const isCurrent =
    !isCompleted && currentModuleOrder(cell?.currentModule ?? null) === module.order;
  const rate = successRate(sessions);
  const distance = bestDistance(sessions);
  const eventCount = coveredEvents(sessions, module.criteria.requiredEvents);
  const targetRate =
    module.criteria.minSuccessRate == null
      ? null
      : module.criteria.minSuccessRate <= 1
        ? module.criteria.minSuccessRate * 100
        : module.criteria.minSuccessRate;

  return (
    <tr className="text-sm">
      <td className="rounded-l-2xl border-y border-l border-white/10 bg-white/[0.035] px-3 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 font-mono text-cyan-100">
            {module.order}
          </span>
          <span>
            <span className="block font-black text-white">{module.title}</span>
            <span className="text-xs text-slate-500">
              {module.description || `Modulo ${module.order}`}
            </span>
          </span>
        </div>
      </td>
      <td className="border-y border-white/10 bg-white/[0.035] px-3 py-3 font-mono text-slate-200">
        {Math.min(
          module.requiredMilestoneCount,
          cell?.achievedMilestonesCount ?? 0,
        )}{" "}
        / {module.requiredMilestoneCount}
      </td>
      <td className="border-y border-white/10 bg-white/[0.035] px-3 py-3 font-mono text-slate-200">
        {sessions.length} / {module.criteria.minSessions || "--"}
      </td>
      <td className="border-y border-white/10 bg-white/[0.035] px-3 py-3 font-mono text-slate-200">
        {targetRate == null ? "--" : `${Math.round(rate)}% / ${Math.round(targetRate)}%`}
      </td>
      <td className="border-y border-white/10 bg-white/[0.035] px-3 py-3 font-mono text-slate-200">
        {formatDistance(distance)} / {formatDistance(module.criteria.minDistanceM)}
      </td>
      <td className="border-y border-white/10 bg-white/[0.035] px-3 py-3 font-mono text-slate-200">
        {eventCount} / {module.criteria.requiredEvents.length || "--"}
      </td>
      <td className="rounded-r-2xl border-y border-r border-white/10 bg-white/[0.035] px-3 py-3">
        {isCompleted ? (
          <Badge tone="green">concluido</Badge>
        ) : isCurrent ? (
          <Badge tone="yellow">em andamento</Badge>
        ) : (
          <Badge tone="slate">nao iniciado</Badge>
        )}
      </td>
    </tr>
  );
}

function UpcomingEvolution({ item }: { item: ReadinessItem }) {
  return (
    <Link
      className="group grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-white/10 bg-black/18 p-3 transition hover:border-cyan-200/30"
      href={paths.trainingMatrix}
    >
      <span>
        <span className="block font-black text-white">{item.dog.dogName}</span>
        <span className="mt-1 block text-xs text-slate-400">
          {item.program?.label ?? canonicalModalityLabel(item.cell.modality)} ·{" "}
          {item.module?.title ?? item.cell.statusLabel}
        </span>
        {item.missing.length ? (
          <span className="mt-1 block text-xs text-amber-200">
            Falta: {item.missing.slice(0, 2).join(", ")}
          </span>
        ) : (
          <span className="mt-1 block text-xs text-emerald-300">
            Sem bloqueios calculados
          </span>
        )}
      </span>
      <span className="min-w-20">
        <span className="block text-right font-mono text-xl font-black text-white">
          {formatPercent(item.score)}
        </span>
        <ProgressBar
          className={item.score >= 80 ? "bg-emerald-300" : "bg-amber-300"}
          value={item.score}
        />
      </span>
    </Link>
  );
}

export default function TrainingPage() {
  const training = useTrainingData();
  const curriculums = useTrainingCurriculums();

  const model = useMemo(() => {
    const modalities = [
      ...baseModalities,
      ...curriculums.programs
        .filter(
          (program) =>
            !baseModalities.some((modality) => modality.value === program.modality),
        )
        .map(
          (program): ModalityView => ({
            icon: BookOpenCheck,
            label: program.label,
            tone: "blue",
            value: program.modality,
          }),
        ),
    ];

    const readinessItems = training.dogs.flatMap((dog) =>
      modalities.map((modality) => {
        const program = programForModality(curriculums.programs, modality.value);
        const sessions = training.sessions.filter(
          (session) =>
            session.dogId === dog.dogId && session.modality === modality.value,
        );
        return readinessFor(dog, modality, program, sessions);
      }),
    );

    const readinessByModality = modalities.map((modality) => {
      const items = readinessItems.filter(
        (item) => item.cell.modality === modality.value,
      );
      const score = items.length
        ? items.reduce((total, item) => total + item.score, 0) / items.length
        : 0;
      return { modality, score };
    });

    const activePrograms = curriculums.programs.filter((program) => program.active);
    const missingCriteria = curriculums.programs.flatMap((program) =>
      program.modules.filter((module) => {
        const criteria = module.criteria;
        return (
          module.requiredMilestoneCount === 0 ||
          (criteria.minSessions <= 0 &&
            criteria.minSuccessRate == null &&
            criteria.minDistanceM == null &&
            criteria.requiredEvents.length === 0)
        );
      }),
    );

    const closeToEvolve = readinessItems.filter(
      (item) =>
        item.score >= 75 &&
        normalized(item.cell.status) !== "operational" &&
        item.cell.source !== "none",
    );

    const critical = {
      distance: readinessItems.filter((item) =>
        item.missing.includes("Distancia minima"),
      ).length,
      milestones: readinessItems.filter((item) =>
        item.missing.includes("Marcos obrigatorios"),
      ).length,
      sessions: readinessItems.filter((item) =>
        item.missing.includes("Sessoes completas"),
      ).length,
      validations: training.pendingPromotions.length,
    };

    const buscaProgram = programForModality(curriculums.programs, "busca_captura");
    const buscaFocus =
      readinessItems
        .filter((item) => item.cell.modality === "busca_captura")
        .sort((a, b) => b.score - a.score)[0] ?? null;

    const upcoming = readinessItems
      .filter(
        (item) =>
          normalized(item.cell.status) !== "operational" &&
          (item.cell.source !== "none" || item.sessions.length > 0),
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    return {
      activePrograms,
      buscaFocus,
      buscaProgram,
      closeToEvolve,
      critical,
      missingCriteria,
      readinessByModality,
      upcoming,
    };
  }, [curriculums.programs, training.dogs, training.pendingPromotions.length, training.sessions]);

  const errors = [...training.errors, ...curriculums.errors];

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-cyan-200/12 bg-[#081320]/82 p-5 shadow-[0_26px_90px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              Treinamentos
            </p>
            <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">
              Treinamentos · Metricas e Evolucao
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Acompanhamento gerencial da evolucao por modalidade, criterios
              curriculares, prontidao e pendencias de Instrutor K9.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:border-cyan-200/40"
              href={paths.trainingCurriculums}
            >
              curriculos / criterios
            </Link>
            <Link
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:border-cyan-200/40"
              href={paths.trainingMatrix}
            >
              matriz completa
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

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          detail={`${formatPercent(
            curriculums.metrics.programs
              ? (model.activePrograms.length / curriculums.metrics.programs) * 100
              : 0,
          )} do cadastrado`}
          icon={Dog}
          label="Modalidades ativas"
          tone="cyan"
          value={formatNumber(model.activePrograms.length)}
        />
        <MetricCard
          detail="com prontidao acima de 75%"
          icon={Award}
          label="K9 aptos a evoluir"
          tone="emerald"
          value={formatNumber(model.closeToEvolve.length)}
        />
        <MetricCard
          detail="modulos sem criterios ou marcos"
          icon={AlertTriangle}
          label="Pendencias curriculares"
          tone="amber"
          value={formatNumber(model.missingCriteria.length)}
        />
        <MetricCard
          detail="promotion_requests pendentes"
          icon={UserCheck}
          label="Avaliacoes aguardando Instrutor"
          tone="violet"
          value={formatNumber(training.metrics.pendingPromotions)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel
          action={<Badge tone="cyan">nivel de prontidao</Badge>}
          subtitle="Media calculada com progresso canonico, sessoes e criterios do curriculo."
          title="Prontidao por modalidade"
        >
          <div className="space-y-3">
            {model.readinessByModality.map((item) => (
              <ModalityReadinessRow
                key={item.modality.value}
                modality={item.modality}
                score={item.score}
              />
            ))}
          </div>
        </Panel>

        <Panel
          subtitle="Criterios curriculares que exigem atencao imediata."
          title="Pendencias criticas"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <CriticalCard
              detail="abaixo da distancia minima"
              icon={Footprints}
              label="Trilha minima"
              tone="red"
              value={model.critical.distance}
            />
            <CriticalCard
              detail="marcos obrigatorios pendentes"
              icon={Target}
              label="Marcos obrigatorios"
              tone="amber"
              value={model.critical.milestones}
            />
            <CriticalCard
              detail="nao atingiram o minimo"
              icon={CalendarDays}
              label="Sessoes completas"
              tone="blue"
              value={model.critical.sessions}
            />
            <CriticalCard
              detail="aguardando avaliacao final"
              icon={GraduationCap}
              label="Validacao do Instrutor K9"
              tone="violet"
              value={model.critical.validations}
            />
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.25fr_0.65fr]">
        <Panel
          action={
            <Link
              className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-100 transition hover:border-cyan-200/40"
              href={paths.trainingMatrix}
            >
              ver matriz completa
            </Link>
          }
          subtitle="Visao por modulo/fase com criterios minimos para evolucao."
          title="Matriz de evolucao - Busca & Captura"
        >
          {model.buscaProgram?.modules.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-separate border-spacing-y-2">
                  <thead className="text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Modulo / fase</th>
                      <th className="px-3 py-2">Marcos concluidos</th>
                      <th className="px-3 py-2">Sessoes completas</th>
                      <th className="px-3 py-2">Sucesso medio</th>
                      <th className="px-3 py-2">Distancia minima</th>
                      <th className="px-3 py-2">Eventos esperados</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.buscaProgram.modules.map((module) => (
                      <MatrixRow
                        focus={model.buscaFocus}
                        key={module.id}
                        module={module}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {model.buscaFocus ? (
                <div className="mt-4 grid gap-4 rounded-3xl border border-cyan-200/10 bg-cyan-300/[0.035] p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                    <Dog className="h-7 w-7" />
                  </span>
                  <div>
                    <p className="font-black text-white">
                      {model.buscaFocus.dog.dogName}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {model.buscaFocus.module?.title ?? "Modulo atual"} ·{" "}
                      {model.buscaFocus.cell.statusLabel}
                    </p>
                  </div>
                  <div className="min-w-36">
                    <p className="text-right font-mono text-2xl font-black text-white">
                      {formatPercent(model.buscaFocus.score)}
                    </p>
                    <ProgressBar value={model.buscaFocus.score} />
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState label="Curriculo de Busca & Captura ainda nao possui modulos cadastrados." />
          )}
        </Panel>

        <Panel
          action={<Badge tone="cyan">{model.upcoming.length} exibidos</Badge>}
          subtitle="K9 mais proximos de evoluir conforme matriz vigente."
          title="Proximas evolucoes"
        >
          {model.upcoming.length ? (
            <div className="space-y-3">
              {model.upcoming.map((item) => (
                <UpcomingEvolution
                  item={item}
                  key={`${item.dog.dogId}:${item.cell.modality}`}
                />
              ))}
            </div>
          ) : (
            <EmptyState label="Nenhuma evolucao proxima calculada com os dados atuais." />
          )}
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Criterios baseados em curriculos, progresso canonico, sessoes e
            solicitacoes pendentes. A aprovacao continua sendo do Instrutor K9.
          </p>
        </Panel>
      </section>

      {(training.loading || curriculums.loading) ? (
        <div className="fixed bottom-5 right-5 rounded-full border border-cyan-300/20 bg-slate-950/90 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          sincronizando
        </div>
      ) : null}
    </div>
  );
}
