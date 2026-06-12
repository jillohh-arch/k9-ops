"use client";

import {
  FileText,
  HeartPulse,
  LoaderCircle,
  Pill,
  Scale,
  Stethoscope,
  Syringe,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import {
  createHealthDocument,
  createHealthEvent,
  createHealthWeight,
} from "@/features/health/data/health-admin-service";
import type { HealthDogSummary } from "@/features/health/hooks/use-health-data";
import { cn } from "@/lib/utils";

export type HealthHubSection =
  | "clinical"
  | "document"
  | "medication"
  | "vaccination"
  | "weight";

const sections: Array<{
  description: string;
  icon: LucideIcon;
  id: HealthHubSection;
  label: string;
}> = [
  {
    description: "Dose aplicada e proximo vencimento",
    icon: Syringe,
    id: "vaccination",
    label: "Vacina",
  },
  {
    description: "Novo registro canonico de peso",
    icon: Scale,
    id: "weight",
    label: "Pesagem",
  },
  {
    description: "Exame ou consulta veterinaria",
    icon: Stethoscope,
    id: "clinical",
    label: "Exame / consulta",
  },
  {
    description: "Produto, protocolo ou tratamento",
    icon: Pill,
    id: "medication",
    label: "Medicacao",
  },
  {
    description: "Laudo, atestado ou documento",
    icon: FileText,
    id: "document",
    label: "Documento",
  },
];

function localDateInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
      .replace(/^Firebase:\s*/i, "")
      .replace(/\s*\(functions\/[^)]+\)\.?$/i, "");
  }
  return "Nao foi possivel salvar o registro.";
}

function Field({
  children,
  label,
  required,
}: {
  children: React.ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
        {required ? <span className="text-cyan-300"> *</span> : null}
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35";

export function HealthEventHub({
  dogs,
  initialDogId = "",
  initialSection = "vaccination",
  onClose,
  onSaved,
  open,
}: {
  dogs: Array<Pick<HealthDogSummary, "dogId" | "dogName">>;
  initialDogId?: string;
  initialSection?: HealthHubSection;
  onClose: () => void;
  onSaved: (message: string) => void;
  open: boolean;
}) {
  const [section, setSection] = useState<HealthHubSection>(initialSection);
  const [dogId, setDogId] = useState(initialDogId);
  const [date, setDate] = useState(localDateInput);
  const [nextDueDate, setNextDueDate] = useState("");
  const [subtype, setSubtype] = useState("");
  const [observations, setObservations] = useState("");
  const [vetName, setVetName] = useState("");
  const [professionalCrmv, setProfessionalCrmv] = useState("");
  const [professionalClinic, setProfessionalClinic] = useState("");
  const [costBrl, setCostBrl] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [weightContext, setWeightContext] = useState("canil");
  const [clinicalType, setClinicalType] =
    useState<"consultation" | "exam">("exam");
  const [documentType, setDocumentType] = useState("laudo");
  const [documentIssuer, setDocumentIssuer] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedDogId = dogId || dogs[0]?.dogId || "";

  const selectedDog = useMemo(
    () => dogs.find((dog) => dog.dogId === resolvedDogId) ?? null,
    [dogs, resolvedDogId],
  );

  function resetForm() {
    setDate(localDateInput());
    setNextDueDate("");
    setSubtype("");
    setObservations("");
    setVetName("");
    setProfessionalCrmv("");
    setProfessionalClinic("");
    setCostBrl("");
    setAttachmentFile(null);
    setWeightKg("");
    setWeightContext("canil");
    setClinicalType("exam");
    setDocumentType("laudo");
    setDocumentIssuer("");
    setDocumentFile(null);
    setError(null);
  }

  function close() {
    if (saving) return;
    resetForm();
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!resolvedDogId) {
      setError("Selecione o K9.");
      return;
    }

    setSaving(true);
    try {
      if (section === "weight") {
        if (!weightKg.trim()) throw new Error("Informe o peso.");
        await createHealthWeight({
          context: weightContext,
          dogId: resolvedDogId,
          measuredAt: date,
          notes: observations,
          weightKg,
        });
      } else if (section === "document") {
        if (!subtype.trim()) throw new Error("Informe o nome do documento.");
        if (!documentFile) throw new Error("Selecione o arquivo.");
        await createHealthDocument({
          description: observations,
          dogId: resolvedDogId,
          file: documentFile,
          issuer: documentIssuer,
          name: subtype,
          type: documentType,
        });
      } else {
        if (!subtype.trim()) {
          throw new Error(
            section === "vaccination"
              ? "Informe a vacina."
              : section === "medication"
                ? "Informe o medicamento."
                : "Informe o exame ou consulta.",
          );
        }
        await createHealthEvent({
          attachmentFile,
          costBrl,
          date,
          dogId: resolvedDogId,
          healthObservations: observations,
          nextDueDate,
          professionalClinic,
          professionalCrmv,
          subtype,
          type:
            section === "vaccination"
              ? "vaccination"
              : section === "medication"
                ? "medication"
                : clinicalType,
          vetName,
        });
      }

      const sectionLabel =
        sections.find((item) => item.id === section)?.label ?? "Registro";
      onSaved(`${sectionLabel} salvo para ${selectedDog?.dogName ?? "o K9"}.`);
      resetForm();
      onClose();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
    >
      <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-[1.75rem] border border-cyan-200/15 bg-[#081426] shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/8 bg-[#081426]/95 p-5 backdrop-blur md:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <HeartPulse className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-black text-white">
                Registrar evento de saude
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                O registro entra no prontuario e recalcula a prontidao.
              </p>
            </div>
          </div>
          <button
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition hover:text-white"
            onClick={close}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="grid gap-5 p-5 md:p-6 xl:grid-cols-[300px_1fr]" onSubmit={submit}>
          <aside className="space-y-3">
            {sections.map((item) => (
              <button
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                  section === item.id
                    ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                    : "border-white/8 bg-white/[0.025] text-slate-300 hover:border-cyan-200/18",
                )}
                key={item.id}
                onClick={() => {
                  setSection(item.id);
                  setError(null);
                }}
                type="button"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-current/20 bg-black/15">
                  <item.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-black">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {item.description}
                  </span>
                </span>
              </button>
            ))}
          </aside>

          <div className="rounded-[1.5rem] border border-white/8 bg-black/15 p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="K9" required>
                <select
                  className={inputClass}
                  onChange={(event) => setDogId(event.target.value)}
                  required
                  value={resolvedDogId}
                >
                  <option className="bg-[#0b1628]" value="">
                    Selecione
                  </option>
                  {dogs.map((dog) => (
                    <option
                      className="bg-[#0b1628]"
                      key={dog.dogId}
                      value={dog.dogId}
                    >
                      {dog.dogName}
                    </option>
                  ))}
                </select>
              </Field>
              {section !== "document" ? (
                <Field
                  label={section === "weight" ? "Data da pesagem" : "Data do evento"}
                  required
                >
                  <input
                    className={inputClass}
                    onChange={(event) => setDate(event.target.value)}
                    required
                    type="date"
                    value={date}
                  />
                </Field>
              ) : (
                <Field label="Tipo do documento" required>
                  <select
                    className={inputClass}
                    onChange={(event) => setDocumentType(event.target.value)}
                    value={documentType}
                  >
                    <option className="bg-[#0b1628]" value="laudo">
                      Laudo
                    </option>
                    <option className="bg-[#0b1628]" value="atestado">
                      Atestado
                    </option>
                    <option className="bg-[#0b1628]" value="exame">
                      Exame
                    </option>
                    <option className="bg-[#0b1628]" value="documento">
                      Outro documento
                    </option>
                  </select>
                </Field>
              )}

              {section === "weight" ? (
                <>
                  <Field label="Peso (kg)" required>
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      max="100"
                      min="1"
                      onChange={(event) => setWeightKg(event.target.value)}
                      placeholder="Ex.: 27,4"
                      required
                      step="0.1"
                      type="number"
                      value={weightKg}
                    />
                  </Field>
                  <Field label="Local / contexto">
                    <select
                      className={inputClass}
                      onChange={(event) => setWeightContext(event.target.value)}
                      value={weightContext}
                    >
                      <option className="bg-[#0b1628]" value="canil">
                        Canil
                      </option>
                      <option className="bg-[#0b1628]" value="clinica_vet">
                        Clinica veterinaria
                      </option>
                      <option className="bg-[#0b1628]" value="casa">
                        Residencia
                      </option>
                      <option className="bg-[#0b1628]" value="outro">
                        Outro
                      </option>
                    </select>
                  </Field>
                </>
              ) : section === "document" ? (
                <>
                  <Field label="Nome do documento" required>
                    <input
                      className={inputClass}
                      onChange={(event) => setSubtype(event.target.value)}
                      placeholder="Ex.: Hemograma completo"
                      required
                      value={subtype}
                    />
                  </Field>
                  <Field label="Emissor">
                    <input
                      className={inputClass}
                      onChange={(event) => setDocumentIssuer(event.target.value)}
                      placeholder="Clinica ou profissional"
                      value={documentIssuer}
                    />
                  </Field>
                  <Field label="Arquivo" required>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-cyan-300/25 bg-cyan-300/[0.05] px-3 text-sm text-cyan-100">
                      <Upload className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {documentFile?.name ?? "Selecionar PDF, imagem, DOC ou DOCX"}
                      </span>
                      <input
                        accept="image/*,.pdf,.doc,.docx"
                        className="sr-only"
                        onChange={(event) =>
                          setDocumentFile(event.target.files?.[0] ?? null)
                        }
                        required
                        type="file"
                      />
                    </label>
                  </Field>
                </>
              ) : (
                <>
                  {section === "clinical" ? (
                    <Field label="Atendimento" required>
                      <select
                        className={inputClass}
                        onChange={(event) =>
                          setClinicalType(
                            event.target.value as "consultation" | "exam",
                          )
                        }
                        value={clinicalType}
                      >
                        <option className="bg-[#0b1628]" value="exam">
                          Exame
                        </option>
                        <option className="bg-[#0b1628]" value="consultation">
                          Consulta
                        </option>
                      </select>
                    </Field>
                  ) : null}
                  <Field
                    label={
                      section === "vaccination"
                        ? "Vacina"
                        : section === "medication"
                          ? "Medicamento / protocolo"
                          : "Exame / consulta"
                    }
                    required
                  >
                    <input
                      className={inputClass}
                      onChange={(event) => setSubtype(event.target.value)}
                      placeholder={
                        section === "vaccination"
                          ? "Ex.: V10"
                          : section === "medication"
                            ? "Ex.: Bravecto"
                            : "Ex.: Hemograma completo"
                      }
                      required
                      value={subtype}
                    />
                  </Field>
                  <Field
                    label={
                      section === "vaccination"
                        ? "Proxima dose"
                        : "Retorno / proxima avaliacao"
                    }
                  >
                    <input
                      className={inputClass}
                      onChange={(event) => setNextDueDate(event.target.value)}
                      type="date"
                      value={nextDueDate}
                    />
                  </Field>
                  <Field label="Profissional">
                    <input
                      className={inputClass}
                      onChange={(event) => setVetName(event.target.value)}
                      placeholder="Nome do veterinario"
                      value={vetName}
                    />
                  </Field>
                  <Field label="CRMV">
                    <input
                      className={inputClass}
                      onChange={(event) => setProfessionalCrmv(event.target.value)}
                      placeholder="Ex.: CRMV-SP 12345"
                      value={professionalCrmv}
                    />
                  </Field>
                  <Field label="Clinica">
                    <input
                      className={inputClass}
                      onChange={(event) =>
                        setProfessionalClinic(event.target.value)
                      }
                      placeholder="Clinica ou unidade"
                      value={professionalClinic}
                    />
                  </Field>
                  <Field label="Custo (R$)">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => setCostBrl(event.target.value)}
                      placeholder="0,00"
                      step="0.01"
                      type="number"
                      value={costBrl}
                    />
                  </Field>
                  <Field label="Anexo">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-cyan-300/20 bg-cyan-300/[0.035] px-3 text-sm text-slate-300">
                      <Upload className="h-4 w-4 shrink-0 text-cyan-200" />
                      <span className="truncate">
                        {attachmentFile?.name ?? "Anexar arquivo opcional"}
                      </span>
                      <input
                        accept="image/*,.pdf,.doc,.docx"
                        className="sr-only"
                        onChange={(event) =>
                          setAttachmentFile(event.target.files?.[0] ?? null)
                        }
                        type="file"
                      />
                    </label>
                  </Field>
                </>
              )}
            </div>

            <div className="mt-4">
              <Field
                label={
                  section === "document"
                    ? "Descricao"
                    : section === "weight"
                      ? "Observacoes da pesagem"
                      : "Observacoes"
                }
              >
                <textarea
                  className="min-h-28 w-full resize-y rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
                  onChange={(event) => setObservations(event.target.value)}
                  placeholder="Informacoes relevantes para o prontuario..."
                  value={observations}
                />
              </Field>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-300/20 bg-red-300/[0.06] px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-white/8 pt-5 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300"
                disabled={saving}
                onClick={close}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-[#031018] shadow-[0_0_28px_rgba(34,211,238,0.16)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving || dogs.length === 0}
                type="submit"
              >
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <HeartPulse className="h-4 w-4" />
                )}
                {saving ? "Salvando..." : "Salvar registro"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
