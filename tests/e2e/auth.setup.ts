/**
 * HW-2 Authenticated E2E Tests - Setup and Helpers
 *
 * Provides shared utilities for authentication and network verification.
 */

/* eslint-disable react-hooks/rules-of-hooks */

import { test as base, type Page } from "@playwright/test";

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

// Network interception results
interface NetworkCall {
  url: string;
  type: string;
  domain: string;
}

const forbiddenDomains = [
  "googleapis.com",
  "firebaseio.com",
  "firestore.googleapis.com",
  "identitytoolkit.googleapis.com",
  "canil-gcm",
  "k9-ops",
];

export class NetworkMonitor {
  private calls: NetworkCall[] = [];

  start(page: Page): void {
    this.calls = [];
    page.on("request", (request) => {
      try {
        const url = new URL(request.url());
        this.calls.push({
          url: request.url(),
          type: request.resourceType(),
          domain: url.hostname,
        });
      } catch {
        // Invalid URL
      }
    });
  }

  getNonLocalCalls(): NetworkCall[] {
    return this.calls.filter((call) => {
      const isLocalhost =
        call.domain === "localhost" ||
        call.domain === "127.0.0.1" ||
        call.domain.startsWith("localhost:");
      const isForbidden = forbiddenDomains.some((d) =>
        call.domain.includes(d)
      );
      return !isLocalhost || isForbidden;
    });
  }

  getFirebaseProductionCalls(): NetworkCall[] {
    return this.calls.filter((call) => {
      const isFirebaseProduction = forbiddenDomains.some(
        (d) => call.domain.includes(d) && !call.domain.includes("demo")
      );
      return isFirebaseProduction;
    });
  }
}

// Extended test fixture with auth helpers
export const test = base.extend<{
  authenticateAs: (user: keyof typeof TEST_USERS) => Promise<void>;
  networkMonitor: NetworkMonitor;
}>({
  authenticateAs: ({ page }, use) => {
    // Playwright fixture hook - not a React hook
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
    // Playwright fixture hook - not a React hook
    const monitor = new NetworkMonitor();
    monitor.start(page);
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
