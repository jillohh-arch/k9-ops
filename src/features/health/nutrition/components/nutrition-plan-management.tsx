"use client";

import { useState } from "react";
import {
  AlertCircle,
  Apple,
  Dog,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useEntities } from "@/features/effective/providers/entities-provider";
import { useNutritionPlans } from "../hooks/use-nutrition-plans";
import { NutritionPlanLoadingSkeleton } from "./nutrition-plan-loading-skeleton";
import { NutritionPlanActiveView } from "./nutrition-plan-active-view";
import { NutritionPlanLegacyView } from "./nutrition-plan-legacy-view";
import { NutritionPlanConflictState } from "./nutrition-plan-conflict-state";
import { NutritionPlanEmptyState } from "./nutrition-plan-empty-state";
import { NutritionPlanDegradedState } from "./nutrition-plan-degraded-state";
import { NutritionPlanCreateDialog } from "./nutrition-plan-create-dialog";
import type { NutritionPlan, LegacyNutritionPlanView } from "../types";

export interface NutritionPlanManagementProps {
  initialDogId?: string;
}

function getRecordString(record: Record<string, unknown> | undefined, key: string): string {
  if (!record) return "";
  const val = record[key];
  return typeof val === "string" ? val : val != null ? String(val) : "";
}

function isCanonicalPlan(plan: unknown): plan is NutritionPlan {
  return plan != null && typeof plan === "object" && "schemaVersion" in plan;
}

export function NutritionPlanManagement({
  initialDogId,
}: NutritionPlanManagementProps) {
  const { can } = useAccessControl();
  const canManage = can("health", "manage_nutrition_plan") || can("health", "edit");

  // Create Dialog Modal State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch K9 dogs from entities provider
  const { dogs: entityDogs, dogsLoading } = useEntities();

  // Active K9s filter
  const activeDogs = entityDogs.filter((dog) => {
    const status = getRecordString(dog, "status").toLowerCase();
    return !status || status === "ativo" || status === "active";
  });

  const defaultDogId = initialDogId || activeDogs[0]?._id || entityDogs[0]?._id || "";
  const [selectedDogId, setSelectedDogId] = useState<string>(defaultDogId);

  // Sync selectedDogId if initial state was empty and dogs finished loading
  const currentDogId = selectedDogId || defaultDogId;
  const currentDog = entityDogs.find((d) => d._id === currentDogId);

  // Consume read model foundation
  const planState = useNutritionPlans(currentDogId);

  const dogName = currentDog ? getRecordString(currentDog, "name") : "";
  const dogBreed = currentDog ? getRecordString(currentDog, "breed") : "";
  const dogRg = currentDog ? getRecordString(currentDog, "rg") : "";

  return (
    <div
      data-testid="nutrition-plan-management"
      className="space-y-6"
    >
      {/* HEADER PRINCIPAL */}
      <div className="rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/80 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
                <Apple className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Saúde & Prontidão K9
              </span>
              <Badge tone={canManage ? "green" : "slate"}>
                {canManage ? (
                  <>
                    <ShieldCheck className="mr-1 h-3 w-3 text-emerald-400" />
                    MODO GESTÃO ATIVO
                  </>
                ) : (
                  <>
                    <Lock className="mr-1 h-3 w-3 text-slate-400" />
                    MODO SOMENTE LEITURA
                  </>
                )}
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Gestão de Plano Alimentar
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Consolidação gerencial em tempo real de nutrição, hidratação e dietas operacionais K9.
            </p>
          </div>

          {/* K9 Selector Dropdown / Select */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-slate-900/90 p-2 px-3 shadow-sm">
              <Dog className="h-4 w-4 text-cyan-400 shrink-0" />
              <select
                aria-label="Selecionar K9"
                value={currentDogId}
                onChange={(e) => setSelectedDogId(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-100 focus:outline-none cursor-pointer pr-2"
                disabled={dogsLoading || entityDogs.length === 0}
              >
                {entityDogs.length === 0 ? (
                  <option value="" disabled className="bg-slate-900 text-slate-400">
                    Carregando cães...
                  </option>
                ) : (
                  entityDogs.map((dog) => {
                    const nameStr = getRecordString(dog, "name");
                    const rgStr = getRecordString(dog, "rg");
                    return (
                      <option
                        key={dog._id}
                        value={dog._id}
                        className="bg-slate-900 text-slate-100"
                      >
                        K9 {nameStr} {rgStr ? `(RG ${rgStr})` : ""}
                      </option>
                    );
                  })
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Selected K9 Summary Ribbon */}
        {currentDog && (
          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-800/80 pt-4 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-semibold text-slate-400">K9 Atual:</span>
              <span className="font-bold text-cyan-300 text-sm">{dogName}</span>
            </div>

            {dogBreed && (
              <div className="text-slate-400">
                • <span className="font-medium text-slate-300">{dogBreed}</span>
              </div>
            )}

            {dogRg && (
              <div className="text-slate-400">
                • RG: <span className="font-mono text-slate-300">{dogRg}</span>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-slate-500">ID: {currentDog._id}</span>
            </div>
          </div>
        )}
      </div>

      {/* PAINEL INFORMATIVO DE GESTÃO DO PLANO ALIMENTAR */}
      <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/60 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 shrink-0">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Gestão do Plano Alimentar
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                As funcionalidades de gerenciamento do plano alimentar estão sendo preparadas para este módulo.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge tone="cyan" className="text-[11px]">
              {canManage ? "Mapeamento Nutricional K9 Ops" : "Requer permissão health.manage_nutrition_plan"}
            </Badge>
          </div>
        </div>
      </div>

      {/* ESTADOS DO READ MODEL */}
      {planState.status === "loading" && <NutritionPlanLoadingSkeleton />}

      {planState.status === "conflict" && (
        <NutritionPlanConflictState
          conflict={planState.integrityConflict}
          dogName={dogName}
        />
      )}

      {planState.status === "error" && (
        <div
          data-testid="nutrition-plan-error-state"
          className="flex items-start gap-4 rounded-2xl border border-red-500/40 bg-red-950/20 p-6 text-red-200 shadow-md"
        >
          <AlertCircle className="h-6 w-6 shrink-0 text-red-400 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-red-100">
              Falha ao Carregar Plano Alimentar
            </h4>
            <p className="text-xs text-red-300/80 leading-relaxed">
              Ocorreu uma falha na consulta aos registros nutricionais deste K9. O listener em tempo real tentará reconectar automaticamente.
            </p>
            {planState.error && (
              <div className="mt-2 font-mono text-[11px] text-red-400">
                {planState.error}
              </div>
            )}
          </div>
        </div>
      )}

      {planState.status === "empty" && (
        <NutritionPlanEmptyState
          dogName={dogName}
          canManage={canManage}
          onOpenCreate={() => setCreateDialogOpen(true)}
        />
      )}

      {planState.status === "degraded" && (
        <div className="space-y-6">
          <NutritionPlanDegradedState
            reason={planState.error ?? undefined}
            parsingErrors={planState.parsingErrors}
          />
          {planState.activePlan && isCanonicalPlan(planState.activePlan) && (
            <NutritionPlanActiveView
              plan={planState.activePlan}
              dogName={dogName}
            />
          )}
          {planState.activePlan && !isCanonicalPlan(planState.activePlan) && (
            <NutritionPlanLegacyView
              plan={planState.activePlan as LegacyNutritionPlanView}
              dogName={dogName}
              canManage={canManage}
              onOpenCreate={() => setCreateDialogOpen(true)}
            />
          )}
        </div>
      )}

      {planState.status === "canonical" && planState.activePlan && (
        <NutritionPlanActiveView
          plan={planState.activePlan as NutritionPlan}
          dogName={dogName}
        />
      )}

      {planState.status === "legacy" && planState.activePlan && (
        <NutritionPlanLegacyView
          plan={planState.activePlan as LegacyNutritionPlanView}
          dogName={dogName}
          canManage={canManage}
          onOpenCreate={() => setCreateDialogOpen(true)}
        />
      )}

      {/* CREATE AND ACTIVATE DIALOG */}
      {canManage && (
        <NutritionPlanCreateDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          dogId={currentDogId}
          dogName={dogName}
          isLegacyContext={planState.status === "legacy"}
        />
      )}
    </div>
  );
}
