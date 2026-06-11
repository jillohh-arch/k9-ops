"use client";

import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Dog,
  FileText,
  HeartPulse,
  Pill,
  Scale,
  ShieldCheck,
  Stethoscope,
  Syringe,
  TestTube2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { EntityImage } from "@/features/effective/components/effective-ui";
import { useDashboardPeriod } from "@/features/dashboard/providers/dashboard-period-provider";
import {
  useHealthData,
  type HealthDogSummary,
  type HealthEventSummary,
  type HealthTone,
} from "@/features/health/hooks/use-health-data";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

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
          label="Em observacao"
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
          label="Critico"
          percent={criticalPercent}
          tone="red"
        />
      </div>

      <div className="rounded-3xl border border-cyan-200/10 bg-white/[0.035] p-5 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-cyan-200" />
        <p className="mt-4 text-sm text-slate-400">Indice de saude</p>
        <p className="mt-2 font-mono text-4xl font-black text-white">
          {healthyPercent}%
        </p>
        <p className="mt-1 text-sm font-black text-emerald-300">
          {healthyPercent >= 80
            ? "Muito bom"
            : healthyPercent >= 50
              ? "Em atencao"
              : "Critico"}
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
            {primary?.label ?? "Sem pendencia"}
          </p>
        </div>
      </div>
      <p className="mt-4 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400">
        {primary?.detail ?? "Prontuario sem prioridade calculada."}
      </p>
      <Badge className="mt-3" tone={tone === "red" ? "red" : tone === "amber" ? "yellow" : "cyan"}>
        {tone === "red" ? "Critico" : tone === "amber" ? "Atencao" : "Cadastro"}
      </Badge>
    </Link>
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
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useHealthData(periodDays);
  const loading = data.loading;
  const buckets = data.dogs.reduce(
    (accumulator, dog) => {
      accumulator[dogHealthBucket(dog)] += 1;
      return accumulator;
    },
    { critical: 0, healthy: 0, incomplete: 0, warning: 0 },
  );
  const monitored = data.metrics.total - data.metrics.incomplete;
  const vaccineOk = data.dogs.filter((dog) => dog.vaccine === "current").length;
  const examOk = data.dogs.filter((dog) => dog.exam === "current").length;
  const weightOk = data.dogs.filter((dog) => dog.weight === "in_range").length;
  const withDocs = data.dogs.filter((dog) => dog.documentsCount > 0).length;
  const medicationEvents = data.recentEvents.filter((event) =>
    event.type.toLowerCase().includes("med"),
  ).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.16)]">
            <HeartPulse className="h-8 w-8" />
          </span>
          <div>
            <h1 className="text-3xl font-black text-white md:text-4xl">
              Saude do Efetivo K9
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Visao geral da saude, bem-estar e prontidao veterinaria.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={data.metrics.critical > 0 ? "red" : "green"}>
            {loading ? "..." : `${formatNumber(data.metrics.critical)} criticos`}
          </Badge>
          <Badge tone="cyan">
            {loading
              ? "..."
              : `${formatNumber(data.metrics.periodEvents)} registros em ${periodLabel.toLowerCase()}`}
          </Badge>
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

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          detail={`${percent(monitored, data.metrics.total)}% do efetivo`}
          footer={`${formatNumber(data.metrics.incomplete)} nao monitorado(s)`}
          icon={ShieldCheck}
          label="K9 monitorados"
          tone="cyan"
          value={loading ? "..." : formatNumber(monitored)}
        />
        <MetricCard
          detail="Nos proximos 30 dias"
          footer={`${formatNumber(data.metrics.vaccinesOverdue)} vencida(s)`}
          icon={Syringe}
          label="Vacinas proximas do vencimento"
          tone="amber"
          value={loading ? "..." : formatNumber(data.metrics.vaccinesDueSoon)}
        />
        <MetricCard
          detail="Aguardando avaliacao"
          footer={`${formatNumber(data.metrics.examsDue)} exame(s) pendente(s)`}
          icon={Stethoscope}
          label="Consultas pendentes"
          tone="blue"
          value={loading ? "..." : formatNumber(data.metrics.examsDue)}
        />
        <MetricCard
          detail="Requerem atencao imediata"
          footer="Ver detalhes no bloco de atencao"
          icon={Activity}
          label="Alertas clinicos"
          tone="red"
          value={loading ? "..." : formatNumber(data.metrics.critical)}
        />
      </section>

      <div className="grid gap-5 2xl:grid-cols-[1.35fr_0.8fr]">
        <Panel
          subtitle="Panorama atual do efetivo K9."
          title="Situacao geral da saude"
        >
          <HealthRing
            critical={buckets.critical}
            healthy={buckets.healthy}
            incomplete={buckets.incomplete}
            total={data.metrics.total}
            warning={buckets.warning}
          />
          <p className="mt-4 text-xs text-slate-500">
            Dados consolidados do periodo selecionado. O indice considera
            pendencias criticas, alertas e lacunas de cadastro.
          </p>
        </Panel>

        <div className="grid gap-5">
          <Panel
            action={<Badge tone="slate">{data.upcoming.length} itens</Badge>}
            title="Proximos vencimentos"
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
            title="Ultimos registros de saude"
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
              <EmptyState label="Nenhum evento de saude encontrado." />
            )}
          </Panel>
        </div>
      </div>

      <Panel
        action={<Badge tone="cyan">{data.attention.slice(0, 4).length} exibidos</Badge>}
        title="O que exige atencao"
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
          <EmptyState label="Nenhuma prioridade clinica calculada." />
        )}
      </Panel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <CategoryCard
          detail={`${formatNumber(vaccineOk)} em dia | ${formatNumber(data.metrics.vaccinesOverdue)} vencida(s)`}
          icon={Syringe}
          label="Vacinacao"
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
          detail={`${formatNumber(weightOk)} na faixa | ${formatNumber(data.metrics.weightAttention)} em atencao`}
          icon={Scale}
          label="Peso"
          percent={percent(weightOk, data.metrics.total)}
          tone="blue"
        />
        <CategoryCard
          detail={`${formatNumber(medicationEvents)} registro(s) no periodo`}
          icon={Pill}
          label="Medicacao"
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
        action={<Badge tone="cyan">{data.dogs.length} K9</Badge>}
        subtitle="Resumo compacto por prontuario. Clique no K9 para abrir o perfil detalhado."
        title="Efetivo K9 por prontuario"
      >
        {loading ? (
          <EmptyState label="Carregando efetivo..." />
        ) : data.dogs.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.dogs.map((dog) => (
              <Link
                className="group grid gap-4 rounded-2xl border border-cyan-200/10 bg-white/[0.035] p-4 transition hover:border-cyan-200/25 hover:bg-white/[0.055] sm:grid-cols-[1fr_auto]"
                href={`${paths.k9}/${dog.dogId}`}
                key={dog.dogId}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <EntityImage
                    alt={dog.dogName}
                    className="h-12 w-12 shrink-0 rounded-xl"
                    fallback={Dog}
                    src={dog.photoUrl}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-black text-white group-hover:text-cyan-100">
                      {dog.dogName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      peso {formatWeight(dog.latestWeightKg)} | vacina{" "}
                      {formatDate(dog.latestVaccineDueAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={dog.ready ? "green" : "yellow"}>
                    {dog.ready ? "pronto" : "revisar"}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-200" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState label="Nenhum K9 ativo encontrado." />
        )}
      </Panel>

      {loading ? (
        <div className="fixed bottom-5 right-5 rounded-full border border-cyan-300/20 bg-slate-950/90 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          sincronizando
        </div>
      ) : null}
    </div>
  );
}
