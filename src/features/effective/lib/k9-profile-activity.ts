/**
 * Derivações de atividade do Perfil K9.
 *
 * Funções puras sobre registros já lidos do Firestore. Regras que valem para
 * todo este módulo:
 *
 * - nenhum evento é sintetizado a partir do estado atual do cão;
 * - um registro sem timestamp confiável é descartado, não recebe data de hoje;
 * - "última atividade" é sempre o registro real mais recente por timestamp;
 * - nada aqui infere estado clínico.
 */

import {
  canônicalModalityLabel,
  isCanonicalK9Modality,
} from "@/features/effective/lib/k9-modalities";
import {
  profileRecordDate,
  profileText,
  type ProfileRecord,
} from "@/features/effective/lib/k9-profile-records";

export type K9ActivityCategory =
  | "document"
  | "health"
  | "occurrence"
  | "specialty"
  | "training"
  | "weight";

export type K9ActivityItem = {
  category: K9ActivityCategory;
  date: Date;
  detail: string;
  id: string;
  title: string;
};

export const K9_ACTIVITY_LABEL: Record<K9ActivityCategory, string> = {
  document: "Documento",
  health: "Saúde",
  occurrence: "Ocorrência",
  specialty: "Especialidade",
  training: "Treinamento",
  weight: "Peso",
};

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function healthEventType(record: ProfileRecord) {
  const explicit = normalized(profileText(record, ["type"]));
  if (explicit) return explicit;
  const legacy = normalized(profileText(record, ["logType"]));
  if (legacy.includes("vacin")) return "vaccination";
  if (legacy.includes("exame")) return "exam";
  return legacy || "other";
}

const HEALTH_EVENT_LABEL: Record<string, string> = {
  antiparasitic: "Antiparasitário",
  consultation: "Consulta",
  exam: "Exame",
  medication: "Medicação",
  other: "Evento de saúde",
  surgery: "Cirurgia",
  symptom: "Sintoma",
  vaccination: "Vacina",
};

export function healthEventTitle(record: ProfileRecord) {
  const type = healthEventType(record);
  const subtype = profileText(record, ["subtype", "title", "name"]);
  const label = HEALTH_EVENT_LABEL[type] ?? "Saúde";
  return subtype ? `${label}: ${subtype}` : label;
}

/**
 * Estados de formação que aparecem como sufixo de tokens compostos do Training
 * (por exemplo `detection_formation`). O vocabulário é o mesmo já usado na
 * situação por especialidade — não é um segundo dicionário de domínio.
 */
const TRAINING_STATE_SUFFIX: ReadonlyArray<[string, string]> = [
  ["in_formation", "Em formação"],
  ["em_formacao", "Em formação"],
  ["formation", "Em formação"],
  ["maintenance", "Manutenção"],
  ["manutencao", "Manutenção"],
  ["operational", "Operacional"],
  ["operacional", "Operacional"],
  ["not_started", "Não iniciada"],
  ["suspended", "Suspensa"],
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Converte um token técnico em texto legível.
 *
 * Última linha de defesa contra enum cru na UI: troca `_` por espaço e
 * capitaliza a primeira letra. Não inventa acento em valor persistido.
 */
export function humanizeToken(value: string) {
  const spaced = value.replaceAll("_", " ").trim();
  if (!spaced) return "";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Rótulo humano de uma atividade de treinamento.
 *
 * Reconhece tokens compostos `modalidade_estado` (`detection_formation` →
 * "Detecção — Em formação"), usa o vocabulário canônico de modalidade quando
 * possível e, em qualquer caso, nunca devolve snake_case cru.
 */
export function humanizeTrainingLabel(raw: string | null | undefined) {
  const slug = slugify(String(raw ?? ""));
  if (!slug) return null;

  for (const [suffix, stateLabel] of TRAINING_STATE_SUFFIX) {
    if (slug === suffix) return stateLabel;
    if (slug.endsWith(`_${suffix}`)) {
      const modalitySlug = slug.slice(0, -(suffix.length + 1));
      const modalityLabel = isCanonicalK9Modality(modalitySlug)
        ? canônicalModalityLabel(modalitySlug)
        : humanizeToken(modalitySlug);
      return `${modalityLabel} — ${stateLabel}`;
    }
  }

  // Modalidade canônica isolada mantém o rótulo oficial.
  if (isCanonicalK9Modality(slug)) return canônicalModalityLabel(slug);
  return humanizeToken(slug);
}

export function sessionModality(record: ProfileRecord) {
  return humanizeTrainingLabel(
    profileText(record, [
      "trainingType",
      "training_type",
      "specialty",
      "modality",
      "type",
      "activityType",
    ]),
  );
}

export function sessionTitle(record: ProfileRecord) {
  return sessionModality(record) ?? "Sessão de treinamento";
}

/** Módulo/fase legível; o valor persistido é técnico mas não pode vazar cru. */
export function humanizePhase(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  return raw ? humanizeToken(raw) : null;
}

export function occurrenceTitle(record: ProfileRecord) {
  return (
    profileText(record, [
      "type_name",
      "typeName",
      "nature_name",
      "nature",
      "type_code",
    ]) ?? "Ocorrência"
  );
}

export function occurrenceStatusLabel(record: ProfileRecord) {
  const status = normalized(profileText(record, ["status"]));
  if (["finalized", "finalized_with_pending", "sealed"].includes(status)) {
    return "Finalizada";
  }
  if (status === "awaiting_signatures") return "Aguardando assinaturas";
  // Status fora do vocabulário conhecido é preservado, porém humanizado: o
  // valor real continua visível, sem `snake_case` cru.
  return status ? humanizeToken(status) : "Registrada";
}

export function weightValue(record: ProfileRecord | null) {
  if (!record) return null;
  for (const key of ["weight_kg", "weightKg", "weight", "peso"]) {
    const raw = record[key];
    if (raw == null) continue;
    const parsed = Number(String(raw).replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function documentTitle(record: ProfileRecord) {
  return (
    profileText(record, ["nome", "name", "title", "fileName"]) ?? "Documento"
  );
}

export function documentType(record: ProfileRecord) {
  return profileText(record, ["tipo", "type", "category", "documentType"]);
}

export function documentOrigin(record: ProfileRecord) {
  return profileText(record, ["emissor", "issuer", "origin", "source"]);
}

export function documentUrl(record: ProfileRecord) {
  return profileText(record, [
    "url",
    "downloadUrl",
    "download_url",
    "documentUrl",
    "document_url",
    "attachmentUrl",
  ]);
}

/** Ordena por timestamp real, do mais recente para o mais antigo. */
export function sortByRecordDateDesc(records: readonly ProfileRecord[]) {
  return [...records].sort(
    (left, right) =>
      (profileRecordDate(right)?.getTime() ?? 0) -
      (profileRecordDate(left)?.getTime() ?? 0),
  );
}

/**
 * Timeline agregada de fatos reais.
 *
 * Só entram registros com timestamp válido; a ordenação é estritamente por
 * data. Especialidade só aparece quando o próprio registro traz uma data —
 * "está em formação hoje" não é um evento.
 */
export function buildK9Activity(input: {
  documents?: readonly ProfileRecord[];
  healthEvents?: readonly ProfileRecord[];
  occurrences?: readonly ProfileRecord[];
  sessions?: readonly ProfileRecord[];
  specialties?: readonly ProfileRecord[];
  weights?: readonly ProfileRecord[];
}): K9ActivityItem[] {
  const items: Array<K9ActivityItem | null> = [
    ...(input.healthEvents ?? []).map((record) =>
      toItem(record, "health", {
        detail:
          profileText(record, [
            "healthObservations",
            "professionalClinic",
            "vetName",
          ]) ?? "Registro de saúde",
        title: healthEventTitle(record),
      }),
    ),
    ...(input.weights ?? []).map((record) => {
      const value = weightValue(record);
      return toItem(record, "weight", {
        detail: value == null ? "Pesagem registrada" : `${value.toFixed(1)} kg`,
        title: "Pesagem registrada",
      });
    }),
    ...(input.sessions ?? []).map((record) =>
      toItem(record, "training", {
        detail:
          profileText(record, ["location", "local", "result", "status"]) ??
          "Sessão registrada",
        title: sessionTitle(record),
      }),
    ),
    ...(input.occurrences ?? []).map((record) =>
      toItem(record, "occurrence", {
        detail: occurrenceStatusLabel(record),
        title: occurrenceTitle(record),
      }),
    ),
    ...(input.documents ?? []).map((record) =>
      toItem(record, "document", {
        detail: documentType(record) ?? "Documento",
        title: documentTitle(record),
      }),
    ),
    ...(input.specialties ?? []).map((record) =>
      toItem(record, "specialty", {
        detail:
          humanizeTrainingLabel(
            profileText(record, ["status", "currentModule", "current_module"]),
          ) ?? "Especialidade atualizada",
        title:
          humanizeTrainingLabel(
            profileText(record, ["type", "modality", "name"]),
          ) ?? "Especialidade",
      }),
    ),
  ];

  return items
    .filter((item): item is K9ActivityItem => item != null)
    .sort((left, right) => right.date.getTime() - left.date.getTime());
}

function toItem(
  record: ProfileRecord,
  category: K9ActivityCategory,
  content: { detail: string; title: string },
): K9ActivityItem | null {
  const date = profileRecordDate(record);
  // Sem timestamp confiável o registro não entra: inventar data para poder
  // ordenar seria fabricar um fato.
  if (!date || date.getTime() <= 0) return null;
  return {
    category,
    date,
    detail: content.detail,
    id: `${category}:${record._source ?? "record"}:${record._id}`,
    title: content.title,
  };
}
