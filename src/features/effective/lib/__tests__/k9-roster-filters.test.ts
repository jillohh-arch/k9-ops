import { describe, expect, it } from "vitest";

import { K9_ROSTER_GROUP_ORDER } from "@/features/effective/lib/k9-roster-classification";
import {
  classifyRosterDogs,
  emptyRosterFilters,
  filterRosterDogs,
  groupRosterDogs,
  hasActiveFilters,
  type RosterDogInput,
  type RosterFilters,
} from "@/features/effective/lib/k9-roster-filters";

const dogs: RosterDogInput[] = [
  {
    breed: "Malinois Belga",
    conductorRa: "691755",
    id: "bono",
    name: "Bono",
    registrationNumber: "111222",
    specialties: [{ status: "operational", type: "deteccao" }],
    status: "Ativo",
  },
  {
    breed: "Pastor Alemão",
    conductorRa: "700001",
    id: "thor",
    name: "Thor",
    registrationNumber: "333444",
    specialties: [{ status: "operational", type: "guarda_protecao" }],
    status: "Ativo",
  },
  {
    breed: "Malinois Belga",
    conductorRa: "700002",
    id: "kira",
    name: "Kira",
    registrationNumber: "555666",
    specialties: [{ status: "in_formation", type: "deteccao" }],
    status: "Ativo",
  },
  {
    breed: "Labrador Retriever",
    conductorRa: null,
    id: "athos",
    name: "Athos",
    registrationNumber: "777888",
    specialties: [{ status: "operational", type: "busca_captura" }],
    status: "Licenca",
  },
  {
    breed: "Border Collie",
    conductorRa: "700003",
    id: "lua",
    name: "Lua",
    registrationNumber: "999000",
    specialties: [],
    status: "Ativo",
  },
];

const handlerLabelByRa = new Map([
  ["691755", "Ragonha"],
  ["700001", "Silva"],
  ["700002", "Costa"],
  ["700003", "Oliveira"],
]);

const classifications = classifyRosterDogs(dogs);

function run(patch: Partial<RosterFilters>) {
  return filterRosterDogs({
    classifications,
    dogs,
    filters: { ...emptyRosterFilters, ...patch },
    handlerLabelByRa,
  }).map((dog) => dog.id);
}

describe("busca", () => {
  it("encontra por nome, ignorando caixa e acento", () => {
    expect(run({ search: "bono" })).toEqual(["bono"]);
    expect(run({ search: "BONO" })).toEqual(["bono"]);
    expect(run({ search: "  Thor " })).toEqual(["thor"]);
  });

  it("encontra por matrícula", () => {
    expect(run({ search: "555666" })).toEqual(["kira"]);
  });

  it("encontra por raça", () => {
    expect(run({ search: "Malinois" })).toEqual(["bono", "kira"]);
    expect(run({ search: "pastor alemao" })).toEqual(["thor"]);
  });

  it("encontra por operador — nome de guerra e RA", () => {
    expect(run({ search: "Ragonha" })).toEqual(["bono"]);
    expect(run({ search: "700002" })).toEqual(["kira"]);
  });

  it("busca vazia não filtra nada", () => {
    expect(run({ search: "   " })).toHaveLength(dogs.length);
  });

  it("busca sem correspondência devolve lista vazia", () => {
    expect(run({ search: "inexistente" })).toEqual([]);
  });
});

describe("filtros estruturados", () => {
  it("filtra por status administrativo", () => {
    expect(run({ status: "Licenca" })).toEqual(["athos"]);
    expect(run({ status: "Ativo" })).toEqual([
      "bono",
      "thor",
      "kira",
      "lua",
    ]);
  });

  it("filtra por especialidade", () => {
    expect(run({ specialty: "deteccao" })).toEqual(["bono", "kira"]);
    expect(run({ specialty: "busca_captura" })).toEqual(["athos"]);
  });

  it("filtra por operador", () => {
    expect(run({ handler: "691755" })).toEqual(["bono"]);
    expect(run({ handler: "700003" })).toEqual(["lua"]);
  });

  it("filtra por situação de emprego derivada da classificação", () => {
    expect(run({ employment: "ready" })).toEqual(["bono", "thor"]);
    expect(run({ employment: "formation" })).toEqual(["kira"]);
    expect(run({ employment: "unavailable" })).toEqual(["athos"]);
    expect(run({ employment: "unclassified_active" })).toEqual(["lua"]);
  });
});

describe("combinações", () => {
  it("aplica busca e especialidade juntas", () => {
    expect(run({ search: "Malinois", specialty: "deteccao" })).toEqual([
      "bono",
      "kira",
    ]);
    expect(run({ search: "Kira", specialty: "deteccao" })).toEqual(["kira"]);
  });

  it("aplica emprego e especialidade juntos", () => {
    expect(run({ employment: "ready", specialty: "deteccao" })).toEqual([
      "bono",
    ]);
  });

  it("combinação contraditória devolve vazio sem quebrar", () => {
    expect(run({ employment: "formation", specialty: "guarda_protecao" })).toEqual(
      [],
    );
    expect(run({ handler: "691755", status: "Licenca" })).toEqual([]);
  });

  it("aplica busca, status, emprego, especialidade e operador ao mesmo tempo", () => {
    expect(
      run({
        employment: "ready",
        handler: "691755",
        search: "bono",
        specialty: "deteccao",
        status: "Ativo",
      }),
    ).toEqual(["bono"]);
  });
});

describe("limpar filtros", () => {
  it("hasActiveFilters reflete cada dimensão", () => {
    expect(hasActiveFilters(emptyRosterFilters)).toBe(false);
    expect(hasActiveFilters({ ...emptyRosterFilters, search: "bono" })).toBe(
      true,
    );
    expect(hasActiveFilters({ ...emptyRosterFilters, search: "   " })).toBe(
      false,
    );
    expect(hasActiveFilters({ ...emptyRosterFilters, status: "Ativo" })).toBe(
      true,
    );
    expect(
      hasActiveFilters({ ...emptyRosterFilters, employment: "ready" }),
    ).toBe(true);
    expect(
      hasActiveFilters({ ...emptyRosterFilters, specialty: "deteccao" }),
    ).toBe(true);
    expect(hasActiveFilters({ ...emptyRosterFilters, handler: "691755" })).toBe(
      true,
    );
  });

  it("voltar ao estado vazio restaura o efetivo completo", () => {
    expect(run({ employment: "ready", search: "bono" })).toEqual(["bono"]);
    expect(run({})).toHaveLength(dogs.length);
  });
});

describe("grupos após filtro", () => {
  it("agrupa na ordem canônica e omite grupos vazios", () => {
    const groups = groupRosterDogs({
      classifications,
      dogs,
      order: K9_ROSTER_GROUP_ORDER,
    });

    expect(groups.map((entry) => entry.group)).toEqual([
      "ready",
      "formation",
      "unavailable",
      "unclassified_active",
    ]);
    expect(groups[0].dogs.map((dog) => dog.id)).toEqual(["bono", "thor"]);
  });

  it("nenhuma seção vazia é devolvida após filtrar", () => {
    const filtered = filterRosterDogs({
      classifications,
      dogs,
      filters: { ...emptyRosterFilters, employment: "formation" },
      handlerLabelByRa,
    });
    const groups = groupRosterDogs({
      classifications,
      dogs: filtered,
      order: K9_ROSTER_GROUP_ORDER,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].group).toBe("formation");
    for (const entry of groups) {
      expect(entry.dogs.length).toBeGreaterThan(0);
    }
  });

  it("todo K9 filtrado aparece em exatamente um grupo", () => {
    const groups = groupRosterDogs({
      classifications,
      dogs,
      order: K9_ROSTER_GROUP_ORDER,
    });
    const ids = groups.flatMap((entry) => entry.dogs.map((dog) => dog.id));

    expect(ids).toHaveLength(dogs.length);
    expect(new Set(ids).size).toBe(dogs.length);
  });

  it("nenhum K9 desaparece por não caber no mockup nominal", () => {
    // `lua` não tem especialidade alguma e ainda assim é renderizável.
    const groups = groupRosterDogs({
      classifications,
      dogs,
      order: K9_ROSTER_GROUP_ORDER,
    });
    const ids = groups.flatMap((entry) => entry.dogs.map((dog) => dog.id));
    expect(ids).toContain("lua");
  });
});
