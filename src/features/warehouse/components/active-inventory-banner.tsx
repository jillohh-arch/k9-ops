"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { InventorySession } from "../domain/contracts";

interface ActiveInventoryBannerProps {
  sessions?: InventorySession[];
}

export function ActiveInventoryBanner({ sessions }: ActiveInventoryBannerProps) {
  const activeSession = useMemo(() => {
    if (!sessions) return null;
    return sessions.find(
      (s) => s.status === "in_progress" || s.status === "reconciling",
    );
  }, [sessions]);

  if (!activeSession) return null;

  const scopeLabel =
    activeSession.scope_type === "full_warehouse"
      ? "Geral (Todo o Almoxarifado)"
      : activeSession.scope_type === "by_location"
      ? `Por Local (${activeSession.scope_label || activeSession.scope_ref_id})`
      : `Por Categoria (${activeSession.scope_label || activeSession.scope_ref_id})`;

  const dateFormatted =
    activeSession.opened_at instanceof Date
      ? activeSession.opened_at.toLocaleDateString("pt-BR")
      : String(activeSession.opened_at);

  const isReconciling = activeSession.status === "reconciling";

  return (
    <div
      role="alert"
      className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200 shadow-sm"
      data-testid="active-inventory-banner"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">
                Sessão de Inventário Físico Ativa:
              </span>
              <span className="font-medium text-amber-100">{activeSession.title}</span>
              <span className="inline-flex items-center rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-semibold text-amber-300 border border-amber-400/30">
                {isReconciling ? "Reconciliando" : "Em Andamento"}
              </span>
            </div>
            <p className="mt-1 text-xs text-amber-200/80">
              Escopo: {scopeLabel} · Aberto por {activeSession.opened_by_name} em {dateFormatted}
            </p>
            <p className="mt-0.5 text-xs text-amber-300/70">
              Movimentações em posições deste escopo estão temporariamente bloqueadas para conferência física.
            </p>
          </div>
        </div>
        <Link
          href={`/warehouse/inventory/${activeSession.id}`}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
        >
          Acessar Sessão de Inventário →
        </Link>
      </div>
    </div>
  );
}
