const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const UNSAFE_FILENAME_CHARACTERS = /[\u0000-\u001f\u007f<>:"/\\|?*]+/g;
const UNSAFE_SHEET_NAME_CHARACTERS = /[\u0000-\u001f\u007f[\]:*?/\\]+/g;
const FORMULA_PREFIX = /^\s*[=+\-@]/;
const WINDOWS_RESERVED_NAMES =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function sanitizeExportText(value: string): string {
  return value.replace(CONTROL_CHARACTERS, "");
}

export function sanitizeDownloadFilename(
  filename: string,
  extension: string,
): string {
  const normalizedExtension = extension.startsWith(".")
    ? extension
    : `.${extension}`;
  const hasExtension = filename
    .toLowerCase()
    .endsWith(normalizedExtension.toLowerCase());
  const rawStem = hasExtension
    ? filename.slice(0, -normalizedExtension.length)
    : filename;
  let safeStem = rawStem
    .replace(UNSAFE_FILENAME_CHARACTERS, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.\s-]+|[.\s-]+$/g, "")
    .slice(0, 120 - normalizedExtension.length);

  if (!safeStem) safeStem = "k9-ops-export";
  if (WINDOWS_RESERVED_NAMES.test(safeStem)) {
    safeStem = `k9-ops-${safeStem}`;
  }

  return `${safeStem}${normalizedExtension}`;
}

export function sanitizeWorksheetName(sheetName: string): string {
  const sanitized = sheetName
    .replace(UNSAFE_SHEET_NAME_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .replace(/^'+|'+$/g, "")
    .trim()
    .slice(0, 31);

  return sanitized || "Relatorio";
}

export function neutralizeSpreadsheetFormula(value: string): string {
  const sanitized = sanitizeExportText(value);
  return FORMULA_PREFIX.test(sanitized) ? `'${sanitized}` : sanitized;
}
