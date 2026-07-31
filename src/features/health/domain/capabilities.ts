/**
 * Health Web v1 — Capabilities Inventory
 *
 * Based on:
 * - HEALTH_WEB_BASELINE.md §14 (Granular Capabilities)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §24 (Authorization Architecture)
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §39 (Permissions and Visibility)
 *
 * This file defines granular capabilities for the Health domain.
 * These replace the generic "health.view/create/edit" actions.
 */

/**
 * Health-specific capabilities.
 * Each capability represents a specific permission within the Health domain.
 */
export type HealthCapability =
  // Read capabilities
  | "health.view_overview"
  | "health.view_readiness"
  | "health.view_schedule"
  | "health.view_clinical"
  | "health.view_treatments"
  | "health.view_exams"
  | "health.view_nutrition"
  | "health.view_history"
  | "health.view_reports"
  | "health.view_audit"
  | "health.view_documents"
  | "health.view_sensitive_documents"

  // Schedule management
  | "health.manage_schedule"
  | "health.manage_schedule_create"
  | "health.manage_schedule_update"
  | "health.manage_schedule_complete"
  | "health.manage_schedule_cancel"

  // Clinical management
  | "health.manage_clinical_case"
  | "health.manage_clinical_case_open"
  | "health.manage_clinical_case_close"
  | "health.manage_clinical_case_reopen"
  | "health.manage_clinical_event"
  | "health.manage_clinical_event_finalize"
  | "health.manage_clinical_amendment"

  // Restriction management
  | "health.manage_restriction"
  | "health.manage_restriction_create"
  | "health.manage_restriction_close"
  | "health.manage_restriction_view_internal"

  // Treatment management
  | "health.manage_treatment"
  | "health.manage_treatment_create"
  | "health.manage_treatment_close"

  // Exam management
  | "health.manage_exam"
  | "health.manage_exam_create"
  | "health.manage_exam_result"

  // Nutrition management (canonical Web domain)
  | "health.manage_nutrition_plan"
  | "health.manage_nutrition_plan_create"
  | "health.manage_nutrition_plan_update"
  | "health.manage_nutrition_plan_replace"
  | "health.manage_nutrition_plan_cancel"

  // Weight management
  | "health.manage_weight"
  | "health.manage_weight_record"

  // Vaccination management
  | "health.manage_vaccination"
  | "health.manage_vaccination_record"

  // Document management
  | "health.manage_documents"
  | "health.manage_documents_upload"
  | "health.manage_documents_delete"

  // External transcription
  | "health.transcribe_external_record"
  | "health.transcribe_consultation"
  | "health.transcribe_examination"

  // Read operations
  | "health.read_health_summary"
  | "health.read_restrictions"
  | "health.read_legacy_data"

  // Export and reporting
  | "health.export_reports"
  | "health.export_health_data"
  | "health.export_clinical_data"

  // Audit access
  | "health.audit_health"
  | "health.audit_view_restricted";

/**
 * Capability groups for organization.
 */
export type HealthCapabilityGroup =
  | "read"
  | "schedule"
  | "clinical"
  | "restrictions"
  | "treatments"
  | "exams"
  | "nutrition"
  | "documents"
  | "transcription"
  | "export"
  | "audit";

/**
 * Maps capabilities to their groups.
 */
export const CAPABILITY_GROUPS: Record<HealthCapability, HealthCapabilityGroup> = {
  // Read
  "health.view_overview": "read",
  "health.view_readiness": "read",
  "health.view_schedule": "read",
  "health.view_clinical": "read",
  "health.view_treatments": "read",
  "health.view_exams": "read",
  "health.view_nutrition": "read",
  "health.view_history": "read",
  "health.view_reports": "read",
  "health.view_audit": "read",
  "health.view_documents": "read",
  "health.view_sensitive_documents": "read",

  // Schedule
  "health.manage_schedule": "schedule",
  "health.manage_schedule_create": "schedule",
  "health.manage_schedule_update": "schedule",
  "health.manage_schedule_complete": "schedule",
  "health.manage_schedule_cancel": "schedule",

  // Clinical
  "health.manage_clinical_case": "clinical",
  "health.manage_clinical_case_open": "clinical",
  "health.manage_clinical_case_close": "clinical",
  "health.manage_clinical_case_reopen": "clinical",
  "health.manage_clinical_event": "clinical",
  "health.manage_clinical_event_finalize": "clinical",
  "health.manage_clinical_amendment": "clinical",

  // Restrictions
  "health.manage_restriction": "restrictions",
  "health.manage_restriction_create": "restrictions",
  "health.manage_restriction_close": "restrictions",
  "health.manage_restriction_view_internal": "restrictions",

  // Treatments
  "health.manage_treatment": "treatments",
  "health.manage_treatment_create": "treatments",
  "health.manage_treatment_close": "treatments",

  // Exams
  "health.manage_exam": "exams",
  "health.manage_exam_create": "exams",
  "health.manage_exam_result": "exams",

  // Nutrition
  "health.manage_nutrition_plan": "nutrition",
  "health.manage_nutrition_plan_create": "nutrition",
  "health.manage_nutrition_plan_update": "nutrition",
  "health.manage_nutrition_plan_replace": "nutrition",
  "health.manage_nutrition_plan_cancel": "nutrition",

  // Weight
  "health.manage_weight": "read",
  "health.manage_weight_record": "read",

  // Vaccination
  "health.manage_vaccination": "read",
  "health.manage_vaccination_record": "read",

  // Documents
  "health.manage_documents": "documents",
  "health.manage_documents_upload": "documents",
  "health.manage_documents_delete": "documents",

  // Transcription
  "health.transcribe_external_record": "transcription",
  "health.transcribe_consultation": "transcription",
  "health.transcribe_examination": "transcription",

  // Read operations
  "health.read_health_summary": "read",
  "health.read_restrictions": "read",
  "health.read_legacy_data": "read",

  // Export
  "health.export_reports": "export",
  "health.export_health_data": "export",
  "health.export_clinical_data": "export",

  // Audit
  "health.audit_health": "audit",
  "health.audit_view_restricted": "audit",
};

/**
 * Human-readable labels for capabilities.
 */
export const CAPABILITY_LABELS: Record<HealthCapability, string> = {
  // Read
  "health.view_overview": "Ver Visão Geral de Saúde",
  "health.view_readiness": "Ver Prontidão",
  "health.view_schedule": "Ver Agenda",
  "health.view_clinical": "Ver Casos Clínicos",
  "health.view_treatments": "Ver Tratamentos",
  "health.view_exams": "Ver Exames",
  "health.view_nutrition": "Ver Nutrição",
  "health.view_history": "Ver Histórico",
  "health.view_reports": "Ver Relatórios",
  "health.view_audit": "Ver Auditoria",
  "health.view_documents": "Ver Documentos",
  "health.view_sensitive_documents": "Ver Documentos Sensíveis",

  // Schedule
  "health.manage_schedule": "Gerenciar Agenda",
  "health.manage_schedule_create": "Criar Itens de Agenda",
  "health.manage_schedule_update": "Atualizar Itens de Agenda",
  "health.manage_schedule_complete": "Concluir Itens de Agenda",
  "health.manage_schedule_cancel": "Cancelar Itens de Agenda",

  // Clinical
  "health.manage_clinical_case": "Gerenciar Casos Clínicos",
  "health.manage_clinical_case_open": "Abrir Casos Clínicos",
  "health.manage_clinical_case_close": "Encerrar Casos Clínicos",
  "health.manage_clinical_case_reopen": "Reabrir Casos Clínicos",
  "health.manage_clinical_event": "Gerenciar Eventos Clínicos",
  "health.manage_clinical_event_finalize": "Finalizar Eventos Clínicos",
  "health.manage_clinical_amendment": "Registrar Amendment Clínico",

  // Restrictions
  "health.manage_restriction": "Gerenciar Restrições",
  "health.manage_restriction_create": "Criar Restrições",
  "health.manage_restriction_close": "Encerrar Restrições",
  "health.manage_restriction_view_internal": "Ver Detalhes Internos de Restrições",

  // Treatments
  "health.manage_treatment": "Gerenciar Tratamentos",
  "health.manage_treatment_create": "Criar Tratamentos",
  "health.manage_treatment_close": "Encerrar Tratamentos",

  // Exams
  "health.manage_exam": "Gerenciar Exames",
  "health.manage_exam_create": "Solicitar Exames",
  "health.manage_exam_result": "Registrar Resultados de Exames",

  // Nutrition
  "health.manage_nutrition_plan": "Gerenciar Planos Alimentares",
  "health.manage_nutrition_plan_create": "Criar Planos Alimentares",
  "health.manage_nutrition_plan_update": "Atualizar Planos Alimentares",
  "health.manage_nutrition_plan_replace": "Substituir Planos Alimentares",
  "health.manage_nutrition_plan_cancel": "Cancelar Planos Alimentares",

  // Weight
  "health.manage_weight": "Ver Peso",
  "health.manage_weight_record": "Registrar Peso",

  // Vaccination
  "health.manage_vaccination": "Ver Vacinação",
  "health.manage_vaccination_record": "Registrar Vacinação",

  // Documents
  "health.manage_documents": "Gerenciar Documentos",
  "health.manage_documents_upload": "Upload de Documentos",
  "health.manage_documents_delete": "Excluir Documentos",

  // Transcription
  "health.transcribe_external_record": "Transcrever Registros Externos",
  "health.transcribe_consultation": "Transcrever Consultas",
  "health.transcribe_examination": "Transcrever Exames",

  // Read operations
  "health.read_health_summary": "Ler Resumo de Saúde",
  "health.read_restrictions": "Ler Restrições",
  "health.read_legacy_data": "Ler Dados Legados",

  // Export
  "health.export_reports": "Exportar Relatórios",
  "health.export_health_data": "Exportar Dados de Saúde",
  "health.export_clinical_data": "Exportar Dados Clínicos",

  // Audit
  "health.audit_health": "Auditar Saúde",
  "health.audit_view_restricted": "Ver Auditoria Restrita",
} as const;

/**
 * Mapping from legacy permissions to granular capabilities.
 * Used during transition from old permission model.
 */
export const LEGACY_TO_GRANULAR: Record<string, HealthCapability[]> = {
  "health.view": [
    "health.view_overview",
    "health.view_readiness",
    "health.view_schedule",
    "health.view_clinical",
    "health.view_nutrition",
    "health.view_history",
    "health.view_reports",
  ],
  "health.create": [
    "health.manage_schedule_create",
    "health.manage_clinical_case_open",
    "health.manage_nutrition_plan_create",
    "health.transcribe_external_record",
  ],
  "health.edit": [
    "health.manage_schedule_update",
    "health.manage_nutrition_plan_update",
    "health.manage_documents",
  ],
  "health.archive": [],
  "health.approve": [
    "health.manage_clinical_case_close",
    "health.manage_restriction_close",
  ],
  "health.export": [
    "health.export_reports",
    "health.export_health_data",
  ],
  "health.audit": [
    "health.audit_health",
  ],
} as const;
