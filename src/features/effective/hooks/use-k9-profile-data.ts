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

import type { ProfileRecord } from "@/features/effective/lib/k9-profile-records";
import { db } from "@/lib/firebase/client";

/**
 * Os helpers puros de leitura de registro vivem em `lib/k9-profile-records.ts`
 * para não acoplar lógica testável ao cliente Firebase. São reexportados aqui
 * porque os consumidores existentes já os importavam deste módulo.
 */
export {
  profileDate,
  profileNumber,
  profileRecordDate,
  profileText,
} from "@/features/effective/lib/k9-profile-records";
export type { ProfileRecord } from "@/features/effective/lib/k9-profile-records";

export type K9ProfileState = {
  dog: ProfileRecord | null;
  documents: ProfileRecord[];
  error: string | null;
  healthEvents: ProfileRecord[];
  loading: boolean;
  occurrences: ProfileRecord[];
  specialties: ProfileRecord[];
  trainingProgress: ProfileRecord[];
  trainingSessions: ProfileRecord[];
  weightRecords: ProfileRecord[];
};

type NamedRecords = {
  error: string | null;
  loading: boolean;
  records: ProfileRecord[];
};

const emptyRecords: NamedRecords = {
  error: null,
  loading: true,
  records: [],
};

function isArchived(record: ProfileRecord) {
  return (
    record.deleted_at != null ||
    record.deletedAt != null ||
    record.archived_at != null ||
    record.active === false
  );
}

function mergeRecords(groups: Map<string, ProfileRecord[]>) {
  const merged = new Map<string, ProfileRecord>();
  for (const records of groups.values()) {
    for (const record of records) {
      const identitySource = (record._source ?? "record")
        .replace(/-(dogId|dog_id|service_dog_id|caoId)$/, "")
        .replace(/^occurrences-.+$/, "occurrences");
      const identity = `${identitySource}:${record._id}`;
      merged.set(identity, record);
    }
  }
  return Array.from(merged.values()).filter((record) => !isArchived(record));
}

function subscribeMany(
  definitions: Array<{ key: string; source: Query }>,
  setter: React.Dispatch<React.SetStateAction<NamedRecords>>,
) {
  const groups = new Map<string, ProfileRecord[]>();
  const pending = new Set(definitions.map((definition) => definition.key));
  const errors = new Map<string, string>();

  if (definitions.length === 0) {
    setter({ error: null, loading: false, records: [] });
    return () => undefined;
  }

  const unsubscribes = definitions.map((definition) =>
    onSnapshot(
      definition.source,
      (snapshot) => {
        groups.set(
          definition.key,
          snapshot.docs.map((item) => ({
            ...item.data(),
            _id: item.id,
            _source: definition.key,
          })),
        );
        pending.delete(definition.key);
        errors.delete(definition.key);
        setter({
          error: errors.size ? Array.from(errors.values()).join(" | ") : null,
          loading: pending.size > 0,
          records: mergeRecords(groups),
        });
      },
      (error) => {
        pending.delete(definition.key);
        errors.set(definition.key, error.message);
        setter({
          error: Array.from(errors.values()).join(" | "),
          loading: pending.size > 0,
          records: mergeRecords(groups),
        });
      },
    ),
  );

  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}

export function useK9ProfileData(dogId: string): K9ProfileState {
  const [dog, setDog] = useState<ProfileRecord | null>(null);
  const [dogLoading, setDogLoading] = useState(true);
  const [dogError, setDogError] = useState<string | null>(null);
  const [specialties, setSpecialties] = useState<NamedRecords>(emptyRecords);
  const [healthEvents, setHealthEvents] = useState<NamedRecords>(emptyRecords);
  const [weightRecords, setWeightRecords] = useState<NamedRecords>(emptyRecords);
  const [trainingSessions, setTrainingSessions] =
    useState<NamedRecords>(emptyRecords);
  const [trainingProgress, setTrainingProgress] =
    useState<NamedRecords>(emptyRecords);
  const [occurrences, setOccurrences] = useState<NamedRecords>(emptyRecords);
  const [documents, setDocuments] = useState<NamedRecords>(emptyRecords);

  useEffect(() => {
    if (!dogId) return;
    return onSnapshot(
      doc(db, "dogs", dogId),
      (snapshot) => {
        setDog(
          snapshot.exists()
            ? { ...snapshot.data(), _id: snapshot.id, _source: "dogs" }
            : null,
        );
        setDogLoading(false);
        setDogError(null);
      },
      (error) => {
        setDog(null);
        setDogLoading(false);
        setDogError(error.message);
      },
    );
  }, [dogId]);

  useEffect(() => {
    if (!dogId) return;
    return subscribeMany(
      [
        {
          key: "dog-specialties",
          source: query(collection(db, "dogs", dogId, "specialties")),
        },
      ],
      setSpecialties,
    );
  }, [dogId]);

  useEffect(() => {
    if (!dogId) return;
    return subscribeMany(
      [
        {
          key: "dog-training-progress",
          source: query(collection(db, "dogs", dogId, "training")),
        },
      ],
      setTrainingProgress,
    );
  }, [dogId]);

  useEffect(() => {
    if (!dogId) return;
    return subscribeMany(
      [
        {
          key: "dog-health-events",
          source: query(collection(db, "dogs", dogId, "health_events")),
        },
      ],
      setHealthEvents,
    );
  }, [dogId]);

  useEffect(() => {
    if (!dogId) return;
    return subscribeMany(
      [
        {
          key: "dog-weight-records",
          source: query(collection(db, "dogs", dogId, "weight_records")),
        },
      ],
      setWeightRecords,
    );
  }, [dogId]);

  useEffect(() => {
    if (!dogId) return;
    return subscribeMany(
      [
        {
          key: "dog-training-sessions",
          source: query(collection(db, "dogs", dogId, "training_sessions")),
        },
        // QW-1: Keep only dogId variants; dog_id variants are redundant
        // (both produce the same _id key after mergeRecords normalization).
        // If the database uses dog_id instead, swap the field name below.
        {
          key: "root-training-sessions-dogId",
          source: query(
            collection(db, "training_sessions"),
            where("dogId", "==", dogId),
          ),
        },
        {
          key: "root-trainings-dogId",
          source: query(
            collection(db, "trainings"),
            where("dogId", "==", dogId),
          ),
        },
      ],
      setTrainingSessions,
    );
  }, [dogId]);

  useEffect(() => {
    if (!dogId) return;
    return subscribeMany(
      [
        {
          key: "occurrences-dog_id",
          source: query(
            collection(db, "occurrences"),
            where("dog_id", "==", dogId),
          ),
        },
        {
          key: "occurrences-service_dog_id",
          source: query(
            collection(db, "occurrences"),
            where("service_dog_id", "==", dogId),
          ),
        },
      ],
      setOccurrences,
    );
  }, [dogId]);

  useEffect(() => {
    if (!dogId) return;
    return subscribeMany(
      [
        {
          key: "documents-caoId",
          source: query(
            collection(db, "documentos"),
            where("caoId", "==", dogId),
          ),
        },
        {
          key: "dog-documents",
          source: query(collection(db, "dogs", dogId, "documents")),
        },
        {
          key: "dog-external-certifications",
          source: query(
            collection(db, "dogs", dogId, "external_certifications"),
          ),
        },
      ],
      setDocuments,
    );
  }, [dogId]);

  return useMemo(
    () => ({
      dog,
      documents: documents.records,
      error:
        dogError ??
        specialties.error ??
        healthEvents.error ??
        weightRecords.error ??
        trainingProgress.error ??
        trainingSessions.error ??
        occurrences.error ??
        documents.error,
      healthEvents: healthEvents.records,
      loading:
        dogLoading ||
        specialties.loading ||
        healthEvents.loading ||
        weightRecords.loading ||
        trainingProgress.loading ||
        trainingSessions.loading ||
        occurrences.loading ||
        documents.loading,
      occurrences: occurrences.records,
      specialties: specialties.records,
      trainingProgress: trainingProgress.records,
      trainingSessions: trainingSessions.records,
      weightRecords: weightRecords.records,
    }),
    [
      documents,
      dog,
      dogError,
      dogLoading,
      healthEvents,
      occurrences,
      specialties,
      trainingProgress,
      trainingSessions,
      weightRecords,
    ],
  );
}
