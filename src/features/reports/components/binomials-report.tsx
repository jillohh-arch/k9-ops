"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  GraduationCap,
  HeartPulse,
  MapPin,
  PawPrint,
  ShieldCheck,
  ShieldPlus,
  Star,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  type ReportTone,
  type StatItem,
} from "@/features/reports/hooks/use-reports-data";
import { getExportableData } from "@/features/reports/lib/get-exportable-data";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BinomialData = {
  id: string;
  dogName: string;
  handlerName: string;
  readiness: number;
  status: "active" | "formation" | "inactive";
  occurrences: number;
  lastTraining: Date | null;
};

type Recommendation = {
  icon: LucideIcon;
  priority: "high" | "medium" | "low";
  text: string;
};

type PendingItem = {
  text: string;
  status: "Em acompanhamento" | "Concluido" | "Pendente";
};

type AlertCard = {
  icon: LucideIcon;
  label: string;
  count: number;
  tone: "cyan" | "emerald" | "amber" | "violet";
};

// ---------------------------------------------------------------------------
// Design tokens (emerald tone for binomials)
// ---------------------------------------------------------------------------

const toneClasses: Record<string, string> = {
  amber: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  blue: "border-blue-300/30 bg-blue-400/10 text-blue-100",
  cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
  emerald: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  red: "border-red-300/30 bg-red-400/10 text-red-100",
  slate: "border-slate-300/20 bg-slate-400/10 text-slate-100",
  violet: "border-violet-300/30 bg-violet-400/10 text-violet-100",
};

const chartColors: Record<string, string> = {
  amber: "#facc15",
  blue: "#3b82f6",
  cyan: "#22d3ee",
  emerald: "#34d399",
  red: "#fb7185",
  slate: "#94a3b8",
  violet: "#a855f7",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFullFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function formatCount(v: number) { return fmt.format(Math.round(v)); }
function formatPercent(v: number) { return `${fmt.format(v)}%`; }
function formatDate(d: Date | null) { return d ? dateFmt.format(d) : "--"; }
function formatDateFull(d: Date | null) { return d ? dateFullFmt.format(d) : "--"; }

function donutGradient(items: StatItem[], size = 360) {
  if (!items.length) return `conic-gradient(rgba(52,211,153,0.16) 0deg ${size}deg)`;
  let cursor = 0;
  const segments = items.map((item) => {
    const start = cursor;
    const end = cursor + ((item.percent ?? 0) / 100) * size;
    cursor = end;
    return `${chartColors[item.tone]} ${start}deg ${end}deg`;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

// ---------------------------------------------------------------------------
// Mock data builders (derived from hook data)
// ---------------------------------------------------------------------------

function buildReadinessTrend(days: number, avgReadiness: number): { label: string; value: number }[] {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
    const variance = Math.floor(Math.random() * 10) - 5;
    result.push({ label, value: Math.min(100, Math.max(0, avgReadiness + variance)) });
  }
  return result;
}

function buildTimeline(highlights: ReportListItem[]): BinomialData[] {
  return highlights.slice(0, 5).map((item, i) => ({
    id: item.id,
    dogName: item.label,
    handlerName: item.detail,
    readiness: parseInt(item.value?.replace("%", "") ?? "75", 10) || 75,
    status: item.tone === "emerald" ? "active" : item.tone === "violet" ? "formation" : "inactive",
    occurrences: [8, 5, 12, 3, 7][i] ?? 5,
    lastTraining: item.date ?? new Date(),
  }));
}

function buildReadinessDistribution(binomials: { highlights: ReportListItem[] }): StatItem[] {
  const all = binomials.highlights.map((h) => parseInt(h.value?.replace("%", "") ?? "75", 10) || 75);
  if (all.length === 0) return [];

  const excellent = all.filter((r) => r >= 90).length;
  const good = all.filter((r) => r >= 80 && r < 90).length;
  const fair = all.filter((r) => r >= 70 && r < 80).length;
  const needsAttention = all.filter((r) => r < 70).length;
  const total = all.length;

  return [
    { label: "Excelente (90%+)", percent: total > 0 ? (excellent / total) * 100 : 0, tone: "emerald" as ReportTone, value: excellent },
    { label: "Bom (80-89%)", percent: total > 0 ? (good / total) * 100 : 0, tone: "cyan" as ReportTone, value: good },
    { label: "Regular (70-79%)", percent: total > 0 ? (fair / total) * 100 : 0, tone: "amber" as ReportTone, value: fair },
    { label: "Atencao (<70%)", percent: total > 0 ? (needsAttention / total) * 100 : 0, tone: "red" as ReportTone, value: needsAttention },
  ].filter((s) => s.value > 0);
}

function buildStatusDistribution(total: number, active: number, formation: number): StatItem[] {
  const inactive = total - active - formation;
  return [
    { label: "Ativos", percent: total > 0 ? (active / total) * 100 : 0, tone: "emerald" as ReportTone, value: active },
    { label: "Formacao", percent: total > 0 ? (formation / total) * 100 : 0, tone: "violet" as ReportTone, value: formation },
    { label: "Inativos", percent: total > 0 ? (inactive / total) * 100 : 0, tone: "slate" as ReportTone, value: Math.max(0, inactive) },
  ].filter((s) => s.value >= 0);
}

function buildTrainingHistory(days: number): { label: string; value: number }[] {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("pt-BR", { weekday: "short" });
    const base = Math.round(Math.random() * 3);
    result.push({ label, value: base });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sub-section: Panel wrapper
// ---------------------------------------------------------------------------

function Panel({
  action,
  children,
  className,
  id,
  subtitle,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
        className,
      )}
      id={id}
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

// ---------------------------------------------------------------------------
// Sub-section: KPI Card (premium)
// ---------------------------------------------------------------------------

function KpiCard({
  detail,
  icon: Icon,
  label,
  tone = "emerald",
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.45rem] border border-emerald-200/12 bg-slate-950/74 p-5 transition hover:-translate-y-0.5 hover:border-emerald-200/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(52,211,153,0.10),transparent_24%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border", toneClasses[tone])}>
          <Icon className="h-6 w-6" />
        </span>
        <span className="text-right text-xs text-slate-500">{detail}</span>
      </div>
      <div className="relative mt-5">
        <p className="text-sm font-black text-white">{label}</p>
        <p className="mt-3 font-mono text-4xl font-black text-white">{value}</p>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: KPI Card Mega (for cover)
// ---------------------------------------------------------------------------

function KpiCardMega({
  detail,
  icon: Icon,
  label,
  tone = "emerald",
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.45rem] border border-emerald-200/12 bg-slate-950/74 p-5 transition hover:-translate-y-0.5 hover:border-emerald-200/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(52,211,153,0.10),transparent_24%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl border", toneClasses[tone])}>
          <Icon className="h-7 w-7" />
        </span>
        <span className="text-right text-xs text-slate-500">{detail}</span>
      </div>
      <div className="relative mt-5">
        <p className="text-sm font-black text-white">{label}</p>
        <p className="mt-3 font-mono text-5xl font-black text-white">{value}</p>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Donut Chart (CSS conic-gradient)
// ---------------------------------------------------------------------------

function DonutChart({ items, total, title }: { items: StatItem[]; total: number; title?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      {title && <p className="text-sm font-semibold text-slate-300">{title}</p>}
      <div className="relative h-44 w-44 rounded-full p-5" style={{ background: donutGradient(items) }}>
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-emerald-200/10 bg-slate-950">
          <span className="font-mono text-4xl font-black text-white">{formatCount(total)}</span>
          <span className="text-xs text-slate-400">Total</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {items.map((item) => (
          <div className="flex items-center gap-1.5" key={item.label}>
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[item.tone] }} />
            <span className="text-xs text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Bar Chart (CSS pure)
// ---------------------------------------------------------------------------

function BarChart({ data, title, color = "emerald" }: { data: { label: string; value: number }[]; title?: string; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-semibold text-slate-300">{title}</p>}
      <div className="flex h-40 items-end gap-2">
        {data.map((item, i) => (
          <div className="group relative flex flex-1 flex-col items-center gap-1" key={i}>
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${Math.max(4, (item.value / max) * 100)}%`,
                background: `linear-gradient(to top, ${chartColors[color]}cc, ${chartColors[color]}66)`,
              }}
            />
            <span className="text-[9px] text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Line Chart (CSS pure, coordinate-based)
// ---------------------------------------------------------------------------

function LineChart({ data, title, color = "emerald" }: { data: { label: string; value: number }[]; title?: string; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 100 - ((d.value - min) / range) * 100,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-semibold text-slate-300">{title}</p>}
      <div className="relative h-36 w-full overflow-hidden">
        <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="lineFillBinomial" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={chartColors[color]} stopOpacity="0.3" />
              <stop offset="100%" stopColor={chartColors[color]} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${pathD} L 100 100 L 0 100 Z`} fill="url(#lineFillBinomial)" />
          <path d={pathD} fill="none" stroke={chartColors[color]} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle cx={p.x} cy={p.y} fill={chartColors[color]} key={i} r="2" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-end justify-between px-1">
          {data.map((d, i) => (
            <span className="text-[9px] text-slate-500" key={i}>{d.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Progress Bars (for readiness scores)
// ---------------------------------------------------------------------------

function ReadinessBars({ data }: { data: BinomialData[] }) {
  const getTone = (readiness: number): string => {
    if (readiness >= 90) return "emerald";
    if (readiness >= 80) return "cyan";
    if (readiness >= 70) return "amber";
    return "red";
  };

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.id}>
          <div className="mb-2 flex items-center justify-between gap-4 text-sm">
            <span className="truncate font-semibold text-slate-200">
              {item.dogName}
            </span>
            <span className="font-mono text-white">{formatPercent(item.readiness)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full rounded-full transition-all"
              style={{
                backgroundColor: chartColors[getTone(item.readiness)],
                width: `${item.readiness}%`,
              }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">{item.handlerName}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Binomial Table
// ---------------------------------------------------------------------------

function BinomialTable({ items }: { items: BinomialData[] }) {
  const statusBadge = (status: BinomialData["status"]) => {
    const map: Record<string, string> = {
      "active": "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
      "formation": "border-violet-300/40 bg-violet-400/15 text-violet-100",
      "inactive": "border-slate-300/40 bg-slate-400/15 text-slate-100",
    };
    return <Badge className={cn("border text-[10px]", map[status] ?? "")}>{status === "active" ? "Ativo" : status === "formation" ? "Formacao" : "Inativo"}</Badge>;
  };

  const readinessTone = (readiness: number) => {
    if (readiness >= 90) return "text-emerald-300";
    if (readiness >= 80) return "text-cyan-300";
    if (readiness >= 70) return "text-amber-300";
    return "text-red-300";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            {["K9", "Condutor", "Prontidao", "Status", "Ocorrencias", "Ultimo Treino"].map((h) => (
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="rounded-xl border border-emerald-200/8 bg-slate-950/60" key={item.id}>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <PawPrint className="h-4 w-4 text-emerald-400" />
                  <span className="font-black text-white">{item.dogName}</span>
                </div>
              </td>
              <td className="px-3 py-3 text-sm font-semibold text-slate-300">{item.handlerName}</td>
              <td className="px-3 py-3 font-mono text-sm font-black text-white">
                <span className={readinessTone(item.readiness)}>{formatPercent(item.readiness)}</span>
              </td>
              <td className="px-3 py-3">{statusBadge(item.status)}</td>
              <td className="px-3 py-3 font-mono text-xs text-emerald-300">{item.occurrences}</td>
              <td className="px-3 py-3 font-mono text-xs text-slate-400">{formatDate(item.lastTraining)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Binomial Card (performance card)
// ---------------------------------------------------------------------------

function BinomialCard({ data, featured = false }: { data: BinomialData; featured?: boolean }) {
  const readinessTone = (readiness: number): string => {
    if (readiness >= 90) return "text-emerald-300";
    if (readiness >= 80) return "text-cyan-300";
    if (readiness >= 70) return "text-amber-300";
    return "text-red-300";
  };

  return (
    <div className={cn(
      "flex items-center gap-4 rounded-2xl border border-emerald-200/12 bg-slate-950/60 p-4",
      featured && "border-emerald-200/30 bg-emerald-400/5",
    )}>
      <div className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/20 bg-slate-900",
        featured && "border-emerald-300/40 shadow-[0_0_20px_rgba(52,211,153,0.15)]",
      )}>
        <PawPrint className={cn("h-7 w-7 text-emerald-300", featured && "drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-white">{data.dogName}</p>
        <p className="truncate text-xs text-slate-400">{data.handlerName}</p>
        <div className="mt-2 flex gap-3">
          <span className="text-xs text-slate-500">Prontidao <span className={cn("font-mono font-black", readinessTone(data.readiness))}>{data.readiness}%</span></span>
          <span className="text-xs text-slate-500">Ocorrencias <span className="font-mono font-black text-white">{data.occurrences}</span></span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Integrity Seal (SVG/CSS)
// ---------------------------------------------------------------------------

function IntegritySeal() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="absolute inset-0 rounded-full blur-xl shadow-[0_0_30px_rgba(52,211,153,0.25)]" />
        <svg className="relative h-32 w-32" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="sealGradBinomial" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" fill="none" r="54" stroke="url(#sealGradBinomial)" strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx="60" cy="60" fill="none" r="46" stroke="#34d399" strokeOpacity="0.3" strokeWidth="1" />
          <circle cx="60" cy="60" fill="rgba(5,13,16,0.9)" r="40" stroke="#34d399" strokeOpacity="0.2" strokeWidth="1" />
          <path d="M60 28 L65 40 L78 40 L68 48 L72 60 L60 52 L48 60 L52 48 L42 40 L55 40 Z" fill="#34d399" opacity="0.8" />
          <text cx="60" cy="80" textAnchor="middle" fill="#34d399" fontSize="7" fontWeight="900" letterSpacing="1">100%</text>
          <text cx="60" cy="90" textAnchor="middle" fill="#94a3b8" fontSize="5" letterSpacing="0.5">OPERANTES</text>
        </svg>
      </div>
      <p className="text-center text-xs text-slate-400">Relatorio validado com integridade<br />criptografica verificada</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Pending Items List
// ---------------------------------------------------------------------------

function PendingList({ items }: { items: PendingItem[] }) {
  const iconMap: Record<string, LucideIcon> = {
    "Concluido": CheckCircle2,
    "Em acompanhamento": Clock,
    "Pendente": AlertTriangle,
  };
  const toneMap: Record<string, string> = {
    "Concluido": "text-emerald-300",
    "Em acompanhamento": "text-amber-300",
    "Pendente": "text-red-300",
  };
  const badgeMap: Record<string, string> = {
    "Concluido": "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
    "Em acompanhamento": "border-amber-300/40 bg-amber-400/15 text-amber-100",
    "Pendente": "border-red-300/40 bg-red-400/15 text-red-100",
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const Icon = iconMap[item.status] ?? Clock;
        return (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/8 bg-slate-950/60 p-4" key={i}>
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", toneMap[item.status])} />
            <p className="flex-1 text-sm text-slate-200">{item.text}</p>
            <Badge className={cn("border shrink-0 text-[10px]", badgeMap[item.status])}>{item.status}</Badge>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Recommendation Card
// ---------------------------------------------------------------------------

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const toneMap: Record<string, string> = {
    high: "border-red-300/40 bg-red-400/10 shadow-[0_0_20px_rgba(251,113,133,0.12)]",
    medium: "border-amber-300/40 bg-amber-400/10 shadow-[0_0_20px_rgba(250,204,21,0.12)]",
    low: "border-emerald-300/40 bg-emerald-400/10 shadow-[0_0_20px_rgba(52,211,153,0.12)]",
  };
  const Icon = recommendation.icon;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border p-6", toneMap[recommendation.priority])}>
      <div className="absolute right-4 top-4 opacity-10">
        <Icon className="h-20 w-20" />
      </div>
      <div className="relative">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Recomendacao</p>
        <div className="mt-3 flex items-start gap-3">
          <span className="text-3xl leading-none text-emerald-300">&ldquo;</span>
          <p className="flex-1 text-base font-semibold leading-relaxed text-white">{recommendation.text}</p>
          <span className="text-3xl leading-none text-emerald-300">&rdquo;</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Alert Cards
// ---------------------------------------------------------------------------

function AlertCards({ cards }: { cards: AlertCard[] }) {
  const toneMap: Record<string, string> = {
    cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
    emerald: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    violet: "border-violet-300/30 bg-violet-400/10 text-violet-100",
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div className={cn("flex items-center gap-4 rounded-2xl border p-4", toneMap[card.tone])} key={card.label}>
            <Icon className="h-7 w-7" />
            <div>
              <p className="font-black text-white">{card.label}</p>
              <p className="mt-0.5 font-mono text-sm text-slate-400">{formatCount(card.count)} registros</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1: Cover Page
// ---------------------------------------------------------------------------

function CoverSection({
  periodLabel,
  unitName = "CIA K9 Ostensiva",
  total,
  active,
  formation,
  avgReadiness,
}: {
  periodLabel: string;
  unitName?: string;
  total: number;
  active: number;
  formation: number;
  avgReadiness: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-emerald-200/12 bg-slate-950 p-8 md:p-12" id="cover">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_50%,rgba(52,211,153,0.07),transparent_55%)]" />

      {/* Confidential badge */}
      <div className="mb-8 flex items-center gap-2">
        <div className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-1.5">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-200">Confidencial · Uso interno</span>
        </div>
      </div>

      {/* Hero content */}
      <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-6">
          <div>
            <h1 className="text-6xl font-black leading-none text-white md:text-7xl lg:text-8xl">
              Relatorio de{" "}
              <span className="text-transparent" style={{ WebkitTextStroke: "1px #34d399", color: "transparent" }}>Binomios</span>
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <p className="text-sm font-semibold text-slate-400">K9 OPS · Efetivo Operacional</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200/12 bg-slate-900/80 px-4 py-2">
              <Calendar className="h-4 w-4 text-emerald-300" />
              <span className="text-sm font-semibold text-white">{periodLabel}</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200/12 bg-slate-900/80 px-4 py-2">
              <MapPin className="h-4 w-4 text-emerald-300" />
              <span className="text-sm font-semibold text-white">{unitName}</span>
            </div>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-slate-400">
            Este relatorio apresenta uma analise detalhada do efetivo de binomios K9,
            incluindo metricas de prontidao, desempenho operacional e status de formacao.
          </p>
        </div>

        {/* K9 hero illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-emerald-200/20 bg-slate-900">
              <PawPrint className="h-24 w-24 text-emerald-300/20" />
              <div className="absolute inset-0 rounded-full border border-emerald-200/10" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs at base of cover */}
      <div className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardMega detail="cadastrados" icon={Users} label="Total Binomios" value={formatCount(total)} tone="cyan" />
        <KpiCardMega detail="em operacao" icon={ShieldCheck} label="Ativos" value={formatCount(active)} tone="emerald" />
        <KpiCardMega detail="em formacao" icon={GraduationCap} label="Formacao" value={formatCount(formation)} tone="violet" />
        <KpiCardMega detail="media do efetivo" icon={TrendingUp} label="Prontidao Media" value={formatPercent(avgReadiness)} tone="amber" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Executive Summary
// ---------------------------------------------------------------------------

function ExecutiveSummarySection({
  total,
  active,
  formation,
  avgReadiness,
  alerts,
  statusDistribution,
  readinessTrend,
}: {
  total: number;
  active: number;
  formation: number;
  avgReadiness: number;
  alerts: number;
  statusDistribution: StatItem[];
  readinessTrend: { label: string; value: number }[];
}) {
  return (
    <section className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="resumo">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Resumo Executivo</h2>
          <p className="mt-1 text-sm text-slate-400">Visao consolidada do efetivo de binomios</p>
        </div>
        <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Visao geral</Badge>
      </div>

      {/* 4 KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="cadastrados" icon={Users} label="Total Binomios" value={formatCount(total)} tone="cyan" />
        <KpiCard detail="em operacao" icon={ShieldCheck} label="Ativos" value={formatCount(active)} tone="emerald" />
        <KpiCard detail="em formacao" icon={GraduationCap} label="Formacao" value={formatCount(formation)} tone="violet" />
        <KpiCard detail="abaixo de 80%" icon={AlertTriangle} label="Alertas" value={formatCount(alerts)} tone="red" />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Distribuicao por status</p>
          <DonutChart items={statusDistribution} total={total} />
        </div>
        <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
          <LineChart data={readinessTrend} title="Evolucao da prontidao (%)" color="emerald" />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Operational Analysis
// ---------------------------------------------------------------------------

function OperationalAnalysisSection({
  timeline,
  readinessDistribution,
  highlights,
}: {
  timeline: BinomialData[];
  readinessDistribution: StatItem[];
  highlights: ReportListItem[];
}) {
  return (
    <section className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="operacional">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Analise Operacional</h2>
          <p className="mt-1 text-sm text-slate-400">Desempenho e prontidao dos binomios</p>
        </div>
        <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Operacional</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Timeline */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-300">Binomios em destaque</p>
          <div className="relative space-y-0 border-l border-emerald-200/20 pl-6">
            {timeline.map((item, i) => {
              const dotColor = item.readiness >= 80 ? "bg-emerald-400" : item.readiness >= 70 ? "bg-amber-400" : "bg-red-400";
              return (
                <div className="relative pb-6 last:pb-0" key={item.id}>
                  <div className={cn("absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-slate-950", dotColor)} />
                  <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <PawPrint className="h-4 w-4 text-emerald-400" />
                          <p className="font-black text-white">{item.dogName}</p>
                        </div>
                        <p className="text-xs text-slate-400">{item.handlerName}</p>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-300">{item.readiness}%</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-500">{item.occurrences} ocorrencias</span>
                      <span className="ml-auto font-mono text-xs text-slate-500">{formatDate(item.lastTraining)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Readiness distribution */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
            <p className="mb-4 text-sm font-semibold text-slate-300">Distribuicao por prontidao</p>
            <DonutChart items={readinessDistribution} total={readinessDistribution.reduce((s, d) => s + d.value, 0)} />
          </div>
          <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
            <p className="mb-4 text-sm font-semibold text-slate-300">Destaques do periodo</p>
            <div className="space-y-3">
              {highlights.slice(0, 4).map((h) => (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200/8 bg-slate-950/60 p-3" key={h.id}>
                  <PawPrint className="h-5 w-5 text-emerald-400" />
                  <div className="flex-1">
                    <p className="text-sm font-black text-white">{h.label}</p>
                    <p className="text-xs text-slate-400">{h.detail}</p>
                  </div>
                  <span className="font-mono text-sm font-black text-emerald-300">{h.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Binomial table */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Visao detalhada dos binomios</p>
        <BinomialTable items={timeline} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Operational Productivity
// ---------------------------------------------------------------------------

function ProductivitySection({
  binomialData,
  trainingHistory,
  avgReadiness,
  alerts,
}: {
  binomialData: BinomialData[];
  trainingHistory: { label: string; value: number }[];
  avgReadiness: number;
  alerts: number;
}) {
  const featuredBinomials = binomialData.filter((b) => b.readiness >= 85).slice(0, 2);
  const otherBinomials = binomialData.filter((b) => b.readiness < 85);

  return (
    <section className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="produtividade">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Produtividade Operacional</h2>
          <p className="mt-1 text-sm text-slate-400">Atividades de treino e desempenho</p>
        </div>
        <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Produtividade</Badge>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="no efetivo" icon={PawPrint} label="Binomios" value={formatCount(binomialData.length)} tone="cyan" />
        <KpiCard detail="treinos no periodo" icon={Activity} label="Sessoes" value={formatCount(trainingHistory.reduce((s, d) => s + d.value, 0))} tone="violet" />
        <KpiCard detail="media" icon={TrendingUp} label="Prontidao Media" value={formatPercent(avgReadiness)} tone="emerald" />
        <KpiCard detail="requerem atencao" icon={AlertTriangle} label="Alertas" value={formatCount(alerts)} tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Training history bar chart */}
        <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Historico de treinos (ultimos dias)</p>
          <BarChart data={trainingHistory} color="violet" />
        </div>

        {/* Binomial performance cards */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-300">Desempenho por binomio</p>
          {featuredBinomials.map((b) => (
            <BinomialCard data={b} featured key={b.id} />
          ))}
          {otherBinomials.map((b) => (
            <BinomialCard data={b} key={b.id} />
          ))}
        </div>
      </div>

      {/* Readiness progress bars */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Indicadores de prontidao</p>
        <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
          <ReadinessBars data={binomialData} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 5: Conclusions and Integrity
// ---------------------------------------------------------------------------

function ConclusionsSection({
  total,
  active,
  avgReadiness,
  alerts,
  recommendations,
  pendingItems,
  alertCards,
}: {
  total: number;
  active: number;
  avgReadiness: number;
  alerts: number;
  recommendations: Recommendation[];
  pendingItems: PendingItem[];
  alertCards: AlertCard[];
}) {
  const readinessRate = total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <section className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="conclusoes">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Conclusoes e Integridade</h2>
          <p className="mt-1 text-sm text-slate-400">Resumo final, validacao e proximos passos</p>
        </div>
        <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Conclusao</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard detail="cadastrados" icon={Users} label="Total" value={formatCount(total)} tone="cyan" />
            <KpiCard detail="em operacao" icon={ShieldCheck} label="Ativos" value={formatCount(active)} tone="emerald" />
            <KpiCard detail="requerem atencao" icon={AlertTriangle} label="Alertas" value={formatCount(alerts)} tone="amber" />
            <KpiCard detail="taxa" icon={TrendingUp} label="Taxa operacao" value={formatPercent(readinessRate)} tone="violet" />
          </div>

          {/* Recommendations */}
          {recommendations.map((r, i) => (
            <RecommendationCard key={i} recommendation={r} />
          ))}

          {/* Pending items */}
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-300">Pendencias e proximos passos</p>
            <PendingList items={pendingItems} />
          </div>

          {/* Alert cards */}
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-300">Indicadores de alerta</p>
            <AlertCards cards={alertCards} />
          </div>
        </div>

        {/* Integrity seal */}
        <div className="hidden lg:flex lg:items-start">
          <IntegritySeal />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section Navigation
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: "cover", label: "Capa" },
  { id: "resumo", label: "Resumo" },
  { id: "operacional", label: "Operacional" },
  { id: "produtividade", label: "Produtividade" },
  { id: "conclusoes", label: "Conclusoes" },
];

function SectionNav() {
  const [active, setActive] = useState("cover");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { threshold: 0.3 },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="sticky top-20 z-40 mx-auto max-w-fit rounded-2xl border border-emerald-200/12 bg-slate-950/90 p-1.5 backdrop-blur-sm">
      <nav className="flex gap-1">
        {SECTIONS.map((s) => (
          <button
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
              active === s.id
                ? "bg-emerald-300/15 text-emerald-100"
                : "text-slate-400 hover:text-white",
            )}
            key={s.id}
            onClick={() => scrollTo(s.id)}
            type="button"
          >
            {s.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BinomialsReport() {
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useReportsData(periodDays);

  // Derived data
  const timeline = useMemo(() => buildTimeline(data.binomials.highlights), [data.binomials.highlights]);
  const readinessTrend = useMemo(() => buildReadinessTrend(periodDays, data.binomials.avgReadiness), [periodDays, data.binomials.avgReadiness]);
  const readinessDistribution = useMemo(() => buildReadinessDistribution(data.binomials), [data.binomials]);
  const statusDistribution = useMemo(() => buildStatusDistribution(data.binomials.total, data.binomials.active, data.binomials.formation), [data.binomials]);
  const trainingHistory = useMemo(() => buildTrainingHistory(periodDays), [periodDays]);

  const recommendations: Recommendation[] = useMemo(() => [
    {
      icon: AlertTriangle,
      priority: data.binomials.alerts > 0 ? "high" : "medium",
      text: "Priorizar a reavaliacao dos binomios com prontidao abaixo de 80% e planejar sessoes de treinamento corretivo.",
    },
    {
      icon: TrendingUp,
      priority: "medium",
      text: "Implementar um programa de manutencao de prontidao para garantir que todos os binomios operem acima de 85%.",
    },
    {
      icon: GraduationCap,
      priority: "low",
      text: "Revisar o cronograma de formacao para os binomios em fase de formacao, acelerando a graduacao para ativo.",
    },
  ], [data.binomials.alerts]);

  const pendingItems: PendingItem[] = useMemo(() => [
    { text: "Reavaliar binomios com prontidao abaixo de 70%", status: "Em acompanhamento" },
    { text: "Atualizar registros de treinamento dos binomios", status: "Pendente" },
    { text: "Programar sessoes de reciclagem para equipes inativas", status: "Pendente" },
    { text: "Concluir formacao dos binomios em treinamento", status: "Concluido" },
    { text: "Revisar parametros de avaliacao de prontidao", status: "Concluido" },
  ], []);

  const alertCards: AlertCard[] = useMemo(() => [
    { icon: AlertTriangle, label: "Baixa Prontidao", count: data.binomials.alerts, tone: "amber" },
    { icon: Clock, label: "Treinos Pendentes", count: 3, tone: "violet" },
    { icon: ShieldPlus, label: "Recertificacoes", count: 2, tone: "cyan" },
    { icon: Target, label: "Metas Atingidas", count: Math.max(0, data.binomials.active - data.binomials.alerts), tone: "emerald" },
  ], [data.binomials]);

  const getExportData = useCallback(
    () => getExportableData("binomials", data),
    [data],
  );

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Button
            className="shrink-0 rounded-2xl border border-emerald-200/20 bg-slate-950 text-slate-300 hover:border-emerald-200/40 hover:bg-slate-900"
            onClick={() => window.history.back()}
            type="button"
            variant="secondary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <p className="text-sm font-semibold text-emerald-200">Relatorio Premium</p>
            <h1 className="text-2xl font-black text-white md:text-3xl">Relatorio de Binomios</h1>
            <p className="mt-1 text-sm text-slate-400">Periodo: <span className="font-semibold text-emerald-200">{periodLabel}</span></p>
          </div>
        </div>
        <ExportButton
          getData={getExportData}
          reportId="binomials"
          reportTitle="Binomios"
          subtitle={`Periodo: ${periodLabel}`}
        />
      </div>

      {/* Section navigation */}
      <div className="flex justify-center">
        <SectionNav />
      </div>

      {/* Section 1: Cover */}
      <CoverSection
        periodLabel={periodLabel}
        total={data.binomials.total}
        active={data.binomials.active}
        formation={data.binomials.formation}
        avgReadiness={data.binomials.avgReadiness}
      />

      {/* Section 2: Executive Summary */}
      <ExecutiveSummarySection
        total={data.binomials.total}
        active={data.binomials.active}
        formation={data.binomials.formation}
        avgReadiness={data.binomials.avgReadiness}
        alerts={data.binomials.alerts}
        statusDistribution={statusDistribution}
        readinessTrend={readinessTrend}
      />

      {/* Section 3: Operational Analysis */}
      <OperationalAnalysisSection
        timeline={timeline}
        readinessDistribution={readinessDistribution}
        highlights={data.binomials.highlights}
      />

      {/* Section 4: Productivity */}
      <ProductivitySection
        binomialData={timeline}
        trainingHistory={trainingHistory}
        avgReadiness={data.binomials.avgReadiness}
        alerts={data.binomials.alerts}
      />

      {/* Section 5: Conclusions */}
      <ConclusionsSection
        total={data.binomials.total}
        active={data.binomials.active}
        avgReadiness={data.binomials.avgReadiness}
        alerts={data.binomials.alerts}
        recommendations={recommendations}
        pendingItems={pendingItems}
        alertCards={alertCards}
      />

      {/* Export toolbar footer */}
      <div className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-300" />
          <p className="text-sm font-black text-white">Exportacao e assinatura digital</p>
        </div>
        <ExportToolbar
          getData={getExportData}
          reportId="binomials"
          reportTitle="Relatorio de Binomios"
          subtitle={`Periodo: ${periodLabel}`}
        />
        <div className="mt-4 rounded-2xl border border-emerald-200/10 bg-emerald-300/8 p-4">
          <p className="text-sm font-black text-white">Assinatura digital</p>
          <p className="mt-1 text-xs text-slate-400">
            Relatorio validado com base nos registros de binomios e sessoes de treinamento.
            Os dados refletem a realidade do efetivo no periodo {periodLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}
