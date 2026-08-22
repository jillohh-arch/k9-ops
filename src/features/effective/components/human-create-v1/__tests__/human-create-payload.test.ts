import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminCreateHuman = vi.fn();

vi.mock("@/lib/firebase/functions", () => ({ callAdminCreateHuman }));
vi.mock("@/lib/firebase/client", () => ({ functions: {} }));

const { createHumanV1 } = await import("../human-create-service");
const { HumanCreateError } = await import("../human-create-adapter");
const { emptyHumanCreateValues } = await import("../human-create-types");

/** Só os obrigatórios preenchidos; todo opcional em branco. */
function requiredOnly() {
  return {
    ...emptyHumanCreateValues,
    ra: "123456",
    fullName: "Jilles Ragonha",
    callsign: "Ragonha",
  };
}

/** Contrato completo: obrigatórios + todos os 10 opcionais de pessoal. */
function fullValues() {
  return {
    ra: "123456",
    fullName: "Jilles Ragonha",
    callsign: "Ragonha",
    rank: "Guarda Civil",
    cargo: "Condutor K9",
    unit: "GCM Canil",
    team: "Alfa",
    admissionDate: "2020-03-01",
    cpf: "12345678901",
    birthDate: "1990-06-15",
    phone: "(11) 90000-0000",
    institutionalEmail: "ragonha@gcm.com.br",
    notes: "Observação administrativa",
  };
}

function sentPayload() {
  return callAdminCreateHuman.mock.calls[0][0];
}

describe("createHumanV1 — payload CREATE (contrato adminCreateHuman)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callAdminCreateHuman.mockResolvedValue({
      data: { ra: "123456", created: true },
    });
  });

  it("usa o wrapper adminCreateHuman exatamente uma vez", async () => {
    await createHumanV1(requiredOnly());
    expect(callAdminCreateHuman).toHaveBeenCalledTimes(1);
  });

  it("envia os obrigatórios ra/fullName/callsign", async () => {
    await createHumanV1(requiredOnly());
    const payload = sentPayload();

    expect(payload.ra).toBe("123456");
    expect(payload.fullName).toBe("Jilles Ragonha");
    expect(payload.callsign).toBe("Ragonha");
  });

  it("envia SOMENTE os obrigatórios quando os opcionais estão em branco", async () => {
    await createHumanV1(requiredOnly());
    expect(Object.keys(sentPayload()).sort()).toEqual(
      ["callsign", "fullName", "ra"].sort(),
    );
  });

  it("omite opcional em branco em vez de enviar null/vazio", async () => {
    await createHumanV1({ ...requiredOnly(), cargo: "   ", notes: "" });
    const payload = sentPayload();

    expect(payload).not.toHaveProperty("cargo");
    expect(payload).not.toHaveProperty("notes");
    expect(Object.values(payload)).not.toContain(null);
    expect(Object.values(payload)).not.toContain("");
  });

  it("repassa canonicamente os 10 campos opcionais de pessoal", async () => {
    await createHumanV1(fullValues());
    const payload = sentPayload();

    expect(payload.rank).toBe("Guarda Civil");
    expect(payload.cargo).toBe("Condutor K9");
    expect(payload.unit).toBe("GCM Canil");
    expect(payload.team).toBe("Alfa");
    expect(payload.admissionDate).toBe("2020-03-01");
    expect(payload.cpf).toBe("12345678901");
    expect(payload.birthDate).toBe("1990-06-15");
    expect(payload.phone).toBe("(11) 90000-0000");
    expect(payload.institutionalEmail).toBe("ragonha@gcm.com.br");
    expect(payload.notes).toBe("Observação administrativa");
  });

  it("envia exatamente o allowlist do contrato quando tudo é preenchido", async () => {
    await createHumanV1(fullValues());

    expect(Object.keys(sentPayload()).sort()).toEqual(
      [
        "admissionDate",
        "birthDate",
        "callsign",
        "cargo",
        "cpf",
        "fullName",
        "institutionalEmail",
        "notes",
        "phone",
        "ra",
        "rank",
        "team",
        "unit",
      ].sort(),
    );
  });

  it("aplica trim nos campos enviados", async () => {
    await createHumanV1({
      ...requiredOnly(),
      ra: "  123456  ",
      fullName: "  Jilles Ragonha  ",
      cargo: "  Condutor K9  ",
    });
    const payload = sentPayload();

    expect(payload.ra).toBe("123456");
    expect(payload.fullName).toBe("Jilles Ragonha");
    expect(payload.cargo).toBe("Condutor K9");
  });

  it("não envia NENHUM campo de provisionamento de acesso", async () => {
    await createHumanV1(fullValues());
    const payload = sentPayload();

    for (const key of [
      "accessProfile",
      "accessProfileId",
      "access_profile",
      "access_profile_id",
      "accessLevel",
      "access_level",
      "accessScope",
      "access_scope",
      "roles",
      "role",
      "admin",
      "claims",
    ]) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it("não envia NENHUM campo de conta de autenticação", async () => {
    await createHumanV1(fullValues());
    const payload = sentPayload();

    for (const key of [
      "uid",
      "auth_uid",
      "authUid",
      "email",
      "password",
      "temporaryPassword",
      "temporary_password",
    ]) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it("não envia campos de Treinamento", async () => {
    await createHumanV1(fullValues());
    const payload = sentPayload();

    expect(payload).not.toHaveProperty("isK9Instructor");
    expect(payload).not.toHaveProperty("is_k9_instructor");
    expect(payload).not.toHaveProperty("specialties");
    expect(payload).not.toHaveProperty("training_role");
  });

  it("não envia campos de Binômio", async () => {
    await createHumanV1(fullValues());
    const payload = sentPayload();

    expect(payload).not.toHaveProperty("binomial");
    expect(payload).not.toHaveProperty("binomialId");
    expect(payload).not.toHaveProperty("handlerId");
    expect(payload).not.toHaveProperty("conductorRa");
    expect(payload).not.toHaveProperty("conductor_ra");
  });

  it("não envia campos de Turno/escala", async () => {
    await createHumanV1(fullValues());
    const payload = sentPayload();

    expect(payload).not.toHaveProperty("shiftGroupId");
    expect(payload).not.toHaveProperty("shift_group_id");
    expect(payload).not.toHaveProperty("vehicle");
    expect(payload).not.toHaveProperty("crew");
  });

  it("não envia campos de foto", async () => {
    await createHumanV1(fullValues());
    const payload = sentPayload();

    expect(payload).not.toHaveProperty("photoUrl");
    expect(payload).not.toHaveProperty("photoURL");
  });

  it("não envia ciclo de vida nem metadados de servidor", async () => {
    await createHumanV1(fullValues());
    const payload = sentPayload();

    for (const key of [
      "active",
      "status",
      "archived",
      "created_at",
      "createdAt",
      "updated_at",
      "updatedAt",
      "audit_trail",
    ]) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it("envia payload PLANO: sem profile/human/payload aninhado nem mode legado", async () => {
    await createHumanV1(fullValues());
    const payload = sentPayload();

    expect(payload).not.toHaveProperty("profile");
    expect(payload).not.toHaveProperty("human");
    expect(payload).not.toHaveProperty("payload");
    expect(payload).not.toHaveProperty("mode");
    for (const value of Object.values(payload)) {
      expect(typeof value).toBe("string");
    }
  });

  it("devolve {ra, created:true} da resposta do callable", async () => {
    const result = await createHumanV1(requiredOnly());
    expect(result).toEqual({ ra: "123456", created: true });
  });

  it("usa o RA autoritativo da resposta, não o digitado", async () => {
    callAdminCreateHuman.mockResolvedValue({
      data: { ra: "999999", created: true },
    });
    const result = await createHumanV1(requiredOnly());
    expect(result.ra).toBe("999999");
  });

  it("trata resposta sem created:true como falha, nunca sucesso silencioso", async () => {
    callAdminCreateHuman.mockResolvedValue({ data: { ra: "123456" } });
    await expect(createHumanV1(requiredOnly())).rejects.toBeInstanceOf(
      HumanCreateError,
    );
  });

  it("trata resposta sem ra como falha", async () => {
    callAdminCreateHuman.mockResolvedValue({ data: { created: true } });
    await expect(createHumanV1(requiredOnly())).rejects.toBeInstanceOf(
      HumanCreateError,
    );
  });
});

describe("createHumanV1 — normalização de erro do callable", () => {
  beforeEach(() => vi.clearAllMocks());

  const cases: Array<[string, string, string]> = [
    ["functions/permission-denied", "PERMISSION_DENIED", "permissão"],
    ["functions/already-exists", "ALREADY_EXISTS", "RA"],
    ["functions/invalid-argument", "INVALID_ARGUMENT", "inválidos"],
    ["functions/unauthenticated", "UNAUTHENTICATED", "sessão"],
    ["functions/internal", "INTERNAL", "Tente novamente"],
  ];

  for (const [code, category, messageFragment] of cases) {
    it(`mapeia ${code} -> ${category}`, async () => {
      const failure = Object.assign(new Error("backend prose"), { code });
      callAdminCreateHuman.mockRejectedValue(failure);

      await expect(createHumanV1(requiredOnly())).rejects.toMatchObject({
        category,
      });
      await expect(createHumanV1(requiredOnly())).rejects.toThrow(
        new RegExp(messageFragment, "i"),
      );
    });
  }

  it("mapeia código desconhecido para UNKNOWN sem vazar prosa do SDK", async () => {
    callAdminCreateHuman.mockRejectedValue(
      Object.assign(new Error("weird internal detail"), { code: "functions/aborted" }),
    );

    const error = await createHumanV1(requiredOnly()).catch((e) => e);
    expect(error.category).toBe("UNKNOWN");
    expect(error.message).not.toContain("weird internal detail");
    expect(error.code).toBe("functions/aborted");
  });
});
