/**
 * Human Create V1 — pure request adapter.
 *
 * No React, no Firebase, no Storage. Two responsibilities:
 *   1. project the UI form values onto the STRICT wire payload of
 *      `adminCreateHuman` (allowlist of 13 fields; blanks omitted);
 *   2. map callable failures onto a typed category, preserving code/message.
 *
 * The wire shape mirrors the homologated backend (gate H4-C): `ra/fullName/
 * callsign` required, the rest optional personnel data. Access, Auth, Training,
 * Binomial, Shift and Photo fields can never be produced here — they are simply
 * not part of the projection.
 */

import type { AdminCreateHumanRequest } from "@/lib/firebase/functions";

import type { HumanCreateFormValues } from "./human-create-types";

/** Opcionais textuais de pessoal: mapeamento 1:1 form -> wire. */
const OPTIONAL_WIRE_FIELDS = [
  "rank",
  "cargo",
  "unit",
  "team",
  "admissionDate",
  "cpf",
  "birthDate",
  "phone",
  "institutionalEmail",
  "notes",
] as const satisfies ReadonlyArray<
  Exclude<keyof AdminCreateHumanRequest, "ra" | "fullName" | "callsign">
>;

/**
 * Projeta os valores do formulário no payload estrito do `adminCreateHuman`.
 *
 * - required (ra/fullName/callsign): sempre presentes, trim aplicado;
 * - opcionais: incluídos SOMENTE quando não-vazios após trim. Um opcional em
 *   branco é OMITIDO — nunca enviado como null ou string vazia. Isso alinha com
 *   o contrato do backend (omissão = ausência; null = REJECT).
 *
 * Nenhuma chave fora do allowlist é construída, então é estruturalmente
 * impossível vazar campo de acesso/Auth/treino/binômio/turno/foto/ciclo de vida.
 */
export function projectHumanCreateRequest(
  values: HumanCreateFormValues,
): AdminCreateHumanRequest {
  const request: AdminCreateHumanRequest = {
    ra: values.ra.trim(),
    fullName: values.fullName.trim(),
    callsign: values.callsign.trim(),
  };

  for (const field of OPTIONAL_WIRE_FIELDS) {
    const trimmed = values[field].trim();
    if (trimmed.length > 0) {
      request[field] = trimmed;
    }
  }

  return request;
}

export type HumanCreateErrorCategory =
  | "UNAUTHENTICATED"
  | "PERMISSION_DENIED"
  | "INVALID_ARGUMENT"
  | "ALREADY_EXISTS"
  | "INTERNAL"
  | "UNKNOWN";

/** Mensagem em PT-BR por categoria, sem acoplar à prosa exata do backend. */
const MESSAGE_BY_CATEGORY: Record<HumanCreateErrorCategory, string> = {
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente para cadastrar.",
  PERMISSION_DENIED: "Seu perfil não tem permissão para cadastrar integrantes.",
  INVALID_ARGUMENT: "Dados inválidos. Revise os campos e tente novamente.",
  ALREADY_EXISTS: "Já existe um integrante com este RA.",
  INTERNAL: "Não foi possível concluir o cadastro. Tente novamente.",
  UNKNOWN: "Não foi possível cadastrar o integrante. Tente novamente.",
};

export class HumanCreateError extends Error {
  readonly category: HumanCreateErrorCategory;
  readonly code: string | null;

  constructor(category: HumanCreateErrorCategory, code: string | null) {
    super(MESSAGE_BY_CATEGORY[category]);
    this.name = "HumanCreateError";
    this.category = category;
    this.code = code;
  }
}

function callableCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Normaliza uma falha do callable numa categoria tipada. O prefixo `functions/`
 * do Firebase SDK é removido antes do match para não depender do transporte.
 */
export function mapHumanCreateError(error: unknown): HumanCreateError {
  if (error instanceof HumanCreateError) return error;

  const rawCode = callableCode(error);
  const normalized = (rawCode ?? "").toLowerCase().replace(/^functions\//, "");

  const category: HumanCreateErrorCategory =
    normalized === "unauthenticated"
      ? "UNAUTHENTICATED"
      : normalized === "permission-denied"
        ? "PERMISSION_DENIED"
        : normalized === "invalid-argument"
          ? "INVALID_ARGUMENT"
          : normalized === "already-exists"
            ? "ALREADY_EXISTS"
            : normalized === "internal"
              ? "INTERNAL"
              : "UNKNOWN";

  return new HumanCreateError(category, rawCode);
}
