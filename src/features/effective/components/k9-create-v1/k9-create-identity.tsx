"use client";

import { Input } from "@/components/ui/input";

export function K9CreateIdentity({
  birthDate,
  birthDateError,
  breed,
  breedError,
  name,
  nameError,
  onBirthDateChange,
  onBreedChange,
  onNameChange,
  onRegistrationNumberChange,
  onSexChange,
  registrationNumber,
  registrationNumberError,
  sex,
  sexError,
}: {
  birthDate: string;
  birthDateError?: string;
  breed: string;
  breedError?: string;
  name: string;
  nameError?: string;
  onBirthDateChange: (value: string) => void;
  onBreedChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onRegistrationNumberChange: (value: string) => void;
  onSexChange: (value: "M" | "F") => void;
  registrationNumber: string;
  registrationNumberError?: string;
  sex: string;
  sexError?: string;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block" htmlFor="k9-create-name">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Nome operacional<span className="ml-1 text-red-300">*</span>
          </span>
          <Input
            aria-describedby={nameError ? "k9-create-name-error" : undefined}
            aria-invalid={nameError ? true : undefined}
            id="k9-create-name"
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ex.: Bono"
            value={name}
          />
          {nameError ? (
            <span className="mt-1.5 block text-[11px] text-red-300" id="k9-create-name-error">
              {nameError}
            </span>
          ) : null}
        </label>

        <label className="block" htmlFor="k9-create-registration">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Matrícula / RGA<span className="ml-1 text-red-300">*</span>
          </span>
          <Input
            aria-describedby={registrationNumberError ? "k9-create-registration-error" : undefined}
            aria-invalid={registrationNumberError ? true : undefined}
            id="k9-create-registration"
            onChange={(e) => onRegistrationNumberChange(e.target.value)}
            placeholder="Ex.: 12345"
            value={registrationNumber}
          />
          {registrationNumberError ? (
            <span className="mt-1.5 block text-[11px] text-red-300" id="k9-create-registration-error">
              {registrationNumberError}
            </span>
          ) : null}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-2" htmlFor="k9-create-breed">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Raça<span className="ml-1 text-red-300">*</span>
          </span>
          <Input
            aria-describedby={breedError ? "k9-create-breed-error" : undefined}
            aria-invalid={breedError ? true : undefined}
            id="k9-create-breed"
            onChange={(e) => onBreedChange(e.target.value)}
            placeholder="Ex.: Malinois Belga"
            value={breed}
          />
          {breedError ? (
            <span className="mt-1.5 block text-[11px] text-red-300" id="k9-create-breed-error">
              {breedError}
            </span>
          ) : null}
        </label>

        <label className="block" htmlFor="k9-create-sex">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Sexo<span className="ml-1 text-red-300">*</span>
          </span>
          <select
            aria-describedby={sexError ? "k9-create-sex-error" : undefined}
            aria-invalid={sexError ? true : undefined}
            className="h-11 w-full rounded-xl border border-cyan-300/15 bg-slate-950/70 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
            id="k9-create-sex"
            onChange={(e) => onSexChange(e.target.value as "M" | "F")}
            value={sex}
          >
            <option value="">Selecione o sexo</option>
            <option value="M">Macho</option>
            <option value="F">Fêmea</option>
          </select>
          {sexError ? (
            <span className="mt-1.5 block text-[11px] text-red-300" id="k9-create-sex-error">
              {sexError}
            </span>
          ) : null}
        </label>
      </div>

      <label className="block max-w-sm" htmlFor="k9-create-birthdate">
        <span className="mb-2 block text-xs font-semibold text-slate-300">
          Data de nascimento<span className="ml-1 text-red-300">*</span>
        </span>
        <Input
          aria-describedby={birthDateError ? "k9-create-birthdate-error" : undefined}
          aria-invalid={birthDateError ? true : undefined}
          className="[color-scheme:dark]"
          id="k9-create-birthdate"
          onChange={(e) => onBirthDateChange(e.target.value)}
          type="date"
          value={birthDate}
        />
        {birthDateError ? (
          <span className="mt-1.5 block text-[11px] text-red-300" id="k9-create-birthdate-error">
            {birthDateError}
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
