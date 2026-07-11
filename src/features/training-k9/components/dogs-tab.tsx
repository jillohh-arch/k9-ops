"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { paths } from "@/lib/routes/paths";

import { useTrainingK9Data, type TrainingK9Dog } from "../hooks/use-training-k9-data";
import { TrainingK9Empty } from "./training-k9-shell";

// ─── Types ─────────────────────────────────────────────────────────────────────

type DogStatus =
  | "evolving"
  | "awaiting_evaluation"
  | "module_completed"
  | "no_matrix";

interface DogCardData {
  breed: string | null;
  conductorName: string | null;
  dogId: string;
  dogName: string;
  matrixLabel: string | null;
  moduleLabel: string | null;
  pendingEvaluations: number;
  photoUrl: string | null;
  progress: { achieved: number; total: number; percent: number } | null;
  registrationNumber: string | null;
  status: DogStatus;
  statusLabel: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDogStatus(dog: TrainingK9Dog): DogStatus {
  if (dog.pendingPromotions > 0) return "awaiting_evaluation";

  const activeCells = dog.cells.filter((c) => c.status !== "not_started");
  if (activeCells.length === 0) return "no_matrix";

  const allOperational = activeCells.every(
    (c) => c.status === "operational" || c.status === "operacional",
  );
  if (allOperational) return "module_completed";

  return "evolving";
}

function statusLabel(status: DogStatus): string {
  switch (status) {
    case "evolving": return "Em evolução";
    case "awaiting_evaluation": return "Aguardando avaliação";
    case "module_completed": return "Módulo concluído";
    case "no_matrix": return "Sem matriz atribuída";
  }
}

const statusTone: Record<DogStatus, "cyan" | "green" | "yellow" | "slate"> = {
  evolving: "cyan",
  awaiting_evaluation: "yellow",
  module_completed: "green",
  no_matrix: "slate",
};

// ─── Filters ──────────────────────────────────────────────────────────────────

interface Filters {
  modality: string;
  search: string;
  status: string;
}

const emptyFilters: Filters = { modality: "", search: "", status: "" };

const statusOptions: Array<{ label: string; value: DogStatus | "" }> = [
  { label: "Todas as situações", value: "" },
  { label: "Em evolução", value: "evolving" },
  { label: "Aguardando avaliação", value: "awaiting_evaluation" },
  { label: "Módulo concluído", value: "module_completed" },
  { label: "Sem matriz atribuída", value: "no_matrix" },
];

function FiltersBar({
  filters,
  modalities,
  onFiltersChange,
}: {
  filters: Filters;
  modalities: Array<{ label: string; value: string }>;
  onFiltersChange: (f: Filters) => void;
}) {
  const hasFilters = filters.search || filters.modality || filters.status;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-48">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          aria-label="Buscar cão por nome ou matrícula"
          className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          placeholder="Buscar cão, matrícula ou condutor..."
          type="text"
          value={filters.search}
        />
      </div>

      <select
        aria-label="Filtrar por modalidade"
        className="h-10 appearance-none rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/35"
        onChange={(e) =>
          onFiltersChange({ ...filters, modality: e.target.value })
        }
        value={filters.modality}
      >
        <option value="">Todas as modalidades</option>
        {modalities.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrar por situação"
        className="h-10 appearance-none rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/35"
        onChange={(e) =>
          onFiltersChange({ ...filters, status: e.target.value })
        }
        value={filters.status}
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {hasFilters ? (
        <button
          aria-label="Limpar filtros"
          className="flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-bold text-slate-400 transition hover:text-white"
          onClick={() => onFiltersChange(emptyFilters)}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
          Limpar
        </button>
      ) : null}
    </div>
  );
}

// ─── Dog Photo ────────────────────────────────────────────────────────────────

function DogPhoto({ name, size = "md", url }: { name: string; size?: "md" | "lg"; url: string | null }) {
  const [failed, setFailed] = useState(false);

  const sizeClasses = size === "lg"
    ? "h-16 w-16"
    : "h-14 w-14";

  if (!url || failed) {
    return (
      <div className={cn("flex shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-slate-800/60", sizeClasses)}>
        <Image
          alt={name}
          className="object-contain p-1.5"
          height={size === "lg" ? 44 : 40}
          src="/brand/logo-app.png"
          width={size === "lg" ? 44 : 40}
        />
      </div>
    );
  }

  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl border border-cyan-300/15", sizeClasses)}>
      <Image
        alt={name}
        className="object-cover"
        fill
        onError={() => setFailed(true)}
        sizes={size === "lg" ? "64px" : "56px"}
        src={url}
        unoptimized={url.startsWith("http")}
      />
    </div>
  );
}

// ─── Dog Card ─────────────────────────────────────────────────────────────────

function DogCard({ dog, isWide }: { dog: DogCardData; isWide: boolean }) {
  const tone = statusTone[dog.status];

  if (isWide) {
    return (
      <Link
        className="group relative flex items-center gap-5 overflow-hidden rounded-2xl border border-cyan-300/10 bg-slate-950/55 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50"
        href={`${paths.trainingDog}/${dog.dogId}`}
      >
        <DogPhoto name={dog.dogName} size="lg" url={dog.photoUrl} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <h3 className="truncate text-base font-black text-white">
              {dog.dogName}
            </h3>
            {dog.registrationNumber ? (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {dog.registrationNumber}
              </span>
            ) : null}
          </div>

          {dog.breed ? (
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {dog.breed}
            </p>
          ) : null}

          <p className="mt-1 truncate text-xs text-slate-400">
            Condutor: {dog.conductorName ?? "Não vinculado"}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {dog.matrixLabel ? (
              <span className="text-xs font-semibold text-slate-300">
                {dog.matrixLabel}
              </span>
            ) : null}
            {dog.matrixLabel && dog.moduleLabel ? (
              <span className="text-slate-600">·</span>
            ) : null}
            {dog.moduleLabel ? (
              <span className="text-xs text-slate-400">
                {dog.moduleLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge tone={tone} className="text-[10px]">
            {dog.statusLabel}
          </Badge>
          {dog.pendingEvaluations > 0 ? (
            <span className="text-xs font-bold text-amber-300">
              {dog.pendingEvaluations} {dog.pendingEvaluations === 1 ? "pendente" : "pendentes"}
            </span>
          ) : null}
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-cyan-300" />
      </Link>
    );
  }

  return (
    <Link
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-cyan-300/10 bg-slate-950/55 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50"
      href={`${paths.trainingDog}/${dog.dogId}`}
    >
      {/* Header with photo */}
      <div className="flex items-start gap-3">
        <DogPhoto name={dog.dogName} url={dog.photoUrl} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-black text-white">
            {dog.dogName}
          </h3>
          {dog.registrationNumber ? (
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {dog.registrationNumber}
            </p>
          ) : null}
          {dog.breed ? (
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {dog.breed}
            </p>
          ) : null}
        </div>
        {dog.pendingEvaluations > 0 ? (
          <span
            className="flex h-auto items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300"
            title={`${dog.pendingEvaluations} ${dog.pendingEvaluations === 1 ? "avaliação pendente" : "avaliações pendentes"}`}
          >
            {dog.pendingEvaluations} {dog.pendingEvaluations === 1 ? "pendente" : "pendentes"}
          </span>
        ) : null}
      </div>

      {/* Conductor */}
      <p className="mt-3 truncate text-xs text-slate-400">
        Condutor: {dog.conductorName ?? "Não vinculado"}
      </p>

      {/* Matrix & Module */}
      <div className="mt-2 space-y-0.5">
        {dog.matrixLabel ? (
          <p className="truncate text-xs font-semibold text-slate-300">
            {dog.matrixLabel}
          </p>
        ) : null}
        {dog.moduleLabel ? (
          <p className="truncate text-[11px] text-slate-400">
            {dog.moduleLabel}
          </p>
        ) : null}
      </div>

      {/* Progress */}
      {dog.progress ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-slate-400">
              {dog.progress.achieved} de {dog.progress.total} marcos
            </span>
            <span className="font-mono text-xs font-bold text-white">
              {dog.progress.percent}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 shadow-[0_0_12px_rgba(77,208,225,0.4)] transition-all duration-500"
              style={{ width: `${dog.progress.percent}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <Badge tone={tone} className="text-[10px]">
          {dog.statusLabel}
        </Badge>
        <ChevronRight className="h-3.5 w-3.5 text-slate-600 transition group-hover:text-cyan-300" />
      </div>
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DogsTab() {
  const data = useTrainingK9Data();
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const modalities = useMemo(() => {
    return data.programs.map((p) => ({
      label: p.label,
      value: p.modality,
    }));
  }, [data.programs]);

  const dogs = useMemo((): DogCardData[] => {
    return data.dogs.map((dog): DogCardData => {
      const activeCells = dog.cells.filter((c) => c.status !== "not_started");
      const primaryCell = activeCells[0] ?? null;

      const program = primaryCell
        ? data.programs.find((p) => p.modality === primaryCell.modality)
        : null;

      const totalMilestones = program?.milestoneCount ?? null;
      const achieved = primaryCell?.achievedMilestonesCount ?? 0;

      const progress =
        totalMilestones && totalMilestones > 0
          ? {
              achieved,
              percent: Math.round((achieved / totalMilestones) * 100),
              total: totalMilestones,
            }
          : null;

      const status = computeDogStatus(dog);

      // Resolve module friendly name from the program
      let moduleLabel = primaryCell?.currentModule ?? null;
      if (moduleLabel && program) {
        const moduleMatch = program.modules.find(
          (m) => m.id === moduleLabel || m.title === moduleLabel,
        );
        if (moduleMatch) {
          moduleLabel = moduleMatch.title;
        }
      }

      return {
        breed: dog.breed,
        conductorName: dog.conductorName,
        dogId: dog.dogId,
        dogName: dog.dogName,
        matrixLabel: program?.label ?? (primaryCell?.label || null),
        moduleLabel,
        pendingEvaluations: dog.pendingPromotions,
        photoUrl: dog.photoUrl,
        progress,
        registrationNumber: dog.registrationNumber,
        status,
        statusLabel: statusLabel(status),
      };
    });
  }, [data.dogs, data.programs]);

  const filtered = useMemo(() => {
    let result = dogs;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (d) =>
          d.dogName.toLowerCase().includes(q) ||
          d.dogId.toLowerCase().includes(q) ||
          d.registrationNumber?.toLowerCase().includes(q) ||
          d.conductorName?.toLowerCase().includes(q) ||
          d.matrixLabel?.toLowerCase().includes(q),
      );
    }

    if (filters.modality) {
      result = result.filter((d) => {
        const dog = data.dogs.find((dd) => dd.dogId === d.dogId);
        return dog?.cells.some(
          (c) => c.modality === filters.modality && c.status !== "not_started",
        );
      });
    }

    if (filters.status) {
      result = result.filter((d) => d.status === filters.status);
    }

    return result;
  }, [data.dogs, dogs, filters]);

  const isWideLayout = filtered.length <= 4;

  return (
    <div className="space-y-5">
      <FiltersBar
        filters={filters}
        modalities={modalities}
        onFiltersChange={setFilters}
      />

      {filtered.length === 0 ? (
        <TrainingK9Empty
          title={
            filters.search || filters.modality || filters.status
              ? "Nenhum cão encontrado"
              : "Nenhum K9 em treinamento"
          }
          description={
            filters.search || filters.modality || filters.status
              ? "Tente ajustar os filtros para encontrar o cão desejado."
              : "Nenhum cão possui treinamento registrado até o momento."
          }
        />
      ) : (
        <>
          <p className="text-xs text-slate-500">
            Mostrando {filtered.length} de {dogs.length} K9s
          </p>
          {isWideLayout ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((dog) => (
                <DogCard dog={dog} isWide key={dog.dogId} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((dog) => (
                <DogCard dog={dog} isWide={false} key={dog.dogId} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
