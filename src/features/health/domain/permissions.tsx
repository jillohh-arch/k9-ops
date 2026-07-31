/**
 * Health Web v1 — Permissions Foundation
 *
 * Read-only permission contracts for HW-2 Foundation.
 *
 * Based on:
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §32 (Authorization Architecture)
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §39 (Permissions and Visibility)
 *
 * IMPORTANT CONSTRAINTS:
 * - health.read is the ONLY read capability for HW-2 Foundation
 * - NO write actions (create, edit, archive, approve) are granted via legacy adapter
 * - Legacy adapter provides ONLY read-only UI compatibility
 * - Backend authorization is SEPARATE from this adapter
 * - Unknown capabilities are ALWAYS denied (fail-closed)
 */

import type { HealthCapability } from "./capabilities";
import { LEGACY_TO_GRANULAR } from "./capabilities";

// ============================================================================
// Permission Evaluation Result
// ============================================================================

/**
 * Permission evaluation result.
 * Uses discriminated union for strict handling.
 */
export type PermissionResult =
  | PermissionGranted
  | PermissionDenied;

/**
 * Granted permission result.
 */
export interface PermissionGranted {
  granted: true;
  capability: HealthCapability;
  source: "explicit" | "legacy_adapter";
}

/**
 * Denied permission result with reason.
 */
export interface PermissionDenied {
  granted: false;
  capability: HealthCapability;
  reason: PermissionDeniedReason;
}

/**
 * Reasons for permission denial.
 */
export type PermissionDeniedReason =
  | "no_session"
  | "no_capabilities"
  | "capability_not_granted"
  | "legacy_view_not_present"
  | "unknown_capability";

/**
 * Session capabilities container.
 */
export interface SessionCapabilities {
  /** User's session ID */
  sessionId: string | null;
  /** Legacy permissions from session */
  legacyPermissions: string[];
  /** Explicit granular capabilities */
  explicitCapabilities: HealthCapability[];
}

/**
 * Default empty session.
 */
export const EMPTY_SESSION: SessionCapabilities = {
  sessionId: null,
  legacyPermissions: [],
  explicitCapabilities: [],
};

// ============================================================================
// Permission Evaluator
// ============================================================================

/**
 * Evaluate if a capability is granted for a session.
 *
 * RULES:
 * 1. No session → denied (unauthorized)
 * 2. health.read requires: explicit health.read OR legacy health.view
 * 3. Write capabilities (record_*, manage_*, etc.) require EXPLICIT grant only
 * 4. Legacy adapter does NOT grant write capabilities
 * 5. Unknown capabilities → denied (fail-closed)
 */
export function evaluateCapability(
  session: SessionCapabilities,
  capability: HealthCapability
): PermissionResult {
  // Rule 1: No session
  if (!session.sessionId) {
    return {
      granted: false,
      capability,
      reason: "no_session",
    };
  }

  // Rule 2: health.read check
  if (capability === "health.read") {
    // Check explicit first
    if (session.explicitCapabilities.includes("health.read")) {
      return { granted: true, capability, source: "explicit" };
    }
    // Check legacy adapter (read-only)
    if (session.legacyPermissions.includes("health.view")) {
      return { granted: true, capability, source: "legacy_adapter" };
    }
    return {
      granted: false,
      capability,
      reason: "capability_not_granted",
    };
  }

  // Rule 3: Write capabilities require EXPLICIT grant only
  // Legacy adapter does NOT grant write capabilities
  if (session.explicitCapabilities.includes(capability)) {
    return { granted: true, capability, source: "explicit" };
  }

  // Rule 5: Fail-closed for unknown capabilities
  // Even if capability exists in type, if not explicitly granted, deny
  return {
    granted: false,
    capability,
    reason: "capability_not_granted",
  };
}

/**
 * Check if user has health.read access.
 * Convenience function for UI components.
 */
export function canReadHealth(session: SessionCapabilities): boolean {
  const result = evaluateCapability(session, "health.read");
  return result.granted;
}

/**
 * Check if session is authenticated.
 */
export function isAuthenticated(session: SessionCapabilities): boolean {
  return session.sessionId !== null;
}

// ============================================================================
// Permission Boundary Component
// ============================================================================

/**
 * Props for HealthPermissionBoundary.
 */
export interface HealthPermissionBoundaryProps {
  /** Session capabilities */
  session: SessionCapabilities;
  /** Required capability */
  requiredCapability: HealthCapability;
  /** Children to render if granted */
  children: React.ReactNode;
  /** Fallback to render if denied */
  fallback?: React.ReactNode;
  /** Custom denied component */
  deniedComponent?: React.ComponentType<PermissionDeniedProps>;
}

/**
 * Props passed to denied component.
 */
export interface PermissionDeniedProps {
  reason: PermissionDeniedReason;
  capability: HealthCapability;
}

/**
 * Health Permission Boundary component.
 *
 * Renders children only if capability is granted.
 * Shows denied state otherwise.
 *
 * Usage:
 * ```tsx
 * <HealthPermissionBoundary
 *   session={session}
 *   requiredCapability="health.read"
 *   fallback={<LoadingState />}
 * >
 *   <HealthContent />
 * </HealthPermissionBoundary>
 * ```
 */
export function HealthPermissionBoundary({
  session,
  requiredCapability,
  children,
  fallback,
  deniedComponent: DeniedComponent,
}: HealthPermissionBoundaryProps) {
  const result = evaluateCapability(session, requiredCapability);

  if (result.granted) {
    return <>{children}</>;
  }

  if (DeniedComponent) {
    return <DeniedComponent reason={result.reason} capability={requiredCapability} />;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Default denied UI
  return <DefaultDeniedState reason={result.reason} capability={requiredCapability} />;
}

/**
 * Default denied state component.
 */
function DefaultDeniedState({ reason, capability }: PermissionDeniedProps) {
  const message = getDeniedMessage(reason, capability);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <svg
          className="h-8 w-8 text-destructive"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-6a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium">Acesso Negado</h3>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Get human-readable denied message.
 */
function getDeniedMessage(
  reason: PermissionDeniedReason,
  capability: HealthCapability
): string {
  switch (reason) {
    case "no_session":
      return "Faça login para acessar esta funcionalidade.";
    case "no_capabilities":
      return "Você não possui permissões de saúde.";
    case "capability_not_granted":
      return `Você não possui a permissão necessária: ${capability}`;
    case "legacy_view_not_present":
      return "Acesso legacy não disponível para esta funcionalidade.";
    case "unknown_capability":
      return `Capability desconhecida: ${capability}. Acesso negado por segurança.`;
    default:
      return "Acesso negado.";
  }
}

// ============================================================================
// Legacy Adapter Check
// ============================================================================

/**
 * Check if session has legacy health.view permission.
 * This grants ONLY read-only access via the legacy adapter.
 *
 * IMPORTANT: This does NOT grant health.read in Backend.
 * It only provides UI compatibility during transition.
 */
export function hasLegacyHealthView(session: SessionCapabilities): boolean {
  return session.legacyPermissions.includes("health.view");
}

/**
 * Get read capabilities from legacy adapter.
 * Returns health.read if legacy view is present.
 *
 * NOTE: Only returns health.read, NOT any write capabilities.
 */
export function getLegacyReadCapabilities(session: SessionCapabilities): HealthCapability[] {
  const legacyCaps = LEGACY_TO_GRANULAR["health.view"];
  if (session.legacyPermissions.includes("health.view") && legacyCaps.includes("health.read")) {
    return ["health.read"];
  }
  return [];
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock session with explicit capability.
 */
export function createSessionWithCapability(capability: HealthCapability): SessionCapabilities {
  return {
    sessionId: "test-session-123",
    legacyPermissions: [],
    explicitCapabilities: [capability],
  };
}

/**
 * Create a mock session with legacy health.view.
 */
export function createLegacyViewSession(): SessionCapabilities {
  return {
    sessionId: "test-session-123",
    legacyPermissions: ["health.view"],
    explicitCapabilities: [],
  };
}

/**
 * Create a mock unauthenticated session.
 */
export function createNoSession(): SessionCapabilities {
  return {
    sessionId: null,
    legacyPermissions: [],
    explicitCapabilities: [],
  };
}

/**
 * Create a mock session with write legacy permissions (should NOT grant write).
 */
export function createWriteLegacySession(): SessionCapabilities {
  return {
    sessionId: "test-session-123",
    legacyPermissions: ["health.view", "health.create", "health.edit"],
    explicitCapabilities: [],
  };
}
