/**
 * K9 Ops Web — Health Web v1 HW-3A
 * Pure Structural Conflict Detection Model
 *
 * Implements conflict detection according to:
 * - HW-3A §10 (Conflict Model)
 * - HEALTH_WEB_READINESS_POLICY.md §41
 *
 * IMPORTANT: This module ONLY detects observable structural inconsistencies.
 * It DOES NOT calculate or alter clinical readiness status client-side.
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
  isPartialRead?: boolean;
}

/**
 * Detects structural observable conflicts between reading sources.
 *
 * PURE HELPER: Safe, read-only inconsistency detector.
 */
export function detectReadinessConflict(
  params: ConflictDetectionParams
): ReadinessConflictResult {
  const { summary, restrictions, freshness, versionEvaluation, isPartialRead } = params;

  // 1. Partial reader failure
  if (isPartialRead) {
    return {
      hasConflict: true,
      conflictType: "partial_reader_failure",
      description: "Conflito técnico: a leitura de fontes foi parcial (algumas fontes falharam ao carregar).",
      affectedFields: ["readinessStatus", "restrictions"],
    };
  }

  // If summary doc is completely absent, it's missing projection (not conflict per se, unless restriction exists without summary)
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

  // 2. Incompatible projection version
  if (versionEvaluation && !versionEvaluation.isSupported) {
    return {
      hasConflict: true,
      conflictType: "incompatible_projection_version",
      description: `Conflito de versão: a versão '${versionEvaluation.rawVersion}' da projeção é incompatível com o Web v1.`,
      affectedFields: ["version"],
    };
  }

  // 3. Unknown readiness enum
  const rawStatus = summary.readinessStatus;
  const isValidEnum = OFFICIAL_READINESS_STATUSES.includes(rawStatus as ReadinessStatus);
  if (!isValidEnum) {
    return {
      hasConflict: true,
      conflictType: "unknown_readiness_enum",
      description: `Conflito de schema: o estado de prontidão '${rawStatus}' é desconhecido pelo sistema.`,
      affectedFields: ["readinessStatus"],
    };
  }

  // 4. Future timestamp anomaly
  if (freshness?.isFutureAnomaly) {
    return {
      hasConflict: true,
      conflictType: "future_timestamp_anomaly",
      description: "Conflito temporal: a projeção possui timestamp no futuro (anomalia de relógio).",
      affectedFields: ["updatedAt", "lastEvaluatedAt"],
    };
  }

  // 5. Active restrictions analysis
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
      affectedFields: ["readinessStatus", "restrictions"],
    };
  }

  // Case B: Summary says 'fit_with_restrictions', but 0 active partial restrictions exist
  if (rawStatus === "fit_with_restrictions" && activePartial.length === 0 && activeAbsolute.length === 0) {
    return {
      hasConflict: true,
      conflictType: "summary_restriction_mismatch",
      description: "Conflito de integridade: a projeção indica 'Apto com restrições', mas nenhuma restrição ativa foi encontrada.",
      affectedFields: ["readinessStatus", "restrictions"],
    };
  }

  // Case C: Summary says 'temporarily_unfit', but 0 active absolute restrictions exist
  if (rawStatus === "temporarily_unfit" && activeAbsolute.length === 0) {
    return {
      hasConflict: true,
      conflictType: "summary_restriction_mismatch",
      description: "Conflito de integridade: a projeção indica 'Temporariamente inapto', mas nenhuma restrição absoluta ativa foi encontrada.",
      affectedFields: ["readinessStatus", "restrictions"],
    };
  }

  // Case D: Summary claims activeRestrictionsCount mismatch
  if (
    typeof summary.activeRestrictionsCount === "number" &&
    summary.activeRestrictionsCount !== activeRestrictions.length
  ) {
    return {
      hasConflict: true,
      conflictType: "restriction_reference_inconsistency",
      description: `Conflito de contagem: a projeção declara ${summary.activeRestrictionsCount} restrição(ões) ativa(s), mas a consulta real retornou ${activeRestrictions.length}.`,
      affectedFields: ["activeRestrictionsCount", "restrictions"],
    };
  }

  return {
    hasConflict: false,
    conflictType: null,
    description: null,
    affectedFields: [],
  };
}
