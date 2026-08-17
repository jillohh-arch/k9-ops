/**
 * Contrato de status do Perfil K9.
 *
 * O Perfil agrega; ele não recalcula domínio de especialista. Este módulo é a
 * fonte compartilhada dos conceitos que o hero e a Visão Geral exibem, e existe
 * para garantir a regra de ouro da seção 4 do prompt: cada conceito é separado,
 * nomeado e nunca fundido em um badge único.
 *
 * Conceitos preservados como entidades distintas:
 *
 *   AdministrativeStatus  — o que está persistido em `dogs.status`
 *   OperationalSituation  — derivada por `classifyK9()` (mesma do Roster)
 *   ClinicalReadiness     — lida de `health_summary/current` (fonte Health)
 *   BinomialStatus        — existe vínculo ativo real?
 *   ActiveShiftStatus     — existe turno ativo real?
 *
 * Nada aqui inventa percentual, score ou estado clínico.
 */

import { humanizeToken } from "@/features/effective/lib/k9-profile-activity";
import {
  K9_READINESS_DETAIL,
  K9_READINESS_LABEL,
  K9_ROSTER_GROUP_LABEL,
  classifyK9,
  type K9Classification,
  type K9ClassificationInput,
  type K9HealthReadiness,
} from "@/features/effective/lib/k9-roster-classification";

/** Tons aceitos pelas primitivas visuais do Efetivo. */
export type K9ProfileTone =
  | "amber"
  | "cyan"
  | "green"
  | "red"
  | "slate"
  | "violet";

export type K9ProfileBadge = {
  detail: string | null;
  label: string;
  tone: K9ProfileTone;
};

/**
 * Status administrativo, exatamente como persistido.
 *
 * Não traduz `Ativo` para `Operacional`: a seção 13 é explícita de que o rótulo
 * administrativo não pode afirmar prontidão. Ausência de valor é declarada como
 * ausência — nunca cai para "Ativo" por conveniência de layout.
 */
export function administrativeStatusBadge(
  status: string | null | undefined,
): K9ProfileBadge {
  const raw = String(status ?? "").trim();

  if (!raw) {
    return {
      detail: "Situação cadastral não informada",
      label: "Não informado",
      tone: "slate",
    };
  }

  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const isActive = normalized === "ativo" || normalized === "active";

  return {
    detail: "Situação cadastral",
    // O valor persistido é preservado com a capitalização original.
    label: raw,
    tone: isActive ? "green" : "violet",
  };
}

/**
 * Situação operacional — mesma decisão do Roster, via classifier canônico.
 *
 * O Perfil não mantém uma segunda interpretação: `classifyK9()` continua sendo
 * a única autoridade, e o rótulo vem de `K9_ROSTER_GROUP_LABEL`.
 */
export function operationalSituationBadge(
  classification: K9Classification,
): K9ProfileBadge {
  const label = K9_ROSTER_GROUP_LABEL[classification.group];
  const tones: Record<K9Classification["group"], K9ProfileTone> = {
    formation: "amber",
    ready: "green",
    unavailable: "red",
    unclassified_active: "slate",
  };

  const details: Record<K9Classification["reason"], string> = {
    administrative_unavailable: "Indisponibilidade administrativa",
    health_temporarily_unfit: "Bloqueado pela prontidão clínica",
    in_formation: "Formação em andamento",
    no_operational_classification: "Sem qualificação operacional registrada",
    operational_specialty: "Qualificação operacional registrada",
  };

  return {
    detail: details[classification.reason],
    label,
    tone: tones[classification.group],
  };
}

export type ClinicalReadinessView =
  | {
      available: false;
      /** Texto literal exigido pelas seções 4, 6 e 14. */
      label: "Prontidão não disponível";
      message: string;
    }
  | {
      available: true;
      detail: string;
      label: string;
      state: K9HealthReadiness;
      tone: K9ProfileTone;
    };

/**
 * Prontidão clínica a partir do estado Health já parseado.
 *
 * `null` significa fonte indisponível — e isso é dito com o texto literal do
 * contrato. Nunca é convertido em `not_evaluated`, que seria uma afirmação
 * clínica que ninguém fez.
 */
export function clinicalReadinessView(
  state: K9HealthReadiness | null,
): ClinicalReadinessView {
  if (!state) {
    return {
      available: false,
      label: "Prontidão não disponível",
      message: "Sem resumo clínico disponível.",
    };
  }

  const tones: Record<K9HealthReadiness, K9ProfileTone> = {
    fit_with_restrictions: "amber",
    not_evaluated: "slate",
    operational: "green",
    operational_attention: "amber",
    temporarily_unfit: "red",
  };

  return {
    available: true,
    detail: K9_READINESS_DETAIL[state],
    label: K9_READINESS_LABEL[state],
    state,
    tone: tones[state],
  };
}

/**
 * Turno ativo. Só afirma "Ativo no turno" a partir de um turno real; a
 * existência de um condutor (ou de `conductorRa`) nunca implica turno.
 */
export function activeShiftBadge(hasActiveShift: boolean): K9ProfileBadge {
  return hasActiveShift
    ? { detail: null, label: "Ativo no turno", tone: "green" }
    : { detail: null, label: "Sem turno ativo", tone: "slate" };
}

/**
 * Situação da especialidade, como registrada no cadastro da especialidade.
 * Valor desconhecido é devolvido como desconhecido, não como "não iniciada".
 */
export function specialtySituationLabel(status: string | null | undefined) {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s-]+/g, "_");

  const known: Record<string, { label: string; tone: K9ProfileTone }> = {
    in_formation: { label: "Em formação", tone: "amber" },
    maintenance: { label: "Manutenção", tone: "cyan" },
    not_started: { label: "Não iniciada", tone: "slate" },
    operational: { label: "Operacional", tone: "green" },
    suspended: { label: "Suspensa", tone: "red" },
  };

  if (known[normalized]) return known[normalized];
  if (!normalized) {
    return { label: "Situação não informada", tone: "slate" as K9ProfileTone };
  }
  // Estado real porém fora do vocabulário conhecido: preservamos o valor em vez
  // de reclassificar por conta própria, mas humanizado — enum cru não chega ao
  // usuário.
  return {
    label: humanizeToken(String(status).trim()),
    tone: "slate" as K9ProfileTone,
  };
}

/**
 * Agrega os conceitos separados de um K9 em uma única estrutura de leitura.
 * Cada campo permanece independente: o consumidor escolhe o que exibir, e
 * nenhum deles é derivado de outro.
 */
export function buildK9ProfileStatus(input: {
  hasActiveShift: boolean;
  readiness: K9HealthReadiness | null;
  specialties: K9ClassificationInput["specialties"];
  status: string | null | undefined;
}) {
  const classification = classifyK9({
    readiness: input.readiness,
    specialties: input.specialties,
    status: input.status,
  });

  return {
    administrative: administrativeStatusBadge(input.status),
    classification,
    operational: operationalSituationBadge(classification),
    readiness: clinicalReadinessView(input.readiness),
    shift: activeShiftBadge(input.hasActiveShift),
  };
}
