/** Shared, production-safe configuration for the HW-2 emulator environment. */

export const DEFAULT_E2E_CONFIG = {
  authHost: "127.0.0.1",
  authPort: 9199,
  firestoreHost: "127.0.0.1",
  firestorePort: 8181,
  hubHost: "127.0.0.1",
  hubPort: 4545,
  nextjsHost: "localhost",
  nextjsPort: 3000,
  projectId: "demo-k9-ops",
} as const;

type Environment = Record<string, string | undefined>;

export type E2EConfig = {
  authHost: string;
  authPort: number;
  firestoreHost: string;
  firestorePort: number;
  hubHost: string;
  hubPort: number;
  nextjsHost: string;
  nextjsPort: number;
  projectId: string;
};

function parsePort(value: string | undefined, fallback: number, name: string) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`[E2E Config] Invalid ${name} port: ${String(value ?? port)}`);
  }
  return port;
}

export function isLocalEmulatorHost(host: string) {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost";
}

export function assertLocalEmulatorHost(host: string, name: string) {
  if (!isLocalEmulatorHost(host)) {
    throw new Error(`[E2E Config] ${name} host must be local`);
  }
}

export function createE2EConfig(env: Environment = process.env): E2EConfig {
  return {
    authHost:
      env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ??
      DEFAULT_E2E_CONFIG.authHost,
    authPort: parsePort(
      env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT,
      DEFAULT_E2E_CONFIG.authPort,
      "Auth",
    ),
    firestoreHost:
      env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ??
      DEFAULT_E2E_CONFIG.firestoreHost,
    firestorePort: parsePort(
      env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT,
      DEFAULT_E2E_CONFIG.firestorePort,
      "Firestore",
    ),
    hubHost:
      env.NEXT_PUBLIC_FIREBASE_HUB_EMULATOR_HOST ??
      DEFAULT_E2E_CONFIG.hubHost,
    hubPort: parsePort(
      env.NEXT_PUBLIC_FIREBASE_HUB_EMULATOR_PORT,
      DEFAULT_E2E_CONFIG.hubPort,
      "Hub",
    ),
    nextjsHost: DEFAULT_E2E_CONFIG.nextjsHost,
    nextjsPort: parsePort(
      env.E2E_NEXTJS_PORT,
      DEFAULT_E2E_CONFIG.nextjsPort,
      "Next.js",
    ),
    projectId:
      env.FIREBASE_EMULATOR_PROJECT_ID ?? DEFAULT_E2E_CONFIG.projectId,
  };
}

const config = createE2EConfig();

export const AUTH_EMULATOR_HOST = config.authHost;
export const AUTH_EMULATOR_PORT = config.authPort;
export const FIRESTORE_EMULATOR_HOST = config.firestoreHost;
export const FIRESTORE_EMULATOR_PORT = config.firestorePort;
export const HUB_EMULATOR_HOST = config.hubHost;
export const HUB_EMULATOR_PORT = config.hubPort;
export const EMULATOR_PROJECT_ID = config.projectId;
export const AUTH_EMULATOR_URL = `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`;
export const FIRESTORE_EMULATOR_URL = `${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`;
export const E2E_PORTS = {
  auth: AUTH_EMULATOR_PORT,
  firestore: FIRESTORE_EMULATOR_PORT,
  hub: HUB_EMULATOR_PORT,
  nextjs: config.nextjsPort,
} as const;

export function validateE2EConfig(nextConfig: E2EConfig = config) {
  assertLocalEmulatorHost(nextConfig.authHost, "Auth emulator");
  assertLocalEmulatorHost(nextConfig.firestoreHost, "Firestore emulator");
  assertLocalEmulatorHost(nextConfig.hubHost, "Hub emulator");
  if (!nextConfig.projectId.startsWith("demo-")) {
    throw new Error("[E2E Config] Emulator project must use the demo- prefix");
  }
}
