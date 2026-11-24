/**
 * K9 Ops — F60 Almoxarifado V1
 * Warehouse Functions Calling Service
 *
 * Encapsulates calls to Firebase Functions (region southamerica-east1):
 * - adminWarehouseUpsertMaterial
 * - adminWarehouseArchiveMaterial
 * - adminWarehouseEntry
 * - adminWarehouseConsumption
 * - adminWarehouseTransfer
 * - adminWarehouseLossDisposal
 *
 * Implements deterministic client-side idempotency keys and user-friendly error translations.
 */

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { functions, storage } from "@/lib/firebase/client";
import {

  CustodyPurpose,
  EquipmentCondition,

  EquipmentStatus,


  InventoryScopeType,
} from "../domain/contracts";
import { WarehouseOverview } from "../domain/overview";

/**
 * Creates a stable idempotency key for user intent.
 */
export function generateWarehouseIdempotencyKey(action: string, entityId?: string): string {
  const prefix = entityId ? `${action}-${entityId}` : action;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Translates canonical Firebase / backend error codes and messages into user-friendly Portuguese.
 */
export function translateWarehouseError(error: unknown): string {
  if (!error) return "Erro desconhecido na operação.";

  const errObj = error as { code?: string; message?: string; details?: unknown };
  const code = (errObj.code || "").toLowerCase();
  const rawMessage = (errObj.message || "").toLowerCase();

  // Known canonical codes & patterns
  if (code.includes("warehouse/inventory-session-already-active") || rawMessage.includes("inventory-session-already-active") || rawMessage.includes("já existe uma sessão de inventário ativa")) {
    return "Já existe uma sessão de inventário ativa no almoxarifado. Conclua ou cancele a sessão existente antes de iniciar uma nova.";
  }

  if (code.includes("warehouse/inventory-scope-locked") || rawMessage.includes("inventory-scope-locked") || rawMessage.includes("locked by inventory")) {
    return "Este estoque está bloqueado temporariamente para conferência de inventário ativa.";
  }

  if (code.includes("already-exists") || rawMessage.includes("already exists") || rawMessage.includes("já existe")) {
    if (rawMessage.includes("identifier") || rawMessage.includes("código") || rawMessage.includes("identificador")) {
      return "Já existe um equipamento com este identificador.";
    }
    return "Já existe um registro com estes dados no sistema (lote, código ou chave de idempotência duplicada).";
  }

  if (code.includes("not-found") || rawMessage.includes("not found") || rawMessage.includes("não encontrado")) {
    return "Registro não encontrado no sistema. Ele pode ter sido removido ou arquivado.";
  }

  if (code.includes("failed-precondition") || rawMessage.includes("failed-precondition")) {
    if (rawMessage.includes("not available") || rawMessage.includes("não está disponível")) {
      return "Equipamento não está disponível para cautela.";
    }
    if (rawMessage.includes("cannot retire") || rawMessage.includes("retire equipment in custody") || rawMessage.includes("aposentar equipamento em cautela")) {
      return "Não é permitido aposentar equipamento em cautela.";
    }
    if (rawMessage.includes("custody not active") || rawMessage.includes("cautela não está ativa") || rawMessage.includes("already returned")) {
      return "A cautela selecionada não está mais ativa.";
    }
    if (rawMessage.includes("insufficient") || rawMessage.includes("saldo insuficiente")) {
      return "Saldo físico insuficiente na posição de estoque selecionada.";
    }
    if (rawMessage.includes("depleted") || rawMessage.includes("esgotado")) {
      return "O lote selecionado está esgotado.";
    }
    if (rawMessage.includes("blocked") || rawMessage.includes("bloqueado")) {
      return "O lote ou material selecionado encontra-se bloqueado para operações.";
    }
    if (rawMessage.includes("expired") || rawMessage.includes("vencido")) {
      return "O lote está vencido e não pode sofrer saídas normais de consumo.";
    }
    if (rawMessage.includes("active on-hand") || rawMessage.includes("has remaining stock")) {
      return "Não é possível arquivar um material que ainda possui saldo físico em estoque (ON-HAND > 0).";
    }
    return "Condição operacional prévia não atendida. Verifique os dados e o estado do estoque.";
  }

  if (code.includes("permission-denied") || rawMessage.includes("permission-denied") || rawMessage.includes("unauthorized")) {
    return "Você não tem permissão para realizar esta operação de almoxarifado.";
  }

  if (code.includes("unauthenticated") || rawMessage.includes("unauthenticated")) {
    return "Sessão expirada ou não autenticada. Faça login novamente.";
  }

  if (code.includes("invalid-argument") || rawMessage.includes("invalid-argument")) {
    if (rawMessage.includes("destination") && rawMessage.includes("origin")) {
      return "O local de destino não pode ser idêntico ao local de origem.";
    }
    if (rawMessage.includes("expiration_date")) {
      return "Data de validade inválida. Use o formato AAAA-MM-DD válido no calendário.";
    }
    return "Dados informados são inválidos ou incompletos. Revise o formulário.";
  }

  if (errObj.message && !errObj.message.includes("INTERNAL") && !errObj.message.includes("firebase")) {
    return errObj.message;
  }

  return "Não foi possível concluir a operação de estoque. Tente novamente ou contate o suporte.";
}

// ---------------- DTOs ---------------- //

export interface UpsertMaterialInput {
  id?: string;
  name: string;
  category_id: string;
  category_name: string;
  unit: string;
  minimum_quantity: number;
  brand?: string | null;
  default_storage_location_id?: string | null;
  storage_conditions?: string | null;
  description?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  photo_remove?: boolean;
}

export interface ArchiveMaterialInput {
  material_id: string;
  reason: string;
}

export interface WarehouseEntryInput {
  material_id: string;
  destination_location_id: string;
  destination_location_name?: string | null;
  lot_number: string;
  expiration_date: string; // YYYY-MM-DD
  quantity: number;
  reason: string;
  supplier_name?: string | null;
  invoice_reference?: string | null;
  notes?: string | null;
  idempotency_key: string;
}

export interface WarehouseConsumptionInput {
  material_id: string;
  batch_id: string;
  origin_location_id: string;
  source_location_id?: string;
  quantity: number;
  reason: string;
  fefo_override_reason?: string | null;
  related_dog_id?: string | null;
  related_dog_name?: string | null;
  related_user_ra?: string | null;
  related_user_name?: string | null;
  related_occurrence_id?: string | null;
  notes?: string | null;
  idempotency_key: string;
}

export interface WarehouseTransferInput {
  material_id: string;
  batch_id: string;
  origin_location_id: string;
  destination_location_id: string;
  destination_location_name?: string | null;
  quantity: number;
  reason: string;
  notes?: string | null;
  idempotency_key: string;
}

export interface WarehouseLossDisposalInput {
  material_id: string;
  batch_id: string;
  origin_location_id: string;
  location_id?: string;
  type: "loss" | "disposal";
  quantity: number;
  reason: string;
  notes?: string | null;
  idempotency_key: string;
}

export interface UpsertEquipmentInput {
  id?: string;
  name: string;
  category_id: string;
  category_name?: string;
  identifier_code: string;
  condition: EquipmentCondition;
  current_location_id: string;
  current_location_name?: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  size?: string | null;
  color?: string | null;
  acquisition_date?: string | null;
  assigned_dog_id?: string | null;
  assigned_dog_name?: string | null;
  assigned_vehicle_id?: string | null;
  assigned_vehicle_prefix?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  photo_remove?: boolean;
}

export interface UpdateEquipmentStatusInput {
  equipment_id: string;
  target_status: EquipmentStatus;
  condition?: EquipmentCondition;
  notes?: string | null;
}

export interface RetireEquipmentInput {
  equipment_id: string;
  reason: string;
}

export interface OpenCustodyInput {
  equipment_id: string;
  borrower_ra: string;
  borrower_name: string;
  purpose: CustodyPurpose;
  condition_at_dispatch?: EquipmentCondition;
  expected_return_at?: string | null;
  linked_dog_id?: string | null;
  linked_dog_name?: string | null;
  linked_vehicle_prefix?: string | null;
  dispatch_notes?: string | null;
  idempotency_key: string;
}

export type ReturnEquipmentStatus = "available" | "damaged" | "maintenance";

export interface ReturnCustodyInput {
  custody_id: string;
  condition_at_return: EquipmentCondition;
  return_location_id?: string | null;
  return_location_name?: string | null;
  target_equipment_status?: ReturnEquipmentStatus;
  return_notes?: string | null;
  idempotency_key: string;
}

export interface CancelCustodyInput {
  custody_id: string;
  reason: string;
  idempotency_key: string;
}

export interface OpenInventorySessionInput {
  title: string;
  scope_type: InventoryScopeType;
  scope_ref_id?: string | null;
  scope_label?: string | null;
  notes?: string | null;
  idempotency_key?: string;
}

export interface RecordInventoryCountInput {
  session_id: string;
  count_id: string;
  counted_quantity: number;
  discrepancy_reason?: string | null;
}

export interface AddUnexpectedCountInput {
  session_id: string;
  material_id: string;
  batch_id: string;
  location_id: string;
  counted_quantity: number;
  discrepancy_reason: string;
}

export interface StartReconciliationInput {
  session_id: string;
}

export interface HomologateInventorySessionInput {
  session_id: string;
  idempotency_key: string;
  notes?: string | null;
}

export interface CancelInventorySessionInput {
  session_id: string;
  reason: string;
}

// ---------------- Photo helpers (F60-owned, storage client-side) ---------------- //

const WAREHOUSE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const WAREHOUSE_PHOTO_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function validateWarehousePhotoFile(file: File): string | null {
  if (!WAREHOUSE_PHOTO_ALLOWED_TYPES.has(file.type)) {
    return "Formato não suportado. Use JPG, PNG, WEBP ou GIF.";
  }
  if (file.size > WAREHOUSE_PHOTO_MAX_BYTES) {
    return "Arquivo muito grande. Tamanho máximo: 5 MB.";
  }
  return null;
}

export function inferWarehouseImageContentType(file: File): string {
  if (WAREHOUSE_PHOTO_ALLOWED_TYPES.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

export async function uploadWarehousePhoto(
  scope: "material" | "equipment",
  idHint: string,
  file: File,
): Promise<string> {
  const validationError = validateWarehousePhotoFile(file);
  if (validationError) throw new Error(validationError);
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const contentType = inferWarehouseImageContentType(file);
  const safeHint = idHint.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40) || "new";
  // Uses existing storage.rules match: /inventory_items/{itemId}/{fileName}
  const storageRef = ref(storage, `inventory_items/${scope}-${safeHint}/${Date.now()}.${extension}`);
  await uploadBytes(storageRef, file, { contentType });
  return getDownloadURL(storageRef);
}

// ---------------- Service Class ---------------- //

export class WarehouseService {
  /**
   * Upsert Material Metadata (NO quantity/balance input allowed)
   */
  static async upsertMaterial(input: UpsertMaterialInput): Promise<{ id: string }> {
    try {
      const mode = input.id ? "edit" : "create";
      const payload = {
        mode,
        id: input.id,
        profile: {
          name: input.name,
          category_id: input.category_id,
          category_name: input.category_name,
          unit: input.unit,
          minimum_quantity: input.minimum_quantity,
          brand: input.brand ?? null,
          description: input.description ?? null,
          notes: input.notes ?? null,
          storage_conditions: input.storage_conditions ?? null,
          photo_url: input.photo_url ?? null,
          photo_remove: input.photo_remove ?? false,
        },
        name: input.name,
        category_id: input.category_id,
        category_name: input.category_name,
        unit: input.unit,
        minimum_quantity: input.minimum_quantity,
        brand: input.brand ?? null,
        description: input.description ?? null,
        notes: input.notes ?? null,
        storage_conditions: input.storage_conditions ?? null,
        photo_url: input.photo_url ?? null,
        photo_remove: input.photo_remove ?? false,
      };
      const callable = httpsCallable<typeof payload, { id: string }>(
        functions,
        "adminWarehouseUpsertMaterial",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Archive Material (Fails if ON-HAND > 0)
   */
  static async archiveMaterial(input: ArchiveMaterialInput): Promise<{ success: boolean }> {
    try {
      const payload = {
        id: input.material_id,
        material_id: input.material_id,
        reason: input.reason,
      };
      const callable = httpsCallable<typeof payload, { success: boolean }>(
        functions,
        "adminWarehouseArchiveMaterial",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Register Entry (New lot or batch increment)
   */
  static async registerEntry(input: WarehouseEntryInput): Promise<{ movement_id: string; batch_id: string }> {
    try {
      const payload = {
        ...input,
        destination_location_name: input.destination_location_name || input.destination_location_id,
      };
      const callable = httpsCallable<typeof payload, { movement_id: string; batch_id: string }>(
        functions,
        "adminWarehouseEntry",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Register Consumption
   */
  static async registerConsumption(input: WarehouseConsumptionInput): Promise<{ movement_id: string }> {
    try {
      const payload = {
        ...input,
        source_location_id: input.origin_location_id,
      };
      const callable = httpsCallable<typeof payload, { movement_id: string }>(
        functions,
        "adminWarehouseConsumption",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Register Transfer between physical locations
   */
  static async registerTransfer(input: WarehouseTransferInput): Promise<{ movement_id: string }> {
    try {
      const payload = {
        ...input,
        destination_location_name: input.destination_location_name || input.destination_location_id,
      };
      const callable = httpsCallable<typeof payload, { movement_id: string }>(
        functions,
        "adminWarehouseTransfer",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Register Loss or Disposal
   */
  static async registerLossDisposal(input: WarehouseLossDisposalInput): Promise<{ movement_id: string }> {
    try {
      const payload = {
        ...input,
        location_id: input.origin_location_id,
      };
      const callable = httpsCallable<typeof payload, { movement_id: string }>(
        functions,
        "adminWarehouseLossDisposal",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Upsert Equipment (Create or Edit metadata)
   */
  static async upsertEquipment(input: UpsertEquipmentInput): Promise<{ id: string }> {
    try {
      const mode = input.id ? "edit" : "create";
      const payload = {
        mode,
        id: input.id,
        equipment_id: input.id,
        name: input.name,
        category_id: input.category_id,
        category_name: input.category_name,
        identifier_code: input.identifier_code,
        condition: input.condition,
        current_location_id: input.current_location_id,
        current_location_name: input.current_location_name,
        brand: input.brand ?? null,
        model: input.model ?? null,
        serial_number: input.serial_number ?? null,
        size: input.size ?? null,
        color: input.color ?? null,
        acquisition_date: input.acquisition_date ?? null,
        assigned_dog_id: input.assigned_dog_id ?? null,
        assigned_dog_name: input.assigned_dog_name ?? null,
        assigned_vehicle_id: input.assigned_vehicle_id ?? null,
        assigned_vehicle_prefix: input.assigned_vehicle_prefix ?? null,
        notes: input.notes ?? null,
        photo_url: input.photo_url ?? null,
        photo_remove: input.photo_remove ?? false,
      };
      const callable = httpsCallable<typeof payload, { id: string }>(
        functions,
        "adminWarehouseUpsertEquipment",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Update operational status and condition of equipment
   */
  static async updateEquipmentStatus(input: UpdateEquipmentStatusInput): Promise<{ success: boolean }> {
    try {
      const payload = {
        equipment_id: input.equipment_id,
        target_status: input.target_status,
        condition: input.condition,
        notes: input.notes ?? null,
      };
      const callable = httpsCallable<typeof payload, { success: boolean }>(
        functions,
        "adminWarehouseUpdateEquipmentStatus",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Retire / Decommission equipment (Cannot retire if in custody)
   */
  static async retireEquipment(input: RetireEquipmentInput): Promise<{ success: boolean }> {
    try {
      const payload = {
        equipment_id: input.equipment_id,
        reason: input.reason,
      };
      const callable = httpsCallable<typeof payload, { success: boolean }>(
        functions,
        "adminWarehouseRetireEquipment",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Open custody for equipment
   */
  static async openCustody(input: OpenCustodyInput): Promise<{ custody_id: string }> {
    try {
      const payload = {
        ...input,
        idempotency_key: input.idempotency_key,
      };
      const callable = httpsCallable<typeof payload, { custody_id: string }>(
        functions,
        "adminWarehouseOpenCustody",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Return custody with inspection and condition check
   */
  static async returnCustody(input: ReturnCustodyInput): Promise<{ custody_id: string; equipment_id: string; equipment_status: string }> {
    try {
      const payload = {
        custody_id: input.custody_id,
        condition_at_return: input.condition_at_return,
        target_equipment_status: input.target_equipment_status,
        return_location_id: input.return_location_id ?? null,
        return_location_name: input.return_location_name ?? null,
        return_notes: input.return_notes ?? null,
        idempotency_key: input.idempotency_key,
      };
      const callable = httpsCallable<typeof payload, { custody_id: string; equipment_id: string; equipment_status: string }>(
        functions,
        "adminWarehouseReturnCustody",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Cancel custody administratively
   */
  static async cancelCustody(input: CancelCustodyInput): Promise<{ success: boolean }> {
    try {
      const payload = {
        ...input,
        idempotency_key: input.idempotency_key,
      };
      const callable = httpsCallable<typeof payload, { success: boolean }>(
        functions,
        "adminWarehouseCancelCustody",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Open Physical Inventory Session
   */
  static async openInventorySession(input: OpenInventorySessionInput): Promise<{ session_id: string; total_items?: number }> {
    try {
      const payload = {
        title: input.title,
        scope_type: input.scope_type,
        scope_ref_id: input.scope_ref_id ?? null,
        scope_label: input.scope_label ?? null,
        notes: input.notes ?? null,
        idempotency_key: input.idempotency_key ?? generateWarehouseIdempotencyKey("open-inventory"),
      };
      const callable = httpsCallable<typeof payload, { session_id: string; total_items?: number }>(
        functions,
        "adminWarehouseOpenInventorySession",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Record Inventory Count for a position
   */
  static async recordInventoryCount(input: RecordInventoryCountInput): Promise<{ success: boolean; discrepancy?: number }> {
    try {
      const payload = {
        session_id: input.session_id,
        count_id: input.count_id,
        counted_quantity: input.counted_quantity,
        discrepancy_reason: input.discrepancy_reason ?? null,
      };
      const callable = httpsCallable<typeof payload, { success: boolean; discrepancy?: number }>(
        functions,
        "adminWarehouseRecordInventoryCount",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Add Unexpected Item Count
   */
  static async addUnexpectedCount(input: AddUnexpectedCountInput): Promise<{ count_id: string }> {
    try {
      const payload = {
        session_id: input.session_id,
        material_id: input.material_id,
        batch_id: input.batch_id,
        location_id: input.location_id,
        counted_quantity: input.counted_quantity,
        discrepancy_reason: input.discrepancy_reason,
      };
      const callable = httpsCallable<typeof payload, { count_id: string }>(
        functions,
        "adminWarehouseAddUnexpectedCount",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Start Reconciliation phase for inventory session
   */
  static async startReconciliation(input: StartReconciliationInput): Promise<{ success: boolean }> {
    try {
      const payload = {
        session_id: input.session_id,
      };
      const callable = httpsCallable<typeof payload, { success: boolean }>(
        functions,
        "adminWarehouseStartReconciliation",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Homologate inventory session (Applies adjustments and unlocks stock)
   */
  static async homologateInventorySession(input: HomologateInventorySessionInput): Promise<{ session_id: string; adjustments_applied: number }> {
    try {
      const payload = {
        session_id: input.session_id,
        idempotency_key: input.idempotency_key,
        notes: input.notes ?? null,
      };
      const callable = httpsCallable<typeof payload, { session_id: string; adjustments_applied: number }>(
        functions,
        "adminWarehouseHomologateInventorySession",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Cancel inventory session administratively
   */
  static async cancelInventorySession(input: CancelInventorySessionInput): Promise<{ success: boolean }> {
    try {
      const payload = {
        session_id: input.session_id,
        reason: input.reason,
      };
      const callable = httpsCallable<typeof payload, { success: boolean }>(
        functions,
        "adminWarehouseCancelInventorySession",
      );
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }

  /**
   * Fetches derived warehouse overview and operational alerts
   */
  static async getOverview(): Promise<WarehouseOverview> {
    try {
      const callable = httpsCallable<void, WarehouseOverview>(
        functions,
        "adminWarehouseGetOverview",
      );
      const result = await callable();
      return result.data;
    } catch (error) {
      throw new Error(translateWarehouseError(error));
    }
  }
}
