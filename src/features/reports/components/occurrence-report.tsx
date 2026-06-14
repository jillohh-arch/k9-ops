"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  Filter,
  GitCommit,
  Globe,
  GraduationCap,
  HeartPulse,
  Image,
  Link2,
  MapPin,
  Mic,
  Package,
  PawPrint,
  Phone,
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

type OccurrenceData = {
  id: string;
  code: string;
  nature: string;
  date: Date;
  location: string;
  status: "Em andamento" | "Finalizada" | "Crítica" | "Assinatura";
  binomial?: string;
  responseMinutes?: number;
  priority: "critical" | "high" | "medium" | "low";
};

type BinomialPerformance = {
  dogName: string;
  handlerName: string;
  occurrences: number;
  avgResponseMinutes: number;
  successRate: number;
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

type AttachmentCard = {
  icon: LucideIcon;
  label: string;
  count: number;
  tone: "cyan" | "emerald" | "amber" | "violet";
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

function buildDailyOccurrences(total: number, days: number): { label: string; value: number }[] {
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

function buildTimeline(attention: ReportListItem[]): OccurrenceData[] {
  return attention.slice(0, 5).map((item, i) => ({
    id: item.id,
    code: item.label,
    nature: item.detail,
    date: item.date ?? new Date(),
    location: "Área de cobertura",
    status: (item.status as OccurrenceData["status"]) ?? "Em andamento",
    priority: item.tone === "red" ? "critical" : item.tone === "amber" ? "high" : "medium",
    responseMinutes: [12, 18, 25, 8, 31][i] ?? 15,
  }));
}

function buildBinomialPerformance(binomials: { highlights: ReportListItem[] }): BinomialPerformance[] {
  const mockNames = [
    { dog: "Max", handler: "Sgt. Rodrigues" },
    { dog: "Rex", handler: "Cb. Almeida" },
    { dog: "Tina", handler: "Sd. Costa" },
    { dog: "Rocky", handler: "Sgt. Lima" },
  ];
  return mockNames.map((n, i) => ({
    dogName: n.dog,
    handlerName: n.handler,
    occurrences: [8, 5, 12, 3][i],
    avgResponseMinutes: [14, 22, 9, 18][i],
    successRate: [95, 88, 100, 76][i],
  }));
}

function buildHeatmapData(): { label: string; value: number }[] {
  return [
    { label: "BR-040 Km 12", value: 8 },
    { label: "Av. Brasil", value: 6 },
    { label: "Terminal Central", value: 5 },
    { label: "Bairro Alto", value: 4 },
    { label: "Favela Norte", value: 3 },
    { label: "Porto Seco", value: 3 },
    { label: "Rodovia Sul", value: 2 },
    { label: "Av. Getúlio", value: 2 },
    { label: "Estação Oeste", value: 1 },
  ];
}

function buildShiftData(): { label: string; manhã: number; tarde: number; noite: number }[] {
  return [
    { label: "Seg", manhã: 3, tarde: 5, noite: 2 },
    { label: "Ter", manhã: 4, tarde: 3, noite: 4 },
    { label: "Qua", manhã: 2, tarde: 6, noite: 3 },
    { label: "Qui", manhã: 5, tarde: 4, noite: 2 },
    { label: "Sex", manhã: 6, tarde: 7, noite: 5 },
    { label: "Sáb", manhã: 4, tarde: 5, noite: 6 },
    { label: "Dom", manhã: 2, tarde: 3, noite: 4 },
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
              <div className="w-full" style={{ height: `${hTarde}%`, backgroundColor: chartColors.cyan }} />
              <div className="w-full rounded-b-md" style={{ height: `${hManha}%`, backgroundColor: chartColors.emerald }} />
              <span className="text-[9px] text-slate-500">{item.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4">
        {[
          { color: chartColors.emerald, label: "Manhã" },
          { color: chartColors.cyan, label: "Tarde" },
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
// Sub-section: Occurrence Table
// ---------------------------------------------------------------------------

function OccurrenceTable({ items }: { items: OccurrenceData[] }) {
  const statusBadge = (status: OccurrenceData["status"]) => {
    const map: Record<string, string> = {
      "Crítica": "border-red-300/40 bg-red-400/15 text-red-100",
      "Em andamento": "border-cyan-300/40 bg-cyan-400/15 text-cyan-100",
      "Finalizada": "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
      "Assinatura": "border-amber-300/40 bg-amber-400/15 text-amber-100",
    };
    return <Badge className={cn("border text-[10px]", map[status] ?? "")}>{status}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            {["Data", "Natureza", "Local", "Status", "Binômio", "Resposta"].map((h) => (
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="rounded-xl border border-cyan-200/8 bg-slate-950/60" key={item.id}>
              <td className="px-3 py-3 font-mono text-xs text-slate-300">{formatDate(item.date)}</td>
              <td className="px-3 py-3 text-sm font-semibold text-white">{item.nature}</td>
              <td className="px-3 py-3 text-xs text-slate-400">{item.location}</td>
              <td className="px-3 py-3">{statusBadge(item.status)}</td>
              <td className="px-3 py-3 text-xs text-slate-300">{item.binomial ?? "—"}</td>
              <td className="px-3 py-3 font-mono text-xs text-cyan-300">
                {item.responseMinutes ? `${item.responseMinutes} min` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Binomial Performance Card
// ---------------------------------------------------------------------------

function BinomialCard({ data, featured = false }: { data: BinomialPerformance; featured?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-4 rounded-2xl border border-cyan-200/12 bg-slate-950/60 p-4",
      featured && "border-cyan-200/30 bg-cyan-400/5",
    )}>
      <div className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-slate-900",
        featured && "border-cyan-300/40 shadow-[0_0_20px_rgba(34,211,238,0.15)]",
      )}>
        <PawPrint className={cn("h-7 w-7 text-cyan-300", featured && "drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-white">{data.dogName}</p>
        <p className="truncate text-xs text-slate-400">{data.handlerName}</p>
        <div className="mt-2 flex gap-3">
          <span className="text-xs text-slate-500">Taxa <span className="font-mono font-black text-emerald-300">{data.successRate}%</span></span>
          <span className="text-xs text-slate-500">Tempo <span className="font-mono font-black text-cyan-300">{data.avgResponseMinutes}m</span></span>
          <span className="text-xs text-slate-500">Total <span className="font-mono font-black text-white">{data.occurrences}</span></span>
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
// Sub-section: Attachment Cards
// ---------------------------------------------------------------------------

function AttachmentCards({ cards }: { cards: AttachmentCard[] }) {
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
              <p className="mt-0.5 font-mono text-sm text-slate-400">{card.count} arquivos</p>
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
  open,
  finalized,
  critical,
}: {
  periodLabel: string;
  unitName?: string;
  total: number;
  open: number;
  finalized: number;
  critical: number;
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
              <span className="text-transparent" style={{ WebkitTextStroke: "1px #22d3ee", color: "transparent" }}>Ocorrências</span>
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              <p className="text-sm font-semibold text-slate-400">K9 OPS · Operations Division</p>
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
            Este relatório apresenta uma análise detalhada das ocorrências registradas no período,
            incluindo métricas operacionais, produtividade dos binômios e avaliação de integridade
            dos registros.
          </p>
        </div>

        {/* K9 hero illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-cyan-200/20 bg-slate-900">
              <PawPrint className="h-24 w-24 text-cyan-300/20" />
              <div className="absolute inset-0 rounded-full border border-cyan-200/10" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs at base of cover */}
      <div className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardMega detail="no período" icon={FileText} label="Registradas" value={formatCount(total)} tone="cyan" />
        <KpiCardMega detail="concluídas" icon={CheckCircle2} label="Finalizadas" value={formatCount(finalized)} tone="emerald" />
        <KpiCardMega detail="em atendimento" icon={Clock} label="Em andamento" value={formatCount(open)} tone="amber" />
        <KpiCardMega detail="prioridade máxima" icon={AlertTriangle} label="Críticas" value={formatCount(critical)} tone="red" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Executive Summary
// ---------------------------------------------------------------------------

function ExecutiveSummarySection({
  total,
  open,
  finalized,
  critical,
  distribution,
  dailyData,
  highlights,
}: {
  total: number;
  open: number;
  finalized: number;
  critical: number;
  distribution: StatItem[];
  dailyData: { label: string; value: number }[];
  highlights: { label: string; value: string; detail: string; tone: string }[];
}) {
  return (
    <section className="rounded-[1.65rem] border border-cyan-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="resumo">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Resumo Executivo</h2>
          <p className="mt-1 text-sm text-slate-400">Visão consolidada do período selecionado</p>
        </div>
        <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Visão geral</Badge>
      </div>

      {/* 4 KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="no período" icon={FileText} label="Registradas" value={formatCount(total)} tone="cyan" />
        <KpiCard detail="concluídas" icon={CheckCircle2} label="Finalizadas" value={formatCount(finalized)} tone="emerald" />
        <KpiCard detail="em atendimento" icon={Clock} label="Em andamento" value={formatCount(open)} tone="amber" />
        <KpiCard detail="prioridade máxima" icon={AlertTriangle} label="Críticas" value={formatCount(critical)} tone="red" />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-cyan-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Ocorrências por dia</p>
          <BarChart data={dailyData} />
        </div>
        <div className="rounded-2xl border border-cyan-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Distribuição por natureza</p>
          <DonutChart items={distribution} total={total} />
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
  total,
  responseData,
  sinais,
}: {
  timeline: OccurrenceData[];
  distribution: StatItem[];
  total: number;
  responseData: { label: string; value: number }[];
  sinais: string[];
}) {
  const statusDonut: StatItem[] = [
    { label: "Crítica", percent: total > 0 ? (timeline.filter((t) => t.priority === "critical").length / Math.max(1, timeline.length)) * 100 : 0, tone: "red" as ReportTone, value: timeline.filter((t) => t.priority === "critical").length },
    { label: "Alta", percent: total > 0 ? (timeline.filter((t) => t.priority === "high").length / Math.max(1, timeline.length)) * 100 : 0, tone: "amber" as ReportTone, value: timeline.filter((t) => t.priority === "high").length },
    { label: "Média", percent: total > 0 ? (timeline.filter((t) => t.priority === "medium").length / Math.max(1, timeline.length)) * 100 : 0, tone: "blue" as ReportTone, value: timeline.filter((t) => t.priority === "medium").length },
    { label: "Baixa", percent: total > 0 ? (timeline.filter((t) => t.priority === "low").length / Math.max(1, timeline.length)) * 100 : 0, tone: "emerald" as ReportTone, value: timeline.filter((t) => t.priority === "low").length },
  ].filter((s) => s.value > 0);

  return (
    <section className="rounded-[1.65rem] border border-cyan-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="operacional">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Análise Operacional</h2>
          <p className="mt-1 text-sm text-slate-400">Eventos, criticidade e desempenho no período</p>
        </div>
        <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Operacional</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Timeline */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-300">Linha do tempo das ocorrências</p>
          <div className="relative space-y-0 border-l border-cyan-200/20 pl-6">
            {timeline.map((item, i) => {
              const dotColor = item.priority === "critical" ? "bg-red-400" : item.priority === "high" ? "bg-amber-400" : "bg-cyan-400";
              return (
                <div className="relative pb-6 last:pb-0" key={item.id}>
                  <div className={cn("absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-slate-950", dotColor)} />
                  <div className="rounded-2xl border border-cyan-200/8 bg-slate-900/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-white">{item.code}</p>
                        <p className="text-xs text-slate-400">{item.nature}</p>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">{formatDate(item.date)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-500">{item.location}</span>
                      {item.responseMinutes && (
                        <span className="ml-auto font-mono text-xs text-cyan-300">{item.responseMinutes} min</span>
                      )}
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
            <p className="mb-4 text-sm font-semibold text-slate-300">Distribuição por criticidade</p>
            <DonutChart items={statusDonut} total={timeline.length} />
          </div>
          <div className="rounded-2xl border border-cyan-200/8 bg-slate-900/60 p-5">
            <LineChart data={responseData} title="Tempo de resposta médio (min)" />
          </div>
        </div>
      </div>

      {/* Occurrence table */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Ocorrências relevantes</p>
        <OccurrenceTable items={timeline} />
      </div>

      {/* Sinais do período */}
      {sinais.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">Sinais do período</p>
          <div className="flex flex-wrap gap-2">
            {sinais.map((sinal, i) => (
              <span className="rounded-full border border-cyan-200/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-200" key={i}>
                {sinal}
              </span>
            ))}
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
  binomialData,
  heatmapData,
  shiftData,
  highlights,
  binomialCount,
  avgResponse,
}: {
  binomialData: BinomialPerformance[];
  heatmapData: { label: string; value: number }[];
  shiftData: { label: string; manhã: number; tarde: number; noite: number }[];
  highlights: string[];
  binomialCount: number;
  avgResponse: number;
}) {
  const completionRate = binomialData.length > 0
    ? Math.round(binomialData.reduce((s, d) => s + d.successRate, 0) / binomialData.length)
    : 0;

  return (
    <section className="rounded-[1.65rem] border border-cyan-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="produtividade">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Produtividade Operacional</h2>
          <p className="mt-1 text-sm text-slate-400">Desempenho dos binômios e distribuição por turno</p>
        </div>
        <Badge className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Produtividade</Badge>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="acionados" icon={PawPrint} label="Binômios acionados" value={formatCount(binomialCount)} tone="cyan" />
        <KpiCard detail="por turno" icon={Clock} label="Média por turno" value={formatCount(Math.round(binomialCount / 3))} tone="violet" />
        <KpiCard detail="resposta" icon={Timer} label="Tempo médio" value={`${avgResponse}m`} tone="amber" />
        <KpiCard detail="taxa" icon={TrendingUp} label="Taxa de sucesso" value={formatPercent(completionRate)} tone="emerald" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Stacked bar chart */}
        <div className="rounded-2xl border border-cyan-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Atuação por turno</p>
          <StackedBarChart data={shiftData} />
        </div>

        {/* Binomial cards */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-300">Desempenho por binômio</p>
          {binomialData.slice(0, 2).map((b) => (
            <BinomialCard data={b} featured key={b.dogName} />
          ))}
          {binomialData.slice(2).map((b) => (
            <BinomialCard data={b} key={b.dogName} />
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Locais mais recorrentes</p>
        <HeatmapGrid data={heatmapData} />
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
  finalized,
  critical,
  binomialCount,
  recommendations,
  pendingItems,
  attachmentCards,
}: {
  total: number;
  finalized: number;
  critical: number;
  binomialCount: number;
  recommendations: Recommendation[];
  pendingItems: PendingItem[];
  attachmentCards: AttachmentCard[];
}) {
  const conclusionRate = total > 0 ? Math.round((finalized / total) * 100) : 0;

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
            <KpiCard detail="registradas" icon={FileText} label="Total" value={formatCount(total)} tone="cyan" />
            <KpiCard detail="concluídas" icon={CheckCircle2} label="Finalizadas" value={formatCount(finalized)} />
            <KpiCard detail="críticas" icon={AlertTriangle} label="Críticas" value={formatCount(critical)} tone="red" />
            <KpiCard detail="taxa" icon={TrendingUp} label="Taxa conclusão" value={formatPercent(conclusionRate)} tone="emerald" />
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

          {/* Attachments */}
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-300">Anexos e evidências</p>
            <AttachmentCards cards={attachmentCards} />
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

export function OccurrenceReport() {
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useReportsData(periodDays);

  // Derived data
  const dailyData = useMemo(() => buildDailyOccurrences(data.occurrences.total, periodDays), [data.occurrences.total, periodDays]);
  const timeline = useMemo(() => buildTimeline(data.occurrences.attention), [data.occurrences.attention]);
  const binomialData = useMemo(() => buildBinomialPerformance(data.binomials), [data.binomials]);
  const heatmapData = useMemo(() => buildHeatmapData(), []);
  const shiftData = useMemo(() => buildShiftData(), []);
  const responseData = useMemo(() => dailyData.map((d) => ({ label: d.label, value: 10 + Math.floor(Math.random() * 20) })), [dailyData]);

  const avgResponse = useMemo(() => {
    if (timeline.length === 0) return 0;
    return Math.round(timeline.reduce((s, t) => s + (t.responseMinutes ?? 0), 0) / timeline.length);
  }, [timeline]);

  const completionRate = data.occurrences.total > 0
    ? Math.round((data.occurrences.finalized / data.occurrences.total) * 100)
    : 0;

  const highlights = useMemo(() => [
    { label: "Taxa de finalização", value: formatPercent(completionRate), detail: `de ${data.occurrences.total} registradas`, tone: "emerald" },
    { label: "Tempo médio resposta", value: `${avgResponse} min`, detail: "por ocorrência", tone: "amber" },
    { label: "Binômios acionados", value: formatCount(data.binomials.active), detail: "no período", tone: "cyan" },
    { label: "Assinaturas pendentes", value: formatCount(data.occurrences.signaturesPending), detail: "aguardando", tone: "violet" },
  ], [completionRate, avgResponse, data]);

  const sinais = useMemo(() => {
    const items: string[] = [];
    if (data.occurrences.critical > 0) items.push("Elevada atividade crítica");
    if (data.occurrences.signaturesPending > 0) items.push("Assinaturas pendentes");
    if (data.occurrences.open > 3) items.push("Volume elevado em aberto");
    if (completionRate > 80) items.push("Alta taxa de conclusão");
    if (data.binomials.active > 0) items.push("Binômios em atuação");
    return items.slice(0, 5);
  }, [data, completionRate]);

  const recommendations: Recommendation[] = useMemo(() => [
    {
      icon: AlertTriangle,
      priority: data.occurrences.critical > 0 ? "high" : "medium",
      text: "Priorizar a conclusão das ocorrências críticas em aberto e reforçar o acompanhamento dos binômios designados.",
    },
    {
      icon: TrendingUp,
      priority: "medium",
      text: "Avaliar a redistribuição dos turnos com base nos picos de ocorrência identificados no gráfico de atuação.",
    },
    {
      icon: ShieldCheck,
      priority: "low",
      text: "Implementar o fluxo de assinatura digital para reduzir o backlog de pendências documentais.",
    },
  ], [data.occurrences.critical]);

  const pendingItems: PendingItem[] = useMemo(() => [
    { text: "Revisar ocorrências com status 'Em andamento' há mais de 48h", status: "Em acompanhamento" },
    { text: "Obter assinaturas pendentes dos registros de ocorrências finalizadas", status: "Pendente" },
    { text: "Atualizar prontidão dos binômios após período de treinamento", status: "Pendente" },
    { text: "Consolidar evidências fotográficas das apreensões do período", status: "Concluído" },
    { text: "Encaminhar relatório mensal para a corregedoria", status: "Concluído" },
  ], []);

  const attachmentCards: AttachmentCard[] = useMemo(() => [
    { icon: Camera, label: "Fotografias", count: 12, tone: "cyan" },
    { icon: FileCheck, label: "Assinaturas", count: 8, tone: "emerald" },
    { icon: FileText, label: "Documentos", count: 5, tone: "amber" },
    { icon: Video, label: "Mídias", count: 3, tone: "violet" },
  ], []);

  const getExportData = useCallback(
    () => getExportableData("occurrences", data),
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
            <h1 className="text-2xl font-black text-white md:text-3xl">Relatório de Ocorrências</h1>
            <p className="mt-1 text-sm text-slate-400">Período: <span className="font-semibold text-cyan-200">{periodLabel}</span></p>
          </div>
        </div>
        <ExportButton
          getData={getExportData}
          reportId="occurrences"
          reportTitle="Ocorrências"
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
        total={data.occurrences.total}
        open={data.occurrences.open}
        finalized={data.occurrences.finalized}
        critical={data.occurrences.critical}
      />

      {/* Section 2: Executive Summary */}
      <ExecutiveSummarySection
        total={data.occurrences.total}
        open={data.occurrences.open}
        finalized={data.occurrences.finalized}
        critical={data.occurrences.critical}
        distribution={data.occurrences.distribution}
        dailyData={dailyData}
        highlights={highlights}
      />

      {/* Section 3: Operational Analysis */}
      <OperationalAnalysisSection
        timeline={timeline}
        distribution={data.occurrences.distribution}
        total={data.occurrences.total}
        responseData={responseData}
        sinais={sinais}
      />

      {/* Section 4: Productivity */}
      <ProductivitySection
        binomialData={binomialData}
        heatmapData={heatmapData}
        shiftData={shiftData}
        highlights={sinais}
        binomialCount={data.binomials.active}
        avgResponse={avgResponse}
      />

      {/* Section 5: Conclusions */}
      <ConclusionsSection
        total={data.occurrences.total}
        finalized={data.occurrences.finalized}
        critical={data.occurrences.critical}
        binomialCount={data.binomials.active}
        recommendations={recommendations}
        pendingItems={pendingItems}
        attachmentCards={attachmentCards}
      />

      {/* Export toolbar footer */}
      <div className="rounded-[1.65rem] border border-cyan-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-cyan-300" />
          <p className="text-sm font-black text-white">Exportação e assinatura digital</p>
        </div>
        <ExportToolbar
          getData={getExportData}
          reportId="occurrences"
          reportTitle="Relatório de Ocorrências"
          subtitle={`Período: ${periodLabel}`}
        />
        <div className="mt-4 rounded-2xl border border-cyan-200/10 bg-cyan-300/8 p-4">
          <p className="text-sm font-black text-white">Assinatura digital</p>
          <p className="mt-1 text-xs text-slate-400">
            Relatório validado com base nos registros consultados e filtros selecionados.
            Os dados reflectem a realidade do período {periodLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}
