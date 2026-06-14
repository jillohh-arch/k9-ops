"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  Building2,
  Camera,
  Check,
  CircleAlert,
  IdCard,
  KeyRound,
  LoaderCircle,
  Save,
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
import { useAccessProfiles } from "@/features/access/hooks/use-access-profiles";
import {
  archiveHuman,
  emptyHumanFormValues,
  humanSpecialtyOptions,
  loadHumanForEdit,
  saveHuman,
  type HumanFormValues,
} from "@/features/effective/data/human-admin-service";
import { useShiftGroups } from "@/features/effective/hooks/use-shift-groups";
import {
  defaultAccessProfiles,
  type AccessProfile,
} from "@/lib/permissions/access-control";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05]";

type FormErrors = Partial<Record<keyof HumanFormValues | "form", string>>;
type HumanFormTab = "identity" | "functional" | "access" | "notes";

const humanFormTabs: Array<{
  id: HumanFormTab;
  label: string;
}> = [
  { id: "identity", label: "Identificação" },
  { id: "functional", label: "Funcional" },
  { id: "access", label: "Acesso" },
  { id: "notes", label: "Observações" },
];

const officialProfileOrder = [
  "condutor",
  "instrutor_k9",
  "subinspetor_inspetor",
  "almoxarifado",
  "administrador",
];

function orderedProfiles(profiles: AccessProfile[]) {
  return [...profiles].sort((left, right) => {
    const leftIndex = officialProfileOrder.indexOf(left.id);
    const rightIndex = officialProfileOrder.indexOf(right.id);
    if (leftIndex >= 0 || rightIndex >= 0) {
      return (
        (leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER) -
        (rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER)
      );
    }
    return left.name.localeCompare(right.name, "pt-BR");
  });
}

function profileRoleSet(profile: Pick<AccessProfile, "id" | "role_keys">) {
  return new Set([profile.id, ...profile.role_keys].map((item) => item.trim()));
}

function isInstructorProfile(profile: Pick<AccessProfile, "id" | "role_keys">) {
  const roles = profileRoleSet(profile);
  return (
    roles.has("instrutor_k9") ||
    roles.has("instrutor") ||
    roles.has("adestrador")
  );
}

function profileAccessModes(profile: Pick<AccessProfile, "id" | "role_keys">) {
  const roles = profileRoleSet(profile);
  const mobile =
    roles.has("condutor") ||
    roles.has("handler") ||
    roles.has("mobile_user") ||
    roles.has("instrutor_k9") ||
    roles.has("instrutor") ||
    roles.has("admin") ||
    roles.has("administrador");
  return mobile ? ["Web", "Mobile"] : ["Web"];
}

function validate(values: HumanFormValues) {
  const errors: FormErrors = {};
  if (!/^\d{4,12}$/.test(values.ra)) {
    errors.ra = "Informe um RA numerico válido.";
  }
  if (!values.fullName.trim()) errors.fullName = "Informe o nome completo.";
  if (!values.callsign.trim()) errors.callsign = "Informe o nome de guerra.";
  if (!values.unit.trim()) errors.unit = "Informe a lotação.";
  if (!values.accessProfileId.trim()) {
    errors.accessProfileId = "Selecione o perfil de acesso.";
  }
  if (!values.status.trim()) errors.status = "Informe o status.";
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

function Section({
  active,
  children,
  icon: Icon,
  title,
}: {
  active: boolean;
  children: React.ReactNode;
  icon: typeof UserRound;
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
        {title}
      </h2>
      {children}
    </section>
  );
}

export function HumanAdminForm({
  mode,
  ra,
}: {
  mode: "create" | "edit";
  ra?: string;
}) {
  const router = useRouter();
  const { can } = useAccessControl();
  const { profiles: accessProfiles } = useAccessProfiles();
  const { groups: shiftGroups } = useShiftGroups();
  const fileInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<HumanFormValues>(emptyHumanFormValues);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [activeFormTab, setActiveFormTab] =
    useState<HumanFormTab>("identity");
  const canSaveHuman = can("humans", mode === "create" ? "create" : "edit");
  const canArchiveHuman = can("humans", "archive");
  const profileOptions = useMemo(
    () =>
      orderedProfiles(
        (accessProfiles.length ? accessProfiles : defaultAccessProfiles).filter(
          (profile) => profile.status === "active",
        ),
      ),
    [accessProfiles],
  );
  const selectedAccessProfile =
    profileOptions.find((profile) => profile.id === values.accessProfileId) ??
    profileOptions[0] ??
    null;

  useEffect(() => {
    if (mode !== "edit" || !ra) return;
    let active = true;
    loadHumanForEdit(ra)
      .then((loaded) => {
        if (!active) return;
        if (!loaded) {
          setErrors({ form: "Agente não localizado." });
          return;
        }
        setValues(loaded);
        setPreview(loaded.photoUrl);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrors({
          form:
            error instanceof Error ? error.message : "Falha ao carregar agente.",
        });
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [mode, ra]);

  useEffect(
    () => () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const checklist = useMemo(
    () => [
      Boolean(values.fullName && values.callsign && values.ra),
      Boolean(values.unit && values.status),
      Boolean(values.accessProfileId && values.accessProfile),
      Boolean(values.role || values.rank || values.team),
      Boolean(values.specialties.length),
    ],
    [values],
  );

  function setField<Key extends keyof HumanFormValues>(
    key: Key,
    value: HumanFormValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setErrors({
        form: "A foto deve ser uma imagem de ate 10 MB.",
      });
      return;
    }
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function toggleSpecialty(specialty: string) {
    setField(
      "specialties",
      values.specialties.includes(specialty)
        ? values.specialties.filter((item) => item !== specialty)
        : [...values.specialties, specialty],
    );
  }

  function applyAccessProfile(profileId: string) {
    const selected = profileOptions.find((profile) => profile.id === profileId);
    if (!selected) {
      setField("accessProfileId", profileId);
      return;
    }
    setValues((current) => ({
      ...current,
      accessLevel: selected.name,
      accessProfile: selected.name,
      accessProfileId: selected.id,
      isK9Instructor: isInstructorProfile(selected),
    }));
    setErrors((current) => ({
      ...current,
      accessLevel: undefined,
      accessProfileId: undefined,
      form: undefined,
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSaveHuman) {
      setErrors({
        form:
          mode === "create"
            ? "Seu perfil não permite cadastrar agentes."
            : "Seu perfil não permite editar agentes.",
      });
      return;
    }
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const result = await saveHuman(mode, values, photoFile);
      if (mode === "create" && result.temporary_password) {
        setTemporaryPassword(result.temporary_password);
      } else {
        router.push(`/humans/${encodeURIComponent(values.ra)}`);
      }
    } catch (error) {
      setErrors({
        form:
          error instanceof Error ? error.message : "Falha ao salvar cadastro.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmArchive() {
    if (!canArchiveHuman) {
      setErrors({ form: "Seu perfil não permite arquivar agentes." });
      setArchiveOpen(false);
      return;
    }
    if (!ra || archiveReason.trim().length < 5) return;
    setArchiving(true);
    try {
      await archiveHuman(ra, archiveReason.trim());
      router.push(paths.humans);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error ? error.message : "Falha ao arquivar cadastro.",
      });
    } finally {
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/8 p-12 text-center text-sm text-slate-500">
        Carregando cadastro...
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Efetivo Humano
          </p>
          <h1 className="mt-1 text-3xl font-black text-white">
            {mode === "create" ? "Cadastrar agente" : "Editar agente"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Dados funcionais, acesso e qualificações do efetivo.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
          onClick={() => router.push(paths.humans)}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar a lista
        </button>
      </div>

      {errors.form ? (
        <div className="flex gap-3 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-200">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          {errors.form}
        </div>
      ) : null}

      <div className="grid gap-5 2xl:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82">
          <nav className="grid gap-2 border-b border-white/8 p-3 md:grid-cols-4">
            {humanFormTabs.map((tab) => (
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
            icon={UserRound}
            title="1. Identificação"
          >
            <div className="grid gap-5 md:grid-cols-[160px_1fr]">
              <div>
                <button
                  className="relative h-44 w-40 overflow-hidden rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-300/[0.04]"
                  onClick={() => fileInput.current?.click()}
                  type="button"
                >
                  {preview ? (
                    <Image
                      alt="Foto do agente"
                      className="object-cover"
                      fill
                      src={preview}
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
                      <UserRound className="h-12 w-12" />
                      <span className="text-xs">Enviar foto</span>
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 rounded-lg border border-cyan-300/30 bg-[#07111d] p-2 text-cyan-200">
                    <Camera className="h-4 w-4" />
                  </span>
                </button>
                <input
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhoto}
                  ref={fileInput}
                  type="file"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field error={errors.fullName} label="Nome completo" required>
                  <input
                    className={inputClass}
                    onChange={(event) =>
                      setField("fullName", event.target.value)
                    }
                    value={values.fullName}
                  />
                </Field>
                <Field error={errors.callsign} label="Nome de guerra" required>
                  <input
                    className={inputClass}
                    onChange={(event) =>
                      setField("callsign", event.target.value)
                    }
                    value={values.callsign}
                  />
                </Field>
                <Field error={errors.ra} label="RA / Matrícula" required>
                  <input
                    className={cn(inputClass, mode === "edit" && "opacity-60")}
                    disabled={mode === "edit"}
                    inputMode="numeric"
                    onChange={(event) =>
                      setField("ra", event.target.value.replace(/\D/g, ""))
                    }
                    value={values.ra}
                  />
                </Field>
                <Field label="CPF / Documento">
                  <input
                    className={inputClass}
                    onChange={(event) => setField("cpf", event.target.value)}
                    value={values.cpf}
                  />
                </Field>
                <Field label="Data de nascimento">
                  <input
                    className={inputClass}
                    onChange={(event) =>
                      setField("birthDate", event.target.value)
                    }
                    type="date"
                    value={values.birthDate}
                  />
                </Field>
                <Field label="Telefone">
                  <input
                    className={inputClass}
                    onChange={(event) => setField("phone", event.target.value)}
                    value={values.phone}
                  />
                </Field>
              </div>
            </div>
          </Section>

          <Section
            active={activeFormTab === "functional"}
            icon={IdCard}
            title="2. Dados funcionais"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Perfil de acesso aplicado">
                <input
                  className={cn(inputClass, "opacity-70")}
                  disabled
                  value={values.accessProfile || "Selecione em Acesso"}
                />
              </Field>
              <Field label="Cargo / função administrativa">
                <input
                  className={inputClass}
                  onChange={(event) => setField("role", event.target.value)}
                  value={values.role}
                />
              </Field>
              <Field label="Posto / Graduação">
                <input
                  className={inputClass}
                  onChange={(event) => setField("rank", event.target.value)}
                  value={values.rank}
                />
              </Field>
              <Field error={errors.unit} label="Lotação" required>
                <input
                  className={inputClass}
                  onChange={(event) => setField("unit", event.target.value)}
                  value={values.unit}
                />
              </Field>
              <Field label="Equipe">
                <input
                  className={inputClass}
                  onChange={(event) => setField("team", event.target.value)}
                  value={values.team}
                />
              </Field>
              <Field label="Data de ingresso">
                <input
                  className={inputClass}
                  onChange={(event) =>
                    setField("admissionDate", event.target.value)
                  }
                  type="date"
                  value={values.admissionDate}
                />
              </Field>
              <Field label="E-mail institucional">
                <input
                  className={inputClass}
                  onChange={(event) =>
                    setField("institutionalEmail", event.target.value)
                  }
                  type="email"
                  value={values.institutionalEmail}
                />
              </Field>
              <Field label="Escala / Jornada">
                <input
                  className={inputClass}
                  onChange={(event) =>
                    setField("shiftLabel", event.target.value)
                  }
                  value={values.shiftLabel}
                />
              </Field>
              <Field error={errors.status} label="Status" required>
                <select
                  className={`${inputClass} appearance-none`}
                  onChange={(event) => {
                    const status = event.target.value;
                    setField("status", status);
                    setField("active", status !== "Inativo");
                  }}
                  value={values.status}
                >
                  {["Ativo", "Em apoio", "Afastado", "Ferias", "Inativo"].map(
                    (item) => (
                      <option className="bg-[#0b1628]" key={item}>
                        {item}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Plantão">
                <select
                  className={`${inputClass} appearance-none`}
                  onChange={(event) => {
                    setField("shiftGroupId", event.target.value);
                  }}
                  value={values.shiftGroupId}
                >
                  <option className="bg-[#0b1628]" value="">
                    Selecione o plantão...
                  </option>
                  {shiftGroups.map((group) => (
                    <option className="bg-[#0b1628]" key={group.id} value={group.id}>
                      {group.name} ({String(group.expectedStartHour).padStart(2, "0")}:00 - {String(group.expectedEndHour).padStart(2, "0")}:00)
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section
            active={activeFormTab === "access"}
            icon={ShieldCheck}
            title="3. Perfil de acesso"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
              <Field
                error={errors.accessProfileId}
                label="Perfil institucional"
                required
              >
                <select
                  className={`${inputClass} appearance-none`}
                  onChange={(event) => applyAccessProfile(event.target.value)}
                  value={values.accessProfileId}
                >
                  {profileOptions.map((profile) => (
                    <option
                      className="bg-[#0b1628]"
                      key={profile.id}
                      value={profile.id}
                    >
                      {profile.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">
                      {selectedAccessProfile?.name ?? "Perfil não selecionado"}
                    </p>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                      {selectedAccessProfile?.description ??
                        "Escolha um perfil para definir acesso web, mobile e claims."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedAccessProfile
                      ? profileAccessModes(selectedAccessProfile).map((mode) => (
                          <span
                            className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100"
                            key={mode}
                          >
                            {mode}
                          </span>
                        ))
                      : null}
                  </div>
                </div>
                <p className="mt-4 text-[11px] leading-5 text-slate-500">
                  Este campo e a fonte de verdade do acesso. Ao salvar, a
                  Function atualiza custom claims, espelho em users/RA e exige
                  novo login para o token refletir o novo perfil.
                </p>
              </div>
            </div>
            <div className="mt-6 border-t border-white/8 pt-5">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                Capacitações complementares
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Cursos e habilidades funcionais. Não definem permissão de
                sistema.
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {humanSpecialtyOptions.map((specialty) => {
                const selected = values.specialties.includes(specialty);
                return (
                  <button
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition",
                      selected
                        ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
                        : "border-white/8 bg-white/[0.02] text-slate-400",
                    )}
                    key={specialty}
                    onClick={() => toggleSpecialty(specialty)}
                    type="button"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md border",
                        selected
                          ? "border-cyan-300 bg-cyan-300 text-[#061018]"
                          : "border-white/15",
                      )}
                    >
                      {selected ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    {specialty}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            active={activeFormTab === "notes"}
            icon={BadgeCheck}
            title="4. Observações"
          >
            <textarea
              className="min-h-28 w-full resize-y rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              onChange={(event) => setField("notes", event.target.value)}
              placeholder="Informações funcionais, restrições ou observações."
              value={values.notes}
            />
          </Section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-cyan-300/20 bg-[#0b1628]/88 p-5">
            <h2 className="text-sm font-black text-white">Resumo do efetivo</h2>
            <div className="mt-5 flex justify-center">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-cyan-300/25 bg-cyan-300/[0.05]">
                {preview ? (
                  <Image
                    alt=""
                    className="h-full w-full object-cover"
                    height={112}
                    src={preview}
                    unoptimized
                    width={112}
                  />
                ) : (
                  <UserRound className="h-14 w-14 text-cyan-200/35" />
                )}
              </div>
            </div>
            <p className="mt-4 text-center text-lg font-black text-white">
              {values.callsign || "Novo agente"}
            </p>
            <p className="mt-1 text-center font-mono text-xs text-slate-500">
              RA {values.ra || "--"}
            </p>
            <div className="mt-5 space-y-2">
              {checklist.map((done, index) => (
                <div
                  className="flex items-center justify-between text-xs"
                  key={index}
                >
                  <span className="text-slate-400">
                    {
                      [
                        "Identificação",
                        "Situação funcional",
                        "Perfil de acesso",
                        "Lotação e função",
                        "Capacitações",
                      ][index]
                    }
                  </span>
                  <span
                    className={done ? "text-emerald-300" : "text-slate-600"}
                  >
                    {done ? "Completo" : "Pendente"}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-3xl border border-white/8 bg-[#0b1628]/72 p-5 text-xs text-slate-500">
            <KeyRound className="mb-3 h-5 w-5 text-cyan-300" />
            O login usa o RA. Em novos cadastros, uma senha provisoria segura e
            exibida uma única vez apos salvar.
          </section>
        </aside>
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/8 bg-[#0b1628]/82 p-4 sm:flex-row">
        <div>
          {mode === "edit" && canArchiveHuman ? (
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2.5 text-sm font-bold text-red-200 hover:bg-red-400/[0.18]"
              onClick={() => setArchiveOpen(true)}
              type="button"
            >
              <Archive className="h-4 w-4" /> Arquivar cadastro
            </button>
          ) : null}
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
          disabled={saving || !canSaveHuman}
          type="submit"
        >
          {saving ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
          <Save className="h-4 w-4" />
          )}
          Salvar efetivo
        </button>
      </div>

      {temporaryPassword ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-md rounded-3xl border border-cyan-300/25 bg-[#091525] p-6 shadow-2xl">
            <KeyRound className="h-8 w-8 text-cyan-300" />
            <h2 className="mt-4 text-xl font-black text-white">
              Cadastro criado
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Entregue esta senha provisória ao agente. Ela não será exibida
              novamente.
            </p>
            <div className="mt-5 rounded-xl border border-cyan-300/20 bg-black/25 p-4 font-mono text-lg font-black text-cyan-200">
              {temporaryPassword}
            </div>
            <button
              className="mt-5 w-full rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200"
              onClick={() =>
                router.push(`/humans/${encodeURIComponent(values.ra)}`)
              }
              type="button"
            >
              Ir para o perfil
            </button>
          </div>
        </div>
      ) : null}

      {archiveOpen && canArchiveHuman ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-md rounded-3xl border border-red-300/20 bg-[#091525] p-6">
            <h2 className="text-xl font-black text-white">Arquivar agente</h2>
            <p className="mt-2 text-sm text-slate-400">
              O login sera desativado. O histórico permanecera preservado.
            </p>
            <textarea
              className="mt-5 min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white outline-none"
              onChange={(event) => setArchiveReason(event.target.value)}
              placeholder="Motivo obrigatório"
              value={archiveReason}
            />
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]"
                onClick={() => setArchiveOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-200 hover:bg-red-400/[0.18] disabled:opacity-50"
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
