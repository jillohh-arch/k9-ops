/**
 * Health Web v1 — Read State Contracts
 *
 * Based on:
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §25 (Technical States)
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §36 (Technical States Taxonomy)
 *
 * These contracts define the possible states for Health data reads.
 * Technical states are SEPARATE from domain states (readiness, schedule status, etc.).
 */

/**
 * Base interface for all read states.
 * All states must include a 'status' discriminator.
 */
export interface ReadStateBase {
  status: ReadStatus;
}

/**
 * Discriminator for all read states.
 * Used for discriminated unions in consumers.
 */
export type ReadStatus =
  | "idle"
  | "loading"
  | "refreshing"
  | "success"
  | "empty"
  | "partial"
  | "degraded"
  | "stale"
  | "legacy"
  | "conflict"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "error";

/**
 * Idle state — initial state before any read is initiated.
 * No data has been requested yet.
 */
export interface ReadStateIdle extends ReadStateBase {
  status: "idle";
}

/**
 * Loading state — initial data fetch in progress.
 * No data available yet.
 */
export interface ReadStateLoading extends ReadStateBase {
  status: "loading";
}

/**
 * Refreshing state — maintaining existing data while fetching updates.
 * Previous data is still visible.
 */
export interface ReadStateRefreshing extends ReadStateBase {
  status: "refreshing";
  /** Data from the previous successful read, still displayed */
  previousData: unknown;
}

/**
 * Success state — data loaded successfully from canonical source.
 * Full, up-to-date data available.
 */
export interface ReadStateSuccess<T = unknown> extends ReadStateBase {
  status: "success";
  data: T;
  /** When the data was retrieved */
  fetchedAt: Date;
}

/**
 * Empty state — query was valid but no records match.
 * This is NOT an error; it means "nothing found".
 */
export interface ReadStateEmpty extends ReadStateBase {
  status: "empty";
  /** Description of what was being queried */
  query: string;
}

/**
 * Partial state — some sources loaded, some failed.
 * Incomplete data is available.
 */
export interface ReadStatePartial<T = unknown> extends ReadStateBase {
  status: "partial";
  /** Data from successful sources */
  partialData: T;
  /** List of sources that failed */
  failedSources: string[];
  /** Which sources succeeded */
  successfulSources: string[];
}

/**
 * Degraded state — experience operates with reduced capability.
 * Known limitation from alternative source or contract.
 */
export interface ReadStateDegraded<T = unknown> extends ReadStateBase {
  status: "degraded";
  data: T;
  /** Reason for degradation */
  reason: string;
  /** What capability is reduced */
  reducedCapability: string;
}

/**
 * Stale state — data is available but beyond acceptable freshness.
 * Projection age exceeded policy threshold.
 */
export interface ReadStateStale<T = unknown> extends ReadStateBase {
  status: "stale";
  data: T;
  /** When the projection was last computed */
  computedAt: Date;
  /** Age in milliseconds since computedAt */
  ageMs: number;
  /** Policy-defined threshold for freshness */
  maxAgeMs: number;
}

/**
 * Legacy state — data comes from pre-canonical source.
 * Identified as legacy, not canonical.
 */
export interface ReadStateLegacy<T = unknown> extends ReadStateBase {
  status: "legacy";
  data: T;
  /** Name/identifier of the legacy source */
  source: string;
  /** Human-readable explanation */
  explanation: string;
}

/**
 * Conflict state — multiple sources are incompatible.
 * Safe action is blocked until resolved.
 */
export interface ReadStateConflict<T1 = unknown, T2 = unknown> extends ReadStateBase {
  status: "conflict";
  /** Data from first source */
  data1: T1;
  /** Data from second source */
  data2: T2;
  /** Description of the conflict */
  conflictDescription: string;
  /** Available resolution options */
  resolutionOptions?: string[];
}

/**
 * Unauthorized state — user is not authenticated.
 * No access to this resource.
 */
export interface ReadStateUnauthorized extends ReadStateBase {
  status: "unauthorized";
  /** Redirect to login recommended */
  redirectToLogin: boolean;
}

/**
 * Forbidden state — user is authenticated but lacks capability.
 * Authentication succeeded, authorization failed.
 */
export interface ReadStateForbidden extends ReadStateBase {
  status: "forbidden";
  /** Which capability is required */
  requiredCapability: string;
  /** Human-readable explanation */
  message: string;
}

/**
 * Not Found state — entity does not exist or is not accessible.
 * Different from empty; this is about a specific entity.
 */
export interface ReadStateNotFound extends ReadStateBase {
  status: "not_found";
  /** Type of entity that was not found */
  entityType: string;
  /** ID of the entity that was not found */
  entityId: string;
}

/**
 * Error state — unrecoverable failure.
 * No meaningful data available.
 */
export interface ReadStateError extends ReadStateBase {
  status: "error";
  /** Machine-readable error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Technical details for debugging (not shown to users) */
  technicalDetails?: string;
  /** Whether the operation can be retried */
  retryable: boolean;
}

/**
 * Union type of all possible read states.
 * Use discriminated union pattern with 'status' field.
 */
export type ReadState<T = unknown, T2 = unknown> =
  | ReadStateIdle
  | ReadStateLoading
  | ReadStateRefreshing
  | ReadStateSuccess<T>
  | ReadStateEmpty
  | ReadStatePartial<T>
  | ReadStateDegraded<T>
  | ReadStateStale<T>
  | ReadStateLegacy<T>
  | ReadStateConflict<T, T2>
  | ReadStateUnauthorized
  | ReadStateForbidden
  | ReadStateNotFound
  | ReadStateError;

/**
 * Readiness domain states (separate from technical read states).
 * These are clinical/operational states, NOT technical states.
 *
 * Based on:
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §14 (Readiness States)
 * - HEALTH_WEB_BASELINE.md §11 (Official Readiness States)
 */
export {
  type ReadinessStatus,
  READINESS_STATUS_LABELS,
  READINESS_STATUS_PRIORITY,
} from "./readiness-types";

/**
 * Restriction types for operational restrictions.
 */
export type RestrictionType = "absolute" | "partial" | "attention";

export const RESTRICTION_TYPE_LABELS: Record<RestrictionType, string> = {
  absolute: "Absoluta",
  partial: "Parcial",
  attention: "Atenção",
} as const;

/**
 * Schedule item lifecycle states.
 */
export type ScheduleStatus =
  | "scheduled"
  | "upcoming"
  | "today"
  | "pending"
  | "overdue"
  | "completed"
  | "cancelled";

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  scheduled: "Programado",
  upcoming: "Próximo",
  today: "Hoje",
  pending: "Pendente",
  overdue: "Atrasado",
  completed: "Concluído",
  cancelled: "Cancelado",
} as const;

/**
 * Clinical case lifecycle states.
 */
export type ClinicalCaseStatus =
  | "open"
  | "under_investigation"
  | "under_treatment"
  | "monitoring"
  | "discharged"
  | "cancelled";

export const CLINICAL_CASE_STATUS_LABELS: Record<ClinicalCaseStatus, string> = {
  open: "Aberto",
  under_investigation: "Em Investigação",
  under_treatment: "Em Tratamento",
  monitoring: "Em Monitoramento",
  discharged: "Encerrado",
  cancelled: "Cancelado",
} as const;

/**
 * Nutrition plan status.
 */
export type NutritionPlanStatus =
  | "active"
  | "superseded"
  | "cancelled"
  | "legacy"
  | "conflict";

export const NUTRITION_PLAN_STATUS_LABELS: Record<NutritionPlanStatus, string> = {
  active: "Ativo",
  superseded: "Substituído",
  cancelled: "Cancelado",
  legacy: "Legado",
  conflict: "Conflito",
} as const;

/**
 * Data source classification.
 * Indicates whether data comes from canonical or legacy source.
 */
export type DataSourceType = "canonical" | "legacy" | "unknown";

/**
 * Helper function to determine if a read state represents a terminal state.
 * Terminal states should trigger final UI rendering.
 */
export function isTerminalState(state: ReadState): boolean {
  return [
    "success",
    "empty",
    "partial",
    "degraded",
    "stale",
    "legacy",
    "conflict",
    "unauthorized",
    "forbidden",
    "not_found",
    "error",
  ].includes(state.status);
}

/**
 * Helper function to determine if a read state represents a loading state.
 */
export function isLoadingState(state: ReadState): boolean {
  return ["idle", "loading", "refreshing"].includes(state.status);
}

/**
 * Helper function to determine if a read state represents an error.
 */
export function isErrorState(state: ReadState): boolean {
  return ["error", "unauthorized", "forbidden", "not_found"].includes(state.status);
}

/**
 * Helper function to determine if a read state represents an auth error.
 */
export function isAuthErrorState(state: ReadState): boolean {
  return ["unauthorized", "forbidden"].includes(state.status);
}

/**
 * Helper function to check if retry is possible for current state.
 */
export function canRetry(state: ReadState): boolean {
  if (state.status === "error") {
    return (state as ReadStateError).retryable;
  }
  if (state.status === "loading") {
    return true;
  }
  return true; // Most states can be retried by re-fetching
}
