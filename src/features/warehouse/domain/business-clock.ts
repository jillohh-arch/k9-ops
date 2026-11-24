/**
 * K9 Ops — F60 Almoxarifado V1
 * Canonical Business Time & Clock Abstraction
 *
 * Enforces canonical organization timezone 'America/Sao_Paulo'.
 * Prevents client-clock drift from affecting critical temporal determinations.
 */

export const CANONICAL_BUSINESS_TIMEZONE = "America/Sao_Paulo" as const;

export interface BusinessClock {
  /** Returns the current Date/instant. */
  now(): Date;
  /** Returns the current date string in YYYY-MM-DD formatted in canonical timezone. */
  today(): string;
}

/**
 * Returns the current date in YYYY-MM-DD for a given Date in America/Sao_Paulo.
 */
export function formatCanonicalBusinessDate(
  date: Date,
  timeZone = CANONICAL_BUSINESS_TIMEZONE,
): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // en-CA produces YYYY-MM-DD
}

/**
 * Default production clock using system now formatted in canonical timezone.
 */
export const defaultBusinessClock: BusinessClock = {
  now(): Date {
    return new Date();
  },
  today(): string {
    return formatCanonicalBusinessDate(new Date(), CANONICAL_BUSINESS_TIMEZONE);
  },
};

/**
 * Creates a deterministic clock for tests or simulated server environments.
 */
export function createFixedBusinessClock(fixedInstant: Date): BusinessClock {
  return {
    now(): Date {
      return new Date(fixedInstant.getTime());
    },
    today(): string {
      return formatCanonicalBusinessDate(fixedInstant, CANONICAL_BUSINESS_TIMEZONE);
    },
  };
}

/**
 * Checks if a batch expiration date (YYYY-MM-DD) is expired.
 * Canonical rule: A batch is expired ONLY if business_today > expiration_date.
 * A batch with expiration_date == business_today remains valid through the full business day.
 */
export function isBatchExpired(
  expirationDate: string,
  businessToday: string,
): boolean {
  return businessToday > expirationDate;
}

/**
 * Computes difference in calendar days between two YYYY-MM-DD strings.
 */
export function daysDifference(targetDate: string, baseDate: string): number {
  const [y1, m1, d1] = targetDate.split("-").map(Number);
  const [y2, m2, d2] = baseDate.split("-").map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc1 - utc2) / (1000 * 60 * 60 * 24));
}

/**
 * Adds days to a YYYY-MM-DD string, returning YYYY-MM-DD.
 */
export function addDaysToDateString(baseDate: string, days: number): string {
  const [y, m, d] = baseDate.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const result = new Date(utc);
  const year = result.getUTCFullYear();
  const month = String(result.getUTCMonth() + 1).padStart(2, "0");
  const day = String(result.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
