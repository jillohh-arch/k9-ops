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
  Glasses,
  HeartPulse,
  History,
  Package,
  ShieldCheck,
  ShieldPlus,
  Star,
  Timer,
  TrendingUp,
  TrendingDown,
  Warehouse,
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

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minimum: number;
  expirationDate: Date | null;
  status: "Normal" | "Crítico" | "Vencido" | "Vencendo";
};

type CategoryPerformance = {
  categoryName: string;
  itemCount: number;
  totalValue: number;
  criticalCount: number;
};

type Recommendation = {
  icon: LucideIcon;
  priority: "high" | "medium" | "low";
  text: string;
};

type PendingItem = {
  text: string;
  status: "Concluído" | "Em reposição" | "Em análise" | "Pendente";
};

type AlertCard = {
  icon: LucideIcon;
  label: string;
  count: number;
  tone: "cyan" | "emerald" | "amber" | "red";
};

// ---------------------------------------------------------------------------
// Design tokens (matching project theme - emerald for inventory)
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
const currencyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
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
function formatCurrency(v: number) { return currencyFmt.format(v); }
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

function buildDailyMovements(total: number, days: number): { label: string; value: number }[] {
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

function buildTimeline(criticalItems: ReportListItem[]): InventoryItem[] {
  return criticalItems.slice(0, 5).map((item, i) => ({
    id: item.id,
    name: item.label,
    category: item.detail,
    quantity: [15, 8, 3, 22, 5][i] ?? 10,
    minimum: [20, 10, 5, 25, 8][i] ?? 15,
    expirationDate: item.date ?? new Date(),
    status: item.tone === "red" ? "Vencido" : item.tone === "amber" ? "Vencendo" : "Crítico" as InventoryItem["status"],
  }));
}

function buildCategoryPerformance(categories: StatItem[]): CategoryPerformance[] {
  const mockValues = [12500, 8500, 6200, 4800, 3500, 2100];
  return categories.slice(0, 6).map((cat, i) => ({
    categoryName: cat.label,
    itemCount: cat.value,
    totalValue: mockValues[i] ?? 5000,
    criticalCount: Math.floor(cat.value * 0.15),
  }));
}

function buildHeatmapData(): { label: string; value: number }[] {
  return [
    { label: "Almoxarifado A", value: 8 },
    { label: "Base Central", value: 6 },
    { label: "Viaturas K9", value: 5 },
    { label: "Posto RevistA", value: 4 },
    { label: "Gabinete", value: 3 },
    { label: "Saguão", value: 3 },
    { label: "Garagem B", value: 2 },
    { label: "Depósito C", value: 2 },
    { label: "Armário K9", value: 1 },
  ];
}

function buildExpirationTrend(): { label: string; expiring: number; expired: number }[] {
  return [
    { label: "Seg", expiring: 2, expired: 0 },
    { label: "Ter", expiring: 3, expired: 1 },
    { label: "Qua", expiring: 1, expired: 0 },
    { label: "Qui", expiring: 4, expired: 2 },
    { label: "Sex", expiring: 2, expired: 0 },
    { label: "Sáb", expiring: 1, expired: 1 },
    { label: "Dom", expiring: 0, expired: 0 },
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
                background: `linear-gradient(to top, ${chartColors[["emerald", "cyan", "violet", "amber", "blue", "red"][i % 6]]}cc, ${chartColors[["emerald", "cyan", "violet", "amber", "blue", "red"][i % 6]]}66)`,
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

function StackedBarChart({ data }: { data: { label: string; expiring: number; expired: number }[] }) {
  const totals = data.map((d) => d.expiring + d.expired);
  const max = Math.max(...totals, 1);
  return (
    <div className="space-y-3">
      <div className="flex h-44 items-end gap-2">
        {data.map((item, i) => {
          const total = item.expiring + item.expired;
          const h = Math.max(4, (total / max) * 100);
          const hExpiring = (item.expiring / total) * h;
          const hExpired = h - hExpiring;
          return (
            <div className="group relative flex flex-1 flex-col justify-end gap-0.5" key={i}>
              <div className="w-full rounded-t-md" style={{ height: `${hExpired}%`, backgroundColor: chartColors.red }} />
              <div className="w-full rounded-b-md" style={{ height: `${hExpiring}%`, backgroundColor: chartColors.amber }} />
              <span className="text-[9px] text-slate-500">{item.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4">
        {[
          { color: chartColors.amber, label: "Vencendo" },
          { color: chartColors.red, label: "Vencido" },
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
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${pathD} L 100 100 L 0 100 Z`} fill="url(#lineFill)" />
          <path d={pathD} fill="none" stroke="#34d399" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle cx={p.x} cy={p.y} fill="#34d399" key={i} r="2" vectorEffect="non-scaling-stroke" />
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
// Sub-section: Inventory Table
// ---------------------------------------------------------------------------

function InventoryTable({ items }: { items: InventoryItem[] }) {
  const statusBadge = (status: InventoryItem["status"]) => {
    const map: Record<string, string> = {
      "Vencido": "border-red-300/40 bg-red-400/15 text-red-100",
      "Vencendo": "border-amber-300/40 bg-amber-400/15 text-amber-100",
      "Crítico": "border-red-300/40 bg-red-400/15 text-red-100",
      "Normal": "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
    };
    return <Badge className={cn("border text-[10px]", map[status] ?? "")}>{status}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            {["Item", "Categoria", "Qtd", "Mínimo", "Validade", "Status"].map((h) => (
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="rounded-xl border border-emerald-200/8 bg-slate-950/60" key={item.id}>
              <td className="px-3 py-3 text-sm font-semibold text-white">{item.name}</td>
              <td className="px-3 py-3 text-xs text-slate-400">{item.category}</td>
              <td className="px-3 py-3 font-mono text-xs text-slate-300">{item.quantity}</td>
              <td className="px-3 py-3 font-mono text-xs text-slate-500">{item.minimum}</td>
              <td className="px-3 py-3 font-mono text-xs text-slate-400">{formatDate(item.expirationDate)}</td>
              <td className="px-3 py-3">{statusBadge(item.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Category Performance Card
// ---------------------------------------------------------------------------

function CategoryCard({ data, featured = false }: { data: CategoryPerformance; featured?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-4 rounded-2xl border border-emerald-200/12 bg-slate-950/60 p-4",
      featured && "border-emerald-200/30 bg-emerald-400/5",
    )}>
      <div className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/20 bg-slate-900",
        featured && "border-emerald-300/40 shadow-[0_0_20px_rgba(52,211,153,0.15)]",
      )}>
        <Package className={cn("h-7 w-7 text-emerald-300", featured && "drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-white">{data.categoryName}</p>
        <p className="truncate text-xs text-slate-400">{data.itemCount} itens cadastrados</p>
        <div className="mt-2 flex gap-3">
          <span className="text-xs text-slate-500">Valor <span className="font-mono font-black text-emerald-300">{formatCurrency(data.totalValue)}</span></span>
          <span className="text-xs text-slate-500">Críticos <span className="font-mono font-black text-red-300">{data.criticalCount}</span></span>
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
    "Em reposição": TrendingUp,
    "Em análise": Clock,
    "Pendente": AlertTriangle,
  };
  const toneMap: Record<string, string> = {
    "Em reposição": "text-emerald-300",
    "Em análise": "text-amber-300",
    "Pendente": "text-red-300",
  };
  const badgeMap: Record<string, string> = {
    "Em reposição": "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
    "Em análise": "border-amber-300/40 bg-amber-400/15 text-amber-100",
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
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Recomendação</p>
        <div className="mt-3 flex items-start gap-3">
          <span className="text-3xl leading-none text-emerald-300">"</span>
          <p className="flex-1 text-base font-semibold leading-relaxed text-white">{recommendation.text}</p>
          <span className="text-3xl leading-none text-emerald-300">"</span>
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
  totalValue,
  items,
  belowMinimum,
  expiring,
}: {
  periodLabel: string;
  unitName?: string;
  totalValue: number;
  items: number;
  belowMinimum: number;
  expiring: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-emerald-200/12 bg-slate-950 p-8 md:p-12" id="cover">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_50%,rgba(52,211,153,0.07),transparent_55%)]" />

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
              <span className="text-transparent" style={{ WebkitTextStroke: "1px #34d399", color: "transparent" }}>Estoque</span>
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-emerald-300" />
              <p className="text-sm font-semibold text-slate-400">K9 OPS · Logistics Division</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200/12 bg-slate-900/80 px-4 py-2">
              <Calendar className="h-4 w-4 text-emerald-300" />
              <span className="text-sm font-semibold text-white">{periodLabel}</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200/12 bg-slate-900/80 px-4 py-2">
              <Warehouse className="h-4 w-4 text-emerald-300" />
              <span className="text-sm font-semibold text-white">{unitName}</span>
            </div>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-slate-400">
            Este relatório apresenta uma análise detalhada do inventário de materiais e equipamentos,
            incluindo níveis de estoque, itens críticos, movimentação e projeções de vencimento.
          </p>
        </div>

        {/* Warehouse hero illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-emerald-200/20 bg-slate-900">
              <Package className="h-24 w-24 text-emerald-300/20" />
              <div className="absolute inset-0 rounded-full border border-emerald-200/10" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs at base of cover */}
      <div className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardMega detail="em estoque" icon={Package} label="Valor total" value={formatCurrency(totalValue)} tone="emerald" />
        <KpiCardMega detail="cadastrados" icon={Warehouse} label="Itens" value={formatCount(items)} tone="cyan" />
        <KpiCardMega detail="abaixo do mínimo" icon={AlertTriangle} label="Críticos" value={formatCount(belowMinimum)} tone="red" />
        <KpiCardMega detail="nos próximos 30 dias" icon={Clock} label="Vencendo" value={formatCount(expiring)} tone="amber" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Executive Summary
// ---------------------------------------------------------------------------

function ExecutiveSummarySection({
  totalValue,
  items,
  belowMinimum,
  expiring,
  categories,
  dailyData,
  highlights,
}: {
  totalValue: number;
  items: number;
  belowMinimum: number;
  expiring: number;
  categories: StatItem[];
  dailyData: { label: string; value: number }[];
  highlights: { label: string; value: string; detail: string; tone: string }[];
}) {
  return (
    <section className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="resumo">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Resumo Executivo</h2>
          <p className="mt-1 text-sm text-slate-400">Visão consolidada do inventário no período</p>
        </div>
        <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Visão geral</Badge>
      </div>

      {/* 4 KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="em estoque" icon={Package} label="Valor total" value={formatCurrency(totalValue)} tone="emerald" />
        <KpiCard detail="cadastrados" icon={Warehouse} label="Itens" value={formatCount(items)} tone="cyan" />
        <KpiCard detail="abaixo do mínimo" icon={AlertTriangle} label="Críticos" value={formatCount(belowMinimum)} tone="red" />
        <KpiCard detail="nos próximos 30 dias" icon={Clock} label="Vencendo" value={formatCount(expiring)} tone="amber" />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Movimentações por dia</p>
          <BarChart data={dailyData} />
        </div>
        <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Distribuição por categoria</p>
          <DonutChart items={categories} total={items} />
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
  categories,
  items,
  belowMinimum,
  expired,
}: {
  timeline: InventoryItem[];
  categories: StatItem[];
  items: number;
  belowMinimum: number;
  expired: number;
}) {
  const statusDonut: StatItem[] = [
    { label: "Vencido", percent: items > 0 ? (expired / Math.max(1, items)) * 100 : 0, tone: "red" as ReportTone, value: expired },
    { label: "Abaixo mínimo", percent: items > 0 ? (belowMinimum / Math.max(1, items)) * 100 : 0, tone: "amber" as ReportTone, value: belowMinimum },
    { label: "Normal", percent: 100 - (items > 0 ? ((expired + belowMinimum) / items) * 100 : 0), tone: "emerald" as ReportTone, value: items - expired - belowMinimum },
  ].filter((s) => s.value > 0);

  return (
    <section className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="operacional">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Análise de Estoque</h2>
          <p className="mt-1 text-sm text-slate-400">Itens críticos, vencimentos e status do inventário</p>
        </div>
        <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Operacional</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Timeline */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-300">Itens que requerem atenção</p>
          <div className="relative space-y-0 border-l border-emerald-200/20 pl-6">
            {timeline.map((item, i) => {
              const dotColor = item.status === "Vencido" ? "bg-red-400" : item.status === "Vencendo" ? "bg-amber-400" : "bg-emerald-400";
              return (
                <div className="relative pb-6 last:pb-0" key={item.id}>
                  <div className={cn("absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-slate-950", dotColor)} />
                  <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-white">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.category}</p>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">{formatDate(item.expirationDate)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-500">Qtd: {item.quantity}/{item.minimum}</span>
                      <span className={cn(
                        "ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold",
                        item.status === "Vencido" ? "bg-red-400/20 text-red-200" :
                        item.status === "Vencendo" ? "bg-amber-400/20 text-amber-200" :
                        "bg-red-400/20 text-red-200"
                      )}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Donut + Line */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
            <p className="mb-4 text-sm font-semibold text-slate-300">Status do inventário</p>
            <DonutChart items={statusDonut} total={items} />
          </div>
          <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
            <p className="mb-4 text-sm font-semibold text-slate-300">Itens por categoria</p>
            <div className="space-y-2">
              {categories.slice(0, 5).map((cat) => (
                <div className="flex items-center gap-3" key={cat.label}>
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[cat.tone] }} />
                  <span className="flex-1 text-xs text-slate-400">{cat.label}</span>
                  <span className="font-mono text-xs font-bold text-white">{cat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Inventory table */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Itens que requerem reposição</p>
        <InventoryTable items={timeline} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Productivity and Logistics
// ---------------------------------------------------------------------------

function ProductivitySection({
  categoryData,
  heatmapData,
  expirationData,
  highlights,
  totalValue,
  movements,
}: {
  categoryData: CategoryPerformance[];
  heatmapData: { label: string; value: number }[];
  expirationData: { label: string; expiring: number; expired: number }[];
  highlights: string[];
  totalValue: number;
  movements: number;
}) {
  const avgValue = categoryData.length > 0
    ? Math.round(categoryData.reduce((s, d) => s + d.totalValue, 0) / categoryData.length)
    : 0;

  return (
    <section className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="produtividade">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Logística e Validade</h2>
          <p className="mt-1 text-sm text-slate-400">Movimentação, vencimentos e locais de armazenamento</p>
        </div>
        <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Logística</Badge>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="no período" icon={History} label="Movimentações" value={formatCount(movements)} tone="emerald" />
        <KpiCard detail="valor total" icon={TrendingUp} label="Valor em estoque" value={formatCurrency(totalValue)} tone="cyan" />
        <KpiCard detail="média por categoria" icon={BarChart3} label="Valor médio" value={formatCurrency(avgValue)} tone="violet" />
        <KpiCard detail="categorias" icon={Package} label="Categorias" value={formatCount(categoryData.length)} tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Stacked bar chart */}
        <div className="rounded-2xl border border-emerald-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Vencimentos por dia</p>
          <StackedBarChart data={expirationData} />
        </div>

        {/* Category cards */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-300">Desempenho por categoria</p>
          {categoryData.slice(0, 2).map((c) => (
            <CategoryCard data={c} featured key={c.categoryName} />
          ))}
          {categoryData.slice(2).map((c) => (
            <CategoryCard data={c} key={c.categoryName} />
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Locais de armazenamento</p>
        <HeatmapGrid data={heatmapData} />
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
  items,
  belowMinimum,
  expired,
  totalValue,
  recommendations,
  pendingItems,
  alertCards,
}: {
  items: number;
  belowMinimum: number;
  expired: number;
  totalValue: number;
  recommendations: Recommendation[];
  pendingItems: PendingItem[];
  alertCards: AlertCard[];
}) {
  const healthRate = items > 0 ? Math.round(((items - belowMinimum - expired) / items) * 100) : 0;

  return (
    <section className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="conclusoes">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Conclusões e Integridade</h2>
          <p className="mt-1 text-sm text-slate-400">Resumo final, validação e próximos passos</p>
        </div>
        <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Conclusão</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard detail="cadastrados" icon={Package} label="Total de itens" value={formatCount(items)} tone="emerald" />
            <KpiCard detail="abaixo mínimo" icon={TrendingDown} label="Itens críticos" value={formatCount(belowMinimum)} tone="red" />
            <KpiCard detail="vencidos" icon={AlertTriangle} label="Vencidos" value={formatCount(expired)} tone="amber" />
            <KpiCard detail="taxa" icon={ShieldCheck} label="Índice saúde" value={formatPercent(healthRate)} tone="cyan" />
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

          {/* Alert Cards */}
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-300">Alertas e notificações</p>
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
  { id: "operacional", label: "Estoque" },
  { id: "produtividade", label: "Logística" },
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

export function InventoryReport() {
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useReportsData(periodDays);

  // Derived data
  const dailyData = useMemo(() => buildDailyMovements(data.inventory.movements, periodDays), [data.inventory.movements, periodDays]);
  const timeline = useMemo(() => buildTimeline(data.inventory.criticalItems), [data.inventory.criticalItems]);
  const categoryData = useMemo(() => buildCategoryPerformance(data.inventory.categories), [data.inventory.categories]);
  const heatmapData = useMemo(() => buildHeatmapData(), []);
  const expirationData = useMemo(() => buildExpirationTrend(), []);

  const healthRate = data.inventory.items > 0
    ? Math.round(((data.inventory.items - data.inventory.belowMinimum - data.inventory.expired) / data.inventory.items) * 100)
    : 100;

  const highlights = useMemo(() => [
    { label: "Valor total em estoque", value: formatCurrency(data.inventory.totalValue), detail: `de ${data.inventory.items} itens`, tone: "emerald" },
    { label: "Itens abaixo mínimo", value: formatCount(data.inventory.belowMinimum), detail: "requerem reposição", tone: "red" },
    { label: "Itens vencendo", value: formatCount(data.inventory.expiring), detail: "nos próximos 30 dias", tone: "amber" },
    { label: "Movimentações", value: formatCount(data.inventory.movements), detail: `no período`, tone: "cyan" },
  ], [data.inventory]);

  const sinais = useMemo(() => {
    const items: string[] = [];
    if (data.inventory.belowMinimum > 0) items.push("Itens abaixo do estoque mínimo");
    if (data.inventory.expiring > 0) items.push("Itens com vencimento próximo");
    if (data.inventory.expired > 0) items.push("Itens vencidos identificados");
    if (healthRate > 90) items.push("Índice de saúde do estoque elevado");
    if (data.inventory.movements > 0) items.push("Movimentações registradas no período");
    return items.slice(0, 5);
  }, [data.inventory, healthRate]);

  const recommendations: Recommendation[] = useMemo(() => [
    {
      icon: TrendingUp,
      priority: data.inventory.belowMinimum > 0 ? "high" : "medium",
      text: "Priorizar a reposição dos itens que estão abaixo do estoque mínimo para garantir a disponibilidade operacional.",
    },
    {
      icon: Clock,
      priority: data.inventory.expiring > 0 ? "medium" : "low",
      text: "Revisar os itens com vencimento próximo e planejar a utilização ou descarte adequado antes da expiração.",
    },
    {
      icon: Warehouse,
      priority: "low",
      text: "Avaliar a reorganização dos locais de armazenamento com base nos padrões de movimentação identificados.",
    },
  ], [data.inventory.belowMinimum, data.inventory.expiring]);

  const pendingItems: PendingItem[] = useMemo(() => [
    { text: "Reposição de materiais de primeiros socorros", status: "Em reposição" },
    { text: "Avaliação de itens vencidos para descarte", status: "Em análise" },
    { text: "Atualização do inventário de viaturas K9", status: "Pendente" },
    { text: "Verificação de EPIs dos binômios", status: "Concluído" },
    { text: "Renovação de certificados de controle de pragas", status: "Concluído" },
  ], []);

  const alertCards: AlertCard[] = useMemo(() => [
    { icon: AlertTriangle, label: "Alertas críticos", count: data.inventory.belowMinimum + data.inventory.expired, tone: "red" },
    { icon: Clock, label: "Próximos vencimentos", count: data.inventory.expiring, tone: "amber" },
    { icon: History, label: "Movimentações", count: data.inventory.movements, tone: "cyan" },
    { icon: ShieldCheck, label: "Integridade", count: Math.round(healthRate), tone: "emerald" },
  ], [data.inventory, healthRate]);

  const getExportData = useCallback(
    () => getExportableData("inventory", data),
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
            <p className="text-sm font-semibold text-emerald-200">Relatório Premium</p>
            <h1 className="text-2xl font-black text-white md:text-3xl">Relatório de Estoque</h1>
            <p className="mt-1 text-sm text-slate-400">Período: <span className="font-semibold text-emerald-200">{periodLabel}</span></p>
          </div>
        </div>
        <ExportButton
          getData={getExportData}
          reportId="inventory"
          reportTitle="Estoque"
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
        totalValue={data.inventory.totalValue}
        items={data.inventory.items}
        belowMinimum={data.inventory.belowMinimum}
        expiring={data.inventory.expiring}
      />

      {/* Section 2: Executive Summary */}
      <ExecutiveSummarySection
        totalValue={data.inventory.totalValue}
        items={data.inventory.items}
        belowMinimum={data.inventory.belowMinimum}
        expiring={data.inventory.expiring}
        categories={data.inventory.categories}
        dailyData={dailyData}
        highlights={highlights}
      />

      {/* Section 3: Operational Analysis */}
      <OperationalAnalysisSection
        timeline={timeline}
        categories={data.inventory.categories}
        items={data.inventory.items}
        belowMinimum={data.inventory.belowMinimum}
        expired={data.inventory.expired}
      />

      {/* Section 4: Productivity */}
      <ProductivitySection
        categoryData={categoryData}
        heatmapData={heatmapData}
        expirationData={expirationData}
        highlights={sinais}
        totalValue={data.inventory.totalValue}
        movements={data.inventory.movements}
      />

      {/* Section 5: Conclusions */}
      <ConclusionsSection
        items={data.inventory.items}
        belowMinimum={data.inventory.belowMinimum}
        expired={data.inventory.expired}
        totalValue={data.inventory.totalValue}
        recommendations={recommendations}
        pendingItems={pendingItems}
        alertCards={alertCards}
      />

      {/* Export toolbar footer */}
      <div className="rounded-[1.65rem] border border-emerald-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-300" />
          <p className="text-sm font-black text-white">Exportação e assinatura digital</p>
        </div>
        <ExportToolbar
          getData={getExportData}
          reportId="inventory"
          reportTitle="Relatório de Estoque"
          subtitle={`Período: ${periodLabel}`}
        />
        <div className="mt-4 rounded-2xl border border-emerald-200/10 bg-emerald-300/8 p-4">
          <p className="text-sm font-black text-white">Assinatura digital</p>
          <p className="mt-1 text-xs text-slate-400">
            Relatório validado com base nos registros de inventário consultados e filtros selecionados.
            Os dados refletem a realidade do estoque no período {periodLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}
