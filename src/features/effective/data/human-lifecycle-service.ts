/**
 * Human Lifecycle V1 — orquestracao Web de DESATIVAR / REATIVAR.
 *
 * Fala exclusivamente contra o backend congelado
 * `ba5284388023ff04cf42e7aa30f29a9fca78508f`:
 *
 *   HumanRecord (onSnapshot)
 *     -> resolveHumanVersionToken()   (autoridade OCC do Human Edit V1, reusada)
 *     -> callAdminDeactivateHuman / callAdminReactivateHuman
 *     -> mapHumanLifecycleError()     (categoria estavel por `details.reason`)
 *
 * NAO escreve Firestore, NAO grava audit, NAO toca Auth, NAO le acesso e NAO
 * reimplementa ciclo de vida: o servidor e a unica autoridade. Tambem nao
 * consome os writers diretos legados (`deactivateUser`/`reactivateUser`).
 *
 * POR QUE UM MAPPER PROPRIO, e nao `mapHumanEditSaveError`:
 * o Human Edit distingue por `error.code` porque `failed-precondition` tinha um
 * unico significado la. No Lifecycle, QUATRO reasons compartilham
 * `failed-precondition` e TRES compartilham `internal`. Mapear por code
 * achataria justamente as distincoes que o contrato congelado existe para
 * garantir — em particular a diferenca entre "o acesso foi suspenso" e "a
 * operacao nao teve efeito". A desambiguacao vem de `details.reason`, nunca de
 * substring da mensagem (isso acoplaria a Web a prose do backend).
 */

import {
  callAdminDeactivateHuman,
  callAdminReactivateHuman,
  type AdminDeactivateHumanResult,
  type AdminReactivateHumanResult,
} from "@/lib/firebase/functions";

import { resolveHumanVersionToken } from "@/features/effective/components/human-edit-v1/human-edit-adapter";

/** Minimo exigido do motivo, alinhado ao `MIN_REASON_LENGTH` do backend. */
export const LIFECYCLE_MIN_REASON_LENGTH = 5;

/**
 * Categorias estaveis consumidas pela UI. Uma categoria por consequencia
 * OPERACIONAL, nao por code Firebase — dois reasons com o mesmo code podem
 * exigir mensagens opostas.
 */
export type HumanLifecycleErrorCategory =
  /** Payload/entrada invalida (inclui token de versao ausente no cliente). */
  | "INVALID_INPUT"
  /** Cadastro nao encontrado. */
  | "NOT_FOUND"
  /** Sem autenticacao ou sem `humans.archive`. */
  | "PERMISSION_DENIED"
  /** O administrador logado nao pode desativar o proprio cadastro. */
  | "SELF_DEACTIVATION_FORBIDDEN"
  /** Existe turno operacional ativo; autoridade e do backend. */
  | "ACTIVE_SHIFT"
  /** Documento alterado por outra sessao: conflito de concorrencia. */
  | "STALE_WRITE"
  /** Estado global (Personnel + Auth) ja convergido: informativo, nao falha. */
  | "ALREADY_IN_STATE"
  /** O vinculo com a conta de autenticacao esta inconsistente. */
  | "AUTH_IDENTITY_BROKEN"
  /** Falha operacional ao mutar a conta de autenticacao. */
  | "AUTH_OPERATION_FAILED"
  /** Acesso FOI suspenso e permanece suspenso; a auditoria falhou. */
  | "AUTH_APPLIED_AUDIT_FAILED"
  /** Reativacao nao concluida; a tentativa foi revertida, conta segue bloqueada. */
  | "AUTH_ENABLE_REVERTED_AUDIT_FAILED"
  /** Reversao nao garantida: estado potencialmente divergente. */
  | "COMPENSATION_FAILED"
  /** Reason desconhecido/ausente: fallback seguro. */
  | "UNKNOWN";

/**
 * Erro tipado para a UI.
 *
 * `mutationApplied` responde a pergunta que a UI precisa fazer antes de escolher
 * a copy: "algo mudou no servidor?".
 *   - `true`      => houve efeito (ex.: acesso suspenso, audit falhou);
 *   - `false`     => nada mudou;
 *   - `"unknown"` => estado potencialmente divergente, NAO presuma.
 */
export class HumanLifecycleError extends Error {
  readonly category: HumanLifecycleErrorCategory;
  readonly code: string | null;
  readonly reason: string | null;
  readonly mutationApplied: boolean | "unknown";
  readonly originalMessage: string;

  constructor(
    category: HumanLifecycleErrorCategory,
    message: string,
    options: {
      code?: string | null;
      mutationApplied?: boolean | "unknown";
      originalMessage?: string;
      reason?: string | null;
    } = {},
  ) {
    super(message);
    this.name = "HumanLifecycleError";
    this.category = category;
    this.code = options.code ?? null;
    this.reason = options.reason ?? null;
    this.mutationApplied = options.mutationApplied ?? false;
    this.originalMessage = options.originalMessage ?? message;
  }
}

/** Extracao defensiva de `error.code` (Functions prefixa com `functions/`). */
function callableCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** Extracao defensiva de `error.details.reason`, o discriminador do contrato. */
function callableReason(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const details = (error as { details?: unknown }).details;
  if (typeof details !== "object" || details === null) return null;
  const reason = (details as { reason?: unknown }).reason;
  return typeof reason === "string" && reason.length > 0 ? reason : null;
}

/**
 * Mapa reason -> categoria + se houve mutacao no servidor.
 *
 * Note que `AUTH_APPLIED_AUDIT_FAILED` marca `mutationApplied: true`: a
 * suspensao de acesso ACONTECEU. Dizer "nao foi possivel desativar" seria
 * factualmente errado e levaria o operador a uma decisao insegura.
 */
const REASON_MAP: Record<
  string,
  { category: HumanLifecycleErrorCategory; mutationApplied: boolean | "unknown" }
> = {
  INVALID_ARGUMENT: { category: "INVALID_INPUT", mutationApplied: false },
  NOT_FOUND: { category: "NOT_FOUND", mutationApplied: false },
  PERMISSION_DENIED: { category: "PERMISSION_DENIED", mutationApplied: false },
  SELF_DEACTIVATION_FORBIDDEN: {
    category: "SELF_DEACTIVATION_FORBIDDEN",
    mutationApplied: false,
  },
  ACTIVE_SHIFT: { category: "ACTIVE_SHIFT", mutationApplied: false },
  STALE_WRITE: { category: "STALE_WRITE", mutationApplied: false },
  ALREADY_IN_STATE: { category: "ALREADY_IN_STATE", mutationApplied: false },
  // Declarado no enum congelado, porem sem call site apos o A1.S1 (provado no
  // W0). Mantido como fallback defensivo, nunca como fluxo esperado.
  AUTH_IDENTITY_MISSING: {
    category: "AUTH_IDENTITY_BROKEN",
    mutationApplied: false,
  },
  AUTH_IDENTITY_NOT_FOUND: {
    category: "AUTH_IDENTITY_BROKEN",
    mutationApplied: false,
  },
  AUTH_OPERATION_FAILED: {
    category: "AUTH_OPERATION_FAILED",
    mutationApplied: false,
  },
  AUTH_APPLIED_AUDIT_FAILED: {
    category: "AUTH_APPLIED_AUDIT_FAILED",
    // O acesso FOI suspenso e permanece suspenso de proposito.
    mutationApplied: true,
  },
  AUTH_ENABLE_REVERTED_AUDIT_FAILED: {
    category: "AUTH_ENABLE_REVERTED_AUDIT_FAILED",
    // A tentativa foi revertida: nada permaneceu aplicado.
    mutationApplied: false,
  },
  COMPENSATION_FAILED: {
    category: "COMPENSATION_FAILED",
    // A reversao nao foi garantida: NAO presuma estado.
    mutationApplied: "unknown",
  },
};

/** Fallback por code, usado apenas quando `details.reason` esta ausente. */
function categoryFromCode(code: string | null): HumanLifecycleErrorCategory {
  const normalized = (code ?? "").toLowerCase().replace(/^functions\//, "");
  if (normalized === "unauthenticated" || normalized === "permission-denied") {
    return "PERMISSION_DENIED";
  }
  if (normalized === "invalid-argument") return "INVALID_INPUT";
  if (normalized === "not-found") return "NOT_FOUND";
  return "UNKNOWN";
}

/**
 * Mapeia falha de callable para categoria estavel.
 *
 * Prioridade absoluta de `details.reason` sobre `code`: dois reasons com o mesmo
 * code exigem tratamento diferente, e o inverso nunca ocorre.
 */
export function mapHumanLifecycleError(error: unknown): HumanLifecycleError {
  if (error instanceof HumanLifecycleError) return error;

  const code = callableCode(error);
  const reason = callableReason(error);
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Falha ao alterar o estado do agente.";

  const mapped = reason ? REASON_MAP[reason] : undefined;

  return new HumanLifecycleError(
    mapped?.category ?? categoryFromCode(code),
    message,
    {
      code,
      // Sem reason conhecido nao ha como afirmar que nada mudou.
      mutationApplied: mapped?.mutationApplied ?? (reason ? "unknown" : false),
      originalMessage: message,
      reason,
    },
  );
}

/**
 * Os results sao os do freeze, sem reempacotamento.
 *
 * Antes o service devolvia um shape proprio com `authState: ... | null`, o que
 * era o mesmo enfraquecimento do W2-1 uma camada acima: `null` nao e um valor
 * que o backend produz.
 */
export type {
  AdminDeactivateHumanResult as DeactivateHumanLifecycleResult,
  AdminReactivateHumanResult as ReactivateHumanLifecycleResult,
} from "@/lib/firebase/functions";

/** Documento canonico observado pela pagina (onSnapshot de `users/{ra}`). */
export type HumanLifecycleRecord = Record<string, unknown> | null | undefined;

/**
 * Token de concorrencia da operacao.
 *
 * `resolveHumanVersionToken` e a autoridade do Human Edit V1 —
 * `max(updated_at, updatedAt)`, jamais um unico espelho. Reusada por import: os
 * dois espelhos nao sao mantidos em sincronia por todos os escritores, e eleger
 * um deles permitiria lost update silencioso.
 *
 * `null` e um valor VALIDO de contrato (documento sem nenhum espelho), por isso
 * a ausencia de token e sinalizada por `hasRecord`, nao por `token === null`.
 */
function resolveExpectedUpdatedAt(record: HumanLifecycleRecord): {
  hasRecord: boolean;
  token: number | null;
} {
  if (!record) return { hasRecord: false, token: null };
  return { hasRecord: true, token: resolveHumanVersionToken(record) };
}

/**
 * Sem o documento observado nao existe token de concorrencia, e enviar um valor
 * inventado (`0`, por exemplo) faria o backend abortar com STALE_WRITE por um
 * motivo falso. Falha localmente, com ZERO chamada de rede.
 */
function requireRecord(record: HumanLifecycleRecord): number | null {
  const resolved = resolveExpectedUpdatedAt(record);
  if (!resolved.hasRecord) {
    throw new HumanLifecycleError(
      "INVALID_INPUT",
      "Dados do agente ainda nao carregados. Aguarde a atualizacao e tente novamente.",
      { mutationApplied: false },
    );
  }
  return resolved.token;
}

function requireRa(ra: string): string {
  const trimmed = typeof ra === "string" ? ra.trim() : "";
  if (trimmed.length === 0) {
    throw new HumanLifecycleError("INVALID_INPUT", "RA ausente.", {
      mutationApplied: false,
    });
  }
  return trimmed;
}

/**
 * DESATIVAR. `reason` e obrigatorio e validado no cliente antes de qualquer
 * chamada — o backend tambem valida, mas gastar uma ida de rede para descobrir
 * que o texto tem 3 caracteres e desperdicio.
 */
export async function deactivateHumanLifecycle(input: {
  ra: string;
  reason: string;
  record: HumanLifecycleRecord;
}): Promise<AdminDeactivateHumanResult> {
  const ra = requireRa(input.ra);
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < LIFECYCLE_MIN_REASON_LENGTH) {
    throw new HumanLifecycleError(
      "INVALID_INPUT",
      `Informe o motivo da desativacao (minimo ${LIFECYCLE_MIN_REASON_LENGTH} caracteres).`,
      { mutationApplied: false },
    );
  }
  const expectedUpdatedAt = requireRecord(input.record);

  try {
    // Sem defaults: o freeze garante os cinco campos em todos os caminhos de
    // sucesso, e fabricar um valor ausente converteria degradacao silenciosa em
    // "sucesso" aparente.
    const { data } = await callAdminDeactivateHuman({
      expectedUpdatedAt,
      ra,
      reason,
    });
    return data;
  } catch (error) {
    throw mapHumanLifecycleError(error);
  }
}

/**
 * REATIVAR. `reason` e opcional no contrato congelado e deliberadamente NAO
 * enviado no V1 — a chave e omitida do payload, nunca enviada vazia (o payload
 * do backend e fechado e `reason: ""` seria recusado como invalido).
 */
export async function reactivateHumanLifecycle(input: {
  ra: string;
  record: HumanLifecycleRecord;
}): Promise<AdminReactivateHumanResult> {
  const ra = requireRa(input.ra);
  const expectedUpdatedAt = requireRecord(input.record);

  try {
    // Sem defaults, mesma razao da desativacao.
    const { data } = await callAdminReactivateHuman({ expectedUpdatedAt, ra });
    return data;
  } catch (error) {
    throw mapHumanLifecycleError(error);
  }
}

/**
 * Estado de ciclo de vida derivado do MESMO snapshot que alimenta o OCC.
 *
 * Espelha os leitores canonicos (`human-edit-service`, pagina de perfil):
 * qualquer marcador de arquivamento conta, nao apenas `active`. Assim o botao
 * exibido e o token enviado vem da mesma versao observada do documento — nao ha
 * segunda autoridade de `active` no painel.
 */
export function isHumanLifecycleActive(record: HumanLifecycleRecord): boolean {
  if (!record) return true;
  if (record.active === false) return false;
  if (record.deleted_at != null) return false;
  if (record.archived_at != null) return false;
  const status = record.status;
  if (typeof status === "string") {
    const normalized = status
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (normalized === "inativo" || normalized === "inactive") return false;
  }
  return true;
}
