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

import { db } from "@/lib/firebase/client";

export type VehicleRecord = Record<string, unknown> & {
  _id: string;
  _source: string;
};

type RecordState = {
  error: string | null;
  loading: boolean;
  records: VehicleRecord[];
};

const emptyState: RecordState = {
  error: null,
  loading: true,
  records: [],
};

export function vehicleText(
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

export function vehicleNumber(
  record: Record<string, unknown> | null,
  ...keys: string[]
) {
  const value = vehicleText(record, ...keys);
  if (value == null) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function vehicleDate(value: unknown): Date | null {
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

export function vehicleRecordDate(record: Record<string, unknown>) {
  for (const key of [
    "date",
    "startedAt",
    "started_at",
    "endedAt",
    "ended_at",
    "created_at",
    "createdAt",
    "updated_at",
    "updatedAt",
  ]) {
    const parsed = vehicleDate(record[key]);
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
              .filter((item) => !isArchived(item)),
          }),
        (error) =>
          setState({ error: error.message, loading: false, records: [] }),
      ),
    [source, sourceName],
  );
  return state;
}

export function useVehicleProfileData(vehicleId: string) {
  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const eventsQuery = useMemo(
    () => query(collection(db, "vehicles", vehicleId, "events")),
    [vehicleId],
  );
  const activeShiftsQuery = useMemo(
    () =>
      query(
        collection(db, "active_shifts"),
        where("vehicle_id", "==", vehicleId),
      ),
    [vehicleId],
  );
  const shiftLogsQuery = useMemo(
    () =>
      query(
        collection(db, "shift_logs"),
        where("vehicle_id", "==", vehicleId),
      ),
    [vehicleId],
  );
  const occurrencesQuery = useMemo(
    () =>
      query(
        collection(db, "occurrences"),
        where("vehicle_id", "==", vehicleId),
      ),
    [vehicleId],
  );

  const events = useRecords(eventsQuery, "vehicle_events");
  const activeShifts = useRecords(activeShiftsQuery, "active_shifts");
  const shiftLogs = useRecords(shiftLogsQuery, "shift_logs");
  const occurrences = useRecords(occurrencesQuery, "occurrences");

  useEffect(() => {
    if (!vehicleId) return;
    return onSnapshot(
      doc(db, "vehicles", vehicleId),
      (snapshot) => {
        setVehicle(
          snapshot.exists()
            ? { ...snapshot.data(), _id: snapshot.id, _source: "vehicles" }
            : null,
        );
        setVehicleLoading(false);
        setVehicleError(null);
      },
      (error) => {
        setVehicle(null);
        setVehicleLoading(false);
        setVehicleError(error.message);
      },
    );
  }, [vehicleId]);

  return useMemo(() => {
    const states = [events, activeShifts, shiftLogs, occurrences];
    const timeline = [
      ...events.records,
      ...activeShifts.records,
      ...shiftLogs.records,
      ...occurrences.records,
    ].sort(
      (a, b) =>
        (vehicleRecordDate(b)?.getTime() ?? 0) -
        (vehicleRecordDate(a)?.getTime() ?? 0),
    );
    return {
      activeShifts: activeShifts.records.filter(
        (record) => vehicleText(record, "status") !== "ended",
      ),
      error:
        vehicleError ??
        states.map((state) => state.error).find(Boolean) ??
        null,
      events: events.records,
      loading: vehicleLoading || states.some((state) => state.loading),
      occurrences: occurrences.records,
      shiftLogs: shiftLogs.records,
      timeline,
      vehicle,
    };
  }, [
    activeShifts,
    events,
    occurrences,
    shiftLogs,
    vehicle,
    vehicleError,
    vehicleLoading,
  ]);
}
