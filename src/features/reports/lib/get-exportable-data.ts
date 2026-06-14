/**
 * Extrai dados tabulares de cada relatório para exportação.
 * Converte os dados processados pelo useReportsData em headers + rows.
 */

import type { ExportableData } from "@/features/reports/components/export-toolbar";
import type { ReportId } from "@/features/reports/lib/report-catalog";
import type { useReportsData } from "@/features/reports/hooks/use-reports-data";

type ReportsDataReturn = ReturnType<typeof useReportsData>;

function buildFromListItems(
  items: ReportsDataReturn["occurrences"]["attention"],
  extraHeaders: string[] = [],
): ExportableData {
  const headers = ["ID", "Nome", "Detalhe", "Status", "Valor", ...extraHeaders];
  const rows = items.map((item) => [
    item.id,
    item.label,
    item.detail,
    item.status ?? "",
    item.value ?? "",
    ...(item.meta ? [item.meta] : extraHeaders.length ? [""] : []),
  ]);
  return { headers, rows };
}

function buildFromStatItems(
  items: ReportsDataReturn["occurrences"]["distribution"],
  categoryLabel = "Categoria",
): ExportableData {
  const headers = [categoryLabel, "Valor", "Percentual (%)"];
  const rows = items.map((item) => [
    item.label,
    String(item.value),
    item.percent !== undefined ? String(item.percent) : "",
  ]);
  return { headers, rows };
}

export function getExportableData(
  reportId: ReportId,
  data: ReportsDataReturn,
): ExportableData {
  switch (reportId) {
    case "occurrences": {
      const headers = [
        "ID",
        "Ocorrência",
        "Detalhe",
        "Status",
        "Valor",
      ];
      const rows = data.occurrences.attention.map((item) => [
        item.id,
        item.label,
        item.detail,
        item.status ?? "",
        item.value ?? "",
      ]);
      // Add distribution summary rows
      const distHeaders = ["Tipo", "Quantidade", "Percentual (%)"];
      const distRows = data.occurrences.distribution.map((item) => [
        item.label,
        String(item.value),
        item.percent !== undefined ? `${item.percent}%` : "",
      ]);
      return {
        headers: rows.length > 0 ? headers : distHeaders,
        rows: rows.length > 0 ? rows : distRows,
      };
    }

    case "inventory": {
      const headers = ["Item", "Detalhe", "Status", "Valor", "Meta"];
      const rows = data.inventory.criticalItems.map((item) => [
        item.label,
        item.detail,
        item.status ?? "",
        item.value ?? "",
        item.meta ?? "",
      ]);
      if (rows.length === 0) {
        return buildFromStatItems(data.inventory.categories, "Categoria");
      }
      return { headers, rows };
    }

    case "effective": {
      const headers = [
        "Categoria",
        "Humanos",
        "K9",
        "Binômios",
        "Viaturas",
      ];
      const summaryRow = [
        "Ativos",
        String(data.effective.activeHumans),
        String(data.effective.activeDogs),
        String(data.effective.binomials),
        String(data.effective.activeVehicles),
      ];
      const totalRow = [
        "Total Cadastrado",
        String(data.effective.humans),
        String(data.effective.dogs),
        String(data.effective.binomials),
        String(data.effective.activeVehicles),
      ];

      const movementHeaders = ["Nome", "Detalhe", "Status", "Valor"];
      const movementRows = data.effective.movements.map((item) => [
        item.label,
        item.detail,
        item.status ?? "",
        item.value ?? "",
      ]);

      if (movementRows.length > 0) {
        return { headers: movementHeaders, rows: movementRows };
      }
      return { headers, rows: [summaryRow, totalRow] };
    }

    case "apprehensions": {
      const headers = ["Categoria", "Quantidade", "Percentual (%)"];
      const rows = data.apprehensions.categories.map((item) => [
        item.label,
        String(item.value),
        item.percent !== undefined ? `${item.percent}%` : "",
      ]);
      // Add summary row
      rows.push([
        "TOTAL",
        String(data.apprehensions.count),
        `${(data.apprehensions.totalGrams / 1000).toFixed(2)} kg`,
      ]);
      return { headers, rows };
    }

    case "vehicles": {
      const headers = ["Viatura", "Detalhe", "Status", "Quilometragem"];
      const rows = data.vehicles.highlights.map((item) => [
        item.label,
        item.detail,
        item.status ?? "",
        item.value ?? "",
      ]);
      if (rows.length === 0) {
        return buildFromStatItems(data.vehicles.status, "Status Frota");
      }
      return { headers, rows };
    }

    case "health": {
      const headers = ["K9", "Detalhe", "Status", "Observação"];
      const rows = data.health.attention.map((item) => [
        item.label,
        item.detail,
        item.status ?? "",
        item.value ?? "",
      ]);
      if (rows.length === 0) {
        return {
          headers: ["Indicador", "Valor"],
          rows: [
            ["Atendimentos", String(data.health.events)],
            ["Pendências", String(data.health.pending)],
            ["Vacinas em dia (%)", `${data.health.vaccinesPercent}%`],
            ["Tratamentos", String(data.health.treatments)],
            ["Prontidão (%)", `${data.health.readyPercent}%`],
          ],
        };
      }
      return { headers, rows };
    }

    case "training": {
      const headers = ["Disciplina", "Valor", "Percentual (%)"];
      const rows = data.training.disciplines.map((item) => [
        item.label,
        String(item.value),
        item.percent !== undefined ? `${item.percent}%` : "",
      ]);
      rows.push([
        "RESUMO",
        `${data.training.sessions} sessões`,
        `${data.training.avgConformity}% conformidade`,
      ]);
      return { headers, rows };
    }

    case "binomials": {
      if (data.binomials.highlights.length > 0) {
        return buildFromListItems(data.binomials.highlights);
      }
      return {
        headers: ["Indicador", "Valor"],
        rows: [
          ["Total", String(data.binomials.total)],
          ["Ativos", String(data.binomials.active)],
          ["Em formação", String(data.binomials.formation)],
          ["Alertas", String(data.binomials.alerts)],
          ["Prontidão média (%)", `${data.binomials.avgReadiness}%`],
        ],
      };
    }

    case "audit": {
      const headers = ["Evento", "Detalhe", "Status", "Valor"];
      const rows = data.audit.recent.map((item) => [
        item.label,
        item.detail,
        item.status ?? "",
        item.value ?? "",
      ]);
      if (rows.length === 0) {
        return buildFromStatItems(data.audit.distribution, "Criticidade");
      }
      return { headers, rows };
    }

    case "productivity": {
      return {
        headers: ["Indicador", "Valor"],
        rows: [
          ["Ocorrências", String(data.occurrences.total)],
          ["Apreensões", String(data.apprehensions.count)],
          [
            "Total Apreendido (kg)",
            (data.apprehensions.totalGrams / 1000).toFixed(2),
          ],
          ["Sessões de Treino", String(data.training.sessions)],
          ["Conformidade Treino (%)", `${data.training.avgConformity}%`],
          ["Efetivo Humano Ativo", String(data.effective.activeHumans)],
          ["Efetivo K9 Ativo", String(data.effective.activeDogs)],
          ["Binômios Ativos", String(data.effective.binomials)],
          ["Viaturas em Operação", String(data.effective.activeVehicles)],
          ["Saúde - Prontidão (%)", `${data.health.readyPercent}%`],
        ],
      };
    }

    default:
      return { headers: ["Info"], rows: [["Sem dados disponíveis"]] };
  }
}
