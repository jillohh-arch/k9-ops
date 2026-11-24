/**
 * K9 Ops — F60 Warehouse Operational CSV Exporter
 * Pure client-side export utility (Zero backend mutation, zero permission drift).
 */

export function exportTableToCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const sanitize = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows = [
    headers.map(sanitize).join(";"),
    ...rows.map((row) => row.map(sanitize).join(";")),
  ];

  const csvContent = "\uFEFF" + csvRows.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
