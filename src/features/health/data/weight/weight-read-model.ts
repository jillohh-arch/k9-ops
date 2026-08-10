/**
 * Projeção compartilhada de peso derivada da análise canônica (WEIGHT-01E-R2B).
 *
 * Extraído de `use-health-data.ts` quando o Perfil do K9 passou a ser o segundo
 * consumidor: a função é pura e não pertence a um hook de apresentação. Sem
 * React, sem Firebase, sem UI.
 *
 * Único ponto do Web autorizado a transformar uma coleção crua de
 * `weight_records` em peso atual. Nenhum consumidor pode reimplementar a
 * seleção de current, aplicar alias local ou ordenar por conta própria.
 */

import {
  analyzeWeightDocuments,
  type WeightCollectionAnalysis,
  type WeightCurrentSelection,
  type WeightDocumentInput,
} from "./weight-collection-policy";

/**
 * Registro cru de `weight_records` aceito pelo resolver.
 *
 * `_data` preserva o `doc.data()` original, sem as chaves de metadata
 * injetadas pelo subscriber (`_id`/`_dogId`/`_path`/`_source`), para que o
 * parser receba o documento intacto em vez do registro achatado.
 */
export type WeightRawRecord = Record<string, unknown> & {
  _data?: unknown;
  _id: string;
};

/**
 * Projeção de peso derivada da análise canônica.
 *
 * `analysis` fica disponível para consumidores que precisem da série válida;
 * `latestWeightKg`/`latestWeightAt` existem apenas quando há peso factual.
 */
export type DogWeightReadModel = {
  readonly analysis: WeightCollectionAnalysis;
  readonly latestWeightAt: Date | null;
  readonly latestWeightKg: number | null;
  readonly weightCurrentState: WeightCurrentSelection["kind"];
};

/**
 * Handoff cru da coleção `weight_records` de um cão para a política canônica.
 *
 * A coleção é entregue completa e na ordem recebida do snapshot: sem
 * pré-filtro de soft-delete, status, `measured_at` ou schema; sem alias local;
 * sem ordenação, deduplicação ou seleção de mais recente. Toda classificação e
 * toda escolha de peso atual pertencem a `analyzeWeightDocuments`.
 *
 * `_data` preserva o `doc.data()` original; o fallback para o registro achatado
 * mantém a função utilizável em cenários sem esse metadata.
 *
 * Somente `current` produz peso: `none` e `inconclusive` mantêm valor e data
 * nulos, sem rollback para registro válido anterior, para invalidado, para
 * `dogs.weight` ou para projeção denormalizada.
 */
export function resolveDogWeightReadModel(
  dogId: string,
  records: readonly WeightRawRecord[],
): DogWeightReadModel {
  const documents: WeightDocumentInput[] = records.map((record) => ({
    data: record._data ?? record,
    dogId,
    entityId: record._id,
    sourceCollection: "weight_records",
  }));
  const analysis = analyzeWeightDocuments({ documents });
  const current = analysis.current;
  return {
    analysis,
    latestWeightAt:
      current.kind === "current" ? current.assessment.measuredAt : null,
    latestWeightKg:
      current.kind === "current" ? current.assessment.weightKg : null,
    weightCurrentState: current.kind,
  };
}
