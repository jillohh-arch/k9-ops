"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Activity, History, LayoutDashboard, NotebookTabs } from "lucide-react";
import { useEffect } from "react";

import { NutritionPlanManagement } from "@/features/health/nutrition/components/nutrition-plan-management";
import { NutritionOverview } from "@/features/health/nutrition/components/nutrition-overview";
import { NutritionActivityPanel } from "@/features/health/nutrition/components/nutrition-activity-panel";

type NutritionTab = "overview" | "plans" | "execution" | "history";

const tabs = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
  { id: "plans", label: "Planos Alimentares", icon: NotebookTabs },
  { id: "execution", label: "Execução", icon: Activity },
  { id: "history", label: "Histórico", icon: History },
] satisfies Array<{ id: NutritionTab; label: string; icon: typeof LayoutDashboard }>;

export default function NutritionPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dogIdFromQuery = searchParams.get("dogId")?.trim() || undefined;
  const tabFromQuery = searchParams.get("tab");
  const activeTab = tabs.some((tab) => tab.id === tabFromQuery)
    ? (tabFromQuery as NutritionTab)
    : "overview";

  const replaceQuery = (mutate: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    mutate(nextParams);
    const query = nextParams.toString();
    router.replace(`/health/nutrition${query ? `?${query}` : ""}`);
  };

  useEffect(() => {
    if (tabFromQuery !== null && !tabs.some((tab) => tab.id === tabFromQuery)) {
      replaceQuery((params) => params.set("tab", "overview"));
    }
  // The URL snapshot is the authority; a new snapshot legitimately re-runs this guard.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromQuery, searchParams]);

  const selectTab = (tab: NutritionTab) => {
    replaceQuery((params) => params.set("tab", tab));
  };

  const selectDog = (dogId: string) => {
    replaceQuery((params) => {
      if (dogId) params.set("dogId", dogId);
      else params.delete("dogId");
    });
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="overflow-hidden rounded-2xl border border-cyan-300/15 bg-slate-950/75">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
              Saúde & Prontidão K9
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">
              Nutrição operacional
            </h1>
            <p className="mt-2 max-w-[68ch] text-sm leading-6 text-slate-400">
              Planos administrativos e acompanhamento factual em uma superfície que separa
              claramente gestão de execução.
            </p>
          </div>
          <div className="text-xs text-slate-500">
            Execuções e histórico são sempre somente leitura na Web.
          </div>
        </div>

        <nav
          aria-label="Áreas da Nutrição"
          className="flex gap-1 overflow-x-auto border-t border-white/8 px-3 pt-2"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                aria-current={selected ? "page" : undefined}
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-t-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
                  selected
                    ? "bg-cyan-300 text-slate-950"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {activeTab === "overview" && <NutritionOverview />}
      {activeTab === "plans" && (
        <NutritionPlanManagement
          key={`plans-${dogIdFromQuery ?? "default"}`}
          initialDogId={dogIdFromQuery}
          onDogIdChange={selectDog}
        />
      )}
      {activeTab === "execution" && (
        <NutritionActivityPanel
          key={`execution-${dogIdFromQuery ?? "default"}`}
          mode="execution"
          initialDogId={dogIdFromQuery}
          onDogIdChange={selectDog}
        />
      )}
      {activeTab === "history" && (
        <NutritionActivityPanel
          key={`history-${dogIdFromQuery ?? "default"}`}
          mode="history"
          initialDogId={dogIdFromQuery}
          onDogIdChange={selectDog}
        />
      )}
    </div>
  );
}
