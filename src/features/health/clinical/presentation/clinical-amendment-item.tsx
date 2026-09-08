"use client";

/**
 * K9 Ops Web — Health Web v1 HW-6B
 * Clinical Amendment Item presentation component
 */

import React from "react";
import { formatClinicalDate } from "./clinical-case-card";
import { formatOpenPayloadValue } from "./clinical-event-item";
import { CLINICAL_AMENDMENT_TYPE_LABELS } from "./types";
import type { ClinicalAmendmentReadModel } from "../types";
import { cn } from "@/lib/utils";

export function ClinicalAmendmentItem({
  amendment,
}: {
  amendment: ClinicalAmendmentReadModel;
}) {
  const typeLabel = amendment.type
    ? CLINICAL_AMENDMENT_TYPE_LABELS[amendment.type] ?? amendment.type
    : amendment.rawType ?? "Emenda";

  const dateStr = amendment.recordedAt
    ? formatClinicalDate(amendment.recordedAt)
    : "Data não informada";

  const hasIssues = amendment.dataQualityIssues.length > 0;
  const contentKeys = Object.keys(amendment.content);

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-cyan-500/20 bg-slate-900/60 p-3 text-xs"
      data-testid={`clinical-amendment-item-${amendment.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="rounded bg-cyan-950/80 px-2 py-0.5 font-bold uppercase tracking-wider text-cyan-300 border border-cyan-500/30"
            data-testid="clinical-amendment-type"
          >
            {typeLabel}
            {amendment.ordinal ? ` #${amendment.ordinal}` : ""}
          </span>
          {hasIssues && (
            <span
              className="rounded bg-amber-950/80 px-1.5 py-0.2 font-mono text-[10px] text-amber-300 border border-amber-500/30"
              title={amendment.dataQualityIssues.join(", ")}
            >
              Parcial
            </span>
          )}
        </div>
        <span className="font-mono text-slate-400" data-testid="clinical-amendment-date">
          {dateStr}
        </span>
      </div>

      <div className="flex flex-col gap-1 text-slate-200">
        <span className="font-semibold text-slate-300">Motivo:</span>
        <p className="rounded bg-slate-950/50 p-2 text-slate-300" data-testid="clinical-amendment-reason">
          {amendment.reason || <span className="italic text-slate-500">Sem motivo registrado</span>}
        </p>
      </div>

      {contentKeys.length > 0 && (
        <div className="mt-1 flex flex-col gap-1">
          <span className="font-semibold text-slate-400">Conteúdo retificado:</span>
          <div className="flex flex-col gap-1 rounded bg-slate-950/40 p-2 font-mono text-[11px] text-slate-300">
            {contentKeys.map((k) => {
              const val = amendment.content[k];
              const isNullish = val === null || val === undefined;
              return (
                <div key={k} className="flex gap-2">
                  <span className="text-cyan-400">{k}:</span>
                  <span
                    className={cn(
                      "break-all",
                      isNullish ? "italic text-slate-400" : "text-slate-300"
                    )}
                  >
                    {formatOpenPayloadValue(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {amendment.recordedBy?.name && (
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
          <span>Registrado por:</span>
          <span className="font-medium text-slate-300" data-testid="clinical-amendment-recorder">
            {amendment.recordedBy.name}
            {amendment.recordedBy.internalRole ? ` (${amendment.recordedBy.internalRole})` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
