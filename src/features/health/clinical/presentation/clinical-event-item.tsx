"use client";

/**
 * K9 Ops Web — Health Web v1 HW-6B
 * Clinical Event Item presentation component
 */

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import { formatClinicalDate } from "./clinical-case-card";
import {
  CLINICAL_EVENT_TYPE_LABELS,
  CLINICAL_EVENT_STATUS_LABELS,
} from "./types";
import { ClinicalAmendmentItem } from "./clinical-amendment-item";
import type { ReadState } from "../../domain/read-states";
import type {
  ClinicalEventReadModel,
  ClinicalAmendmentReadModel,
} from "../types";
import { cn } from "@/lib/utils";

export function formatOpenPayloadValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "Não informado";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function ClinicalEventItem({
  event,
  amendmentsState,
  onLoadAmendments,
}: {
  event: ClinicalEventReadModel;
  amendmentsState?: ReadState<ClinicalAmendmentReadModel[]>;
  onLoadAmendments?: (eventId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const typeLabel = event.type
    ? CLINICAL_EVENT_TYPE_LABELS[event.type] ?? event.type
    : event.rawType ?? "Evento Clínico";

  const statusLabel = event.status
    ? CLINICAL_EVENT_STATUS_LABELS[event.status] ?? event.status
    : event.rawStatus ?? "Status não informado";

  // Strict temporal distinction: occurredAt is clinical occurrence time
  const occurrenceDateStr = event.occurredAt
    ? formatClinicalDate(event.occurredAt)
    : "Data não informada";

  const isCancelled = event.status === "cancelled";
  const isDraft = event.status === "draft";
  const isFinal = event.status === "final";

  const hasIssues = event.dataQualityIssues.length > 0;
  const contentEntries = Object.entries(event.content ?? {});

  const handleToggleAmendments = () => {
    const nextState = !expanded;
    setExpanded(nextState);
    if (nextState && onLoadAmendments && (!amendmentsState || amendmentsState.status === "idle")) {
      onLoadAmendments(event.id);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 transition-colors",
        isCancelled
          ? "border-rose-500/30 bg-rose-950/15"
          : isDraft
          ? "border-amber-500/30 bg-amber-950/15"
          : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
      )}
      data-testid={`clinical-event-item-${event.id}`}
    >
      {/* Event Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-md bg-cyan-950/80 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-cyan-200 border border-cyan-500/30"
            data-testid="clinical-event-type"
          >
            {typeLabel}
          </span>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
              isCancelled
                ? "bg-rose-900/50 text-rose-300 border border-rose-600/40"
                : isDraft
                ? "bg-amber-900/50 text-amber-300 border border-amber-600/40"
                : isFinal
                ? "bg-emerald-900/40 text-emerald-300 border border-emerald-600/30"
                : "bg-slate-800 text-slate-300 border border-slate-700"
            )}
            data-testid="clinical-event-status"
          >
            {statusLabel}
          </span>
          {hasIssues && (
            <span
              className="rounded bg-amber-950/80 px-2 py-0.5 text-[11px] font-mono text-amber-300 border border-amber-500/30"
              title={event.dataQualityIssues.join(", ")}
              data-testid="clinical-event-partial-badge"
            >
              Parcial
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span data-testid="clinical-event-occurred-at">{occurrenceDateStr}</span>
        </div>
      </div>

      {/* Cancellation Callout if cancelled */}
      {isCancelled && (
        <div
          className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200"
          data-testid="clinical-event-cancellation-block"
        >
          <div className="font-semibold text-rose-300">Evento Cancelado</div>
          <p className="mt-1" data-testid="clinical-event-cancel-reason">
            <span className="text-rose-400">Motivo:</span>{" "}
            {event.cancelReason || "Motivo não informado"}
          </p>
          {(event.cancelledAt || event.cancelledBy) && (
            <div className="mt-1 text-[11px] text-rose-400">
              {event.cancelledAt && (
                <span>Cancelado em: {formatClinicalDate(event.cancelledAt)}</span>
              )}
              {event.cancelledBy?.name && (
                <span className="ml-2">por {event.cancelledBy.name}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Event Content / Details */}
      {contentEntries.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-slate-950/40 p-3 text-xs" data-testid="clinical-event-content">
          {contentEntries.map(([key, value]) => {
            const isNullish = value === null || value === undefined;
            return (
              <div key={key} className="flex flex-col sm:flex-row sm:gap-2">
                <span className="font-semibold text-slate-400 capitalize sm:min-w-[140px]">
                  {key.replace(/_/g, " ")}:
                </span>
                <span
                  className={cn(
                    "break-words",
                    isNullish ? "italic text-slate-400" : "text-slate-200"
                  )}
                >
                  {formatOpenPayloadValue(value)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Professional & Recorder details */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-slate-400 border-t border-slate-800/40 pt-2">
        {event.professional?.name ? (
          <div className="flex items-center gap-1.5" data-testid="clinical-event-professional">
            <span className="text-slate-500">Profissional:</span>
            <span className="font-medium text-slate-200">
              {event.professional.name}
              {event.professional.formattedRegistration
                ? ` (${event.professional.formattedRegistration})`
                : ""}
              {event.professional.clinic ? ` — ${event.professional.clinic}` : ""}
            </span>
          </div>
        ) : (
          <span />
        )}

        {event.recordedBy?.name && (
          <div className="flex items-center gap-1.5 text-[11px]" data-testid="clinical-event-recorder">
            <span className="text-slate-500">Registrado por:</span>
            <span className="text-slate-300">
              {event.recordedBy.name}
              {event.recordedBy.internalRole ? ` (${event.recordedBy.internalRole})` : ""}
            </span>
          </div>
        )}
      </div>

      {/* Attachments & Amendments Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/40 pt-2 text-xs">
        {/* Attachments fact (Rule 7.1: null = Não informado) */}
        <div className="flex items-center gap-1 text-slate-400" data-testid="clinical-event-attachments">
          <Paperclip className="h-3.5 w-3.5 text-slate-500" />
          {event.attachmentRefs === null ? (
            <span className="italic text-slate-500">Anexos: Não informado</span>
          ) : event.attachmentRefs.length === 0 ? (
            <span className="text-slate-500">Nenhum anexo</span>
          ) : (
            <span className="font-semibold text-cyan-300">
              {event.attachmentRefs.length} anexo(s)
            </span>
          )}
        </div>

        {/* Amendments Toggle */}
        <div>
          {event.hasAmendments === false && (event.amendmentCount === 0 || event.amendmentCount === null) ? (
            <span className="text-[11px] text-slate-500 italic" data-testid="clinical-event-no-amendments">
              Sem emendas
            </span>
          ) : (
            <button
              type="button"
              onClick={handleToggleAmendments}
              className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-950/40 px-2 py-1 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-900/50"
              data-testid="clinical-event-amendments-toggle"
            >
              <span>
                {event.hasAmendments === null && event.amendmentCount === null
                  ? "Consultar emendas"
                  : `Emendas${event.amendmentCount !== null ? ` (${event.amendmentCount})` : ""}`}
              </span>
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Amendments Section */}
      {expanded && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">
            Emendas do Evento
          </div>

          {!amendmentsState || amendmentsState.status === "loading" ? (
            <div className="py-2 text-center text-xs text-slate-400" data-testid="clinical-amendments-loading">
              Carregando emendas...
            </div>
          ) : amendmentsState.status === "empty" ? (
            <div className="py-2 text-center text-xs text-slate-500 italic" data-testid="clinical-amendments-empty">
              Nenhuma emenda registrada para este evento.
            </div>
          ) : amendmentsState.status === "error" || amendmentsState.status === "forbidden" ? (
            <div className="py-2 text-center text-xs text-rose-400" data-testid="clinical-amendments-error">
              Não foi possível carregar as emendas.
            </div>
          ) : amendmentsState.status === "success" || amendmentsState.status === "partial" ? (
            <div className="flex flex-col gap-2" data-testid="clinical-amendments-list">
              {(amendmentsState.status === "success"
                ? amendmentsState.data
                : amendmentsState.partialData
              ).map((amend) => (
                <ClinicalAmendmentItem key={amend.id} amendment={amend} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
