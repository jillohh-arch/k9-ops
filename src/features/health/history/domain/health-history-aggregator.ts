/**
 * K9 Ops Web — Health Web v1 F30 History
 * Pure aggregators and filters for unified Health longitudinal timeline.
 *
 * INVARIANTS:
 * - Pure functions with zero side effects.
 * - Reference Date is always passed explicitly (no implicit `new Date()`).
 * - Stable descending chronological order (most recent effectiveDate first).
 * - Distinguishes effective date from registration date truthfully.
 * - Preserves canonical vs legacy provenance indicators.
 */

import { CLINICAL_CASE_STATUS_LABELS } from "../../domain/read-states";
import type { ClinicalCaseListEntry, ClinicalScopeResult } from "../../clinical/data/clinical-scope-loader";
import type { ReadinessScope } from "../../presentation/hooks/load-readiness-scope";
import type { ScheduleListEntry, ScheduleScopeResult } from "../../schedule/data/schedule-scope-loader";
import type { ScheduleType } from "../../schedule/types";
import type {
  HealthHistoryAggregate,
  HealthHistoryFilter,
  HealthHistoryPeriod,
  HealthTimelineImpact,
  HealthTimelineItem,
  HealthTimelineSource,
} from "./health-history-types";

const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  dose: "Dose / Medicação",
  vaccination: "Vacinação",
  exam: "Exame",
  consultation: "Consulta",
  weighing: "Pesagem",
  reevaluation: "Reavaliação",
  deworming: "Vermifugação",
  bath: "Banho / Higiene",
  general: "Geral",
};

/**
 * Maps a single ClinicalCaseListEntry to a HealthTimelineItem.
 */
export function mapClinicalCaseToTimelineItem(
  entry: ClinicalCaseListEntry
): HealthTimelineItem {
  const { dog, case: c } = entry;
  const status = c.clinicalStatus ?? "open";
  const statusLabel = c.clinicalStatus
    ? CLINICAL_CASE_STATUS_LABELS[c.clinicalStatus] ?? c.rawClinicalStatus ?? "Aberto"
    : "Aberto";

  let impact: HealthTimelineImpact = "low";
  if (c.hasActiveRestriction) {
    impact = "high";
  } else if (status === "discharged" || status === "cancelled") {
    impact = "none";
  } else if (status === "under_treatment" || status === "under_investigation") {
    impact = "medium";
  }

  const effectiveDate =
    c.openedAt instanceof Date && !Number.isNaN(c.openedAt.getTime())
      ? c.openedAt
      : c.lastEventAt instanceof Date && !Number.isNaN(c.lastEventAt.getTime())
        ? c.lastEventAt
        : new Date(0);

  const actor =
    c.recordedBy?.name ??
    c.openedBy?.name ??
    (c.recordedBy?.uid ? `UID: ${c.recordedBy.uid}` : null);

  const professional = c.primaryProfessional?.name ?? null;

  return {
    id: `clinical:${c.caseId}`,
    dogId: dog.id,
    dogName: dog.name,
    dogRegistrationNumber: dog.registrationNumber,
    category: "clinical",
    title: c.title ?? "Caso Clínico",
    summary: `Caso clínico em estado ${statusLabel}.`,
    effectiveDate,
    registrationDate: c.openedAt,
    actor,
    professional,
    source: "canonical",
    sourceEntity: "clinical_case",
    status,
    statusLabel,
    impact,
    link: `/health/clinical/${encodeURIComponent(c.caseId)}`,
    dataQuality: c.dataQuality,
  };
}

/**
 * Maps a single ScheduleListEntry to a HealthTimelineItem.
 */
export function mapScheduleItemToTimelineItem(
  entry: ScheduleListEntry
): HealthTimelineItem {
  const { dog, item } = entry;
  const typeLabel =
    item.scheduleType && item.scheduleType in SCHEDULE_TYPE_LABELS
      ? SCHEDULE_TYPE_LABELS[item.scheduleType]
      : item.rawScheduleType ?? "Procedimento";

  let impact: HealthTimelineImpact = "medium";
  let statusLabel = "Agendado";
  if (item.lifecycleStatus === "completed") {
    impact = "none";
    statusLabel = "Concluído";
  } else if (item.lifecycleStatus === "cancelled") {
    impact = "none";
    statusLabel = "Cancelado";
  }

  const effectiveDate =
    item.scheduledFor instanceof Date && !Number.isNaN(item.scheduledFor.getTime())
      ? item.scheduledFor
      : new Date(0);

  const actor =
    item.recordedBy?.name ??
    (item.recordedBy?.uid ? `UID: ${item.recordedBy.uid}` : null);

  const source: HealthTimelineSource =
    item.revisionSource === "legacy_absent" || item.dataQuality === "legacy"
      ? "legacy"
      : "canonical";

  return {
    id: `schedule:${item.scheduleId}`,
    dogId: dog.id,
    dogName: dog.name,
    dogRegistrationNumber: dog.registrationNumber,
    category: "schedule",
    title: item.title || typeLabel,
    summary: `Procedimento preventivo: ${typeLabel}.`,
    effectiveDate,
    registrationDate: item.createdAt,
    actor,
    professional: null,
    source,
    sourceEntity: "health_schedule",
    status: item.lifecycleStatus ?? "open",
    statusLabel,
    impact,
    link: `/health/schedule/dogs/${encodeURIComponent(dog.id)}`,
    dataQuality: item.dataQuality === "complete" ? "complete" : "partial",
  };
}

/**
 * Maps an OperationalRestrictionReadModel to a HealthTimelineItem.
 */
export function mapRestrictionToTimelineItem(
  restriction: ReadinessScope["activeRestrictions"][number],
  scope: ReadinessScope
): HealthTimelineItem {
  const matchingDog = scope.items.find((i) => i.dog.id === restriction.dogId)?.dog;
  const dogName = matchingDog?.name ?? `K9-${restriction.dogId}`;
  const dogRegistrationNumber = matchingDog?.registrationNumber ?? null;

  let impact: HealthTimelineImpact = "medium";
  if (restriction.type === "absolute") {
    impact = "unfit";
  } else if (restriction.type === "partial") {
    impact = "high";
  }

  const statusLabel =
    restriction.status === "active"
      ? "Ativa"
      : restriction.status === "ended"
        ? "Encerrada"
        : "Cancelada";

  const effectiveDate =
    restriction.issuedAt instanceof Date && !Number.isNaN(restriction.issuedAt.getTime())
      ? restriction.issuedAt
      : new Date(0);

  const actor =
    restriction.recordedBy?.name ??
    (restriction.recordedBy?.ra ? `RA ${restriction.recordedBy.ra}` : null);

  const professional = restriction.professional?.name ?? null;

  return {
    id: `restriction:${restriction.id}`,
    dogId: restriction.dogId,
    dogName,
    dogRegistrationNumber,
    category: "restriction",
    title: restriction.reason ? `Restrição: ${restriction.reason}` : "Restrição Operacional",
    summary: restriction.description || restriction.reason || "Restrição operacional emitida.",
    effectiveDate,
    registrationDate: restriction.issuedAt,
    actor,
    professional,
    source: "canonical",
    sourceEntity: "operational_restriction",
    status: restriction.status,
    statusLabel,
    impact,
    link: `/health/readiness/${encodeURIComponent(restriction.dogId)}`,
    dataQuality: "complete",
  };
}

/**
 * Checks whether an item falls within the specified timeline period.
 */
export function isItemInPeriod(
  item: HealthTimelineItem,
  period: HealthHistoryPeriod,
  now: Date
): boolean {
  if (period === "all") return true;

  const itemTime = item.effectiveDate.getTime();
  const nowTime = now.getTime();

  let days = 30;
  if (period === "7d") days = 7;
  if (period === "90d") days = 90;

  const periodMs = days * 24 * 60 * 60 * 1000;
  // Window includes past `days` and future window up to `days` (for future schedule items)
  return itemTime >= nowTime - periodMs && itemTime <= nowTime + periodMs;
}

/**
 * Filters items by category, period and search text.
 */
export function filterTimelineItems(
  items: HealthTimelineItem[],
  filter: HealthHistoryFilter,
  now: Date
): HealthTimelineItem[] {
  let result = items;

  if (filter.category !== "all") {
    result = result.filter((item) => item.category === filter.category);
  }

  if (filter.period !== "all") {
    result = result.filter((item) => isItemInPeriod(item, filter.period, now));
  }

  if (filter.search.trim().length > 0) {
    const term = filter.search.trim().toLowerCase();
    result = result.filter(
      (item) =>
        item.dogName.toLowerCase().includes(term) ||
        (item.dogRegistrationNumber && item.dogRegistrationNumber.toLowerCase().includes(term)) ||
        item.title.toLowerCase().includes(term) ||
        item.summary.toLowerCase().includes(term) ||
        (item.actor && item.actor.toLowerCase().includes(term)) ||
        (item.professional && item.professional.toLowerCase().includes(term))
    );
  }

  return result;
}

/**
 * Aggregates all Health domain events into a unified chronological history.
 */
export function aggregateHealthHistory(
  readinessScope: ReadinessScope,
  clinicalResult: ClinicalScopeResult,
  scheduleResult: ScheduleScopeResult,
  filter: HealthHistoryFilter,
  now: Date
): HealthHistoryAggregate {
  const allItems: HealthTimelineItem[] = [];

  // 1. Ingest Clinical Cases
  const clinicalEntries: ClinicalCaseListEntry[] =
    clinicalResult.state.status === "success"
      ? clinicalResult.state.data
      : clinicalResult.state.status === "partial"
        ? clinicalResult.state.partialData
        : [];

  for (const entry of clinicalEntries) {
    allItems.push(mapClinicalCaseToTimelineItem(entry));
  }

  // 2. Ingest Schedule Items
  const scheduleEntries: ScheduleListEntry[] =
    scheduleResult.state.status === "success"
      ? scheduleResult.state.data
      : scheduleResult.state.status === "partial"
        ? scheduleResult.state.partialData
        : [];

  for (const entry of scheduleEntries) {
    allItems.push(mapScheduleItemToTimelineItem(entry));
  }

  // 3. Ingest Active Operational Restrictions
  for (const restriction of readinessScope.activeRestrictions) {
    allItems.push(mapRestrictionToTimelineItem(restriction, readinessScope));
  }

  // 4. Stable Descending Chronological Sort (most recent first)
  allItems.sort((a, b) => {
    const diff = b.effectiveDate.getTime() - a.effectiveDate.getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  // 5. Compute counts by category across all available items
  const countsByCategory: Record<"clinical" | "schedule" | "restriction", number> = {
    clinical: 0,
    schedule: 0,
    restriction: 0,
  };

  for (const item of allItems) {
    countsByCategory[item.category]++;
  }

  // 6. Apply presentation filters
  const filteredItems = filterTimelineItems(allItems, filter, now);

  // 7. Data completeness and notes
  const notes: string[] = [];
  const isPartial =
    readinessScope.isPartial ||
    !clinicalResult.coverage.complete ||
    !scheduleResult.coverage.complete;

  if (readinessScope.isPartial) {
    notes.push("Restrições operacionais com leitura parcial");
  }
  if (!clinicalResult.coverage.complete) {
    notes.push("Casos clínicos com cobertura parcial em alguns cães");
  }
  if (!scheduleResult.coverage.complete) {
    notes.push("Agenda com leitura parcial em alguns cães");
  }

  const totalDogsInScope = Math.max(
    readinessScope.items.length,
    clinicalResult.coverage.dogsInScope,
    scheduleResult.coverage.dogsInScope
  );

  return {
    allItems,
    filteredItems,
    totalCount: allItems.length,
    countsByCategory,
    referenceDate: now,
    isPartial,
    filter,
    coverageSummary: {
      totalDogsInScope,
      complete: !isPartial,
      notes,
    },
  };
}
