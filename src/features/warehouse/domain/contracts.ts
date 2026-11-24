/**
 * K9 Ops — F60 Almoxarifado V1
 * Canonical Domain Contracts & Types
 *
 * Conforms to F60.ALMOXARIFADO-DOMAIN-AND-UX-V1-R1 (with REPAIR-1 and REPAIR-2).
 */

export type WarehouseCategoryTargetType = "consumable" | "equipment" | "both";

export interface WarehouseCategory {
  id: string;
  name: string;
  target_type: WarehouseCategoryTargetType;
  description?: string | null;
  active: boolean;
  created_at?: Date | null;
  updated_at?: Date | null;
  deleted_at?: Date | null;
  deleted_by?: string | null;
}

export type WarehouseUnit =
  | "kg"
  | "g"
  | "unidade"
  | "pacote"
  | "caixa"
  | "frasco"
  | "dose"
  | "comprimido"
  | "metro"
  | "par"
  | "litro"
  | "ml";

export interface ConsumableMaterial {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  unit: WarehouseUnit | string;
  /** Physical ON-HAND aggregate quantity across all active positions. */
  current_quantity: number;
  /** Operational minimum threshold triggering low_stock when available <= minimum. */
  minimum_quantity: number;
  /** Persisted catalog lifecycle state. */
  active: boolean;
  description?: string | null;
  brand?: string | null;
  default_storage_location_id?: string | null;
  storage_conditions?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  created_at?: Date | null;
  updated_at?: Date | null;
  deleted_at?: Date | null;
  deleted_by?: string | null;
}

export type StockBatchStatus = "active" | "depleted" | "blocked";

export interface StockBatch {
  id: string;
  material_id: string;
  material_name: string;
  lot_number: string;
  initial_quantity: number;
  /** Current ON-HAND physical quantity for this batch (sum of its positions). */
  current_quantity: number;
  /** Expiration date in ISO format YYYY-MM-DD. */
  expiration_date: string;
  received_at: Date;
  status: StockBatchStatus;
  supplier_name?: string | null;
  invoice_reference?: string | null;
  notes?: string | null;
  created_at?: Date | null;
  updated_at?: Date | null;
}

export interface StockPosition {
  /** Deterministic identifier: pos_${material_id}_${batch_id}_${location_id} */
  id: string;
  material_id: string;
  batch_id: string;
  lot_number: string;
  location_id: string;
  location_name: string;
  /** Physical quantity of this batch at this location. Must be >= 0. */
  quantity: number;
  unit: string;
  sub_location?: string | null;
  notes?: string | null;
  updated_at: Date;
  schema_version: 1;
}

export type WarehouseLocationType =
  | "warehouse"
  | "room"
  | "vehicle"
  | "kennel"
  | "other";

export interface WarehouseLocation {
  id: string;
  name: string;
  type: WarehouseLocationType;
  description?: string | null;
  parent_location_id?: string | null;
  active: boolean;
  created_at?: Date | null;
  updated_at?: Date | null;
}

export type StockMovementType =
  | "entry"
  | "consumption"
  | "transfer"
  | "inventory_adjustment"
  | "loss"
  | "disposal";

export interface StockMovement {
  id: string;
  material_id: string;
  material_name: string;
  batch_id: string;
  lot_number: string;
  type: StockMovementType;
  quantity: number;
  /** Positive for entry / positive adjustment; negative for consumption / loss / disposal. Zero for transfer. */
  delta: number;
  unit: string;
  reason: string;
  balance_before: number;
  balance_after: number;
  origin_location_id?: string | null;
  origin_location_name?: string | null;
  destination_location_id?: string | null;
  destination_location_name?: string | null;
  performed_by_ra: string;
  performed_by_name: string;
  performed_by_uid: string;
  performed_at: Date;
  related_dog_id?: string | null;
  related_dog_name?: string | null;
  related_user_ra?: string | null;
  related_user_name?: string | null;
  related_occurrence_id?: string | null;
  related_training_session_id?: string | null;
  inventory_session_id?: string | null;
  inventory_count_id?: string | null;
  document_url?: string | null;
  notes?: string | null;
  idempotency_key?: string | null;
  created_at?: Date | null;
}

export type EquipmentCondition = "new" | "good" | "fair" | "damaged";

export type EquipmentStatus =
  | "available"
  | "in_custody"
  | "maintenance"
  | "damaged"
  | "retired";

export interface Equipment {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  /** Unique asset tag, patrimony, or operational code. */
  identifier_code: string;
  condition: EquipmentCondition;
  status: EquipmentStatus;
  current_location_id: string;
  current_location_name: string;
  active: boolean;
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
  active_custody_id?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  created_at?: Date | null;
  updated_at?: Date | null;
}

export type CustodyPurpose =
  | "daily_duty"
  | "training"
  | "operation"
  | "permanent_assignment";

export type CustodyStatus = "active" | "returned" | "cancelled";

export interface EquipmentCustody {
  id: string;
  equipment_id: string;
  equipment_name: string;
  equipment_code: string;
  borrower_ra: string;
  borrower_name: string;
  dispatched_by_ra: string;
  dispatched_by_name: string;
  dispatched_at: Date;
  condition_at_dispatch: EquipmentCondition;
  purpose: CustodyPurpose;
  status: CustodyStatus;
  expected_return_at?: Date | null;
  returned_at?: Date | null;
  received_by_ra?: string | null;
  received_by_name?: string | null;
  condition_at_return?: EquipmentCondition | null;
  return_notes?: string | null;
  linked_dog_id?: string | null;
  linked_dog_name?: string | null;
  linked_vehicle_prefix?: string | null;
  dispatch_notes?: string | null;
  idempotency_key?: string | null;
  created_at?: Date | null;
}

export type InventoryScopeType =
  | "full_warehouse"
  | "by_location"
  | "by_category";

export type InventorySessionStatus =
  | "draft"
  | "in_progress"
  | "reconciling"
  | "homologated"
  | "cancelled";

export interface InventorySession {
  id: string;
  title: string;
  scope_type: InventoryScopeType;
  /** Location ID if by_location; Category ID if by_category; null if full_warehouse. */
  scope_ref_id?: string | null;
  scope_label?: string | null;
  opened_by_ra: string;
  opened_by_name: string;
  opened_at: Date;
  status: InventorySessionStatus;
  closed_by_ra?: string | null;
  closed_by_name?: string | null;
  closed_at?: Date | null;
  notes?: string | null;
  total_items?: number;
  counted_items?: number;
  discrepant_items?: number;
  created_at?: Date | null;
  updated_at?: Date | null;
}

export interface InventoryItemCount {
  id: string;
  session_id: string;
  material_id: string;
  material_name: string;
  batch_id: string;
  lot_number: string;
  location_id: string;
  location_name: string;
  stock_position_id: string;
  unit: string;
  expected_quantity: number;
  counted_quantity: number;
  discrepancy: number;
  discrepancy_reason?: string | null;
  counted_by_ra: string;
  counted_by_name: string;
  counted_at: Date;
}

export type DerivedBatchTemporalState = "valid" | "expiring_soon" | "expired";

export type DerivedMaterialStockState = "regular" | "low_stock" | "out_of_stock";

export type DerivedCustodyDueState = "on_time" | "due_today" | "overdue";
