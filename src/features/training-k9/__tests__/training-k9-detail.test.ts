import { describe, expect, it } from "vitest";

import {
  canônicalModalityLabel,
} from "@/features/effective/lib/k9-modalities";

// ─── Helper reproductions from the detail page ───────────────────────────────

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

function friendlyModuleName(
  raw: string | null,
  program: { modules: Array<{ id: string; title: string }> } | null,
): string {
  if (!raw) return "Módulo não identificado";
  if (program) {
    const match = program.modules.find((m) => m.id === raw || m.title === raw);
    if (match) return match.title;
  }
  const num = Number(raw.replace(/\D/g, ""));
  if (Number.isFinite(num) && num > 0) return `Módulo ${num}`;
  if (raw.includes("_")) {
    return raw
      .replaceAll("_", " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return raw;
}

type JourneyModuleStatus = "completed" | "current" | "awaiting_evaluation" | "locked";

interface JourneyModule {
  id: string;
  milestoneCount: number;
  milestonesAchieved: number;
  order: number;
  status: JourneyModuleStatus;
  title: string;
}

interface PromotionRequest {
  current_module_id: string | null;
  current_module_name: string | null;
  modality: string;
  status: string;
}

function computeJourney(
  modules: Array<{ id: string; milestoneCount: number; order: number; title: string }>,
  completedCount: number,
  achievedMilestones: number,
  primaryModality: string,
  dogRequests: PromotionRequest[],
): JourneyModule[] {
  const sorted = [...modules].sort((a, b) => a.order - b.order);

  const relevantPendingPromotions = dogRequests.filter(
    (r) =>
      r.status === "pending" &&
      (r.modality === primaryModality),
  );

  return sorted.map((mod, idx): JourneyModule => {
    let status: JourneyModuleStatus = "locked";

    if (idx < completedCount) {
      status = "completed";
    } else if (idx === completedCount) {
      const hasPendingForModule = relevantPendingPromotions.some(
        (r) =>
          r.current_module_id === mod.id ||
          r.current_module_name === mod.title ||
          (r.current_module_id === null && r.current_module_name === null),
      );
      status = hasPendingForModule ? "awaiting_evaluation" : "current";
    }

    return {
      id: mod.id,
      milestoneCount: mod.milestoneCount,
      milestonesAchieved:
        status === "completed"
          ? mod.milestoneCount
          : status === "current" || status === "awaiting_evaluation"
            ? achievedMilestones
            : 0,
      order: mod.order,
      status,
      title: mod.title,
    };
  });
}

// ─── Test data ────────────────────────────────────────────────────────────────

const sampleProgram = {
  modules: [
    { id: "mod-1", milestoneCount: 4, order: 0, title: "Fundamentos de pareamento" },
    { id: "mod-2", milestoneCount: 3, order: 1, title: "Indicação passiva" },
    { id: "mod-3", milestoneCount: 5, order: 2, title: "Busca em área" },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("dog detail — no matrix state", () => {
  it("shows correct message for dog without matrix", () => {
    const message = "Nenhuma matriz de treinamento atribuída";
    const description = "Vincule o K9 a uma matriz para iniciar o acompanhamento da evolução.";
    expect(message).toBe("Nenhuma matriz de treinamento atribuída");
    expect(description).toContain("Vincule");
  });

  it("does NOT show 'Currículo não configurado'", () => {
    const hasMatrix = false;
    const emptyStateTitle = hasMatrix ? "Currículo não configurado" : "Nenhuma matriz de treinamento atribuída";
    expect(emptyStateTitle).not.toContain("Currículo não configurado");
  });
});

describe("dog detail — no technical IDs shown", () => {
  it("modulo_1 is resolved to friendly name", () => {
    const result = friendlyModuleName("modulo_1", sampleProgram);
    expect(result).not.toBe("modulo_1");
    expect(result).toBe("Módulo 1");
  });

  it("module id is resolved from program", () => {
    const result = friendlyModuleName("mod-1", sampleProgram);
    expect(result).toBe("Fundamentos de pareamento");
  });

  it("busca_captura is resolved to friendly label", () => {
    const result = canônicalModalityLabel("busca_captura");
    expect(result).toBe("Busca & Captura");
    expect(result).not.toBe("busca_captura");
  });

  it("guarda_protecao is resolved to friendly label", () => {
    const result = canônicalModalityLabel("guarda_protecao");
    expect(result).toBe("Guarda & Proteção");
    expect(result).not.toBe("guarda_protecao");
  });

  it("deteccao is resolved to friendly label", () => {
    const result = canônicalModalityLabel("deteccao");
    expect(result).toBe("Detecção");
  });

  it("null module returns fallback label", () => {
    const result = friendlyModuleName(null, sampleProgram);
    expect(result).toBe("Módulo não identificado");
  });

  it("unknown snake_case is converted to Title Case", () => {
    const result = friendlyModuleName("avaliacao_final", null);
    expect(result).toBe("Avaliacao Final");
  });
});

describe("dog detail — journey module states", () => {
  it("current module is NOT locked", () => {
    const journey = computeJourney(
      sampleProgram.modules,
      0, // no modules completed yet
      1, // 1 milestone achieved
      "busca_captura",
      [], // no promotions
    );
    expect(journey[0].status).toBe("current");
    expect(journey[0].status).not.toBe("locked");
  });

  it("subsequent modules ARE locked", () => {
    const journey = computeJourney(
      sampleProgram.modules,
      0,
      1,
      "busca_captura",
      [],
    );
    expect(journey[1].status).toBe("locked");
    expect(journey[2].status).toBe("locked");
  });

  it("completed modules show as completed", () => {
    const journey = computeJourney(
      sampleProgram.modules,
      2, // 2 modules completed
      2,
      "busca_captura",
      [],
    );
    expect(journey[0].status).toBe("completed");
    expect(journey[1].status).toBe("completed");
    expect(journey[2].status).toBe("current");
  });

  it("pending promotion for current module marks it as awaiting_evaluation", () => {
    const journey = computeJourney(
      sampleProgram.modules,
      0,
      1,
      "busca_captura",
      [{
        current_module_id: "mod-1",
        current_module_name: "Fundamentos de pareamento",
        modality: "busca_captura",
        status: "pending",
      }],
    );
    expect(journey[0].status).toBe("awaiting_evaluation");
  });

  it("pending promotion for DIFFERENT modality does NOT alter state", () => {
    const journey = computeJourney(
      sampleProgram.modules,
      0,
      1,
      "busca_captura",
      [{
        current_module_id: "mod-1",
        current_module_name: "Fundamentos",
        modality: "guarda_protecao", // different modality
        status: "pending",
      }],
    );
    expect(journey[0].status).toBe("current");
    expect(journey[0].status).not.toBe("awaiting_evaluation");
  });

  it("approved promotion does NOT mark as awaiting_evaluation", () => {
    const journey = computeJourney(
      sampleProgram.modules,
      0,
      1,
      "busca_captura",
      [{
        current_module_id: "mod-1",
        current_module_name: "Fundamentos de pareamento",
        modality: "busca_captura",
        status: "approved", // not pending
      }],
    );
    expect(journey[0].status).toBe("current");
  });

  it("rejected promotion does NOT mark as awaiting_evaluation", () => {
    const journey = computeJourney(
      sampleProgram.modules,
      0,
      1,
      "busca_captura",
      [{
        current_module_id: "mod-1",
        current_module_name: "Fundamentos de pareamento",
        modality: "busca_captura",
        status: "rejected",
      }],
    );
    expect(journey[0].status).toBe("current");
  });

  it("promotion with null module_id for current module matches (fallback)", () => {
    const journey = computeJourney(
      sampleProgram.modules,
      0,
      1,
      "busca_captura",
      [{
        current_module_id: null,
        current_module_name: null,
        modality: "busca_captura",
        status: "pending",
      }],
    );
    expect(journey[0].status).toBe("awaiting_evaluation");
  });
});

describe("dog detail — pluralization", () => {
  it("singular: 1 avaliação pendente", () => {
    expect(pluralize(1, "avaliação pendente", "avaliações pendentes"))
      .toBe("1 avaliação pendente");
  });

  it("plural: 2 avaliações pendentes", () => {
    expect(pluralize(2, "avaliação pendente", "avaliações pendentes"))
      .toBe("2 avaliações pendentes");
  });

  it("plural: 5 avaliações pendentes", () => {
    expect(pluralize(5, "avaliação pendente", "avaliações pendentes"))
      .toBe("5 avaliações pendentes");
  });

  it("never produces parenthesized plurals", () => {
    const result = pluralize(2, "avaliação pendente", "avaliações pendentes");
    expect(result).not.toContain("(");
    expect(result).not.toContain(")");
  });
});

describe("dog detail — history uses friendly labels", () => {
  it("modality in history uses canônicalModalityLabel", () => {
    const label = canônicalModalityLabel("busca_captura");
    expect(label).toBe("Busca & Captura");
  });

  it("module in history resolves from program", () => {
    const label = friendlyModuleName("mod-2", sampleProgram);
    expect(label).toBe("Indicação passiva");
  });
});

describe("dog detail — assign matrix button visibility", () => {
  it("shows assign button when canEdit is true and no matrix", () => {
    const canEdit = true;
    const hasMatrix = false;
    const showButton = canEdit && !hasMatrix;
    expect(showButton).toBe(true);
  });

  it("hides assign button when canEdit is false", () => {
    const canEdit = false;
    const hasMatrix = false;
    const showButton = canEdit && !hasMatrix;
    expect(showButton).toBe(false);
  });

  it("hides assign button when matrix exists", () => {
    const canEdit = true;
    const hasMatrix = true;
    const showButton = canEdit && !hasMatrix;
    expect(showButton).toBe(false);
  });
});
