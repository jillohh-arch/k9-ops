"use client";

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type Query,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { parseBinomialId } from "@/features/effective/data/binomial-admin-service";
import { db } from "@/lib/firebase/client";

import {
  canonicalSource,
  countValidFields,
  mergeRecords,
  type BinomialRecord,
} from "../lib/binomial-deduplication";

// Re-export for consumers
export type { BinomialRecord };
export { canonicalSource, countValidFields, mergeRecords };

type RecordState = {
  error: string | null;
  loading: boolean;
  records: BinomialRecord[];
};

const emptyState: RecordState = {
  error: null,
  loading: true,
  records: [],
};

export function binomialText(
  record: Record<string, unknown> | null,
  ...keys: string[]
) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return null;
}

export function binomialNumber(
  record: Record<string, unknown> | null,
  ...keys: string[]
) {
  const value = binomialText(record, ...keys);
  if (value == null) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function binomialDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const method = (value as { toDate?: unknown }).toDate;
    if (typeof method === "function") {
      const parsed = method.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : null;
    }
  }
  return null;
}

export function binomialRecordDate(record: Record<string, unknown>) {
  for (const key of [
    "date",
    "start_at",
    "startAt",
    "started_at",
    "startedAt",
    "finalized_at",
    "finalizedAt",
    "created_at",
    "createdAt",
    "updated_at",
    "updatedAt",
  ]) {
    const parsed = binomialDate(record[key]);
    if (parsed) return parsed;
  }
  return null;
}

function isArchived(record: Record<string, unknown>) {
  return (
    record.deleted_at != null ||
    record.deletedAt != null ||
    record.archived_at != null
  );
}

function useRecords(source: Query, sourceName: string) {
  const [state, setState] = useState<RecordState>(emptyState);
  useEffect(
    () =>
      onSnapshot(
        source,
        (snapshot) => {
          setState({
            error: null,
            loading: false,
            records: snapshot.docs
              .map((item) => ({
                ...item.data(),
                _id: item.id,
                _source: sourceName,
              }))
              .filter((item) => !isArchived(item)),
          });
        },
        (error) =>
          setState({ error: error.message, loading: false, records: [] }),
      ),
    [source, sourceName],
  );
  return state;
}

function matchesRa(record: BinomialRecord, ra: string) {
  if (!ra) return false;
  return [
    // Handler fields
    "handlerId",
    "handler_id",
    "handlerRa",
    "handler_ra",
    // Primary handler (occurrences)
    "primaryHandlerId",
    "primary_handler_id",
    "primaryHandlerRa",
    "primary_handler_ra",
    // Other fields
    "conductorRa",
    "performed_by",
    "created_by",
  ].some((key) => binomialText(record, key) === ra);
}

export function useBinomialProfileData(binomialId: string) {
  const legacy = useMemo(() => parseBinomialId(binomialId), [binomialId]);
  const [binomial, setBinomial] = useState<BinomialRecord | null>(null);
  const [binomialLoading, setBinomialLoading] = useState(true);
  const [binomialError, setBinomialError] = useState<string | null>(null);
  const [dog, setDog] = useState<BinomialRecord | null>(null);
  const [handler, setHandler] = useState<BinomialRecord | null>(null);
  const [identity, setIdentity] = useState<{
    dogId: string;
    handlerRa: string;
  } | null>(legacy);

  useEffect(() => {
    if (!binomialId) return;
    return onSnapshot(
      doc(db, "binomials", binomialId),
      (snapshot) => {
        const data = snapshot.exists()
          ? {
              ...snapshot.data(),
              _id: snapshot.id,
              _source: "binomials",
            }
          : null;
        setBinomial(data);
        setIdentity(
          data
            ? {
                dogId:
                  binomialText(data, "dog_id", "dogId") ?? legacy?.dogId ?? "",
                handlerRa:
                  binomialText(data, "handler_ra", "handlerRa") ??
                  legacy?.handlerRa ??
                  "",
              }
            : legacy,
        );
        setBinomialLoading(false);
        setBinomialError(null);
      },
      (error) => {
        setBinomial(null);
        setIdentity(legacy);
        setBinomialLoading(false);
        setBinomialError(error.message);
      },
    );
  }, [binomialId, legacy]);

  useEffect(() => {
    if (!identity?.dogId) return;
    return onSnapshot(
      doc(db, "dogs", identity.dogId),
      (snapshot) =>
        setDog(
          snapshot.exists()
            ? { ...snapshot.data(), _id: snapshot.id, _source: "dogs" }
            : null,
        ),
      () => setDog(null),
    );
  }, [identity?.dogId]);

  useEffect(() => {
    if (!identity?.handlerRa) return;
    return onSnapshot(
      doc(db, "users", identity.handlerRa),
      (snapshot) =>
        setHandler(
          snapshot.exists()
            ? { ...snapshot.data(), _id: snapshot.id, _source: "users" }
            : null,
        ),
      () => setHandler(null),
    );
  }, [identity?.handlerRa]);

  const dogId = identity?.dogId ?? "";
  const handlerRa = identity?.handlerRa ?? "";

  // BUG-FS-002: Mobile grava em dogs/{dogId}/training_sessions (subcoleção)
  // e em trainings (raiz), não em training_sessions (raiz).
  // Adicionar fontes correspondentes para recuperar os dados.
  const trainingsSubcollectionQuery = useMemo(
    () =>
      dogId
        ? query(collection(db, "dogs", dogId, "training_sessions"))
        : null,
    [dogId],
  );
  const trainingsQuery = useMemo(
    () => query(collection(db, "training_sessions"), where("dogId", "==", dogId)),
    [dogId],
  );
  const trainingsLegacyQuery = useMemo(
    () => query(collection(db, "training_sessions"), where("dog_id", "==", dogId)),
    [dogId],
  );
  const trainingsRootQuery = useMemo(
    () => query(collection(db, "trainings"), where("dogId", "==", dogId)),
    [dogId],
  );
  const occurrencesDogQuery = useMemo(
    () => query(collection(db, "occurrences"), where("service_dog_id", "==", dogId)),
    [dogId],
  );
  const occurrencesLegacyDogQuery = useMemo(
    () => query(collection(db, "occurrences"), where("dog_id", "==", dogId)),
    [dogId],
  );
  const shiftLogsDogQuery = useMemo(
    () => query(collection(db, "shift_logs"), where("service_dog_id", "==", dogId)),
    [dogId],
  );

  // BUG-FS-002: Registrar listeners para cada fonte de treino
  const trainingsSubcollection = useRecords(
    trainingsSubcollectionQuery!,
    "dogs_training_sessions", // BUG-FS-002: nome consistente com SOURCE_FAMILY_MAP
  );
  const trainingsDog = useRecords(trainingsQuery, "training_sessions");
  const trainingsDogLegacy = useRecords(
    trainingsLegacyQuery,
    "training_sessions_legacy",
  );
  const trainingsRoot = useRecords(trainingsRootQuery, "trainings");
  const occurrencesDog = useRecords(occurrencesDogQuery, "occurrences");
  const occurrencesDogLegacy = useRecords(
    occurrencesLegacyDogQuery,
    "occurrences_legacy",
  );
  const shiftLogsDog = useRecords(shiftLogsDogQuery, "shift_logs");

  return useMemo(() => {
    const records = [
      ...trainingsSubcollection.records, // BUG-FS-002: Subcoleção do cão (FONTE CANÔNICA DO MOBILE)
      ...trainingsRoot.records,           // BUG-FS-002: Coleção trainings (raiz)
      ...trainingsDog.records,
      ...trainingsDogLegacy.records,
      ...occurrencesDog.records,
      ...occurrencesDogLegacy.records,
      ...shiftLogsDog.records,
    ];
    const byIdentity = new Map<string, BinomialRecord>();
    for (const record of records) {
      // BUG-FS-001: Usar fonte canônica para evitar duplicação
      // Quando mobile grava {dogId, dog_id}, o mesmo documento é retornado
      // por dois listeners com _source diferente. Canonical source normaliza.
      const key = `${canonicalSource(record._source)}:${record._id}`;
      const existing = byIdentity.get(key);
      byIdentity.set(key, existing ? mergeRecords(existing, record) : record);
    }
    const events = Array.from(byIdentity.values())
      .filter((record) => !handlerRa || matchesRa(record, handlerRa))
      .sort(
        (a, b) =>
          (binomialRecordDate(b)?.getTime() ?? 0) -
          (binomialRecordDate(a)?.getTime() ?? 0),
      );
    const states = [
      trainingsDog,
      trainingsDogLegacy,
      occurrencesDog,
      occurrencesDogLegacy,
      shiftLogsDog,
    ];
    return {
      binomial,
      dog,
      error:
        binomialError ??
        states.map((state) => state.error).find(Boolean) ??
        null,
      events,
      handler,
      handlerRa,
      loading: binomialLoading || states.some((state) => state.loading),
      dogId,
      occurrences: events.filter((event) => event._source.startsWith("occurrences")),
      shifts: events.filter((event) => event._source === "shift_logs"),
      trainings: events.filter((event) =>
        // BUG-FS-002: Incluir todas as fontes de treino
        event._source.startsWith("training_sessions") ||
        event._source === "trainings" ||
        event._source === "dogs_training_sessions",
      ),
    };
  }, [
    binomial,
    binomialError,
    binomialLoading,
    dog,
    dogId,
    handler,
    handlerRa,
    occurrencesDog,
    occurrencesDogLegacy,
    shiftLogsDog,
    trainingsDog,
    trainingsDogLegacy,
    trainingsSubcollection,
    trainingsRoot,
  ]);
}
