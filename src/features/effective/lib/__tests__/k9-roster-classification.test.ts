import { describe, expect, it } from "vitest";

import {
  K9_ROSTER_GROUP_ORDER,
  classifyK9,
  groupCounts,
  isAdministrativelyActive,
  parseHealthReadiness,
  type K9ClassificationInput,
  type K9HealthReadiness,
} from "@/features/effective/lib/k9-roster-classification";

const operational = { status: "operational", type: "deteccao" };
const inFormation = { status: "in_formation", type: "deteccao" };
const notStarted = { status: "not_started", type: "deteccao" };

describe("classifyK9 — casos obrigatórios da seção 30", () => {
  it("1. K9 administrativo inativo cai em indisponíveis", () => {
    for (const status of ["Inativo", "Licenca", "Aposentado", "", null]) {
      const result = classifyK9({ specialties: [operational], status });
      expect(result.group).toBe("unavailable");
      expect(result.reason).toBe("administrative_unavailable");
    }
  });

  it("2. especialidade operacional em K9 ativo vira pronto para emprego", () => {
    const result = classifyK9({ specialties: [operational], status: "Ativo" });
    expect(result.group).toBe("ready");
    expect(result.reason).toBe("operational_specialty");
  });

  it("3. especialidade em formação vira grupo de formação", () => {
    const result = classifyK9({ specialties: [inFormation], status: "Ativo" });
    expect(result.group).toBe("formation");
    expect(result.reason).toBe("in_formation");
  });

  it("4. ativo sem especialidade vai para o grupo de escape", () => {
    expect(classifyK9({ specialties: [], status: "Ativo" }).group).toBe(
      "unclassified_active",
    );
    expect(classifyK9({ status: "Ativo" }).group).toBe("unclassified_active");
    expect(
      classifyK9({ specialties: [notStarted], status: "Ativo" }).group,
    ).toBe("unclassified_active");
  });

  it("5. temporarily_unfit é bloqueante mesmo com especialidade operacional", () => {
    const result = classifyK9({
      readiness: "temporarily_unfit",
      specialties: [operational],
      status: "Ativo",
    });
    expect(result.group).toBe("unavailable");
    expect(result.reason).toBe("health_temporarily_unfit");
  });

  it("6. fit_with_restrictions não vira indisponibilidade total", () => {
    const result = classifyK9({
      readiness: "fit_with_restrictions",
      specialties: [operational],
      status: "Ativo",
    });
    expect(result.group).toBe("ready");
    expect(result.hasNonBlockingRestriction).toBe(true);
  });

  it("7. operational_attention não vira indisponibilidade", () => {
    const result = classifyK9({
      readiness: "operational_attention",
      specialties: [operational],
      status: "Ativo",
    });
    expect(result.group).toBe("ready");
    expect(result.hasNonBlockingRestriction).toBe(true);
  });

  it("8. readiness ausente não é lida como prontidão clínica", () => {
    // Sem readiness, a classificação usa apenas dados administrativos e de
    // formação. O grupo `ready` significa "qualificado e não bloqueado",
    // nunca "clinicamente avaliado como operacional".
    const absent = classifyK9({ specialties: [operational], status: "Ativo" });
    const evaluated = classifyK9({
      readiness: "operational",
      specialties: [operational],
      status: "Ativo",
    });

    expect(absent.group).toBe("ready");
    expect(absent.hasNonBlockingRestriction).toBe(false);
    expect(evaluated.group).toBe("ready");

    // Ausência de readiness nunca produz um estado Health canônico.
    expect(parseHealthReadiness(undefined)).toBeNull();
    expect(parseHealthReadiness(null)).toBeNull();
    expect(parseHealthReadiness("")).toBeNull();
    // Em especial, nunca é convertida em `not_evaluated`, que é afirmação clínica.
    expect(parseHealthReadiness(undefined)).not.toBe("not_evaluated");
  });
});

describe("invariantes do contrato", () => {
  it("indisponibilidade absoluta prevalece sobre qualquer qualificação", () => {
    const readinessValues: Array<K9HealthReadiness | null> = [
      "operational",
      "operational_attention",
      "fit_with_restrictions",
      "temporarily_unfit",
      "not_evaluated",
      null,
    ];

    for (const readiness of readinessValues) {
      const result = classifyK9({
        readiness,
        specialties: [operational, inFormation],
        status: "Aposentado",
      });
      expect(result.group).toBe("unavailable");
    }
  });

  it("restrição parcial nunca bloqueia automaticamente", () => {
    for (const readiness of [
      "fit_with_restrictions",
      "operational_attention",
    ] as const) {
      expect(
        classifyK9({ readiness, specialties: [operational], status: "Ativo" })
          .group,
      ).toBe("ready");
      expect(
        classifyK9({ readiness, specialties: [inFormation], status: "Ativo" })
          .group,
      ).toBe("formation");
      expect(classifyK9({ readiness, status: "Ativo" }).group).toBe(
        "unclassified_active",
      );
    }
  });

  it("todo K9 recebe exatamente um grupo válido", () => {
    const statuses = ["Ativo", "active", "ATIVO", "Licenca", "Aposentado", ""];
    const specialtySets = [
      [],
      [operational],
      [inFormation],
      [notStarted],
      [operational, inFormation],
      [notStarted, inFormation],
    ];
    const readinessValues: Array<K9HealthReadiness | null> = [
      "operational",
      "operational_attention",
      "fit_with_restrictions",
      "temporarily_unfit",
      "not_evaluated",
      null,
    ];

    let combinations = 0;
    for (const status of statuses) {
      for (const specialties of specialtySets) {
        for (const readiness of readinessValues) {
          const result = classifyK9({ readiness, specialties, status });
          expect(K9_ROSTER_GROUP_ORDER).toContain(result.group);
          combinations += 1;
        }
      }
    }
    expect(combinations).toBe(
      statuses.length * specialtySets.length * readinessValues.length,
    );
  });

  it("especialidade operacional conquistada prevalece sobre outra em formação", () => {
    const result = classifyK9({
      specialties: [inFormation, operational],
      status: "Ativo",
    });
    expect(result.group).toBe("ready");
  });

  it("aceita status administrativo com acento e caixa variada", () => {
    expect(isAdministrativelyActive("Ativo")).toBe(true);
    expect(isAdministrativelyActive(" ATIVO ")).toBe(true);
    expect(isAdministrativelyActive("active")).toBe(true);
    expect(isAdministrativelyActive("Licenca")).toBe(false);
    expect(isAdministrativelyActive("Licença")).toBe(false);
    expect(isAdministrativelyActive(null)).toBe(false);
  });
});

describe("parseHealthReadiness", () => {
  it("reconhece os cinco estados oficiais", () => {
    expect(parseHealthReadiness("operational")).toBe("operational");
    expect(parseHealthReadiness("operational_attention")).toBe(
      "operational_attention",
    );
    expect(parseHealthReadiness("fit_with_restrictions")).toBe(
      "fit_with_restrictions",
    );
    expect(parseHealthReadiness("temporarily_unfit")).toBe("temporarily_unfit");
    expect(parseHealthReadiness("not_evaluated")).toBe("not_evaluated");
  });

  it("normaliza caixa, espaços e hífens", () => {
    expect(parseHealthReadiness("Temporarily Unfit")).toBe("temporarily_unfit");
    expect(parseHealthReadiness("fit-with-restrictions")).toBe(
      "fit_with_restrictions",
    );
  });

  it("rejeita valores desconhecidos em vez de adivinhar", () => {
    expect(parseHealthReadiness("apto")).toBeNull();
    expect(parseHealthReadiness("87")).toBeNull();
    expect(parseHealthReadiness({})).toBeNull();
  });
});

describe("groupCounts", () => {
  it("soma exatamente os grupos classificados", () => {
    const inputs: K9ClassificationInput[] = [
      { specialties: [operational], status: "Ativo" },
      { specialties: [operational], status: "Ativo" },
      { specialties: [inFormation], status: "Ativo" },
      { status: "Ativo" },
      { specialties: [operational], status: "Licenca" },
    ];
    const counts = groupCounts(inputs.map(classifyK9));

    expect(counts).toEqual({
      formation: 1,
      ready: 2,
      unavailable: 1,
      unclassified_active: 1,
    });
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(inputs.length);
  });
});
