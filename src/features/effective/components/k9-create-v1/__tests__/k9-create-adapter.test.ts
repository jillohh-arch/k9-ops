import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthProfile } from "@/features/auth/providers/auth-provider";
import { mapK9CreateError, saveNewK9V1 } from "../k9-create-adapter";
import type { K9CreateFormValues } from "../k9-create-types";

const saveNewK9Mock = vi.fn();

vi.mock("@/features/effective/data/k9-admin-service", () => ({
  saveNewK9V1: (...args: unknown[]) => saveNewK9Mock(...args),
}));

const mockProfile = {
  ra: "1234",
  role: "admin",
  uid: "admin-uid",
} as unknown as AuthProfile;

const validValues: K9CreateFormValues = {
  birthDate: "2022-05-10",
  breed: "Pastor Belga Malinois",
  color: "Caramelo",
  microchip: "981098109810",
  name: "Thor",
  notes: "Cão de faro de entorpecentes",
  profileImageUrl: "",
  registrationNumber: "K9-2022-01",
  sex: "M",
  size: "Grande",
};

describe("k9-create-adapter — mapK9CreateError", () => {
  describe("duplicate registration / already-exists", () => {
    it("mapeia error.code already-exists", () => {
      const error = { code: "already-exists", message: "Error" };
      expect(mapK9CreateError(error)).toBe("Essa matrícula já está cadastrada.");
    });

    it("mapeia error.code functions/already-exists", () => {
      const error = { code: "functions/already-exists", message: "Error" };
      expect(mapK9CreateError(error)).toBe("Essa matrícula já está cadastrada.");
    });

    it("mapeia mensagem em português: 'Ja existe um K9 com esta matricula/RGA.'", () => {
      const error = new Error("Ja existe um K9 com esta matricula/RGA.");
      expect(mapK9CreateError(error)).toBe("Essa matrícula já está cadastrada.");
    });

    it("mapeia mensagem em português: 'Ja existe um K9 com este identificador.'", () => {
      const error = new Error("Ja existe um K9 com este identificador.");
      expect(mapK9CreateError(error)).toBe("Essa matrícula já está cadastrada.");
    });

    it("mapeia substrings em inglês: 'already exists' ou 'duplicate'", () => {
      expect(mapK9CreateError(new Error("Document already exists in collection."))).toBe(
        "Essa matrícula já está cadastrada.",
      );
      expect(mapK9CreateError(new Error("Duplicate registration key."))).toBe(
        "Essa matrícula já está cadastrada.",
      );
    });
  });

  describe("permission / authentication", () => {
    it("mapeia error.code permission-denied", () => {
      const error = { code: "permission-denied" };
      expect(mapK9CreateError(error)).toBe("Seu perfil não tem permissão para cadastrar K9.");
    });

    it("mapeia error.code functions/permission-denied", () => {
      const error = { code: "functions/permission-denied" };
      expect(mapK9CreateError(error)).toBe("Seu perfil não tem permissão para cadastrar K9.");
    });

    it("mapeia error.code unauthenticated", () => {
      const error = { code: "unauthenticated" };
      expect(mapK9CreateError(error)).toBe("Seu perfil não tem permissão para cadastrar K9.");
    });

    it("mapeia mensagem backend em português: 'Perfil sem permissao para k9.create.'", () => {
      const error = new Error("Perfil sem permissao para k9.create.");
      expect(mapK9CreateError(error)).toBe("Seu perfil não tem permissão para cadastrar K9.");
    });
  });

  describe("storage / photo upload", () => {
    it("mapeia error.code storage/unauthorized", () => {
      const error = { code: "storage/unauthorized", message: "User not authorized" };
      expect(mapK9CreateError(error)).toBe(
        "Não foi possível enviar a foto. Tente outro arquivo ou continue sem foto.",
      );
    });

    it("mapeia error.code storage/upload-failed", () => {
      const error = { code: "storage/upload-failed", message: "Upload failed" };
      expect(mapK9CreateError(error)).toBe(
        "Não foi possível enviar a foto. Tente outro arquivo ou continue sem foto.",
      );
    });

    it("mapeia mensagens contendo upload ou storage", () => {
      const error = new Error("Falha no upload da foto: network timeout");
      expect(mapK9CreateError(error)).toBe(
        "Não foi possível enviar a foto. Tente outro arquivo ou continue sem foto.",
      );
    });
  });

  describe("actionable backend validation messages", () => {
    it("repassa mensagem limpa de invalid-argument: 'Data de nascimento do K9 invalida.'", () => {
      const error = {
        code: "invalid-argument",
        message: "Data de nascimento do K9 invalida.",
      };
      expect(mapK9CreateError(error)).toBe("Data de nascimento do K9 invalida.");
    });

    it("remove prefixos técnicos da mensagem em invalid-argument", () => {
      const error = {
        code: "functions/invalid-argument",
        message: "functions/invalid-argument: Campo obrigatório ausente: breed",
      };
      expect(mapK9CreateError(error)).toBe("Campo obrigatório ausente: breed");
    });

    it("fornece mensagem acionável padrão quando invalid-argument não possui mensagem detalhada", () => {
      const error = { code: "invalid-argument", message: "" };
      expect(mapK9CreateError(error)).toBe(
        "Dados do K9 inválidos. Verifique as informações preenchidas.",
      );
    });

    it("surfa mensagem sobre data de nascimento mesmo sem code explícito", () => {
      const error = new Error("Data de nascimento do K9 inválida.");
      expect(mapK9CreateError(error)).toBe("Data de nascimento do K9 inválida.");
    });
  });

  describe("unknown error fallback", () => {
    it("retorna fallback seguro para erros desconhecidos", () => {
      expect(mapK9CreateError(new Error("Something weird happened"))).toBe(
        "Não foi possível cadastrar o K9. Tente novamente.",
      );
      expect(mapK9CreateError(null)).toBe("Não foi possível cadastrar o K9. Tente novamente.");
      expect(mapK9CreateError(undefined)).toBe("Não foi possível cadastrar o K9. Tente novamente.");
    });
  });
});

describe("k9-create-adapter — saveNewK9V1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("salva K9 válido sem imagem", async () => {
    saveNewK9Mock.mockResolvedValueOnce("dog-thor-123");

    const result = await saveNewK9V1({
      photoFile: null,
      profile: mockProfile,
      values: validValues,
    });

    expect(result).toBe("dog-thor-123");
    expect(saveNewK9Mock).toHaveBeenCalledTimes(1);
    expect(saveNewK9Mock).toHaveBeenCalledWith({
      photoFile: null,
      profile: mockProfile,
      values: validValues,
    });
  });

  it("salva K9 válido com imagem", async () => {
    saveNewK9Mock.mockResolvedValueOnce("dog-thor-with-photo");
    const photoFile = new File(["dummy"], "thor.jpg", { type: "image/jpeg" });

    const result = await saveNewK9V1({
      photoFile,
      profile: mockProfile,
      values: validValues,
    });

    expect(result).toBe("dog-thor-with-photo");
    expect(saveNewK9Mock).toHaveBeenCalledTimes(1);
    expect(saveNewK9Mock).toHaveBeenCalledWith({
      photoFile,
      profile: mockProfile,
      values: validValues,
    });
  });

  it("lança erro mapeado quando saveNewK9 falha com matrícula duplicada", async () => {
    saveNewK9Mock.mockRejectedValueOnce({
      code: "already-exists",
      message: "Ja existe um K9 com esta matricula/RGA.",
    });

    await expect(
      saveNewK9V1({
        photoFile: null,
        profile: mockProfile,
        values: validValues,
      }),
    ).rejects.toThrow("Essa matrícula já está cadastrada.");
  });

  it("lança erro mapeado quando saveNewK9 falha com erro de upload de foto", async () => {
    saveNewK9Mock.mockRejectedValueOnce({
      code: "storage/unauthorized",
      message: "Permission denied",
    });

    await expect(
      saveNewK9V1({
        photoFile: new File(["x"], "photo.png", { type: "image/png" }),
        profile: mockProfile,
        values: validValues,
      }),
    ).rejects.toThrow("Não foi possível enviar a foto. Tente outro arquivo ou continue sem foto.");
  });

  it("lança erro mapeado quando saveNewK9 falha com erro de permissão", async () => {
    saveNewK9Mock.mockRejectedValueOnce({
      code: "permission-denied",
      message: "Perfil sem permissao para k9.create.",
    });

    await expect(
      saveNewK9V1({
        photoFile: null,
        profile: mockProfile,
        values: validValues,
      }),
    ).rejects.toThrow("Seu perfil não tem permissão para cadastrar K9.");
  });
});
