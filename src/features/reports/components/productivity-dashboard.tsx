"use client";

import {
  ArrowDownUp,
  BarChart3,
  Clock,
  Medal,
  PawPrint,
  RadioTower,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/charts/lazy-recharts";
import { Panel } from "@/components/form/form-primitives";
import { Button } from "@/components/ui/button";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  dashboardPeriodOptions,
  useDashboardPeriod,
  type DashboardPeriodDays,
} from "@/features/dashboard/providers/dashboard-period-provider";
import {
  ExportButton,
  ExportToolbar,
} from "@/features/reports/components/export-toolbar";
import {
  useProductivityData,
  type ConductorMetrics,
} from "@/features/reports/hooks/use-productivity-data";
import { cn } from "@/lib/utils";

// ─── Formatters ─────────────────────────────────────────────────────────────

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

function fmt(value: number) {
  return numberFormatter.format(value);
}

// ─── Sort logic ─────────────────────────────────────────────────────────────

type SortField =
  | "name"
  | "occurrences"
  | "trainingSessions"
  | "shiftHours"
  | "avgOccurrencesPerShift";

function sortConductors(
  list: ConductorMetrics[],
  field: SortField,
  asc: boolean,
): ConductorMetrics[] {
  const sorted = [...list].sort((a, b) => {
    if (field === "name") return a.name.localeCompare(b.name);
    return a[field] - b[field];
  });
  return asc ? sorted : sorted.reverse();
}

// ─── Components ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof Clock;
  label: string;
  tone: string;
  value: string;
}) {
  const toneMap: Record<string, string> = {
    cyan: "border-cyan-300/20 bg-cyan-400/8 text-cyan-200",
    emerald: "border-emerald-300/20 bg-emerald-400/8 text-emerald-200",
    violet: "border-violet-300/20 bg-violet-400/8 text-violet-200",
    amber: "border-amber-300/20 bg-amber-400/8 text-amber-200",
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border p-4",
        toneMap[tone] ?? toneMap.cyan,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 opacity-70" />
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
          {label}
        </span>
      </div>
      <span className="font-mono text-2xl font-black text-white">{value}</span>
    </div>
  );
}

function PeriodSelector() {
  const { periodDays, setPeriodDays } = useDashboardPeriod();

  return (
    <div className="flex gap-2">
      {dashboardPeriodOptions.map((option) => (
        <button
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold transition",
            option.days === periodDays
              ? "bg-cyan-300 text-slate-950"
              : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
          )}
          key={option.days}
          onClick={() => setPeriodDays(option.days)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ConductorTable({
  conductors,
}: {
  conductors: ConductorMetrics[];
}) {
  const [sortField, setSortField] = useState<SortField>("occurrences");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(
    () => sortConductors(conductors, sortField, sortAsc),
    [conductors, sortField, sortAsc],
  );

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  const columns: Array<{ field: SortField; label: string }> = [
    { field: "name", label: "Condutor" },
    { field: "occurrences", label: "Ocorrencias" },
    { field: "trainingSessions", label: "Treinos" },
    { field: "shiftHours", label: "Horas turno" },
    { field: "avgOccurrencesPerShift", label: "Media/turno" },
  ];

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-cyan-200/10 bg-black/14 p-8 text-center text-sm text-slate-400">
        Nenhum condutor com atividade no periodo selecionado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8">
            <th className="px-2 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              #
            </th>
            {columns.map((col) => (
              <th
                className="cursor-pointer px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 transition hover:text-cyan-200"
                key={col.field}
                onClick={() => handleSort(col.field)}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {sortField === col.field && (
                    <ArrowDownUp className="h-3 w-3 text-cyan-300" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((conductor, index) => (
            <tr
              className="border-b border-white/5 transition hover:bg-white/[0.03]"
              key={conductor.id}
            >
              <td className="px-2 py-3">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    index === 0 && "bg-amber-400/20 text-amber-200",
                    index === 1 && "bg-slate-400/20 text-slate-200",
                    index === 2 && "bg-orange-400/20 text-orange-200",
                    index > 2 && "text-slate-500",
                  )}
                >
                  {index + 1}
                </span>
              </td>
              <td className="px-3 py-3 font-semibold text-white">
                {conductor.name}
              </td>
              <td className="px-3 py-3 font-mono text-cyan-200">
                {conductor.occurrences}
              </td>
              <td className="px-3 py-3 font-mono text-violet-200">
                {conductor.trainingSessions}
              </td>
              <td className="px-3 py-3 font-mono text-emerald-200">
                {fmt(conductor.shiftHours)}h
              </td>
              <td className="px-3 py-3 font-mono text-amber-200">
                {fmt(conductor.avgOccurrencesPerShift)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductivityBarChart({
  conductors,
}: {
  conductors: ConductorMetrics[];
}) {
  const top10 = conductors.slice(0, 10);

  if (top10.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-cyan-200/10 bg-black/14 text-sm text-slate-400">
        Sem dados para o grafico no periodo selecionado.
      </div>
    );
  }

  const data = top10.map((c) => ({
    name: c.name.length > 12 ? `${c.name.slice(0, 12)}…` : c.name,
    ocorrencias: c.occurrences,
    treinos: c.trainingSessions,
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          data={data}
          margin={{ bottom: 20, left: 0, right: 10, top: 10 }}
        >
          <CartesianGrid opacity={0.08} strokeDasharray="3 3" vertical={false} />
          <XAxis
            angle={-30}
            dataKey="name"
            fontSize={11}
            stroke="#475569"
            textAnchor="end"
            tick={{ fill: "#94a3b8" }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            fontSize={11}
            stroke="#475569"
            tick={{ fill: "#94a3b8" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid rgba(34,211,238,0.2)",
              borderRadius: "12px",
              color: "#e2e8f0",
              fontSize: "12px",
            }}
            cursor={{ fill: "rgba(34,211,238,0.05)" }}
          />
          <Bar
            dataKey="ocorrencias"
            fill="#22d3ee"
            name="Ocorrencias"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="treinos"
            fill="#a855f7"
            name="Treinos"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BinomialCard({
  binomial,
}: {
  binomial: {
    conductorName: string;
    dogName: string;
    id: string;
    occurrences: number;
    readinessScore: number;
    trainingSessions: number;
  };
}) {
  const readinessColor =
    binomial.readinessScore >= 80
      ? "text-emerald-300"
      : binomial.readinessScore >= 50
        ? "text-amber-300"
        : "text-red-300";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-cyan-200/12 bg-slate-950/60 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10">
          <PawPrint className="h-4 w-4 text-cyan-200" />
        </span>
        <div>
          <p className="text-sm font-bold text-white">{binomial.dogName}</p>
          <p className="text-xs text-slate-400">{binomial.conductorName}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="font-mono text-lg font-black text-cyan-200">
            {binomial.occurrences}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Ocorr.
          </p>
        </div>
        <div>
          <p className="font-mono text-lg font-black text-violet-200">
            {binomial.trainingSessions}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Treinos
          </p>
        </div>
        <div>
          <p className={cn("font-mono text-lg font-black", readinessColor)}>
            {binomial.readinessScore}%
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Prontidao
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function ProductivityDashboard() {
  const { can } = useAccessControl();
  const { periodDays, periodLabel } = useDashboardPeriod();
  const data = useProductivityData(periodDays);

  const getExportData = useCallback(() => {
    const headers = [
      "Condutor",
      "Ocorrencias",
      "Treinos",
      "Horas Turno",
      "Media/Turno",
    ];
    const rows = data.conductorRanking.map((c) => [
      c.name,
      String(c.occurrences),
      String(c.trainingSessions),
      fmt(c.shiftHours),
      fmt(c.avgOccurrencesPerShift),
    ]);
    return { headers, rows };
  }, [data.conductorRanking]);

  if (!can("reports", "view")) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-slate-400">
          Voce nao tem permissao para acessar este relatorio.
        </p>
      </div>
    );
  }

  if (data.loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          <p className="text-sm text-slate-400">Carregando produtividade…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black text-white">
            <BarChart3 className="h-7 w-7 text-cyan-300" />
            Produtividade Operacional
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Desempenho por condutor e binomio — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector />
          <ExportButton
            getData={getExportData}
            reportId="productivity"
            reportTitle="Produtividade Operacional"
            subtitle={`Periodo: ${periodLabel}`}
          />
        </div>
      </header>

      {/* Summary Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={RadioTower}
          label="Ocorrencias"
          tone="cyan"
          value={fmt(data.summary.totalOccurrences)}
        />
        <SummaryCard
          icon={Target}
          label="Treinos"
          tone="violet"
          value={fmt(data.summary.totalTrainingSessions)}
        />
        <SummaryCard
          icon={Clock}
          label="Horas em turno"
          tone="emerald"
          value={`${fmt(data.summary.totalShiftHours)}h`}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Media ocorr./turno"
          tone="amber"
          value={fmt(data.summary.avgOccurrencesPerShift)}
        />
      </section>

      {/* Ranking Table */}
      <Panel
        action={
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Medal className="h-4 w-4 text-amber-300" />
            Ranking
          </span>
        }
        subtitle="Classificacao por volume de atividade no periodo"
        title="Ranking de Condutores"
      >
        <ConductorTable conductors={data.conductorRanking} />
      </Panel>

      {/* Bar Chart */}
      <Panel
        subtitle="Comparativo de ocorrencias e treinos (Top 10)"
        title="Grafico Comparativo"
      >
        <ProductivityBarChart conductors={data.conductorRanking} />
      </Panel>

      {/* Binomials Section */}
      <Panel
        action={
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <PawPrint className="h-4 w-4 text-emerald-300" />
            {data.binomialMetrics.length} binomios
          </span>
        }
        subtitle="Produtividade e prontidao por binomio"
        title="Binomios"
      >
        {data.binomialMetrics.length === 0 ? (
          <div className="rounded-2xl border border-cyan-200/10 bg-black/14 p-8 text-center text-sm text-slate-400">
            Nenhum binomio com atividade registrada no periodo.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.binomialMetrics.map((binomial) => (
              <BinomialCard binomial={binomial} key={binomial.id} />
            ))}
          </div>
        )}
      </Panel>

      {/* Export */}
      <Panel subtitle={`Periodo: ${periodLabel}`} title="Exportacao">
        <ExportToolbar
          getData={getExportData}
          reportId="productivity"
          reportTitle="Produtividade Operacional"
          subtitle={`Periodo: ${periodLabel}`}
        />
      </Panel>
    </div>
  );
}
