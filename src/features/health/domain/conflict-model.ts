/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Pure Structural Conflict Detection Model (Corrected)
 *
 * Implements conflict detection according to:
 * - HW-3A Corrective Review §5 (Partial is not Conflict)
 * - HEALTH_WEB_READINESS_POLICY.md §41
 *
 * IMPORTANT MANDATES:
 * - This module ONLY detects observable structural inconsistencies.
 * - `partial` read state is a distinct technical quality state ("Parcial"), NOT a structural conflict!
 * - DOES NOT calculate or alter clinical readiness status client-side.
 */

import {
  OFFICIAL_READINESS_STATUSES,
  type CanonicalHealthSummaryDoc,
  type CanonicalRestrictionDoc,
  type FreshnessEvaluationResult,
  type ReadinessConflictResult,
  type ReadinessStatus,
  type VersionEvaluationResult,
} from "./readiness-types";

export interface ConflictDetectionParams {
  summary: CanonicalHealthSummaryDoc | null;
  restrictions: CanonicalRestrictionDoc[];
  freshness?: FreshnessEvaluationResult;
  versionEvaluation?: VersionEvaluationResult;
}

/**
 * Detects structural observable conflicts between reading sources.
 *
 * PURE HELPER: Safe, read-only inconsistency detector.
 */
export function detectReadinessConflict(
  params: ConflictDetectionParams
): ReadinessConflictResult {
  const { summary, restrictions, freshness, versionEvaluation } = params;

  // If summary doc is completely absent, it's missing projection (not conflict per se, unless active restriction exists without summary)
  if (!summary) {
    const activeRestrictions = restrictions.filter((r) => r.status === "active");
    if (activeRestrictions.length > 0) {
      return {
        hasConflict: true,
        conflictType: "missing_summary",
        description: `Conflito estrutural: existem ${activeRestrictions.length} restrição(ões) ativa(s) mas a projeção health_summary/current está ausente.`,
        affectedFields: ["summary", "restrictions"],
      };
    }
    return {
      hasConflict: false,
      conflictType: null,
      description: null,
      affectedFields: [],
    };
  }

  // 1. Incompatible projection version
  if (versionEvaluation && !versionEvaluation.isSupported) {
    return {
      hasConflict: true,
      conflictType: "incompatible_projection_version",
      description: versionEvaluation.details,
      affectedFields: ["schema_version"],
    };
  }

  // 2. Unknown readiness enum
  const rawStatus = summary.readinessStatus;
  const isValidEnum = OFFICIAL_READINESS_STATUSES.includes(rawStatus as ReadinessStatus);
  if (!isValidEnum) {
    return {
      hasConflict: true,
      conflictType: "unknown_readiness_enum",
      description: `Conflito de schema: o estado de prontidão '${String(rawStatus)}' é desconhecido pelo sistema.`,
      affectedFields: ["readiness_status"],
    };
  }

  // 3. Future timestamp anomaly
  if (freshness?.isFutureAnomaly) {
    return {
      hasConflict: true,
      conflictType: "future_timestamp_anomaly",
      description: "Conflito temporal: a projeção possui readiness_updated_at no futuro (anomalia de relógio).",
      affectedFields: ["readiness_updated_at"],
    };
  }

  // 4. Active restrictions analysis
  const activeRestrictions = restrictions.filter((r) => r.status === "active");
  const activeAbsolute = activeRestrictions.filter((r) => r.level === "absolute");
  const activePartial = activeRestrictions.filter((r) => r.level === "partial");

  // Case A: Summary says 'operational', but active absolute or partial restriction exists!
  if (
    rawStatus === "operational" &&
    (activeAbsolute.length > 0 || activePartial.length > 0)
  ) {
    return {
      hasConflict: true,
      conflictType: "summary_restriction_mismatch",
      description: `Conflito de integridade: a projeção indica 'Operacional', mas existe(m) ${activeRestrictions.length} restrição(ões) ativa(s) no Firestore.`,
      affectedFields: ["readiness_status", "restrictions"],
    };
  }

  // Case B: Summary says 'fit_with_restrictions', but 0 active partial restrictions exist
  if (rawStatus === "fit_with_restrictions" && activePartial.length === 0 && activeAbsolute.length === 0) {
    return {
      hasConflict: true,
      conflictType: "summary_restriction_mismatch",
      description: "Conflito de integridade: a projeção indica 'Apto com restrições', mas nenhuma restrição ativa foi encontrada.",
      affectedFields: ["readiness_status", "restrictions"],
    };
  }

  // Case C: Summary says 'temporarily_unfit', but 0 active absolute restrictions exist
  if (rawStatus === "temporarily_unfit" && activeAbsolute.length === 0) {
    return {
      hasConflict: true,
      conflictType: "summary_restriction_mismatch",
      description: "Conflito de integridade: a projeção indica 'Temporariamente inapto', mas nenhuma restrição absoluta ativa foi encontrada.",
      affectedFields: ["readiness_status", "restrictions"],
    };
  }

  // Case D: Summary claims restriction_count mismatch
  const totalActiveFromCount = summary.restrictionCount.absolute + summary.restrictionCount.partial + summary.restrictionCount.attention;
  if (
    totalActiveFromCount > 0 &&
    totalActiveFromCount !== activeRestrictions.length
  ) {
    return {
      hasConflict: true,
      conflictType: "restriction_reference_inconsistency",
      description: `Conflito de contagem: a projeção declara ${totalActiveFromCount} restrição(ões) ativa(s), mas a consulta real retornou ${activeRestrictions.length}.`,
      affectedFields: ["restriction_count", "restrictions"],
    };
  }

  return {
    hasConflict: false,
    conflictType: null,
    description: null,
    affectedFields: [],
  };
}
