import type { AuthProfile } from "@/features/auth/providers/auth-provider";

import { saveNewK9V1 as saveNewK9 } from "@/features/effective/data/k9-admin-service";

import type { K9CreateFormValues } from "./k9-create-types";

function extractErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code.toLowerCase().trim() : "";
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message.trim();
  }
  return "";
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Mapeia erros da criação de K9 (backend Firebase Functions, Storage e validações)
 * para mensagens claras e acionáveis para o operador.
 */
export function mapK9CreateError(error: unknown): string {
  const rawCode = extractErrorCode(error);
  const normalizedCode = rawCode.replace(/^functions\//, "");
  const message = extractErrorMessage(error);
  const normalizedMessage = normalizeText(message);

  // 1. Falha de upload / Firebase Storage
  if (
    rawCode.startsWith("storage/") ||
    normalizedCode.startsWith("storage/") ||
    normalizedMessage.includes("storage") ||
    normalizedMessage.includes("upload") ||
    normalizedMessage.includes("enviar a foto") ||
    normalizedMessage.includes("enviar foto")
  ) {
    return "Não foi possível enviar a foto. Tente outro arquivo ou continue sem foto.";
  }

  // 2. Matrícula ou K9 já existente / duplicado
  if (
    normalizedCode === "already-exists" ||
    normalizedCode === "already_exists" ||
    normalizedMessage.includes("already exists") ||
    normalizedMessage.includes("already-exists") ||
    normalizedMessage.includes("duplicate") ||
    normalizedMessage.includes("ja existe") ||
    normalizedMessage.includes("esta matricula") ||
    normalizedMessage.includes("este identificador") ||
    (normalizedMessage.includes("matricula") && normalizedMessage.includes("cadastrad"))
  ) {
    return "Essa matrícula já está cadastrada.";
  }

  // 3. Permissão / autenticação
  if (
    normalizedCode === "permission-denied" ||
    normalizedCode === "permission_denied" ||
    normalizedCode === "unauthenticated" ||
    normalizedCode === "unauthorized" ||
    normalizedMessage.includes("permissao") ||
    normalizedMessage.includes("permission") ||
    normalizedMessage.includes("unauthenticated") ||
    normalizedMessage.includes("sem permissao") ||
    normalizedMessage.includes("nao autenticado")
  ) {
    return "Seu perfil não tem permissão para cadastrar K9.";
  }

  // 4. Mensagens acionáveis do backend (ex: invalid-argument, data inválida, campos obrigatórios)
  if (
    normalizedCode === "invalid-argument" ||
    normalizedCode === "invalid_argument" ||
    normalizedCode === "out-of-range"
  ) {
    if (message) {
      const cleaned = message
        .replace(/^(functions\/[a-z-]+:\s*)/i, "")
        .replace(/^(firebaseerror:\s*)/i, "")
        .replace(/^(error:\s*)/i, "")
        .trim();
      if (cleaned) {
        return cleaned;
      }
    }
    return "Dados do K9 inválidos. Verifique as informações preenchidas.";
  }

  // Mensagens em português acionáveis sem código explícito
  if (
    normalizedMessage.includes("data de nascimento") &&
    (normalizedMessage.includes("invalida") || normalizedMessage.includes("futura"))
  ) {
    return message || "Data de nascimento do K9 inválida.";
  }

  if (
    normalizedMessage.includes("campo obrigatorio") ||
    normalizedMessage.includes("obrigatorio ausente")
  ) {
    return message;
  }

  // 5. Fallback seguro para erros desconhecidos
  return "Não foi possível cadastrar o K9. Tente novamente.";
}

/** Narrow CREATE V1 adapter; Edit remains on the legacy save path. */
export async function saveNewK9V1({
  photoFile,
  profile,
  values,
}: {
  photoFile: File | null;
  profile: AuthProfile;
  values: K9CreateFormValues;
}) {
  try {
    return await saveNewK9({ photoFile, profile, values });
  } catch (error) {
    throw new Error(mapK9CreateError(error));
  }
}
