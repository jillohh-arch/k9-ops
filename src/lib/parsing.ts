/**
 * Shared parsing and normalization utilities.
 *
 * Centralizes logic previously duplicated in dashboard, shift-group-service,
 * and operational center hooks.
 */

/**
 * Normalize text by trimming and lowercasing, removing accents.
 * Useful for search filters.
 */
export function normalizeText(value: unknown): string {
  const text = String(value ?? "");
  if (text.length === 0) return "";
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Parse a Firestore timestamp, ISO string, or number into a Date.
 * Falls back to `new Date()` when the value is unrecognizable.
 */
export function parseFirestoreDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : new Date();
    }
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  return new Date();
}

/**
 * Parse a Firestore timestamp that may be null/undefined.
 */
export function parseNullableFirestoreDate(value: unknown): Date | null {
  if (value == null) return null;
  return parseFirestoreDate(value);
}

/**
 * Returns midnight of the given date in local time.
 */
export function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * Extract the first non-empty string from a record given multiple candidate field names.
 * Coerces numbers to string.
 */
export function recordText(
  record: Record<string, unknown>,
  fields: string[],
): string {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text.length > 0) return text;
    }
  }
  return "";
}

/**
 * Filter records that are considered "visible" (active, not deleted, not archived).
 */
export function visibleRecords<T extends Record<string, unknown>>(
  records: T[],
): T[] {
  return records.filter((record) => {
    if (record.active === false) return false;
    if (record.deleted_at != null || record.deletedAt != null) return false;
    if (record.archived_at != null || record.archivedAt != null) return false;
    if (record.status === "archived" || record.status === "deleted") return false;
    return true;
  });
}
