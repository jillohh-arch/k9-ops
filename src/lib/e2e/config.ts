/**
 * E2E Test Environment Configuration
 *
 * Centralized configuration for all E2E test infrastructure.
 * This module is the SINGLE SOURCE OF TRUTH for port configuration.
 *
 * Security guarantees:
 * - Only used in E2E testing context
 * - No production impact
 * - No secrets required
 */

/** Auth Emulator Host */
export const AUTH_EMULATOR_HOST = "127.0.0.1";

/** Auth Emulator Port */
export const AUTH_EMULATOR_PORT = Number(
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT || "9199"
);

/** Firestore Emulator Host */
export const FIRESTORE_EMULATOR_HOST = "127.0.0.1";

/** Firestore Emulator Port */
export const FIRESTORE_EMULATOR_PORT = Number(
  process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT || "8181"
);

/** Firebase Hub Emulator Port */
export const HUB_EMULATOR_PORT = Number(
  process.env.NEXT_PUBLIC_FIREBASE_HUB_EMULATOR_PORT || "4545"
);

/** Firebase Emulator Project ID */
export const EMULATOR_PROJECT_ID = "demo-k9-ops";

/** Auth Emulator URL for direct HTTP calls */
export const AUTH_EMULATOR_URL = `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`;

/** Firestore Emulator URL for direct HTTP calls */
export const FIRESTORE_EMULATOR_URL = `${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`;

/** All E2E test ports for lifecycle management */
export const E2E_PORTS = {
  auth: AUTH_EMULATOR_PORT,
  firestore: FIRESTORE_EMULATOR_PORT,
  hub: HUB_EMULATOR_PORT,
  nextjs: 3000,
} as const;

/**
 * Validates that port values are within valid range.
 */
export function validateE2EPorts(): void {
  const ports = [
    { name: "Auth", port: AUTH_EMULATOR_PORT },
    { name: "Firestore", port: FIRESTORE_EMULATOR_PORT },
    { name: "Hub", port: HUB_EMULATOR_PORT },
  ];

  for (const { name, port } of ports) {
    if (port < 1024 || port > 65535) {
      throw new Error(`[E2E Config] Invalid port for ${name}: ${port} (must be 1024-65535)`);
    }
  }
}

// Validate on module load
validateE2EPorts();
