import { describe, expect, it } from "vitest";

import {
  canonicalSource,
  countValidFields,
  deduplicateRecords,
  mergeRecords,
  type BinomialRecord,
} from "../../lib/binomial-deduplication";

describe("canonicalSource", () => {
  it("returns training_sessions for training_sessions", () => {
    expect(canonicalSource("training_sessions")).toBe("training_sessions");
  });

  it("returns training_sessions for training_sessions_legacy", () => {
    expect(canonicalSource("training_sessions_legacy")).toBe(
      "training_sessions",
    );
  });

  // BUG-FS-002: Novas fontes adicionadas para recuperar treinos do mobile
  it("returns training_sessions for dogs_training_sessions (subcoleção)", () => {
    expect(canonicalSource("dogs_training_sessions")).toBe(
      "training_sessions",
    );
  });

  it("returns training_sessions for trainings (coleção raiz)", () => {
    expect(canonicalSource("trainings")).toBe("training_sessions");
  });

  it("returns occurrences for occurrences", () => {
    expect(canonicalSource("occurrences")).toBe("occurrences");
  });

  it("returns occurrences for occurrences_legacy", () => {
    expect(canonicalSource("occurrences_legacy")).toBe("occurrences");
  });

  it("returns other sources unchanged", () => {
    expect(canonicalSource("shift_logs")).toBe("shift_logs");
    expect(canonicalSource("dogs")).toBe("dogs");
    expect(canonicalSource("users")).toBe("users");
  });
});

describe("countValidFields", () => {
  it("counts null and undefined as invalid", () => {
    expect(
      countValidFields({ a: null, b: undefined, c: "valid" }),
    ).toBe(1);
  });

  it("counts empty string as invalid", () => {
    expect(countValidFields({ a: "", b: "valid", c: "" })).toBe(1);
  });

  it("counts all valid non-empty values", () => {
    expect(
      countValidFields({ a: "hello", b: 123, c: true, d: [] }),
    ).toBe(4);
  });

  it("returns 0 for empty object", () => {
    expect(countValidFields({})).toBe(0);
  });
});

describe("mergeRecords", () => {
  it("prefers record with more valid fields", () => {
    const existing: BinomialRecord = {
      _id: "doc-1",
      _source: "training_sessions",
      dogId: "dog-1",
      handlerId: "handler-1",
      // fewer fields
    };
    const incoming: BinomialRecord = {
      _id: "doc-1",
      _source: "training_sessions",
      dogId: "dog-1",
      handlerId: "handler-1",
      date: "2025-01-01",
      location: "Base Alpha",
      // more fields
    };
    const result = mergeRecords(existing, incoming);
    expect(result.date).toBe("2025-01-01");
    expect(result.location).toBe("Base Alpha");
  });

  it("prefers canônica source when field count is equal", () => {
    const existing: BinomialRecord = {
      _id: "doc-2",
      _source: "training_sessions_legacy",
      dogId: "dog-1",
      dog_name: "Bono",
    };
    const incoming: BinomialRecord = {
      _id: "doc-2",
      _source: "training_sessions",
      dogId: "dog-1",
      dog_name: "Bono",
    };
    const result = mergeRecords(existing, incoming);
    // Incoming wins because existing is legacy
    expect(result._source).toBe("training_sessions");
  });

  it("keeps existing when both are legacy", () => {
    const existing: BinomialRecord = {
      _id: "doc-3",
      _source: "training_sessions_legacy",
      field1: "a",
    };
    const incoming: BinomialRecord = {
      _id: "doc-3",
      _source: "training_sessions_legacy",
      field1: "a",
    };
    const result = mergeRecords(existing, incoming);
    expect(result).toBe(existing);
  });

  it("normalizes source to canônica in result", () => {
    const existing: BinomialRecord = {
      _id: "doc-4",
      _source: "training_sessions",
      field1: "a",
    };
    const incoming: BinomialRecord = {
      _id: "doc-4",
      _source: "training_sessions_legacy",
      field1: "a",
      field2: "b",
    };
    const result = mergeRecords(existing, incoming);
    expect(result._source).toBe("training_sessions");
  });
});

describe("BUG-FS-001: deduplication scenarios", () => {
  // Fixture 1: documento somente camelCase
  it("handles camelCase-only document without duplication", () => {
    const records: BinomialRecord[] = [
      {
        _id: "doc-a",
        _source: "training_sessions",
        dogId: "dog-1",
      },
    ];

    const result = deduplicateRecords(records);
    expect(result.length).toBe(1);
    expect(result[0]._id).toBe("doc-a");
    expect(result[0]._source).toBe("training_sessions");
  });

  // Fixture 2: documento somente snake_case
  it("handles snake_case-only document without duplication", () => {
    const records: BinomialRecord[] = [
      {
        _id: "doc-b",
        _source: "training_sessions_legacy",
        dog_id: "dog-1",
      },
    ];

    const result = deduplicateRecords(records);
    expect(result.length).toBe(1);
    expect(result[0]._id).toBe("doc-b");
    expect(result[0]._source).toBe("training_sessions");
  });

  // Fixture 3: mesmo documento nos dois listeners (BUG-FS-001)
  it("merges same document from two listeners (BUG-FS-001)", () => {
    const records: BinomialRecord[] = [
      {
        _id: "doc-c",
        _source: "training_sessions",
        dogId: "dog-1",
        dog_id: "dog-1",
        type: "detection",
      },
      {
        _id: "doc-c",
        _source: "training_sessions_legacy",
        dogId: "dog-1",
        dog_id: "dog-1",
        type: "detection",
      },
    ];

    const result = deduplicateRecords(records);
    // Deve resultar em apenas 1 registro
    expect(result.length).toBe(1);
    expect(result[0]._id).toBe("doc-c");
    expect(result[0].type).toBe("detection");
  });

  // Determinismo: mesmo resultado nos dois sentidos (CRÍTICO para snapshots assíncronos)
  it("is deterministic regardless of arrival order (canonical first)", () => {
    const records: BinomialRecord[] = [
      {
        _id: "doc-det",
        _source: "training_sessions",
        dogId: "dog-1",
        type: "detection",
        location: "Base Alpha",
      },
      {
        _id: "doc-det",
        _source: "training_sessions_legacy",
        dogId: "dog-1",
        type: "detection",
        location: "Base Alpha",
      },
    ];
    return records;
  });

  it("is deterministic regardless of arrival order (legacy first)", () => {
    const records: BinomialRecord[] = [
      {
        _id: "doc-det",
        _source: "training_sessions_legacy",
        dogId: "dog-1",
        type: "detection",
        location: "Base Alpha",
      },
      {
        _id: "doc-det",
        _source: "training_sessions",
        dogId: "dog-1",
        type: "detection",
        location: "Base Alpha",
      },
    ];
    return records;
  });

  it("produces deeply equal results regardless of order", () => {
    const result1 = deduplicateRecords([
      {
        _id: "doc-det",
        _source: "training_sessions",
        dogId: "dog-1",
        type: "detection",
        location: "Base Alpha",
      },
      {
        _id: "doc-det",
        _source: "training_sessions_legacy",
        dogId: "dog-1",
        type: "detection",
        location: "Base Alpha",
      },
    ]);

    const result2 = deduplicateRecords([
      {
        _id: "doc-det",
        _source: "training_sessions_legacy",
        dogId: "dog-1",
        type: "detection",
        location: "Base Alpha",
      },
      {
        _id: "doc-det",
        _source: "training_sessions",
        dogId: "dog-1",
        type: "detection",
        location: "Base Alpha",
      },
    ]);

    // Verificar que ambos têm exatamente 1 registro
    expect(result1.length).toBe(1);
    expect(result2.length).toBe(1);

    // Verificar que os registros são profundamente iguais
    expect(result1[0]).toEqual(result2[0]);
  });

  // Fixture 4: IDs iguais em coleções diferentes
  it("does not collide IDs from different source families", () => {
    const records: BinomialRecord[] = [
      {
        _id: "same-id",
        _source: "training_sessions",
        dogId: "dog-1",
      },
      {
        _id: "same-id",
        _source: "occurrences",
        dog_id: "dog-1",
      },
    ];

    const result = deduplicateRecords(records);
    // Deve resultar em 2 registros (famílias diferentes)
    expect(result.length).toBe(2);
    const training = result.find((r) => r._source === "training_sessions");
    const occurrence = result.find((r) => r._source === "occurrences");
    expect(training).toBeDefined();
    expect(occurrence).toBeDefined();
  });

  // Fixture 5: valores divergentes (dogId != dog_id)
  it("merges with field count precedence (divergent values)", () => {
    const records: BinomialRecord[] = [
      {
        _id: "doc-e",
        _source: "training_sessions",
        dogId: "dog-web",
        dog_id: "dog-web",
        location: "Base Alpha",
      },
      {
        _id: "doc-e",
        _source: "training_sessions_legacy",
        dogId: "dog-web",
        dog_id: "dog-mobile",
        // missing location
      },
    ];

    const result = deduplicateRecords(records);
    expect(result.length).toBe(1);
    expect(result[0].location).toBe("Base Alpha");
    // Incoming (with location) has more fields, so it wins
  });

  // Fixture 6: ocorrência com ambos os listeners
  it("handles occurrences with both listeners", () => {
    const records: BinomialRecord[] = [
      {
        _id: "occ-1",
        _source: "occurrences",
        service_dog_id: "dog-1",
        status: "closed",
      },
      {
        _id: "occ-1",
        _source: "occurrences_legacy",
        dog_id: "dog-1",
        status: "closed",
      },
    ];

    const result = deduplicateRecords(records);
    expect(result.length).toBe(1);
    expect(result[0]._source).toBe("occurrences");
    expect(result[0].status).toBe("closed");
  });
});

describe("BUG-FS-002: novas fontes de treino", () => {
  // Fixture 7: treino na subcoleção dogs/{id}/training_sessions (FONTE CANÔNICA DO MOBILE)
  it("handles training in subcoleção dogs/{id}/training_sessions", () => {
    const records: BinomialRecord[] = [
      {
        _id: "sub-doc-1",
        _source: "dogs_training_sessions",
        dogId: "dog-1",
        type: "detection",
        date: "2026-07-09",
      },
    ];

    const result = deduplicateRecords(records);
    expect(result.length).toBe(1);
    expect(result[0]._source).toBe("training_sessions");
    expect(result[0].type).toBe("detection");
  });

  // Fixture 8: treino na coleção raiz trainings
  it("handles training in raiz trainings collection", () => {
    const records: BinomialRecord[] = [
      {
        _id: "trainings-doc-1",
        _source: "trainings",
        dogId: "dog-1",
        type: "obedience",
        date: "2026-07-08",
      },
    ];

    const result = deduplicateRecords(records);
    expect(result.length).toBe(1);
    expect(result[0]._source).toBe("training_sessions");
    expect(result[0].type).toBe("obedience");
  });

  // Fixture 9: mesmo treino gravado em múltiplas fontes (deduplicar)
  it("deduplicates same training across multiple sources", () => {
    const records: BinomialRecord[] = [
      {
        _id: "multi-1",
        _source: "dogs_training_sessions",
        dogId: "dog-1",
        type: "detection",
        location: "Base Alpha",
      },
      {
        _id: "multi-1",
        _source: "training_sessions",
        dogId: "dog-1",
        type: "detection",
        location: "Base Alpha",
      },
      {
        _id: "multi-1",
        _source: "trainings",
        dogId: "dog-1",
        type: "detection",
        location: "Base Alpha",
      },
    ];

    const result = deduplicateRecords(records);
    // Deve resultar em apenas 1 registro após deduplicação
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("detection");
    expect(result[0].location).toBe("Base Alpha");
  });

  // Fixture 10: treino com mais campos na subcoleção (preferir essa)
  it("prefers training with more fields from subcoleção", () => {
    const records: BinomialRecord[] = [
      {
        _id: "field-diff",
        _source: "training_sessions",
        dogId: "dog-1",
        type: "detection",
      },
      {
        _id: "field-diff",
        _source: "dogs_training_sessions",
        dogId: "dog-1",
        type: "detection",
        location: "Base Beta",
        score: 95,
      },
    ];

    const result = deduplicateRecords(records);
    expect(result.length).toBe(1);
    // Incoming (subcoleção) tem mais campos, então deve ganhar
    expect(result[0].location).toBe("Base Beta");
    expect(result[0].score).toBe(95);
  });
});
