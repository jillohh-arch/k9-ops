import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminUpsertHuman = vi.fn();
const uploadBytes = vi.fn();
const getDownloadURL = vi.fn();
const getDoc = vi.fn();

vi.mock("@/lib/firebase/functions", () => ({
  callAdminUpsertHuman,
  callAdminArchiveHuman: vi.fn(),
  callAdminArchiveHumanCertification: vi.fn(),
  callAdminArchiveHumanDocument: vi.fn(),
  callAdminArchiveHumanMovement: vi.fn(),
  callAdminSaveHumanCertification: vi.fn(),
  callAdminSaveHumanDocument: vi.fn(),
  callAdminSaveHumanMovement: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({ db: {}, storage: {} }));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  getDoc,
}));

vi.mock("firebase/storage", () => ({
  ref: vi.fn(() => ({})),
  uploadBytes,
  getDownloadURL,
}));

const {
  emptyHumanFormValues,
  loadHumanForEdit,
  resolveLegacyEditAccessState,
  saveHuman,
  LegacyHumanEditBlockedError,
} = await import("../human-admin-service");

function snapshot(data: Record<string, unknown> | null) {
  return {
    exists: () => data !== null,
    data: () => data,
  };
}

/** Valores completos de um registro PROVISIONADO (perfil explícito válido). */
function provisionedValues() {
  return {
    ...emptyHumanFormValues,
    ra: "123456",
    fullName: "Jilles Ragonha",
    callsign: "Ragonha",
    accessLevel: "Gestor / Comando",
    accessProfile: "Gestor / Comando",
    accessProfileId: "gestor",
  };
}

describe("H3-W3 — emptyHumanFormValues sem defaults de acesso", () => {
  it("NÃO usa default 'Operador' em accessLevel/accessProfile", () => {
    expect(emptyHumanFormValues.accessLevel).toBe("");
    expect(emptyHumanFormValues.accessProfile).toBe("");
    expect(emptyHumanFormValues.accessLevel).not.toBe("Operador");
    expect(emptyHumanFormValues.accessProfile).not.toBe("Operador");
  });

  it("NÃO usa default 'operador_k9' em accessProfileId", () => {
    expect(emptyHumanFormValues.accessProfileId).toBe("");
    expect(emptyHumanFormValues.accessProfileId).not.toBe("operador_k9");
  });
});

describe("H3-W3 — loadHumanForEdit sem coerção de acesso", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registro sem campos de acesso NÃO fabrica Operador/operador_k9", async () => {
    getDoc.mockResolvedValue(
      snapshot({
        nomeCompleto: "Agente Silva",
        callsign: "SILVA",
        cargo: "Condutor K9",
      }),
    );

    const loaded = await loadHumanForEdit("998877");

    expect(loaded).not.toBeNull();
    expect(loaded?.accessLevel).toBe("");
    expect(loaded?.accessProfile).toBe("");
    expect(loaded?.accessProfileId).toBe("");
    expect(loaded?.accessProfileId).not.toBe("operador_k9");
    expect(loaded?.accessProfile).not.toBe("Operador");
  });

  it("Operador explicitamente persistido permanece Operador", async () => {
    getDoc.mockResolvedValue(
      snapshot({
        nomeCompleto: "Condutor Um",
        callsign: "CONDUTOR1",
        access_profile_id: "operador_k9",
      }),
    );

    const loaded = await loadHumanForEdit("1002");

    expect(loaded?.accessProfileId).toBe("operador_k9");
    expect(loaded?.accessProfile).toBe("Operador");
  });

  it("perfil não-operador explícito permanece factual", async () => {
    getDoc.mockResolvedValue(
      snapshot({
        nomeCompleto: "Comandante",
        callsign: "COMANDANTE",
        access_profile_id: "gestor",
      }),
    );

    const loaded = await loadHumanForEdit("1003");

    expect(loaded?.accessProfileId).toBe("gestor");
    expect(loaded?.accessProfile).toBe("Gestor / Comando");
  });

  it("referência legada textual válida resolve o id factual sem inventar", async () => {
    getDoc.mockResolvedValue(
      snapshot({
        nomeCompleto: "Estoque",
        callsign: "ESTOQUE",
        accessLevel: "almoxarifado",
      }),
    );

    const loaded = await loadHumanForEdit("7777");

    expect(loaded?.accessProfileId).toBe("almoxarifado");
    expect(loaded?.accessProfile).toBe("Almoxarifado");
  });
});

describe("H3-W3 — resolveLegacyEditAccessState", () => {
  it("registro sem acesso -> unprovisioned e save legado bloqueado", () => {
    const state = resolveLegacyEditAccessState({
      accessLevel: "",
      accessProfile: "",
      accessProfileId: "",
    });

    expect(state.status).toBe("unprovisioned");
    expect(state.canUseLegacySave).toBe(false);
    expect(state.profileId).toBeNull();
  });

  it("perfil explícito válido -> provisioned e save legado permitido", () => {
    const state = resolveLegacyEditAccessState({
      accessLevel: "Gestor / Comando",
      accessProfile: "Gestor / Comando",
      accessProfileId: "gestor",
    });

    expect(state.status).toBe("provisioned");
    expect(state.canUseLegacySave).toBe(true);
    expect(state.profileId).toBe("gestor");
  });

  it("referência não resolvível -> incomplete e save legado bloqueado", () => {
    const state = resolveLegacyEditAccessState({
      accessLevel: "",
      accessProfile: "",
      accessProfileId: "perfil_inexistente_xyz",
    });

    expect(state.status).toBe("incomplete");
    expect(state.canUseLegacySave).toBe(false);
  });
});

describe("H3-W3 — saveHuman fail-closed backstop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callAdminUpsertHuman.mockResolvedValue({ data: { ra: "123456" } });
  });

  it("edit de registro NÃO provisionado NÃO invoca adminUpsertHuman", async () => {
    const values = {
      ...emptyHumanFormValues,
      ra: "998877",
      fullName: "Agente Silva",
      callsign: "SILVA",
    };

    await expect(saveHuman("edit", values, null)).rejects.toBeInstanceOf(
      LegacyHumanEditBlockedError,
    );

    expect(callAdminUpsertHuman).toHaveBeenCalledTimes(0);
    expect(uploadBytes).toHaveBeenCalledTimes(0);
  });

  it("nenhum payload com Operador/operador_k9 vaza no caso bloqueado", async () => {
    const values = {
      ...emptyHumanFormValues,
      ra: "998877",
      fullName: "Agente Silva",
      callsign: "SILVA",
    };

    await expect(saveHuman("edit", values, null)).rejects.toBeInstanceOf(
      LegacyHumanEditBlockedError,
    );

    expect(callAdminUpsertHuman).not.toHaveBeenCalled();
  });

  it("edit de registro PROVISIONADO invoca adminUpsertHuman com o perfil factual", async () => {
    const result = await saveHuman("edit", provisionedValues(), null);

    expect(callAdminUpsertHuman).toHaveBeenCalledTimes(1);
    const payload = callAdminUpsertHuman.mock.calls[0][0];
    expect(payload.mode).toBe("edit");
    expect(payload.profile.access_profile_id).toBe("gestor");
    expect(payload.profile.access_profile).toBe("Gestor / Comando");
    expect(result).toEqual({ ra: "123456" });
  });
});
