/**
 * Fixtures documentais de Pesagem.
 *
 * IDs e nomes são sanitizados: nenhum dado pessoal real. Os dois registros de
 * Apolo reproduzem apenas os valores/datas citados na especificação canônica
 * (32,0 kg em 2026-06-17 e 33,3 kg em 2026-08-06) como shape v1 deployado.
 */

export const FIXTURE_DOG_ID = "dog-apolo-fixture";
export const OTHER_DOG_ID = "dog-outro-fixture";

/** Timestamp Firestore client-like (`seconds`/`nanoseconds`). */
export function timestampLike(iso: string): {
  nanoseconds: number;
  seconds: number;
} {
  const millis = new Date(iso).getTime();
  return { nanoseconds: 0, seconds: Math.trunc(millis / 1000) };
}

/** Timestamp Admin-like (`_seconds`/`_nanoseconds`). */
export function adminTimestampLike(iso: string): {
  _nanoseconds: number;
  _seconds: number;
} {
  const millis = new Date(iso).getTime();
  return { _nanoseconds: 0, _seconds: Math.trunc(millis / 1000) };
}

/** Objeto com `toDate()`, como o `Timestamp` do SDK. */
export function toDateLike(iso: string): { toDate: () => Date } {
  return { toDate: () => new Date(iso) };
}

export const RECORDER_FIXTURE = Object.freeze({
  internal_role: "operador_k9",
  name: "Operador Fixture",
  uid: "uid-operador-fixture",
});

// ─── 1–2. Apolo canônico v1 ────────────────────────────────────────────────

export const apoloCanonicalV1_32_0 = Object.freeze({
  context: "routine",
  created_at: timestampLike("2026-06-17T14:05:00.000Z"),
  measured_at: timestampLike("2026-06-17T14:00:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  schema_version: 1,
  weight_kg: 32.0,
});

export const apoloCanonicalV1_33_3 = Object.freeze({
  context: "routine",
  created_at: timestampLike("2026-08-06T10:05:00.000Z"),
  measured_at: timestampLike("2026-08-06T10:00:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  schema_version: 1,
  weight_kg: 33.3,
});

// ─── 3. v1 com precisão histórica ──────────────────────────────────────────

export const v1PrecisionPreserved = Object.freeze({
  measured_at: timestampLike("2026-07-01T12:00:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  schema_version: 1,
  weight_kg: 32.523,
});

// ─── 4. Legacy Web reconhecido ─────────────────────────────────────────────

export const recognizedLegacyWeb = Object.freeze({
  context: "canil",
  created_at: timestampLike("2026-05-10T09:05:00.000Z"),
  measured_at: timestampLike("2026-05-10T09:00:00.000Z"),
  measured_by: "RA-FIXTURE-001",
  performed_by: "RA-FIXTURE-001",
  weight_kg: 30.5,
});

// ─── 5. Legacy dog-update reconhecido ──────────────────────────────────────

export const recognizedLegacyDogUpdate = Object.freeze({
  created_at: timestampLike("2026-04-02T08:00:00.000Z"),
  measured_at: timestampLike("2026-04-02T08:00:00.000Z"),
  performed_by: "RA-FIXTURE-002",
  weight_kg: 29.8,
});

// ─── 6. weight_history (fonte não canônica) ────────────────────────────────

export const weightHistoryDocument = Object.freeze({
  measured_at: timestampLike("2026-03-01T08:00:00.000Z"),
  measured_by: "RA-FIXTURE-003",
  performed_by: "RA-FIXTURE-003",
  weight_kg: 28.4,
});

// ─── 7. Target v2 Quick valid ──────────────────────────────────────────────

export const targetV2QuickValid = Object.freeze({
  dog_id: FIXTURE_DOG_ID,
  measured_at: timestampLike("2026-08-06T11:00:00.000Z"),
  origin_record_type: "quick",
  record_type: "quick",
  recorded_at: timestampLike("2026-08-06T11:01:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  revision: 1,
  schema_version: 2,
  status: "valid",
  weight_kg: 33.4,
});

// ─── 8. Target v2 Official valid ───────────────────────────────────────────

export const targetV2OfficialValid = Object.freeze({
  dog_id: FIXTURE_DOG_ID,
  equipment_state: "none",
  information_source: "measured_by_recorder",
  location: "veterinary_clinic",
  measured_at: timestampLike("2026-08-06T12:00:00.000Z"),
  measurement_condition: "fasting",
  origin_record_type: "official",
  reading_quality: "stable",
  record_type: "official",
  recorded_at: timestampLike("2026-08-06T12:01:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  revision: 1,
  schema_version: 2,
  status: "valid",
  weight_kg: 33.5,
});

// ─── 9. Target v2 invalidated ──────────────────────────────────────────────

export const targetV2Invalidated = Object.freeze({
  ...targetV2QuickValid,
  measured_at: timestampLike("2026-08-06T13:00:00.000Z"),
  recorded_at: timestampLike("2026-08-06T13:01:00.000Z"),
  status: "invalidated",
  weight_kg: 99.9,
});

// ─── 10. Quick com campo exclusivo de Official ─────────────────────────────

export const targetV2QuickWithOfficialField = Object.freeze({
  ...targetV2QuickValid,
  location: "kennel",
});

// ─── 11. Official incompleto ───────────────────────────────────────────────

export const targetV2OfficialIncomplete = Object.freeze({
  dog_id: FIXTURE_DOG_ID,
  information_source: "measured_by_recorder",
  measured_at: timestampLike("2026-08-06T12:00:00.000Z"),
  origin_record_type: "official",
  record_type: "official",
  recorded_at: timestampLike("2026-08-06T12:01:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  revision: 1,
  schema_version: 2,
  status: "valid",
  weight_kg: 33.5,
});

/** Official com `location: other` e sem descrição correspondente. */
export const targetV2OfficialOtherWithoutDescription = Object.freeze({
  ...targetV2OfficialValid,
  location: "other",
});

// ─── 12–14. BCS ────────────────────────────────────────────────────────────

export const targetV2OfficialBcs1 = Object.freeze({
  ...targetV2OfficialValid,
  bcs: 1,
  bcs_source: "operator_assessment",
});

export const targetV2OfficialBcs5 = Object.freeze({
  ...targetV2OfficialValid,
  bcs: 5,
  bcs_source: "veterinary_guidance",
});

/** Escala legada 1–9: rejeitada, nunca convertida. */
export const targetV2OfficialBcs9 = Object.freeze({
  ...targetV2OfficialValid,
  bcs: 9,
  bcs_source: "operator_assessment",
});

// ─── 15. Schema futuro ─────────────────────────────────────────────────────

export const futureSchema3 = Object.freeze({
  dog_id: FIXTURE_DOG_ID,
  measured_at: timestampLike("2026-08-06T14:00:00.000Z"),
  origin_record_type: "quick",
  record_type: "quick",
  recorded_at: timestampLike("2026-08-06T14:01:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  revision: 1,
  schema_version: 3,
  status: "valid",
  weight_kg: 33.6,
});

// ─── 16. Híbrido v1/v2 ─────────────────────────────────────────────────────

export const hybridV1V2 = Object.freeze({
  measured_at: timestampLike("2026-08-06T15:00:00.000Z"),
  record_type: "quick",
  recorded_by: RECORDER_FIXTURE,
  schema_version: 1,
  status: "valid",
  weight_kg: 33.7,
});

// ─── 17. Sem schema + marcador target ──────────────────────────────────────

export const schemalessWithTargetMarker = Object.freeze({
  measured_at: timestampLike("2026-08-06T16:00:00.000Z"),
  measured_by: "RA-FIXTURE-004",
  performed_by: "RA-FIXTURE-004",
  status: "valid",
  weight_kg: 33.8,
});

/** Sem schema, mas com `recorded_at` (marcador target). */
export const schemalessWithRecordedAt = Object.freeze({
  measured_at: timestampLike("2026-08-06T16:30:00.000Z"),
  measured_by: "RA-FIXTURE-005",
  performed_by: "RA-FIXTURE-005",
  recorded_at: timestampLike("2026-08-06T16:31:00.000Z"),
  weight_kg: 33.9,
});

// ─── 18–25. schema_version inválido ────────────────────────────────────────

const malformedSchemaBase = {
  measured_at: timestampLike("2026-08-06T17:00:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  weight_kg: 32.1,
};

export const schemaVersionString = Object.freeze({
  ...malformedSchemaBase,
  schema_version: "1",
});

export const schemaVersionBoolean = Object.freeze({
  ...malformedSchemaBase,
  schema_version: true,
});

export const schemaVersionFractional = Object.freeze({
  ...malformedSchemaBase,
  schema_version: 2.5,
});

export const schemaVersionZero = Object.freeze({
  ...malformedSchemaBase,
  schema_version: 0,
});

export const schemaVersionNegative = Object.freeze({
  ...malformedSchemaBase,
  schema_version: -1,
});

export const schemaVersionNull = Object.freeze({
  ...malformedSchemaBase,
  schema_version: null,
});

export const schemaVersionMap = Object.freeze({
  ...malformedSchemaBase,
  schema_version: { value: 1 },
});

export const schemaVersionArray = Object.freeze({
  ...malformedSchemaBase,
  schema_version: [1],
});

// ─── 26–29. Valores malformados ────────────────────────────────────────────

export const malformedWeightV1 = Object.freeze({
  measured_at: timestampLike("2026-08-06T18:00:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  schema_version: 1,
  weight_kg: "32.0",
});

export const weightAboveLimitV1 = Object.freeze({
  measured_at: timestampLike("2026-08-06T18:10:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  schema_version: 1,
  weight_kg: 101,
});

/** Target exige décimos exatos: 32.523 é rejeitado. */
export const targetV2WeightTooPrecise = Object.freeze({
  ...targetV2QuickValid,
  weight_kg: 32.523,
});

/** Ruído representacional aceitável, normalizado para 32.3. */
export const targetV2WeightFloatNoise = Object.freeze({
  ...targetV2QuickValid,
  weight_kg: 32.300000000000004,
});

export const malformedMeasuredAtV1 = Object.freeze({
  measured_at: "2026-08-06",
  recorded_by: RECORDER_FIXTURE,
  schema_version: 1,
  weight_kg: 32.2,
});

/** `toDate()` que lança — documento ilegível, não exceção de fluxo. */
export const throwingTimestampV1 = Object.freeze({
  measured_at: {
    toDate: () => {
      throw new Error("timestamp corrompido");
    },
  },
  recorded_by: RECORDER_FIXTURE,
  schema_version: 1,
  weight_kg: 32.3,
});

/** Nanos fora da faixa válida. */
export const outOfRangeNanosV1 = Object.freeze({
  measured_at: { nanoseconds: 1_000_000_000, seconds: 1_780_000_000 },
  recorded_by: RECORDER_FIXTURE,
  schema_version: 1,
  weight_kg: 32.4,
});

// ─── 30. dogId divergente ──────────────────────────────────────────────────

export const embeddedDogIdMismatch = Object.freeze({
  dog_id: OTHER_DOG_ID,
  measured_at: timestampLike("2026-08-06T19:00:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  schema_version: 1,
  weight_kg: 32.5,
});

// ─── 31. Enum desconhecido preservando raw ─────────────────────────────────

/** Official com `equipment_state` desconhecido: parseável com diagnostic. */
export const targetV2UnknownOptionalEnum = Object.freeze({
  ...targetV2OfficialValid,
  equipment_state: "exoskeleton_v2",
});

/** `status` desconhecido: nunca pode virar `valid`. */
export const targetV2UnknownStatus = Object.freeze({
  ...targetV2QuickValid,
  status: "quarantined",
});

/** `record_type` desconhecido. */
export const targetV2UnknownRecordType = Object.freeze({
  ...targetV2QuickValid,
  record_type: "super_quick",
});

/** `legacy_simple` não é tipo factual target. */
export const targetV2LegacySimpleRecordType = Object.freeze({
  ...targetV2QuickValid,
  origin_record_type: "legacy_simple",
  record_type: "legacy_simple",
});

// ─── 32–33. Autoria ───────────────────────────────────────────────────────

export const targetV2WithoutRecorder = Object.freeze({
  dog_id: FIXTURE_DOG_ID,
  measured_at: timestampLike("2026-08-06T20:00:00.000Z"),
  origin_record_type: "quick",
  record_type: "quick",
  recorded_at: timestampLike("2026-08-06T20:01:00.000Z"),
  revision: 1,
  schema_version: 2,
  status: "valid",
  weight_kg: 33.1,
});

/** Recorder com e-mail: rejeitado e nunca preservado. */
export const v1RecorderWithEmail = Object.freeze({
  measured_at: timestampLike("2026-08-06T20:10:00.000Z"),
  recorded_by: {
    email: "operador@example.invalid",
    internal_role: "operador_k9",
    name: "Operador Fixture",
    uid: "uid-operador-fixture",
  },
  schema_version: 1,
  weight_kg: 33.2,
});

/** Recorder incompleto. */
export const v1RecorderIncomplete = Object.freeze({
  measured_at: timestampLike("2026-08-06T20:20:00.000Z"),
  recorded_by: { uid: "uid-operador-fixture" },
  schema_version: 1,
  weight_kg: 33.25,
});

// ─── 34–36. Attachments ────────────────────────────────────────────────────

export const targetV2DuplicateAttachment = Object.freeze({
  ...targetV2OfficialValid,
  attachment_refs: [
    { caption: "balança", health_document_id: "doc-fixture-1" },
    { caption: "duplicado", health_document_id: "doc-fixture-1" },
  ],
});

/** Quick aceita no máximo 3 anexos. */
export const targetV2QuickAttachmentLimit = Object.freeze({
  ...targetV2QuickValid,
  attachment_refs: [
    { health_document_id: "doc-fixture-1" },
    { health_document_id: "doc-fixture-2" },
    { health_document_id: "doc-fixture-3" },
    { health_document_id: "doc-fixture-4" },
  ],
});

/** Official aceita no máximo 5 anexos. */
export const targetV2OfficialAttachmentLimit = Object.freeze({
  ...targetV2OfficialValid,
  attachment_refs: [
    { health_document_id: "doc-fixture-1" },
    { health_document_id: "doc-fixture-2" },
    { health_document_id: "doc-fixture-3" },
    { health_document_id: "doc-fixture-4" },
    { health_document_id: "doc-fixture-5" },
    { health_document_id: "doc-fixture-6" },
  ],
});

/** Quick no limite exato (3) — deve ser aceito. */
export const targetV2QuickAtAttachmentLimit = Object.freeze({
  ...targetV2QuickValid,
  attachment_refs: [
    { health_document_id: "doc-fixture-1" },
    { health_document_id: "doc-fixture-2" },
    { health_document_id: "doc-fixture-3" },
  ],
});

// ─── Shapes legados não reconhecidos ───────────────────────────────────────

/** Sem schema e sem marcador legado conhecido. */
export const unknownSchemalessShape = Object.freeze({
  measured_at: timestampLike("2026-08-06T21:00:00.000Z"),
  weight: 32.0,
});

/** Shape legado que carrega `recorded_by` — combinação impossível. */
export const legacyWithRecordedBy = Object.freeze({
  measured_at: timestampLike("2026-08-06T21:10:00.000Z"),
  measured_by: "RA-FIXTURE-006",
  performed_by: "RA-FIXTURE-006",
  recorded_by: RECORDER_FIXTURE,
  weight_kg: 32.6,
});

/** dog-update com `context` presente: não é dog-update nem Web. */
export const ambiguousLegacyDogUpdateWithContext = Object.freeze({
  context: "canil",
  measured_at: timestampLike("2026-08-06T21:20:00.000Z"),
  performed_by: "RA-FIXTURE-007",
  weight_kg: 32.7,
});

// ─── Objetos adversariais: getters e Proxy que lançam ──────────────────────

/** Marca genérica de que um acesso adversarial lançou. */
export const ADVERSARIAL_THROW_MESSAGE = "acesso adversarial";

/**
 * Documento base v1 válido, usado como esqueleto para injetar um getter que
 * lança em um único campo por vez.
 */
const V1_ADVERSARIAL_BASE = Object.freeze({
  context: "routine",
  created_at: timestampLike("2026-08-06T10:05:00.000Z"),
  measured_at: timestampLike("2026-08-06T10:00:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  schema_version: 1,
  weight_kg: 33.0,
});

/**
 * Copia um objeto plano redefinindo uma chave como getter que lança.
 *
 * O restante das chaves mantém o valor original. `configurable/enumerable`
 * permanecem verdadeiros para que a chave apareça em enumeração — o acesso é
 * que falha, não a listagem.
 */
export function withThrowingGetter(
  base: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const target: Record<string, unknown> = { ...base };
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error(ADVERSARIAL_THROW_MESSAGE);
    },
  });
  return target;
}

/**
 * Documento v1 cujo timestamp `measured_at` é um objeto com um getter que
 * lança na chave indicada.
 *
 * A base do timestamp acompanha o campo sob teste, para que o parser realmente
 * leia a chave que lança: `toDate` usa base `{ toDate }`; `_seconds`/
 * `_nanoseconds` usam base admin-like; `seconds`/`nanoseconds` usam base
 * client-like. Do contrário o parser leria a variante presente e ignoraria a
 * que lança.
 */
export function v1WithThrowingTimestampField(
  key: string,
): Record<string, unknown> {
  const secondsValue = Math.trunc(
    new Date("2026-08-06T10:00:00.000Z").getTime() / 1000,
  );
  let timestamp: Record<string, unknown>;
  if (key === "toDate") {
    timestamp = { toDate: () => new Date("2026-08-06T10:00:00.000Z") };
  } else if (key === "_seconds" || key === "_nanoseconds") {
    timestamp = { _nanoseconds: 0, _seconds: secondsValue };
  } else {
    timestamp = { nanoseconds: 0, seconds: secondsValue };
  }
  return {
    ...V1_ADVERSARIAL_BASE,
    measured_at: withThrowingGetter(timestamp, key),
  };
}

/** Documento v1 cujo `recorded_by` tem um getter que lança na chave indicada. */
export function v1WithThrowingRecorderField(
  key: string,
): Record<string, unknown> {
  return {
    ...V1_ADVERSARIAL_BASE,
    recorded_by: withThrowingGetter({ ...RECORDER_FIXTURE }, key),
  };
}

/** Base target v2 Official válida para injeção adversarial aninhada. */
const TARGET_V2_ADVERSARIAL_BASE = Object.freeze({
  dog_id: FIXTURE_DOG_ID,
  equipment_state: "none",
  information_source: "measured_by_recorder",
  location: "veterinary_clinic",
  measured_at: timestampLike("2026-08-06T11:00:00.000Z"),
  measurement_condition: "fasting",
  origin_record_type: "official",
  reading_quality: "stable",
  record_type: "official",
  recorded_at: timestampLike("2026-08-06T11:01:00.000Z"),
  recorded_by: RECORDER_FIXTURE,
  revision: 1,
  schema_version: 2,
  status: "valid",
  weight_kg: 33.4,
});

/** Target v2 com um attachment cujo campo indicado lança no acesso. */
export function targetV2WithThrowingAttachmentField(
  key: string,
): Record<string, unknown> {
  return {
    ...TARGET_V2_ADVERSARIAL_BASE,
    attachment_refs: [
      withThrowingGetter({ health_document_id: "doc-fixture-1" }, key),
    ],
  };
}

/** Target v2 com um clinical link cujo campo indicado lança no acesso. */
export function targetV2WithThrowingClinicalLinkField(
  key: string,
): Record<string, unknown> {
  return {
    ...TARGET_V2_ADVERSARIAL_BASE,
    clinical_links: [
      withThrowingGetter(
        { entity_id: "entity-1", entity_type: "consulta" },
        key,
      ),
    ],
  };
}

/** Target v2 Official com BCS cujo campo indicado lança no acesso. */
export function targetV2WithThrowingBcsField(
  key: string,
): Record<string, unknown> {
  return withThrowingGetter(
    { ...TARGET_V2_ADVERSARIAL_BASE, bcs: 3, bcs_source: "operator_assessment" },
    key,
  );
}

/** Target v2 Official cujo campo raiz indicado lança no acesso. */
export function targetV2WithThrowingRootField(
  key: string,
): Record<string, unknown> {
  return withThrowingGetter({ ...TARGET_V2_ADVERSARIAL_BASE }, key);
}

/**
 * Envolve um objeto em Proxy cujo trap indicado lança.
 *
 * Cobre os três traps que o parser exercita: `get` (leitura de valor), `has`
 * (nunca usado diretamente, mas defensivo) e `getOwnPropertyDescriptor`
 * (consultado por `hasOwnProperty`).
 */
export function proxyThatThrowsOn(
  base: Record<string, unknown>,
  trap: "get" | "has" | "getOwnPropertyDescriptor",
): Record<string, unknown> {
  const handler: ProxyHandler<Record<string, unknown>> = {};
  if (trap === "get") {
    handler.get = () => {
      throw new Error(ADVERSARIAL_THROW_MESSAGE);
    };
  } else if (trap === "has") {
    handler.has = () => {
      throw new Error(ADVERSARIAL_THROW_MESSAGE);
    };
  } else {
    handler.getOwnPropertyDescriptor = () => {
      throw new Error(ADVERSARIAL_THROW_MESSAGE);
    };
  }
  return new Proxy({ ...base }, handler);
}

/** Base v1 mutável para envolver em Proxy adversarial. */
export function v1AdversarialBase(): Record<string, unknown> {
  return { ...V1_ADVERSARIAL_BASE };
}

/**
 * Base legada Web reconhecida (sem `schema_version`), mutável.
 *
 * Usada para exercitar campos lidos apenas no ramo legado — `measured_by` e
 * `performed_by` — que o ramo v1 nunca acessa.
 */
export function legacyWebAdversarialBase(): Record<string, unknown> {
  return {
    created_at: timestampLike("2026-08-06T10:05:00.000Z"),
    measured_at: timestampLike("2026-08-06T10:00:00.000Z"),
    measured_by: "RA-FIXTURE-ADV",
    performed_by: "RA-FIXTURE-ADV",
    weight_kg: 33.0,
  };
}

/**
 * Target v2 Official válido com um campo aninhado (`recorded_by`) que é ele
 * próprio um Proxy com trap `get` que lança.
 */
export function targetV2WithThrowingNestedProxy(): Record<string, unknown> {
  return {
    ...TARGET_V2_ADVERSARIAL_BASE,
    recorded_by: proxyThatThrowsOn({ ...RECORDER_FIXTURE }, "get"),
  };
}

/**
 * Target v2 com e-mail em enum opcional desconhecido.
 *
 * `equipment_state` desconhecido preserva o raw (o e-mail) apenas no aggregate
 * bruto do parser; a superfície pública nunca deve expô-lo. Usado na prova de
 * privacidade de M1.
 */
export const ADVERSARIAL_ENUM_EMAIL = "operador@example.invalid";
export const targetV2UnknownEnumWithEmail = Object.freeze({
  ...TARGET_V2_ADVERSARIAL_BASE,
  equipment_state: ADVERSARIAL_ENUM_EMAIL,
});
