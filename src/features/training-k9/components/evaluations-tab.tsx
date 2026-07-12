"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Search,
  Timer,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  EVALUATION_SUBTABS,
  useEvaluationsData,
  type EvaluationRequest,
  type EvaluationSubtab,
} from "../hooks/use-evaluations-data";
import { TrainingK9Empty, TrainingK9Skeleton } from "./training-k9-shell";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatWaiting(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "Hoje";
  if (days === 1) return "Há 1 dia";
  return `Há ${days} dias`;
}

function statusLabel(status: string): string {
  if (status === "pending") return "Pendente";
  if (status === "approved") return "Aprovada";
  if (status === "rejected") return "Rejeitada";
  return status;
}

function statusTone(status: string): "yellow" | "green" | "red" | "slate" {
  if (status === "pending") return "yellow";
  if (status === "approved") return "green";
  if (status === "rejected") return "red";
  return "slate";
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const toneClasses = {
  yellow: "from-amber-300/20 text-amber-200 shadow-amber-500/10",
  red: "from-red-400/20 text-red-300 shadow-red-500/10",
  green: "from-emerald-400/20 text-emerald-300 shadow-emerald-500/10",
  cyan: "from-cyan-300/20 text-cyan-200 shadow-cyan-500/10",
};

function EvalKpi({
  icon: Icon,
  label,
  tone = "cyan",
  tooltip,
  value,
}: {
  icon: typeof Clock;
  label: string;
  tone?: keyof typeof toneClasses;
  tooltip?: string;
  value: string | number;
}) {
  return (
    <article
      aria-label={`${label}: ${value}`}
      className="group relative overflow-hidden rounded-2xl border border-cyan-300/10 bg-slate-950/55 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/25"
      title={tooltip}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent opacity-80",
          toneClasses[tone],
        )}
      />
      <div className="relative flex items-center gap-3">
        <Badge tone={tone} className="shrink-0 rounded-xl p-2 shadow-lg">
          <Icon className="h-3.5 w-3.5" />
        </Badge>
        <div className="min-w-0">
          <p className="font-mono text-xl font-black text-white">{value}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
            {label}
          </p>
        </div>
      </div>
    </article>
  );
}

// ─── Subtabs ──────────────────────────────────────────────────────────────────

function EvaluationSubtabs({
  active,
  counts,
  onChange,
}: {
  active: EvaluationSubtab;
  counts: { pending: number; approved: number; rejected: number };
  onChange: (tab: EvaluationSubtab) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.025] p-1">
      {EVALUATION_SUBTABS.map((tab) => {
        const isActive = active === tab.value;
        const count = counts[tab.value];
        return (
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              isActive
                ? "bg-cyan-300/10 text-cyan-200 shadow-sm"
                : "text-slate-400 hover:text-white",
            )}
            key={tab.value}
            onClick={() => onChange(tab.value)}
            type="button"
          >
            {tab.label}
            {count > 0 ? (
              <span className={cn(
                "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black",
                isActive ? "bg-cyan-300/20 text-cyan-200" : "bg-white/10 text-slate-500",
              )}>
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function EvalFilters({
  filters,
  onFiltersChange,
}: {
  filters: { search: string };
  onFiltersChange: (f: { search: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-48">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          aria-label="Buscar avaliação"
          className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
          onChange={(e) => onFiltersChange({ search: e.target.value })}
          placeholder="Buscar por K9, condutor, modalidade..."
          type="text"
          value={filters.search}
        />
      </div>
      {filters.search ? (
        <button
          aria-label="Limpar busca"
          className="flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-bold text-slate-400 transition hover:text-white"
          onClick={() => onFiltersChange({ search: "" })}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
          Limpar
        </button>
      ) : null}
    </div>
  );
}

// ─── Request Row (desktop) ────────────────────────────────────────────────────

function EvalRow({ request }: { request: EvaluationRequest }) {
  const waiting = formatWaiting(request.waitingDays);

  return (
    <Link
      className="group flex items-center gap-4 rounded-xl border border-cyan-200/8 bg-slate-900/40 px-4 py-3 transition hover:border-cyan-300/20 hover:bg-slate-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50"
      href={`/training/evaluations/${request.id}`}
    >
      {/* Avatar */}
      <div className="shrink-0">
        {request.dogPhotoUrl ? (
          <Image
            alt={request.dogName}
            className="h-10 w-10 rounded-xl border border-cyan-300/15 object-cover"
            height={40}
            src={request.dogPhotoUrl}
            width={40}
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/15 bg-slate-800/60 text-sm font-black text-cyan-300">
            {request.dogName.charAt(0)}
          </div>
        )}
      </div>

      {/* Col 1: K9 + modality + advance */}
      <div className="min-w-0 flex-[2]">
        <p className="text-sm font-bold text-white">{request.dogName}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {request.modalityLabel}
        </p>
        {request.currentModuleName && request.nextModuleName ? (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {request.currentModuleName} → {request.nextModuleName}
          </p>
        ) : null}
      </div>

      {/* Col 2: conductor + date */}
      <div className="hidden min-w-0 flex-[2] md:block">
        {request.conductorName ? (
          <p className="text-xs text-slate-300">{request.conductorName}</p>
        ) : null}
        {request.createdAt ? (
          <p className="mt-0.5 text-xs text-slate-500">{formatDate(request.createdAt)}</p>
        ) : null}
      </div>

      {/* Col 3: waiting / decision info */}
      <div className="hidden min-w-0 flex-1 lg:block">
        {request.status === "pending" && waiting ? (
          <p className={cn(
            "text-xs font-medium",
            request.waitingDays !== null && request.waitingDays > 7 ? "text-amber-300" : "text-slate-400",
          )}>
            {waiting}
          </p>
        ) : null}
        {request.status !== "pending" && request.decidedAt ? (
          <p className="text-xs text-slate-500">{formatDate(request.decidedAt)}</p>
        ) : null}
        {request.decisionBy ? (
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{request.decisionBy}</p>
        ) : null}
      </div>

      {/* Status + chevron */}
      <div className="flex shrink-0 items-center gap-3">
        <Badge tone={statusTone(request.status)} className="text-[10px]">
          {statusLabel(request.status)}
        </Badge>
        <ChevronRight className="h-3.5 w-3.5 text-slate-600 transition group-hover:text-cyan-300" />
      </div>
    </Link>
  );
}

// ─── Request Card (mobile) ────────────────────────────────────────────────────

function EvalCard({ request }: { request: EvaluationRequest }) {
  const waiting = formatWaiting(request.waitingDays);

  return (
    <Link
      className="group flex flex-col rounded-2xl border border-cyan-300/10 bg-slate-950/55 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50"
      href={`/training/evaluations/${request.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {request.dogPhotoUrl ? (
            <Image
              alt={request.dogName}
              className="h-9 w-9 rounded-lg border border-cyan-300/15 object-cover"
              height={36}
              src={request.dogPhotoUrl}
              width={36}
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-300/15 bg-slate-800/60 text-xs font-black text-cyan-300">
              {request.dogName.charAt(0)}
            </div>
          )}
          <p className="text-sm font-bold text-white">{request.dogName}</p>
        </div>
        <Badge tone={statusTone(request.status)} className="text-[9px]">
          {statusLabel(request.status)}
        </Badge>
      </div>

      <p className="mt-2 text-xs text-slate-400">{request.modalityLabel}</p>

      {request.currentModuleName && request.nextModuleName ? (
        <p className="mt-1 text-[11px] text-slate-500">
          {request.currentModuleName} → {request.nextModuleName}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
        {request.conductorName ? <span>{request.conductorName}</span> : null}
        {request.createdAt ? <span>{formatDate(request.createdAt)}</span> : null}
        {request.status === "pending" && waiting ? (
          <span className={request.waitingDays !== null && request.waitingDays > 7 ? "text-amber-300" : ""}>
            {waiting}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EvaluationsTab() {
  const data = useEvaluationsData();
  const [subtab, setSubtab] = useState<EvaluationSubtab>("pending");
  const [filters, setFilters] = useState<{ search: string }>({ search: "" });

  const byStatus = useMemo(() => ({
    pending: data.requests.filter((r) => r.status === "pending")
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)),
    approved: data.requests.filter((r) => r.status === "approved")
      .sort((a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0)),
    rejected: data.requests.filter((r) => r.status === "rejected")
      .sort((a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0)),
  }), [data.requests]);

  const activeList = byStatus[subtab];

  const filtered = useMemo(() => {
    if (!filters.search) return activeList;
    const q = filters.search.toLowerCase();
    return activeList.filter(
      (r) =>
        r.dogName.toLowerCase().includes(q) ||
        r.modalityLabel.toLowerCase().includes(q) ||
        r.conductorName.toLowerCase().includes(q) ||
        r.currentModuleName?.toLowerCase().includes(q) ||
        r.nextModuleName?.toLowerCase().includes(q),
    );
  }, [activeList, filters.search]);

  if (data.loading) {
    return <TrainingK9Skeleton />;
  }

  if (data.error) {
    return (
      <TrainingK9Empty
        title="Erro ao carregar avaliações"
        description={data.error}
      />
    );
  }

  const avgLabel = data.metrics.avgDecisionDays !== null
    ? `${data.metrics.avgDecisionDays} ${data.metrics.avgDecisionDays === 1 ? "dia" : "dias"}`
    : "—";

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <EvalKpi
          icon={Clock}
          label={data.metrics.pending === 1 ? "Pendente" : "Pendentes"}
          tone="yellow"
          tooltip="Solicitações aguardando análise de um instrutor."
          value={data.metrics.pending}
        />
        <EvalKpi
          icon={AlertTriangle}
          label="Aguardando > 7 dias"
          tone="red"
          tooltip="Solicitações pendentes há mais de 7 dias desde a criação."
          value={data.metrics.waitingOver7Days}
        />
        <EvalKpi
          icon={CheckCircle2}
          label={data.metrics.approved === 1 ? "Aprovada" : "Aprovadas"}
          tone="green"
          tooltip="Total de solicitações aprovadas."
          value={data.metrics.approved}
        />
        <EvalKpi
          icon={Timer}
          label="Tempo médio"
          tone="cyan"
          tooltip="Média de dias entre criação e decisão, considerando apenas registros com ambas as datas."
          value={avgLabel}
        />
      </div>

      {/* Subtabs + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <EvaluationSubtabs
          active={subtab}
          counts={{
            pending: byStatus.pending.length,
            approved: byStatus.approved.length,
            rejected: byStatus.rejected.length,
          }}
          onChange={setSubtab}
        />
      </div>

      <EvalFilters filters={filters} onFiltersChange={setFilters} />

      {/* Refreshing */}
      {data.refreshing ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
          Atualizando...
        </div>
      ) : null}

      {/* List */}
      {filtered.length === 0 ? (
        <TrainingK9Empty
          title={
            filters.search
              ? "Nenhuma avaliação encontrada"
              : subtab === "pending"
                ? "Nenhuma avaliação pendente"
                : subtab === "approved"
                  ? "Nenhuma avaliação aprovada"
                  : "Nenhuma avaliação rejeitada"
          }
          description={
            filters.search
              ? "Tente ajustar a busca para encontrar a avaliação desejada."
              : subtab === "pending"
                ? "Não há solicitações aguardando análise."
                : subtab === "approved"
                  ? "Nenhuma avaliação aprovada no período."
                  : "Nenhuma avaliação rejeitada no período."
          }
        />
      ) : (
        <>
          <p className="text-sm text-slate-400">
            {filters.search
              ? `${filtered.length} de ${pluralize(activeList.length, "avaliação", "avaliações")}`
              : pluralize(filtered.length, "avaliação", "avaliações")}
          </p>

          {/* Desktop */}
          <div className="hidden space-y-2 sm:block">
            {filtered.map((r) => (
              <EvalRow key={r.id} request={r} />
            ))}
          </div>

          {/* Mobile */}
          <div className="grid gap-3 sm:hidden">
            {filtered.map((r) => (
              <EvalCard key={r.id} request={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
