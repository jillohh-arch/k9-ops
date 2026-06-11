"use client";

import { FileUp, LoaderCircle, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  saveHumanCertification,
  saveHumanDocument,
  saveHumanMovement,
  uploadHumanDocument,
  type HumanCertificationInput,
  type HumanMovementInput,
} from "@/features/effective/data/human-admin-service";

const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/35";

function DialogShell({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-cyan-200/16 bg-[#091525] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black text-white">{title}</h2>
          <button
            className="rounded-lg border border-white/10 p-2 text-slate-400"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RecordFields({
  values,
  onChange,
}: {
  values: HumanCertificationInput;
  onChange: (values: HumanCertificationInput) => void;
}) {
  const set = (key: keyof HumanCertificationInput, value: string) =>
    onChange({ ...values, [key]: value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="mb-2 block text-xs font-semibold text-slate-300">
          Nome *
        </span>
        <input
          className={inputClass}
          onChange={(event) => set("name", event.target.value)}
          value={values.name}
        />
      </label>
      <label>
        <span className="mb-2 block text-xs font-semibold text-slate-300">
          Tipo
        </span>
        <input
          className={inputClass}
          onChange={(event) => set("type", event.target.value)}
          value={values.type}
        />
      </label>
      <label>
        <span className="mb-2 block text-xs font-semibold text-slate-300">
          Categoria
        </span>
        <input
          className={inputClass}
          onChange={(event) => set("category", event.target.value)}
          value={values.category}
        />
      </label>
      <label>
        <span className="mb-2 block text-xs font-semibold text-slate-300">
          Emissor
        </span>
        <input
          className={inputClass}
          onChange={(event) => set("issuer", event.target.value)}
          value={values.issuer}
        />
      </label>
      <label>
        <span className="mb-2 block text-xs font-semibold text-slate-300">
          Emissao
        </span>
        <input
          className={inputClass}
          onChange={(event) => set("issuedAt", event.target.value)}
          type="date"
          value={values.issuedAt}
        />
      </label>
      <label>
        <span className="mb-2 block text-xs font-semibold text-slate-300">
          Validade
        </span>
        <input
          className={inputClass}
          onChange={(event) => set("expiresAt", event.target.value)}
          type="date"
          value={values.expiresAt}
        />
      </label>
      <label className="sm:col-span-2">
        <span className="mb-2 block text-xs font-semibold text-slate-300">
          Observacoes
        </span>
        <textarea
          className="min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white outline-none"
          onChange={(event) => set("notes", event.target.value)}
          value={values.notes}
        />
      </label>
    </div>
  );
}

const emptyRecord: HumanCertificationInput = {
  category: "",
  documentUrl: "",
  expiresAt: "",
  fileName: "",
  issuedAt: "",
  issuer: "",
  name: "",
  notes: "",
  storagePath: "",
  type: "",
};

export function HumanRecordDialog({
  kind,
  onClose,
  ra,
}: {
  kind: "certification" | "document";
  onClose: () => void;
  ra: string;
}) {
  const [values, setValues] = useState(emptyRecord);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setError("Informe o nome do registro.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let payload = values;
      if (file) {
        const upload = await uploadHumanDocument(ra, file);
        payload = {
          ...payload,
          documentUrl: upload.url,
          fileName: upload.fileName,
          storagePath: upload.storagePath,
        };
      }
      if (kind === "certification") {
        await saveHumanCertification(ra, payload);
      } else {
        await saveHumanDocument(ra, payload);
      }
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Falha ao salvar registro.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogShell
      onClose={onClose}
      title={
        kind === "certification"
          ? "Nova certificacao"
          : "Novo documento funcional"
      }
    >
      <form className="mt-6 space-y-5" onSubmit={submit}>
        <RecordFields onChange={setValues} values={values} />
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-cyan-300/25 bg-cyan-300/[0.04] p-4 text-sm text-slate-300">
          <FileUp className="h-5 w-5 text-cyan-300" />
          <span>{file?.name ?? "Anexar PDF, imagem ou documento"}</span>
          <input
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-[#041018] disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          Salvar registro
        </button>
      </form>
    </DialogShell>
  );
}

const emptyMovement: HumanMovementInput = {
  destinationUnit: "",
  endedAt: "",
  expectedEndAt: "",
  movementType: "Transferencia",
  notes: "",
  operationalImpact: "Medio",
  ra: "",
  reason: "",
  startAt: new Date().toISOString().slice(0, 10),
  status: "Em andamento",
};

export function HumanMovementDialog({
  initialRa = "",
  onClose,
  users,
}: {
  initialRa?: string;
  onClose: () => void;
  users: Array<{ label: string; value: string }>;
}) {
  const [values, setValues] = useState({
    ...emptyMovement,
    ra: initialRa || users[0]?.value || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof HumanMovementInput, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!values.ra || !values.reason.trim()) {
      setError("Selecione o agente e informe o motivo.");
      return;
    }
    setSaving(true);
    try {
      await saveHumanMovement(values);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha ao salvar movimentacao.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogShell onClose={onClose} title="Nova movimentacao">
      <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <label>
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Agente *
          </span>
          <select
            className={`${inputClass} appearance-none`}
            onChange={(event) => set("ra", event.target.value)}
            value={values.ra}
          >
            {users.map((user) => (
              <option className="bg-[#0b1628]" key={user.value} value={user.value}>
                {user.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Tipo *
          </span>
          <select
            className={`${inputClass} appearance-none`}
            onChange={(event) => set("movementType", event.target.value)}
            value={values.movementType}
          >
            {[
              "Transferencia",
              "Afastamento medico",
              "Ferias",
              "Licenca",
              "Substituicao",
              "Retorno operacional",
            ].map((item) => (
              <option className="bg-[#0b1628]" key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Inicio *
          </span>
          <input
            className={inputClass}
            onChange={(event) => set("startAt", event.target.value)}
            type="date"
            value={values.startAt}
          />
        </label>
        <label>
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Fim previsto
          </span>
          <input
            className={inputClass}
            onChange={(event) => set("expectedEndAt", event.target.value)}
            type="date"
            value={values.expectedEndAt}
          />
        </label>
        <label>
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Status
          </span>
          <select
            className={`${inputClass} appearance-none`}
            onChange={(event) => set("status", event.target.value)}
            value={values.status}
          >
            {["Pendente", "Em andamento", "Concluida", "Cancelada"].map(
              (item) => (
                <option className="bg-[#0b1628]" key={item}>
                  {item}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Impacto operacional
          </span>
          <select
            className={`${inputClass} appearance-none`}
            onChange={(event) => set("operationalImpact", event.target.value)}
            value={values.operationalImpact}
          >
            {["Baixo", "Medio", "Alto"].map((item) => (
              <option className="bg-[#0b1628]" key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Destino / nova lotacao
          </span>
          <input
            className={inputClass}
            onChange={(event) => set("destinationUnit", event.target.value)}
            value={values.destinationUnit}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Motivo *
          </span>
          <textarea
            className="min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white outline-none"
            onChange={(event) => set("reason", event.target.value)}
            value={values.reason}
          />
        </label>
        {error ? (
          <p className="text-sm text-red-300 sm:col-span-2">{error}</p>
        ) : null}
        <button
          className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-[#041018] disabled:opacity-50 sm:col-span-2"
          disabled={saving}
          type="submit"
        >
          {saving ? "Salvando..." : "Salvar movimentacao"}
        </button>
      </form>
    </DialogShell>
  );
}
