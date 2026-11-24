/**
 * K9 Ops — F60 Almoxarifado V1
 * Equipment & Custody Canonical Domain Rules & Helpers
 *
 * Conforms to F60.ALMOXARIFADO-EQUIPMENT-CUSTODY-V1-R1.
 */

import {
  CustodyPurpose,
  CustodyStatus,
  DerivedCustodyDueState,
  EquipmentCondition,
  EquipmentCustody,
  EquipmentStatus,
} from "./contracts";
import { CANONICAL_BUSINESS_TIMEZONE, formatCanonicalBusinessDate } from "./business-clock";

export const CANONICAL_EQUIPMENT_STATUSES: readonly EquipmentStatus[] = [
  "available",
  "in_custody",
  "maintenance",
  "damaged",
  "retired",
] as const;

export const CANONICAL_EQUIPMENT_CONDITIONS: readonly EquipmentCondition[] = [
  "new",
  "good",
  "fair",
  "damaged",
] as const;

export const CANONICAL_CUSTODY_PURPOSES: readonly CustodyPurpose[] = [
  "daily_duty",
  "training",
  "operation",
  "permanent_assignment",
] as const;

export const CANONICAL_CUSTODY_STATUSES: readonly CustodyStatus[] = [
  "active",
  "returned",
  "cancelled",
] as const;

/**
 * Checks whether an active custody is overdue relative to a reference instant.
 * Rule: Only active custodies with an expected_return_at strictly before `now` are overdue.
 * Note: 'overdue' is 100% derived and never persisted.
 */
export function isCustodyOverdue(
  custody: Pick<EquipmentCustody, "status" | "expected_return_at">,
  now: Date = new Date(),
): boolean {
  if (custody.status !== "active" || !custody.expected_return_at) {
    return false;
  }
  return now.getTime() > custody.expected_return_at.getTime();
}

/**
 * Derives the deterministic temporal due state of a custody.
 * Uses business date and time in canonical timezone 'America/Sao_Paulo'.
 * States:
 * - "overdue": custody is active, expected_return_at != null and now > expected_return_at.
 * - "due_today": custody is active, expected_return_at != null, now <= expected_return_at,
 *   and expected_return_at falls on the current business day (America/Sao_Paulo).
 * - "on_time": all other cases (including inactive custodies, custodies with no expected return,
 *   or custodies due in future dates).
 */
export function deriveCustodyDueState(
  custody: Pick<EquipmentCustody, "status" | "expected_return_at">,
  now: Date = new Date(),
): DerivedCustodyDueState {
  if (custody.status !== "active" || !custody.expected_return_at) {
    return "on_time";
  }

  const nowTime = now.getTime();
  const returnTime = custody.expected_return_at.getTime();

  if (nowTime > returnTime) {
    return "overdue";
  }

  const businessToday = formatCanonicalBusinessDate(now, CANONICAL_BUSINESS_TIMEZONE);
  const returnBusinessDate = formatCanonicalBusinessDate(
    custody.expected_return_at,
    CANONICAL_BUSINESS_TIMEZONE,
  );

  if (businessToday === returnBusinessDate) {
    return "due_today";
  }

  return "on_time";
}

/**
 * Consistency validation matrix between equipment condition and status.
 *
 * Rules:
 * 1. If condition === "damaged", status CANNOT be "available".
 * 2. If status === "in_custody", it is only allowed if there is an active custody.
 * 3. If status === "retired", the equipment is inactive and cannot have an active custody.
 */
export function validateConditionStatusConsistency(
  condition: EquipmentCondition,
  status: EquipmentStatus,
  options?: {
    hasActiveCustody?: boolean;
  },
): { valid: boolean; error?: string } {
  if (!CANONICAL_EQUIPMENT_CONDITIONS.includes(condition)) {
    return {
      valid: false,
      error: `Condição de equipamento desconhecida: "${condition}".`,
    };
  }

  if (!CANONICAL_EQUIPMENT_STATUSES.includes(status)) {
    return {
      valid: false,
      error: `Status de equipamento desconhecido: "${status}".`,
    };
  }

  // Rule 1: Damaged items cannot be available for deployment
  if (condition === "damaged" && status === "available") {
    return {
      valid: false,
      error: "Equipamento danificado não pode estar com status 'disponível'. Deve ser recolhido para manutenção ou baixado.",
    };
  }

  // Rule 2: in_custody status requires active custody
  if (status === "in_custody" && options?.hasActiveCustody === false) {
    return {
      valid: false,
      error: "Equipamento só pode estar com status 'em cautela' se houver uma cautela ativa associada.",
    };
  }

  // Rule 3: retired status means inactive asset, cannot be in custody
  if (status === "retired" && options?.hasActiveCustody === true) {
    return {
      valid: false,
      error: "Equipamento baixado/aposentado não pode possuir cautela ativa.",
    };
  }

  return { valid: true };
}
