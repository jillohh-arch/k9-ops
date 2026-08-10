/**
 * WEIGHT-01D-C2A — integração do reader R1 (Health) com a política canônica.
 *
 * Os testes exercitam `resolveDogWeightReadModel` com documentos brutos, sem
 * fabricar `WeightCollectionAnalysis`: a classificação vem sempre do parser e
 * da política reais. Provam que o reader entrega a coleção completa e não
 * decide peso atual por conta própria.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(() => () => undefined),
  orderBy: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@/lib/firebase/client", () => ({ db: {} }));

import { resolveDogWeightReadModel } from "../../data/weight/weight-read-model";
import * as fixtures from "../../domain/weight/__tests__/weight-document-fixtures";

const { FIXTURE_DOG_ID } = fixtures;

type SnapshotRecord = Record<string, unknown> & {
  _data?: unknown;
  _dogId?: string;
  _id: string;
  _path?: string;
};

/** Reproduz o registro achatado publicado por `subscribeManyCollections`. */
function snapshotRecord(id: string, data: object): SnapshotRecord {
  return {
    ...data,
    _data: data,
    _dogId: FIXTURE_DOG_ID,
    _id: id,
    _path: `dogs/${FIXTURE_DOG_ID}/weight_records/${id}`,
  };
}

function readModel(records: readonly SnapshotRecord[]) {
  return resolveDogWeightReadModel(FIXTURE_DOG_ID, records);
}

const HOOK_SOURCE = readFileSync(
  path.resolve(__dirname, "../use-health-data.ts"),
  "utf8",
);

const READ_MODEL_SOURCE = readFileSync(
  path.resolve(__dirname, "../../data/weight/weight-read-model.ts"),
  "utf8",
);

/**
 * Superfície completa de leitura do R1: o hook que assina a coleção mais o
 * resolver compartilhado (WEIGHT-01E-R2B extraiu o resolver para
 * `data/weight/weight-read-model.ts`). As garantias de fonte valem para as duas
 * unidades — um alias proibido em qualquer uma delas reintroduz o problema.
 */
const READER_SOURCE = `${HOOK_SOURCE}\n${READ_MODEL_SOURCE}`;

/**
 * Fonte do reader sem comentários.
 *
 * Comentários citam nomes de wire legados ao documentar a decisão do gate; as
 * asserções de alias precisam olhar apenas o código executável.
 */
const READER_CODE = READER_SOURCE.replaceAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

// ─── 1–2. Recência não depende da ordem da fonte ───────────────────────────

describe("peso atual por recência canônica", () => {
  it("elege 33.3 sobre 32.0 (ordem crescente na fonte)", () => {
    const result = readModel([
      snapshotRecord("w-32", fixtures.apoloCanonicalV1_32_0),
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
    ]);

    expect(result.weightCurrentState).toBe("current");
    expect(result.latestWeightKg).toBe(33.3);
    expect(result.latestWeightAt).toEqual(new Date("2026-08-06T10:00:00.000Z"));
  });

  it("elege 33.3 também com a fonte invertida", () => {
    const result = readModel([
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
      snapshotRecord("w-32", fixtures.apoloCanonicalV1_32_0),
    ]);

    expect(result.weightCurrentState).toBe("current");
    expect(result.latestWeightKg).toBe(33.3);
  });

  it("mantém a invariante current === validRecords[0]", () => {
    const result = readModel([
      snapshotRecord("w-32", fixtures.apoloCanonicalV1_32_0),
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
    ]);

    expect(result.analysis.current.kind).toBe("current");
    if (result.analysis.current.kind !== "current") return;
    expect(result.analysis.current.assessment).toBe(
      result.analysis.validRecords[0],
    );
  });
});

// ─── 3–5. Shapes legados ───────────────────────────────────────────────────

describe("shapes legados reconhecidos", () => {
  it("aceita legacy Web como válido", () => {
    const result = readModel([
      snapshotRecord("w-web", fixtures.recognizedLegacyWeb),
    ]);

    expect(result.weightCurrentState).toBe("current");
    expect(result.latestWeightKg).toBe(30.5);
    expect(result.analysis.validRecords).toHaveLength(1);
  });

  it("aceita legacy dog-update como válido", () => {
    const result = readModel([
      snapshotRecord("w-dogupdate", fixtures.recognizedLegacyDogUpdate),
    ]);

    expect(result.weightCurrentState).toBe("current");
    expect(result.latestWeightKg).toBe(29.8);
  });

  it("não quebra com autoria legada ausente e não inventa recorder", () => {
    const result = readModel([
      snapshotRecord("w-web", fixtures.recognizedLegacyWeb),
    ]);

    expect(result.analysis.validRecords[0].recorder).toBeNull();
  });
});

// ─── 6. Invalidated não bloqueia e não é current ───────────────────────────

describe("registros invalidados", () => {
  it("mantém o válido como current e separa o invalidado", () => {
    const result = readModel([
      snapshotRecord("w-inv", fixtures.targetV2Invalidated),
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
    ]);

    expect(result.weightCurrentState).toBe("current");
    expect(result.latestWeightKg).toBe(33.3);
    expect(result.analysis.invalidatedRecords).toHaveLength(1);
    expect(result.analysis.validRecords).toHaveLength(1);
  });

  it("não alimenta latestWeight quando só há invalidados", () => {
    const result = readModel([
      snapshotRecord("w-inv", fixtures.targetV2Invalidated),
    ]);

    expect(result.weightCurrentState).toBe("none");
    expect(result.latestWeightKg).toBeNull();
    expect(result.latestWeightAt).toBeNull();
    expect(result.analysis.invalidatedRecords).toHaveLength(1);
  });
});

// ─── 7–10, 13. Bloqueio global sem rollback ────────────────────────────────

describe("bloqueio global de integridade", () => {
  it("malformed antes de válido produz inconclusive sem rollback", () => {
    const result = readModel([
      snapshotRecord("w-bad", fixtures.malformedWeightV1),
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
    ]);

    expect(result.weightCurrentState).toBe("inconclusive");
    expect(result.latestWeightKg).toBeNull();
    expect(result.latestWeightAt).toBeNull();
  });

  it("malformed depois de válido também produz inconclusive", () => {
    const result = readModel([
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
      snapshotRecord("w-bad", fixtures.malformedWeightV1),
    ]);

    expect(result.weightCurrentState).toBe("inconclusive");
    expect(result.latestWeightKg).toBeNull();
  });

  it("unsupported com válido produz inconclusive", () => {
    const result = readModel([
      snapshotRecord("w-future", fixtures.futureSchema3),
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
    ]);

    expect(result.weightCurrentState).toBe("inconclusive");
    expect(result.latestWeightKg).toBeNull();
  });

  it("schema futuro isolado produz inconclusive", () => {
    const result = readModel([
      snapshotRecord("w-future", fixtures.futureSchema3),
    ]);

    expect(result.weightCurrentState).toBe("inconclusive");
    expect(result.analysis.validRecords).toHaveLength(0);
  });

  it("entityId duplicado produz inconclusive sem dedupe prévio", () => {
    const result = readModel([
      snapshotRecord("w-dup", fixtures.apoloCanonicalV1_33_3),
      snapshotRecord("w-dup", fixtures.apoloCanonicalV1_32_0),
    ]);

    expect(result.weightCurrentState).toBe("inconclusive");
    expect(result.latestWeightKg).toBeNull();
    expect(
      result.analysis.anomalies.some(
        (anomaly) => anomaly.kind === "duplicate_entity_id",
      ),
    ).toBe(true);
  });
});

// ─── 11–12. Ausência real ──────────────────────────────────────────────────

describe("ausência de pesagem", () => {
  it("coleção vazia produz none", () => {
    const result = readModel([]);

    expect(result.weightCurrentState).toBe("none");
    expect(result.latestWeightKg).toBeNull();
    expect(result.latestWeightAt).toBeNull();
    expect(result.analysis.anomalies).toHaveLength(0);
  });
});

// ─── 14–16. Nada é pré-filtrado antes da política ──────────────────────────

describe("handoff cru para a política", () => {
  it("documento sem measured_at chega à política e é classificado lá", () => {
    const withoutMeasuredAt = Object.fromEntries(
      Object.entries(fixtures.apoloCanonicalV1_33_3).filter(
        ([key]) => key !== "measured_at",
      ),
    );
    const result = readModel([
      snapshotRecord("w-no-measured", withoutMeasuredAt),
    ]);

    expect(result.weightCurrentState).toBe("inconclusive");
    expect(
      result.analysis.anomalies.some((anomaly) => anomaly.kind === "malformed"),
    ).toBe(true);
  });

  it("schema malformado chega à política como anomalia, não é descartado", () => {
    const result = readModel([
      snapshotRecord("w-schema", fixtures.schemaVersionString),
    ]);

    expect(result.analysis.anomalies).toHaveLength(1);
    expect(result.analysis.anomalies[0].kind).toBe("malformed");
  });

  it("soft-delete legado (deleted:true) não é filtrado pelo reader", () => {
    // Documenta apenas que o reader entrega o documento à política. Não se
    // afirma que `deleted` vira `invalidated`: o reader não cria essa ponte.
    const legacySoftDeleted = {
      ...fixtures.apoloCanonicalV1_33_3,
      archived_at: fixtures.timestampLike("2026-08-07T10:00:00.000Z"),
      deleted: true,
      deleted_at: fixtures.timestampLike("2026-08-07T10:00:00.000Z"),
    };
    const result = readModel([snapshotRecord("w-soft", legacySoftDeleted)]);

    const classified =
      result.analysis.validRecords.length +
      result.analysis.invalidatedRecords.length +
      result.analysis.anomalies.length;
    expect(classified).toBe(1);
    expect(result.analysis.invalidatedRecords).toHaveLength(0);
  });

  it("preserva a contagem da coleção completa entregue à política", () => {
    const result = readModel([
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
      snapshotRecord("w-32", fixtures.apoloCanonicalV1_32_0),
      snapshotRecord("w-inv", fixtures.targetV2Invalidated),
    ]);

    expect(
      result.analysis.validRecords.length +
        result.analysis.invalidatedRecords.length,
    ).toBe(3);
  });
});

// ─── 17–19. Fontes e fallbacks proibidos ───────────────────────────────────

describe("superfície de leitura do reader", () => {
  it("não referencia weight_history", () => {
    expect(READER_SOURCE).not.toContain("weight_history");
  });

  it("não usa projeção denormalizada de peso como fallback", () => {
    expect(READER_SOURCE).not.toContain("_last_weight_kg");
    expect(READER_SOURCE).not.toContain("_last_weight_at");
  });

  it("não interpreta aliases de peso vindos do documento bruto", () => {
    // As formas de wire não existem mais no código do reader. Comentários
    // podem citá-las ao documentar a decisão, então a checagem olha só o código.
    // `sourceCollection: "weight_records"` é o nome da coleção, não um alias de
    // campo, então a checagem de `weight_kg` continua válida.
    expect(READER_CODE).not.toContain("weight_kg");
    expect(READER_CODE).not.toContain("measured_at");
    // `weightKg`/`measuredAt` só podem aparecer como acesso a campo do
    // assessment canônico, nunca lidos de um registro bruto. O prefixo exigido
    // é estrito de propósito: alternativas genéricas como `latest` aceitariam
    // `latest.weightKg`, que é exatamente a leitura crua paralela proibida.
    for (const alias of ["weightKg", "measuredAt"] as const) {
      const occurrences = [
        ...READER_CODE.matchAll(new RegExp(`(.{0,12})\\b${alias}\\b`, "g")),
      ];
      expect(occurrences.length).toBeGreaterThan(0);
      for (const occurrence of occurrences) {
        expect(occurrence[1]).toContain("assessment.");
      }
    }
    // `peso` isolado seria alias de valor de pesagem. `peso_mínimo`/
    // `peso_máximo` pertencem à faixa ideal do perfil e continuam válidos.
    expect(READER_CODE).not.toMatch(/record\s*\.\s*peso\b/);
    expect(READER_CODE).not.toMatch(/\.\s*weight\b\s*\?\?/);
  });

  it("assina apenas a subcoleção canônica por cão", () => {
    expect(HOOK_SOURCE).toContain("weight_records");
    expect(READER_SOURCE).not.toContain("collectionGroup");
  });

  it("não pré-filtra a coleção de pesagem por soft-delete", () => {
    expect(HOOK_SOURCE).toContain(
      "const weights = weightRecordsState.records;",
    );
  });

  it("delega a seleção de current ao resolver compartilhado", () => {
    // O hook não pode reimplementar a decisão: nem sort local, nem `[0]`.
    expect(HOOK_SOURCE).toContain("resolveDogWeightReadModel");
    expect(READ_MODEL_SOURCE).toContain("analyzeWeightDocuments");
  });
});

// ─── 20–22. Recência exposta sem fallback stale ────────────────────────────

describe("recência exposta ao consumidor", () => {
  it("current expõe measuredAt factual", () => {
    const result = readModel([
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
    ]);

    expect(result.latestWeightAt).toEqual(new Date("2026-08-06T10:00:00.000Z"));
  });

  it("inconclusive não expõe a data do válido anterior", () => {
    const valid = readModel([
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
    ]);
    const blocked = readModel([
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
      snapshotRecord("w-bad", fixtures.malformedWeightV1),
    ]);

    expect(valid.latestWeightAt).not.toBeNull();
    expect(blocked.latestWeightAt).toBeNull();
    expect(blocked.latestWeightKg).toBeNull();
  });

  it("invalidado não expõe data nem valor", () => {
    const result = readModel([
      snapshotRecord("w-inv", fixtures.targetV2Invalidated),
    ]);

    expect(result.latestWeightAt).toBeNull();
    expect(result.latestWeightKg).toBeNull();
  });
});

// ─── 23–25. Imutabilidade, autoria e sigilo de diagnóstico ─────────────────

describe("garantias estruturais", () => {
  it("não muta os documentos brutos recebidos", () => {
    const records = [
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
      snapshotRecord("w-bad", fixtures.malformedWeightV1),
    ];
    const before = JSON.stringify(records);

    readModel(records);

    expect(JSON.stringify(records)).toBe(before);
  });

  it("preserva autoria factual do documento canônico", () => {
    const result = readModel([
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
    ]);

    expect(result.analysis.validRecords[0].recorder).toEqual({
      internalRole: fixtures.RECORDER_FIXTURE.internal_role,
      name: fixtures.RECORDER_FIXTURE.name,
      uid: fixtures.RECORDER_FIXTURE.uid,
    });
  });

  it("não expõe raw de enum nem metadata legada de ator", () => {
    const result = readModel([
      snapshotRecord("w-web", fixtures.recognizedLegacyWeb),
    ]);
    const assessment = result.analysis.validRecords[0];

    expect(Object.keys(assessment.status)).not.toContain("raw");
    expect(Object.keys(assessment.recordType)).not.toContain("raw");
    expect(Object.keys(assessment.compatibility)).not.toContain(
      "legacyActorReference",
    );
    expect(Object.keys(assessment.compatibility)).not.toContain("diagnostics");
  });

  it("expõe anomalias apenas por diagnostic code público", () => {
    const result = readModel([
      snapshotRecord("w-bad", fixtures.malformedWeightV1),
    ]);
    const anomaly = result.analysis.anomalies[0];

    expect(anomaly.kind).toBe("malformed");
    expect(Object.keys(anomaly)).not.toContain("data");
    expect(Object.keys(anomaly)).not.toContain("raw");
    expect(JSON.stringify(anomaly)).not.toContain("32.0");
  });
});
