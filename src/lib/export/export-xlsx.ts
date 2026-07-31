/**
 * Exportação de dados em formato XLSX via SheetJS.
 */

import * as XLSX from "xlsx";

import {
  neutralizeSpreadsheetFormula,
  sanitizeDownloadFilename,
  sanitizeWorksheetName,
} from "./export-safety";

export function createXlsxWorkbook(
  headers: string[],
  rows: string[][],
  sheetName = "Relatório",
): XLSX.WorkBook {
  const worksheetData = [
    headers.map(neutralizeSpreadsheetFormula),
    ...rows.map((row) => row.map(neutralizeSpreadsheetFormula)),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-size columns based on content width
  const colWidths = headers.map((header, colIndex) => {
    const maxContentWidth = Math.max(
      header.length,
      ...rows.map((row) => (row[colIndex] ?? "").length),
    );
    return { wch: Math.min(maxContentWidth + 2, 50) };
  });
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    sanitizeWorksheetName(sheetName),
  );

  return workbook;
}

export function createXlsxBlob(
  headers: string[],
  rows: string[][],
  sheetName = "Relatório",
): Blob {
  const workbook = createXlsxWorkbook(headers, rows, sheetName);
  const xlsxBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;

  return new Blob([xlsxBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function exportToXlsx(
  filename: string,
  headers: string[],
  rows: string[][],
  sheetName = "Relatório",
): void {
  const blob = createXlsxBlob(headers, rows, sheetName);
  triggerDownload(blob, sanitizeDownloadFilename(filename, ".xlsx"));
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
