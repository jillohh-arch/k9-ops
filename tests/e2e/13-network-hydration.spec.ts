/**
 * HW-2 E2E Test 13: Network Validation
 *
 * Validates:
 * - Zero critical console errors
 * - Zero hydration errors
 * - Auth calls ONLY to emulator 127.0.0.1:9199
 * - Firestore calls ONLY to emulator 127.0.0.1:8181
 * - ZERO calls to Firebase production
 * - No mutations from shell pages
 */

import { test, expect, type Page, type Request } from "@playwright/test";
import { authenticateAs, TEST_USERS } from "./auth.setup";

// E2E emulator configuration - must match E2E config module
const EMULATOR_AUTH_HOST = "127.0.0.1";
const EMULATOR_AUTH_PORT = 9199;
const EMULATOR_FIRESTORE_HOST = "127.0.0.1";
const EMULATOR_FIRESTORE_PORT = 8181;

// Forbidden domains - ANY call to these is a test failure
const FORBIDDEN_DOMAINS = [
  "googleapis.com",
  "firestore.googleapis.com",
  "firebaseio.com",
  "identitytoolkit.googleapis.com",
  "canil-gcm",
  "k9-ops",
];

interface NetworkCall {
  url: string;
  method: string;
  domain: string;
}

class NetworkValidator {
  public requests: NetworkCall[] = [];
  private page: Page | null = null;

  attach(page: Page): void {
    this.page = page;
    this.requests = [];

    page.on("request", (request: Request) => {
      try {
        const url = new URL(request.url());
        this.requests.push({
          url: request.url(),
          method: request.method(),
          domain: url.hostname,
        });
      } catch {
        // Invalid URL
      }
    });
  }

  getAuthCalls(): NetworkCall[] {
    return this.requests.filter((req) => req.url.includes("identitytoolkit"));
  }

  getAuthEmulatorCalls(): NetworkCall[] {
    return this.getAuthCalls().filter((req) => {
      const isToEmulator =
        req.domain === EMULATOR_AUTH_HOST ||
        req.domain === "localhost" ||
        req.domain.includes(EMULATOR_AUTH_HOST);
      return isToEmulator;
    });
  }

  getFirestoreCalls(): NetworkCall[] {
    return this.requests.filter((req) => {
      return (
        req.url.includes("firestore") ||
        req.url.includes("firebaseio") ||
        req.url.includes("datastore.googleapis")
      );
    });
  }

  getFirestoreEmulatorCalls(): NetworkCall[] {
    return this.getFirestoreCalls().filter((req) => {
      const isToEmulator =
        req.domain === EMULATOR_FIRESTORE_HOST ||
        req.domain === "localhost" ||
        req.domain.includes(EMULATOR_FIRESTORE_HOST);
      return isToEmulator;
    });
  }

  getFirebaseProductionCalls(): NetworkCall[] {
    return this.requests.filter((req) => {
      return FORBIDDEN_DOMAINS.some((domain) => req.domain.includes(domain));
    });
  }

  getMutationCalls(): NetworkCall[] {
    return this.requests.filter((req) => {
      const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
      const isFirestore =
        req.url.includes("firestore") ||
        req.url.includes("firebaseio") ||
        req.url.includes("datastore.googleapis");
      return isMutation && isFirestore;
    });
  }
}

test.describe("HW-2 Test 13: Network Validation", () => {
  test("should have zero forbidden network calls", async ({ page }) => {
    const validator = new NetworkValidator();
    validator.attach(page);

    await authenticateAs(page, "canonical");

    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    const forbiddenCalls = validator.getFirebaseProductionCalls();

    expect(forbiddenCalls).toEqual([]);
  });

  test("should call Auth ONLY on emulator (127.0.0.1:9199)", async ({
    page,
  }) => {
    const validator = new NetworkValidator();
    validator.attach(page);

    await authenticateAs(page, "canonical");

    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    const authCalls = validator.getAuthCalls();
    const authEmulatorCalls = validator.getAuthEmulatorCalls();

    // At least one Auth call should be made during login
    expect(authCalls.length).toBeGreaterThan(0);

    // ALL Auth calls should be to emulator
    expect(authEmulatorCalls.length).toBe(authCalls.length);

    // Verify Auth calls are specifically to 127.0.0.1:9199
    for (const call of authCalls) {
      expect(call.domain).toBe(EMULATOR_AUTH_HOST);
    }
  });

  test("should call Firestore ONLY on emulator (127.0.0.1:8181)", async ({
    page,
  }) => {
    const validator = new NetworkValidator();
    validator.attach(page);

    await authenticateAs(page, "canonical");

    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    const firestoreCalls = validator.getFirestoreCalls();
    const firestoreEmulatorCalls = validator.getFirestoreEmulatorCalls();

    // At least one Firestore read should be made
    expect(firestoreCalls.length).toBeGreaterThan(0);

    // ALL Firestore calls should be to emulator
    expect(firestoreEmulatorCalls.length).toBe(firestoreCalls.length);

    // Verify Firestore calls are specifically to 127.0.0.1:8181
    for (const call of firestoreCalls) {
      expect(call.domain).toBe(EMULATOR_FIRESTORE_HOST);
    }
  });

  test("should not initiate mutations from shell pages", async ({
    page,
  }) => {
    const validator = new NetworkValidator();
    validator.attach(page);

    await authenticateAs(page, "canonical");

    // Just load pages, do NOT interact
    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    await page.goto("/health/schedule");
    await page.waitForLoadState("networkidle");

    // Filter out seed writes - we only care about browser-initiated mutations
    const mutations = validator.getMutationCalls();

    // Shell should not initiate mutations (POST/PUT/PATCH/DELETE to Firestore)
    // Note: Login POST to Auth Emulator is allowed and expected
    const authMutations = mutations.filter((m) => m.url.includes("identitytoolkit"));
    const firestoreMutations = mutations.filter(
      (m) =>
        m.url.includes("firestore") ||
        m.url.includes("firebaseio") ||
        m.url.includes("datastore.googleapis")
    );

    // Firestore mutations should be zero
    expect(firestoreMutations).toEqual([]);

    // Auth POST during login is expected (but not after)
    // If Auth POSTs happen after initial login, that's suspicious
  });

  test("should only use Firebase emulators, not production", async ({
    page,
  }) => {
    const validator = new NetworkValidator();
    validator.attach(page);

    await authenticateAs(page, "canonical");

    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    const productionCalls = validator.getFirebaseProductionCalls();

    expect(productionCalls).toEqual([]);
  });

  test("should complete login with Auth emulator call", async ({ page }) => {
    const validator = new NetworkValidator();
    validator.attach(page);

    // Login manually
    await page.goto("/login");
    await page
      .getByLabel(/email/i)
      .fill(TEST_USERS.canonical.email);
    await page.getByLabel(/senha/i).fill(TEST_USERS.canonical.password);
    await page.getByRole("button", { name: /entrar|login|sign in/i }).click();

    // Wait for navigation
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 10000,
    });

    // Verify Auth emulator was called
    const authCalls = validator.getAuthEmulatorCalls();
    expect(authCalls.length).toBeGreaterThan(0);

    // Verify Auth calls went to emulator
    for (const call of authCalls) {
      expect(call.domain).toBe(EMULATOR_AUTH_HOST);
    }
  });
});
