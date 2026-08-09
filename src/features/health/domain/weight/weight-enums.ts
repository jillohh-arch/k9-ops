/**
 * Enums controlados de Pesagem (leitura).
 *
 * Reproduz semanticamente o contrato canônico definido em
 * `HEALTH_WEIGHT_CANONICAL_SPEC.md` e ADR-008, já implementado no Mobile em
 * `health_v1_enums.dart` (commit 6e6733eb).
 *
 * Regras estruturais:
 * - os valores do union SÃO os wire names persistidos no Firestore;
 * - `unknown` preserva o raw recebido e nunca é confundido com ausência;
 * - `absent` significa campo não presente ou vazio;
 * - nenhum serializer de escrita existe neste módulo.
 */

// ─── Record type ───────────────────────────────────────────────────────────

/**
 * `legacy_simple` existe SOMENTE no read model (bridge de compatibilidade).
 * Nunca é um tipo factual target e não possui serializer.
 */
export const WEIGHT_RECORD_TYPES = ["quick", "official", "legacy_simple"] as const;
export type WeightRecordType = (typeof WEIGHT_RECORD_TYPES)[number];

/** Tipos factuais aceitos por um documento target v2. */
export const TARGET_WEIGHT_RECORD_TYPES = ["quick", "official"] as const;
export type TargetWeightRecordType = (typeof TARGET_WEIGHT_RECORD_TYPES)[number];

export function isTargetWeightRecordType(
  value: WeightRecordType,
): value is TargetWeightRecordType {
  return value !== "legacy_simple";
}

// ─── Status ────────────────────────────────────────────────────────────────

export const WEIGHT_ASSESSMENT_STATUSES = ["valid", "invalidated"] as const;
export type WeightAssessmentStatus = (typeof WEIGHT_ASSESSMENT_STATUSES)[number];

// ─── Official details ──────────────────────────────────────────────────────

export const WEIGHT_INFORMATION_SOURCES = [
  "measured_by_recorder",
  "reported_by_other_operator",
  "external_document_or_service",
] as const;
export type WeightInformationSource = (typeof WEIGHT_INFORMATION_SOURCES)[number];

export const WEIGHT_LOCATIONS = [
  "kennel",
  "veterinary_clinic",
  "pharmacy",
  "other",
] as const;
export type WeightLocation = (typeof WEIGHT_LOCATIONS)[number];

export const WEIGHT_MEASUREMENT_CONDITIONS = [
  "fasting",
  "after_feeding",
  "after_activity_or_training",
  "no_specific_condition",
  "other",
] as const;
export type WeightMeasurementCondition =
  (typeof WEIGHT_MEASUREMENT_CONDITIONS)[number];

export const WEIGHT_EQUIPMENT_STATES = [
  "none",
  "collar",
  "harness_or_operational_equipment",
  "not_informed",
] as const;
export type WeightEquipmentState = (typeof WEIGHT_EQUIPMENT_STATES)[number];

export const WEIGHT_READING_QUALITIES = [
  "stable",
  "approximate",
  "not_recorded",
] as const;
export type WeightReadingQuality = (typeof WEIGHT_READING_QUALITIES)[number];

export const WEIGHT_BCS_SOURCES = [
  "operator_assessment",
  "veterinary_guidance",
  "reported_by_other_operator",
] as const;
export type WeightBcsSource = (typeof WEIGHT_BCS_SOURCES)[number];

// ─── Lifecycle reasons ─────────────────────────────────────────────────────

export const WEIGHT_CORRECTION_REASONS = [
  "data_entry_error",
  "new_scale_reading",
  "other",
] as const;
export type WeightCorrectionReason = (typeof WEIGHT_CORRECTION_REASONS)[number];

export const WEIGHT_INVALIDATION_REASONS = [
  "wrong_dog",
  "defective_scale",
  "duplicate",
  "irrecoverable_error",
  "other",
] as const;
export type WeightInvalidationReason =
  (typeof WEIGHT_INVALIDATION_REASONS)[number];

// ─── Operation types ───────────────────────────────────────────────────────

export const WEIGHT_ASSESSMENT_OPERATION_TYPES = [
  "create_quick",
  "create_official",
  "complete_as_official",
  "correct",
  "invalidate",
  "add_attachment",
  "remove_attachment",
] as const;
export type WeightAssessmentOperationType =
  (typeof WEIGHT_ASSESSMENT_OPERATION_TYPES)[number];

/**
 * Configuração de referência (range/goal) é um aggregate versionado separado.
 * NÃO integra o ledger de `WeightAssessment` (ADR-008, decisão 7).
 */
export const WEIGHT_CONFIGURATION_OPERATION_TYPES = [
  "set_reference_range",
  "set_weight_goal",
] as const;
export type WeightConfigurationOperationType =
  (typeof WEIGHT_CONFIGURATION_OPERATION_TYPES)[number];

/** Follow-up é aggregate próprio e também não integra o ledger de pesagem. */
export const WEIGHT_FOLLOW_UP_OPERATION_TYPES = ["create_follow_up"] as const;
export type WeightFollowUpOperationType =
  (typeof WEIGHT_FOLLOW_UP_OPERATION_TYPES)[number];

// ─── Parsed enum ───────────────────────────────────────────────────────────

export type ParsedWeightEnumState = "known" | "unknown" | "absent";

/**
 * Resultado de parse defensivo de enum.
 *
 * `known` sempre carrega raw não vazio e valor; `unknown` carrega raw não
 * vazio sem valor; `absent` não carrega raw. A API pública não permite
 * construir combinações inconsistentes.
 */
export type ParsedWeightEnum<T extends string> =
  | { readonly state: "known"; readonly value: T; readonly raw: string }
  | { readonly state: "unknown"; readonly raw: string }
  | { readonly state: "absent" };

/** Instância canônica de ausência. */
export const ABSENT_WEIGHT_ENUM: ParsedWeightEnum<never> = Object.freeze({
  state: "absent",
});

export function absentWeightEnum<T extends string>(): ParsedWeightEnum<T> {
  return ABSENT_WEIGHT_ENUM as ParsedWeightEnum<T>;
}

/** Limite defensivo do raw preservado em diagnostics. */
const MAX_RAW_LENGTH = 64;

/**
 * Representação segura e limitada do valor bruto.
 *
 * Strings preservam o conteúdo (necessário para diagnosticar enum futuro);
 * demais tipos viram um token de tipo, para nunca vazar estrutura documental.
 */
function safeRawOf(value: unknown): string {
  if (typeof value === "string") {
    return value.trim().slice(0, MAX_RAW_LENGTH);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).slice(0, MAX_RAW_LENGTH);
  }
  if (typeof value === "bigint") {
    return `${value}`.slice(0, MAX_RAW_LENGTH);
  }
  if (Array.isArray(value)) return "[array]";
  if (typeof value === "object") return "[object]";
  return `[${typeof value}]`;
}

/**
 * Parse defensivo de enum a partir de valor documental desconhecido.
 *
 * Nunca lança. Valor ausente/vazio vira `absent`; valor não reconhecido vira
 * `unknown` preservando raw sanitizado.
 */
export function parseWeightEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
): ParsedWeightEnum<T> {
  if (raw === null || raw === undefined) return absentWeightEnum<T>();

  const safeRaw = safeRawOf(raw);
  if (safeRaw.length === 0) return absentWeightEnum<T>();

  if (typeof raw === "string") {
    const match = allowed.find((candidate) => candidate === safeRaw);
    if (match !== undefined) {
      return { raw: safeRaw, state: "known", value: match };
    }
  }
  return { raw: safeRaw, state: "unknown" };
}

export function isKnownWeightEnum<T extends string>(
  parsed: ParsedWeightEnum<T>,
): parsed is { readonly state: "known"; readonly value: T; readonly raw: string } {
  return parsed.state === "known";
}

export function isUnknownWeightEnum<T extends string>(
  parsed: ParsedWeightEnum<T>,
): parsed is { readonly state: "unknown"; readonly raw: string } {
  return parsed.state === "unknown";
}

export function isAbsentWeightEnum<T extends string>(
  parsed: ParsedWeightEnum<T>,
): boolean {
  return parsed.state === "absent";
}

/** Raw preservado, quando existir. */
export function weightEnumRaw<T extends string>(
  parsed: ParsedWeightEnum<T>,
): string | null {
  return parsed.state === "absent" ? null : parsed.raw;
}

/** Valor factual, somente quando `known`. */
export function weightEnumValue<T extends string>(
  parsed: ParsedWeightEnum<T>,
): T | null {
  return parsed.state === "known" ? parsed.value : null;
}
