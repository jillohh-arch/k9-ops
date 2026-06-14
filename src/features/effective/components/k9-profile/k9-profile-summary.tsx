"use client";

import { Scale, Stethoscope, Syringe, UserRound } from "lucide-react";

import {
  EntityImage,
  StatusPill,
} from "@/features/effective/components/effective-ui";
import { profileText, type ProfileRecord } from "@/features/effective/hooks/use-k9-profile-data";
import { specialtyLabel } from "@/features/effective/hooks/use-effective-data";

import { dateLabel, SectionCard, specialtyStatus, type ProfileView } from "./k9-profile-types";

export function K9ProfileSummary({
  conductorName,
  conductorPhoto,
  dog,
  lastExam,
  lastExamDate,
  microchip,
  color,
  view,
}: {
  conductorName: string;
  conductorPhoto: string | null;
  color: string | null;
  dog: ProfileRecord;
  lastExam: ProfileRecord | null;
  lastExamDate: Date | null;
  microchip: string | null;
  view: ProfileView;
}) {
  const { registration, birthDate } = view;

  return (
    <div className="grid gap-5 2xl:grid-cols-4">
      <SectionCard title="Resumo do K9">
        <dl className="mt-4 space-y-3 text-xs">
          {[
            ["Identificação", registration],
            ["Microchip", microchip ?? "Não informado"],
            ["Nascimento", dateLabel(birthDate)],
            ["Pelagem", color ?? "Não informada"],
            ["Situação cadastral", profileText(dog, ["status"]) ?? "Ativo"],
          ].map(([label, value]) => (
            <div className="flex justify-between gap-4" key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-right font-semibold text-slate-200">{value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title="Saúde por evidência">
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs text-slate-300">
                <Syringe className="h-4 w-4 text-emerald-300" />
                Vacinação
              </span>
              <StatusPill
                label={view.vaccineState.label}
                tone={view.vaccineState.tone}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Última: {dateLabel(view.vaccineDate)} - Próxima:{" "}
              {dateLabel(view.vaccineDue)}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs text-slate-300">
                <Scale className="h-4 w-4 text-cyan-300" />
                Faixa de peso
              </span>
              <StatusPill
                label={view.weightState.label}
                tone={view.weightState.tone}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Ideal:{" "}
              {view.idealMin != null && view.idealMax != null
                ? `${view.idealMin.toFixed(1)}-${view.idealMax.toFixed(1)} kg`
                : "não cadastrada"}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Stethoscope className="h-4 w-4 text-blue-300" />
              Último exame
            </div>
            <p className="mt-2 text-sm font-bold text-white">
              {lastExam
                ? profileText(lastExam, ["subtype", "title"]) ?? "Exame registrado"
                : "Sem exame localizado"}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {dateLabel(lastExamDate)}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Especialidades operacionais">
        <div className="mt-4 space-y-3">
          {view.specialtyRecords.length ? (
            view.specialtyRecords.map((specialty) => {
              const presentation = specialtyStatus(specialty);
              const currentModule = profileText(specialty, [
                "current_module",
                "currentModule",
                "phase",
              ]);
              return (
                <div
                  className="rounded-xl border border-white/8 bg-white/[0.025] p-3"
                  key={specialty._id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-200">
                      {specialtyLabel(
                        profileText(specialty, ["modality", "type", "name"]) ??
                          specialty._id,
                      )}
                    </p>
                    <StatusPill
                      label={presentation.label}
                      tone={presentation.tone}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {currentModule
                      ? `Módulo/fase atual: ${currentModule}`
                      : "Estado lido do cadastro da especialidade"}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">
              Nenhuma especialidade cadastrada.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Condutor vinculado">
        <div className="mt-4 flex items-center gap-4">
          <EntityImage
            alt={conductorName}
            className="h-20 w-20 shrink-0 rounded-full"
            fallback={UserRound}
            src={conductorPhoto}
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-white">
              {conductorName}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              RA {view.conductorRa ?? "--"}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {profileText(view.conductor, ["unit", "unidade"]) ??
                "Unidade não informada"}
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.025] p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Natureza do vínculo
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-300">
            Condutor titular registrado em dogs.conductorRa
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
