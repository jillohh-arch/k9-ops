"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Heart,
  HeartPulse,
  Plus,
  RefreshCw,
  ShieldCheck,
  Siren,
  Stethoscope,
  Syringe,
  Thermometer,
  Timer,
  TrendingUp,
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

type HealthEvent = {
  id: string;
  dogName: string;
  type: string;
  date: Date;
  status: "Em tratamento" | "Concluído" | "Pendente" | "Crítico";
  priority: "critical" | "high" | "medium" | "low";
  description?: string;
  nextAppointment?: Date;
};

type TreatmentData = {
  dogName: string;
  handler: string;
  status: string;
  startDate: Date;
  sessions: number;
  completed: number;
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

type VaccineCard = {
  icon: LucideIcon;
  label: string;
  count: number;
  tone: "red" | "emerald" | "amber" | "violet";
};

// ---------------------------------------------------------------------------
// Design tokens (matching project theme - red tone for health)
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
  if (!items.length) return `conic-gradient(rgba(251,113,133,0.16) 0deg ${size}deg)`;
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

function buildDailyEvents(total: number, days: number): { label: string; value: number }[] {
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

function buildHealthTimeline(attention: ReportListItem[]): HealthEvent[] {
  return attention.slice(0, 5).map((item, i) => ({
    id: item.id,
    dogName: item.label,
    type: item.detail,
    date: item.date ?? new Date(),
    status: (item.status as HealthEvent["status"]) ?? "Pendente",
    priority: item.tone === "red" ? "critical" : item.tone === "amber" ? "high" : "medium",
    nextAppointment: i === 0 ? new Date(Date.now() + 86400000 * (i + 1)) : undefined,
  }));
}

function buildTreatmentData(attention: ReportListItem[]): TreatmentData[] {
  const mockTreatments = [
    { dog: "Max", handler: "Sgt. Rodrigues" },
    { dog: "Rex", handler: "Cb. Almeida" },
    { dog: "Tina", handler: "Sd. Costa" },
    { dog: "Rocky", handler: "Sgt. Lima" },
    { dog: "Fido", handler: "Cb. Santos" },
  ];
  return mockTreatments.map((t, i) => ({
    dogName: t.dog,
    handler: t.handler,
    status: i % 3 === 0 ? "Em tratamento" : i % 3 === 1 ? "Concluído" : "Pendente",
    startDate: new Date(Date.now() - 86400000 * (i * 3 + 1)),
    sessions: [8, 12, 6, 10, 4][i],
    completed: [5, 12, 3, 7, 0][i],
  }));
}

function buildVaccineData(): { label: string; value: number }[] {
  return [
    { label: "Raiva", value: 12 },
    { label: "V8/V10", value: 10 },
    { label: "Giárdia", value: 8 },
    { label: "Leptospirose", value: 6 },
    { label: "Gripe", value: 5 },
    { label: "Tosse", value: 3 },
  ];
}

function buildMonthlyData(): { label: string; events: number; treatments: number }[] {
  return [
    { label: "Jan", events: 8, treatments: 5 },
    { label: "Fev", events: 12, treatments: 7 },
    { label: "Mar", events: 6, treatments: 4 },
    { label: "Abr", events: 15, treatments: 9 },
    { label: "Mai", events: 10, treatments: 6 },
    { label: "Jun", events: 9, treatments: 5 },
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
        "rounded-[1.65rem] border border-red-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
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
  tone = "red",
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.45rem] border border-red-200/12 bg-slate-950/74 p-5 transition hover:-translate-y-0.5 hover:border-red-200/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(251,113,133,0.10),transparent_24%)]" />
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
  tone = "red",
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.45rem] border border-red-200/12 bg-slate-950/74 p-5 transition hover:-translate-y-0.5 hover:border-red-200/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(251,113,133,0.10),transparent_24%)]" />
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
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-red-200/10 bg-slate-950">
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
                background: `linear-gradient(to top, ${chartColors[["red", "emerald", "violet", "amber", "blue", "cyan"][i % 6]]}cc, ${chartColors[["red", "emerald", "violet", "amber", "blue", "cyan"][i % 6]]}66)`,
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

function StackedBarChart({ data }: { data: { label: string; events: number; treatments: number }[] }) {
  const totals = data.map((d) => d.events + d.treatments);
  const max = Math.max(...totals, 1);
  return (
    <div className="space-y-3">
      <div className="flex h-44 items-end gap-2">
        {data.map((item, i) => {
          const total = item.events + item.treatments;
          const h = Math.max(4, (total / max) * 100);
          const hEvents = (item.events / total) * h;
          const hTreatments = h - hEvents;
          return (
            <div className="group relative flex flex-1 flex-col justify-end gap-0.5" key={i}>
              <div className="w-full rounded-t-md" style={{ height: `${hTreatments}%`, backgroundColor: chartColors.violet }} />
              <div className="w-full rounded-b-md" style={{ height: `${hEvents}%`, backgroundColor: chartColors.red }} />
              <span className="text-[9px] text-slate-500">{item.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4">
        {[
          { color: chartColors.red, label: "Eventos" },
          { color: chartColors.violet, label: "Tratamentos" },
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

function LineChart({ data, title, color = "red" }: { data: { label: string; value: number }[]; title?: string; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 100 - ((d.value - min) / range) * 100,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const colorHex = chartColors[color] || chartColors.red;

  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-semibold text-slate-300">{title}</p>}
      <div className="relative h-36 w-full overflow-hidden">
        <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="lineFillHealth" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={colorHex} stopOpacity="0.3" />
              <stop offset="100%" stopColor={colorHex} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${pathD} L 100 100 L 0 100 Z`} fill="url(#lineFillHealth)" />
          <path d={pathD} fill="none" stroke={colorHex} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle cx={p.x} cy={p.y} fill={colorHex} key={i} r="2" vectorEffect="non-scaling-stroke" />
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
// Sub-section: Progress Ring (CSS conic-gradient)
// ---------------------------------------------------------------------------

function ProgressRing({ percent, label, color = "emerald" }: { percent: number; label: string; color?: string }) {
  const colorHex = chartColors[color] || chartColors.emerald;
  const bgColor = `${colorHex}33`;
  const angle = (percent / 100) * 360;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24 rounded-full p-4" style={{ background: `conic-gradient(${colorHex} 0deg ${angle}deg, ${bgColor} ${angle}deg 360deg)` }}>
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-red-200/10 bg-slate-950">
          <span className="font-mono text-2xl font-black text-white">{formatPercent(percent)}</span>
        </div>
      </div>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Health Timeline Card
// ---------------------------------------------------------------------------

function HealthTimelineCard({ event }: { event: HealthEvent }) {
  const statusBadge = (status: HealthEvent["status"]) => {
    const map: Record<string, string> = {
      "Crítico": "border-red-300/40 bg-red-400/15 text-red-100",
      "Em tratamento": "border-amber-300/40 bg-amber-400/15 text-amber-100",
      "Pendente": "border-violet-300/40 bg-violet-400/15 text-violet-100",
      "Concluído": "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
    };
    return <Badge className={cn("border text-[10px]", map[status] ?? "")}>{status}</Badge>;
  };

  return (
    <div className="rounded-2xl border border-red-200/8 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-black text-white">{event.dogName}</p>
          <p className="text-xs text-slate-400">{event.type}</p>
        </div>
        {statusBadge(event.status)}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Calendar className="h-3 w-3" />
          {formatDate(event.date)}
        </span>
        {event.nextAppointment && (
          <span className="flex items-center gap-1 text-xs text-amber-300">
            <Clock className="h-3 w-3" />
            Próx: {formatDate(event.nextAppointment)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Treatment Card
// ---------------------------------------------------------------------------

function TreatmentCard({ data }: { data: TreatmentData }) {
  const progress = (data.completed / data.sessions) * 100;
  const statusColor = data.status === "Concluído" ? "emerald" : data.status === "Em tratamento" ? "amber" : "violet";

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-red-200/12 bg-slate-950/60 p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-200/20 bg-slate-900">
        <Stethoscope className="h-6 w-6 text-red-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-white">{data.dogName}</p>
        <p className="truncate text-xs text-slate-400">{data.handler}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: chartColors[statusColor] }}
            />
          </div>
          <span className="text-xs text-slate-500">{data.completed}/{data.sessions}</span>
        </div>
      </div>
      <Badge className={cn("border shrink-0 text-[10px]", toneClasses[statusColor])}>{data.status}</Badge>
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
        <div className="absolute inset-0 rounded-full blur-xl shadow-[0_0_30px_rgba(251,113,133,0.25)]" />
        <svg className="relative h-32 w-32" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="sealGradHealth" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fb7185" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" fill="none" r="54" stroke="url(#sealGradHealth)" strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx="60" cy="60" fill="none" r="46" stroke="#fb7185" strokeOpacity="0.3" strokeWidth="1" />
          <circle cx="60" cy="60" fill="rgba(5,13,16,0.9)" r="40" stroke="#fb7185" strokeOpacity="0.2" strokeWidth="1" />
          <path d="M60 28 L65 40 L78 40 L68 48 L72 60 L60 52 L48 60 L52 48 L42 40 L55 40 Z" fill="#fb7185" opacity="0.8" />
          <text cx="60" cy="80" textAnchor="middle" fill="#fb7185" fontSize="7" fontWeight="900" letterSpacing="1">100%</text>
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
          <div className="flex items-start gap-3 rounded-2xl border border-red-200/8 bg-slate-950/60 p-4" key={i}>
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
          <span className="text-3xl leading-none text-red-300">&ldquo;</span>
          <p className="flex-1 text-base font-semibold leading-relaxed text-white">{recommendation.text}</p>
          <span className="text-3xl leading-none text-red-300">&rdquo;</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Vaccine Cards
// ---------------------------------------------------------------------------

function VaccineCards({ cards }: { cards: VaccineCard[] }) {
  const toneMap: Record<string, string> = {
    red: "border-red-300/30 bg-red-400/10 text-red-100",
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
              <p className="mt-0.5 font-mono text-sm text-slate-400">{card.count} doses</p>
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
  events,
  pending,
  treatments,
  readyPercent,
}: {
  periodLabel: string;
  unitName?: string;
  events: number;
  pending: number;
  treatments: number;
  readyPercent: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-red-200/12 bg-slate-950 p-8 md:p-12" id="cover">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_50%,rgba(251,113,133,0.07),transparent_55%)]" />

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
              <span className="text-transparent" style={{ WebkitTextStroke: "1px #fb7185", color: "transparent" }}>Saúde</span>
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-red-300" />
              <p className="text-sm font-semibold text-slate-400">K9 OPS · Divisão Veterinária</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-red-200/12 bg-slate-900/80 px-4 py-2">
              <Calendar className="h-4 w-4 text-red-300" />
              <span className="text-sm font-semibold text-white">{periodLabel}</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-red-200/12 bg-slate-900/80 px-4 py-2">
              <Stethoscope className="h-4 w-4 text-red-300" />
              <span className="text-sm font-semibold text-white">{unitName}</span>
            </div>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-slate-400">
            Este relatório apresenta uma análise detalhada da saúde do efetivo K9 no período,
            incluindo atendimentos veterinários, tratamentos em andamento, calendário vacinal
            e avaliação da prontidão clínica dos animais.
          </p>
        </div>

        {/* Health hero illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-red-500/10 blur-3xl" />
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-red-200/20 bg-slate-900">
              <Heart className="h-24 w-24 text-red-300/20" />
              <div className="absolute inset-0 rounded-full border border-red-200/10" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs at base of cover */}
      <div className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardMega detail="no período" icon={HeartPulse} label="Atendimentos" value={formatCount(events)} tone="red" />
        <KpiCardMega detail="requerem atenção" icon={AlertTriangle} label="Pendências" value={formatCount(pending)} tone="amber" />
        <KpiCardMega detail="em acompanhamento" icon={Stethoscope} label="Tratamentos" value={formatCount(treatments)} tone="violet" />
        <KpiCardMega detail="com prontidão" icon={ShieldCheck} label="Prontos" value={formatPercent(readyPercent)} tone="emerald" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Executive Summary
// ---------------------------------------------------------------------------

function ExecutiveSummarySection({
  events,
  pending,
  treatments,
  readyPercent,
  vaccinesPercent,
  distribution,
  dailyData,
  highlights,
}: {
  events: number;
  pending: number;
  treatments: number;
  readyPercent: number;
  vaccinesPercent: number;
  distribution: StatItem[];
  dailyData: { label: string; value: number }[];
  highlights: { label: string; value: string; detail: string; tone: string }[];
}) {
  return (
    <section className="rounded-[1.65rem] border border-red-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="resumo">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Resumo Executivo</h2>
          <p className="mt-1 text-sm text-slate-400">Visão consolidada da saúde do efetivo K9</p>
        </div>
        <Badge className="border-red-300/20 bg-red-300/10 text-red-100">Visão geral</Badge>
      </div>

      {/* 4 KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="no período" icon={HeartPulse} label="Atendimentos" value={formatCount(events)} tone="red" />
        <KpiCard detail="em acompanhamento" icon={Stethoscope} label="Tratamentos" value={formatCount(treatments)} tone="violet" />
        <KpiCard detail="requerem atenção" icon={AlertTriangle} label="Pendências" value={formatCount(pending)} tone="amber" />
        <KpiCard detail="vacinas em dia" icon={Syringe} label="Imunização" value={formatPercent(vaccinesPercent)} tone="emerald" />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-red-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Atendimentos por dia</p>
          <BarChart data={dailyData} />
        </div>
        <div className="rounded-2xl border border-red-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Prontidão do efetivo</p>
          <DonutChart items={distribution} total={100} />
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
// Section 3: Clinical Analysis
// ---------------------------------------------------------------------------

function ClinicalAnalysisSection({
  timeline,
  treatmentData,
  readyPercent,
  attention,
}: {
  timeline: HealthEvent[];
  treatmentData: TreatmentData[];
  readyPercent: number;
  attention: ReportListItem[];
}) {
  const vaccineData = buildVaccineData();
  const maxVaccine = Math.max(...vaccineData.map((v) => v.value));

  return (
    <section className="rounded-[1.65rem] border border-red-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="clinico">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Análise Clínica</h2>
          <p className="mt-1 text-sm text-slate-400">Eventos, tratamentos e calendário vacinal</p>
        </div>
        <Badge className="border-red-300/20 bg-red-300/10 text-red-100">Clínico</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Timeline */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-300">Eventos recentes</p>
          <div className="relative space-y-0 border-l border-red-200/20 pl-6">
            {timeline.map((item, i) => {
              const dotColor = item.priority === "critical" ? "bg-red-400" : item.priority === "high" ? "bg-amber-400" : "bg-red-300";
              return (
                <div className="relative pb-6 last:pb-0" key={item.id}>
                  <div className={cn("absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-slate-950", dotColor)} />
                  <div className="rounded-2xl border border-red-200/8 bg-slate-900/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-white">{item.dogName}</p>
                        <p className="text-xs text-slate-400">{item.type}</p>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">{formatDate(item.date)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-500">{item.status}</span>
                      {item.nextAppointment && (
                        <span className="ml-auto text-xs text-amber-300">
                          Próx: {formatDate(item.nextAppointment)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Treatments + Vaccine Progress */}
        <div className="space-y-5">
          {/* Readiness ring */}
          <div className="rounded-2xl border border-red-200/8 bg-slate-900/60 p-5">
            <p className="mb-4 text-sm font-semibold text-slate-300">Prontidão veterinária</p>
            <div className="flex justify-center">
              <ProgressRing percent={readyPercent} label="Efetivo pronto" color="emerald" />
            </div>
          </div>

          {/* Vaccine bars */}
          <div className="rounded-2xl border border-red-200/8 bg-slate-900/60 p-5">
            <p className="mb-4 text-sm font-semibold text-slate-300">Calendário vacinal</p>
            <div className="space-y-3">
              {vaccineData.slice(0, 5).map((vaccine, i) => (
                <div key={vaccine.label} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-slate-400">{vaccine.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(vaccine.value / maxVaccine) * 100}%`,
                        backgroundColor: chartColors[["red", "emerald", "cyan", "violet", "amber"][i % 5]],
                      }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-xs text-slate-300">{vaccine.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Treatments list */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Tratamentos em andamento</p>
        <div className="grid gap-3 md:grid-cols-2">
          {treatmentData.slice(0, 4).map((t) => (
            <TreatmentCard data={t} key={t.dogName} />
          ))}
        </div>
      </div>

      {/* Attention items */}
      {attention.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">K9 que exigem atenção</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attention.slice(0, 3).map((item) => (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-200/20 bg-amber-400/5 p-3" key={item.id}>
                <AlertTriangle className="h-5 w-5 text-amber-300" />
                <div>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Treatment Productivity
// ---------------------------------------------------------------------------

function TreatmentProductivitySection({
  treatmentData,
  monthlyData,
  readyPercent,
  vaccinesPercent,
  highlights,
}: {
  treatmentData: TreatmentData[];
  monthlyData: { label: string; events: number; treatments: number }[];
  readyPercent: number;
  vaccinesPercent: number;
  highlights: string[];
}) {
  const activeTreatments = treatmentData.filter((t) => t.status === "Em tratamento").length;
  const completedTreatments = treatmentData.filter((t) => t.status === "Concluído").length;

  return (
    <section className="rounded-[1.65rem] border border-red-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="tratamentos">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Produtividade Clínica</h2>
          <p className="mt-1 text-sm text-slate-400">Tratamentos, evolução e indicadores de saúde</p>
        </div>
        <Badge className="border-red-300/20 bg-red-300/10 text-red-100">Tratamentos</Badge>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="em andamento" icon={Stethoscope} label="Tratamentos ativos" value={formatCount(activeTreatments)} tone="violet" />
        <KpiCard detail="concluídos" icon={CheckCircle2} label="Finalizados" value={formatCount(completedTreatments)} tone="emerald" />
        <KpiCard detail="prontos" icon={ShieldCheck} label="Prontidão" value={formatPercent(readyPercent)} tone="emerald" />
        <KpiCard detail="vacinados" icon={Syringe} label="Imunização" value={formatPercent(vaccinesPercent)} tone="cyan" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Monthly stacked bar */}
        <div className="rounded-2xl border border-red-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Eventos vs Tratamentos (6 meses)</p>
          <StackedBarChart data={monthlyData} />
        </div>

        {/* Treatment progress */}
        <div className="rounded-2xl border border-red-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Evolução dos tratamentos</p>
          <div className="space-y-4">
            {treatmentData.slice(0, 4).map((t) => {
              const progress = (t.completed / t.sessions) * 100;
              return (
                <div key={t.dogName} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{t.dogName}</span>
                    <span className="text-xs text-slate-400">{t.completed}/{t.sessions} sessões</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, backgroundColor: chartColors.emerald }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">Principais achados</p>
          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200/8 bg-slate-900/60 p-3" key={i}>
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
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
  events,
  treatments,
  pending,
  recommendations,
  pendingItems,
  vaccineCards,
}: {
  events: number;
  treatments: number;
  pending: number;
  recommendations: Recommendation[];
  pendingItems: PendingItem[];
  vaccineCards: VaccineCard[];
}) {
  const healthRate = events > 0 ? Math.round(((events - pending) / events) * 100) : 0;

  return (
    <section className="rounded-[1.65rem] border border-red-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="conclusoes">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Conclusões e Integridade</h2>
          <p className="mt-1 text-sm text-slate-400">Resumo final, validação e próximos passos</p>
        </div>
        <Badge className="border-red-300/20 bg-red-300/10 text-red-100">Conclusão</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard detail="no período" icon={HeartPulse} label="Atendimentos" value={formatCount(events)} tone="red" />
            <KpiCard detail="em curso" icon={Stethoscope} label="Tratamentos" value={formatCount(treatments)} tone="violet" />
            <KpiCard detail="requerem atenção" icon={AlertTriangle} label="Pendências" value={formatCount(pending)} tone="amber" />
            <KpiCard detail="taxa" icon={TrendingUp} label="Taxa resolução" value={formatPercent(healthRate)} tone="emerald" />
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

          {/* Vaccine summary */}
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-300">Calendário vacinal</p>
            <VaccineCards cards={vaccineCards} />
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
  { id: "clinico", label: "Clínico" },
  { id: "tratamentos", label: "Tratamentos" },
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
    <div className="sticky top-20 z-40 mx-auto max-w-fit rounded-2xl border border-red-200/12 bg-slate-950/90 p-1.5 backdrop-blur-sm">
      <nav className="flex gap-1">
        {SECTIONS.map((s) => (
          <button
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
              active === s.id
                ? "bg-red-300/15 text-red-100"
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

export function HealthReport() {
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useReportsData(periodDays);

  // Derived data
  const dailyData = useMemo(() => buildDailyEvents(data.health.events, periodDays), [data.health.events, periodDays]);
  const timeline = useMemo(() => buildHealthTimeline(data.health.attention), [data.health.attention]);
  const treatmentData = useMemo(() => buildTreatmentData(data.health.attention), [data.health.attention]);
  const monthlyData = useMemo(() => buildMonthlyData(), []);
  const vaccineData = useMemo(() => buildVaccineData(), []);

  const distribution: StatItem[] = useMemo(() => [
    { label: "Prontos", percent: data.health.readyPercent, tone: "emerald" as ReportTone, value: data.health.readyPercent },
    { label: "Pendências", percent: 100 - data.health.readyPercent, tone: "amber" as ReportTone, value: 100 - data.health.readyPercent },
  ], [data.health.readyPercent]);

  const healthRate = useMemo(() => {
    if (data.health.events === 0) return 0;
    return Math.round(((data.health.events - data.health.pending) / data.health.events) * 100);
  }, [data.health.events, data.health.pending]);

  const highlights = useMemo(() => [
    { label: "Taxa de resolução", value: formatPercent(healthRate), detail: `de ${data.health.events} atendimentos`, tone: "emerald" },
    { label: "Tratamentos", value: formatCount(data.health.treatments), detail: "em acompanhamento", tone: "violet" },
    { label: "Vacinas em dia", value: formatPercent(data.health.vaccinesPercent), detail: "do efetivo", tone: "cyan" },
    { label: "Pendências", value: formatCount(data.health.pending), detail: "requerem atenção", tone: "amber" },
  ], [healthRate, data.health]);

  const clinicalHighlights = useMemo(() => {
    const items: string[] = [];
    if (data.health.pending > 0) items.push(`${data.health.pending} K9 requerem atenção clínica imediata`);
    if (data.health.treatments > 0) items.push(`${data.health.treatments} tratamentos em andamento`);
    if (data.health.vaccinesPercent < 100) items.push(`${formatPercent(100 - data.health.vaccinesPercent)} do efetivo sem vacinas em dia`);
    if (healthRate > 80) items.push("Alta taxa de resolução dos atendimentos");
    if (data.health.events > 5) items.push("Volume significativo de atendimentos no período");
    return items.slice(0, 4);
  }, [data.health, healthRate]);

  const recommendations: Recommendation[] = useMemo(() => [
    {
      icon: AlertTriangle,
      priority: data.health.pending > 2 ? "high" : "medium",
      text: "Priorizar o agendamento de consultas veterinárias para os K9 com pendências clínicas em aberto.",
    },
    {
      icon: Syringe,
      priority: data.health.vaccinesPercent < 95 ? "high" : "medium",
      text: "Revisar e atualizar o calendário vacinal de todo o efetivo, garantindo proteção contra doenças essenciais.",
    },
    {
      icon: TrendingUp,
      priority: "low",
      text: "Implementar um sistema de monitoramento preventivo para reduzir ocorrências de saúde no efetivo.",
    },
  ], [data.health.pending, data.health.vaccinesPercent]);

  const pendingItems: PendingItem[] = useMemo(() => [
    { text: "Agendar consultas de acompanhamento para K9 em tratamento", status: "Em acompanhamento" },
    { text: "Atualizar registros de peso e condições físicas dos cães", status: "Pendente" },
    { text: "Verificar carteiras de vacinação em atraso", status: "Pendente" },
    { text: "Revisar protocolos de saúde preventivos", status: "Concluído" },
    { text: "Consolidar laudos veterinários do período", status: "Concluído" },
  ], []);

  const vaccineCards: VaccineCard[] = useMemo(() => [
    { icon: Syringe, label: "Raiva", count: 12, tone: "emerald" },
    { icon: ShieldCheck, label: "V8/V10", count: 10, tone: "red" },
    { icon: Activity, label: "Giárdia", count: 8, tone: "amber" },
    { icon: HeartPulse, label: "Leptospirose", count: 6, tone: "violet" },
  ], []);

  const getExportData = useCallback(
    () => getExportableData("health", data),
    [data],
  );

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Button
            className="shrink-0 rounded-2xl border border-red-200/20 bg-slate-950 text-slate-300 hover:border-red-200/40 hover:bg-slate-900"
            onClick={() => window.history.back()}
            type="button"
            variant="secondary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <p className="text-sm font-semibold text-red-200">Relatório Premium</p>
            <h1 className="text-2xl font-black text-white md:text-3xl">Relatório de Saúde</h1>
            <p className="mt-1 text-sm text-slate-400">Período: <span className="font-semibold text-red-200">{periodLabel}</span></p>
          </div>
        </div>
        <ExportButton
          getData={getExportData}
          reportId="health"
          reportTitle="Saúde"
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
        events={data.health.events}
        pending={data.health.pending}
        treatments={data.health.treatments}
        readyPercent={data.health.readyPercent}
      />

      {/* Section 2: Executive Summary */}
      <ExecutiveSummarySection
        events={data.health.events}
        pending={data.health.pending}
        treatments={data.health.treatments}
        readyPercent={data.health.readyPercent}
        vaccinesPercent={data.health.vaccinesPercent}
        distribution={distribution}
        dailyData={dailyData}
        highlights={highlights}
      />

      {/* Section 3: Clinical Analysis */}
      <ClinicalAnalysisSection
        timeline={timeline}
        treatmentData={treatmentData}
        readyPercent={data.health.readyPercent}
        attention={data.health.attention}
      />

      {/* Section 4: Treatment Productivity */}
      <TreatmentProductivitySection
        treatmentData={treatmentData}
        monthlyData={monthlyData}
        readyPercent={data.health.readyPercent}
        vaccinesPercent={data.health.vaccinesPercent}
        highlights={clinicalHighlights}
      />

      {/* Section 5: Conclusions */}
      <ConclusionsSection
        events={data.health.events}
        treatments={data.health.treatments}
        pending={data.health.pending}
        recommendations={recommendations}
        pendingItems={pendingItems}
        vaccineCards={vaccineCards}
      />

      {/* Export toolbar footer */}
      <div className="rounded-[1.65rem] border border-red-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-red-300" />
          <p className="text-sm font-black text-white">Exportação e assinatura digital</p>
        </div>
        <ExportToolbar
          getData={getExportData}
          reportId="health"
          reportTitle="Relatório de Saúde"
          subtitle={`Período: ${periodLabel}`}
        />
        <div className="mt-4 rounded-2xl border border-red-200/10 bg-red-300/8 p-4">
          <p className="text-sm font-black text-white">Assinatura digital</p>
          <p className="mt-1 text-xs text-slate-400">
            Relatório validado com base nos registros de saúde consultados e filtros selecionados.
            Os dados refletem a realidade do efetivo K9 no período {periodLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}
