/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Pure Presentation Readiness Aggregator
 *
 * Implements read-only readiness presentation composition according to:
 * - HW-3A §11 (Read Models Web), §15 (Readiness Aggregation)
 * - HEALTH_WEB_READINESS_POLICY.md §21-§26
 *
 * CRITICAL MANDATE:
 * This aggregator is strictly for PRESENTATION.
 * It DOES NOT calculate clinical readiness, update Firestore, or assign scores.
 * It strictly preserves canonical status while deriving freshness, technical quality, and structural conflict.
 */

import {
  detectReadinessConflict,
} from "./conflict-model";
import {
  evaluateFreshness,
  evaluateProjectionVersion,
  parseTimestamp,
  type FreshnessOptions,
} from "./freshness-policy";
import type { ReadState } from "./read-states";
import {
  OFFICIAL_READINESS_STATUSES,
  READINESS_STATUS_LABELS,
  type CanonicalHealthSummaryDoc,
  type CanonicalRestrictionDoc,
  type DogIdentityReadModel,
  type EvidenceAvailability,
  type OperationalRestrictionReadModel,
  type QualityStateLabel,
  type ReadinessCockpit,
  type ReadinessListItem,
  type ReadinessStatus,
} from "./readiness-types";

export interface AggregateReadinessParams {
  dog: DogIdentityReadModel;
  summary: CanonicalHealthSummaryDoc | null;
  restrictions: CanonicalRestrictionDoc[];
  dataQuality?: ReadState;
  freshnessOptions?: FreshnessOptions;
  now?: Date;
}

/**
 * Normalizes a raw Firestore restriction document into an OperationalRestrictionReadModel.
 */
export function normalizeRestrictionDoc(
  doc: CanonicalRestrictionDoc,
  now: Date = new Date()
): OperationalRestrictionReadModel {
  const issuedAt = parseTimestamp(doc.issuedAt) ?? now;
  const expectedEnd = parseTimestamp(doc.expectedEnd);
  const actualEnd = parseTimestamp(doc.actualEnd);

  const rawLevel = (doc.level || "attention").toLowerCase();
  const type: "absolute" | "partial" | "attention" =
    rawLevel === "absolute" ? "absolute" : rawLevel === "partial" ? "partial" : "attention";

  const rawStatus = (doc.status || "active").toLowerCase();
  const status: "active" | "ended" | "cancelled" =
    rawStatus === "ended" ? "ended" : rawStatus === "cancelled" ? "cancelled" : "active";

  const isOverdueReevaluation =
    status === "active" && expectedEnd !== null && expectedEnd.getTime() < now.getTime();

  return {
    id: doc.id,
    dogId: doc.dogId,
    type,
    status,
    reason: doc.reason || "Restrição operacional registrada",
    description: doc.description ?? null,
    restrictedActivities: doc.restrictedActivities ?? [],
    issuedAt,
    issuedBy: doc.issuedBy || "Profissional Responsável",
    expectedEnd,
    actualEnd,
    authority: doc.authority ?? null,
    sourceDocumentUrl: doc.sourceDocumentUrl ?? null,
    clinicalCaseId: doc.clinicalCaseId ?? null,
    isOverdueReevaluation,
  };
}

/**
 * Pure presentation aggregator for ReadinessListItem (List View).
 */
export function aggregateReadinessListItem(
  params: AggregateReadinessParams
): ReadinessListItem {
  const now = params.now ?? new Date();
  const { dog, summary, restrictions, freshnessOptions, dataQuality } = params;

  // 1. Parse freshness & version
  const rawTimestamp = summary?.updatedAt ?? summary?.lastEvaluatedAt ?? null;
  const freshness = evaluateFreshness(rawTimestamp, { ...freshnessOptions, now });
  const versionEval = evaluateProjectionVersion(summary?.version, { allowMissing: false });

  // 2. Normalize active restrictions
  const activeRestrictions = restrictions
    .filter((r) => (r.status || "active").toLowerCase() === "active")
    .map((r) => normalizeRestrictionDoc(r, now));

  // 3. Detect structural conflict
  const isPartialRead = dataQuality?.status === "partial";
  const conflict = detectReadinessConflict({
    summary,
    restrictions,
    freshness,
    versionEvaluation: versionEval,
    isPartialRead,
  });

  // 4. Determine domain readiness status & label
  // MANDATE: error !== not_evaluated and missing summary !== not_evaluated!
  let readinessStatus: ReadinessStatus = "not_evaluated";
  let readinessLabel = READINESS_STATUS_LABELS.not_evaluated;

  if (summary && OFFICIAL_READINESS_STATUSES.includes(summary.readinessStatus as ReadinessStatus)) {
    readinessStatus = summary.readinessStatus as ReadinessStatus;
    readinessLabel = READINESS_STATUS_LABELS[readinessStatus];
  } else if (summary && !OFFICIAL_READINESS_STATUSES.includes(summary.readinessStatus as ReadinessStatus)) {
    readinessStatus = "not_evaluated"; // fallback for presentation if unknown enum
    readinessLabel = READINESS_STATUS_LABELS.not_evaluated;
  }

  // 5. Determine presentation quality label (technical quality state)
  let qualityLabel: QualityStateLabel = "Atualizada";

  if (!summary) {
    qualityLabel = "Sem projeção válida";
  } else if (isPartialRead) {
    qualityLabel = "Parcial";
  } else if (conflict.hasConflict) {
    qualityLabel = "Conflito";
  } else if (freshness.isStale) {
    qualityLabel = "Desatualizada";
  } else {
    qualityLabel = "Atualizada";
  }

  const updatedAt = freshness.computedAt;
  const reason = summary?.readinessReason ?? (readinessStatus === "not_evaluated" ? "Nenhuma avaliação registrada" : null);

  const projectionMetadata = summary
    ? {
        version: summary.version ?? null,
        source: summary.source ?? "dogs/{dogId}/health_summary/current",
      }
    : null;

  const defaultQualityState: ReadState = dataQuality ?? (
    summary
      ? freshness.isStale
        ? {
            status: "stale",
            data: summary,
            computedAt: freshness.computedAt ?? now,
            ageMs: freshness.ageMs ?? 0,
            maxAgeMs: freshness.maxAgeMs,
          }
        : {
            status: "success",
            data: summary,
            fetchedAt: freshness.computedAt ?? now,
          }
      : {
          status: "empty",
          query: `dogs/${dog.id}/health_summary/current`,
        }
  );

  return {
    dog,
    summary,
    readinessStatus,
    readinessLabel,
    reason,
    activeRestrictionsSummary: activeRestrictions,
    updatedAt,
    freshness,
    dataQuality: defaultQualityState,
    qualityLabel,
    conflict: conflict.hasConflict ? conflict : null,
    projectionMetadata,
    cockpitAvailable: true,
  };
}

/**
 * Pure presentation aggregator for ReadinessCockpit (Cockpit View).
 */
export function aggregateReadinessCockpit(
  params: AggregateReadinessParams
): ReadinessCockpit {
  const listItem = aggregateReadinessListItem(params);
  const now = params.now ?? new Date();

  const allRestrictions = params.restrictions.map((r) => normalizeRestrictionDoc(r, now));

  const pendingIntegration: EvidenceAvailability = {
    available: false,
    reason: "Source pending integration in HW-3",
    data: null,
  };

  return {
    dog: listItem.dog,
    summary: listItem.summary,
    readinessStatus: listItem.readinessStatus,
    readinessLabel: listItem.readinessLabel,
    reason: listItem.reason,
    restrictions: allRestrictions,
    vaccinationEvidence: pendingIntegration,
    weightEvidence: pendingIntegration,
    scheduleSummary: pendingIntegration,
    nutritionSummary: pendingIntegration,
    clinicalSummary: pendingIntegration,
    timelineSummary: pendingIntegration,
    freshness: listItem.freshness,
    dataQuality: listItem.dataQuality,
    qualityLabel: listItem.qualityLabel,
    conflict: listItem.conflict,
    projectionMetadata: listItem.projectionMetadata,
  };
}
