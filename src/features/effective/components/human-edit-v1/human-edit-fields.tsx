"use client";

import { Input } from "@/components/ui/input";

import type { HumanEditField, HumanEditPersonnel } from "./human-edit-types";

/** Erros de campo locais da UI — não vazam para o A1 congelado. */
export type HumanEditFieldErrors = Partial<
  Record<HumanEditField | "form", string>
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

type FieldProps = {
  errors: HumanEditFieldErrors;
  onChange: (key: HumanEditField, value: string) => void;
  values: HumanEditPersonnel;
};

function TextField({
  errors,
  field,
  label,
  onChange,
  required,
  type = "text",
  values,
}: FieldProps & {
  field: HumanEditField;
  label: string;
  required?: boolean;
  type?: "text" | "date" | "email";
}) {
  const id = `human-edit-${field}`;
  const errorId = `${id}-error`;
  const message = errors[field];
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
        {required ? requiredMark : null}
      </label>
      <Input
        aria-describedby={message ? errorId : undefined}
        aria-invalid={message ? true : undefined}
        id={id}
        onChange={(event) => onChange(field, event.target.value)}
        type={type}
        value={values[field]}
      />
      <FieldError id={errorId} message={message} />
    </div>
  );
}

/**
 * IDENTIFICAÇÃO — RA imutável (fora do modelo de rascunho) + os dois campos
 * obrigatórios e os documentos pessoais.
 */
export function HumanEditIdentification({
  errors,
  onChange,
  ra,
  values,
}: FieldProps & { ra: string }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <span className={labelClass} id="human-edit-ra-label">
            RA
          </span>
          {/*
            RA é a IDENTIDADE do registro: exibido como valor de contexto
            somente leitura, deliberadamente fora do rascunho de 12 campos —
            não existe input, então não há como editá-lo nesta tela.
          */}
          <p
            aria-labelledby="human-edit-ra-label"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-semibold text-slate-400"
            data-testid="human-edit-ra-readonly"
          >
            {ra}
          </p>
        </div>
        <TextField
          errors={errors}
          field="fullName"
          label="Nome completo"
          onChange={onChange}
          required
          values={values}
        />
        <TextField
          errors={errors}
          field="callsign"
          label="Nome de guerra"
          onChange={onChange}
          required
          values={values}
        />
        <TextField
          errors={errors}
          field="cpf"
          label="CPF"
          onChange={onChange}
          values={values}
        />
        <TextField
          errors={errors}
          field="birthDate"
          label="Data de nascimento"
          onChange={onChange}
          type="date"
          values={values}
        />
      </div>
    </div>
  );
}

/** DADOS FUNCIONAIS — posto, cargo, lotação, equipe, admissão. */
export function HumanEditFunctionalData({
  errors,
  onChange,
  values,
}: FieldProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TextField
        errors={errors}
        field="rank"
        label="Posto / graduação"
        onChange={onChange}
        values={values}
      />
      <TextField
        errors={errors}
        field="cargo"
        label="Função"
        onChange={onChange}
        values={values}
      />
      <TextField
        errors={errors}
        field="unit"
        label="Unidade / lotação"
        onChange={onChange}
        values={values}
      />
      <TextField
        errors={errors}
        field="team"
        label="Equipe"
        onChange={onChange}
        values={values}
      />
      <TextField
        errors={errors}
        field="admissionDate"
        label="Data de admissão"
        onChange={onChange}
        type="date"
        values={values}
      />
    </div>
  );
}

/** CONTATO E OBSERVAÇÕES — telefone, e-mail institucional, observações. */
export function HumanEditContactNotes({
  errors,
  onChange,
  values,
}: FieldProps) {
  const notesId = "human-edit-notes";
  const notesErrorId = `${notesId}-error`;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <TextField
          errors={errors}
          field="phone"
          label="Telefone"
          onChange={onChange}
          values={values}
        />
        <TextField
          errors={errors}
          field="institutionalEmail"
          label="E-mail institucional"
          onChange={onChange}
          type="email"
          values={values}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor={notesId}>
          Observações
        </label>
        <textarea
          aria-describedby={errors.notes ? notesErrorId : undefined}
          className="min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
          id={notesId}
          onChange={(event) => onChange("notes", event.target.value)}
          value={values.notes}
        />
        <FieldError id={notesErrorId} message={errors.notes} />
      </div>
    </div>
  );
}
