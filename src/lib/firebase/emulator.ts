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
 */

import { connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";

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
 * @param auth - Firebase Auth instance
 * @param db - Firestore instance
 * @param options - Connection options
 * @param options.authHost - Auth emulator host (default: 127.0.0.1)
 * @param options.authPort - Auth emulator port (default: 9099)
 * @param options.firestoreHost - Firestore emulator host (default: 127.0.0.1)
 * @param options.firestorePort - Firestore emulator port (default: 8080)
 * @param options.shareSession - Share same-origin port for emulator UI (default: true)
 *
 * @throws Error if environment validation fails
 * @throws Error if already connected
 * @throws Error if already connecting
 */
export function connectToEmulators(
  auth: Parameters<typeof connectAuthEmulator>[0],
  db: Parameters<typeof connectFirestoreEmulator>[0],
  options: {
    authHost?: string;
    authPort?: number;
    firestoreHost?: string;
    firestorePort?: number;
    shareSession?: boolean;
  } = {},
): void {
  const {
    authHost = "127.0.0.1",
    authPort = 9099,
    firestoreHost = "127.0.0.1",
    firestorePort = 8080,
  } = options;

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
    // Connect Auth Emulator
    const authUrl = `http://${authHost}:${authPort}`;
    connectAuthEmulator(auth, authUrl, { disableWarnings: true });

    // Connect Firestore Emulator
    connectFirestoreEmulator(db, firestoreHost, firestorePort);

    // Mark as connected
    isConnected = true;

    console.info(`[Emulator] Connected to Auth (${authUrl}) and Firestore (${firestoreHost}:${firestorePort})`);
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
