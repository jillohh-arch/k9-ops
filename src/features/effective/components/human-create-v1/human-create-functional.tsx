"use client";

import { Input } from "@/components/ui/input";

export function HumanCreateFunctional({
  admissionDate,
  cargo,
  onAdmissionDateChange,
  onCargoChange,
  onRankChange,
  onTeamChange,
  onUnitChange,
  rank,
  team,
  unit,
}: {
  admissionDate: string;
  cargo: string;
  onAdmissionDateChange: (value: string) => void;
  onCargoChange: (value: string) => void;
  onRankChange: (value: string) => void;
  onTeamChange: (value: string) => void;
  onUnitChange: (value: string) => void;
  rank: string;
  team: string;
  unit: string;
}) {
  return (
    <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
          Dados funcionais
        </h2>
        <p className="text-[11px] text-slate-500">Todos opcionais</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block" htmlFor="human-create-rank">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Posto / graduação
          </span>
          <Input
            id="human-create-rank"
            onChange={(e) => onRankChange(e.target.value)}
            placeholder="Ex.: Guarda Civil"
            value={rank}
          />
        </label>

        <label className="block" htmlFor="human-create-cargo">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Cargo / função
          </span>
          <Input
            id="human-create-cargo"
            onChange={(e) => onCargoChange(e.target.value)}
            placeholder="Ex.: Condutor K9"
            value={cargo}
          />
        </label>

        <label className="block" htmlFor="human-create-unit">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Unidade
          </span>
          <Input
            id="human-create-unit"
            onChange={(e) => onUnitChange(e.target.value)}
            placeholder="Ex.: GCM Canil"
            value={unit}
          />
        </label>

        <label className="block" htmlFor="human-create-team">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Equipe
          </span>
          <Input
            id="human-create-team"
            onChange={(e) => onTeamChange(e.target.value)}
            placeholder="Ex.: Alfa"
            value={team}
          />
        </label>

        <label className="block max-w-sm" htmlFor="human-create-admission">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Data de ingresso
          </span>
          <Input
            className="[color-scheme:dark]"
            id="human-create-admission"
            onChange={(e) => onAdmissionDateChange(e.target.value)}
            type="date"
            value={admissionDate}
          />
        </label>
      </div>
    </section>
  );
}
