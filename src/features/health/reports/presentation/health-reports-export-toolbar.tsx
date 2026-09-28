"use client";

/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Export toolbar with fail-closed security gating.
 */

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Lock, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  HealthReportsAggregate,
  ReportExportAuthority,
  ReportExportDataset,
  ReportExportFormat,
} from "../domain/health-reports-types";
import { executeHealthReportExport } from "../lib/health-reports-export";

interface HealthReportsExportToolbarProps {
  aggregate: HealthReportsAggregate;
  exportAuthority: ReportExportAuthority;
}

export function HealthReportsExportToolbar({
  aggregate,
  exportAuthority,
}: HealthReportsExportToolbarProps) {
  const [dataset, setDataset] = useState<ReportExportDataset>("kpi_summary");
  const [exportingFormat, setExportingFormat] = useState<ReportExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const authorized = exportAuthority.canExport;

  const handleExport = (format: ReportExportFormat) => {
    if (!authorized) return;
    setExportingFormat(format);
    setExportError(null);
    setExportSuccess(null);

    try {
      executeHealthReportExport(dataset, format, aggregate, exportAuthority);
      setExportSuccess(`Arquivo ${format.toUpperCase()} exportado com sucesso.`);
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao gerar arquivo de exportação.";
      setExportError(msg);
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3 sm:p-4">
        {/* Dataset selection */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Escopo:</span>
          <div className="inline-flex rounded-lg bg-slate-950/60 p-1">
            <button
              type="button"
              onClick={() => setDataset("kpi_summary")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                dataset === "kpi_summary"
                  ? "bg-cyan-500/20 text-cyan-300 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Resumo Geral
            </button>
            <button
              type="button"
              onClick={() => setDataset("readiness")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                dataset === "readiness"
                  ? "bg-cyan-500/20 text-cyan-300 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Prontidão
            </button>
            <button
              type="button"
              onClick={() => setDataset("clinical")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                dataset === "clinical"
                  ? "bg-cyan-500/20 text-cyan-300 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Clínico
            </button>
            <button
              type="button"
              onClick={() => setDataset("schedule")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                dataset === "schedule"
                  ? "bg-cyan-500/20 text-cyan-300 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Agenda
            </button>
          </div>
        </div>

        {/* Action buttons or blocked warning */}
        <div className="flex items-center gap-2">
          {!authorized ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{exportAuthority.reason ?? "Exportação desabilitada: permissão não atribuída."}</span>
            </div>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => handleExport("csv")}
                disabled={exportingFormat !== null}
                className="h-8 gap-1.5 px-2.5 text-xs"
                title="Exportar dados tabulares em CSV"
              >
                {exportingFormat === "csv" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                CSV
              </Button>

              <Button
                variant="secondary"
                onClick={() => handleExport("xlsx")}
                disabled={exportingFormat !== null}
                className="h-8 gap-1.5 px-2.5 text-xs"
                title="Exportar pasta de trabalho em Excel (XLSX)"
              >
                {exportingFormat === "xlsx" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                )}
                XLSX
              </Button>

              <Button
                variant="primary"
                onClick={() => handleExport("pdf")}
                disabled={exportingFormat !== null}
                className="h-8 gap-1.5 px-3 text-xs"
                title="Gerar relatório impresso em PDF"
              >
                {exportingFormat === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {exportError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{exportError}</span>
        </div>
      )}

      {exportSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{exportSuccess}</span>
        </div>
      )}
    </div>
  );
}
