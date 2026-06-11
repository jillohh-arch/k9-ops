"use client";

import {
  collection,
  doc,
  onSnapshot,
  query,
  type DocumentData,
  type Query,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebase/client";

export type HumanRecord = Record<string, unknown> & {
  _id: string;
  _source: string;
};

type RecordsState = {
  error: string | null;
  loading: boolean;
  records: HumanRecord[];
};

const emptyRecords: RecordsState = {
  error: null,
  loading: true,
  records: [],
};

export function humanText(
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

export function humanDate(value: unknown): Date | null {
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

export function humanRecordDate(record: Record<string, unknown>) {
  for (const key of [
    "started_at",
    "startedAt",
    "start_at",
    "date",
    "requested_at",
    "decided_at",
    "finalized_at",
    "created_at",
    "createdAt",
    "updated_at",
    "updatedAt",
    "performed_at",
    "client_time",
  ]) {
    const parsed = humanDate(record[key]);
    if (parsed) return parsed;
  }
  return null;
}

export function isHumanRecordArchived(record: Record<string, unknown>) {
  return (
    record.deleted_at != null ||
    record.deletedAt != null ||
    record.archived_at != null
  );
}

function nestedText(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return humanText(value as Record<string, unknown>, "ra", "id", "uid", "email");
}

function recordMatchesRa(record: HumanRecord, ra: string) {
  const directKeys = [
    "handlerId",
    "handler_id",
    "handlerRa",
    "handler_ra",
    "primary_handler_id",
    "primary_handler_ra",
    "requested_by",
    "requester_ra",
    "decision_by",
    "performed_by",
    "created_by",
    "updated_by",
    "entity_id",
  ];
  if (directKeys.some((key) => humanText(record, key) === ra)) return true;
  if (record._source === "active_shifts" && record._id === ra) return true;
  for (const key of [
    "team_handler_ids",
    "accepted_handler_ids",
    "pending_handler_ids",
  ]) {
    const value = record[key];
    if (Array.isArray(value) && value.map(String).includes(ra)) return true;
  }
  return (
    nestedText(record, "actor") === ra ||
    nestedText(record, "performed_by_snapshot") === ra
  );
}

function useRecords(source: Query<DocumentData>, sourceName: string) {
  const [state, setState] = useState<RecordsState>(emptyRecords);
  useEffect(
    () =>
      onSnapshot(
        source,
        (snapshot) =>
          setState({
            error: null,
            loading: false,
            records: snapshot.docs
              .map((item) => ({
                ...item.data(),
                _id: item.id,
                _source: sourceName,
              }))
              .filter((item) => !isHumanRecordArchived(item)),
          }),
        (error) =>
          setState({ error: error.message, loading: false, records: [] }),
      ),
    [source, sourceName],
  );
  return state;
}

export function useHumanProfileData(ra: string) {
  const [user, setUser] = useState<HumanRecord | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const certificationsQuery = useMemo(
    () => query(collection(db, "users", ra, "certifications")),
    [ra],
  );
  const documentsQuery = useMemo(
    () => query(collection(db, "users", ra, "documents")),
    [ra],
  );
  const dogsQuery = useMemo(() => query(collection(db, "dogs")), []);
  const trainingsQuery = useMemo(() => query(collection(db, "trainings")), []);
  const occurrencesQuery = useMemo(
    () => query(collection(db, "occurrences")),
    [],
  );
  const shiftsQuery = useMemo(
    () => query(collection(db, "active_shifts")),
    [],
  );
  const shiftLogsQuery = useMemo(
    () => query(collection(db, "shift_logs")),
    [],
  );
  const promotionsQuery = useMemo(
    () => query(collection(db, "promotion_requests")),
    [],
  );
  const auditQuery = useMemo(() => query(collection(db, "auditLogs")), []);
  const movementsQuery = useMemo(
    () => query(collection(db, "effective_movements")),
    [],
  );

  const certifications = useRecords(certificationsQuery, "certifications");
  const documents = useRecords(documentsQuery, "documents");
  const dogs = useRecords(dogsQuery, "dogs");
  const trainings = useRecords(trainingsQuery, "trainings");
  const occurrences = useRecords(occurrencesQuery, "occurrences");
  const activeShifts = useRecords(shiftsQuery, "active_shifts");
  const shiftLogs = useRecords(shiftLogsQuery, "shift_logs");
  const promotionRequests = useRecords(promotionsQuery, "promotion_requests");
  const auditLogs = useRecords(auditQuery, "auditLogs");
  const movements = useRecords(movementsQuery, "effective_movements");

  useEffect(() => {
    if (!ra) return;
    return onSnapshot(
      doc(db, "users", ra),
      (snapshot) => {
        setUser(
          snapshot.exists()
            ? {
                ...snapshot.data(),
                _id: snapshot.id,
                _source: "users",
              }
            : null,
        );
        setUserLoading(false);
        setUserError(null);
      },
      (error) => {
        setUser(null);
        setUserLoading(false);
        setUserError(error.message);
      },
    );
  }, [ra]);

  return useMemo(() => {
    const linkedDogs = dogs.records.filter(
      (record) =>
        humanText(
          record,
          "conductorRa",
          "conductor_ra",
          "handlerId",
          "handler_id",
        ) === ra,
    );
    const matching = (records: HumanRecord[]) =>
      records.filter((record) => recordMatchesRa(record, ra));
    const humanMovements = movements.records.filter(
      (record) =>
        humanText(record, "entity_type") === "human" &&
        humanText(record, "entity_id") === ra,
    );
    const events = [
      ...matching(trainings.records),
      ...matching(occurrences.records),
      ...matching(shiftLogs.records),
      ...matching(promotionRequests.records),
      ...matching(auditLogs.records),
      ...humanMovements,
      ...certifications.records,
      ...documents.records,
    ].sort(
      (a, b) =>
        (humanRecordDate(b)?.getTime() ?? 0) -
        (humanRecordDate(a)?.getTime() ?? 0),
    );
    const states = [
      certifications,
      documents,
      dogs,
      trainings,
      occurrences,
      activeShifts,
      shiftLogs,
      promotionRequests,
      auditLogs,
      movements,
    ];
    return {
      activeShift:
        activeShifts.records.find(
          (record) =>
            record._id === ra ||
            humanText(record, "handlerId", "handler_id") === ra,
        ) ?? null,
      certifications: certifications.records,
      documents: documents.records,
      error:
        userError ??
        states.map((state) => state.error).find(Boolean) ??
        null,
      events,
      linkedDogs,
      loading: userLoading || states.some((state) => state.loading),
      movements: humanMovements,
      occurrences: matching(occurrences.records),
      promotionRequests: matching(promotionRequests.records),
      shiftLogs: matching(shiftLogs.records),
      trainings: matching(trainings.records),
      user,
    };
  }, [
    activeShifts,
    auditLogs,
    certifications,
    documents,
    dogs,
    movements,
    occurrences,
    promotionRequests,
    ra,
    shiftLogs,
    trainings,
    user,
    userError,
    userLoading,
  ]);
}

export function useHumanAdministrativeRecords() {
  const usersQuery = useMemo(() => query(collection(db, "users")), []);
  const movementsQuery = useMemo(
    () => query(collection(db, "effective_movements")),
    [],
  );
  const users = useRecords(usersQuery, "users");
  const movements = useRecords(movementsQuery, "effective_movements");
  const [nested, setNested] = useState<RecordsState>(emptyRecords);

  useEffect(() => {
    if (users.loading) return;
    if (!users.records.length) return;
    const byUser = new Map<string, HumanRecord[]>();
    const errors = new Map<string, string>();
    const pending = new Set(
      users.records.flatMap((user) => [
        `${user._id}:certifications`,
        `${user._id}:documents`,
      ]),
    );
    const update = () =>
      setNested({
        error: errors.size ? Array.from(errors.values()).join(" | ") : null,
        loading: pending.size > 0,
        records: Array.from(byUser.values()).flat(),
      });
    const unsubscribes = users.records.flatMap((user) =>
      (["certifications", "documents"] as const).map((kind) => {
        const key = `${user._id}:${kind}`;
        return onSnapshot(
          collection(db, "users", user._id, kind),
          (snapshot) => {
            byUser.set(
              key,
              snapshot.docs
                .map((item) => ({
                  ...item.data(),
                  _id: item.id,
                  _ownerRa: user._id,
                  _source: kind,
                }))
                .filter((record) => !isHumanRecordArchived(record)),
            );
            pending.delete(key);
            errors.delete(key);
            update();
          },
          (error) => {
            pending.delete(key);
            errors.set(key, error.message);
            update();
          },
        );
      }),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [users.loading, users.records]);

  const effectiveNested =
    !users.loading && users.records.length === 0
      ? { error: null, loading: false, records: [] }
      : nested;

  return {
    error: users.error ?? effectiveNested.error ?? movements.error,
    loading: users.loading || effectiveNested.loading || movements.loading,
    movements: movements.records,
    records: effectiveNested.records,
    users: users.records,
  };
}
