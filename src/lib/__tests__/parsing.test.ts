import { describe, expect, it } from "vitest";

import {
  normalizeText,
  parseFirestoreDate,
  parseNullableFirestoreDate,
  recordText,
  startOfLocalDay,
  visibleRecords,
} from "../parsing";

describe("normalizeText", () => {
  it("lowercases and removes accents", () => {
    expect(normalizeText("São Paulo")).toBe("sao paulo");
  });

  it("handles non-string values", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText(123)).toBe("");
  });

  it("trims whitespace", () => {
    expect(normalizeText("  hello  ")).toBe("hello");
  });
});

describe("parseFirestoreDate", () => {
  it("returns Date instances as-is", () => {
    const date = new Date("2025-01-15");
    expect(parseFirestoreDate(date)).toBe(date);
  });

  it("handles Firestore Timestamp-like objects", () => {
    const fakeTimestamp = {
      toDate: () => new Date("2025-06-01T12:00:00Z"),
    };
    expect(parseFirestoreDate(fakeTimestamp).getTime()).toBe(
      new Date("2025-06-01T12:00:00Z").getTime(),
    );
  });

  it("parses ISO strings", () => {
    const result = parseFirestoreDate("2025-03-10T08:30:00Z");
    expect(result.toISOString()).toBe("2025-03-10T08:30:00.000Z");
  });

  it("parses numeric timestamps", () => {
    const ms = 1700000000000;
    expect(parseFirestoreDate(ms).getTime()).toBe(ms);
  });

  it("falls back to now for invalid values", () => {
    const before = Date.now();
    const result = parseFirestoreDate("not-a-date");
    // Invalid string → fallback to new Date()
    expect(result.getTime()).toBeGreaterThanOrEqual(before - 10);
  });

  it("falls back to now for null/undefined", () => {
    const before = Date.now();
    expect(parseFirestoreDate(null).getTime()).toBeGreaterThanOrEqual(before - 10);
    expect(parseFirestoreDate(undefined).getTime()).toBeGreaterThanOrEqual(before - 10);
  });
});

describe("parseNullableFirestoreDate", () => {
  it("returns null for null/undefined", () => {
    expect(parseNullableFirestoreDate(null)).toBeNull();
    expect(parseNullableFirestoreDate(undefined)).toBeNull();
  });

  it("parses valid values", () => {
    const result = parseNullableFirestoreDate("2025-01-01");
    expect(result).toBeInstanceOf(Date);
  });
});

describe("startOfLocalDay", () => {
  it("sets time to midnight", () => {
    const date = new Date("2025-06-15T14:30:00");
    const result = startOfLocalDay(date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("does not mutate the original date", () => {
    const date = new Date("2025-06-15T14:30:00");
    const originalTime = date.getTime();
    startOfLocalDay(date);
    expect(date.getTime()).toBe(originalTime);
  });
});

describe("recordText", () => {
  it("returns first non-empty matching field", () => {
    const record = { name: "", displayName: "Rex", warName: "K9-Rex" };
    expect(recordText(record, ["name", "displayName", "warName"])).toBe("Rex");
  });

  it("coerces numbers to string", () => {
    const record = { code: 42 };
    expect(recordText(record, ["code"])).toBe("42");
  });

  it("returns empty string when no field matches", () => {
    const record = { foo: "" };
    expect(recordText(record, ["name", "displayName"])).toBe("");
  });
});

describe("visibleRecords", () => {
  it("filters out inactive records", () => {
    const records = [
      { id: "1", active: true },
      { id: "2", active: false },
    ];
    expect(visibleRecords(records)).toHaveLength(1);
    expect(visibleRecords(records)[0].id).toBe("1");
  });

  it("filters out soft-deleted records", () => {
    const records = [
      { id: "1" },
      { id: "2", deleted_at: new Date() },
      { id: "3", archivedAt: new Date() },
      { id: "4", status: "archived" },
    ];
    expect(visibleRecords(records)).toHaveLength(1);
  });

  it("keeps records without deletion markers", () => {
    const records = [{ id: "1", name: "Active" }];
    expect(visibleRecords(records)).toHaveLength(1);
  });
});
