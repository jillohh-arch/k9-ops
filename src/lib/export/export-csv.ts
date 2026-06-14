/**
 * Exportação de dados em formato CSV (UTF-8 com BOM).
 * Sem dependências externas.
 */

function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: string[][],
): void {
  const BOM = "﻿";
  const headerLine = headers.map(escapeCsvValue).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(","));
  const csvContent = BOM + [headerLine, ...dataLines].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, ensureExtension(filename, ".csv"));
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
