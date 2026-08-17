"use client";

import {
  Activity,
  Dumbbell,
  FileText,
  HeartPulse,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { useRef } from "react";

import { cn } from "@/lib/utils";

export type K9ProfileTab =
  | "documents"
  | "health"
  | "history"
  | "overview"
  | "training";

export const K9_PROFILE_TABS: ReadonlyArray<{
  icon: LucideIcon;
  id: K9ProfileTab;
  label: string;
}> = [
  { icon: LayoutGrid, id: "overview", label: "Visão Geral" },
  { icon: Dumbbell, id: "training", label: "Treinamento" },
  { icon: HeartPulse, id: "health", label: "Saúde" },
  { icon: Activity, id: "history", label: "Histórico" },
  { icon: FileText, id: "documents", label: "Documentos" },
];

export function tabPanelId(tab: K9ProfileTab) {
  return `k9-profile-panel-${tab}`;
}

export function tabId(tab: K9ProfileTab) {
  return `k9-profile-tab-${tab}`;
}

/**
 * Navegação interna do Perfil.
 *
 * Padrão ARIA de tabs com foco gerenciado: apenas a aba ativa é tabulável, e
 * as setas movem a seleção. Estado é local (`useState` no page) — não há
 * necessidade arquitetural de uma rota por aba, e o prompt pede para não criar
 * rotas desnecessárias.
 */
export function K9ProfileTabs({
  activeTab,
  onChange,
}: {
  activeTab: K9ProfileTab;
  onChange: (tab: K9ProfileTab) => void;
}) {
  const refs = useRef(new Map<K9ProfileTab, HTMLButtonElement | null>());

  function focusTab(tab: K9ProfileTab) {
    onChange(tab);
    // O foco acompanha a seleção; sem isso a navegação por setas fica muda
    // para quem usa leitor de tela.
    requestAnimationFrame(() => refs.current.get(tab)?.focus());
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const index = K9_PROFILE_TABS.findIndex((tab) => tab.id === activeTab);
    if (index < 0) return;

    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % K9_PROFILE_TABS.length;
    if (event.key === "ArrowLeft") {
      next = (index - 1 + K9_PROFILE_TABS.length) % K9_PROFILE_TABS.length;
    }
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = K9_PROFILE_TABS.length - 1;

    if (next != null) {
      event.preventDefault();
      focusTab(K9_PROFILE_TABS[next].id);
    }
  }

  return (
    <div
      aria-label="Seções do perfil do K9"
      className="flex gap-1 overflow-x-auto border-b border-cyan-200/10 pb-px"
      role="tablist"
    >
      {K9_PROFILE_TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            aria-controls={tabPanelId(tab.id)}
            aria-selected={isActive}
            className={cn(
              "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
              isActive ? "text-cyan-200" : "text-slate-400 hover:text-white",
            )}
            id={tabId(tab.id)}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            onKeyDown={onKeyDown}
            ref={(node) => {
              refs.current.set(tab.id, node);
            }}
            role="tab"
            // Foco gerenciado: só a aba ativa entra na ordem de tabulação.
            tabIndex={isActive ? 0 : -1}
            type="button"
          >
            <Icon aria-hidden className="h-4 w-4" />
            {tab.label}
            {isActive ? (
              <span
                aria-hidden
                className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(77,208,225,0.7)]"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function K9ProfileTabPanel({
  children,
  tab,
}: {
  children: React.ReactNode;
  tab: K9ProfileTab;
}) {
  return (
    <div
      aria-labelledby={tabId(tab)}
      className="focus-visible:outline-none"
      id={tabPanelId(tab)}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  );
}
