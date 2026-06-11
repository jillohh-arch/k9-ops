"use client";

import {
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  FileSignature,
  FileWarning,
  MapPin,
  Package,
  PawPrint,
  RadioTower,
  ShieldCheck,
  Siren,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { useDashboardPeriod } from "@/features/dashboard/providers/dashboard-period-provider";
import {
  useOperationalCenterData,
  type OperationAttention,
  type OperationNatureStat,
  type OperationOccurrence,
  type OperationQueueItem,
  type OperationStatusTone,
  type OperationTimelineItem,
} from "@/features/operations/hooks/use-operational-center-data";
import { cn } from "@/lib/utils";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const toneClasses: Record<OperationStatusTone, string> = {
  amber: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  blue: "border-blue-300/30 bg-blue-400/10 text-blue-100",
  cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
  emerald: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  red: "border-red-300/30 bg-red-400/10 text-red-100",
  slate: "border-slate-300/20 bg-slate-400/10 text-slate-100",
  violet: "border-violet-300/30 bg-violet-400/10 text-violet-100",
};

const glowClasses: Record<OperationStatusTone, string> = {
  amber: "border-amber-300/70 shadow-[0_0_28px_rgba(251,191,36,0.22)]",
  blue: "border-blue-300/55 shadow-[0_0_28px_rgba(96,165,250,0.18)]",
  cyan: "border-cyan-300/70 shadow-[0_0_28px_rgba(34,211,238,0.22)]",
  emerald: "border-emerald-300/55 shadow-[0_0_28px_rgba(52,211,153,0.18)]",
  red: "border-red-300/70 shadow-[0_0_28px_rgba(248,113,113,0.22)]",
  slate: "border-slate-300/25 shadow-[0_0_28px_rgba(148,163,184,0.1)]",
  violet: "border-violet-300/70 shadow-[0_0_28px_rgba(168,85,247,0.2)]",
};

const chartColors: Record<OperationStatusTone, string> = {
  amber: "#facc15",
  blue: "#3b82f6",
  cyan: "#22d3ee",
  emerald: "#34d399",
  red: "#fb7185",
  slate: "#94a3b8",
  violet: "#a855f7",
};

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatTime(value: Date | null) {
  return value ? timeFormatter.format(value) : "--:--";
}

function formatShortDate(value: Date | null) {
  return value ? shortDateFormatter.format(value) : "--";
}

function formatPercent(value: number) {
  return `${numberFormatter.format(value)}%`;
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function donutGradient(items: OperationNatureStat[]) {
  if (items.length === 0) {
    return "conic-gradient(rgba(34,211,238,0.18) 0deg 360deg)";
  }

  let cursor = 0;
  const segments = items.map((item) => {
    const start = cursor;
    const end = cursor + (item.percent / 100) * 360;
    cursor = end;
    return `${chartColors[item.tone]} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function Panel({
  action,
  children,
  className,
  subtitle,
  title,
}: {
  action?: string;
  children: ReactNode;
  className?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.65rem] border border-cyan-200/12 bg-slate-950/76 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.3)]",
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
        {action ? (
          <Badge className="border-cyan-300/15 bg-cyan-300/8 text-cyan-100">
            {action}
          </Badge>
        ) : null}
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

function KpiCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone: OperationStatusTone;
  value: number;
}) {
  return (
    <article
      className={cn(
        "relative min-h-32 overflow-hidden rounded-[1.4rem] border bg-slate-950/74 p-5",
        glowClasses[tone],
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(15,23,42,0.15),transparent_45%),radial-gradient(circle_at_82%_48%,rgba(255,255,255,0.12),transparent_22%)]" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-300">{label}</p>
          <p
            className={cn(
              "mt-4 font-mono text-6xl font-black leading-none",
              tone === "red"
                ? "text-red-300"
                : tone === "amber"
                  ? "text-amber-300"
                  : tone === "violet"
                    ? "text-violet-300"
                    : "text-cyan-300",
            )}
          >
            {formatNumber(value)}
          </p>
        </div>
        <span
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full border",
            toneClasses[tone],
          )}
        >
          <Icon className="h-8 w-8" />
        </span>
      </div>
      <span className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </article>
  );
}

function OccurrenceMiniCard({ occurrence }: { occurrence: OperationOccurrence }) {
  const team = [occurrence.handlerName, occurrence.dogName]
    .filter(Boolean)
    .join(" + ");

  return (
    <article className="rounded-2xl border border-cyan-200/12 bg-white/[0.035] p-4 transition hover:border-cyan-200/25 hover:bg-white/[0.055]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-black text-cyan-300">
              {occurrence.code}
            </span>
            <span className="text-sm font-black text-white">
              {occurrence.nature}
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin className="h-3.5 w-3.5" />
            {occurrence.location}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <Users className="h-3.5 w-3.5" />
            {team || "Equipe nao informada"}
          </p>
        </div>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
            toneClasses[occurrence.tone],
          )}
        >
          {occurrence.isCritical ? (
            <Siren className="h-5 w-5" />
          ) : (
            <ClipboardList className="h-5 w-5" />
          )}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Badge className={cn("border text-[10px]", toneClasses[occurrence.priorityTone])}>
            {occurrence.priorityLabel}
          </Badge>
          <Badge className="border-cyan-300/20 bg-cyan-300/8 text-[10px] text-cyan-100">
            {formatStatus(occurrence.status)}
          </Badge>
        </div>
        <span className="font-mono text-xs text-slate-300">
          {formatTime(occurrence.date)}
        </span>
      </div>
    </article>
  );
}

function AttentionCard({ item }: { item: OperationAttention }) {
  const tone =
    item.severity === "critical"
      ? "red"
      : item.severity === "warning"
        ? "amber"
        : "blue";

  return (
    <article
      className={cn(
        "flex items-center gap-4 rounded-2xl border bg-white/[0.035] p-4",
        glowClasses[tone],
      )}
    >
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border",
          toneClasses[tone],
        )}
      >
        {item.severity === "critical" ? (
          <AlertTriangle className="h-6 w-6" />
        ) : item.severity === "warning" ? (
          <FileSignature className="h-6 w-6" />
        ) : (
          <RadioTower className="h-6 w-6" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white">{item.label}</p>
        <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
      </div>
      <Badge className={cn("border", toneClasses[tone])}>{item.action}</Badge>
      <ChevronRight className="h-5 w-5 text-slate-500" />
    </article>
  );
}

function DistributionPanel({
  total,
  types,
}: {
  total: number;
  types: OperationNatureStat[];
}) {
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[10rem_1fr]">
      <div
        className="relative mx-auto h-40 w-40 rounded-full p-4"
        style={{ background: donutGradient(types) }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-cyan-200/10 bg-slate-950">
          <span className="font-mono text-3xl font-black text-white">
            {formatNumber(total)}
          </span>
          <span className="text-xs text-slate-400">Total</span>
        </div>
      </div>

      <div className="space-y-3">
        {types.length > 0 ? (
          types.map((item) => (
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4" key={item.label}>
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: chartColors[item.tone] }}
                />
                <span className="truncate text-sm font-semibold text-slate-200">
                  {item.label}
                </span>
              </div>
              <span className="font-mono text-sm text-white">{item.value}</span>
              <span className="font-mono text-xs text-slate-400">
                {formatPercent(item.percent)}
              </span>
            </div>
          ))
        ) : (
          <EmptyState label="Sem ocorrencias no periodo selecionado." />
        )}
      </div>
    </div>
  );
}

function RecentRecord({ item }: { item: OperationTimelineItem }) {
  return (
    <li className="relative grid grid-cols-[2.25rem_1fr_auto] items-start gap-3 pb-4 last:pb-0">
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border",
          toneClasses[item.tone],
        )}
      >
        <PawPrint className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{item.label}</p>
        <p className="mt-1 text-xs text-slate-400">{item.source}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-xs text-slate-300">{formatShortDate(item.at)}</p>
        <p className="mt-1 text-[10px] text-slate-500">{item.detail}</p>
      </div>
    </li>
  );
}

function IntegrityCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: OperationStatusTone;
  value: number;
}) {
  return (
    <article className={cn("rounded-2xl border bg-white/[0.035] p-4", toneClasses[tone])}>
      <Icon className="mb-5 h-7 w-7" />
      <p className="font-mono text-4xl font-black text-white">
        {formatNumber(value)}
      </p>
      <p className="mt-3 text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </article>
  );
}

function QueueCard({ item }: { item: OperationQueueItem }) {
  return (
    <article className={cn("flex items-center gap-4 rounded-2xl border bg-white/[0.035] p-4", toneClasses[item.tone])}>
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border",
          toneClasses[item.tone],
        )}
      >
        {item.tone === "red" ? (
          <Siren className="h-5 w-5" />
        ) : item.tone === "violet" ? (
          <FileWarning className="h-5 w-5" />
        ) : item.tone === "amber" ? (
          <Users className="h-5 w-5" />
        ) : (
          <PawPrint className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-white">{item.label}</p>
        <p className="mt-1 truncate text-xs text-slate-400">{item.detail}</p>
        <Badge className={cn("mt-3 border text-[10px]", toneClasses[item.tone])}>
          {item.category}
        </Badge>
      </div>
      <ChevronRight className="h-5 w-5 text-slate-500" />
    </article>
  );
}

export default function OccurrencesPage() {
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useOperationalCenterData(periodDays);

  const kpis = [
    {
      icon: ClipboardList,
      label: "Ocorrencias em andamento",
      tone: "cyan" as const,
      value: data.summary.openOccurrences,
    },
    {
      icon: AlertTriangle,
      label: "Ocorrencias criticas",
      tone: "red" as const,
      value: data.summary.criticalOccurrences,
    },
    {
      icon: Users,
      label: "Binomios em operacao",
      tone: "amber" as const,
      value: data.summary.activeBinomials,
    },
    {
      icon: Package,
      label: "Apreensoes hoje",
      tone: "violet" as const,
      value: data.summary.apprehensionsToday,
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-white">
          Central Operacional
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Visao consultiva das ocorrencias e movimentacoes operacionais da
          unidade. Periodo atual:{" "}
          <span className="font-semibold text-cyan-200">{periodLabel}</span>.
        </p>
      </header>

      {data.errors.length > 0 ? (
        <section className="rounded-3xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-black">Algumas fontes nao carregaram:</p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {data.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {kpis.map((item) => (
          <KpiCard key={item.label} {...item} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
        <Panel
          action={data.occurrences.length > 4 ? "Ver todas" : undefined}
          title="Ocorrencias em andamento"
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {data.occurrences.length > 0 ? (
              data.occurrences.slice(0, 4).map((occurrence) => (
                <OccurrenceMiniCard occurrence={occurrence} key={occurrence.id} />
              ))
            ) : (
              <div className="lg:col-span-2">
                <EmptyState label="Nenhuma ocorrencia em andamento no momento." />
              </div>
            )}
          </div>
        </Panel>

        <Panel
          action={data.attention.length > 3 ? "Ver todas" : undefined}
          title="Atencao imediata"
        >
          <div className="space-y-3">
            {data.attention.length > 0 ? (
              data.attention.slice(0, 3).map((item) => (
                <AttentionCard item={item} key={item.id} />
              ))
            ) : (
              <EmptyState label="Nenhuma atencao imediata agora." />
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_0.85fr_0.95fr]">
        <Panel
          subtitle="Naturezas registradas no periodo selecionado."
          title="Distribuicao por tipo de ocorrencia"
        >
          <DistributionPanel
            total={data.distribution.total}
            types={data.distribution.types}
          />
        </Panel>

        <Panel title="Ultimos registros recebidos">
          {data.recentRecords.length > 0 ? (
            <ol className="space-y-0">
              {data.recentRecords.map((item) => (
                <RecentRecord item={item} key={item.id} />
              ))}
            </ol>
          ) : (
            <EmptyState label="Sem registros recentes para exibir." />
          )}
        </Panel>

        <Panel
          action={`${formatPercent(data.integrity.coverage)} selo`}
          title="Integridade institucional"
        >
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <IntegrityCard
              detail={`${formatNumber(data.integrity.finalized)} finalizadas`}
              icon={ShieldCheck}
              label="Seladas"
              tone="cyan"
              value={data.integrity.sealed}
            />
            <IntegrityCard
              detail="Aguardando responsaveis"
              icon={FileSignature}
              label="Pendentes de assinatura"
              tone="amber"
              value={data.integrity.awaitingSignatures}
            />
            <IntegrityCard
              detail="Requer atencao"
              icon={FileWarning}
              label="Correcoes abertas"
              tone="red"
              value={data.integrity.correctionsOpen}
            />
          </div>
        </Panel>
      </section>

      <Panel
        action={`${data.managerQueue.length} itens`}
        title="Fila de atencao do gestor"
      >
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {data.managerQueue.length > 0 ? (
            data.managerQueue.map((item) => (
              <QueueCard item={item} key={item.id} />
            ))
          ) : (
            <div className="md:col-span-2 2xl:col-span-4">
              <EmptyState label="Fila do gestor sem itens pendentes agora." />
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
