import type { TrainingDogSummary, TrainingMatrixCell, TrainingSessionSummary } from "@/features/training/hooks/use-training-data";
import type { CurriculumProgram } from "@/features/training-curriculums/hooks/use-training-curriculums";
import type { ModalityView } from "./training-matrix-types";

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function hasRealValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number" && Number.isNaN(value)) return false;
  const str = String(value).trim();
  return str !== "" && str !== "--";
}

export function progressWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export function currentModuleOrder(value: unknown): number | null {
  if (value == null) return null;
  const str = String(value);
  const match = str.match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function countEventsMatched(
  sessions: TrainingSessionSummary[],
  requiredEvents: string[],
) {
  if (!requiredEvents.length) return 0;
  const seen = new Set(
    sessions.flatMap((session) =>
      (session.events ?? []).map((event) => normalized(event)),
    ),
  );
  return requiredEvents.filter((event) => seen.has(normalized(event))).length;
}

export function scorePart(value: number, target: number | null) {
  if (!target || target <= 0) return null;
  return Math.min(100, (value / target) * 100);
}

export function programForModality(
  programs: CurriculumProgram[],
  modality: string,
) {
  return (
    programs.find((program) => program.modality === modality && program.active) ??
    programs.find((program) => program.modality === modality) ??
    null
  );
}

export function moduleForCell(
  program: CurriculumProgram | null,
  cell: TrainingMatrixCell,
) {
  if (!program?.modules.length) return null;
  const order = currentModuleOrder(cell.currentModule);
  if (order != null) {
    return (
      program.modules.find((module) => module.order === order) ??
      program.modules[order - 1] ??
      program.modules[0]
    );
  }
  return program.modules[cell.completedModules] ?? program.modules[0];
}

export function emptyCell(modality: ModalityView): TrainingMatrixCell {
  return {
    achievedMilestonesCount: 0,
    completedModules: 0,
    currentModule: null,
    label: modality.label,
    lastSessionAt: null,
    modality: modality.value,
    pendingPromotions: 0,
    programVersion: null,
    sessionCount: 0,
    source: "none",
    status: "not_started",
    statusLabel: "Não iniciado",
    tone: "slate",
  };
}

export function cellForDog(dog: TrainingDogSummary, modality: ModalityView) {
  return (
    dog.cells.find((cell) => cell.modality === modality.value) ??
    emptyCell(modality)
  );
}
