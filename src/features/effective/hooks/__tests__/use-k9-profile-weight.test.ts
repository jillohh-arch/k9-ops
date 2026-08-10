/**
 * WEIGHT-01E-R2B — integração do Perfil do K9 com a política canônica de peso.
 *
 * Os testes exercitam o mesmo resolver compartilhado que o Perfil usa, com
 * documentos brutos reais das fixtures: a classificação vem sempre do parser e
 * da política, nunca de um `WeightCollectionAnalysis` fabricado.
 *
 * As asserções de fonte provam que o Perfil deixou de possuir contrato paralelo
 * de peso — sem sort local, sem alias de peso/data, sem fallback cadastral — e
 * que a coleção chega crua à política, sem pré-filtro de soft-delete.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(() => () => undefined),
  query: vi.fn(),
  where: vi.fn(),
}));
vi.mock("@/lib/firebase/client", () => ({ db: {} }));

import { resolveDogWeightReadModel } from "@/features/health/data/weight/weight-read-model";

import * as fixtures from "../../../health/domain/weight/__tests__/weight-document-fixtures";

const { FIXTURE_DOG_ID } = fixtures;

type ProfileWeightRecord = Record<string, unknown> & {
  _data: unknown;
  _id: string;
  _source?: string;
};

/** Reproduz o registro publicado por `subscribeWeightRecords`. */
function snapshotRecord(id: string, data: object): ProfileWeightRecord {
  return {
    ...data,
    _data: data,
    _id: id,
    _source: "dog-weight-records",
  };
}

function readModel(records: readonly ProfileWeightRecord[]) {
  return resolveDogWeightReadModel(FIXTURE_DOG_ID, records);
}

const HOOK_SOURCE = readFileSync(
  path.resolve(__dirname, "../use-k9-profile-data.ts"),
  "utf8",
);

const PAGE_SOURCE = readFileSync(
  path.resolve(__dirname, "../../../../app/(app)/k9/[dogId]/page.tsx"),
  "utf8",
);

/**
 * Fontes sem comentários: comentários citam aliases legados ao documentar a
 * decisão do gate, então as asserções de alias olham só o código executável.
 */
function stripComments(source: string) {
  return source.replaceAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
}

const HOOK_CODE = stripComments(HOOK_SOURCE);
const PAGE_CODE = stripComments(PAGE_SOURCE);

// ─── 1–2. Handoff cru: nada desaparece antes da política ───────────────────

describe("handoff cru da coleção de pesagem", () => {
  it("entrega a coleção completa à política", () => {
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

  it("preserva doc.data() bruto em _data, sem achatamento decidir a leitura", () => {
    // O subscriber dedicado publica `_data`; o resolver precisa consumi-lo para
    // que o parser veja o documento intacto.
    expect(HOOK_CODE).toContain("_data: data");
    expect(HOOK_CODE).toContain('collection(db, "dogs", dogId, "weight_records")');
  });

  it("não pré-filtra a coleção de pesagem por alias de soft-delete", () => {
    // `deleted_at` é alias legado de exclusão. O documento tem de chegar à
    // política: descartá-lo aqui esconderia um possível bloqueio de integridade
    // e traduzir `deleted` para `invalidated` criaria segunda semântica.
    const softDeleted = {
      ...fixtures.apoloCanonicalV1_33_3,
      deleted_at: fixtures.apoloCanonicalV1_33_3.created_at,
    };
    const result = readModel([snapshotRecord("w-del", softDeleted)]);

    expect(
      result.analysis.validRecords.length +
        result.analysis.invalidatedRecords.length +
        result.analysis.anomalies.length,
    ).toBe(1);
  });

  it("o caminho de pesagem não passa por subscribeMany", () => {
    // O efeito de pesagem chama o subscriber dedicado, não o genérico.
    expect(HOOK_CODE).toContain(
      "return subscribeWeightRecords(dogId, setWeightRecords);",
    );
    expect(HOOK_CODE).not.toMatch(/subscribeMany\([\s\S]*?weight_records/);
  });
});

// ─── 3–4. current e none ───────────────────────────────────────────────────

describe("peso atual factual", () => {
  it("valid mais recente vira current independentemente da ordem da fonte", () => {
    const ascending = readModel([
      snapshotRecord("w-32", fixtures.apoloCanonicalV1_32_0),
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
    ]);
    const descending = readModel([
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
      snapshotRecord("w-32", fixtures.apoloCanonicalV1_32_0),
    ]);

    expect(ascending.weightCurrentState).toBe("current");
    expect(ascending.latestWeightKg).toBe(33.3);
    expect(descending.latestWeightKg).toBe(33.3);
    expect(ascending.latestWeightAt).toEqual(
      new Date("2026-08-06T10:00:00.000Z"),
    );
  });

  it("coleção vazia produz none, sem bloqueio", () => {
    const result = readModel([]);

    expect(result.weightCurrentState).toBe("none");
    expect(result.latestWeightKg).toBeNull();
    expect(result.latestWeightAt).toBeNull();
    expect(result.analysis.anomalies).toHaveLength(0);
  });
});

// ─── 5–6. Blockers produzem inconclusive ───────────────────────────────────

describe("bloqueio de integridade", () => {
  it("malformed produz inconclusive e não faz rollback para o válido", () => {
    const result = readModel([
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
      snapshotRecord("w-bad", fixtures.malformedWeightV1),
    ]);

    expect(result.weightCurrentState).toBe("inconclusive");
    expect(result.latestWeightKg).toBeNull();
    expect(result.latestWeightAt).toBeNull();
  });

  it("unsupported produz inconclusive", () => {
    const result = readModel([
      snapshotRecord("w-future", fixtures.futureSchema3),
    ]);

    expect(result.weightCurrentState).toBe("inconclusive");
    expect(result.latestWeightKg).toBeNull();
  });

  it("entityId duplicado produz inconclusive", () => {
    const result = readModel([
      snapshotRecord("w-dup", fixtures.apoloCanonicalV1_33_3),
      snapshotRecord("w-dup", fixtures.apoloCanonicalV1_32_0),
    ]);

    expect(result.weightCurrentState).toBe("inconclusive");
    expect(result.latestWeightKg).toBeNull();
  });
});

// ─── 7–8. Invalidated ──────────────────────────────────────────────────────

describe("registros invalidados", () => {
  it("invalidado nunca vira current", () => {
    // A fixture invalidada é a mais recente da coleção e tem peso 99.9: só
    // viraria current num contrato que ignora lifecycle.
    const result = readModel([
      snapshotRecord("w-inv", fixtures.targetV2Invalidated),
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
    ]);

    expect(result.weightCurrentState).toBe("current");
    expect(result.latestWeightKg).toBe(33.3);
    expect(result.analysis.invalidatedRecords).toHaveLength(1);
  });

  it("invalidado sozinho produz none, não current", () => {
    const result = readModel([
      snapshotRecord("w-inv", fixtures.targetV2Invalidated),
    ]);

    expect(result.weightCurrentState).toBe("none");
    expect(result.latestWeightKg).toBeNull();
  });

  it("invalidado não bloqueia sozinho outro valid", () => {
    const result = readModel([
      snapshotRecord("w-inv", fixtures.targetV2Invalidated),
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
    ]);

    expect(result.analysis.anomalies).toHaveLength(0);
    expect(result.weightCurrentState).not.toBe("inconclusive");
  });
});

// ─── 9, 13–14. Fontes e fallbacks proibidos ────────────────────────────────

describe("fontes proibidas no Perfil", () => {
  it("não usa dogs.weight como fallback de peso atual", () => {
    // O campo cadastral do K9 não é pesagem factual. `profileNumber` continua
    // válido para a faixa ideal, mas nunca para o peso.
    expect(PAGE_CODE).not.toMatch(/profileNumber\(\s*dog\s*,\s*\[\s*"weight"/);
    expect(PAGE_CODE).not.toMatch(/\?\?\s*profileNumber\(\s*dog/);
  });

  it("não referencia weight_history", () => {
    expect(HOOK_SOURCE).not.toContain("weight_history");
    expect(PAGE_SOURCE).not.toContain("weight_history");
  });

  it("não usa projeção denormalizada _last_weight_*", () => {
    for (const source of [HOOK_SOURCE, PAGE_SOURCE]) {
      expect(source).not.toContain("_last_weight_kg");
      expect(source).not.toContain("_last_weight_at");
    }
  });

  it("não usa collectionGroup para pesagem", () => {
    expect(HOOK_SOURCE).not.toContain("collectionGroup");
    expect(PAGE_SOURCE).not.toContain("collectionGroup");
  });
});

// ─── 10–12, 20. Nenhum contrato paralelo de current ────────────────────────

describe("ausência de contrato paralelo", () => {
  it("a página não interpreta aliases de peso do documento bruto", () => {
    expect(PAGE_CODE).not.toContain("weight_kg");
    expect(PAGE_CODE).not.toContain('"peso"');
    // `weightValue`, que resolvia peso por 4 aliases, deixou de existir.
    expect(PAGE_CODE).not.toContain("weightValue(");
  });

  it("a página não decide recência por updated_at, created_at ou date genérico", () => {
    // `profileRecordDate` percorre 14 aliases, incluindo `updated_at`. Ele
    // continua válido para treino/ocorrências/documentos, mas não pode tocar a
    // série de pesagem nem o peso atual.
    const weightBlock = PAGE_CODE.slice(
      PAGE_CODE.indexOf("resolveDogWeightReadModel(dogId"),
      PAGE_CODE.indexOf("const healthEvents"),
    );
    expect(weightBlock).not.toContain("profileRecordDate");
    expect(weightBlock).not.toContain("updated_at");
    expect(weightBlock).not.toContain("created_at");
    expect(weightBlock).not.toContain(".sort(");
  });

  it("a página não elege current por sort()[0] nem por índice", () => {
    expect(PAGE_CODE).not.toMatch(/weights\s*\[\s*0\s*\]/);
    expect(PAGE_CODE).not.toContain("latestWeight =");
    expect(PAGE_CODE).toContain("resolveDogWeightReadModel");
  });

  it("delega toda a decisão ao resolver compartilhado", () => {
    expect(PAGE_CODE).not.toContain("analyzeWeightDocuments");
    expect(PAGE_CODE).toContain("weightCurrentState");
  });
});

// ─── 15–16. Semântica da UI ────────────────────────────────────────────────

describe("semântica de apresentação", () => {
  it("inconclusive não é apresentado como ausência de pesagem", () => {
    expect(PAGE_CODE).toContain('"Não conclusivo"');
    expect(PAGE_CODE).toMatch(/inconclusive[\s\S]{0,80}Não conclusivo/);
  });

  it("um único rótulo serve todas as superfícies de peso atual", () => {
    // Duas verdades de peso (`currentWeight` com fallback e `canônicalWeight`)
    // não podem voltar a coexistir.
    expect(PAGE_CODE).not.toContain("canônicalWeight");
    expect(PAGE_CODE).not.toContain("currentWeight");
    const labelCalls = [...PAGE_CODE.matchAll(/weightLabel\(/g)];
    // uma definição + quatro superfícies de exibição
    expect(labelCalls.length).toBeGreaterThanOrEqual(5);
  });

  it("faixa ideal não é avaliada sobre peso inconclusivo", () => {
    const stateBlock = PAGE_CODE.slice(
      PAGE_CODE.indexOf("const weightState"),
      PAGE_CODE.indexOf("const healthEvents"),
    );
    expect(stateBlock.indexOf("inconclusive")).toBeLessThan(
      stateBlock.indexOf("Dentro da faixa ideal"),
    );
  });
});

// ─── 17. Série / gráfico ───────────────────────────────────────────────────

describe("série de pesagem", () => {
  it("a série exposta contém apenas registros válidos", () => {
    const result = readModel([
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
      snapshotRecord("w-32", fixtures.apoloCanonicalV1_32_0),
      snapshotRecord("w-inv", fixtures.targetV2Invalidated),
    ]);

    expect(result.analysis.validRecords).toHaveLength(2);
    expect(
      result.analysis.validRecords.map((assessment) => assessment.weightKg),
    ).toEqual([33.3, 32.0]);
  });

  it("a página plota validRecords, não a coleção crua", () => {
    expect(PAGE_CODE).toContain("analysis.validRecords");
    expect(PAGE_CODE).not.toMatch(/weightChartData[\s\S]{0,400}data\.weightRecords/);
  });

  it("registro invalidado não é plotado como pesagem factual", () => {
    const result = readModel([
      snapshotRecord("w-33", fixtures.apoloCanonicalV1_33_3),
      snapshotRecord("w-inv", fixtures.targetV2Invalidated),
    ]);

    expect(
      result.analysis.validRecords.some(
        (assessment) => assessment.weightKg === 99.9,
      ),
    ).toBe(false);
  });
});

// ─── 18. Peso inválido ─────────────────────────────────────────────────────

describe("validação de valor", () => {
  it("peso em string não vira valid", () => {
    const result = readModel([
      snapshotRecord("w-str", fixtures.malformedWeightV1),
    ]);

    expect(result.analysis.validRecords).toHaveLength(0);
    expect(result.latestWeightKg).toBeNull();
  });

  it("peso zero ou negativo não vira current", () => {
    for (const value of [0, -5]) {
      const result = readModel([
        snapshotRecord("w-bad", {
          ...fixtures.apoloCanonicalV1_33_3,
          weight_kg: value,
        }),
      ]);

      expect(result.weightCurrentState).not.toBe("current");
      expect(result.latestWeightKg).toBeNull();
    }
  });

  it("peso acima do limite plausível não vira current", () => {
    const result = readModel([
      snapshotRecord("w-heavy", fixtures.weightAboveLimitV1),
    ]);

    expect(result.weightCurrentState).not.toBe("current");
  });
});

// ─── 19. Autoridade do dogId ───────────────────────────────────────────────

describe("autoridade de identidade", () => {
  it("o dogId do path é a autoridade, não um alias embutido", () => {
    const result = readModel([
      snapshotRecord("w-mismatch", fixtures.embeddedDogIdMismatch),
    ]);

    // O parser detecta a divergência porque recebeu o dono vindo do path.
    expect(result.weightCurrentState).not.toBe("current");
  });

  it("o subscriber usa o path per-dog e a página passa o dogId da rota", () => {
    expect(HOOK_CODE).toContain('collection(db, "dogs", dogId, "weight_records")');
    expect(PAGE_CODE).toContain(
      "resolveDogWeightReadModel(dogId, data.weightRecords)",
    );
  });
});

// ─── Regressão: domínios não-Weight seguem no caminho genérico ─────────────

describe("isolamento do caminho dedicado", () => {
  it("os demais domínios continuam usando subscribeMany e mergeRecords", () => {
    for (const collectionPath of [
      "specialties",
      "training",
      "health_events",
      "training_sessions",
      "documents",
    ]) {
      expect(HOOK_CODE).toContain(collectionPath);
    }
    expect(HOOK_CODE).toContain("subscribeMany(");
    expect(HOOK_CODE).toContain("function mergeRecords(");
    expect(HOOK_CODE).toContain("function isArchived(");
  });

  it("isArchived permanece aplicado apenas no merge genérico", () => {
    const mergeBlock = HOOK_CODE.slice(
      HOOK_CODE.indexOf("function mergeRecords("),
      HOOK_CODE.indexOf("function subscribeMany("),
    );
    expect(mergeBlock).toContain("isArchived");

    // O subscriber dedicado vai da sua declaração até a função seguinte
    // (`isArchived`), que pertence ao caminho genérico.
    const weightBlock = HOOK_CODE.slice(
      HOOK_CODE.indexOf("function subscribeWeightRecords("),
      HOOK_CODE.indexOf("function isArchived("),
    );
    expect(weightBlock).toContain("weight_records");
    expect(weightBlock).not.toContain("isArchived");
    expect(weightBlock).not.toContain("mergeRecords");
    expect(weightBlock).not.toContain(".sort(");
    expect(weightBlock).not.toContain(".filter(");
  });
});
