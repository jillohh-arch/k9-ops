/**
 * K9 Ops — F60 Almoxarifado V1
 * Domain Validation Functions
 *
 * Implements typed, fail-closed validation adhering to existing repository patterns.
 */

export class WarehouseValidationError extends Error {
  public readonly fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "WarehouseValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export function validateMaterialPayload(payload: {
  category_id?: unknown;
  category_name?: unknown;
  minimum_quantity?: unknown;
  name?: unknown;
  unit?: unknown;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!payload.name || typeof payload.name !== "string" || !payload.name.trim()) {
    errors.name = "Nome do material é obrigatório.";
  }
  if (!payload.category_id || typeof payload.category_id !== "string" || !payload.category_id.trim()) {
    errors.category_id = "Categoria é obrigatória.";
  }
  if (!payload.unit || typeof payload.unit !== "string" || !payload.unit.trim()) {
    errors.unit = "Unidade de medida é obrigatória.";
  }
  if (
    payload.minimum_quantity !== undefined &&
    payload.minimum_quantity !== null &&
    (typeof payload.minimum_quantity !== "number" || payload.minimum_quantity < 0 || !Number.isFinite(payload.minimum_quantity))
  ) {
    errors.minimum_quantity = "Estoque mínimo deve ser um número maior ou igual a zero.";
  }

  return errors;
}

export function validateBatchPayload(payload: {
  expiration_date?: unknown;
  initial_quantity?: unknown;
  lot_number?: unknown;
  material_id?: unknown;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!payload.material_id || typeof payload.material_id !== "string" || !payload.material_id.trim()) {
    errors.material_id = "Material de referência é obrigatório.";
  }
  if (!payload.lot_number || typeof payload.lot_number !== "string" || !payload.lot_number.trim()) {
    errors.lot_number = "Número do lote é obrigatório.";
  }
  if (
    typeof payload.initial_quantity !== "number" ||
    payload.initial_quantity <= 0 ||
    !Number.isFinite(payload.initial_quantity)
  ) {
    errors.initial_quantity = "Quantidade inicial do lote deve ser estritamente positiva.";
  }
  if (
    !payload.expiration_date ||
    typeof payload.expiration_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.expiration_date)
  ) {
    errors.expiration_date = "Data de validade deve estar no formato AAAA-MM-DD.";
  } else {
    const [y, m, d] = payload.expiration_date.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() + 1 !== m ||
      date.getUTCDate() !== d
    ) {
      errors.expiration_date = "Data de validade inválida.";
    }
  }

  return errors;
}

export function validateMovementCommon(payload: {
  batch_id?: unknown;
  material_id?: unknown;
  quantity?: unknown;
  reason?: unknown;
  type?: unknown;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!payload.material_id || typeof payload.material_id !== "string" || !payload.material_id.trim()) {
    errors.material_id = "Identificador do material é obrigatório.";
  }
  if (!payload.batch_id || typeof payload.batch_id !== "string" || !payload.batch_id.trim()) {
    errors.batch_id = "Identificador do lote é obrigatório.";
  }
  if (
    typeof payload.quantity !== "number" ||
    payload.quantity <= 0 ||
    !Number.isFinite(payload.quantity)
  ) {
    errors.quantity = "Quantidade movimentada deve ser um número estritamente positivo.";
  }
  if (!payload.reason || typeof payload.reason !== "string" || !payload.reason.trim()) {
    errors.reason = "Motivo da movimentação é obrigatório.";
  }

  const validTypes = [
    "entry",
    "consumption",
    "transfer",
    "inventory_adjustment",
    "loss",
    "disposal",
  ];
  if (!payload.type || !validTypes.includes(String(payload.type))) {
    errors.type = "Tipo de movimentação inválido.";
  }

  return errors;
}

export function validateTransferPayload(payload: {
  batch_id?: unknown;
  destination_location_id?: unknown;
  material_id?: unknown;
  origin_location_id?: unknown;
  quantity?: unknown;
  reason?: unknown;
}): Record<string, string> {
  const errors = validateMovementCommon({
    ...payload,
    type: "transfer",
  });

  if (
    !payload.origin_location_id ||
    typeof payload.origin_location_id !== "string" ||
    !payload.origin_location_id.trim()
  ) {
    errors.origin_location_id = "Local de origem é obrigatório para transferência.";
  }
  if (
    !payload.destination_location_id ||
    typeof payload.destination_location_id !== "string" ||
    !payload.destination_location_id.trim()
  ) {
    errors.destination_location_id = "Local de destino é obrigatório para transferência.";
  }
  if (
    payload.origin_location_id &&
    payload.destination_location_id &&
    payload.origin_location_id === payload.destination_location_id
  ) {
    errors.destination_location_id = "Local de destino deve ser diferente do local de origem.";
  }

  return errors;
}

export function validateEquipmentPayload(payload: {
  category_id?: unknown;
  condition?: unknown;
  current_location_id?: unknown;
  identifier_code?: unknown;
  name?: unknown;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!payload.name || typeof payload.name !== "string" || !payload.name.trim()) {
    errors.name = "Nome do equipamento é obrigatório.";
  }
  if (
    !payload.identifier_code ||
    typeof payload.identifier_code !== "string" ||
    !payload.identifier_code.trim()
  ) {
    errors.identifier_code = "Identificador patrimonial/código é obrigatório.";
  } else if (payload.identifier_code.includes("/") || payload.identifier_code.includes("\\")) {
    errors.identifier_code = "Identificador patrimonial não pode conter barras ('/' ou '\\').";
  }
  if (!payload.category_id || typeof payload.category_id !== "string" || !payload.category_id.trim()) {
    errors.category_id = "Categoria do equipamento é obrigatória.";
  }
  const validConditions = ["new", "good", "fair", "damaged"];
  if (!payload.condition || !validConditions.includes(String(payload.condition))) {
    errors.condition = "Condição física do equipamento é inválida.";
  }
  if (
    !payload.current_location_id ||
    typeof payload.current_location_id !== "string" ||
    !payload.current_location_id.trim()
  ) {
    errors.current_location_id = "Localização do equipamento é obrigatória.";
  }

  return errors;
}

export function validateOpenCustodyPayload(payload: {
  borrower_name?: unknown;
  borrower_ra?: unknown;
  condition_at_dispatch?: unknown;
  equipment_id?: unknown;
  expected_return_at?: unknown;
  purpose?: unknown;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!payload.equipment_id || typeof payload.equipment_id !== "string" || !payload.equipment_id.trim()) {
    errors.equipment_id = "Equipamento é obrigatório.";
  }
  if (!payload.borrower_ra || typeof payload.borrower_ra !== "string" || !payload.borrower_ra.trim()) {
    errors.borrower_ra = "RA do integrante responsável é obrigatório.";
  }
  if (!payload.borrower_name || typeof payload.borrower_name !== "string" || !payload.borrower_name.trim()) {
    errors.borrower_name = "Nome do integrante responsável é obrigatório.";
  }
  const validConditions = ["new", "good", "fair"];
  if (payload.condition_at_dispatch !== undefined && !validConditions.includes(String(payload.condition_at_dispatch))) {
    errors.condition_at_dispatch = "Condição física no despacho deve ser apta (novo, bom ou regular).";
  }
  const validPurposes = ["daily_duty", "training", "operation", "permanent_assignment"];
  if (!payload.purpose || !validPurposes.includes(String(payload.purpose))) {
    errors.purpose = "Finalidade da cautela é inválida.";
  }
  if (payload.expected_return_at !== undefined && payload.expected_return_at !== null && payload.expected_return_at !== "") {
    const returnDate = payload.expected_return_at instanceof Date
      ? payload.expected_return_at
      : new Date(String(payload.expected_return_at));
    if (Number.isNaN(returnDate.getTime())) {
      errors.expected_return_at = "Data prevista de retorno inválida.";
    }
  }

  return errors;
}

export function validateReturnCustodyPayload(payload: {
  condition_at_return?: unknown;
  custody_id?: unknown;
  return_notes?: unknown;
  target_equipment_status?: unknown;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!payload.custody_id || typeof payload.custody_id !== "string" || !payload.custody_id.trim()) {
    errors.custody_id = "Identificador da cautela é obrigatório.";
  }
  const validConditions = ["new", "good", "fair", "damaged"];
  if (!payload.condition_at_return || !validConditions.includes(String(payload.condition_at_return))) {
    errors.condition_at_return = "Condição física na devolução é obrigatória.";
  }
  if (
    payload.condition_at_return === "damaged" &&
    (!payload.return_notes || typeof payload.return_notes !== "string" || !payload.return_notes.trim())
  ) {
    errors.return_notes = "Descrição do dano/avaria é obrigatória na devolução de item avariado.";
  }
  if (payload.target_equipment_status !== undefined && payload.target_equipment_status !== null) {
    const validStatuses = ["available", "maintenance", "damaged"];
    if (!validStatuses.includes(String(payload.target_equipment_status))) {
      errors.target_equipment_status = "Status resultante da devolução é inválido.";
    } else if (payload.condition_at_return === "damaged" && payload.target_equipment_status === "available") {
      errors.target_equipment_status = "Equipamento danificado não pode retornar com status disponível.";
    } else if (payload.target_equipment_status === "damaged" && payload.condition_at_return !== "damaged") {
      errors.target_equipment_status = "Status resultante 'danificado' exige condição de devolução 'danificado'.";
    }
  }

  return errors;
}

export function validateInventoryCountPayload(payload: {
  counted_quantity?: unknown;
  discrepancy_reason?: unknown;
  expected_quantity?: unknown;
  stock_position_id?: unknown;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (
    !payload.stock_position_id ||
    typeof payload.stock_position_id !== "string" ||
    !payload.stock_position_id.trim()
  ) {
    errors.stock_position_id = "Posição física de estoque é obrigatória.";
  }
  if (
    typeof payload.counted_quantity !== "number" ||
    payload.counted_quantity < 0 ||
    !Number.isFinite(payload.counted_quantity)
  ) {
    errors.counted_quantity = "Quantidade contada deve ser um número maior ou igual a zero.";
  }
  if (
    typeof payload.expected_quantity === "number" &&
    typeof payload.counted_quantity === "number"
  ) {
    const diff = Math.round((payload.counted_quantity - payload.expected_quantity) * 1000) / 1000;
    if (diff !== 0) {
      if (
        !payload.discrepancy_reason ||
        typeof payload.discrepancy_reason !== "string" ||
        !payload.discrepancy_reason.trim()
      ) {
        errors.discrepancy_reason = "Justificativa é obrigatória para contagem divergente.";
      }
    }
  }

  return errors;
}

export function assertNoValidationErrors(
  errors: Record<string, string>,
  prefix = "Falha de validação",
): void {
  const keys = Object.keys(errors);
  if (keys.length > 0) {
    throw new WarehouseValidationError(
      `${prefix}: ${keys.map((k) => `${k}: ${errors[k]}`).join("; ")}`,
      errors,
    );
  }
}
