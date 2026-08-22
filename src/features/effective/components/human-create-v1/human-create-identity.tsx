"use client";

import { Input } from "@/components/ui/input";

export function HumanCreateIdentity({
  callsign,
  callsignError,
  fullName,
  fullNameError,
  onCallsignChange,
  onFullNameChange,
  onRaChange,
  ra,
  raError,
}: {
  callsign: string;
  callsignError?: string;
  fullName: string;
  fullNameError?: string;
  onCallsignChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onRaChange: (value: string) => void;
  ra: string;
  raError?: string;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block" htmlFor="human-create-ra">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            RA<span className="ml-1 text-red-300">*</span>
          </span>
          <Input
            aria-describedby={raError ? "human-create-ra-error" : undefined}
            aria-invalid={raError ? true : undefined}
            id="human-create-ra"
            inputMode="numeric"
            onChange={(e) => onRaChange(e.target.value)}
            placeholder="Ex.: 123456"
            value={ra}
          />
          {raError ? (
            <span className="mt-1.5 block text-[11px] text-red-300" id="human-create-ra-error">
              {raError}
            </span>
          ) : null}
        </label>

        <label className="block" htmlFor="human-create-callsign">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Nome de guerra<span className="ml-1 text-red-300">*</span>
          </span>
          <Input
            aria-describedby={callsignError ? "human-create-callsign-error" : undefined}
            aria-invalid={callsignError ? true : undefined}
            id="human-create-callsign"
            onChange={(e) => onCallsignChange(e.target.value)}
            placeholder="Ex.: Ragonha"
            value={callsign}
          />
          {callsignError ? (
            <span
              className="mt-1.5 block text-[11px] text-red-300"
              id="human-create-callsign-error"
            >
              {callsignError}
            </span>
          ) : null}
        </label>
      </div>

      <label className="block" htmlFor="human-create-fullname">
        <span className="mb-2 block text-xs font-semibold text-slate-300">
          Nome completo<span className="ml-1 text-red-300">*</span>
        </span>
        <Input
          aria-describedby={fullNameError ? "human-create-fullname-error" : undefined}
          aria-invalid={fullNameError ? true : undefined}
          id="human-create-fullname"
          onChange={(e) => onFullNameChange(e.target.value)}
          placeholder="Nome civil completo"
          value={fullName}
        />
        {fullNameError ? (
          <span className="mt-1.5 block text-[11px] text-red-300" id="human-create-fullname-error">
            {fullNameError}
          </span>
        ) : null}
      </label>

      <div className="flex items-center gap-2 border-t border-cyan-200/10 pt-4 text-xs text-slate-500">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
        <p>
          <span className="font-semibold text-slate-300">Situação cadastral:</span>{" "}
          Ativo · definida automaticamente
        </p>
      </div>
    </div>
  );
}
