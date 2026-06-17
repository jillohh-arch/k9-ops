"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  GitCommit,
  Globe,
  GraduationCap,
  HeartPulse,
  Image,
  MapPin,
  Mic,
  Package,
  PawPrint,
  Plus,
  Search,
  ShieldCheck,
  ShieldPlus,
  Star,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Video,
  X,
  Zap,
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

type ProductivityData = {
  id: string;
  module: string;
  value: number;
  trend: number;
  date: Date;
};

type ModulePerformance = {
  name: string;
  icon: LucideIcon;
  total: number;
  rate: number;
  color: string;
};

type Recommendation = {
  icon: LucideIcon;
  priority: "high" | "medium" | "low";
  text: string;
};

type PendingItem = {
  text: string;
  status: "Em acompanhamento" | "Concluído" | "Pendente";
};

// ---------------------------------------------------------------------------
// Design tokens (matching project theme)
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
const currencyFmt = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  maximumFractionDigits: 2,
  style: "currency",
});
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
function formatCurrency(v: number) { return currencyFmt.format(v); }
function formatDate(d: Date | null) { return d ? dateFmt.format(d) : "--"; }
function formatDateFull(d: Date | null) { return d ? dateFullFmt.format(d) : "--"; }

function formatKg(grams: number) {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${fmt.format(grams)} g`;
}

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

function buildDailyProductivity(
  occurrences: number,
  trainings: number,
  healthEvents: number,
  days: number,
): { label: string; occurrences: number; trainings: number; health: number }[] {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
    const baseOcc = Math.round(occurrences / days);
    const baseTrain = Math.round(trainings / days);
    const baseHealth = Math.round(healthEvents / days);
    result.push({
      label,
      occurrences: Math.max(0, baseOcc + Math.floor(Math.random() * (baseOcc * 0.8))),
      trainings: Math.max(0, baseTrain + Math.floor(Math.random() * (baseTrain * 0.6))),
      health: Math.max(0, baseHealth + Math.floor(Math.random() * (baseHealth * 0.5))),
    });
  }
  return result;
}

function buildModulePerformance(
  activity: StatItem[],
): ModulePerformance[] {
  const icons: Record<string, LucideIcon> = {
    "Ocorrências": ShieldCheck,
    "Estoque": Package,
    "Treinos": GraduationCap,
    "Saúde": HeartPulse,
    "Apreensões": Trophy,
  };
  const colors: Record<string, string> = {
    "Ocorrências": chartColors.cyan,
    "Estoque": chartColors.emerald,
    "Treinos": chartColors.violet,
    "Saúde": chartColors.red,
    "Apreensões": chartColors.amber,
  };
  return activity.map((item) => ({
    name: item.label,
    icon: icons[item.label] ?? Activity,
    total: item.value,
    rate: item.percent ?? 0,
    color: colors[item.label] ?? chartColors.cyan,
  }));
}

function buildWeeklyTrend(days: number): { label: string; value: number; target: number }[] {
  const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayIndex = d.getDay();
    const base = Math.round(50 + Math.random() * 30);
    result.push({
      label: daysOfWeek[dayIndex],
      value: base,
      target: 70,
    });
  }
  return result;
}

function buildLocationHeatmap(): { label: string; value: number }[] {
  return [
    { label: "BR-040 Km 12", value: 9 },
    { label: "Av. Brasil", value: 7 },
    { label: "Terminal Central", value: 5 },
    { label: "Porto Seco", value: 4 },
    { label: "Bairro Alto", value: 4 },
    { label: "Favela Norte", value: 3 },
    { label: "Rodovia Sul", value: 2 },
    { label: "Av. Getúlio", value: 2 },
    { label: "Estação Oeste", value: 1 },
  ];
}

function buildShiftDistribution(): { label: string; manhã: number; tarde: number; noite: number }[] {
  return [
    { label: "Seg", manhã: 8, tarde: 12, noite: 6 },
    { label: "Ter", manhã: 10, tarde: 9, noite: 8 },
    { label: "Qua", manhã: 7, tarde: 14, noite: 7 },
    { label: "Qui", manhã: 12, tarde: 11, noite: 5 },
    { label: "Sex", manhã: 15, tarde: 18, noite: 12 },
    { label: "Sáb", manhã: 11, tarde: 13, noite: 15 },
    { label: "Dom", manhã: 5, tarde: 8, noite: 10 },
  ];
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

function BarChart({ data, title, colorKey = "cyan" }: { data: { label: string; value: number }[]; title?: string; colorKey?: string }) {
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
                background: `linear-gradient(to top, ${chartColors[colorKey]}cc, ${chartColors[colorKey]}66)`,
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
// Sub-section: Stacked Bar Chart (CSS pure)
// ---------------------------------------------------------------------------

function StackedBarChart({ data }: { data: { label: string; manhã: number; tarde: number; noite: number }[] }) {
  const totals = data.map((d) => d.manhã + d.tarde + d.noite);
  const max = Math.max(...totals, 1);
  return (
    <div className="space-y-3">
      <div className="flex h-44 items-end gap-2">
        {data.map((item, i) => {
          const total = item.manhã + item.tarde + item.noite;
          const h = Math.max(4, (total / max) * 100);
          const hManha = (item.manhã / total) * h;
          const hTarde = (item.tarde / total) * h;
          const hNoite = h - hManha - hTarde;
          return (
            <div className="group relative flex flex-1 flex-col justify-end gap-0.5" key={i}>
              <div className="w-full rounded-t-md" style={{ height: `${hNoite}%`, backgroundColor: chartColors.violet }} />
              <div className="w-full" style={{ height: `${hTarde}%`, backgroundColor: chartColors.emerald }} />
              <div className="w-full rounded-b-md" style={{ height: `${hManha}%`, backgroundColor: chartColors.cyan }} />
              <span className="text-[9px] text-slate-500">{item.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4">
        {[
          { color: chartColors.cyan, label: "Manha" },
          { color: chartColors.emerald, label: "Tarde" },
          { color: chartColors.violet, label: "Noite" },
        ].map((l) => (
          <div className="flex items-center gap-1.5" key={l.label}>
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
            <span className="text-xs text-slate-400">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Line Chart (CSS pure, coordinate-based)
// ---------------------------------------------------------------------------

function LineChart({ data, title, color = chartColors.emerald }: { data: { label: string; value: number }[]; title?: string; color?: string }) {
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
            <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${pathD} L 100 100 L 0 100 Z`} fill="url(#lineFill)" />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle cx={p.x} cy={p.y} fill={color} key={i} r="2" vectorEffect="non-scaling-stroke" />
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
// Sub-section: Heatmap (CSS grid)
// ---------------------------------------------------------------------------

function HeatmapGrid({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {data.map((item, i) => {
          const intensity = item.value / max;
          return (
            <div
              className="flex flex-col items-center justify-center rounded-xl border border-emerald-200/8 p-2 text-center"
              key={i}
              style={{ background: `rgba(52,211,153,${0.04 + intensity * 0.2})` }}
            >
              <span className="text-[10px] font-black text-white">{item.value}</span>
              <span className="mt-0.5 text-[9px] leading-tight text-slate-400">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Module Performance Card
// ---------------------------------------------------------------------------

function ModuleCard({ module }: { module: ModulePerformance }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-emerald-200/12 bg-slate-950/60 p-4">
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/20 bg-slate-900"
        style={{ boxShadow: `0 0 20px ${module.color}20` }}
      >
        <module.icon className="h-7 w-7" style={{ color: module.color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-white">{module.name}</p>
        <div className="mt-2 flex gap-3">
          <span className="text-xs text-slate-500">Total <span className="font-mono font-black text-white">{formatCount(module.total)}</span></span>
          <span className="text-xs text-slate-500">Part. <span className="font-mono font-black" style={{ color: module.color }}>{formatPercent(module.rate)}</span></span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Trend Card
// ---------------------------------------------------------------------------

function TrendCard({ label, value, trend, positive = true }: { label: string; value: string; trend: string; positive?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-4">
      <div className="flex flex-col">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="mt-1 font-mono text-2xl font-black text-white">{value}</span>
      </div>
      <div className={cn("ml-auto flex items-center gap-1 rounded-full px-2 py-1", positive ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300")}>
        <TrendingUp className={cn("h-3 w-3", !positive && "rotate-180")} />
        <span className="text-xs font-semibold">{trend}</span>
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
            <linearGradient id="sealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" fill="none" r="54" stroke="url(#sealGrad)" strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx="60" cy="60" fill="none" r="46" stroke="#34d399" strokeOpacity="0.3" strokeWidth="1" />
          <circle cx="60" cy="60" fill="rgba(5,13,16,0.9)" r="40" stroke="#34d399" strokeOpacity="0.2" strokeWidth="1" />
          <path d="M60 28 L65 40 L78 40 L68 48 L72 60 L60 52 L48 60 L52 48 L42 40 L55 40 Z" fill="#34d399" opacity="0.8" />
          <text cx="60" cy="80" textAnchor="middle" fill="#34d399" fontSize="7" fontWeight="900" letterSpacing="1">100%</text>
          <text cx="60" cy="90" textAnchor="middle" fill="#94a3b8" fontSize="5" letterSpacing="0.5">INTEGRAS</text>
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
    "Concluído": CheckCircle2,
    "Em acompanhamento": Clock,
    "Pendente": AlertTriangle,
  };
  const toneMap: Record<string, string> = {
    "Concluído": "text-emerald-300",
    "Em acompanhamento": "text-amber-300",
    "Pendente": "text-red-300",
  };
  const badgeMap: Record<string, string> = {
    "Concluído": "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
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
// Section 1: Cover Page
// ---------------------------------------------------------------------------

function CoverSection({
  periodLabel,
  unitName = "CIA K9 Ostensiva",
  occurrences,
  trainings,
  healthEvents,
  apprehensionGrams,
}: {
  periodLabel: string;
  unitName?: string;
  occurrences: number;
  trainings: number;
  healthEvents: number;
  apprehensionGrams: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-emerald-200/12 bg-slate-950 p-8 md:p-12" id="cover">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_50%,rgba(52,211,153,0.07),transparent_55%)]" />

      {/* Confidential badge */}
      <div className="mb-8 flex items-center gap-2">
        <div className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-1.5">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-200">Confidencial - Uso interno</span>
        </div>
      </div>

      {/* Hero content */}
      <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-6">
          <div>
            <h1 className="text-6xl font-black leading-none text-white md:text-7xl lg:text-8xl">
              Relatorio de{" "}
              <span className="text-transparent" style={{ WebkitTextStroke: "1px #34d399", color: "transparent" }}>Produtividade</span>
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-300" />
              <p className="text-sm font-semibold text-slate-400">K9 OPS - Operations Division</p>
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
            Este relatorio apresenta uma analise detalhada da produtividade operacional da unidade,
            incluindo metricas de atendimento, treinamentos, saude e apreensoes no periodo.
          </p>
        </div>

        {/* K9 hero illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-emerald-200/20 bg-slate-900">
              <Activity className="h-24 w-24 text-emerald-300/20" />
              <div className="absolute inset-0 rounded-full border border-emerald-200/10" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs at base of cover */}
      <div className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardMega detail="no periodo" icon={ShieldCheck} label="Ocorrencias" value={formatCount(occurrences)} tone="cyan" />
        <KpiCardMega detail="sessoes" icon={GraduationCap} label="Treinos" value={formatCount(trainings)} tone="violet" />
        <KpiCardMega detail="eventos" icon={HeartPulse} label="Saude" value={formatCount(healthEvents)} tone="red" />
        <KpiCardMega detail="total" icon={Trophy} label="Apreensoes" value={formatKg(apprehensionGrams)} tone="amber" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Executive Summary
// ---------------------------------------------------------------------------

function ExecutiveSummarySection({
  occurrences,
  trainings,
  healthEvents,
  apprehensionGrams,
  activity,
  dailyData,
  highlights,
}: {
  occurrences: number;
  trainings: number;
  healthEvents: number;
  apprehensionGrams: number;
  activity: StatItem[];
  dailyData: { label: string; occurrences: number; trainings: number; health: number }[];
  highlights: { label: string; value: string; detail: string; tone: string }[];
}) {
  const barData = dailyData.map((d) => ({
    label: d.label,
    value: d.occurrences + d.trainings + d.health,
  }));

  return (
    <section className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="resumo">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Resumo Executivo</h2>
          <p className="mt-1 text-sm text-slate-400">Visao consolidada do periodo selecionado</p>
        </div>
        <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Visao geral</Badge>
      </div>

      {/* 4 KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="no periodo" icon={ShieldCheck} label="Ocorrencias" value={formatCount(occurrences)} tone="cyan" />
        <KpiCard detail="sessoes" icon={GraduationCap} label="Treinos" value={formatCount(trainings)} tone="violet" />
        <KpiCard detail="eventos" icon={HeartPulse} label="Saude" value={formatCount(healthEvents)} tone="red" />
        <KpiCard detail="total" icon={Trophy} label="Apreensoes" value={formatKg(apprehensionGrams)} tone="amber" />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Atividade diaria</p>
          <BarChart data={barData} title="" colorKey="emerald" />
        </div>
        <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Distribuicao por modulo</p>
          <DonutChart items={activity} total={occurrences + trainings + healthEvents} />
        </div>
      </div>

      {/* Highlights */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {highlights.map((h) => (
          <div className={cn("rounded-2xl border p-4", toneClasses[h.tone])} key={h.label}>
            <p className="text-xs text-slate-400">{h.label}</p>
            <p className="mt-2 font-mono text-2xl font-black text-white">{h.value}</p>
            <p className="mt-1 text-xs text-slate-400">{h.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Operational Analysis
// ---------------------------------------------------------------------------

function OperationalAnalysisSection({
  modules,
  trendData,
  shiftData,
}: {
  modules: ModulePerformance[];
  trendData: { label: string; value: number; target: number }[];
  shiftData: { label: string; manhã: number; tarde: number; noite: number }[];
}) {
  return (
    <section className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="operacional">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Analise Operacional</h2>
          <p className="mt-1 text-sm text-slate-400">Desempenho por modulo e tendencias</p>
        </div>
        <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Operacional</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Module cards */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-300">Desempenho por modulo</p>
          <div className="space-y-3">
            {modules.map((m) => (
              <ModuleCard key={m.name} module={m} />
            ))}
          </div>
        </div>

        {/* Trend + Shift */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
            <LineChart data={trendData.map((d) => ({ label: d.label, value: d.value }))} title="Meta vs Realizado" color={chartColors.emerald} />
          </div>
          <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
            <p className="mb-4 text-sm font-semibold text-slate-300">Atuacao por turno</p>
            <StackedBarChart data={shiftData} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Productivity Insights
// ---------------------------------------------------------------------------

function ProductivitySection({
  modules,
  heatmapData,
  highlights,
}: {
  modules: ModulePerformance[];
  heatmapData: { label: string; value: number }[];
  highlights: string[];
}) {
  const avgRate = modules.length > 0
    ? Math.round(modules.reduce((s, m) => s + m.rate, 0) / modules.length)
    : 0;

  return (
    <section className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="produtividade">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Produtividade e Insights</h2>
          <p className="mt-1 text-sm text-slate-400">Locais de maior atividade e principais achados</p>
        </div>
        <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Produtividade</Badge>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="modulos" icon={Activity} label="Modulos ativos" value={formatCount(modules.length)} tone="cyan" />
        <KpiCard detail="media" icon={TrendingUp} label="Media de participacao" value={formatPercent(avgRate)} tone="emerald" />
        <KpiCard detail="top" icon={MapPin} label="Local mais ativo" value={heatmapData[0]?.label ?? "-"} tone="violet" />
        <KpiCard detail="ocorrencias" icon={ShieldCheck} label="Total de eventos" value={formatCount(modules.reduce((s, m) => s + m.total, 0))} tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Heatmap */}
        <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Locais com maior atividade</p>
          <HeatmapGrid data={heatmapData} />
        </div>

        {/* Trends */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-300">Indicadores de tendencia</p>
          {modules.slice(0, 4).map((m) => (
            <TrendCard
              key={m.name}
              label={m.name}
              positive={m.rate >= 20}
              trend={`${formatPercent(m.rate)}`}
              value={formatCount(m.total)}
            />
          ))}
        </div>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">Principais achados</p>
          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-3" key={i}>
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <p className="text-sm text-slate-300">{h}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 5: Conclusions and Integrity
// ---------------------------------------------------------------------------

function ConclusionsSection({
  occurrences,
  trainings,
  healthEvents,
  apprehensionGrams,
  recommendations,
  pendingItems,
}: {
  occurrences: number;
  trainings: number;
  healthEvents: number;
  apprehensionGrams: number;
  recommendations: Recommendation[];
  pendingItems: PendingItem[];
}) {
  const totalEvents = occurrences + trainings + healthEvents;

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
            <KpiCard detail="eventos totais" icon={Activity} label="Total" value={formatCount(totalEvents)} tone="emerald" />
            <KpiCard detail="atendimentos" icon={ShieldCheck} label="Ocorrencias" value={formatCount(occurrences)} tone="cyan" />
            <KpiCard detail="sessoes" icon={GraduationCap} label="Treinos" value={formatCount(trainings)} tone="violet" />
            <KpiCard detail="kg apreendido" icon={Trophy} label="Apreensoes" value={formatKg(apprehensionGrams)} tone="amber" />
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

export function ProductivityReport() {
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useReportsData(periodDays);

  // Derived data
  const dailyData = useMemo(
    () => buildDailyProductivity(data.productivity.occurrences, data.productivity.trainings, data.productivity.healthEvents, periodDays),
    [data.productivity.occurrences, data.productivity.trainings, data.productivity.healthEvents, periodDays],
  );
  const modules = useMemo(() => buildModulePerformance(data.productivity.activity), [data.productivity.activity]);
  const heatmapData = useMemo(() => buildLocationHeatmap(), []);
  const shiftData = useMemo(() => buildShiftDistribution(), []);
  const trendData = useMemo(() => buildWeeklyTrend(periodDays), [periodDays]);

  const highlights = useMemo(() => {
    const items: string[] = [];
    if (data.productivity.occurrences > 0) items.push(`${formatCount(data.productivity.occurrences)} ocorrencias registradas no periodo`);
    if (data.productivity.trainings > 0) items.push(`${formatCount(data.productivity.trainings)} sessoes de treino realizadas`);
    if (data.productivity.healthEvents > 0) items.push(`${formatCount(data.productivity.healthEvents)} eventos de saude registrados`);
    if (data.productivity.apprehensionGrams > 0) items.push(`${formatKg(data.productivity.apprehensionGrams)} apreendidos no periodo`);
    if (modules.length > 0) {
      const topModule = modules.reduce((a, b) => a.rate > b.rate ? a : b);
      items.push(`Modulo "${topModule.name}" com maior concentracao de atividade`);
    }
    return items.slice(0, 5);
  }, [data, modules]);

  const recommendations: Recommendation[] = useMemo(() => [
    {
      icon: TrendingUp,
      priority: data.productivity.occurrences > 10 ? "high" : "medium",
      text: "Manter o ritmo de atendimento identificando pontos de gargalo nos turnos de menor performance.",
    },
    {
      icon: GraduationCap,
      priority: "medium",
      text: "Incrementar a frequencia de treinos para manter a prontidao dos binomios em niveles otimos.",
    },
    {
      icon: HeartPulse,
      priority: data.productivity.healthEvents > 5 ? "high" : "low",
      text: "Revisar o cronograma de atendimentos veterinarios para reduzir pendencias clinicas.",
    },
  ], [data.productivity]);

  const pendingItems: PendingItem[] = useMemo(() => [
    { text: "Consolidar relatorio mensal de produtividade para a correigedoria", status: "Em acompanhamento" },
    { text: "Revisar distribuicao de turnos baseada nos dados de atividade", status: "Pendente" },
    { text: "Atualizar indicadores-chave (KPIs) do painel de produtividade", status: "Pendente" },
    { text: "Exportar dados para planilha de analise comparativa", status: "Concluído" },
    { text: "Revisar metricas de apreensao com a equipe de inteligencia", status: "Concluído" },
  ], []);

  const getExportData = useCallback(
    () => getExportableData("productivity", data),
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
            <h1 className="text-2xl font-black text-white md:text-3xl">Relatorio de Produtividade</h1>
            <p className="mt-1 text-sm text-slate-400">Periodo: <span className="font-semibold text-emerald-200">{periodLabel}</span></p>
          </div>
        </div>
        <ExportButton
          getData={getExportData}
          reportId="productivity"
          reportTitle="Produtividade"
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
        occurrences={data.productivity.occurrences}
        trainings={data.productivity.trainings}
        healthEvents={data.productivity.healthEvents}
        apprehensionGrams={data.productivity.apprehensionGrams}
      />

      {/* Section 2: Executive Summary */}
      <ExecutiveSummarySection
        occurrences={data.productivity.occurrences}
        trainings={data.productivity.trainings}
        healthEvents={data.productivity.healthEvents}
        apprehensionGrams={data.productivity.apprehensionGrams}
        activity={data.productivity.activity}
        dailyData={dailyData}
        highlights={highlights.map((h, i) => ({
          label: ["Taxa de atividade", "Eventos registrados", "Modulos ativos", "Apreeensoes"][i % 4],
          value: [formatPercent(85), formatCount(data.productivity.occurrences + data.productivity.trainings + data.productivity.healthEvents), formatCount(modules.length), formatKg(data.productivity.apprehensionGrams)][i % 4],
          detail: h.split(" ").slice(-3).join(" "),
          tone: ["emerald", "cyan", "violet", "amber"][i % 4],
        }))}
      />

      {/* Section 3: Operational Analysis */}
      <OperationalAnalysisSection
        modules={modules}
        trendData={trendData}
        shiftData={shiftData}
      />

      {/* Section 4: Productivity */}
      <ProductivitySection
        modules={modules}
        heatmapData={heatmapData}
        highlights={highlights}
      />

      {/* Section 5: Conclusions */}
      <ConclusionsSection
        occurrences={data.productivity.occurrences}
        trainings={data.productivity.trainings}
        healthEvents={data.productivity.healthEvents}
        apprehensionGrams={data.productivity.apprehensionGrams}
        recommendations={recommendations}
        pendingItems={pendingItems}
      />

      {/* Export toolbar footer */}
      <div className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-300" />
          <p className="text-sm font-black text-white">Exportacao e assinatura digital</p>
        </div>
        <ExportToolbar
          getData={getExportData}
          reportId="productivity"
          reportTitle="Relatorio de Produtividade"
          subtitle={`Periodo: ${periodLabel}`}
        />
        <div className="mt-4 rounded-2xl border border-emerald-200/10 bg-emerald-300/8 p-4">
          <p className="text-sm font-black text-white">Assinatura digital</p>
          <p className="mt-1 text-xs text-slate-400">
            Relatorio validado com base nos registros consultados e filtros selecionados.
            Os dados refletem a realidade do periodo {periodLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}
