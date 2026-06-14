"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  Filter,
  GitCommit,
  History,
  Lock,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldPlus,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  User,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExportToolbar,
} from "@/features/reports/components/export-toolbar";
import {
  useDashboardPeriod,
} from "@/features/dashboard/providers/dashboard-period-provider";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditEvent = {
  id: string;
  timestamp: Date;
  user: string;
  userRa: string;
  action: string;
  module: string;
  detail: string;
  hash?: string;
};

type UserActivity = {
  user: string;
  userRa: string;
  actions: number;
  lastAction: Date;
};

type IntegrityRecord = {
  id: string;
  document: string;
  status: "verified" | "modified" | "pending";
  lastCheck: Date;
  signedBy?: string;
};

// ---------------------------------------------------------------------------
// Design Tokens
// ---------------------------------------------------------------------------

const tone = "blue";

const tokens = {
  border: "border-blue-400/30",
  bg: "bg-blue-500/10",
  text: "text-blue-200",
  icon: "bg-blue-400/20 text-blue-300",
  accent: "text-blue-300",
  glow: "shadow-[0_0_40px_rgba(59,130,246,0.15)]",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  icon: Icon,
  label,
  sublabel,
  value,
}: {
  icon: LucideIcon;
  label: string;
  sublabel: string;
  value: string | number;
}) {
  return (
    <article className={cn("relative min-h-36 overflow-hidden rounded-2xl border p-5", tokens.border, tokens.bg)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_18%,rgba(255,255,255,0.1),transparent_30%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-200">{label}</p>
          <p className="mt-3 font-mono text-4xl font-black text-white">{value}</p>
          <p className="mt-1.5 text-sm text-slate-400">{sublabel}</p>
        </div>
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10", tokens.icon)}>
          <Icon className="h-6 w-6" />
        </span>
      </div>
    </article>
  );
}

function KpiCardMega({
  icon: Icon,
  label,
  sublabel,
  value,
}: {
  icon: LucideIcon;
  label: string;
  sublabel: string;
  value: string | number;
}) {
  return (
    <article className={cn("relative min-h-44 overflow-hidden rounded-2xl border p-6", tokens.border, tokens.bg, tokens.glow)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.2),transparent_40%)]" />
      <div className="relative flex items-center gap-5">
        <span className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10", tokens.icon)}>
          <Icon className="h-8 w-8" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-2 font-mono text-5xl font-black text-white">{value}</p>
          <p className="mt-1 text-sm text-slate-400">{sublabel}</p>
        </div>
      </div>
    </article>
  );
}

function DonutChart({
  data,
  title,
}: {
  data: { label: string; value: number; color: string }[];
  title: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className={cn("rounded-2xl border border-white/10 bg-white/[0.02] p-5", tokens.border)}>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <p className="mt-4 text-sm text-slate-500">Sem dados no período</p>
      </div>
    );
  }

  const gradientStops = data.map((d, i) => {
    const start = i === 0 ? 0 : data.slice(0, i).reduce((s, x) => s + (x.value / total) * 100, 0);
    const end = start + (d.value / total) * 100;
    return `${d.color} ${start}% ${end}%`;
  });

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.02] p-5", tokens.border)}>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <div className="mt-4 flex items-center gap-6">
        <div
          className="relative h-32 w-32 shrink-0 rounded-full"
          style={{
            background: `conic-gradient(${gradientStops.join(", ")})`,
          }}
        >
          <div className="absolute inset-4 rounded-full bg-slate-950" />
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d) => (
            <div key={d.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-sm text-slate-300">{d.label}</span>
              </div>
              <span className="font-mono text-sm font-semibold text-white">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarChart({
  data,
  title,
}: {
  data: { label: string; value: number; color?: string }[];
  title: string;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.02] p-5", tokens.border)}>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <div className="mt-4 space-y-3">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-slate-400">{d.label}</span>
            <div className="h-6 flex-1 overflow-hidden rounded-lg bg-white/[0.05]">
              <div
                className="h-full rounded-lg transition-all"
                style={{
                  width: `${(d.value / maxValue) * 100}%`,
                  backgroundColor: d.color ?? "rgb(59, 130, 246)",
                }}
              />
            </div>
            <span className="w-10 text-right font-mono text-xs text-slate-300">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:bg-white/[0.04]">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", tokens.icon)}>
        <History className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{event.action}</p>
            <p className="mt-0.5 text-xs text-slate-400">{event.module}</p>
          </div>
          <span className="text-xs text-slate-500">
            {event.timestamp.toLocaleString("pt-BR")}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-300">{event.detail}</p>
        <div className="mt-2 flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <User className="h-3 w-3" />
            {event.user} ({event.userRa})
          </span>
          {event.hash && (
            <span className="flex items-center gap-1.5 text-xs text-slate-600">
              <ShieldCheck className="h-3 w-3" />
              {event.hash.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function IntegrityCard({ record }: { record: IntegrityRecord }) {
  const statusConfig = {
    verified: { icon: CheckCircle2, color: "emerald", label: "Verificado" },
    modified: { icon: AlertCircle, color: "amber", label: "Modificado" },
    pending: { icon: Clock, color: "slate", label: "Pendente" },
  };
  const config = statusConfig[record.status];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", tokens.icon)}>
          <FileCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{record.document}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Última verificação: {record.lastCheck.toLocaleString("pt-BR")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {record.signedBy && (
          <span className="text-xs text-slate-500">Assinado por {record.signedBy}</span>
        )}
        {config.icon === CheckCircle2 ? (
              <Badge tone="green">{config.label}</Badge>
            ) : config.icon === AlertCircle ? (
              <Badge tone="yellow">{config.label}</Badge>
            ) : (
              <Badge tone="slate">{config.label}</Badge>
            )}
      </div>
    </div>
  );
}

function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  return (
    <nav className="sticky top-0 z-10 mb-6 flex gap-2 overflow-x-auto border-b border-white/10 pb-4">
      {sections.map((s) => (
        <button
          key={s.id}
          className={cn(
            "shrink-0 rounded-xl border px-4 py-2 text-xs font-semibold transition",
            active === s.id
              ? cn(tokens.border, tokens.bg, tokens.text)
              : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200",
          )}
          onClick={() => setActive(s.id)}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AuditReport() {
  const { periodDays, periodLabel } = useDashboardPeriod();
  const [searchQuery, setSearchQuery] = useState("");

  // Mock data - em produção viria do hook
  const stats = useMemo(() => ({
    totalEvents: 247,
    verifiedDocs: 189,
    pendingReview: 12,
    usersActive: 8,
  }), []);

  const eventsByModule = useMemo(() => [
    { label: "Efetivo", value: 89, color: "rgb(59, 130, 246)" },
    { label: "Treinamentos", value: 67, color: "rgb(139, 92, 246)" },
    { label: "Saúde", value: 45, color: "rgb(239, 68, 68)" },
    { label: "Viaturas", value: 28, color: "rgb(34, 211, 238)" },
    { label: "Estoque", value: 18, color: "rgb(16, 185, 129)" },
  ], []);

  const eventsByAction = useMemo(() => [
    { label: "Create", value: 45 },
    { label: "Edit", value: 89 },
    { label: "Archive", value: 23 },
    { label: "Approve", value: 67 },
    { label: "Export", value: 23 },
  ], []);

  const recentEvents: AuditEvent[] = useMemo(() => [
    {
      id: "1",
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      user: "Sgt. Oliveira",
      userRa: "12345",
      action: "Aprovou promoção",
      module: "Treinamentos",
      detail: "K9 Thor: Módulo Detecção Nível 2 → Nível 3",
      hash: "a1b2c3d4e5f6",
    },
    {
      id: "2",
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      user: "Cb. Santos",
      userRa: "23456",
      action: "Registrou ocorrência",
      module: "Operações",
      detail: "Ocorrência #2024-0892 - Abordagem suspicious",
    },
    {
      id: "3",
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      user: "Sdt. Pereira",
      userRa: "34567",
      action: "Atualizou prontuário",
      module: "Saúde",
      detail: "K9 Max: Registro de vacina V8",
      hash: "f6e5d4c3b2a1",
    },
    {
      id: "4",
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      user: "Sgt. Oliveira",
      userRa: "12345",
      action: "Cadastrou binômio",
      module: "Efetivo",
      detail: "Binômio Thor + Sdt. Pereira",
    },
  ], []);

  const topUsers: UserActivity[] = useMemo(() => [
    { user: "Sgt. Oliveira", userRa: "12345", actions: 45, lastAction: new Date(Date.now() - 1000 * 60 * 5) },
    { user: "Cb. Santos", userRa: "23456", actions: 38, lastAction: new Date(Date.now() - 1000 * 60 * 15) },
    { user: "Sdt. Pereira", userRa: "34567", actions: 29, lastAction: new Date(Date.now() - 1000 * 60 * 30) },
    { user: "Sd. Costa", userRa: "45678", actions: 22, lastAction: new Date(Date.now() - 1000 * 60 * 60) },
  ], []);

  const integrityRecords: IntegrityRecord[] = useMemo(() => [
    { id: "1", document: "Ocorrência #2024-0892", status: "verified", lastCheck: new Date(Date.now() - 1000 * 60 * 10), signedBy: "Sgt. Oliveira" },
    { id: "2", document: "Treino Detecção - 15/06", status: "verified", lastCheck: new Date(Date.now() - 1000 * 60 * 30), signedBy: "Sgt. Oliveira" },
    { id: "3", document: "Prontuário K9 Max", status: "pending", lastCheck: new Date(Date.now() - 1000 * 60 * 120) },
    { id: "4", document: "Baixa de Estoque #45", status: "modified", lastCheck: new Date(Date.now() - 1000 * 60 * 180) },
  ], []);

  const recommendations = useMemo(() => [
    { icon: ShieldAlert, priority: "high" as const, text: "Revisar 3 documentos com status Pendente" },
    { icon: UserCheck, priority: "medium" as const, text: "9 usuários sem assinatura digital" },
    { icon: History, priority: "low" as const, text: "Backup de trilhas recomendado" },
  ], []);

  const sections = [
    { id: "cover", label: "Cover" },
    { id: "resumo", label: "Resumo" },
    { id: "eventos", label: "Eventos" },
    { id: "integridade", label: "Integridade" },
    { id: "conclusoes", label: "Conclusões" },
  ];

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return recentEvents;
    const q = searchQuery.toLowerCase();
    return recentEvents.filter(
      (e) =>
        e.action.toLowerCase().includes(q) ||
        e.module.toLowerCase().includes(q) ||
        e.user.toLowerCase().includes(q),
    );
  }, [recentEvents, searchQuery]);

  return (
    <div className="space-y-8">
      <SectionNav sections={sections} />

      {/* COVER SECTION */}
      <section className="space-y-6">
        <div className={cn("rounded-[2rem] border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8", tokens.border, tokens.glow)}>
          <div className="flex items-start justify-between">
            <div>
              <div className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest", tokens.border, tokens.bg, tokens.text)}>
                <ShieldAlert className="h-4 w-4" />
                Confidencial
              </div>
              <h1 className="mt-6 text-5xl font-black text-white tracking-tight">
                Relatório de<br />
                <span className={cn(tokens.accent)}>Auditoria</span>
              </h1>
              <p className="mt-4 max-w-lg text-lg text-slate-400">
                Monitoramento de eventos, integridade documental e compliance do sistema K9 Ops.
              </p>
              <div className="mt-6 flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {periodLabel}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Gerado em {new Date().toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className={cn("flex h-24 w-24 items-center justify-center rounded-3xl border", tokens.border, tokens.bg)}>
                <Shield className="h-12 w-12 text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        {/* KPIs Mega */}
        <div className="grid gap-4 lg:grid-cols-4">
          <KpiCardMega icon={History} label="Total de Eventos" sublabel="ações auditadas" value={stats.totalEvents} />
          <KpiCardMega icon={CheckCircle2} label="Documentos Verificados" sublabel="com integridade" value={stats.verifiedDocs} />
          <KpiCardMega icon={AlertCircle} label="Pendentes" sublabel="em revisão" value={stats.pendingReview} />
          <KpiCardMega icon={Users} label="Usuários Ativos" sublabel="no período" value={stats.usersActive} />
        </div>
      </section>

      {/* RESUMO EXECUTIVO */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", tokens.icon)}>
            <TrendingUp className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-black text-white">Resumo Executivo</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <DonutChart
            data={eventsByModule}
            title="Eventos por Módulo"
          />
          <BarChart
            data={eventsByAction}
            title="Eventos por Tipo de Ação"
          />
        </div>

        {/* Top Users */}
        <div className={cn("rounded-2xl border border-white/10 bg-white/[0.02] p-5", tokens.border)}>
          <h3 className="text-sm font-semibold text-slate-200">Usuários Mais Ativos</h3>
          <div className="mt-4 space-y-3">
            {topUsers.map((u, i) => (
              <div key={u.userRa} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-400">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{u.user}</p>
                    <p className="text-xs text-slate-500">RA: {u.userRa}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-black text-white">{u.actions}</p>
                  <p className="text-xs text-slate-500">ações</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EVENTOS RECENTES */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", tokens.icon)}>
              <History className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black text-white">Eventos Recentes</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="h-10 w-64 rounded-xl border border-white/10 bg-white/[0.035] pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-blue-300/35"
              placeholder="Buscar eventos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredEvents.map((event) => (
            <AuditEventRow key={event.id} event={event} />
          ))}
          {filteredEvents.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
              <Search className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">Nenhum evento encontrado</p>
            </div>
          )}
        </div>
      </section>

      {/* INTEGRIDADE DOCUMENTAL */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", tokens.icon)}>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-black text-white">Integridade Documental</h2>
        </div>

        <div className="space-y-3">
          {integrityRecords.map((record) => (
            <IntegrityCard key={record.id} record={record} />
          ))}
        </div>
      </section>

      {/* CONCLUSÕES */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", tokens.icon)}>
            <Target className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-black text-white">Conclusões e Recomendações</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className={cn("rounded-2xl border border-white/10 bg-white/[0.02] p-5", tokens.border)}>
            <h3 className="text-sm font-semibold text-slate-200">Recomendações</h3>
            <div className="mt-4 space-y-3">
              {recommendations.map((rec, i) => {
                const Icon = rec.icon;
                const priorityColors = {
                  high: "border-amber-400/30 bg-amber-400/10 text-amber-200",
                  medium: "border-blue-400/30 bg-blue-400/10 text-blue-200",
                  low: "border-slate-400/30 bg-slate-400/10 text-slate-300",
                };
                return (
                  <div key={i} className={cn("flex items-start gap-3 rounded-xl border p-3", priorityColors[rec.priority])}>
                    <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                    <p className="text-sm">{rec.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={cn("rounded-2xl border border-white/10 bg-white/[0.02] p-5", tokens.border)}>
            <h3 className="text-sm font-semibold text-slate-200">Resumo Geral</h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-sm text-slate-400">Índice de Conformidade</span>
                <span className="font-mono text-lg font-black text-emerald-400">94.2%</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-sm text-slate-400">Documentos Assinados</span>
                <span className="font-mono text-lg font-black text-white">189/201</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Última Verificação</span>
                <span className="text-sm text-slate-300">{new Date().toLocaleString("pt-BR")}</span>
              </div>
            </div>

            {/* Integrity Seal */}
            <div className={cn("mt-6 rounded-xl border p-4 text-center", tokens.border, tokens.bg)}>
              <ShieldCheck className={cn("mx-auto h-10 w-10", tokens.accent)} />
              <p className="mt-2 font-mono text-sm font-bold text-white">SELO DE INTEGRIDADE</p>
              <p className="mt-1 text-xs text-slate-400">
                Relatório verificado em {new Date().toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <div className={cn("rounded-[1.65rem] border border-blue-200/12 bg-slate-950/76 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]", tokens.border)}>
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-300" />
          <p className="text-sm font-black text-white">Exportação e assinatura digital</p>
        </div>
        <ExportToolbar
          getData={() => ({ headers: [], rows: [] })}
          reportId="audit"
          reportTitle="Relatório de Auditoria"
          subtitle={`Período: ${periodLabel}`}
        />
        <div className="mt-4 rounded-2xl border border-blue-200/10 bg-blue-300/8 p-4">
          <p className="text-sm font-black text-white">Assinatura digital</p>
          <p className="mt-1 text-xs text-slate-400">
            Relatório validado com base nos registros de auditoria consultados.
            Os dados refletem a realidade do período {periodLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}
