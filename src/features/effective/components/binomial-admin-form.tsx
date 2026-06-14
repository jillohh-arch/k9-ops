"use client";

import {
  Archive,
  ArrowLeft,
  Check,
  Dog,
  Link2,
  LoaderCircle,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  EntityImage,
  StatusPill,
} from "@/features/effective/components/effective-ui";
import {
  archiveBinomial,
  emptyBinomialFormValues,
  loadBinomialForEdit,
  loadBinomialFormOptions,
  saveBinomial,
  specialtyLabel,
  type BinomialFormOptions,
  type BinomialFormValues,
} from "@/features/effective/data/binomial-admin-service";
import { useEffectiveData } from "@/features/effective/hooks/use-effective-data";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35";

type BinomialFormTab = "composition" | "link" | "notes";

const binomialFormTabs: Array<{
  id: BinomialFormTab;
  label: string;
}> = [
  { id: "composition", label: "Composição" },
  { id: "link", label: "Vínculo" },
  { id: "notes", label: "Observações" },
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
  title,
}: {
  active: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5",
        !active && "hidden",
      )}
    >
      <h2 className="text-lg font-black text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function validate(values: BinomialFormValues) {
  const errors: Partial<Record<keyof BinomialFormValues, string>> = {};
  if (!values.handlerRa) errors.handlerRa = "Selecione o condutor.";
  if (!values.dogId) errors.dogId = "Selecione o K9.";
  if (!values.startAt) errors.startAt = "Informe o início do vínculo.";
  if (!values.status) errors.status = "Informe o status.";
  if (!values.primarySpecialty) errors.primarySpecialty = "Informe a especialidade principal.";
  return errors;
}

export function BinomialAdminForm({
  binomialId,
  mode,
}: {
  binomialId?: string;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const { can } = useAccessControl();
  const { dogs, users } = useEffectiveData();
  const [values, setValues] = useState<BinomialFormValues>(emptyBinomialFormValues);
  const [options, setOptions] = useState<BinomialFormOptions>({
    dogs: [],
    handlers: [],
    specialties: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [activeFormTab, setActiveFormTab] =
    useState<BinomialFormTab>("composition");
  const canSaveBinomial = can(
    "binomials",
    mode === "create" ? "create" : "edit",
  );
  const canArchiveBinomial = can("binomials", "archive");

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadBinomialFormOptions(),
      mode === "edit" && binomialId
        ? loadBinomialForEdit(binomialId)
        : Promise.resolve(emptyBinomialFormValues),
    ])
      .then(([loadedOptions, loadedValues]) => {
        if (!alive) return;
        setOptions(loadedOptions);
        if (loadedValues) setValues(loadedValues);
        else setError("Binômio não localizado.");
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [binomialId, mode]);

  const errors = useMemo(() => validate(values), [values]);
  const selectedDog = dogs.find((dog) => dog.id === values.dogId) ?? null;
  const selectedHandler =
    users.find((user) => user.ra === values.handlerRa) ?? null;
  const checklist = [
    !errors.handlerRa,
    !errors.dogId,
    !errors.startAt && !errors.status && !errors.primarySpecialty,
    values.notes.trim().length > 0 || values.primary,
  ];

  function setField<K extends keyof BinomialFormValues>(
    field: K,
    value: BinomialFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveBinomial) {
      setError(
        mode === "create"
          ? "Seu perfil não permite criar binômios."
          : "Seu perfil não permite editar binômios.",
      );
      return;
    }
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length) {
      setError("Preencha os campos obrigatórios do vínculo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await saveBinomial(mode, values, binomialId);
      router.push(`/binomials/${encodeURIComponent(id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function confirmArchive() {
    if (!canArchiveBinomial) {
      setError("Seu perfil não permite encerrar binômios.");
      setArchiveOpen(false);
      return;
    }
    if (!binomialId) return;
    setArchiving(true);
    setError(null);
    try {
      await archiveBinomial(binomialId, archiveReason);
      router.push(paths.binomials);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
        Carregando vínculo...
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-300"
            href={paths.binomials}
          >
            <ArrowLeft className="h-4 w-4" />
            Binômios
          </Link>
          <h1 className="mt-3 text-3xl font-black text-white">
            {mode === "create" ? "Vincular Binômio" : "Editar Vínculo"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Associe condutor e K9 sem quebrar o vínculo operacional do mobile.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
          disabled={saving || !canSaveBinomial}
          type="submit"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar binômio
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-300/15 bg-red-300/[0.04] px-4 py-3 text-sm text-red-200/80">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <nav className="grid gap-2 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-3 md:grid-cols-3">
            {binomialFormTabs.map((tab) => (
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

          <section className="relative overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,0.11),transparent_42%)]" />
            <div className="relative grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
              <div className="flex items-center gap-4">
                <EntityImage
                  alt={selectedHandler?.callsign ?? "Condutor"}
                  className="h-24 w-24"
                  fallback={UserRound}
                  src={selectedHandler?.photoUrl ?? null}
                />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Condutor
                  </p>
                  <p className="mt-1 text-xl font-black text-white">
                    {selectedHandler?.callsign ?? "Aguardando seleção"}
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    RA {values.handlerRa || "--"}
                  </p>
                </div>
              </div>
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
                <Link2 className="h-9 w-9" />
              </div>
              <div className="flex items-center gap-4 md:justify-end">
                <div className="text-left md:text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    K9
                  </p>
                  <p className="mt-1 text-xl font-black text-cyan-200">
                    {selectedDog?.name ?? "Aguardando seleção"}
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    {selectedDog?.registrationNumber ?? "--"}
                  </p>
                </div>
                <EntityImage
                  alt={selectedDog?.name ?? "K9"}
                  className="h-24 w-24"
                  fallback={Dog}
                  src={selectedDog?.profileImageUrl ?? null}
                />
              </div>
            </div>
          </section>

          <Section
            active={activeFormTab === "composition"}
            title="1. Composição do binômio"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field error={errors.handlerRa} label="Condutor" required>
                <select
                  className={`${inputClass} appearance-none`}
                  onChange={(event) => setField("handlerRa", event.target.value)}
                  value={values.handlerRa}
                >
                  <option className="bg-[#0b1628]" value="">
                    Selecione o condutor...
                  </option>
                  {options.handlers.map((option) => (
                    <option className="bg-[#0b1628]" key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field error={errors.dogId} label="K9" required>
                <select
                  className={`${inputClass} appearance-none`}
                  onChange={(event) => setField("dogId", event.target.value)}
                  value={values.dogId}
                >
                  <option className="bg-[#0b1628]" value="">
                    Selecione o K9...
                  </option>
                  {options.dogs.map((option) => (
                    <option className="bg-[#0b1628]" key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section
            active={activeFormTab === "link"}
            title="2. Dados do vínculo"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field error={errors.startAt} label="Data de início" required>
                <input className={inputClass} onChange={(event) => setField("startAt", event.target.value)} type="date" value={values.startAt} />
              </Field>
              <Field label="Data de encerramento">
                <input className={inputClass} onChange={(event) => setField("endAt", event.target.value)} type="date" value={values.endAt} />
              </Field>
              <Field error={errors.status} label="Status" required>
                <select className={`${inputClass} appearance-none`} onChange={(event) => setField("status", event.target.value)} value={values.status}>
                  {["Ativo", "Operacional", "Em formação", "Afastado", "Encerrado"].map((item) => (
                    <option className="bg-[#0b1628]" key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo de vínculo">
                <select className={`${inputClass} appearance-none`} onChange={(event) => setField("type", event.target.value)} value={values.type}>
                  {["Operacional", "Formação", "Substituição temporária", "Apoio"].map((item) => (
                    <option className="bg-[#0b1628]" key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              <Field error={errors.primarySpecialty} label="Especialidade principal" required>
                <select className={`${inputClass} appearance-none`} onChange={(event) => setField("primarySpecialty", event.target.value)} value={values.primarySpecialty}>
                  {options.specialties.map((option) => (
                    <option className="bg-[#0b1628]" key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Unidade">
                <input className={inputClass} onChange={(event) => setField("unit", event.target.value)} value={values.unit} />
              </Field>
              <Field label="Equipe">
                <input className={inputClass} onChange={(event) => setField("team", event.target.value)} value={values.team} />
              </Field>
              <Field label="Prontidão combinada (%)">
                <input className={inputClass} inputMode="numeric" onChange={(event) => setField("readinessScore", event.target.value.replace(/[^\d,.]/g, ""))} value={values.readinessScore} />
              </Field>
              <Field label="Sinergia (%)">
                <input className={inputClass} inputMode="numeric" onChange={(event) => setField("synergyScore", event.target.value.replace(/[^\d,.]/g, ""))} value={values.synergyScore} />
              </Field>
            </div>
            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] px-4 py-3">
              <input
                checked={values.primary}
                className="mt-1 h-4 w-4 accent-cyan-300"
                onChange={(event) => setField("primary", event.target.checked)}
                type="checkbox"
              />
              <span>
                <strong className="block text-sm text-white">
                  Vínculo principal ativo
                </strong>
                <span className="text-xs text-slate-500">
                  Quando ativo, sincroniza `dogs.conductorRa` para o mobile.
                </span>
              </span>
            </label>
          </Section>

          <Section
            active={activeFormTab === "notes"}
            title="3. Avaliação inicial e observações"
          >
            <textarea
              className="min-h-32 w-full resize-y rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-slate-100 outline-none focus:border-cyan-300/35"
              onChange={(event) => setField("notes", event.target.value)}
              placeholder="Compatibilidade, restrições, rotina da dupla, observações operacionais..."
              value={values.notes}
            />
          </Section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-cyan-300/20 bg-[#0b1628]/88 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black text-white">Resumo do binômio</h2>
              <StatusPill label={values.status || "Pendente"} tone={values.active ? "green" : "violet"} />
            </div>
            <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <EntityImage alt="Condutor" className="h-20 w-full" fallback={UserRound} src={selectedHandler?.photoUrl ?? null} />
              <Link2 className="h-7 w-7 text-cyan-300" />
              <EntityImage alt="K9" className="h-20 w-full" fallback={Dog} src={selectedDog?.profileImageUrl ?? null} />
            </div>
            <div className="mt-5 space-y-2 text-xs">
              {[
                ["Condutor", selectedHandler?.callsign ?? "--"],
                ["K9", selectedDog?.name ?? "--"],
                ["Especialidade", specialtyLabel(values.primarySpecialty)],
                ["Início", values.startAt || "--"],
                ["Prontidão", `${values.readinessScore || "--"}%`],
              ].map(([label, value]) => (
                <div className="flex justify-between gap-4" key={label}>
                  <span className="text-slate-500">{label}</span>
                  <span className="text-right font-semibold text-slate-200">{value}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-3xl border border-white/8 bg-[#0b1628]/72 p-5">
            <h2 className="text-sm font-black text-white">Checklist do vínculo</h2>
            <div className="mt-4 space-y-2">
              {["Condutor selecionado", "K9 selecionado", "Dados do vínculo", "Auditoria orientada"].map((item, index) => (
                <div className="flex items-center justify-between text-xs" key={item}>
                  <span className="text-slate-400">{item}</span>
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", checklist[index] ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300" : "border-white/10 text-slate-600")}>
                    {checklist[index] ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-3xl border border-amber-300/15 bg-amber-300/[0.045] p-5">
            <ShieldCheck className="h-5 w-5 text-amber-200" />
            <p className="mt-3 text-xs leading-5 text-amber-50/75">
              A Function encerra vínculos ativos anteriores do mesmo K9 quando
              este for marcado como vínculo principal ativo.
            </p>
          </section>
          {mode === "edit" && canArchiveBinomial ? (
            <button
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/25 px-4 py-3 text-sm font-bold text-red-200"
              onClick={() => setArchiveOpen(true)}
              type="button"
            >
              <Archive className="h-4 w-4" /> Encerrar vínculo
            </button>
          ) : null}
        </aside>
      </div>

      {archiveOpen && canArchiveBinomial ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-md rounded-3xl border border-red-300/20 bg-[#091525] p-6">
            <h2 className="text-xl font-black text-white">Encerrar binômio</h2>
            <p className="mt-2 text-sm text-slate-400">
              O histórico permanece preservado. Se for vínculo principal atual,
              o K9 fica sem condutor titular ate nova atribuição.
            </p>
            <textarea
              className="mt-5 min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-white outline-none"
              onChange={(event) => setArchiveReason(event.target.value)}
              placeholder="Motivo obrigatório"
              value={archiveReason}
            />
            <div className="mt-5 flex gap-3">
              <button className="flex-1 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]" onClick={() => setArchiveOpen(false)} type="button">
                Cancelar
              </button>
              <button
                className="flex-1 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-200 hover:bg-red-400/[0.18] disabled:opacity-50"
                disabled={archiveReason.trim().length < 5 || archiving}
                onClick={confirmArchive}
                type="button"
              >
                {archiving ? "Encerrando..." : "Encerrar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
