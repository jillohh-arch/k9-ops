/**
 * WEIGHT-01E-R2B.2 — lifecycle real do subscriber dedicado de Pesagem.
 *
 * Diferente do teste de contrato (`use-k9-profile-weight.test.ts`), aqui o hook
 * é montado de verdade: `onSnapshot` é substituído por um duplo controlável que
 * registra cada assinatura por path e permite disparar sucesso e erro sob
 * demanda. Prova comportamental, não asserção sobre o texto do código.
 *
 * Cobre: loading inicial, snapshot com dados, snapshot vazio, erro,
 * unsubscribe no unmount e troca de `dogId`.
 */

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SnapshotDoc = { data: () => Record<string, unknown>; id: string };
type Subscription = {
  error: (error: { message: string }) => void;
  next: (snapshot: { docs: SnapshotDoc[] }) => void;
  path: string;
  unsubscribe: ReturnType<typeof vi.fn>;
};

const firestore = vi.hoisted(() => ({
  subscriptions: [] as unknown[],
}));

/**
 * `collection`/`doc` devolvem um marcador com o path concatenado; `query` é
 * transparente. Assim cada assinatura fica identificável sem Firebase real.
 */
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...segments: string[]) => ({
    __path: segments.join("/"),
  }),
  doc: (_db: unknown, ...segments: string[]) => ({
    __path: segments.join("/"),
  }),
  onSnapshot: (
    ref: { __path: string },
    next: (snapshot: { docs: SnapshotDoc[] }) => void,
    error: (error: { message: string }) => void,
  ) => {
    const unsubscribe = vi.fn();
    firestore.subscriptions.push({
      error,
      next,
      path: ref.__path,
      unsubscribe,
    });
    return unsubscribe;
  },
  query: (ref: unknown) => ref,
  where: () => ({}),
}));
vi.mock("@/lib/firebase/client", () => ({ db: {} }));

import * as fixtures from "../../../health/domain/weight/__tests__/weight-document-fixtures";
import { useK9ProfileData } from "../use-k9-profile-data";

const { FIXTURE_DOG_ID, OTHER_DOG_ID } = fixtures;

function subscriptions() {
  return firestore.subscriptions as Subscription[];
}

/** Assinaturas de pesagem de um cão, na ordem de criação. */
function weightSubscriptions(dogId: string) {
  return subscriptions().filter(
    (subscription) => subscription.path === `dogs/${dogId}/weight_records`,
  );
}

function weightSubscription(dogId: string) {
  const found = weightSubscriptions(dogId);
  expect(found.length).toBeGreaterThan(0);
  return found[found.length - 1];
}

function snapshotDoc(id: string, data: object): SnapshotDoc {
  return { data: () => ({ ...data }), id };
}

/** Assinatura do documento do cão (`dogs/{dogId}`), não da subcoleção. */
function dogSubscription(dogId: string) {
  const found = subscriptions().filter(
    (subscription) => subscription.path === `dogs/${dogId}`,
  );
  expect(found.length).toBeGreaterThan(0);
  return found[found.length - 1];
}

/** Snapshot de documento único, com o shape usado pelo hook. */
function docSnapshot(id: string, data: object) {
  return {
    data: () => ({ ...data }),
    exists: () => true,
    id,
  } as unknown as { docs: SnapshotDoc[] };
}

/**
 * Liquida com coleção vazia todas as assinaturas que não são o documento do cão
 * nem a pesagem, para que `loading` agregado possa chegar a `false` sem que o
 * teste precise encenar treino, ocorrências e documentos.
 */
function settleOtherSources() {
  for (const subscription of subscriptions()) {
    const segments = subscription.path.split("/");
    // Documento do cão (`dogs/{dogId}`) recebe DocumentSnapshot, não coleção.
    const isDogDoc = segments.length === 2 && segments[0] === "dogs";
    const isWeight = subscription.path.endsWith("/weight_records");
    if (isDogDoc || isWeight) continue;
    subscription.next({ docs: [] });
  }
}

beforeEach(() => {
  firestore.subscriptions = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── A. Loading inicial ────────────────────────────────────────────────────

describe("loading inicial", () => {
  it("começa em loading, sem records e sem erro, antes do primeiro snapshot", () => {
    const { result } = renderHook(() => useK9ProfileData(FIXTURE_DOG_ID));

    expect(result.current.loading).toBe(true);
    expect(result.current.weightRecords).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("assina exatamente a subcoleção per-dog de pesagem", () => {
    renderHook(() => useK9ProfileData(FIXTURE_DOG_ID));

    expect(weightSubscriptions(FIXTURE_DOG_ID)).toHaveLength(1);
    // Sem collectionGroup e sem assinatura de outro cão.
    expect(weightSubscriptions(OTHER_DOG_ID)).toHaveLength(0);
  });
});

// ─── B. Snapshot com dados ─────────────────────────────────────────────────

describe("snapshot com dados", () => {
  it("publica todos os docs do snapshot com _data, _id e _source", () => {
    const { result } = renderHook(() => useK9ProfileData(FIXTURE_DOG_ID));

    act(() => {
      weightSubscription(FIXTURE_DOG_ID).next({
        docs: [
          snapshotDoc("w-33", fixtures.apoloCanonicalV1_33_3),
          snapshotDoc("w-32", fixtures.apoloCanonicalV1_32_0),
          snapshotDoc("w-inv", fixtures.targetV2Invalidated),
          snapshotDoc("w-bad", fixtures.malformedWeightV1),
        ],
      });
    });

    const records = result.current.weightRecords;
    expect(records).toHaveLength(4);
    expect(records.map((record) => record._id)).toEqual([
      "w-33",
      "w-32",
      "w-inv",
      "w-bad",
    ]);
    for (const record of records) {
      expect(record._source).toBe("dog-weight-records");
      expect(record._data).toBeDefined();
    }
    // Malformed e invalidated continuam presentes: a classificação é da
    // política, não do subscriber.
    expect(records.some((record) => record._id === "w-bad")).toBe(true);
  });

  it("preserva doc.data() intacto em _data", () => {
    const { result } = renderHook(() => useK9ProfileData(FIXTURE_DOG_ID));

    act(() => {
      weightSubscription(FIXTURE_DOG_ID).next({
        docs: [snapshotDoc("w-33", fixtures.apoloCanonicalV1_33_3)],
      });
    });

    expect(result.current.weightRecords[0]._data).toEqual(
      fixtures.apoloCanonicalV1_33_3,
    );
  });

  it("não pré-filtra registro com alias de soft-delete", () => {
    const { result } = renderHook(() => useK9ProfileData(FIXTURE_DOG_ID));

    act(() => {
      weightSubscription(FIXTURE_DOG_ID).next({
        docs: [
          snapshotDoc("w-del", {
            ...fixtures.apoloCanonicalV1_33_3,
            deleted_at: fixtures.apoloCanonicalV1_33_3.created_at,
          }),
          snapshotDoc("w-arch", {
            ...fixtures.apoloCanonicalV1_32_0,
            active: false,
          }),
        ],
      });
    });

    expect(result.current.weightRecords).toHaveLength(2);
  });

  it("metadata interna vence payload que tente sobrescrevê-la", () => {
    const { result } = renderHook(() => useK9ProfileData(FIXTURE_DOG_ID));

    act(() => {
      weightSubscription(FIXTURE_DOG_ID).next({
        docs: [
          snapshotDoc("w-real", {
            ...fixtures.apoloCanonicalV1_33_3,
            _data: "spoofed",
            _id: "spoofed",
            _source: "spoofed",
          }),
        ],
      });
    });

    const record = result.current.weightRecords[0];
    expect(record._id).toBe("w-real");
    expect(record._source).toBe("dog-weight-records");
    expect(record._data).not.toBe("spoofed");
  });
});

// ─── C. Snapshot vazio ─────────────────────────────────────────────────────

describe("snapshot vazio", () => {
  it("produz coleção vazia sem erro", () => {
    const { result } = renderHook(() => useK9ProfileData(FIXTURE_DOG_ID));

    act(() => {
      weightSubscription(FIXTURE_DOG_ID).next({ docs: [] });
    });

    expect(result.current.weightRecords).toEqual([]);
  });
});

// ─── D. Snapshot com erro ──────────────────────────────────────────────────

describe("snapshot com erro", () => {
  it("expõe a mensagem factual do erro", () => {
    const { result } = renderHook(() => useK9ProfileData(FIXTURE_DOG_ID));

    act(() => {
      weightSubscription(FIXTURE_DOG_ID).error({
        message: "Missing or insufficient permissions.",
      });
    });

    expect(result.current.error).toContain(
      "Missing or insufficient permissions.",
    );
  });

  it("não mantém peso anterior como dado atual após erro", () => {
    const { result } = renderHook(() => useK9ProfileData(FIXTURE_DOG_ID));

    act(() => {
      weightSubscription(FIXTURE_DOG_ID).next({
        docs: [snapshotDoc("w-33", fixtures.apoloCanonicalV1_33_3)],
      });
    });
    expect(result.current.weightRecords).toHaveLength(1);

    act(() => {
      weightSubscription(FIXTURE_DOG_ID).error({ message: "permission-denied" });
    });

    // O peso stale não pode sobreviver a uma falha de leitura: sem isso, a
    // política receberia uma coleção que já não se sabe representar a verdade.
    expect(result.current.weightRecords).toEqual([]);
    expect(result.current.error).toContain("permission-denied");
  });
});

// ─── E. Unsubscribe ────────────────────────────────────────────────────────

describe("unsubscribe", () => {
  it("cancela a assinatura de pesagem no unmount", () => {
    const { unmount } = renderHook(() => useK9ProfileData(FIXTURE_DOG_ID));
    const subscription = weightSubscription(FIXTURE_DOG_ID);

    expect(subscription.unsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it("cancela a assinatura antiga ao trocar de dogId", () => {
    const { rerender } = renderHook(({ dogId }) => useK9ProfileData(dogId), {
      initialProps: { dogId: FIXTURE_DOG_ID },
    });
    const first = weightSubscription(FIXTURE_DOG_ID);

    rerender({ dogId: OTHER_DOG_ID });

    expect(first.unsubscribe).toHaveBeenCalled();
    expect(weightSubscriptions(OTHER_DOG_ID)).toHaveLength(1);
  });
});

// ─── F. Troca de dogId ─────────────────────────────────────────────────────

describe("troca de dogId", () => {
  it("um snapshot do cão antigo não contamina o cão novo após a troca", () => {
    const { rerender, result } = renderHook(
      ({ dogId }) => useK9ProfileData(dogId),
      { initialProps: { dogId: FIXTURE_DOG_ID } },
    );
    const first = weightSubscription(FIXTURE_DOG_ID);

    act(() => {
      first.next({
        docs: [snapshotDoc("w-33", fixtures.apoloCanonicalV1_33_3)],
      });
    });
    expect(result.current.weightRecords).toHaveLength(1);

    rerender({ dogId: OTHER_DOG_ID });

    // A assinatura antiga foi cancelada; um callback atrasado dela não deve
    // reescrever o estado do cão novo.
    expect(first.unsubscribe).toHaveBeenCalled();
    const second = weightSubscription(OTHER_DOG_ID);
    expect(second).not.toBe(first);

    act(() => {
      second.next({
        docs: [snapshotDoc("w-b", fixtures.recognizedLegacyWeb)],
      });
    });

    expect(result.current.weightRecords.map((record) => record._id)).toEqual([
      "w-b",
    ]);
  });

  it("expõe a janela em que o cão novo já chegou mas o peso ainda é do antigo", () => {
    const { rerender, result } = renderHook(
      ({ dogId }) => useK9ProfileData(dogId),
      { initialProps: { dogId: FIXTURE_DOG_ID } },
    );

    // Cão A totalmente carregado: documento, pesagem e as demais fontes.
    act(() => {
      dogSubscription(FIXTURE_DOG_ID).next(
        docSnapshot(FIXTURE_DOG_ID, { name: "Apolo" }),
      );
      weightSubscription(FIXTURE_DOG_ID).next({
        docs: [snapshotDoc("w-33", fixtures.apoloCanonicalV1_33_3)],
      });
      settleOtherSources();
    });
    expect(result.current.loading).toBe(false);

    rerender({ dogId: OTHER_DOG_ID });

    // Só o documento do cão B responde, junto das fontes não-Weight; a pesagem
    // de B ainda não chegou.
    act(() => {
      dogSubscription(OTHER_DOG_ID).next(
        docSnapshot(OTHER_DOG_ID, { name: "Outro" }),
      );
      settleOtherSources();
    });

    // Estado factual desta janela, fixado para auditoria: nenhum campo de
    // loading volta a `true` na troca de `dogId`, então o consumidor recebe o
    // documento do cão B junto da coleção de pesagem do cão A.
    expect(result.current.loading).toBe(false);
    expect(result.current.dog?._id).toBe(OTHER_DOG_ID);
    expect(result.current.weightRecords.map((record) => record._id)).toEqual([
      "w-33",
    ]);
  });
});
