"use client";

/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Executive KPI cards for Health Reports.
 *
 * Displays truthful metrics across:
 * 1. Prontidão Operacional (Point-in-Time)
 * 2. Restrições Operacionais (Point-in-Time)
 * 3. Casos Clínicos (Active + Period)
 * 4. Agenda de Procedimentos (Actionable + Period)
 */

import {
  Activity,
  AlertCircle,
  AlertOctagon,
  CalendarClock,
  Clock,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HealthReportsAggregate } from "../domain/health-reports-types";

interface HealthReportsKpiGridProps {
  aggregate: HealthReportsAggregate;
}

export function HealthReportsKpiGrid({ aggregate }: HealthReportsKpiGridProps) {
  const { readiness, clinical, schedule, period } = aggregate;

  const periodLabel =
    period === "today" ? "Hoje" : period === "7d" ? "7 dias" : "30 dias";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Prontidão Operacional */}
      <Card className="border-cyan-500/20 bg-slate-900/80">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">
            Prontidão da Tropa
          </CardTitle>
          <ShieldCheck className="h-4 w-4 text-cyan-400" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">
              {readiness.statusCounts.operational}
            </span>
            <span className="text-xs text-slate-400">
              / {readiness.totalDogsInScope} operacionais
            </span>
          </div>

          <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Apto c/ restrições:</span>
              <span className="font-semibold text-amber-300">
                {readiness.statusCounts.fit_with_restrictions}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Inaptos (temporário):</span>
              <span className="font-semibold text-red-400">
                {readiness.statusCounts.temporarily_unfit}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Com atenção:</span>
              <span className="font-semibold text-amber-200">
                {readiness.statusCounts.operational_attention}
              </span>
            </div>
          </div>

          {readiness.unevaluatedCount > 0 && (
            <div className="mt-2.5 flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{readiness.unevaluatedCount} sem projeção válida</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Restrições Operacionais */}
      <Card className="border-amber-500/20 bg-slate-900/80">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">
            Restrições Ativas
          </CardTitle>
          <AlertOctagon className="h-4 w-4 text-amber-400" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-amber-300">
              {readiness.activeRestrictionsCount}
            </span>
            <span className="text-xs text-slate-400">
              em {readiness.dogsWithRestrictionsCount} cão(ões)
            </span>
          </div>

          <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Absolutas:</span>
              <span className="font-semibold text-red-400">
                {readiness.restrictionsByType.absolute}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Parciais:</span>
              <span className="font-semibold text-amber-300">
                {readiness.restrictionsByType.partial}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Atenção:</span>
              <span className="font-semibold text-slate-200">
                {readiness.restrictionsByType.attention}
              </span>
            </div>
          </div>

          {!readiness.restrictionsCoverageComplete && (
            <div className="mt-2.5 flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Cobertura de restrições parcial</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Casos Clínicos */}
      <Card className="border-emerald-500/20 bg-slate-900/80">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">
            Casos Clínicos
          </CardTitle>
          <Stethoscope className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-emerald-300">
              {clinical.activeCasesCount}
            </span>
            <span className="text-xs text-slate-400">casos ativos</span>
          </div>

          <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Abertos em {periodLabel}:</span>
              <span className="font-semibold text-cyan-300">
                {clinical.casesOpenedInPeriodCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Com restrição ativa:</span>
              <span className="font-semibold text-amber-300">
                {clinical.casesWithActiveRestrictionCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total histórico em escopo:</span>
              <span className="font-semibold text-slate-200">
                {clinical.totalCases}
              </span>
            </div>
          </div>

          {!clinical.coverage.complete && (
            <div className="mt-2.5 flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                {clinical.coverage.forbiddenDogIds.length} cães não autorizados
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Agenda de Procedimentos */}
      <Card className="border-blue-500/20 bg-slate-900/80">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">
            Agenda de Procedimentos
          </CardTitle>
          <CalendarClock className="h-4 w-4 text-blue-400" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">
              {schedule.itemsInPeriodCount}
            </span>
            <span className="text-xs text-slate-400">em {periodLabel}</span>
          </div>

          <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs text-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Atrasados (Ação):</span>
              <span
                className={`font-semibold ${
                  schedule.overdueCount > 0 ? "text-red-400 font-bold" : "text-emerald-400"
                }`}
              >
                {schedule.overdueCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Programados hoje:</span>
              <span className="font-semibold text-cyan-300">
                {schedule.todayCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Próximos 7 dias:</span>
              <span className="font-semibold text-slate-200">
                {schedule.upcomingCount}
              </span>
            </div>
          </div>

          {!schedule.coverage.complete && (
            <div className="mt-2.5 flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                {schedule.coverage.forbiddenDogIds.length} cães não autorizados
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
