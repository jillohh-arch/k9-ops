import { describe, expect, it } from "vitest";

import * as fixtures from "../../../domain/weight/__tests__/weight-document-fixtures";
import {
  analyzeWeightDocuments,
  compareValidWeightRecency,
  type WeightDocumentInput,
} from "../weight-collection-policy";
import type {
  PublicParsedWeightEnum,
  PublicWeightCompatibilityMetadata,
} from "../weight-read-adapter";

const { FIXTURE_DOG_ID } = fixtures;

// ─── Provas estáticas de tipo (falham no tsc se chaves vazarem) ─────────────

type Assert<T extends false> = T;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

const STATIC_TYPE_ASSERTIONS: readonly [
  Assert<HasKey<PublicWeightCompatibilityMetadata, "legacyActorReference">>,
  Assert<HasKey<PublicWeightCompatibilityMetadata, "diagnostics">>,
  Assert<HasKey<PublicParsedWeightEnum<"quick">, "raw">>,
] = [false, false, false];

// ─── Inspeção recursiva de privacidade ─────────────────────────────────────

function deepInspectOwnKeys(value: unknown): {
  readonly keys: readonly string[];
  readonly strings: readonly string[];
} {
  const keys: string[] = [];
  const strings: string[] = [];
  const seen = new Set<object>();

  const walk = (node: unknown): void => {
    if (node === null || node === undefined) return;
    if (typeof node === "string") {
      strings.push(node);
      return;
    }
    if (typeof node !== "object") return;

    const obj = node as object;
    if (seen.has(obj)) return;
    seen.add(obj);

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

// ─── Suíte de testes da política coletiva (WEIGHT-01D-C1-R1) ───────────────

describe("weight-collection-policy — 25 cenários reconciliados", () => {
  // 1. coleção vazia → none
  it("1. coleção vazia → none", () => {
    const analysis = analyzeWeightDocuments({
      documents: [],
    });

    expect(analysis.current).toEqual({ kind: "none" });
    expect(analysis.validRecords).toEqual([]);
    expect(analysis.invalidatedRecords).toEqual([]);
    expect(analysis.anomalies).toEqual([]);
  });

  // 2. um v1 válido → current
  it("2. um v1 válido → current", () => {
    const doc: WeightDocumentInput = {
      data: fixtures.apoloCanonicalV1_32_0,
      dogId: FIXTURE_DOG_ID,
      entityId: "doc-v1-32",
    };
    const analysis = analyzeWeightDocuments({
      documents: [doc],
    });

    expect(analysis.current.kind).toBe("current");
    if (analysis.current.kind !== "current") throw new Error("esperado current");
    expect(analysis.current.assessment).toBe(analysis.validRecords[0]);
    expect(analysis.current.assessment.entityId).toBe("doc-v1-32");
    expect(analysis.current.assessment.weightKg).toBe(32.0);
    expect(analysis.validRecords).toHaveLength(1);
    expect(analysis.invalidatedRecords).toEqual([]);
    expect(analysis.anomalies).toEqual([]);
  });

  // 3. Apolo 33.3 e 32.0 → current 33.3 (canônico)
  it("3. Apolo 33.3 e 32.0 → current 33.3 (canônico)", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.apoloCanonicalV1_33_3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-apolo-33-3",
      },
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-apolo-32-0",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("current");
    if (analysis.current.kind !== "current") throw new Error("esperado current");
    expect(analysis.current.assessment).toBe(analysis.validRecords[0]);
    expect(analysis.current.assessment.entityId).toBe("doc-apolo-33-3");
    expect(analysis.current.assessment.weightKg).toBe(33.3);
    expect(analysis.validRecords).toHaveLength(2);
    expect(analysis.validRecords[0].weightKg).toBe(33.3);
    expect(analysis.validRecords[1].weightKg).toBe(32.0);
  });

  // 4. 32.0 e 33.3 independente da ordem no array de entrada → current é sempre o canônico (33.3)
  it("4. 32.0 e 33.3 independente da ordem de entrada → current é sempre validRecords[0] (33.3)", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-32-0",
      },
      {
        data: fixtures.apoloCanonicalV1_33_3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-33-3",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("current");
    if (analysis.current.kind !== "current") throw new Error("esperado current");
    expect(analysis.current.assessment).toBe(analysis.validRecords[0]);
    expect(analysis.current.assessment.weightKg).toBe(33.3);
    expect(analysis.validRecords[0].weightKg).toBe(33.3);
    expect(analysis.validRecords[1].weightKg).toBe(32.0);
  });

  // 5. invalidated + valid → valid vira current, invalidated vai para invalidatedRecords
  it("5. invalidated + valid → valid vira current, invalidated vai para invalidatedRecords", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.targetV2Invalidated,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-invalidated",
      },
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("current");
    if (analysis.current.kind !== "current") throw new Error("esperado current");
    expect(analysis.current.assessment).toBe(analysis.validRecords[0]);
    expect(analysis.current.assessment.entityId).toBe("doc-valid");
    expect(analysis.validRecords).toHaveLength(1);
    expect(analysis.invalidatedRecords).toHaveLength(1);
    expect(analysis.invalidatedRecords[0].entityId).toBe("doc-invalidated");
    expect(analysis.anomalies).toEqual([]);
  });

  // 6. malformed em qualquer posição + valid → inconclusive
  it("6. malformed em qualquer posição + valid → inconclusive", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.hybridV1V2,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-malformed",
      },
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") {
      throw new Error("esperado inconclusive");
    }
    expect(analysis.current.blockerKinds).toContain("malformed");

    expect(analysis.anomalies).toHaveLength(1);
    expect(analysis.anomalies[0].kind).toBe("malformed");
    if (analysis.anomalies[0].kind !== "malformed") throw new Error();
    expect(analysis.anomalies[0].entityId).toBe("doc-malformed");
    expect(analysis.anomalies[0].inputIndex).toBe(0);
    expect(analysis.validRecords).toHaveLength(1);
  });

  // 7. unsupported em qualquer posição + valid → inconclusive
  it("7. unsupported em qualquer posição + valid → inconclusive", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.futureSchema3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-future",
      },
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") {
      throw new Error("esperado inconclusive");
    }
    expect(analysis.current.blockerKinds).toContain("unsupported");

    expect(analysis.anomalies).toHaveLength(1);
    expect(analysis.anomalies[0].kind).toBe("unsupported");
    expect(analysis.anomalies[0].entityId).toBe("doc-future");
    if (analysis.anomalies[0].kind !== "unsupported") throw new Error();
    expect(analysis.anomalies[0].inputIndex).toBe(0);
    expect(analysis.anomalies[0].schemaVersion).toBe(3);
    expect(analysis.validRecords).toHaveLength(1);
  });

  // 8. valid + malformed posterior → inconclusive (nova política global)
  it("8. valid + malformed posterior → inconclusive (sem exceção por posição)", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.apoloCanonicalV1_33_3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid-first",
      },
      {
        data: fixtures.hybridV1V2,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-malformed-later",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") {
      throw new Error("esperado inconclusive");
    }
    expect(analysis.current.blockerKinds).toContain("malformed");

    expect(analysis.anomalies).toHaveLength(1);
    expect(analysis.anomalies[0].entityId).toBe("doc-malformed-later");
    if (analysis.anomalies[0].kind !== "malformed") throw new Error();
    expect(analysis.anomalies[0].inputIndex).toBe(1);
    expect(analysis.validRecords).toHaveLength(1);
  });

  // 9. valid + unsupported posterior → inconclusive
  it("9. valid + unsupported posterior → inconclusive (sem exceção por posição)", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.apoloCanonicalV1_33_3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid-first",
      },
      {
        data: fixtures.futureSchema3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-unsupported-later",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") {
      throw new Error("esperado inconclusive");
    }
    expect(analysis.current.blockerKinds).toContain("unsupported");

    expect(analysis.anomalies).toHaveLength(1);
    expect(analysis.anomalies[0].kind).toBe("unsupported");
    expect(analysis.anomalies[0].entityId).toBe("doc-unsupported-later");
    if (analysis.anomalies[0].kind !== "unsupported") throw new Error();
    expect(analysis.anomalies[0].inputIndex).toBe(1);
    expect(analysis.validRecords).toHaveLength(1);
  });

  // 10. somente invalidated → none
  it("10. somente invalidated → none", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.targetV2Invalidated,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-inv-1",
      },
      {
        data: fixtures.targetV2Invalidated,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-inv-2",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current).toEqual({ kind: "none" });
    expect(analysis.validRecords).toEqual([]);
    expect(analysis.invalidatedRecords).toHaveLength(2);
    expect(analysis.anomalies).toEqual([]);
  });

  // 11. invalidated + malformed sem valid → inconclusive
  it("11. invalidated + malformed sem valid → inconclusive", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.targetV2Invalidated,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-invalidated",
      },
      {
        data: fixtures.hybridV1V2,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-malformed",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") {
      throw new Error("esperado inconclusive");
    }
    expect(analysis.current.blockerKinds).toContain("malformed");

    expect(analysis.invalidatedRecords).toHaveLength(1);
    expect(analysis.anomalies).toHaveLength(1);
    if (analysis.anomalies[0].kind !== "malformed") throw new Error();
    expect(analysis.anomalies[0].inputIndex).toBe(1);
    expect(analysis.validRecords).toEqual([]);
  });

  // 12. dois valid com measuredAt diferentes → validRecords ordenado canonicamente
  it("12. dois valid com measuredAt diferentes → validRecords ordenado canonicamente", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.apoloCanonicalV1_32_0, // 2026-06-17
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-older",
      },
      {
        data: fixtures.apoloCanonicalV1_33_3, // 2026-08-06
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-newer",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("current");
    if (analysis.current.kind !== "current") throw new Error("esperado current");
    expect(analysis.current.assessment).toBe(analysis.validRecords[0]);
    expect(analysis.validRecords).toHaveLength(2);
    expect(analysis.validRecords[0].entityId).toBe("doc-newer");
    expect(analysis.validRecords[1].entityId).toBe("doc-older");
  });

  // 13. empate measuredAt, recordedAt factual vence null
  it("13. empate measuredAt, recordedAt factual vence null", () => {
    const docWithRecordedAt = {
      ...fixtures.targetV2QuickValid,
      measured_at: fixtures.timestampLike("2026-08-06T11:00:00.000Z"),
      recorded_at: fixtures.timestampLike("2026-08-06T11:01:00.000Z"),
    };
    const docNullRecordedAt = {
      ...fixtures.apoloCanonicalV1_33_3,
      measured_at: fixtures.timestampLike("2026-08-06T11:00:00.000Z"),
    };

    const docs: readonly WeightDocumentInput[] = [
      {
        data: docNullRecordedAt,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-null-rec",
      },
      {
        data: docWithRecordedAt,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-factual-rec",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("current");
    if (analysis.current.kind !== "current") throw new Error("esperado current");
    expect(analysis.current.assessment).toBe(analysis.validRecords[0]);
    expect(analysis.validRecords[0].entityId).toBe("doc-factual-rec");
    expect(analysis.validRecords[0].recordedAt).not.toBeNull();
    expect(analysis.validRecords[1].entityId).toBe("doc-null-rec");
    expect(analysis.validRecords[1].recordedAt).toBeNull();
  });

  // 14. empate measuredAt e recordedAt, entityId desempata
  it("14. empate measuredAt e recordedAt, entityId desempata", () => {
    const base = {
      ...fixtures.apoloCanonicalV1_33_3,
      measured_at: fixtures.timestampLike("2026-08-06T10:00:00.000Z"),
    };

    const docs: readonly WeightDocumentInput[] = [
      { data: base, dogId: FIXTURE_DOG_ID, entityId: "weight-001" },
      { data: base, dogId: FIXTURE_DOG_ID, entityId: "weight-002" },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("current");
    if (analysis.current.kind !== "current") throw new Error("esperado current");
    expect(analysis.current.assessment).toBe(analysis.validRecords[0]);
    expect(analysis.validRecords[0].entityId).toBe("weight-002");
    expect(analysis.validRecords[1].entityId).toBe("weight-001");
  });

  // 15. dois legados sem recorder continuam valid
  it("15. dois legados sem recorder continuam valid", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.recognizedLegacyWeb,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-legacy-web",
      },
      {
        data: fixtures.recognizedLegacyDogUpdate,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-legacy-dog-update",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("current");
    if (analysis.current.kind !== "current") throw new Error("esperado current");
    expect(analysis.current.assessment).toBe(analysis.validRecords[0]);
    expect(analysis.validRecords).toHaveLength(2);
    expect(analysis.validRecords[0].recorder).toBeNull();
    expect(analysis.validRecords[1].recorder).toBeNull();
  });

  // 16. recorder factual preservado
  it("16. recorder factual preservado", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-v1",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("current");
    if (analysis.current.kind !== "current") throw new Error("esperado current");
    expect(analysis.current.assessment).toBe(analysis.validRecords[0]);
    expect(analysis.validRecords[0].recorder).toEqual({
      internalRole: "operador_k9",
      name: "Operador Fixture",
      uid: "uid-operador-fixture",
    });
  });

  // 17. malformed nunca aparece em validRecords
  it("17. malformed nunca aparece em validRecords", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.hybridV1V2,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-malformed",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.validRecords).toEqual([]);
    expect(analysis.anomalies).toHaveLength(1);
  });

  // 18. unsupported nunca aparece em validRecords
  it("18. unsupported nunca aparece em validRecords", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.futureSchema3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-future",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.validRecords).toEqual([]);
    expect(analysis.anomalies).toHaveLength(1);
  });

  // 19. invalidated nunca aparece em validRecords
  it("19. invalidated nunca aparece em validRecords", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.targetV2Invalidated,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-invalidated",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.validRecords).toEqual([]);
    expect(analysis.invalidatedRecords).toHaveLength(1);
  });

  // 20. input array permanece inalterado
  it("20. input array permanece inalterado", () => {
    const originalDocs: readonly WeightDocumentInput[] = Object.freeze([
      Object.freeze({
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-1",
      }),
      Object.freeze({
        data: fixtures.apoloCanonicalV1_33_3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-2",
      }),
    ]);

    const snapshot = [...originalDocs];
    analyzeWeightDocuments({
      documents: originalDocs,
    });

    expect(originalDocs).toEqual(snapshot);
  });

  // 21. nenhuma metadata interna aparece na análise
  it("21. nenhuma metadata interna aparece na análise", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.recognizedLegacyWeb,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-legacy",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    const { keys, strings } = deepInspectOwnKeys(analysis);
    expect(keys).not.toContain("legacyActorReference");
    expect(keys).not.toContain("safeRaw");
    expect(keys).not.toContain("raw");
    expect(keys).not.toContain("measured_by");
    expect(keys).not.toContain("performed_by");

    for (const str of strings) {
      expect(str).not.toContain("RA-FIXTURE");
    }
  });

  // 22. diagnostic codes preservados nos assessments
  it("22. diagnostic codes preservados nos assessments", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.recognizedLegacyWeb,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-legacy",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("current");
    if (analysis.current.kind !== "current") throw new Error("esperado current");
    expect(analysis.current.assessment).toBe(analysis.validRecords[0]);
    expect(analysis.current.assessment.compatibility.diagnosticCodes).toContain(
      "legacySourceShape",
    );
    expect(analysis.current.assessment.compatibility.diagnosticCodes).toContain(
      "missingCanonicalRecorder",
    );
  });

  // 23. unsupported preserva somente schemaVersion seguro em anomalia
  it("23. unsupported preserva somente schemaVersion seguro em anomalia", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.futureSchema3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-future-3",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") {
      throw new Error("esperado inconclusive");
    }
    expect(analysis.current.blockerKinds).toContain("unsupported");

    expect(analysis.anomalies[0]).toEqual({
      diagnosticCodes: ["unsupportedSchemaVersion"],
      entityId: "doc-future-3",
      inputIndex: 0,
      kind: "unsupported",
      schemaVersion: 3,
    });
  });

  // 24. sourceCollection não canônica vira malformed anomaly + inconclusive
  it("24. sourceCollection não canônica vira malformed anomaly + inconclusive", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.weightHistoryDocument,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-history",
        sourceCollection: "weight_history",
      },
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") {
      throw new Error("esperado inconclusive");
    }
    expect(analysis.current.blockerKinds).toContain("malformed");
    expect(analysis.anomalies[0].entityId).toBe("doc-history");
    if (analysis.anomalies[0].kind !== "malformed") throw new Error();
    expect(analysis.anomalies[0].inputIndex).toBe(0);
    expect(analysis.anomalies[0].diagnosticCodes).toContain(
      "nonCanonicalCollection",
    );
  });

  // 25. future schema em qualquer posição torna current inconclusive
  it("25. future schema em qualquer posição torna current inconclusive", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.apoloCanonicalV1_33_3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid",
      },
      {
        data: fixtures.futureSchema3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-future",
      },
    ];
    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") {
      throw new Error("esperado inconclusive");
    }
    expect(analysis.current.blockerKinds).toContain("unsupported");
    expect(analysis.anomalies).toHaveLength(1);
    expect(analysis.anomalies[0].kind).toBe("unsupported");
    expect(analysis.anomalies[0].entityId).toBe("doc-future");
    if (analysis.anomalies[0].kind !== "unsupported") throw new Error();
    expect(analysis.anomalies[0].inputIndex).toBe(1);
  });
});

// ─── Testes de Blockers Compostos (Seção 12) ──────────────────────────────

describe("weight-collection-policy — blockers compostos (Seção 12)", () => {
  it("1. malformed → unsupported → valid → inconclusive (blockerKinds inclui malformed + unsupported)", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.hybridV1V2,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-malformed",
      },
      {
        data: fixtures.futureSchema3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-unsupported",
      },
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid",
      },
    ];
    const analysis = analyzeWeightDocuments({ documents: docs });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") throw new Error();
    expect(analysis.current.blockerKinds).toEqual(["malformed", "unsupported"]);
    expect(analysis.anomalies).toHaveLength(2);
    expect(analysis.anomalies[0].kind).toBe("malformed");
    if (analysis.anomalies[0].kind !== "malformed") throw new Error();
    expect(analysis.anomalies[0].inputIndex).toBe(0);
    expect(analysis.anomalies[1].kind).toBe("unsupported");
    if (analysis.anomalies[1].kind !== "unsupported") throw new Error();
    expect(analysis.anomalies[1].inputIndex).toBe(1);
    expect(analysis.validRecords).toHaveLength(1);
  });

  it("2. unsupported → malformed → valid → mesmo resultado sem depender da ordem", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.futureSchema3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-unsupported",
      },
      {
        data: fixtures.hybridV1V2,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-malformed",
      },
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid",
      },
    ];
    const analysis = analyzeWeightDocuments({ documents: docs });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") throw new Error();
    expect(analysis.current.blockerKinds).toEqual(["malformed", "unsupported"]);
    expect(analysis.anomalies).toHaveLength(2);
    expect(analysis.validRecords).toHaveLength(1);
  });

  it("3. invalidated → malformed → valid → inconclusive", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.targetV2Invalidated,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-invalidated",
      },
      {
        data: fixtures.hybridV1V2,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-malformed",
      },
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid",
      },
    ];
    const analysis = analyzeWeightDocuments({ documents: docs });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") throw new Error();
    expect(analysis.current.blockerKinds).toEqual(["malformed"]);
    expect(analysis.invalidatedRecords).toHaveLength(1);
    expect(analysis.validRecords).toHaveLength(1);
  });

  it("4. malformed → invalidated → valid → inconclusive", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.hybridV1V2,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-malformed",
      },
      {
        data: fixtures.targetV2Invalidated,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-invalidated",
      },
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid",
      },
    ];
    const analysis = analyzeWeightDocuments({ documents: docs });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") throw new Error();
    expect(analysis.current.blockerKinds).toEqual(["malformed"]);
    expect(analysis.invalidatedRecords).toHaveLength(1);
    expect(analysis.validRecords).toHaveLength(1);
  });

  it("5. valid → malformed → inconclusive (regra antiga supersedida)", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid",
      },
      {
        data: fixtures.hybridV1V2,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-malformed",
      },
    ];
    const analysis = analyzeWeightDocuments({ documents: docs });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") throw new Error();
    expect(analysis.current.blockerKinds).toEqual(["malformed"]);
  });

  it("6. valid → unsupported → inconclusive (regra antiga supersedida)", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-valid",
      },
      {
        data: fixtures.futureSchema3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-unsupported",
      },
    ];
    const analysis = analyzeWeightDocuments({ documents: docs });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") throw new Error();
    expect(analysis.current.blockerKinds).toEqual(["unsupported"]);
  });
});

// ─── Testes de Duplicidade (Seção 13) ──────────────────────────────────────

describe("weight-collection-policy — duplicidade de entityId (Seção 13)", () => {
  it("mesmo documento repetido → duplicate anomaly, current inconclusive", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-same-id",
      },
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-same-id",
      },
    ];
    const analysis = analyzeWeightDocuments({ documents: docs });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") throw new Error();
    expect(analysis.current.blockerKinds).toContain("duplicate_entity_id");

    expect(analysis.anomalies).toHaveLength(1);
    expect(analysis.anomalies[0]).toEqual({
      entityId: "doc-same-id",
      inputIndices: [0, 1],
      kind: "duplicate_entity_id",
    });
  });

  it("mesmo entityId com conteúdo divergente → duplicate anomaly, current inconclusive", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-shared-id",
      },
      {
        data: fixtures.apoloCanonicalV1_33_3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-shared-id",
      },
    ];
    const analysis = analyzeWeightDocuments({ documents: docs });

    expect(analysis.current.kind).toBe("inconclusive");
    if (analysis.current.kind !== "inconclusive") throw new Error();
    expect(analysis.current.blockerKinds).toContain("duplicate_entity_id");

    expect(analysis.anomalies).toHaveLength(1);
    expect(analysis.anomalies[0]).toEqual({
      entityId: "doc-shared-id",
      inputIndices: [0, 1],
      kind: "duplicate_entity_id",
    });
  });

  it("IDs distintos não geram anomalia de duplicidade", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.apoloCanonicalV1_32_0,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-unique-1",
      },
      {
        data: fixtures.apoloCanonicalV1_33_3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-unique-2",
      },
    ];
    const analysis = analyzeWeightDocuments({ documents: docs });

    expect(analysis.current.kind).toBe("current");
    expect(analysis.anomalies).toEqual([]);
  });
});

// ─── Testes Diretos do Comparador Canônico (Seção 14) ──────────────────────

describe("compareValidWeightRecency — matriz completa (Seção 14)", () => {
  it("measuredAt diferentes", () => {
    const a1 = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_32_0, // measuredAt 2026-06-17
          dogId: FIXTURE_DOG_ID,
          entityId: "doc-32",
        },
      ],
    });
    const a2 = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_33_3, // measuredAt 2026-08-06
          dogId: FIXTURE_DOG_ID,
          entityId: "doc-33",
        },
      ],
    });

    const record32 = a1.validRecords[0];
    const record33 = a2.validRecords[0];

    expect(compareValidWeightRecency(record33, record32)).toBeLessThan(0);
    expect(compareValidWeightRecency(record32, record33)).toBeGreaterThan(0);
  });

  it("measuredAt igual + recordedAt factual x null", () => {
    const legacyWebAnalysis = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.recognizedLegacyWeb,
          dogId: FIXTURE_DOG_ID,
          entityId: "doc-legacy",
        },
      ],
    });
    const targetV2Analysis = analyzeWeightDocuments({
      documents: [
        {
          data: {
            ...fixtures.targetV2QuickValid,
            measured_at: fixtures.timestampLike("2026-05-10T09:00:00.000Z"),
          },
          dogId: FIXTURE_DOG_ID,
          entityId: "doc-target",
        },
      ],
    });

    const legacyRecord = legacyWebAnalysis.validRecords[0];
    const targetRecord = targetV2Analysis.validRecords[0];

    expect(compareValidWeightRecency(targetRecord, legacyRecord)).toBeLessThan(0);
    expect(compareValidWeightRecency(legacyRecord, targetRecord)).toBeGreaterThan(0);
  });

  it("recordedAt factual diferentes", () => {
    const docEarly = analyzeWeightDocuments({
      documents: [
        {
          data: {
            ...fixtures.targetV2QuickValid,
            measured_at: fixtures.timestampLike("2026-08-06T10:00:00.000Z"),
            recorded_at: fixtures.timestampLike("2026-08-06T10:05:00.000Z"),
          },
          dogId: FIXTURE_DOG_ID,
          entityId: "doc-early",
        },
      ],
    }).validRecords[0];

    const docLate = analyzeWeightDocuments({
      documents: [
        {
          data: {
            ...fixtures.targetV2QuickValid,
            measured_at: fixtures.timestampLike("2026-08-06T10:00:00.000Z"),
            recorded_at: fixtures.timestampLike("2026-08-06T10:15:00.000Z"),
          },
          dogId: FIXTURE_DOG_ID,
          entityId: "doc-late",
        },
      ],
    }).validRecords[0];

    expect(compareValidWeightRecency(docLate, docEarly)).toBeLessThan(0);
    expect(compareValidWeightRecency(docEarly, docLate)).toBeGreaterThan(0);
  });

  it("ambos recordedAt null", () => {
    const docA = analyzeWeightDocuments({
      documents: [
        {
          data: {
            ...fixtures.apoloCanonicalV1_32_0,
            measured_at: fixtures.timestampLike("2026-08-06T10:00:00.000Z"),
          },
          dogId: FIXTURE_DOG_ID,
          entityId: "doc-b",
        },
      ],
    }).validRecords[0];

    const docB = analyzeWeightDocuments({
      documents: [
        {
          data: {
            ...fixtures.apoloCanonicalV1_32_0,
            measured_at: fixtures.timestampLike("2026-08-06T10:00:00.000Z"),
          },
          dogId: FIXTURE_DOG_ID,
          entityId: "doc-a",
        },
      ],
    }).validRecords[0];

    // doc-b > doc-a em UTF-16 code units, logo em DESC doc-b vem antes (retorna < 0)
    expect(compareValidWeightRecency(docA, docB)).toBeLessThan(0);
    expect(compareValidWeightRecency(docB, docA)).toBeGreaterThan(0);
  });

  it("entityId casing ('a' vs 'A')", () => {
    const docLower = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_32_0,
          dogId: FIXTURE_DOG_ID,
          entityId: "a",
        },
      ],
    }).validRecords[0];

    const docUpper = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_32_0,
          dogId: FIXTURE_DOG_ID,
          entityId: "A",
        },
      ],
    }).validRecords[0];

    // 'a' (97) > 'A' (65). Em DESC: 'a' vem antes de 'A' (retorna < 0)
    expect(compareValidWeightRecency(docLower, docUpper)).toBeLessThan(0);
    expect(compareValidWeightRecency(docUpper, docLower)).toBeGreaterThan(0);
  });

  it("entityId numeric string ('10' vs '2')", () => {
    const doc10 = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_32_0,
          dogId: FIXTURE_DOG_ID,
          entityId: "10",
        },
      ],
    }).validRecords[0];

    const doc2 = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_32_0,
          dogId: FIXTURE_DOG_ID,
          entityId: "2",
        },
      ],
    }).validRecords[0];

    // '2' (50) > '1' (49). Em UTF-16 lexicográfico, "2" > "10". Em DESC: "2" vem antes de "10"
    expect(compareValidWeightRecency(doc2, doc10)).toBeLessThan(0);
    expect(compareValidWeightRecency(doc10, doc2)).toBeGreaterThan(0);
  });

  it("prefix ('abc' vs 'abcd')", () => {
    const docShort = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_32_0,
          dogId: FIXTURE_DOG_ID,
          entityId: "abc",
        },
      ],
    }).validRecords[0];

    const docLong = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_32_0,
          dogId: FIXTURE_DOG_ID,
          entityId: "abcd",
        },
      ],
    }).validRecords[0];

    // "abcd" > "abc". Em DESC: "abcd" vem antes de "abc"
    expect(compareValidWeightRecency(docLong, docShort)).toBeLessThan(0);
    expect(compareValidWeightRecency(docShort, docLong)).toBeGreaterThan(0);
  });

  it("UTF-16 supplementary case (U+E000 vs U+10000) prova ordem de UTF-16 code units", () => {
    const docPrivate = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_32_0,
          dogId: FIXTURE_DOG_ID,
          entityId: "\uE000", // code unit 0xE000 (57344)
        },
      ],
    }).validRecords[0];

    const docSupplementary = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_32_0,
          dogId: FIXTURE_DOG_ID,
          entityId: "\uD800\uDC00", // U+10000 em UTF-16 tem high surrogate 0xD800 (55296)
        },
      ],
    }).validRecords[0];

    // Em UTF-16 code unit order: 0xE000 (57344) > 0xD800 (55296).
    // Nota: Em Unicode scalar order U+10000 (65536) > U+E000 (57344).
    // Em DESC por UTF-16: "\uE000" vem antes de "\uD800\uDC00" (retorna < 0).
    expect(compareValidWeightRecency(docPrivate, docSupplementary)).toBeLessThan(0);
    expect(compareValidWeightRecency(docSupplementary, docPrivate)).toBeGreaterThan(0);
  });

  it("igualdade de assessments distintos com os mesmos campos relevantes", () => {
    const doc1 = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_32_0,
          dogId: FIXTURE_DOG_ID,
          entityId: "same-id",
        },
      ],
    }).validRecords[0];

    const doc2 = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_32_0,
          dogId: FIXTURE_DOG_ID,
          entityId: "same-id",
        },
      ],
    }).validRecords[0];

    expect(compareValidWeightRecency(doc1, doc2)).toBe(0);
  });
});

// ─── Auditoria Estrita de Privacidade em Todas as Saídas ────────────────────

describe("privacidade e segurança da análise coletiva", () => {
  const forbiddenKeys = [
    "legacyActorReference",
    "measured_by",
    "performed_by",
    "measuredBy",
    "performedBy",
    "raw",
    "safeRaw",
    "document",
    "data",
  ];

  const forbiddenTokens = [
    "RA-FIXTURE",
    "legacyActorReference",
    "example.invalid",
  ];

  it("garante ausência de campos e tokens legados em coleção mista complexa", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.targetV2UnknownEnumWithEmail,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-enum-email",
      },
      {
        data: fixtures.recognizedLegacyWeb,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-legacy-web",
      },
      {
        data: fixtures.recognizedLegacyDogUpdate,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-legacy-dog-update",
      },
      {
        data: fixtures.targetV2Invalidated,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-invalidated",
      },
      {
        data: fixtures.futureSchema3,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-future",
      },
      {
        data: fixtures.hybridV1V2,
        dogId: FIXTURE_DOG_ID,
        entityId: "doc-malformed",
      },
    ];

    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    const { keys, strings } = deepInspectOwnKeys(analysis);

    for (const forbiddenKey of forbiddenKeys) {
      expect(keys).not.toContain(forbiddenKey);
    }

    const json = JSON.stringify(analysis);
    for (const token of forbiddenTokens) {
      expect(json).not.toContain(token);
      for (const str of strings) {
        expect(str).not.toContain(token);
      }
    }
  });

  it("garante ausência de vazamento de privacidade em anomalia de duplicidade", () => {
    const docs: readonly WeightDocumentInput[] = [
      {
        data: fixtures.targetV2UnknownEnumWithEmail,
        dogId: FIXTURE_DOG_ID,
        entityId: "dup-1",
      },
      {
        data: fixtures.targetV2UnknownEnumWithEmail,
        dogId: FIXTURE_DOG_ID,
        entityId: "dup-1",
      },
    ];

    const analysis = analyzeWeightDocuments({
      documents: docs,
    });

    const { keys, strings } = deepInspectOwnKeys(analysis);

    for (const forbiddenKey of forbiddenKeys) {
      expect(keys).not.toContain(forbiddenKey);
    }

    const json = JSON.stringify(analysis);
    for (const token of forbiddenTokens) {
      expect(json).not.toContain(token);
      for (const str of strings) {
        expect(str).not.toContain(token);
      }
    }
  });

  it("provas estáticas de tipo foram consumidas sem erro em runtime", () => {
    expect(STATIC_TYPE_ASSERTIONS).toEqual([false, false, false]);
  });

  it("o resultado da análise é congelado (frozen)", () => {
    const analysis = analyzeWeightDocuments({
      documents: [
        {
          data: fixtures.apoloCanonicalV1_32_0,
          dogId: FIXTURE_DOG_ID,
          entityId: "doc-1",
        },
      ],
    });

    expect(Object.isFrozen(analysis)).toBe(true);
    expect(Object.isFrozen(analysis.validRecords)).toBe(true);
    expect(Object.isFrozen(analysis.invalidatedRecords)).toBe(true);
    expect(Object.isFrozen(analysis.anomalies)).toBe(true);
  });
});
