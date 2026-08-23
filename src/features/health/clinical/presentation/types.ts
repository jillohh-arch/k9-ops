/**
 * K9 Ops Web — Health Web v1 HW-6A.I3
 * Clinical list PRESENTATION contract (types only).
 *
 * This module declares the vocabulary the Clinical main screen shares between
 * its filter bar, its summary instruments and its list. It holds NO data
 * access, NO derivation logic and NO React.
 *
 * MANDATES:
 * - Every "indisponível" option below exists because `null` is a THIRD answer,
 *   never a synonym for `false` or `0`. A filter that could not distinguish
 *   "sem restrição" from "restrição não informada" would make the screen lie.
 * - Nothing here redefines the canonical `ClinicalCaseStatus`; the unknown
 *   bucket is a PRESENTATION bucket for `clinicalStatus === null`, i.e. a value
 *   the canonical parser refused to recognize.
 */

import type { ClinicalCaseStatus } from "../../domain/read-states";

/**
 * Status filter domain.
 *
 * `"unknown"` selects cases whose canonical status was NOT recognized
 * (`clinicalStatus === null`). It is deliberately selectable: an unrecognized
 * case must be findable, not hidden.
 */
export type ClinicalStatusFilter = "all" | ClinicalCaseStatus | "unknown";

/**
 * Tri-state boolean filter over a documented-optional canonical flag.
 *
 * all         — no filtering
 * with        — flag is exactly `true`
 * without     — flag is exactly `false` (an AFFIRMED negative)
 * unavailable — flag is `null` (never read as `false`)
 */
export type ClinicalFlagFilter = "all" | "with" | "without" | "unavailable";

/**
 * Active-treatment filter over `activeTreatmentsCount`.
 *
 * with        — count > 0
 * without     — count is exactly 0 (an AFFIRMED zero)
 * unavailable — count is `null` (never read as 0)
 */
export type ClinicalTreatmentFilter = "all" | "with" | "without" | "unavailable";

export interface ClinicalListFilters {
  /** Free text over the K9 name and the case title. Case-insensitive. */
  search: string;
  /** `dogId` of a K9 present in the CURRENT result, or "all". */
  dogId: string;
  status: ClinicalStatusFilter;
  restriction: ClinicalFlagFilter;
  treatment: ClinicalTreatmentFilter;
  schedule: ClinicalFlagFilter;
}

export const DEFAULT_CLINICAL_FILTERS: ClinicalListFilters = {
  search: "",
  dogId: "all",
  status: "all",
  restriction: "all",
  treatment: "all",
  schedule: "all",
};

/** True when any control is narrowing the list (drives filter-empty copy). */
export function isClinicalFiltersActive(filters: ClinicalListFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.dogId !== "all" ||
    filters.status !== "all" ||
    filters.restriction !== "all" ||
    filters.treatment !== "all" ||
    filters.schedule !== "all"
  );
}

/** A K9 option for the scope selector, taken from the current result only. */
export interface ClinicalDogOption {
  dogId: string;
  name: string;
  caseCount: number;
}

/**
 * Presentation grouping keys, in the mandated visual order.
 * `unrecognized` carries `clinicalStatus === null` — a technical parse outcome,
 * NOT a clinical stage.
 */
export type ClinicalGroupKey = "active" | "closed" | "unrecognized";

/** Canonical statuses treated as "em acompanhamento" by the screen. */
export const CLINICAL_ACTIVE_STATUSES: readonly ClinicalCaseStatus[] = [
  "open",
  "under_investigation",
  "under_treatment",
  "monitoring",
] as const;

/** Canonical statuses treated as "encerrados" by the screen. */
export const CLINICAL_CLOSED_STATUSES: readonly ClinicalCaseStatus[] = [
  "discharged",
  "cancelled",
] as const;

/** Fallbacks for absent canonical text — never invented data, only labelled absence. */
export const CLINICAL_ABSENT_TITLE_LABEL = "Sem título informado";
export const CLINICAL_NO_LATER_ACTIVITY_LABEL = "Sem atividade posterior";
export const CLINICAL_UNRECOGNIZED_STATUS_LABEL = "Status não reconhecido";
export const CLINICAL_UNAVAILABLE_LABEL = "Indisponível";
