"use client";

import {
  collection,
  onSnapshot,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

import { db } from "@/lib/firebase/client";
import { parseRecordedBy } from "../data/nutrition-plan-service";

export const NUTRITION_ACTIVITY_SOURCES = [
  "meal_logs",
  "supplement_logs",
  "feeding_events",
] as const;

export type NutritionActivitySource = (typeof NUTRITION_ACTIVITY_SOURCES)[number];
export type NutritionActivityKind = "meal" | "supplement";
export type NutritionActivityOrigin = "canonical" | "legacy";

export interface NutritionActivity {
  id: string;
  dogId: string;
  documentId: string;
  source: NutritionActivitySource;
  kind: NutritionActivityKind;
  origin: NutritionActivityOrigin;
  occurredAt: Date;
  title: string;
  detail: string;
  responsible: string | null;
  status: string | null;
  notes: string | null;
  planId: string | null;
  planned: boolean;
  mealOccurrenceId: string | null;
  coexistenceFingerprint: string;
  legacySource: string | null;
  legacyId: string | null;
  diagnosticReferences: string[];
}

export interface NutritionActivitySourceState {
  loaded: boolean;
  validCount: number;
  invalidCount: number;
  error: "permission-denied" | "unavailable" | "read-failed" | null;
  records: NutritionActivity[];
}

export interface NutritionActivityIssue {
  kind:
    | "malformed-documents"
    | "source-error"
    | "canonical-conflict"
    | "possible-cross-source-duplicate";
  source: NutritionActivitySource;
  count: number;
}

interface NutritionActivitySettledState {
  records: NutritionActivity[];
  error: string | null;
  issues: NutritionActivityIssue[];
  sources: Record<NutritionActivitySource, NutritionActivitySourceState>;
}

export type NutritionActivityState =
  | {
      status: "idle" | "loading";
      records: NutritionActivity[];
      error: null;
      issues: NutritionActivityIssue[];
      sources: Record<NutritionActivitySource, NutritionActivitySourceState>;
    }
  | (NutritionActivitySettledState & {
      status: "ready" | "empty" | "degraded" | "error";
    });

export type NutritionActivityHookState = NutritionActivityState & {
  /** Explicit recovery: creates fresh Firestore subscriptions. */
  retry: () => void;
};

function emptySourceState(): NutritionActivitySourceState {
  return { loaded: false, validCount: 0, invalidCount: 0, error: null, records: [] };
}

export function emptyNutritionActivitySources() {
  return {
    meal_logs: emptySourceState(),
    supplement_logs: emptySourceState(),
    feeding_events: emptySourceState(),
  } satisfies Record<NutritionActivitySource, NutritionActivitySourceState>;
}

function stringValue(data: DocumentData, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function optionalString(value: unknown): { valid: boolean; value: string | null } {
  if (value == null) return { valid: true, value: null };
  if (typeof value !== "string") return { valid: false, value: null };
  const trimmed = value.trim();
  return trimmed
    ? { valid: true, value: trimmed }
    : { valid: false, value: null };
}

const STRICT_NUMBER = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/;

function contractNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!STRICT_NUMBER.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = contractNumber(value);
  return parsed != null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const FIRESTORE_MIN_SECONDS = -62135596800;
const FIRESTORE_MAX_SECONDS = 253402300799;
const MAX_DATE_MILLISECONDS = 8_640_000_000_000_000;
const ISO_WITH_TIMEZONE =
  /^\d{4,6}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/i;

function validDate(date: Date): Date | null {
  const time = date.getTime();
  return Number.isFinite(time) && Math.abs(time) <= MAX_DATE_MILLISECONDS
    ? date
    : null;
}

/**
 * Activity timestamps must be deterministic in every browser timezone.
 * Numeric epochs are milliseconds; Firestore seconds use the map shape.
 */
export function parseNutritionActivityTimestamp(value: unknown): Date | null {
  try {
    if (value instanceof Date) return validDate(value);

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!ISO_WITH_TIMEZONE.test(trimmed)) return null;
      return validDate(new Date(trimmed));
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
      return validDate(new Date(value));
    }

    if (!value || typeof value !== "object") return null;
    const object = value as Record<string, unknown>;
    const toDate = (object as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const converted = (toDate as () => unknown).call(value);
      return converted instanceof Date ? validDate(converted) : null;
    }

    const seconds = object.seconds ?? object._seconds;
    const nanoseconds = object.nanoseconds ?? object._nanoseconds ?? 0;
    if (
      typeof seconds !== "number" ||
      !Number.isInteger(seconds) ||
      seconds < FIRESTORE_MIN_SECONDS ||
      seconds > FIRESTORE_MAX_SECONDS ||
      typeof nanoseconds !== "number" ||
      !Number.isInteger(nanoseconds) ||
      nanoseconds < 0 ||
      nanoseconds >= 1_000_000_000
    ) {
      return null;
    }
    const milliseconds = seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
    return validDate(new Date(milliseconds));
  } catch {
    return null;
  }
}

const CANONICAL_MEAL_PERIODS = new Set([
  "morning",
  "afternoon",
  "evening",
  "night",
  "extra",
]);
const LEGACY_PERIOD_ALIASES: Record<string, string> = {
  manha: "morning",
  almoco: "afternoon",
  noite: "night",
};
const SUPPLEMENT_UNITS = new Set([
  "mg",
  "g",
  "ml",
  "scoop",
  "tablet",
  "drop",
  "other",
]);

function canonicalPeriod(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return CANONICAL_MEAL_PERIODS.has(trimmed) ? trimmed : null;
}

function legacyPeriod(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return LEGACY_PERIOD_ALIASES[trimmed] ?? trimmed;
}

function normalizedLegacySource(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function diagnosticReferences(data: DocumentData) {
  const candidates = [
    ["operation", data.operation_id],
    ["receipt", data.receipt_id],
    ["source", data.source_reference],
    ["create-operation", data.create_operation_id],
  ] as const;
  return candidates.flatMap(([namespace, raw]) => {
    const parsed = optionalString(raw);
    return parsed.valid && parsed.value ? [`${namespace}:${parsed.value}`] : [];
  });
}

function activityFingerprint(input: {
  dogId: string;
  kind: NutritionActivityKind;
  occurredAt: Date;
  slot: string | null;
  quantity: number | null;
  planId: string | null;
}) {
  // Diagnostic/order key only. It never authorizes destructive deduplication.
  return [
    input.dogId,
    input.kind,
    input.occurredAt.toISOString(),
    input.slot?.trim() ?? "",
    input.quantity == null ? "" : String(input.quantity),
    input.planId ?? "",
  ].join("|");
}

type ParsedActivityDocument =
  | { kind: "valid"; record: NutritionActivity }
  | { kind: "invalid" }
  | { kind: "ignored" };

function canonicalProvenance(data: DocumentData) {
  const source = optionalString(data.legacy_source);
  const id = optionalString(data.legacy_id);
  if (!source.valid || !id.valid || Boolean(source.value) !== Boolean(id.value)) {
    return null;
  }
  return {
    legacySource: source.value ? normalizedLegacySource(source.value) : null,
    legacyId: id.value,
  };
}

function parseCanonicalMeal(
  dogId: string,
  id: string,
  data: DocumentData,
): ParsedActivityDocument {
  const occurredAt = parseNutritionActivityTimestamp(data.fed_at);
  const period = canonicalPeriod(data.period);
  const offered = contractNumber(data.offered_grams);
  const consumed =
    data.consumed_grams == null ? null : contractNumber(data.consumed_grams);
  const recordedBy = parseRecordedBy(data.recorded_by);
  const schemaVersion = positiveInteger(data.schema_version);
  const revision = positiveInteger(data.revision);
  const planId = optionalString(data.plan_id);
  const plannedMealId = optionalString(data.planned_meal_id);
  const mealOccurrenceId = optionalString(data.meal_occurrence_id);
  const provenance = canonicalProvenance(data);
  const plannedLinks = [planId.value, plannedMealId.value, mealOccurrenceId.value];
  const hasAnyPlannedLink = plannedLinks.some(Boolean);
  const hasAllPlannedLinks = plannedLinks.every(Boolean);
  const acceptance = optionalString(data.acceptance);
  const acceptanceValue = acceptance.valid ? acceptance.value : null;

  if (
    !occurredAt ||
    !period ||
    offered == null ||
    offered <= 0 ||
    (data.consumed_grams != null && consumed == null) ||
    (consumed != null && (consumed < 0 || consumed > offered)) ||
    (acceptanceValue === "refused" && consumed !== 0) ||
    (acceptanceValue === "full" && consumed != null && consumed !== offered) ||
    (acceptanceValue === "partial" &&
      consumed != null &&
      (consumed <= 0 || consumed >= offered)) ||
    !recordedBy ||
    !schemaVersion ||
    !revision ||
    !planId.valid ||
    !plannedMealId.valid ||
    !mealOccurrenceId.valid ||
    (hasAnyPlannedLink && !hasAllPlannedLinks) ||
    !acceptance.valid ||
    !provenance
  ) {
    return { kind: "invalid" };
  }

  if (
    data.scheduled_for != null &&
    !parseNutritionActivityTimestamp(data.scheduled_for)
  ) {
    return { kind: "invalid" };
  }
  if (
    data.attachment_refs != null &&
    (!Array.isArray(data.attachment_refs) ||
      data.attachment_refs.some(
        (value: unknown) => typeof value !== "string" || !value.trim(),
      ))
  ) {
    return { kind: "invalid" };
  }

  return {
    kind: "valid",
    record: {
      id: `meal_logs:${id}`,
      dogId,
      documentId: id,
      source: "meal_logs",
      kind: "meal",
      origin: "canonical",
      occurredAt,
      title: `Refeição · ${period}`,
      detail:
        consumed == null
          ? `${offered} g oferecidos`
          : `${consumed} de ${offered} g consumidos`,
      responsible: recordedBy.name,
      status: acceptanceValue,
      notes: stringValue(data, "observations", "notes"),
      planId: planId.value,
      planned: hasAllPlannedLinks,
      mealOccurrenceId: mealOccurrenceId.value,
      coexistenceFingerprint: activityFingerprint({
        dogId,
        kind: "meal",
        occurredAt,
        slot: period,
        quantity: offered,
        planId: planId.value,
      }),
      legacySource: provenance.legacySource,
      legacyId: provenance.legacyId,
      diagnosticReferences: diagnosticReferences(data),
    },
  };
}

function parseLegacyMeal(
  dogId: string,
  id: string,
  data: DocumentData,
): ParsedActivityDocument {
  if (data.deleted_at != null) {
    return parseNutritionActivityTimestamp(data.deleted_at)
      ? { kind: "ignored" }
      : { kind: "invalid" };
  }

  const occurredAt = parseNutritionActivityTimestamp(data.fed_at ?? data.created_at);
  const period = legacyPeriod(data.period);
  const offered = contractNumber(data.amount_grams);
  if (!occurredAt || !period || offered == null || offered <= 0) {
    return { kind: "invalid" };
  }

  const recordedBy = parseRecordedBy(data.recorded_by);
  const legacyAuthor =
    typeof data.fed_by === "string" && data.fed_by.trim()
      ? data.fed_by.trim()
      : null;

  return {
    kind: "valid",
    record: {
      id: `feeding_events:${id}`,
      dogId,
      documentId: id,
      source: "feeding_events",
      kind: "meal",
      origin: "legacy",
      occurredAt,
      title: `Refeição · ${period}`,
      detail: `${offered} g oferecidos`,
      responsible: recordedBy?.name ?? legacyAuthor,
      status: stringValue(data, "acceptance", "status"),
      notes: stringValue(data, "observations", "notes"),
      planId: null,
      planned: false,
      mealOccurrenceId: null,
      coexistenceFingerprint: activityFingerprint({
        dogId,
        kind: "meal",
        occurredAt,
        slot: period,
        quantity: offered,
        planId: null,
      }),
      legacySource: "feeding_events",
      legacyId: id,
      diagnosticReferences: diagnosticReferences(data),
    },
  };
}

function parseSupplement(
  dogId: string,
  id: string,
  data: DocumentData,
): ParsedActivityDocument {
  const occurredAt = parseNutritionActivityTimestamp(data.administered_at);
  const name = optionalString(data.supplement_name);
  const dose = contractNumber(data.dose);
  const unit = optionalString(data.unit);
  const recordedBy = parseRecordedBy(data.recorded_by);
  const schemaVersion = positiveInteger(data.schema_version);
  const revision = positiveInteger(data.revision);
  const planId = optionalString(data.nutrition_plan_id);
  const regimenId = optionalString(data.supplement_regimen_id);
  const provenance = canonicalProvenance(data);

  if (
    !occurredAt ||
    !name.valid ||
    !name.value ||
    dose == null ||
    dose <= 0 ||
    !unit.valid ||
    !unit.value ||
    !SUPPLEMENT_UNITS.has(unit.value) ||
    !recordedBy ||
    !schemaVersion ||
    !revision ||
    !planId.valid ||
    !regimenId.valid ||
    !provenance
  ) {
    return { kind: "invalid" };
  }

  return {
    kind: "valid",
    record: {
      id: `supplement_logs:${id}`,
      dogId,
      documentId: id,
      source: "supplement_logs",
      kind: "supplement",
      origin: "canonical",
      occurredAt,
      title: name.value,
      detail: `${dose} ${unit.value}`,
      responsible: recordedBy.name,
      status: "administrado",
      notes: stringValue(data, "notes"),
      planId: planId.value,
      planned: Boolean(regimenId.value),
      mealOccurrenceId: null,
      coexistenceFingerprint: activityFingerprint({
        dogId,
        kind: "supplement",
        occurredAt,
        slot: regimenId.value,
        quantity: dose,
        planId: planId.value,
      }),
      legacySource: provenance.legacySource,
      legacyId: provenance.legacyId,
      diagnosticReferences: diagnosticReferences(data),
    },
  };
}

export function parseNutritionActivityDocuments(
  dogId: string,
  source: NutritionActivitySource,
  documents: Array<{ id: string; data: DocumentData }>,
) {
  const records: NutritionActivity[] = [];
  let invalidCount = 0;
  for (const document of documents) {
    try {
      const parsed =
        source === "supplement_logs"
          ? parseSupplement(dogId, document.id, document.data)
          : source === "meal_logs"
            ? parseCanonicalMeal(dogId, document.id, document.data)
            : parseLegacyMeal(dogId, document.id, document.data);
      if (parsed.kind === "valid") records.push(parsed.record);
      else if (parsed.kind === "invalid") invalidCount += 1;
    } catch {
      invalidCount += 1;
    }
  }
  return { records, validCount: records.length, invalidCount };
}

const SOURCE_PRIORITY: Record<NutritionActivitySource, number> = {
  meal_logs: 0,
  supplement_logs: 1,
  feeding_events: 2,
};

export function compareOrdinal(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function compareNutritionActivities(a: NutritionActivity, b: NutritionActivity) {
  const byTime = b.occurredAt.getTime() - a.occurredAt.getTime();
  if (byTime) return byTime;
  const bySource = SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source];
  if (bySource) return bySource;
  const byKind = compareOrdinal(a.kind, b.kind);
  if (byKind) return byKind;
  const aIdentity =
    a.mealOccurrenceId ??
    a.diagnosticReferences[0] ??
    a.coexistenceFingerprint;
  const bIdentity =
    b.mealOccurrenceId ??
    b.diagnosticReferences[0] ??
    b.coexistenceFingerprint;
  const byIdentity = compareOrdinal(aIdentity, bIdentity);
  if (byIdentity) return byIdentity;
  const byDocument = compareOrdinal(a.documentId, b.documentId);
  if (byDocument) return byDocument;
  return compareOrdinal(a.id, b.id);
}

function canonicalExplicitlyReferencesLegacy(
  canonical: NutritionActivity,
  legacy: NutritionActivity,
) {
  return (
    canonical.dogId === legacy.dogId &&
    normalizedLegacySource(canonical.legacySource) === "feeding_events" &&
    Boolean(canonical.legacyId) &&
    canonical.legacyId === legacy.documentId
  );
}

export function consolidateNutritionActivitySources(
  sources: Record<NutritionActivitySource, NutritionActivitySourceState>,
): NutritionActivityState {
  if (!NUTRITION_ACTIVITY_SOURCES.every((source) => sources[source].loaded)) {
    return { status: "loading", records: [], error: null, issues: [], sources };
  }

  const issues: NutritionActivityIssue[] = [];
  for (const source of NUTRITION_ACTIVITY_SOURCES) {
    const state = sources[source];
    if (state.invalidCount) {
      issues.push({ kind: "malformed-documents", source, count: state.invalidCount });
    }
    if (state.error) {
      issues.push({ kind: "source-error", source, count: 1 });
    }
  }

  const canonicalMeals = sources.meal_logs.records;
  const occurrenceCounts = new Map<string, number>();
  canonicalMeals.forEach((record) => {
    if (record.mealOccurrenceId) {
      occurrenceCounts.set(
        record.mealOccurrenceId,
        (occurrenceCounts.get(record.mealOccurrenceId) ?? 0) + 1,
      );
    }
  });
  const conflictCount = [...occurrenceCounts.values()].filter((count) => count > 1).length;
  if (conflictCount) {
    issues.push({
      kind: "canonical-conflict",
      source: "meal_logs",
      count: conflictCount,
    });
  }

  const legacyMeals = sources.feeding_events.records.filter(
    (legacy) =>
      !canonicalMeals.some((canonical) =>
        canonicalExplicitlyReferencesLegacy(canonical, legacy),
      ),
  );
  const possibleDuplicateCount = legacyMeals.filter((legacy) =>
    canonicalMeals.some(
      (canonical) =>
        canonical.dogId === legacy.dogId &&
        canonical.coexistenceFingerprint === legacy.coexistenceFingerprint,
    ),
  ).length;
  if (possibleDuplicateCount) {
    issues.push({
      kind: "possible-cross-source-duplicate",
      source: "feeding_events",
      count: possibleDuplicateCount,
    });
  }

  const records = [
    ...canonicalMeals,
    ...sources.supplement_logs.records,
    ...legacyMeals,
  ].sort(compareNutritionActivities);

  const failedCount = NUTRITION_ACTIVITY_SOURCES.filter(
    (source) => sources[source].error,
  ).length;
  if (failedCount === NUTRITION_ACTIVITY_SOURCES.length) {
    return {
      status: "error",
      records: [],
      error: "Não foi possível consultar as fontes de atividade nutricional.",
      issues,
      sources,
    };
  }
  if (issues.length) {
    return {
      status: "degraded",
      records,
      error: "Leitura parcial: há fontes indisponíveis ou registros inválidos.",
      issues,
      sources,
    };
  }
  if (records.length === 0) {
    return { status: "empty", records, error: null, issues, sources };
  }
  return { status: "ready", records, error: null, issues, sources };
}

function sanitizedReadError(error: unknown): NutritionActivitySourceState["error"] {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code.includes("permission-denied")) return "permission-denied";
  if (code.includes("unavailable")) return "unavailable";
  return "read-failed";
}

export function unsubscribeAllSafely(unsubscribers: Unsubscribe[]) {
  for (const unsubscribe of unsubscribers) {
    try {
      unsubscribe();
    } catch {
      // Cleanup must remain best-effort and never expose technical details.
    }
  }
}

export function useNutritionActivity(dogId: string): NutritionActivityHookState {
  const normalizedDogId = dogId.trim();
  const generationRef = useRef(0);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const requestKey = `${normalizedDogId}:${retryGeneration}`;
  const retry = useCallback(() => {
    setRetryGeneration((current) => current + 1);
  }, []);
  const [snapshot, setSnapshot] = useState<{
    requestKey: string;
    state: NutritionActivityState;
  }>({
    requestKey: "",
    state: {
      status: "idle",
      records: [],
      error: null,
      issues: [],
      sources: emptyNutritionActivitySources(),
    },
  });

  useEffect(() => {
    const generation = ++generationRef.current;
    if (!normalizedDogId) return;

    let stopped = false;
    const sources = emptyNutritionActivitySources();

    const publish = () => {
      if (stopped || generation !== generationRef.current) return;
      setSnapshot({
        requestKey,
        state: consolidateNutritionActivitySources({
          meal_logs: { ...sources.meal_logs, records: [...sources.meal_logs.records] },
          supplement_logs: {
            ...sources.supplement_logs,
            records: [...sources.supplement_logs.records],
          },
          feeding_events: {
            ...sources.feeding_events,
            records: [...sources.feeding_events.records],
          },
        }),
      });
    };

    const subscribe = (source: NutritionActivitySource): Unsubscribe => {
      try {
        return onSnapshot(
          collection(db, "dogs", normalizedDogId, source),
          (querySnapshot: QuerySnapshot<DocumentData>) => {
            if (stopped || generation !== generationRef.current) return;
            const parsed = parseNutritionActivityDocuments(
              normalizedDogId,
              source,
              querySnapshot.docs.map((document) => ({
                id: document.id,
                data: document.data(),
              })),
            );
            sources[source] = {
              loaded: true,
              error: null,
              ...parsed,
            };
            publish();
          },
          (error) => {
            if (stopped || generation !== generationRef.current) return;
            sources[source] = {
              ...sources[source],
              loaded: true,
              error: sanitizedReadError(error),
            };
            publish();
          },
        );
      } catch (error) {
        sources[source] = {
          ...sources[source],
          loaded: true,
          error: sanitizedReadError(error),
        };
        publish();
        return () => undefined;
      }
    };

    const unsubscribers = NUTRITION_ACTIVITY_SOURCES.map(subscribe);
    return () => {
      stopped = true;
      generationRef.current += 1;
      unsubscribeAllSafely(unsubscribers);
    };
  }, [normalizedDogId, requestKey]);

  if (!normalizedDogId) {
    return {
      status: "idle",
      records: [],
      error: null,
      issues: [],
      sources: emptyNutritionActivitySources(),
      retry,
    };
  }
  if (snapshot.requestKey !== requestKey) {
    return {
      status: "loading",
      records: [],
      error: null,
      issues: [],
      sources: emptyNutritionActivitySources(),
      retry,
    };
  }
  return { ...snapshot.state, retry };
}
