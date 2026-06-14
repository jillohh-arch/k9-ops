"use client";

import { FileSpreadsheet, FileText, Loader2, Table } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { exportToCsv, exportToPdf, exportToXlsx } from "@/lib/export";
import type { ReportId } from "@/features/reports/lib/report-catalog";
import { cn } from "@/lib/utils";

export type ExportableData = {
  headers: string[];
  rows: string[][];
};

type ExportFormat = "csv" | "xlsx" | "pdf";

interface ExportToolbarProps {
  reportId: ReportId;
  reportTitle: string;
  getData: () => ExportableData;
  subtitle?: string;
  className?: string;
}

const formatOptions: Array<{
  detail: string;
  format: ExportFormat;
  icon: typeof FileText;
  label: string;
  tone: "red" | "emerald" | "blue";
}> = [
  {
    detail: "Documento portátil",
    format: "pdf",
    icon: FileText,
    label: "PDF",
    tone: "red",
  },
  {
    detail: "Planilha editável",
    format: "xlsx",
    icon: FileSpreadsheet,
    label: "Excel",
    tone: "emerald",
  },
  {
    detail: "Valores separados",
    format: "csv",
    icon: Table,
    label: "CSV",
    tone: "blue",
  },
];

const toneClasses = {
  red: "border-red-300/30 bg-red-400/10 text-red-100 hover:bg-red-400/20",
  emerald:
    "border-emerald-300/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20",
  blue: "border-blue-300/30 bg-blue-400/10 text-blue-100 hover:bg-blue-400/20",
};

/**
 * Toolbar de exportação que dispara download em CSV, XLSX ou PDF.
 * Recebe uma função `getData` que retorna headers + rows no momento do clique.
 */
export function ExportToolbar({
  reportId,
  reportTitle,
  getData,
  subtitle,
  className,
}: ExportToolbarProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(format);

      // Pequeno delay para exibir feedback visual
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        const { headers, rows } = getData();
        const baseFilename = `k9-ops-${reportId}-${new Date().toISOString().slice(0, 10)}`;

        switch (format) {
          case "csv":
            exportToCsv(baseFilename, headers, rows);
            break;
          case "xlsx":
            exportToXlsx(baseFilename, headers, rows, reportTitle);
            break;
          case "pdf":
            exportToPdf({
              filename: baseFilename,
              title: `Relatório de ${reportTitle}`,
              subtitle: subtitle ?? `Exportado em ${new Date().toLocaleDateString("pt-BR")}`,
              headers,
              rows,
              orientation: headers.length > 5 ? "landscape" : "portrait",
            });
            break;
        }
      } catch (error) {
        console.error(`[ExportToolbar] Erro ao exportar ${format}:`, error);
      } finally {
        setExporting(null);
      }
    },
    [getData, reportId, reportTitle, subtitle],
  );

  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {formatOptions.map((option) => {
        const Icon = option.icon;
        const isExporting = exporting === option.format;

        return (
          <button
            aria-label={`Exportar como ${option.label}`}
            className={cn(
              "rounded-2xl border p-4 text-left transition",
              toneClasses[option.tone],
              isExporting && "pointer-events-none opacity-60",
            )}
            disabled={isExporting}
            key={option.format}
            onClick={() => handleExport(option.format)}
            type="button"
          >
            {isExporting ? (
              <Loader2 className="mb-4 h-7 w-7 animate-spin" />
            ) : (
              <Icon className="mb-4 h-7 w-7" />
            )}
            <p className="font-black text-white">{option.label}</p>
            <p className="mt-1 text-xs text-slate-400">{option.detail}</p>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Botão compacto de exportação rápida (para header do relatório).
 */
export function ExportButton({
  reportId,
  reportTitle,
  getData,
  subtitle,
}: Omit<ExportToolbarProps, "className">) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(format);
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        const { headers, rows } = getData();
        const baseFilename = `k9-ops-${reportId}-${new Date().toISOString().slice(0, 10)}`;

        switch (format) {
          case "csv":
            exportToCsv(baseFilename, headers, rows);
            break;
          case "xlsx":
            exportToXlsx(baseFilename, headers, rows, reportTitle);
            break;
          case "pdf":
            exportToPdf({
              filename: baseFilename,
              title: `Relatório de ${reportTitle}`,
              subtitle: subtitle ?? `Exportado em ${new Date().toLocaleDateString("pt-BR")}`,
              headers,
              rows,
              orientation: headers.length > 5 ? "landscape" : "portrait",
            });
            break;
        }
      } catch (error) {
        console.error(`[ExportButton] Erro ao exportar ${format}:`, error);
      } finally {
        setExporting(null);
        setOpen(false);
      }
    },
    [getData, reportId, reportTitle, subtitle],
  );

  return (
    <div className="relative">
      <Button
        className="rounded-2xl bg-cyan-300 text-slate-950 hover:bg-cyan-200"
        onClick={() => setOpen(!open)}
        type="button"
      >
        {exporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Exportar relatório
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-cyan-200/15 bg-slate-900 p-2 shadow-xl">
          {formatOptions.map((option) => {
            const Icon = option.icon;
            const isExporting = exporting === option.format;

            return (
              <button
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                disabled={isExporting}
                key={option.format}
                onClick={() => handleExport(option.format)}
                type="button"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="font-semibold">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
