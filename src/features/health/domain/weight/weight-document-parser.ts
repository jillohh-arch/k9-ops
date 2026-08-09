/**
 * Parser documental central de Pesagem.
 *
 * Reproduz semanticamente `weight_assessment_document_parser.dart` (Mobile,
 * commit 6e6733eb), conforme `HEALTH_WEIGHT_CANONICAL_SPEC.md` e ADR-008.
 *
 * Contrato:
 * - função pura; não consulta, não escreve, não loga, sem side effect;
 * - não escolhe peso atual;
 * - não serializa;
 * - não lança como fluxo normal para documento inválido;
 * - não depende de Firebase SDK nem de React.
 *
 * Precedência de classificação (nesta ordem):
 *   1. source collection canônica
 *   2. identidade (entityId, dogId de contexto, dog_id embutido)
 *   3. ausência de `schema_version` → marcador target ⇒ híbrido; senão adapters
 *   4. `schema_version` inválido ⇒ malformed
 *   5. `schema_version > 2` ⇒ unsupported
 *   6. `schema_version == 1` ⇒ deployed v1 (rejeita marcador target)
 *   7. `schema_version == 2` ⇒ target v2
 */

import {
  hasExactTenths,
  normalizeExactTenths,
  OFFICIAL_ATTACHMENT_LIMIT,
  QUICK_ATTACHMENT_LIMIT,
  type WeightAssessment,
  type WeightAttachmentReference,
  type WeightBodyConditionScore,
  type WeightClinicalLink,
  type WeightCompatibilityMetadata,
  type WeightDerivedField,
  type WeightOfficialDetails,
  type WeightRecorder,
} from "./weight-assessment";
import {
  legacyBridgeDiagnostics,
  weightDiagnostic,
  type WeightDocumentDiagnostic,
  type WeightDocumentDiagnosticCode,
} from "./weight-diagnostics";
import {
  parseWeightEnum,
  WEIGHT_ASSESSMENT_STATUSES,
  WEIGHT_BCS_SOURCES,
  WEIGHT_EQUIPMENT_STATES,
  WEIGHT_INFORMATION_SOURCES,
  WEIGHT_LOCATIONS,
  WEIGHT_MEASUREMENT_CONDITIONS,
  WEIGHT_READING_QUALITIES,
  WEIGHT_RECORD_TYPES,
  type WeightAssessmentStatus,
  type WeightRecordType,
} from "./weight-enums";

// ─── Resultado ─────────────────────────────────────────────────────────────

export type WeightParseResult =
  | {
      readonly kind: "success";
      readonly assessment: WeightAssessment;
      readonly diagnostics: readonly WeightDocumentDiagnostic[];
    }
  | {
      readonly kind: "malformed";
      readonly assessment: null;
      readonly diagnostics: readonly WeightDocumentDiagnostic[];
    }
  | {
      readonly kind: "unsupported";
      readonly assessment: null;
      readonly schemaVersion: number;
      readonly diagnostics: readonly WeightDocumentDiagnostic[];
    };

export const CANONICAL_WEIGHT_COLLECTION = "weight_records";

export type ParseWeightDocumentInput = {
  readonly entityId: string;
  readonly dogId: string;
  readonly data: unknown;
  readonly sourceCollection?: string;
};

// ─── Marcadores de shape ───────────────────────────────────────────────────

/**
 * Campos que só existem no envelope target v2.
 *
 * `recorded_at` integra este conjunto porque o writer v1 atualmente deployado
 * não o persiste (confirmado em `functions/src/health_weight_engine.ts`): sua
 * presença sem `schema_version = 2` indica documento híbrido.
 */
const TARGET_MARKER_FIELDS = [
  "record_type",
  "origin_record_type",
  "status",
  "revision",
  "recorded_at",
  "information_source",
  "location",
  "measurement_condition",
  "equipment_state",
  "reading_quality",
  "bcs",
  "bcs_source",
  "attachment_refs",
  "clinical_links",
] as const;

/** Campos exclusivos de Official — proibidos em Quick. */
const OFFICIAL_ONLY_FIELDS = [
  "information_source",
  "location",
  "location_other_description",
  "measurement_condition",
  "condition_other_description",
  "equipment_state",
  "reading_quality",
  "scale_identifier",
  "bcs",
  "bcs_source",
  "clinical_links",
] as const;

/** Campos target que, quando presentes e não nulos, devem ser string. */
const TARGET_STRING_FIELDS = [
  "record_type",
  "origin_record_type",
  "status",
  "information_source",
  "location",
  "location_other_description",
  "measurement_condition",
  "condition_other_description",
  "equipment_state",
  "reading_quality",
  "scale_identifier",
  "bcs_source",
  "context",
  "notes",
] as const;

/** Contextos aceitos pelo shape v1 deployado. */
const DEPLOYED_V1_CONTEXTS = [
  "routine",
  "clinical",
  "pre_op",
  "post_op",
] as const;

const LEGACY_DERIVED_FIELDS: readonly WeightDerivedField[] = Object.freeze([
  "recordType",
  "originRecordType",
  "status",
  "revision",
] as const);

const NO_DERIVED_FIELDS: readonly WeightDerivedField[] = Object.freeze([]);

/** Enums derivados no read model para v1 e legado reconhecido. */
const DERIVED_LEGACY_RECORD_TYPE = parseWeightEnum<WeightRecordType>(
  "legacy_simple",
  WEIGHT_RECORD_TYPES,
);
const DERIVED_VALID_STATUS = parseWeightEnum<WeightAssessmentStatus>(
  "valid",
  WEIGHT_ASSESSMENT_STATUSES,
);

// ─── Construtores de resultado ─────────────────────────────────────────────

function success(assessment: WeightAssessment): WeightParseResult {
  return {
    assessment,
    diagnostics: assessment.compatibility.diagnostics,
    kind: "success",
  };
}

function malformed(
  diagnostics: readonly WeightDocumentDiagnostic[],
): WeightParseResult {
  return {
    assessment: null,
    diagnostics: Object.freeze([...diagnostics]),
    kind: "malformed",
  };
}

function unsupported(schemaVersion: number): WeightParseResult {
  return {
    assessment: null,
    diagnostics: Object.freeze([
      weightDiagnostic(
        "unsupportedSchemaVersion",
        "schema_version",
        String(schemaVersion),
      ),
    ]),
    kind: "unsupported",
    schemaVersion,
  };
}

// ─── Acesso seguro a propriedades ──────────────────────────────────────────

/**
 * Sentinela de acesso que lançou.
 *
 * `safeGet`/`safeHasOwn` distinguem três desfechos:
 * - ausente (`hasOwnProperty` falso);
 * - presente com `undefined`;
 * - acesso que lançou (`ACCESS_THREW`).
 *
 * Nenhum consumidor deve armazenar a sentinela: ela só flui até virar
 * `malformed` via `WeightAccessError`.
 */
const ACCESS_THREW: unique symbol = Symbol("weight.accessThrew");
type AccessThrew = typeof ACCESS_THREW;

/**
 * Erro de controle interno.
 *
 * Nunca escapa de `parseWeightDocument`: o boundary o converte em `malformed`
 * com o diagnostic do campo. Carrega apenas código e campo — nunca a mensagem
 * ou o objeto da exceção original.
 */
class WeightAccessError extends Error {
  constructor(
    readonly diagnosticCode: WeightDocumentDiagnosticCode,
    readonly field: string,
  ) {
    super();
  }
}

/**
 * Leitura de propriedade que nunca coage nem propaga exceção.
 *
 * Encapsula `Reflect.get` (trap `get`, getters). Não invoca `toString`,
 * `valueOf` nem coerção customizada e não preserva a mensagem da exceção.
 */
function safeGet(target: object, key: PropertyKey): unknown | AccessThrew {
  try {
    return Reflect.get(target, key);
  } catch {
    return ACCESS_THREW;
  }
}

/**
 * Detecção de propriedade própria que nunca propaga exceção.
 *
 * Encapsula `Object.prototype.hasOwnProperty` (trap `getOwnPropertyDescriptor`).
 */
function safeHasOwn(target: object, key: PropertyKey): boolean | AccessThrew {
  try {
    return Object.prototype.hasOwnProperty.call(target, key);
  } catch {
    return ACCESS_THREW;
  }
}

/**
 * Leitura materializada de uma propriedade de objeto do input.
 *
 * Um acesso que lança vira `malformed` com o diagnostic e campo informados —
 * nunca exceção propagada nem mensagem preservada.
 */
function accessOrThrow(
  target: object,
  key: PropertyKey,
  code: WeightDocumentDiagnosticCode,
  field: string,
): unknown {
  const value = safeGet(target, key);
  if (value === ACCESS_THREW) throw new WeightAccessError(code, field);
  return value;
}

/** Presença de propriedade própria; acesso que lança vira `malformed`. */
function hasOwnOrThrow(
  target: object,
  key: PropertyKey,
  code: WeightDocumentDiagnosticCode,
  field: string,
): boolean {
  const present = safeHasOwn(target, key);
  if (present === ACCESS_THREW) throw new WeightAccessError(code, field);
  return present;
}

// ─── Helpers de valor ──────────────────────────────────────────────────────

type DocumentMap = Readonly<Record<string, unknown>>;

function asDocumentMap(raw: unknown): DocumentMap | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as DocumentMap;
}

/**
 * Presença de propriedade própria.
 *
 * Um trap `getOwnPropertyDescriptor` que lança torna o documento ilegível:
 * vira `malformed` com o diagnostic do campo, nunca `success`.
 */
function hasField(data: DocumentMap, field: string): boolean {
  return hasOwnOrThrow(data, field, "unknownLegacyShape", field);
}

function containsAny(data: DocumentMap, fields: readonly string[]): boolean {
  return fields.some((field) => hasField(data, field));
}

/**
 * Leitura de campo do input.
 *
 * Um acesso que lança vira `malformed` com o diagnostic informado, no campo
 * lido — nunca uma exceção propagada. O valor materializado (não sentinela)
 * segue para os validadores de tipo já existentes.
 */
function readField(
  data: DocumentMap,
  field: string,
  onThrow: WeightDocumentDiagnosticCode,
): unknown {
  return accessOrThrow(data, field, onThrow, field);
}

/** Presença factual: chave existente com valor diferente de null/undefined. */
function isPresent(data: DocumentMap, field: string): boolean {
  if (!hasField(data, field)) return false;
  const value = readField(data, field, "unknownLegacyShape");
  return value !== null && value !== undefined;
}

function optionalString(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value.length === 0 ? null : value;
}

/**
 * Leitura de string opcional de um item de array documental.
 *
 * O item pode ser Proxy/getter que lança: qualquer falha de acesso vira
 * `null`, sinalizando ao chamador para rejeitar a coleção como `malformed`.
 */
function safeOptionalString(map: object, key: string): string | null {
  const raw = safeGet(map, key);
  return raw === ACCESS_THREW ? null : optionalString(raw);
}

/** Inteiro estrito: rejeita string, boolean, non-finite e fracionário. */
function strictInteger(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Number.isInteger(raw) ? raw : null;
}

/**
 * Peso histórico (v1 e legado reconhecido).
 *
 * Preserva a precisão persistida: `32.523` é aceito e sinalizado por
 * diagnostic, nunca arredondado silenciosamente.
 */
function historicalWeight(
  raw: unknown,
  diagnostics: WeightDocumentDiagnostic[],
): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw <= 0 || raw > 100) return null;
  if (!hasExactTenths(raw)) {
    diagnostics.push(
      weightDiagnostic("legacyWeightPrecisionPreserved", "weight_kg"),
    );
    return raw;
  }
  return normalizeExactTenths(raw);
}

/**
 * Peso target v2: 1.0–100.0 com décimos exatos.
 *
 * `32.523` é rejeitado; `32.300000000000004` é aceito e normalizado para
 * `32.3`, porque a divergência é ruído representacional de ponto flutuante.
 */
function targetWeight(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw < 1 || raw > 100) return null;
  return hasExactTenths(raw) ? normalizeExactTenths(raw) : null;
}

const MAX_TIMESTAMP_MILLIS = 8.64e15;
const NANOS_PER_SECOND = 1_000_000_000;

/**
 * Converte valor temporal documental em `Date`.
 *
 * Aceita `Date`, objeto com `toDate()`, e maps `seconds/nanoseconds` ou
 * `_seconds/_nanoseconds`. Não depende do SDK do Firebase.
 */
function dateTime(raw: unknown): Date | null {
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  if (raw === null || typeof raw !== "object") return null;

  // O próprio timestamp pode ser Proxy com traps/getters que lançam: qualquer
  // falha de acesso vira `null`, e o chamador emite `malformedTimestamp`.
  const has = (key: string): boolean => safeHasOwn(raw, key) === true;
  const get = (key: string): unknown => {
    const value = safeGet(raw, key);
    return value === ACCESS_THREW ? undefined : value;
  };

  if (has("seconds") || has("_seconds")) {
    const secondsRaw = has("seconds") ? get("seconds") : get("_seconds");
    const nanosPresent = has("nanoseconds") || has("_nanoseconds");
    const nanosRaw = nanosPresent
      ? has("nanoseconds")
        ? get("nanoseconds")
        : get("_nanoseconds")
      : 0;

    const seconds = strictInteger(secondsRaw);
    const nanos = strictInteger(nanosRaw);
    if (seconds === null || nanos === null) return null;
    if (nanos < 0 || nanos >= NANOS_PER_SECOND) return null;

    const millis = seconds * 1000 + Math.trunc(nanos / 1_000_000);
    if (!Number.isFinite(millis) || Math.abs(millis) > MAX_TIMESTAMP_MILLIS) {
      return null;
    }
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const toDate = get("toDate");
  if (typeof toDate === "function") {
    try {
      const converted = (toDate as () => unknown).call(raw);
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted;
      }
      return null;
    } catch {
      // `toDate()` que lança indica documento ilegível, não erro de fluxo.
      return null;
    }
  }
  return null;
}

/**
 * Autoria canônica.
 *
 * Exige uid, name e internal_role não vazios. `internal_role` não é
 * restringido a lista fechada. A presença de qualquer chave `email` invalida
 * o recorder, e o e-mail nunca é preservado.
 */
function parseRecorder(raw: unknown): WeightRecorder | null {
  const map = asDocumentMap(raw);
  if (map === null) return null;

  // Acesso seguro: recorder Proxy/getter que lança vira `null`, e o chamador
  // emite `malformedRecorder`. A presença de qualquer `email` invalida.
  const hasEmail = safeHasOwn(map, "email");
  if (hasEmail === ACCESS_THREW || hasEmail === true) return null;

  const uidRaw = safeGet(map, "uid");
  const nameRaw = safeGet(map, "name");
  const roleRaw = safeGet(map, "internal_role");
  if (
    uidRaw === ACCESS_THREW ||
    nameRaw === ACCESS_THREW ||
    roleRaw === ACCESS_THREW
  ) {
    return null;
  }

  const uid = optionalString(uidRaw);
  const name = optionalString(nameRaw);
  const internalRole = optionalString(roleRaw);
  if (uid === null || name === null || internalRole === null) return null;

  return Object.freeze({ internalRole, name, uid });
}

/** dogId de contexto é autoridade; embutido divergente invalida o documento. */
function embeddedDogIdIssue(
  dogId: string,
  data: DocumentMap,
): WeightDocumentDiagnostic | null {
  const expected = dogId.trim();
  for (const key of ["dogId", "dog_id"] as const) {
    if (!hasField(data, key)) continue;
    const embedded = optionalString(
      readField(data, key, "embeddedDogIdMismatch"),
    );
    if (embedded === null || embedded !== expected) {
      return weightDiagnostic("embeddedDogIdMismatch", key);
    }
  }
  return null;
}

function parseAttachments(
  raw: unknown,
): readonly WeightAttachmentReference[] | null {
  if (raw === null || raw === undefined) return Object.freeze([]);
  if (!Array.isArray(raw)) return null;

  const values: WeightAttachmentReference[] = [];
  for (const item of raw) {
    const map = asDocumentMap(item);
    if (map === null) return null;
    const healthDocumentId = safeOptionalString(map, "health_document_id");
    if (healthDocumentId === null) return null;
    values.push(
      Object.freeze({
        caption: safeOptionalString(map, "caption"),
        healthDocumentId,
      }),
    );
  }
  return Object.freeze(values);
}

function parseClinicalLinks(
  raw: unknown,
): readonly WeightClinicalLink[] | null {
  if (raw === null || raw === undefined) return Object.freeze([]);
  if (!Array.isArray(raw)) return null;

  const values: WeightClinicalLink[] = [];
  for (const item of raw) {
    const map = asDocumentMap(item);
    if (map === null) return null;
    const entityType = safeOptionalString(map, "entity_type");
    const entityId = safeOptionalString(map, "entity_id");
    if (entityType === null || entityId === null) return null;
    values.push(Object.freeze({ entityId, entityType }));
  }
  return Object.freeze(values);
}

// ─── Entry point ───────────────────────────────────────────────────────────

/**
 * Boundary do parser.
 *
 * Nenhuma exceção — inclusive de getters e Proxy traps do input — escapa: um
 * `WeightAccessError` interno vira `malformed` com o diagnostic do campo,
 * sem mensagem ou objeto da exceção original. Qualquer outra exceção
 * inesperada também vira `malformed`, nunca `success` parcial.
 */
export function parseWeightDocument(
  input: ParseWeightDocumentInput,
): WeightParseResult {
  try {
    return parseWeightDocumentInner(input);
  } catch (error) {
    if (error instanceof WeightAccessError) {
      return malformed([weightDiagnostic(error.diagnosticCode, error.field)]);
    }
    return malformed([weightDiagnostic("unknownLegacyShape", "document")]);
  }
}

function parseWeightDocumentInner(
  input: ParseWeightDocumentInput,
): WeightParseResult {
  const sourceCollection =
    input.sourceCollection ?? CANONICAL_WEIGHT_COLLECTION;

  // 1. `weight_history` e qualquer outra origem nunca são fonte canônica.
  if (sourceCollection !== CANONICAL_WEIGHT_COLLECTION) {
    return malformed([
      weightDiagnostic("nonCanonicalCollection", "source_collection"),
    ]);
  }

  const data = asDocumentMap(input.data);
  if (data === null) {
    return malformed([weightDiagnostic("unknownLegacyShape", "document")]);
  }

  // 2. Identidade.
  if (input.entityId.trim().length === 0 || input.dogId.trim().length === 0) {
    return malformed([weightDiagnostic("unknownLegacyShape", "identity")]);
  }
  const identityIssue = embeddedDogIdIssue(input.dogId, data);
  if (identityIssue !== null) return malformed([identityIssue]);

  const entityId = input.entityId.trim();
  const dogId = input.dogId.trim();

  // 3. Ausência de `schema_version`.
  if (!hasField(data, "schema_version")) {
    if (containsAny(data, TARGET_MARKER_FIELDS)) {
      return malformed([weightDiagnostic("hybridV1V2", "schema_version")]);
    }
    return parseRecognizedLegacy({ data, dogId, entityId });
  }

  // 4. `schema_version` inválido.
  const schema = strictInteger(
    readField(data, "schema_version", "malformedSchemaVersion"),
  );
  if (schema === null || schema < 1) {
    return malformed([
      weightDiagnostic("malformedSchemaVersion", "schema_version"),
    ]);
  }

  // 5. Schema futuro.
  if (schema > 2) return unsupported(schema);

  // 6. Deployed v1.
  if (schema === 1) {
    if (containsAny(data, TARGET_MARKER_FIELDS)) {
      return malformed([weightDiagnostic("hybridV1V2", "schema_version")]);
    }
    return parseDeployedV1({ data, dogId, entityId });
  }

  // 7. Target v2.
  return parseTargetV2({ data, dogId, entityId });
}

type ShapeInput = {
  readonly data: DocumentMap;
  readonly dogId: string;
  readonly entityId: string;
};

// ─── Deployed v1 ───────────────────────────────────────────────────────────

function parseDeployedV1({
  data,
  dogId,
  entityId,
}: ShapeInput): WeightParseResult {
  const diagnostics: WeightDocumentDiagnostic[] = [
    ...legacyBridgeDiagnostics(),
  ];

  const weightKg = historicalWeight(
    readField(data, "weight_kg", "malformedWeight"),
    diagnostics,
  );
  if (weightKg === null) {
    return malformed([
      ...diagnostics,
      weightDiagnostic("malformedWeight", "weight_kg"),
    ]);
  }

  const measuredAt = dateTime(readField(data, "measured_at", "malformedTimestamp"));
  if (measuredAt === null) {
    return malformed([
      ...diagnostics,
      weightDiagnostic("malformedTimestamp", "measured_at"),
    ]);
  }

  const recorder = parseRecorder(
    readField(data, "recorded_by", "malformedRecorder"),
  );
  if (recorder === null) {
    return malformed([
      ...diagnostics,
      weightDiagnostic("malformedRecorder", "recorded_by"),
    ]);
  }

  const notes = optionalString(readField(data, "notes", "unknownLegacyShape"));
  const context = optionalString(readField(data, "context", "unknownLegacyShape"));
  if (
    isPresent(data, "context") &&
    (context === null ||
      !(DEPLOYED_V1_CONTEXTS as readonly string[]).includes(context))
  ) {
    return malformed([weightDiagnostic("unknownLegacyShape", "context")]);
  }

  if (
    isPresent(data, "notes") &&
    typeof readField(data, "notes", "unknownLegacyShape") !== "string"
  ) {
    return malformed([weightDiagnostic("unknownLegacyShape", "notes")]);
  }

  const createdAt = dateTime(readField(data, "created_at", "malformedTimestamp"));
  if (createdAt !== null) {
    diagnostics.push(
      weightDiagnostic("legacyTimestampFallbackAvailable", "created_at"),
    );
  }

  const compatibility: WeightCompatibilityMetadata = {
    derivedFields: LEGACY_DERIVED_FIELDS,
    diagnostics: Object.freeze([...diagnostics]),
    legacyActorReference: null,
    orderingFallbackAt: createdAt,
    persistedSchemaVersion: 1,
    schemaVersionDerived: false,
    sourceShape: "deployedV1",
  };

  const assessment: WeightAssessment = {
    attachmentReferences: Object.freeze([]),
    clinicalLinks: Object.freeze([]),
    compatibility: Object.freeze(compatibility),
    context,
    dogId,
    entityId,
    measuredAt,
    notes,
    officialDetails: null,
    originRecordType: DERIVED_LEGACY_RECORD_TYPE,
    recordedAt: null,
    recorder,
    recordType: DERIVED_LEGACY_RECORD_TYPE,
    revision: 1,
    schemaVersion: 1,
    status: DERIVED_VALID_STATUS,
    weightKg,
  };

  return success(Object.freeze(assessment));
}

// ─── Legado reconhecido ────────────────────────────────────────────────────

/**
 * Adapters legados mutuamente exclusivos, ambos sem `schema_version`.
 *
 * Legacy Web        — `measured_by` E `performed_by` presentes.
 * Legacy dog-update — `performed_by` presente; `measured_by`, `context` e
 *                     `notes` ausentes.
 *
 * Qualquer outro shape é rejeitado: o parser não adivinha formato.
 */
function parseRecognizedLegacy({
  data,
  dogId,
  entityId,
}: ShapeInput): WeightParseResult {
  const hasMeasuredBy = isPresent(data, "measured_by");
  const hasPerformedBy = isPresent(data, "performed_by");

  const isWeb = hasMeasuredBy && hasPerformedBy;
  const isDogUpdate =
    hasPerformedBy &&
    !hasMeasuredBy &&
    !isPresent(data, "context") &&
    !isPresent(data, "notes");

  if (!isWeb && !isDogUpdate) {
    return malformed([
      weightDiagnostic("unknownLegacyShape", "schema_version"),
    ]);
  }

  // Shape legado nunca carrega autoria canônica.
  if (isPresent(data, "recorded_by")) {
    return malformed([weightDiagnostic("unknownLegacyShape", "recorded_by")]);
  }

  const diagnostics: WeightDocumentDiagnostic[] = [
    ...legacyBridgeDiagnostics(),
    weightDiagnostic("legacySourceShape"),
    weightDiagnostic("missingCanonicalRecorder", "recorded_by"),
  ];

  const weightKg = historicalWeight(
    readField(data, "weight_kg", "malformedWeight"),
    diagnostics,
  );
  const measuredAt = dateTime(readField(data, "measured_at", "malformedTimestamp"));
  if (weightKg === null || measuredAt === null) {
    return malformed([
      ...diagnostics,
      ...(weightKg === null
        ? [weightDiagnostic("malformedWeight", "weight_kg")]
        : []),
      ...(measuredAt === null
        ? [weightDiagnostic("malformedTimestamp", "measured_at")]
        : []),
    ]);
  }

  const createdAt = dateTime(readField(data, "created_at", "malformedTimestamp"));
  if (createdAt !== null) {
    diagnostics.push(
      weightDiagnostic("legacyTimestampFallbackAvailable", "created_at"),
    );
  }

  // RA legado: preservado apenas como metadata interna, nunca como autoria.
  const legacyActorReference =
    optionalString(readField(data, "measured_by", "unknownLegacyShape")) ??
    optionalString(readField(data, "performed_by", "unknownLegacyShape"));

  const compatibility: WeightCompatibilityMetadata = {
    derivedFields: LEGACY_DERIVED_FIELDS,
    diagnostics: Object.freeze([...diagnostics]),
    legacyActorReference,
    orderingFallbackAt: createdAt,
    persistedSchemaVersion: null,
    schemaVersionDerived: true,
    sourceShape: isWeb ? "recognizedLegacyWeb" : "recognizedLegacyDogUpdate",
  };

  const assessment: WeightAssessment = {
    attachmentReferences: Object.freeze([]),
    clinicalLinks: Object.freeze([]),
    compatibility: Object.freeze(compatibility),
    context: optionalString(readField(data, "context", "unknownLegacyShape")),
    dogId,
    entityId,
    measuredAt,
    notes: optionalString(readField(data, "notes", "unknownLegacyShape")),
    officialDetails: null,
    originRecordType: DERIVED_LEGACY_RECORD_TYPE,
    recordedAt: null,
    recorder: null,
    recordType: DERIVED_LEGACY_RECORD_TYPE,
    revision: 1,
    schemaVersion: 1,
    status: DERIVED_VALID_STATUS,
    weightKg,
  };

  return success(Object.freeze(assessment));
}

// ─── Target v2 ─────────────────────────────────────────────────────────────

function parseTargetV2({
  data,
  dogId,
  entityId,
}: ShapeInput): WeightParseResult {
  const diagnostics: WeightDocumentDiagnostic[] = [];

  for (const field of TARGET_STRING_FIELDS) {
    if (!hasField(data, field)) continue;
    const value = readField(data, field, "unknownLegacyShape");
    if (value !== null && typeof value !== "string") {
      return malformed([weightDiagnostic("unknownLegacyShape", field)]);
    }
  }

  const embeddedDogId =
    optionalString(readField(data, "dog_id", "unknownLegacyShape")) ??
    optionalString(readField(data, "dogId", "unknownLegacyShape"));
  const weightKg = targetWeight(readField(data, "weight_kg", "malformedWeight"));
  const measuredAt = dateTime(readField(data, "measured_at", "malformedTimestamp"));
  const recordedAt = dateTime(readField(data, "recorded_at", "malformedTimestamp"));
  const recorder = parseRecorder(
    readField(data, "recorded_by", "malformedRecorder"),
  );
  const revision = strictInteger(
    readField(data, "revision", "unknownLegacyShape"),
  );
  const recordType = parseWeightEnum<WeightRecordType>(
    readField(data, "record_type", "unknownLegacyShape"),
    WEIGHT_RECORD_TYPES,
  );
  const originRecordType = parseWeightEnum<WeightRecordType>(
    readField(data, "origin_record_type", "unknownLegacyShape"),
    WEIGHT_RECORD_TYPES,
  );
  const status = parseWeightEnum<WeightAssessmentStatus>(
    readField(data, "status", "unknownLegacyShape"),
    WEIGHT_ASSESSMENT_STATUSES,
  );

  // Envelope target obrigatório. `legacy_simple` não é tipo factual target e
  // status não conhecido nunca pode alcançar classificação `valid`.
  const envelopeIssues: WeightDocumentDiagnostic[] = [];
  if (embeddedDogId === null) {
    envelopeIssues.push(weightDiagnostic("unknownLegacyShape", "dog_id"));
  }
  if (weightKg === null) {
    envelopeIssues.push(weightDiagnostic("malformedWeight", "weight_kg"));
  }
  if (measuredAt === null) {
    envelopeIssues.push(weightDiagnostic("malformedTimestamp", "measured_at"));
  }
  if (recordedAt === null) {
    envelopeIssues.push(weightDiagnostic("malformedTimestamp", "recorded_at"));
  }
  if (recorder === null) {
    envelopeIssues.push(weightDiagnostic("malformedRecorder", "recorded_by"));
  }
  if (revision === null || revision < 1) {
    envelopeIssues.push(weightDiagnostic("unknownLegacyShape", "revision"));
  }
  if (recordType.state !== "known" || recordType.value === "legacy_simple") {
    envelopeIssues.push(weightDiagnostic("unknownLegacyShape", "record_type"));
    if (recordType.state === "unknown") {
      envelopeIssues.push(
        weightDiagnostic("unknownEnum", "record_type", recordType.raw),
      );
    }
  }
  if (
    originRecordType.state !== "known" ||
    originRecordType.value === "legacy_simple"
  ) {
    envelopeIssues.push(
      weightDiagnostic("unknownLegacyShape", "origin_record_type"),
    );
    if (originRecordType.state === "unknown") {
      envelopeIssues.push(
        weightDiagnostic(
          "unknownEnum",
          "origin_record_type",
          originRecordType.raw,
        ),
      );
    }
  }
  if (status.state !== "known") {
    envelopeIssues.push(weightDiagnostic("unknownLegacyShape", "status"));
    if (status.state === "unknown") {
      envelopeIssues.push(weightDiagnostic("unknownEnum", "status", status.raw));
    }
  }
  if (envelopeIssues.length > 0) return malformed(envelopeIssues);

  // Guard de narrowing: os discriminadores acima já são factuais aqui.
  if (
    weightKg === null ||
    measuredAt === null ||
    recordedAt === null ||
    recorder === null ||
    revision === null ||
    recordType.state !== "known" ||
    originRecordType.state !== "known" ||
    status.state !== "known"
  ) {
    return malformed([weightDiagnostic("unknownLegacyShape", "target_v2")]);
  }

  const isQuick = recordType.value === "quick";

  // Quick não pode carregar campo exclusivo de Official.
  if (isQuick && containsAny(data, OFFICIAL_ONLY_FIELDS)) {
    return malformed([weightDiagnostic("forbiddenQuickField", "record_type")]);
  }
  // Quick preserva a origem Quick.
  if (isQuick && originRecordType.value !== "quick") {
    return malformed([
      weightDiagnostic("unknownLegacyShape", "origin_record_type"),
    ]);
  }

  let officialDetails: WeightOfficialDetails | null = null;
  if (recordType.value === "official") {
    officialDetails = parseOfficialDetails(data, diagnostics);
    if (officialDetails === null) {
      return malformed([
        ...diagnostics,
        weightDiagnostic("incompleteOfficial"),
      ]);
    }
  }

  const attachmentReferences = parseAttachments(
    readField(data, "attachment_refs", "unknownLegacyShape"),
  );
  const clinicalLinks = parseClinicalLinks(
    readField(data, "clinical_links", "unknownLegacyShape"),
  );
  if (attachmentReferences === null || clinicalLinks === null) {
    return malformed([weightDiagnostic("unknownLegacyShape", "references")]);
  }

  const attachmentLimit = isQuick
    ? QUICK_ATTACHMENT_LIMIT
    : OFFICIAL_ATTACHMENT_LIMIT;
  if (attachmentReferences.length > attachmentLimit) {
    return malformed([
      weightDiagnostic("attachmentLimitExceeded", "attachment_refs"),
    ]);
  }
  const uniqueAttachmentIds = new Set(
    attachmentReferences.map((item) => item.healthDocumentId),
  );
  if (uniqueAttachmentIds.size !== attachmentReferences.length) {
    return malformed([
      weightDiagnostic("duplicateAttachment", "attachment_refs"),
    ]);
  }

  const compatibility: WeightCompatibilityMetadata = {
    derivedFields: NO_DERIVED_FIELDS,
    diagnostics: Object.freeze([...diagnostics]),
    legacyActorReference: null,
    orderingFallbackAt: null,
    persistedSchemaVersion: 2,
    schemaVersionDerived: false,
    sourceShape: "targetV2",
  };

  const assessment: WeightAssessment = {
    attachmentReferences,
    clinicalLinks,
    compatibility: Object.freeze(compatibility),
    context: optionalString(readField(data, "context", "unknownLegacyShape")),
    dogId,
    entityId,
    measuredAt,
    notes: optionalString(readField(data, "notes", "unknownLegacyShape")),
    officialDetails,
    originRecordType,
    recordedAt,
    recorder,
    recordType,
    revision,
    schemaVersion: 2,
    status,
    weightKg,
  };

  return success(Object.freeze(assessment));
}

/**
 * Detalhes de Pesagem Oficial.
 *
 * Exige fonte, local e condição. `other` exige a descrição correspondente.
 * BCS, quando presente, exige inteiro 1–5 e source: BCS 9 (escala legada 1–9)
 * é rejeitado e nunca convertido.
 */
function parseOfficialDetails(
  data: DocumentMap,
  diagnostics: WeightDocumentDiagnostic[],
): WeightOfficialDetails | null {
  const informationSource = parseWeightEnum(
    readField(data, "information_source", "unknownLegacyShape"),
    WEIGHT_INFORMATION_SOURCES,
  );
  const location = parseWeightEnum(
    readField(data, "location", "unknownLegacyShape"),
    WEIGHT_LOCATIONS,
  );
  const measurementCondition = parseWeightEnum(
    readField(data, "measurement_condition", "unknownLegacyShape"),
    WEIGHT_MEASUREMENT_CONDITIONS,
  );
  const equipmentState = parseWeightEnum(
    readField(data, "equipment_state", "unknownLegacyShape"),
    WEIGHT_EQUIPMENT_STATES,
  );
  const readingQuality = parseWeightEnum(
    readField(data, "reading_quality", "unknownLegacyShape"),
    WEIGHT_READING_QUALITIES,
  );

  if (
    informationSource.state === "absent" ||
    location.state === "absent" ||
    measurementCondition.state === "absent"
  ) {
    return null;
  }

  for (const parsed of [
    informationSource,
    location,
    measurementCondition,
    equipmentState,
    readingQuality,
  ]) {
    if (parsed.state === "unknown") {
      diagnostics.push(weightDiagnostic("unknownEnum", undefined, parsed.raw));
    }
  }

  const locationOtherDescription = optionalString(
    readField(data, "location_other_description", "unknownLegacyShape"),
  );
  const conditionOtherDescription = optionalString(
    readField(data, "condition_other_description", "unknownLegacyShape"),
  );
  if (
    location.state === "known" &&
    location.value === "other" &&
    locationOtherDescription === null
  ) {
    return null;
  }
  if (
    measurementCondition.state === "known" &&
    measurementCondition.value === "other" &&
    conditionOtherDescription === null
  ) {
    return null;
  }

  let bodyConditionScore: WeightBodyConditionScore | null = null;
  if (hasField(data, "bcs") || hasField(data, "bcs_source")) {
    const value = strictInteger(readField(data, "bcs", "unknownLegacyShape"));
    const source = parseWeightEnum(
      readField(data, "bcs_source", "unknownLegacyShape"),
      WEIGHT_BCS_SOURCES,
    );
    if (value === null || value < 1 || value > 5 || source.state === "absent") {
      return null;
    }
    if (source.state === "unknown") {
      diagnostics.push(
        weightDiagnostic("unknownEnum", "bcs_source", source.raw),
      );
    }
    bodyConditionScore = Object.freeze({
      source,
      value: value as WeightBodyConditionScore["value"],
    });
  }

  return Object.freeze({
    bodyConditionScore,
    conditionOtherDescription,
    equipmentState,
    informationSource,
    location,
    locationOtherDescription,
    measurementCondition,
    readingQuality,
    scaleIdentifier: optionalString(
      readField(data, "scale_identifier", "unknownLegacyShape"),
    ),
  });
}
