import { describe, expect, it } from "vitest";

import * as fixtures from "../../../domain/weight/__tests__/weight-document-fixtures";
import { parseWeightDocument } from "../../../domain/weight/weight-document-parser";
import {
  presentableRecorder,
  readWeightDocument,
  type PublicParsedWeightEnum,
  type PublicWeightCompatibilityMetadata,
  type WeightReadResult,
} from "../weight-read-adapter";

const { FIXTURE_DOG_ID } = fixtures;

// ─── M1: checagens de tipo (falham no tsc se um campo for reintroduzido) ────

/** Resolve a `false`; um `true` (campo presente) quebra a constraint no tsc. */
type Assert<T extends false> = T;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

/**
 * Tupla de provas estáticas, consumida em runtime para não ficar "unused".
 *
 * Cada elemento só tipa se o campo proibido NÃO for chave do tipo público.
 * Reintroduzir `legacyActorReference`, `diagnostics` (objeto completo) ou
 * `raw` faz este arquivo falhar em `npm run typecheck`.
 */
const PUBLIC_TYPE_ASSERTIONS: [
  Assert<HasKey<PublicWeightCompatibilityMetadata, "legacyActorReference">>,
  Assert<HasKey<PublicWeightCompatibilityMetadata, "diagnostics">>,
  Assert<HasKey<PublicParsedWeightEnum<"quick">, "raw">>,
] = [false, false, false];

function read(
  data: unknown,
  options: { documentId?: string; dogId?: string; sourceCollection?: string } = {},
): WeightReadResult {
  return readWeightDocument({
    data,
    documentId: options.documentId ?? "weight-fixture-1",
    dogId: options.dogId ?? FIXTURE_DOG_ID,
    ...(options.sourceCollection === undefined
      ? {}
      : { sourceCollection: options.sourceCollection }),
  });
}

/** Coleta recursivamente todas as chaves e valores string de um objeto. */
function deepInspect(value: unknown): { keys: string[]; strings: string[] } {
  const keys: string[] = [];
  const strings: string[] = [];
  const seen = new Set<unknown>();

  const walk = (node: unknown): void => {
    if (node === null || node === undefined) return;
    if (typeof node === "string") {
      strings.push(node);
      return;
    }
    if (typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);

    if (node instanceof Date) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      keys.push(key);
      walk(child);
    }
  };

  walk(value);
  return { keys, strings };
}

describe("readWeightDocument — classificação", () => {
  it("success valid vira valid", () => {
    const result = read(fixtures.apoloCanonicalV1_32_0);
    expect(result.kind).toBe("valid");
    expect(result.assessment).not.toBeNull();
  });

  it("valid sem recorder permanece valid com autoria nula", () => {
    const result = read(fixtures.recognizedLegacyWeb);
    expect(result.kind).toBe("valid");
    if (result.kind !== "valid") throw new Error("esperado valid");
    expect(result.assessment.recorder).toBeNull();
    expect(presentableRecorder(result.assessment)).toBeNull();
  });

  it("invalidated permanece invalidated e preserva o aggregate", () => {
    const result = read(fixtures.targetV2Invalidated);
    expect(result.kind).toBe("invalidated");
    expect(result.assessment).not.toBeNull();
  });

  it("malformed permanece malformed sem aggregate", () => {
    const result = read(fixtures.hybridV1V2);
    expect(result.kind).toBe("malformed");
    expect(result.assessment).toBeNull();
  });

  it("unsupported permanece unsupported preservando a versão", () => {
    const result = read(fixtures.futureSchema3);
    expect(result.kind).toBe("unsupported");
    if (result.kind !== "unsupported") throw new Error("esperado unsupported");
    expect(result.schemaVersion).toBe(3);
    expect(result.assessment).toBeNull();
  });

  it("weight_history é bloqueado", () => {
    const result = read(fixtures.weightHistoryDocument, {
      sourceCollection: "weight_history",
    });
    expect(result.kind).toBe("malformed");
    expect(result.diagnostics).toContain("nonCanonicalCollection");
  });

  it("status desconhecido nunca vira valid", () => {
    const result = read(fixtures.targetV2UnknownStatus);
    expect(result.kind).not.toBe("valid");
    expect(result.kind).toBe("malformed");
    expect(result.assessment).toBeNull();
  });

  it("opera em exatamente um documento por chamada", () => {
    // A entrada é um único documento; arrays não são aggregate de coleção.
    const result = read([fixtures.apoloCanonicalV1_32_0]);
    expect(result.kind).toBe("malformed");
  });
});

// ─── Escopo: sem seleção de current weight ─────────────────────────────────

describe("superfície pública do adapter", () => {
  it("expõe apenas leitura e autoria apresentável", async () => {
    const adapter = await import("../weight-read-adapter");
    expect(Object.keys(adapter).sort()).toEqual([
      "presentableRecorder",
      "readWeightDocument",
    ]);
  });

  it("não exporta seleção coletiva de peso atual", async () => {
    const adapter: Record<string, unknown> = await import(
      "../weight-read-adapter"
    );
    expect(adapter.pickCurrentWeight).toBeUndefined();
    expect(adapter.compareWeightRecency).toBeUndefined();
    expect(adapter.isBlockingRead).toBeUndefined();
  });

  it("não exporta serializer, mutation API nem API Firebase", async () => {
    const adapter: Record<string, unknown> = await import(
      "../weight-read-adapter"
    );
    for (const forbidden of [
      "serialize",
      "toFirestore",
      "write",
      "create",
      "update",
      "setDoc",
      "updateDoc",
      "addDoc",
      "deleteDoc",
      "writeBatch",
      "collection",
      "query",
    ]) {
      expect(adapter[forbidden]).toBeUndefined();
    }
  });

  it("não devolve função utilitária de ordenação em nenhum resultado", () => {
    const result = read(fixtures.apoloCanonicalV1_32_0);
    const { keys } = deepInspect(result);
    for (const key of keys) {
      expect(typeof (result as Record<string, unknown>)[key]).not.toBe(
        "function",
      );
    }
  });
});

// ─── Privacidade: legacyActorReference ─────────────────────────────────────

describe("sanitização de metadata legada — recognizedLegacyWeb", () => {
  const raw = parseWeightDocument({
    data: fixtures.recognizedLegacyWeb,
    dogId: FIXTURE_DOG_ID,
    entityId: "weight-legacy-web",
  });

  it("o parser preserva legacyActorReference internamente", () => {
    if (raw.kind !== "success") throw new Error("esperado success");
    expect(raw.assessment.compatibility.legacyActorReference).toBe(
      "RA-FIXTURE-001",
    );
  });

  it("o adapter não devolve legacyActorReference", () => {
    const result = read(fixtures.recognizedLegacyWeb, {
      documentId: "weight-legacy-web",
    });
    if (result.kind !== "valid") throw new Error("esperado valid");
    const compatibility: Record<string, unknown> = result.assessment
      .compatibility as unknown as Record<string, unknown>;
    expect("legacyActorReference" in compatibility).toBe(false);
    expect(compatibility.legacyActorReference).toBeUndefined();
  });

  it("o campo não aparece em nenhuma profundidade do resultado", () => {
    const result = read(fixtures.recognizedLegacyWeb, {
      documentId: "weight-legacy-web",
    });
    const { keys, strings } = deepInspect(result);
    expect(keys).not.toContain("legacyActorReference");
    expect(keys).not.toContain("measured_by");
    expect(keys).not.toContain("performed_by");
    for (const value of strings) {
      expect(value).not.toContain("RA-FIXTURE");
    }
  });

  it("recorder permanece null e os fatos são preservados", () => {
    const result = read(fixtures.recognizedLegacyWeb, {
      documentId: "weight-legacy-web",
    });
    if (result.kind !== "valid") throw new Error("esperado valid");
    expect(result.assessment.recorder).toBeNull();
    expect(presentableRecorder(result.assessment)).toBeNull();
    expect(result.assessment.weightKg).toBe(30.5);
    expect(result.assessment.measuredAt.toISOString()).toBe(
      "2026-05-10T09:00:00.000Z",
    );
    expect(result.assessment.compatibility.sourceShape).toBe(
      "recognizedLegacyWeb",
    );
    expect(result.assessment.compatibility.schemaVersionDerived).toBe(true);
    expect(result.assessment.compatibility.persistedSchemaVersion).toBeNull();
    expect(
      result.assessment.compatibility.orderingFallbackAt?.toISOString(),
    ).toBe("2026-05-10T09:05:00.000Z");
    expect(result.assessment.compatibility.derivedFields).toEqual([
      "recordType",
      "originRecordType",
      "status",
      "revision",
    ]);
    expect(result.diagnostics).toContain("legacySourceShape");
    expect(result.diagnostics).toContain("missingCanonicalRecorder");
    expect(result.diagnostics).toContain("derivedValidStatus");
  });

  it("não muta o parser result original", () => {
    const before = parseWeightDocument({
      data: fixtures.recognizedLegacyWeb,
      dogId: FIXTURE_DOG_ID,
      entityId: "weight-legacy-web",
    });
    if (before.kind !== "success") throw new Error("esperado success");
    const snapshot = before.assessment.compatibility.legacyActorReference;

    read(fixtures.recognizedLegacyWeb, { documentId: "weight-legacy-web" });

    const after = parseWeightDocument({
      data: fixtures.recognizedLegacyWeb,
      dogId: FIXTURE_DOG_ID,
      entityId: "weight-legacy-web",
    });
    if (after.kind !== "success") throw new Error("esperado success");
    expect(after.assessment.compatibility.legacyActorReference).toBe(snapshot);
    expect(before.assessment.compatibility.legacyActorReference).toBe(snapshot);
  });
});

describe("sanitização de metadata legada — recognizedLegacyDogUpdate", () => {
  it("o parser preserva legacyActorReference internamente", () => {
    const raw = parseWeightDocument({
      data: fixtures.recognizedLegacyDogUpdate,
      dogId: FIXTURE_DOG_ID,
      entityId: "weight-legacy-dog-update",
    });
    if (raw.kind !== "success") throw new Error("esperado success");
    expect(raw.assessment.compatibility.legacyActorReference).toBe(
      "RA-FIXTURE-002",
    );
  });

  it("o adapter não devolve legacyActorReference em nenhuma profundidade", () => {
    const result = read(fixtures.recognizedLegacyDogUpdate, {
      documentId: "weight-legacy-dog-update",
    });
    if (result.kind !== "valid") throw new Error("esperado valid");
    const compatibility: Record<string, unknown> = result.assessment
      .compatibility as unknown as Record<string, unknown>;
    expect("legacyActorReference" in compatibility).toBe(false);

    const { keys, strings } = deepInspect(result);
    expect(keys).not.toContain("legacyActorReference");
    for (const value of strings) {
      expect(value).not.toContain("RA-FIXTURE");
    }
  });

  it("recorder permanece null e os fatos são preservados", () => {
    const result = read(fixtures.recognizedLegacyDogUpdate, {
      documentId: "weight-legacy-dog-update",
    });
    if (result.kind !== "valid") throw new Error("esperado valid");
    expect(result.assessment.recorder).toBeNull();
    expect(result.assessment.weightKg).toBe(29.8);
    expect(result.assessment.measuredAt.toISOString()).toBe(
      "2026-04-02T08:00:00.000Z",
    );
    expect(result.assessment.compatibility.sourceShape).toBe(
      "recognizedLegacyDogUpdate",
    );
    expect(result.diagnostics).toContain("missingCanonicalRecorder");
  });

  it("não muta o parser result original", () => {
    const before = parseWeightDocument({
      data: fixtures.recognizedLegacyDogUpdate,
      dogId: FIXTURE_DOG_ID,
      entityId: "weight-legacy-dog-update",
    });
    if (before.kind !== "success") throw new Error("esperado success");
    read(fixtures.recognizedLegacyDogUpdate, {
      documentId: "weight-legacy-dog-update",
    });
    expect(before.assessment.compatibility.legacyActorReference).toBe(
      "RA-FIXTURE-002",
    );
  });
});

describe("canonical v1 — autoria factual preservada", () => {
  it("preserva o recorder canônico integralmente", () => {
    const result = read(fixtures.apoloCanonicalV1_32_0);
    if (result.kind !== "valid") throw new Error("esperado valid");
    expect(result.assessment.recorder).toEqual({
      internalRole: "operador_k9",
      name: "Operador Fixture",
      uid: "uid-operador-fixture",
    });
    expect(presentableRecorder(result.assessment)).not.toBeNull();
  });

  it("não remove nenhuma propriedade factual", () => {
    const result = read(fixtures.apoloCanonicalV1_32_0);
    if (result.kind !== "valid") throw new Error("esperado valid");
    const { assessment } = result;
    expect(assessment.entityId).toBe("weight-fixture-1");
    expect(assessment.dogId).toBe(FIXTURE_DOG_ID);
    expect(assessment.weightKg).toBe(32.0);
    expect(assessment.measuredAt.toISOString()).toBe(
      "2026-06-17T14:00:00.000Z",
    );
    expect(assessment.recordedAt).toBeNull();
    expect(assessment.context).toBe("routine");
    expect(assessment.revision).toBe(1);
    expect(assessment.schemaVersion).toBe(1);
    expect(assessment.status.state).toBe("known");
    expect(assessment.recordType.state).toBe("known");
    expect(assessment.attachmentReferences).toEqual([]);
    expect(assessment.clinicalLinks).toEqual([]);
    expect(assessment.compatibility.sourceShape).toBe("deployedV1");
    expect(assessment.compatibility.persistedSchemaVersion).toBe(1);
  });

  it("não introduz campo legado", () => {
    const result = read(fixtures.apoloCanonicalV1_32_0);
    const { keys } = deepInspect(result);
    expect(keys).not.toContain("legacyActorReference");
    expect(keys).not.toContain("measured_by");
    expect(keys).not.toContain("performed_by");
  });
});

describe("target v2 — classificação e metadata preservadas", () => {
  it("Quick valid preserva autoria e metadata target", () => {
    const result = read(fixtures.targetV2QuickValid);
    if (result.kind !== "valid") throw new Error("esperado valid");
    expect(result.assessment.recorder).not.toBeNull();
    expect(result.assessment.schemaVersion).toBe(2);
    expect(result.assessment.recordedAt?.toISOString()).toBe(
      "2026-08-06T11:01:00.000Z",
    );
    expect(result.assessment.compatibility.sourceShape).toBe("targetV2");
    expect(result.assessment.compatibility.persistedSchemaVersion).toBe(2);
    expect(result.assessment.compatibility.schemaVersionDerived).toBe(false);
    expect(result.assessment.compatibility.derivedFields).toEqual([]);
  });

  it("Official valid preserva os detalhes oficiais", () => {
    const result = read(fixtures.targetV2OfficialValid);
    if (result.kind !== "valid") throw new Error("esperado valid");
    expect(result.assessment.officialDetails).not.toBeNull();
    expect(result.assessment.officialDetails?.location.state).toBe("known");
  });

  it("invalidated é classificado corretamente e preserva autoria", () => {
    const result = read(fixtures.targetV2Invalidated);
    if (result.kind !== "invalidated") throw new Error("esperado invalidated");
    // Enum público não carrega `raw`: só estado e valor canônico.
    expect(result.assessment.status).toEqual({
      state: "known",
      value: "invalidated",
    });
    expect(result.assessment.recorder).not.toBeNull();
  });
});

// ─── Segurança: serialização recursiva ─────────────────────────────────────

describe("segurança do resultado público", () => {
  /**
   * Chaves legadas que nunca podem existir no resultado público, em nenhuma
   * profundidade.
   */
  const forbiddenKeys = [
    "legacyActorReference",
    "measured_by",
    "performed_by",
    "measuredBy",
    "performedBy",
  ];

  /**
   * Substrings que nunca podem aparecer em valor string.
   *
   * `measured_by` NÃO entra aqui: é substring do wire name legítimo
   * `measured_by_recorder` (`information_source` do target v2), que é fato
   * canônico e deve ser preservado. A proibição de `measured_by` é de chave,
   * verificada acima.
   */
  const forbiddenValueTokens = [
    "RA-FIXTURE",
    "legacyActorReference",
    "example.invalid",
  ];

  it("nenhum token proibido aparece na serialização de nenhum resultado", () => {
    const cases: readonly unknown[] = [
      fixtures.apoloCanonicalV1_32_0,
      fixtures.apoloCanonicalV1_33_3,
      fixtures.v1PrecisionPreserved,
      fixtures.recognizedLegacyWeb,
      fixtures.recognizedLegacyDogUpdate,
      fixtures.targetV2QuickValid,
      fixtures.targetV2OfficialValid,
      fixtures.targetV2Invalidated,
      fixtures.targetV2OfficialBcs1,
      fixtures.targetV2OfficialBcs5,
      fixtures.futureSchema3,
      fixtures.hybridV1V2,
      fixtures.legacyWithRecordedBy,
      fixtures.v1RecorderWithEmail,
      fixtures.schemalessWithRecordedAt,
      fixtures.weightHistoryDocument,
    ];

    for (const data of cases) {
      const result = read(data);
      const { keys, strings } = deepInspect(result);
      for (const key of forbiddenKeys) {
        expect(keys).not.toContain(key);
      }
      for (const token of forbiddenValueTokens) {
        expect(JSON.stringify(result)).not.toContain(token);
        for (const value of strings) {
          expect(value).not.toContain(token);
        }
      }
    }
  });

  it("diagnostics contêm apenas códigos técnicos string", () => {
    const result = read(fixtures.recognizedLegacyWeb);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    for (const code of result.diagnostics) {
      expect(typeof code).toBe("string");
    }
  });

  it("o resultado público é congelado", () => {
    const result = read(fixtures.apoloCanonicalV1_32_0);
    if (result.kind !== "valid") throw new Error("esperado valid");
    expect(Object.isFrozen(result.assessment)).toBe(true);
    expect(Object.isFrozen(result.assessment.compatibility)).toBe(true);
  });
});

// ─── M2: adapter não lança em inputs adversariais ──────────────────────────

describe("readWeightDocument — getters e Proxies que lançam", () => {
  const adversarialDocs: readonly [string, () => unknown][] = [
    ["root getter (weight_kg)", () =>
      fixtures.withThrowingGetter(fixtures.v1AdversarialBase(), "weight_kg")],
    ["root getter (recorded_by)", () =>
      fixtures.withThrowingGetter(fixtures.v1AdversarialBase(), "recorded_by")],
    ["timestamp getter (toDate)", () =>
      fixtures.v1WithThrowingTimestampField("toDate")],
    ["timestamp getter (seconds)", () =>
      fixtures.v1WithThrowingTimestampField("seconds")],
    ["recorder getter (email)", () =>
      fixtures.v1WithThrowingRecorderField("email")],
    ["attachment getter (health_document_id)", () =>
      fixtures.targetV2WithThrowingAttachmentField("health_document_id")],
    ["clinical link getter (entity_id)", () =>
      fixtures.targetV2WithThrowingClinicalLinkField("entity_id")],
    ["bcs getter (bcs_source)", () =>
      fixtures.targetV2WithThrowingBcsField("bcs_source")],
    ["root Proxy trap get", () =>
      fixtures.proxyThatThrowsOn(fixtures.v1AdversarialBase(), "get")],
    ["root Proxy trap getOwnPropertyDescriptor", () =>
      fixtures.proxyThatThrowsOn(
        fixtures.v1AdversarialBase(),
        "getOwnPropertyDescriptor",
      )],
    ["nested Proxy (recorder) trap get", () =>
      fixtures.targetV2WithThrowingNestedProxy()],
  ];

  it.each(adversarialDocs)(
    "%s → malformed sem lançar e sem aggregate",
    (_label, build) => {
      let result: WeightReadResult | undefined;
      expect(() => {
        result = read(build());
      }).not.toThrow();
      expect(result?.kind).toBe("malformed");
      expect(result?.assessment).toBeNull();
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(fixtures.ADVERSARIAL_THROW_MESSAGE);
    },
  );

  it("root Proxy trap has que lança nunca derruba o adapter", () => {
    const doc = fixtures.proxyThatThrowsOn(fixtures.v1AdversarialBase(), "has");
    expect(() => read(doc)).not.toThrow();
  });
});

// ─── M1: prova de privacidade do enum desconhecido com e-mail ──────────────

/**
 * Percorre um valor recursivamente coletando TODAS as chaves — inclusive
 * símbolos e propriedades não enumeráveis — via `Reflect.ownKeys` e
 * descriptors, além de todos os valores string alcançáveis.
 */
function deepInspectOwnKeys(value: unknown): {
  keys: string[];
  strings: string[];
} {
  const keys: string[] = [];
  const strings: string[] = [];
  const seen = new Set<unknown>();

  const walk = (node: unknown): void => {
    if (node === null || node === undefined) return;
    if (typeof node === "string") {
      strings.push(node);
      return;
    }
    if (typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (node instanceof Date) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    for (const key of Reflect.ownKeys(node)) {
      keys.push(typeof key === "symbol" ? key.toString() : key);
      const descriptor = Reflect.getOwnPropertyDescriptor(node, key);
      if (descriptor && "value" in descriptor) {
        walk(descriptor.value);
      }
    }
  };

  walk(value);
  return { keys, strings };
}

describe("readWeightDocument — privacidade do enum desconhecido", () => {
  const rawParse = parseWeightDocument({
    data: fixtures.targetV2UnknownEnumWithEmail,
    dogId: FIXTURE_DOG_ID,
    entityId: "weight-unknown-enum-email",
  });
  const publicResult = read(fixtures.targetV2UnknownEnumWithEmail, {
    documentId: "weight-unknown-enum-email",
  });

  it("o parser bruto preserva raw e safeRaw internamente", () => {
    if (rawParse.kind !== "success") throw new Error("esperado success");
    const equipmentState =
      rawParse.assessment.officialDetails?.equipmentState;
    expect(equipmentState?.state).toBe("unknown");
    if (equipmentState?.state !== "unknown") {
      throw new Error("esperado unknown");
    }
    expect(equipmentState.raw).toBe(fixtures.ADVERSARIAL_ENUM_EMAIL);
    const safeRaws = rawParse.diagnostics
      .filter((diagnostic) => diagnostic.code === "unknownEnum")
      .map((diagnostic) => diagnostic.safeRaw);
    expect(safeRaws).toContain(fixtures.ADVERSARIAL_ENUM_EMAIL);
  });

  it("a superfície pública não expõe raw, safeRaw, field nem o e-mail", () => {
    if (publicResult.kind !== "valid") throw new Error("esperado valid");
    const equipmentState =
      publicResult.assessment.officialDetails?.equipmentState;
    expect(equipmentState?.state).toBe("unknown");
    expect(equipmentState).toEqual({ state: "unknown" });

    const { keys, strings } = deepInspectOwnKeys(publicResult);
    expect(keys).not.toContain("raw");
    expect(keys).not.toContain("safeRaw");
    expect(keys).not.toContain("field");
    expect(keys).not.toContain("legacyActorReference");
    for (const value of strings) {
      expect(value).not.toContain(fixtures.ADVERSARIAL_ENUM_EMAIL);
    }
  });

  it("as provas de tipo público estão ativas", () => {
    // Consome as asserts estáticas; a garantia real é o tsc.
    expect(PUBLIC_TYPE_ASSERTIONS).toEqual([false, false, false]);
  });

  it("os diagnostic codes públicos contêm apenas códigos técnicos", () => {
    if (publicResult.kind !== "valid") throw new Error("esperado valid");
    expect(publicResult.diagnostics).toContain("unknownEnum");
    expect(
      publicResult.assessment.compatibility.diagnosticCodes,
    ).toContain("unknownEnum");
    for (const code of publicResult.assessment.compatibility.diagnosticCodes) {
      expect(typeof code).toBe("string");
    }
  });

  it("nenhum objeto WeightDocumentDiagnostic aparece na metadata pública", () => {
    if (publicResult.kind !== "valid") throw new Error("esperado valid");
    const compatibility = publicResult.assessment.compatibility as Record<
      string,
      unknown
    >;
    expect("diagnostics" in compatibility).toBe(false);
    expect(Array.isArray(compatibility.diagnosticCodes)).toBe(true);
  });

  it("o valor canônico measured_by_recorder permanece exposto quando factual", () => {
    if (publicResult.kind !== "valid") throw new Error("esperado valid");
    // `information_source` factual conhecido: o wire name canônico persiste.
    expect(
      publicResult.assessment.officialDetails?.informationSource,
    ).toEqual({ state: "known", value: "measured_by_recorder" });
  });
});
