import { describe, expect, it } from "vitest";

import {
  activeShiftBadge,
  administrativeStatusBadge,
  buildK9ProfileStatus,
  clinicalReadinessView,
  operationalSituationBadge,
  specialtySituationLabel,
} from "@/features/effective/lib/k9-profile-status";
import { classifyK9 } from "@/features/effective/lib/k9-roster-classification";

const operational = { status: "operational", type: "deteccao" };
const inFormation = { status: "in_formation", type: "deteccao" };

describe("status administrativo", () => {
  it("preserva o valor persistido e não o traduz para 'Operacional'", () => {
    const badge = administrativeStatusBadge("Ativo");

    expect(badge.label).toBe("Ativo");
    expect(badge.label).not.toBe("Operacional");
  });

  it("status vazio NÃO vira 'Ativo' por fallback artificial", () => {
    for (const value of ["", "   ", null, undefined]) {
      const badge = administrativeStatusBadge(value);
      expect(badge.label).toBe("Não informado");
      expect(badge.label).not.toBe("Ativo");
    }
  });

  it("status não-ativo é preservado como persistido", () => {
    expect(administrativeStatusBadge("Licenca").label).toBe("Licenca");
    expect(administrativeStatusBadge("Aposentado").tone).toBe("violet");
  });
});

describe("situação operacional", () => {
  it("usa exatamente o classifier canônico do Roster", () => {
    const classification = classifyK9({
      specialties: [inFormation],
      status: "Ativo",
    });
    const badge = operationalSituationBadge(classification);

    // O rótulo é o do grupo canônico, não uma segunda interpretação local.
    expect(classification.group).toBe("formation");
    expect(badge.label).toBe("Em formação");
  });

  it("temporarily_unfit não aparece como operacional", () => {
    const status = buildK9ProfileStatus({
      hasActiveShift: false,
      readiness: "temporarily_unfit",
      specialties: [operational],
      status: "Ativo",
    });

    expect(status.classification.group).toBe("unavailable");
    expect(status.operational.label).not.toMatch(/Prontos para emprego/);
    expect(status.operational.label).toBe("Indisponíveis / com restrições");
    expect(status.readiness.available && status.readiness.label).toBe(
      "Temporariamente inapto",
    );
  });

  it("K9 com especialidade operacional e status ativo fica pronto", () => {
    const status = buildK9ProfileStatus({
      hasActiveShift: false,
      readiness: null,
      specialties: [operational],
      status: "Ativo",
    });

    expect(status.classification.group).toBe("ready");
  });
});

describe("prontidão clínica", () => {
  it("ausência de fonte usa o texto literal do contrato", () => {
    const view = clinicalReadinessView(null);

    expect(view.available).toBe(false);
    expect(view.label).toBe("Prontidão não disponível");
    expect(view.available === false && view.message).toBe(
      "Sem resumo clínico disponível.",
    );
  });

  it("ausência de fonte NUNCA é convertida em 'Não avaliado'", () => {
    const view = clinicalReadinessView(null);

    // `not_evaluated` é uma afirmação clínica; ausência de fonte não é.
    expect(view.label).not.toBe("Não Avaliado");
  });

  it("cada estado oficial tem rótulo PT-BR próprio", () => {
    expect(clinicalReadinessView("operational").label).toBe("Operacional");
    expect(clinicalReadinessView("operational_attention").label).toBe(
      "Operacional com atenção",
    );
    expect(clinicalReadinessView("fit_with_restrictions").label).toBe(
      "Apto com restrições",
    );
    expect(clinicalReadinessView("temporarily_unfit").label).toBe(
      "Temporariamente inapto",
    );
    expect(clinicalReadinessView("not_evaluated").label).toBe("Não avaliado");
  });

  it("não deriva prontidão de especialidade, peso, vacina ou binômio", () => {
    // Cão com especialidade operacional, turno ativo e status ativo: nada
    // disso pode produzir prontidão clínica.
    const status = buildK9ProfileStatus({
      hasActiveShift: true,
      readiness: null,
      specialties: [operational],
      status: "Ativo",
    });

    expect(status.readiness.available).toBe(false);
    expect(status.readiness.label).toBe("Prontidão não disponível");
  });
});

describe("conceitos permanecem separados", () => {
  it("administrativo, operacional, clínico e turno são campos distintos", () => {
    const status = buildK9ProfileStatus({
      hasActiveShift: false,
      readiness: "fit_with_restrictions",
      specialties: [operational],
      status: "Ativo",
    });

    expect(status.administrative.label).toBe("Ativo");
    expect(status.operational.label).toBe("Prontos para emprego");
    expect(status.readiness.available && status.readiness.label).toBe(
      "Apto com restrições",
    );
    expect(status.shift.label).toBe("Sem turno ativo");

    // Nenhum dos quatro rótulos colide com outro: não há badge único.
    const labels = new Set([
      status.administrative.label,
      status.operational.label,
      status.readiness.label,
      status.shift.label,
    ]);
    expect(labels.size).toBe(4);
  });

  it("turno ativo só é afirmado a partir de turno real", () => {
    expect(activeShiftBadge(false).label).toBe("Sem turno ativo");
    expect(activeShiftBadge(true).label).toBe("Ativo no turno");
  });
});

describe("situação da especialidade", () => {
  it("mapeia estados conhecidos", () => {
    expect(specialtySituationLabel("operational").label).toBe("Operacional");
    expect(specialtySituationLabel("in_formation").label).toBe("Em formação");
    expect(specialtySituationLabel("not_started").label).toBe("Não iniciada");
  });

  it("valor desconhecido é preservado, não reclassificado, mas humanizado", () => {
    const label = specialtySituationLabel("homologacao_externa").label;

    // O valor real permanece reconhecível; o que não pode é o enum cru.
    expect(label).toBe("Homologacao externa");
    expect(label).not.toMatch(/_/);
  });

  it("ausência é declarada como ausência", () => {
    expect(specialtySituationLabel(null).label).toBe("Situação não informada");
  });
});
