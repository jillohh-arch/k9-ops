import type { ReactNode } from "react";
import {
  Activity,
  FileText,
  HeartPulse,
  Stethoscope,
  Target,
} from "lucide-react";

import {
  profileDate,
  profileRecordDate,
  profileText,
  type ProfileRecord,
} from "@/features/effective/hooks/use-k9-profile-data";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

export type TimelineItem = {
  category: "health" | "occurrence" | "training" | "weight" | "document";
  date: Date;
  detail: string;
  id: string;
  title: string;
};

export type HealthTab =
  | "clínical"
  | "documents"
  | "overview"
  | "vaccines"
  | "weight";

export type ProfileView = {
  birthDate: Date | null;
  breed: string;
  canônicalWeight: number | null;
  clínicalEvents: ProfileRecord[];
  conductor: ProfileRecord | null;
  conductorRa: string | null;
  currentWeight: number | null;
  documents: ProfileRecord[];
  healthEvents: ProfileRecord[];
  idealMax: number | null;
  idealMin: number | null;
  imageUrl: string | null;
  name: string;
  occurrences: ProfileRecord[];
  occurrences30: ProfileRecord[];
  registration: string;
  sessions: ProfileRecord[];
  sessions30: ProfileRecord[];
  sex: string;
  specialtyRecords: ProfileRecord[];
  status: { label: string; tone: "green" | "blue" | "amber" | "violet" | "slate" | "cyan" | "red" };
  timeline: TimelineItem[];
  vaccineDate: Date | null;
  vaccineDue: Date | null;
  vaccineRecords: ProfileRecord[];
  vaccines: ProfileRecord[];
  vaccineState: { tone: "green" | "blue" | "amber" | "violet" | "slate" | "cyan" | "red"; label: string };
  weightChartData: { date: string; fullDate?: string; weight: number }[];
  weights: ProfileRecord[];
  weightState: { tone: "green" | "blue" | "amber" | "violet" | "slate" | "cyan" | "red"; label: string };
};

// ─── Formatters ────────────────────────────────────────────────────────────

export const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// ─── Utility functions ─────────────────────────────────────────────────────

export function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function firstDate(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const parsed = profileDate(record[key]);
    if (parsed) return parsed;
  }
  return null;
}

export function ageLabel(date: Date | null) {
  if (!date) return "Não informada";
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  let months = now.getMonth() - date.getMonth();
  if (now.getDate() < date.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years <= 0 && months <= 0) return "Menos de 1 mes";
  if (years === 0) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const extra = months > 0 ? ` e ${months}m` : "";
  return `${years} ${years === 1 ? "ano" : "anos"}${extra}`;
}

export function dateLabel(date: Date | null) {
  if (!date) return "--";
  return dateFormatter.format(date);
}

export function weightValue(record: ProfileRecord | null): number | null {
  if (!record) return null;
  for (const key of ["weight", "peso", "weightKg", "weight_kg"]) {
    const raw = record[key];
    if (raw != null) {
      const num = Number(raw);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

export function eventTitle(record: ProfileRecord): string {
  return (
    profileText(record, [
      "description",
      "descrição",
      "procedimento",
      "type",
      "procedureType",
    ]) ?? "Evento"
  );
}

export function sessionTitle(record: ProfileRecord): string {
  return (
    profileText(record, [
      "modality",
      "type",
      "name",
      "description",
    ]) ?? "Treino"
  );
}

export function specialtyStatus(record: ProfileRecord): { label: string; tone: "green" | "blue" | "amber" | "violet" | "slate" | "cyan" | "red" } {
  const status = normalized(profileText(record, ["status", "training_status"]));
  if (["certified", "operational", "ativo"].includes(status)) {
    return { label: "Operacional", tone: "green" };
  }
  if (["in_training", "training", "em_treinamento"].includes(status)) {
    return { label: "Em treinamento", tone: "cyan" };
  }
  if (["suspended", "suspenso", "inactive", "inativo"].includes(status)) {
    return { label: "Suspenso", tone: "red" };
  }
  return { label: status || "Cadastrada", tone: "slate" };
}

export function vaccineState(record: ProfileRecord): { tone: "green" | "blue" | "amber" | "violet" | "slate" | "cyan" | "red"; label: string; dueDate: Date | null } {
  const applied = profileRecordDate(record);
  const due = firstDate(record as Record<string, unknown>, [
    "nextDueDate",
    "next_due_date",
    "próximaDose",
    "validUntil",
    "valid_until",
  ]);
  if (!applied) return { tone: "amber", label: "Sem data", dueDate: due };
  if (!due) return { tone: "cyan", label: "Aplicada", dueDate: null };
  const now = new Date();
  if (due.getTime() < now.getTime()) return { tone: "red", label: "Vencida", dueDate: due };
  const daysLeft = Math.round((due.getTime() - now.getTime()) / 86_400_000);
  if (daysLeft < 30) return { tone: "amber", label: `Vence em ${daysLeft}d`, dueDate: due };
  return { tone: "green", label: "Em dia", dueDate: due };
}

// ─── Timeline constants ────────────────────────────────────────────────────

export const timelineIcons: Record<TimelineItem["category"], typeof Activity> = {
  document: FileText,
  health: HeartPulse,
  occurrence: Stethoscope,
  training: Target,
  weight: Activity,
};

export const timelineTones: Record<TimelineItem["category"], string> = {
  document: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  health: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  occurrence: "border-red-300/20 bg-red-300/10 text-red-200",
  training: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  weight: "border-blue-300/20 bg-blue-300/10 text-blue-200",
};

// ─── Shared UI primitives ──────────────────────────────────────────────────

export function SectionCard({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-cyan-200/12 bg-surface-card/82 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      {title ? <h2 className="text-sm font-black text-white">{title}</h2> : null}
      {children}
    </section>
  );
}

export function StatCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: typeof Activity;
  label: string;
  tone: "cyan" | "green" | "blue" | "violet";
  value: string;
}) {
  const tones = {
    blue: "border-blue-300/20 bg-blue-300/10 text-blue-200",
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
    green: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
    violet: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  };
  return (
    <article className="rounded-2xl border border-white/9 bg-surface-card/82 p-4">
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
            tones[tone],
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 font-mono text-2xl font-black text-white">{value}</p>
          <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
        </div>
      </div>
    </article>
  );
}
