/**
 * Dashboard domain utilities - extracted from dashboard/page.tsx
 * for testability and reuse.
 */

import { normalizeText } from "@/lib/parsing";

export { normalizeText };

export type DashboardRecord = Record<string, unknown> & { _id: string };

export type DashboardCollectionState = {
  error: string | null;
  loading: boolean;
  records: DashboardRecord[];
};

export type DrugCategory = "maconha" | "cocaina" | "crack" | "ecstasy" | "outros";
export type DrugStats = Record<DrugCategory, number>;

export const emptyDrugStats: DrugStats = {
  maconha: 0,
  cocaina: 0,
  crack: 0,
  ecstasy: 0,
  outros: 0,
};

export function emptyDashboardCollection(): DashboardCollectionState {
  return { error: null, loading: true, records: [] };
}

export function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return 0;
  }
  const cleaned = value.replace(/[^\d.,\-]/g, "").replace(",", ".");
  const result = parseFloat(cleaned);
  return Number.isFinite(result) ? result : 0;
}

export function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = normalizeText(value);
    if (["1", "ativo", "active", "sim", "true", "yes"].includes(normalized)) return true;
    if (["0", "false", "inativo", "inactive", "nao", "no"].includes(normalized)) return false;
  }
  return null;
}

export function hasValue(value: unknown) {
  return value != null && String(value).trim().length > 0;
}

export function isSoftDeleted(record: Record<string, unknown>) {
  const deletedFlag = parseBoolean(
    record.deleted ?? record.is_deleted ?? record.isDeleted ?? record.archived,
  );
  return (
    deletedFlag === true ||
    hasValue(record.deleted_at) ||
    hasValue(record.deletedAt) ||
    hasValue(record.archived_at) ||
    hasValue(record.archivedAt)
  );
}

export function visibleRecords(records: DashboardRecord[]) {
  return records.filter((record) => !isSoftDeleted(record));
}

export function recordText(record: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text.length > 0) return text;
    }
  }
  return "";
}

export function statusOf(record: Record<string, unknown>) {
  return normalizeText(
    record.status ?? record.current_status ?? record.state ?? record.situacao,
  );
}

export function dateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate.call(value);
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function isActiveRecord(record: Record<string, unknown>) {
  if (isSoftDeleted(record)) return false;
  const active = parseBoolean(record.active ?? record.is_active ?? record.isActive);
  if (active === false) return false;
  const status = statusOf(record);
  if (!status) return true;
  return ![
    "aposentado", "arquivado", "deleted", "encerrado", "ended",
    "excluido", "finalizado", "inactive", "inativo", "licenca",
  ].includes(status);
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function asArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>);
  return [];
}

export function drugCategory(type: unknown): DrugCategory {
  const value = normalizeText(type);
  if (value.includes("maconha") || value.includes("cannabis")) return "maconha";
  if (value.includes("cocaina") || value.includes("cocaine")) return "cocaina";
  if (value.includes("crack")) return "crack";
  if (value.includes("ecstasy") || value.includes("extasy") || value.includes("mdma")) return "ecstasy";
  return "outros";
}

export function drugEntriesFromOccurrence(data: Record<string, unknown>) {
  const details = asRecord(data.details);
  return [
    ...asArray(details?.drug_seized),
    ...asArray(details?.drugSeized),
    ...asArray(details?.drogasApreendidas),
    ...asArray(details?.drogas),
  ]
    .map(asRecord)
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
}

export function drugEntryGrams(entry: Record<string, unknown>) {
  const rawText = normalizeText(
    entry.quantity ?? entry.quantidade ?? entry.weight ?? entry.peso ?? "",
  );
  const grams = parseNumber(rawText || (entry.quantity ?? entry.quantidade ?? entry.weight ?? entry.peso));
  const unit = normalizeText(entry.unit ?? entry.unidade);
  if (rawText.includes("kg") || unit === "kg" || unit.includes("quilo")) {
    return grams * 1000;
  }
  return grams;
}

export function formatWeight(grams: number) {
  if (grams <= 0) return "--";
  if (grams < 1000) {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(grams)} g`;
  }
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(grams / 1000)} kg`;
}

export function formatPercent(value: number, total: number) {
  if (total <= 0) return "--";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format((value / total) * 100)}%`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

export function dogIdentity(record: Record<string, unknown>) {
  return (
    recordText(record, ["_id", "dogId", "dog_id", "id"]) || null
  );
}

export function occurrenceNature(record: Record<string, unknown>) {
  return (
    recordText(record, [
      "type_name", "typeName", "nature_name", "nature", "natureza", "type_code",
    ]) || "Nao informada"
  );
}

export function dashboardDateLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

export function daysFromToday(date: Date) {
  const difference = date.getTime() - startOfToday().getTime();
  return Math.ceil(difference / 86_400_000);
}

export type UserProfile = "admin" | "gestor" | "instrutor" | "operador";

export function detectUserProfile(options: {
  isK9Instructor?: boolean;
  roles?: string[];
  claims?: Record<string, unknown>;
}): UserProfile {
  const roles = (options.roles ?? []).map(normalizeText);
  const claims = options.claims ?? {};
  const isInstructor = options.isK9Instructor === true;
  const isAdmin = roles.includes("administrador") || roles.includes("admin") || claims.admin === true;
  const isGestor = roles.some((r) => ["gestor", "comando", "subinspetor", "inspetor", "coordenador"].includes(r));
  if (isAdmin) return "admin";
  if (isGestor) return "gestor";
  if (isInstructor) return "instrutor";
  return "operador";
}