/**
 * Shared date/number formatting utilities (pt-BR).
 */

// ─── Formatters (singleton instances) ────────────────────────────────────────

const shortDateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

const shortDateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const dayMonthFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

const dayMonthTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const fullDateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const integerFmt = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const weightFmt = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const currencyFmt = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  maximumFractionDigits: 2,
  style: "currency",
});

// ─── Date formatters ─────────────────────────────────────────────────────────

/** Format as dd/mm/yyyy. Returns "--" when null. */
export function formatDate(date: Date | null, withTime?: boolean): string {
  if (!date) return "--";
  if (withTime) return shortDateTimeFmt.format(date);
  return shortDateFmt.format(date);
}

/** Format as dd/mm (no year). */
export function formatDateShort(date: Date | null): string {
  return date ? dayMonthFmt.format(date) : "--";
}

/** Format as dd/mm HH:mm. */
export function formatDateTimeCompact(date: Date | null): string {
  return date ? dayMonthTimeFmt.format(date) : "--";
}

/** Format as dd/mm/yyyy (explicit full). */
export function formatDateFull(date: Date | null): string {
  return date ? fullDateFmt.format(date) : "--";
}

// ─── Number formatters ───────────────────────────────────────────────────────

/** Integer format (no decimals). */
export function formatNumber(value: number): string {
  return integerFmt.format(value);
}

/** Percent from integer value (e.g. 85 → "85%"). */
export function formatPercent(value: number): string {
  return `${integerFmt.format(value)}%`;
}

/**
 * Format a success rate. Handles both 0-1 and 0-100 scales.
 * Returns "--" when null.
 */
export function formatSuccess(value: number | null): string {
  if (value == null) return "--";
  return `${Math.round(value <= 1 ? value * 100 : value)}%`;
}

/** Weight with 1 decimal (e.g. "12,5"). */
export function formatWeight(value: number): string {
  return weightFmt.format(value);
}

/** Currency in BRL. */
export function formatCurrency(value: number): string {
  return currencyFmt.format(value);
}

/** Kilograms from grams. */
export function formatKg(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${integerFmt.format(grams)} g`;
}

/** Distance in meters/km. */
export function formatDistance(value: number | null): string {
  if (value == null) return "--";
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(value)} m`;
}
