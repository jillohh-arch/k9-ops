"use client";

import { Input } from "@/components/ui/input";

export function HumanCreateContact({
  birthDate,
  birthDateError,
  cpf,
  institutionalEmail,
  institutionalEmailError,
  notes,
  onBirthDateChange,
  onCpfChange,
  onInstitutionalEmailChange,
  onNotesChange,
  onPhoneChange,
  phone,
}: {
  birthDate: string;
  birthDateError?: string;
  cpf: string;
  institutionalEmail: string;
  institutionalEmailError?: string;
  notes: string;
  onBirthDateChange: (value: string) => void;
  onCpfChange: (value: string) => void;
  onInstitutionalEmailChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  phone: string;
}) {
  return (
    <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
          Contato / pessoal
        </h2>
        <p className="text-[11px] text-slate-500">Todos opcionais</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block" htmlFor="human-create-cpf">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            CPF
          </span>
          <Input
            id="human-create-cpf"
            inputMode="numeric"
            onChange={(e) => onCpfChange(e.target.value)}
            placeholder="Somente números"
            value={cpf}
          />
        </label>

        <label className="block" htmlFor="human-create-birthdate">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Nascimento
          </span>
          <Input
            aria-describedby={birthDateError ? "human-create-birthdate-error" : undefined}
            aria-invalid={birthDateError ? true : undefined}
            className="[color-scheme:dark]"
            id="human-create-birthdate"
            onChange={(e) => onBirthDateChange(e.target.value)}
            type="date"
            value={birthDate}
          />
          {birthDateError ? (
            <span
              className="mt-1.5 block text-[11px] text-red-300"
              id="human-create-birthdate-error"
            >
              {birthDateError}
            </span>
          ) : null}
        </label>

        <label className="block" htmlFor="human-create-phone">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Telefone
          </span>
          <Input
            id="human-create-phone"
            inputMode="tel"
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="Ex.: (11) 90000-0000"
            value={phone}
          />
        </label>

        <label className="block" htmlFor="human-create-email">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            E-mail institucional
          </span>
          <Input
            aria-describedby={
              institutionalEmailError ? "human-create-email-error" : undefined
            }
            aria-invalid={institutionalEmailError ? true : undefined}
            id="human-create-email"
            inputMode="email"
            onChange={(e) => onInstitutionalEmailChange(e.target.value)}
            placeholder="nome@instituicao.gov.br"
            type="email"
            value={institutionalEmail}
          />
          {institutionalEmailError ? (
            <span className="mt-1.5 block text-[11px] text-red-300" id="human-create-email-error">
              {institutionalEmailError}
            </span>
          ) : null}
        </label>

        <label className="block sm:col-span-2" htmlFor="human-create-notes">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Observações
          </span>
          <textarea
            aria-describedby="human-create-notes-counter"
            className="min-h-28 w-full rounded-xl border border-cyan-300/15 bg-slate-950/70 p-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
            id="human-create-notes"
            maxLength={800}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Informações administrativas adicionais"
            value={notes}
          />
          <span
            className="mt-1 block text-right text-[11px] text-slate-500"
            id="human-create-notes-counter"
          >
            {notes.length}/800
          </span>
        </label>
      </div>
    </section>
  );
}
