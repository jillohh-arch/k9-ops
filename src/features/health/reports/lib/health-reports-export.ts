/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Export orchestration and formatters for authorized reporting data.
 *
 * HARD SECURITY & INTEGRITY INVARIANTS:
 * - Fail-closed: enforces `exportAuthority.canExport === true`.
 * - Truthful export: exports ONLY the authorized, visible data.
 * - Format support: CSV, XLSX, PDF.
 * - Preserves ZERO vs UNKNOWN semantics in exported notes.
 */

import { exportToCsv } from "@/lib/export/export-csv";
import { exportToXlsx } from "@/lib/export/export-xlsx";
import { exportToPdf } from "@/lib/export/export-pdf";
import {
  CLINICAL_CASE_STATUS_LABELS,
  SCHEDULE_STATUS_LABELS,
} from "../../domain/read-states";
import type {
  HealthReportsAggregate,
  ReportExportAuthority,
  ReportExportDataset,
  ReportExportFormat,
} from "../domain/health-reports-types";

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  dose: "Dose",
  vaccination: "Vacinação",
  exam: "Exame",
  consultation: "Consulta",
  weighing: "Pesagem",
  reevaluation: "Reavaliação",
  deworming: "Vermifugação",
  bath: "Banho",
  general: "Geral",
};

export interface TableExportData {
  title: string;
  subtitle: string;
  headers: string[];
  rows: string[][];
  filename: string;
}

export function formatHealthReportExportData(
  dataset: ReportExportDataset,
  aggregate: HealthReportsAggregate
): TableExportData {
  const dateStr = aggregate.referenceDate.toISOString().slice(0, 10);
  const periodLabel =
    aggregate.period === "today"
      ? "Hoje"
      : aggregate.period === "7d"
        ? "7 dias"
        : "30 dias";

  switch (dataset) {
    case "readiness": {
      const headers = [
        "Cão (Nome)",
        "RG / Matrícula",
        "Raça",
        "Status de Prontidão",
        "Restrições Ativas",
        "Qualidade dos Dados",
      ];

      // Format from filtered readiness items (or from aggregate summary)
      const rows: string[][] = [];
      // Note: If no individual dog items were preserved in aggregate, we list what's present
      // We can also format the status counts
      rows.push([
        "TODOS OS CÃES EM ESCOPO",
        `Total: ${aggregate.readiness.totalDogsInScope}`,
        "-",
        `Aptos: ${aggregate.readiness.statusCounts.operational} | Atenção: ${aggregate.readiness.statusCounts.operational_attention} | Restrições: ${aggregate.readiness.statusCounts.fit_with_restrictions} | Inaptos: ${aggregate.readiness.statusCounts.temporarily_unfit}`,
        `Total ativas: ${aggregate.readiness.activeRestrictionsCount} (${aggregate.readiness.restrictionsCoverageComplete ? "Completa" : "Incompleta"})`,
        aggregate.readiness.isCoverageComplete ? "Completa" : "Parcial / Degradada",
      ]);

      return {
        title: "K9 OPS — Relatório de Prontidão Operacional",
        subtitle: `Escopo institucional em ${dateStr} • Cobertura: ${aggregate.readiness.isCoverageComplete ? "100% Avaliada" : "Parcial"}`,
        headers,
        rows,
        filename: `relatorio-prontidao-${dateStr}`,
      };
    }

    case "clinical": {
      const headers = [
        "Cão",
        "Título do Caso",
        "Status Clínico",
        "Data de Abertura",
        "Restrição Ativa",
        "Agenda Pendente",
      ];

      const rows = aggregate.filteredClinicalCases.map((entry) => {
        const c = entry.case;
        const statusLabel = c.clinicalStatus
          ? CLINICAL_CASE_STATUS_LABELS[c.clinicalStatus] ?? c.rawClinicalStatus ?? "Desconhecido"
          : c.rawClinicalStatus ?? "Não informado";

        const openedStr = c.openedAt
          ? c.openedAt.toLocaleDateString("pt-BR")
          : "Não informada";

        return [
          entry.dog.name,
          c.title ?? `Caso #${c.caseId}`,
          statusLabel,
          openedStr,
          c.hasActiveRestriction === true ? "Sim" : c.hasActiveRestriction === false ? "Não" : "N/D",
          c.hasPendingSchedule === true ? "Sim" : c.hasPendingSchedule === false ? "Não" : "N/D",
        ];
      });

      if (rows.length === 0) {
        rows.push([
          "Nenhum caso clínico encontrado",
          "-",
          "-",
          "-",
          "-",
          "-",
        ]);
      }

      return {
        title: "K9 OPS — Relatório de Casos Clínicos",
        subtitle: `Período: ${periodLabel} • Total: ${aggregate.clinical.totalCases} casos (${aggregate.clinical.activeCasesCount} ativos)`,
        headers,
        rows,
        filename: `relatorio-casos-clinicos-${aggregate.period}-${dateStr}`,
      };
    }

    case "schedule": {
      const headers = [
        "Cão",
        "Procedimento",
        "Tipo",
        "Data / Hora",
        "Status Temporal",
      ];

      const rows = aggregate.filteredScheduleItems.map((entry) => {
        const item = entry.entry.item;
        const status = entry.temporal.temporalStatus;
        const statusText = status ? SCHEDULE_STATUS_LABELS[status] ?? status : "Indisponível";

        const typeLabel = item.scheduleType
          ? SCHEDULE_TYPE_LABELS[item.scheduleType] ?? item.scheduleType
          : "Geral";

        const scheduledStr = item.scheduledFor
          ? item.scheduledFor.toLocaleString("pt-BR", {
              timeZone: item.timezone ?? undefined,
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Data indisponível";

        return [
          entry.entry.dog.name,
          item.title ?? "Sem título",
          typeLabel,
          scheduledStr,
          statusText,
        ];
      });

      if (rows.length === 0) {
        rows.push([
          "Nenhum procedimento na agenda encontrado",
          "-",
          "-",
          "-",
          "-",
        ]);
      }

      return {
        title: "K9 OPS — Relatório da Agenda de Procedimentos",
        subtitle: `Período: ${periodLabel} • Total no período: ${aggregate.schedule.itemsInPeriodCount} (${aggregate.schedule.overdueCount} atrasados)`,
        headers,
        rows,
        filename: `relatorio-agenda-${aggregate.period}-${dateStr}`,
      };
    }

    case "kpi_summary":
    default: {
      const headers = ["Módulo / Categoria", "Indicador", "Valor", "Status / Cobertura"];
      const r = aggregate.readiness;
      const c = aggregate.clinical;
      const s = aggregate.schedule;

      const rows: string[][] = [
        [
          "Prontidão Operacional",
          "Cães no Escopo",
          String(r.totalDogsInScope),
          r.isCoverageComplete ? "100% Avaliado" : `${r.unevaluatedCount} sem projeção válida`,
        ],
        [
          "Prontidão Operacional",
          "Operacionais (Aptos)",
          String(r.statusCounts.operational),
          "-",
        ],
        [
          "Prontidão Operacional",
          "Operacional com Atenção",
          String(r.statusCounts.operational_attention),
          "-",
        ],
        [
          "Prontidão Operacional",
          "Apto com Restrições",
          String(r.statusCounts.fit_with_restrictions),
          "-",
        ],
        [
          "Prontidão Operacional",
          "Temporariamente Inaptos",
          String(r.statusCounts.temporarily_unfit),
          "-",
        ],
        [
          "Prontidão Operacional",
          "Restrições Ativas Totais",
          String(r.activeRestrictionsCount),
          r.restrictionsCoverageComplete ? "Cobertura completa" : "Parcial / Incompleta",
        ],
        [
          "Casos Clínicos",
          "Total de Casos",
          String(c.totalCases),
          c.coverage.complete ? "Completa" : "Parcial",
        ],
        [
          "Casos Clínicos",
          "Casos Ativos em Tratamento/Acompanhamento",
          String(c.activeCasesCount),
          "-",
        ],
        [
          "Casos Clínicos",
          `Casos Abertos no Período (${periodLabel})`,
          String(c.casesOpenedInPeriodCount),
          "-",
        ],
        [
          "Agenda de Procedimentos",
          "Procedimentos em Aberto / Escopo",
          String(s.totalItems),
          s.coverage.complete ? "Completa" : "Parcial",
        ],
        [
          "Agenda de Procedimentos",
          `Procedimentos no Período (${periodLabel})`,
          String(s.itemsInPeriodCount),
          "-",
        ],
        [
          "Agenda de Procedimentos",
          "Procedimentos Atrasados (Atenção)",
          String(s.overdueCount),
          s.overdueCount > 0 ? "Ação Requerida" : "Em dia",
        ],
        [
          "Agenda de Procedimentos",
          "Procedimentos Previstos para Hoje",
          String(s.todayCount),
          "-",
        ],
      ];

      return {
        title: "K9 OPS — Resumo Executivo de Saúde Canina",
        subtitle: `Período: ${periodLabel} • Gerado em: ${dateStr}`,
        headers,
        rows,
        filename: `resumo-saude-${aggregate.period}-${dateStr}`,
      };
    }
  }
}

export function executeHealthReportExport(
  dataset: ReportExportDataset,
  format: ReportExportFormat,
  aggregate: HealthReportsAggregate,
  exportAuthority: ReportExportAuthority
): void {
  // Fail-closed authorization gate
  if (!exportAuthority.canExport) {
    throw new Error(
      exportAuthority.reason ??
        "Acesso negado: exportação de relatórios não autorizada para este perfil."
    );
  }

  const data = formatHealthReportExportData(dataset, aggregate);

  if (format === "csv") {
    exportToCsv(data.filename, data.headers, data.rows);
  } else if (format === "xlsx") {
    exportToXlsx(data.filename, data.headers, data.rows, data.title.slice(0, 31));
  } else if (format === "pdf") {
    exportToPdf({
      filename: data.filename,
      title: data.title,
      subtitle: data.subtitle,
      headers: data.headers,
      rows: data.rows,
      orientation: "landscape",
    });
  }
}
