"use client";

import { AlertCircle, Clock, FileSpreadsheet, Lock, Scale, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LegacyNutritionPlanView } from "../types";

interface NutritionPlanLegacyViewProps {
  plan: LegacyNutritionPlanView;
  dogName?: string;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(date: Date | undefined | null) {
  if (!date || isNaN(date.getTime())) return "--";
  return dateFormatter.format(date);
}

function formatWeight(grams: number | undefined | null) {
  if (grams == null || isNaN(grams) || grams <= 0) return "--";
  if (grams >= 1000) {
    return `${(grams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg/dia`;
  }
  return `${grams.toLocaleString("pt-BR")} g/dia`;
}

export function NutritionPlanLegacyView({
  plan,
  dogName,
}: NutritionPlanLegacyViewProps) {
  return (
    <div
      data-testid="nutrition-plan-legacy-view"
      className="space-y-6"
    >
      {/* Notice Banner */}
      <div className="flex items-start gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-[0_12px_40px_rgba(245,158,11,0.08)]">
        <AlertCircle className="h-6 w-6 shrink-0 text-amber-400 mt-0.5" />
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h4 className="font-bold text-amber-200">
              Plano Alimentar Legado em Exibição {dogName ? `— ${dogName}` : ""}
            </h4>
            <Badge tone="yellow">
              SOMENTE LEITURA
            </Badge>
          </div>
          <p className="text-xs text-amber-200/80 leading-relaxed">
            Este registro provém da base de dados legada ({plan.legacySource || "legacy"}). Ele é exibido em modo somente leitura e não pode ser editado via mutações canônicas. Para atualizar o plano deste K9, será necessário registrar um novo plano canônico.
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/72 p-6 space-y-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <FileSpreadsheet className="h-4 w-4" />
              <span>REGISTRO LEGADO #{plan.legacyId || plan.id}</span>
            </div>
            <h3 className="mt-1 text-2xl font-bold text-slate-100">
              {plan.foodType || "Alimentação não especificada"}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone="slate">
              <Lock className="mr-1 h-3 w-3" /> Legado Inalterável
            </Badge>
          </div>
        </div>

        {/* Operational Metrics Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-cyan-200/10 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Scale className="h-4 w-4 text-cyan-400" />
              <span>Quantidade Diária</span>
            </div>
            <div className="mt-2 text-xl font-bold text-slate-100">
              {formatWeight(plan.amountGramsPerDay)}
            </div>
          </div>

          <div className="rounded-xl border border-cyan-200/10 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Utensils className="h-4 w-4 text-cyan-400" />
              <span>Refeições / Dia</span>
            </div>
            <div className="mt-2 text-xl font-bold text-slate-100">
              {plan.mealsPerDay ? `${plan.mealsPerDay}x por dia` : "--"}
            </div>
          </div>

          <div className="rounded-xl border border-cyan-200/10 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span>Vigência Inicial</span>
            </div>
            <div className="mt-2 text-lg font-bold text-slate-100">
              {formatDate(plan.vigentFrom)}
            </div>
          </div>

          <div className="rounded-xl border border-cyan-200/10 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span>Vigência Término</span>
            </div>
            <div className="mt-2 text-lg font-bold text-slate-100">
              {formatDate(plan.vigentUntil)}
            </div>
          </div>
        </div>

        {/* Optional Fields */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 border-t border-slate-800 pt-5">
          {plan.professionalName && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Profissional Responsável
              </div>
              <div className="mt-1 font-medium text-slate-200">
                {plan.professionalName}{" "}
                {plan.professionalRegistrationType && plan.professionalRegistrationNumber
                  ? `(${plan.professionalRegistrationType} · ${plan.professionalRegistrationNumber})`
                  : plan.professionalRegistrationNumber
                  ? `(${plan.professionalRegistrationNumber})`
                  : plan.professionalCrmv
                  ? `(CRMV: ${plan.professionalCrmv})`
                  : ""}
              </div>
            </div>
          )}

          {plan.hydrationMl != null && plan.hydrationMl > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Meta de Hidratação
              </div>
              <div className="mt-1 font-medium text-slate-200">
                {plan.hydrationMl} ml/dia
              </div>
            </div>
          )}

          {plan.notes && (
            <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Observações do Registro Legado
              </div>
              <div className="mt-1 text-sm text-slate-300 leading-relaxed">
                {plan.notes}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
