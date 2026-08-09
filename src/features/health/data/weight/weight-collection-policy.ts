/**
 * Política coletiva de leitura de Pesagem (WEIGHT-01D-C1).
 *
 * Analisa a coleção completa de documentos de pesagem fornecida sem assumir
 * ordem de recência na fonte, utilizando exclusivamente o adapter público
 * `readWeightDocument`.
 *
 * Responsabilidades:
 * 1. Classificação coletiva dos documentos (valid / invalidated / malformed / unsupported)
 * 2. Detecção de anomalia de integridade por `entityId` duplicado
 * 3. Seleção segura do peso atual (`current`, `none`, `inconclusive`)
 * 4. Invariante: `current.assessment === validRecords[0]` sempre que `current.kind === "current"`
 * 5. Ordenação determinística de registros válidos (`compareValidWeightRecency`)
 * 6. Exclusão de registros invalidados do peso atual e da série ordinária
 * 7. Bloqueio global (`inconclusive`) por qualquer `malformed`, `unsupported` ou duplicidade
 * 8. Exposição segura e sanitizada de anomalias
 *
 * Não consulta Firestore, não altera o array de entrada, não expõe documento bruto.
 * Sem dependência de React, Firebase, hooks ou UI.
 */

import type { WeightDocumentDiagnosticCode } from "../../domain/weight/weight-diagnostics";
import {
  readWeightDocument,
  type PublicWeightAssessment,
} from "./weight-read-adapter";

// ─── Contratos de Entrada ──────────────────────────────────────────────────

export type WeightDocumentInput = {
  readonly entityId: string;
  readonly dogId: string;
  readonly data: unknown;
  readonly sourceCollection?: string;
};

export type AnalyzeWeightDocumentsOptions = {
  readonly documents: readonly WeightDocumentInput[];
};

// ─── Anomalias ─────────────────────────────────────────────────────────────

export type WeightCollectionAnomalyMalformed = {
  readonly kind: "malformed";
  readonly entityId: string;
  readonly inputIndex: number;
  readonly diagnosticCodes: readonly WeightDocumentDiagnosticCode[];
};

export type WeightCollectionAnomalyUnsupported = {
  readonly kind: "unsupported";
  readonly entityId: string;
  readonly inputIndex: number;
  readonly schemaVersion: number;
  readonly diagnosticCodes: readonly WeightDocumentDiagnosticCode[];
};

export type WeightCollectionAnomalyDuplicateEntityId = {
  readonly kind: "duplicate_entity_id";
  readonly entityId: string;
  readonly inputIndices: readonly number[];
};

export type WeightCollectionAnomaly =
  | WeightCollectionAnomalyMalformed
  | WeightCollectionAnomalyUnsupported
  | WeightCollectionAnomalyDuplicateEntityId;

// ─── Seleção do Peso Atual ─────────────────────────────────────────────────

export type WeightCollectionBlockingKind =
  | "malformed"
  | "unsupported"
  | "duplicate_entity_id";

export type WeightCurrentSelectionCurrent = {
  readonly kind: "current";
  readonly assessment: PublicWeightAssessment;
};

export type WeightCurrentSelectionNone = {
  readonly kind: "none";
};

export type WeightCurrentSelectionInconclusive = {
  readonly kind: "inconclusive";
  readonly blockerKinds: readonly WeightCollectionBlockingKind[];
};

export type WeightCurrentSelection =
  | WeightCurrentSelectionCurrent
  | WeightCurrentSelectionNone
  | WeightCurrentSelectionInconclusive;

// ─── Análise Coletiva ──────────────────────────────────────────────────────

export type WeightCollectionAnalysis = {
  readonly current: WeightCurrentSelection;
  readonly validRecords: readonly PublicWeightAssessment[];
  readonly invalidatedRecords: readonly PublicWeightAssessment[];
  readonly anomalies: readonly WeightCollectionAnomaly[];
};

// ─── Comparador Canônico ───────────────────────────────────────────────────

/**
 * Compara duas strings por código de unidade UTF-16 de forma determinística.
 * Retorna valor positivo se `a` > `b`, negativo se `a` < `b`, ou 0 se idênticas.
 */
function compareUtf16CodeUnits(a: string, b: string): number {
  if (a === b) return 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    const codeA = a.charCodeAt(i);
    const codeB = b.charCodeAt(i);
    if (codeA !== codeB) {
      return codeA - codeB;
    }
  }
  return a.length - b.length;
}

/**
 * Compara dois registros válidos pela regra canônica de recência:
 * 1. `measuredAt` DESC
 * 2. `recordedAt` DESC (factual `recordedAt` vence `null`; `null` vs `null` segue)
 * 3. `entityId` DESC (desempate determinístico por unidades de código UTF-16)
 *
 * Retorna valor negativo se `a` for mais recente que `b` (vem antes em ordem decrescente),
 * valor positivo se `b` for mais recente que `a`, ou 0 se idênticos.
 *
 * Não muta arrays, não usa `localeCompare`, não usa `Date.toString()`.
 */
export function compareValidWeightRecency(
  a: PublicWeightAssessment,
  b: PublicWeightAssessment,
): number {
  const aMeasured = a.measuredAt.getTime();
  const bMeasured = b.measuredAt.getTime();

  if (aMeasured !== bMeasured) {
    return bMeasured - aMeasured;
  }

  const aRecorded = a.recordedAt;
  const bRecorded = b.recordedAt;

  if (aRecorded !== null && bRecorded === null) {
    return -1;
  }
  if (aRecorded === null && bRecorded !== null) {
    return 1;
  }
  if (aRecorded !== null && bRecorded !== null) {
    const aRecTime = aRecorded.getTime();
    const bRecTime = bRecorded.getTime();
    if (aRecTime !== bRecTime) {
      return bRecTime - aRecTime;
    }
  }

  if (a.entityId !== b.entityId) {
    const idCmp = compareUtf16CodeUnits(a.entityId, b.entityId);
    if (idCmp !== 0) {
      return idCmp > 0 ? -1 : 1;
    }
  }

  return 0;
}

// ─── Análise de Coleção ────────────────────────────────────────────────────

/**
 * Analisa a coleção completa de documentos de pesagem.
 * Não assume ordem de recência na entrada.
 */
export function analyzeWeightDocuments(
  options: AnalyzeWeightDocumentsOptions,
): WeightCollectionAnalysis {
  const { documents } = options;

  const validRecords: PublicWeightAssessment[] = [];
  const invalidatedRecords: PublicWeightAssessment[] = [];
  const anomalies: WeightCollectionAnomaly[] = [];

  const blockerKindSet = new Set<WeightCollectionBlockingKind>();
  const entityIdIndicesMap = new Map<string, number[]>();

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];

    let indices = entityIdIndicesMap.get(doc.entityId);
    if (!indices) {
      indices = [];
      entityIdIndicesMap.set(doc.entityId, indices);
    }
    indices.push(i);

    const result = readWeightDocument({
      data: doc.data,
      documentId: doc.entityId,
      dogId: doc.dogId,
      ...(doc.sourceCollection !== undefined
        ? { sourceCollection: doc.sourceCollection }
        : {}),
    });

    if (result.kind === "malformed") {
      blockerKindSet.add("malformed");
      const anomaly: WeightCollectionAnomalyMalformed = Object.freeze({
        diagnosticCodes: result.diagnostics,
        entityId: doc.entityId,
        inputIndex: i,
        kind: "malformed",
      });
      anomalies.push(anomaly);
    } else if (result.kind === "unsupported") {
      blockerKindSet.add("unsupported");
      const anomaly: WeightCollectionAnomalyUnsupported = Object.freeze({
        diagnosticCodes: result.diagnostics,
        entityId: doc.entityId,
        inputIndex: i,
        kind: "unsupported",
        schemaVersion: result.schemaVersion,
      });
      anomalies.push(anomaly);
    } else if (result.kind === "invalidated") {
      invalidatedRecords.push(result.assessment);
    } else if (result.kind === "valid") {
      validRecords.push(result.assessment);
    }
  }

  for (const [entityId, indices] of entityIdIndicesMap.entries()) {
    if (indices.length > 1) {
      blockerKindSet.add("duplicate_entity_id");
      const anomaly: WeightCollectionAnomalyDuplicateEntityId = Object.freeze({
        entityId,
        inputIndices: Object.freeze([...indices]),
        kind: "duplicate_entity_id",
      });
      anomalies.push(anomaly);
    }
  }

  const sortedValid = Object.freeze(
    [...validRecords].sort(compareValidWeightRecency),
  );

  let currentSelection: WeightCurrentSelection;

  if (blockerKindSet.size > 0) {
    const blockerKinds: WeightCollectionBlockingKind[] = [];
    if (blockerKindSet.has("malformed")) blockerKinds.push("malformed");
    if (blockerKindSet.has("unsupported")) blockerKinds.push("unsupported");
    if (blockerKindSet.has("duplicate_entity_id")) {
      blockerKinds.push("duplicate_entity_id");
    }

    currentSelection = Object.freeze({
      blockerKinds: Object.freeze(blockerKinds),
      kind: "inconclusive",
    });
  } else if (sortedValid.length > 0) {
    currentSelection = Object.freeze({
      assessment: sortedValid[0],
      kind: "current",
    });
  } else {
    currentSelection = Object.freeze({ kind: "none" });
  }

  return Object.freeze({
    anomalies: Object.freeze(anomalies),
    current: currentSelection,
    invalidatedRecords: Object.freeze(invalidatedRecords),
    validRecords: sortedValid,
  });
}
