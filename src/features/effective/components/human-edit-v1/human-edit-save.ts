import {
  callAdminPatchHumanPersonnel,
  type AdminPatchHumanPersonnelClearableField,
  type AdminPatchHumanPersonnelField,
  type AdminPatchHumanPersonnelRequest,
} from "@/lib/firebase/functions";

import { buildHumanEditPatch } from "./human-edit-adapter";
import type { HumanEditPersonnel } from "./human-edit-types";

/**
 * Human Edit V1 — orquestração de SAVE (sem React, sem Firestore).
 *
 * Junta o planejador de patch congelado (A1) ao callable congelado (B1):
 *   baseline + draft + versionToken
 *     → buildHumanEditPatch()  (A1, única autoridade de diff/clear)
 *     → no-op? então ZERO chamada de backend
 *     → senão callAdminPatchHumanPersonnel (B1) com expectedUpdatedAt SEMPRE presente
 *     → resultado tipado / erro tipado por categoria (sem acoplar a prose do backend).
 *
 * NÃO carrega o Human (B2 faz isso), NÃO renderiza, NÃO troca rota, NÃO lê
 * Auth/acesso. `PRECONDITION_FAILED` NÃO é desambiguado aqui — a UI (C2)
 * re-lê via B2 e distingue archived de conflito pelo estado atual.
 */

export type HumanEditSaveInput = {
  ra: string;
  baseline: HumanEditPersonnel;
  current: HumanEditPersonnel;
  versionToken: number | null;
};

export type HumanEditSaveResult = {
  ra: string;
  noop: boolean;
  updatedFields: string[];
  clearedFields: string[];
};

export type HumanEditSaveErrorCategory =
  | "UNAUTHENTICATED"
  | "PERMISSION_DENIED"
  | "INVALID_ARGUMENT"
  | "PRECONDITION_FAILED"
  | "NOT_FOUND"
  | "UNKNOWN";

/** Erro tipado voltado à UI. `category` é estável; a prose do backend fica só como diagnóstico. */
export class HumanEditSaveError extends Error {
  readonly category: HumanEditSaveErrorCategory;
  readonly code: string | null;
  readonly originalMessage: string;

  constructor(
    category: HumanEditSaveErrorCategory,
    message: string,
    options: { code?: string | null; originalMessage?: string } = {},
  ) {
    super(message);
    this.name = "HumanEditSaveError";
    this.category = category;
    this.code = options.code ?? null;
    this.originalMessage = options.originalMessage ?? message;
  }
}

function callableCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Mapeia falha de callable numa categoria tipada. `failed-precondition` cobre
 * TANTO concorrência obsoleta QUANTO registro arquivado no backend homologado;
 * é deliberadamente uma só categoria (`PRECONDITION_FAILED`) — desambiguar por
 * substring de mensagem acoplaria a Web à prose do backend. C2 re-lê via B2.
 */
export function mapHumanEditSaveError(error: unknown): HumanEditSaveError {
  if (error instanceof HumanEditSaveError) return error;
  const rawCode = callableCode(error);
  const normalized = (rawCode ?? "").toLowerCase().replace(/^functions\//, "");
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Falha ao salvar.";

  const category: HumanEditSaveErrorCategory =
    normalized === "unauthenticated"
      ? "UNAUTHENTICATED"
      : normalized === "permission-denied"
        ? "PERMISSION_DENIED"
        : normalized === "invalid-argument"
          ? "INVALID_ARGUMENT"
          : normalized === "failed-precondition"
            ? "PRECONDITION_FAILED"
            : normalized === "not-found"
              ? "NOT_FOUND"
              : "UNKNOWN";

  return new HumanEditSaveError(category, message, {
    code: rawCode,
    originalMessage: message,
  });
}

/** RA de identidade não-vazio — não há normalização que altere a identidade. */
function assertRa(ra: string): string {
  if (typeof ra !== "string" || ra.trim().length === 0) {
    throw new HumanEditSaveError("INVALID_ARGUMENT", "RA ausente.");
  }
  return ra;
}

/**
 * Calcula o plano (A1) e, se houver mudança efetiva, salva via B1.
 *
 * No-op → zero callable. Mudança → request estreito com `expectedUpdatedAt`
 * SEMPRE presente (inclusive `null`), `patch`/`clearFields` omitidos quando
 * vazios. Erros de callable saem tipados por `mapHumanEditSaveError`.
 */
export async function saveHumanEdit(
  input: HumanEditSaveInput,
): Promise<HumanEditSaveResult> {
  const ra = assertRa(input.ra);

  // A1 é a única autoridade de diff/clear/validação de campo obrigatório.
  // Um campo obrigatório esvaziado lança HumanEditError localmente (zero callable).
  const plan = buildHumanEditPatch(input.baseline, input.current);

  if (plan.noop) {
    return { ra, noop: true, updatedFields: [], clearedFields: [] };
  }

  const hasPatch = Object.keys(plan.patch).length > 0;
  const hasClear = plan.clearFields.length > 0;

  const request: AdminPatchHumanPersonnelRequest = {
    ra,
    expectedUpdatedAt: input.versionToken,
    ...(hasPatch
      ? {
          patch: plan.patch as Partial<
            Record<AdminPatchHumanPersonnelField, string>
          >,
        }
      : {}),
    ...(hasClear
      ? {
          clearFields:
            plan.clearFields as AdminPatchHumanPersonnelClearableField[],
        }
      : {}),
  };

  let data: Awaited<ReturnType<typeof callAdminPatchHumanPersonnel>>["data"];
  try {
    ({ data } = await callAdminPatchHumanPersonnel(request));
  } catch (error) {
    throw mapHumanEditSaveError(error);
  }

  // O backend pode omitir os arrays (marcados opcionais no wrapper); o plano A1
  // é o fallback determinístico. Nunca inventamos um novo version token — o
  // contrato congelado não devolve concorrência nova; a UI recarrega via B2.
  return {
    ra: data?.ra ?? ra,
    noop: false,
    updatedFields: data?.updatedFields ?? plan.updatedFields,
    clearedFields: data?.clearedFields ?? plan.clearFields,
  };
}
