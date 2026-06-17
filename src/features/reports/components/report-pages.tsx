"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Car,
  ChevronRight,
  Download,
  FileBarChart,
  FileText,
  Filter,
  HeartPulse,
  Package,
  PawPrint,
  ShieldCheck,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useDashboardPeriod,
} from "@/features/dashboard/providers/dashboard-period-provider";
import {
  ExportButton,
  ExportToolbar,
} from "@/features/reports/components/export-toolbar";
import {
  useReportsData,
  type ReportListItem,
  type ReportMetric,
  type StatItem,
} from "@/features/reports/hooks/use-reports-data";
import {
  getReportDefinition,
  reportDefinitions,
  type ReportId,
  type ReportTone,
} from "@/features/reports/lib/report-catalog";
import { getExportableData } from "@/features/reports/lib/get-exportable-data";
import { humanizeSourceErrors } from "@/lib/errors/user-facing-errors";
import { cn } from "@/lib/utils";

const toneClasses: Record<ReportTone, string> = {
  amber: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  blue: "border-blue-300/30 bg-blue-400/10 text-blue-100",
  cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
  emerald: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  red: "border-red-300/30 bg-red-400/10 text-red-100",
  slate: "border-slate-300/20 bg-slate-400/10 text-slate-100",
  violet: "border-violet-300/30 bg-violet-400/10 text-violet-100",
};

const softToneClasses: Record<ReportTone, string> = {
  amber: "from-amber-400/20 to-slate-950/50",
  blue: "from-blue-400/20 to-slate-950/50",
  cyan: "from-cyan-400/20 to-slate-950/50",
  emerald: "from-emerald-400/20 to-slate-950/50",
  red: "from-rose-400/20 to-slate-950/50",
  slate: "from-slate-400/18 to-slate-950/50",
  violet: "from-violet-400/20 to-slate-950/50",
};

const chartColors: Record<ReportTone, string> = {
  amber: "#facc15",
  blue: "#3b82f6",
  cyan: "#22d3ee",
  emerald: "#34d399",
  red: "#fb7185",
  slate: "#94a3b8",
  violet: "#a855f7",
};

const iconByReport: Record<ReportId, LucideIcon> = {
  apprehensions: Trophy,
  audit: ShieldCheck,
  binomials: PawPrint,
  effective: Users,
  health: HeartPulse,
  inventory: Package,
  occurrences: ShieldCheck,
  productivity: BarChart3,
  training: Activity,
  vehicles: Car,
};

type ReportHubTabId =
  | "operational"
  | "effective"
  | "health"
  | "training"
  | "inventory"
  | "audit";

const reportHubTabs: Array<{
  description: string;
  ids: ReportId[];
  id: ReportHubTabId;
  label: string;
}> = [
  {
    description: "ocorrências, apreensões e produtividade",
    id: "operational",
    ids: ["occurrences", "apprehensions", "productivity"],
    label: "Operacional",
  },
  {
    description: "K9, humanos, viaturas e binômios",
    id: "effective",
    ids: ["effective", "vehicles", "binomials"],
    label: "Efetivo",
  },
  {
    description: "prontuário e prontidão veterinária",
    id: "health",
    ids: ["health"],
    label: "Saúde",
  },
  {
    description: "formação, manutenção e prontidão",
    id: "training",
    ids: ["training"],
    label: "Treinos",
  },
  {
    description: "insumos, consumo e validade",
    id: "inventory",
    ids: ["inventory"],
    label: "Estoque",
  },
  {
    description: "integridade e trilhas auditáveis",
    id: "audit",
    ids: ["audit"],
    label: "Auditoria",
  },
];

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  maximumFractionDigits: 2,
  style: "currency",
});

function formatCount(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatPercent(value: number) {
  return `${numberFormatter.format(value)}%`;
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatKg(grams: number) {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${numberFormatter.format(grams)} g`;
}

function formatDate(value: Date | null) {
  return value ? dateFormatter.format(value) : "--";
}

function donutGradient(items: StatItem[]) {
  if (items.length === 0) {
    return "conic-gradient(rgba(34,211,238,0.16) 0deg 360deg)";
  }

  let cursor = 0;
  const segments = items.map((item) => {
    const start = cursor;
    const end = cursor + ((item.percent ?? 0) / 100) * 360;
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
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.65rem] border border-cyan-200/12 bg-slate-950/76 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  metric,
}: {
  detail?: string;
  icon: LucideIcon;
  metric: ReportMetric;
}) {
  return (
    <article className="relative overflow-hidden rounded-[1.45rem] border border-cyan-200/12 bg-slate-950/74 p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(34,211,238,0.10),transparent_24%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl border",
            toneClasses[metric.tone],
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <span className="text-right text-xs text-slate-500">{detail}</span>
      </div>
      <div className="relative mt-5">
        <p className="text-sm font-black text-white">{metric.label}</p>
        <p className="mt-3 font-mono text-4xl font-black text-white">
          {metric.value}
        </p>
        <p
          className={cn(
            "mt-2 text-xs font-semibold",
            metric.tone === "red" ? "text-red-300" : "text-emerald-300",
          )}
        >
          {metric.trend ?? metric.detail}
        </p>
      </div>
    </article>
  );
}

function ReportCard({
  description,
  href,
  id,
  indicators,
  title,
  tone,
  category,
}: (typeof reportDefinitions)[number]) {
  const Icon = iconByReport[id];

  return (
    <Link
      className={cn(
        "group relative overflow-hidden rounded-[1.5rem] border border-cyan-200/12 bg-gradient-to-br p-6 transition hover:-translate-y-0.5 hover:border-cyan-200/30",
        softToneClasses[tone],
      )}
      href={href}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-[1.35rem] border",
            toneClasses[tone],
          )}
        >
          <Icon className="h-10 w-10" />
        </span>
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition group-hover:border-cyan-200/30 group-hover:text-cyan-100">
          <ChevronRight className="h-6 w-6" />
        </span>
      </div>
      <h3 className="mt-7 text-2xl font-black text-white">{title}</h3>
      <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">
        {description}
      </p>
      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
        <Badge className={cn("border", toneClasses[tone])}>{category}</Badge>
        <span className="text-sm text-slate-400">{indicators} indicadores</span>
      </div>
    </Link>
  );
}

function ListItem({ item }: { item: ReportListItem }) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
          toneClasses[item.tone],
        )}
      >
        <FileBarChart className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-white">{item.label}</p>
        <p className="mt-1 truncate text-xs text-slate-400">{item.detail}</p>
      </div>
      <div className="text-right">
        {item.value ? (
          <p className="font-mono text-sm font-black text-white">{item.value}</p>
        ) : null}
        {item.status ? (
          <Badge className={cn("border text-[10px]", toneClasses[item.tone])}>
            {item.status}
          </Badge>
        ) : null}
        <p className="mt-1 font-mono text-[10px] text-slate-500">
          {formatDate(item.date)}
        </p>
      </div>
    </article>
  );
}

function StatBars({ items }: { items: StatItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-cyan-200/15 bg-black/14 p-8 text-center text-sm text-slate-400">
        Sem dados no período selecionado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between gap-4 text-sm">
            <span className="truncate font-semibold text-slate-200">
              {item.label}
            </span>
            <span className="font-mono text-white">{formatCount(item.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: chartColors[item.tone],
                width: `${Math.max(6, item.percent ?? 0)}%`,
              }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatPercent(item.percent ?? 0)}
          </p>
        </div>
      ))}
    </div>
  );
}

function DonutStats({ items, total }: { items: StatItem[]; total: number }) {
  return (
    <div className="grid items-center gap-5 md:grid-cols-[12rem_1fr]">
      <div
        className="relative mx-auto h-44 w-44 rounded-full p-5"
        style={{ background: donutGradient(items) }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-cyan-200/10 bg-slate-950">
          <span className="font-mono text-4xl font-black text-white">
            {formatCount(total)}
          </span>
          <span className="text-xs text-slate-400">Total</span>
        </div>
      </div>
      <StatBars items={items} />
    </div>
  );
}

function FilterBar({
  label,
  onGenerate,
}: {
  label: string;
  onGenerate?: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-[1.35rem] border border-cyan-200/10 bg-slate-950/65 p-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
      {["Período", "Tipo", "Status", "Responsável"].map((item, index) => (
        <button
          className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3 text-left"
          key={item}
          type="button"
        >
          <span>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {item}
            </span>
            <span className="mt-1 block text-sm font-semibold text-white">
              {index === 0 ? label : "Todos"}
            </span>
          </span>
          <Filter className="h-4 w-4 text-slate-500" />
        </button>
      ))}
      <Button
        className="rounded-2xl bg-cyan-300 text-slate-950 hover:bg-cyan-200"
        onClick={onGenerate}
        type="button"
      >
        Gerar relatório
      </Button>
    </div>
  );
}

function buildReportView(
  id: ReportId,
  data: ReturnType<typeof useReportsData>,
): {
  attention: ReportListItem[];
  chartItems: StatItem[];
  chartTitle: string;
  listTitle: string;
  metrics: ReportMetric[];
  secondary: StatItem[];
  secondaryTitle: string;
  totalForDonut: number;
} {
  switch (id) {
    case "occurrences":
      return {
        attention: data.occurrences.attention,
        chartItems: data.occurrences.distribution,
        chartTitle: "Distribuição por tipo de ocorrência",
        listTitle: "Ocorrências que exigem atenção",
        metrics: [
          {
            detail: "no período",
            label: "Ocorrências totais",
            tone: "cyan",
            trend: "+ período atual",
            value: formatCount(data.occurrences.total),
          },
          {
            detail: "abertas",
            label: "Abertas",
            tone: "emerald",
            value: formatCount(data.occurrences.open),
          },
          {
            detail: "prioridade critica",
            label: "Críticas",
            tone: "red",
            value: formatCount(data.occurrences.critical),
          },
          {
            detail: "selo institucional",
            label: "Seladas",
            tone: "violet",
            value: formatCount(data.occurrences.sealed),
          },
        ],
        secondary: [
          {
            label: "Finalizadas",
            tone: "emerald",
            value: data.occurrences.finalized,
          },
          {
            label: "Assinaturas pendentes",
            tone: "amber",
            value: data.occurrences.signaturesPending,
          },
          {
            label: "Em atenção",
            tone: "red",
            value: data.occurrences.attention.length,
          },
        ],
        secondaryTitle: "Indicadores operacionais",
        totalForDonut: data.occurrences.total,
      };
    case "inventory":
      return {
        attention: data.inventory.criticalItems,
        chartItems: data.inventory.categories,
        chartTitle: "Distribuição por categoria",
        listTitle: "Itens críticos",
        metrics: [
          {
            detail: "valor estimado",
            label: "Valor total",
            tone: "cyan",
            value: formatCurrency(data.inventory.totalValue),
          },
          {
            detail: "catalogados",
            label: "Itens cadastrados",
            tone: "emerald",
            value: formatCount(data.inventory.items),
          },
          {
            detail: "abaixo do mínimo",
            label: "Itens críticos",
            tone: "red",
            value: formatCount(data.inventory.belowMinimum),
          },
          {
            detail: "próximos 30 dias",
            label: "Vencendo",
            tone: "amber",
            value: formatCount(data.inventory.expiring),
          },
        ],
        secondary: [
          { label: "Movimentações", tone: "cyan", value: data.inventory.movements },
          { label: "Reposicoes", tone: "violet", value: data.inventory.replenishments },
          { label: "Vencidos", tone: "red", value: data.inventory.expired },
        ],
        secondaryTitle: "Resumo logistico",
        totalForDonut: data.inventory.items,
      };
    case "effective":
      return {
        attention: data.effective.movements,
        chartItems: data.effective.status,
        chartTitle: "Composição do efetivo por status",
        listTitle: "Movimentações recentes",
        metrics: [
          {
            detail: "ativos",
            label: "K9 cadastrados",
            tone: "cyan",
            value: formatCount(data.effective.dogs),
          },
          {
            detail: "humanos",
            label: "Efetivo humano",
            tone: "blue",
            value: formatCount(data.effective.humans),
          },
          {
            detail: "ativos",
            label: "Binômios ativos",
            tone: "emerald",
            value: formatCount(data.effective.binomials),
          },
          {
            detail: "afastamentos",
            label: "Afastamentos",
            tone: "red",
            value: formatCount(data.effective.absences),
          },
        ],
        secondary: data.effective.incomplete,
        secondaryTitle: "Cadastros incompletos",
        totalForDonut: data.effective.dogs + data.effective.humans,
      };
    case "apprehensions":
      return {
        attention: data.apprehensions.recent,
        chartItems: data.apprehensions.categories,
        chartTitle: "Distribuição por tipo de droga/material",
        listTitle: "Apreensões recentes",
        metrics: [
          {
            detail: "total apreendido",
            label: "Total apreendido",
            tone: "emerald",
            value: formatKg(data.apprehensions.totalGrams),
          },
          {
            detail: "com apreensão",
            label: "Registros",
            tone: "violet",
            value: formatCount(data.apprehensions.count),
          },
          {
            detail: "maior categoria",
            label: "Maior categoria",
            tone: "amber",
            value: data.apprehensions.topCategory,
          },
          {
            detail: "media",
            label: "Media por registro",
            tone: "cyan",
            value: formatKg(data.apprehensions.avgGrams),
          },
        ],
        secondary: data.apprehensions.categories,
        secondaryTitle: "Resumo analitico",
        totalForDonut: Math.max(1, data.apprehensions.count),
      };
    case "vehicles":
      return {
        attention: data.vehicles.highlights,
        chartItems: data.vehicles.status,
        chartTitle: "Status da frota",
        listTitle: "Viaturas destaque",
        metrics: [
          {
            detail: "cadastradas",
            label: "Viaturas cadastradas",
            tone: "cyan",
            value: formatCount(data.vehicles.total),
          },
          {
            detail: "ativas",
            label: "Em operação",
            tone: "emerald",
            value: formatCount(data.vehicles.inOperation),
          },
          {
            detail: "manutenção",
            label: "Em manutenção",
            tone: "amber",
            value: formatCount(data.vehicles.inMaintenance),
          },
          {
            detail: "30 dias",
            label: "Documentação",
            tone: "red",
            value: formatCount(data.vehicles.docsExpiring),
          },
        ],
        secondary: [
          {
            label: "Km medio",
            tone: "cyan",
            value: data.vehicles.mileageAvg,
          },
          {
            label: "Frota ativa",
            tone: "emerald",
            value: data.vehicles.inOperation,
          },
        ],
        secondaryTitle: "Utilização da frota",
        totalForDonut: data.vehicles.total,
      };
    case "health":
      return {
        attention: data.health.attention,
        chartItems: [
          {
            label: "Prontos",
            percent: data.health.readyPercent,
            tone: "emerald",
            value: data.health.readyPercent,
          },
          {
            label: "Pendências",
            percent: 100 - data.health.readyPercent,
            tone: "amber",
            value: data.health.pending,
          },
        ],
        chartTitle: "Prontidão veterinária do efetivo",
        listTitle: "K9 que exigem atenção clínica",
        metrics: [
          {
            detail: "no período",
            label: "Atendimentos",
            tone: "violet",
            value: formatCount(data.health.events),
          },
          {
            detail: "requerem atenção",
            label: "Pendências",
            tone: "red",
            value: formatCount(data.health.pending),
          },
          {
            detail: "do efetivo atualizado",
            label: "Vacinas em dia",
            tone: "emerald",
            value: formatPercent(data.health.vaccinesPercent),
          },
          {
            detail: "em acompanhamento",
            label: "Tratamentos",
            tone: "amber",
            value: formatCount(data.health.treatments),
          },
        ],
        secondary: [],
        secondaryTitle: "Agenda clínica",
        totalForDonut: 100,
      };
    case "training":
      return {
        attention: data.training.pending,
        chartItems: data.training.disciplines,
        chartTitle: "Desempenho por disciplina",
        listTitle: "Treinos pendentes / recertificações",
        metrics: [
          {
            detail: "sessões",
            label: "Sessões realizadas",
            tone: "cyan",
            value: formatCount(data.training.sessions),
          },
          {
            detail: "avaliados",
            label: "Binômios avaliados",
            tone: "violet",
            value: formatCount(data.training.binomialsEvaluated),
          },
          {
            detail: "conformidade",
            label: "Conformidade",
            tone: "emerald",
            value: formatPercent(data.training.avgConformity),
          },
          {
            detail: "registrados",
            label: "Comandos novos",
            tone: "amber",
            value: formatCount(data.training.commands),
          },
        ],
        secondary: data.training.disciplines,
        secondaryTitle: "Disciplinas",
        totalForDonut: data.training.sessions,
      };
    case "binomials":
      return {
        attention: data.binomials.highlights,
        chartItems: [
          {
            label: "Prontidão media",
            percent: data.binomials.avgReadiness,
            tone: "cyan",
            value: data.binomials.avgReadiness,
          },
          {
            label: "Alertas",
            percent: 100 - data.binomials.avgReadiness,
            tone: "amber",
            value: data.binomials.alerts,
          },
        ],
        chartTitle: "Prontidão dos binômios",
        listTitle: "Destaques do período",
        metrics: [
          {
            detail: "ativos",
            label: "Binômios ativos",
            tone: "cyan",
            value: formatCount(data.binomials.active),
          },
          {
            detail: "em treino",
            label: "Em formação",
            tone: "violet",
            value: formatCount(data.binomials.formation),
          },
          {
            detail: "media",
            label: "Prontidão media",
            tone: "emerald",
            value: formatPercent(data.binomials.avgReadiness),
          },
          {
            detail: "requerem atenção",
            label: "Alertas",
            tone: "amber",
            value: formatCount(data.binomials.alerts),
          },
        ],
        secondary: [],
        secondaryTitle: "Insights e pendências",
        totalForDonut: 100,
      };
    case "audit":
      return {
        attention: data.audit.recent,
        chartItems: data.audit.distribution,
        chartTitle: "Distribuição por criticidade",
        listTitle: "Eventos auditados recentes",
        metrics: [
          {
            detail: "hash e cadeia",
            label: "Eventos selados",
            tone: "cyan",
            value: formatCount(data.audit.sealed),
          },
          {
            detail: "assinaturas",
            label: "Pendências",
            tone: "amber",
            value: formatCount(data.audit.signaturesPending),
          },
          {
            detail: "divergencias",
            label: "Divergencias",
            tone: "red",
            value: formatCount(data.audit.divergences),
          },
          {
            detail: "críticas",
            label: "Revisoes",
            tone: "violet",
            value: formatCount(data.audit.revisions),
          },
        ],
        secondary: data.audit.distribution,
        secondaryTitle: "Integridade institucional",
        totalForDonut: data.audit.events,
      };
    case "productivity":
      return {
        attention: [],
        chartItems: data.productivity.activity,
        chartTitle: "Desempenho por módulo",
        listTitle: "Alertas de produtividade",
        metrics: [
          {
            detail: "atendidas",
            label: "Ocorrências",
            tone: "cyan",
            value: formatCount(data.productivity.occurrences),
          },
          {
            detail: "realizados",
            label: "Treinos",
            tone: "violet",
            value: formatCount(data.productivity.trainings),
          },
          {
            detail: "registros",
            label: "Saúde",
            tone: "red",
            value: formatCount(data.productivity.healthEvents),
          },
          {
            detail: "apreendido",
            label: "Apreensões",
            tone: "emerald",
            value: formatKg(data.productivity.apprehensionGrams),
          },
        ],
        secondary: data.productivity.activity,
        secondaryTitle: "Variação vs. período anterior",
        totalForDonut: data.productivity.activity.reduce(
          (sum, item) => sum + item.value,
          0,
        ),
      };
  }
}

export function ReportsHubPage() {
  const { periodLabel, periodDays } = useDashboardPeriod();
  const data = useReportsData(periodDays);
  const [activeTab, setActiveTab] = useState<ReportHubTabId>("operational");

  const visibleReports = useMemo(() => {
    const tab = reportHubTabs.find((item) => item.id === activeTab);
    const ids = new Set(tab?.ids ?? []);
    return reportDefinitions.filter((report) => ids.has(report.id));
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">Hub de Relatórios</h1>
          <p className="mt-2 text-sm text-slate-400">
            Centralize consultas, exportações e relatórios agendados da unidade
            K9. Período atual:{" "}
            <span className="font-semibold text-cyan-200">{periodLabel}</span>.
          </p>
        </div>
        <Button className="rounded-2xl bg-cyan-300 text-slate-950 hover:bg-cyan-200">
          <CalendarClock className="mr-2 h-4 w-4" />
          Agendar relatório
        </Button>
      </header>

      {data.errors.length > 0 ? (
        <Panel title="Fontes parcialmente indisponíveis">
          <p className="mb-3 text-sm leading-6 text-amber-100/80">
            Alguns dados não puderam ser consultados com o perfil atual. Os
            relatórios continuam disponíveis, mas podem aparecer incompletos.
          </p>
          <ul className="space-y-1 text-xs text-amber-100">
            {humanizeSourceErrors(data.errors).slice(0, 5).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {[
          {
            detail: "gerados",
            icon: FileText,
            label: "Relatórios gerados no mes",
            tone: "cyan" as const,
            value: formatCount(data.generatedThisMonth),
          },
          {
            detail: "aguardando processamento",
            icon: Download,
            label: "Exportações pendentes",
            tone: "amber" as const,
            value: formatCount(data.pendingExports),
          },
          {
            detail: "execução automática",
            icon: CalendarClock,
            label: "Agendamentos ativos",
            tone: "emerald" as const,
            value: formatCount(data.schedules.length),
          },
          {
            detail: "sincronização",
            icon: Activity,
            label: "Última atualização",
            tone: "violet" as const,
            value: data.loading ? "..." : formatDate(data.updatedAt),
          },
        ].map((metric) => (
          <MetricCard
            detail={metric.detail}
            icon={metric.icon}
            key={metric.label}
            metric={{
              detail: metric.detail,
              label: metric.label,
              tone: metric.tone,
              value: metric.value,
            }}
          />
        ))}
      </section>

      <div className="flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-6">
          {reportHubTabs.map((item) => (
            <button
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition",
                activeTab === item.id
                  ? "border-cyan-300/40 bg-cyan-300/12 text-cyan-100"
                  : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-white",
              )}
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              type="button"
            >
              <span className="block text-sm font-black">{item.label}</span>
              <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                {item.description}
              </span>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button className="rounded-2xl" variant="secondary">
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        {visibleReports.map((report) => (
          <ReportCard key={report.id} {...report} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr_0.7fr]">
        <Panel action={<Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Ver todos</Badge>} title="Relatórios recentes">
          <div className="space-y-3">
            {data.recentReports.map((item) => (
              <ListItem item={item} key={item.id} />
            ))}
          </div>
        </Panel>

        <Panel action={<Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Ver todos</Badge>} title="Agendamentos automáticos">
          <div className="space-y-3">
            {data.schedules.map((item) => (
              <ListItem item={item} key={item.id} />
            ))}
          </div>
        </Panel>

        <Panel title="Formatos de exportação">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "PDF", detail: "Documento portátil", tone: "red" as const },
              { label: "Excel", detail: "Planilha editável", tone: "emerald" as const },
              { label: "CSV", detail: "Valores separados", tone: "blue" as const },
            ].map((format) => (
              <div
                className={cn(
                  "rounded-2xl border bg-white/[0.035] p-4 text-left",
                  toneClasses[format.tone],
                )}
                key={format.label}
              >
                <FileText className="mb-4 h-7 w-7" />
                <p className="font-black text-white">{format.label}</p>
                <p className="mt-1 text-xs text-slate-400">{format.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-cyan-200/10 bg-cyan-300/8 p-4">
            <ShieldCheck className="mb-3 h-6 w-6 text-cyan-200" />
            <p className="text-sm font-black text-white">Dados seguros</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Relatórios seguem as permissões do perfil e preservam a origem dos
              registros.
            </p>
          </div>
        </Panel>
      </section>
    </div>
  );
}

export function ReportDetailPage({ reportId }: { reportId: ReportId }) {
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useReportsData(periodDays);
  const definition = getReportDefinition(reportId);
  const view = buildReportView(reportId, data);

  const getExportData = useCallback(
    () => getExportableData(reportId, data),
    [reportId, data],
  );

  if (!definition) {
    return (
      <Panel title="Relatório não encontrado">
        <Link className="text-cyan-200" href="/reports">
          Voltar ao Hub de Relatórios
        </Link>
      </Panel>
    );
  }

  const Icon = iconByReport[definition.id];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "hidden h-16 w-16 items-center justify-center rounded-2xl border md:flex",
              toneClasses[definition.tone],
            )}
          >
            <Icon className="h-8 w-8" />
          </span>
          <div>
            <Link
              className="mb-2 inline-flex text-sm font-semibold text-cyan-200 hover:text-cyan-100"
              href="/reports"
            >
              Hub de Relatórios
            </Link>
            <h1 className="text-3xl font-black text-white">
              Relatório de {definition.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              {definition.description}
            </p>
          </div>
        </div>

        <ExportButton
          getData={getExportData}
          reportId={reportId}
          reportTitle={definition.title}
          subtitle={`Período: ${periodLabel}`}
        />
      </header>

      <FilterBar label={periodLabel} />

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {view.metrics.map((metric, index) => (
          <MetricCard
            detail={metric.detail}
            icon={[FileBarChart, Activity, AlertTriangle, CalendarClock][index]}
            key={metric.label}
            metric={metric}
          />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title={view.chartTitle}>
          <DonutStats items={view.chartItems} total={view.totalForDonut} />
        </Panel>

        <Panel title={view.secondaryTitle}>
          {view.secondary.length > 0 ? (
            <StatBars items={view.secondary} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {view.metrics.slice(0, 3).map((metric) => (
                <div
                  className={cn(
                    "rounded-2xl border bg-white/[0.03] p-4",
                    toneClasses[metric.tone],
                  )}
                  key={metric.label}
                >
                  <p className="text-sm font-semibold text-white">
                    {metric.label}
                  </p>
                  <p className="mt-3 font-mono text-3xl font-black text-white">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{metric.detail}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.7fr]">
        <Panel
          action={<Badge className={cn("border", toneClasses[definition.tone])}>Ver todos</Badge>}
          title={view.listTitle}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {view.attention.length > 0 ? (
              view.attention.slice(0, 6).map((item) => (
                <ListItem item={item} key={item.id} />
              ))
            ) : (
              <div className="md:col-span-2 rounded-2xl border border-dashed border-cyan-200/15 bg-black/14 p-8 text-center text-sm text-slate-400">
                Sem itens para exibir no período selecionado.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Exportação e assinatura">
          <ExportToolbar
            getData={getExportData}
            reportId={reportId}
            reportTitle={definition.title}
            subtitle={`Período: ${periodLabel}`}
          />
          <div className="mt-4 rounded-2xl border border-cyan-200/10 bg-cyan-300/8 p-4">
            <ShieldCheck className="mb-3 h-6 w-6 text-cyan-200" />
            <p className="font-black text-white">Assinatura digital</p>
            <p className="mt-1 text-sm text-slate-400">
              Relatório validado com base nos registros consultados e filtros
              selecionados.
            </p>
            <Button className="mt-4 w-full rounded-2xl" variant="secondary">
              Assinar relatório
            </Button>
          </div>
        </Panel>
      </section>
    </div>
  );
}
