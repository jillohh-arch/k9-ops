/**
 * Human Edit V1 — adapter puro do domínio Personnel.
 *
 * Sem React, sem Firebase, sem Storage, sem I/O. Responsabilidades:
 *   1. projetar `users/{ra}` cru sobre a superfície Personnel (allowlist),
 *      propriedade por propriedade — nenhum spread cruza a fronteira;
 *   2. derivar o token de concorrência `max(updated_at, updatedAt)`;
 *   3. construir o plano de patch/clear a partir de baseline × current.
 *
 * O contrato de callable (Slice B) NÃO existe aqui: este arquivo não importa
 * `firebase/functions`, `httpsCallable` nem o SDK Firebase.
 */

import {
  HUMAN_EDIT_CLEARABLE_FIELDS,
  HUMAN_EDIT_FIELDS,
  HUMAN_EDIT_REQUIRED_FIELDS,
  HumanEditError,
  type HumanEditClearableField,
  type HumanEditField,
  type HumanEditPatch,
  type HumanEditPatchPlan,
  type HumanEditPersonnel,
} from "./human-edit-types";

const CLEARABLE_SET = new Set<string>(HUMAN_EDIT_CLEARABLE_FIELDS);
const REQUIRED_SET = new Set<string>(HUMAN_EDIT_REQUIRED_FIELDS);

/**
 * Precedência de alias por campo. SOMENTE aliases Personnel — nenhum campo de
 * acesso/Auth/foto/treino aparece aqui, então a projeção é estruturalmente
 * incapaz de sintetizar `cargo` a partir de `role`/`accessLevel` ou
 * `institutionalEmail` a partir do `email` de Auth.
 */
const PERSONNEL_ALIASES: Record<HumanEditField, readonly string[]> = {
  fullName: ["nomeCompleto", "name", "nome"],
  callsign: ["callsign", "callSign", "nome_guerra"],
  cpf: ["cpf", "document"],
  birthDate: ["birth_date", "birthDate"],
  phone: ["telefone", "phone"],
  institutionalEmail: ["institutional_email", "institutionalEmail"],
  rank: ["rank", "posto", "graduacao"],
  cargo: ["cargo", "função"],
  unit: ["unit", "unidade", "lotação"],
  team: ["team", "equipe"],
  admissionDate: ["admission_date", "admissionDate"],
  notes: ["notes", "observações"],
};

/**
 * Primeiro alias não-vazio (string/number), trim aplicado. Puro e
 * Personnel-only. Devolve "" quando nenhum alias tem valor utilizável.
 */
function firstPersonnelText(
  data: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return "";
}

/**
 * Projeta o documento cru `users/{ra}` sobre os 12 campos Personnel.
 *
 * Cada campo é lido por nome, na precedência de alias congelada — nenhum
 * `{ ...raw }`, então uma chave nova/estranha do documento não pode vazar para
 * o formulário nem para o patch.
 */
export function projectHumanEditPersonnel(
  data: Record<string, unknown> | null | undefined,
): HumanEditPersonnel {
  const source = data ?? {};
  const projected = {} as HumanEditPersonnel;
  for (const field of HUMAN_EDIT_FIELDS) {
    projected[field] = firstPersonnelText(source, PERSONNEL_ALIASES[field]);
  }
  return projected;
}

/**
 * Normaliza um valor timestamp-ish do documento para epoch millis.
 *
 * Os helpers `toMillis()`/`toDate()` vêm do documento, então são entrada
 * NÃO CONFIÁVEL: um valor malformado pode lançar. Uma exceção aqui
 * classificaria o espelho como erro de aplicação e — pior — abortaria a
 * resolução antes do outro espelho ser considerado. Por isso a invocação é
 * isolada: helper que lança é um timestamp INUTILIZÁVEL, ou seja, `null`.
 */
function timestampMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  const candidate = value as { toDate?: unknown; toMillis?: unknown };
  if (typeof candidate.toMillis === "function") {
    try {
      const millis = (candidate.toMillis as () => number)();
      return Number.isFinite(millis) ? millis : null;
    } catch {
      return null;
    }
  }
  if (typeof candidate.toDate === "function") {
    try {
      const asDate = (candidate.toDate as () => Date)();
      const millis = asDate?.getTime?.();
      return typeof millis === "number" && !Number.isNaN(millis)
        ? millis
        : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Autoridade de concorrência de `users/{ra}`: o MAIS NOVO entre os dois
 * espelhos `updated_at`/`updatedAt`.
 *
 * Deliberadamente NÃO é `updated_at ?? updatedAt` (nem o inverso): escritores
 * diferentes bumpam espelhos diferentes, então eleger o primeiro presente
 * aceitaria um precondition obsoleto. Um espelho malformado nunca esconde o
 * outro válido — cada um é normalizado independentemente e os nulos são
 * filtrados antes do `Math.max`.
 */
export function resolveHumanVersionToken(
  data: Record<string, unknown> | null | undefined,
): number | null {
  if (!data) return null;
  const candidates = [
    timestampMillis(data.updated_at),
    timestampMillis(data.updatedAt),
  ].filter((value): value is number => value !== null);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

/**
 * Diff baseline × current sobre os 12 campos owned.
 *
 * Semântica:
 *   - inalterado                         -> omite (backend preserva);
 *   - alterado para valor não-vazio      -> patch[field];
 *   - limpável populado -> agora vazio    -> clearFields;
 *   - limpável vazio -> vazio            -> omite;
 *   - obrigatório -> vazio               -> HumanEditError (fail closed);
 *   - `null` nunca é emitido;
 *   - `ra` nunca participa (não está no modelo).
 *
 * Sem alteração efetiva -> `{ noop: true }`, sem payload de rede.
 */
export function buildHumanEditPatch(
  baseline: HumanEditPersonnel,
  current: HumanEditPersonnel,
): HumanEditPatchPlan {
  const patch: HumanEditPatch = {};
  const clearFields: HumanEditClearableField[] = [];
  const updatedFields: HumanEditField[] = [];

  for (const field of HUMAN_EDIT_FIELDS) {
    const before = (baseline[field] ?? "").trim();
    const after = (current[field] ?? "").trim();

    if (after.length === 0 && REQUIRED_SET.has(field)) {
      // Fail closed mesmo que a validação de formulário tenha sido contornada.
      throw new HumanEditError(
        "REQUIRED_FIELD_MISSING",
        `O campo obrigatório "${field}" não pode ficar vazio.`,
        { field },
      );
    }
    if (before === after) continue;
    if (after.length === 0) {
      if (!CLEARABLE_SET.has(field)) {
        throw new HumanEditError(
          "REQUIRED_FIELD_MISSING",
          `O campo "${field}" não pode ser limpo.`,
          { field },
        );
      }
      clearFields.push(field as HumanEditClearableField);
      updatedFields.push(field);
      continue;
    }
    patch[field] = after;
    updatedFields.push(field);
  }

  if (updatedFields.length === 0) {
    return { noop: true };
  }
  return { noop: false, patch, clearFields, updatedFields };
}
