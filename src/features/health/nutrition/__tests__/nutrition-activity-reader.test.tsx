import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  compareNutritionActivities,
  compareOrdinal,
  consolidateNutritionActivitySources,
  emptyNutritionActivitySources,
  parseNutritionActivityDocuments,
  parseNutritionActivityTimestamp,
  unsubscribeAllSafely,
  useNutritionActivity,
  type NutritionActivity,
  type NutritionActivitySource,
  type NutritionActivitySourceState,
} from "../hooks/use-nutrition-activity";

vi.mock("@/lib/firebase/client", () => ({ db: {} }));

interface Listener {
  path: string;
  next: (snapshot: {
    docs: Array<{ id: string; data: () => Record<string, unknown> }>;
  }) => void;
  error: (error: unknown) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

const mockListeners: Listener[] = [];

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({ path: segments.join("/") })),
  onSnapshot: vi.fn(
    (
      reference: { path: string },
      next: Listener["next"],
      error: Listener["error"],
    ) => {
      const listener: Listener = {
        path: reference.path,
        next,
        error,
        unsubscribe: vi.fn(),
      };
      mockListeners.push(listener);
      return listener.unsubscribe;
    },
  ),
}));

const at = "2026-07-30T12:00:00.000Z";
const recordedBy = {
  uid: "synthetic-user",
  name: "Operador Sintético",
  internal_role: "handler",
};

function meal(overrides: Record<string, unknown> = {}) {
  return {
    fed_at: at,
    period: "morning",
    offered_grams: 100,
    recorded_by: recordedBy,
    schema_version: 1,
    revision: 1,
    ...overrides,
  };
}

function supplement(overrides: Record<string, unknown> = {}) {
  return {
    administered_at: at,
    supplement_name: "Ômega 3",
    dose: 1,
    unit: "tablet",
    recorded_by: recordedBy,
    schema_version: 1,
    revision: 1,
    ...overrides,
  };
}

function legacy(overrides: Record<string, unknown> = {}) {
  return {
    fed_at: at,
    period: "manha",
    amount_grams: 100,
    fed_by: "Condutor Sintético",
    ...overrides,
  };
}

function parsed(
  source: NutritionActivitySource,
  documents: Array<{ id?: string; data: Record<string, unknown> }>,
  dogId = "dog-a",
): NutritionActivitySourceState {
  const result = parseNutritionActivityDocuments(
    dogId,
    source,
    documents.map((document, index) => ({
      id: document.id ?? `${source}-${index}`,
      data: document.data,
    })),
  );
  return { loaded: true, error: null, ...result };
}

function settled(
  overrides?: Partial<Record<NutritionActivitySource, NutritionActivitySourceState>>,
) {
  return {
    meal_logs: overrides?.meal_logs ?? parsed("meal_logs", []),
    supplement_logs: overrides?.supplement_logs ?? parsed("supplement_logs", []),
    feeding_events: overrides?.feeding_events ?? parsed("feeding_events", []),
  };
}

function emit(listener: Listener, documents: Array<Record<string, unknown>>) {
  listener.next({
    docs: documents.map((data, index) => ({
      id: `doc-${index}`,
      data: () => data,
    })),
  });
}

function emitSettled(
  listeners: Listener[],
  values: {
    meal?: Array<Record<string, unknown>>;
    supplement?: Array<Record<string, unknown>>;
    legacy?: Array<Record<string, unknown>>;
  } = {},
) {
  emit(listeners[0], values.meal ?? []);
  emit(listeners[1], values.supplement ?? []);
  emit(listeners[2], values.legacy ?? []);
}

function seededPermutation<T>(values: T[], seed: number) {
  const result = [...values];
  let state = seed;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

describe("deterministic fail-closed nutrition activity reader", () => {
  beforeEach(() => {
    mockListeners.splice(0);
  });

  it("accepts only a contract-valid canonical MealLog", () => {
    const result = parsed("meal_logs", [{ data: meal() }]);
    expect(result).toMatchObject({ validCount: 1, invalidCount: 0 });
    expect(result.records[0]).toMatchObject({
      source: "meal_logs",
      origin: "canonical",
      responsible: "Operador Sintético",
    });
  });

  it.each([
    ["timestamp", { fed_at: undefined }],
    ["period", { period: undefined }],
    ["offered", { offered_grams: 0 }],
    ["recorded_by", { recorded_by: undefined }],
    ["schema", { schema_version: 0 }],
    ["revision", { revision: 0 }],
    ["planned linkage", { plan_id: "p", planned_meal_id: "s" }],
    ["provenance pair", { legacy_source: "feeding_events" }],
  ])("rejects a MealLog with invalid %s", (_name, override) => {
    expect(parsed("meal_logs", [{ data: meal(override) }])).toMatchObject({
      validCount: 0,
      invalidCount: 1,
    });
  });

  it("accepts a contract-valid SupplementLog and rejects invalid units", () => {
    expect(parsed("supplement_logs", [{ data: supplement({ dose: "1,5" }) }]))
      .toMatchObject({ validCount: 1, invalidCount: 0 });
    expect(parsed("supplement_logs", [{ data: supplement({ unit: "capsule" }) }]))
      .toMatchObject({ validCount: 0, invalidCount: 1 });
  });

  it("normalizes documented legacy aliases and supported numeric strings", () => {
    const result = parsed("feeding_events", [
      { data: legacy({ period: "almoco", amount_grams: "350,5" }) },
    ]);
    expect(result).toMatchObject({ validCount: 1, invalidCount: 0 });
    expect(result.records[0]).toMatchObject({
      title: "Refeição · afternoon",
      detail: "350.5 g oferecidos",
      responsible: "Condutor Sintético",
    });
  });

  it("ignores a valid soft-deleted FeedingEvent and rejects malformed deleted_at", () => {
    expect(
      parsed("feeding_events", [{ data: legacy({ deleted_at: at }) }]),
    ).toMatchObject({ validCount: 0, invalidCount: 0, records: [] });
    expect(
      parsed("feeding_events", [{ data: legacy({ deleted_at: "sem-timezone" }) }]),
    ).toMatchObject({ validCount: 0, invalidCount: 1 });
  });

  it("deduplicates only an explicit namespaced provenance link", () => {
    const state = consolidateNutritionActivitySources(
      settled({
        meal_logs: parsed("meal_logs", [
          {
            data: meal({
              legacy_source: " FEEDING_EVENTS ",
              legacy_id: "legacy-exact",
            }),
          },
        ]),
        feeding_events: parsed("feeding_events", [
          { id: "legacy-exact", data: legacy() },
        ]),
      }),
    );
    expect(state.records).toHaveLength(1);
    expect(state.records[0].source).toBe("meal_logs");
  });

  it("does not deduplicate an explicit legacy ID belonging to another dog", () => {
    const canonical = parsed(
      "meal_logs",
      [{ data: meal({ legacy_source: "feeding_events", legacy_id: "same-id" }) }],
      "dog-a",
    );
    const otherDogLegacy = parsed(
      "feeding_events",
      [{ id: "same-id", data: legacy() }],
      "dog-b",
    );
    const state = consolidateNutritionActivitySources(
      settled({ meal_logs: canonical, feeding_events: otherDogLegacy }),
    );
    expect(state.records).toHaveLength(2);
  });

  it("preserves equal fingerprints without provenance and marks possible duplicate", () => {
    const state = consolidateNutritionActivitySources(
      settled({
        meal_logs: parsed("meal_logs", [{ data: meal() }]),
        feeding_events: parsed("feeding_events", [{ data: legacy() }]),
      }),
    );
    expect(state.records).toHaveLength(2);
    expect(state.status).toBe("degraded");
    expect(state.issues).toContainEqual({
      kind: "possible-cross-source-duplicate",
      source: "feeding_events",
      count: 1,
    });
  });

  it("never uses operation, receipt, source or create-operation references for dedupe", () => {
    const state = consolidateNutritionActivitySources(
      settled({
        meal_logs: parsed("meal_logs", [
          { data: meal({ create_operation_id: "shared", operation_id: "shared" }) },
        ]),
        feeding_events: parsed("feeding_events", [
          { data: legacy({ receipt_id: "shared", source_reference: "shared" }) },
        ]),
      }),
    );
    expect(state.records).toHaveLength(2);
    expect(state.records.flatMap((record) => record.diagnosticReferences)).toEqual(
      expect.arrayContaining([
        "create-operation:shared",
        "operation:shared",
        "receipt:shared",
        "source:shared",
      ]),
    );
  });

  it("preserves close but distinct canonical and legacy meals", () => {
    const state = consolidateNutritionActivitySources(
      settled({
        meal_logs: parsed("meal_logs", [{ data: meal() }]),
        feeding_events: parsed("feeding_events", [
          { data: legacy({ fed_at: "2026-07-30T12:00:00.001Z" }) },
        ]),
      }),
    );
    expect(state.records).toHaveLength(2);
    expect(state.status).toBe("ready");
  });

  it("preserves canonical conflicts without summing or selecting a document", () => {
    const state = consolidateNutritionActivitySources(
      settled({
        meal_logs: parsed("meal_logs", [
          {
            id: "canonical-a",
            data: meal({
              plan_id: "p",
              planned_meal_id: "slot",
              meal_occurrence_id: "occ-1",
            }),
          },
          {
            id: "canonical-b",
            data: meal({
              plan_id: "p",
              planned_meal_id: "slot",
              meal_occurrence_id: "occ-1",
            }),
          },
        ]),
      }),
    );
    expect(state.status).toBe("degraded");
    expect(state.records.map((record) => record.documentId)).toEqual([
      "canonical-a",
      "canonical-b",
    ]);
    expect(state.issues).toContainEqual({
      kind: "canonical-conflict",
      source: "meal_logs",
      count: 1,
    });
  });

  it("parses supported timestamps without locale-dependent fallback", () => {
    expect(parseNutritionActivityTimestamp(new Date(at))?.toISOString()).toBe(at);
    expect(parseNutritionActivityTimestamp(at)?.toISOString()).toBe(at);
    expect(
      parseNutritionActivityTimestamp("2026-07-30T09:00:00.000-03:00")?.toISOString(),
    ).toBe(at);
    expect(parseNutritionActivityTimestamp(Date.parse(at))?.toISOString()).toBe(at);
    expect(
      parseNutritionActivityTimestamp({ seconds: 1785412800, nanoseconds: 0 })
        ?.toISOString(),
    ).toBe(at);
  });

  it.each([
    ["extreme seconds", { seconds: Number.MAX_SAFE_INTEGER, nanoseconds: 0 }],
    ["invalid nanos", { seconds: 1, nanoseconds: 1_000_000_000 }],
    ["throwing toDate", { toDate: () => { throw new Error("synthetic"); } }],
    ["Invalid Date", new Date(Number.NaN)],
    ["invalid ISO", "not-a-date"],
    ["timezone-less ISO", "2026-07-30T12:00:00"],
    ["epoch out of range", Number.MAX_VALUE],
  ])("rejects %s without throwing", (_name, value) => {
    expect(() => parseNutritionActivityTimestamp(value)).not.toThrow();
    expect(parseNutritionActivityTimestamp(value)).toBeNull();
  });

  it("counts contract-invalid documents and never converts them to ready", () => {
    const state = consolidateNutritionActivitySources(
      settled({
        meal_logs: parsed("meal_logs", [
          { data: meal() },
          { data: { fed_at: at, offered_grams: 100 } },
        ]),
      }),
    );
    expect(state.status).toBe("degraded");
    expect(state.records).toHaveLength(1);
    expect(state.sources.meal_logs.invalidCount).toBe(1);
  });

  it("returns degraded, never empty, when every document is invalid", () => {
    const state = consolidateNutritionActivitySources(
      settled({
        meal_logs: parsed("meal_logs", [{ data: { fed_at: "invalid" } }]),
        supplement_logs: parsed("supplement_logs", [{ data: supplement({ dose: 0 }) }]),
        feeding_events: parsed("feeding_events", [{ data: legacy({ amount_grams: 0 }) }]),
      }),
    );
    expect(state.status).toBe("degraded");
    expect(state.records).toHaveLength(0);
  });

  it("returns true empty only after three clean empty sources", () => {
    expect(consolidateNutritionActivitySources(settled()).status).toBe("empty");
  });

  it("returns error when every source fails without exposing payload details", () => {
    const sources = settled();
    for (const source of Object.keys(sources) as NutritionActivitySource[]) {
      sources[source] = { ...sources[source], error: "permission-denied" };
    }
    const state = consolidateNutritionActivitySources(sources);
    expect(state.status).toBe("error");
    expect(state.error).not.toContain("doc-");
  });

  it("uses ordinal comparison for ASCII, accents, case and Unicode", () => {
    const values = ["a", "A", "á", "ä", "中", "🙂"];
    for (const left of values) {
      for (const right of values) {
        expect(compareOrdinal(left, right)).toBe(
          left === right ? 0 : left < right ? -1 : 1,
        );
        if (left === right) {
          expect(compareOrdinal(left, right)).toBe(0);
        } else {
          expect(compareOrdinal(left, right)).toBe(
            -compareOrdinal(right, left),
          );
        }
      }
    }
  });

  it("produces byte-identical order for 12 seeded permutations", () => {
    const baseDocuments = ["a", "A", "á", "中", "🙂"].map((id, index) => ({
      id,
      data: meal({ offered_grams: 100 + index }),
    }));
    const expected = consolidateNutritionActivitySources(
      settled({ meal_logs: parsed("meal_logs", baseDocuments) }),
    ).records.map((record) => record.id);

    for (let seed = 1; seed <= 12; seed += 1) {
      const result = consolidateNutritionActivitySources(
        settled({
          meal_logs: parsed(
            "meal_logs",
            seededPermutation(baseDocuments, seed),
          ),
        }),
      );
      expect(result.records.map((record) => record.id)).toEqual(expected);
      for (let index = 0; index < result.records.length - 2; index += 1) {
        const [a, b, c] = result.records.slice(index, index + 3);
        expect(compareNutritionActivities(a, b)).toBeLessThan(0);
        expect(compareNutritionActivities(b, c)).toBeLessThan(0);
        expect(compareNutritionActivities(a, c)).toBeLessThan(0);
      }
    }
  });

  it("recovers only through a new explicit subscription cycle", () => {
    const { result } = renderHook(() => useNutritionActivity("dog-a"));
    const firstCycle = mockListeners.slice(0, 3);
    act(() => emitSettled(firstCycle, { meal: [meal()] }));
    expect(result.current.status).toBe("ready");

    act(() => firstCycle[2].error({ code: "unavailable", message: "secret doc-77" }));
    expect(result.current.status).toBe("degraded");
    expect(mockListeners).toHaveLength(3);

    act(() => result.current.retry());
    const secondCycle = mockListeners.slice(3, 6);
    expect(firstCycle.every((listener) => listener.unsubscribe.mock.calls.length === 1))
      .toBe(true);
    act(() => emitSettled(secondCycle, { legacy: [legacy({ amount_grams: 75 })] }));
    expect(result.current.status).toBe("ready");
    expect(result.current.records).toHaveLength(1);
  });

  it("does not automatically retry permission-denied", () => {
    renderHook(() => useNutritionActivity("dog-a"));
    act(() => {
      mockListeners[0].error({ code: "permission-denied" });
      emit(mockListeners[1], []);
      emit(mockListeners[2], []);
    });
    expect(mockListeners).toHaveLength(3);
  });

  it("defensively attempts every unsubscribe even when the first throws", () => {
    const first = vi.fn(() => {
      throw new Error("synthetic cleanup");
    });
    const second = vi.fn();
    const third = vi.fn();
    expect(() => unsubscribeAllSafely([first, second, third])).not.toThrow();
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(third).toHaveBeenCalledOnce();
    expect(() => unsubscribeAllSafely([first, second, third])).not.toThrow();
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("ignores callbacks across a rapid A to B to A switch", () => {
    const { result, rerender } = renderHook(
      ({ dogId }) => useNutritionActivity(dogId),
      { initialProps: { dogId: "dog-a" } },
    );
    const firstA = mockListeners.slice(0, 3);
    rerender({ dogId: "dog-b" });
    const dogB = mockListeners.slice(3, 6);
    rerender({ dogId: "dog-a" });
    const secondA = mockListeners.slice(6, 9);

    act(() => {
      emitSettled(secondA, { meal: [meal({ offered_grams: 80 })] });
      emit(firstA[0], [meal({ offered_grams: 999 })]);
      dogB[1].error({ code: "permission-denied" });
    });
    expect(result.current.status).toBe("ready");
    expect(result.current.records[0].detail).toContain("80");
  });

  it("ignores callbacks after unmount and still attempts all cleanups", () => {
    const { unmount } = renderHook(() => useNutritionActivity("dog-a"));
    const listeners = mockListeners.slice(0, 3);
    listeners[0].unsubscribe.mockImplementation(() => {
      throw new Error("synthetic cleanup");
    });
    expect(() => unmount()).not.toThrow();
    expect(listeners.every((listener) => listener.unsubscribe.mock.calls.length === 1))
      .toBe(true);
    expect(() => {
      emit(listeners[0], [meal()]);
      listeners[1].error({ code: "unavailable" });
    }).not.toThrow();
  });

  it("remains loading until every source has loaded or failed", () => {
    const sources = emptyNutritionActivitySources();
    sources.meal_logs = parsed("meal_logs", [{ data: meal() }]);
    expect(consolidateNutritionActivitySources(sources).status).toBe("loading");
  });
});

// Compile-time fixture: all fields used by the comparator remain explicit.
const _activityShape: NutritionActivity | null = null;
void _activityShape;
