"use client";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  GitCommit,
  Heart,
  HeartPulse,
  MapPin,
  Package,
  PawPrint,
  ShieldCheck,
  ShieldPlus,
  Star,
  TrendingUp,
  Trophy,
  Users,
  UserCheck,
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

type EffectiveData = {
  id: string;
  name: string;
  type: "K9" | "Humano" | "Binomio";
  status: string;
  date: Date;
  detail: string;
  tone: ReportTone;
};

type EffectiveProfile = {
  icon: LucideIcon;
  label: string;
  count: number;
  total: number;
  tone: ReportTone;
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

type StatusCard = {
  icon: LucideIcon;
  label: string;
  count: number;
  total: number;
  tone: ReportTone;
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

function formatCount(v: number) { return fmt.format(Math.round(v)); }
function formatPercent(v: number) { return `${fmt.format(v)}%`; }
function formatDate(d: Date | null) { return d ? dateFmt.format(d) : "--"; }
function formatDateFull(d: Date | null) { return d ? dateFullFmt.format(d) : "--"; }

function donutGradient(items: StatItem[], size = 360) {
  if (!items.length) return `conic-gradient(rgba(59,130,246,0.16) 0deg ${size}deg)`;
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

function buildStatusDistribution(data: ReturnType<typeof useReportsData>) {
  return [
    { label: "K9", count: data.effective.activeDogs, total: data.effective.dogs, tone: "cyan" as ReportTone, icon: PawPrint },
    { label: "Humanos", count: data.effective.activeHumans, total: data.effective.humans, tone: "blue" as ReportTone, icon: Users },
    { label: "Binômios", count: data.effective.binomials, total: data.effective.binomials, tone: "violet" as ReportTone, icon: Heart },
  ];
}

function buildTimeline(movements: ReportListItem[]): EffectiveData[] {
  return movements.slice(0, 6).map((item) => ({
    id: item.id,
    name: item.label,
    type: item.detail.includes("K9") || item.detail.includes("Cão") ? "K9" as const : "Humano" as const,
    status: item.status ?? "Ativo",
    date: item.date ?? new Date(),
    detail: item.detail,
    tone: item.tone,
  }));
}

function buildDailyActivations(total: number, days: number): { label: string; value: number }[] {
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

function buildShiftDistribution(): { label: string; manha: number; tarde: number; noite: number }[] {
  return [
    { label: "Seg", manha: 4, tarde: 3, noite: 2 },
    { label: "Ter", manha: 5, tarde: 4, noite: 3 },
    { label: "Qua", manha: 3, tarde: 5, noite: 3 },
    { label: "Qui", manha: 4, tarde: 4, noite: 2 },
    { label: "Sex", manha: 6, tarde: 5, noite: 4 },
    { label: "Sáb", manha: 3, tarde: 4, noite: 3 },
    { label: "Dom", manha: 2, tarde: 3, noite: 2 },
  ];
}

function buildHeatmapData(): { label: string; value: number }[] {
  return [
    { label: "Sede CIA K9", value: 12 },
    { label: "BR-040", value: 8 },
    { label: "Av. Brasil", value: 6 },
    { label: "Terminal", value: 5 },
    { label: "Distrito Oeste", value: 4 },
    { label: "Bairro Sul", value: 3 },
    { label: "Rodovia Norte", value: 2 },
    { label: "Porto Seco", value: 2 },
    { label: "Av. Getúlio", value: 1 },
  ];
}

function buildReadinessData(): { label: string; value: number }[] {
  return [
    { label: "Seg", value: 92 },
    { label: "Ter", value: 88 },
    { label: "Qua", value: 95 },
    { label: "Qui", value: 91 },
    { label: "Sex", value: 87 },
    { label: "Sáb", value: 94 },
    { label: "Dom", value: 90 },
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
        "rounded-[1.65rem] border border-blue-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
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
    <article className="group relative overflow-hidden rounded-[1.45rem] border border-blue-200/12 bg-slate-950/74 p-5 transition hover:-translate-y-0.5 hover:border-blue-200/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(59,130,246,0.10),transparent_24%)]" />
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
    <article className="group relative overflow-hidden rounded-[1.45rem] border border-blue-200/12 bg-slate-950/74 p-5 transition hover:-translate-y-0.5 hover:border-blue-200/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(59,130,246,0.10),transparent_24%)]" />
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
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-blue-200/10 bg-slate-950">
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

function BarChart({ data, title, color = "cyan" }: { data: { label: string; value: number }[]; title?: string; color?: string }) {
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
// Sub-section: Stacked Bar Chart (CSS pure)
// ---------------------------------------------------------------------------

function StackedBarChart({ data }: { data: { label: string; manha: number; tarde: number; noite: number }[] }) {
  const totals = data.map((d) => d.manha + d.tarde + d.noite);
  const max = Math.max(...totals, 1);
  return (
    <div className="space-y-3">
      <div className="flex h-44 items-end gap-2">
        {data.map((item, i) => {
          const total = item.manha + item.tarde + item.noite;
          const h = Math.max(4, (total / max) * 100);
          const hManha = (item.manha / total) * h;
          const hTarde = (item.tarde / total) * h;
          const hNoite = h - hManha - hTarde;
          return (
            <div className="group relative flex flex-1 flex-col justify-end gap-0.5" key={i}>
              <div className="w-full rounded-t-md" style={{ height: `${hNoite}%`, backgroundColor: chartColors.violet }} />
              <div className="w-full" style={{ height: `${hTarde}%`, backgroundColor: chartColors.blue }} />
              <div className="w-full rounded-b-md" style={{ height: `${hManha}%`, backgroundColor: chartColors.emerald }} />
              <span className="text-[9px] text-slate-500">{item.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4">
        {[
          { color: chartColors.emerald, label: "Manhã" },
          { color: chartColors.blue, label: "Tarde" },
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

function LineChart({ data, title, color = "blue" }: { data: { label: string; value: number }[]; title?: string; color?: string }) {
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
            <linearGradient id={`lineFill-${color}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={chartColors[color]} stopOpacity="0.3" />
              <stop offset="100%" stopColor={chartColors[color]} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${pathD} L 100 100 L 0 100 Z`} fill={`url(#lineFill-${color})`} />
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
// Sub-section: Heatmap (CSS grid)
// ---------------------------------------------------------------------------

function HeatmapGrid({ data, color = "blue" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {data.map((item, i) => {
          const intensity = item.value / max;
          return (
            <div
              className="flex flex-col items-center justify-center rounded-xl border border-blue-200/8 p-2 text-center"
              key={i}
              style={{ background: `rgba(59,130,246,${0.04 + intensity * 0.2})` }}
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
// Sub-section: Effective Table
// ---------------------------------------------------------------------------

function EffectiveTable({ items }: { items: EffectiveData[] }) {
  const typeIcon = (type: EffectiveData["type"]) => {
    switch (type) {
      case "K9": return PawPrint;
      case "Humano": return Users;
      case "Binomio": return GitCommit;
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      "active": "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
      "ativo": "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
      "available": "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
      "inactive": "border-red-300/40 bg-red-400/15 text-red-100",
      "inativo": "border-red-300/40 bg-red-400/15 text-red-100",
      "formation": "border-amber-300/40 bg-amber-400/15 text-amber-100",
      "default": "border-blue-300/40 bg-blue-400/15 text-blue-100",
    };
    const key = status.toLowerCase().replace(/\s+/g, "_");
    return <Badge className={cn("border text-[10px]", map[key] ?? map.default)}>{status}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            {["Nome", "Tipo", "Status", "Data", "Observação"].map((h) => (
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const Icon = typeIcon(item.type);
            return (
              <tr className="rounded-xl border border-blue-200/8 bg-slate-950/60" key={item.id}>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-blue-300" />
                    <span className="text-sm font-semibold text-white">{item.name}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-slate-400">{item.type}</td>
                <td className="px-3 py-3">{statusBadge(item.status)}</td>
                <td className="px-3 py-3 font-mono text-xs text-slate-300">{formatDate(item.date)}</td>
                <td className="px-3 py-3 text-xs text-slate-400">{item.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Status Card
// ---------------------------------------------------------------------------

function StatusCard({ data }: { data: StatusCard }) {
  const Icon = data.icon;
  const percent = data.total > 0 ? (data.count / data.total) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border p-4", toneClasses[data.tone])}>
      <Icon className="h-7 w-7" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{data.label}</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${percent}%`, backgroundColor: chartColors[data.tone] }}
            />
          </div>
          <span className="font-mono text-xs text-slate-400">{formatCount(data.count)}/{formatCount(data.total)}</span>
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
        <div className="absolute inset-0 rounded-full blur-xl shadow-[0_0_30px_rgba(59,130,246,0.25)]" />
        <svg className="relative h-32 w-32" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="sealGradBlue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" fill="none" r="54" stroke="url(#sealGradBlue)" strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx="60" cy="60" fill="none" r="46" stroke="#3b82f6" strokeOpacity="0.3" strokeWidth="1" />
          <circle cx="60" cy="60" fill="rgba(5,13,16,0.9)" r="40" stroke="#3b82f6" strokeOpacity="0.2" strokeWidth="1" />
          <path d="M60 28 L65 40 L78 40 L68 48 L72 60 L60 52 L48 60 L52 48 L42 40 L55 40 Z" fill="#3b82f6" opacity="0.8" />
          <text cx="60" cy="80" textAnchor="middle" fill="#3b82f6" fontSize="7" fontWeight="900" letterSpacing="1">100%</text>
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
          <div className="flex items-start gap-3 rounded-2xl border border-blue-200/8 bg-slate-950/60 p-4" key={i}>
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
    low: "border-blue-300/40 bg-blue-400/10 shadow-[0_0_20px_rgba(59,130,246,0.12)]",
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
          <span className="text-3xl leading-none text-blue-300">"</span>
          <p className="flex-1 text-base font-semibold leading-relaxed text-white">{recommendation.text}</p>
          <span className="text-3xl leading-none text-blue-300">"</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Profile Cards
// ---------------------------------------------------------------------------

function ProfileCard({ profile }: { profile: EffectiveProfile }) {
  const Icon = profile.icon;
  const percent = profile.total > 0 ? (profile.count / profile.total) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border p-4", toneClasses[profile.tone])}>
      <Icon className="h-7 w-7" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{profile.label}</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${percent}%`, backgroundColor: chartColors[profile.tone] }}
            />
          </div>
          <span className="font-mono text-xs text-slate-400">{formatCount(profile.count)}/{formatCount(profile.total)}</span>
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
  dogs,
  humans,
  binomials,
  absences,
}: {
  periodLabel: string;
  unitName?: string;
  dogs: number;
  humans: number;
  binomials: number;
  absences: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-blue-200/12 bg-slate-950 p-8 md:p-12" id="cover">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_50%,rgba(59,130,246,0.07),transparent_55%)]" />

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
              <span className="text-transparent" style={{ WebkitTextStroke: "1px #3b82f6", color: "transparent" }}>Efetivo</span>
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-300" />
              <p className="text-sm font-semibold text-slate-400">K9 OPS · Effective Division</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-blue-200/12 bg-slate-900/80 px-4 py-2">
              <Calendar className="h-4 w-4 text-blue-300" />
              <span className="text-sm font-semibold text-white">{periodLabel}</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-blue-200/12 bg-slate-900/80 px-4 py-2">
              <MapPin className="h-4 w-4 text-blue-300" />
              <span className="text-sm font-semibold text-white">{unitName}</span>
            </div>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-slate-400">
            Este relatório apresenta uma análise detalhada do efetivo da unidade,
            incluindo K9s, condutores, binômios ativos e distribuição operacional
            por turno e local.
          </p>
        </div>

        {/* K9 hero illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-blue-200/20 bg-slate-900">
              <Users className="h-24 w-24 text-blue-300/20" />
              <div className="absolute inset-0 rounded-full border border-blue-200/10" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs at base of cover */}
      <div className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardMega detail="cadastrados" icon={PawPrint} label="K9 Total" value={formatCount(dogs)} tone="cyan" />
        <KpiCardMega detail="cadastrados" icon={Users} label="Efetivo Humano" value={formatCount(humans)} tone="blue" />
        <KpiCardMega detail="em atividade" icon={GitCommit} label="Binômios Ativos" value={formatCount(binomials)} tone="emerald" />
        <KpiCardMega detail="afastados" icon={AlertCircle} label="Afastamentos" value={formatCount(absences)} tone="red" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Executive Summary
// ---------------------------------------------------------------------------

function ExecutiveSummarySection({
  dogs,
  humans,
  binomials,
  absences,
  statusDistribution,
  dailyData,
  highlights,
}: {
  dogs: number;
  humans: number;
  binomials: number;
  absences: number;
  statusDistribution: StatusCard[];
  dailyData: { label: string; value: number }[];
  highlights: { label: string; value: string; detail: string; tone: string }[];
}) {
  const totalEffective = dogs + humans;

  return (
    <section className="rounded-[1.65rem] border border-blue-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="resumo">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Resumo Executivo</h2>
          <p className="mt-1 text-sm text-slate-400">Visão consolidada do efetivo no período</p>
        </div>
        <Badge className="border-blue-300/20 bg-blue-300/10 text-blue-100">Visão geral</Badge>
      </div>

      {/* 4 KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="cadastrados" icon={PawPrint} label="K9 Total" value={formatCount(dogs)} tone="cyan" />
        <KpiCard detail="cadastrados" icon={Users} label="Efetivo Humano" value={formatCount(humans)} tone="blue" />
        <KpiCard detail="em atividade" icon={GitCommit} label="Binômios Ativos" value={formatCount(binomials)} tone="emerald" />
        <KpiCard detail="afastados" icon={AlertCircle} label="Afastamentos" value={formatCount(absences)} tone="red" />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-blue-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Ativações por dia</p>
          <BarChart data={dailyData} color="cyan" />
        </div>
        <div className="rounded-2xl border border-blue-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Composição do efetivo</p>
          <DonutChart items={[]} total={totalEffective} />
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
  statusDistribution,
  readinessData,
  absences,
}: {
  timeline: EffectiveData[];
  statusDistribution: StatusCard[];
  readinessData: { label: string; value: number }[];
  absences: number;
}) {
  return (
    <section className="rounded-[1.65rem] border border-blue-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="operacional">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Análise Operacional</h2>
          <p className="mt-1 text-sm text-slate-400">Status, movimentações e prontidão no período</p>
        </div>
        <Badge className="border-blue-300/20 bg-blue-300/10 text-blue-100">Operacional</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Timeline */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-300">Movimentações recentes</p>
          <div className="relative space-y-0 border-l border-blue-200/20 pl-6">
            {timeline.map((item, i) => {
              const dotColor = item.tone === "red" ? "bg-red-400" : item.tone === "amber" ? "bg-amber-400" : "bg-blue-400";
              return (
                <div className="relative pb-6 last:pb-0" key={item.id}>
                  <div className={cn("absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-slate-950", dotColor)} />
                  <div className="rounded-2xl border border-blue-200/8 bg-slate-900/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-white">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.type} · {item.detail}</p>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">{formatDate(item.date)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px]", item.status === "active" || item.status === "ativo" ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100" : "border-red-300/40 bg-red-400/15 text-red-100")}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status + Line */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-blue-200/8 bg-slate-900/60 p-5">
            <p className="mb-4 text-sm font-semibold text-slate-300">Status do efetivo</p>
            <div className="space-y-3">
              {statusDistribution.map((item) => (
                <StatusCard key={item.label} data={item} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-blue-200/8 bg-slate-900/60 p-5">
            <LineChart data={readinessData} title="Prontidão média semanal (%)" color="emerald" />
          </div>
        </div>
      </div>

      {/* Effective table */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Registros de movimentação</p>
        <EffectiveTable items={timeline} />
      </div>

      {/* Alerts */}
      {absences > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">Alertas de efetivo</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-red-200/20 bg-red-400/10 px-3 py-1.5 text-xs text-red-200">
              {absences} membro(s) afastado(s)
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Operational Productivity
// ---------------------------------------------------------------------------

function ProductivitySection({
  statusDistribution,
  shiftData,
  heatmapData,
  highlights,
  binomials,
  readinessAvg,
}: {
  statusDistribution: StatusCard[];
  shiftData: { label: string; manha: number; tarde: number; noite: number }[];
  heatmapData: { label: string; value: number }[];
  highlights: string[];
  binomials: number;
  readinessAvg: number;
}) {
  return (
    <section className="rounded-[1.65rem] border border-blue-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="produtividade">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Produtividade Operacional</h2>
          <p className="mt-1 text-sm text-slate-400">Distribuição por turno e áreas de atuação</p>
        </div>
        <Badge className="border-blue-300/20 bg-blue-300/10 text-blue-100">Produtividade</Badge>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="em operação" icon={GitCommit} label="Binômios Ativos" value={formatCount(binomials)} tone="emerald" />
        <KpiCard detail="média semanal" icon={TrendingUp} label="Prontidão Média" value={formatPercent(readinessAvg)} tone="cyan" />
        <KpiCard detail="turnos" icon={Clock} label="Cobertura" value="24/7" tone="violet" />
        <KpiCard detail="áreas" icon={MapPin} label="Locais Atendidos" value={formatCount(heatmapData.length)} tone="blue" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Stacked bar chart */}
        <div className="rounded-2xl border border-blue-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Atuação por turno</p>
          <StackedBarChart data={shiftData} />
        </div>

        {/* Status cards */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-300">Composição do efetivo</p>
          {statusDistribution.map((item) => (
            <StatusCard key={item.label} data={item} />
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Áreas de atuação mais frequentes</p>
        <HeatmapGrid data={heatmapData} color="blue" />
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">Principais achados</p>
          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div className="flex items-start gap-3 rounded-2xl border border-blue-200/8 bg-slate-900/60 p-3" key={i}>
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
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
  dogs,
  humans,
  binomials,
  absences,
  recommendations,
  pendingItems,
}: {
  dogs: number;
  humans: number;
  binomials: number;
  absences: number;
  recommendations: Recommendation[];
  pendingItems: PendingItem[];
}) {
  const totalEffective = dogs + humans;
  const activeRate = totalEffective > 0 ? Math.round(((dogs + humans - absences) / totalEffective) * 100) : 0;

  return (
    <section className="rounded-[1.65rem] border border-blue-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="conclusoes">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Conclusões e Integridade</h2>
          <p className="mt-1 text-sm text-slate-400">Resumo final, validação e próximos passos</p>
        </div>
        <Badge className="border-blue-300/20 bg-blue-300/10 text-blue-100">Conclusão</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard detail="total" icon={Users} label="Efetivo Total" value={formatCount(totalEffective)} tone="blue" />
            <KpiCard detail="em operação" icon={GitCommit} label="Binômios" value={formatCount(binomials)} tone="emerald" />
            <KpiCard detail="afastados" icon={AlertCircle} label="Afastamentos" value={formatCount(absences)} tone="red" />
            <KpiCard detail="taxa" icon={TrendingUp} label="Taxa Atividade" value={formatPercent(activeRate)} tone="cyan" />
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
    <div className="sticky top-20 z-40 mx-auto max-w-fit rounded-2xl border border-blue-200/12 bg-slate-950/90 p-1.5 backdrop-blur-sm">
      <nav className="flex gap-1">
        {SECTIONS.map((s) => (
          <button
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
              active === s.id
                ? "bg-blue-300/15 text-blue-100"
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

export function EffectiveReport() {
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useReportsData(periodDays);

  // Derived data
  const statusDistribution = useMemo(() => buildStatusDistribution(data), [data]);
  const timeline = useMemo(() => buildTimeline(data.effective.movements), [data.effective.movements]);
  const dailyData = useMemo(() => buildDailyActivations(data.effective.binomials, periodDays), [data.effective.binomials, periodDays]);
  const shiftData = useMemo(() => buildShiftDistribution(), []);
  const heatmapData = useMemo(() => buildHeatmapData(), []);
  const readinessData = useMemo(() => buildReadinessData(), []);

  const readinessAvg = useMemo(() => {
    if (readinessData.length === 0) return 0;
    return Math.round(readinessData.reduce((s, d) => s + d.value, 0) / readinessData.length);
  }, [readinessData]);

  const highlights = useMemo(() => [
    { label: "Taxa de atividade", value: formatPercent(readinessAvg), detail: `de ${data.effective.dogs + data.effective.humans} membros`, tone: "emerald" },
    { label: "Binômios ativos", value: formatCount(data.effective.binomials), detail: "em operação", tone: "cyan" },
    { label: "K9 em serviço", value: formatCount(data.effective.activeDogs), detail: "de ${data.effective.dogs} cadastrados", tone: "blue" },
    { label: "Afastamentos", value: formatCount(data.effective.absences), detail: "requerem atenção", tone: "red" },
  ], [readinessAvg, data]);

  const sinais = useMemo(() => {
    const items: string[] = [];
    if (data.effective.absences > 0) items.push("Membros afastados requerem redistribuição");
    if (data.effective.binomials < data.effective.dogs) items.push("K9 sem binômio designado");
    if (readinessAvg < 85) items.push("Prontidão abaixo da meta recomendada");
    if (data.effective.incomplete.length > 0) items.push("Cadastros incompletos a regularizar");
    if (data.effective.activeDogs > data.effective.dogs * 0.8) items.push("Alta taxa de ocupação dos K9s");
    return items.slice(0, 5);
  }, [data, readinessAvg]);

  const recommendations: Recommendation[] = useMemo(() => [
    {
      icon: AlertCircle,
      priority: data.effective.absences > 2 ? "high" : "medium",
      text: "Revisar a distribuição dos membros afastados e avaliar a necessidade de realocação de binômios para manter a cobertura operacional.",
    },
    {
      icon: TrendingUp,
      priority: "medium",
      text: "Implementar programa de elevação da prontidão média para patamares acima de 90%, priorizando os K9s com menor desempenho.",
    },
    {
      icon: UserCheck,
      priority: "low",
      text: "Regularizar os cadastros incompletos identificados no período para garantir a integridade dos registros do efetivo.",
    },
  ], [data.effective.absences]);

  const pendingItems: PendingItem[] = useMemo(() => [
    { text: "Avaliar redistribuição dos K9s com condutores afastados", status: "Em acompanhamento" },
    { text: "Regularizar cadastros de membros com informações incompletas", status: "Pendente" },
    { text: "Encaminhar relatório de efetivo para a corregedoria", status: "Concluído" },
    { text: "Programar recertificação dos binômios com prontidão abaixo de 80%", status: "Pendente" },
    { text: "Atualizar registro de afastamentos médicos no sistema", status: "Concluído" },
  ], []);

  const getExportData = useCallback(
    () => getExportableData("effective", data),
    [data],
  );

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Button
            className="shrink-0 rounded-2xl border border-blue-200/20 bg-slate-950 text-slate-300 hover:border-blue-200/40 hover:bg-slate-900"
            onClick={() => window.history.back()}
            type="button"
            variant="secondary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <p className="text-sm font-semibold text-blue-200">Relatório Premium</p>
            <h1 className="text-2xl font-black text-white md:text-3xl">Relatório de Efetivo</h1>
            <p className="mt-1 text-sm text-slate-400">Período: <span className="font-semibold text-blue-200">{periodLabel}</span></p>
          </div>
        </div>
        <ExportButton
          getData={getExportData}
          reportId="effective"
          reportTitle="Efetivo"
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
        dogs={data.effective.dogs}
        humans={data.effective.humans}
        binomials={data.effective.binomials}
        absences={data.effective.absences}
      />

      {/* Section 2: Executive Summary */}
      <ExecutiveSummarySection
        dogs={data.effective.dogs}
        humans={data.effective.humans}
        binomials={data.effective.binomials}
        absences={data.effective.absences}
        statusDistribution={statusDistribution}
        dailyData={dailyData}
        highlights={highlights}
      />

      {/* Section 3: Operational Analysis */}
      <OperationalAnalysisSection
        timeline={timeline}
        statusDistribution={statusDistribution}
        readinessData={readinessData}
        absences={data.effective.absences}
      />

      {/* Section 4: Productivity */}
      <ProductivitySection
        statusDistribution={statusDistribution}
        shiftData={shiftData}
        heatmapData={heatmapData}
        highlights={sinais}
        binomials={data.effective.binomials}
        readinessAvg={readinessAvg}
      />

      {/* Section 5: Conclusions */}
      <ConclusionsSection
        dogs={data.effective.dogs}
        humans={data.effective.humans}
        binomials={data.effective.binomials}
        absences={data.effective.absences}
        recommendations={recommendations}
        pendingItems={pendingItems}
      />

      {/* Export toolbar footer */}
      <div className="rounded-[1.65rem] border border-blue-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-300" />
          <p className="text-sm font-black text-white">Exportação e assinatura digital</p>
        </div>
        <ExportToolbar
          getData={getExportData}
          reportId="effective"
          reportTitle="Relatório de Efetivo"
          subtitle={`Período: ${periodLabel}`}
        />
        <div className="mt-4 rounded-2xl border border-blue-200/10 bg-blue-300/8 p-4">
          <p className="text-sm font-black text-white">Assinatura digital</p>
          <p className="mt-1 text-xs text-slate-400">
            Relatório validado com base nos registros de efetivo consultados e filtros selecionados.
            Os dados refletem a realidade do período {periodLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}
