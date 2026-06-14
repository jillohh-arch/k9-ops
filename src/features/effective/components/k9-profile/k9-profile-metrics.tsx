"use client";

import { CheckCircle2, CircleAlert, ClipboardCheck, FileText } from "lucide-react";

import type { ProfileView } from "./k9-profile-types";

export function K9ProfileMetrics({
  documentsCount,
  totalRecords,
  view,
}: {
  documentsCount: number;
  totalRecords: number;
  view: ProfileView;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-white/8 bg-surface-card/70 p-4">
        <p className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <ClipboardCheck className="h-4 w-4 text-cyan-300" />
          Registros consolidados
        </p>
        <p className="mt-3 font-mono text-2xl font-black text-white">
          {totalRecords}
        </p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-surface-card/70 p-4">
        <p className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <FileText className="h-4 w-4 text-amber-300" />
          Documentos
        </p>
        <p className="mt-3 font-mono text-2xl font-black text-white">
          {documentsCount}
        </p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-surface-card/70 p-4">
        <p className="flex items-center gap-2 text-xs font-bold text-slate-300">
          {view.vaccineState.tone === "green" &&
          view.weightState.tone === "green" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          ) : (
            <CircleAlert className="h-4 w-4 text-amber-300" />
          )}
          Evidência administrativa
        </p>
        <p className="mt-3 text-sm font-bold text-white">
          {view.vaccineState.tone === "green" &&
          view.weightState.tone === "green"
            ? "Vacina e peso em conformidade"
            : "Há dados de saúde a revisar"}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Indicador administrativo; não substitui avaliação veterinária.
        </p>
      </div>
    </section>
  );
}
