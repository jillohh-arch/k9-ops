import { describe, expect, it } from "vitest";

import {
  buildDrugDisplayItems,
  detectUserProfile,
  drugCategory,
  drugEntryGrams,
  emptyDrugStats,
  formatCount,
  formatPercent,
  formatWeight,
  hasValue,
  HUD_PRIMARY_SLOTS,
  isSoftDeleted,
  normalizeText,
  parseBoolean,
  parseNumber,
  recordText,
  visibleRecords,
  type DashboardRecord,
  type DrugDisplayItem,
} from "../dashboard-utils";

describe("normalizeText", () => {
  it("removes accents and lowercases", () => {
    expect(normalizeText("São Paulo")).toBe("sao paulo");
    expect(normalizeText("AÇÃO")).toBe("acao");
  });

  it("handles null and undefined", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });

  it("coerces numbers to string", () => {
    expect(normalizeText(123)).toBe("123");
  });

  it("trims whitespace", () => {
    expect(normalizeText("  hello  ")).toBe("hello");
  });
});

describe("parseNumber", () => {
  it("returns finite numbers as-is", () => {
    expect(parseNumber(42)).toBe(42);
    expect(parseNumber(3.14)).toBe(3.14);
  });

  it("parses strings with comma as decimal separator", () => {
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("3,5")).toBe(3.5);
  });

  it("returns 0 for invalid values", () => {
    expect(parseNumber(null)).toBe(0);
    expect(parseNumber(undefined)).toBe(0);
    expect(parseNumber("abc")).toBe(0);
    expect(parseNumber(NaN)).toBe(0);
    expect(parseNumber(Infinity)).toBe(0);
  });

  it("strips non-numeric characters from strings", () => {
    expect(parseNumber("R$ 100")).toBe(100);
  });
});

describe("parseBoolean", () => {
  it("returns booleans as-is", () => {
    expect(parseBoolean(true)).toBe(true);
    expect(parseBoolean(false)).toBe(false);
  });

  it("parses truthy string variants", () => {
    expect(parseBoolean("sim")).toBe(true);
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("yes")).toBe(true);
    expect(parseBoolean("1")).toBe(true);
    expect(parseBoolean("ativo")).toBe(true);
    expect(parseBoolean("active")).toBe(true);
  });

  it("parses falsy string variants", () => {
    expect(parseBoolean("nao")).toBe(false);
    expect(parseBoolean("false")).toBe(false);
    expect(parseBoolean("no")).toBe(false);
    expect(parseBoolean("0")).toBe(false);
    expect(parseBoolean("inativo")).toBe(false);
    expect(parseBoolean("inactive")).toBe(false);
  });

  it("returns null for unrecognized values", () => {
    expect(parseBoolean(null)).toBeNull();
    expect(parseBoolean(undefined)).toBeNull();
    expect(parseBoolean("maybe")).toBeNull();
  });

  it("interprets non-zero numbers as true", () => {
    expect(parseBoolean(1)).toBe(true);
    expect(parseBoolean(-1)).toBe(true);
    expect(parseBoolean(0)).toBe(false);
  });
});

describe("hasValue", () => {
  it("returns true for non-empty values", () => {
    expect(hasValue("hello")).toBe(true);
    expect(hasValue(123)).toBe(true);
    expect(hasValue(0)).toBe(true);
  });

  it("returns false for null, undefined, and empty strings", () => {
    expect(hasValue(null)).toBe(false);
    expect(hasValue(undefined)).toBe(false);
    expect(hasValue("")).toBe(false);
    expect(hasValue("   ")).toBe(false);
  });
});

describe("isSoftDeleted", () => {
  it("detects deleted_at field", () => {
    expect(isSoftDeleted({ deleted_at: "2025-01-01" })).toBe(true);
  });

  it("detects deletedAt field", () => {
    expect(isSoftDeleted({ deletedAt: new Date() })).toBe(true);
  });

  it("detects archived_at field", () => {
    expect(isSoftDeleted({ archived_at: "2025-01-01" })).toBe(true);
  });

  it("detects archivedAt field", () => {
    expect(isSoftDeleted({ archivedAt: new Date() })).toBe(true);
  });

  it("detects deleted boolean flag", () => {
    expect(isSoftDeleted({ deleted: true })).toBe(true);
    expect(isSoftDeleted({ is_deleted: "sim" })).toBe(true);
  });

  it("returns false for active records", () => {
    expect(isSoftDeleted({ name: "test" })).toBe(false);
    expect(isSoftDeleted({ deleted: false })).toBe(false);
  });
});

describe("visibleRecords", () => {
  it("filters out soft-deleted records", () => {
    const records: DashboardRecord[] = [
      { _id: "1", name: "Active" },
      { _id: "2", deleted_at: "2025-01-01" },
      { _id: "3", archivedAt: new Date() },
    ];
    const result = visibleRecords(records);
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("1");
  });

  it("keeps all records when none are deleted", () => {
    const records: DashboardRecord[] = [
      { _id: "1", name: "A" },
      { _id: "2", name: "B" },
    ];
    expect(visibleRecords(records)).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(visibleRecords([])).toHaveLength(0);
  });
});

describe("recordText", () => {
  it("returns first matching field value", () => {
    const record = { name: "Rex", displayName: "Rex K9" };
    expect(recordText(record, ["name", "displayName"])).toBe("Rex");
  });

  it("skips empty strings and finds next match", () => {
    const record = { name: "", displayName: "Rex K9" };
    expect(recordText(record, ["name", "displayName"])).toBe("Rex K9");
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

describe("drugEntryGrams", () => {
  it("returns grams for plain numeric entry", () => {
    expect(drugEntryGrams({ quantity: 500 })).toBe(500);
  });

  it("converts kg to grams", () => {
    expect(drugEntryGrams({ quantity: 2, unit: "kg" })).toBe(2000);
  });

  it("detects kg in quantity text", () => {
    expect(drugEntryGrams({ quantity: "1.5kg" })).toBe(1500);
  });

  it("handles quilo unit variant", () => {
    expect(drugEntryGrams({ peso: 3, unidade: "quilograma" })).toBe(3000);
  });

  it("returns 0 for invalid entries", () => {
    expect(drugEntryGrams({})).toBe(0);
    expect(drugEntryGrams({ quantity: "abc" })).toBe(0);
  });
});

describe("formatWeight", () => {
  it("formats grams below 1000", () => {
    expect(formatWeight(500)).toBe("500 g");
    expect(formatWeight(1)).toBe("1 g");
  });

  it("formats kilograms at or above 1000", () => {
    expect(formatWeight(1000)).toBe("1,0 kg");
    expect(formatWeight(2500)).toBe("2,5 kg");
  });

  it("returns placeholder for zero or negative", () => {
    expect(formatWeight(0)).toBe("--");
    expect(formatWeight(-1)).toBe("--");
  });
});

describe("formatPercent", () => {
  it("formats percentage correctly", () => {
    expect(formatPercent(50, 100)).toBe("50,0%");
    expect(formatPercent(1, 3)).toBe("33,3%");
  });

  it("returns placeholder when total is zero", () => {
    expect(formatPercent(5, 0)).toBe("--");
    expect(formatPercent(0, 0)).toBe("--");
  });
});

describe("formatCount", () => {
  it("formats numbers with locale separators", () => {
    expect(formatCount(1000)).toBe("1.000");
    expect(formatCount(42)).toBe("42");
  });
});

describe("drugCategory (classifyDrug)", () => {
  it("classifies maconha/cannabis", () => {
    expect(drugCategory("Maconha")).toBe("maconha");
    expect(drugCategory("cannabis sativa")).toBe("maconha");
  });

  it("classifies cocaina", () => {
    expect(drugCategory("Cocaína")).toBe("cocaina");
    expect(drugCategory("cocaine")).toBe("cocaina");
  });

  it("classifies crack", () => {
    expect(drugCategory("Crack")).toBe("crack");
  });

  it("classifies ecstasy/mdma", () => {
    expect(drugCategory("Ecstasy")).toBe("ecstasy");
    expect(drugCategory("MDMA")).toBe("ecstasy");
    expect(drugCategory("Extasy")).toBe("ecstasy");
  });

  it("returns outros for unknown types", () => {
    expect(drugCategory("LSD")).toBe("outros");
    expect(drugCategory("")).toBe("outros");
    expect(drugCategory(null)).toBe("outros");
  });
});

describe("detectUserProfile", () => {
  it("detects admin from roles", () => {
    expect(detectUserProfile({ roles: ["administrador"] })).toBe("admin");
    expect(detectUserProfile({ roles: ["admin"] })).toBe("admin");
  });

  it("detects admin from claims", () => {
    expect(detectUserProfile({ claims: { admin: true } })).toBe("admin");
  });

  it("detects gestor from management roles", () => {
    expect(detectUserProfile({ roles: ["gestor"] })).toBe("gestor");
    expect(detectUserProfile({ roles: ["comando"] })).toBe("gestor");
    expect(detectUserProfile({ roles: ["coordenador"] })).toBe("gestor");
    expect(detectUserProfile({ roles: ["inspetor"] })).toBe("gestor");
    expect(detectUserProfile({ roles: ["subinspetor"] })).toBe("gestor");
  });

  it("detects instrutor from isK9Instructor flag", () => {
    expect(detectUserProfile({ isK9Instructor: true })).toBe("instrutor");
  });

  it("defaults to operador", () => {
    expect(detectUserProfile({})).toBe("operador");
    expect(detectUserProfile({ roles: [] })).toBe("operador");
  });

  it("prioritizes admin over gestor over instrutor", () => {
    expect(
      detectUserProfile({ roles: ["administrador", "gestor"], isK9Instructor: true }),
    ).toBe("admin");
    expect(
      detectUserProfile({ roles: ["gestor"], isK9Instructor: true }),
    ).toBe("gestor");
  });
});

describe("buildDrugDisplayItems", () => {
  it("returns an empty summary when no grams are present", () => {
    const result = buildDrugDisplayItems({ drugStats: emptyDrugStats });

    expect(result.items).toHaveLength(0);
    expect(result.totalGrams).toBe(0);
    expect(result.categoryCount).toBe(0);
    expect(result.hasOverflow).toBe(false);
    expect(result.overflowCount).toBe(0);
  });

  it("exposes a single category with full percentage", () => {
    const result = buildDrugDisplayItems({
      drugStats: { ...emptyDrugStats, maconha: 250 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("maconha");
    expect(result.items[0]?.name).toBe("Maconha");
    expect(result.items[0]?.percent).toBeCloseTo(100, 5);
    expect(result.totalGrams).toBe(250);
    expect(result.categoryCount).toBe(1);
    expect(result.hasOverflow).toBe(false);
  });

  it("splits percentages across two categories", () => {
    const result = buildDrugDisplayItems({
      drugStats: { ...emptyDrugStats, maconha: 300, cocaina: 700 },
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.id)).toEqual(["cocaina", "maconha"]);
    const maconha = result.items.find((item) => item.id === "maconha");
    const cocaina = result.items.find((item) => item.id === "cocaina");
    expect(maconha?.percent).toBeCloseTo(30, 5);
    expect(cocaina?.percent).toBeCloseTo(70, 5);
    // Percentages must add up to 100% within rounding tolerance.
    const sum = result.items.reduce((acc, item) => acc + item.percent, 0);
    expect(sum).toBeCloseTo(100, 1);
  });

  it("keeps the top three categories visible when more are present", () => {
    const result = buildDrugDisplayItems({
      drugStats: {
        ...emptyDrugStats,
        maconha: 100,
        cocaina: 200,
        crack: 300,
        ecstasy: 400,
        outros: 500,
      },
    });

    expect(result.items).toHaveLength(HUD_PRIMARY_SLOTS + 1);
    expect(result.items[0]?.id).toBe("outros");
    expect(result.items[1]?.id).toBe("ecstasy");
    expect(result.items[2]?.id).toBe("crack");
    expect(result.items[3]?.isAggregate).toBe(true);
    expect(result.items[3]?.name).toBe("+2 categorias");
    expect(result.categoryCount).toBe(5);
    expect(result.hasOverflow).toBe(true);
    expect(result.overflowCount).toBe(2);
    // The aggregate item should sum the grams of the tail categories.
    expect(result.items[3]?.grams).toBe(100 + 200);
  });

  it("keeps percentages consistent when categories overflow", () => {
    const result = buildDrugDisplayItems({
      drugStats: {
        ...emptyDrugStats,
        maconha: 100,
        cocaina: 200,
        crack: 300,
        ecstasy: 400,
      },
    });

    const sum = result.items.reduce((acc, item) => acc + item.percent, 0);
    expect(sum).toBeCloseTo(100, 1);
    expect(result.totalGrams).toBe(1000);
  });

  it("sorts ties by the original category order", () => {
    const result = buildDrugDisplayItems({
      drugStats: {
        ...emptyDrugStats,
        maconha: 100,
        cocaina: 100,
        crack: 100,
        ecstasy: 0,
        outros: 100,
      },
    });

    // With four non-zero categories the helper keeps the first three
    // (resolved by grams tie, then by canonical order) as primary items
    // and aggregates the tail into "+N categorias".
    expect(result.items.map((item) => item.id)).toEqual([
      "maconha",
      "cocaina",
      "crack",
      "aggregate",
    ]);
    expect(result.hasOverflow).toBe(true);
    expect(result.overflowCount).toBe(1);
  });

  it("treats a zero total as zero percent for every item", () => {
    // All categories active but grams are zero — degenerate input that
    // the dashboard cannot really produce, but the helper should be
    // robust against it.
    const result = buildDrugDisplayItems({
      drugStats: {
        maconha: 0,
        cocaina: 0,
        crack: 0,
        ecstasy: 0,
        outros: 0,
      },
    });

    expect(result.items).toHaveLength(0);
    expect(result.totalGrams).toBe(0);
  });

  it("respects the explicit categoryOrder override", () => {
    const result = buildDrugDisplayItems({
      categoryOrder: ["crack", "maconha"],
      drugStats: { ...emptyDrugStats, maconha: 100, crack: 100 },
    });

    // With equal grams the tie-breaker uses the supplied order.
    expect(result.items.map((item) => item.id)).toEqual(["crack", "maconha"]);
  });
});
