import { describe, expect, it } from "vitest";

import {
  buildK9Activity,
  humanizePhase,
  humanizeToken,
  humanizeTrainingLabel,
  sessionTitle,
} from "@/features/effective/lib/k9-profile-activity";
import type { ProfileRecord } from "@/features/effective/lib/k9-profile-records";

function record(fields: Record<string, unknown>, id = "r1"): ProfileRecord {
  return { _id: id, ...fields } as ProfileRecord;
}

/** Nenhum texto exibido pode conter `snake_case` cru. */
const SNAKE_CASE = /[a-z0-9]+_[a-z0-9]/;

describe("humanizeTrainingLabel — token composto do Training", () => {
  it("detection_formation nunca renderiza cru", () => {
    const label = humanizeTrainingLabel("detection_formation");

    expect(label).not.toBe("detection_formation");
    expect(label).not.toMatch(SNAKE_CASE);
  });

  it("detection_formation vira modalidade + estado em PT-BR", () => {
    expect(humanizeTrainingLabel("detection_formation")).toBe(
      "Detecção — Em formação",
    );
  });

  it("usa o vocabulário canônico de modalidade", () => {
    expect(humanizeTrainingLabel("deteccao")).toBe("Detecção");
    expect(humanizeTrainingLabel("busca_captura")).toBe("Busca & Captura");
    expect(humanizeTrainingLabel("guarda_protecao")).toBe("Guarda & Proteção");
  });

  it("reconhece outros estados compostos", () => {
    expect(humanizeTrainingLabel("guarda_protecao_operational")).toBe(
      "Guarda & Proteção — Operacional",
    );
    expect(humanizeTrainingLabel("deteccao_maintenance")).toBe(
      "Detecção — Manutenção",
    );
  });

  it("estado isolado é traduzido", () => {
    expect(humanizeTrainingLabel("in_formation")).toBe("Em formação");
  });

  it("modalidade desconhecida é humanizada, não descartada", () => {
    const label = humanizeTrainingLabel("faro_tecnico_formation");

    expect(label).toBe("Faro tecnico — Em formação");
    expect(label).not.toMatch(SNAKE_CASE);
  });

  it("token totalmente desconhecido ainda sai legível", () => {
    const label = humanizeTrainingLabel("algum_token_novo");

    expect(label).not.toMatch(SNAKE_CASE);
    expect(label).toBe("Algum token novo");
  });

  it("ausência devolve null em vez de texto inventado", () => {
    expect(humanizeTrainingLabel(null)).toBeNull();
    expect(humanizeTrainingLabel("")).toBeNull();
    expect(humanizeTrainingLabel("   ")).toBeNull();
  });
});

describe("humanizeToken / humanizePhase", () => {
  it("troca separadores e capitaliza", () => {
    expect(humanizeToken("modulo_3")).toBe("Modulo 3");
    expect(
      humanizePhase("modulo_4_cenarios_operacionais_simulados"),
    ).toBe("Modulo 4 cenarios operacionais simulados");
  });

  it("não deixa `_` sobrar", () => {
    expect(humanizePhase("modulo_4_cenarios")).not.toMatch(SNAKE_CASE);
  });

  it("ausência devolve null", () => {
    expect(humanizePhase(null)).toBeNull();
    expect(humanizePhase("")).toBeNull();
  });
});

describe("títulos derivados de sessão", () => {
  it("sessão com token composto exibe rótulo humano", () => {
    const title = sessionTitle(record({ trainingType: "detection_formation" }));

    expect(title).toBe("Detecção — Em formação");
    expect(title).not.toMatch(SNAKE_CASE);
  });

  it("sessão sem modalidade usa rótulo genérico honesto", () => {
    expect(sessionTitle(record({}))).toBe("Sessão de treinamento");
  });
});

describe("timeline não expõe token técnico", () => {
  it("título e detalhe de especialidade são humanizados", () => {
    const [item] = buildK9Activity({
      specialties: [
        record(
          {
            status: "in_formation",
            type: "detection",
            updated_at: "2026-04-01",
          },
          "sp1",
        ),
      ],
    });

    expect(item.title).not.toMatch(SNAKE_CASE);
    expect(item.detail).not.toMatch(SNAKE_CASE);
    expect(item.detail).toBe("Em formação");
  });

  it("nenhum campo visível de nenhuma categoria contém snake_case", () => {
    const activity = buildK9Activity({
      documents: [record({ dataUpload: "2026-02-02", nome: "Atestado" }, "d1")],
      healthEvents: [
        record({ date: "2026-01-10", subtype: "joelho", type: "surgery" }, "h1"),
      ],
      occurrences: [
        record({ date: "2026-02-03", status: "awaiting_signatures" }, "o1"),
      ],
      sessions: [
        record({ date: "2026-03-01", trainingType: "detection_formation" }, "s1"),
      ],
      weights: [record({ date: "2026-02-01", weight_kg: 30 }, "w1")],
    });

    expect(activity).toHaveLength(5);
    for (const item of activity) {
      expect(item.title).not.toMatch(SNAKE_CASE);
      expect(item.detail).not.toMatch(SNAKE_CASE);
    }
  });
});
