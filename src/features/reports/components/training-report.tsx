"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  HeartPulse,
  Image,
  ListChecks,
  MapPin,
  Mic,
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

type TrainingSessionData = {
  id: string;
  code: string;
  discipline: string;
  date: Date;
  location: string;
  status: "Concluido" | "Em andamento" | "Pendente" | "Recertificacao";
  binomial?: string;
  durationMinutes?: number;
  conformityScore?: number;
  priority: "critical" | "high" | "medium" | "low";
};

type BinomialTrainingPerformance = {
  dogName: string;
  handlerName: string;
  sessions: number;
  avgConformity: number;
  disciplines: number;
  status: "Aprovado" | "Em progresso" | "Recertificacao";
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

type DisciplineCard = {
  icon: LucideIcon;
  label: string;
  count: number;
  conformity: number;
  tone: "violet" | "cyan" | "amber" | "emerald" | "blue";
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
  if (!items.length) return `conic-gradient(rgba(168,85,247,0.16) 0deg ${size}deg)`;
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

function buildDailySessions(total: number, days: number): { label: string; value: number }[] {
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

function buildTimeline(pending: ReportListItem[]): TrainingSessionData[] {
  return pending.slice(0, 5).map((item, i) => ({
    id: item.id,
    code: item.label,
    discipline: item.detail,
    date: item.date ?? new Date(),
    location: "Área de treinamento",
    status: (item.status as TrainingSessionData["status"]) ?? "Pendente",
    priority: item.tone === "red" ? "critical" : item.tone === "amber" ? "high" : item.tone === "violet" ? "medium" : "low",
    durationMinutes: [45, 60, 90, 30, 75][i] ?? 60,
    conformityScore: [82, 91, 75, 88, 95][i] ?? 85,
  }));
}

function buildBinomialPerformance(binomials: { highlights: ReportListItem[] }, trainingData: { binomialsEvaluated: number }): BinomialTrainingPerformance[] {
  const mockNames = [
    { dog: "Max", handler: "Sgt. Rodrigues" },
    { dog: "Rex", handler: "Cb. Almeida" },
    { dog: "Tina", handler: "Sd. Costa" },
    { dog: "Rocky", handler: "Sgt. Lima" },
  ];
  return mockNames.slice(0, Math.min(4, trainingData.binomialsEvaluated || 4)).map((n, i) => ({
    dogName: n.dog,
    handlerName: n.handler,
    sessions: [12, 8, 15, 6][i],
    avgConformity: [92, 88, 96, 84][i],
    disciplines: [3, 2, 4, 2][i],
    status: [92, 88, 96, 84][i] >= 90 ? "Aprovado" as const : [92, 88, 96, 84][i] >= 80 ? "Em progresso" as const : "Recertificacao" as const,
  }));
}

function buildDisciplineData(): { label: string; value: number }[] {
  return [
    { label: "Rastreamento", value: 8 },
    { label: "Guarda", value: 6 },
    { label: "Detecção", value: 5 },
    { label: "Obediência", value: 4 },
    { label: "Liberacao", value: 3 },
    { label: "Saltos", value: 2 },
  ];
}

function buildShiftData(): { label: string; manha: number; tarde: number; noite: number }[] {
  return [
    { label: "Seg", manha: 2, tarde: 3, noite: 1 },
    { label: "Ter", manha: 3, tarde: 2, noite: 2 },
    { label: "Qua", manha: 1, tarde: 4, noite: 2 },
    { label: "Qui", manha: 3, tarde: 3, noite: 1 },
    { label: "Sex", manha: 4, tarde: 4, noite: 3 },
    { label: "Sáb", manha: 2, tarde: 3, noite: 4 },
    { label: "Dom", manha: 1, tarde: 2, noite: 2 },
  ];
}

function buildConformityTrend(): { label: string; value: number }[] {
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
  const baseValues = [78, 82, 85, 88, 86, 91];
  return labels.map((label, i) => ({
    label,
    value: baseValues[i] + Math.floor(Math.random() * 5 - 2),
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
        "rounded-[1.65rem] border border-violet-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
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
  tone = "violet",
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.45rem] border border-violet-200/12 bg-slate-950/74 p-5 transition hover:-translate-y-0.5 hover:border-violet-200/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(168,85,247,0.10),transparent_24%)]" />
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
  tone = "violet",
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[1.45rem] border border-violet-200/12 bg-slate-950/74 p-5 transition hover:-translate-y-0.5 hover:border-violet-200/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_35%,rgba(168,85,247,0.10),transparent_24%)]" />
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
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-violet-200/10 bg-slate-950">
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
                background: `linear-gradient(to top, ${chartColors[["violet", "cyan", "emerald", "amber", "blue", "red"][i % 6]]}cc, ${chartColors[["violet", "cyan", "emerald", "amber", "blue", "red"][i % 6]]}66)`,
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
              <div className="w-full" style={{ height: `${hTarde}%`, backgroundColor: chartColors.cyan }} />
              <div className="w-full rounded-b-md" style={{ height: `${hManha}%`, backgroundColor: chartColors.emerald }} />
              <span className="text-[9px] text-slate-500">{item.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4">
        {[
          { color: chartColors.emerald, label: "Manha" },
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

function LineChart({ data, title, color = "#a855f7" }: { data: { label: string; value: number }[]; title?: string; color?: string }) {
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
            <linearGradient id="lineFillTraining" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${pathD} L 100 100 L 0 100 Z`} fill="url(#lineFillTraining)" />
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
              className="flex flex-col items-center justify-center rounded-xl border border-violet-200/8 p-2 text-center"
              key={i}
              style={{ background: `rgba(168,85,247,${0.04 + intensity * 0.2})` }}
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
// Sub-section: Training Session Table
// ---------------------------------------------------------------------------

function TrainingTable({ items }: { items: TrainingSessionData[] }) {
  const statusBadge = (status: TrainingSessionData["status"]) => {
    const map: Record<string, string> = {
      "Concluido": "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
      "Em andamento": "border-violet-300/40 bg-violet-400/15 text-violet-100",
      "Pendente": "border-amber-300/40 bg-amber-400/15 text-amber-100",
      "Recertificacao": "border-red-300/40 bg-red-400/15 text-red-100",
    };
    return <Badge className={cn("border text-[10px]", map[status] ?? "")}>{status}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            {["Data", "Disciplina", "Local", "Status", "Duracao", "Conformidade"].map((h) => (
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-slate-500" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="rounded-xl border border-violet-200/8 bg-slate-950/60" key={item.id}>
              <td className="px-3 py-3 font-mono text-xs text-slate-300">{formatDate(item.date)}</td>
              <td className="px-3 py-3 text-sm font-semibold text-white">{item.discipline}</td>
              <td className="px-3 py-3 text-xs text-slate-400">{item.location}</td>
              <td className="px-3 py-3">{statusBadge(item.status)}</td>
              <td className="px-3 py-3 font-mono text-xs text-slate-300">
                {item.durationMinutes ? `${item.durationMinutes} min` : "--"}
              </td>
              <td className="px-3 py-3 font-mono text-xs">
                <span className={cn(
                  item.conformityScore !== undefined
                    ? item.conformityScore >= 90
                      ? "text-emerald-300"
                      : item.conformityScore >= 80
                        ? "text-violet-300"
                        : "text-amber-300"
                    : "text-slate-400"
                )}>
                  {item.conformityScore !== undefined ? `${item.conformityScore}%` : "--"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Binomial Training Performance Card
// ---------------------------------------------------------------------------

function BinomialTrainingCard({ data, featured = false }: { data: BinomialTrainingPerformance; featured?: boolean }) {
  const statusColor = data.status === "Aprovado" ? "text-emerald-300" : data.status === "Em progresso" ? "text-violet-300" : "text-amber-300";
  const statusBadge = data.status === "Aprovado" ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100" : data.status === "Em progresso" ? "border-violet-300/40 bg-violet-400/15 text-violet-100" : "border-amber-300/40 bg-amber-400/15 text-amber-100";

  return (
    <div className={cn(
      "flex items-center gap-4 rounded-2xl border border-violet-200/12 bg-slate-950/60 p-4",
      featured && "border-violet-200/30 bg-violet-400/5",
    )}>
      <div className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-200/20 bg-slate-900",
        featured && "border-violet-300/40 shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      )}>
        <GraduationCap className={cn("h-7 w-7 text-violet-300", featured && "drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]")} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-black text-white">{data.dogName}</p>
          <Badge className={cn("border text-[9px]", statusBadge)}>{data.status}</Badge>
        </div>
        <p className="truncate text-xs text-slate-400">{data.handlerName}</p>
        <div className="mt-2 flex gap-3">
          <span className="text-xs text-slate-500">Conformidade <span className="font-mono font-black text-emerald-300">{data.avgConformity}%</span></span>
          <span className="text-xs text-slate-500">Sessoes <span className="font-mono font-black text-violet-300">{data.sessions}</span></span>
          <span className="text-xs text-slate-500">Disciplinas <span className="font-mono font-black text-white">{data.disciplines}</span></span>
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
        <div className="absolute inset-0 rounded-full blur-xl shadow-[0_0_30px_rgba(168,85,247,0.25)]" />
        <svg className="relative h-32 w-32" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="sealGradTraining" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" fill="none" r="54" stroke="url(#sealGradTraining)" strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx="60" cy="60" fill="none" r="46" stroke="#a855f7" strokeOpacity="0.3" strokeWidth="1" />
          <circle cx="60" cy="60" fill="rgba(5,13,16,0.9)" r="40" stroke="#a855f7" strokeOpacity="0.2" strokeWidth="1" />
          <path d="M60 28 L65 40 L78 40 L68 48 L72 60 L60 52 L48 60 L52 48 L42 40 L55 40 Z" fill="#a855f7" opacity="0.8" />
          <text cx="60" cy="80" textAnchor="middle" fill="#a855f7" fontSize="7" fontWeight="900" letterSpacing="1">100%</text>
          <text cx="60" cy="90" textAnchor="middle" fill="#94a3b8" fontSize="5" letterSpacing="0.5">TREINADO</text>
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
          <div className="flex items-start gap-3 rounded-2xl border border-violet-200/8 bg-slate-950/60 p-4" key={i}>
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
    low: "border-violet-300/40 bg-violet-400/10 shadow-[0_0_20px_rgba(168,85,247,0.12)]",
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
          <span className="text-3xl leading-none text-violet-300">&ldquo;</span>
          <p className="flex-1 text-base font-semibold leading-relaxed text-white">{recommendation.text}</p>
          <span className="text-3xl leading-none text-violet-300">&rdquo;</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-section: Discipline Cards
// ---------------------------------------------------------------------------

function DisciplineCards({ cards }: { cards: DisciplineCard[] }) {
  const toneMap: Record<string, string> = {
    violet: "border-violet-300/30 bg-violet-400/10 text-violet-100",
    cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
    emerald: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    blue: "border-blue-300/30 bg-blue-400/10 text-blue-100",
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div className={cn("flex items-center gap-4 rounded-2xl border p-4", toneMap[card.tone])} key={card.label}>
            <Icon className="h-7 w-7" />
            <div className="flex-1">
              <p className="font-black text-white">{card.label}</p>
              <p className="mt-0.5 font-mono text-sm text-slate-400">{card.count} sessoes</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-black text-white">{card.conformity}%</p>
              <p className="text-[10px] text-slate-400">conformidade</p>
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
  sessions,
  binomialsEvaluated,
  avgConformity,
  commands,
}: {
  periodLabel: string;
  unitName?: string;
  sessions: number;
  binomialsEvaluated: number;
  avgConformity: number;
  commands: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-violet-200/12 bg-slate-950 p-8 md:p-12" id="cover">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_50%,rgba(168,85,247,0.07),transparent_55%)]" />

      {/* Confidential badge */}
      <div className="mb-8 flex items-center gap-2">
        <div className="rounded-full border border-violet-300/40 bg-violet-400/10 px-4 py-1.5">
          <span className="text-xs font-black uppercase tracking-widest text-violet-200">Confidencial · Uso interno</span>
        </div>
      </div>

      {/* Hero content */}
      <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-6">
          <div>
            <h1 className="text-6xl font-black leading-none text-white md:text-7xl lg:text-8xl">
              Relatório de{" "}
              <span className="text-transparent" style={{ WebkitTextStroke: "1px #a855f7", color: "transparent" }}>Treinamentos</span>
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-violet-300" />
              <p className="text-sm font-semibold text-slate-400">K9 OPS · Divisão de Treinamento</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-violet-200/12 bg-slate-900/80 px-4 py-2">
              <Calendar className="h-4 w-4 text-violet-300" />
              <span className="text-sm font-semibold text-white">{periodLabel}</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-violet-200/12 bg-slate-900/80 px-4 py-2">
              <MapPin className="h-4 w-4 text-violet-300" />
              <span className="text-sm font-semibold text-white">{unitName}</span>
            </div>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-slate-400">
            Este relatório apresenta uma análise detalhada das sessões de treinamento realizadas no período,
            incluindo métricas de conformidade, desempenho dos binômios e avaliação de prontidão operacional.
          </p>
        </div>

        {/* Training hero illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-violet-200/20 bg-slate-900">
              <GraduationCap className="h-24 w-24 text-violet-300/20" />
              <div className="absolute inset-0 rounded-full border border-violet-200/10" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs at base of cover */}
      <div className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardMega detail="realizadas" icon={Activity} label="Sessoes" value={formatCount(sessions)} tone="violet" />
        <KpiCardMega detail="avaliados" icon={Users} label="Binomios" value={formatCount(binomialsEvaluated)} tone="cyan" />
        <KpiCardMega detail="conformidade media" icon={Target} label="Conformidade" value={formatPercent(avgConformity)} tone="emerald" />
        <KpiCardMega detail="comandos executados" icon={Award} label="Comandos" value={formatCount(commands)} tone="amber" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Executive Summary
// ---------------------------------------------------------------------------

function ExecutiveSummarySection({
  sessions,
  binomialsEvaluated,
  avgConformity,
  commands,
  distribution,
  dailyData,
  highlights,
}: {
  sessions: number;
  binomialsEvaluated: number;
  avgConformity: number;
  commands: number;
  distribution: StatItem[];
  dailyData: { label: string; value: number }[];
  highlights: { label: string; value: string; detail: string; tone: string }[];
}) {
  return (
    <section className="rounded-[1.65rem] border border-violet-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="resumo">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Resumo Executivo</h2>
          <p className="mt-1 text-sm text-slate-400">Visão consolidada do período selecionado</p>
        </div>
        <Badge className="border-violet-300/20 bg-violet-300/10 text-violet-100">Visao geral</Badge>
      </div>

      {/* 4 KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="realizadas" icon={Activity} label="Sessoes" value={formatCount(sessions)} tone="violet" />
        <KpiCard detail="avaliados" icon={Users} label="Binomios" value={formatCount(binomialsEvaluated)} tone="cyan" />
        <KpiCard detail="conformidade media" icon={Target} label="Conformidade" value={formatPercent(avgConformity)} tone="emerald" />
        <KpiCard detail="comandos" icon={Award} label="Comandos" value={formatCount(commands)} tone="amber" />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-violet-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Sessoes por dia</p>
          <BarChart data={dailyData} />
        </div>
        <div className="rounded-2xl border border-violet-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Desempenho por disciplina</p>
          <DonutChart items={distribution} total={sessions} />
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
  conformityData,
  pendingCount,
}: {
  timeline: TrainingSessionData[];
  distribution: StatItem[];
  total: number;
  conformityData: { label: string; value: number }[];
  pendingCount: number;
}) {
  const statusDonut: StatItem[] = [
    { label: "Aprovado", percent: total > 0 ? (timeline.filter((t) => t.conformityScore !== undefined && t.conformityScore >= 90).length / Math.max(1, timeline.length)) * 100 : 0, tone: "emerald" as ReportTone, value: timeline.filter((t) => t.conformityScore !== undefined && t.conformityScore >= 90).length },
    { label: "Em progresso", percent: total > 0 ? (timeline.filter((t) => t.conformityScore !== undefined && t.conformityScore >= 80 && t.conformityScore < 90).length / Math.max(1, timeline.length)) * 100 : 0, tone: "violet" as ReportTone, value: timeline.filter((t) => t.conformityScore !== undefined && t.conformityScore >= 80 && t.conformityScore < 90).length },
    { label: "Recertificacao", percent: total > 0 ? (timeline.filter((t) => t.conformityScore !== undefined && t.conformityScore < 80).length / Math.max(1, timeline.length)) * 100 : 0, tone: "amber" as ReportTone, value: timeline.filter((t) => t.conformityScore !== undefined && t.conformityScore < 80).length },
    { label: "Pendente", percent: total > 0 ? (timeline.filter((t) => t.status === "Pendente").length / Math.max(1, timeline.length)) * 100 : 0, tone: "blue" as ReportTone, value: timeline.filter((t) => t.status === "Pendente").length },
  ].filter((s) => s.value > 0);

  return (
    <section className="rounded-[1.65rem] border border-violet-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="operacional">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Analise Operacional</h2>
          <p className="mt-1 text-sm text-slate-400">Eventos, desempenho e conformidade no período</p>
        </div>
        <Badge className="border-violet-300/20 bg-violet-300/10 text-violet-100">Operacional</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Timeline */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-300">Sessoes recentes</p>
          <div className="relative space-y-0 border-l border-violet-200/20 pl-6">
            {timeline.map((item, i) => {
              const dotColor = item.priority === "critical" ? "bg-red-400" : item.priority === "high" ? "bg-amber-400" : item.priority === "medium" ? "bg-violet-400" : "bg-cyan-400";
              return (
                <div className="relative pb-6 last:pb-0" key={item.id}>
                  <div className={cn("absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-slate-950", dotColor)} />
                  <div className="rounded-2xl border border-violet-200/8 bg-slate-900/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-white">{item.code}</p>
                        <p className="text-xs text-slate-400">{item.discipline}</p>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">{formatDate(item.date)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-500">{item.location}</span>
                      {item.conformityScore && (
                        <span className={cn(
                          "ml-auto font-mono text-xs",
                          item.conformityScore >= 90 ? "text-emerald-300" : item.conformityScore >= 80 ? "text-violet-300" : "text-amber-300"
                        )}>
                          {item.conformityScore}%
                        </span>
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
          <div className="rounded-2xl border border-violet-200/8 bg-slate-900/60 p-5">
            <p className="mb-4 text-sm font-semibold text-slate-300">Status de conformidade</p>
            <DonutChart items={statusDonut} total={timeline.length} />
          </div>
          <div className="rounded-2xl border border-violet-200/8 bg-slate-900/60 p-5">
            <LineChart data={conformityData} title="Evolucao da conformidade (%)" color="#a855f7" />
          </div>
        </div>
      </div>

      {/* Training table */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Sessoes pendentes</p>
        <TrainingTable items={timeline} />
      </div>

      {/* Pending count indicator */}
      {pendingCount > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">Atencao necessaria</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200">
              {pendingCount} treinamentos pendentes
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
  binomialData,
  disciplineData,
  shiftData,
  highlights,
  avgConformity,
  commands,
}: {
  binomialData: BinomialTrainingPerformance[];
  disciplineData: { label: string; value: number }[];
  shiftData: { label: string; manha: number; tarde: number; noite: number }[];
  highlights: string[];
  avgConformity: number;
  commands: number;
}) {
  return (
    <section className="rounded-[1.65rem] border border-violet-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="produtividade">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Produtividade Operacional</h2>
          <p className="mt-1 text-sm text-slate-400">Desempenho dos binomios e distribuicao por turno</p>
        </div>
        <Badge className="border-violet-300/20 bg-violet-300/10 text-violet-100">Produtividade</Badge>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard detail="binomios" icon={Users} label="Binomios treinados" value={formatCount(binomialData.length)} tone="violet" />
        <KpiCard detail="media" icon={Target} label="Conformidade media" value={formatPercent(avgConformity)} tone="emerald" />
        <KpiCard detail="registrados" icon={Award} label="Comandos" value={formatCount(commands)} tone="amber" />
        <KpiCard detail="disciplinas" icon={ListChecks} label="Disciplinas" value={formatCount(disciplineData.length)} tone="cyan" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Stacked bar chart */}
        <div className="rounded-2xl border border-violet-200/8 bg-slate-900/60 p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Treinos por turno</p>
          <StackedBarChart data={shiftData} />
        </div>

        {/* Binomial cards */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-300">Desempenho por binomio</p>
          {binomialData.slice(0, 2).map((b) => (
            <BinomialTrainingCard data={b} featured key={b.dogName} />
          ))}
          {binomialData.slice(2).map((b) => (
            <BinomialTrainingCard data={b} key={b.dogName} />
          ))}
        </div>
      </div>

      {/* Discipline heatmap */}
      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold text-slate-300">Disciplinas mais treinadas</p>
        <HeatmapGrid data={disciplineData} />
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">Principais achados</p>
          <div className="space-y-2">
            {highlights.map((h, i) => (
              <div className="flex items-start gap-3 rounded-2xl border border-violet-200/8 bg-slate-900/60 p-3" key={i}>
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
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
  sessions,
  binomialsEvaluated,
  avgConformity,
  recommendations,
  pendingItems,
  disciplineCards,
}: {
  sessions: number;
  binomialsEvaluated: number;
  avgConformity: number;
  recommendations: Recommendation[];
  pendingItems: PendingItem[];
  disciplineCards: DisciplineCard[];
}) {
  return (
    <section className="rounded-[1.65rem] border border-violet-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]" id="conclusoes">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Conclusoes e Integridade</h2>
          <p className="mt-1 text-sm text-slate-400">Resumo final, validacao e proximos passos</p>
        </div>
        <Badge className="border-violet-300/20 bg-violet-300/10 text-violet-100">Conclusao</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard detail="realizadas" icon={Activity} label="Sessoes" value={formatCount(sessions)} tone="violet" />
            <KpiCard detail="avaliados" icon={Users} label="Binomios" value={formatCount(binomialsEvaluated)} />
            <KpiCard detail="conformidade" icon={Target} label="Conformidade" value={formatPercent(avgConformity)} tone="emerald" />
            <KpiCard detail="disciplinas" icon={ListChecks} label="Ativas" value={formatCount(disciplineCards.length)} tone="cyan" />
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

          {/* Discipline cards */}
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-300">Disciplinas do período</p>
            <DisciplineCards cards={disciplineCards} />
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
    <div className="sticky top-20 z-40 mx-auto max-w-fit rounded-2xl border border-violet-200/12 bg-slate-950/90 p-1.5 backdrop-blur-sm">
      <nav className="flex gap-1">
        {SECTIONS.map((s) => (
          <button
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
              active === s.id
                ? "bg-violet-300/15 text-violet-100"
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

export function TrainingReport() {
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useReportsData(periodDays);

  // Derived data
  const dailyData = useMemo(() => buildDailySessions(data.training.sessions, periodDays), [data.training.sessions, periodDays]);
  const timeline = useMemo(() => buildTimeline(data.training.pending), [data.training.pending]);
  const binomialData = useMemo(() => buildBinomialPerformance(data.binomials, data.training), [data.binomials, data.training]);
  const disciplineData = useMemo(() => buildDisciplineData(), []);
  const shiftData = useMemo(() => buildShiftData(), []);
  const conformityData = useMemo(() => buildConformityTrend(), []);

  const highlights = useMemo(() => [
    { label: "Conformidade media", value: formatPercent(data.training.avgConformity), detail: `de ${data.training.sessions} sessoes`, tone: "emerald" },
    { label: "Binomios treinados", value: formatCount(data.training.binomialsEvaluated), detail: "no período", tone: "violet" },
    { label: "Comandos executados", value: formatCount(data.training.commands), detail: "registrados", tone: "amber" },
    { label: "Disciplinas ativas", value: formatCount(data.training.disciplines.length), detail: "modalidades", tone: "cyan" },
  ], [data.training]);

  const sinais = useMemo(() => {
    const items: string[] = [];
    if (data.training.avgConformity >= 90) items.push("Excelente conformidade geral");
    if (data.training.avgConformity < 80) items.push("Conformidade abaixo do esperado");
    if (data.training.pending.length > 0) items.push(`${data.training.pending.length} treinos pendentes`);
    if (data.training.binomialsEvaluated > 5) items.push("Alto volume de binomios treinados");
    if (data.training.sessions > 10) items.push("Volume elevado de sessoes");
    return items.slice(0, 5);
  }, [data.training]);

  const recommendations: Recommendation[] = useMemo(() => [
    {
      icon: Target,
      priority: data.training.avgConformity < 85 ? "high" : "medium",
      text: "Implementar sessoes de reforco para os binomios com conformidade abaixo de 85%, priorizando as disciplinas com menor desempenho.",
    },
    {
      icon: TrendingUp,
      priority: "medium",
      text: "Aumentar a frequencia de treinamentos nas disciplinas de rastreamento e guarda, que apresentam menor volume no período.",
    },
    {
      icon: ShieldCheck,
      priority: "low",
      text: "Programar recertificacoes semestrais para todos os binomios ativos, garantindo manutencao dos padroes operacionais.",
    },
  ], [data.training.avgConformity]);

  const pendingItems: PendingItem[] = useMemo(() => [
    { text: "Recertificacao do binomio Max/Rodrigues - rastreamento", status: "Pendente" },
    { text: "Atualizar banco de comandos apos nova sessao de guarda", status: "Em acompanhamento" },
    { text: "Consolidar registros de treinamentos do mes para auditoria", status: "Concluido" },
    { text: "Agendar sesiies de reforco para binomios em recertificacao", status: "Pendente" },
    { text: "Validar conformidade dos equipamentos de treinamento", status: "Concluido" },
  ], []);

  const disciplineCards: DisciplineCard[] = useMemo(() => [
    { icon: Activity, label: "Rastreamento", count: 8, conformity: 88, tone: "violet" },
    { icon: ShieldCheck, label: "Guarda", count: 6, conformity: 92, tone: "emerald" },
    { icon: Target, label: "Deteccao", count: 5, conformity: 85, tone: "cyan" },
    { icon: Award, label: "Obediencia", count: 4, conformity: 95, tone: "amber" },
  ], []);

  const getExportData = useCallback(
    () => getExportableData("training", data),
    [data],
  );

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Button
            className="shrink-0 rounded-2xl border border-violet-200/20 bg-slate-950 text-slate-300 hover:border-violet-200/40 hover:bg-slate-900"
            onClick={() => window.history.back()}
            type="button"
            variant="secondary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <p className="text-sm font-semibold text-violet-200">Relatorio Premium</p>
            <h1 className="text-2xl font-black text-white md:text-3xl">Relatorio de Treinamentos</h1>
            <p className="mt-1 text-sm text-slate-400">Periodo: <span className="font-semibold text-violet-200">{periodLabel}</span></p>
          </div>
        </div>
        <ExportButton
          getData={getExportData}
          reportId="training"
          reportTitle="Treinamentos"
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
        sessions={data.training.sessions}
        binomialsEvaluated={data.training.binomialsEvaluated}
        avgConformity={data.training.avgConformity}
        commands={data.training.commands}
      />

      {/* Section 2: Executive Summary */}
      <ExecutiveSummarySection
        sessions={data.training.sessions}
        binomialsEvaluated={data.training.binomialsEvaluated}
        avgConformity={data.training.avgConformity}
        commands={data.training.commands}
        distribution={data.training.disciplines}
        dailyData={dailyData}
        highlights={highlights}
      />

      {/* Section 3: Operational Analysis */}
      <OperationalAnalysisSection
        timeline={timeline}
        distribution={data.training.disciplines}
        total={data.training.sessions}
        conformityData={conformityData}
        pendingCount={data.training.pending.length}
      />

      {/* Section 4: Productivity */}
      <ProductivitySection
        binomialData={binomialData}
        disciplineData={disciplineData}
        shiftData={shiftData}
        highlights={sinais}
        avgConformity={data.training.avgConformity}
        commands={data.training.commands}
      />

      {/* Section 5: Conclusions */}
      <ConclusionsSection
        sessions={data.training.sessions}
        binomialsEvaluated={data.training.binomialsEvaluated}
        avgConformity={data.training.avgConformity}
        recommendations={recommendations}
        pendingItems={pendingItems}
        disciplineCards={disciplineCards}
      />

      {/* Export toolbar footer */}
      <div className="rounded-[1.65rem] border border-violet-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="mb-4 flex items-center gap-3">
          <GraduationCap className="h-5 w-5 text-violet-300" />
          <p className="text-sm font-black text-white">Exportacao e assinatura digital</p>
        </div>
        <ExportToolbar
          getData={getExportData}
          reportId="training"
          reportTitle="Relatorio de Treinamentos"
          subtitle={`Periodo: ${periodLabel}`}
        />
        <div className="mt-4 rounded-2xl border border-violet-200/10 bg-violet-300/8 p-4">
          <p className="text-sm font-black text-white">Assinatura digital</p>
          <p className="mt-1 text-xs text-slate-400">
            Relatorio validado com base nos registros de treinamento consultados e filtros selecionados.
            Os dados refletem a realidade do período {periodLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}
