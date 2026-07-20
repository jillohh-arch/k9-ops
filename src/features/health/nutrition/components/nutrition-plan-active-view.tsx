"use client";

import {
  Calendar,
  CheckCircle2,
  Clock,
  Droplets,
  FileCheck2,
  FileText,
  Pill,
  Scale,
  ShieldCheck,
  UserCheck,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { NutritionPlan } from "../types";

interface NutritionPlanActiveViewProps {
  plan: NutritionPlan;
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

function translatePeriod(period: string): string {
  const map: Record<string, string> = {
    morning: "Manhã",
    afternoon: "Tarde",
    evening: "Noite",
    night: "Madrugada",
    extra: "Extra / Treino",
  };
  return map[period.toLowerCase()] ?? period;
}

function formatProfessionalRegistration(prof?: {
  registration_type?: string;
  registration_number?: string;
  registrationType?: string;
  registrationNumber?: string;
  crmv?: string;
} | null): string | null {
  if (!prof) return null;
  const regType = prof.registration_type ?? prof.registrationType ?? (prof.crmv ? "CRMV" : undefined);
  const regNum = prof.registration_number ?? prof.registrationNumber ?? prof.crmv;

  if (regType && regNum) return `${regType} · ${regNum}`;
  if (regNum) return String(regNum);
  if (regType) return String(regType);
  return null;
}

export function NutritionPlanActiveView({
  plan,
  dogName,
}: NutritionPlanActiveViewProps) {
  return (
    <div
      data-testid="nutrition-plan-active-view"
      className="space-y-6"
    >
      {/* Container Principal */}
      <div className="rounded-[1.75rem] border border-cyan-200/15 bg-slate-950/80 p-6 sm:p-8 space-y-8 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-md">
        
        {/* 1. HEADER DO PLANO */}
        <div className="flex flex-col gap-4 border-b border-cyan-200/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Badge tone="green" className="font-semibold px-3 py-1">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                PLANO CANÔNICO ATIVO
              </Badge>
              <Badge tone="cyan">
                Rev. #{plan.revision ?? 1}
              </Badge>
              {plan.schemaVersion && (
                <span className="text-xs text-slate-500 font-mono">
                  Schema v{plan.schemaVersion}
                </span>
              )}
            </div>

            <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              {plan.foodType || "Dieta Nutricional Canônica"} {dogName ? `— ${dogName}` : ""}
            </h3>

            <p className="text-xs text-slate-400 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-cyan-400" />
              <span>Vigência: {formatDate(plan.validFrom)} até {plan.validUntil ? formatDate(plan.validUntil) : "indefinido"}</span>
              {plan.timezone && (
                <span className="text-slate-500 font-mono">({plan.timezone})</span>
              )}
            </p>
          </div>

          {/* Identification badge */}
          <div className="flex flex-col items-start md:items-end gap-1 rounded-2xl border border-cyan-500/20 bg-slate-900/80 p-3.5 px-5">
            <div className="text-xs font-medium text-slate-400">ID do Plano</div>
            <div className="font-mono text-xs text-cyan-300 select-all font-semibold">
              {plan.id}
            </div>
          </div>
        </div>

        {/* 2. RESUMO OPERACIONAL */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-2">
            <Scale className="h-4 w-4" />
            <span>Resumo Operacional de Dieta</span>
          </h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-cyan-200/10 bg-slate-900/70 p-4">
              <div className="text-xs font-medium text-slate-400">Meta Diária</div>
              <div className="mt-1.5 text-2xl font-black text-slate-100">
                {formatWeight(plan.amountGramsPerDay)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Total diário programado</div>
            </div>

            <div className="rounded-2xl border border-cyan-200/10 bg-slate-900/70 p-4">
              <div className="text-xs font-medium text-slate-400">Frequência</div>
              <div className="mt-1.5 text-2xl font-black text-slate-100">
                {plan.mealsPerDay ?? 0}x / dia
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Refeições fracionadas</div>
            </div>

            <div className="rounded-2xl border border-cyan-200/10 bg-slate-900/70 p-4">
              <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-cyan-400" />
                <span>Hidratação</span>
              </div>
              <div className="mt-1.5 text-2xl font-black text-slate-100">
                {plan.hydrationMl ? `${plan.hydrationMl} ml` : "--"}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Meta hídrica recomendada</div>
            </div>

            <div className="rounded-2xl border border-cyan-200/10 bg-slate-900/70 p-4">
              <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Pill className="h-3.5 w-3.5 text-cyan-400" />
                <span>Suplementos</span>
              </div>
              <div className="mt-1.5 text-2xl font-black text-slate-100">
                {plan.supplements?.length ?? 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Itens prescritos</div>
            </div>
          </div>
        </div>

        {/* 3. CRONOGRAMA DE REFEIÇÕES */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-2">
            <Utensils className="h-4 w-4" />
            <span>Cronograma Diário das Refeições</span>
          </h4>

          {plan.mealSchedule && plan.mealSchedule.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plan.mealSchedule.map((slot, idx) => (
                <div
                  key={slot.id || idx}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-4"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      {translatePeriod(slot.period)}
                    </div>
                    <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-cyan-400" />
                      <span>{slot.scheduledTime || "--:--"}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-cyan-300">
                      {slot.targetGrams ?? 0} g
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-xs text-slate-400 italic">
              Nenhum horário individual de refeição cadastrado.
            </div>
          )}
        </div>

        {/* 4. SUPLEMENTAÇÃO */}
        {plan.supplements && plan.supplements.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-2">
              <Pill className="h-4 w-4" />
              <span>Regime de Suplementação Prescrito</span>
            </h4>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {plan.supplements.map((supp, idx) => (
                <div
                  key={supp.id || idx}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100 text-sm">
                      {supp.name}
                    </span>
                    <Badge tone="cyan" className="text-[10px]">
                      {supp.frequency}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-300 font-medium">
                    Dose: {supp.dose} {supp.unit}
                  </div>
                  {supp.instructions && (
                    <p className="text-xs text-slate-400 bg-slate-950/50 p-2 rounded border border-slate-800/80">
                      {supp.instructions}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. ORIENTAÇÕES ESPECIAIS */}
        {plan.specialInstructions && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Orientações Nutricionais Especiais</span>
            </h4>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200 leading-relaxed">
              {plan.specialInstructions}
            </div>
          </div>
        )}

        {/* 6. RESPONSABILIDADE E ORIGEM */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 border-t border-slate-800 pt-6">
          {/* Profissional */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-cyan-400" />
              <span>Profissional Responsável</span>
            </div>
            <div className="text-sm font-bold text-slate-200">
              {plan.professional?.name || "Não especificado"}
            </div>
            {formatProfessionalRegistration(plan.professional) && (
              <div className="text-xs text-slate-400 font-mono">
                {formatProfessionalRegistration(plan.professional)}
              </div>
            )}
            {plan.professional?.specialty && (
              <div className="text-xs text-slate-400">
                Especialidade: {String(plan.professional.specialty)}
              </div>
            )}
            {plan.professional?.clinic && (
              <div className="text-xs text-slate-400">
                Clínica: {String(plan.professional.clinic)}
              </div>
            )}
          </div>

          {/* Documento de Origem */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5 text-cyan-400" />
              <span>Documento de Origem</span>
            </div>
            <div className="text-sm font-bold text-slate-200">
              {plan.sourceDocument?.name || plan.sourceDocument?.id || "Sem documento vinculado"}
            </div>
            {plan.attachmentRefs && plan.attachmentRefs.length > 0 && (
              <div className="text-xs text-slate-400">
                {plan.attachmentRefs.length} anexo(s) referenciado(s)
              </div>
            )}
          </div>

          {/* Autoria / Registro */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
              <span>Registro de Autoria</span>
            </div>
            <div className="text-sm font-bold text-slate-200">
              {plan.recordedBy?.name || "Operador K9 Ops"}
            </div>
            <div className="text-xs text-slate-400">
              Papel: {plan.recordedBy?.internalRole || "Membro da Operação"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
