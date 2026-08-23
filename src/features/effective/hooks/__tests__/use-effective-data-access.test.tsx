import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEffectiveData } from "../use-effective-data";

vi.mock("@/lib/firebase/client", () => ({
  auth: {},
  db: {},
  functions: {},
  storage: {},
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  query: vi.fn(),
  where: vi.fn(),
}));

const mockEntities = {
  dogs: [],
  dogsLoading: false,
  users: [
    {
      _id: "ra_sem_acesso",
      callsign: "NOVO_AGENTE",
      fullName: "Agente Novo",
      ra: "1001",
      // Sem accessLevel, sem accessProfile, sem role
    },
    {
      _id: "ra_com_gestor",
      accessProfile: "gestor",
      callsign: "COMANDANTE",
      fullName: "Major Comandante",
      ra: "1002",
    },
    {
      _id: "ra_com_operador_k9",
      accessLevel: "operador_k9",
      callsign: "CONDUTOR",
      fullName: "Cabo Condutor",
      ra: "1003",
    },
    {
      _id: "ra_id_explicito",
      // C1: SOMENTE id canônico explícito, sem nenhum espelho legado
      access_profile_id: "gestor",
      callsign: "GESTOR_CANONICO",
      fullName: "Gestor Canônico",
      ra: "1004",
    },
  ],
  usersLoading: false,
  vehicles: [],
  vehiclesLoading: false,
};

vi.mock("@/features/effective/providers/entities-provider", () => ({
  useEntities: () => mockEntities,
}));

describe("useEffectiveData — Honest Access Read Mapping (H3-W2)", () => {
  it("não sintetiza 'Operador' para usuário sem perfil de acesso configurado", () => {
    const { result } = renderHook(() => useEffectiveData());

    const userWithoutAccess = result.current.users.find(
      (u) => u.ra === "1001",
    );

    expect(userWithoutAccess).toBeDefined();
    expect(userWithoutAccess?.accessLevel).toBeNull();
    expect(userWithoutAccess?.accessLevel).not.toBe("Operador");
  });

  it("mapeia perfil configurado quando presente", () => {
    const { result } = renderHook(() => useEffectiveData());

    const userWithGestor = result.current.users.find((u) => u.ra === "1002");
    expect(userWithGestor?.accessLevel).toBe("gestor");

    const userWithOperadorK9 = result.current.users.find(
      (u) => u.ra === "1003",
    );
    expect(userWithOperadorK9?.accessLevel).toBe("operador_k9");
  });

  // C1: o campo canônico explícito é ADITIVO. Ele não pode reescrever nem
  // ser reescrito pela string legada `accessLevel`, que segue servindo
  // filtros/busca/isOperador.
  it("C1: projeta access_profile_id em accessProfileId sem contaminar accessLevel", () => {
    const { result } = renderHook(() => useEffectiveData());

    const canonical = result.current.users.find((u) => u.ra === "1004");

    expect(canonical).toBeDefined();
    expect(canonical?.accessProfileId).toBe("gestor");
    // Sem espelho legado, accessLevel permanece null (semântica preservada)
    expect(canonical?.accessLevel).toBeNull();
    expect(canonical?.accessLevel).not.toBe("Operador");
  });

  it("C1: accessProfileId NÃO é derivado de role/accessLevel legado", () => {
    const { result } = renderHook(() => useEffectiveData());

    // 1002 tem accessProfile legado; 1003 tem accessLevel legado.
    // Nenhum dos dois possui id explícito, então accessProfileId deve ser null.
    expect(
      result.current.users.find((u) => u.ra === "1002")?.accessProfileId,
    ).toBeNull();
    expect(
      result.current.users.find((u) => u.ra === "1003")?.accessProfileId,
    ).toBeNull();
    // E o campo legado segue intacto
    expect(result.current.users.find((u) => u.ra === "1002")?.accessLevel).toBe(
      "gestor",
    );
  });
});
