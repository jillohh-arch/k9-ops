/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Domain types and contracts for Health Reports (/health/reports).
 *
 * GOALS:
 * - Define pure, immutable data structures for reporting aggregations.
 * - Adhere to frozen canonical contracts:
 *   - Readiness: 5 canonical server-side states from backend projection.
 *   - Clinical: 6 canonical states from F20 clinical case lifecycle.
 *   - Schedule: canonical temporal derivation and types.
 * - Truthful metrics: ZERO vs UNKNOWN semantics, coverage accounting.
 * - Strictly read-only: no mutations, no synthetic data.
 */

import type {
  ReadinessStatus,
} from "../../domain/readiness-types";
import type { ClinicalCaseStatus } from "../../domain/read-states";
import type {
  ClinicalCaseListEntry,
  ClinicalScopeCoverage,
} from "../../clinical/data/clinical-scope-loader";
import type {
  ScheduleScopeCoverage,
} from "../../schedule/data/schedule-scope-loader";
import type { ScheduleType } from "../../schedule/types";
import type { ComposedScheduleEntry } from "../../schedule/composition/schedule-composition";

/**
 * Canonical report periods for temporal filtering.
 */
export type ReportPeriod = "today" | "7d" | "30d";

export interface ReportPeriodOption {
  key: ReportPeriod;
  label: string;
  days: number;
  description: string;
}

export const REPORT_PERIOD_OPTIONS: readonly ReportPeriodOption[] = [
  {
    key: "today",
    label: "Hoje",
    days: 1,
    description: "Procedimentos do dia e casos abertos hoje",
  },
  {
    key: "7d",
    label: "7 dias",
    days: 7,
    description: "Janela operacional dos próximos 7 dias e casos recentes",
  },
  {
    key: "30d",
    label: "30 dias",
    days: 30,
    description: "Visão expandida de 30 dias para planejamento de saúde",
  },
] as const;

/**
 * Aggregated Readiness metrics (Point-in-Time / Current State).
 */
export interface ReadinessReportMetrics {
  /** Total dogs in institutional scope */
  totalDogsInScope: number;
  /** Dogs with valid canonical projection evaluated */
  evaluatedCount: number;
  /** Dogs with missing/error/partial projection (NOT collapsed into not_evaluated) */
  unevaluatedCount: number;
  /** True when every dog in scope was successfully evaluated without degradation */
  isCoverageComplete: boolean;
  /** Counts per canonical readiness status (only from valid projections) */
  statusCounts: Record<ReadinessStatus, number>;
  /** Total active operational restrictions across the scope */
  activeRestrictionsCount: number;
  /** True when restrictions reads succeeded for all dogs */
  restrictionsCoverageComplete: boolean;
  /** Breakdown of restrictions by type */
  restrictionsByType: {
    absolute: number;
    partial: number;
    attention: number;
  };
  /** Dogs with active restrictions count */
  dogsWithRestrictionsCount: number;
}

/**
 * Aggregated Clinical metrics.
 */
export interface ClinicalReportMetrics {
  /** Total clinical cases across scope */
  totalCases: number;
  /** Active cases in scope (open, under_investigation, under_treatment, monitoring) */
  activeCasesCount: number;
  /** Closed cases in scope (discharged, cancelled) */
  closedCasesCount: number;
  /** Cases opened within the selected period window */
  casesOpenedInPeriodCount: number;
  /** Counts per canonical status */
  casesByStatus: Record<ClinicalCaseStatus, number>;
  /** Unrecognized wire status count (data quality defect) */
  unrecognizedStatusCount: number;
  /** Active cases that carry an active restriction */
  casesWithActiveRestrictionCount: number;
  /** Active cases that carry a pending schedule */
  casesWithPendingScheduleCount: number;
  /** Scope read coverage */
  coverage: ClinicalScopeCoverage;
  /** True when zero cases is proven and not an artifact of denied/failed reads */
  isTruthfulZero: boolean;
}

/**
 * Aggregated Schedule metrics.
 */
export interface ScheduleReportMetrics {
  /** Total schedule items in scope */
  totalItems: number;
  /** Items falling within the selected period window */
  itemsInPeriodCount: number;
  /** Overdue items (strictly past effective deadline) */
  overdueCount: number;
  /** Pending items (scheduled before now, within tolerance) */
  pendingCount: number;
  /** Today items (scheduled for current local date) */
  todayCount: number;
  /** Upcoming items (scheduled within rolling 7 days) */
  upcomingCount: number;
  /** Scheduled items (scheduled beyond 7 days) */
  scheduledCount: number;
  /** Completed items in scope */
  completedCount: number;
  /** Cancelled items in scope */
  cancelledCount: number;
  /** Items by canonical type within period */
  itemsByTypeInPeriod: Record<ScheduleType, number>;
  /** Items with temporal derivation unavailable */
  temporalUnavailableCount: number;
  /** Scope read coverage */
  coverage: ScheduleScopeCoverage;
  /** True when zero items is proven and not an artifact of denied/failed reads */
  isTruthfulZero: boolean;
}

/**
 * Unified Coverage & Data Quality Summary.
 */
export interface HealthReportsCoverageSummary {
  /** True when readiness, clinical and schedule all completed with 100% coverage */
  isAllComplete: boolean;
  /** Dogs with forbidden reads in any subsystem */
  forbiddenDogsCount: number;
  /** Dogs with failed reads in any subsystem */
  failedDogsCount: number;
  /** Dogs in institutional scope */
  totalDogsInScope: number;
  /** Specific notes about degraded or partial data */
  notes: string[];
}

/**
 * Unified Health Reports Aggregate.
 */
export interface HealthReportsAggregate {
  period: ReportPeriod;
  referenceDate: Date;
  readiness: ReadinessReportMetrics;
  clinical: ClinicalReportMetrics;
  schedule: ScheduleReportMetrics;
  filteredClinicalCases: ClinicalCaseListEntry[];
  filteredScheduleItems: ComposedScheduleEntry[];
  coverageSummary: HealthReportsCoverageSummary;
}

/**
 * Institutional policy ratification gate (F10 Cross-Front).
 *
 * Candidate policy: `health.read === true && reports.export === true`.
 * RATIFICATION STATUS: RATIFIED (satisfied under current F10 access profile capability model).
 * Export capability is authorized when health read authority and export permission are present.
 */
export const HEALTH_REPORTS_EXPORT_POLICY_RATIFIED = true;

/**
 * Export authorization status.
 */
export interface ReportExportAuthority {
  canExport: boolean;
  reason?: string;
  hasCanonicalRead: boolean;
  hasExportCapability: boolean;
  isPolicyRatified: boolean;
}

/**
 * Export dataset choices.
 */
export type ReportExportDataset =
  | "readiness"
  | "clinical"
  | "schedule"
  | "kpi_summary";

export type ReportExportFormat = "csv" | "xlsx" | "pdf";
