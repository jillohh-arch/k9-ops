/**
 * K9 Ops Web — Health Web v1 F30 History
 * Domain types and contracts for Health History (/health/history).
 *
 * BASED ON:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §24 (Histórico)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.12 (Timeline)
 * - CT3.AUTH-HEALTH-01 (Canonical Health Read Authority)
 *
 * GOALS:
 * - Define pure, immutable data structures for unified longitudinal timeline.
 * - Adhere to frozen canonical contracts:
 *   - Clinical: F20 clinical case lifecycle & events.
 *   - Schedule: RD-I3 agenda scope and temporal statuses.
 *   - Readiness: Active operational restrictions and K9 identity.
 * - Truthful representation: distinguish effective date from registration date,
 *   canonical vs legacy provenance, and preserve actor/professional attribution.
 * - Strictly read-only: no mutations, no synthetic domain state.
 */

export type HealthHistoryCategory = "all" | "clinical" | "schedule" | "restriction";

export type HealthHistoryPeriod = "7d" | "30d" | "90d" | "all";

export type HealthTimelineImpact = "none" | "low" | "medium" | "high" | "unfit";

export type HealthTimelineSource = "canonical" | "legacy";

export type HealthTimelineEntity =
  | "clinical_case"
  | "health_schedule"
  | "operational_restriction";

/**
 * Single item in the unified Health timeline.
 *
 * Adheres to §24.4 of HEALTH_WEB_INFORMATION_ARCHITECTURE:
 * - category, K9, title, summary, effective date, registration date,
 *   actor, source, source entity, impact, canonical/legacy indicator, link.
 */
export interface HealthTimelineItem {
  /** Unique composite identifier (e.g. clinical:case-123) */
  id: string;
  /** Dog structural ID */
  dogId: string;
  /** Dog display name */
  dogName: string;
  /** Dog institutional registration number (RG) */
  dogRegistrationNumber: string | null;
  /** Primary category of the health event */
  category: "clinical" | "schedule" | "restriction";
  /** Title / short headline */
  title: string;
  /** Descriptive summary or clinical note */
  summary: string;
  /** Effective date when event occurred or is scheduled */
  effectiveDate: Date;
  /** Registration date when entered into system (null if unavailable) */
  registrationDate: Date | null;
  /** Operator or user who registered the item */
  actor: string | null;
  /** Attending professional (e.g. veterinarian), if applicable */
  professional: string | null;
  /** Data source lineage: canonical or legacy */
  source: HealthTimelineSource;
  /** Source entity type */
  sourceEntity: HealthTimelineEntity;
  /** Raw lifecycle status */
  status: string;
  /** Human-readable status label */
  statusLabel: string;
  /** Impact on K9 operational readiness */
  impact: HealthTimelineImpact;
  /** Direct link to the source entity in Health Web */
  link: string;
  /** Data completeness classification */
  dataQuality: "complete" | "partial";
}

/**
 * Filter configuration for Health History timeline.
 */
export interface HealthHistoryFilter {
  category: HealthHistoryCategory;
  period: HealthHistoryPeriod;
  search: string;
}

/**
 * Period filter option definition.
 */
export interface HealthHistoryPeriodOption {
  key: HealthHistoryPeriod;
  label: string;
  days: number | null;
  description: string;
}

export const HEALTH_HISTORY_PERIOD_OPTIONS: readonly HealthHistoryPeriodOption[] = [
  {
    key: "7d",
    label: "7 dias",
    days: 7,
    description: "Últimos 7 dias e próximos agendamentos",
  },
  {
    key: "30d",
    label: "30 dias",
    days: 30,
    description: "Últimos 30 dias de eventos",
  },
  {
    key: "90d",
    label: "90 dias",
    days: 90,
    description: "Últimos 90 dias de histórico",
  },
  {
    key: "all",
    label: "Todo o histórico",
    days: null,
    description: "Todos os registros disponíveis",
  },
] as const;

/**
 * Category filter option definition.
 */
export interface HealthHistoryCategoryOption {
  key: HealthHistoryCategory;
  label: string;
  description: string;
}

export const HEALTH_HISTORY_CATEGORY_OPTIONS: readonly HealthHistoryCategoryOption[] = [
  {
    key: "all",
    label: "Todos",
    description: "Todos os eventos da saúde",
  },
  {
    key: "clinical",
    label: "Clínico",
    description: "Casos clínicos e consultas",
  },
  {
    key: "schedule",
    label: "Agenda",
    description: "Procedimentos e vacinas agendadas",
  },
  {
    key: "restriction",
    label: "Restrições",
    description: "Restrições operacionais emitidas",
  },
] as const;

/**
 * Unified timeline summary metrics.
 */
export interface HealthHistoryCoverageSummary {
  totalDogsInScope: number;
  complete: boolean;
  notes: string[];
}

/**
 * Unified Health History Aggregate state.
 */
export interface HealthHistoryAggregate {
  /** All raw aggregated items before presentation filtering */
  allItems: HealthTimelineItem[];
  /** Items after applying category, period and search filters */
  filteredItems: HealthTimelineItem[];
  /** Total count of items available in the scope */
  totalCount: number;
  /** Counts by category across all available items */
  countsByCategory: Record<"clinical" | "schedule" | "restriction", number>;
  /** Reference evaluation date */
  referenceDate: Date;
  /** True when any source reported partial or degraded data */
  isPartial: boolean;
  /** Active filter state */
  filter: HealthHistoryFilter;
  /** Audit coverage summary */
  coverageSummary: HealthHistoryCoverageSummary;
}

/**
 * Canonical authority status for Health History read.
 */
export type HealthHistoryAuthorityStatus = "loading" | "allowed" | "forbidden";
