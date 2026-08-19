"use client";

import { Input } from "@/components/ui/input";

import type { K9EditIdentityValues } from "./k9-edit-adapter";

export type K9EditFieldErrors = Partial<
  Record<keyof K9EditIdentityValues | "form" | "photo", string>
>;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span className="mt-1.5 block text-[11px] text-red-300" id={id} role="alert">
      {message}
    </span>
  );
}

const labelClass = "mb-2 block text-xs font-semibold text-slate-300";
const requiredMark = <span className="ml-1 text-red-300">*</span>;

/**
 * Main administrative data: the five required identity fields.
 *
 * `sex` intentionally has no artificial default — a legacy document with a
 * missing or unrecognised value must force a conscious choice rather than
 * silently becoming "Macho".
 */
export function K9EditMainData({
  errors,
  onChange,
  values,
}: {
  errors: K9EditFieldErrors;
  onChange: <K extends keyof K9EditIdentityValues>(
    key: K,
    value: K9EditIdentityValues[K],
  ) => void;
  values: K9EditIdentityValues;
}) {
  const knownSex = values.sex === "M" || values.sex === "F";

  return (
    <div className="space-y-4">
      {/*
        Two columns only from `lg:`. At tablet width the photo already takes a
        column, so pairing fields here squeezed each input to ~214px while the
        date field stayed at 256px — inconsistent and cramped. Below `lg:` the
        identity fields stack full-width instead.
      */}
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className={labelClass}>
            Nome operacional{requiredMark}
          </span>
          <Input
            aria-describedby={errors.name ? "k9-edit-name-error" : undefined}
            aria-invalid={errors.name ? true : undefined}
            onChange={(event) => onChange("name", event.target.value)}
            value={values.name}
          />
          <FieldError id="k9-edit-name-error" message={errors.name} />
        </label>

        <label className="block">
          <span className={labelClass}>
            Matrícula / RGA{requiredMark}
          </span>
          <Input
            aria-describedby={
              errors.registrationNumber ? "k9-edit-registration-error" : undefined
            }
            aria-invalid={errors.registrationNumber ? true : undefined}
            onChange={(event) => onChange("registrationNumber", event.target.value)}
            value={values.registrationNumber}
          />
          <FieldError
            id="k9-edit-registration-error"
            message={errors.registrationNumber}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Raça{requiredMark}</span>
          <Input
            aria-describedby={errors.breed ? "k9-edit-breed-error" : undefined}
            aria-invalid={errors.breed ? true : undefined}
            onChange={(event) => onChange("breed", event.target.value)}
            value={values.breed}
          />
          <FieldError id="k9-edit-breed-error" message={errors.breed} />
        </label>

        <label className="block">
          <span className={labelClass}>Sexo{requiredMark}</span>
          <select
            aria-describedby={errors.sex ? "k9-edit-sex-error" : undefined}
            aria-invalid={errors.sex ? true : undefined}
            className="h-11 w-full rounded-xl border border-cyan-300/15 bg-slate-950/70 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
            onChange={(event) => onChange("sex", event.target.value)}
            value={knownSex ? values.sex : ""}
          >
            <option value="">Selecione</option>
            <option value="M">Macho</option>
            <option value="F">Fêmea</option>
          </select>
          <FieldError id="k9-edit-sex-error" message={errors.sex} />
          {!knownSex && values.sex ? (
            <span className="mt-1.5 block text-[11px] text-amber-200">
              Valor legado não reconhecido ({values.sex}). Selecione o sexo.
            </span>
          ) : null}
        </label>
      </div>

      <label className="block sm:max-w-[16rem]">
        <span className={labelClass}>
          Data de nascimento{requiredMark}
        </span>
        <Input
          aria-describedby={errors.birthDate ? "k9-edit-birthdate-error" : undefined}
          aria-invalid={errors.birthDate ? true : undefined}
          className="[color-scheme:dark]"
          onChange={(event) => onChange("birthDate", event.target.value)}
          type="date"
          value={values.birthDate}
        />
        <FieldError id="k9-edit-birthdate-error" message={errors.birthDate} />
      </label>
    </div>
  );
}

/**
 * Optional identity traits. All three are clearable at the backend, so an
 * emptied field becomes an explicit clearFields entry — never a null.
 */
export function K9EditTraits({
  errors,
  onChange,
  values,
}: {
  errors: K9EditFieldErrors;
  onChange: <K extends keyof K9EditIdentityValues>(
    key: K,
    value: K9EditIdentityValues[K],
  ) => void;
  values: K9EditIdentityValues;
}) {
  return (
    // Microchip holds a 16-digit value, so three columns only from `lg:`.
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block">
        <span className={labelClass}>Pelagem / cor</span>
        <Input
          onChange={(event) => onChange("color", event.target.value)}
          value={values.color}
        />
        <FieldError id="k9-edit-color-error" message={errors.color} />
      </label>

      <label className="block">
        <span className={labelClass}>Porte</span>
        <Input
          onChange={(event) => onChange("size", event.target.value)}
          value={values.size}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Microchip</span>
        <Input
          onChange={(event) => onChange("microchip", event.target.value)}
          value={values.microchip}
        />
      </label>
    </div>
  );
}

export function K9EditNotes({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className={labelClass}>Observações administrativas</span>
      <textarea
        className="min-h-[7rem] w-full rounded-xl border border-cyan-300/15 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
        maxLength={800}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Anotações administrativas do cadastro"
        value={value}
      />
      <span className="mt-1.5 block text-[11px] text-slate-500">
        {value.length}/800
      </span>
    </label>
  );
}
