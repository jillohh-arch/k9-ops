"use client";

import {
  Archive,
  ArrowLeft,
  Camera,
  Car,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Save,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  archiveVehicle,
  emptyVehicleFormValues,
  loadVehicleForEdit,
  saveVehicle,
  type VehicleFormValues,
} from "@/features/effective/data/vehicle-admin-service";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35";

type VehicleFormTab = "identity" | "operation" | "documents" | "technical";

const vehicleFormTabs: Array<{
  id: VehicleFormTab;
  label: string;
}> = [
  { id: "identity", label: "Identificacao" },
  { id: "operation", label: "Operacional" },
  { id: "documents", label: "Documentacao" },
  { id: "technical", label: "Dados tecnicos" },
];

function Field({
  children,
  error,
  label,
  required,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-300">
        {label} {required ? <span className="text-red-300">*</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : null}
    </label>
  );
}

function Section({
  active,
  children,
  icon: Icon,
  title,
}: {
  active: boolean;
  children: React.ReactNode;
  icon: typeof Car;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5",
        !active && "hidden",
      )}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-black text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function validate(values: VehicleFormValues) {
  const errors: Partial<Record<keyof VehicleFormValues, string>> = {};
  if (!values.prefix.trim()) errors.prefix = "Informe o prefixo.";
  if (!values.name.trim()) errors.name = "Informe o nome operacional.";
  if (!values.plate.trim()) errors.plate = "Informe a placa.";
  if (!values.model.trim()) errors.model = "Informe o modelo.";
  if (!values.unit.trim()) errors.unit = "Informe a lotacao/base.";
  if (!values.crewSize.trim()) errors.crewSize = "Informe a capacidade da guarnicao.";
  return errors;
}

export function VehicleAdminForm({
  mode,
  vehicleId,
}: {
  mode: "create" | "edit";
  vehicleId?: string;
}) {
  const router = useRouter();
  const { can } = useAccessControl();
  const [values, setValues] = useState<VehicleFormValues>(emptyVehicleFormValues);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [activeFormTab, setActiveFormTab] =
    useState<VehicleFormTab>("identity");
  const canSaveVehicle = can("vehicles", mode === "create" ? "create" : "edit");
  const canArchiveVehicle = can("vehicles", "archive");
  const preview = photoFile ? URL.createObjectURL(photoFile) : values.photoUrl;

  useEffect(() => {
    if (mode !== "edit" || !vehicleId) return;
    let alive = true;
    loadVehicleForEdit(vehicleId)
      .then((loaded) => {
        if (!alive) return;
        if (loaded) setValues(loaded);
        else setError("Viatura nao localizada.");
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [mode, vehicleId]);

  const errors = useMemo(() => validate(values), [values]);
  const checklist = [
    !errors.prefix && !errors.name && !errors.plate,
    !errors.model && values.brand.trim() && values.year.trim(),
    !errors.unit && values.status.trim(),
    values.renavam.trim() || values.chassis.trim() || values.documentValidUntil.trim(),
  ];

  function setField<K extends keyof VehicleFormValues>(
    field: K,
    value: VehicleFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveVehicle) {
      setError(
        mode === "create"
          ? "Seu perfil nao permite cadastrar viaturas."
          : "Seu perfil nao permite editar viaturas.",
      );
      return;
    }
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length) {
      setError("Preencha os campos obrigatorios da viatura.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await saveVehicle(mode, values, photoFile);
      router.push(`/vehicles/${encodeURIComponent(id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function confirmArchive() {
    if (!canArchiveVehicle) {
      setError("Seu perfil nao permite arquivar viaturas.");
      setArchiveOpen(false);
      return;
    }
    if (!vehicleId) return;
    setArchiving(true);
    setError(null);
    try {
      await archiveVehicle(vehicleId, archiveReason);
      router.push(paths.vehicles);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
        Carregando cadastro da viatura...
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-300"
            href={paths.vehicles}
          >
            <ArrowLeft className="h-4 w-4" />
            Viaturas
          </Link>
          <h1 className="mt-3 text-3xl font-black text-white">
            {mode === "create" ? "Cadastrar Viatura" : "Editar Viatura"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Cadastro patrimonial e operacional da frota K9.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-black text-[#041018] disabled:opacity-50"
          disabled={saving || !canSaveVehicle}
          type="submit"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar viatura
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300/15 bg-red-300/[0.04] px-4 py-3 text-sm text-red-200/80">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        <div className="space-y-5">
          <nav className="grid gap-2 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-3 md:grid-cols-4">
            {vehicleFormTabs.map((tab) => (
              <button
                className={cn(
                  "rounded-2xl border px-3 py-2.5 text-left text-xs font-black transition",
                  activeFormTab === tab.id
                    ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-100"
                    : "border-white/10 bg-white/[0.025] text-slate-500 hover:text-slate-200",
                )}
                key={tab.id}
                onClick={() => setActiveFormTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <Section
            active={activeFormTab === "identity"}
            icon={Car}
            title="1. Identificacao"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field error={errors.prefix} label="Prefixo" required>
                <input
                  className={inputClass}
                  disabled={mode === "edit"}
                  onChange={(event) => setField("prefix", event.target.value)}
                  placeholder="Ex.: 1075"
                  value={values.prefix}
                />
              </Field>
              <Field error={errors.name} label="Nome operacional" required>
                <input
                  className={inputClass}
                  onChange={(event) => setField("name", event.target.value)}
                  placeholder="Ex.: Canil"
                  value={values.name}
                />
              </Field>
              <Field error={errors.plate} label="Placa" required>
                <input
                  className={inputClass}
                  onChange={(event) => setField("plate", event.target.value.toUpperCase())}
                  placeholder="Ex.: QXY-1B23"
                  value={values.plate}
                />
              </Field>
              <Field error={errors.model} label="Modelo" required>
                <input
                  className={inputClass}
                  onChange={(event) => setField("model", event.target.value)}
                  placeholder="Ex.: Toyota Hilux"
                  value={values.model}
                />
              </Field>
              <Field label="Marca">
                <input
                  className={inputClass}
                  onChange={(event) => setField("brand", event.target.value)}
                  value={values.brand}
                />
              </Field>
              <Field label="Ano">
                <input
                  className={inputClass}
                  onChange={(event) => setField("year", event.target.value)}
                  value={values.year}
                />
              </Field>
              <Field label="Tipo">
                <select
                  className={`${inputClass} appearance-none`}
                  onChange={(event) => setField("type", event.target.value)}
                  value={values.type}
                >
                  {["Operacional K9", "Apoio", "Reserva", "Administrativa"].map((item) => (
                    <option className="bg-[#0b1628]" key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  className={`${inputClass} appearance-none`}
                  onChange={(event) => setField("status", event.target.value)}
                  value={values.status}
                >
                  {["Ativa", "Em manutencao", "Reserva", "Baixada"].map((item) => (
                    <option className="bg-[#0b1628]" key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section
            active={activeFormTab === "operation"}
            icon={CheckCircle2}
            title="2. Vinculacao operacional"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field error={errors.unit} label="Lotacao / Unidade" required>
                <input
                  className={inputClass}
                  onChange={(event) => setField("unit", event.target.value)}
                  value={values.unit}
                />
              </Field>
              <Field label="Base">
                <input
                  className={inputClass}
                  onChange={(event) => setField("base", event.target.value)}
                  placeholder="Ex.: Canil Central"
                  value={values.base}
                />
              </Field>
              <Field error={errors.crewSize} label="Tamanho da guarnicao" required>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  onChange={(event) => setField("crewSize", event.target.value.replace(/\D/g, ""))}
                  value={values.crewSize}
                />
              </Field>
              <Field label="Capacidade">
                <input
                  className={inputClass}
                  onChange={(event) => setField("capacity", event.target.value)}
                  value={values.capacity}
                />
              </Field>
            </div>
            <textarea
              className="mt-4 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              onChange={(event) => setField("notes", event.target.value)}
              placeholder="Observacoes operacionais, restricoes, disponibilidade..."
              value={values.notes}
            />
          </Section>

          <div className="grid gap-5 xl:grid-cols-2">
            <Section
              active={activeFormTab === "documents"}
              icon={FileText}
              title="3. Documentacao"
            >
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ["renavam", "Renavam"],
                  ["chassis", "Chassi"],
                  ["licensing", "Licenciamento"],
                  ["insurance", "Seguro"],
                  ["documentValidUntil", "Validade do documento"],
                ].map(([field, label]) => (
                  <Field key={field} label={label}>
                    <input
                      className={inputClass}
                      onChange={(event) =>
                        setField(field as keyof VehicleFormValues, event.target.value)
                      }
                      type={field === "documentValidUntil" ? "date" : "text"}
                      value={values[field as keyof VehicleFormValues] as string}
                    />
                  </Field>
                ))}
              </div>
            </Section>

            <Section
              active={activeFormTab === "technical"}
              icon={Wrench}
              title="4. Dados tecnicos"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Cor">
                  <input className={inputClass} onChange={(event) => setField("color", event.target.value)} value={values.color} />
                </Field>
                <Field label="Combustivel">
                  <input className={inputClass} onChange={(event) => setField("fuel", event.target.value)} value={values.fuel} />
                </Field>
                <Field label="Quilometragem">
                  <input className={inputClass} inputMode="numeric" onChange={(event) => setField("mileageKm", event.target.value.replace(/[^\d,.]/g, ""))} value={values.mileageKm} />
                </Field>
                <Field label="Proxima revisao">
                  <input className={inputClass} onChange={(event) => setField("nextReviewAt", event.target.value)} type="date" value={values.nextReviewAt} />
                </Field>
                <Field label="Km da proxima revisao">
                  <input className={inputClass} inputMode="numeric" onChange={(event) => setField("nextReviewKm", event.target.value.replace(/[^\d,.]/g, ""))} value={values.nextReviewKm} />
                </Field>
                <Field label="Status de manutencao">
                  <input className={inputClass} onChange={(event) => setField("maintenanceStatus", event.target.value)} value={values.maintenanceStatus} />
                </Field>
              </div>
              <textarea
                className="mt-4 min-h-20 w-full resize-y rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
                onChange={(event) => setField("accessories", event.target.value)}
                placeholder="Acessorios, compartimentos, radio, giroflex..."
                value={values.accessories}
              />
            </Section>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-cyan-300/20 bg-[#0b1628]/88 p-5">
            <h2 className="text-sm font-black text-white">Previa da viatura</h2>
            <div className="relative mt-5 h-44 overflow-hidden rounded-2xl border border-white/8 bg-cyan-300/[0.04]">
              {preview ? (
                <Image alt="" className="object-cover" fill src={preview} unoptimized />
              ) : (
                <div className="flex h-full items-center justify-center text-cyan-200/35">
                  <Car className="h-16 w-16" />
                </div>
              )}
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-300/20 px-4 py-3 text-sm font-bold text-cyan-200">
              <Camera className="h-4 w-4" />
              Foto da viatura
              <input
                accept="image/*"
                className="hidden"
                onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            <div className="mt-5 space-y-2 text-xs">
              {[
                ["Prefixo", values.prefix || "--"],
                ["Nome", `${values.name || "Viatura"} ${values.prefix || ""}`.trim()],
                ["Placa", values.plate || "--"],
                ["Modelo", values.model || "--"],
                ["Lotacao", values.unit || "--"],
                ["Status", values.status || "--"],
              ].map(([label, value]) => (
                <div className="flex justify-between gap-4" key={label}>
                  <span className="text-slate-500">{label}</span>
                  <span className="text-right font-semibold text-slate-200">{value}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-3xl border border-white/8 bg-[#0b1628]/72 p-5">
            <h2 className="text-sm font-black text-white">Checklist</h2>
            <div className="mt-4 space-y-2">
              {["Identificacao", "Dados tecnicos", "Vinculacao", "Documentacao"].map((item, index) => (
                <div className="flex items-center justify-between text-xs" key={item}>
                  <span className="text-slate-400">{item}</span>
                  <span className={cn(checklist[index] ? "text-emerald-300" : "text-slate-600")}>
                    {checklist[index] ? "Completo" : "Pendente"}
                  </span>
                </div>
              ))}
            </div>
          </section>
          {mode === "edit" && canArchiveVehicle ? (
            <button
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/25 px-4 py-3 text-sm font-bold text-red-200"
              onClick={() => setArchiveOpen(true)}
              type="button"
            >
              <Archive className="h-4 w-4" /> Arquivar viatura
            </button>
          ) : null}
        </aside>
      </div>

      {archiveOpen && canArchiveVehicle ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-md rounded-3xl border border-red-300/20 bg-[#091525] p-6">
            <h2 className="text-xl font-black text-white">Arquivar viatura</h2>
            <p className="mt-2 text-sm text-slate-400">
              A viatura sai da lista operacional, mas o historico permanece.
            </p>
            <textarea
              className="mt-5 min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white outline-none"
              onChange={(event) => setArchiveReason(event.target.value)}
              placeholder="Motivo obrigatorio"
              value={archiveReason}
            />
            <div className="mt-5 flex gap-3">
              <button className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300" onClick={() => setArchiveOpen(false)} type="button">
                Cancelar
              </button>
              <button
                className="flex-1 rounded-xl bg-red-400 px-4 py-3 text-sm font-black text-[#170607] disabled:opacity-50"
                disabled={archiveReason.trim().length < 5 || archiving}
                onClick={confirmArchive}
                type="button"
              >
                {archiving ? "Arquivando..." : "Arquivar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
