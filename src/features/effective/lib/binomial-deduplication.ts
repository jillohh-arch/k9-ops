/**
 * Funções utilitárias para deduplicação de registros do binômio.
 * Isolado para permitir testes unitários sem dependência do Firebase.
 */

export type BinomialRecord = Record<string, unknown> & {
  _id: string;
  _source: string;
};

/**
 * Mapeamento explícito de fontes para famílias canônicas.
 * Cada fonte alternativa aponta para sua família canônica.
 * Mapeamento explícito evita agrupamento acidental de fontes diferentes.
 */
const SOURCE_FAMILY_MAP: Record<string, string> = {
  // training_sessions
  training_sessions: "training_sessions",
  training_sessions_legacy: "training_sessions",
  dogs_training_sessions: "training_sessions", // BUG-FS-002: subcoleção dogs/{id}/training_sessions
  trainings: "training_sessions",              // BUG-FS-002: coleção raiz trainings
  // occurrences
  occurrences: "occurrences",
  occurrences_legacy: "occurrences",
};

/**
 * Normaliza _source para identidade canônica.
 * Documentos da mesma família recebem a mesma chave,
 * independente do listener que os retornou.
 *
 * CRÍTICO: Não usar regex genérico como source.replace(/_legacy$/, "")
 * porque poderia agrupar fontes diferentes sem intenção.
 */
export function canonicalSource(source: string): string {
  return SOURCE_FAMILY_MAP[source] ?? source;
}

/**
 * Conta quantos campos do registro não são null/undefined/vazio.
 * Usado para precedência em merges.
 */
export function countValidFields(record: Record<string, unknown>): number {
  return Object.values(record).filter(
    (v) => v !== null && v !== undefined && v !== "",
  ).length;
}

/**
 * Merge dois registros com precedência determinística:
 * 1. Mesmo ID e família de fonte
 * 2. Preferir o registro com mais campos válidos
 * 3. Em caso de empate, preferir fonte canônica (sem sufixo "_legacy")
 * 4. Nunca depender da ordem de chegada dos snapshots
 */
export function mergeRecords(
  existing: BinomialRecord,
  incoming: BinomialRecord,
): BinomialRecord {
  const existingFields = countValidFields(existing);
  const incomingFields = countValidFields(incoming);

  // Preferir o com mais campos válidos
  if (incomingFields > existingFields) {
    return { ...incoming, _source: canonicalSource(incoming._source) };
  }
  if (existingFields > incomingFields) {
    return existing;
  }

  // Empate: preferir fonte canônica
  const incomingCanonical = canonicalSource(incoming._source);
  const existingCanonical = canonicalSource(existing._source);
  const incomingIsLegacy =
    incoming._source !== incomingCanonical;
  const existingIsLegacy = existing._source !== existingCanonical;

  if (existingIsLegacy && !incomingIsLegacy) {
    return { ...incoming, _source: incomingCanonical };
  }
  if (incomingIsLegacy && !existingIsLegacy) {
    return existing;
  }

  // Ambos legacy ou ambos canônicos: manter o existente (determinístico)
  return existing;
}

/**
 * Função auxiliar para deduplicar um array de registros.
 * Útil para testes e validação de lógica.
 */
export function deduplicateRecords(records: BinomialRecord[]): BinomialRecord[] {
  const byIdentity = new Map<string, BinomialRecord>();
  for (const record of records) {
    const key = `${canonicalSource(record._source)}:${record._id}`;
    const existing = byIdentity.get(key);
    if (existing) {
      byIdentity.set(key, mergeRecords(existing, record));
    } else {
      // Normalizar _source para canônica mesmo quando não há merge
      byIdentity.set(key, {
        ...record,
        _source: canonicalSource(record._source),
      });
    }
  }
  return Array.from(byIdentity.values());
}
