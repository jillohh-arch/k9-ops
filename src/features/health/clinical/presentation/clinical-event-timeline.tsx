"use client";

/**
 * K9 Ops Web — Health Web v1 HW-6B
 * Clinical Event Timeline Section for ClinicalCaseModal
 *
 * Section Label: Strictly "Eventos clínicos" (CLINICAL-DEBT-01 mandate).
 */

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useClinicalCaseEvents } from "../hooks/use-clinical-case-events";
import { ClinicalEventItem } from "./clinical-event-item";

export function ClinicalEventTimeline({
  dogId,
  caseId,
}: {
  dogId: string;
  caseId: string;
}) {
  const {
    state,
    refresh,
    loadAmendmentsForEvent,
    amendmentsState,
  } = useClinicalCaseEvents(dogId, caseId);

  return (
    <section className="flex flex-col gap-3" data-testid="clinical-event-timeline-section">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
          Eventos clínicos
        </h3>
        {state.status === "success" && (
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300 transition-colors"
            title="Atualizar eventos"
            data-testid="clinical-timeline-refresh-btn"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Atualizar</span>
          </button>
        )}
      </div>

      {/* Loading state */}
      {state.status === "loading" && (
        <div
          className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/30 p-8 text-xs text-slate-400"
          data-testid="clinical-timeline-loading"
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
            <span>Carregando eventos clínicos...</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {state.status === "empty" && (
        <div
          className="flex items-center justify-center rounded-xl border border-slate-800/80 bg-slate-900/20 p-6 text-center text-xs text-slate-400"
          data-testid="clinical-timeline-empty"
        >
          Nenhum evento clínico registrado para este caso.
        </div>
      )}

      {/* Forbidden state */}
      {state.status === "forbidden" && (
        <div
          className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300"
          data-testid="clinical-timeline-forbidden"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{state.message || "Acesso aos eventos clínicos não autorizado."}</span>
        </div>
      )}

      {/* Error state */}
      {state.status === "error" && (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/20 p-6 text-center text-xs text-rose-300"
          data-testid="clinical-timeline-error"
        >
          <AlertCircle className="h-5 w-5 text-rose-400" />
          <span>{state.message || "Erro ao carregar eventos clínicos."}</span>
          {state.retryable && (
            <button
              type="button"
              onClick={refresh}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-900/40 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-900/60"
            >
              <RefreshCw className="h-3 w-3" />
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {/* Success / Partial state list */}
      {(state.status === "success" || state.status === "partial") && (
        <div className="flex flex-col gap-3" data-testid="clinical-timeline-list">
          {(state.status === "success" ? state.data : state.partialData).map((evt) => (
            <ClinicalEventItem
              key={evt.id}
              event={evt}
              amendmentsState={amendmentsState[evt.id]}
              onLoadAmendments={loadAmendmentsForEvent}
            />
          ))}
        </div>
      )}
    </section>
  );
}
