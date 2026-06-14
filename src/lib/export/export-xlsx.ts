/**
 * Exportação de dados em formato XLSX via SheetJS.
 */

import * as XLSX from "xlsx";

export function exportToXlsx(
  filename: string,
  headers: string[],
  rows: string[][],
  sheetName = "Relatório",
): void {
  const worksheetData = [headers, ...rows];
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
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const xlsxBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([xlsxBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  triggerDownload(blob, ensureExtension(filename, ".xlsx"));
}

function ensureExtension(filename: string, ext: string): string {
  return filename.endsWith(ext) ? filename : `${filename}${ext}`;
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
