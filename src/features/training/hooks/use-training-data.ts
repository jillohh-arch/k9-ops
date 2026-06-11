"use client";

import {
  collection,
  onSnapshot,
  query,
  type Query,
  where,
} from "firebase/firestore";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  canonicalK9Modalities,
  canonicalModality,
  canonicalModalityLabel,
} from "@/features/effective/lib/k9-modalities";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { useEffectiveData } from "@/features/effective/hooks/use-effective-data";
import { db } from "@/lib/firebase/client";

export type TrainingTone =
  | "amber"
  | "blue"
  | "cyan"
  | "emerald"
  | "red"
  | "slate"
  | "violet";

type RawRecord = Record<string, unknown> & {
  _dogId?: string;
  _id: string;
  _moduleId?: string;
  _parentId?: string;
  _path?: string;
  _programId?: string;
};

type SourceKey =
  | "programs"
  | "trainingRecords"
  | "trainingSessions";

type SourceState = {
  error: string | null;
  loading: boolean;
  records: RawRecord[];
};

type Sources = Record<SourceKey, SourceState>;

export type TrainingProgramSummary = {
  active: boolean;
  id: string;
  label: string;
  modality: string;
  moduleCount: number;
  version: string | null;
};

export type TrainingProgressSummary = {
  achievedMilestonesCount: number;
  completedModules: number;
  currentModule: string | null;
  dogId: string;
  modality: string;
  operationalSince: Date | null;
  programVersion: string | null;
  sourcePath: string | null;
  status: string;
};

export type TrainingSessionSummary = {
  date: Date | null;
  distanceM: number | null;
  dogId: string | null;
  durationS: number | null;
  events: string[];
  id: string;
  modality: string;
  phase: string;
  result: string | null;
  sourcePath: string | null;
};

export type TrainingPromotionSummary = {
  dogId: string | null;
  id: string;
  marksCount: number;
  modality: string;
  moduleId: string | null;
  requestedAt: Date | null;
  requestedBy: string | null;
  status: string;
};

export type TrainingMatrixCell = {
  achievedMilestonesCount: number;
  completedModules: number;
  currentModule: string | null;
  label: string;
  lastSessionAt: Date | null;
  modality: string;
  pendingPromotions: number;
  programVersion: string | null;
  sessionCount: number;
  source: "none" | "progress" | "specialty";
  status: string;
  statusLabel: string;
  tone: TrainingTone;
};

export type TrainingDogSummary = {
  cells: TrainingMatrixCell[];
  dogId: string;
  dogName: string;
  inFormationCount: number;
  lastSessionAt: Date | null;
  operationalCount: number;
  pendingPromotions: number;
  sessionCount: number;
  status: string;
};

export type TrainingData = {
  dogs: TrainingDogSummary[];
  errors: string[];
  loading: boolean;
  metrics: {
    activeDogs: number;
    dogsInFormation: number;
    operationalDogs: number;
    pendingPromotions: number;
    programs: number;
    sessions30d: number;
    sessionsTotal: number;
  };
  pendingPromotions: TrainingPromotionSummary[];
  programs: TrainingProgramSummary[];
  progress: TrainingProgressSummary[];
  sessions: TrainingSessionSummary[];
};

const sourceDefinitions: Array<{
  key: SourceKey;
  path: string;
}> = [
  { key: "programs", path: "training_programs" },
  { key: "trainingRecords", path: "trainings" },
  { key: "trainingSessions", path: "training_sessions" },
];

const emptySource: SourceState = {
  error: null,
  loading: true,
  records: [],
};

function createSources(): Sources {
  return {
    programs: emptySource,
    trainingRecords: emptySource,
    trainingSessions: emptySource,
  };
}

function metadataFromPath(path: string) {
  const segments = path.split("/");
  const after = (segment: string) => {
    const index = segments.indexOf(segment);
    return index >= 0 ? segments[index + 1] : undefined;
  };

  return {
    dogId: after("dogs"),
    moduleId: after("modules"),
    programId: after("training_programs"),
  };
}

function subscribeSource(
  path: string,
  setter: Dispatch<SetStateAction<SourceState>>,
) {
  const ref: Query = collection(db, path);
  return subscribeQuerySource(ref, setter);
}

function subscribeQuerySource(
  ref: Query,
  setter: Dispatch<SetStateAction<SourceState>>,
) {
  return onSnapshot(
    ref,
    (snapshot) => {
      setter({
        error: null,
        loading: false,
        records: snapshot.docs.map((item) => {
          const itemPath = item.ref.path;
          const metadata = metadataFromPath(itemPath);
          return {
            ...item.data(),
            _dogId: metadata.dogId,
            _id: item.id,
            _moduleId: metadata.moduleId,
            _parentId: item.ref.parent.parent?.id,
            _path: itemPath,
            _programId: metadata.programId,
          };
        }),
      });
    },
    (error) => {
      setter({ error: error.message, loading: false, records: [] });
    },
  );
}

function subscribeManySources(
  definitions: Array<{ key: string; path: string }>,
  setter: Dispatch<SetStateAction<SourceState>>,
) {
  const groups = new Map<string, RawRecord[]>();
  const pending = new Set(definitions.map((definition) => definition.key));
  const errors = new Map<string, string>();

  if (definitions.length === 0) {
    setter({ error: null, loading: false, records: [] });
    return () => undefined;
  }

  const publish = () => {
    setter({
      error: errors.size ? Array.from(errors.values()).join(" | ") : null,
      loading: pending.size > 0,
      records: Array.from(groups.values()).flat(),
    });
  };

  const unsubscribes = definitions.map((definition) =>
    onSnapshot(
      collection(db, definition.path),
      (snapshot) => {
        groups.set(
          definition.key,
          snapshot.docs.map((item) => {
            const itemPath = item.ref.path;
            const metadata = metadataFromPath(itemPath);
            return {
              ...item.data(),
              _dogId: metadata.dogId,
              _id: item.id,
              _moduleId: metadata.moduleId,
              _parentId: item.ref.parent.parent?.id,
              _path: itemPath,
              _programId: metadata.programId,
            };
          }),
        );
        pending.delete(definition.key);
        errors.delete(definition.key);
        publish();
      },
      (error) => {
        pending.delete(definition.key);
        errors.set(definition.key, `${definition.path}: ${error.message}`);
        publish();
      },
    ),
  );

  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return null;
}

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const parsed = normalized(value);
  if (["true", "1", "sim", "ativo", "active"].includes(parsed)) return true;
  if (["false", "0", "nao", "inativo", "inactive"].includes(parsed)) {
    return false;
  }
  return fallback;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : null;
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function isDeleted(record: Record<string, unknown>) {
  return (
    record.deleted_at != null ||
    record.deletedAt != null ||
    record.archived_at != null ||
    booleanValue(record.deleted, false)
  );
}

function recordDate(record: RawRecord) {
  return dateValue(
    record.started_at ??
      record.startedAt ??
      record.performed_at ??
      record.performedAt ??
      record.date ??
      record.created_at ??
      record.createdAt ??
      record.requested_at ??
      record.requestedAt,
  );
}

function statusOf(record: Record<string, unknown>) {
  return normalized(record.status ?? record.situacao ?? record.state);
}

function visible(records: RawRecord[]) {
  return records.filter((record) => !isDeleted(record));
}

function dedupe(records: RawRecord[]) {
  const byKey = new Map<string, RawRecord>();
  for (const record of records) {
    byKey.set(record._path ?? record._id, record);
  }
  return Array.from(byKey.values());
}

function arrayOrObjectCount(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

function eventNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") {
        return String(item).trim();
      }
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return text(
          record.type,
          record.event_type,
          record.eventType,
          record.name,
          record.label,
        );
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function formatCurrentModule(value: unknown) {
  const parsed = text(value);
  if (!parsed) return null;
  const number = Number(parsed);
  return Number.isFinite(number) ? `Modulo ${number}` : parsed;
}

function normalizeProgress(record: RawRecord): TrainingProgressSummary | null {
  const dogId = text(record.dogId, record.dog_id, record._dogId);
  const modality = canonicalModality(
    text(record.modality, record.modality_id, record.type, record._id) ??
      record._id,
  );

  if (!dogId || !modality) return null;

  return {
    achievedMilestonesCount: arrayOrObjectCount(
      record.achieved_milestones ??
        record.achievedMilestones ??
        record.milestones_achieved ??
        record.marks_snapshot ??
        record.marksSnapshot,
    ),
    completedModules: arrayOrObjectCount(
      record.completed_modules ?? record.completedModules,
    ),
    currentModule: formatCurrentModule(
      record.current_module ?? record.currentModule,
    ),
    dogId,
    modality,
    operationalSince: dateValue(
      record.operational_since ?? record.operationalSince,
    ),
    programVersion: text(record.program_version, record.programVersion),
    sourcePath: record._path ?? null,
    status: statusOf(record) || "not_started",
  };
}

function normalizeSession(record: RawRecord): TrainingSessionSummary | null {
  const track = asRecord(record.track);
  const dogId = text(
    record.dogId,
    record.dog_id,
    record.service_dog_id,
    record.serviceDogId,
    record._dogId,
  );
  const rawModality = text(
    record.modality,
    record.modality_id,
    record.trainingType,
    record.training_type,
    record.type,
  );

  return {
    date: recordDate(record),
    distanceM: numberValue(
      record.distance_m ??
        record.distanceM ??
        track?.distance_m ??
        track?.distanceM,
    ),
    dogId,
    durationS: numberValue(
      record.duration_s ??
        record.durationS ??
        track?.duration_s ??
        track?.durationS,
    ),
    events: eventNames(record.events ?? track?.events),
    id: record._id,
    modality: rawModality ? canonicalModality(rawModality) : "treino_geral",
    phase: text(record.phase, record.training_phase, record.trainingPhase) ??
      (record.module_id || record.moduleId ? "formation" : "maintenance"),
    result: text(record.result, record.outcome, record.status),
    sourcePath: record._path ?? null,
  };
}

function normalizePromotion(record: RawRecord): TrainingPromotionSummary | null {
  const status = statusOf(record) || "pending";
  const isOpen =
    ["pending", "open", "requested", "aguardando", "submitted"].includes(
      status,
    ) &&
    record.resolved_at == null &&
    record.resolvedAt == null &&
    record.decided_at == null &&
    record.decidedAt == null;

  if (!isOpen) return null;

  const rawModality = text(
    record.modality,
    record.modality_id,
    record.training_modality,
  );

  return {
    dogId: text(record.dogId, record.dog_id, record._dogId),
    id: record._id,
    marksCount: arrayOrObjectCount(
      record.marks_snapshot ?? record.marksSnapshot,
    ),
    modality: rawModality ? canonicalModality(rawModality) : "treino_geral",
    moduleId: text(record.module_id, record.moduleId, record.current_module),
    requestedAt: recordDate(record),
    requestedBy: text(
      record.requested_by,
      record.requestedBy,
      record.conductor_ra,
      record.conductorRa,
    ),
    status,
  };
}

function progressPriority(status: string) {
  const normalizedStatus = normalized(status);
  if (normalizedStatus === "operational" || normalizedStatus === "operacional") {
    return 3;
  }
  if (
    normalizedStatus === "in_formation" ||
    normalizedStatus === "em_formacao"
  ) {
    return 2;
  }
  return 1;
}

function cellTone(status: string, pendingPromotions: number): TrainingTone {
  const normalizedStatus = normalized(status);
  if (pendingPromotions > 0) return "amber";
  if (normalizedStatus === "operational" || normalizedStatus === "operacional") {
    return "emerald";
  }
  if (
    normalizedStatus === "in_formation" ||
    normalizedStatus === "em_formacao"
  ) {
    return "cyan";
  }
  return "slate";
}

function cellStatusLabel(
  status: string,
  currentModule: string | null,
  pendingPromotions: number,
) {
  const normalizedStatus = normalized(status);
  if (pendingPromotions > 0) return "Aguardando avaliacao";
  if (normalizedStatus === "operational" || normalizedStatus === "operacional") {
    return "Operacional";
  }
  if (
    normalizedStatus === "in_formation" ||
    normalizedStatus === "em_formacao"
  ) {
    return currentModule ?? "Em formacao";
  }
  return "Nao iniciado";
}

function isOperational(status: string) {
  const normalizedStatus = normalized(status);
  return normalizedStatus === "operational" || normalizedStatus === "operacional";
}

function isInFormation(status: string) {
  const normalizedStatus = normalized(status);
  return (
    normalizedStatus === "in_formation" ||
    normalizedStatus === "em_formacao" ||
    normalizedStatus === "formation"
  );
}

function lastDate(values: Array<Date | null>) {
  return values
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

function daysAgo(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

export function useTrainingData(): TrainingData {
  const { can, status: accessStatus } = useAccessControl();
  const { profile: authProfile, status: authStatus } = useAuth();
  const effective = useEffectiveData();
  const [sources, setSources] = useState<Sources>(createSources);
  const [modulesState, setModulesState] = useState<SourceState>(emptySource);
  const [progressState, setProgressState] = useState<SourceState>(emptySource);
  const [promotionRequestsState, setPromotionRequestsState] =
    useState<SourceState>(emptySource);
  const [dogTrainingSessionsState, setDogTrainingSessionsState] =
    useState<SourceState>(emptySource);
  const canReadPromotionQueue =
    can("training", "approve") ||
    can("training", "audit") ||
    can("training_matrix", "approve") ||
    can("training_matrix", "audit");

  useEffect(() => {
    const unsubscribes = sourceDefinitions.map((definition) =>
      subscribeSource(
        definition.path,
        (next) =>
          setSources((current) => ({
            ...current,
            [definition.key]:
              typeof next === "function"
                ? next(current[definition.key])
                : next,
          })),
      ),
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    if (sources.programs.loading) return;

    const programIds = visible(sources.programs.records)
      .map((record) => record._id)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return subscribeManySources(
      programIds.map((programId) => ({
        key: programId,
        path: `training_programs/${programId}/modules`,
      })),
      setModulesState,
    );
  }, [sources.programs.loading, sources.programs.records]);

  useEffect(() => {
    if (authStatus !== "authenticated" || accessStatus === "loading") return;

    if (canReadPromotionQueue) {
      return subscribeSource("promotion_requests", setPromotionRequestsState);
    }

    if (!authProfile?.ra) {
      const timer = window.setTimeout(() => {
        setPromotionRequestsState({ error: null, loading: false, records: [] });
      }, 0);
      return () => window.clearTimeout(timer);
    }

    return subscribeQuerySource(
      query(
        collection(db, "promotion_requests"),
        where("requester_ra", "==", authProfile.ra),
      ),
      setPromotionRequestsState,
    );
  }, [
    accessStatus,
    authProfile?.ra,
    authStatus,
    canReadPromotionQueue,
  ]);

  useEffect(() => {
    if (effective.loading) return;

    const dogIds = effective.dogs
      .map((dog) => dog.id)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return subscribeManySources(
      dogIds.map((dogId) => ({
        key: dogId,
        path: `dogs/${dogId}/training`,
      })),
      setProgressState,
    );
  }, [effective.dogs, effective.loading]);

  useEffect(() => {
    if (effective.loading) return;

    const dogIds = effective.dogs
      .map((dog) => dog.id)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return subscribeManySources(
      dogIds.map((dogId) => ({
        key: dogId,
        path: `dogs/${dogId}/training_sessions`,
      })),
      setDogTrainingSessionsState,
    );
  }, [effective.dogs, effective.loading]);

  return useMemo(() => {
    const modulesByProgram = visible(modulesState.records)
      .filter((record) => record._path?.includes("training_programs/"))
      .reduce<Record<string, number>>((accumulator, record) => {
        const programId = record._programId;
        if (!programId) return accumulator;
        accumulator[programId] = (accumulator[programId] ?? 0) + 1;
        return accumulator;
      }, {});

    const programs = visible(sources.programs.records)
      .map((record): TrainingProgramSummary => {
        const rawModality = text(record.modality, record.modality_id, record._id);
        const modality = rawModality ? canonicalModality(rawModality) : record._id;
        return {
          active: booleanValue(record.active, true),
          id: record._id,
          label:
            text(record.name, record.label, record.title) ??
            canonicalModalityLabel(modality),
          modality,
          moduleCount: modulesByProgram[record._id] ?? 0,
          version: text(record.version, record.program_version),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

    const progress = visible(progressState.records)
      .map(normalizeProgress)
      .filter((item): item is TrainingProgressSummary => item != null);

    const sessions = dedupe([
      ...visible(sources.trainingSessions.records),
      ...visible(sources.trainingRecords.records),
      ...visible(dogTrainingSessionsState.records),
    ])
      .map(normalizeSession)
      .filter((item): item is TrainingSessionSummary => item != null)
      .sort(
        (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0),
      );

    const pendingPromotions = visible(promotionRequestsState.records)
      .map(normalizePromotion)
      .filter((item): item is TrainingPromotionSummary => item != null)
      .sort(
        (a, b) =>
          (b.requestedAt?.getTime() ?? 0) -
          (a.requestedAt?.getTime() ?? 0),
      );

    const progressByDogModality = new Map<string, TrainingProgressSummary>();
    for (const item of progress) {
      const key = `${item.dogId}:${item.modality}`;
      const previous = progressByDogModality.get(key);
      if (!previous || progressPriority(item.status) >= progressPriority(previous.status)) {
        progressByDogModality.set(key, item);
      }
    }

    const dogIds = new Set<string>();
    for (const dog of effective.dogs) dogIds.add(dog.id);
    for (const item of progress) dogIds.add(item.dogId);
    for (const item of sessions) if (item.dogId) dogIds.add(item.dogId);
    for (const item of pendingPromotions) if (item.dogId) dogIds.add(item.dogId);

    const dogById = new Map(effective.dogs.map((dog) => [dog.id, dog]));

    const dogs = Array.from(dogIds)
      .map((dogId): TrainingDogSummary => {
        const dog = dogById.get(dogId);
        const dogSessions = sessions.filter((session) => session.dogId === dogId);
        const dogPromotions = pendingPromotions.filter(
          (promotion) => promotion.dogId === dogId,
        );

        const cells = canonicalK9Modalities.map((modality) => {
          const progressItem = progressByDogModality.get(
            `${dogId}:${modality.value}`,
          );
          const specialty = dog?.specialties.find(
            (item) => canonicalModality(item.type) === modality.value,
          );
          const modalitySessions = dogSessions.filter(
            (session) => session.modality === modality.value,
          );
          const modalityPromotions = dogPromotions.filter(
            (promotion) => promotion.modality === modality.value,
          );
          const status =
            progressItem?.status ??
            specialty?.status ??
            "not_started";
          const currentModule = progressItem?.currentModule ?? null;
          const pendingPromotionsCount = modalityPromotions.length;

          return {
            achievedMilestonesCount: progressItem?.achievedMilestonesCount ?? 0,
            completedModules: progressItem?.completedModules ?? 0,
            currentModule,
            label: modality.label,
            lastSessionAt: lastDate(modalitySessions.map((session) => session.date)),
            modality: modality.value,
            pendingPromotions: pendingPromotionsCount,
            programVersion: progressItem?.programVersion ?? null,
            sessionCount: modalitySessions.length,
            source: progressItem ? "progress" : specialty ? "specialty" : "none",
            status,
            statusLabel: cellStatusLabel(status, currentModule, pendingPromotionsCount),
            tone: cellTone(status, pendingPromotionsCount),
          } satisfies TrainingMatrixCell;
        });

        return {
          cells,
          dogId,
          dogName: dog?.name ?? `K9 ${dogId}`,
          inFormationCount: cells.filter((cell) => isInFormation(cell.status))
            .length,
          lastSessionAt: lastDate(dogSessions.map((session) => session.date)),
          operationalCount: cells.filter((cell) => isOperational(cell.status))
            .length,
          pendingPromotions: dogPromotions.length,
          sessionCount: dogSessions.length,
          status: dog?.status ?? "Ativo",
        };
      })
      .sort((a, b) => a.dogName.localeCompare(b.dogName, "pt-BR"));

    const thirtyDaysAgo = daysAgo(30);
    const errors = [
      effective.error,
      modulesState.error,
      progressState.error,
      promotionRequestsState.error,
      dogTrainingSessionsState.error,
      ...Object.entries(sources)
        .filter(([, state]) => state.error)
        .map(([key, state]) => `${key}: ${state.error}`),
    ].filter((item): item is string => Boolean(item));

    return {
      dogs,
      errors,
      loading:
        effective.loading ||
        modulesState.loading ||
        progressState.loading ||
        promotionRequestsState.loading ||
        dogTrainingSessionsState.loading ||
        Object.values(sources).some((source) => source.loading),
      metrics: {
        activeDogs: effective.dogs.length,
        dogsInFormation: dogs.filter((dog) => dog.inFormationCount > 0).length,
        operationalDogs: dogs.filter((dog) => dog.operationalCount > 0).length,
        pendingPromotions: pendingPromotions.length,
        programs: programs.length,
        sessions30d: sessions.filter(
          (session) => session.date != null && session.date >= thirtyDaysAgo,
        ).length,
        sessionsTotal: sessions.length,
      },
      pendingPromotions,
      programs,
      progress,
      sessions,
    };
  }, [
    dogTrainingSessionsState,
    effective,
    modulesState,
    progressState,
    promotionRequestsState,
    sources,
  ]);
}
