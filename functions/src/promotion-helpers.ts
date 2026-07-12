/**
 * Pure helpers for decidePromotionRequest.
 * Extracted for testability without Firebase emulator.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ModuleEntry {
  id: string;
  order: number;
  title?: string;
}

export interface ProgressDoc {
  current_module: string | null;
  completed_module_ids: string[];
  completed_modules: unknown[];
  program_version: number | null;
  status: string;
  achieved_milestones: Record<string, unknown>;
}

export interface PromotionDoc {
  dog_id: string;
  modality: string;
  module_id: string;
  module_name?: string;
  module_order?: number;
  program_id: string;
  program_version: number;
  status: string;
  next_module_id?: string | null;
}

export interface CompletedModuleEntry {
  module_id: string;
  module_name: string | null;
  module_order: number | null;
  completed_at: Date;
  decided_by: string;
}

export interface ResolvedNextModule {
  nextModuleId: string | null;
  isLastModule: boolean;
}

// ─── Authorization ───────────────────────────────────────────────────────────

const INSTRUCTOR_CLAIMS = ["instrutor", "adestrador", "instrutor_k9", "training_instructor"] as const;
const INSTRUCTOR_ROLES = ["instrutor", "adestrador", "instrutor_k9"] as const;

export function extractRaFromEmail(email: string | undefined): string | null {
  if (!email) return null;
  const match = /^(.+)@(gcm\.com\.br|canilgcm\.com)$/.exec(email);
  return match ? match[1] : null;
}

export function isTrainingInstructorClaims(claims: Record<string, unknown>): boolean {
  if (claims.admin === true) return true;
  if (claims.role === "admin" || claims.role === "administrador") return true;
  const roles = claims.roles;
  if (Array.isArray(roles) && (roles.includes("admin") || roles.includes("administrador"))) return true;

  for (const claim of INSTRUCTOR_CLAIMS) {
    if (claims[claim] === true) return true;
  }
  if (typeof claims.role === "string" && claims.role === "instrutor_k9") return true;
  if (typeof claims.training_role === "string" && INSTRUCTOR_ROLES.includes(claims.training_role as typeof INSTRUCTOR_ROLES[number])) return true;
  if (Array.isArray(roles) && roles.some((r: unknown) => typeof r === "string" && INSTRUCTOR_ROLES.includes(r as typeof INSTRUCTOR_ROLES[number]))) return true;

  return false;
}

// ─── Module Resolution ───────────────────────────────────────────────────────

export function resolveNextModule(
  modules: ModuleEntry[],
  currentModuleId: string,
): ResolvedNextModule {
  const sorted = [...modules].sort((a, b) => a.order - b.order);
  const currentIndex = sorted.findIndex((m) => m.id === currentModuleId);

  if (currentIndex === -1) {
    return { nextModuleId: null, isLastModule: false };
  }

  if (currentIndex >= sorted.length - 1) {
    return { nextModuleId: null, isLastModule: true };
  }

  return {
    nextModuleId: sorted[currentIndex + 1].id,
    isLastModule: false,
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePromotionState(
  promotion: PromotionDoc,
  progress: ProgressDoc,
  modules: ModuleEntry[],
): ValidationResult {
  if (promotion.status !== "pending") {
    return { valid: false, error: "Esta solicitação já foi analisada." };
  }

  if (promotion.program_version != null && progress.program_version != null
    && promotion.program_version !== progress.program_version) {
    return { valid: false, error: "Versão do programa diverge do progresso atual do K9." };
  }

  const moduleExists = modules.some((m) => m.id === promotion.module_id);
  if (!moduleExists) {
    return { valid: false, error: "Módulo da solicitação não pertence ao programa." };
  }

  if (progress.current_module && promotion.module_id !== progress.current_module) {
    return { valid: false, error: "Módulo atual do K9 não corresponde à solicitação." };
  }

  if (progress.completed_module_ids.includes(promotion.module_id)) {
    return { valid: false, error: "Este módulo já foi concluído anteriormente." };
  }

  return { valid: true };
}

// ─── Progress Update Builder ─────────────────────────────────────────────────

export interface ProgressUpdate {
  current_module: string | null;
  completed_module_ids: string[];
  completed_modules: unknown[];
  status?: string;
  operational_since?: unknown;
}

export function buildProgressUpdate(
  progress: ProgressDoc,
  promotion: PromotionDoc,
  modules: ModuleEntry[],
  decidedBy: string,
  decidedAt: Date,
): ProgressUpdate {
  const { nextModuleId, isLastModule } = resolveNextModule(modules, promotion.module_id);

  const completedModuleIds = [...progress.completed_module_ids];
  if (!completedModuleIds.includes(promotion.module_id)) {
    completedModuleIds.push(promotion.module_id);
  }

  const completedModules = [...progress.completed_modules];
  const entry: CompletedModuleEntry = {
    module_id: promotion.module_id,
    module_name: promotion.module_name ?? null,
    module_order: promotion.module_order ?? null,
    completed_at: decidedAt,
    decided_by: decidedBy,
  };
  completedModules.push(entry);

  const update: ProgressUpdate = {
    current_module: nextModuleId,
    completed_module_ids: completedModuleIds,
    completed_modules: completedModules,
  };

  if (isLastModule && progress.status === "in_formation") {
    update.status = "operational";
  }

  return update;
}

// ─── Decision Update Builder ─────────────────────────────────────────────────

export interface DecisionFields {
  status: string;
  decision: string;
  decision_by: string;
  decision_by_uid: string;
  decision_by_email: string;
  decision_reason: string | null;
}

export function buildDecisionFields(
  decision: "approved" | "rejected",
  ra: string,
  uid: string,
  email: string,
  reason: string | null,
  note: string | null,
): DecisionFields {
  const decisionReason = decision === "rejected"
    ? (reason?.trim() || "")
    : (note?.trim() || reason?.trim() || null);

  return {
    status: decision,
    decision,
    decision_by: ra,
    decision_by_uid: uid,
    decision_by_email: email,
    decision_reason: decisionReason || null,
  };
}
