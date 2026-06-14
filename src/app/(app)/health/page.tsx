"use client";

import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Dog,
  FileText,
  HeartPulse,
  Pencil,
  Pill,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  Stethoscope,
  Syringe,
  TestTube2,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { EntityImage } from "@/features/effective/components/effective-ui";
import { useDashboardPeriod } from "@/features/dashboard/providers/dashboard-period-provider";
import { HealthEventHub } from "@/features/health/components/health-event-hub";
import {
  useHealthData,
  type HealthDogSummary,
  type HealthEventSummary,
  type HealthTone,
} from "@/features/health/hooks/use-health-data";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

type ReadinessFilter =
  | "all"
  | "attention"
  | "critical"
  | "incomplete"
  | "ready";

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const weightFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

const toneClasses: Record<HealthTone, string> = {
  amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  blue: "border-blue-300/25 bg-blue-300/10 text-blue-100",
  cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  red: "border-red-300/25 bg-red-300/10 text-red-100",
  slate: "border-slate-300/15 bg-slate-400/10 text-slate-200",
  violet: "border-violet-300/25 bg-violet-300/10 text-violet-100",
};

const glowClasses: Record<HealthTone, string> = {
  amber: "from-amber-300/18 to-slate-950/62",
  blue: "from-blue-300/18 to-slate-950/62",
  cyan: "from-cyan-300/18 to-slate-950/62",
  emerald: "from-emerald-300/18 to-slate-950/62",
  red: "from-red-300/18 to-slate-950/62",
  slate: "from-slate-300/12 to-slate-950/62",
  violet: "from-violet-300/18 to-slate-950/62",
};

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: Date | null) {
  return value ? dateFormatter.format(value) : "--";
}

function formatShortDate(value: Date | null) {
  return value ? shortDateFormatter.format(value) : "--";
}

function formatWeight(value: number | null) {
  return value == null ? "--" : `${weightFormatter.format(value)} kg`;
}

function formatRange(range: HealthDogSummary["idealRange"]) {
  if (!range) return "não cadastrada";
  return `${weightFormatter.format(range.min)}-${weightFormatter.format(range.max)} kg`;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function daysUntil(date: Date | null) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function searchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function hasIssue(
  dog: HealthDogSummary,
  severity: "critical" | "missing" | "warning",
) {
  return dog.issues.some((issue) => issue.severity === severity);
}

function matchesReadinessFilter(
  dog: HealthDogSummary,
  filter: ReadinessFilter,
) {
  if (filter === "ready") return dog.ready;
  if (filter === "critical") return hasIssue(dog, "critical");
  if (filter === "attention") return hasIssue(dog, "warning");
  if (filter === "incomplete") return hasIssue(dog, "missing");
  return true;
}

function EventTypeIcon({
  className,
  type,
}: {
  className?: string;
  type: string;
}) {
  const normalized = type.toLowerCase();
  if (normalized.includes("vac")) return <Syringe className={className} />;
  if (normalized.includes("exam") || normalized.includes("laudo")) {
    return <TestTube2 className={className} />;
  }
  if (normalized.includes("med") || normalized.includes("rem")) {
    return <Pill className={className} />;
  }
  if (normalized.includes("peso")) return <Scale className={className} />;
  return <Stethoscope className={className} />;
}

function severityTone(dog: HealthDogSummary): HealthTone {
  if (dog.issues.some((issue) => issue.severity === "critical")) return "red";
  if (dog.issues.some((issue) => issue.severity === "warning")) return "amber";
  if (dog.issues.length > 0) return "blue";
  return "emerald";
}

function dogHealthBucket(dog: HealthDogSummary) {
  if (dog.issues.some((issue) => issue.severity === "critical")) {
    return "critical";
  }
  if (dog.issues.some((issue) => issue.severity === "warning")) {
    return "warning";
  }
  if (dog.issues.length > 0) return "incomplete";
  return "healthy";
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-cyan-200/15 bg-black/16 px-5 py-7 text-center text-sm text-slate-400">
      {label}
    </div>
  );
}

function MetricCard({
  detail,
  footer,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  footer?: ReactNode;
  icon: LucideIcon;
  label: string;
  tone: HealthTone;
  value: string;
}) {
  return (
    <article
      className={cn(
        "relative min-h-44 overflow-hidden rounded-[1.45rem] border bg-gradient-to-br p-5",
        toneClasses[tone],
        glowClasses[tone],
      )}
    >
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10 bg-white/[0.035]" />
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/18">
            <Icon className="h-5 w-5" />
          </span>
          <p className="text-sm font-black text-white">{label}</p>
        </div>
        <p className="mt-7 font-mono text-4xl font-black text-white">
          {value}
        </p>
        <p className="mt-2 text-sm text-slate-400">{detail}</p>
        {footer ? (
          <div className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400">
            {footer}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function HealthRing({
  critical,
  healthy,
  incomplete,
  total,
  warning,
}: {
  critical: number;
  healthy: number;
  incomplete: number;
  total: number;
  warning: number;
}) {
  const healthyPercent = percent(healthy, total);
  const warningPercent = percent(warning, total);
  const incompletePercent = percent(incomplete, total);
  const criticalPercent = percent(critical, total);
  const first = healthyPercent;
  const second = healthyPercent + warningPercent;
  const third = second + incompletePercent;

  const background = total
    ? `conic-gradient(#34d399 0 ${first}%, #facc15 ${first}% ${second}%, #fb923c ${second}% ${third}%, #fb7185 ${third}% 100%)`
    : "conic-gradient(#334155 0 100%)";

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr_170px] lg:items-center">
      <div className="relative mx-auto h-60 w-60 rounded-full p-5 shadow-[0_0_60px_rgba(34,211,238,0.16)]">
        <div
          className="absolute inset-0 rounded-full"
          style={{ background }}
        />
        <div className="absolute inset-7 rounded-full bg-slate-950 shadow-inner" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Activity className="mx-auto h-10 w-10 text-cyan-200" />
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              indice
            </p>
            <p className="font-mono text-4xl font-black text-white">
              {healthyPercent}%
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <RingLegend
          count={healthy}
          label="Saudavel"
          percent={healthyPercent}
          tone="emerald"
        />
        <RingLegend
          count={warning}
          label="Em observação"
          percent={warningPercent}
          tone="amber"
        />
        <RingLegend
          count={incomplete}
          label="Cadastro incompleto"
          percent={incompletePercent}
          tone="blue"
        />
        <RingLegend
          count={critical}
          label="Crítico"
          percent={criticalPercent}
          tone="red"
        />
      </div>

      <div className="rounded-3xl border border-cyan-200/10 bg-white/[0.035] p-5 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-cyan-200" />
        <p className="mt-4 text-sm text-slate-400">Índice de saúde</p>
        <p className="mt-2 font-mono text-4xl font-black text-white">
          {healthyPercent}%
        </p>
        <p className="mt-1 text-sm font-black text-emerald-300">
          {healthyPercent >= 80
            ? "Muito bom"
            : healthyPercent >= 50
              ? "Em atenção"
              : "Crítico"}
        </p>
      </div>
    </div>
  );
}

function RingLegend({
  count,
  label,
  percent: value,
  tone,
}: {
  count: number;
  label: string;
  percent: number;
  tone: HealthTone;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-2xl border px-4 py-3",
        toneClasses[tone],
      )}
    >
      <span className="flex items-center gap-2 font-black text-white">
        <span className="h-2.5 w-2.5 rounded-full bg-current" />
        {label}
      </span>
      <span className="font-mono text-sm text-slate-300">
        {formatNumber(count)} K9
      </span>
      <span className="font-mono text-sm text-slate-300">{value}%</span>
    </div>
  );
}

function UpcomingRow({ event }: { event: HealthEventSummary }) {
  const dueDays = daysUntil(event.dueAt);
  const tone: HealthTone =
    dueDays != null && dueDays < 0
      ? "red"
      : dueDays != null && dueDays <= 15
        ? "amber"
        : "cyan";

  return (
    <article className="flex items-center gap-3 rounded-2xl border border-cyan-200/10 bg-white/[0.035] p-3">
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
          toneClasses[tone],
        )}
      >
        <EventTypeIcon className="h-5 w-5" type={event.type} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-white">{event.dogName}</p>
        <p className="truncate text-sm text-slate-400">{event.label}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm text-slate-300">
          {formatDate(event.dueAt)}
        </p>
        <Badge tone={tone === "red" ? "red" : tone === "amber" ? "yellow" : "cyan"}>
          {dueDays == null
            ? "--"
            : dueDays < 0
              ? `${Math.abs(dueDays)}d venc.`
              : `${dueDays} dias`}
        </Badge>
      </div>
    </article>
  );
}

function RecentRow({ event }: { event: HealthEventSummary }) {
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-transparent px-2 py-2">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          toneClasses[event.tone],
        )}
      >
        <EventTypeIcon className="h-4 w-4" type={event.type} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-white">{event.dogName}</p>
        <p className="line-clamp-2 text-sm text-slate-400">{event.label}</p>
        <p className="mt-1 text-xs text-slate-500">{event.detail}</p>
      </div>
      <span className="font-mono text-xs text-slate-500">
        {formatShortDate(event.date)}
      </span>
    </article>
  );
}

function AttentionCard({ dog }: { dog: HealthDogSummary }) {
  const primary = dog.issues[0];
  const tone = severityTone(dog);

  return (
    <Link
      className={cn(
        "group min-h-36 rounded-[1.35rem] border bg-gradient-to-br p-4 transition hover:-translate-y-0.5 hover:border-cyan-200/30",
        toneClasses[tone],
        glowClasses[tone],
      )}
      href={`${paths.k9}/${dog.dogId}`}
    >
      <div className="flex items-start gap-3">
        <EntityImage
          alt={dog.dogName}
          className="h-16 w-16 shrink-0 rounded-2xl"
          fallback={Dog}
          src={dog.photoUrl}
        />
        <div className="min-w-0">
          <p className="truncate font-black text-white group-hover:text-cyan-100">
            {dog.dogName}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-300">
            {primary?.label ?? "Sem pendência"}
          </p>
        </div>
      </div>
      <p className="mt-4 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400">
        {primary?.detail ?? "Prontuário sem prioridade calculada."}
      </p>
      <Badge className="mt-3" tone={tone === "red" ? "red" : tone === "amber" ? "yellow" : "cyan"}>
        {tone === "red" ? "Crítico" : tone === "amber" ? "Atenção" : "Cadastro"}
      </Badge>
    </Link>
  );
}

function DataGapRow({ dog }: { dog: HealthDogSummary }) {
  const gaps = [
    dog.weight === "missing_range" ? "faixa ideal" : null,
    dog.weight === "missing" ? "peso canonico" : null,
    dog.vaccine === "missing" ? "vacina" : null,
    dog.exam === "missing" ? "exame" : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <article className="grid gap-3 rounded-2xl border border-cyan-200/10 bg-white/[0.035] p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <EntityImage
          alt={dog.dogName}
          className="h-12 w-12 shrink-0 rounded-xl"
          fallback={Dog}
          src={dog.photoUrl}
        />
        <div className="min-w-0">
          <p className="truncate font-black text-white">{dog.dogName}</p>
          <p className="mt-1 text-sm text-slate-400">
            Corrigir: {gaps.join(", ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={dog.weight === "missing_range" ? "yellow" : "slate"}>
              faixa {formatRange(dog.idealRange)}
            </Badge>
            <Badge tone={dog.weight === "missing" ? "yellow" : "slate"}>
              peso {formatWeight(dog.latestWeightKg)}
            </Badge>
          </div>
        </div>
      </div>
      <Link
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.12]"
        href={`${paths.k9}/${encodeURIComponent(dog.dogId)}/edit`}
      >
        Ajustar cadastro
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

function healthStatus(dog: HealthDogSummary) {
  if (hasIssue(dog, "critical")) {
    return { label: "Crítico", tone: "red" as const };
  }
  if (hasIssue(dog, "missing")) {
    return { label: "Incompleto", tone: "yellow" as const };
  }
  if (hasIssue(dog, "warning")) {
    return { label: "Atenção", tone: "yellow" as const };
  }
  if (dog.ready) {
    return { label: "Pronto", tone: "green" as const };
  }
  return { label: "Revisar", tone: "slate" as const };
}

function vaccineStatus(dog: HealthDogSummary) {
  if (dog.vaccine === "current") {
    return { label: "Em dia", tone: "green" as const };
  }
  if (dog.vaccine === "due_soon") {
    return { label: "A vencer", tone: "yellow" as const };
  }
  if (dog.vaccine === "overdue") {
    return { label: "Vencida", tone: "red" as const };
  }
  return { label: "Sem registro", tone: "slate" as const };
}

function weightStatus(dog: HealthDogSummary) {
  if (dog.weight === "in_range") {
    return { label: "Na faixa", tone: "green" as const };
  }
  if (dog.weight === "out_of_range") {
    return { label: "Fora da faixa", tone: "yellow" as const };
  }
  if (dog.weight === "missing_range") {
    return { label: "Sem faixa ideal", tone: "yellow" as const };
  }
  return { label: "Sem pesagem", tone: "slate" as const };
}

function examStatus(dog: HealthDogSummary) {
  if (dog.exam === "current") {
    return { label: "Em dia", tone: "green" as const };
  }
  if (dog.exam === "due") {
    return { label: "Revisar", tone: "yellow" as const };
  }
  return { label: "Sem registro", tone: "slate" as const };
}

function ReadinessRow({
  canEdit,
  dog,
}: {
  canEdit: boolean;
  dog: HealthDogSummary;
}) {
  const status = healthStatus(dog);
  const vaccine = vaccineStatus(dog);
  const weight = weightStatus(dog);
  const exam = examStatus(dog);

  return (
    <article className="rounded-[1.35rem] border border-cyan-200/10 bg-white/[0.035] p-4 transition hover:border-cyan-200/25 hover:bg-white/[0.05]">
      <div className="grid gap-4 xl:grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.8fr)_minmax(190px,1fr)_minmax(145px,0.75fr)_minmax(110px,0.55fr)_auto] xl:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <EntityImage
            alt={dog.dogName}
            className="h-14 w-14 shrink-0 rounded-2xl"
            fallback={Dog}
            src={dog.photoUrl}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-black text-white">{dog.dogName}</p>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-slate-500">
              {dog.issues[0]?.label ?? "Sem pendências calculadas"}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Vacinação
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={vaccine.tone}>{vaccine.label}</Badge>
            <span className="font-mono text-xs text-slate-400">
              {formatDate(dog.latestVaccineDueAt)}
            </span>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Peso e faixa
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={weight.tone}>{weight.label}</Badge>
            <span className="font-mono text-xs text-slate-400">
              {formatWeight(dog.latestWeightKg)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            ideal {formatRange(dog.idealRange)}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Exame
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={exam.tone}>{exam.label}</Badge>
            <span className="font-mono text-xs text-slate-400">
              {formatDate(dog.latestExamAt)}
            </span>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Documentos
          </p>
          <p className="mt-2 font-mono text-lg font-black text-white">
            {formatNumber(dog.documentsCount)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.12]"
            href={`${paths.k9}/${encodeURIComponent(dog.dogId)}`}
          >
            Abrir
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {canEdit ? (
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.12]"
              href={`${paths.k9}/${encodeURIComponent(dog.dogId)}/edit`}
            >
              <Pencil className="h-3.5 w-3.5" />
              Corrigir
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CategoryCard({
  detail,
  icon: Icon,
  label,
  percent: value,
  tone,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  percent: number;
  tone: HealthTone;
}) {
  return (
    <article className="rounded-[1.35rem] border border-cyan-200/10 bg-slate-950/72 p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl border",
            toneClasses[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-black text-white">{label}</p>
          <p className="font-mono text-3xl font-black text-white">{value}%</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
      <div className="mt-4 h-2 rounded-full bg-slate-800">
        <div
          className={cn(
            "h-full rounded-full shadow-[0_0_18px_rgba(34,211,238,0.3)]",
            tone === "amber"
              ? "bg-amber-300"
              : tone === "blue"
                ? "bg-blue-300"
                : tone === "red"
                  ? "bg-red-300"
                  : tone === "violet"
                    ? "bg-violet-300"
                    : "bg-cyan-300",
          )}
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
    </article>
  );
}

export default function HealthPage() {
  const { can } = useAccessControl();
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useHealthData(periodDays);
  const [readinessFilter, setReadinessFilter] =
    useState<ReadinessFilter>("all");
  const [readinessSearch, setReadinessSearch] = useState("");
  const [healthHubOpen, setHealthHubOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const loading = data.loading;
  const buckets = data.dogs.reduce(
    (accumulator, dog) => {
      accumulator[dogHealthBucket(dog)] += 1;
      return accumulator;
    },
    { critical: 0, healthy: 0, incomplete: 0, warning: 0 },
  );
  const vaccineOk = data.dogs.filter((dog) => dog.vaccine === "current").length;
  const examOk = data.dogs.filter((dog) => dog.exam === "current").length;
  const weightOk = data.dogs.filter((dog) => dog.weight === "in_range").length;
  const withDocs = data.dogs.filter((dog) => dog.documentsCount > 0).length;
  const missingRange = data.dogs.filter(
    (dog) => dog.weight === "missing_range",
  ).length;
  const missingWeight = data.dogs.filter((dog) => dog.weight === "missing").length;
  const missingVaccine = data.dogs.filter(
    (dog) => dog.vaccine === "missing",
  ).length;
  const dataGaps = data.dogs.filter(
    (dog) =>
      dog.weight === "missing_range" ||
      dog.weight === "missing" ||
      dog.vaccine === "missing" ||
      dog.exam === "missing",
  );
  const medicationEvents = data.recentEvents.filter((event) =>
    event.type.toLowerCase().includes("med"),
  ).length;
  const canEditK9 = can("k9", "edit");
  const canWriteHealth = can("health", "create") || can("health", "edit");
  const readinessCounts = useMemo(
    () => ({
      all: data.dogs.length,
      attention: data.dogs.filter((dog) => hasIssue(dog, "warning")).length,
      critical: data.dogs.filter((dog) => hasIssue(dog, "critical")).length,
      incomplete: data.dogs.filter((dog) => hasIssue(dog, "missing")).length,
      ready: data.dogs.filter((dog) => dog.ready).length,
    }),
    [data.dogs],
  );
  const filteredDogs = useMemo(() => {
    const needle = searchText(readinessSearch);
    return [...data.dogs]
      .filter((dog) => {
        const matchesSearch =
          !needle ||
          [
            dog.dogName,
            dog.status,
            ...dog.issues.flatMap((issue) => [issue.label, issue.detail]),
          ].some((value) => searchText(value).includes(needle));
        return (
          matchesSearch && matchesReadinessFilter(dog, readinessFilter)
        );
      })
      .sort((a, b) => {
        const score = (dog: HealthDogSummary) =>
          hasIssue(dog, "critical")
            ? 4
            : hasIssue(dog, "missing")
              ? 3
              : hasIssue(dog, "warning")
                ? 2
                : dog.ready
                  ? 0
                  : 1;
        return score(b) - score(a) || a.dogName.localeCompare(b.dogName);
      });
  }, [data.dogs, readinessFilter, readinessSearch]);
  const readinessFilters: Array<{
    id: ReadinessFilter;
    label: string;
  }> = [
    { id: "all", label: "Todos" },
    { id: "ready", label: "Prontos" },
    { id: "attention", label: "Atenção" },
    { id: "critical", label: "Críticos" },
    { id: "incomplete", label: "Dados incompletos" },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.16)]">
            <HeartPulse className="h-8 w-8" />
          </span>
          <div>
            <h1 className="text-3xl font-black text-white md:text-4xl">
              Saúde do Efetivo K9
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Visão geral da saúde, bem-estar e prontidão veterinária.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge tone={data.metrics.critical > 0 ? "red" : "green"}>
              {loading ? "..." : `${formatNumber(data.metrics.critical)} críticos`}
            </Badge>
            <Badge tone="cyan">
              {loading
                ? "..."
                : `${formatNumber(data.metrics.periodEvents)} registros em ${periodLabel.toLowerCase()}`}
            </Badge>
          </div>
          {canWriteHealth ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(77,208,225,0.24)] transition hover:bg-cyan-200"
              onClick={() => {
                setSaveMessage(null);
                setHealthHubOpen(true);
              }}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Registrar evento
            </button>
          ) : null}
        </div>
      </header>

      {saveMessage ? (
        <div className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100">
          <span>{saveMessage}</span>
          <button
            className="text-xs font-black uppercase tracking-[0.14em] text-emerald-200"
            onClick={() => setSaveMessage(null)}
            type="button"
          >
            Fechar
          </button>
        </div>
      ) : null}

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

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          detail={`${percent(data.metrics.ready, data.metrics.total)}% do efetivo`}
          footer="vacina vigente + peso canonico na faixa"
          icon={ShieldCheck}
          label="Prontos por evidência"
          tone="emerald"
          value={loading ? "..." : `${formatNumber(data.metrics.ready)} / ${formatNumber(data.metrics.total)}`}
        />
        <MetricCard
          detail="Nos próximos 30 dias"
          footer={`${formatNumber(data.metrics.vaccinesOverdue)} vencida(s)`}
          icon={Syringe}
          label="Vacinas próximas do vencimento"
          tone="amber"
          value={loading ? "..." : formatNumber(data.metrics.vaccinesDueSoon)}
        />
        <MetricCard
          detail="Fora do intervalo ideal"
          footer={`${formatNumber(missingRange)} sem faixa ideal | ${formatNumber(missingWeight)} sem peso`}
          icon={Scale}
          label="Peso em atenção"
          tone="blue"
          value={loading ? "..." : formatNumber(data.metrics.weightAttention)}
        />
        <MetricCard
          detail="Falta dado essencial"
          footer={`${formatNumber(missingVaccine)} sem vacina | ${formatNumber(data.metrics.examsDue)} exame(s) a revisar`}
          icon={Activity}
          label="Lacunas de prontidão"
          tone={data.metrics.incomplete > 0 ? "amber" : "cyan"}
          value={loading ? "..." : formatNumber(data.metrics.incomplete)}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel
          action={<Badge tone={dataGaps.length ? "yellow" : "green"}>{formatNumber(dataGaps.length)} K9</Badge>}
          subtitle="Pontos que impedem uma leitura confiável de prontidão."
          title="Lacunas de prontidão"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-cyan-200/10 bg-white/[0.035] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Sem faixa ideal
              </p>
              <p className="mt-3 font-mono text-3xl font-black text-white">
                {formatNumber(missingRange)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                mínimo e máximo no cadastro K9
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-200/10 bg-white/[0.035] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Sem peso canonico
              </p>
              <p className="mt-3 font-mono text-3xl font-black text-white">
                {formatNumber(missingWeight)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                sem registro em weight_records
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-200/10 bg-white/[0.035] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Sem vacina
              </p>
              <p className="mt-3 font-mono text-3xl font-black text-white">
                {formatNumber(missingVaccine)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                nenhuma vacinação localizada
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            O painel não presume aptidão clínica: ele mostra se há evidência
            mínima cadastrada para defender a prontidão do K9.
          </p>
        </Panel>

        <Panel
          action={<Badge tone="cyan">{dataGaps.slice(0, 3).length} exibidos</Badge>}
          subtitle="Atalhos para completar cadastro e parâmetros."
          title="Corrigir primeiro"
        >
          {loading ? (
            <EmptyState label="Carregando lacunas..." />
          ) : dataGaps.length ? (
            <div className="space-y-3">
              {dataGaps.slice(0, 3).map((dog) => (
                <DataGapRow dog={dog} key={dog.dogId} />
              ))}
            </div>
          ) : (
            <EmptyState label="Nenhuma lacuna essencial encontrada." />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1.35fr_0.8fr]">
        <Panel
          subtitle="Panorama atual do efetivo K9."
          title="Situação geral da saúde"
        >
          <HealthRing
            critical={buckets.critical}
            healthy={buckets.healthy}
            incomplete={buckets.incomplete}
            total={data.metrics.total}
            warning={buckets.warning}
          />
          <p className="mt-4 text-xs text-slate-500">
            Dados consolidados do período selecionado. O indice considera
            pendências críticas, alertas e lacunas de cadastro.
          </p>
        </Panel>

        <div className="grid gap-5">
          <Panel
            action={<Badge tone="slate">{data.upcoming.length} itens</Badge>}
            title="Próximos vencimentos"
          >
            {loading ? (
              <EmptyState label="Carregando vencimentos..." />
            ) : data.upcoming.length ? (
              <div className="space-y-3">
                {data.upcoming.slice(0, 4).map((event) => (
                  <UpcomingRow
                    event={event}
                    key={`${event.sourcePath ?? event.id}:due`}
                  />
                ))}
              </div>
            ) : (
              <EmptyState label="Nenhum vencimento conhecido." />
            )}
          </Panel>

          <Panel
            action={<Badge tone="slate">{data.recentEvents.length} eventos</Badge>}
            title="Últimos registros de saúde"
          >
            {loading ? (
              <EmptyState label="Carregando registros..." />
            ) : data.recentEvents.length ? (
              <div className="space-y-1">
                {data.recentEvents.slice(0, 4).map((event) => (
                  <RecentRow event={event} key={event.sourcePath ?? event.id} />
                ))}
              </div>
            ) : (
              <EmptyState label="Nenhum evento de saúde encontrado." />
            )}
          </Panel>
        </div>
      </div>

      <Panel
        action={<Badge tone="cyan">{data.attention.slice(0, 4).length} exibidos</Badge>}
        title="O que exige atenção"
      >
        {loading ? (
          <EmptyState label="Carregando prioridades..." />
        ) : data.attention.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {data.attention.slice(0, 4).map((dog) => (
              <AttentionCard dog={dog} key={dog.dogId} />
            ))}
          </div>
        ) : (
          <EmptyState label="Nenhuma prioridade clínica calculada." />
        )}
      </Panel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <CategoryCard
          detail={`${formatNumber(vaccineOk)} em dia | ${formatNumber(data.metrics.vaccinesOverdue)} vencida(s)`}
          icon={Syringe}
          label="Vacinação"
          percent={percent(vaccineOk, data.metrics.total)}
          tone="cyan"
        />
        <CategoryCard
          detail={`${formatNumber(examOk)} em dia | ${formatNumber(data.metrics.examsDue)} pendente(s)`}
          icon={Stethoscope}
          label="Consultas"
          percent={percent(examOk, data.metrics.total)}
          tone="violet"
        />
        <CategoryCard
          detail={`${formatNumber(weightOk)} na faixa | ${formatNumber(data.metrics.weightAttention)} em atenção`}
          icon={Scale}
          label="Peso"
          percent={percent(weightOk, data.metrics.total)}
          tone="blue"
        />
        <CategoryCard
          detail={`${formatNumber(medicationEvents)} registro(s) no período`}
          icon={Pill}
          label="Medicação"
          percent={percent(medicationEvents, Math.max(1, data.recentEvents.length))}
          tone="amber"
        />
        <CategoryCard
          detail={`${formatNumber(withDocs)} K9 com documento | ${formatNumber(data.metrics.documents)} arquivo(s)`}
          icon={FileText}
          label="Documentos"
          percent={percent(withDocs, data.metrics.total)}
          tone="cyan"
        />
      </section>

      <Panel
        action={<Badge tone="cyan">{filteredDogs.length} exibidos</Badge>}
        subtitle="Busca, filtros e evidências essenciais de cada prontuário."
        title="Prontidão K9"
      >
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/8 bg-[#0b1628]/72 p-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1 xl:max-w-[420px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-11 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
              onChange={(event) => setReadinessSearch(event.target.value)}
              placeholder="Buscar K9 ou pendencia..."
              type="search"
              value={readinessSearch}
            />
          </label>
          <div className="flex flex-1 flex-wrap gap-2">
            {readinessFilters.map((filter) => (
              <button
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition",
                  readinessFilter === filter.id
                    ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                    : "border-white/8 bg-white/[0.025] text-slate-400 hover:border-cyan-200/20 hover:text-slate-200",
                )}
                key={filter.id}
                onClick={() => setReadinessFilter(filter.id)}
                type="button"
              >
                {filter.label}
                <span className="rounded-full bg-black/20 px-2 py-0.5 font-mono text-xs">
                  {readinessCounts[filter.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <EmptyState label="Carregando efetivo..." />
        ) : filteredDogs.length ? (
          <div className="space-y-3">
            {filteredDogs.map((dog) => (
              <ReadinessRow
                canEdit={canEditK9}
                dog={dog}
                key={dog.dogId}
              />
            ))}
          </div>
        ) : (
          <EmptyState label="Nenhum K9 corresponde aos filtros atuais." />
        )}
      </Panel>

      {loading ? (
        <div className="fixed bottom-5 right-5 rounded-full border border-cyan-300/20 bg-slate-950/90 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          sincronizando
        </div>
      ) : null}

      <HealthEventHub
        dogs={data.dogs}
        onClose={() => setHealthHubOpen(false)}
        onSaved={setSaveMessage}
        open={healthHubOpen}
      />
    </div>
  );
}
