/**
 * Health Web v1 — Capabilities Inventory
 *
 * Based on:
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §32 (Authorization Architecture)
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §39 (Permissions and Visibility)
 *
 * CANONICAL capability names for Health Web v1 Foundation.
 * These are the minimal set of capabilities required for Phase HW-2.
 *
 * Pattern: action-based canonical names (NOT view_*, edit_* patterns)
 */

/**
 * Canonical Health-specific capabilities for HW-2 Foundation.
 * Each capability represents a specific permission within the Health domain.
 *
 * NOTE: This is the FOUNDATION set. HW-3+ will expand with additional capabilities.
 */
export type HealthCapability =
  // Core read capability
  | "health.read"

  // Routine/preventive recording
  | "health.record_routine"
  | "health.record_preventive"

  // Incident recording
  | "health.record_incident"

  // Clinical document recording
  | "health.record_clinical_document"

  // Exam capabilities
  | "health.request_exam"
  | "health.interpret_exam"

  // Treatment capabilities
  | "health.create_treatment"
  | "health.complete_treatment"

  // Dose administration
  | "health.administer_dose"

  // Restriction capabilities
  | "health.issue_restriction"
  | "health.release_restriction"

  // Case lifecycle
  | "health.discharge_case"
  | "health.reopen_case"
  | "health.cancel_case"

  // Schedule capabilities
  | "health.schedule_item"
  | "health.manage_schedule"

  // Record corrections
  | "health.cancel_record"
  | "health.amend_record"

  // Nutrition (canonical Web domain - preserved from architecture)
  | "health.manage_nutrition_plan"

  // Audit
  | "health.audit";

/**
 * Capability groups for organization.
 */
export type HealthCapabilityGroup =
  | "read"
  | "record"
  | "clinical"
  | "exams"
  | "treatments"
  | "restrictions"
  | "schedule"
  | "nutrition"
  | "audit";

/**
 * Maps capabilities to their groups.
 * Based on canonical capability structure for Health Web v1 Foundation.
 */
export const CAPABILITY_GROUPS: Record<HealthCapability, HealthCapabilityGroup> = {
  // Read
  "health.read": "read",

  // Record
  "health.record_routine": "record",
  "health.record_preventive": "record",
  "health.record_incident": "record",
  "health.record_clinical_document": "record",

  // Exams
  "health.request_exam": "exams",
  "health.interpret_exam": "exams",

  // Treatments
  "health.create_treatment": "treatments",
  "health.complete_treatment": "treatments",

  // Dose
  "health.administer_dose": "treatments",

  // Restrictions
  "health.issue_restriction": "restrictions",
  "health.release_restriction": "restrictions",

  // Case lifecycle
  "health.discharge_case": "clinical",
  "health.reopen_case": "clinical",
  "health.cancel_case": "clinical",

  // Schedule
  "health.schedule_item": "schedule",
  "health.manage_schedule": "schedule",

  // Record corrections
  "health.cancel_record": "record",
  "health.amend_record": "record",

  // Nutrition
  "health.manage_nutrition_plan": "nutrition",

  // Audit
  "health.audit": "audit",
};

/**
 * Human-readable labels for capabilities.
 * Based on canonical capability structure for Health Web v1 Foundation.
 */
export const CAPABILITY_LABELS: Record<HealthCapability, string> = {
  // Read
  "health.read": "Ler Dados de Saúde",

  // Record
  "health.record_routine": "Registrar Rotina",
  "health.record_preventive": "Registrar Preventivo",
  "health.record_incident": "Registrar Ocorrência",
  "health.record_clinical_document": "Registrar Documento Clínico",

  // Exams
  "health.request_exam": "Solicitar Exame",
  "health.interpret_exam": "Interpretar Exame",

  // Treatments
  "health.create_treatment": "Criar Tratamento",
  "health.complete_treatment": "Concluir Tratamento",

  // Dose
  "health.administer_dose": "Administrar Dose",

  // Restrictions
  "health.issue_restriction": "Emitir Restrição",
  "health.release_restriction": "Liberar Restrição",

  // Case lifecycle
  "health.discharge_case": "Encerrar Caso",
  "health.reopen_case": "Reabrir Caso",
  "health.cancel_case": "Cancelar Caso",

  // Schedule
  "health.schedule_item": "Agendar Item",
  "health.manage_schedule": "Gerenciar Agenda",

  // Record corrections
  "health.cancel_record": "Cancelar Registro",
  "health.amend_record": "Registrar Correção, Adendo ou Complemento (append-only)",

  // Nutrition
  "health.manage_nutrition_plan": "Gerenciar Planos Alimentares",

  // Audit
  "health.audit": "Auditar Saúde",
} as const;

/**
 * LEGACY ADAPTER ONLY — READ-ONLY UI COMPATIBILITY
 *
 * This mapping provides TEMPORARY backwards compatibility for the UI layer only.
 *
 * CRITICAL CONSTRAINTS:
 * - Only "health.view" → "health.read" is allowed
 * - NO write actions (create, edit, archive, approve) map to capabilities
 * - The Backend does NOT grant health.read via this adapter
 * - This is UI-only; Backend authorization is separate
 *
 * For HW-2 Foundation, only read access is supported.
 */
export const LEGACY_TO_GRANULAR: Record<string, HealthCapability[]> = {
  // LEGACY ADAPTER: health.view → health.read (read-only shell access)
  // This does NOT grant health.read in Backend — only UI compatibility
  "health.view": ["health.read"],

  // Write actions are NOT mapped — they require explicit capability grant
  // Mapping would defeat the purpose of granular authorization
  "health.create": [],
  "health.edit": [],
  "health.archive": [],
  "health.approve": [],
  "health.export": [],
  "health.audit": [],
} as const;
