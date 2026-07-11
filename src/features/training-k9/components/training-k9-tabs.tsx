"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { cn } from "@/lib/utils";
import { paths } from "@/lib/routes/paths";

import {
  defaultTab,
  isValidTab,
  trainingTabs,
  type TrainingTab,
} from "../lib/training-k9-constants";

export function useActiveTab(): [TrainingTab, (tab: TrainingTab) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();

  const raw = searchParams.get("tab");
  const activeTab = isValidTab(raw) ? raw : defaultTab;

  const setTab = useCallback(
    (tab: TrainingTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === defaultTab) {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.push(`${paths.training}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams],
  );

  return [activeTab, setTab];
}

interface TrainingK9TabsProps {
  activeTab: TrainingTab;
  onTabChange: (tab: TrainingTab) => void;
  pendingEvaluations?: number;
}

export function TrainingK9Tabs({
  activeTab,
  onTabChange,
  pendingEvaluations = 0,
}: TrainingK9TabsProps) {
  return (
    <nav
      aria-label="Abas de treinamento"
      className="flex items-center gap-1 overflow-x-auto border-b border-cyan-200/10 pb-px"
      role="tablist"
    >
      {trainingTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const showBadge = tab.id === "evaluations" && pendingEvaluations > 0;

        return (
          <button
            aria-selected={isActive}
            className={cn(
              "relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-semibold transition",
              isActive
                ? "text-cyan-200"
                : "text-slate-400 hover:text-white",
            )}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
            {showBadge ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400/20 px-1.5 text-[10px] font-black text-amber-300">
                {pendingEvaluations > 99 ? "99+" : pendingEvaluations}
              </span>
            ) : null}
            {isActive ? (
              <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(77,208,225,0.7)]" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
