import {
  defaultAccessProfiles,
  getDefaultAccessProfile,
  getProfileIdFromLegacyValue,
  type AccessProfile,
} from "@/lib/permissions/access-control";

export type HumanAccessStatus =
  | "unprovisioned"
  | "configured"
  | "incomplete";

export type HumanAccessReadModel = {
  status: HumanAccessStatus;
  statusLabel: string;
  detail: string;
  profileId: string | null;
  profileName: string | null;
  hasAccess: boolean;
  rawReference: string | null;
};

function readText(record: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return null;
}

/**
 * Deriva o modelo de leitura honesto de acesso de um integrante.
 *
 * Regras estritas:
 * 1. Sem profile id / sem perfil -> "unprovisioned" ("Não provisionado").
 *    JAMAIS faz fallback para "Operador" ou "operador_k9".
 * 2. Perfil válido explicitamente configurado -> "configured" ("Perfil configurado").
 *    Exibe o nome factual do perfil. JAMAIS rotula como "Acesso Ativo" ou "Conta ativa"
 *    baseando-se em `users.active`, pois o estado real do Firebase Auth é desconhecido no cliente.
 * 3. Referência de acesso malformada ou apontando para perfil inexistente -> "incomplete" ("Configuração incompleta").
 * 4. A ausência de `auth_uid` NÃO é tratada como ausência de conta de Auth.
 */
export function resolveHumanAccessReadModel(
  user: Record<string, unknown> | null | undefined,
  availableProfiles: AccessProfile[] = defaultAccessProfiles,
): HumanAccessReadModel {
  if (!user) {
    return {
      detail: "Nenhum perfil de acesso configurado",
      hasAccess: false,
      profileId: null,
      profileName: null,
      rawReference: null,
      status: "unprovisioned",
      statusLabel: "Não provisionado",
    };
  }

  // 1. Procura identificadores explícitos de perfil
  const explicitProfileId = readText(
    user,
    "access_profile_id",
    "accessProfileId",
    "profile_id",
    "profileId",
  );

  // 2. Procura referências legadas/textuais
  const legacyReference = readText(
    user,
    "access_profile",
    "accessProfile",
    "access_level",
    "accessLevel",
  );

  const rawReference = explicitProfileId ?? legacyReference;

  // CASO A: Nenhuma chave de acesso presente
  if (!rawReference) {
    return {
      detail: "Sem perfil de acesso vinculado",
      hasAccess: false,
      profileId: null,
      profileName: null,
      rawReference: null,
      status: "unprovisioned",
      statusLabel: "Não provisionado",
    };
  }

  // Tenta resolver por ID direto na lista de perfis disponíveis
  const matchedById = availableProfiles.find(
    (p) => p.id === rawReference || p.slug === rawReference,
  ) ?? getDefaultAccessProfile(rawReference);

  if (matchedById) {
    return {
      detail: matchedById.name,
      hasAccess: true,
      profileId: matchedById.id,
      profileName: matchedById.name,
      rawReference,
      status: "configured",
      statusLabel: "Perfil configurado",
    };
  }

  // Tenta resolver por valor legado/alias conhecido
  const legacyResolvedId = getProfileIdFromLegacyValue(rawReference);
  if (legacyResolvedId) {
    const matchedByLegacy = availableProfiles.find(
      (p) => p.id === legacyResolvedId || p.slug === legacyResolvedId,
    ) ?? getDefaultAccessProfile(legacyResolvedId);

    if (matchedByLegacy) {
      return {
        detail: matchedByLegacy.name,
        hasAccess: true,
        profileId: matchedByLegacy.id,
        profileName: matchedByLegacy.name,
        rawReference,
        status: "configured",
        statusLabel: "Perfil configurado",
      };
    }
  }

  // CASO C: Referência existe mas não pôde ser resolvida
  return {
    detail: `Referência '${rawReference}' não localizada`,
    hasAccess: false,
    profileId: null,
    profileName: null,
    rawReference,
    status: "incomplete",
    statusLabel: "Configuração incompleta",
  };
}
