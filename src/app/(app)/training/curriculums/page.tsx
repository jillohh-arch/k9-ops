"use client";

import Link from "next/link";
import {
  AlertCircle,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Flag,
  GripVertical,
  Layers3,
  LoaderCircle,
  Plus,
  Ruler,
  Save,
  ShieldCheck,
  Target,
  UserCheck,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { canônicalK9Modalities } from "@/features/effective/lib/k9-modalities";
import {
  createTrainingMilestone,
  createTrainingModule,
  createTrainingProgram,
  updateTrainingMilestone,
  updateTrainingModule,
  updateTrainingProgram,
  type MilestoneInput,
  type ModuleInput,
  type ProgramInput,
  type PromotionCriteriaInput,
} from "@/features/training-curriculums/data/training-curriculum-service";
import {
  useTrainingCurriculums,
  type CurriculumMilestone,
  type CurriculumModule,
  type CurriculumProgram,
  type PromotionCriteria,
} from "@/features/training-curriculums/hooks/use-training-curriculums";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

const modalityOptions = [
  ...canônicalK9Modalities,
  { label: "Obediência", value: "obediencia" },
];

const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-55";

const textareaClass =
  "min-h-20 w-full rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-55";

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDistance(value: number | null) {
  if (value == null) return "--";
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(value)} m`;
}

function formatSuccess(value: number | null) {
  if (value == null) return "--";
  return `${Math.round(value <= 1 ? value * 100 : value)}%`;
}

function criteriaToInput(criteria?: PromotionCriteria): PromotionCriteriaInput {
  return {
    instructorApprovalRequired: criteria?.instructorApprovalRequired ?? true,
    maxAverageDurationS:
      criteria?.maxAverageDurationS == null
        ? ""
        : String(criteria.maxAverageDurationS),
    minDistanceM:
      criteria?.minDistanceM == null ? "" : String(criteria.minDistanceM),
    minSessions: String(criteria?.minSessions ?? 0),
    minSuccessRate:
      criteria?.minSuccessRate == null
        ? ""
        : String(
            criteria.minSuccessRate > 0 && criteria.minSuccessRate <= 1
              ? Math.round(criteria.minSuccessRate * 100)
              : criteria.minSuccessRate,
          ),
    notes: criteria?.notes ?? "",
    requiredEvents: criteria?.requiredEvents.join(", ") ?? "",
  };
}

function moduleToInput(module?: CurriculumModule): ModuleInput {
  return {
    criteria: criteriaToInput(module?.criteria),
    description: module?.description ?? "",
    order: String(module?.order ?? 1),
    title: module?.title ?? "",
  };
}

function milestoneToInput(milestone?: CurriculumMilestone): MilestoneInput {
  return {
    description: milestone?.description ?? "",
    order: String(milestone?.order ?? 1),
    required: milestone?.required ?? true,
    title: milestone?.title ?? "",
  };
}

function programToInput(program?: CurriculumProgram): ProgramInput {
  return {
    active: program?.active ?? true,
    description: program?.description ?? "",
    modality: program?.modality ?? "busca_captura",
    name: program?.label ?? "",
    version: program?.version ?? "v1",
  };
}

function Panel({
  action,
  children,
  className,
  subtitle,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  children,
  label,
  required,
}: {
  children: ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label} {required ? <span className="text-cyan-300">*</span> : null}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-cyan-200/15 bg-black/16 px-5 py-7 text-center text-sm text-slate-400">
      {label}
    </div>
  );
}

function CriteriaTile({
  detail,
  icon,
  label,
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/18 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/18 bg-cyan-300/10 text-cyan-100">
          {icon}
        </span>
        <span>
          <span className="block text-sm text-slate-400">{label}</span>
          <span className="mt-1 block font-mono text-xl font-black text-white">
            {value}
          </span>
          <span className="mt-1 block text-xs text-slate-500">{detail}</span>
        </span>
      </div>
    </article>
  );
}

function ProgramTabs({
  programs,
  selectedId,
  setSelectedId,
}: {
  programs: CurriculumProgram[];
  selectedId: string | null;
  setSelectedId: (value: string) => void;
}) {
  if (!programs.length) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {programs.map((program) => {
        const active = program.id === selectedId;
        return (
          <button
            className={cn(
              "group flex min-h-20 items-center gap-4 rounded-[1.35rem] border px-5 text-left transition",
              active
                ? "border-cyan-300/45 bg-cyan-300/12 shadow-[0_0_28px_rgba(34,211,238,0.12)]"
                : "border-cyan-200/10 bg-white/[0.035] hover:border-cyan-200/25",
            )}
            key={program.id}
            onClick={() => setSelectedId(program.id)}
            type="button"
          >
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl border",
                active
                  ? "border-cyan-300/35 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 bg-black/18 text-slate-400",
              )}
            >
              <Target className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-black text-white">{program.label}</span>
              <span className="mt-1 block text-xs text-slate-500">
                {program.modules.length} módulos · {program.version}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CriteriaFields({
  disabled,
  form,
  setForm,
}: {
  disabled: boolean;
  form: ModuleInput;
  setForm: (updater: (current: ModuleInput) => ModuleInput) => void;
}) {
  const updateCriteria = (
    key: keyof PromotionCriteriaInput,
    value: boolean | string,
  ) => {
    setForm((current) => ({
      ...current,
      criteria: { ...current.criteria, [key]: value },
    }));
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Min. sessões">
          <input
            className={inputClass}
            disabled={disabled}
            inputMode="numeric"
            onChange={(event) => updateCriteria("minSessions", event.target.value)}
            value={form.criteria.minSessions}
          />
        </Field>
        <Field label="Sucesso min. (%)">
          <input
            className={inputClass}
            disabled={disabled}
            inputMode="decimal"
            onChange={(event) =>
              updateCriteria("minSuccessRate", event.target.value)
            }
            placeholder="80"
            value={form.criteria.minSuccessRate}
          />
        </Field>
        <Field label="Distância min. (m)">
          <input
            className={inputClass}
            disabled={disabled}
            inputMode="decimal"
            onChange={(event) =>
              updateCriteria("minDistanceM", event.target.value)
            }
            placeholder="100"
            value={form.criteria.minDistanceM}
          />
        </Field>
        <Field label="Tempo max. medio (s)">
          <input
            className={inputClass}
            disabled={disabled}
            inputMode="decimal"
            onChange={(event) =>
              updateCriteria("maxAverageDurationS", event.target.value)
            }
            placeholder="900"
            value={form.criteria.maxAverageDurationS}
          />
        </Field>
      </div>
      <Field label="Eventos obrigatórios">
        <input
          className={inputClass}
          disabled={disabled}
          onChange={(event) =>
            updateCriteria("requiredEvents", event.target.value)
          }
          placeholder="alvo_encontrado, cao_indicou"
          value={form.criteria.requiredEvents}
        />
      </Field>
      <Field label="Notas do criterio">
        <textarea
          className={textareaClass}
          disabled={disabled}
          onChange={(event) => updateCriteria("notes", event.target.value)}
          placeholder="Explique o julgamento esperado do instrutor..."
          value={form.criteria.notes}
        />
      </Field>
      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/18 p-3 text-sm font-semibold text-slate-300">
        <input
          checked={form.criteria.instructorApprovalRequired}
          className="h-4 w-4 accent-cyan-300"
          disabled={disabled}
          onChange={(event) =>
            updateCriteria("instructorApprovalRequired", event.target.checked)
          }
          type="checkbox"
        />
        Aprovação de Instrutor K9 obrigatória
      </label>
    </div>
  );
}

function ModuleForm({
  canEdit,
  module,
  onSave,
  saving,
}: {
  canEdit: boolean;
  module: CurriculumModule;
  onSave: (input: ModuleInput) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState<ModuleInput>(() => moduleToInput(module));

  return (
    <div className="mt-5 grid gap-4 rounded-[1.5rem] border border-cyan-200/10 bg-black/18 p-4">
      <div className="grid gap-4 md:grid-cols-[0.2fr_1fr]">
        <Field label="Ordem">
          <input
            className={inputClass}
            disabled={!canEdit}
            onChange={(event) =>
              setForm((current) => ({ ...current, order: event.target.value }))
            }
            value={form.order}
          />
        </Field>
        <Field label="Título" required>
          <input
            className={inputClass}
            disabled={!canEdit}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            value={form.title}
          />
        </Field>
      </div>
      <Field label="Descrição">
        <textarea
          className={textareaClass}
          disabled={!canEdit}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          value={form.description}
        />
      </Field>
      <CriteriaFields disabled={!canEdit} form={form} setForm={setForm} />
      <div className="flex justify-end">
        <Button
          disabled={!canEdit || saving || !form.title.trim()}
          onClick={() => void onSave(form)}
        >
          {saving ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar criterios
        </Button>
      </div>
    </div>
  );
}

function NewModuleForm({
  canEdit,
  nextOrder,
  onCreate,
  saving,
}: {
  canEdit: boolean;
  nextOrder: number;
  onCreate: (input: ModuleInput) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState<ModuleInput>(() =>
    moduleToInput({
      criteria: {
        instructorApprovalRequired: true,
        maxAverageDurationS: null,
        minDistanceM: null,
        minSessions: 0,
        minSuccessRate: null,
        notes: "",
        requiredEvents: [],
      },
      description: "",
      id: "",
      milestoneCount: 0,
      milestones: [],
      order: nextOrder,
      requiredMilestoneCount: 0,
      title: "",
    }),
  );

  return (
    <div className="rounded-2xl border border-dashed border-cyan-200/18 bg-cyan-300/[0.035] p-4">
      <p className="mb-3 text-sm font-black text-white">Novo módulo</p>
      <div className="grid gap-3 md:grid-cols-[0.25fr_1fr]">
        <Field label="Ordem">
          <input
            className={inputClass}
            disabled={!canEdit}
            onChange={(event) =>
              setForm((current) => ({ ...current, order: event.target.value }))
            }
            value={form.order}
          />
        </Field>
        <Field label="Título" required>
          <input
            className={inputClass}
            disabled={!canEdit}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Ex.: Progressao em campo"
            value={form.title}
          />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          disabled={!canEdit || saving || !form.title.trim()}
          onClick={async () => {
            await onCreate(form);
            setForm(moduleToInput(undefined));
          }}
          variant="secondary"
        >
          {saving ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Adicionar módulo
        </Button>
      </div>
    </div>
  );
}

function MilestoneEditor({
  canEdit,
  milestone,
  onSave,
  saving,
}: {
  canEdit: boolean;
  milestone: CurriculumMilestone;
  onSave: (input: MilestoneInput) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState<MilestoneInput>(() =>
    milestoneToInput(milestone),
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-black/18 p-3">
      <div className="grid grid-cols-[auto_3.5rem_1fr_auto] items-center gap-3">
        <GripVertical className="h-4 w-4 text-slate-600" />
        <input
          className={cn(inputClass, "px-2 text-center")}
          disabled={!canEdit}
          onChange={(event) =>
            setForm((current) => ({ ...current, order: event.target.value }))
          }
          value={form.order}
        />
        <input
          className={inputClass}
          disabled={!canEdit}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
          value={form.title}
        />
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <input
            checked={form.required}
            className="h-4 w-4 accent-cyan-300"
            disabled={!canEdit}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                required: event.target.checked,
              }))
            }
            type="checkbox"
          />
          obrig.
        </label>
      </div>
      <textarea
        className={cn(textareaClass, "mt-3 min-h-14")}
        disabled={!canEdit}
        onChange={(event) =>
          setForm((current) => ({ ...current, description: event.target.value }))
        }
        placeholder="Descrição técnica do marco..."
        value={form.description}
      />
      <div className="mt-3 flex justify-end">
        <Button
          disabled={!canEdit || saving || !form.title.trim()}
          onClick={() => void onSave(form)}
          variant="secondary"
        >
          {saving ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
}

function NewMilestoneForm({
  canEdit,
  nextOrder,
  onCreate,
  saving,
}: {
  canEdit: boolean;
  nextOrder: number;
  onCreate: (input: MilestoneInput) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState<MilestoneInput>(() =>
    milestoneToInput({ description: "", id: "", order: nextOrder, required: true, title: "" }),
  );

  return (
    <div className="rounded-2xl border border-dashed border-cyan-200/18 bg-cyan-300/[0.035] p-3">
      <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3">
        <input
          className={cn(inputClass, "px-2 text-center")}
          disabled={!canEdit}
          onChange={(event) =>
            setForm((current) => ({ ...current, order: event.target.value }))
          }
          value={form.order}
        />
        <input
          className={inputClass}
          disabled={!canEdit}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
          placeholder="Novo marco"
          value={form.title}
        />
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <input
            checked={form.required}
            className="h-4 w-4 accent-cyan-300"
            disabled={!canEdit}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                required: event.target.checked,
              }))
            }
            type="checkbox"
          />
          obrig.
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          disabled={!canEdit || saving || !form.title.trim()}
          onClick={async () => {
            await onCreate(form);
            setForm(milestoneToInput(undefined));
          }}
          variant="secondary"
        >
          {saving ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Novo marco
        </Button>
      </div>
    </div>
  );
}

function ProgramSettings({
  canEdit,
  onSave,
  program,
  saving,
}: {
  canEdit: boolean;
  onSave: (input: ProgramInput) => Promise<void>;
  program: CurriculumProgram;
  saving: boolean;
}) {
  const [form, setForm] = useState<ProgramInput>(() => programToInput(program));

  return (
    <Panel
      action={<Badge tone={form.active ? "green" : "slate"}>{form.active ? "ativa" : "inativa"}</Badge>}
      subtitle="Dados base de training_programs/{modality}."
      title="Aplica-se a"
    >
      <div className="space-y-4">
        <div className="grid gap-3">
          {modalityOptions.map((option) => {
            const selected = option.value === form.modality;
            return (
              <button
                className={cn(
                  "flex items-center justify-between rounded-2xl border p-3 text-left transition",
                  selected
                    ? "border-cyan-300/35 bg-cyan-300/10"
                    : "border-white/10 bg-black/18",
                )}
                disabled={!canEdit}
                key={option.value}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    modality: option.value,
                    name: current.name || option.label,
                  }))
                }
                type="button"
              >
                <span className="font-semibold text-slate-200">{option.label}</span>
                {selected ? <Badge tone="cyan">selecionada</Badge> : null}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/18 p-4">
          <span>
            <span className="block text-xs text-slate-500">Total módulos</span>
            <span className="font-mono text-2xl font-black text-white">
              {formatNumber(program.modules.length)}
            </span>
          </span>
          <span>
            <span className="block text-xs text-slate-500">Total marcos</span>
            <span className="font-mono text-2xl font-black text-white">
              {formatNumber(
                program.modules.reduce(
                  (total, module) => total + module.milestoneCount,
                  0,
                ),
              )}
            </span>
          </span>
        </div>
        <Field label="Nome">
          <input
            className={inputClass}
            disabled={!canEdit}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            value={form.name}
          />
        </Field>
        <Field label="Versao">
          <input
            className={inputClass}
            disabled={!canEdit}
            onChange={(event) =>
              setForm((current) => ({ ...current, version: event.target.value }))
            }
            value={form.version}
          />
        </Field>
        <Field label="Descrição">
          <textarea
            className={textareaClass}
            disabled={!canEdit}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            value={form.description}
          />
        </Field>
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-300">
          <input
            checked={form.active}
            className="h-4 w-4 accent-cyan-300"
            disabled={!canEdit}
            onChange={(event) =>
              setForm((current) => ({ ...current, active: event.target.checked }))
            }
            type="checkbox"
          />
          Currículo ativo
        </label>
        <Button
          className="w-full"
          disabled={!canEdit || saving || !form.name.trim()}
          onClick={() => void onSave(form)}
        >
          {saving ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Salvar currículo
        </Button>
      </div>
    </Panel>
  );
}

function NewProgramForm({
  canEdit,
  onCreate,
  saving,
}: {
  canEdit: boolean;
  onCreate: (input: ProgramInput) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState<ProgramInput>(() => programToInput());

  return (
    <Panel
      action={<Badge tone="cyan">novo</Badge>}
      subtitle="Cria training_programs/{modality}; requer Instrutor K9."
      title="Novo currículo"
    >
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-[1fr_0.6fr_0.3fr]">
          <Field label="Nome" required>
            <input
              className={inputClass}
              disabled={!canEdit}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Ex.: Obediência"
              value={form.name}
            />
          </Field>
          <Field label="Modalidade">
            <select
              className={inputClass}
              disabled={!canEdit}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  modality: event.target.value,
                }))
              }
              value={form.modality}
            >
              {modalityOptions.map((item) => (
                <option className="bg-slate-950" key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Versao">
            <input
              className={inputClass}
              disabled={!canEdit}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  version: event.target.value,
                }))
              }
              value={form.version}
            />
          </Field>
        </div>
        <Button
          disabled={!canEdit || saving || !form.name.trim()}
          onClick={async () => {
            await onCreate(form);
            setForm(programToInput());
          }}
        >
          {saving ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Criar currículo
        </Button>
      </div>
    </Panel>
  );
}

export default function TrainingCurriculumsPage() {
  const { profile } = useAuth();
  const data = useTrainingCurriculums();
  const canEdit = profile?.isK9Instructor === true;
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedProgram =
    data.programs.find((program) => program.id === selectedProgramId) ??
    data.programs[0] ??
    null;
  const selectedModule =
    selectedProgram?.modules.find((module) => module.id === selectedModuleId) ??
    selectedProgram?.modules[0] ??
    null;

  const nextModuleOrder =
    (selectedProgram?.modules.reduce(
      (max, module) => Math.max(max, module.order),
      0,
    ) ?? 0) + 1;
  const nextMilestoneOrder =
    (selectedModule?.milestones.reduce(
      (max, milestone) => Math.max(max, milestone.order),
      0,
    ) ?? 0) + 1;

  const totals = useMemo(() => {
    const modules = data.programs.flatMap((program) => program.modules);
    return {
      metrics: modules.reduce((total, module) => {
        const criteria = module.criteria;
        return (
          total +
          [
            criteria.minSessions > 0,
            criteria.minSuccessRate != null,
            criteria.minDistanceM != null,
            criteria.maxAverageDurationS != null,
            criteria.requiredEvents.length > 0,
            criteria.instructorApprovalRequired,
          ].filter(Boolean).length
        );
      }, 0),
      milestones: modules.reduce(
        (total, module) => total + module.milestoneCount,
        0,
      ),
      modules: modules.length,
    };
  }, [data.programs]);

  async function run(key: string, action: () => Promise<void>) {
    setSavingKey(key);
    setMessage(null);
    try {
      await action();
      setMessage("Alteraçao salva com trilha de auditoria.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-cyan-200/12 bg-[#081320]/82 p-5 shadow-[0_26px_90px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              Treinamentos
            </p>
            <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">
              Currículos / Critérios
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Cadastro de módulos, marcos obrigatórios e métricas mínimas para
              evolução. As alterações continuam auditadas no Firestore.
            </p>
          </div>
          <Link
            className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 transition hover:bg-cyan-300/[0.12]"
            href={paths.training}
          >
            voltar aos treinamentos
          </Link>
        </div>
      </header>

      {data.errors.length ? (
        <div className="rounded-[1.5rem] border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">Algumas leituras foram bloqueadas.</p>
              <p className="mt-1 text-amber-100/75">
                {data.errors.join(" | ")}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[1.25rem] border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm text-cyan-100">
          {message}
        </div>
      ) : null}

      {!canEdit ? (
        <div className="rounded-[1.25rem] border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">
          Edição disponível apenas para Instrutor K9. A leitura permanece
          aberta conforme permissões do perfil.
        </div>
      ) : null}

      <ProgramTabs
        programs={data.programs}
        selectedId={selectedProgram?.id ?? null}
        setSelectedId={(id) => {
          setSelectedProgramId(id);
          setSelectedModuleId(null);
        }}
      />

      {selectedProgram ? (
        <div className="grid gap-5 2xl:grid-cols-[1.2fr_0.7fr]">
          <Panel
            action={
              <Button
                disabled={!canEdit}
                onClick={() => setSelectedModuleId(null)}
                variant="secondary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo módulo
              </Button>
            }
            subtitle="Selecione um módulo para revisar as metas que liberam evolução."
            title={`Estrutura curricular - ${selectedProgram.label}`}
          >
            <div className="space-y-3">
              {selectedProgram.modules.map((module) => {
                const expanded = module.id === selectedModule?.id;
                return (
                  <article
                    className={cn(
                      "rounded-[1.4rem] border transition",
                      expanded
                        ? "border-cyan-300/25 bg-cyan-300/[0.055]"
                        : "border-white/10 bg-black/18",
                    )}
                    key={module.id}
                  >
                    <button
                      className="grid w-full gap-4 p-4 text-left md:grid-cols-[auto_1fr_auto] md:items-center"
                      onClick={() => setSelectedModuleId(module.id)}
                      type="button"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 font-mono text-lg font-black text-cyan-100">
                        {module.order}
                      </span>
                      <span>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-white">
                            {module.title}
                          </span>
                          <Badge tone={module.requiredMilestoneCount ? "green" : "slate"}>
                            {module.requiredMilestoneCount
                              ? "ativo"
                              : "sem marcos"}
                          </Badge>
                        </span>
                        <span className="mt-1 block text-sm text-slate-400">
                          {module.description || "Sem descrição cadastrada."}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-slate-400">
                        <span className="hidden rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-xs md:inline-flex">
                          {module.requiredMilestoneCount} marcos ·{" "}
                          {module.criteria.minSessions} sessões ·{" "}
                          {formatSuccess(module.criteria.minSuccessRate)} sucesso
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 transition",
                            expanded ? "rotate-180 text-cyan-200" : "",
                          )}
                        />
                      </span>
                    </button>
                    {expanded ? (
                      <div className="border-t border-white/10 p-4">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <CriteriaTile
                            detail="ordem definida"
                            icon={<Target className="h-5 w-5" />}
                            label="marcos obrigatórios"
                            value={formatNumber(module.requiredMilestoneCount)}
                          />
                          <CriteriaTile
                            detail="sessões completas"
                            icon={<CalendarDays className="h-5 w-5" />}
                            label="mínimo"
                            value={formatNumber(module.criteria.minSessions)}
                          />
                          <CriteriaTile
                            detail="taxa mínima de sucesso"
                            icon={<BookOpenCheck className="h-5 w-5" />}
                            label="sucesso"
                            value={formatSuccess(module.criteria.minSuccessRate)}
                          />
                          <CriteriaTile
                            detail="distância mínima trabalhada"
                            icon={<Ruler className="h-5 w-5" />}
                            label="distância"
                            value={formatDistance(module.criteria.minDistanceM)}
                          />
                          <CriteriaTile
                            detail="eventos esperados"
                            icon={<Flag className="h-5 w-5" />}
                            label="eventos"
                            value={
                              module.criteria.requiredEvents.join(", ") || "--"
                            }
                          />
                          <CriteriaTile
                            detail="validação final"
                            icon={<UserCheck className="h-5 w-5" />}
                            label="Instrutor K9"
                            value={
                              module.criteria.instructorApprovalRequired
                                ? "obrigatória"
                                : "dispensada"
                            }
                          />
                        </div>
                        <ModuleForm
                          canEdit={canEdit}
                          key={module.id}
                          module={module}
                          onSave={(input) =>
                            run(`module:${module.id}`, () =>
                              updateTrainingModule(
                                selectedProgram.id,
                                module.id,
                                input,
                                profile,
                              ),
                            )
                          }
                          saving={savingKey === `module:${module.id}`}
                        />
                      </div>
                    ) : null}
                  </article>
                );
              })}

              <NewModuleForm
                canEdit={canEdit}
                key={`${selectedProgram.id}:${nextModuleOrder}`}
                nextOrder={nextModuleOrder}
                onCreate={(input) =>
                  run("module:new", () =>
                    createTrainingModule(selectedProgram.id, input, profile),
                  )
                }
                saving={savingKey === "module:new"}
              />
            </div>
          </Panel>

          <div className="space-y-5">
            <Panel
              action={
                <Badge tone="cyan">
                  {selectedModule?.milestoneCount ?? 0} marcos
                </Badge>
              }
              subtitle="A ordem dos marcos define a sequencia obrigatória de evolução."
              title="Marcos obrigatórios"
            >
              {selectedModule ? (
                <div className="space-y-3">
                  {selectedModule.milestones.map((milestone) => (
                    <MilestoneEditor
                      canEdit={canEdit}
                      key={milestone.id}
                      milestone={milestone}
                      onSave={(input) =>
                        run(`milestone:${milestone.id}`, () =>
                          updateTrainingMilestone(
                            selectedProgram.id,
                            selectedModule.id,
                            milestone.id,
                            input,
                            profile,
                          ),
                        )
                      }
                      saving={savingKey === `milestone:${milestone.id}`}
                    />
                  ))}
                  <NewMilestoneForm
                    canEdit={canEdit}
                    key={`${selectedModule.id}:${nextMilestoneOrder}`}
                    nextOrder={nextMilestoneOrder}
                    onCreate={(input) =>
                      run("milestone:new", () =>
                        createTrainingMilestone(
                          selectedProgram.id,
                          selectedModule.id,
                          input,
                          profile,
                        ),
                      )
                    }
                    saving={savingKey === "milestone:new"}
                  />
                </div>
              ) : (
                <EmptyState label="Selecione ou crie um módulo para cadastrar marcos." />
              )}
            </Panel>

            <ProgramSettings
              canEdit={canEdit}
              key={selectedProgram.id}
              onSave={(input) =>
                run(`program:${selectedProgram.id}`, () =>
                  updateTrainingProgram(selectedProgram.id, input, profile),
                )
              }
              program={selectedProgram}
              saving={savingKey === `program:${selectedProgram.id}`}
            />
          </div>
        </div>
      ) : (
        <NewProgramForm
          canEdit={canEdit}
          onCreate={(input) =>
            run("program:new", async () => {
              await createTrainingProgram(input, profile);
            })
          }
          saving={savingKey === "program:new"}
        />
      )}

      <Panel
        action={<Badge tone="slate">{formatNumber(totals.metrics)} métricas</Badge>}
        subtitle="Resumo de integridade do cadastro curricular atual."
        title="Cobertura do currículo"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
            <Layers3 className="h-5 w-5 text-cyan-200" />
            <p className="mt-3 font-mono text-3xl font-black text-white">
              {formatNumber(totals.modules)}
            </p>
            <p className="text-sm text-slate-400">módulos cadastrados</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
            <Target className="h-5 w-5 text-cyan-200" />
            <p className="mt-3 font-mono text-3xl font-black text-white">
              {formatNumber(totals.milestones)}
            </p>
            <p className="text-sm text-slate-400">marcos cadastrados</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
            <ShieldCheck className="h-5 w-5 text-cyan-200" />
            <p className="mt-3 font-mono text-3xl font-black text-white">
              {formatNumber(data.metrics.activePrograms)}
            </p>
            <p className="text-sm text-slate-400">currículos ativos</p>
          </div>
        </div>
      </Panel>

      {data.loading ? (
        <div className="fixed bottom-5 right-5 rounded-full border border-cyan-300/20 bg-slate-950/90 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          sincronizando
        </div>
      ) : null}
    </div>
  );
}
