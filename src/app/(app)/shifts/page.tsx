"use client";

import {
  Archive,
  Bell,
  Briefcase,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  Info,
  LoaderCircle,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  archiveShiftGroup,
  defaultShiftNotifications,
  defaultTwoByTwoWorkPattern,
  expectedShiftWindowAt,
  expectedShiftWindowForDate,
  isOvernightShift,
  nextShiftWindow,
  saveShiftGroup,
  subscribeShiftAssignments,
  syncShiftGroupMembers,
  type ShiftAssignment,
  type ShiftGroup,
  type ShiftGroupFormValues,
  type ShiftGroupType,
  type ShiftScheduleType,
  type ShiftWindow,
} from "@/features/effective/data/shift-group-service";
import { useShiftGroups } from "@/features/effective/hooks/use-shift-groups";
import { useAccessUsers } from "@/features/access/hooks/use-access-users";
import type { AccessUser } from "@/features/access/data/access-profile-service";
import { cn } from "@/lib/utils";

type DialogMode = "create" | "edit" | null;
type ShiftGroupCardModel = ShiftGroup & { memberCount: number };
type ShiftGroupFormState = ShiftGroupFormValues;
type TypeFilter = "all" | ShiftGroupType;
type StatusFilter = "all" | "today" | "in_progress";
type ScaleFilter = "all" | ShiftScheduleType;

const emptyForm: ShiftGroupFormState = {
  anchorDate: dateInputValue(new Date()),
  code: "",
  expectedEndHour: 19,
  expectedStartHour: 7,
  municipality: "limeira",
  name: "",
  notes: "",
  notifications: defaultShiftNotifications,
  scheduleType: "two_by_two",
  type: "operational",
  workPattern: defaultTwoByTwoWorkPattern,
};

const scheduleOptions: Array<{
  description: string;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  value: ShiftScheduleType;
}> = [
  {
    description: "Trabalha 2 dias seguidos e folga 2 dias.",
    icon: CalendarClock,
    label: "2x2",
    value: "two_by_two",
  },
  {
    description: "Expediente administrativo de segunda a sexta.",
    icon: Briefcase,
    label: "Segunda a sexta",
    value: "weekdays",
  },
  {
    description: "Reservada para regras especiais futuras.",
    disabled: true,
    icon: Clock,
    label: "Personalizada",
    value: "custom",
  },
];

const workPatternOptions = [
  {
    detail: "Dias 0 e 1 do ciclo trabalham.",
    label: "Alfa / Bravo",
    value: [0, 1],
  },
  {
    detail: "Dias 2 e 3 do ciclo trabalham.",
    label: "Charlie / Delta",
    value: [2, 3],
  },
];

const typeFilterOptions: Array<{ label: string; value: TypeFilter }> = [
  { label: "Todos", value: "all" },
  { label: "Operacionais", value: "operational" },
  { label: "Administrativos", value: "administrative" },
];

const statusFilterOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: "Todos", value: "all" },
  { label: "Com turno hoje", value: "today" },
  { label: "Em andamento", value: "in_progress" },
];

const scaleFilterOptions: Array<{ label: string; value: ScaleFilter }> = [
  { label: "Todas", value: "all" },
  { label: "Escala 2x2", value: "two_by_two" },
  { label: "Segunda a sexta", value: "weekdays" },
];

function formFromGroup(group: ShiftGroup | null): ShiftGroupFormState {
  if (!group) return emptyForm;
  return {
    anchorDate: group.anchorDate,
    code: group.code,
    expectedEndHour: group.expectedEndHour,
    expectedStartHour: group.expectedStartHour,
    municipality: group.municipality,
    name: group.name,
    notes: group.notes,
    notifications: group.notifications,
    scheduleType: group.scheduleType,
    type: group.type,
    workPattern: group.workPattern,
  };
}

function ShiftGroupDialog({
  group,
  mode,
  onClose,
  onSave,
}: {
  group: ShiftGroup | null;
  mode: DialogMode;
  onClose: () => void;
  onSave: (values: ShiftGroupFormValues, id?: string) => Promise<void>;
}) {
  const [form, setForm] = useState<ShiftGroupFormState>(() =>
    formFromGroup(group),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!mode) return null;

  const updateNotifications = (
    patch: Partial<ShiftGroupFormState["notifications"]>,
  ) => {
    setForm((current) => ({
      ...current,
      notifications: { ...current.notifications, ...patch },
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Informe o nome do plantão.");
      return;
    }
    if (!form.code.trim()) {
      setError("Informe o código do plantão.");
      return;
    }
    if (form.scheduleType === "two_by_two" && !form.anchorDate) {
      setError("Informe a data de referência da escala 2x2.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave(form, group?.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o plantão.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-[28px] border border-cyan-200/15 bg-[#081321] shadow-[0_30px_100px_rgba(0,0,0,0.55)] lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.18)]">
                <CalendarClock className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl font-black text-white">
                  {mode === "create" ? "Novo plantão" : "Editar plantão"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Cadastre a regra de escala e os lembretes operacionais.
                </p>
              </div>
            </div>
            <button
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
              onClick={onClose}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-[1fr_160px]">
              <FormField label="Nome do plantão *">
                <input
                  className={inputClass}
                  placeholder="Ex.: Plantão Alfa"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </FormField>
              <FormField label="Código *">
                <input
                  className={inputClass}
                  placeholder="ALFA"
                  value={form.code}
                  onChange={(event) =>
                    setForm({ ...form, code: event.target.value.toUpperCase() })
                  }
                />
              </FormField>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FormField label="Tipo *">
                <SegmentedButtons
                  options={[
                    {
                      icon: ShieldCheck,
                      label: "Operacional",
                      value: "operational",
                    },
                    {
                      icon: Briefcase,
                      label: "Administrativo",
                      value: "administrative",
                    },
                  ]}
                  value={form.type}
                  onChange={(value) => {
                    const nextType = value as ShiftGroupType;
                    const shouldUseWeekdays = nextType === "administrative";
                    setForm({
                      ...form,
                      anchorDate: shouldUseWeekdays
                        ? null
                        : form.anchorDate ?? dateInputValue(new Date()),
                      scheduleType: shouldUseWeekdays
                        ? "weekdays"
                        : form.scheduleType === "weekdays"
                          ? "two_by_two"
                          : form.scheduleType,
                      type: nextType,
                    });
                  }}
                />
              </FormField>

              <FormField label="Município *">
                <input
                  className={inputClass}
                  placeholder="Limeira"
                  value={form.municipality}
                  onChange={(event) =>
                    setForm({ ...form, municipality: event.target.value })
                  }
                />
              </FormField>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <FormField label="Horário de início *">
                <input
                  className={inputClass}
                  type="time"
                  value={hourInputValue(form.expectedStartHour)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      expectedStartHour: timeInputToHour(event.target.value, 7),
                    })
                  }
                />
              </FormField>
              <FormField label="Horário de fim *">
                <input
                  className={inputClass}
                  type="time"
                  value={hourInputValue(form.expectedEndHour)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      expectedEndHour: timeInputToHour(event.target.value, 19),
                    })
                  }
                />
              </FormField>
              <FormField label="Data de referência *">
                <input
                  className={inputClass}
                  disabled={form.scheduleType !== "two_by_two"}
                  type="date"
                  value={form.anchorDate ?? ""}
                  onChange={(event) =>
                    setForm({ ...form, anchorDate: event.target.value || null })
                  }
                />
              </FormField>
            </div>

            <div className="mt-4">
              <FormField label="Escala *">
                <div className="grid gap-3 md:grid-cols-3">
                  {scheduleOptions.map((option) => {
                    const active = form.scheduleType === option.value;
                    return (
                      <button
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-sm font-bold transition",
                          active
                            ? "border-cyan-300/45 bg-cyan-300/12 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                            : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20",
                          option.disabled &&
                            "cursor-not-allowed opacity-45 hover:border-white/10",
                        )}
                        disabled={option.disabled}
                        key={option.value}
                        onClick={() =>
                          setForm({
                            ...form,
                            anchorDate:
                              option.value === "two_by_two"
                                ? form.anchorDate ?? dateInputValue(new Date())
                                : null,
                            scheduleType: option.value,
                            type:
                              option.value === "weekdays"
                                ? "administrative"
                                : form.type,
                          })
                        }
                        type="button"
                      >
                        <option.icon className="mr-2 inline h-4 w-4 text-cyan-300" />
                        {option.label}
                        <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </FormField>
            </div>

            {form.scheduleType === "two_by_two" ? (
              <div className="mt-4">
                <FormField label="Ciclo 2x2">
                  <div className="grid gap-3 md:grid-cols-2">
                    {workPatternOptions.map((option) => {
                      const active = patternEquals(form.workPattern, option.value);
                      return (
                        <button
                          className={cn(
                            "rounded-2xl border p-4 text-left transition",
                            active
                              ? "border-cyan-300/45 bg-cyan-300/12"
                              : "border-white/10 bg-white/[0.035] hover:border-white/20",
                          )}
                          key={option.label}
                          onClick={() =>
                            setForm({ ...form, workPattern: option.value })
                          }
                          type="button"
                        >
                          <span className="font-bold text-white">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-xs text-slate-400">
                            {option.detail}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </FormField>
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.025]">
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              <Bell className="h-5 w-5 text-cyan-300" />
              <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-300">
                Notificações do celular
              </h3>
            </div>
            <div className="divide-y divide-white/10">
              <ToggleRow
                checked={form.notifications.startReminderEnabled}
                detail={`Enviar ${form.notifications.startLeadMinutes} min antes do horário previsto.`}
                label="Lembrete para assumir turno"
                onChange={(checked) =>
                  updateNotifications({ startReminderEnabled: checked })
                }
              />
              <ToggleRow
                checked={form.notifications.endReminderEnabled}
                detail="Avisar no horário previsto de encerramento."
                label="Lembrete para encerrar turno"
                onChange={(checked) =>
                  updateNotifications({ endReminderEnabled: checked })
                }
              />
              <ToggleRow
                checked={form.notifications.overdueReminderEnabled}
                detail={`Avisar após ${form.notifications.overdueAfterMinutes} min de turno aberto.`}
                label="Lembrete de turno em horário excedido"
                onChange={(checked) =>
                  updateNotifications({ overdueReminderEnabled: checked })
                }
              />
            </div>
          </div>

          <div className="mt-4">
            <FormField label="Observações (opcional)">
              <textarea
                className={cn(inputClass, "h-24 resize-none py-3")}
                maxLength={300}
                placeholder="Adicione informações complementares sobre este plantão..."
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
              <span className="mt-1 block text-right text-xs text-slate-500">
                {form.notes.length}/300
              </span>
            </FormField>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={loading} onClick={handleSave} variant="primary">
              {loading ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Salvar plantão
            </Button>
          </div>
        </div>

        <ScaleGuide />
      </div>
    </div>
  );
}

function ScaleGuide() {
  return (
    <aside className="border-t border-white/10 bg-white/[0.02] p-5 sm:p-7 lg:border-l lg:border-t-0">
      <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5">
        <div className="flex items-center gap-3">
          <Info className="h-5 w-5 text-cyan-300" />
          <h3 className="font-black text-white">Entenda a lógica da escala</h3>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          A escala define quando cada plantão deve estar de serviço. O turno real
          continua sendo assumido e encerrado pelo operador no mobile.
        </p>

        <div className="mt-5 space-y-3">
          <ScaleExample
            badge="2x2"
            icon={Sun}
            label="Alfa"
            schedule="07h - 19h"
          />
          <ScaleExample
            badge="2x2"
            icon={Moon}
            label="Bravo"
            schedule="19h - 07h"
          />
          <ScaleExample
            badge="2x2"
            icon={Sun}
            label="Charlie"
            schedule="07h - 19h"
          />
          <ScaleExample
            badge="2x2"
            icon={Moon}
            label="Delta"
            schedule="19h - 07h"
          />
          <ScaleExample
            badge="Seg a Sex"
            icon={Briefcase}
            label="Administrativo"
            schedule="08h - 17h"
          />
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 text-sm leading-6 text-slate-300">
          <span className="font-bold text-cyan-200">Exemplo de ciclo 2x2:</span>{" "}
          trabalha 2 dias seguidos e folga 2 dias consecutivos, alternando com
          o próximo plantão da sequência.
        </div>
      </div>
    </aside>
  );
}

function ScaleExample({
  badge,
  icon: Icon,
  label,
  schedule,
}: {
  badge: string;
  icon: LucideIcon;
  label: string;
  schedule: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-cyan-300" />
        <div>
          <p className="font-bold text-cyan-100">{label}</p>
          <p className="font-mono text-sm text-slate-400">{schedule}</p>
        </div>
      </div>
      <span className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-bold text-cyan-200">
        {badge}
      </span>
    </div>
  );
}

function ToggleRow({
  checked,
  detail,
  label,
  onChange,
}: {
  checked: boolean;
  detail: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.025]"
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span>
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          {label}
          <Info className="h-3.5 w-3.5 text-slate-500" />
        </span>
        <span className="mt-1 block text-xs text-slate-500">{detail}</span>
      </span>
      <span
        className={cn(
          "relative h-7 w-12 rounded-full border transition",
          checked
            ? "border-cyan-300/40 bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.26)]"
            : "border-white/10 bg-white/[0.08]",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-slate-950 transition",
            checked ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

function FormField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function SegmentedButtons({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: Array<{
    icon: LucideIcon;
    label: string;
    value: string;
  }>;
  value: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm font-bold transition",
              active
                ? "border-cyan-300/45 bg-cyan-300/12 text-cyan-100"
                : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <option.icon className="mr-2 inline h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.015] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-300">{label}</p>
          <p className="mt-2 text-4xl font-black text-white">{value}</p>
          <p className="mt-1 text-sm text-slate-400">{detail}</p>
        </div>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.16)]">
          <Icon className="h-7 w-7" />
        </span>
      </div>
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <select
        className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-semibold text-slate-200 outline-none transition focus:border-cyan-300/35"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ShiftCard({
  group,
  onArchive,
  onEdit,
  onManageMembers,
  onOpenAgenda,
}: {
  group: ShiftGroupCardModel;
  onArchive: (group: ShiftGroup) => void;
  onEdit: (group: ShiftGroup) => void;
  onManageMembers: (group: ShiftGroup) => void;
  onOpenAgenda: (group: ShiftGroup) => void;
}) {
  const isOvernight = isOvernightShift(group);
  const nextWindow = nextShiftWindow(group);
  const inProgress = expectedShiftWindowAt(group) !== null;

  return (
    <article className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.055] to-white/[0.018] p-5 transition hover:border-cyan-300/20 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl border",
              group.type === "operational"
                ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-200"
                : "border-blue-300/25 bg-blue-300/10 text-blue-200",
            )}
          >
            <GroupIcon className="h-6 w-6" group={group} />
          </span>
          <div>
            <h3 className="text-lg font-black text-white">{group.name}</h3>
            <p className="mt-0.5 text-sm text-slate-400">
              {cityLabel(group.municipality)}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Badge tone={group.type === "operational" ? "cyan" : "slate"}>
            {group.type === "operational" ? "Operacional" : "Administrativo"}
          </Badge>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Ativo
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-2 text-sm text-slate-300">
        <InfoLine icon={Clock}>
          <span className="font-mono">
            {hourText(group.expectedStartHour)} - {hourText(group.expectedEndHour)}
            {isOvernight ? " (+1 dia)" : ""}
          </span>
        </InfoLine>
        <InfoLine icon={CalendarClock}>{scaleSummary(group)}</InfoLine>
        <InfoLine icon={Users}>{memberLabel(group.memberCount)}</InfoLine>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.04] p-3 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Próximo turno
          </p>
          <p className="mt-1 text-sm font-bold text-white">
            {relativeWindowLabel(nextWindow)}
          </p>
        </div>
        {inProgress ? (
          <span className="self-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">
            Em andamento
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/8 pt-4 xl:grid-cols-4">
        <ActionButton icon={Edit2} label="Editar" onClick={() => onEdit(group)} />
        <ActionButton
          icon={Users}
          label="Vincular"
          onClick={() => onManageMembers(group)}
        />
        <ActionButton
          icon={CalendarClock}
          label="Agenda"
          onClick={() => onOpenAgenda(group)}
        />
        <ActionButton
          danger
          icon={Archive}
          label="Desativar"
          onClick={() => onArchive(group)}
        />
      </div>
    </article>
  );
}

function ActionButton({
  danger,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition",
        danger
          ? "border-red-400/20 bg-red-400/8 text-red-300 hover:border-red-300/35"
          : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/25 hover:text-cyan-100",
        disabled && "cursor-not-allowed opacity-45 hover:border-white/10",
      )}
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Disponível na próxima etapa" : undefined}
      type="button"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function InfoLine({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-500" />
      <span>{children}</span>
    </div>
  );
}

function TodayAgendaPanel({
  groups,
  now,
  onOpenAgenda,
}: {
  groups: ShiftGroupCardModel[];
  now: Date;
  onOpenAgenda: (group?: ShiftGroup) => void;
}) {
  const entries = useMemo(() => {
    return groups
      .map((group) => ({
        group,
        window: expectedShiftWindowForDate(group, now),
      }))
      .filter(
        (item): item is { group: ShiftGroupCardModel; window: ShiftWindow } =>
          item.window !== null,
      )
      .sort((a, b) => a.window.start.getTime() - b.window.start.getTime());
  }, [groups, now]);

  const activeNow = entries.filter(
    ({ group }) => expectedShiftWindowAt(group, now) !== null,
  ).length;
  const membersToday = entries.reduce(
    (total, { group }) => total + group.memberCount,
    0,
  );

  return (
    <aside className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.055] to-white/[0.018]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-cyan-300" />
          <h2 className="font-black text-white">Agenda de hoje</h2>
        </div>
        <button
          className="rounded-xl border border-cyan-300/20 bg-cyan-300/8 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/12"
          onClick={() => onOpenAgenda()}
          type="button"
        >
          Ver agenda completa
        </button>
      </div>

      <div className="space-y-3 p-4">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
            Nenhum plantão previsto para hoje.
          </div>
        ) : (
          entries.map(({ group, window }) => (
            <TodayAgendaCard group={group} key={group.id} window={window} />
          ))
        )}
      </div>

      <div className="border-t border-white/10 p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-cyan-300" />
          <h3 className="text-sm font-black text-white">Resumo do dia</h3>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <DaySummaryValue label="Turnos ativos" value={activeNow} />
          <DaySummaryValue label="GCMs previstos" value={membersToday} />
          <DaySummaryValue label="Turnos previstos" value={entries.length} />
        </div>
      </div>
    </aside>
  );
}

function useShiftAssignments() {
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeShiftAssignments(
        (nextAssignments) => {
          setAssignments(nextAssignments);
          setError(null);
          setLoading(false);
        },
        (nextError) => {
          setError(nextError.message);
          setLoading(false);
        },
      ),
    [],
  );

  return { assignments, error, loading };
}

function MembersDialog({
  assignments,
  group,
  groups,
  loading,
  onClose,
  onSaved,
  users,
}: {
  assignments: ShiftAssignment[];
  group: ShiftGroupCardModel;
  groups: ShiftGroupCardModel[];
  loading: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  users: AccessUser[];
}) {
  const initialSelected = useMemo(
    () =>
      new Set(
        assignments
          .filter((assignment) => assignment.shiftGroupId === group.id)
          .map((assignment) => assignment.userId),
      ),
    [assignments, group.id],
  );
  const [selected, setSelected] = useState<Set<string>>(() => initialSelected);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignmentsByUser = useMemo(() => {
    const map = new Map<string, ShiftAssignment>();
    for (const assignment of assignments) {
      map.set(assignment.userId, assignment);
    }
    return map;
  }, [assignments]);

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of groups) map.set(item.id, item.name);
    return map;
  }, [groups]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      const matches =
        !needle ||
        user.callsign.toLowerCase().includes(needle) ||
        user.ra.toLowerCase().includes(needle) ||
        (user.fullName ?? "").toLowerCase().includes(needle);
      return matches;
    });
  }, [query, users]);

  const toggleUser = (ra: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(ra)) {
        next.delete(ra);
      } else {
        next.add(ra);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await syncShiftGroupMembers(group, Array.from(selected));
      await onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar os vínculos.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-4xl rounded-[28px] border border-cyan-200/15 bg-[#081321] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Vincular GCMs
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              {group.name}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Selecione os operadores que pertencem a este plantão. Um GCM fica
              em apenas um plantão ativo por vez.
            </p>
          </div>
          <button
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/60 pl-12 pr-4 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
              placeholder="Buscar por nome, RA ou nome completo..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/8 px-4 py-3 text-sm font-bold text-cyan-100">
            {selected.size} selecionado{selected.size === 1 ? "" : "s"}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-5 max-h-[56vh] space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 text-center text-sm text-slate-400">
              Carregando GCMs...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              Nenhum GCM encontrado.
            </div>
          ) : (
            filteredUsers.map((user) => {
              const activeAssignment = assignmentsByUser.get(user.ra);
              const currentGroup =
                activeAssignment?.shiftGroupId === group.id
                  ? "Neste plantão"
                  : activeAssignment
                    ? groupNameById.get(activeAssignment.shiftGroupId) ??
                      activeAssignment.shiftGroupLabel ??
                      "Outro plantão"
                    : "Sem plantão";
              const checked = selected.has(user.ra);

              return (
                <button
                  className={cn(
                    "flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition",
                    checked
                      ? "border-cyan-300/35 bg-cyan-300/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20",
                  )}
                  key={user.ra}
                  onClick={() => toggleUser(user.ra)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-white">{user.callsign}</p>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-slate-400">
                        MAT {user.ra}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {user.fullName ?? user.role ?? "Sem nome completo"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-bold",
                        activeAssignment?.shiftGroupId === group.id
                          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                          : activeAssignment
                            ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
                            : "border-slate-500/25 bg-slate-500/10 text-slate-400",
                      )}
                    >
                      {currentGroup}
                    </span>
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border",
                        checked
                          ? "border-cyan-300 bg-cyan-300 text-slate-950"
                          : "border-white/15 text-transparent",
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={handleSave} variant="primary">
            {saving ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Salvar vínculos
          </Button>
        </div>
      </div>
    </div>
  );
}

function AgendaDialog({
  focusGroup,
  groups,
  onClose,
}: {
  focusGroup: ShiftGroupCardModel | null;
  groups: ShiftGroupCardModel[];
  onClose: () => void;
}) {
  const [days, setDays] = useState(14);
  const entries = useMemo(
    () => buildAgendaEntries(focusGroup ? [focusGroup] : groups, days),
    [days, focusGroup, groups],
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-5xl rounded-[28px] border border-cyan-200/15 bg-[#081321] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Agenda prevista
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              {focusGroup ? focusGroup.name : "Plantões da unidade"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Projeção calculada pela regra de escala. Não cria turnos reais
              nem encerra plantões automaticamente.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-semibold text-slate-200 outline-none focus:border-cyan-300/35"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
            </select>
            <button
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
              onClick={onClose}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-6 max-h-[68vh] space-y-4 overflow-y-auto pr-1">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
              Nenhum plantão previsto no período selecionado.
            </div>
          ) : (
            entries.map((day) => (
              <section
                className="rounded-3xl border border-white/10 bg-white/[0.025] p-4"
                key={day.key}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black text-white">{day.label}</h3>
                    <p className="text-sm text-slate-500">{day.dateLabel}</p>
                  </div>
                  <Badge tone="cyan">
                    {day.items.length} turno{day.items.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {day.items.map(({ group, window }) => (
                    <article
                      className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                      key={`${group.id}-${window.start.toISOString()}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                            <GroupIcon className="h-5 w-5" group={group} />
                          </span>
                          <div>
                            <p className="font-bold text-white">{group.name}</p>
                            <p className="font-mono text-xs text-slate-400">
                              {timeLabel(window.start)} - {timeLabel(window.end)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            tone={group.type === "operational" ? "cyan" : "slate"}
                          >
                            {scaleSummary(group)}
                          </Badge>
                          <p className="mt-2 text-xs text-slate-500">
                            {memberLabel(group.memberCount)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TodayAgendaCard({
  group,
  window,
}: {
  group: ShiftGroupCardModel;
  window: ShiftWindow;
}) {
  const inProgress = expectedShiftWindowAt(group) !== null;

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span
            className={cn(
              "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
              group.type === "operational"
                ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
                : "border-blue-300/20 bg-blue-300/10 text-blue-200",
            )}
          >
            <GroupIcon className="h-5 w-5" group={group} />
          </span>
          <div>
            <h3 className="font-bold text-white">{group.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-slate-400">
              {timeLabel(window.start)} - {timeLabel(window.end)} ·{" "}
              {scaleSummary(group)}
            </p>
            <p
              className={cn(
                "mt-2 text-xs font-bold",
                inProgress ? "text-emerald-300" : "text-amber-300",
              )}
            >
              {inProgress ? "Em andamento" : relativeWindowLabel(window)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={group.type === "operational" ? "cyan" : "slate"}>
            {group.type === "operational" ? "Operacional" : "Adm"}
          </Badge>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-slate-300">
            {group.memberCount} GCMs
          </span>
        </div>
      </div>
    </article>
  );
}

function DaySummaryValue({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.055] disabled:cursor-not-allowed disabled:opacity-45";

export default function ShiftsPage() {
  const { error, groups, loading, refetchCounts } = useShiftGroups();
  const {
    assignments,
    error: assignmentsError,
    loading: assignmentsLoading,
  } = useShiftAssignments();
  const {
    error: usersError,
    loading: usersLoading,
    users,
  } = useAccessUsers();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingGroup, setEditingGroup] = useState<ShiftGroup | null>(null);
  const [membersGroup, setMembersGroup] = useState<ShiftGroupCardModel | null>(
    null,
  );
  const [agendaGroup, setAgendaGroup] = useState<ShiftGroupCardModel | null>(
    null,
  );
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [scaleFilter, setScaleFilter] = useState<ScaleFilter>("all");
  const now = useMemo(() => new Date(), []);

  const groupsWithLiveCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const assignment of assignments) {
      counts.set(
        assignment.shiftGroupId,
        (counts.get(assignment.shiftGroupId) ?? 0) + 1,
      );
    }

    return groups.map((group) => ({
      ...group,
      memberCount: assignmentsLoading
        ? group.memberCount
        : counts.get(group.id) ?? 0,
    }));
  }, [assignments, assignmentsLoading, groups]);

  const metrics = useMemo(() => {
    const operational = groupsWithLiveCounts.filter(
      (group) => group.type === "operational",
    );
    const administrative = groupsWithLiveCounts.filter(
      (group) => group.type === "administrative",
    );
    const today = groupsWithLiveCounts.filter(
      (group) => expectedShiftWindowForDate(group, now) !== null,
    );
    const inProgress = groupsWithLiveCounts.filter(
      (group) => expectedShiftWindowAt(group, now) !== null,
    );

    return {
      administrative: administrative.length,
      inProgress: inProgress.length,
      operational: operational.length,
      today: today.length,
      total: groupsWithLiveCounts.length,
    };
  }, [groupsWithLiveCounts, now]);

  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return groupsWithLiveCounts.filter((group) => {
      const matchesSearch =
        !needle ||
        group.name.toLowerCase().includes(needle) ||
        group.code.toLowerCase().includes(needle) ||
        group.municipality.toLowerCase().includes(needle);
      const matchesType = typeFilter === "all" || group.type === typeFilter;
      const matchesScale =
        scaleFilter === "all" || group.scheduleType === scaleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "today" &&
          expectedShiftWindowForDate(group, now) !== null) ||
        (statusFilter === "in_progress" &&
          expectedShiftWindowAt(group, now) !== null);

      return matchesSearch && matchesType && matchesScale && matchesStatus;
    });
  }, [groupsWithLiveCounts, now, scaleFilter, search, statusFilter, typeFilter]);

  const hasFilters =
    search.trim() ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    scaleFilter !== "all";

  const handleSave = async (values: ShiftGroupFormValues, id?: string) => {
    await saveShiftGroup(values, id);
    await refetchCounts();
  };

  const handleArchive = async (group: ShiftGroup) => {
    if (
      confirm(
        `Desativar o plantão ${group.name}? Ele sairá da escala ativa, mas o histórico será preservado.`,
      )
    ) {
      await archiveShiftGroup(group.id);
      await refetchCounts();
    }
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setScaleFilter("all");
  };

  const openAgenda = (group?: ShiftGroup) => {
    setAgendaGroup(
      group
        ? groupsWithLiveCounts.find((item) => item.id === group.id) ?? null
        : null,
    );
    setAgendaOpen(true);
  };

  const pageError = error ?? assignmentsError ?? usersError;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-3xl font-black text-white">Plantões</h1>
          <p className="mt-1 text-sm text-slate-400">
            Gerencie a escala operacional da unidade de forma eficiente e
            integrada.
          </p>
        </div>
        <Button
          className="h-12 self-start px-5 xl:self-auto"
          onClick={() => {
            setEditingGroup(null);
            setDialogMode("create");
          }}
          variant="primary"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo plantão
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          detail="cadastrados"
          icon={CalendarClock}
          label="Total de plantões"
          value={metrics.total}
        />
        <MetricCard
          detail={`${percentage(metrics.operational, metrics.total)}% do total`}
          icon={CheckCircle2}
          label="Operacionais"
          value={metrics.operational}
        />
        <MetricCard
          detail={`${percentage(metrics.administrative, metrics.total)}% do total`}
          icon={Briefcase}
          label="Administrativos"
          value={metrics.administrative}
        />
        <MetricCard
          detail={`${metrics.today} previstos hoje`}
          icon={Clock}
          label="Turnos agora"
          value={metrics.inProgress}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_170px_170px_170px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/60 pl-12 pr-4 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
                  placeholder="Buscar plantão por nome, código ou município..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <FilterSelect
                label="Tipo"
                onChange={setTypeFilter}
                options={typeFilterOptions}
                value={typeFilter}
              />
              <FilterSelect
                label="Status"
                onChange={setStatusFilter}
                options={statusFilterOptions}
                value={statusFilter}
              />
              <FilterSelect
                label="Escala"
                onChange={setScaleFilter}
                options={scaleFilterOptions}
                value={scaleFilter}
              />
              <Button
                className="h-12 self-end"
                disabled={!hasFilters}
                onClick={clearFilters}
                variant="ghost"
              >
                Limpar filtros
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-3xl border border-white/10 bg-white/[0.025] py-20">
              <div className="rounded-full border border-cyan-300/20 bg-slate-950/90 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
                carregando
              </div>
            </div>
          ) : pageError ? (
            <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-5 text-sm text-red-200">
              Não foi possível carregar os plantões agora. Tente novamente em
              instantes.
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-cyan-200/15 bg-black/16 px-5 py-16 text-center">
              <CalendarClock className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">
                {hasFilters
                  ? "Nenhum plantão encontrado com os filtros atuais."
                  : "Nenhum plantão cadastrado ainda."}
              </p>
              {!hasFilters ? (
                <Button
                  className="mt-4"
                  onClick={() => {
                    setEditingGroup(null);
                    setDialogMode("create");
                  }}
                  variant="primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeiro plantão
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 2xl:grid-cols-2">
              {filteredGroups.map((group) => (
                <ShiftCard
                  group={group}
                  key={group.id}
                  onArchive={handleArchive}
                  onEdit={(nextGroup) => {
                    setEditingGroup(nextGroup);
                    setDialogMode("edit");
                  }}
                  onManageMembers={(nextGroup) => {
                    setMembersGroup(
                      groupsWithLiveCounts.find(
                        (item) => item.id === nextGroup.id,
                      ) ?? null,
                    );
                  }}
                  onOpenAgenda={openAgenda}
                />
              ))}
            </div>
          )}
        </section>

        <TodayAgendaPanel
          groups={groupsWithLiveCounts}
          now={now}
          onOpenAgenda={openAgenda}
        />
      </div>

      <ShiftGroupDialog
        group={editingGroup}
        key={`${dialogMode}-${editingGroup?.id ?? "new"}`}
        mode={dialogMode}
        onClose={() => {
          setDialogMode(null);
          setEditingGroup(null);
        }}
        onSave={handleSave}
      />

      {membersGroup ? (
        <MembersDialog
          assignments={assignments}
          group={membersGroup}
          groups={groupsWithLiveCounts}
          key={membersGroup.id}
          loading={usersLoading || assignmentsLoading}
          onClose={() => setMembersGroup(null)}
          onSaved={refetchCounts}
          users={users}
        />
      ) : null}

      {agendaOpen ? (
        <AgendaDialog
          focusGroup={agendaGroup}
          groups={groupsWithLiveCounts}
          onClose={() => {
            setAgendaOpen(false);
            setAgendaGroup(null);
          }}
        />
      ) : null}
    </div>
  );
}

function cityLabel(value: string) {
  const normalized = value.trim();
  if (!normalized) return "Sem município";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildAgendaEntries(groups: ShiftGroupCardModel[], days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const items = groups
      .map((group) => ({
        group,
        window: expectedShiftWindowForDate(group, date),
      }))
      .filter(
        (item): item is { group: ShiftGroupCardModel; window: ShiftWindow } =>
          item.window !== null,
      )
      .sort((a, b) => a.window.start.getTime() - b.window.start.getTime());

    return {
      date,
      dateLabel: date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        weekday: "long",
      }),
      items,
      key: dateInputValue(date),
      label: relativeDateLabel(date),
    };
  }).filter((day) => day.items.length > 0);
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function GroupIcon({
  className,
  group,
}: {
  className?: string;
  group: Pick<ShiftGroup, "expectedEndHour" | "expectedStartHour" | "type">;
}) {
  if (group.type === "administrative") {
    return <Briefcase className={className} />;
  }
  if (isOvernightShift(group)) {
    return <Moon className={className} />;
  }
  return <Sun className={className} />;
}

function hourInputValue(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function hourText(hour: number) {
  return `${String(hour).padStart(2, "0")}h00`;
}

function memberLabel(count: number) {
  if (count === 1) return "1 GCM vinculado";
  return `${count} GCMs vinculados`;
}

function patternEquals(a: number[], b: number[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function relativeDateLabel(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  );

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  if (diffDays === -1) return "Ontem";
  return target.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function relativeWindowLabel(window: ShiftWindow | null) {
  if (!window) return "Sem previsão";
  return `${relativeDateLabel(window.start)} às ${timeLabel(window.start)}`;
}

function scaleSummary(group: ShiftGroup) {
  if (group.scheduleType === "weekdays") return "Escala administrativa";
  if (group.scheduleType === "custom") return "Escala personalizada";
  return "Escala 2x2";
}

function timeInputToHour(value: string, fallback: number) {
  const parsed = Number(value.split(":")[0]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(23, parsed));
}

function timeLabel(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
