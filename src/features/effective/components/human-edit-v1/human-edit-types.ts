/**
 * Human Edit V1 — tipos do domínio Personnel.
 *
 * Espelha EXATAMENTE o contrato homologado do callable
 * `adminPatchHumanPersonnel` (backend `canilGcmMobile` @ main f97ebaf,
 * `functions/src/admin_patch_human_personnel.ts`).
 *
 * Fronteira de propriedade (Personnel-only):
 *   - 12 campos editáveis;
 *   - 10 campos limpáveis explicitamente via `clearFields`;
 *   - `ra` é ALVO imutável: nunca entra em `patch` nem em `clearFields`.
 *
 * Deliberadamente FORA deste domínio (o backend recusa fail-closed):
 * foto (`photoUrl`/`photoURL`), acesso (`role`, `accessLevel`,
 * `access_profile_id`, `roles`, `admin`, `access_scope`, `claim_role`),
 * Auth (`email`, `uid`, `password`, `displayName`), treino
 * (`isK9Instructor`, `training_role`, `specialties`, `certifications`),
 * turno (`shiftGroupId`, `shiftLabel`), ciclo de vida (`active`, `status`)
 * e metadados de servidor.
 *
 * Os tipos são fechados de propósito: não existe index signature, então um
 * campo de outro domínio não é atribuível nem em tempo de compilação.
 */

/** Campos obrigatórios: podem ser omitidos do patch, mas nunca limpos. */
export const HUMAN_EDIT_REQUIRED_FIELDS = ["fullName", "callsign"] as const;

/** Campos opcionais de pessoal: patchaveis E limpáveis. */
export const HUMAN_EDIT_CLEARABLE_FIELDS = [
  "cpf",
  "birthDate",
  "phone",
  "institutionalEmail",
  "rank",
  "cargo",
  "unit",
  "team",
  "admissionDate",
  "notes",
] as const;

export type HumanEditRequiredField =
  (typeof HUMAN_EDIT_REQUIRED_FIELDS)[number];

export type HumanEditClearableField =
  (typeof HUMAN_EDIT_CLEARABLE_FIELDS)[number];

/** As 12 chaves de wire aceitas em `patch`. */
export type HumanEditField = HumanEditRequiredField | HumanEditClearableField;

/**
 * Ordem canônica dos 12 campos — obrigatórios primeiro, depois opcionais na
 * ordem do backend. Usada para saída determinística (`clearFields`,
 * `updatedFields`) e para iterar o diff.
 */
export const HUMAN_EDIT_FIELDS = [
  ...HUMAN_EDIT_REQUIRED_FIELDS,
  ...HUMAN_EDIT_CLEARABLE_FIELDS,
] as const satisfies readonly HumanEditField[];

/**
 * Valores de formulário do domínio Personnel. Todos os 12 campos são strings
 * (vazio = ausente na UI); a tradução de "vazio" para `clearFields` é
 * responsabilidade do adapter, nunca do formulário.
 */
export type HumanEditPersonnel = Record<HumanEditField, string>;

/** Corpo `patch` do callable: apenas os 12 campos, sempre string. */
export type HumanEditPatch = Partial<Record<HumanEditField, string>>;

/**
 * Plano de mutação derivado de baseline × current.
 *
 * `noop === true` significa que nenhuma alteração efetiva existe: o chamador
 * NÃO deve invocar o callable. Deliberadamente não devolvemos um payload
 * vazio "pronto para enviar", para que um no-op não possa ser confundido com
 * uma requisição legítima.
 */
export type HumanEditPatchPlan =
  | { noop: true }
  | {
      noop: false;
      patch: HumanEditPatch;
      clearFields: HumanEditClearableField[];
      /** Campos alterados, em ordem canônica (diagnóstico/UI). */
      updatedFields: HumanEditField[];
    };

export type HumanEditErrorCategory =
  /** Campo obrigatório vazio, ou tentativa de limpar campo não-limpável. */
  | "REQUIRED_FIELD_MISSING";

/** Erro local do adapter: nenhuma chamada de rede acontece quando ele é lançado. */
export class HumanEditError extends Error {
  readonly category: HumanEditErrorCategory;
  readonly field: HumanEditField | null;

  constructor(
    category: HumanEditErrorCategory,
    message: string,
    options: { field?: HumanEditField | null } = {},
  ) {
    super(message);
    this.name = "HumanEditError";
    this.category = category;
    this.field = options.field ?? null;
  }
}
