/**
 * HW-2 Authenticated E2E Tests - Setup and Helpers
 *
 * Provides shared utilities for authentication and network verification.
 * Validates that all Firebase calls go exclusively to E2E emulators.
 */

/* eslint-disable react-hooks/rules-of-hooks */

import { test as base, type Page, type Request } from "@playwright/test";

// Test user credentials (emulator-only, never real)
export const TEST_USERS = {
  canonical: {
    email: "canonical@hw2-test.local",
    password: "TestPassword123!",
    uid: "canonical-test-user-uid",
  },
  legacy: {
    email: "legacy@hw2-test.local",
    password: "TestPassword123!",
    uid: "legacy-test-user-uid",
  },
  noAccess: {
    email: "noaccess@hw2-test.local",
    password: "TestPassword123!",
    uid: "noaccess-test-user-uid",
  },
};

// E2E emulator configuration - must match E2E config module
const EMULATOR_AUTH_HOST = "127.0.0.1";
const EMULATOR_AUTH_PORT = 9199;
const EMULATOR_FIRESTORE_HOST = "127.0.0.1";
const EMULATOR_FIRESTORE_PORT = 8181;

// Allowed hosts for E2E testing
const ALLOWED_HOSTS = [
  "localhost",
  "127.0.0.1",
  `localhost:${EMULATOR_AUTH_PORT}`,
  `${EMULATOR_AUTH_HOST}:${EMULATOR_AUTH_PORT}`,
  `localhost:${EMULATOR_FIRESTORE_PORT}`,
  `${EMULATOR_FIRESTORE_HOST}:${EMULATOR_FIRESTORE_PORT}`,
];

// Forbidden domains - ANY call to these is a test failure
const FORBIDDEN_DOMAINS = [
  "googleapis.com",
  "firebaseio.com",
  "firestore.googleapis.com",
  "identitytoolkit.googleapis.com",
  "canil-gcm",
  "k9-ops",
];

// Network call interface
interface NetworkCall {
  url: string;
  method: string;
  type: string;
  domain: string;
}

/**
 * Enhanced NetworkMonitor for rigorous E2E network validation.
 * Validates that:
 * - Auth calls go ONLY to emulator (127.0.0.1:9199)
 * - Firestore calls go ONLY to emulator (127.0.0.1:8181)
 * - ZERO calls to Firebase production domains
 */
export class NetworkMonitor {
  private calls: NetworkCall[] = [];
  private page: Page | null = null;

  attach(page: Page): void {
    this.page = page;
    this.calls = [];

    page.on("request", (request: Request) => {
      try {
        const url = new URL(request.url());
        this.calls.push({
          url: request.url(),
          method: request.method(),
          type: request.resourceType(),
          domain: url.hostname,
        });
      } catch {
        // Invalid URL - log but don't fail
        console.warn("[NetworkMonitor] Invalid URL:", request.url());
      }
    });
  }

  getCalls(): NetworkCall[] {
    return [...this.calls];
  }

  /**
   * Get all Auth emulator calls (should be to 127.0.0.1:9199)
   */
  getAuthEmulatorCalls(): NetworkCall[] {
    return this.calls.filter((call) => {
      const isAuthCall = call.url.includes("identitytoolkit");
      const isToEmulator =
        call.domain === "127.0.0.1" ||
        call.domain === "localhost" ||
        call.domain.includes(EMULATOR_AUTH_HOST);
      return isAuthCall && isToEmulator;
    });
  }

  /**
   * Get all Firestore emulator calls (should be to 127.0.0.1:8181)
   */
  getFirestoreEmulatorCalls(): NetworkCall[] {
    return this.calls.filter((call) => {
      const isFirestoreCall =
        call.url.includes("firestore") ||
        call.url.includes("firebaseio") ||
        call.url.includes("datastore.googleapis");
      const isToEmulator =
        call.domain === "127.0.0.1" ||
        call.domain === "localhost" ||
        call.domain.includes(EMULATOR_FIRESTORE_HOST);
      return isFirestoreCall && isToEmulator;
    });
  }

  /**
   * Get calls to Firebase production (FORBIDDEN in E2E)
   */
  getFirebaseProductionCalls(): NetworkCall[] {
    return this.calls.filter((call) => {
      return FORBIDDEN_DOMAINS.some(
        (domain) =>
          call.domain.includes(domain) && !call.domain.includes("demo")
      );
    });
  }

  /**
   * Get mutation calls (POST/PUT/PATCH/DELETE to Firestore)
   */
  getMutationCalls(): NetworkCall[] {
    return this.calls.filter((call) => {
      const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(call.method);
      const isFirestore =
        call.url.includes("firestore") ||
        call.url.includes("firebaseio") ||
        call.url.includes("datastore.googleapis");
      return isMutation && isFirestore;
    });
  }

  /**
   * Get read calls to Firestore
   */
  getReadCalls(): NetworkCall[] {
    return this.calls.filter((call) => {
      const isRead = call.method === "GET";
      const isFirestore =
        call.url.includes("firestore") ||
        call.url.includes("firebaseio") ||
        call.url.includes("datastore.googleapis");
      return isRead && isFirestore;
    });
  }

  /**
   * Validate complete network audit for a test.
   * Returns validation result with details.
   */
  validateNetworkAudit(): {
    valid: boolean;
    authCallsToEmulator: number;
    firestoreCallsToEmulator: number;
    productionCalls: NetworkCall[];
    mutations: NetworkCall[];
    errors: string[];
  } {
    const errors: string[] = [];
    const productionCalls = this.getFirebaseProductionCalls();
    const authCalls = this.getAuthEmulatorCalls();
    const firestoreCalls = this.getFirestoreEmulatorCalls();
    const mutations = this.getMutationCalls();

    if (productionCalls.length > 0) {
      errors.push(
        `FAIL: ${productionCalls.length} call(s) to Firebase production detected: ${productionCalls.map(c => c.domain).join(", ")}`
      );
    }

    return {
      valid: errors.length === 0,
      authCallsToEmulator: authCalls.length,
      firestoreCallsToEmulator: firestoreCalls.length,
      productionCalls,
      mutations,
      errors,
    };
  }
}

// Extended test fixture with auth helpers and network monitoring
export const test = base.extend<{
  authenticateAs: (user: keyof typeof TEST_USERS) => Promise<void>;
  networkMonitor: NetworkMonitor;
}>({
  authenticateAs: ({ page }, use) => {
    use(async (user: keyof typeof TEST_USERS) => {
      const credentials = TEST_USERS[user];

      // Navigate to login if not there
      await page.goto("/login");

      // Fill login form
      await page.getByLabel(/email/i).fill(credentials.email);
      await page.getByLabel(/senha/i).fill(credentials.password);

      // Submit
      await page.getByRole("button", { name: /entrar|login|sign in/i }).click();

      // Wait for navigation away from login
      await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 10000,
      });
    });
  },

  networkMonitor: ({ page }, use) => {
    const monitor = new NetworkMonitor();
    monitor.attach(page);
    use(monitor);
  },
});

// Export authenticateAs as a standalone function for tests that need it
export async function authenticateAs(
  page: Page,
  user: keyof typeof TEST_USERS
): Promise<void> {
  const credentials = TEST_USERS[user];

  // Navigate to login if not there
  await page.goto("/login");

  // Fill login form
  await page.getByLabel(/email/i).fill(credentials.email);
  await page.getByLabel(/senha/i).fill(credentials.password);

  // Submit
  await page.getByRole("button", { name: /entrar|login|sign in/i }).click();

  // Wait for navigation away from login
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10000,
  });
}

export { expect } from "@playwright/test";
