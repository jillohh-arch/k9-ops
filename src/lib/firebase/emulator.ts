/**
 * Firebase Emulator Connection Module
 *
 * Provides secure, conditional connection to Firebase Auth and Firestore emulators.
 * This module is for LOCAL TESTING ONLY.
 *
 * Security guarantees:
 * - Only connects when NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true"
 * - Refuses to connect in production environment
 * - Guards against server-side execution
 * - Prevents duplicate connections
 * - No secrets or credentials required
 *
 * Port configuration is sourced from E2E config module to ensure consistency
 * across lifecycle, browser client, and seed scripts.
 */

import { connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";
import {
  AUTH_EMULATOR_HOST,
  AUTH_EMULATOR_PORT,
  FIRESTORE_EMULATOR_HOST,
  FIRESTORE_EMULATOR_PORT,
} from "../e2e/config";

/** Guard flag to prevent duplicate connections */
let isConnected = false;

/** Guard flag to prevent concurrent initialization */
let isConnecting = false;

/**
 * Environment validation result
 */
export interface EmulatorEnvironment {
  enabled: boolean;
  reason?: string;
}

/**
 * Validates that emulator connection is allowed in current environment.
 * Returns validation result without throwing.
 */
export function validateEmulatorEnvironment(): EmulatorEnvironment {
  // Server-side check
  if (typeof window === "undefined") {
    return {
      enabled: false,
      reason: "Server-side environment detected",
    };
  }

  // Production check
  if (process.env.NODE_ENV === "production") {
    return {
      enabled: false,
      reason: "Production environment detected - emulator connection refused",
    };
  }

  // Variable check
  const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS;
  if (useEmulators !== "true") {
    return {
      enabled: false,
      reason: `NEXT_PUBLIC_FIREBASE_USE_EMULATORS is not "true" (current: "${useEmulators}")`,
    };
  }

  return { enabled: true };
}

/**
 * Connects Firebase Auth and Firestore clients to their respective emulators.
 *
 * Uses port configuration from E2E config module for consistency.
 *
 * @param auth - Firebase Auth instance
 * @param db - Firestore instance
 *
 * @throws Error if environment validation fails
 * @throws Error if already connected
 * @throws Error if already connecting
 */
export function connectToEmulators(
  auth: Parameters<typeof connectAuthEmulator>[0],
  db: Parameters<typeof connectFirestoreEmulator>[0],
): void {
  // Prevent concurrent initialization
  if (isConnecting) {
    console.warn("[Emulator] Connection already in progress, skipping");
    return;
  }

  // Prevent duplicate connections
  if (isConnected) {
    console.warn("[Emulator] Already connected to emulators, skipping");
    return;
  }

  // Environment validation
  const validation = validateEmulatorEnvironment();
  if (!validation.enabled) {
    console.info(`[Emulator] Skipping connection: ${validation.reason}`);
    return;
  }

  // Mark as connecting to prevent race conditions
  isConnecting = true;

  try {
    // Connect Auth Emulator using E2E config ports
    const authUrl = `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`;
    connectAuthEmulator(auth, authUrl, { disableWarnings: true });

    // Connect Firestore Emulator using E2E config ports
    connectFirestoreEmulator(db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);

    // Mark as connected
    isConnected = true;

    console.info(`[Emulator] Connected to Auth (${authUrl}) and Firestore (${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT})`);
  } catch (error) {
    isConnecting = false;
    throw new Error(`Failed to connect to emulators: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isConnecting = false;
  }
}

/**
 * Checks if emulators are currently connected.
 */
export function areEmulatorsConnected(): boolean {
  return isConnected;
}

/**
 * Resets connection state (for testing only).
 * This function should never be called in production code.
 */
export function _resetEmulatorState(): void {
  isConnected = false;
  isConnecting = false;
}
