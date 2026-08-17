import { describe, expect, it } from "vitest";

import {
  buildK9Activity,
  documentUrl,
  healthEventTitle,
  occurrenceStatusLabel,
  sortByRecordDateDesc,
  weightValue,
} from "@/features/effective/lib/k9-profile-activity";
import type { ProfileRecord } from "@/features/effective/hooks/use-k9-profile-data";

function record(fields: Record<string, unknown>, id = "r1"): ProfileRecord {
  return { _id: id, ...fields } as ProfileRecord;
}

describe("buildK9Activity — somente eventos reais", () => {
  it("ordena estritamente por timestamp real, do mais recente ao mais antigo", () => {
    const activity = buildK9Activity({
      healthEvents: [record({ date: "2026-01-10", type: "exam" }, "h1")],
      sessions: [record({ date: "2026-03-01" }, "s1")],
      weights: [record({ date: "2026-02-01", weight_kg: 30 }, "w1")],
    });

    expect(activity.map((item) => item.category)).toEqual([
      "training",
      "weight",
      "health",
    ]);
    for (let index = 1; index < activity.length; index += 1) {
      expect(activity[index - 1].date.getTime()).toBeGreaterThanOrEqual(
        activity[index].date.getTime(),
      );
    }
  });

  it("descarta registros sem timestamp confiável em vez de datá-los hoje", () => {
    const activity = buildK9Activity({
      healthEvents: [
        record({ type: "exam" }, "no-date"),
        record({ date: "2026-05-05", type: "exam" }, "with-date"),
      ],
    });

    expect(activity).toHaveLength(1);
    expect(activity[0].id).toContain("with-date");
  });

  it("não sintetiza eventos a partir do estado atual do cão", () => {
    // Nenhuma fonte fornecida: a timeline é vazia. O fato de o cão estar
    // "em formação" hoje não gera um evento.
    expect(buildK9Activity({})).toEqual([]);
  });

  it("especialidade só entra quando o registro traz data própria", () => {
    const withoutDate = buildK9Activity({
      specialties: [record({ status: "in_formation", type: "deteccao" }, "sp1")],
    });
    expect(withoutDate).toHaveLength(0);

    const withDate = buildK9Activity({
      specialties: [
        record(
          { status: "in_formation", type: "deteccao", updated_at: "2026-04-01" },
          "sp2",
        ),
      ],
    });
    expect(withDate).toHaveLength(1);
    expect(withDate[0].category).toBe("specialty");
  });

  it("agrega apenas as categorias das fontes fornecidas", () => {
    const activity = buildK9Activity({
      documents: [record({ dataUpload: "2026-02-02", nome: "Atestado" }, "d1")],
      occurrences: [record({ date: "2026-02-03", status: "sealed" }, "o1")],
    });

    expect(new Set(activity.map((item) => item.category))).toEqual(
      new Set(["document", "occurrence"]),
    );
  });

  it("ids são estáveis e distinguem fontes homônimas", () => {
    const activity = buildK9Activity({
      sessions: [
        record({ _source: "dog-training-sessions", date: "2026-01-01" }, "same"),
        record({ _source: "root-training-sessions", date: "2026-01-02" }, "same"),
      ],
    });

    expect(new Set(activity.map((item) => item.id)).size).toBe(2);
  });
});

describe("derivações de registro", () => {
  it("peso aceita as variações canônicas e rejeita valores inválidos", () => {
    expect(weightValue(record({ weight_kg: 29.5 }))).toBe(29.5);
    expect(weightValue(record({ peso: "31,2" }))).toBeCloseTo(31.2);
    expect(weightValue(record({ weight: 0 }))).toBeNull();
    expect(weightValue(null)).toBeNull();
  });

  it("título de evento de saúde combina tipo e subtipo reais", () => {
    expect(healthEventTitle(record({ subtype: "joelho", type: "surgery" }))).toBe(
      "Cirurgia: joelho",
    );
    expect(healthEventTitle(record({ type: "vaccination" }))).toBe("Vacina");
  });

  it("status de ocorrência preserva o valor, porém humanizado", () => {
    expect(occurrenceStatusLabel(record({ status: "sealed" }))).toBe("Finalizada");
    // O valor real continua visível, mas sem `snake_case` cru na UI.
    expect(occurrenceStatusLabel(record({ status: "em_analise" }))).toBe(
      "Em analise",
    );
    expect(occurrenceStatusLabel(record({ status: "em_analise" }))).not.toMatch(
      /_/,
    );
  });

  it("documento sem URL real devolve null em vez de link inventado", () => {
    expect(documentUrl(record({ nome: "Doc" }))).toBeNull();
    expect(documentUrl(record({ url: "https://example.test/a.pdf" }))).toBe(
      "https://example.test/a.pdf",
    );
  });

  it("sortByRecordDateDesc não muta o array original", () => {
    const input = [record({ date: "2026-01-01" }, "a"), record({ date: "2026-02-01" }, "b")];
    const sorted = sortByRecordDateDesc(input);

    expect(sorted[0]._id).toBe("b");
    expect(input[0]._id).toBe("a");
  });
});
