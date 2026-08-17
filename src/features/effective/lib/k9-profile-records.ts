/**
 * Leitura pura de registros de perfil.
 *
 * Estes helpers vivem fora dos hooks de propósito: `use-k9-profile-data.ts` é
 * um módulo `"use client"` que importa o cliente Firebase, então qualquer lib
 * pura que dependesse dele arrastaria a inicialização do Firebase para dentro
 * de testes unitários. Aqui não há I/O nem dependência de ambiente.
 */

export type ProfileRecord = Record<string, unknown> & {
  _id: string;
  _source?: string;
};

/** Primeiro valor textual não vazio entre as chaves informadas. */
export function profileText(
  record: Record<string, unknown> | null,
  keys: string[],
) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return null;
}

export function profileNumber(
  record: Record<string, unknown> | null,
  keys: string[],
) {
  const value = profileText(record, keys);
  if (value == null) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Converte Date, string, número ou Timestamp do Firestore em `Date`. */
export function profileDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime())
        ? parsed
        : null;
    }
  }
  return null;
}

/**
 * Data canônica de um registro, na ordem de preferência das chaves reais
 * usadas pelas coleções do projeto.
 */
export function profileRecordDate(record: Record<string, unknown>) {
  const keys = [
    "date",
    "measured_at",
    "measuredAt",
    "performed_at",
    "performedAt",
    "started_at",
    "startedAt",
    "finalized_at",
    "finalizedAt",
    "dataUpload",
    "created_at",
    "createdAt",
    "updated_at",
    "updatedAt",
  ];
  for (const key of keys) {
    const parsed = profileDate(record[key]);
    if (parsed) return parsed;
  }
  return null;
}
