// @vitest-environment node
/**
 * HW-4.WEB-SCHED-RD-I1 — Schedule strict parser.
 *
 * Contract under test: HEALTH_V1_FIRESTORE_SCHEMA.md §2.14, frozen by
 * FRONT20-SCHED-CONTRACT-R2 @ b3838cd.
 *
 * No Firestore, no network, no wall-clock dependence: every fixture supplies its
 * own timestamps, so results are reproducible at any execution time.
 *
 * Temporal derivation is NOT tested here because it is NOT implemented in this
 * slice (RD-I2 owns it). The final block asserts that absence.
 */
import { describe, expect, it } from "vitest";
import {
  isValidIanaTimezone,
  parseScheduleItemWireDoc,
  parseScheduleTimestamp,
} from "../parser";
import {
  SCHEDULE_LIFECYCLE_STATUSES,
  SCHEDULE_SOURCE_TYPES,
  SCHEDULE_TYPES,
} from "../types";

const DOG_ID = "dog-alpha";
const SCHEDULE_ID = "sched-001";
const TZ = "America/Sao_Paulo";

/** Minimal Firestore Timestamp stand-in exposing the canonical `toMillis()`. */
function ts(iso: string) {
  const millis = new Date(iso).getTime();
  return { toMillis: () => millis };
}

/** A fully canonical document: every required field present and well-formed. */
function canonicalWire(overrides: Record<string, unknown> = {}) {
  return {
    dog_id: DOG_ID,
    schedule_type: "vaccination",
    title: "Reforço V10",
    scheduled_for: ts("2026-09-10T13:00:00Z"),
    timezone: TZ,
    lifecycle_status: "open",
    source_type: "preventive",
    created_at: ts("2026-08-20T10:00:00Z"),
    recorded_by: { uid: "uid-1", name: "Cond. Silva", internal_role: "condutor" },
    revision: 1,
    schema_version: 1,
    ...overrides,
  };
}

function parse(overrides: Record<string, unknown> = {}) {
  return parseScheduleItemWireDoc(canonicalWire(overrides), SCHEDULE_ID, DOG_ID);
}

function codes(model: { issues: { code: string }[] }): string[] {
  return model.issues.map((i) => i.code);
}

describe("canonical document", () => {
  it("parses a complete canonical item with no issues", () => {
    const model = parse();

    expect(model.dataQuality).toBe("complete");
    expect(model.issues).toEqual([]);
    expect(model.dogId).toBe(DOG_ID);
    expect(model.scheduleId).toBe(SCHEDULE_ID);
    expect(model.persistedDogId).toBe(DOG_ID);
    expect(model.scheduleType).toBe("vaccination");
    expect(model.title).toBe("Reforço V10");
    expect(model.lifecycleStatus).toBe("open");
    expect(model.sourceType).toBe("preventive");
    expect(model.timezone).toBe(TZ);
    expect(model.revision).toBe(1);
    expect(model.revisionSource).toBe("canonical");
    expect(model.schemaVersion).toBe(1);
    expect(model.recordedBy).toEqual({
      uid: "uid-1",
      name: "Cond. Silva",
      internalRole: "condutor",
    });
    expect(model.scheduledFor?.toISOString()).toBe("2026-09-10T13:00:00.000Z");
    expect(model.createdAt?.toISOString()).toBe("2026-08-20T10:00:00.000Z");
  });

  it("leaves documented-optional fields null without any issue", () => {
    const model = parse();

    expect(model.dueUntil).toBeNull();
    expect(model.sourceId).toBeNull();
    expect(model.caseId).toBeNull();
    expect(model.completedAt).toBeNull();
    expect(model.completedBy).toBeNull();
    expect(model.cancelledAt).toBeNull();
    expect(model.cancelledBy).toBeNull();
    expect(model.cancelReason).toBeNull();
    expect(model.notes).toBeNull();
    expect(model.migrationBatchId).toBeNull();
    expect(model.dataQuality).toBe("complete");
  });

  it("parses documented-optional fields when present", () => {
    const model = parse({
      due_until: ts("2026-09-11T13:00:00Z"),
      source_id: "proto-9",
      case_id: "case-3",
      notes: "levar carteira",
      migration_batch_id: "batch-7",
    });

    expect(model.dueUntil?.toISOString()).toBe("2026-09-11T13:00:00.000Z");
    expect(model.sourceId).toBe("proto-9");
    expect(model.caseId).toBe("case-3");
    expect(model.notes).toBe("levar carteira");
    expect(model.migrationBatchId).toBe("batch-7");
    expect(model.dataQuality).toBe("complete");
  });

  it("returns a partial all-null model for a non-object document", () => {
    for (const bad of [null, undefined, "str", 42, []]) {
      const model = parseScheduleItemWireDoc(
        bad as unknown as Record<string, unknown>,
        SCHEDULE_ID,
        DOG_ID
      );
      expect(model.dataQuality).toBe("partial");
      expect(codes(model)).toEqual(["malformed_document"]);
      expect(model.dogId).toBe(DOG_ID);
      expect(model.scheduleId).toBe(SCHEDULE_ID);
      expect(model.persistedDogId).toBeNull();
      expect(model.revisionSource).toBe("unavailable");
    }
  });
});

describe("schedule_type", () => {
  it.each(SCHEDULE_TYPES)("accepts canonical type %s", (type) => {
    const model = parse({ schedule_type: type });
    expect(model.scheduleType).toBe(type);
    expect(model.dataQuality).toBe("complete");
  });

  it("covers exactly nine canonical types", () => {
    expect(SCHEDULE_TYPES).toHaveLength(9);
  });

  it("does NOT normalize an unknown type and preserves the raw value", () => {
    const model = parse({ schedule_type: "grooming" });

    expect(model.scheduleType).toBeNull();
    expect(model.rawScheduleType).toBe("grooming");
    expect(model.dataQuality).toBe("partial");
    expect(codes(model)).toContain("unrecognized_schedule_type");
    // Sibling data survives.
    expect(model.title).toBe("Reforço V10");
  });

  it("flags a missing or malformed type distinctly", () => {
    expect(codes(parse({ schedule_type: undefined }))).toContain("missing_required_field");
    expect(codes(parse({ schedule_type: 7 }))).toContain("malformed_field");
  });
});

describe("source_type", () => {
  it.each(SCHEDULE_SOURCE_TYPES)("accepts canonical source %s", (source) => {
    const model = parse({ source_type: source });
    expect(model.sourceType).toBe(source);
    expect(model.dataQuality).toBe("complete");
  });

  it("covers exactly five canonical sources", () => {
    expect(SCHEDULE_SOURCE_TYPES).toHaveLength(5);
  });

  it("NEVER normalizes an unknown source_type to manual", () => {
    const model = parse({ source_type: "imported_legacy" });

    expect(model.sourceType).not.toBe("manual");
    expect(model.sourceType).toBeNull();
    expect(model.rawSourceType).toBe("imported_legacy");
    expect(codes(model)).toContain("unrecognized_source_type");
  });
});

describe("title", () => {
  it("accepts and trims a valid title", () => {
    expect(parse({ title: "  Banho mensal  " }).title).toBe("Banho mensal");
  });

  it("never fabricates a title when absent", () => {
    const model = parse({ title: undefined });

    expect(model.title).toBeNull();
    expect(model.dataQuality).toBe("partial");
    expect(codes(model)).toContain("missing_title");
    // No placeholder, and never the schedule_type as a stand-in.
    expect(model.title).not.toBe("Item sem título");
    expect(model.title).not.toBe("vaccination");
  });

  it("treats an empty or wrong-typed title as a defect", () => {
    expect(codes(parse({ title: "   " }))).toContain("malformed_field");
    expect(codes(parse({ title: 99 }))).toContain("malformed_field");
    expect(parse({ title: 99 }).title).toBeNull();
  });
});

describe("dog_id", () => {
  it("accepts a persisted dog_id matching the structural path", () => {
    const model = parse();
    expect(model.persistedDogId).toBe(DOG_ID);
    expect(model.dataQuality).toBe("complete");
  });

  it("classifies an absent dog_id as legacy and preserves the item", () => {
    const model = parse({ dog_id: undefined });

    expect(model.persistedDogId).toBeNull();
    expect(model.dogId).toBe(DOG_ID);
    expect(model.dataQuality).toBe("legacy");
    expect(codes(model)).toContain("legacy_missing_dog_id");
    expect(model.title).toBe("Reforço V10");
  });

  it("never back-fills persistedDogId from the structural path", () => {
    expect(parse({ dog_id: undefined }).persistedDogId).toBeNull();
  });

  it("surfaces a path mismatch as an integrity defect", () => {
    const model = parse({ dog_id: "dog-beta" });

    expect(model.persistedDogId).toBe("dog-beta");
    expect(model.dogId).toBe(DOG_ID);
    expect(model.dataQuality).toBe("partial");
    expect(codes(model)).toContain("dog_id_path_mismatch");
  });

  it("flags an empty or wrong-typed dog_id as malformed", () => {
    expect(codes(parse({ dog_id: "   " }))).toContain("dog_id_malformed");
    expect(codes(parse({ dog_id: 12 }))).toContain("dog_id_malformed");
  });
});

describe("lifecycle_status", () => {
  it.each(SCHEDULE_LIFECYCLE_STATUSES)("accepts persisted lifecycle %s", (status) => {
    const model = parse({ lifecycle_status: status });
    expect(model.lifecycleStatus).toBe(status);
    expect(model.dataQuality).toBe("complete");
  });

  it("persists exactly three lifecycle values", () => {
    expect(SCHEDULE_LIFECYCLE_STATUSES).toHaveLength(3);
  });

  it.each(["scheduled", "pending", "overdue", "today", "upcoming"])(
    "rejects derived temporal value %s as a persisted lifecycle",
    (temporal) => {
      const model = parse({ lifecycle_status: temporal });

      expect(model.lifecycleStatus).toBeNull();
      expect(model.rawLifecycleStatus).toBe(temporal);
      expect(model.dataQuality).toBe("partial");
      expect(codes(model)).toContain("unrecognized_lifecycle_status");
    }
  );

  it("flags a missing or malformed lifecycle_status", () => {
    expect(codes(parse({ lifecycle_status: undefined }))).toContain("missing_required_field");
    expect(codes(parse({ lifecycle_status: 1 }))).toContain("malformed_field");
  });
});

describe("legacy temporal `status` field", () => {
  it("ignores a legacy temporal status as authority and reports it", () => {
    const model = parse({ lifecycle_status: "open", status: "overdue" });

    // Canonical authority is untouched by the legacy field.
    expect(model.lifecycleStatus).toBe("open");
    expect(codes(model)).toContain("legacy_temporal_field_present");
    expect(model.dataQuality).toBe("legacy");
  });

  it("does not let a legacy status contradict a completed lifecycle", () => {
    const model = parse({ lifecycle_status: "completed", status: "pending" });
    expect(model.lifecycleStatus).toBe("completed");
  });

  it("treats a non-temporal `status` value as a defect", () => {
    const model = parse({ status: "whatever" });
    expect(model.dataQuality).toBe("partial");
    expect(codes(model)).toContain("legacy_temporal_field_present");
  });
});

describe("revision", () => {
  it("accepts a canonical numeric revision", () => {
    const model = parse({ revision: 4 });
    expect(model.revision).toBe(4);
    expect(model.revisionSource).toBe("canonical");
    expect(model.dataQuality).toBe("complete");
  });

  it("interprets an absent revision as legacy semantic 0 — never 1", () => {
    const model = parse({ revision: undefined });

    expect(model.revision).toBe(0);
    expect(model.revision).not.toBe(1);
    expect(model.revisionSource).toBe("legacy_absent");
    expect(model.dataQuality).toBe("legacy");
  });

  it("keeps a persisted 0 distinguishable from legacy absence", () => {
    const persistedZero = parse({ revision: 0 });
    expect(persistedZero.revision).toBe(0);
    expect(persistedZero.revisionSource).toBe("canonical");

    const legacyAbsent = parse({ revision: undefined });
    expect(legacyAbsent.revision).toBe(0);
    expect(legacyAbsent.revisionSource).toBe("legacy_absent");
  });

  it("flags a malformed present revision", () => {
    for (const bad of ["1", Number.NaN, {}]) {
      const model = parse({ revision: bad });
      expect(model.dataQuality).toBe("partial");
      expect(codes(model)).toContain("revision_malformed");
      expect(model.revision).toBeNull();
    }
  });

  // RD-I1.A1 / C1 — a monotonic counter cannot be negative or fractional, so a
  // bare finite-number check is insufficient: those values were previously
  // accepted as fully canonical.
  it.each([
    ["negative", -1],
    ["fractional", 1.5],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ])("rejects a %s revision as outside the valid domain", (_label, value) => {
    const model = parse({ revision: value });

    expect(model.revision).toBeNull();
    expect(model.revisionSource).toBe("unavailable");
    expect(model.dataQuality).toBe("partial");
    expect(codes(model)).toContain("revision_malformed");
  });

  it("still accepts a large valid integer revision", () => {
    const model = parse({ revision: 128 });
    expect(model.revision).toBe(128);
    expect(model.revisionSource).toBe("canonical");
    expect(model.dataQuality).toBe("complete");
  });
});

describe("schema_version", () => {
  it("accepts numeric 1 as canonical", () => {
    const model = parse({ schema_version: 1 });
    expect(model.schemaVersion).toBe(1);
    expect(model.dataQuality).toBe("complete");
  });

  it.each(["1", "1.0"])("rejects the string %s as equivalent to numeric 1", (raw) => {
    const model = parse({ schema_version: raw });

    expect(model.schemaVersion).toBeNull();
    expect(model.dataQuality).toBe("partial");
    expect(codes(model)).toContain("schema_version_invalid");
  });

  it("flags a missing or wrong-typed schema_version", () => {
    expect(codes(parse({ schema_version: undefined }))).toContain("schema_version_invalid");
    expect(codes(parse({ schema_version: {} }))).toContain("schema_version_invalid");
  });

  it("classifies a lower numeric version as legacy", () => {
    const model = parse({ schema_version: 0 });
    expect(model.schemaVersion).toBe(0);
    expect(model.dataQuality).toBe("legacy");
  });

  it("classifies a higher numeric version as degraded", () => {
    const model = parse({ schema_version: 2 });
    expect(model.schemaVersion).toBe(2);
    expect(model.dataQuality).toBe("degraded");
  });

  it("ranks a real defect above a degraded future version", () => {
    const model = parse({ schema_version: 2, title: undefined });
    expect(model.dataQuality).toBe("partial");
  });

  // RD-I1.A1 / C1 — malformed numerics must never acquire legitimate version
  // semantics: `-2` is not "an older schema" and `1.5` is not "a future schema".
  it.each([
    ["negative", -2],
    ["fractional below current", 0.5],
    ["fractional above current", 1.5],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ])("rejects a %s schema_version instead of classifying it", (_label, value) => {
    const model = parse({ schema_version: value });

    expect(model.schemaVersion).toBeNull();
    expect(model.dataQuality).toBe("partial");
    expect(codes(model)).toContain("schema_version_invalid");
  });

  it("keeps the legacy/current/future classification for valid integers", () => {
    expect(parse({ schema_version: 0 }).dataQuality).toBe("legacy");
    expect(parse({ schema_version: 1 }).dataQuality).toBe("complete");
    expect(parse({ schema_version: 2 }).dataQuality).toBe("degraded");
  });
});

describe("recorded_by", () => {
  it("maps a complete actor onto the shared read model shape", () => {
    const model = parse();
    expect(model.recordedBy).toEqual({
      uid: "uid-1",
      name: "Cond. Silva",
      internalRole: "condutor",
    });
    expect(model.dataQuality).toBe("complete");
  });

  it("preserves a partial actor instead of discarding it", () => {
    const model = parse({ recorded_by: { uid: "uid-2" } });

    expect(model.recordedBy).toEqual({ uid: "uid-2", name: null, internalRole: null });
    expect(model.dataQuality).toBe("partial");
    expect(codes(model)).toContain("recorded_by_incomplete");
  });

  it("treats an all-empty actor map as incomplete with no invented fields", () => {
    const model = parse({ recorded_by: {} });

    expect(model.recordedBy).toBeNull();
    expect(codes(model)).toContain("recorded_by_incomplete");
  });

  it('rejects the literal string "system" as a current canonical actor', () => {
    const model = parse({ recorded_by: "system" });

    expect(model.recordedBy).toBeNull();
    expect(model.dataQuality).toBe("partial");
    expect(codes(model)).toContain("recorded_by_not_map");
  });

  it("flags an absent required actor", () => {
    expect(codes(parse({ recorded_by: undefined }))).toContain("missing_required_field");
  });

  it("applies the same actor semantics to completed_by / cancelled_by", () => {
    const complete = parse({
      lifecycle_status: "completed",
      completed_at: ts("2026-09-10T14:00:00Z"),
      completed_by: { uid: "uid-9", name: "Vet", internal_role: "admin" },
    });
    expect(complete.completedBy).toEqual({
      uid: "uid-9",
      name: "Vet",
      internalRole: "admin",
    });
    expect(complete.dataQuality).toBe("complete");

    expect(codes(parse({ cancelled_by: "system" }))).toContain("recorded_by_not_map");
  });
});

describe("strict Firestore timestamp — accepted shapes", () => {
  const expected = "2026-09-10T13:00:00.000Z";
  const millis = new Date(expected).getTime();

  it("accepts callable toMillis()", () => {
    expect(parseScheduleTimestamp({ toMillis: () => millis })?.toISOString()).toBe(expected);
  });

  it("accepts callable toDate()", () => {
    expect(
      parseScheduleTimestamp({ toDate: () => new Date(millis) })?.toISOString()
    ).toBe(expected);
  });

  it("accepts seconds + nanoseconds", () => {
    expect(
      parseScheduleTimestamp({ seconds: millis / 1000, nanoseconds: 0 })?.toISOString()
    ).toBe(expected);
  });

  it("accepts _seconds + _nanoseconds (serialized form)", () => {
    expect(
      parseScheduleTimestamp({ _seconds: millis / 1000, _nanoseconds: 0 })?.toISOString()
    ).toBe(expected);
  });

  it("accepts seconds without a nanoseconds field", () => {
    expect(parseScheduleTimestamp({ seconds: millis / 1000 })?.toISOString()).toBe(expected);
  });

  it("accepts the inclusive nanoseconds boundaries", () => {
    const seconds = millis / 1000;
    expect(parseScheduleTimestamp({ seconds, nanoseconds: 0 })?.toISOString()).toBe(expected);
    expect(
      parseScheduleTimestamp({ seconds, nanoseconds: 999_999_999 })?.toISOString()
    ).toBe("2026-09-10T13:00:00.999Z");
    expect(
      parseScheduleTimestamp({ _seconds: seconds, _nanoseconds: 999_999_999 })?.toISOString()
    ).toBe("2026-09-10T13:00:00.999Z");
  });
});

/**
 * RD-I1.A1 / C1 — structural domain of the seconds-based representation.
 *
 * A real Firestore Timestamp guarantees an integer `seconds` and
 * `0 <= nanoseconds <= 999_999_999`. Before C1 these inputs were accepted, and
 * out-of-range nanoseconds silently SHIFTED the instant (5e9 ns => +5 s) while
 * reporting a successful parse — the most dangerous shape of the defect, since
 * RD-I2 derives deadlines directly from `scheduledFor`.
 */
describe("strict Firestore timestamp — structural seconds/nanoseconds domain", () => {
  const S = new Date("2026-09-10T13:00:00.000Z").getTime() / 1000;

  it.each([
    ["fractional seconds", { seconds: S + 0.5 }],
    ["fractional nanoseconds", { seconds: S, nanoseconds: 1.7 }],
    ["negative nanoseconds", { seconds: S, nanoseconds: -1 }],
    ["nanoseconds at 1e9", { seconds: S, nanoseconds: 1_000_000_000 }],
    ["nanoseconds far out of range", { seconds: S, nanoseconds: 5_000_000_000 }],
    ["fractional _seconds", { _seconds: S + 0.25 }],
    ["negative _nanoseconds", { _seconds: S, _nanoseconds: -1 }],
    ["_nanoseconds out of range", { _seconds: S, _nanoseconds: 2_000_000_000 }],
    ["non-integer nanoseconds type", { seconds: S, nanoseconds: "0" }],
  ])("rejects %s", (_label, value) => {
    expect(parseScheduleTimestamp(value)).toBeNull();
  });

  it("never carries out-of-range nanoseconds into seconds", () => {
    // The pre-C1 behavior returned 2026-09-10T13:00:05.000Z here.
    expect(parseScheduleTimestamp({ seconds: S, nanoseconds: 5_000_000_000 })).toBeNull();
    expect(parseScheduleTimestamp({ _seconds: S, _nanoseconds: 2_000_000_000 })).toBeNull();
  });

  it("surfaces a structurally impossible required timestamp as a defect", () => {
    const model = parse({ scheduled_for: { seconds: S, nanoseconds: 5_000_000_000 } });

    expect(model.scheduledFor).toBeNull();
    expect(model.dataQuality).toBe("partial");
    expect(codes(model)).toContain("timestamp_not_firestore_shape");
  });
});

describe("strict Firestore timestamp — rejected shapes", () => {
  it("rejects an ISO string", () => {
    expect(parseScheduleTimestamp("2026-09-10T13:00:00Z")).toBeNull();
  });

  it("rejects an epoch number", () => {
    expect(parseScheduleTimestamp(1789045200000)).toBeNull();
  });

  it("rejects a bare JS Date", () => {
    expect(parseScheduleTimestamp(new Date("2026-09-10T13:00:00Z"))).toBeNull();
  });

  it("rejects null, undefined and non-timestamp objects", () => {
    expect(parseScheduleTimestamp(null)).toBeNull();
    expect(parseScheduleTimestamp(undefined)).toBeNull();
    expect(parseScheduleTimestamp({})).toBeNull();
    expect(parseScheduleTimestamp({ seconds: "1789045200" })).toBeNull();
  });

  it("rejects non-finite extractions instead of substituting a value", () => {
    expect(parseScheduleTimestamp({ toMillis: () => Number.NaN })).toBeNull();
    expect(parseScheduleTimestamp({ seconds: Number.NaN })).toBeNull();
    expect(parseScheduleTimestamp({ toDate: () => new Date("nope") })).toBeNull();
  });

  it("returns null when a timestamp accessor throws", () => {
    expect(
      parseScheduleTimestamp({
        toMillis: () => {
          throw new Error("boom");
        },
      })
    ).toBeNull();
  });

  it("never substitutes the current time for an unparseable value", () => {
    const before = Date.now();
    const model = parse({ scheduled_for: "2026-09-10T13:00:00Z" });
    const after = Date.now();

    // A `new Date()` fallback would land inside [before, after]; null cannot.
    expect(model.scheduledFor).toBeNull();
    expect(model.scheduledFor).not.toBeInstanceOf(Date);
    expect(after - before).toBeGreaterThanOrEqual(0);
    expect(codes(model)).toContain("timestamp_not_firestore_shape");
  });

  it("flags a required timestamp as missing versus malformed distinctly", () => {
    expect(codes(parse({ created_at: undefined }))).toContain("missing_required_field");
    expect(codes(parse({ created_at: 123 }))).toContain("timestamp_not_firestore_shape");
  });
});

describe("optional timestamps", () => {
  it("accepts absence of due_until without any issue", () => {
    const model = parse({ due_until: undefined });
    expect(model.dueUntil).toBeNull();
    expect(model.dataQuality).toBe("complete");
    expect(model.issues).toEqual([]);
  });

  it("flags a malformed present due_until while keeping the item", () => {
    const model = parse({ due_until: "2026-09-11" });

    expect(model.dueUntil).toBeNull();
    expect(model.dataQuality).toBe("partial");
    expect(codes(model)).toContain("timestamp_not_firestore_shape");
    expect(model.title).toBe("Reforço V10");
  });

  it("flags malformed completed_at / cancelled_at", () => {
    expect(codes(parse({ completed_at: 1 }))).toContain("timestamp_not_firestore_shape");
    expect(codes(parse({ cancelled_at: "x" }))).toContain("timestamp_not_firestore_shape");
  });
});

describe("timezone", () => {
  it.each(["America/Sao_Paulo", "UTC", "America/Manaus", "Europe/Lisbon"])(
    "accepts valid IANA zone %s",
    (zone) => {
      const model = parse({ timezone: zone });
      expect(model.timezone).toBe(zone);
      expect(model.dataQuality).toBe("complete");
    }
  );

  it("rejects an invalid IANA zone and keeps the item", () => {
    const model = parse({ timezone: "Mars/Olympus" });

    expect(model.timezone).toBeNull();
    expect(model.dataQuality).toBe("partial");
    expect(codes(model)).toContain("invalid_timezone");
    expect(model.title).toBe("Reforço V10");
  });

  it("flags a missing or malformed timezone", () => {
    expect(codes(parse({ timezone: undefined }))).toContain("missing_required_field");
    expect(codes(parse({ timezone: 5 }))).toContain("malformed_field");
  });

  it("validates zones through the platform IANA database", () => {
    expect(isValidIanaTimezone("America/Sao_Paulo")).toBe(true);
    expect(isValidIanaTimezone("Not/AZone")).toBe(false);
  });
});

describe("scope boundary — no temporal derivation in RD-I1", () => {
  it("exposes no temporal status, effective deadline or display-window field", () => {
    const model = parse() as unknown as Record<string, unknown>;

    expect("temporalStatus" in model).toBe(false);
    expect("effectiveDueUntil" in model).toBe(false);
    expect("inDisplayWindow" in model).toBe(false);
    expect("temporalAvailability" in model).toBe(false);
  });

  it("does not derive a deadline for a dose item lacking due_until", () => {
    // RD-I2 owns the fail-closed rule. RD-I1 must simply not invent anything.
    const model = parse({ schedule_type: "dose", due_until: undefined });

    expect(model.scheduleType).toBe("dose");
    expect(model.dueUntil).toBeNull();
    expect(model.dataQuality).toBe("complete");
    expect(model.issues).toEqual([]);
  });
});
