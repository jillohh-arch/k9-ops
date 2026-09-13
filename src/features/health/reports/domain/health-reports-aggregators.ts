/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Pure aggregators and truthfulness evaluators for Health Reports.
 *
 * INVARIANTS:
 * - Pure functions with zero side effects.
 * - No implicit `now` — reference Date is always passed explicitly.
 * - No synthetic or heuristic calculations.
 * - ZERO vs UNKNOWN distinction strictly enforced:
 *   - 0 is returned only when scope read is proven and complete.
 *   - Any missing/failed/forbidden read results in UNKNOWN / partial notation.
 * - Missing health summary projection is NEVER collapsed into "not_evaluated".
 */

import {
  CLINICAL_ACTIVE_STATUSES,
  CLINICAL_CLOSED_STATUSES,
} from "../../clinical/presentation/types";
import type {
  ClinicalCaseListEntry,
  ClinicalScopeResult,
} from "../../clinical/data/clinical-scope-loader";
import type { ClinicalCaseStatus } from "../../domain/read-states";
import type {
  ReadinessStatus,
} from "../../domain/readiness-types";
import type { ReadinessScope } from "../../presentation/hooks/load-readiness-scope";
import type { ComposedScheduleEntry } from "../../schedule/composition/schedule-composition";
import type { ScheduleScopeCoverage } from "../../schedule/data/schedule-scope-loader";
import type { ScheduleType } from "../../schedule/types";
import type {
  ClinicalReportMetrics,
  HealthReportsAggregate,
  HealthReportsCoverageSummary,
  ReadinessReportMetrics,
  ReportPeriod,
  ScheduleReportMetrics,
} from "./health-reports-types";

// ============================================================================
// Readiness Aggregation (Point-in-Time / Current State)
// ============================================================================

export function aggregateReadiness(scope: ReadinessScope): ReadinessReportMetrics {
  const statusCounts: Record<ReadinessStatus, number> = {
    operational: 0,
    operational_attention: 0,
    fit_with_restrictions: 0,
    temporarily_unfit: 0,
    not_evaluated: 0,
  };

  let evaluatedCount = 0;
  let unevaluatedCount = 0;

  for (const item of scope.items) {
    // MANDATE: Only valid projections count towards official readiness statuses
    if (item.dataQuality.status === "success") {
      evaluatedCount++;
      if (item.readinessStatus in statusCounts) {
        statusCounts[item.readinessStatus]++;
      }
    } else {
      // Missing or degraded projection — MUST NOT be counted as not_evaluated
      unevaluatedCount++;
    }
  }

  const restrictionsByType = {
    absolute: 0,
    partial: 0,
    attention: 0,
  };

  const restrictedDogIds = new Set<string>();

  for (const restriction of scope.activeRestrictions) {
    if (restriction.type in restrictionsByType) {
      restrictionsByType[restriction.type]++;
    }
    if (restriction.dogId) {
      restrictedDogIds.add(restriction.dogId);
    }
  }

  const isCoverageComplete =
    !scope.isPartial &&
    scope.restrictionsCoverageComplete &&
    unevaluatedCount === 0;

  return {
    totalDogsInScope: scope.items.length,
    evaluatedCount,
    unevaluatedCount,
    isCoverageComplete,
    statusCounts,
    activeRestrictionsCount: scope.activeRestrictions.length,
    restrictionsCoverageComplete: scope.restrictionsCoverageComplete,
    restrictionsByType,
    dogsWithRestrictionsCount: restrictedDogIds.size,
  };
}

// ============================================================================
// Clinical Filtering and Aggregation
// ============================================================================

/**
 * Evaluates whether a clinical case was opened within the specified report period.
 */
export function isCaseOpenedInPeriod(
  entry: ClinicalCaseListEntry,
  period: ReportPeriod,
  now: Date
): boolean {
  const openedAt = entry.case.openedAt;
  if (!openedAt || !(openedAt instanceof Date) || Number.isNaN(openedAt.getTime())) {
    return false;
  }

  const openedTime = openedAt.getTime();
  const nowTime = now.getTime();

  if (period === "today") {
    return (
      openedAt.getFullYear() === now.getFullYear() &&
      openedAt.getMonth() === now.getMonth() &&
      openedAt.getDate() === now.getDate()
    );
  }

  if (period === "7d") {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    // Window: [now - 7d, now + 1d (to tolerate small local timezone drift)]
    return openedTime >= nowTime - sevenDaysMs && openedTime <= nowTime + 24 * 60 * 60 * 1000;
  }

  if (period === "30d") {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return openedTime >= nowTime - thirtyDaysMs && openedTime <= nowTime + 24 * 60 * 60 * 1000;
  }

  return false;
}

export function aggregateClinical(
  result: ClinicalScopeResult,
  period: ReportPeriod,
  now: Date
): {
  metrics: ClinicalReportMetrics;
  filteredCases: ClinicalCaseListEntry[];
} {
  const entries: ClinicalCaseListEntry[] =
    result.state.status === "success"
      ? result.state.data
      : result.state.status === "partial"
        ? result.state.partialData
        : [];

  const casesByStatus: Record<ClinicalCaseStatus, number> = {
    open: 0,
    under_investigation: 0,
    under_treatment: 0,
    monitoring: 0,
    discharged: 0,
    cancelled: 0,
  };

  let activeCasesCount = 0;
  let closedCasesCount = 0;
  let casesOpenedInPeriodCount = 0;
  let unrecognizedStatusCount = 0;
  let casesWithActiveRestrictionCount = 0;
  let casesWithPendingScheduleCount = 0;

  const filteredCases: ClinicalCaseListEntry[] = [];

  for (const entry of entries) {
    const status = entry.case.clinicalStatus;

    if (status && Object.prototype.hasOwnProperty.call(casesByStatus, status)) {
      casesByStatus[status as ClinicalCaseStatus]++;

      if (CLINICAL_ACTIVE_STATUSES.includes(status)) {
        activeCasesCount++;
        if (entry.case.hasActiveRestriction === true) {
          casesWithActiveRestrictionCount++;
        }
        if (entry.case.hasPendingSchedule === true) {
          casesWithPendingScheduleCount++;
        }
      } else if (CLINICAL_CLOSED_STATUSES.includes(status)) {
        closedCasesCount++;
      }
    } else {
      unrecognizedStatusCount++;
    }

    const inPeriod = isCaseOpenedInPeriod(entry, period, now);
    if (inPeriod) {
      casesOpenedInPeriodCount++;
    }

    // In a clinical operational report, relevant cases are:
    // 1) Active cases currently requiring ongoing veterinary care
    // 2) Cases opened in the selected period window
    const isActive = status ? CLINICAL_ACTIVE_STATUSES.includes(status) : false;
    if (isActive || inPeriod) {
      filteredCases.push(entry);
    }
  }

  // Sort filtered cases: active first, then by openedAt desc
  filteredCases.sort((a, b) => {
    const aActive = a.case.clinicalStatus ? CLINICAL_ACTIVE_STATUSES.includes(a.case.clinicalStatus) : false;
    const bActive = b.case.clinicalStatus ? CLINICAL_ACTIVE_STATUSES.includes(b.case.clinicalStatus) : false;
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    const timeA = a.case.openedAt?.getTime() ?? 0;
    const timeB = b.case.openedAt?.getTime() ?? 0;
    return timeB - timeA;
  });

  const isTruthfulZero =
    entries.length === 0 && result.coverage.complete === true;

  const metrics: ClinicalReportMetrics = {
    totalCases: entries.length,
    activeCasesCount,
    closedCasesCount,
    casesOpenedInPeriodCount,
    casesByStatus,
    unrecognizedStatusCount,
    casesWithActiveRestrictionCount,
    casesWithPendingScheduleCount,
    coverage: result.coverage,
    isTruthfulZero,
  };

  return { metrics, filteredCases };
}

// ============================================================================
// Schedule Filtering and Aggregation
// ============================================================================

/**
 * Checks whether a composed schedule item falls into the requested period window.
 */
export function isScheduleItemInPeriod(
  entry: ComposedScheduleEntry,
  period: ReportPeriod,
  now: Date
): boolean {
  const item = entry.entry.item;
  const scheduledFor = item.scheduledFor;

  if (!scheduledFor || !(scheduledFor instanceof Date) || Number.isNaN(scheduledFor.getTime())) {
    return false;
  }

  // Prefer canonical displayWindow offset if available
  const offset = entry.displayWindow.offsetDays;

  if (period === "today") {
    if (offset !== null) {
      return offset === 0;
    }
    // Fallback calendar day check
    return (
      scheduledFor.getFullYear() === now.getFullYear() &&
      scheduledFor.getMonth() === now.getMonth() &&
      scheduledFor.getDate() === now.getDate()
    );
  }

  if (period === "7d") {
    if (offset !== null) {
      return offset >= 0 && offset < 7;
    }
    const diff = scheduledFor.getTime() - now.getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }

  if (period === "30d") {
    if (offset !== null) {
      return offset >= 0 && offset < 30;
    }
    const diff = scheduledFor.getTime() - now.getTime();
    return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000;
  }

  return false;
}

export function aggregateSchedule(
  entries: ComposedScheduleEntry[],
  coverage: ScheduleScopeCoverage,
  period: ReportPeriod,
  now: Date
): {
  metrics: ScheduleReportMetrics;
  filteredItems: ComposedScheduleEntry[];
} {
  const itemsByTypeInPeriod: Record<ScheduleType, number> = {
    dose: 0,
    vaccination: 0,
    exam: 0,
    consultation: 0,
    weighing: 0,
    reevaluation: 0,
    deworming: 0,
    bath: 0,
    general: 0,
  };

  let itemsInPeriodCount = 0;
  let overdueCount = 0;
  let pendingCount = 0;
  let todayCount = 0;
  let upcomingCount = 0;
  let scheduledCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let temporalUnavailableCount = 0;

  const filteredItems: ComposedScheduleEntry[] = [];

  for (const entry of entries) {
    const temporalStatus = entry.temporal.temporalStatus;

    if (temporalStatus === "overdue") overdueCount++;
    else if (temporalStatus === "pending") pendingCount++;
    else if (temporalStatus === "today") todayCount++;
    else if (temporalStatus === "upcoming") upcomingCount++;
    else if (temporalStatus === "scheduled") scheduledCount++;
    else if (temporalStatus === "completed") completedCount++;
    else if (temporalStatus === "cancelled") cancelledCount++;
    else if (temporalStatus === null) temporalUnavailableCount++;

    const inPeriod = isScheduleItemInPeriod(entry, period, now);
    const isActionable = temporalStatus === "overdue" || temporalStatus === "pending";

    if (inPeriod) {
      itemsInPeriodCount++;
      const type = entry.entry.item.scheduleType;
      if (type && type in itemsByTypeInPeriod) {
        itemsByTypeInPeriod[type]++;
      }
    }

    // In a health operations report, actionable items (overdue, pending)
    // plus items falling in the selected period window are shown.
    if (inPeriod || isActionable) {
      filteredItems.push(entry);
    }
  }

  // Sort: overdue first, then pending, then chronologically by scheduledFor asc
  filteredItems.sort((a, b) => {
    const statusWeight: Record<string, number> = {
      overdue: 0,
      pending: 1,
      today: 2,
      upcoming: 3,
      scheduled: 4,
      completed: 5,
      cancelled: 6,
    };

    const wA = statusWeight[a.temporal.temporalStatus ?? ""] ?? 7;
    const wB = statusWeight[b.temporal.temporalStatus ?? ""] ?? 7;
    if (wA !== wB) return wA - wB;

    const timeA = a.entry.item.scheduledFor?.getTime() ?? 0;
    const timeB = b.entry.item.scheduledFor?.getTime() ?? 0;
    return timeA - timeB;
  });

  const isTruthfulZero = entries.length === 0 && coverage.complete === true;

  const metrics: ScheduleReportMetrics = {
    totalItems: entries.length,
    itemsInPeriodCount,
    overdueCount,
    pendingCount,
    todayCount,
    upcomingCount,
    scheduledCount,
    completedCount,
    cancelledCount,
    itemsByTypeInPeriod,
    temporalUnavailableCount,
    coverage,
    isTruthfulZero,
  };

  return { metrics, filteredItems };
}

// ============================================================================
// Unified Aggregate Composition
// ============================================================================

export function aggregateHealthReports(
  readinessScope: ReadinessScope,
  clinicalResult: ClinicalScopeResult,
  scheduleEntries: ComposedScheduleEntry[],
  scheduleCoverage: ScheduleScopeCoverage,
  period: ReportPeriod,
  now: Date
): HealthReportsAggregate {
  const readiness = aggregateReadiness(readinessScope);
  const { metrics: clinical, filteredCases: filteredClinicalCases } =
    aggregateClinical(clinicalResult, period, now);
  const { metrics: schedule, filteredItems: filteredScheduleItems } =
    aggregateSchedule(scheduleEntries, scheduleCoverage, period, now);

  const notes: string[] = [];
  let forbiddenDogsCount = 0;
  let failedDogsCount = 0;

  if (readinessScope.isPartial) {
    notes.push("Prontidão com cobertura parcial de resumos ou restrições.");
  }
  if (!readinessScope.restrictionsCoverageComplete) {
    notes.push("Leitura de restrições operacionais incompleta para um ou mais cães.");
  }
  if (readiness.unevaluatedCount > 0) {
    notes.push(
      `${readiness.unevaluatedCount} cão(ões) com projeção de saúde ausente ou degradada (não classificados como não avaliados).`
    );
  }

  if (clinicalResult.coverage.forbiddenDogIds.length > 0) {
    forbiddenDogsCount += clinicalResult.coverage.forbiddenDogIds.length;
    notes.push(
      `Casos clínicos: ${clinicalResult.coverage.forbiddenDogIds.length} cão(ões) com leitura não autorizada (cobertura desconhecida).`
    );
  }
  if (clinicalResult.coverage.failedDogIds.length > 0) {
    failedDogsCount += clinicalResult.coverage.failedDogIds.length;
    notes.push(
      `Casos clínicos: ${clinicalResult.coverage.failedDogIds.length} cão(ões) com falha técnica de leitura.`
    );
  }

  if (scheduleCoverage.forbiddenDogIds.length > 0) {
    forbiddenDogsCount += scheduleCoverage.forbiddenDogIds.length;
    notes.push(
      `Agenda: ${scheduleCoverage.forbiddenDogIds.length} cão(ões) com leitura não autorizada (cobertura desconhecida).`
    );
  }
  if (scheduleCoverage.failedDogIds.length > 0) {
    failedDogsCount += scheduleCoverage.failedDogIds.length;
    notes.push(
      `Agenda: ${scheduleCoverage.failedDogIds.length} cão(ões) com falha técnica de leitura.`
    );
  }

  const isAllComplete =
    readiness.isCoverageComplete &&
    clinicalResult.coverage.complete &&
    scheduleCoverage.complete;

  const totalDogsInScope = Math.max(
    readinessScope.items.length,
    clinicalResult.coverage.dogsInScope,
    scheduleCoverage.dogsInScope
  );

  const coverageSummary: HealthReportsCoverageSummary = {
    isAllComplete,
    forbiddenDogsCount,
    failedDogsCount,
    totalDogsInScope,
    notes,
  };

  return {
    period,
    referenceDate: now,
    readiness,
    clinical,
    schedule,
    filteredClinicalCases,
    filteredScheduleItems,
    coverageSummary,
  };
}
