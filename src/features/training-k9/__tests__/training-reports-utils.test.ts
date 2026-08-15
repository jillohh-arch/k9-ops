import { describe, expect, it } from "vitest";

import {
  isValidReportDate,
  resolveReportStartDate,
} from "../lib/training-reports-utils";

// ─── isValidReportDate ────────────────────────────────────────────────────────

describe("isValidReportDate", () => {
  it("accepts a valid Date instance", () => {
    const d = new Date("2025-01-15T10:00:00Z");
    expect(isValidReportDate(d)).toBe(true);
  });

  it("accepts an epoch Date", () => {
    expect(isValidReportDate(new Date(0))).toBe(true);
  });

  it("rejects an Invalid Date", () => {
    expect(isValidReportDate(new Date("not-a-date"))).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isValidReportDate(undefined)).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidReportDate(null)).toBe(false);
  });

  it("rejects a number", () => {
    expect(isValidReportDate(1736935200000)).toBe(false);
  });

  it("rejects a string", () => {
    expect(isValidReportDate("2025-01-15")).toBe(false);
  });

  it("rejects a plain object", () => {
    expect(isValidReportDate({})).toBe(false);
  });

  it("rejects an object that quacks like a Date but is not one", () => {
    const fake = { getTime: () => 1736935200000 };
    expect(isValidReportDate(fake)).toBe(false);
  });

  it("rejects a Timestamp-like object without Date prototype", () => {
    const fakeTimestamp = { seconds: 1736935200, nanoseconds: 0, toMillis: () => 1736935200000 };
    expect(isValidReportDate(fakeTimestamp)).toBe(false);
  });
});

// ─── resolveReportStartDate ───────────────────────────────────────────────────

describe("resolveReportStartDate", () => {
  const now = new Date("2025-06-15T12:00:00Z");

  it("returns null for the 'all' period (no lower bound)", () => {
    expect(resolveReportStartDate("all", now)).toBeNull();
  });

  it("returns a Date 7 days before now for '7d'", () => {
    const start = resolveReportStartDate("7d", now);
    expect(start).toBeInstanceOf(Date);
    expect(start!.getTime()).toBe(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  });

  it("returns a Date 30 days before now for '30d'", () => {
    const start = resolveReportStartDate("30d", now);
    expect(start).toBeInstanceOf(Date);
    expect(start!.getTime()).toBe(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  });

  it("returns a Date 60 days before now for '60d'", () => {
    const start = resolveReportStartDate("60d", now);
    expect(start!.getTime()).toBe(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  });

  it("returns a Date 90 days before now for '90d'", () => {
    const start = resolveReportStartDate("90d", now);
    expect(start!.getTime()).toBe(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  });

  it("defaults to 30 days for unknown periods", () => {
    // @ts-expect-error — testing defensive fallback for unknown keys
    const start = resolveReportStartDate("garbage", now);
    expect(start!.getTime()).toBe(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  });
});

// ─── Validation gate for temporal queries ─────────────────────────────────────
// Documents the contract used by use-training-reports-data:
// resolveReportStartDate output MUST be validated with isValidReportDate
// before being passed to a Firestore where(..., ">=", value) constraint.

describe("temporal query contract", () => {
  const now = new Date("2025-06-15T12:00:00Z");

  it("'30d' produces a valid Date suitable for Firestore filter", () => {
    const start = resolveReportStartDate("30d", now);
    expect(isValidReportDate(start)).toBe(true);
  });

  it("'7d' produces a valid Date suitable for Firestore filter", () => {
    const start = resolveReportStartDate("7d", now);
    expect(isValidReportDate(start)).toBe(true);
  });

  it("'all' produces null — caller must skip the temporal filter", () => {
    const start = resolveReportStartDate("all", now);
    expect(start).toBeNull();
    // A null bypasses the temporal constraint branch entirely; nothing
    // reaches Firestore's serializer.
  });

  it("an Invalid Date is rejected and would block the query", () => {
    const bad = new Date("not-a-date");
    expect(isValidReportDate(bad)).toBe(false);
    // Defensive use: the provider replaces invalid values with null
    // before constructing the query, so the where clause is omitted.
    const safe = isValidReportDate(bad) ? bad : null;
    expect(safe).toBeNull();
  });
});