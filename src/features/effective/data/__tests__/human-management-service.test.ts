import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetHumanPassword, toggleInstructorRole } from "../human-management-service";

const mockCallAdminResetHumanPassword = vi.fn();
const mockCallSetK9InstructorRole = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock("@/lib/firebase/functions", () => ({
  callAdminResetHumanPassword: (args: unknown) => mockCallAdminResetHumanPassword(args),
  callSetK9InstructorRole: (args: unknown) => mockCallSetK9InstructorRole(args),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, coll, id) => ({ path: `${coll}/${id}` })),
  getDoc: vi.fn(),
  updateDoc: (ref: unknown, data: unknown) => mockUpdateDoc(ref, data),
  arrayUnion: vi.fn((x) => x),
  Timestamp: {
    now: () => ({ seconds: 123456, nanoseconds: 0 }),
  },
}));

vi.mock("@/lib/firebase/client", () => ({
  auth: {
    currentUser: {
      email: "gestor@gcm.com.br",
      displayName: "Gestor K9",
    },
  },
  db: {},
}));

describe("human-management-service: resetHumanPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna sucesso e temporaryPassword quando a callable responde com sucesso", async () => {
    mockCallAdminResetHumanPassword.mockResolvedValueOnce({
      data: { temporary_password: "TempPassword!123" },
    });

    const result = await resetHumanPassword("990011");

    expect(mockCallAdminResetHumanPassword).toHaveBeenCalledWith({ ra: "990011" });
    expect(result).toEqual({
      success: true,
      message: "Nova senha temporária gerada com sucesso.",
      temporaryPassword: "TempPassword!123",
    });
    // Invariante critico: servidor eh autoridade de auditoria canonica;
    // cliente NAO deve chamar updateDoc/appendAuditTrail.
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("mapeia erro de AUTH_IDENTITY_NOT_FOUND com mensagem clara", async () => {
    const error = {
      code: "functions/not-found",
      details: { reason: "AUTH_IDENTITY_NOT_FOUND" },
    };
    mockCallAdminResetHumanPassword.mockRejectedValueOnce(error);

    const result = await resetHumanPassword("990011");

    expect(result).toEqual({
      success: false,
      message: "Conta de acesso não encontrada para este agente no provedor de autenticação.",
    });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("mapeia erro de permission-denied adequadamente", async () => {
    const error = {
      code: "functions/permission-denied",
      message: "Permission denied",
    };
    mockCallAdminResetHumanPassword.mockRejectedValueOnce(error);

    const result = await resetHumanPassword("990011");

    expect(result).toEqual({
      success: false,
      message: "Você não tem permissão para redefinir a senha deste agente.",
    });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("mapeia erro de NOT_FOUND com mensagem de cadastro inexistente", async () => {
    const error = {
      code: "functions/not-found",
      details: { reason: "NOT_FOUND" },
    };
    mockCallAdminResetHumanPassword.mockRejectedValueOnce(error);

    const result = await resetHumanPassword("990099");

    expect(result).toEqual({
      success: false,
      message: "Cadastro do agente não encontrado.",
    });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("mapeia funcao nao implantada no servidor adequadamente", async () => {
    const error = {
      code: "functions/unimplemented",
      message: "Function not implemented",
    };
    mockCallAdminResetHumanPassword.mockRejectedValueOnce(error);

    const result = await resetHumanPassword("990011");

    expect(result).toEqual({
      success: false,
      message: "Função de reset ainda não disponível no servidor.",
    });
  });

  it("mapeia erro generico desconhecido com mensagem padrao", async () => {
    mockCallAdminResetHumanPassword.mockRejectedValueOnce(new Error("Network breakdown"));

    const result = await resetHumanPassword("990011");

    expect(result).toEqual({
      success: false,
      message: "Falha ao gerar nova senha. Tente novamente.",
    });
  });
});

describe("human-management-service: toggleInstructorRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invoca exclusivamente a callable setK9InstructorRole sem escrita direta no Firestore", async () => {
    mockCallSetK9InstructorRole.mockResolvedValueOnce({
      data: { ra: "990011", uid: "uid-990011", enabled: true },
    });

    await toggleInstructorRole("990011", true);

    expect(mockCallSetK9InstructorRole).toHaveBeenCalledWith({
      ra: "990011",
      enabled: true,
    });
    // Invariante critico F10/F20: auditoria canonica reside no backend;
    // o cliente nao deve tentar updateDoc direto em users/{ra}.
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("caracterizacao RED/GREEN: sucesso da callable nao eh convertido em falha por bloqueio de regras no cliente", async () => {
    mockCallSetK9InstructorRole.mockResolvedValueOnce({
      data: { ra: "990011", uid: "uid-990011", enabled: true },
    });
    mockUpdateDoc.mockRejectedValue(new Error("permission-denied: Missing or insufficient permissions"));

    // No codigo legado, esta chamada rejeitava porque tentava updateDoc em users/{ra} apos sucesso no backend.
    // Com o fix, a operacao conclui com sucesso com zero escrita client-side.
    await expect(toggleInstructorRole("990011", true)).resolves.toBeUndefined();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("propaga rejeicao da callable fail-closed sem tentar escrita no cliente", async () => {
    const error = new Error("permission-denied");
    mockCallSetK9InstructorRole.mockRejectedValueOnce(error);

    await expect(toggleInstructorRole("990011", false)).rejects.toThrow("permission-denied");

    expect(mockCallSetK9InstructorRole).toHaveBeenCalledWith({
      ra: "990011",
      enabled: false,
    });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
