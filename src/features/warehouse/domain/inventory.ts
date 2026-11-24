/**
 * K9 Ops — F60 Almoxarifado V1
 * Physical Inventory Domain Models & Validations
 *
 * Implements canonical inventory domain logic:
 * - InventorySession, InventoryItemCount, InventoryScopeType, InventorySessionStatus
 * - calculateDiscrepancy(expected, counted)
 * - deriveCountRowStatus(count)
 * - calculateInventoryProgress(counts)
 * - validateCountPayload(payload)
 * - validateOpenInventoryPayload(payload)
 */

import {
  InventoryItemCount,
  InventoryScopeType,
  InventorySession,
  InventorySessionStatus,
} from "./contracts";

export type {
  InventoryItemCount,
  InventoryScopeType,
  InventorySession,
  InventorySessionStatus,
};

export type InventoryCountRowStatus = "pending" | "matching" | "shortage" | "surplus";

export interface InventoryProgressSummary {
  total: number;
  counted: number;
  pending: number;
  matching: number;
  divergent: number;
}

/**
 * Calculates discrepancy between counted and expected quantities.
 * If counted is null or undefined (not yet counted), returns null.
 * Otherwise returns Math.round((counted - expected) * 1000) / 1000.
 */
export function calculateDiscrepancy(
  expected: number,
  counted: number | null | undefined,
): number | null {
  if (counted === null || counted === undefined) {
    return null;
  }
  return Math.round((counted - expected) * 1000) / 1000;
}

/**
 * Derives visual and operational status for an inventory item count row.
 * - "pending" if counted === null or undefined
 * - "matching" if diff === 0
 * - "shortage" if diff < 0 (missing items)
 * - "surplus" if diff > 0 (excess items)
 */
export function deriveCountRowStatus(
  count: Pick<InventoryItemCount, "expected_quantity"> & {
    counted_quantity?: number | null;
    discrepancy?: number | null;
  },
): InventoryCountRowStatus {
  if (count.counted_quantity === null || count.counted_quantity === undefined) {
    return "pending";
  }

  const diff =
    count.discrepancy !== undefined && count.discrepancy !== null
      ? count.discrepancy
      : calculateDiscrepancy(count.expected_quantity, count.counted_quantity);

  if (diff === null) {
    return "pending";
  }

  if (diff === 0) {
    return "matching";
  }
  if (diff < 0) {
    return "shortage";
  }
  return "surplus";
}

/**
 * Calculates aggregate progress and breakdown of counts in an inventory session.
 */
export function calculateInventoryProgress(
  counts: Array<
    Pick<InventoryItemCount, "expected_quantity"> & {
      counted_quantity?: number | null;
      discrepancy?: number | null;
    }
  >,
): InventoryProgressSummary {
  const total = counts.length;
  let counted = 0;
  let pending = 0;
  let matching = 0;
  let divergent = 0;

  for (const item of counts) {
    const status = deriveCountRowStatus(item);
    if (status === "pending") {
      pending += 1;
    } else {
      counted += 1;
      if (status === "matching") {
        matching += 1;
      } else {
        divergent += 1;
      }
    }
  }

  return {
    total,
    counted,
    pending,
    matching,
    divergent,
  };
}

export interface CountPayloadInput {
  session_id?: unknown;
  count_id?: unknown;
  counted_quantity?: unknown;
  discrepancy_reason?: unknown;
  expected_quantity?: unknown;
}

/**
 * Validates count submission payload.
 * Requires:
 * - counted_quantity must be a finite number >= 0.
 * - if counted !== expected (diff !== 0), discrepancy_reason is required and non-empty.
 */
export function validateCountPayload(
  payload: CountPayloadInput,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (
    payload.counted_quantity === undefined ||
    payload.counted_quantity === null ||
    typeof payload.counted_quantity !== "number" ||
    !Number.isFinite(payload.counted_quantity) ||
    payload.counted_quantity < 0
  ) {
    errors.counted_quantity = "Quantidade física deve ser um número maior ou igual a zero.";
  }

  if (
    typeof payload.expected_quantity === "number" &&
    typeof payload.counted_quantity === "number" &&
    Number.isFinite(payload.counted_quantity) &&
    payload.counted_quantity >= 0
  ) {
    const diff = calculateDiscrepancy(payload.expected_quantity, payload.counted_quantity);
    if (diff !== null && diff !== 0) {
      if (
        !payload.discrepancy_reason ||
        typeof payload.discrepancy_reason !== "string" ||
        !payload.discrepancy_reason.trim()
      ) {
        errors.discrepancy_reason = "Justificativa obrigatória quando houver divergência entre o esperado e o contado.";
      }
    }
  }

  return errors;
}

export interface OpenInventoryPayloadInput {
  title?: unknown;
  scope_type?: unknown;
  scope_ref_id?: unknown;
  notes?: unknown;
}

/**
 * Validates open inventory session payload.
 * Requires:
 * - non-empty title
 * - scope_type in "full_warehouse" | "by_location" | "by_category"
 * - scope_ref_id mandatory for "by_location" and "by_category"
 */
export function validateOpenInventoryPayload(
  payload: OpenInventoryPayloadInput,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (
    !payload.title ||
    typeof payload.title !== "string" ||
    !payload.title.trim()
  ) {
    errors.title = "Título da sessão de inventário é obrigatório.";
  }

  const validScopeTypes: InventoryScopeType[] = [
    "full_warehouse",
    "by_location",
    "by_category",
  ];

  if (
    !payload.scope_type ||
    typeof payload.scope_type !== "string" ||
    !validScopeTypes.includes(payload.scope_type as InventoryScopeType)
  ) {
    errors.scope_type = "Tipo de escopo inválido. Escolha Geral, Por Local ou Por Categoria.";
  } else {
    if (
      (payload.scope_type === "by_location" || payload.scope_type === "by_category") &&
      (!payload.scope_ref_id ||
        typeof payload.scope_ref_id !== "string" ||
        !payload.scope_ref_id.trim())
    ) {
      errors.scope_ref_id =
        payload.scope_type === "by_location"
          ? "Local físico de referência é obrigatório para escopo por local."
          : "Categoria de referência é obrigatória para escopo por categoria.";
    }
  }

  return errors;
}
