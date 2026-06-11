"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Camera,
  Check,
  CircleAlert,
  Dog,
  HeartPulse,
  IdCard,
  LoaderCircle,
  LockKeyhole,
  Save,
  Scale,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useAuth } from "@/features/auth/providers/auth-provider";
import {
  archiveK9,
  emptyK9FormValues,
  loadK9ForEdit,
  loadK9FormOptions,
  saveK9,
  type K9FormOptions,
  type K9FormValues,
} from "@/features/effective/data/k9-admin-service";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05]";

const selectClass = `${inputClass} appearance-none`;

type FieldErrors = Partial<Record<keyof K9FormValues | "form", string>>;
type K9FormTab = "identity" | "physical" | "specialties" | "notes";

const k9FormTabs: Array<{
  id: K9FormTab;
  label: string;
}> = [
  { id: "identity", label: "Identificacao" },
  { id: "physical", label: "Saude e vinculo" },
  { id: "specialties", label: "Modalidades" },
  { id: "notes", label: "Observacoes" },
];

function parseNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function validate(values: K9FormValues) {
  const errors: FieldErrors = {};
  if (!values.name.trim()) errors.name = "Informe o nome operacional.";
  if (!values.registrationNumber.trim()) {
    errors.registrationNumber = "Informe a matricula/RGA.";
  }
  if (!values.breed.trim()) errors.breed = "Informe a raca.";
  if (!values.birthDate) errors.birthDate = "Informe a data de nascimento.";
  if (!values.color.trim()) errors.color = "Informe a cor/pelagem.";
  if (!values.sex) errors.sex = "Informe o sexo.";
  if (!values.operationalStatus) {
    errors.operationalStatus = "Informe a situacao cadastral.";
  }

  const weight = parseNumber(values.weight);
  const min = parseNumber(values.idealWeightMin);
  const max = parseNumber(values.idealWeightMax);
  if (weight == null || weight <= 0) errors.weight = "Informe o peso atual.";
  if (min == null || min <= 0) {
    errors.idealWeightMin = "Informe o peso ideal minimo.";
  }
  if (max == null || max <= 0) {
    errors.idealWeightMax = "Informe o peso ideal maximo.";
  }
  if (min != null && max != null && min >= max) {
    errors.idealWeightMax = "O maximo deve ser maior que o minimo.";
  }
  if (values.birthDate) {
    const birth = new Date(`${values.birthDate}T12:00:00`);
    if (Number.isNaN(birth.getTime()) || birth > new Date()) {
      errors.birthDate = "Data de nascimento invalida.";
    }
  }
  return errors;
}

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
        {label}
        {required ? <span className="ml-1 text-red-300">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[11px] text-red-300">{error}</span>
      ) : null}
    </label>
  );
}

function FormSection({
  active,
  children,
  icon: Icon,
  index,
  title,
}: {
  active: boolean;
  children: React.ReactNode;
  icon: typeof Dog;
  index: number;
  title: string;
}) {
  return (
    <section
      className={cn(
        "border-b border-white/8 px-5 py-6 last:border-b-0",
        !active && "hidden",
      )}
    >
      <h2 className="mb-5 flex items-center gap-2 text-sm font-black text-white">
        <Icon className="h-4 w-4 text-cyan-300" />
        {index}. {title}
      </h2>
      {children}
    </section>
  );
}

function statusLabel(status: string) {
  if (status === "Licenca") return "Licenca";
  return status;
}

export function K9AdminForm({
  dogId,
  mode,
}: {
  dogId?: string;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const { can } = useAccessControl();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<K9FormValues>(emptyK9FormValues);
  const [options, setOptions] = useState<K9FormOptions>({
    modalities: [],
    users: [],
  });
  const [initialWeight, setInitialWeight] = useState<number | null>(null);
  const [protectedSpecialties, setProtectedSpecialties] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<K9FormTab>("identity");
  const canSaveK9 = can("k9", mode === "create" ? "create" : "edit");
  const canArchiveK9 = can("k9", "archive");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [loadedOptions, loadedDog] = await Promise.all([
          loadK9FormOptions(),
          mode === "edit" && dogId ? loadK9ForEdit(dogId) : null,
        ]);
        if (!active) return;
        setOptions(loadedOptions);
        if (mode === "edit") {
          if (!loadedDog) {
            setErrors({ form: "K9 nao localizado para edicao." });
          } else {
            setValues(loadedDog.values);
            setPreviewUrl(loadedDog.values.profileImageUrl);
            setInitialWeight(parseNumber(loadedDog.values.weight));
            setProtectedSpecialties(loadedDog.protectedSpecialties);
          }
        }
      } catch (error) {
        if (!active) return;
        setErrors({
          form:
            error instanceof Error
              ? error.message
              : "Falha ao carregar o cadastro.",
        });
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [dogId, mode]);

  useEffect(
    () => () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const completedChecks = useMemo(
    () => [
      {
        done: Boolean(values.name && values.registrationNumber && values.breed),
        label: "Dados basicos",
      },
      {
        done: Boolean(
          values.weight && values.idealWeightMin && values.idealWeightMax,
        ),
        label: "Peso e faixa ideal",
      },
      {
        done: values.specialties.length > 0,
        label: "Modalidades",
      },
      {
        done: Boolean(values.conductorRa),
        label: "Condutor vinculado",
      },
    ],
    [values],
  );

  function setField<Key extends keyof K9FormValues>(
    key: Key,
    value: K9FormValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((current) => ({
        ...current,
        form: "A foto precisa ser uma imagem.",
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({
        ...current,
        form: "A foto deve ter no maximo 5 MB.",
      }));
      return;
    }
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function toggleSpecialty(value: string) {
    if (protectedSpecialties.includes(value)) return;
    setField(
      "specialties",
      values.specialties.includes(value)
        ? values.specialties.filter((item) => item !== value)
        : [...values.specialties, value],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSaveK9) {
      setErrors({
        form:
          mode === "create"
            ? "Seu perfil nao permite cadastrar K9."
            : "Seu perfil nao permite editar K9.",
      });
      return;
    }
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !profile) return;

    setSaving(true);
    try {
      const savedId = await saveK9({
        currentWeight: initialWeight,
        dogId,
        mode,
        photoFile,
        profile,
        values,
      });
      router.push(`/k9/${encodeURIComponent(savedId)}`);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error ? error.message : "Falha ao salvar o K9.",
      });
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!canArchiveK9) {
      setErrors({ form: "Seu perfil nao permite arquivar K9." });
      setArchiveOpen(false);
      return;
    }
    if (!profile || !dogId) return;
    setArchiving(true);
    try {
      await archiveK9({
        dogId,
        profile,
        reason: archiveReason,
      });
      router.push(paths.k9);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "Falha ao arquivar o cadastro.",
      });
      setArchiving(false);
      setArchiveOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-white/8 bg-[#0b1628]/75">
        <LoaderCircle className="h-7 w-7 animate-spin text-cyan-300" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <button
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-300"
            onClick={() => router.back()}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
            {mode === "create" ? "Cadastrar K9" : "Cadastro / Edicao de K9"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Dados administrativos compartilhados com o aplicativo mobile.
          </p>
        </div>
        {mode === "edit" && canArchiveK9 ? (
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/20 bg-red-300/[0.06] px-4 py-2.5 text-xs font-bold text-red-200 transition hover:bg-red-300/10"
            onClick={() => setArchiveOpen(true)}
            type="button"
          >
            <Archive className="h-4 w-4" />
            Arquivar cadastro
          </button>
        ) : null}
      </div>

      {errors.form ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          {errors.form}
        </div>
      ) : null}

      <form
        className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_310px]"
        onSubmit={handleSubmit}
      >
        <div className="overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 shadow-[0_26px_80px_rgba(0,0,0,0.22)]">
          <nav className="grid gap-2 border-b border-white/8 p-3 md:grid-cols-4">
            {k9FormTabs.map((tab) => (
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

          <FormSection
            active={activeFormTab === "identity"}
            icon={IdCard}
            index={1}
            title="Dados basicos"
          >
            <div className="grid gap-5 lg:grid-cols-[190px_1fr]">
              <div>
                <button
                  className="relative flex h-48 w-full overflow-hidden rounded-2xl border border-dashed border-cyan-300/30 bg-cyan-300/[0.035] transition hover:bg-cyan-300/[0.065]"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  {previewUrl ? (
                    <Image
                      alt="Foto do K9"
                      className="object-cover"
                      fill
                      sizes="190px"
                      src={previewUrl}
                      unoptimized
                    />
                  ) : (
                    <span className="m-auto flex flex-col items-center gap-3 text-slate-500">
                      <Camera className="h-8 w-8 text-cyan-300" />
                      <span className="text-xs font-semibold">Adicionar foto</span>
                      <span className="text-[10px]">PNG, JPG ou WEBP - 5 MB</span>
                    </span>
                  )}
                </button>
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handlePhoto}
                  ref={fileInputRef}
                  type="file"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field error={errors.name} label="Nome operacional" required>
                  <input
                    className={inputClass}
                    onChange={(event) => setField("name", event.target.value)}
                    placeholder="Ex.: Bono"
                    value={values.name}
                  />
                </Field>
                <Field
                  error={errors.registrationNumber}
                  label="Matricula / RGA"
                  required
                >
                  <input
                    className={inputClass}
                    onChange={(event) =>
                      setField("registrationNumber", event.target.value)
                    }
                    placeholder="Ex.: K9-023"
                    value={values.registrationNumber}
                  />
                </Field>
                <Field error={errors.breed} label="Raca" required>
                  <input
                    className={inputClass}
                    onChange={(event) => setField("breed", event.target.value)}
                    placeholder="Ex.: Pastor Belga Malinois"
                    value={values.breed}
                  />
                </Field>
                <Field error={errors.sex} label="Sexo" required>
                  <select
                    className={selectClass}
                    onChange={(event) => setField("sex", event.target.value)}
                    value={values.sex}
                  >
                    <option className="bg-[#0b1628]" value="M">
                      Macho
                    </option>
                    <option className="bg-[#0b1628]" value="F">
                      Femea
                    </option>
                  </select>
                </Field>
                <Field
                  error={errors.birthDate}
                  label="Data de nascimento"
                  required
                >
                  <input
                    className={inputClass}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) =>
                      setField("birthDate", event.target.value)
                    }
                    type="date"
                    value={values.birthDate}
                  />
                </Field>
                <Field error={errors.color} label="Cor / Pelagem" required>
                  <input
                    className={inputClass}
                    onChange={(event) => setField("color", event.target.value)}
                    placeholder="Ex.: Fulvo encarvoado"
                    value={values.color}
                  />
                </Field>
                <Field label="Microchip">
                  <input
                    className={inputClass}
                    onChange={(event) =>
                      setField("microchip", event.target.value)
                    }
                    placeholder="Numero do microchip"
                    value={values.microchip}
                  />
                </Field>
                <Field label="Porte">
                  <select
                    className={selectClass}
                    onChange={(event) => setField("size", event.target.value)}
                    value={values.size}
                  >
                    <option className="bg-[#0b1628]" value="">
                      Nao informado
                    </option>
                    <option className="bg-[#0b1628]" value="Pequeno">
                      Pequeno
                    </option>
                    <option className="bg-[#0b1628]" value="Medio">
                      Medio
                    </option>
                    <option className="bg-[#0b1628]" value="Grande">
                      Grande
                    </option>
                  </select>
                </Field>
              </div>
            </div>
          </FormSection>

          <FormSection
            active={activeFormTab === "physical"}
            icon={Scale}
            index={2}
            title="Dados fisicos e vinculo"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field error={errors.weight} label="Peso atual (kg)" required>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  min="0.1"
                  onChange={(event) => setField("weight", event.target.value)}
                  placeholder="Ex.: 28,5"
                  step="0.1"
                  type="number"
                  value={values.weight}
                />
              </Field>
              <Field
                error={errors.idealWeightMin}
                label="Peso ideal minimo (kg)"
                required
              >
                <input
                  className={inputClass}
                  inputMode="decimal"
                  min="0.1"
                  onChange={(event) =>
                    setField("idealWeightMin", event.target.value)
                  }
                  step="0.1"
                  type="number"
                  value={values.idealWeightMin}
                />
              </Field>
              <Field
                error={errors.idealWeightMax}
                label="Peso ideal maximo (kg)"
                required
              >
                <input
                  className={inputClass}
                  inputMode="decimal"
                  min="0.1"
                  onChange={(event) =>
                    setField("idealWeightMax", event.target.value)
                  }
                  step="0.1"
                  type="number"
                  value={values.idealWeightMax}
                />
              </Field>
              <Field
                error={errors.operationalStatus}
                label="Situacao cadastral"
                required
              >
                <select
                  className={selectClass}
                  onChange={(event) =>
                    setField("operationalStatus", event.target.value)
                  }
                  value={values.operationalStatus}
                >
                  {["Ativo", "Licenca", "Aposentado"].map((status) => (
                    <option
                      className="bg-[#0b1628]"
                      key={status}
                      value={status}
                    >
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Condutor titular">
                <select
                  className={selectClass}
                  onChange={(event) =>
                    setField("conductorRa", event.target.value)
                  }
                  value={values.conductorRa}
                >
                  <option className="bg-[#0b1628]" value="">
                    Sem condutor vinculado
                  </option>
                  {options.users.map((user) => (
                    <option
                      className="bg-[#0b1628]"
                      key={user.value}
                      value={user.value}
                    >
                      {user.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Condicao corporal">
                <input
                  className={inputClass}
                  onChange={(event) =>
                    setField("physicalCondition", event.target.value)
                  }
                  placeholder="Ex.: Ideal"
                  value={values.physicalCondition}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            active={activeFormTab === "specialties"}
            icon={ShieldCheck}
            index={3}
            title="Modalidades K9"
          >
            {options.modalities.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {options.modalities.map((modality) => {
                  const checked = values.specialties.includes(modality.value);
                  const locked = protectedSpecialties.includes(modality.value);
                  return (
                    <button
                      aria-disabled={locked}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition",
                        checked
                          ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
                          : "border-white/9 bg-white/[0.025] text-slate-400 hover:border-white/15",
                        locked && "cursor-not-allowed opacity-75",
                      )}
                      key={modality.value}
                      onClick={() => toggleSpecialty(modality.value)}
                      type="button"
                    >
                      <span>
                        <span className="block">{modality.label}</span>
                        {locked ? (
                          <span className="mt-1 block text-[10px] font-normal text-amber-200/75">
                            Possui progressao de treino
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-md border",
                          checked
                            ? "border-cyan-300 bg-cyan-300 text-[#04101a]"
                            : "border-white/15",
                        )}
                      >
                        {locked ? (
                          <LockKeyhole className="h-3.5 w-3.5 text-amber-200" />
                        ) : checked ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
                Nenhum curriculo foi encontrado em training_programs. O K9
                ainda pode ser salvo e as modalidades vinculadas depois.
              </p>
            )}
            <p className="mt-3 text-[11px] text-slate-500">
              Deteccao de armas, entorpecentes e outras linhas pertencem a
              modalidade unica Deteccao. Modalidades com progressao ficam
              protegidas e continuam controladas pelo fluxo de treinamento.
            </p>
          </FormSection>

          <FormSection
            active={activeFormTab === "notes"}
            icon={HeartPulse}
            index={4}
            title="Observacoes"
          >
            <Field label="Observacoes gerais e sanitarias">
              <textarea
                className="min-h-28 w-full resize-y rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
                maxLength={800}
                onChange={(event) => setField("notes", event.target.value)}
                placeholder="Historico, comportamento, restricoes e observacoes relevantes."
                value={values.notes}
              />
              <span className="mt-1 block text-right font-mono text-[10px] text-slate-600">
                {values.notes.length}/800
              </span>
            </Field>
          </FormSection>

          <div className="flex flex-col-reverse gap-3 border-t border-white/8 px-5 py-5 sm:flex-row sm:justify-end">
            <button
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/[0.04]"
              onClick={() => router.back()}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200/35 bg-cyan-300 px-6 py-3 text-sm font-black text-[#031018] shadow-[0_0_30px_rgba(34,211,238,0.2)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving || !profile || !canSaveK9}
              type="submit"
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving
                ? "Salvando..."
                : mode === "create"
                  ? "Salvar K9"
                  : "Salvar alteracoes"}
            </button>
          </div>
        </div>

        <aside className="space-y-4 2xl:sticky 2xl:top-24 2xl:self-start">
          <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
            <h2 className="text-sm font-black text-white">Resumo do cadastro</h2>
            <div className="mx-auto mt-5 h-40 w-40 overflow-hidden rounded-full border border-cyan-300/20 bg-cyan-300/[0.04]">
              {previewUrl ? (
                <div className="relative h-full w-full">
                  <Image
                    alt="Resumo da foto do K9"
                    className="object-cover"
                    fill
                    sizes="160px"
                    src={previewUrl}
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Dog className="h-20 w-20 text-slate-700" />
                </div>
              )}
            </div>
            <p className="mt-4 text-center text-lg font-black text-white">
              {values.name || "Novo K9"}
            </p>
            <p className="mt-1 text-center font-mono text-xs text-slate-500">
              {values.registrationNumber || "Matricula pendente"}
            </p>
            <div className="mt-5 space-y-3">
              {completedChecks.map((item) => (
                <div
                  className="flex items-center gap-3 text-xs"
                  key={item.label}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border",
                      item.done
                        ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300"
                        : "border-white/15 text-slate-600",
                    )}
                  >
                    {item.done ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className={item.done ? "text-slate-200" : "text-slate-500"}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
            <h2 className="text-sm font-black text-white">Integridade</h2>
            <div className="mt-4 space-y-4 text-xs text-slate-400">
              <p className="flex gap-3">
                <IdCard className="h-4 w-4 shrink-0 text-cyan-300" />
                A matricula/RGA e validada contra duplicidade.
              </p>
              <p className="flex gap-3">
                <Scale className="h-4 w-4 shrink-0 text-cyan-300" />
                Alterar o peso gera um novo registro canonico em weight_records.
              </p>
              <p className="flex gap-3">
                <UserRound className="h-4 w-4 shrink-0 text-cyan-300" />
                Toda gravacao inclui autoria e entrada no audit_trail.
              </p>
              <p className="flex gap-3">
                <Archive className="h-4 w-4 shrink-0 text-cyan-300" />
                Arquivar nunca apaga fisicamente o cadastro.
              </p>
            </div>
          </section>
        </aside>
      </form>

      {archiveOpen && canArchiveK9 ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-3xl border border-red-300/20 bg-[#0b1628] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-300/10 text-red-200">
                <Archive className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-white">
                  Arquivar cadastro do K9
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  O registro deixa a lista ativa, mas todo o historico permanece.
                </p>
              </div>
            </div>
            <Field label="Motivo do arquivamento" required>
              <textarea
                className="mt-5 min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white outline-none focus:border-red-300/35"
                onChange={(event) => setArchiveReason(event.target.value)}
                placeholder="Informe o motivo administrativo..."
                value={archiveReason}
              />
            </Field>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-300"
                onClick={() => setArchiveOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-red-400 px-4 py-2.5 text-xs font-black text-[#1b0707] disabled:opacity-50"
                disabled={archiving || !archiveReason.trim()}
                onClick={handleArchive}
                type="button"
              >
                {archiving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                Confirmar arquivamento
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
