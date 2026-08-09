import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CANONICAL_WEIGHT_COLLECTION,
  parseWeightDocument,
  type WeightParseResult,
} from "../weight-document-parser";
import { hasDiagnosticCode } from "../weight-diagnostics";
import * as fixtures from "./weight-document-fixtures";

const { FIXTURE_DOG_ID, OTHER_DOG_ID } = fixtures;

function parse(
  data: unknown,
  options: { documentId?: string; dogId?: string; sourceCollection?: string } = {},
): WeightParseResult {
  return parseWeightDocument({
    data,
    dogId: options.dogId ?? FIXTURE_DOG_ID,
    entityId: options.documentId ?? "weight-fixture-1",
    sourceCollection: options.sourceCollection ?? CANONICAL_WEIGHT_COLLECTION,
  });
}

function expectSuccess(result: WeightParseResult) {
  if (result.kind !== "success") {
    throw new Error(`esperado success, recebido ${result.kind}`);
  }
  return result;
}

describe("parseWeightDocument — origem canônica", () => {
  it("rejeita weight_history como fonte canônica", () => {
    const result = parse(fixtures.weightHistoryDocument, {
      sourceCollection: "weight_history",
    });
    expect(result.kind).toBe("malformed");
    expect(hasDiagnosticCode(result.diagnostics, "nonCanonicalCollection")).toBe(
      true,
    );
  });

  it("aceita weight_records por padrão", () => {
    const result = parseWeightDocument({
      data: fixtures.apoloCanonicalV1_32_0,
      dogId: FIXTURE_DOG_ID,
      entityId: "weight-fixture-1",
    });
    expect(result.kind).toBe("success");
  });

  it("rejeita documento que não é map", () => {
    expect(parse(null).kind).toBe("malformed");
    expect(parse([]).kind).toBe("malformed");
    expect(parse("documento").kind).toBe("malformed");
  });
});

describe("parseWeightDocument — identidade", () => {
  it("exige entityId e dogId não vazios", () => {
    expect(parse(fixtures.apoloCanonicalV1_32_0, { documentId: "  " }).kind).toBe(
      "malformed",
    );
    expect(parse(fixtures.apoloCanonicalV1_32_0, { dogId: "  " }).kind).toBe(
      "malformed",
    );
  });

  it("trata o dogId de contexto como autoridade e rejeita embutido divergente", () => {
    const result = parse(fixtures.embeddedDogIdMismatch);
    expect(result.kind).toBe("malformed");
    expect(hasDiagnosticCode(result.diagnostics, "embeddedDogIdMismatch")).toBe(
      true,
    );
  });

  it("aceita dog_id embutido coerente e preserva o dogId de contexto", () => {
    const result = expectSuccess(parse(fixtures.targetV2QuickValid));
    expect(result.assessment.dogId).toBe(FIXTURE_DOG_ID);
    expect(result.assessment.dogId).not.toBe(OTHER_DOG_ID);
  });
});

describe("parseWeightDocument — deployed v1", () => {
  it("classifica os registros canônicos de Apolo", () => {
    const first = expectSuccess(parse(fixtures.apoloCanonicalV1_32_0));
    expect(first.assessment.weightKg).toBe(32.0);
    expect(first.assessment.schemaVersion).toBe(1);
    expect(first.assessment.compatibility.sourceShape).toBe("deployedV1");

    const second = expectSuccess(parse(fixtures.apoloCanonicalV1_33_3));
    expect(second.assessment.weightKg).toBe(33.3);
  });

  it("deriva record_type, status e revision apenas no read model", () => {
    const { assessment } = expectSuccess(parse(fixtures.apoloCanonicalV1_32_0));
    expect(assessment.recordType).toEqual({
      raw: "legacy_simple",
      state: "known",
      value: "legacy_simple",
    });
    expect(assessment.originRecordType.state).toBe("known");
    expect(assessment.status).toEqual({
      raw: "valid",
      state: "known",
      value: "valid",
    });
    expect(assessment.revision).toBe(1);
    expect(assessment.compatibility.derivedFields).toEqual([
      "recordType",
      "originRecordType",
      "status",
      "revision",
    ]);
    expect(assessment.compatibility.persistedSchemaVersion).toBe(1);
    expect(assessment.compatibility.schemaVersionDerived).toBe(false);
    expect(hasDiagnosticCode(assessment.compatibility.diagnostics, "derivedLegacyRecordType")).toBe(true);
    expect(hasDiagnosticCode(assessment.compatibility.diagnostics, "derivedValidStatus")).toBe(true);
    expect(hasDiagnosticCode(assessment.compatibility.diagnostics, "derivedRevisionOne")).toBe(true);
  });

  it("NÃO é classificado como legado sem schema", () => {
    const { assessment } = expectSuccess(parse(fixtures.apoloCanonicalV1_32_0));
    expect(assessment.compatibility.sourceShape).toBe("deployedV1");
    expect(assessment.compatibility.sourceShape).not.toBe(
      "recognizedLegacyWeb",
    );
    expect(assessment.compatibility.sourceShape).not.toBe(
      "recognizedLegacyDogUpdate",
    );
  });

  it("exige autoria canônica e nunca a inventa", () => {
    const { assessment } = expectSuccess(parse(fixtures.apoloCanonicalV1_32_0));
    expect(assessment.recorder).toEqual({
      internalRole: "operador_k9",
      name: "Operador Fixture",
      uid: "uid-operador-fixture",
    });

    const incomplete = parse(fixtures.v1RecorderIncomplete);
    expect(incomplete.kind).toBe("malformed");
    expect(hasDiagnosticCode(incomplete.diagnostics, "malformedRecorder")).toBe(
      true,
    );
  });

  it("rejeita recorder com e-mail e nunca preserva o e-mail", () => {
    const result = parse(fixtures.v1RecorderWithEmail);
    expect(result.kind).toBe("malformed");
    expect(result.assessment).toBeNull();
    expect(hasDiagnosticCode(result.diagnostics, "malformedRecorder")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("example.invalid");
  });

  it("preserva precisão histórica sem arredondar", () => {
    const { assessment } = expectSuccess(parse(fixtures.v1PrecisionPreserved));
    expect(assessment.weightKg).toBe(32.523);
    expect(
      hasDiagnosticCode(
        assessment.compatibility.diagnostics,
        "legacyWeightPrecisionPreserved",
      ),
    ).toBe(true);
  });

  it("não promove created_at a measured_at, apenas a fallback de ordenação", () => {
    const { assessment } = expectSuccess(parse(fixtures.apoloCanonicalV1_32_0));
    expect(assessment.measuredAt.toISOString()).toBe(
      "2026-06-17T14:00:00.000Z",
    );
    expect(assessment.recordedAt).toBeNull();
    expect(assessment.compatibility.orderingFallbackAt?.toISOString()).toBe(
      "2026-06-17T14:05:00.000Z",
    );
    expect(
      hasDiagnosticCode(
        assessment.compatibility.diagnostics,
        "legacyTimestampFallbackAvailable",
      ),
    ).toBe(true);
  });

  it("rejeita peso e timestamp malformados", () => {
    expect(parse(fixtures.malformedWeightV1).kind).toBe("malformed");
    expect(parse(fixtures.weightAboveLimitV1).kind).toBe("malformed");
    expect(parse(fixtures.malformedMeasuredAtV1).kind).toBe("malformed");
    expect(parse(fixtures.outOfRangeNanosV1).kind).toBe("malformed");
  });

  it("trata toDate() que lança como documento ilegível, sem propagar exceção", () => {
    expect(() => parse(fixtures.throwingTimestampV1)).not.toThrow();
    expect(parse(fixtures.throwingTimestampV1).kind).toBe("malformed");
  });

  it("aceita variações de timestamp sem depender do SDK", () => {
    const base = {
      recorded_by: fixtures.RECORDER_FIXTURE,
      schema_version: 1,
      weight_kg: 32.0,
    };
    for (const measured of [
      new Date("2026-06-17T14:00:00.000Z"),
      fixtures.timestampLike("2026-06-17T14:00:00.000Z"),
      fixtures.adminTimestampLike("2026-06-17T14:00:00.000Z"),
      fixtures.toDateLike("2026-06-17T14:00:00.000Z"),
    ]) {
      const { assessment } = expectSuccess(
        parse({ ...base, measured_at: measured }),
      );
      expect(assessment.measuredAt.toISOString()).toBe(
        "2026-06-17T14:00:00.000Z",
      );
    }
  });
});

describe("parseWeightDocument — adapters legados", () => {
  it("reconhece legacy Web e não produz autoria", () => {
    const { assessment } = expectSuccess(parse(fixtures.recognizedLegacyWeb));
    expect(assessment.compatibility.sourceShape).toBe("recognizedLegacyWeb");
    expect(assessment.recorder).toBeNull();
    expect(assessment.compatibility.schemaVersionDerived).toBe(true);
    expect(assessment.compatibility.persistedSchemaVersion).toBeNull();
    expect(
      hasDiagnosticCode(assessment.compatibility.diagnostics, "legacySourceShape"),
    ).toBe(true);
    expect(
      hasDiagnosticCode(
        assessment.compatibility.diagnostics,
        "missingCanonicalRecorder",
      ),
    ).toBe(true);
  });

  it("reconhece legacy dog-update e não produz autoria", () => {
    const { assessment } = expectSuccess(
      parse(fixtures.recognizedLegacyDogUpdate),
    );
    expect(assessment.compatibility.sourceShape).toBe(
      "recognizedLegacyDogUpdate",
    );
    expect(assessment.recorder).toBeNull();
  });

  it("mantém os detectores mutuamente exclusivos", () => {
    const web = expectSuccess(parse(fixtures.recognizedLegacyWeb));
    const dogUpdate = expectSuccess(parse(fixtures.recognizedLegacyDogUpdate));
    expect(web.assessment.compatibility.sourceShape).not.toBe(
      dogUpdate.assessment.compatibility.sourceShape,
    );

    // dog-update com context não satisfaz nenhum detector.
    const ambiguous = parse(fixtures.ambiguousLegacyDogUpdateWithContext);
    expect(ambiguous.kind).toBe("malformed");
    expect(hasDiagnosticCode(ambiguous.diagnostics, "unknownLegacyShape")).toBe(
      true,
    );
  });

  it("preserva o RA legado apenas como metadata interna", () => {
    const { assessment } = expectSuccess(parse(fixtures.recognizedLegacyWeb));
    expect(assessment.compatibility.legacyActorReference).toBe("RA-FIXTURE-001");
    expect(assessment.recorder).toBeNull();
  });

  it("não classifica Quick/Official em shape legado", () => {
    const { assessment } = expectSuccess(parse(fixtures.recognizedLegacyWeb));
    expect(assessment.recordType.state).toBe("known");
    expect(assessment.recordType).toEqual({
      raw: "legacy_simple",
      state: "known",
      value: "legacy_simple",
    });
    expect(assessment.officialDetails).toBeNull();
  });

  it("rejeita shape legado com recorded_by", () => {
    const result = parse(fixtures.legacyWithRecordedBy);
    expect(result.kind).toBe("malformed");
    expect(hasDiagnosticCode(result.diagnostics, "unknownLegacyShape")).toBe(
      true,
    );
  });

  it("rejeita shape genérico sem schema", () => {
    const result = parse(fixtures.unknownSchemalessShape);
    expect(result.kind).toBe("malformed");
    expect(hasDiagnosticCode(result.diagnostics, "unknownLegacyShape")).toBe(
      true,
    );
  });
});

describe("parseWeightDocument — híbridos e schema inválido", () => {
  it("rejeita v1 com marcador target", () => {
    const result = parse(fixtures.hybridV1V2);
    expect(result.kind).toBe("malformed");
    expect(hasDiagnosticCode(result.diagnostics, "hybridV1V2")).toBe(true);
  });

  it("rejeita documento sem schema com marcador target", () => {
    for (const fixture of [
      fixtures.schemalessWithTargetMarker,
      fixtures.schemalessWithRecordedAt,
    ]) {
      const result = parse(fixture);
      expect(result.kind).toBe("malformed");
      expect(hasDiagnosticCode(result.diagnostics, "hybridV1V2")).toBe(true);
    }
  });

  it("rejeita schema_version inválido em todas as formas", () => {
    for (const fixture of [
      fixtures.schemaVersionString,
      fixtures.schemaVersionBoolean,
      fixtures.schemaVersionFractional,
      fixtures.schemaVersionZero,
      fixtures.schemaVersionNegative,
      fixtures.schemaVersionNull,
      fixtures.schemaVersionMap,
      fixtures.schemaVersionArray,
    ]) {
      const result = parse(fixture);
      expect(result.kind).toBe("malformed");
      expect(
        hasDiagnosticCode(result.diagnostics, "malformedSchemaVersion"),
      ).toBe(true);
    }
  });

  it("classifica schema futuro como unsupported, sem aggregate", () => {
    const result = parse(fixtures.futureSchema3);
    expect(result.kind).toBe("unsupported");
    if (result.kind !== "unsupported") throw new Error("esperado unsupported");
    expect(result.schemaVersion).toBe(3);
    expect(result.assessment).toBeNull();
    expect(
      hasDiagnosticCode(result.diagnostics, "unsupportedSchemaVersion"),
    ).toBe(true);
  });
});

describe("parseWeightDocument — target v2", () => {
  it("aceita Quick válido", () => {
    const { assessment } = expectSuccess(parse(fixtures.targetV2QuickValid));
    expect(assessment.schemaVersion).toBe(2);
    expect(assessment.compatibility.sourceShape).toBe("targetV2");
    expect(assessment.recordType.state).toBe("known");
    expect(assessment.officialDetails).toBeNull();
    expect(assessment.recordedAt?.toISOString()).toBe(
      "2026-08-06T11:01:00.000Z",
    );
    expect(assessment.compatibility.derivedFields).toEqual([]);
  });

  it("aceita Official válido com detalhes completos", () => {
    const { assessment } = expectSuccess(parse(fixtures.targetV2OfficialValid));
    expect(assessment.officialDetails).not.toBeNull();
    expect(assessment.officialDetails?.informationSource.state).toBe("known");
    expect(assessment.officialDetails?.location.state).toBe("known");
    expect(assessment.officialDetails?.measurementCondition.state).toBe("known");
  });

  it("não é capturado por adapter legado", () => {
    const { assessment } = expectSuccess(parse(fixtures.targetV2QuickValid));
    expect(assessment.compatibility.sourceShape).toBe("targetV2");
    expect(assessment.compatibility.schemaVersionDerived).toBe(false);
    expect(assessment.compatibility.legacyActorReference).toBeNull();
  });

  it("aceita invalidated como parseável", () => {
    const { assessment } = expectSuccess(parse(fixtures.targetV2Invalidated));
    expect(assessment.status).toEqual({
      raw: "invalidated",
      state: "known",
      value: "invalidated",
    });
  });

  it("rejeita legacy_simple como tipo target", () => {
    const result = parse(fixtures.targetV2LegacySimpleRecordType);
    expect(result.kind).toBe("malformed");
    expect(hasDiagnosticCode(result.diagnostics, "unknownLegacyShape")).toBe(
      true,
    );
  });

  it("rejeita status desconhecido preservando o raw em diagnostic", () => {
    const result = parse(fixtures.targetV2UnknownStatus);
    expect(result.kind).toBe("malformed");
    expect(hasDiagnosticCode(result.diagnostics, "unknownEnum")).toBe(true);
    const unknown = result.diagnostics.find(
      (diagnostic) => diagnostic.code === "unknownEnum",
    );
    expect(unknown?.safeRaw).toBe("quarantined");
  });

  it("rejeita record_type desconhecido", () => {
    const result = parse(fixtures.targetV2UnknownRecordType);
    expect(result.kind).toBe("malformed");
  });

  it("preserva raw de enum opcional desconhecido sem invalidar o documento", () => {
    const { assessment } = expectSuccess(
      parse(fixtures.targetV2UnknownOptionalEnum),
    );
    expect(assessment.officialDetails?.equipmentState).toEqual({
      raw: "exoskeleton_v2",
      state: "unknown",
    });
    expect(
      hasDiagnosticCode(assessment.compatibility.diagnostics, "unknownEnum"),
    ).toBe(true);
  });

  it("proíbe campo exclusivo de Official em Quick", () => {
    const result = parse(fixtures.targetV2QuickWithOfficialField);
    expect(result.kind).toBe("malformed");
    expect(hasDiagnosticCode(result.diagnostics, "forbiddenQuickField")).toBe(
      true,
    );
  });

  it("rejeita Official incompleto", () => {
    const result = parse(fixtures.targetV2OfficialIncomplete);
    expect(result.kind).toBe("malformed");
    expect(hasDiagnosticCode(result.diagnostics, "incompleteOfficial")).toBe(
      true,
    );
  });

  it("exige descrição quando location é other", () => {
    const result = parse(fixtures.targetV2OfficialOtherWithoutDescription);
    expect(result.kind).toBe("malformed");
    expect(hasDiagnosticCode(result.diagnostics, "incompleteOfficial")).toBe(
      true,
    );
  });

  it("exige décimos exatos e normaliza apenas ruído representacional", () => {
    expect(parse(fixtures.targetV2WeightTooPrecise).kind).toBe("malformed");

    const { assessment } = expectSuccess(
      parse(fixtures.targetV2WeightFloatNoise),
    );
    expect(assessment.weightKg).toBe(32.3);
  });

  it("exige autoria canônica no target", () => {
    const result = parse(fixtures.targetV2WithoutRecorder);
    expect(result.kind).toBe("malformed");
    expect(hasDiagnosticCode(result.diagnostics, "malformedRecorder")).toBe(
      true,
    );
  });

  it("aceita BCS 1 e 5 e rejeita BCS 9", () => {
    const bcs1 = expectSuccess(parse(fixtures.targetV2OfficialBcs1));
    expect(bcs1.assessment.officialDetails?.bodyConditionScore?.value).toBe(1);

    const bcs5 = expectSuccess(parse(fixtures.targetV2OfficialBcs5));
    expect(bcs5.assessment.officialDetails?.bodyConditionScore?.value).toBe(5);

    const bcs9 = parse(fixtures.targetV2OfficialBcs9);
    expect(bcs9.kind).toBe("malformed");
    expect(hasDiagnosticCode(bcs9.diagnostics, "incompleteOfficial")).toBe(true);
  });

  it("rejeita anexo duplicado", () => {
    const result = parse(fixtures.targetV2DuplicateAttachment);
    expect(result.kind).toBe("malformed");
    expect(hasDiagnosticCode(result.diagnostics, "duplicateAttachment")).toBe(
      true,
    );
  });

  it("aplica limite de anexos por tipo", () => {
    const quickOver = parse(fixtures.targetV2QuickAttachmentLimit);
    expect(quickOver.kind).toBe("malformed");
    expect(
      hasDiagnosticCode(quickOver.diagnostics, "attachmentLimitExceeded"),
    ).toBe(true);

    const officialOver = parse(fixtures.targetV2OfficialAttachmentLimit);
    expect(officialOver.kind).toBe("malformed");
    expect(
      hasDiagnosticCode(officialOver.diagnostics, "attachmentLimitExceeded"),
    ).toBe(true);

    const quickAtLimit = expectSuccess(
      parse(fixtures.targetV2QuickAtAttachmentLimit),
    );
    expect(quickAtLimit.assessment.attachmentReferences).toHaveLength(3);
  });
});

describe("parseWeightDocument — determinismo e ausência de aggregate parcial", () => {
  it("é determinístico para a mesma entrada", () => {
    const first = parse(fixtures.apoloCanonicalV1_33_3);
    const second = parse(fixtures.apoloCanonicalV1_33_3);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("nunca devolve aggregate em malformed ou unsupported", () => {
    for (const fixture of [
      fixtures.hybridV1V2,
      fixtures.schemaVersionString,
      fixtures.malformedWeightV1,
      fixtures.embeddedDogIdMismatch,
      fixtures.targetV2OfficialIncomplete,
      fixtures.futureSchema3,
    ]) {
      const result = parse(fixture);
      expect(result.kind).not.toBe("success");
      expect(result.assessment).toBeNull();
    }
  });

  it("não lança para nenhum documento inválido conhecido", () => {
    const invalid: unknown[] = [
      null,
      undefined,
      [],
      "",
      0,
      { schema_version: Number.NaN },
      { schema_version: Number.POSITIVE_INFINITY },
      { measured_at: { seconds: Number.NaN } },
      fixtures.throwingTimestampV1,
      fixtures.schemaVersionMap,
    ];
    for (const data of invalid) {
      expect(() => parse(data)).not.toThrow();
    }
  });

  it("nunca expõe RA, uid, nome ou e-mail em diagnostics", () => {
    for (const fixture of [
      fixtures.recognizedLegacyWeb,
      fixtures.v1RecorderWithEmail,
      fixtures.legacyWithRecordedBy,
    ]) {
      const result = parse(fixture);
      const serialized = JSON.stringify(result.diagnostics);
      expect(serialized).not.toContain("RA-FIXTURE");
      expect(serialized).not.toContain("uid-operador-fixture");
      expect(serialized).not.toContain("Operador Fixture");
      expect(serialized).not.toContain("example.invalid");
    }
  });
});

// ─── M2: acesso a propriedades que lançam ──────────────────────────────────

describe("parseWeightDocument — getters e Proxies que lançam", () => {
  /** Sanidade: as bases adversariais parseiam como success quando intactas. */
  it("as bases adversariais são válidas sem injeção", () => {
    expect(parse(fixtures.v1AdversarialBase()).kind).toBe("success");
    expect(parse(fixtures.targetV2WithThrowingRootField("__none__")).kind).toBe(
      "success",
    );
  });

  const rootFields = [
    "schema_version",
    "weight_kg",
    "measured_at",
    "recorded_by",
    "dog_id",
    "context",
    "notes",
    "created_at",
  ];
  it.each(rootFields)("getter que lança em root.%s vira malformed", (field) => {
    const doc = fixtures.withThrowingGetter(fixtures.v1AdversarialBase(), field);
    let result: WeightParseResult | undefined;
    expect(() => {
      result = parse(doc);
    }).not.toThrow();
    expect(result?.kind).toBe("malformed");
    expect(result?.assessment).toBeNull();
    expect(JSON.stringify(result?.diagnostics)).not.toContain(
      fixtures.ADVERSARIAL_THROW_MESSAGE,
    );
  });

  // `measured_by`/`performed_by` só são lidos no ramo legado (sem schema).
  const legacyFields = ["measured_by", "performed_by"];
  it.each(legacyFields)(
    "getter que lança em root.%s (legado) vira malformed",
    (field) => {
      const doc = fixtures.withThrowingGetter(
        fixtures.legacyWebAdversarialBase(),
        field,
      );
      let result: WeightParseResult | undefined;
      expect(() => {
        result = parse(doc);
      }).not.toThrow();
      expect(result?.kind).toBe("malformed");
      expect(result?.assessment).toBeNull();
      expect(JSON.stringify(result?.diagnostics)).not.toContain(
        fixtures.ADVERSARIAL_THROW_MESSAGE,
      );
    },
  );

  const timestampFields = [
    "toDate",
    "seconds",
    "nanoseconds",
    "_seconds",
    "_nanoseconds",
  ];
  it.each(timestampFields)(
    "getter que lança em timestamp.%s vira malformed",
    (field) => {
      const doc = fixtures.v1WithThrowingTimestampField(field);
      let result: WeightParseResult | undefined;
      expect(() => {
        result = parse(doc);
      }).not.toThrow();
      expect(result?.kind).toBe("malformed");
      expect(result?.assessment).toBeNull();
      expect(JSON.stringify(result?.diagnostics)).not.toContain(
        fixtures.ADVERSARIAL_THROW_MESSAGE,
      );
    },
  );

  const recorderFields = ["uid", "name", "internal_role", "email"];
  it.each(recorderFields)(
    "getter que lança em recorder.%s vira malformed",
    (field) => {
      const doc = fixtures.v1WithThrowingRecorderField(field);
      let result: WeightParseResult | undefined;
      expect(() => {
        result = parse(doc);
      }).not.toThrow();
      expect(result?.kind).toBe("malformed");
      expect(result?.assessment).toBeNull();
      expect(JSON.stringify(result?.diagnostics)).not.toContain(
        fixtures.ADVERSARIAL_THROW_MESSAGE,
      );
    },
  );

  it("getter que lança em attachment.health_document_id vira malformed", () => {
    let result: WeightParseResult | undefined;
    expect(() => {
      result = parse(
        fixtures.targetV2WithThrowingAttachmentField("health_document_id"),
      );
    }).not.toThrow();
    expect(result?.kind).toBe("malformed");
    expect(result?.assessment).toBeNull();
  });

  it("getter que lança em attachment.storage_path é tolerado (campo não lido)", () => {
    // `storage_path` não é lido pelo parser: o attachment permanece factual.
    const result = parse(
      fixtures.targetV2WithThrowingAttachmentField("storage_path"),
    );
    expect(result.kind).toBe("success");
  });

  it("getter que lança em clinical_link.entity_id vira malformed", () => {
    let result: WeightParseResult | undefined;
    expect(() => {
      result = parse(
        fixtures.targetV2WithThrowingClinicalLinkField("entity_id"),
      );
    }).not.toThrow();
    expect(result?.kind).toBe("malformed");
    expect(result?.assessment).toBeNull();
  });

  const bcsFields = ["bcs", "bcs_source"];
  it.each(bcsFields)("getter que lança em %s vira malformed", (field) => {
    let result: WeightParseResult | undefined;
    expect(() => {
      result = parse(fixtures.targetV2WithThrowingBcsField(field));
    }).not.toThrow();
    expect(result?.kind).toBe("malformed");
    expect(result?.assessment).toBeNull();
  });

  const officialRootFields = [
    "information_source",
    "location",
    "measurement_condition",
  ];
  it.each(officialRootFields)(
    "getter que lança em official.%s vira malformed",
    (field) => {
      let result: WeightParseResult | undefined;
      expect(() => {
        result = parse(fixtures.targetV2WithThrowingRootField(field));
      }).not.toThrow();
      expect(result?.kind).toBe("malformed");
      expect(result?.assessment).toBeNull();
    },
  );

  // `get` e `getOwnPropertyDescriptor` são exercitados diretamente
  // (`Reflect.get` e `hasOwnProperty`) e devem virar malformed sem lançar.
  const failingProxyTraps = ["get", "getOwnPropertyDescriptor"] as const;
  it.each(failingProxyTraps)(
    "root Proxy com trap %s que lança vira malformed",
    (trap) => {
      const doc = fixtures.proxyThatThrowsOn(fixtures.v1AdversarialBase(), trap);
      let result: WeightParseResult | undefined;
      expect(() => {
        result = parse(doc);
      }).not.toThrow();
      expect(result?.kind).toBe("malformed");
      expect(result?.assessment).toBeNull();
      expect(JSON.stringify(result?.diagnostics)).not.toContain(
        fixtures.ADVERSARIAL_THROW_MESSAGE,
      );
    },
  );

  // O parser nunca usa o operador `in`, então o trap `has` não é acionado: a
  // garantia aqui é apenas que nenhuma exceção escapa.
  it("root Proxy com trap has que lança nunca derruba o parser", () => {
    const doc = fixtures.proxyThatThrowsOn(fixtures.v1AdversarialBase(), "has");
    expect(() => parse(doc)).not.toThrow();
  });

  it("Proxy aninhado (recorder) com trap get que lança vira malformed", () => {
    let result: WeightParseResult | undefined;
    expect(() => {
      result = parse(fixtures.targetV2WithThrowingNestedProxy());
    }).not.toThrow();
    expect(result?.kind).toBe("malformed");
    expect(result?.assessment).toBeNull();
  });

  it("nunca muta o input adversarial", () => {
    const doc = fixtures.withThrowingGetter(
      fixtures.v1AdversarialBase(),
      "weight_kg",
    );
    const keysBefore = Reflect.ownKeys(doc).length;
    parse(doc);
    expect(Reflect.ownKeys(doc).length).toBe(keysBefore);
  });
});

// ─── Guardrails de fonte (complementares aos testes de comportamento) ──────

describe("guardrails de fonte do módulo de domínio", () => {
  const moduleDir = path.resolve(__dirname, "..");
  const adapterDir = path.resolve(__dirname, "../../../data/weight");
  const sources = [
    path.join(moduleDir, "weight-enums.ts"),
    path.join(moduleDir, "weight-assessment.ts"),
    path.join(moduleDir, "weight-diagnostics.ts"),
    path.join(moduleDir, "weight-document-parser.ts"),
    path.join(adapterDir, "weight-read-adapter.ts"),
  ];

  it("não importa Firebase nem React", () => {
    for (const file of sources) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/from\s+["']firebase/);
      expect(source).not.toMatch(/from\s+["']react/);
      expect(source).not.toMatch(/@\/lib\/firebase/);
    }
  });

  it("não contém API de escrita nem serializer target", () => {
    for (const file of sources) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/\bsetDoc\b/);
      expect(source).not.toMatch(/\bupdateDoc\b/);
      expect(source).not.toMatch(/\baddDoc\b/);
      expect(source).not.toMatch(/\bdeleteDoc\b/);
      expect(source).not.toMatch(/\bwriteBatch\b/);
      expect(source).not.toMatch(/function\s+serialize/);
      expect(source).not.toMatch(/toFirestore/);
    }
  });

  it("não faz logging", () => {
    for (const file of sources) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/console\.(log|warn|error|info|debug)/);
    }
  });

  it("não usa any nem cast amplo", () => {
    for (const file of sources) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/:\s*any\b/);
      expect(source).not.toMatch(/as\s+unknown\s+as/);
      expect(source).not.toMatch(/eslint-disable/);
      expect(source).not.toMatch(/@ts-(ignore|expect-error|nocheck)/);
    }
  });
});
