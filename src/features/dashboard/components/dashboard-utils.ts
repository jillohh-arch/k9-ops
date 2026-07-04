import type {
  DashboardCollectionKey,
  DashboardCollections,
  DashboardCollectionState,
  DashboardRecord,
  DogHealthStatus,
  DrugCategory,
  DrugStats,
  HealthMetrics,
  IntegrityMetrics,
  OccurrenceMetrics,
  PendingMetrics,
  SummaryCardData,
} from "./dashboard-types";

export type { DrugStats };

import type { DashboardPeriodDays } from "@/features/dashboard/providers/dashboard-period-provider";

/* ─── Text helpers ─── */

export function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/* ─── Drug helpers ─── */

export function drugCategory(type: unknown): DrugCategory {
  const value = normalizeText(type);

  if (value.includes("maconha") || value.includes("cannabis")) {
    return "maconha";
  }

  if (value.includes("cocaina") || value.includes("cocaine")) {
    return "cocaina";
  }

  if (value.includes("crack")) {
    return "crack";
  }

  if (
    value.includes("ecstasy") ||
    value.includes("extasy") ||
    value.includes("mdma")
  ) {
    return "ecstasy";
  }

  return "outros";
}

export function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const cleaned = value
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function entryWeightGrams(entry: Record<string, unknown>) {
  if (entry.weight_kg != null || entry.weightKg != null) {
    return parseNumber(entry.weight_kg ?? entry.weightKg) * 1000;
  }

  const raw =
    entry.weight_grams ??
    entry.weightGrams ??
    entry.grams ??
    entry.weight ??
    entry.quantidade ??
    entry.quantity;
  const grams = parseNumber(raw);
  const rawText = normalizeText(raw);
  const unit = normalizeText(entry.unit ?? entry.unidade);

  if (rawText.includes("kg") || unit === "kg" || unit.includes("quilo")) {
    return grams * 1000;
  }

  return grams;
}

/* ─── Firestore helpers ─── */

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function asArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>);
  }

  return [];
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

/* ─── Formatting ─── */

export function formatWeight(grams: number) {
  if (grams <= 0) {
    return "--";
  }

  if (grams < 1000) {
    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 0,
    }).format(grams)} g`;
  }

  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(grams / 1000)} kg`;
}

export function formatPercent(value: number, total: number) {
  if (total <= 0) {
    return "--";
  }

  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format((value / total) * 100)}%`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}

/* ─── Boolean/state helpers ─── */

export function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = normalizeText(value);
    if (["1", "ativo", "active", "sim", "true", "yes"].includes(normalized)) {
      return true;
    }

    if (
      ["0", "false", "inativo", "inactive", "nao", "no"].includes(normalized)
    ) {
      return false;
    }
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
      if (text.length > 0) {
        return text;
      }
    }
  }

  return "";
}

export function statusOf(record: Record<string, unknown>) {
  return normalizeText(
    record.status ?? record.current_status ?? record.state ?? record.situação,
  );
}

/* ─── Date helpers ─── */

export function dateValue(value: unknown): Date | null {
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

export function occurrenceDate(record: Record<string, unknown>) {
  return dateValue(
    record.started_at ??
      record.startedAt ??
      record.created_at ??
      record.createdAt,
  );
}

export function periodStart(days: DashboardPeriodDays) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/* ─── Dog helpers ─── */

export function dogIdentity(record: Record<string, unknown>) {
  return recordText(record, ["dogId", "dog_id", "_dogId", "_id"]);
}

export function dogName(record: Record<string, unknown>) {
  return recordText(record, ["name", "nome", "dogName", "dog_name"]) || "K9";
}

export function healthEventType(record: Record<string, unknown>) {
  const explicitType = normalizeText(record.type);
  if (explicitType) {
    return explicitType;
  }

  const legacy = normalizeText(record.logType);
  if (legacy.includes("vacin")) {
    return "vaccination";
  }
  if (legacy.includes("exame")) {
    return "exam";
  }

  return legacy;
}

export function healthEventDate(record: Record<string, unknown>) {
  return dateValue(
    record.date ??
      record.event_date ??
      record.eventDate ??
      record.created_at ??
      record.createdAt,
  );
}

export function healthEventDueDate(record: Record<string, unknown>) {
  return dateValue(record.nextDueDate ?? record.next_due_date);
}

export function weightRecordDate(record: Record<string, unknown>) {
  return dateValue(
    record.measured_at ??
      record.measuredAt ??
      record.created_at ??
      record.createdAt,
  );
}

export function weightRecordValue(record: Record<string, unknown>) {
  return parseNumber(
    record.weight_kg ?? record.weightKg ?? record.weight ?? record.peso,
  );
}

export function dogIdealWeightRange(record: Record<string, unknown>) {
  const min = parseNumber(
    record.idealWeightMin ?? record.ideal_weight_min ?? record.peso_mínimo,
  );
  const max = parseNumber(
    record.idealWeightMax ?? record.ideal_weight_max ?? record.peso_máximo,
  );

  return min > 0 && max >= min ? { max, min } : null;
}

export function daysFromToday(date: Date) {
  const difference = date.getTime() - startOfToday().getTime();
  return Math.ceil(difference / 86_400_000);
}

/* ─── Occurrence helpers ─── */

export function occurrenceNature(record: Record<string, unknown>) {
  return (
    recordText(record, [
      "type_name",
      "typeName",
      "nature_name",
      "nature",
      "natureza",
      "type_code",
    ]) || "Não informada"
  );
}

export function hasAuditAction(
  record: Record<string, unknown>,
  expectedAction: string,
) {
  const normalizedExpected = normalizeText(expectedAction);

  return asArray(record.audit_trail).some((rawEntry) => {
    const entry = asRecord(rawEntry);
    return entry != null && normalizeText(entry.action) === normalizedExpected;
  });
}

/* ─── Dashboard date ─── */

export function dashboardDateLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

/* ─── Record filter helpers ─── */

export function isActiveRecord(record: Record<string, unknown>) {
  if (isSoftDeleted(record)) {
    return false;
  }

  const active = parseBoolean(
    record.active ?? record.is_active ?? record.isActive,
  );
  if (active === false) {
    return false;
  }

  const status = statusOf(record);
  if (!status) {
    return true;
  }

  return ![
    "aposentado",
    "arquivado",
    "deleted",
    "encerrado",
    "ended",
    "excluido",
    "finalizado",
    "inactive",
    "inativo",
    "licenca",
  ].includes(status);
}

export function isK9Instructor(record: Record<string, unknown>) {
  const roles = asArray(record.roles).map(normalizeText);

  return (
    record.is_k9_instructor === true ||
    record.training_instructor === true ||
    normalizeText(record.training_role) === "instrutor_k9" ||
    normalizeText(record.role) === "instrutor_k9" ||
    roles.includes("instrutor_k9")
  );
}

export function isActiveShift(record: Record<string, unknown>) {
  if (isSoftDeleted(record)) {
    return false;
  }

  const status = statusOf(record);
  if (status) {
    return ["active", "ativo", "em_andamento"].includes(status);
  }

  return (
    parseBoolean(record.active) !== false &&
    !hasValue(record.endedAt) &&
    !hasValue(record.ended_at)
  );
}

export function isActiveVehicleCrew(record: Record<string, unknown>) {
  if (isSoftDeleted(record)) {
    return false;
  }

  const status = statusOf(record);
  if (status) {
    return ["active", "ativo", "titular"].includes(status);
  }

  // Aceitar cycle reaberto: active:true mesmo que ended_at antigo persista (resíduo
  // de ciclo anterior). Só bloqueia se active for explicitamente false OU status
  // de encerramento explícito.
  if (parseBoolean(record.active) === true) {
    return true;
  }

  return false;
}

export function hasDogAndHandler(record: Record<string, unknown>) {
  return (
    hasValue(record.dogId ?? record.service_dog_id) &&
    hasValue(record.handlerId ?? record.titular_handler_id ?? record.handler_id)
  );
}

export function vehicleIdentity(record: Record<string, unknown>) {
  return recordText(record, [
    "vehicle_id",
    "vehicleId",
    "vehicle_prefix",
    "vehiclePrefix",
    "prefix",
    "vehicle_label",
    "label",
  ]);
}

/* ─── Tone classes ─── */

/**
 * Canonical tone palette used across dashboard components.
 *
 * The class maps below use literal Tailwind class names (no dynamic
 * interpolation) so the Tailwind 4 content scanner picks them up in
 * production builds. Whenever you need to compose a new look from one
 * of these tones, prefer adding a new entry here over building class
 * strings with template literals.
 */

export type DashboardTone = "amber" | "blue" | "cyan" | "emerald" | "red" | "violet";

export const dashboardTones = [
  "amber",
  "blue",
  "cyan",
  "emerald",
  "red",
  "violet",
] as const satisfies readonly DashboardTone[];

const cardBorderByTone: Record<DashboardTone, string> = {
  amber: "border-amber-300/20",
  blue: "border-blue-300/20",
  cyan: "border-cyan-300/20",
  emerald: "border-emerald-300/20",
  red: "border-red-300/20",
  violet: "border-violet-300/20",
};

const cardGlyphBgByTone: Record<DashboardTone, string> = {
  amber: "bg-amber-300/10",
  blue: "bg-blue-300/10",
  cyan: "bg-cyan-300/10",
  emerald: "bg-emerald-300/10",
  red: "bg-red-300/10",
  violet: "bg-violet-300/10",
};

const cardGlyphTextByTone: Record<DashboardTone, string> = {
  amber: "text-amber-200",
  blue: "text-blue-200",
  cyan: "text-cyan-200",
  emerald: "text-emerald-200",
  red: "text-red-200",
  violet: "text-violet-200",
};

const cardGlyphBorderByTone: Record<DashboardTone, string> = {
  amber: "border-amber-300/30",
  blue: "border-blue-300/30",
  cyan: "border-cyan-300/30",
  emerald: "border-emerald-300/30",
  red: "border-red-300/30",
  violet: "border-violet-300/30",
};

const segmentFillByTone: Record<DashboardTone, string> = {
  amber: "bg-amber-300",
  blue: "bg-blue-300",
  cyan: "bg-cyan-300",
  emerald: "bg-emerald-300",
  red: "bg-red-300",
  violet: "bg-violet-300",
};

const connectionStrokeByTone: Record<DashboardTone, string> = {
  amber: "stroke-amber-300/70",
  blue: "stroke-blue-300/70",
  cyan: "stroke-cyan-300/70",
  emerald: "stroke-emerald-300/70",
  red: "stroke-red-300/70",
  violet: "stroke-violet-300/70",
};

const ringStrokeByTone: Record<DashboardTone, string> = {
  amber: "stroke-amber-300",
  blue: "stroke-blue-300",
  cyan: "stroke-cyan-300",
  emerald: "stroke-emerald-300",
  red: "stroke-red-300",
  violet: "stroke-violet-300",
};

const gradientStopByTone: Record<DashboardTone, { from: string; to: string }> = {
  amber: { from: "#fcd34d", to: "#22d3ee" },
  blue: { from: "#60a5fa", to: "#22d3ee" },
  cyan: { from: "#22d3ee", to: "#22d3ee" },
  emerald: { from: "#34d399", to: "#22d3ee" },
  red: { from: "#f87171", to: "#22d3ee" },
  violet: { from: "#a78bfa", to: "#22d3ee" },
};

export const toneClasses = (tone: string) => {
  const tones: Record<string, string> = {
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    blue: "border-blue-300/25 bg-blue-300/10 text-blue-200",
    cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
    emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
    red: "border-red-300/25 bg-red-300/10 text-red-200",
    violet: "border-violet-300/25 bg-violet-300/10 text-violet-200",
  };

  return tones[tone] ?? tones.cyan;
};

/**
 * Resolve a tone key for any of the HUD sub-components. Falls back to
 * "cyan" so the visual always carries the brand colour when an
 * unknown token is supplied.
 */
export function dashboardTone(tone: string | undefined | null): DashboardTone {
  return (dashboardTones as readonly string[]).includes(tone ?? "")
    ? (tone as DashboardTone)
    : "cyan";
}

export function cardBorderClass(tone: string) {
  return cardBorderByTone[dashboardTone(tone)];
}

export function cardGlyphBgClass(tone: string) {
  return cardGlyphBgByTone[dashboardTone(tone)];
}

export function cardGlyphTextClass(tone: string) {
  return cardGlyphTextByTone[dashboardTone(tone)];
}

export function cardGlyphBorderClass(tone: string) {
  return cardGlyphBorderByTone[dashboardTone(tone)];
}

export function segmentFillClass(tone: string) {
  return segmentFillByTone[dashboardTone(tone)];
}

export function connectionStrokeClass(tone: string) {
  return connectionStrokeByTone[dashboardTone(tone)];
}

export function ringStrokeClass(tone: string) {
  return ringStrokeByTone[dashboardTone(tone)];
}

export function gradientStop(tone: string) {
  return gradientStopByTone[dashboardTone(tone)];
}

/* ─── Profile Detection ─── */

export type { UserProfile } from "./dashboard-types";

export function detectUserProfile(profile: {
  isK9Instructor?: boolean;
  roles?: string[];
  claims?: Record<string, unknown>;
}): import("./dashboard-types").UserProfile {
  const roles = profile.roles ?? [];
  const claims = profile.claims ?? {};
  const isInstructor = profile.isK9Instructor === true || roles.includes("instrutor_k9") || claims.instrutor_k9 === true;
  const isAdmin = roles.includes("admin") || roles.includes("administrador") || claims.admin === true;
  const isGestor = roles.some((r) => ["gestor", "comando", "subinspetor", "inspetor", "coordenador"].includes(r));

  if (isAdmin) return "admin";
  if (isGestor) return "gestor";
  if (isInstructor) return "instrutor";
  return "operador";
}

/* ─── Constants ─── */

export const summaryCardMeta = [
  {
    collection: "dogs",
    label: "Efetivo K9",
    image: "/assets/card_k9.png",
    imageClassName: "right-0 -bottom-2 h-[154px] w-[360px]",
    tone: "cyan",
  },
  {
    collection: "users",
    label: "Efetivo Humano",
    image: "/assets/card_humano.png",
    imageClassName: "right-0 -bottom-2 h-[154px] w-[360px]",
    tone: "emerald",
  },
  {
    collection: "binomials",
    label: "Binômios",
    image: "/assets/card_binomio.png",
    imageClassName: "right-0 -bottom-2 h-[154px] w-[360px]",
    tone: "amber",
  },
  {
    collection: "vehicles",
    label: "Viaturas",
    image: "/assets/card_viatura.png",
    imageClassName: "right-0 -bottom-2 h-[154px] w-[360px]",
    tone: "violet",
  },
] as const;

export const drugTiles = [
  {
    label: "Maconha",
    category: "maconha",
    className: "from-emerald-400/30 to-teal-950/72",
    glyph: "ma",
  },
  {
    label: "Cocaina",
    category: "cocaina",
    className: "from-blue-400/28 to-blue-950/70",
    glyph: "co",
  },
  {
    label: "Crack",
    category: "crack",
    className: "from-violet-400/34 to-purple-950/72",
    glyph: "cr",
  },
  {
    label: "Ecstasy",
    category: "ecstasy",
    className: "from-orange-400/34 to-orange-950/72",
    glyph: "ex",
  },
  {
    label: "Outros",
    category: "outros",
    className: "from-slate-400/22 to-slate-950/72",
    glyph: "ot",
  },
] as const;

export type DrugTileItem = (typeof drugTiles)[number];

export const emptyDrugStats = {
  maconha: 0,
  cocaina: 0,
  crack: 0,
  ecstasy: 0,
  outros: 0,
} as const;

/* ─── Drug HUD display helpers ─── */

/**
 * Tone associated with each drug category. Defined here so the HUD view
 * never has to know about business categories — only tones.
 */
const drugCategoryTone: Record<DrugCategory, DashboardTone> = {
  maconha: "emerald",
  cocaina: "blue",
  crack: "violet",
  ecstasy: "amber",
  outros: "cyan",
};

const drugTilesByCategory: Record<DrugCategory, { glyph: string; label: string }> =
  drugTiles.reduce(
    (acc, tile) => {
      acc[tile.category] = { glyph: tile.glyph, label: tile.label };
      return acc;
    },
    {} as Record<DrugCategory, { glyph: string; label: string }>,
  );

/**
 * Ordered list of drug categories as they should appear in the HUD.
 * The first three slots map to the main visual composition; the
 * remainder are aggregated under a "+N categorias" badge.
 */
export const HUD_PRIMARY_SLOTS = 3;

export interface DrugDisplayItem {
  /** Stable id — either the category or a synthetic id for aggregates. */
  id: string;
  /** Display name (already localised). */
  name: string;
  /** Substance abbreviation used inside the glyph badge. */
  glyph: string;
  /** Amount in grams (the canonical unit for this dataset). */
  grams: number;
  /** Percentage relative to the total (0..100). */
  percent: number;
  /** Tone key — always one of {@link DashboardTone}. */
  tone: DashboardTone;
  /** True when this item represents an aggregate of remaining categories. */
  isAggregate: boolean;
}

export interface DrugDisplaySummary {
  items: DrugDisplayItem[];
  /** Number of underlying categories that fed into the items list. */
  categoryCount: number;
  /** Sum of grams from the primary + aggregate items. */
  totalGrams: number;
  /** True when more than HUD_PRIMARY_SLOTS categories are present. */
  hasOverflow: boolean;
  /** Number of categories collapsed into the aggregate item (0 if none). */
  overflowCount: number;
}

interface BuildDrugDisplayInput {
  drugStats: DrugStats;
  /** Optional override list of categories. When provided, restricts the
   *  iteration to those present in the dashboard's `visibleDrugTiles`.
   *  When omitted, ALL categories present in `drugStats` are evaluated. */
  categoryOrder?: readonly DrugCategory[];
}

/**
 * Builds the canonical list of items rendered by the HUD section.
 *
 * The dashboard page already computes `drugStats` and `totalDrugGrams`
 * from occurrences. This helper does not recompute those totals — it
 * only shapes the data for the HUD view, deciding which categories
 * appear as primary cards and which are aggregated.
 *
 * Behaviour:
 *  - Sorts categories by grams desc (ties broken by display order).
 *  - Keeps the top three as primary items.
 *  - Aggregates the remaining grams into a single "+N categorias"
 *    item so the layout stays balanced even with many categories.
 *  - Returns `totalGrams: 0` and `items: []` when no grams exist.
 */
export function buildDrugDisplayItems(
  input: BuildDrugDisplayInput,
): DrugDisplaySummary {
  const { drugStats, categoryOrder } = input;

  const allCategories = (
    categoryOrder ?? (Object.keys(drugStats) as DrugCategory[])
  ).filter((category): category is DrugCategory => category in drugStats);

  const nonZero = allCategories.filter((category) => drugStats[category] > 0);

  const ordered = [...nonZero].sort((a, b) => {
    const diff = drugStats[b] - drugStats[a];
    if (diff !== 0) return diff;
    return allCategories.indexOf(a) - allCategories.indexOf(b);
  });

  const primaryCategories = ordered.slice(0, HUD_PRIMARY_SLOTS);
  const overflowCategories = ordered.slice(HUD_PRIMARY_SLOTS);

  const primaryItems: DrugDisplayItem[] = primaryCategories.map((category) => {
    const grams = drugStats[category];
    return {
      grams,
      glyph: drugTilesByCategory[category].glyph,
      id: category,
      isAggregate: false,
      name: drugTilesByCategory[category].label,
      percent: 0, // recalculated below once the total is known
      tone: drugCategoryTone[category],
    };
  });

  let overflowItem: DrugDisplayItem | null = null;
  if (overflowCategories.length > 0) {
    const overflowGrams = overflowCategories.reduce(
      (sum, category) => sum + drugStats[category],
      0,
    );
    overflowItem = {
      grams: overflowGrams,
      glyph: "+",
      id: "aggregate",
      isAggregate: true,
      name: `+${overflowCategories.length} categorias`,
      percent: 0,
      tone: "cyan",
    };
  }

  const totalGrams =
    primaryItems.reduce((sum, item) => sum + item.grams, 0) +
    (overflowItem?.grams ?? 0);

  const assignPercent = (item: DrugDisplayItem): DrugDisplayItem => ({
    ...item,
    percent: totalGrams > 0 ? (item.grams / totalGrams) * 100 : 0,
  });

  const items: DrugDisplayItem[] = [
    ...primaryItems.map(assignPercent),
    ...(overflowItem ? [assignPercent(overflowItem)] : []),
  ];

  return {
    categoryCount: ordered.length,
    hasOverflow: overflowCategories.length > 0,
    items,
    overflowCount: overflowCategories.length,
    totalGrams,
  };
}

/* ─── Dashboard collection factory ─── */

export const dashboardCollectionPaths: Array<{
  key: DashboardCollectionKey;
  path: string;
}> = [
  { key: "activeShifts", path: "active_shifts" },
  { key: "dogs", path: "dogs" },
  { key: "users", path: "users" },
  { key: "vehicleCrews", path: "vehicle_crews" },
  { key: "vehicles", path: "vehicles" },
];

export function emptyDashboardCollection(): DashboardCollectionState {
  return {
    error: null,
    loading: true,
    records: [],
  };
}

export function createDashboardCollections(): DashboardCollections {
  return {
    activeShifts: emptyDashboardCollection(),
    dogs: emptyDashboardCollection(),
    users: emptyDashboardCollection(),
    vehicleCrews: emptyDashboardCollection(),
    vehicles: emptyDashboardCollection(),
  };
}

/* ─── Computed metrics helpers ─── */

export function computeOccurrenceMetrics(
  allRecords: DashboardRecord[],
  periodOccurrences: DashboardRecord[],
): OccurrenceMetrics {
  const inPeriod = periodOccurrences;
  const finalized = inPeriod.filter((o) =>
    ["finalized", "finalized_with_pending"].includes(statusOf(o)),
  );
  const open = inPeriod.filter(
    (o) => !["finalized", "finalized_with_pending", "canceled", "cancelled"].includes(statusOf(o)),
  );
  const awaitingSignatures = inPeriod.filter(
    (o) => statusOf(o) === "awaiting_signatures",
  );
  const natureMap = new Map<string, number>();
  for (const o of inPeriod) {
    const nature = occurrenceNature(o);
    natureMap.set(nature, (natureMap.get(nature) ?? 0) + 1);
  }
  const natures = [...natureMap.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percent: inPeriod.length > 0 ? (value / inPeriod.length) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    awaitingSignatures: awaitingSignatures.length,
    finalized: finalized.length,
    natures,
    open: open.length,
    total: inPeriod.length,
  };
}

export function computePendingMetrics(
  occurrenceRecords: DashboardRecord[],
  notificationRecords: DashboardRecord[],
  promotionRecords: DashboardRecord[],
): PendingMetrics {
  const allOccurrences = visibleRecords(occurrenceRecords);
  const awaitingSignatureOccurrences = allOccurrences.filter(
    (o) => statusOf(o) === "awaiting_signatures",
  );
  const finalizingOccurrences = allOccurrences.filter((o) =>
    ["finalizing", "in_progress"].includes(statusOf(o)),
  );
  const finalizedWithPending = allOccurrences.filter(
    (o) => statusOf(o) === "finalized_with_pending",
  );
  const pendingPromotions = visibleRecords(promotionRecords).filter(
    (r) => statusOf(r) === "pending",
  );
  const personalActions = visibleRecords(notificationRecords).filter(
    (n) => !isSoftDeleted(n) && statusOf(n) !== "done",
  );

  return {
    awaitingSignatureOccurrences: awaitingSignatureOccurrences.length,
    finalizedWithPending: finalizedWithPending.length,
    finalizingOccurrences: finalizingOccurrences.length,
    pendingPromotions: pendingPromotions.length,
    personalActions: personalActions.length,
  };
}

export function computeIntegrityMetrics(
  occurrenceRecords: DashboardRecord[],
): IntegrityMetrics {
  const allOccurrences = visibleRecords(occurrenceRecords);
  const finalized = allOccurrences.filter((o) =>
    ["finalized", "finalized_with_pending"].includes(statusOf(o)),
  );
  const sealed = finalized.filter((o) => {
    const hash = recordText(o, ["integrity_hash", "hash"]);
    return hash.length === 64;
  });
  const awaitingSignatures = allOccurrences.filter(
    (o) => statusOf(o) === "awaiting_signatures",
  );
  const correctionsInProgress = allOccurrences.filter((o) => {
    const status = statusOf(o);
    return (
      ["in_progress", "finalizing"].includes(status) &&
      hasAuditAction(o, "reverted_to_draft")
    );
  });
  const versions = [1, 2, 3, 4].map((version) => ({
    version,
    count: sealed.filter(
      (o) =>
        Math.round(parseNumber(o.hash_version ?? o.hashVersion ?? 1)) === version,
    ).length,
  }));

  return {
    awaitingSignatures: awaitingSignatures.length,
    correctionsInProgress: correctionsInProgress.length,
    coverage: finalized.length > 0 ? (sealed.length / finalized.length) * 100 : 0,
    finalized: finalized.length,
    sealed: sealed.length,
    versions,
  };
}

export function computeHealthMetrics(
  dogRecords: DashboardRecord[],
  healthRecords: DashboardRecord[],
  weightRecordsArr: DashboardRecord[],
  periodDays: DashboardPeriodDays,
): HealthMetrics {
  const activeDogs = visibleRecords(dogRecords).filter(isActiveRecord);
  const activeHealthEvents = visibleRecords(healthRecords);
  const activeWeightRecords = visibleRecords(weightRecordsArr);
  const healthByDog = new Map<string, DashboardRecord[]>();
  const weightsByDog = new Map<string, DashboardRecord[]>();

  for (const event of activeHealthEvents) {
    const id = dogIdentity(event);
    if (!id) continue;
    healthByDog.set(id, [...(healthByDog.get(id) ?? []), event]);
  }

  for (const record of activeWeightRecords) {
    const id = dogIdentity(record);
    if (!id) continue;
    weightsByDog.set(id, [...(weightsByDog.get(id) ?? []), record]);
  }

  const statuses: DogHealthStatus[] = activeDogs.map((dog) => {
    const id = dogIdentity(dog);
    const events = healthByDog.get(id) ?? [];
    const vaccines = events
      .filter((e) => healthEventType(e) === "vaccination")
      .map((e) => ({ appliedAt: healthEventDate(e), dueAt: healthEventDueDate(e) }))
      .filter((e): e is { appliedAt: Date; dueAt: Date | null } => e.appliedAt != null)
      .sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime());
    const snapshotVaccineDate = dateValue(dog.lastVaccineDate ?? dog.last_vaccine_date);
    const latestVaccine = vaccines[0];
    const vaccineDueDate = latestVaccine
      ? latestVaccine.dueAt ?? addDays(latestVaccine.appliedAt, 365)
      : snapshotVaccineDate
        ? addDays(snapshotVaccineDate, 365)
        : null;
    const vaccineDays = vaccineDueDate ? daysFromToday(vaccineDueDate) : null;
    const vaccine: DogHealthStatus["vaccine"] =
      vaccineDays == null ? "missing" : vaccineDays < 0 ? "overdue" : vaccineDays <= 30 ? "due_soon" : "current";

    const dogWeights = weightsByDog.get(id) ?? [];
    const latestWeight = dogWeights
      .map((w) => ({ date: weightRecordDate(w), value: weightRecordValue(w) }))
      .filter((w): w is { date: Date; value: number } => w.date != null && w.value > 0)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    const idealRange = dogIdealWeightRange(dog);
    const weight: DogHealthStatus["weight"] = !latestWeight
      ? "missing"
      : !idealRange
        ? "missing_range"
        : latestWeight.value >= idealRange.min && latestWeight.value <= idealRange.max
          ? "in_range"
          : "out_of_range";

    const exams = events
      .filter((e) => healthEventType(e) === "exam")
      .map((e) => ({ date: healthEventDate(e), dueAt: healthEventDueDate(e) }))
      .filter((e): e is { date: Date; dueAt: Date | null } => e.date != null)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    const latestExam = exams[0];
    const examDueDate = latestExam
      ? latestExam.dueAt ?? addDays(latestExam.date, 180)
      : null;
    const exam: DogHealthStatus["exam"] = !examDueDate
      ? "missing"
      : daysFromToday(examDueDate) < 0
        ? "due"
        : "current";

    const issues: DogHealthStatus["issues"] = [];
    if (vaccine === "overdue") issues.push({ label: "Vacina vencida", detail: `Vencida ha ${Math.abs(vaccineDays!)} dias`, severity: "critical" });
    if (vaccine === "due_soon") issues.push({ label: "Vacina a vencer", detail: `Vence em ${vaccineDays} dias`, severity: "warning" });
    if (vaccine === "missing") issues.push({ label: "Vacina nao registrada", detail: "Nenhum registro encontrado", severity: "missing" });
    if (weight === "out_of_range") issues.push({ label: "Peso fora do intervalo", detail: `${latestWeight!.value.toFixed(1)} kg`, severity: "warning" });
    if (weight === "missing") issues.push({ label: "Peso nao registrado", detail: "Sem pesagem registrada", severity: "missing" });
    if (weight === "missing_range") issues.push({ label: "Faixa ideal nao definida", detail: "Cadastrar peso ideal", severity: "missing" });
    if (exam === "due") issues.push({ label: "Exame pendente", detail: "Periodicidade excedida", severity: "warning" });
    if (exam === "missing") issues.push({ label: "Exame nao registrado", detail: "Nenhum exame encontrado", severity: "missing" });

    return {
      dogId: id,
      dogName: dogName(dog),
      exam,
      issues,
      ready: vaccine === "current" && weight === "in_range",
      vaccine,
      weight,
    };
  });

  const severityOrder = { critical: 3, warning: 2, missing: 1 };
  const attention = statuses
    .filter((s) => s.issues.length > 0)
    .sort((a, b) => {
      const aSev = Math.max(...a.issues.map((i) => severityOrder[i.severity]));
      const bSev = Math.max(...b.issues.map((i) => severityOrder[i.severity]));
      return bSev - aSev || a.dogName.localeCompare(b.dogName);
    })
    .slice(0, 4);

  const periodHealthEvents = activeHealthEvents.filter((event) => {
    const eventDate = healthEventDate(event);
    return eventDate != null && eventDate >= periodStart(periodDays);
  });

  return {
    attention,
    critical: statuses.filter((s) => s.issues.some((i) => i.severity === "critical")).length,
    incomplete: statuses.filter((s) => s.vaccine === "missing" || s.weight === "missing" || s.weight === "missing_range").length,
    outOfRangeWeight: statuses.filter((s) => s.weight === "out_of_range").length,
    periodEvents: periodHealthEvents.length,
    ready: statuses.filter((s) => s.ready).length,
    total: statuses.length,
    vaccinesDueSoon: statuses.filter((s) => s.vaccine === "due_soon").length,
    vaccinesOverdue: statuses.filter((s) => s.vaccine === "overdue").length,
  };
}

export function computeSummaryCards(
  dashboardCollections: DashboardCollections,
): SummaryCardData[] {
  const dogRecords = visibleRecords(dashboardCollections.dogs.records);
  const activeDogs = dogRecords.filter(isActiveRecord);
  const userRecords = visibleRecords(dashboardCollections.users.records);
  const activeUsers = userRecords.filter(isActiveRecord);
  const instructors = userRecords.filter(isK9Instructor);
  const activeShifts = dashboardCollections.activeShifts.records.filter(isActiveShift);
  const activeVehicleCrews = dashboardCollections.vehicleCrews.records.filter(isActiveVehicleCrew);
  const activeBinomials = activeShifts.filter(hasDogAndHandler);
  const vehicleRecords = visibleRecords(dashboardCollections.vehicles.records).filter(isActiveRecord);
  const vehiclesInUse = new Set(
    [...activeShifts, ...activeVehicleCrews].map(vehicleIdentity).filter(Boolean),
  );

  const metrics: Record<string, { detail: string; error: string | null; loading: boolean; value: number }> = {
    binomials: {
      detail: activeVehicleCrews.length > 0
        ? `${formatCount(activeVehicleCrews.length)} guarnicoes em viatura`
        : `${formatCount(activeShifts.length)} turnos ativos`,
      error: dashboardCollections.activeShifts.error ?? dashboardCollections.vehicleCrews.error,
      loading: dashboardCollections.activeShifts.loading || dashboardCollections.vehicleCrews.loading,
      value: activeBinomials.length > 0 ? activeBinomials.length : activeVehicleCrews.length,
    },
    dogs: {
      detail: `${formatCount(activeDogs.length)} ativos`,
      error: dashboardCollections.dogs.error,
      loading: dashboardCollections.dogs.loading,
      value: dogRecords.length,
    },
    users: {
      detail: `${formatCount(instructors.length)} instrutores K9`,
      error: dashboardCollections.users.error,
      loading: dashboardCollections.users.loading,
      value: activeUsers.length,
    },
    vehicles: {
      detail: `${formatCount(vehiclesInUse.size)} em uso`,
      error: dashboardCollections.vehicles.error ?? dashboardCollections.activeShifts.error,
      loading: dashboardCollections.vehicles.loading || dashboardCollections.activeShifts.loading,
      value: vehicleRecords.length > 0 ? vehicleRecords.length : vehiclesInUse.size,
    },
  };

  return summaryCardMeta.map((card) => {
    const metric = metrics[card.collection];
    return {
      ...card,
      detail: metric.error ? "falha ao carregar" : metric.detail,
      value: metric.loading ? "..." : metric.error ? "--" : formatCount(metric.value),
      rawValue: metric.loading ? 0 : metric.value,
    };
  });
}
