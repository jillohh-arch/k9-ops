/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Pure Presentation Readiness Aggregator (Corrected)
 *
 * Implements read-only readiness presentation composition according to:
 * - HW-3A §11 (Read Models Web), §15 (Readiness Aggregation)
 * - HEALTH_WEB_READINESS_POLICY.md §21-§26
 * - HW-3A Corrective Review
 *
 * CRITICAL MANDATES:
 * - Strictly for PRESENTATION.
 * - DOES NOT calculate clinical readiness, update Firestore, or assign scores.
 * - Strictly preserves canonical status while deriving freshness, technical quality, and structural conflict.
 * - Uses readiness_updated_at as authoritative timestamp for readiness freshness.
 * - Preserves partial !== conflict distinction.
 */

import { detectReadinessConflict } from "./conflict-model";
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
 * Normalizes a canonical restriction document into an OperationalRestrictionReadModel for presentation.
 */
export function normalizeRestrictionDoc(
  doc: CanonicalRestrictionDoc,
  now: Date = new Date()
): OperationalRestrictionReadModel {
  const issuedAt = doc.issuedAt ?? now;
  const expectedEnd = doc.expectedEnd;
  const actualEnd = doc.actualEnd;

  const rawLevel = (doc.level || "attention").toLowerCase();
  const type: "absolute" | "partial" | "attention" =
    rawLevel === "absolute" ? "absolute" : rawLevel === "partial" ? "partial" : "attention";

  const rawStatus = (doc.status || "active").toLowerCase();
  const status: "active" | "ended" | "cancelled" =
    rawStatus === "ended" ? "ended" : rawStatus === "cancelled" ? "cancelled" : "active";

  const isOverdueReevaluation =
    status === "active" && expectedEnd !== null && expectedEnd.getTime() < now.getTime();

  let authorityLabel: string | null = null;
  if (doc.professional) {
    authorityLabel = doc.professional.clinic
      ? `${doc.professional.name} (${doc.professional.clinic})`
      : doc.professional.name;
  }

  return {
    id: doc.id,
    dogId: doc.dogId,
    type,
    status,
    reason: doc.description || "Restrição operacional registrada",
    description: doc.description,
    restrictedActivities: doc.activitiesRestricted ?? [],
    issuedAt,
    recordedBy: doc.recordedBy,
    professional: doc.professional,
    sourceDocument: doc.sourceDocument,
    expectedEnd,
    actualEnd,
    authorityLabel,
    sourceDocumentUrl: doc.sourceDocument?.url ?? null,
    clinicalCaseId: doc.caseId ?? null,
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

  // 1. Parse freshness (AUTHORITATIVE: readiness_updated_at!) & version
  const freshness = evaluateFreshness(
    {
      readinessUpdatedAt: summary?.readinessUpdatedAt,
      lastEvaluatedAt: summary?.lastEvaluatedAt,
      updatedAt: summary?.updatedAt,
    },
    { ...freshnessOptions, now }
  );

  const versionEval = evaluateProjectionVersion(summary?.schemaVersion, { allowMissing: false });

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
  // MANDATE: partial !== conflict!
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

  const updatedAt = freshness.readinessUpdatedAt ?? freshness.updatedAt;
  const reason = summary?.readinessReason ?? (readinessStatus === "not_evaluated" ? "Nenhuma avaliação registrada" : null);

  const projectionMetadata = summary
    ? {
        version: summary.schemaVersion ?? null,
        source: "dogs/{dogId}/health_summary/current",
      }
    : null;

  const defaultQualityState: ReadState = dataQuality ?? (
    summary
      ? freshness.isStale
        ? {
            status: "stale",
            data: summary,
            computedAt: freshness.readinessUpdatedAt ?? now,
            ageMs: freshness.ageMs ?? 0,
            maxAgeMs: freshness.maxAgeMs,
          }
        : {
            status: "success",
            data: summary,
            fetchedAt: freshness.readinessUpdatedAt ?? now,
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

  const summary = listItem.summary;

  /**
   * Secondary evidence is classified by WHERE THE FACT ACTUALLY CAME FROM.
   *
   * `health_summary/current` is an integrated, server-owned projection that
   * already carries projected digests of weight, vaccination, nutrition, cases
   * and schedule. When such a field is present it is real canonical data, so it
   * is surfaced: marking it "pending integration" would be a false unavailable,
   * the mirror of the false zero this module refuses to render.
   *
   * This does NOT move domain authority. The authorities remain:
   *   weight       -> WeightAssessment / weight_records
   *   vaccination  -> VaccinationRecord
   *   nutrition    -> NutritionPlan
   *   cases        -> ClinicalCase
   *   schedule     -> HealthScheduleItem
   *   restrictions -> operational_restrictions (read canonically, never from summary)
   *
   * `reason` records provenance so the cockpit can state that a value came from
   * the readiness projection rather than from a detailed aggregate reader, and
   * so drill-down stays disabled until that reader/route exists.
   */
  const pendingIntegration = <T = unknown>(domain: string): EvidenceAvailability<T> => ({
    available: false,
    reason: `${domain}: leitura detalhada ainda não integrada nesta versão.`,
    data: null,
  });

  const PROJECTED_REASON = "Resumo projetado da prontidão canônica.";

  /** Present projected digest -> available; absent/null -> unavailable, never zero. */
  const projected = <T>(
    value: T | null | undefined,
    domain: string
  ): EvidenceAvailability<T> =>
    value == null
      ? pendingIntegration(domain)
      : { available: true, reason: PROJECTED_REASON, data: value };

  return {
    dog: listItem.dog,
    summary: listItem.summary,
    readinessStatus: listItem.readinessStatus,
    readinessLabel: listItem.readinessLabel,
    reason: listItem.reason,
    restrictions: allRestrictions,
    vaccinationEvidence: projected(summary?.lastVaccination ?? null, "Vacinação"),
    weightEvidence: projected(summary?.lastWeight ?? null, "Peso"),
    scheduleSummary: summary
      ? {
          available: true,
          reason: PROJECTED_REASON,
          data: {
            pending: summary.pendingScheduleCount,
            overdue: summary.overdueScheduleCount,
          },
        }
      : pendingIntegration("Agenda"),
    nutritionSummary: projected(summary?.nutritionPlan ?? null, "Nutrição"),
    clinicalSummary: summary
      ? {
          available: true,
          reason: PROJECTED_REASON,
          data: {
            activeCases: summary.activeCasesCount,
            activeTreatments: summary.activeTreatmentsCount,
            lastExam: summary.lastExam ?? null,
            lastConsultation: summary.lastConsultation ?? null,
          },
        }
      : pendingIntegration("Casos clínicos"),
    // health_timeline has no reader yet: genuinely not integrated.
    timelineSummary: pendingIntegration("Histórico"),
    freshness: listItem.freshness,
    dataQuality: listItem.dataQuality,
    qualityLabel: listItem.qualityLabel,
    conflict: listItem.conflict,
    projectionMetadata: listItem.projectionMetadata,
  };
}
