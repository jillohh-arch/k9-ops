/**
 * Contrato de classificação do roster de Efetivo K9.
 *
 * Função pura e testável: recebe status administrativo, especialidades e
 * (opcionalmente) a prontidão Health canônica, e devolve exatamente um grupo.
 *
 * Precedência (seção 10 do prompt de implementação):
 *   1. indisponibilidade administrativa / `temporarily_unfit`
 *   2. em formação sem prontidão para emprego
 *   3. pronto para emprego
 *   4. ativo sem classificação operacional
 *
 * Invariantes:
 * - especialidade `operational` NÃO é sinônimo de prontidão clínica;
 * - `temporarily_unfit` é bloqueante;
 * - `fit_with_restrictions` não vira indisponibilidade total automaticamente;
 * - `operational_attention` não vira indisponibilidade automaticamente;
 * - ausência de readiness nunca é lida como prontidão clínica;
 * - nenhum K9 fica fora de um grupo.
 */

export type K9RosterGroup =
  | "ready"
  | "formation"
  | "unavailable"
  | "unclassified_active";

/** Estados oficiais de prontidão do módulo Health. */
export type K9HealthReadiness =
  | "operational"
  | "operational_attention"
  | "fit_with_restrictions"
  | "temporarily_unfit"
  | "not_evaluated";

export type K9SpecialtyInput = {
  status?: string | null;
  type?: string | null;
};

export type K9ClassificationInput = {
  /** Prontidão Health canônica. `null`/`undefined` = fonte indisponível. */
  readiness?: K9HealthReadiness | null;
  specialties?: readonly K9SpecialtyInput[] | null;
  /** Status administrativo cru, como persistido (`Ativo`, `Licenca`, ...). */
  status?: string | null;
};

export type K9Classification = {
  group: K9RosterGroup;
  /** `true` quando o K9 é empregável porém com restrição não bloqueante. */
  hasNonBlockingRestriction: boolean;
  /** Motivo canônico da decisão, útil para depuração e para os testes. */
  reason: K9ClassificationReason;
};

export type K9ClassificationReason =
  | "administrative_unavailable"
  | "health_temporarily_unfit"
  | "in_formation"
  | "operational_specialty"
  | "no_operational_classification";

const READINESS_VALUES: readonly K9HealthReadiness[] = [
  "operational",
  "operational_attention",
  "fit_with_restrictions",
  "temporarily_unfit",
  "not_evaluated",
];

/**
 * Status administrativos que mantêm o K9 no efetivo empregável.
 * Qualquer outro valor conhecido (Licenca, Aposentado, Inativo...) é
 * indisponibilidade administrativa.
 */
const ACTIVE_STATUSES = new Set(["ativo", "active"]);

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Converte um valor cru em estado Health canônico.
 * Retorna `null` quando o valor não é reconhecido — nunca adivinha
 * `not_evaluated`, porque "não avaliado" é uma afirmação clínica e
 * "fonte ausente" não é.
 */
export function parseHealthReadiness(value: unknown): K9HealthReadiness | null {
  const normalized = normalize(value).replace(/[\s-]+/g, "_");
  return (
    READINESS_VALUES.find((candidate) => candidate === normalized) ?? null
  );
}

export function isAdministrativelyActive(status: string | null | undefined) {
  return ACTIVE_STATUSES.has(normalize(status));
}

function hasSpecialtyStatus(
  specialties: readonly K9SpecialtyInput[] | null | undefined,
  target: string,
) {
  return (specialties ?? []).some(
    (specialty) => normalize(specialty?.status) === target,
  );
}

export function classifyK9(input: K9ClassificationInput): K9Classification {
  const readiness = input.readiness ?? null;
  const hasNonBlockingRestriction =
    readiness === "fit_with_restrictions" ||
    readiness === "operational_attention";

  // 1. Indisponibilidade administrativa tem a maior precedência.
  if (!isAdministrativelyActive(input.status)) {
    return {
      group: "unavailable",
      hasNonBlockingRestriction,
      reason: "administrative_unavailable",
    };
  }

  // 1b. `temporarily_unfit` é bloqueante mesmo com status administrativo ativo.
  if (readiness === "temporarily_unfit") {
    return {
      group: "unavailable",
      hasNonBlockingRestriction: false,
      reason: "health_temporarily_unfit",
    };
  }

  const isOperational = hasSpecialtyStatus(input.specialties, "operational");
  const isInFormation = hasSpecialtyStatus(input.specialties, "in_formation");

  // 2. Em formação sem prontidão para emprego.
  //    Uma especialidade operacional já conquistada tem precedência sobre
  //    outra ainda em formação — o K9 é empregável naquilo que domina.
  if (isInFormation && !isOperational) {
    return {
      group: "formation",
      hasNonBlockingRestriction,
      reason: "in_formation",
    };
  }

  // 3. Pronto para emprego.
  //    Exige qualificação operacional. A ausência de readiness NÃO bloqueia
  //    aqui, mas também não é apresentada como prontidão clínica: quem informa
  //    o estado clínico é o drawer, a partir da fonte Health.
  if (isOperational) {
    return {
      group: "ready",
      hasNonBlockingRestriction,
      reason: "operational_specialty",
    };
  }

  // 4. Ativo sem classificação operacional — grupo de escape.
  //    Garante que nenhum K9 desapareça por não caber no mockup nominal.
  return {
    group: "unclassified_active",
    hasNonBlockingRestriction,
    reason: "no_operational_classification",
  };
}

export const K9_ROSTER_GROUP_ORDER: readonly K9RosterGroup[] = [
  "ready",
  "formation",
  "unavailable",
  "unclassified_active",
];

export const K9_ROSTER_GROUP_LABEL: Record<K9RosterGroup, string> = {
  formation: "Em formação",
  ready: "Prontos para emprego",
  unavailable: "Indisponíveis / com restrições",
  unclassified_active: "Ativos sem classificação operacional",
};

/** Rótulo textual dos estados Health — cor nunca é o único sinal. */
export const K9_READINESS_LABEL: Record<K9HealthReadiness, string> = {
  fit_with_restrictions: "Apto com restrições",
  not_evaluated: "Não avaliado",
  operational: "Operacional",
  operational_attention: "Operacional com atenção",
  temporarily_unfit: "Temporariamente inapto",
};

export const K9_READINESS_DETAIL: Record<K9HealthReadiness, string> = {
  fit_with_restrictions: "Empregável com restrições registradas",
  not_evaluated: "Sem avaliação de prontidão registrada",
  operational: "Apto para todas as atividades",
  operational_attention: "Apto, com pendência em acompanhamento",
  temporarily_unfit: "Bloqueado para emprego operacional",
};

export function groupCounts(classifications: readonly K9Classification[]) {
  const counts: Record<K9RosterGroup, number> = {
    formation: 0,
    ready: 0,
    unavailable: 0,
    unclassified_active: 0,
  };
  for (const classification of classifications) {
    counts[classification.group] += 1;
  }
  return counts;
}
