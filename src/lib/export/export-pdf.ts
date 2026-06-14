/**
 * Exportação de dados em formato PDF via jsPDF + jspdf-autotable.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfExportOptions {
  filename: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  orientation?: "portrait" | "landscape";
}

export function exportToPdf({
  filename,
  title,
  subtitle,
  headers,
  rows,
  orientation = "portrait",
}: PdfExportOptions): void {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 32, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 15);

  // Subtitle
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(subtitle, 14, 24);
  }

  // Generation timestamp
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const timestamp = new Date().toLocaleString("pt-BR");
  doc.text(`Gerado em: ${timestamp}`, pageWidth - 14, 24, { align: "right" });

  // Table
  autoTable(doc, {
    startY: 38,
    head: [headers],
    body: rows,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59], // slate-800
      lineColor: [203, 213, 225], // slate-300
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249], // slate-100
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      // Footer on each page
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `K9 OPS - ${title}`,
        14,
        pageHeight - 8,
      );
      doc.text(
        `Página ${doc.getCurrentPageInfo().pageNumber}`,
        pageWidth - 14,
        pageHeight - 8,
        { align: "right" },
      );
    },
  });

  doc.save(ensureExtension(filename, ".pdf"));
}

function ensureExtension(filename: string, ext: string): string {
  return filename.endsWith(ext) ? filename : `${filename}${ext}`;
}
