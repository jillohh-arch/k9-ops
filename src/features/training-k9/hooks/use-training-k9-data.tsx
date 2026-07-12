"use client";

/**
 * Lean data hook for the Training K9 module.
 *
 * Loads only data required by the Visão Geral and Cães em Treinamento tabs:
 * - dogs (effective)
 * - users (effective, for conductor enrichment)
 * - training progress per dog (dogs/{id}/training)
 * - training programs + modules + milestones
 * - promotion requests
 *
 * Does NOT load:
 * - trainings (legacy)
 * - training_sessions (top-level)
 * - dogs/{id}/training_sessions
 *
 * Those will be loaded on-demand when the Sessões tab is implemented.
 *
 * Listener estimate:
 * - Fixed: training_programs (1), promotion_requests (1)
 * - Per-program: modules subcollection (P listeners)
 * - Per-program-module: milestones subcollection (M listeners)
 * - Per-dog: dogs/{id}/training (N listeners)
 * - Effective: dogs (1), users (1) — shared via useEntities
 *
 * Total ≈ 4 + P + M + N where P=programs, M=modules, N=dogs
 * Example: 4 programs, 12 modules, 10 dogs = ~30 listeners
 */

import {
  collection,
  onSnapshot,
  type DocumentData,
} from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  canônicalK9Modalities,
  canônicalModality,
  canônicalModalityLabel,
} from "@/features/effective/lib/k9-modalities";
import {
  useEffectiveData,
  type EffectiveDog,
  type EffectiveUser,
} from "@/features/effective/hooks/use-effective-data";
import { db } from "@/lib/firebase/client";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useAuth } from "@/features/auth/providers/auth-provider";

// ─── Internal types ────────────────────────────────────────────────────────────

type RawRecord = DocumentData & { _id: string; _path: string; _programId?: string; _moduleId?: string; _dogId?: string };

type SourceState = {
  error: string | null;
  loading: boolean;
  records: RawRecord[];
};

const emptySource: SourceState = { error: null, loading: true, records: [] };
const emptyDoneSource: SourceState = { error: null, loading: false, records: [] };

// ─── Exported types ────────────────────────────────────────────────────────────

export type TrainingK9Dog = {
  breed: string | null;
  cells: TrainingK9Cell[];
  conductorName: string | null;
  conductorRa: string | null;
  dogId: string;
  dogName: string;
  inFormationCount: number;
  operationalCount: number;
  pendingPromotions: number;
  photoUrl: string | null;
  registrationNumber: string | null;
  status: string;
};

export type TrainingK9Cell = {
  achievedMilestonesCount: number;
  completedModules: number;
  currentModule: string | null;
  label: string;
  modality: string;
  pendingPromotions: number;
  source: "none" | "progress" | "specialty";
  status: string;
  statusLabel: string;
  tone: "amber" | "cyan" | "emerald" | "slate";
};

export type TrainingK9Program = {
  active: boolean;
  id: string;
  label: string;
  milestoneCount: number;
  modality: string;
  moduleCount: number;
  modules: Array<{ id: string; milestoneCount: number; order: number; title: string }>;
};

export type TrainingK9Promotion = {
  dogId: string | null;
  id: string;
  modality: string;
  moduleId: string | null;
  requestedAt: Date | null;
  requestedBy: string | null;
  status: string;
};

export type TrainingK9Data = {
  dogs: TrainingK9Dog[];
  effectiveDogs: EffectiveDog[];
  errors: string[];
  loading: boolean;
  metrics: {
    activeDogs: number;
    activePrograms: number;
    dogsInFormation: number;
    milestones: number;
    operationalDogs: number;
    pendingPromotions: number;
    programs: number;
  };
  pendingPromotions: TrainingK9Promotion[];
  programs: TrainingK9Program[];
  users: EffectiveUser[];
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function metadataFromPath(path: string) {
  const segments = path.split("/");
  const after = (segment: string) => {
    const index = segments.indexOf(segment);
    return index >= 0 ? segments[index + 1] : undefined;
  };
  return { dogId: after("dogs"), moduleId: after("modules"), programId: after("training_programs") };
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
          const p = item.ref.path;
          const meta = metadataFromPath(p);
          return { ...item.data(), _id: item.id, _path: p, _programId: meta.programId, _moduleId: meta.moduleId, _dogId: meta.dogId };
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
  const pending = new Set(definitions.map((d) => d.key));
  const errors = new Map<string, string>();

  if (definitions.length === 0) {
    setter(emptyDoneSource);
    return () => undefined;
  }

  const publish = () => {
    setter({
      error: errors.size ? Array.from(errors.values()).join(" | ") : null,
      loading: pending.size > 0,
      records: Array.from(groups.values()).flat(),
    });
  };

  const unsubscribes = definitions.map((def) =>
    onSnapshot(
      collection(db, def.path),
      (snapshot) => {
        groups.set(def.key, snapshot.docs.map((item) => {
          const p = item.ref.path;
          const meta = metadataFromPath(p);
          return { ...item.data(), _id: item.id, _path: p, _programId: meta.programId, _moduleId: meta.moduleId, _dogId: meta.dogId };
        }));
        pending.delete(def.key);
        errors.delete(def.key);
        publish();
      },
      (error) => {
        pending.delete(def.key);
        errors.set(def.key, `${def.path}: ${error.message}`);
        publish();
      },
    ),
  );

  return () => unsubscribes.forEach((u) => u());
}

function text(...values: unknown[]) {
  for (const v of values) {
    if (typeof v === "string" || typeof v === "number") {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return null;
}

function booleanValue(v: unknown, fallback = true) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "sim", "ativo", "active"].includes(s)) return true;
    if (["false", "0", "nao", "inativo", "inactive"].includes(s)) return false;
  }
  return fallback;
}

function normalized(v: unknown) {
  return String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function isDeleted(r: DocumentData) {
  return r.deleted_at != null || r.deletedAt != null || r.archived_at != null;
}

function visible(records: RawRecord[]) {
  return records.filter((r) => !isDeleted(r));
}

function dateValue(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (v && typeof v === "object" && "toDate" in v) {
    const fn = (v as { toDate?: unknown }).toDate;
    if (typeof fn === "function") {
      const d = fn.call(v);
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
  }
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function arrayOrObjectCount(v: unknown) {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === "object") return Object.keys(v).length;
  return 0;
}

function statusOf(r: DocumentData) {
  return normalized(r.status ?? r.state);
}

function formatCurrentModule(v: unknown) {
  const s = text(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? `Módulo ${n}` : s;
}

function cellTone(status: string, pending: number): TrainingK9Cell["tone"] {
  const s = normalized(status);
  if (pending > 0) return "amber";
  if (s === "operational" || s === "operacional") return "emerald";
  if (s === "in_formation" || s === "em_formacao") return "cyan";
  return "slate";
}

function cellStatusLabel(status: string, currentModule: string | null, pending: number) {
  const s = normalized(status);
  if (pending > 0) return "Aguardando avaliação";
  if (s === "operational" || s === "operacional") return "Operacional";
  if (s === "in_formation" || s === "em_formacao") return currentModule ?? "Em formação";
  return "Não iniciado";
}

function isOperational(s: string) { const n = normalized(s); return n === "operational" || n === "operacional"; }
function isInFormation(s: string) { const n = normalized(s); return n === "in_formation" || n === "em_formacao" || n === "formation"; }

// ─── Context ───────────────────────────────────────────────────────────────────

const TrainingK9Context = createContext<TrainingK9Data | null>(null);

export function useTrainingK9Data(): TrainingK9Data {
  const ctx = useContext(TrainingK9Context);
  if (!ctx) throw new Error("useTrainingK9Data must be used within TrainingK9DataProvider");
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────────

export function TrainingK9DataProvider({ children }: { children: ReactNode }) {
  const { can, status: accessStatus } = useAccessControl();
  const { status: authStatus } = useAuth();
  const effective = useEffectiveData();

  const [programsState, setProgramsState] = useState<SourceState>(emptySource);
  const [modulesState, setModulesState] = useState<SourceState>(emptySource);
  const [milestonesState, setMilestonesState] = useState<SourceState>(emptySource);
  const [progressState, setProgressState] = useState<SourceState>(emptySource);
  const [promotionsState, setPromotionsState] = useState<SourceState>(emptySource);

  const canReadPromotions =
    can("training", "approve") || can("training", "audit") ||
    can("training_matrix", "approve") || can("training_matrix", "audit");

  // Programs (1 listener)
  useEffect(() => subscribeCollection("training_programs", setProgramsState), []);

  // Modules per program (P listeners)
  useEffect(() => {
    if (programsState.loading) return;
    const ids = visible(programsState.records).map((r) => r._id).filter(Boolean).sort();
    return subscribeMany(
      ids.map((id) => ({ key: id, path: `training_programs/${id}/modules` })),
      setModulesState,
    );
  }, [programsState.loading, programsState.records]);

  // Milestones per module (M listeners)
  useEffect(() => {
    if (modulesState.loading) return;
    const modulePaths = visible(modulesState.records)
      .map((r) => ({ key: r._path, path: `${r._path}/milestones` }))
      .sort((a, b) => a.path.localeCompare(b.path));
    if (modulePaths.length === 0) {
      Promise.resolve().then(() => setMilestonesState(emptyDoneSource));
      return;
    }
    return subscribeMany(modulePaths, setMilestonesState);
  }, [modulesState.loading, modulesState.records]);

  // Promotion requests (1 listener)
  useEffect(() => {
    if (authStatus !== "authenticated" || accessStatus === "loading") return;
    if (canReadPromotions) {
      return subscribeCollection("promotion_requests", setPromotionsState);
    }
    Promise.resolve().then(() => setPromotionsState(emptyDoneSource));
  }, [accessStatus, authStatus, canReadPromotions]);

  // Progress per dog (N listeners)
  useEffect(() => {
    if (effective.loading) return;
    const dogIds = effective.dogs.map((d) => d.id).filter(Boolean).sort();
    return subscribeMany(
      dogIds.map((id) => ({ key: id, path: `dogs/${id}/training` })),
      setProgressState,
    );
  }, [effective.dogs, effective.loading]);

  const data = useMemo((): TrainingK9Data => {
    // Build milestones count per module from subcollection
    const milestoneCountByModule = new Map<string, number>();
    for (const r of visible(milestonesState.records)) {
      const programId = r._programId;
      const moduleId = r._moduleId;
      if (!programId || !moduleId) continue;
      const key = `${programId}:${moduleId}`;
      milestoneCountByModule.set(key, (milestoneCountByModule.get(key) ?? 0) + 1);
    }

    // Build modules grouped by program
    const moduleRecordsByProgram = new Map<string, RawRecord[]>();
    for (const r of visible(modulesState.records)) {
      const pid = r._programId;
      if (!pid) continue;
      const list = moduleRecordsByProgram.get(pid) ?? [];
      list.push(r);
      moduleRecordsByProgram.set(pid, list);
    }

    const programs: TrainingK9Program[] = visible(programsState.records).map((r) => {
      const raw = text(r.modality, r.modality_id, r._id);
      const modality = raw ? canônicalModality(raw) : r._id;
      const moduleRecs = (moduleRecordsByProgram.get(r._id) ?? [])
        .sort((a, b) => (Number(a.order ?? 0)) - (Number(b.order ?? 0)));
      const modules = moduleRecs.map((m) => ({
        id: m._id,
        milestoneCount: milestoneCountByModule.get(`${r._id}:${m._id}`) || arrayOrObjectCount(m.milestones) || Number(m.milestone_count ?? m.milestoneCount ?? 0),
        order: Number(m.order ?? 0),
        title: text(m.title, m.label, m.name) ?? `Módulo ${m._id}`,
      }));
      const totalMilestones = modules.reduce((sum, m) => sum + m.milestoneCount, 0);

      return {
        active: booleanValue(r.active, true),
        id: r._id,
        label: text(r.name, r.label, r.title) ?? canônicalModalityLabel(modality),
        milestoneCount: totalMilestones,
        modality,
        moduleCount: moduleRecs.length,
        modules,
      };
    }).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

    // Progress by dog×modality
    type ProgressEntry = { achievedMilestones: number; completedModules: number; currentModule: string | null; dogId: string; modality: string; status: string };
    const progressByKey = new Map<string, ProgressEntry>();
    for (const r of visible(progressState.records)) {
      const dogId = text(r.dogId, r.dog_id, r._dogId);
      const modality = canônicalModality(text(r.modality, r.modality_id, r.type, r._id) ?? r._id);
      if (!dogId || !modality) continue;
      const key = `${dogId}:${modality}`;
      const entry: ProgressEntry = {
        achievedMilestones: arrayOrObjectCount(r.achieved_milestones ?? r.achievedMilestones ?? r.milestones_achieved ?? r.marks_snapshot ?? r.marksSnapshot),
        completedModules: arrayOrObjectCount(r.completed_modules ?? r.completedModules),
        currentModule: formatCurrentModule(r.current_module ?? r.currentModule),
        dogId,
        modality,
        status: statusOf(r) || "not_started",
      };
      const prev = progressByKey.get(key);
      if (!prev || priorityOf(entry.status) >= priorityOf(prev.status)) {
        progressByKey.set(key, entry);
      }
    }

    // Promotions
    const pendingPromotions: TrainingK9Promotion[] = visible(promotionsState.records)
      .filter((r) => {
        const s = statusOf(r);
        return ["pending", "open", "requested", "aguardando", "submitted"].includes(s) &&
          r.resolved_at == null && r.resolvedAt == null && r.decided_at == null && r.decidedAt == null;
      })
      .map((r): TrainingK9Promotion => ({
        dogId: text(r.dogId, r.dog_id, r._dogId),
        id: r._id,
        modality: canônicalModality(text(r.modality, r.modality_id, r.training_modality) ?? "") || "treino_geral",
        moduleId: text(r.module_id, r.moduleId, r.current_module),
        requestedAt: dateValue(r.started_at ?? r.created_at ?? r.createdAt ?? r.requested_at ?? r.requestedAt),
        requestedBy: text(r.requested_by, r.requestedBy, r.conductor_ra, r.conductorRa),
        status: statusOf(r) || "pending",
      }))
      .sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0));

    // Build dog summaries
    const userMap = new Map(effective.users.map((u) => [u.ra, u]));

    const dogs: TrainingK9Dog[] = effective.dogs.map((eDog) => {
      const dogPromotions = pendingPromotions.filter((p) => p.dogId === eDog.id);
      const conductor = eDog.conductorRa ? userMap.get(eDog.conductorRa) : null;

      const cells: TrainingK9Cell[] = canônicalK9Modalities.map((mod) => {
        const progress = progressByKey.get(`${eDog.id}:${mod.value}`);
        const specialty = eDog.specialties.find((s) => canônicalModality(s.type) === mod.value);
        const modalPromotions = dogPromotions.filter((p) => p.modality === mod.value);
        const status = progress?.status ?? specialty?.status ?? "not_started";
        const currentModule = progress?.currentModule ?? null;
        const pending = modalPromotions.length;

        return {
          achievedMilestonesCount: progress?.achievedMilestones ?? 0,
          completedModules: progress?.completedModules ?? 0,
          currentModule,
          label: mod.label,
          modality: mod.value,
          pendingPromotions: pending,
          source: progress ? "progress" as const : specialty ? "specialty" as const : "none" as const,
          status,
          statusLabel: cellStatusLabel(status, currentModule, pending),
          tone: cellTone(status, pending),
        };
      });

      return {
        breed: eDog.breed,
        cells,
        conductorName: conductor?.fullName ?? conductor?.callsign ?? null,
        conductorRa: eDog.conductorRa,
        dogId: eDog.id,
        dogName: eDog.name,
        inFormationCount: cells.filter((c) => isInFormation(c.status)).length,
        operationalCount: cells.filter((c) => isOperational(c.status)).length,
        pendingPromotions: dogPromotions.length,
        photoUrl: eDog.profileImageUrl,
        registrationNumber: eDog.registrationNumber,
        status: eDog.status,
      };
    }).sort((a, b) => a.dogName.localeCompare(b.dogName, "pt-BR"));

    const errors = [
      effective.error,
      programsState.error,
      modulesState.error,
      progressState.error,
      promotionsState.error,
    ].filter((e): e is string => Boolean(e));

    return {
      dogs,
      effectiveDogs: effective.dogs,
      errors,
      loading: effective.loading || programsState.loading || modulesState.loading || milestonesState.loading || progressState.loading || promotionsState.loading,
      metrics: {
        activeDogs: effective.dogs.length,
        activePrograms: programs.filter((p) => p.active).length,
        dogsInFormation: dogs.filter((d) => d.inFormationCount > 0).length,
        milestones: programs.reduce((sum, p) => sum + p.milestoneCount, 0),
        operationalDogs: dogs.filter((d) => d.operationalCount > 0).length,
        pendingPromotions: pendingPromotions.length,
        programs: programs.length,
      },
      pendingPromotions,
      programs,
      users: effective.users,
    };
  }, [effective, milestonesState, modulesState, programsState, progressState, promotionsState]);

  return (
    <TrainingK9Context.Provider value={data}>
      {children}
    </TrainingK9Context.Provider>
  );
}

// ─── Internal ──────────────────────────────────────────────────────────────────

function priorityOf(status: string) {
  const s = normalized(status);
  if (s === "operational" || s === "operacional") return 3;
  if (s === "in_formation" || s === "em_formacao") return 2;
  return 1;
}
