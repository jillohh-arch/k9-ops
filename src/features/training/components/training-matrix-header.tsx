"use client";

import Link from "next/link";
import { Dog } from "lucide-react";

import { SourceWarning } from "@/components/feedback/source-warning";
import type { TrainingDogSummary } from "@/features/training/hooks/use-training-data";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

import type { ModalityView } from "./training-matrix-types";
import { toneClasses } from "./training-matrix-constants";

export function MatrixHeader({
  errors,
  modalities,
  onDogChange,
  onModalityChange,
  selectedDog,
  selectedModality,
  dogs,
}: {
  errors: string[];
  modalities: ModalityView[];
  onDogChange: (dogId: string) => void;
  onModalityChange: (value: string) => void;
  selectedDog: TrainingDogSummary | undefined;
  selectedModality: ModalityView;
  dogs: TrainingDogSummary[];
}) {
  const ModalityIcon = selectedModality.icon;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
            Treinamentos
          </p>
          <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">
            Prontidão K9
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Avaliação de evolução por modalidade com base nas métricas
            curriculares, sessões e progresso registrado.
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
      </header>

      <SourceWarning
        errors={errors}
        title="Parte dos critérios de prontidão não pôde ser consultada."
      />

      <section className="grid gap-4 rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/72 p-5 md:grid-cols-[1fr_1fr] xl:grid-cols-[1.2fr_0.8fr]">
        <div className="flex items-center gap-4">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
            <Dog className="h-10 w-10" />
          </span>
          <div>
            <select
              className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-2xl font-black text-white outline-none"
              onChange={(event) => onDogChange(event.target.value)}
              value={selectedDog?.dogId ?? ""}
            >
              {dogs.map((dog) => (
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
              onChange={(event) => onModalityChange(event.target.value)}
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
    </>
  );
}
