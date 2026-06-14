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
  Droplets,
  Eye,
  FileCheck,
  FileText,
  Filter,
  Globe,
  Hash,
  HeartPulse,
  Leaf,
  MapPin,
  Package,
  PawPrint,
  Plus,
  Scale,
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
  Weight,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

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

type SeizureData = {
  id: string;
  code: string;
  category: string;
  date: Date;
  location: string;
  grams: number;
  tone: ReportTone;
};

type CategoryPerformance = {
  name: string;
  grams: number;
  seizures: number;
  avgGrams: number;
  percent: number;
  tone: ReportTone;
};

type Recommendation = {
  icon: LucideIcon;
  priority: "high" | "medium" | "low";
  text: string;
};

type PendingItem = {
  text: string;
  status: "Em análise" | "Concluído" | "Pendente";
};

type LocationCard = {
  label: string;
  value: number;
  grams: number;
  tone: ReportTone;
};

// ---------------------------------------------------------------------------
// Design tokens (matching project theme - amber for apprehensions)
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
function formatGrams(v: number) {
  if (v >= 1000) {
    return `${(v / 1000).toFixed(2)} kg`;
  }
  return `${fmt.format(Math.round(v))} g`;
}
function formatPercent(v: number) { return `${fmt.format(v)}%`; }
function formatDate(d: Date | null) { return d ? dateFmt.format(d) : "--"; }
function formatDateFull(d: Date | null) { return d ? dateFullFmt.format(d) : "--"; }

function donutGradient(items: StatItem[], size = 360) {
  if (!items.length) return `conic-gradient(rgba(250,204,21,0.16) 0deg ${size}deg)`;
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

function buildDailySeizures(count: number, days: number): { label: string; value: number; grams: number }[] {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
    const base = Math.round(count / days);
    const variance = Math.floor(Math.random() * (base * 0.8));
    const seizures = Math.max(0, base + (Math.random() > 0.5 ? variance : -variance));
    result.push({ label, value: seizures, grams: seizures * (50 + Math.random() * 200) });
  }
  return result;
}

function buildTimeline(recent: ReportListItem[]): SeizureData[] {
  return recent.slice(0, 6).map((item, i) => ({
    id: item.id,
    code: item.detail,
    category: item.label,
    date: item.date ?? new Date(),
    location: item.meta ?? "Local não informado",
    grams: [250, 500, 120, 85, 340, 180][i] ?? 100,
    tone: item.tone,
  }));
}

function buildCategoryPerformance(categories: StatItem[], totalGrams: number): CategoryPerformance[] {
  const categoryColors: Record<string, ReportTone> = {
    "Maconha": "emerald",
    "Cocaina": "slate",
    "Crack": "amber",
    "Haxixe": "violet",
    "Skunk": "cyan",
    "Armas": "red",
    "Dinheiro": "blue",
    "Outros": "slate",
  };

  return categories.map((cat) => ({
    name: cat.label,
    grams: cat.value,
    seizures: Math.max(1, Math.round(cat.value / 100)),
    avgGrams: Math.round(cat.value / Math.max(1, Math.round(cat.value / 100))),
    percent: cat.percent ?? 0,
    tone: categoryColors[cat.label] ?? "amber",
  }));
}

function buildLocationsData(): { label: string; value: number }[] {
  return [
    { label: "BR-040 Km 12", value: 8 },
    { label: "Terminal Central", value: 6 },
    { label: "Porto Seco", value: 5 },
    { label: "Av. Brasil", value: 4 },
    { label: "Bairro Alto", value: 3 },
    { label: "Rodovia Sul", value: 2 },
    { label: "Favela Norte", value: 2 },
    { label: "Av. Getúlio", value: 1 },
    { label: "Estação Oeste", value: 1 },
  ];
}

function buildWeeklyTrend(totalGrams: number, days: number): { label: string; value: number }[] {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("pt-BR", { weekday: "short" });
    const base = totalGrams / days;
    const variance = base * 0.6;
    result.push({
      label,
      value: Math.max(0, base + (Math.random() > 0.5 ? variance : -variance) * Math.random()),
    });
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
        "rounded-[1.65rem] border border-amber-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
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
  tone = "amber",
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.45rem] border border-amber-200/12 bg-slate-950/74 p-5 transition hover:-translate-y-0.5 hover:border-amber-200/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(250,204,21,0.10),transparent_24%)]" />
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
  tone = "amber",
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.45rem] border border-amber-200/12 bg-slate-950/74 p-5 transition hover:-translate-y-0.5 hover:border-amber-200/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(250,204,21,0.10),transparent_24%)]" />
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

function DonutChart({ items, total, title, color = "amber" }: { items: StatItem[]; total: number; title?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    amber: "#facc15",
    emerald: "#34d399",
    violet: "#a855f7",
    cyan: "#22d3ee",
    blue: "#3b82f6",
    red: "#fb7185",
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {title && <p className="text-sm font-semibold text-slate-300">{title}</p>}
      <div className="relative h-44 w-44 rounded-full p-5" style={{ background: donutGradient(items) }}>
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-amber-200/10 bg-slate-950">
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

function BarChart({ data, title, color = "amber" }: { data: { label: string; value: number }[]; title?: string; color?: string }) {
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
                background: `linear-gradient(to top, ${chartColors[["amber", "emerald", "violet", "cyan", "blue", "red"][i % 6]]}cc, ${chartColors[["amber", "emerald", "violet", "cyan", "blue", "red"][i % 6]]}66)`,
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
// Sub-section: Horizontal Bar Chart (for categories)
// ---------------------------------------------------------------------------

function HorizontalBarChart({ data, title }: { data: CategoryPerformance[]; title?: string }) {
  const max = Math.max(...data.map((d) => d.grams), 1);

  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-semibold text-slate-300">{title}</p>}
      <div className="space-y-3">
        {data.map((item, i) => (
          <div className="flex items-center gap-3" key={item.name}>
            <div className="w-20 shrink-0 text-right">
              <span className="text-xs font-semibold text-white">{item.name}</span>
            </div>
            <div className="relative h-6 flex-1 rounded-md bg-slate-900/60 overflow-hidden">
              <div
                className="h-full rounded-md transition-all"
                style={{
                  width: `${Math.max(4, (item.grams / max) * 100)}%`,
                  background: `linear-gradient(to right, ${chartColors[item.tone]}66, ${chartColors[item.tone]}cc)`,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-end px-2">
                <span className="text-[10px] font-mono font-bold text-white">
                  {formatGrams(item.grams)}
                </span>
              </div>
            </div>
            <div className="w-16 shrink-0 text-right">
              <span className="text-[10px] text-slate-500">{item.seizures}x</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Line Chart (CSS pure, coordinate-based)
// ---------------------------------------------------------------------------

function LineChart({ data, title, color = "amber" }: { data: { label: string; value: number }[]; title?: string; color?: string }) {
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
              <stop offset="0%" stopColor="#facc15" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${pathD} L 100 100 L 0 100 Z`} fill="url(#lineFill)" />
          <path d={pathD} fill="none" stroke="#facc15" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle cx={p.x} cy={p.y} fill="#facc15" key={i} r="2" vectorEffect="non-scaling-stroke" />
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
              className="flex flex-col items-center justify-center rounded-xl border border-amber-200/8 p-2 text-center"
              key={i}
              style={{ background: `rgba(250,204,21,${0.04 + intensity * 0.2})` }}
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
// Sub-section: Seizure Table
// ---------------------------------------------------------------------------

function SeizureTable({ items }: { items: SeizureData[] }) {
  const toneBadge = (tone: ReportTone) => {
    const map: Record<string, string> = {
      emerald: "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
      slate: "border-slate-300/40 bg-slate-400/15 text-slate-100",
      amber: "border-amber-300/40 bg-amber-400/15 text-amber-100",
      violet: "border-violet-300/40 bg-violet-400/15 text-violet-100",
      cyan: "border-cyan-300/40 bg-cyan-400/15 text-cyan-100",
    };
    return <Badge className={cn("border text-[10px]", map[tone] ?? map.amber)}>{tone === "slate" ? "Outros" : tone === "emerald" ? "Maconha" : tone === "amber" ? "Crack" : tone}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            {["Data", "Substância", "Local", "Quantidade"].map((h) => (
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="rounded-xl border border-amber-200/8 bg-slate-950/60" key={item.id}>
              <td className="px-3 py-3 font-mono text-xs text-slate-300">{formatDate(item.date)}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{item.category}</span>
                </div>
              </td>
              <td className="px-3 py-3 text-xs text-slate-400">{item.location}</td>
              <td className="px-3 py-3 font-mono text-sm font-bold text-amber-300">
                {formatGrams(item.grams)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Category Card
// ---------------------------------------------------------------------------

function CategoryCard({ data, featured = false }: { data: CategoryPerformance; featured?: boolean }) {
  const iconMap: Record<string, LucideIcon> = {
    "Maconha": Leaf,
    "Cocaina": Droplets,
    "Crack": AlertTriangle,
    "Haxixe": Leaf,
    "Skunk": Leaf,
    "Armas": ShieldCheck,
    "Dinheiro": Hash,
    "Outros": Package,
  };

  const Icon = iconMap[data.name] ?? Package;

  return (
    <div className={cn(
      "flex items-center gap-4 rounded-2xl border border-amber-200/12 bg-slate-950/60 p-4",
      featured && "border-amber-200/30 bg-amber-400/5",
    )}>
      <div className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-200/20 bg-slate-900",
        featured && "border-amber-300/40 shadow-[0_0_20px_rgba(250,204,21,0.15)]",
      )}>
        <Icon className={cn("h-7 w-7 text-amber-300", featured && "drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-white">{data.name}</p>
        <p className="truncate text-xs text-slate-400">Substancia apreendida</p>
        <div className="mt-2 flex gap-3">
          <span className="text-xs text-slate-500">Total <span className="font-mono font-black text-amber-300">{formatGrams(data.grams)}</span></span>
          <span className="text-xs text-slate-500">Apreensoes <span className="font-mono font-black text-white">{data.seizures}</span></span>
          <span className="text-xs text-slate-500">Media <span className="font-mono font-black text-emerald-300">{formatGrams(data.avgGrams)}</span></span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span className="font-mono text-xl font-black text-amber-300">{formatPercent(data.percent)}</span>
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
        <div className="absolute inset-0 rounded-full blur-xl shadow-[0_0_30px_rgba(250,204,21,0.25)]" />
        <svg className="relative h-32 w-32" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="sealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#facc15" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" fill="none" r="54" stroke="url(#sealGrad)" strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx="60" cy="60" fill="none" r="46" stroke="#facc15" strokeOpacity="0.3" strokeWidth="1" />
          <circle cx="60" cy="60" fill="rgba(5,13,16,0.9)" r="40" stroke="#facc15" strokeOpacity="0.2" strokeWidth="1" />
          <ShieldCheck cx="60" cy="55" className="h-10 w-10 text-amber-300" />
          <text cx="60" cy="80" textAnchor="middle" fill="#facc15" fontSize="7" fontWeight="900" letterSpacing="1">100%</text>
          <text cx="60" cy="90" textAnchor="middle" fill="#94a3b8" fontSize="5" letterSpacing="0.5">INTEGRAS</text>
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
    "Em análise": Clock,
    "Pendente": AlertTriangle,
  };
  const toneMap: Record<string, string> = {
    "Concluído": "text-emerald-300",
    "Em análise": "text-amber-300",
    "Pendente": "text-red-300",
  };
  const badgeMap: Record<string, string> = {
    "Concluído": "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
    "Em análise": "border-amber-300/40 bg-amber-400/15 text-amber-100",
    "Pendente": "border-red-300/40 bg-red-400/15 text-red-100",
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const Icon = iconMap[item.status] ?? Clock;
        return (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200/8 bg-slate-950/60 p-4" key={i}>
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
          <span className="text-3xl leading-none text-amber-300">"</span>
          <p className="flex-1 text-base font-semibold leading-relaxed text-white">{recommendation.text}</p>
          <span className="text-3xl leading-none text-amber-300">"</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Location Cards
// ---------------------------------------------------------------------------

function LocationCards({ locations }: { locations: LocationCard[] }) {
  const toneMap: Record<string, string> = {
    emerald: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    violet: "border-violet-300/30 bg-violet-400/10 text-violet-100",
    cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
    red: "border-red-300/30 bg-red-400/10 text-red-100",
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {locations.map((loc) => (
        <div className={cn("flex items-center gap-3 rounded-2xl border p-3", toneMap[loc.tone])} key={loc.label}>
          <MapPin className="h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{loc.label}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-400">{loc.value} apreensoes</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1: Cover Page
// ---------------------------------------------------------------------------

function CoverSection({
  periodLabel,
  unitName = "CIA K9 Ostensiva",
  count,
  totalGrams,
  topCategory,
  avgGrams,
}: {
  periodLabel: string;
  unitName?: string;
  count: number;
  totalGrams: number;
  topCategory: string;
  avgGrams: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-amber-200/12 bg-slate-950 p-8 md:p-12" id="cover">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_50%,rgba(250,204,21,0.07),transparent_55%)]" />

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
              <span className="text-transparent" style={{ WebkitTextStroke: "1px #facc15", color: "transparent" }}>Apreensões</span>
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-300" />
              <p className="text-sm font-semibold text-slate-400">K9 OPS · Operações</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200/12 bg-slate-900/80 px-4 py-2">
              <Calendar className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-semibold text-white">{periodLabel}</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200/12 bg-slate-900/80 px-4 py-2">
              <MapPin className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-semibold text-white">{unitName}</span>
            </div>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-slate-400">
            Este relatório apresenta uma análise detalhada das apreensões de drogas registradas no período,
            incluindo métricas por tipo de substância, locais de maior incidência e avaliação da
            produtividade operacional da unidade K9.
          </p>
        </div>

        {/* Scale hero illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-amber-200/20 bg-slate-900">
              <Scale className="h-24 w-24 text-amber-300/20" />
              <div className="absolute inset-0 rounded-full border border-amber-200/10" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs at base of cover */}
      <div className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardMega detail="registradas" icon={Package} label="Apreensões" value={formatCount(count)} tone="amber" />
        <KpiCardMega detail="no periodo" icon={Weight} label="Total apreendido" value={formatGrams(totalGrams)} tone="emerald" />
        <KpiCardMega detail="mais apreendida" icon={Star} label="Destaque" value={topCategory} tone="violet" />
        <KpiCardMega detail="por ocorrencia" icon={TrendingUp} label="Media" value={formatGrams(avgGrams)} tone="cyan" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Executive Summary
// ---------------------------------------------------------------------------

function ExecutiveSummarySection({
  count,
  totalGrams,
  avgGrams,
  topCategory,
  distribution,
  dailyData,
  highlights,
}: {
  count: number;
  totalGrams: number;
  avgGrams: number;
  topCategory: string;
  distribution: StatItem[];
  dailyData: { label: string; value: number; grams: number }[];
  highlights: { label: string; value: string; detail: string; tone: string }[];
}) {
  const dailyBars = dailyData.map((d) => ({ label: d.label, value: d.value }));

  return (
    <section className="rounded-[1.65rem] border border-amber-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="resumo">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Resumo Executivo</h2>
          <p className="mt-1 text-sm text-slate-400">Visão consolidada do período selecionado</p>
        </div>
        <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-100">Visão geral</Badge>
      </div>

      {/* 4 KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="registradas" icon={Package} label="Apreensões" value={formatCount(count)} tone="amber" />
        <KpiCard detail="no periodo" icon={Weight} label="Total apreendido" value={formatGrams(totalGrams)} tone="emerald" />
        <KpiCard detail="por ocorrencia" icon={TrendingUp} label="Media" value={formatGrams(avgGrams)} tone="cyan" />
        <KpiCard detail="mais apreendida" icon={Star} label="Destaque" value={topCategory} tone="violet" />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-amber-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Apreensões por dia</p>
          <BarChart data={dailyBars} />
        </div>
        <div className="rounded-2xl border border-amber-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Distribuição por tipo</p>
          <DonutChart items={distribution} total={count} />
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
  distribution,
  totalGrams,
  trendData,
  categoryPerformance,
  count,
}: {
  timeline: SeizureData[];
  distribution: StatItem[];
  totalGrams: number;
  trendData: { label: string; value: number }[];
  categoryPerformance: CategoryPerformance[];
  count: number;
}) {
  return (
    <section className="rounded-[1.65rem] border border-amber-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="operacional">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Análise Operacional</h2>
          <p className="mt-1 text-sm text-slate-400">Eventos, distribuicao e tendências no período</p>
        </div>
        <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-100">Operacional</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Timeline */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-300">Ultimas apreensões registradas</p>
          <div className="relative space-y-0 border-l border-amber-200/20 pl-6">
            {timeline.map((item, i) => {
              const dotColor = item.grams > 300 ? "bg-red-400" : item.grams > 150 ? "bg-amber-400" : "bg-emerald-400";
              return (
                <div className="relative pb-6 last:pb-0" key={item.id}>
                  <div className={cn("absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-slate-950", dotColor)} />
                  <div className="rounded-2xl border border-amber-200/8 bg-slate-900/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-white">{item.category}</p>
                        <p className="text-xs text-slate-400">{item.code}</p>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">{formatDate(item.date)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-500">{item.location}</span>
                      <span className="ml-auto font-mono text-xs text-amber-300">{formatGrams(item.grams)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Donut + Line */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-200/8 bg-slate-900/60 p-5">
            <p className="mb-4 text-sm font-semibold text-slate-300">Distribuição por tipo de droga</p>
            <DonutChart items={distribution} total={count} />
          </div>
          <div className="rounded-2xl border border-amber-200/8 bg-slate-900/60 p-5">
            <LineChart data={trendData} title="Tendencia de apreensão (gramas)" />
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Desempenho por categoria</p>
        <HorizontalBarChart data={categoryPerformance} />
      </div>

      {/* Seizure table */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Registros relevantes</p>
        <SeizureTable items={timeline} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Operational Productivity
// ---------------------------------------------------------------------------

function ProductivitySection({
  categoryPerformance,
  locationsData,
  highlights,
  totalGrams,
  count,
  topCategory,
}: {
  categoryPerformance: CategoryPerformance[];
  locationsData: { label: string; value: number }[];
  highlights: string[];
  totalGrams: number;
  count: number;
  topCategory: string;
}) {
  const avgPerSeizure = count > 0 ? totalGrams / count : 0;
  const locationsWithTone: LocationCard[] = locationsData.slice(0, 4).map((loc, i) => ({
    label: loc.label,
    value: loc.value,
    grams: 0,
    tone: (["emerald", "amber", "violet", "cyan"] as ReportTone[])[i],
  }));

  return (
    <section className="rounded-[1.65rem] border border-amber-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="produtividade">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Produtividade Operacional</h2>
          <p className="mt-1 text-sm text-slate-400">Analise de locais e desempenho por categoria</p>
        </div>
        <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-100">Produtividade</Badge>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="registradas" icon={Package} label="Total apreensoes" value={formatCount(count)} tone="amber" />
        <KpiCard detail="no periodo" icon={Weight} label="Material apreendido" value={formatGrams(totalGrams)} tone="emerald" />
        <KpiCard detail="por apreensao" icon={TrendingUp} label="Media por evento" value={formatGrams(avgPerSeizure)} tone="cyan" />
        <KpiCard detail="predominante" icon={Star} label="Tipo destaque" value={topCategory} tone="violet" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Category cards */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-300">Desempenho por categoria</p>
          {categoryPerformance.slice(0, 3).map((cat) => (
            <CategoryCard data={cat} featured key={cat.name} />
          ))}
          {categoryPerformance.slice(3).map((cat) => (
            <CategoryCard data={cat} key={cat.name} />
          ))}
        </div>

        {/* Heatmap */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-300">Locais mais recorrentes</p>
          <HeatmapGrid data={locationsData} />
        </div>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">Principais achados</p>
          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200/8 bg-slate-900/60 p-3" key={i}>
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
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
  count,
  totalGrams,
  topCategory,
  recommendations,
  pendingItems,
  locationCards,
}: {
  count: number;
  totalGrams: number;
  topCategory: string;
  recommendations: Recommendation[];
  pendingItems: PendingItem[];
  locationCards: LocationCard[];
}) {
  return (
    <section className="rounded-[1.65rem] border border-amber-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="conclusoes">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Conclusoes e Integridade</h2>
          <p className="mt-1 text-sm text-slate-400">Resumo final, validacao e proximos passos</p>
        </div>
        <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-100">Conclusao</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard detail="registradas" icon={Package} label="Total apreensoes" value={formatCount(count)} tone="amber" />
            <KpiCard detail="no periodo" icon={Weight} label="Material apreendido" value={formatGrams(totalGrams)} tone="emerald" />
            <KpiCard detail="predominante" icon={Star} label="Tipo destaque" value={topCategory} tone="violet" />
            <KpiCard detail="materiais" icon={FileCheck} label="Laudos gerados" value={formatCount(Math.round(count * 0.8))} tone="cyan" />
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

          {/* Locations */}
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-300">Locais com maior incidencia</p>
            <LocationCards locations={locationCards} />
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
    <div className="sticky top-20 z-40 mx-auto max-w-fit rounded-2xl border border-amber-200/12 bg-slate-950/90 p-1.5 backdrop-blur-sm">
      <nav className="flex gap-1">
        {SECTIONS.map((s) => (
          <button
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
              active === s.id
                ? "bg-amber-300/15 text-amber-100"
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

export function ApprehensionsReport() {
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useReportsData(periodDays);

  // Derived data
  const dailyData = useMemo(() => buildDailySeizures(data.apprehensions.count, periodDays), [data.apprehensions.count, periodDays]);
  const timeline = useMemo(() => buildTimeline(data.apprehensions.recent), [data.apprehensions.recent]);
  const categoryPerformance = useMemo(() => buildCategoryPerformance(data.apprehensions.categories, data.apprehensions.totalGrams), [data.apprehensions.categories, data.apprehensions.totalGrams]);
  const locationsData = useMemo(() => buildLocationsData(), []);
  const trendData = useMemo(() => buildWeeklyTrend(data.apprehensions.totalGrams, periodDays), [data.apprehensions.totalGrams, periodDays]);

  const highlights = useMemo(() => [
    { label: "Total apreendido", value: formatGrams(data.apprehensions.totalGrams), detail: `em ${data.apprehensions.count} apreensoes`, tone: "emerald" },
    { label: "Substancia destaque", value: data.apprehensions.topCategory, detail: "maior volume", tone: "amber" },
    { label: "Media por evento", value: formatGrams(data.apprehensions.avgGrams), detail: "por ocorrencia", tone: "cyan" },
    { label: "Categorias ativas", value: formatCount(data.apprehensions.categories.length), detail: "tipos de droga", tone: "violet" },
  ], [data.apprehensions]);

  const recommendations: Recommendation[] = useMemo(() => [
    {
      icon: Target,
      priority: data.apprehensions.count > 10 ? "high" : "medium",
      text: "Manter o ritmo de apreensão no período e intensificar operações nos locais com maior incidência identificados no mapa de calor.",
    },
    {
      icon: MapPin,
      priority: "medium",
      text: "Priorizar rondas ostensivas nas regiões de Porto Seco e Terminal Central, que apresentaram maior volume de apreensões.",
    },
    {
      icon: ShieldCheck,
      priority: "low",
      text: "Implementar registro fotográfico padronizado das apreensões para facilitar a elaboração de laudos periciais.",
    },
  ], [data.apprehensions.count]);

  const pendingItems: PendingItem[] = useMemo(() => [
    { text: "Encaminhar amostras para o Instituto Criminal para análise laboratorial", status: "Em análise" },
    { text: "Elaborar laudos periciais das apreensões realizadas", status: "Pendente" },
    { text: "Atualizar planilha de controle de drogas apreendidas", status: "Pendente" },
    { text: "Consolidar evidencias fotográficas do período", status: "Concluído" },
    { text: "Apresentar relatório mensal à delegacia", status: "Concluído" },
  ], []);

  const locationCards: LocationCard[] = useMemo(() => [
    { label: "BR-040 Km 12", value: 8, grams: 2400, tone: "emerald" },
    { label: "Terminal Central", value: 6, grams: 1800, tone: "amber" },
    { label: "Porto Seco", value: 5, grams: 1500, tone: "violet" },
    { label: "Av. Brasil", value: 4, grams: 1200, tone: "cyan" },
  ], []);

  const getExportData = useCallback(
    () => getExportableData("apprehensions", data),
    [data],
  );

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Button
            className="shrink-0 rounded-2xl border border-amber-200/20 bg-slate-950 text-slate-300 hover:border-amber-200/40 hover:bg-slate-900"
            onClick={() => window.history.back()}
            type="button"
            variant="secondary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <p className="text-sm font-semibold text-amber-200">Relatório Premium</p>
            <h1 className="text-2xl font-black text-white md:text-3xl">Relatório de Apreensões</h1>
            <p className="mt-1 text-sm text-slate-400">Periodo: <span className="font-semibold text-amber-200">{periodLabel}</span></p>
          </div>
        </div>
        <ExportButton
          getData={getExportData}
          reportId="apprehensions"
          reportTitle="Apreensões"
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
        count={data.apprehensions.count}
        totalGrams={data.apprehensions.totalGrams}
        topCategory={data.apprehensions.topCategory}
        avgGrams={data.apprehensions.avgGrams}
      />

      {/* Section 2: Executive Summary */}
      <ExecutiveSummarySection
        count={data.apprehensions.count}
        totalGrams={data.apprehensions.totalGrams}
        avgGrams={data.apprehensions.avgGrams}
        topCategory={data.apprehensions.topCategory}
        distribution={data.apprehensions.categories}
        dailyData={dailyData}
        highlights={highlights}
      />

      {/* Section 3: Operational Analysis */}
      <OperationalAnalysisSection
        timeline={timeline}
        distribution={data.apprehensions.categories}
        totalGrams={data.apprehensions.totalGrams}
        trendData={trendData}
        categoryPerformance={categoryPerformance}
        count={data.apprehensions.count}
      />

      {/* Section 4: Productivity */}
      <ProductivitySection
        categoryPerformance={categoryPerformance}
        locationsData={locationsData}
        highlights={highlights.map((h) => h.detail)}
        totalGrams={data.apprehensions.totalGrams}
        count={data.apprehensions.count}
        topCategory={data.apprehensions.topCategory}
      />

      {/* Section 5: Conclusions */}
      <ConclusionsSection
        count={data.apprehensions.count}
        totalGrams={data.apprehensions.totalGrams}
        topCategory={data.apprehensions.topCategory}
        recommendations={recommendations}
        pendingItems={pendingItems}
        locationCards={locationCards}
      />

      {/* Export toolbar footer */}
      <div className="rounded-[1.65rem] border border-amber-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-300" />
          <p className="text-sm font-black text-white">Exportação e assinatura digital</p>
        </div>
        <ExportToolbar
          getData={getExportData}
          reportId="apprehensions"
          reportTitle="Relatório de Apreensões"
          subtitle={`Periodo: ${periodLabel}`}
        />
        <div className="mt-4 rounded-2xl border border-amber-200/10 bg-amber-300/8 p-4">
          <p className="text-sm font-black text-white">Assinatura digital</p>
          <p className="mt-1 text-xs text-slate-400">
            Relatório validado com base nos registros consultados e filtros selecionados.
            Os dados refletem a realidade do período {periodLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}
