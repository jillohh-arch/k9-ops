"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Clock, Dog, Search, X, ChevronRight, ChevronDown, Layers, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { paths } from "@/lib/routes/paths";

import {
  PERIOD_OPTIONS,
  useTrainingSessionsData,
  type TrainingSession,
} from "../hooks/use-training-sessions-data";
import { TrainingK9Empty, TrainingK9Skeleton } from "./training-k9-shell";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function formatResult(result: string | null): string {
  if (!result) return "Não informado";
  const r = result.toLowerCase().trim();
  if (r === "satisfatorio" || r === "satisfatório" || r === "success" || r === "approved") return "Satisfatório";
  if (r === "insatisfatorio" || r === "insatisfatório" || r === "failure" || r === "failed") return "Insatisfatório";
  if (r === "parcial" || r === "partial") return "Parcial";
  if (r === "completed" || r === "concluido" || r === "concluído") return "Concluída";
  return result.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function resultTone(result: string | null): "cyan" | "green" | "yellow" | "red" | "slate" {
  if (!result) return "slate";
  const r = result.toLowerCase().trim();
  if (["satisfatorio", "satisfatório", "success", "approved", "completed", "concluido", "concluído"].includes(r)) return "green";
  if (["insatisfatorio", "insatisfatório", "failure", "failed"].includes(r)) return "red";
  if (["parcial", "partial"].includes(r)) return "yellow";
  return "cyan";
}

function formatPhase(phase: string | null): string {
  if (!phase) return "";
  const p = phase.trim();
  if (/^\d+[a-zA-Z]?$/.test(p)) return `Fase ${p.toUpperCase()}`;
  const lower = p.toLowerCase();
  if (lower === "formation" || lower === "formacao") return "Formação";
  if (lower === "maintenance" || lower === "manutencao") return "Manutenção";
  if (lower === "evaluation" || lower === "avaliacao") return "Avaliação";
  if (lower === "warm_up" || lower === "aquecimento") return "Aquecimento";
  if (/^\d/.test(p)) return `Fase ${p.toUpperCase()}`;
  return p.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function composeModalityMatrix(modalityLabel: string, matrixLabel: string | null): string {
  if (!matrixLabel) return modalityLabel;
  const modalLower = modalityLabel.toLowerCase().trim();
  const matrixLower = matrixLabel.toLowerCase().trim();
  if (matrixLower.startsWith(modalLower)) {
    const suffix = matrixLabel.slice(modalityLabel.length).replace(/^[\s—\-·]+/, "").trim();
    return suffix ? `${modalityLabel} — ${suffix}` : modalityLabel;
  }
  return `${modalityLabel} — ${matrixLabel}`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const toneClasses = {
  cyan: "from-cyan-300/20 text-cyan-200 shadow-cyan-500/10",
  green: "from-emerald-400/20 text-emerald-300 shadow-emerald-500/10",
  yellow: "from-amber-300/20 text-amber-200 shadow-amber-500/10",
  slate: "from-slate-400/15 text-slate-300 shadow-slate-500/10",
};

function SessionKpi({
  description,
  icon: Icon,
  label,
  tone = "cyan",
  tooltip,
  truncated = false,
  value,
}: {
  description?: string;
  icon: typeof Dog;
  label: string;
  tone?: keyof typeof toneClasses;
  tooltip?: string;
  truncated?: boolean;
  value: string | number;
}) {
  return (
    <article
      aria-label={`${label}: ${value}${truncated ? "+" : ""}`}
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
          <p className="font-mono text-xl font-black text-white">
            {value}{truncated ? <span className="text-sm text-slate-400">+</span> : null}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
            {label}
          </p>
          {description ? (
            <p className="text-[10px] text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────

interface Filters {
  dog: string;
  modality: string;
  search: string;
}

const emptyFilters: Filters = { dog: "", modality: "", search: "" };

function FiltersBar({
  dogs,
  filters,
  modalities,
  onFiltersChange,
  onPeriodChange,
  period,
}: {
  dogs: Array<{ label: string; value: string }>;
  filters: Filters;
  modalities: Array<{ label: string; value: string }>;
  onFiltersChange: (f: Filters) => void;
  onPeriodChange: (p: string) => void;
  period: string;
}) {
  const hasFilters = filters.search || filters.dog || filters.modality;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        aria-label="Período"
        className="h-10 appearance-none rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/35"
        onChange={(e) => onPeriodChange(e.target.value)}
        value={period}
      >
        {PERIOD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <div className="relative flex-1 min-w-48">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          aria-label="Buscar sessão"
          className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder="Buscar por K9, condutor, modalidade..."
          type="text"
          value={filters.search}
        />
      </div>

      <select
        aria-label="Filtrar por K9"
        className="h-10 appearance-none rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/35"
        onChange={(e) => onFiltersChange({ ...filters, dog: e.target.value })}
        value={filters.dog}
      >
        <option value="">Todos os K9s</option>
        {dogs.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>

      <select
        aria-label="Filtrar por modalidade"
        className="h-10 appearance-none rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/35"
        onChange={(e) => onFiltersChange({ ...filters, modality: e.target.value })}
        value={filters.modality}
      >
        <option value="">Todas as modalidades</option>
        {modalities.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>

      {hasFilters ? (
        <button
          aria-label="Limpar filtros"
          className="flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-bold text-slate-400 transition hover:text-white"
          onClick={() => onFiltersChange(emptyFilters)}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
          Limpar
        </button>
      ) : null}
    </div>
  );
}

// ─── Session Row (desktop) ────────────────────────────────────────────────────

function SessionRow({ session }: { session: TrainingSession }) {
  const phase = formatPhase(session.phase);
  const result = formatResult(session.result);
  const tone = resultTone(session.result);
  const hasResult = !!session.result;
  const subtitle = composeModalityMatrix(session.modalityLabel, session.matrixLabel);

  return (
    <Link
      className="group flex items-center gap-4 rounded-xl border border-cyan-200/8 bg-slate-900/40 px-4 py-3 transition hover:border-cyan-300/20 hover:bg-slate-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50"
      href={`${paths.trainingDog}/${session.dogId}/sessions/${session.id}`}
    >
      {/* Col 1: K9 + modality */}
      <div className="min-w-0 flex-[2]">
        <p className="text-sm font-bold text-white">{session.dogName}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {subtitle}
        </p>
      </div>

      {/* Col 2: date + conductor */}
      <div className="hidden min-w-0 flex-[2] md:block">
        {session.date ? (
          <p className="text-xs text-slate-300">
            {formatDate(session.date)} · {formatTime(session.date)}
          </p>
        ) : null}
        {session.conductorName ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
            <User className="h-3 w-3" />
            {session.conductorName}
          </p>
        ) : null}
      </div>

      {/* Col 3: phase + duration */}
      <div className="hidden min-w-0 flex-1 lg:block">
        {phase ? (
          <p className="text-xs font-medium text-slate-300">{phase}</p>
        ) : null}
        {session.durationS ? (
          <p className="mt-0.5 text-xs text-slate-500">{formatDuration(session.durationS)}</p>
        ) : null}
      </div>

      {/* Col 4: result */}
      <div className="flex shrink-0 items-center gap-3">
        {hasResult ? (
          <Badge tone={tone} className="text-[10px]">
            {result}
          </Badge>
        ) : (
          <span className="text-[10px] text-slate-600">Sem resultado</span>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-600 transition group-hover:text-cyan-300" />
      </div>
    </Link>
  );
}

// ─── Session Card (mobile) ────────────────────────────────────────────────────

function SessionCard({ session }: { session: TrainingSession }) {
  const phase = formatPhase(session.phase);
  const result = formatResult(session.result);
  const tone = resultTone(session.result);
  const hasResult = !!session.result;
  const subtitle = composeModalityMatrix(session.modalityLabel, session.matrixLabel);

  return (
    <Link
      className="group flex flex-col rounded-2xl border border-cyan-300/10 bg-slate-950/55 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50"
      href={`${paths.trainingDog}/${session.dogId}/sessions/${session.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-white">{session.dogName}</p>
        {hasResult ? (
          <Badge tone={tone} className="text-[9px]">
            {result}
          </Badge>
        ) : (
          <span className="text-[9px] text-slate-600">Sem resultado</span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {subtitle}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
        {session.date ? <span>{formatDate(session.date)} · {formatTime(session.date)}</span> : null}
        {session.durationS ? <span>{formatDuration(session.durationS)}</span> : null}
        {phase ? <span>{phase}</span> : null}
      </div>
      {session.conductorName ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
          <User className="h-3 w-3" />
          {session.conductorName}
        </p>
      ) : null}
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SessionsTab() {
  const data = useTrainingSessionsData();
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const modalities = useMemo(() => {
    const set = new Set<string>();
    const list: Array<{ label: string; value: string }> = [];
    for (const s of data.sessions) {
      if (!set.has(s.modality)) {
        set.add(s.modality);
        list.push({ label: s.modalityLabel, value: s.modality });
      }
    }
    return list.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [data.sessions]);

  const dogs = useMemo(() => {
    const set = new Set<string>();
    const list: Array<{ label: string; value: string }> = [];
    for (const s of data.sessions) {
      if (!set.has(s.dogId)) {
        set.add(s.dogId);
        list.push({ label: s.dogName, value: s.dogId });
      }
    }
    return list.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [data.sessions]);

  const filtered = useMemo(() => {
    let result = data.sessions;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (s) =>
          s.dogName.toLowerCase().includes(q) ||
          s.modalityLabel.toLowerCase().includes(q) ||
          s.conductorName?.toLowerCase().includes(q) ||
          s.moduleLabel?.toLowerCase().includes(q) ||
          s.result?.toLowerCase().includes(q),
      );
    }

    if (filters.dog) {
      result = result.filter((s) => s.dogId === filters.dog);
    }

    if (filters.modality) {
      result = result.filter((s) => s.modality === filters.modality);
    }

    return result;
  }, [data.sessions, filters]);

  if (data.loading) {
    return <TrainingK9Skeleton />;
  }

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === data.period)?.label ?? "Período";
  const durationCoverage = data.metrics.sessionsLoaded > 0
    ? data.metrics.sessionsWithDuration > 0
      ? `em ${pluralize(data.metrics.sessionsWithDuration, "sessão", "sessões")}`
      : `Nenhuma sessão com duração`
    : undefined;

  const hasClientFilter = !!(filters.search || filters.dog || filters.modality);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SessionKpi
          icon={Calendar}
          label={data.metrics.sessionsLoaded === 1 ? "Sessão" : "Sessões"}
          tooltip={
            data.metrics.truncated
              ? `Existem mais sessões no período (${periodLabel}). Use "Carregar mais" para ver o restante.`
              : `Total de sessões carregadas (${periodLabel}).`
          }
          truncated={data.metrics.truncated}
          value={data.metrics.sessionsLoaded}
        />
        <SessionKpi
          icon={Dog}
          label={data.metrics.dogsWithSessions === 1 ? "K9 treinado" : "K9s treinados"}
          tone="green"
          tooltip={`Cães com ao menos uma sessão (${periodLabel}).`}
          truncated={data.metrics.truncated}
          value={data.metrics.dogsWithSessions}
        />
        <SessionKpi
          description={durationCoverage}
          icon={Clock}
          label="Tempo registrado"
          tone="yellow"
          tooltip="Soma da duração das sessões que possuem tempo informado."
          truncated={data.metrics.truncated}
          value={data.metrics.totalDurationS > 0 ? formatDuration(data.metrics.totalDurationS) : "—"}
        />
        <SessionKpi
          icon={Layers}
          label={data.metrics.modalitiesUsed === 1 ? "Modalidade" : "Modalidades"}
          tone="slate"
          tooltip={`Modalidades distintas praticadas (${periodLabel}).`}
          truncated={data.metrics.truncated}
          value={data.metrics.modalitiesUsed}
        />
      </div>

      {/* Filters */}
      <FiltersBar
        dogs={dogs}
        filters={filters}
        modalities={modalities}
        onFiltersChange={setFilters}
        onPeriodChange={(p) => data.setPeriod(p as "7d" | "30d" | "90d" | "recent")}
        period={data.period}
      />

      {/* Loading indicator for period change */}
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
            hasClientFilter
              ? "Nenhuma sessão encontrada"
              : "Nenhuma sessão no período"
          }
          description={
            hasClientFilter
              ? "Tente ajustar os filtros para encontrar a sessão desejada."
              : "Sessões de treinamento são registradas pelo aplicativo mobile. Tente ampliar o período."
          }
        />
      ) : (
        <>
          <p className="text-sm text-slate-400">
            {hasClientFilter
              ? `${filtered.length} de ${pluralize(data.sessions.length, "sessão", "sessões")}`
              : `${pluralize(filtered.length, "sessão encontrada", "sessões encontradas")}`}
            {data.metrics.truncated && !hasClientFilter ? " · existem mais registros" : ""}
          </p>

          {/* Desktop list */}
          <div className="hidden space-y-2 sm:block">
            {filtered.map((session) => (
              <SessionRow key={`${session.dogId}/${session.id}`} session={session} />
            ))}
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 sm:hidden">
            {filtered.map((session) => (
              <SessionCard key={`${session.dogId}/${session.id}`} session={session} />
            ))}
          </div>

          {/* Load more */}
          {data.hasMore ? (
            <div className="flex justify-center pt-2">
              <button
                className="flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-slate-900/60 px-5 py-2.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/30 hover:bg-slate-900/80 disabled:opacity-50"
                disabled={data.loadingMore}
                onClick={data.loadMore}
                type="button"
              >
                {data.loadingMore ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Carregar mais sessões
                  </>
                )}
              </button>
            </div>
          ) : data.sessions.length > 0 ? (
            <p className="text-center text-xs text-slate-600">
              Todos os registros foram carregados.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
