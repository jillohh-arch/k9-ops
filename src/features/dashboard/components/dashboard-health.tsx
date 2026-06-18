"use client";

import {
  AlertCircle,
  CalendarDays,
  HeartPulse,
  RefreshCw,
  Scale,
  Stethoscope,
  Syringe,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { HealthMetrics } from "./dashboard-types";
import { formatCount, toneClasses } from "./dashboard-utils";

export interface DashboardHealthProps {
  healthMetrics: HealthMetrics;
  healthLoading: boolean;
  healthError: string | null;
  readinessPercent: number;
  periodLabel: string;
}

export function DashboardHealth({
  healthMetrics,
  healthLoading,
  healthError,
  readinessPercent,
  periodLabel,
}: DashboardHealthProps) {
  return (
    <section>
      <article className="overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col justify-between gap-4 border-b border-white/8 p-5 md:flex-row md:items-start">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
              <HeartPulse className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">
                Saúde e prontidão K9
              </h2>
              <p className="mt-0.5 text-sm text-slate-400">
                Vacinas, pesagem canônica e exames dos caes ativos.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={healthMetrics.critical > 0 ? "red" : "green"}>
              {healthLoading
                ? "..."
                : healthError
                  ? "dados indisponíveis"
                  : `${formatCount(healthMetrics.critical)} críticos`}
            </Badge>
            <Badge tone="cyan">
              {healthLoading
                ? "..."
                : `${formatCount(healthMetrics.periodEvents)} registros em ${periodLabel.toLowerCase()}`}
            </Badge>
          </div>
        </div>

        <div className="grid 2xl:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-white/8 p-5 2xl:border-r 2xl:border-b-0">
            <div className="rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.08] to-cyan-300/[0.025] p-5">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200/70">
                    Prontos por evidência
                  </p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-mono text-5xl font-black text-white">
                      {healthLoading
                        ? "..."
                        : healthError
                          ? "--"
                          : formatCount(healthMetrics.ready)}
                    </span>
                    <span className="font-mono text-lg text-slate-400">
                      / {healthLoading ? "..." : formatCount(healthMetrics.total)}
                    </span>
                  </div>
                  <p className="mt-2 max-w-md text-xs leading-5 text-slate-400">
                    Critério: vacinação vigente e último registro de peso
                    dentro da faixa ideal cadastrada.
                  </p>
                </div>
                <p className="font-mono text-3xl font-black text-emerald-300">
                  {healthLoading || healthError
                    ? "--"
                    : `${formatCount(readinessPercent)}%`}
                </p>
              </div>
              <div className="mt-4 h-2 rounded-full bg-black/25">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  detail: "exigem regularização",
                  icon: Syringe,
                  label: "Vacinas vencidas",
                  tone: "red",
                  value: healthMetrics.vaccinesOverdue,
                },
                {
                  detail: "nos próximos 30 dias",
                  icon: CalendarDays,
                  label: "Vacinas a vencer",
                  tone: "amber",
                  value: healthMetrics.vaccinesDueSoon,
                },
                {
                  detail: "fora do intervalo ideal",
                  icon: Scale,
                  label: "Peso em atenção",
                  tone: "blue",
                  value: healthMetrics.outOfRangeWeight,
                },
                {
                  detail: "vacina, peso ou faixa ausente",
                  icon: Stethoscope,
                  label: "Dados incompletos",
                  tone: "violet",
                  value: healthMetrics.incomplete,
                },
              ].map((metric) => (
                <div
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                  key={metric.label}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                      toneClasses(metric.tone),
                    )}
                  >
                    <metric.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-white">
                        {metric.label}
                      </p>
                      <span className="font-mono text-2xl font-black text-white">
                        {healthLoading
                          ? "..."
                          : healthError
                            ? "--"
                            : formatCount(metric.value)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {metric.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-white">
                  K9 que exigem atenção
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Ate 4 prioridades clínicas ou lacunas de cadastro.
                </p>
              </div>
              <Badge tone="slate">{healthMetrics.attention.length} exibidos</Badge>
            </div>

            {healthLoading ? (
              <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
                Carregando prontuários...
              </div>
            ) : healthError ? (
              <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-5 text-sm text-amber-100/80">
                <p>
                  Algumas informações de saúde não estão disponíveis para este
                  perfil no momento. O restante do dashboard continua válido.
                </p>
                <button
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-300/[0.15]"
                  onClick={() => window.location.reload()}
                  type="button"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Tentar novamente
                </button>
              </div>
            ) : healthMetrics.attention.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {healthMetrics.attention.map((dog) => {
                  const primary = dog.issues[0];
                  const isCritical = dog.issues.some(
                    (issue) => issue.severity === "critical",
                  );
                  const hasWarning = dog.issues.some(
                    (issue) => issue.severity === "warning",
                  );

                  return (
                    <div
                      className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                      key={dog.dogId}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-white">
                            {dog.dogName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {dog.issues.length} ponto(s) para revisar
                          </p>
                        </div>
                        <Badge
                          tone={
                            isCritical
                              ? "red"
                              : hasWarning
                                ? "yellow"
                                : "slate"
                          }
                        >
                          {isCritical
                            ? "crítico"
                            : hasWarning
                              ? "atenção"
                              : "cadastro"}
                        </Badge>
                      </div>
                      <div className="mt-4 flex gap-3">
                        <AlertCircle
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            isCritical
                              ? "text-red-300"
                              : hasWarning
                                ? "text-amber-300"
                                : "text-slate-400",
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-200">
                            {primary.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {primary.detail}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-5 text-sm text-emerald-200/80">
                Nenhuma pendência calculável nos prontuários ativos.
              </div>
            )}

            <p className="mt-4 text-xs leading-5 text-slate-500">
              A prontidão e um indicador administrativo. A avaliação clínica
              continua pertencendo ao profissional responsável.
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}
