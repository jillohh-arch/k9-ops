"use client";

import {
  collection,
  onSnapshot,
  type DocumentData,
} from "firebase/firestore";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  canônicalK9Modalities,
  canônicalModality,
  canônicalModalityLabel,
} from "@/features/effective/lib/k9-modalities";
import { db } from "@/lib/firebase/client";

export type PromotionCriteria = {
  instructorApprovalRequired: boolean;
  maxAverageDurationS: number | null;
  minDistanceM: number | null;
  minSessions: number;
  minSuccessRate: number | null;
  notes: string;
  requiredEvents: string[];
};

export type CurriculumMilestone = {
  description: string;
  id: string;
  order: number;
  required: boolean;
  title: string;
};

export type CurriculumModule = {
  criteria: PromotionCriteria;
  description: string;
  id: string;
  milestoneCount: number;
  milestones: CurriculumMilestone[];
  order: number;
  requiredMilestoneCount: number;
  title: string;
};

export type CurriculumProgram = {
  active: boolean;
  description: string;
  id: string;
  label: string;
  modality: string;
  modules: CurriculumModule[];
  version: string;
};

type RawRecord = DocumentData & {
  _id: string;
  _moduleId?: string;
  _programId?: string;
  _path: string;
};

type SourceState = {
  error: string | null;
  loading: boolean;
  records: RawRecord[];
};

export type TrainingCurriculumsData = {
  errors: string[];
  loading: boolean;
  metrics: {
    activePrograms: number;
    criteriaBlocks: number;
    milestones: number;
    modules: number;
    programs: number;
  };
  programs: CurriculumProgram[];
};

const emptyState: SourceState = {
  error: null,
  loading: true,
  records: [],
};

function metadataFromPath(path: string) {
  const segments = path.split("/");
  const after = (segment: string) => {
    const index = segments.indexOf(segment);
    return index >= 0 ? segments[index + 1] : undefined;
  };

  return {
    moduleId: after("modules"),
    programId: after("training_programs"),
  };
}

function subscribeCollection(
  path: string,
  setter: Dispatch<SetStateAction<SourceState>>,
) {
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      setter({
        error: null,
        loading: false,
        records: snapshot.docs.map((item) => {
          const path = item.ref.path;
          const metadata = metadataFromPath(path);
          return {
            ...item.data(),
            _id: item.id,
            _moduleId: metadata.moduleId,
            _path: path,
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

function subscribeMany(
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
            const path = item.ref.path;
            const metadata = metadataFromPath(path);
            return {
              ...item.data(),
              _id: item.id,
              _moduleId: metadata.moduleId,
              _path: path,
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

function text(record: DocumentData, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return "";
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function nullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const parsed = value.trim().toLowerCase();
    if (["true", "1", "sim", "ativo", "active"].includes(parsed)) return true;
    if (["false", "0", "nao", "inativo", "inactive"].includes(parsed)) {
      return false;
    }
  }
  return fallback;
}

function stringList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function isDeleted(record: DocumentData) {
  return record.deleted_at != null || record.archived_at != null;
}

function criteriaFromRecord(record: DocumentData): PromotionCriteria {
  const criteria =
    record.promotion_criteria ??
    record.promotionCriteria ??
    record.criteria ??
    record.evolution_criteria ??
    {};
  const source =
    criteria && typeof criteria === "object"
      ? (criteria as Record<string, unknown>)
      : {};

  return {
    instructorApprovalRequired: booleanValue(
      source.instructor_approval_required ??
        source.instructorApprovalRequired ??
        record.instructor_approval_required,
      true,
    ),
    maxAverageDurationS: nullableNumber(
      source.max_average_duration_s ??
        source.maxAverageDurationS ??
        record.max_average_duration_s,
    ),
    minDistanceM: nullableNumber(
      source.min_distance_m ?? source.minDistanceM ?? record.min_distance_m,
    ),
    minSessions: numberValue(
      source.min_sessions ?? source.minSessions ?? record.min_sessions,
      0,
    ),
    minSuccessRate: nullableNumber(
      source.min_success_rate ??
        source.minSuccessRate ??
        record.min_success_rate,
    ),
    notes: text(source, "notes", "observations", "description"),
    requiredEvents: stringList(
      source.required_events ?? source.requiredEvents ?? record.required_events,
    ),
  };
}

function hasCriteria(criteria: PromotionCriteria) {
  return (
    criteria.minSessions > 0 ||
    criteria.minSuccessRate != null ||
    criteria.minDistanceM != null ||
    criteria.maxAverageDurationS != null ||
    criteria.requiredEvents.length > 0 ||
    Boolean(criteria.notes)
  );
}

export function useTrainingCurriculums(): TrainingCurriculumsData {
  const [programsState, setProgramsState] = useState<SourceState>(emptyState);
  const [modulesState, setModulesState] = useState<SourceState>(emptyState);
  const [milestonesState, setMilestonesState] =
    useState<SourceState>(emptyState);

  useEffect(
    () => subscribeCollection("training_programs", setProgramsState),
    [],
  );

  useEffect(() => {
    if (programsState.loading) return;
    const programIds = programsState.records
      .filter((record) => !isDeleted(record))
      .map((record) => record._id)
      .sort((a, b) => a.localeCompare(b));

    return subscribeMany(
      programIds.map((programId) => ({
        key: programId,
        path: `training_programs/${programId}/modules`,
      })),
      setModulesState,
    );
  }, [programsState.loading, programsState.records]);

  useEffect(() => {
    if (modulesState.loading) return;
    const modulePaths = modulesState.records
      .filter((record) => !isDeleted(record))
      .map((record) => ({
        key: record._path,
        path: `${record._path}/milestones`,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));

    return subscribeMany(modulePaths, setMilestonesState);
  }, [modulesState.loading, modulesState.records]);

  return useMemo(() => {
    const milestonesByModule = milestonesState.records
      .filter((record) => !isDeleted(record))
      .reduce<Record<string, CurriculumMilestone[]>>((accumulator, record) => {
        const moduleId = record._moduleId;
        const programId = record._programId;
        if (!moduleId || !programId) return accumulator;
        const key = `${programId}:${moduleId}`;
        const milestone: CurriculumMilestone = {
          description: text(record, "description", "summary", "notes"),
          id: record._id,
          order: numberValue(record.order ?? record.index ?? record.sequence),
          required: booleanValue(record.required, true),
          title:
            text(record, "title", "label", "name") ||
            `Marco ${record._id}`,
        };
        accumulator[key] = [...(accumulator[key] ?? []), milestone];
        return accumulator;
      }, {});

    for (const key of Object.keys(milestonesByModule)) {
      milestonesByModule[key].sort((a, b) => a.order - b.order);
    }

    const modulesByProgram = modulesState.records
      .filter((record) => !isDeleted(record))
      .reduce<Record<string, CurriculumModule[]>>((accumulator, record) => {
        const programId = record._programId;
        if (!programId) return accumulator;
        const milestones = milestonesByModule[`${programId}:${record._id}`] ?? [];
        const criteria = criteriaFromRecord(record);
        const curriculumModule: CurriculumModule = {
          criteria,
          description: text(record, "description", "summary", "subtitle"),
          id: record._id,
          milestoneCount: milestones.length,
          milestones,
          order: numberValue(record.order ?? record.index ?? record.sequence),
          requiredMilestoneCount: milestones.filter((item) => item.required)
            .length,
          title:
            text(record, "title", "label", "name") ||
            `Módulo ${record._id}`,
        };
        accumulator[programId] = [
          ...(accumulator[programId] ?? []),
          curriculumModule,
        ];
        return accumulator;
      }, {});

    for (const key of Object.keys(modulesByProgram)) {
      modulesByProgram[key].sort((a, b) => a.order - b.order);
    }

    const programs = programsState.records
      .filter((record) => !isDeleted(record))
      .map((record): CurriculumProgram => {
        const modality = canônicalModality(
          text(record, "modality", "modality_id") || record._id,
        );
        return {
          active: booleanValue(record.active, true),
          description: text(record, "description", "summary", "subtitle"),
          id: record._id,
          label:
            text(record, "label", "name", "title") ||
            canônicalModalityLabel(modality),
          modality,
          modules: modulesByProgram[record._id] ?? [],
          version: text(record, "version", "program_version") || "v1",
        };
      })
      .sort((a, b) => {
        const orderA = canônicalK9Modalities.findIndex(
          (item) => item.value === a.modality,
        );
        const orderB = canônicalK9Modalities.findIndex(
          (item) => item.value === b.modality,
        );
        if (orderA !== orderB) return orderA - orderB;
        return a.label.localeCompare(b.label, "pt-BR");
      });

    const modules = programs.flatMap((program) => program.modules);
    const errors = [
      programsState.error,
      modulesState.error,
      milestonesState.error,
    ].filter((item): item is string => Boolean(item));

    return {
      errors,
      loading:
        programsState.loading ||
        modulesState.loading ||
        milestonesState.loading,
      metrics: {
        activePrograms: programs.filter((program) => program.active).length,
        criteriaBlocks: modules.filter((module) => hasCriteria(module.criteria))
          .length,
        milestones: modules.reduce(
          (total, module) => total + module.milestoneCount,
          0,
        ),
        modules: modules.length,
        programs: programs.length,
      },
      programs,
    };
  }, [milestonesState, modulesState, programsState]);
}
