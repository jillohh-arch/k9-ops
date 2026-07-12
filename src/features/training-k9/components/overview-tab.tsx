"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Award, Dog, GitBranch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { useTrainingK9Data } from "../hooks/use-training-k9-data";
import { TrainingK9Empty } from "./training-k9-shell";

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
  description: string;
  icon: typeof Dog;
  label: string;
  tone?: KpiTone;
  tooltip?: string;
  value: number | string;
}

function KpiCard({
  description,
  icon: Icon,
  label,
  tone = "cyan",
  tooltip,
  value,
}: KpiCardProps) {
  return (
    <article
      aria-label={`${label}: ${value}`}
      className="group relative overflow-hidden rounded-2xl border border-cyan-300/10 bg-slate-950/55 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/25"
      title={tooltip}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent opacity-80",
          toneClasses[tone],
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 font-mono text-3xl font-black text-white">
            {value}
          </p>
        </div>
        <Badge tone={tone} className="shrink-0 rounded-xl p-2.5 shadow-lg">
          <Icon className="h-4 w-4" />
        </Badge>
      </div>
      <p className="relative mt-3 text-xs leading-5 text-slate-400">
        {description}
      </p>
    </article>
  );
}

// ─── Dog Status Panel ─────────────────────────────────────────────────────────

type DogSituationStatus =
  | "awaiting_evaluation"
  | "evolving"
  | "module_completed"
  | "no_matrix"
  | "paused";

interface DogSituation {
  dogName: string;
  id: string;
  status: DogSituationStatus;
  statusLabel: string;
  tone: "amber" | "cyan" | "emerald" | "slate";
}

const situationToneStyles: Record<string, string> = {
  amber: "border-amber-400/20 bg-amber-400/5",
  cyan: "border-cyan-300/15 bg-cyan-300/5",
  emerald: "border-emerald-400/15 bg-emerald-400/5",
  slate: "border-slate-400/15 bg-slate-400/5",
};

const situationDotStyles: Record<string, string> = {
  amber: "bg-amber-400",
  cyan: "bg-cyan-300",
  emerald: "bg-emerald-400",
  slate: "bg-slate-500",
};

function DogStatusPanel({ situations }: { situations: DogSituation[] }) {
  if (situations.length === 0) {
    return (
      <TrainingK9Empty
        title="Nenhum K9 cadastrado"
        description="Nenhum cão está vinculado ao sistema de treinamento."
      />
    );
  }

  return (
    <div className="space-y-2">
      {situations.map((item) => (
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:border-cyan-300/20",
            situationToneStyles[item.tone],
          )}
          key={item.id}
        >
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              situationDotStyles[item.tone],
            )}
          />
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-white">
            {item.dogName}
          </p>
          <span className="shrink-0 text-xs text-slate-400">
            {item.statusLabel}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Distribution Bar ─────────────────────────────────────────────────────────

interface DistributionSegment {
  color: string;
  count: number;
  label: string;
}

function DistributionBar({ segments, total }: { segments: DistributionSegment[]; total: number }) {
  if (total === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-400/10 bg-slate-900/40 px-4 py-5">
        <p className="text-xs text-slate-500">Nenhum K9 no sistema de treinamento.</p>
      </div>
    );
  }

  const nonZero = segments.filter((s) => s.count > 0);

  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
        {nonZero.map((seg) => (
          <div
            className={cn("h-full transition-all duration-500", seg.color)}
            key={seg.label}
            style={{ width: `${(seg.count / total) * 100}%` }}
            title={`${seg.label}: ${seg.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((seg) => (
          <div className="flex items-center gap-2" key={seg.label}>
            <span className={cn("h-2.5 w-2.5 rounded-sm", seg.color)} />
            <span className="text-xs text-slate-400">
              {seg.label}
            </span>
            <span className="font-mono text-xs font-bold text-white">
              {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Matrix Cards ─────────────────────────────────────────────────────────────

interface MatrixInfo {
  active: boolean;
  dogsCount: number;
  dogsSummary: string | null;
  id: string;
  label: string;
  milestoneCount: number;
  moduleCount: number;
}

function MatrixCards({ matrices }: { matrices: MatrixInfo[] }) {
  if (matrices.length === 0) {
    return (
      <TrainingK9Empty
        title="Nenhuma matriz cadastrada"
        description="Cadastre matrizes de treinamento para acompanhar a evolução dos K9s."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {matrices.slice(0, 3).map((matrix) => (
        <div
          className="rounded-xl border border-cyan-200/10 bg-slate-900/50 p-4 transition hover:border-cyan-300/20"
          key={matrix.id}
        >
          <p className="text-sm font-bold text-white">{matrix.label}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-wider text-slate-400">
            <span>{matrix.moduleCount} módulos</span>
            {matrix.milestoneCount > 0 ? (
              <span>{matrix.milestoneCount} marcos</span>
            ) : null}
            <span>
              {matrix.dogsCount} {matrix.dogsCount === 1 ? "K9" : "K9s"}
            </span>
          </div>
          {matrix.dogsSummary ? (
            <p className="mt-2 text-xs text-slate-400">
              {matrix.dogsSummary}
            </p>
          ) : null}
          <div className="mt-3 flex items-center gap-2">
            {matrix.active ? (
              <Badge tone="green" className="text-[10px]">Ativa</Badge>
            ) : (
              <Badge tone="slate" className="text-[10px]">Rascunho</Badge>
            )}
            {matrix.milestoneCount === 0 && matrix.active ? (
              <Badge tone="yellow" className="text-[10px]">Marcos pendentes</Badge>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Pending Evaluations ──────────────────────────────────────────────────────

interface PendingEvalItem {
  dogId: string | null;
  dogName: string;
  id: string;
  modality: string;
  requestedAt: Date | null;
  requestedBy: string | null;
}

function timeAgo(date: Date | null, now: number) {
  if (!date) return "—";
  const days = Math.floor((now - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoje";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}

function PendingEvaluations({ items, now }: { items: PendingEvalItem[]; now: number }) {
  if (items.length === 0) {
    return (
      <TrainingK9Empty
        title="Nenhuma avaliação pendente"
        description="Não há solicitações de evolução aguardando análise."
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.slice(0, 5).map((item) => (
        <div
          className="flex items-center justify-between rounded-xl border border-amber-300/15 bg-amber-300/[0.03] px-4 py-3"
          key={item.id}
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{item.dogName}</p>
            <p className="text-xs text-slate-400">
              {item.modality}
              {item.requestedBy ? ` · Solicitado por ${item.requestedBy}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/70">
              há {timeAgo(item.requestedAt, now)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function OverviewSection({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-cyan-200/10 bg-slate-950/60 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OverviewTab() {
  const data = useTrainingK9Data();
  const [now] = useState(() => Date.now());

  // KPI computations
  const dogsWithActiveTraining = useMemo(() => {
    return data.dogs.filter((dog) =>
      dog.cells.some((cell) => cell.status !== "not_started"),
    ).length;
  }, [data.dogs]);

  const dogsWithoutMatrix = useMemo(() => {
    return data.dogs.filter((dog) =>
      dog.cells.every((cell) => cell.status === "not_started"),
    ).length;
  }, [data.dogs]);

  const matricesInUse = useMemo(() => {
    return data.programs.filter((program) =>
      data.dogs.some((dog) =>
        dog.cells.some(
          (cell) =>
            cell.modality === program.modality && cell.source !== "none",
        ),
      ),
    ).length;
  }, [data.programs, data.dogs]);

  // Dog situations — one entry per dog, no duplication
  const situations = useMemo((): DogSituation[] => {
    return data.dogs.map((dog): DogSituation => {
      if (dog.pendingPromotions > 0) {
        return {
          dogName: dog.dogName,
          id: dog.dogId,
          status: "awaiting_evaluation",
          statusLabel: "Aguardando avaliação",
          tone: "amber",
        };
      }
      const activeCells = dog.cells.filter((c) => c.status !== "not_started");
      if (activeCells.length === 0) {
        return {
          dogName: dog.dogName,
          id: dog.dogId,
          status: "no_matrix",
          statusLabel: "Sem matriz atribuída",
          tone: "slate",
        };
      }
      const allOperational = activeCells.every(
        (c) => c.status === "operational" || c.status === "operacional",
      );
      if (allOperational) {
        return {
          dogName: dog.dogName,
          id: dog.dogId,
          status: "module_completed",
          statusLabel: "Módulo concluído",
          tone: "emerald",
        };
      }
      return {
        dogName: dog.dogName,
        id: dog.dogId,
        status: "evolving",
        statusLabel: "Em evolução",
        tone: "cyan",
      };
    });
  }, [data.dogs]);

  // Distribution segments
  const distribution = useMemo((): { segments: DistributionSegment[]; total: number } => {
    const noMatrix = situations.filter((s) => s.status === "no_matrix").length;
    const evolving = situations.filter((s) => s.status === "evolving").length;
    const awaiting = situations.filter((s) => s.status === "awaiting_evaluation").length;
    const completed = situations.filter((s) => s.status === "module_completed").length;

    const segments: DistributionSegment[] = [
      { color: "bg-slate-500", count: noMatrix, label: "Sem matriz" },
      { color: "bg-cyan-400", count: evolving, label: "Em formação" },
      { color: "bg-amber-400", count: awaiting, label: "Aguardando avaliação" },
      { color: "bg-emerald-400", count: completed, label: "Módulo concluído" },
    ];

    return { segments, total: situations.length };
  }, [situations]);

  // Matrices
  const matrices = useMemo((): MatrixInfo[] => {
    return data.programs.map((program) => {
      const dogsInProgram = data.dogs.filter((dog) =>
        dog.cells.some(
          (cell) =>
            cell.modality === program.modality && cell.source !== "none",
        ),
      );

      let dogsSummary: string | null = null;
      if (dogsInProgram.length === 1) {
        const dog = dogsInProgram[0];
        const cell = dog.cells.find((c) => c.modality === program.modality);
        dogsSummary = `${dog.dogName} · ${cell?.statusLabel ?? "Sem progresso"}`;
      } else if (dogsInProgram.length > 1) {
        const awaiting = dogsInProgram.filter((d) =>
          d.cells.some(
            (c) => c.modality === program.modality && c.pendingPromotions > 0,
          ),
        ).length;
        const parts: string[] = [];
        if (awaiting > 0) parts.push(`${awaiting} aguardando avaliação`);
        const evolving = dogsInProgram.length - awaiting;
        if (evolving > 0) parts.push(`${evolving} em evolução`);
        dogsSummary = parts.join(" · ");
      }

      return {
        active: program.active,
        dogsCount: dogsInProgram.length,
        dogsSummary,
        id: program.id,
        label: program.label,
        milestoneCount: program.milestoneCount,
        moduleCount: program.moduleCount,
      };
    });
  }, [data.programs, data.dogs]);

  // Pending evaluations
  const pendingEvals = useMemo((): PendingEvalItem[] => {
    return data.pendingPromotions.map((promo) => {
      const dog = data.dogs.find((d) => d.dogId === promo.dogId);
      return {
        dogId: promo.dogId,
        dogName: dog?.dogName ?? `K9 ${promo.dogId ?? "—"}`,
        id: promo.id,
        modality: promo.modality,
        requestedAt: promo.requestedAt,
        requestedBy: promo.requestedBy,
      };
    });
  }, [data.dogs, data.pendingPromotions]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          description={`De ${data.metrics.activeDogs} cães cadastrados`}
          icon={Dog}
          label="K9s com treinamento ativo"
          tone="cyan"
          tooltip="Cães que possuem ao menos uma modalidade de treinamento com progresso iniciado."
          value={dogsWithActiveTraining}
        />
        <KpiCard
          description="Ainda não possuem programa vinculado"
          icon={AlertTriangle}
          label="Cães sem matriz"
          tone={dogsWithoutMatrix > 0 ? "yellow" : "green"}
          tooltip="Cães cadastrados que ainda não possuem nenhuma matriz de treinamento atribuída."
          value={dogsWithoutMatrix}
        />
        <KpiCard
          description="Requerem análise de instrutor"
          icon={Award}
          label="Avaliações pendentes"
          tone="yellow"
          tooltip="Solicitações de evolução aguardando aprovação ou rejeição por instrutor."
          value={data.metrics.pendingPromotions}
        />
        <KpiCard
          description={`De ${data.metrics.activePrograms} matrizes cadastradas`}
          icon={GitBranch}
          label="Matrizes em uso"
          tone="cyan"
          tooltip="Matrizes de treinamento que possuem ao menos um K9 vinculado."
          value={matricesInUse}
        />
      </div>

      {/* Distribution */}
      <OverviewSection title="Distribuição dos K9s">
        <DistributionBar segments={distribution.segments} total={distribution.total} />
      </OverviewSection>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <OverviewSection title="Situação dos K9s">
          <DogStatusPanel situations={situations} />
        </OverviewSection>

        <OverviewSection title="Avaliações pendentes">
          <PendingEvaluations items={pendingEvals} now={now} />
        </OverviewSection>
      </div>

      {/* Matrices */}
      <OverviewSection
        title="Matrizes de treinamento"
        action={
          matrices.length > 3 ? (
            <a
              className="text-xs font-bold text-cyan-300 transition hover:text-cyan-200"
              href="/training/matrices"
            >
              Ver todas →
            </a>
          ) : null
        }
      >
        <MatrixCards matrices={matrices} />
      </OverviewSection>
    </div>
  );
}
