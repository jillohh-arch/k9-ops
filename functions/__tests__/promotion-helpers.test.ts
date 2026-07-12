import { describe, expect, it } from "vitest";
import {
  buildDecisionFields,
  buildProgressUpdate,
  extractRaFromEmail,
  isTrainingInstructorClaims,
  resolveNextModule,
  validatePromotionState,
  type ModuleEntry,
  type ProgressDoc,
  type PromotionDoc,
} from "../src/promotion-helpers";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseModules: ModuleEntry[] = [
  { id: "mod-1", order: 1, title: "Fundamentos" },
  { id: "mod-2", order: 2, title: "Controle" },
  { id: "mod-3", order: 3, title: "Busca Avançada" },
];

function makeProgress(overrides: Partial<ProgressDoc> = {}): ProgressDoc {
  return {
    current_module: "mod-1",
    completed_module_ids: [],
    completed_modules: [],
    program_version: 1,
    status: "in_formation",
    achieved_milestones: {},
    ...overrides,
  };
}

function makePromotion(overrides: Partial<PromotionDoc> = {}): PromotionDoc {
  return {
    dog_id: "dog-bono",
    modality: "busca_captura",
    module_id: "mod-1",
    module_name: "Fundamentos",
    module_order: 1,
    program_id: "prog-bc",
    program_version: 1,
    status: "pending",
    ...overrides,
  };
}

// ─── extractRaFromEmail ──────────────────────────────────────────────────────

describe("extractRaFromEmail", () => {
  it("extracts RA from @gcm.com.br email", () => {
    expect(extractRaFromEmail("12345@gcm.com.br")).toBe("12345");
  });

  it("extracts RA from @canilgcm.com email", () => {
    expect(extractRaFromEmail("jilles@canilgcm.com")).toBe("jilles");
  });

  it("returns null for non-institutional email", () => {
    expect(extractRaFromEmail("user@gmail.com")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(extractRaFromEmail(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractRaFromEmail("")).toBeNull();
  });
});

// ─── isTrainingInstructorClaims ──────────────────────────────────────────────

describe("isTrainingInstructorClaims", () => {
  it("grants access for admin: true", () => {
    expect(isTrainingInstructorClaims({ admin: true })).toBe(true);
  });

  it("grants access for role: admin", () => {
    expect(isTrainingInstructorClaims({ role: "admin" })).toBe(true);
  });

  it("grants access for role: administrador", () => {
    expect(isTrainingInstructorClaims({ role: "administrador" })).toBe(true);
  });

  it("grants access for roles array with admin", () => {
    expect(isTrainingInstructorClaims({ roles: ["admin"] })).toBe(true);
  });

  it("grants access for instrutor claim", () => {
    expect(isTrainingInstructorClaims({ instrutor: true })).toBe(true);
  });

  it("grants access for adestrador claim", () => {
    expect(isTrainingInstructorClaims({ adestrador: true })).toBe(true);
  });

  it("grants access for instrutor_k9 claim", () => {
    expect(isTrainingInstructorClaims({ instrutor_k9: true })).toBe(true);
  });

  it("grants access for training_instructor claim", () => {
    expect(isTrainingInstructorClaims({ training_instructor: true })).toBe(true);
  });

  it("grants access for role: instrutor_k9", () => {
    expect(isTrainingInstructorClaims({ role: "instrutor_k9" })).toBe(true);
  });

  it("grants access for training_role: instrutor", () => {
    expect(isTrainingInstructorClaims({ training_role: "instrutor" })).toBe(true);
  });

  it("grants access for roles array with instrutor_k9", () => {
    expect(isTrainingInstructorClaims({ roles: ["instrutor_k9"] })).toBe(true);
  });

  it("denies access for empty claims", () => {
    expect(isTrainingInstructorClaims({})).toBe(false);
  });

  it("denies access for operador role", () => {
    expect(isTrainingInstructorClaims({ role: "operador_k9" })).toBe(false);
  });

  it("denies access for false instrutor claim", () => {
    expect(isTrainingInstructorClaims({ instrutor: false })).toBe(false);
  });

  it("denies access for non-matching roles array", () => {
    expect(isTrainingInstructorClaims({ roles: ["operador"] })).toBe(false);
  });
});

// ─── resolveNextModule ───────────────────────────────────────────────────────

describe("resolveNextModule", () => {
  it("finds next module in sequence", () => {
    const result = resolveNextModule(baseModules, "mod-1");
    expect(result.nextModuleId).toBe("mod-2");
    expect(result.isLastModule).toBe(false);
  });

  it("finds last module correctly", () => {
    const result = resolveNextModule(baseModules, "mod-3");
    expect(result.nextModuleId).toBeNull();
    expect(result.isLastModule).toBe(true);
  });

  it("handles middle module", () => {
    const result = resolveNextModule(baseModules, "mod-2");
    expect(result.nextModuleId).toBe("mod-3");
    expect(result.isLastModule).toBe(false);
  });

  it("returns null/false for non-existent module", () => {
    const result = resolveNextModule(baseModules, "mod-999");
    expect(result.nextModuleId).toBeNull();
    expect(result.isLastModule).toBe(false);
  });

  it("sorts modules by order regardless of input order", () => {
    const unsorted = [
      { id: "c", order: 3 },
      { id: "a", order: 1 },
      { id: "b", order: 2 },
    ];
    const result = resolveNextModule(unsorted, "a");
    expect(result.nextModuleId).toBe("b");
  });

  it("single module is always last", () => {
    const result = resolveNextModule([{ id: "only", order: 1 }], "only");
    expect(result.isLastModule).toBe(true);
    expect(result.nextModuleId).toBeNull();
  });

  it("does NOT treat absent next_module_id as last module", () => {
    const result = resolveNextModule(baseModules, "mod-1");
    expect(result.isLastModule).toBe(false);
  });
});

// ─── validatePromotionState ──────────────────────────────────────────────────

describe("validatePromotionState", () => {
  it("valid for correct state", () => {
    const result = validatePromotionState(makePromotion(), makeProgress(), baseModules);
    expect(result.valid).toBe(true);
  });

  it("invalid when status is not pending", () => {
    const result = validatePromotionState(
      makePromotion({ status: "approved" }),
      makeProgress(),
      baseModules,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("já foi analisada");
  });

  it("invalid when program version diverges", () => {
    const result = validatePromotionState(
      makePromotion({ program_version: 2 }),
      makeProgress({ program_version: 1 }),
      baseModules,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Versão do programa");
  });

  it("valid when progress has null program_version (legacy)", () => {
    const result = validatePromotionState(
      makePromotion({ program_version: 1 }),
      makeProgress({ program_version: null }),
      baseModules,
    );
    expect(result.valid).toBe(true);
  });

  it("invalid when module not in program", () => {
    const result = validatePromotionState(
      makePromotion({ module_id: "nonexistent" }),
      makeProgress(),
      baseModules,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("não pertence ao programa");
  });

  it("invalid when current_module diverges", () => {
    const result = validatePromotionState(
      makePromotion({ module_id: "mod-1" }),
      makeProgress({ current_module: "mod-2" }),
      baseModules,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("não corresponde");
  });

  it("valid when progress has null current_module (first time)", () => {
    const result = validatePromotionState(
      makePromotion({ module_id: "mod-1" }),
      makeProgress({ current_module: null }),
      baseModules,
    );
    expect(result.valid).toBe(true);
  });

  it("invalid when module already completed", () => {
    const result = validatePromotionState(
      makePromotion({ module_id: "mod-1" }),
      makeProgress({ completed_module_ids: ["mod-1"] }),
      baseModules,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("já foi concluído");
  });

  it("invalid for empty modules list (program has no modules)", () => {
    const result = validatePromotionState(makePromotion(), makeProgress(), []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("não pertence ao programa");
  });
});

// ─── buildProgressUpdate ─────────────────────────────────────────────────────

describe("buildProgressUpdate", () => {
  const decidedAt = new Date("2026-07-12T10:00:00Z");

  it("advances to next module for intermediate module", () => {
    const result = buildProgressUpdate(makeProgress(), makePromotion(), baseModules, "12345", decidedAt);
    expect(result.current_module).toBe("mod-2");
    expect(result.completed_module_ids).toEqual(["mod-1"]);
    expect(result.completed_modules).toHaveLength(1);
    expect(result.status).toBeUndefined();
  });

  it("sets operational for last module when in_formation", () => {
    const progress = makeProgress({ current_module: "mod-3", completed_module_ids: ["mod-1", "mod-2"] });
    const promotion = makePromotion({ module_id: "mod-3", module_order: 3 });
    const result = buildProgressUpdate(progress, promotion, baseModules, "12345", decidedAt);
    expect(result.current_module).toBeNull();
    expect(result.completed_module_ids).toEqual(["mod-1", "mod-2", "mod-3"]);
    expect(result.status).toBe("operational");
    expect(result.operational_since).toEqual(decidedAt);
  });

  it("does NOT set operational when already operational", () => {
    const progress = makeProgress({ current_module: "mod-3", completed_module_ids: ["mod-1", "mod-2"], status: "operational" });
    const promotion = makePromotion({ module_id: "mod-3", module_order: 3 });
    const result = buildProgressUpdate(progress, promotion, baseModules, "12345", decidedAt);
    expect(result.status).toBeUndefined();
    expect(result.operational_since).toBeUndefined();
  });

  it("does not duplicate module_id in completed_module_ids", () => {
    const progress = makeProgress({ completed_module_ids: ["mod-1"] });
    const promotion = makePromotion({ module_id: "mod-1" });
    const result = buildProgressUpdate(progress, promotion, baseModules, "12345", decidedAt);
    expect(result.completed_module_ids.filter((id) => id === "mod-1")).toHaveLength(1);
  });

  it("completed_modules entry has correct structure", () => {
    const result = buildProgressUpdate(makeProgress(), makePromotion(), baseModules, "12345", decidedAt);
    const entry = result.completed_modules[0] as Record<string, unknown>;
    expect(entry.module_id).toBe("mod-1");
    expect(entry.module_name).toBe("Fundamentos");
    expect(entry.module_order).toBe(1);
    expect(entry.completed_at).toEqual(decidedAt);
    expect(entry.decided_by).toBe("12345");
  });

  it("preserves existing completed_modules", () => {
    const existing = [{ module_id: "mod-0", completed_at: new Date() }];
    const progress = makeProgress({ current_module: "mod-1", completed_modules: existing });
    const result = buildProgressUpdate(progress, makePromotion(), baseModules, "12345", decidedAt);
    expect(result.completed_modules).toHaveLength(2);
    expect(result.completed_modules[0]).toBe(existing[0]);
  });

  it("resolves next module from matrix, not from next_module_id field", () => {
    const promotion = makePromotion({ module_id: "mod-2", next_module_id: "wrong-id" });
    const progress = makeProgress({ current_module: "mod-2", completed_module_ids: ["mod-1"] });
    const result = buildProgressUpdate(progress, promotion, baseModules, "12345", decidedAt);
    expect(result.current_module).toBe("mod-3");
  });
});

// ─── buildDecisionFields ─────────────────────────────────────────────────────

describe("buildDecisionFields", () => {
  it("approval with note", () => {
    const fields = buildDecisionFields("approved", "12345", "uid1", "12345@gcm.com.br", null, "Bom desempenho");
    expect(fields.status).toBe("approved");
    expect(fields.decision).toBe("approved");
    expect(fields.decision_by).toBe("12345");
    expect(fields.decision_by_uid).toBe("uid1");
    expect(fields.decision_by_email).toBe("12345@gcm.com.br");
    expect(fields.decision_reason).toBe("Bom desempenho");
  });

  it("approval without note returns null reason", () => {
    const fields = buildDecisionFields("approved", "12345", "uid1", "12345@gcm.com.br", null, null);
    expect(fields.decision_reason).toBeNull();
  });

  it("rejection uses reason", () => {
    const fields = buildDecisionFields("rejected", "12345", "uid1", "12345@gcm.com.br", "Insuficiente", null);
    expect(fields.status).toBe("rejected");
    expect(fields.decision_reason).toBe("Insuficiente");
  });

  it("rejection trims reason", () => {
    const fields = buildDecisionFields("rejected", "12345", "uid1", "12345@gcm.com.br", "  texto  ", null);
    expect(fields.decision_reason).toBe("texto");
  });

  it("decision_by is RA, not display name", () => {
    const fields = buildDecisionFields("approved", "jilles", "uid1", "jilles@gcm.com.br", null, null);
    expect(fields.decision_by).toBe("jilles");
  });
});

// ─── Integration: progress absent → failure ──────────────────────────────────

describe("integration scenarios", () => {
  it("next_module_id absent in promotion does NOT conclude training", () => {
    const promotion = makePromotion({ module_id: "mod-1", next_module_id: undefined });
    const { nextModuleId, isLastModule } = resolveNextModule(baseModules, promotion.module_id);
    expect(isLastModule).toBe(false);
    expect(nextModuleId).toBe("mod-2");
  });

  it("only true last module in matrix concludes training", () => {
    const promotion = makePromotion({ module_id: "mod-3" });
    const { isLastModule } = resolveNextModule(baseModules, promotion.module_id);
    expect(isLastModule).toBe(true);
  });

  it("rejection does not need progress validation", () => {
    const fields = buildDecisionFields("rejected", "ra", "uid", "ra@gcm.com.br", "Motivo", null);
    expect(fields.status).toBe("rejected");
  });
});
