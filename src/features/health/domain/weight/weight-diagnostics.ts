/**
 * Diagnostics estruturados de leitura de Pesagem.
 *
 * São códigos técnicos, NÃO texto de interface. Nenhum diagnostic pode conter
 * uid, nome, RA, e-mail, documento bruto ou map completo: apenas `code`,
 * `field` opcional e `safeRaw` opcional já sanitizado.
 */

export const WEIGHT_DOCUMENT_DIAGNOSTIC_CODES = [
  // Origem e identidade
  "nonCanonicalCollection",
  "embeddedDogIdMismatch",

  // Classificação de schema
  "unknownLegacyShape",
  "hybridV1V2",
  "malformedSchemaVersion",
  "unsupportedSchemaVersion",

  // Campos factuais
  "malformedWeight",
  "malformedTimestamp",
  "malformedRecorder",

  // Bridge legado
  "legacySourceShape",
  "missingCanonicalRecorder",
  "derivedLegacyRecordType",
  "derivedValidStatus",
  "derivedRevisionOne",
  "legacyWeightPrecisionPreserved",
  "legacyTimestampFallbackAvailable",

  // Target v2
  "unknownEnum",
  "forbiddenQuickField",
  "incompleteOfficial",
  "duplicateAttachment",
  "attachmentLimitExceeded",
] as const;

export type WeightDocumentDiagnosticCode =
  (typeof WEIGHT_DOCUMENT_DIAGNOSTIC_CODES)[number];

/**
 * Diagnostic de leitura.
 *
 * `safeRaw` só deve receber valores já sanitizados (ver `parseWeightEnum`),
 * usados para diagnosticar enum desconhecido ou schema futuro.
 */
export type WeightDocumentDiagnostic = {
  readonly code: WeightDocumentDiagnosticCode;
  readonly field?: string;
  readonly safeRaw?: string;
};

export function weightDiagnostic(
  code: WeightDocumentDiagnosticCode,
  field?: string,
  safeRaw?: string,
): WeightDocumentDiagnostic {
  const diagnostic: {
    code: WeightDocumentDiagnosticCode;
    field?: string;
    safeRaw?: string;
  } = { code };
  if (field !== undefined) diagnostic.field = field;
  if (safeRaw !== undefined) diagnostic.safeRaw = safeRaw;
  return Object.freeze(diagnostic);
}

/**
 * Diagnostics do bridge de leitura legada.
 *
 * Registram que `record_type`, `origin_record_type`, `status` e `revision`
 * foram DERIVADOS no read model, nunca lidos como fato persistido
 * (ADR-008, compatibilidade).
 */
export function legacyBridgeDiagnostics(): readonly WeightDocumentDiagnostic[] {
  return Object.freeze([
    weightDiagnostic("derivedLegacyRecordType", "record_type"),
    weightDiagnostic("derivedLegacyRecordType", "origin_record_type"),
    weightDiagnostic("derivedValidStatus", "status"),
    weightDiagnostic("derivedRevisionOne", "revision"),
  ]);
}

export function diagnosticCodes(
  diagnostics: readonly WeightDocumentDiagnostic[],
): readonly WeightDocumentDiagnosticCode[] {
  return Object.freeze(diagnostics.map((diagnostic) => diagnostic.code));
}

export function hasDiagnosticCode(
  diagnostics: readonly WeightDocumentDiagnostic[],
  code: WeightDocumentDiagnosticCode,
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.code === code);
}
