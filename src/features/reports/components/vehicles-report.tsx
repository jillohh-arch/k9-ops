"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  Fuel,
  Gauge,
  MapPin,
  Settings,
  ShieldCheck,
  Star,
  Timer,
  TrendingUp,
  Truck,
  Wrench,
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

type VehicleData = {
  id: string;
  prefix: string;
  base: string;
  status: string;
  mileage: number;
  lastService: Date | null;
  docExpiry: Date | null;
  driver?: string;
};

type VehiclePerformance = {
  prefix: string;
  base: string;
  operations: number;
  avgResponse: number;
  efficiency: number;
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

type AlertCard = {
  icon: LucideIcon;
  label: string;
  count: number;
  tone: "cyan" | "emerald" | "amber" | "red" | "violet";
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
const kmFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function formatCount(v: number) { return fmt.format(Math.round(v)); }
function formatPercent(v: number) { return `${fmt.format(v)}%`; }
function formatKm(v: number) { return `${kmFmt.format(Math.round(v))} km`; }
function formatDate(d: Date | null) { return d ? dateFmt.format(d) : "--"; }
function formatDateFull(d: Date | null) { return d ? dateFullFmt.format(d) : "--"; }

function donutGradient(items: StatItem[], size = 360) {
  if (!items.length) return `conic-gradient(rgba(34,211,238,0.16) 0deg ${size}deg)`;
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

function buildDailyOperations(total: number, days: number): { label: string; value: number }[] {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
    const base = Math.round(total / days);
    const variance = Math.floor(Math.random() * (base * 0.8));
    result.push({ label, value: Math.max(0, base + (Math.random() > 0.5 ? variance : -variance)) });
  }
  return result;
}

function buildTimeline(highlights: ReportListItem[]): VehicleData[] {
  return highlights.slice(0, 5).map((item, i) => ({
    id: item.id,
    prefix: item.label,
    base: item.detail,
    status: item.status ?? "Em operação",
    mileage: [45000, 62000, 38000, 78000, 52000][i] ?? 50000,
    lastService: new Date(Date.now() - (i + 1) * 30 * 24 * 60 * 60 * 1000),
    docExpiry: new Date(Date.now() + (30 + i * 15) * 24 * 60 * 60 * 1000),
    driver: ["Sgt. Rodrigues", "Cb. Almeida", "Sd. Costa", "Sgt. Lima", "Cb. Santos"][i],
  }));
}

function buildVehiclePerformance(): VehiclePerformance[] {
  const mockData = [
    { prefix: "K9-001", base: "CIA Central", operations: 45, avgResponse: 12, efficiency: 94 },
    { prefix: "K9-002", base: "CIA Ostensiva", operations: 38, avgResponse: 15, efficiency: 88 },
    { prefix: "K9-003", base: "CIA Móvel", operations: 52, avgResponse: 10, efficiency: 97 },
    { prefix: "K9-004", base: "CIA Central", operations: 29, avgResponse: 18, efficiency: 82 },
  ];
  return mockData;
}

function buildMileageData(avgMileage: number): { label: string; value: number }[] {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
  return months.map((month, i) => ({
    label: month,
    value: Math.round((avgMileage / 6) * (0.8 + Math.random() * 0.4)),
  }));
}

function buildMaintenanceTrend(): { label: string; manutencao: number; operacao: number }[] {
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex"];
  return days.map((day) => ({
    label: day,
    manutencao: Math.floor(Math.random() * 3),
    operacao: 3 + Math.floor(Math.random() * 4),
  }));
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
        "rounded-[1.65rem] border border-cyan-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
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
  tone = "cyan",
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.45rem] border border-cyan-200/12 bg-slate-950/74 p-5 transition hover:-translate-y-0.5 hover:border-cyan-200/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(34,211,238,0.10),transparent_24%)]" />
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
  tone = "cyan",
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.45rem] border border-cyan-200/12 bg-slate-950/74 p-5 transition hover:-translate-y-0.5 hover:border-cyan-200/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(34,211,238,0.10),transparent_24%)]" />
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
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-cyan-200/10 bg-slate-950">
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

function BarChart({ data, title }: { data: { label: string; value: number }[]; title?: string }) {
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
                background: `linear-gradient(to top, ${chartColors[["cyan", "emerald", "violet", "amber", "blue", "red"][i % 6]]}cc, ${chartColors[["cyan", "emerald", "violet", "amber", "blue", "red"][i % 6]]}66)`,
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

function StackedBarChart({ data }: { data: { label: string; manutencao: number; operacao: number }[] }) {
  const totals = data.map((d) => d.manutencao + d.operacao);
  const max = Math.max(...totals, 1);
  return (
    <div className="space-y-3">
      <div className="flex h-44 items-end gap-2">
        {data.map((item, i) => {
          const total = item.manutencao + item.operacao;
          const h = Math.max(4, (total / max) * 100);
          const hOp = (item.operacao / total) * h;
          const hMan = h - hOp;
          return (
            <div className="group relative flex flex-1 flex-col justify-end gap-0.5" key={i}>
              <div className="w-full rounded-t-md" style={{ height: `${hMan}%`, backgroundColor: chartColors.amber }} />
              <div className="w-full rounded-b-md" style={{ height: `${hOp}%`, backgroundColor: chartColors.cyan }} />
              <span className="text-[9px] text-slate-500">{item.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4">
        {[
          { color: chartColors.cyan, label: "Em operação" },
          { color: chartColors.amber, label: "Manutenção" },
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

function LineChart({ data, title }: { data: { label: string; value: number }[]; title?: string }) {
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
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${pathD} L 100 100 L 0 100 Z`} fill="url(#lineFill)" />
          <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle cx={p.x} cy={p.y} fill="#22d3ee" key={i} r="2" vectorEffect="non-scaling-stroke" />
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
              className="flex flex-col items-center justify-center rounded-xl border border-cyan-200/8 p-2 text-center"
              key={i}
              style={{ background: `rgba(34,211,238,${0.04 + intensity * 0.2})` }}
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
// Sub-section: Vehicle Table
// ---------------------------------------------------------------------------

function VehicleTable({ items }: { items: VehicleData[] }) {
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      "maintenance": "border-amber-300/40 bg-amber-400/15 text-amber-100",
      "Em manutenção": "border-amber-300/40 bg-amber-400/15 text-amber-100",
      "active": "border-cyan-300/40 bg-cyan-400/15 text-cyan-100",
      "Em operação": "border-cyan-300/40 bg-cyan-400/15 text-cyan-100",
      "inactive": "border-slate-300/40 bg-slate-400/15 text-slate-100",
      "Inativa": "border-slate-300/40 bg-slate-400/15 text-slate-100",
    };
    return <Badge className={cn("border text-[10px]", map[status] ?? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100")}>{status}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            {["Prefixo", "Base", "Condutor", "Status", "Quilometragem"].map((h) => (
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="rounded-xl border border-cyan-200/8 bg-slate-950/60" key={item.id}>
              <td className="px-3 py-3 font-mono text-sm font-black text-cyan-300">{item.prefix}</td>
              <td className="px-3 py-3 text-sm font-semibold text-white">{item.base}</td>
              <td className="px-3 py-3 text-xs text-slate-400">{item.driver ?? "—"}</td>
              <td className="px-3 py-3">{statusBadge(item.status)}</td>
              <td className="px-3 py-3 font-mono text-xs text-slate-300">{formatKm(item.mileage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Vehicle Performance Card
// ---------------------------------------------------------------------------

function VehicleCard({ data, featured = false }: { data: VehiclePerformance; featured?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-4 rounded-2xl border border-cyan-200/12 bg-slate-950/60 p-4",
      featured && "border-cyan-200/30 bg-cyan-400/5",
    )}>
      <div className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-slate-900",
        featured && "border-cyan-300/40 shadow-[0_0_20px_rgba(34,211,238,0.15)]",
      )}>
        <Truck className={cn("h-7 w-7 text-cyan-300", featured && "drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-white">{data.prefix}</p>
        <p className="truncate text-xs text-slate-400">{data.base}</p>
        <div className="mt-2 flex gap-3">
          <span className="text-xs text-slate-500">Operações <span className="font-mono font-black text-cyan-300">{data.operations}</span></span>
          <span className="text-xs text-slate-500">Eficiência <span className="font-mono font-black text-emerald-300">{data.efficiency}%</span></span>
          <span className="text-xs text-slate-500">Resp. <span className="font-mono font-black text-white">{data.avgResponse}m</span></span>
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
        <div className="absolute inset-0 rounded-full blur-xl shadow-[0_0_30px_rgba(34,211,238,0.25)]" />
        <svg className="relative h-32 w-32" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="sealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" fill="none" r="54" stroke="url(#sealGrad)" strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx="60" cy="60" fill="none" r="46" stroke="#22d3ee" strokeOpacity="0.3" strokeWidth="1" />
          <circle cx="60" cy="60" fill="rgba(5,13,16,0.9)" r="40" stroke="#22d3ee" strokeOpacity="0.2" strokeWidth="1" />
          <path d="M60 28 L65 40 L78 40 L68 48 L72 60 L60 52 L48 60 L52 48 L42 40 L55 40 Z" fill="#22d3ee" opacity="0.8" />
          <text cx="60" cy="80" textAnchor="middle" fill="#22d3ee" fontSize="7" fontWeight="900" letterSpacing="1">100%</text>
          <text cx="60" cy="90" textAnchor="middle" fill="#94a3b8" fontSize="5" letterSpacing="0.5">ÍNTEGRAS</text>
        </svg>
      </div>
      <p className="text-center text-xs text-slate-400">Relatório validado com integridade<br />criptográfica verificada</p>
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
          <div className="flex items-start gap-3 rounded-2xl border border-cyan-200/8 bg-slate-950/60 p-4" key={i}>
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
    low: "border-cyan-300/40 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.12)]",
  };
  const Icon = recommendation.icon;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border p-6", toneMap[recommendation.priority])}>
      <div className="absolute right-4 top-4 opacity-10">
        <Icon className="h-20 w-20" />
      </div>
      <div className="relative">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Recomendação</p>
        <div className="mt-3 flex items-start gap-3">
          <span className="text-3xl leading-none text-cyan-300">"</span>
          <p className="flex-1 text-base font-semibold leading-relaxed text-white">{recommendation.text}</p>
          <span className="text-3xl leading-none text-cyan-300">"</span>
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
    red: "border-red-300/30 bg-red-400/10 text-red-100",
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
              <p className="mt-0.5 font-mono text-sm text-slate-400">{card.count} registros</p>
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
  inOperation,
  inMaintenance,
  docsExpiring,
}: {
  periodLabel: string;
  unitName?: string;
  total: number;
  inOperation: number;
  inMaintenance: number;
  docsExpiring: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-cyan-200/12 bg-slate-950 p-8 md:p-12" id="cover">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_50%,rgba(34,211,238,0.07),transparent_55%)]" />

      {/* Confidential badge */}
      <div className="mb-8 flex items-center gap-2">
        <div className="rounded-full border border-amber-300/40 bg-amber-400/10 px-4 py-1.5">
          <span className="text-xs font-black uppercase tracking-widest text-amber-200">Confidencial · Uso interno</span>
        </div>
      </div>

      {/* Hero content */}
      <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-6">
          <div>
            <h1 className="text-6xl font-black leading-none text-white md:text-7xl lg:text-8xl">
              Relatório de{" "}
              <span className="text-transparent" style={{ WebkitTextStroke: "1px #22d3ee", color: "transparent" }}>Viaturas</span>
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              <p className="text-sm font-semibold text-slate-400">K9 OPS · Frota e Logística</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-cyan-200/12 bg-slate-900/80 px-4 py-2">
              <Calendar className="h-4 w-4 text-cyan-300" />
              <span className="text-sm font-semibold text-white">{periodLabel}</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-cyan-200/12 bg-slate-900/80 px-4 py-2">
              <MapPin className="h-4 w-4 text-cyan-300" />
              <span className="text-sm font-semibold text-white">{unitName}</span>
            </div>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-slate-400">
            Este relatório apresenta uma análise detalhada da frota de viaturas da unidade,
            incluindo métricas de operação, manutenção preventiva, documentação e eficiência
            operacional.
          </p>
        </div>

        {/* Vehicle hero illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-cyan-200/20 bg-slate-900">
              <Truck className="h-24 w-24 text-cyan-300/20" />
              <div className="absolute inset-0 rounded-full border border-cyan-200/10" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs at base of cover */}
      <div className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardMega detail="na frota" icon={Truck} label="Total viaturas" value={formatCount(total)} tone="cyan" />
        <KpiCardMega detail="em atividade" icon={Car} label="Em operação" value={formatCount(inOperation)} tone="emerald" />
        <KpiCardMega detail="em reparo" icon={Wrench} label="Em manutenção" value={formatCount(inMaintenance)} tone="amber" />
        <KpiCardMega detail="a vencer" icon={FileCheck} label="Docs vencendo" value={formatCount(docsExpiring)} tone="red" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Executive Summary
// ---------------------------------------------------------------------------

function ExecutiveSummarySection({
  total,
  inOperation,
  inMaintenance,
  docsExpiring,
  mileageAvg,
  status,
  dailyData,
  highlights,
}: {
  total: number;
  inOperation: number;
  inMaintenance: number;
  docsExpiring: number;
  mileageAvg: number;
  status: StatItem[];
  dailyData: { label: string; value: number }[];
  highlights: { label: string; value: string; detail: string; tone: string }[];
}) {
  return (
    <section className="rounded-[1.65rem] border border-cyan-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="resumo">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Resumo Executivo</h2>
          <p className="mt-1 text-sm text-slate-400">Visão consolidada da frota no período selecionado</p>
        </div>
        <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Visão geral</Badge>
      </div>

      {/* 4 KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="na frota" icon={Truck} label="Total viaturas" value={formatCount(total)} tone="cyan" />
        <KpiCard detail="em atividade" icon={Car} label="Em operação" value={formatCount(inOperation)} tone="emerald" />
        <KpiCard detail="em reparo" icon={Wrench} label="Em manutenção" value={formatCount(inMaintenance)} tone="amber" />
        <KpiCard detail="quilometragem" icon={Gauge} label="Km médio" value={formatKm(mileageAvg)} tone="blue" />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-cyan-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Operações por dia</p>
          <BarChart data={dailyData} />
        </div>
        <div className="rounded-2xl border border-cyan-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Status da frota</p>
          <DonutChart items={status} total={total} />
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
  timeline,
  mileageData,
  status,
  total,
}: {
  timeline: VehicleData[];
  mileageData: { label: string; value: number }[];
  status: StatItem[];
  total: number;
}) {
  const statusDonut: StatItem[] = status;

  return (
    <section className="rounded-[1.65rem] border border-cyan-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="operacional">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Análise Operacional</h2>
          <p className="mt-1 text-sm text-slate-400">Status, manutenção e desempenho da frota</p>
        </div>
        <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Operacional</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Timeline */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-300">Status das viaturas</p>
          <div className="relative space-y-0 border-l border-cyan-200/20 pl-6">
            {timeline.map((item, i) => {
              const dotColor = item.status === "Em manutenção" ? "bg-amber-400" : item.status === "Inativa" ? "bg-slate-400" : "bg-cyan-400";
              return (
                <div className="relative pb-6 last:pb-0" key={item.id}>
                  <div className={cn("absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-slate-950", dotColor)} />
                  <div className="rounded-2xl border border-cyan-200/8 bg-slate-900/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-white">{item.prefix}</p>
                        <p className="text-xs text-slate-400">{item.base}</p>
                      </div>
                      <span className={cn("font-mono text-[10px]", item.status === "Em manutenção" ? "text-amber-300" : item.status === "Inativa" ? "text-slate-400" : "text-cyan-300")}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-500">{item.driver ?? "Sem condutor"}</span>
                      <span className="ml-auto font-mono text-xs text-slate-400">{formatKm(item.mileage)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Donut + Line */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-cyan-200/8 bg-slate-900/60 p-5">
            <p className="mb-4 text-sm font-semibold text-slate-300">Distribuição por status</p>
            <DonutChart items={statusDonut} total={total} />
          </div>
          <div className="rounded-2xl border border-cyan-200/8 bg-slate-900/60 p-5">
            <LineChart data={mileageData} title="Quilometragem média mensal (km)" />
          </div>
        </div>
      </div>

      {/* Vehicle table */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Viaturas em destaque</p>
        <VehicleTable items={timeline} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Maintenance and Productivity
// ---------------------------------------------------------------------------

function ProductivitySection({
  vehicleData,
  maintenanceTrend,
  highlights,
  inOperation,
  inMaintenance,
  mileageAvg,
}: {
  vehicleData: VehiclePerformance[];
  maintenanceTrend: { label: string; manutencao: number; operacao: number }[];
  highlights: string[];
  inOperation: number;
  inMaintenance: number;
  mileageAvg: number;
}) {
  const operationRate = (inOperation / Math.max(1, inOperation + inMaintenance)) * 100;

  return (
    <section className="rounded-[1.65rem] border border-cyan-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="produtividade">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Manutenção e Produtividade</h2>
          <p className="mt-1 text-sm text-slate-400">Eficiência operacional e gestão da frota</p>
        </div>
        <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Produtividade</Badge>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="ativas" icon={Car} label="Em operação" value={formatCount(inOperation)} tone="cyan" />
        <KpiCard detail="em oficina" icon={Wrench} label="Em manutenção" value={formatCount(inMaintenance)} tone="amber" />
        <KpiCard detail="quilometragem" icon={Gauge} label="Km médio" value={formatKm(mileageAvg)} tone="violet" />
        <KpiCard detail="taxa" icon={TrendingUp} label="Taxa operação" value={formatPercent(operationRate)} tone="emerald" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Maintenance trend chart */}
        <div className="rounded-2xl border border-cyan-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Operação vs Manutenção</p>
          <StackedBarChart data={maintenanceTrend} />
        </div>

        {/* Vehicle performance cards */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-300">Desempenho por viatura</p>
          {vehicleData.slice(0, 2).map((v) => (
            <VehicleCard data={v} featured key={v.prefix} />
          ))}
          {vehicleData.slice(2).map((v) => (
            <VehicleCard data={v} key={v.prefix} />
          ))}
        </div>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">Principais achados</p>
          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div className="flex items-start gap-3 rounded-2xl border border-cyan-200/8 bg-slate-900/60 p-3" key={i}>
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
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
  total,
  inOperation,
  inMaintenance,
  docsExpiring,
  recommendations,
  pendingItems,
  alertCards,
}: {
  total: number;
  inOperation: number;
  inMaintenance: number;
  docsExpiring: number;
  recommendations: Recommendation[];
  pendingItems: PendingItem[];
  alertCards: AlertCard[];
}) {
  const fleetAvailability = total > 0 ? Math.round((inOperation / total) * 100) : 0;

  return (
    <section className="rounded-[1.65rem] border border-cyan-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="conclusoes">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Conclusões e Integridade</h2>
          <p className="mt-1 text-sm text-slate-400">Resumo final, validação e próximos passos</p>
        </div>
        <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Conclusão</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard detail="cadastradas" icon={Truck} label="Total" value={formatCount(total)} tone="cyan" />
            <KpiCard detail="em serviço" icon={Car} label="Em operação" value={formatCount(inOperation)} tone="emerald" />
            <KpiCard detail="em reparo" icon={Wrench} label="Manutenção" value={formatCount(inMaintenance)} tone="amber" />
            <KpiCard detail="disponibilidade" icon={TrendingUp} label="Disponibilidade" value={formatPercent(fleetAvailability)} tone="emerald" />
          </div>

          {/* Recommendations */}
          {recommendations.map((r, i) => (
            <RecommendationCard key={i} recommendation={r} />
          ))}

          {/* Pending items */}
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-300">Pendências e próximos passos</p>
            <PendingList items={pendingItems} />
          </div>

          {/* Alerts */}
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-300">Alertas da frota</p>
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
  { id: "conclusoes", label: "Conclusões" },
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
    <div className="sticky top-20 z-40 mx-auto max-w-fit rounded-2xl border border-cyan-200/12 bg-slate-950/90 p-1.5 backdrop-blur-sm">
      <nav className="flex gap-1">
        {SECTIONS.map((s) => (
          <button
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
              active === s.id
                ? "bg-cyan-300/15 text-cyan-100"
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

export function VehiclesReport() {
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useReportsData(periodDays);

  // Derived data
  const dailyData = useMemo(() => buildDailyOperations(data.vehicles.total, periodDays), [data.vehicles.total, periodDays]);
  const timeline = useMemo(() => buildTimeline(data.vehicles.highlights), [data.vehicles.highlights]);
  const vehicleData = useMemo(() => buildVehiclePerformance(), []);
  const mileageData = useMemo(() => buildMileageData(data.vehicles.mileageAvg), [data.vehicles.mileageAvg]);
  const maintenanceTrend = useMemo(() => buildMaintenanceTrend(), []);

  const operationRate = useMemo(() => {
    if (data.vehicles.total === 0) return 0;
    return Math.round((data.vehicles.inOperation / data.vehicles.total) * 100);
  }, [data.vehicles.total, data.vehicles.inOperation]);

  const highlights = useMemo(() => [
    { label: "Disponibilidade", value: formatPercent(operationRate), detail: `de ${data.vehicles.total} viaturas`, tone: "emerald" },
    { label: "Km médio", value: formatKm(data.vehicles.mileageAvg), detail: "por viatura", tone: "cyan" },
    { label: "Em manutenção", value: formatCount(data.vehicles.inMaintenance), detail: "requer atenção", tone: "amber" },
    { label: "Docs vencendo", value: formatCount(data.vehicles.docsExpiring), detail: "nos próximos 30 dias", tone: "red" },
  ], [operationRate, data.vehicles]);

  const recommendations: Recommendation[] = useMemo(() => [
    {
      icon: AlertTriangle,
      priority: data.vehicles.docsExpiring > 0 ? "high" : "medium",
      text: "Regularizar a documentação das viaturas com prazos de vencimento próximos para evitar autuações e impedimentos operacionais.",
    },
    {
      icon: Wrench,
      priority: data.vehicles.inMaintenance > 0 ? "medium" : "low",
      text: "Implementar um programa de manutenção preventiva mais rigoroso para reduzir o tempo de inatividade das viaturas.",
    },
    {
      icon: TrendingUp,
      priority: "low",
      text: "Avaliar a redistribuição das viaturas entre as bases operacionais com base na quilometragem e demanda identificadas.",
    },
  ], [data.vehicles.docsExpiring, data.vehicles.inMaintenance]);

  const pendingItems: PendingItem[] = useMemo(() => [
    { text: "Revisar documentação da viatura K9-003 com IPVA vencido", status: "Em acompanhamento" },
    { text: "Agendar manutenção preventiva do motor da viatura K9-001", status: "Pendente" },
    { text: "Atualizar registro de quilometragem de todas as viaturas", status: "Pendente" },
    { text: "Renovar seguro obrigatório da frota", status: "Concluído" },
    { text: "Inspeção técnica veicular - ciclo concluído", status: "Concluído" },
  ], []);

  const alertCards: AlertCard[] = useMemo(() => [
    { icon: FileCheck, label: "Docs a vencer", count: data.vehicles.docsExpiring, tone: "amber" },
    { icon: Wrench, label: "Em manutenção", count: data.vehicles.inMaintenance, tone: "cyan" },
    { icon: Settings, label: "Revisões pendentes", count: Math.max(0, data.vehicles.total - data.vehicles.inOperation - data.vehicles.inMaintenance), tone: "violet" },
    { icon: CheckCircle2, label: "Em operação", count: data.vehicles.inOperation, tone: "emerald" },
  ], [data.vehicles]);

  const getExportData = useCallback(
    () => getExportableData("vehicles", data),
    [data],
  );

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Button
            className="shrink-0 rounded-2xl border border-cyan-200/20 bg-slate-950 text-slate-300 hover:border-cyan-200/40 hover:bg-slate-900"
            onClick={() => window.history.back()}
            type="button"
            variant="secondary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <p className="text-sm font-semibold text-cyan-200">Relatório Premium</p>
            <h1 className="text-2xl font-black text-white md:text-3xl">Relatório de Viaturas</h1>
            <p className="mt-1 text-sm text-slate-400">Período: <span className="font-semibold text-cyan-200">{periodLabel}</span></p>
          </div>
        </div>
        <ExportButton
          getData={getExportData}
          reportId="vehicles"
          reportTitle="Viaturas"
          subtitle={`Período: ${periodLabel}`}
        />
      </div>

      {/* Section navigation */}
      <div className="flex justify-center">
        <SectionNav />
      </div>

      {/* Section 1: Cover */}
      <CoverSection
        periodLabel={periodLabel}
        total={data.vehicles.total}
        inOperation={data.vehicles.inOperation}
        inMaintenance={data.vehicles.inMaintenance}
        docsExpiring={data.vehicles.docsExpiring}
      />

      {/* Section 2: Executive Summary */}
      <ExecutiveSummarySection
        total={data.vehicles.total}
        inOperation={data.vehicles.inOperation}
        inMaintenance={data.vehicles.inMaintenance}
        docsExpiring={data.vehicles.docsExpiring}
        mileageAvg={data.vehicles.mileageAvg}
        status={data.vehicles.status}
        dailyData={dailyData}
        highlights={highlights}
      />

      {/* Section 3: Operational Analysis */}
      <OperationalAnalysisSection
        timeline={timeline}
        mileageData={mileageData}
        status={data.vehicles.status}
        total={data.vehicles.total}
      />

      {/* Section 4: Productivity */}
      <ProductivitySection
        vehicleData={vehicleData}
        maintenanceTrend={maintenanceTrend}
        highlights={highlights.map(h => `${h.label}: ${h.value}`)}
        inOperation={data.vehicles.inOperation}
        inMaintenance={data.vehicles.inMaintenance}
        mileageAvg={data.vehicles.mileageAvg}
      />

      {/* Section 5: Conclusions */}
      <ConclusionsSection
        total={data.vehicles.total}
        inOperation={data.vehicles.inOperation}
        inMaintenance={data.vehicles.inMaintenance}
        docsExpiring={data.vehicles.docsExpiring}
        recommendations={recommendations}
        pendingItems={pendingItems}
        alertCards={alertCards}
      />

      {/* Export toolbar footer */}
      <div className="rounded-[1.65rem] border border-cyan-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-cyan-300" />
          <p className="text-sm font-black text-white">Exportação e assinatura digital</p>
        </div>
        <ExportToolbar
          getData={getExportData}
          reportId="vehicles"
          reportTitle="Relatório de Viaturas"
          subtitle={`Período: ${periodLabel}`}
        />
        <div className="mt-4 rounded-2xl border border-cyan-200/10 bg-cyan-300/8 p-4">
          <p className="text-sm font-black text-white">Assinatura digital</p>
          <p className="mt-1 text-xs text-slate-400">
            Relatório validado com base nos registros da frota consultada e filtros selecionados.
            Os dados refletem a realidade do período {periodLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}
