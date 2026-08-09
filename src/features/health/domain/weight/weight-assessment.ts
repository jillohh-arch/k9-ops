/**
 * Modelo de domínio read-only de Pesagem.
 *
 * Reproduz semanticamente `weight_assessment.dart` (Mobile, commit 6e6733eb),
 * conforme `HEALTH_WEIGHT_CANONICAL_SPEC.md` e ADR-008.
 *
 * O aggregate separa explicitamente:
 * - fatos persistidos (peso, datas, autoria factual, discriminadores target);
 * - valores derivados de compatibilidade (`legacy_simple`, `valid`, revisão 1);
 * - origem documental (`sourceShape`);
 * - diagnostics técnicos;
 * - metadata legada interna, que NUNCA deve ser exposta a superfícies de UI.
 *
 * Este módulo não constrói queries, não escreve, não serializa e não depende
 * de Firebase ou React.
 */

import type {
  ParsedWeightEnum,
  WeightAssessmentStatus,
  WeightBcsSource,
  WeightEquipmentState,
  WeightInformationSource,
  WeightLocation,
  WeightMeasurementCondition,
  WeightReadingQuality,
  WeightRecordType,
} from "./weight-enums";
import type { WeightDocumentDiagnostic } from "./weight-diagnostics";

// ─── Origem documental ─────────────────────────────────────────────────────

export const WEIGHT_DOCUMENT_SOURCE_SHAPES = [
  "deployedV1",
  "recognizedLegacyWeb",
  "recognizedLegacyDogUpdate",
  "targetV2",
] as const;

export type WeightDocumentSourceShape =
  (typeof WEIGHT_DOCUMENT_SOURCE_SHAPES)[number];

export const WEIGHT_DERIVED_FIELDS = [
  "recordType",
  "originRecordType",
  "status",
  "revision",
] as const;

export type WeightDerivedField = (typeof WEIGHT_DERIVED_FIELDS)[number];

// ─── Autoria factual ───────────────────────────────────────────────────────

/**
 * Autoria canônica de criação.
 *
 * Só existe quando o documento persiste `recorded_by` completo e sem e-mail.
 * Shapes legados reconhecidos produzem `recorder = null`: autoria ausente
 * nunca é inventada nem substituída por RA.
 */
export type WeightRecorder = {
  readonly uid: string;
  readonly name: string;
  readonly internalRole: string;
};

// ─── Official details ──────────────────────────────────────────────────────

export type WeightBodyConditionScore = {
  /** Escala target 1–5. BCS legado 1–9 não é convertido automaticamente. */
  readonly value: 1 | 2 | 3 | 4 | 5;
  readonly source: ParsedWeightEnum<WeightBcsSource>;
};

export type WeightOfficialDetails = {
  readonly informationSource: ParsedWeightEnum<WeightInformationSource>;
  readonly location: ParsedWeightEnum<WeightLocation>;
  readonly measurementCondition: ParsedWeightEnum<WeightMeasurementCondition>;
  readonly equipmentState: ParsedWeightEnum<WeightEquipmentState>;
  readonly readingQuality: ParsedWeightEnum<WeightReadingQuality>;
  readonly bodyConditionScore: WeightBodyConditionScore | null;
  readonly locationOtherDescription: string | null;
  readonly conditionOtherDescription: string | null;
  readonly scaleIdentifier: string | null;
};

// ─── Referências ───────────────────────────────────────────────────────────

export type WeightAttachmentReference = {
  readonly healthDocumentId: string;
  readonly caption: string | null;
};

export type WeightClinicalLink = {
  readonly entityType: string;
  readonly entityId: string;
};

// ─── Compatibilidade ───────────────────────────────────────────────────────

/**
 * Metadata de compatibilidade documental.
 *
 * `legacyActorReference` guarda o pseudo-identificador legado (RA) apenas para
 * rastreabilidade interna de parsing. É deliberadamente separado de `recorder`
 * e NUNCA deve ser promovido a autoria nem exposto por adapters ou UI.
 */
export type WeightCompatibilityMetadata = {
  readonly sourceShape: WeightDocumentSourceShape;
  /** `null` quando o documento não persistia `schema_version`. */
  readonly persistedSchemaVersion: number | null;
  readonly schemaVersionDerived: boolean;
  readonly derivedFields: readonly WeightDerivedField[];
  /** `created_at` legado, disponível apenas como desempate de ordenação. */
  readonly orderingFallbackAt: Date | null;
  readonly legacyActorReference: string | null;
  readonly diagnostics: readonly WeightDocumentDiagnostic[];
};

// ─── Aggregate ─────────────────────────────────────────────────────────────

/**
 * Aggregate de leitura de uma pesagem canônica.
 *
 * `recordedAt` é `null` em v1/legado — o writer atualmente deployado não
 * persiste `recorded_at` (verificado em `health_weight_engine.ts`).
 */
export type WeightAssessment = {
  readonly entityId: string;
  readonly dogId: string;
  readonly weightKg: number;
  readonly measuredAt: Date;
  readonly recordedAt: Date | null;
  /** `null` significa autoria ausente e factualmente desconhecida. */
  readonly recorder: WeightRecorder | null;
  readonly recordType: ParsedWeightEnum<WeightRecordType>;
  readonly originRecordType: ParsedWeightEnum<WeightRecordType>;
  readonly status: ParsedWeightEnum<WeightAssessmentStatus>;
  readonly revision: number;
  readonly schemaVersion: number;
  readonly officialDetails: WeightOfficialDetails | null;
  readonly attachmentReferences: readonly WeightAttachmentReference[];
  readonly clinicalLinks: readonly WeightClinicalLink[];
  readonly context: string | null;
  readonly notes: string | null;
  readonly compatibility: WeightCompatibilityMetadata;
};

/** Diagnostics acumulados durante o parse do documento. */
export function assessmentDiagnostics(
  assessment: WeightAssessment,
): readonly WeightDocumentDiagnostic[] {
  return assessment.compatibility.diagnostics;
}

/** Verdadeiro quando há autoria canônica factual. */
export function hasFactualRecorder(assessment: WeightAssessment): boolean {
  return assessment.recorder !== null;
}

/**
 * Instante de ordenação secundária.
 *
 * Usa `recorded_at` quando factual; em shapes legados cai para o
 * `created_at` preservado como fallback declarado. Nunca promove o fallback a
 * `measured_at`.
 */
export function orderingInstant(assessment: WeightAssessment): Date | null {
  return assessment.recordedAt ?? assessment.compatibility.orderingFallbackAt;
}

/** Limites de anexo por tipo factual (ADR-008 / spec canônica). */
export const QUICK_ATTACHMENT_LIMIT = 3;
export const OFFICIAL_ATTACHMENT_LIMIT = 5;

/** Precisão de décimos exatos, tolerando apenas ruído representacional. */
export function hasExactTenths(value: number): boolean {
  const tenths = value * 10;
  return Math.abs(tenths - Math.round(tenths)) <= 1e-9;
}

/**
 * Normaliza ruído binário de ponto flutuante sem arredondar de fato.
 *
 * `32.300000000000004` vira `32.3`; `32.523` não é aceito por
 * `hasExactTenths` e portanto nunca chega aqui como valor target.
 */
export function normalizeExactTenths(value: number): number {
  return Math.round(value * 10) / 10;
}
