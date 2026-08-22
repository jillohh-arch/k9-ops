import { describe, expect, it } from "vitest";

import { resolveHumanAccessReadModel } from "../human-access-read-model";

describe("resolveHumanAccessReadModel (H3-W2)", () => {
  it("CASO A: ausência de perfil de acesso resolve honestamente para 'Não provisionado'", () => {
    const userWithoutAccess = {
      callsign: "FALCAO",
      fullName: "Carlos Falcão",
      ra: "12345",
    };

    const result = resolveHumanAccessReadModel(userWithoutAccess);

    expect(result.status).toBe("unprovisioned");
    expect(result.statusLabel).toBe("Não provisionado");
    expect(result.hasAccess).toBe(false);
    expect(result.profileName).toBeNull();
    expect(result.profileId).toBeNull();
  });

  it("CASO A: NUNCA sintetiza 'Operador' ou 'operador_k9' por padrão", () => {
    const freshCreatedUser = {
      active: true,
      admissionDate: "2026-01-15",
      callsign: "NOVO_AGENTE",
      cargo: "Condutor K9",
      fullName: "Agente Silva",
      ra: "998877",
    };

    const result = resolveHumanAccessReadModel(freshCreatedUser);

    expect(result.statusLabel).not.toBe("Operador");
    expect(result.statusLabel).not.toBe("operador_k9");
    expect(result.detail).not.toContain("Operador");
    expect(result.status).toBe("unprovisioned");
    expect(result.statusLabel).toBe("Não provisionado");
  });

  it("CASO B: perfil explicitamente configurado por access_profile_id resolve nome factual", () => {
    const userWithAdmin = {
      access_profile_id: "administrador",
      callsign: "ADMIN1",
      ra: "1001",
    };

    const result = resolveHumanAccessReadModel(userWithAdmin);

    expect(result.status).toBe("configured");
    expect(result.statusLabel).toBe("Perfil configurado");
    expect(result.hasAccess).toBe(true);
    expect(result.profileId).toBe("administrador");
    expect(result.profileName).toBe("Administrador");
    expect(result.detail).toBe("Administrador");
  });

  it("CASO B: perfil explicitamente configurado por access_profile_id operador_k9", () => {
    const userWithOperadorK9 = {
      access_profile_id: "operador_k9",
      callsign: "CONDUTOR1",
      ra: "1002",
    };

    const result = resolveHumanAccessReadModel(userWithOperadorK9);

    expect(result.status).toBe("configured");
    expect(result.statusLabel).toBe("Perfil configurado");
    expect(result.hasAccess).toBe(true);
    expect(result.profileId).toBe("operador_k9");
    expect(result.profileName).toBe("Operador");
  });

  it("CASO B: perfil resolvido por referência legada válida (gestor)", () => {
    const legacyGestor = {
      accessLevel: "gestor",
      callsign: "COMANDANTE",
      ra: "1003",
    };

    const result = resolveHumanAccessReadModel(legacyGestor);

    expect(result.status).toBe("configured");
    expect(result.statusLabel).toBe("Perfil configurado");
    expect(result.hasAccess).toBe(true);
    expect(result.profileName).toBe("Gestor / Comando");
  });

  it("CASO C: referência de perfil inexistente/malformada resolve para 'Configuração incompleta'", () => {
    const corruptedProfile = {
      access_profile_id: "perfil_inexistente_xyz_999",
      callsign: "CORROMPIDO",
      ra: "9999",
    };

    const result = resolveHumanAccessReadModel(corruptedProfile);

    expect(result.status).toBe("incomplete");
    expect(result.statusLabel).toBe("Configuração incompleta");
    expect(result.hasAccess).toBe(false);
    expect(result.profileName).toBeNull();
    expect(result.detail).toContain("perfil_inexistente_xyz_999");
    // Não pode fazer fallback silencioso para Operador
    expect(result.statusLabel).not.toBe("Operador");
  });

  it("FRONTEIRA DE AUTORIDADE: users.active = false NÃO rotula o acesso como 'Desativado'", () => {
    // users.active é estado de ciclo de vida cadastral de pessoal, NÃO estado administrativo do Firebase Auth
    const inactivePersonnelWithProfile = {
      access_profile_id: "gestor",
      active: false,
      callsign: "INATIVO_CADASTRO",
      ra: "5555",
    };

    const result = resolveHumanAccessReadModel(inactivePersonnelWithProfile);

    // O status do perfil de acesso continua sendo o do perfil configurado
    expect(result.status).toBe("configured");
    expect(result.statusLabel).toBe("Perfil configurado");
    expect(result.statusLabel).not.toBe("Desativado");
    expect(result.statusLabel).not.toBe("Conta desativada");
  });

  it("FRONTEIRA DE AUTORIDADE: ausência de auth_uid não impede nem inventa estado de Auth", () => {
    // auth.token.email -> RA -> users/{ra} -> access_profile_id não requer auth_uid no documento
    const userWithoutAuthUid = {
      access_profile_id: "almoxarifado",
      callsign: "ESTOQUE",
      ra: "7777",
    };

    const result = resolveHumanAccessReadModel(userWithoutAuthUid);

    expect(result.status).toBe("configured");
    expect(result.profileName).toBe("Almoxarifado");
  });

  it("respeita lista customizada de perfis quando fornecida", () => {
    const customProfiles = [
      {
        description: "Perfil Especial",
        id: "custom_audit",
        level: "gerencial",
        module_tags: [],
        name: "Auditor Especial",
        permissions: {},
        role_keys: ["auditor"],
        seed_version: 1,
        slug: "custom_audit",
        status: "active" as const,
        tone: "violet",
      },
    ];

    const userWithCustom = {
      access_profile_id: "custom_audit",
      callsign: "AUDITOR",
      ra: "3333",
    };

    const result = resolveHumanAccessReadModel(userWithCustom, customProfiles);

    expect(result.status).toBe("configured");
    expect(result.profileName).toBe("Auditor Especial");
  });
});
