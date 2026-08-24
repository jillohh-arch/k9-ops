/**
 * Health Web v1 — Route Paths
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §9 (Route Map)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §11 (Route Architecture)
 */

export const paths = {
  /** Health module root - Overview */
  health: "/health",

  /** Readiness - global list */
  health_readiness: "/health/readiness",

  /** Readiness - individual dog cockpit (placeholder for HW-3) */
  health_readiness_dog: (dogId: string) => `/health/readiness/${encodeURIComponent(dogId)}`,

  /** Preventive schedule - global */
  health_schedule: "/health/schedule",

  /** Schedule - individual dog */
  health_schedule_dog: (dogId: string) => `/health/schedule/dogs/${encodeURIComponent(dogId)}`,

  /** Clinical - global list */
  health_clinical: "/health/clinical",

  /** Clinical case - detail */
  health_clinical_case: (caseId: string) => `/health/clinical/${encodeURIComponent(caseId)}`,

  /** Individual dog's clinical cases */
  health_clinical_dog: (dogId: string) => `/health/clinical/dogs/${encodeURIComponent(dogId)}`,

  /** Nutrition management - global */
  health_nutrition: "/health/nutrition",

  /** Individual dog's nutrition context */
  health_nutrition_dog: (dogId: string) => `/health/nutrition/dogs/${encodeURIComponent(dogId)}`,

  /** History - global timeline */
  health_history: "/health/history",

  /** Individual dog's history */
  health_history_dog: (dogId: string) => `/health/history/dogs/${encodeURIComponent(dogId)}`,

  /** Reports - global */
  health_reports: "/health/reports",

  // NOTE: /health/audit removed from HW-2 — no documentary justification
} as const;

/**
 * All health routes as a union type.
 * NOTE: audit and documents removed from HW-2 — no documentary justification
 */
export type HealthRoute =
  | typeof paths.health
  | typeof paths.health_readiness
  | typeof paths.health_readiness_dog extends (dogId: string) => infer R ? R : never
  | typeof paths.health_schedule
  | typeof paths.health_schedule_dog extends (dogId: string) => infer R ? R : never
  | typeof paths.health_clinical
  | typeof paths.health_clinical_case extends (caseId: string) => infer R ? R : never
  | typeof paths.health_clinical_dog extends (dogId: string) => infer R ? R : never
  | typeof paths.health_nutrition
  | typeof paths.health_nutrition_dog extends (dogId: string) => infer R ? R : never
  | typeof paths.health_history
  | typeof paths.health_history_dog extends (dogId: string) => infer R ? R : never
  | typeof paths.health_reports;

/**
 * Navigation items for the health secondary navigation.
 */
export const HEALTH_NAV_ITEMS = [
  { key: "overview", label: "Visão Geral", href: paths.health },
  { key: "readiness", label: "Prontidão", href: paths.health_readiness },
  { key: "schedule", label: "Agenda", href: paths.health_schedule },
  { key: "clinical", label: "Clínico", href: paths.health_clinical },
  { key: "nutrition", label: "Nutrição", href: paths.health_nutrition },
  { key: "history", label: "Histórico", href: paths.health_history },
  { key: "reports", label: "Relatórios", href: paths.health_reports },
] as const;

export type HealthNavItemKey = (typeof HEALTH_NAV_ITEMS)[number]["key"];

/**
 * Check if a path is a health route.
 */
export function isHealthRoute(path: string): boolean {
  return path.startsWith("/health");
}

/**
 * Get the nav item key for a given path.
 */
export function getHealthNavKey(path: string): HealthNavItemKey | null {
  if (path === paths.health) return "overview";
  if (path === paths.health_readiness || path.startsWith("/health/readiness")) return "readiness";
  if (path === paths.health_schedule || path.startsWith("/health/schedule")) return "schedule";
  if (path === paths.health_clinical || path.startsWith("/health/clinical")) return "clinical";
  if (path === paths.health_nutrition || path.startsWith("/health/nutrition")) return "nutrition";
  if (path === paths.health_history || path.startsWith("/health/history")) return "history";
  if (path === paths.health_reports || path.startsWith("/health/reports")) return "reports";
  return null;
}
