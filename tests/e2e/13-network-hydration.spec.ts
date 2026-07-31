/**
 * HW-2 E2E Test 13: Console, Hydration, and Network Validation
 *
 * Validates:
 * - Zero critical console errors
 * - Zero hydration errors
 * - No Firebase production calls
 * - Auth only to emulator
 * - Firestore only to emulator
 * - No mutations
 */

// Forbidden domains that should never be called
const FORBIDDEN_DOMAINS = [
  "googleapis.com",
  "firebaseio.com",
  "firestore.googleapis.com",
  "identitytoolkit.googleapis.com",
  "canil-gcm",
];

const ALLOWED_HOSTS = ["localhost", "127.0.0.1", "demo-k9-ops"];

import { test, expect, type Page } from "@playwright/test";
import { authenticateAs } from "./auth.setup";

interface NetworkRequest {
  url: string;
  domain: string;
  method: string;
}

class NetworkValidator {
  public requests: NetworkRequest[] = [];
  private page: Page | null = null;

  attach(page: Page): void {
    this.page = page;
    this.requests = [];

    page.on("request", (request) => {
      try {
        const url = new URL(request.url());
        this.requests.push({
          url: request.url(),
          domain: url.hostname,
          method: request.method(),
        });
      } catch {
        // Invalid URL, ignore
      }
    });
  }

  getForbiddenCalls(): NetworkRequest[] {
    return this.requests.filter((req) => {
      // Check if domain matches any forbidden pattern
      const isForbidden = FORBIDDEN_DOMAINS.some((domain) =>
        req.domain.includes(domain)
      );

      // Allow demo-k9-ops in emulator context
      const isAllowedEmulator =
        ALLOWED_HOSTS.some((host) => req.domain.includes(host)) &&
        req.domain.includes("demo");

      return isForbidden && !isAllowedEmulator;
    });
  }

  getFirebaseProductionCalls(): NetworkRequest[] {
    return this.requests.filter((req) => {
      const isFirebaseProduction =
        req.domain.includes("googleapis.com") ||
        req.domain.includes("firebaseio.com") ||
        req.domain.includes("firestore.googleapis.com") ||
        (req.domain.includes("identitytoolkit.googleapis.com") &&
          !req.domain.includes("demo"));

      return isFirebaseProduction;
    });
  }

  getMutationCalls(): NetworkRequest[] {
    return this.requests.filter(
      (req) =>
        ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
        (req.url.includes("firestore.googleapis.com") ||
          req.url.includes("firebaseio.com"))
    );
  }
}

test.describe("HW-2 Test 13: Console, Hydration, and Network", () => {
  let validator: NetworkValidator;

  test.beforeEach(async ({ page }) => {
    validator = new NetworkValidator();
    validator.attach(page);
  });

  test("should have no critical console errors during authenticated navigation", async ({
    page,
  }) => {
    await authenticateAs(page, "canonical");

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate through health routes
    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    await page.goto("/health/schedule");
    await page.waitForLoadState("networkidle");

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes("ResizeObserver") && // Non-critical layout warning
        !err.includes("favicon") && // Non-critical
        !err.includes("hydration") // Checked separately
    );

    expect(criticalErrors).toEqual([]);
  });

  test("should have no hydration errors", async ({ page }) => {
    await authenticateAs(page, "canonical");

    const hydrationErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("hydration")) {
        hydrationErrors.push(msg.text());
      }
    });

    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    // Hydration should complete without errors
    await page.waitForTimeout(1000); // Allow hydration to complete

    expect(hydrationErrors).toEqual([]);
  });

  test("should only use Firebase emulators, not production", async ({
    page,
  }) => {
    await authenticateAs(page, "canonical");

    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    // Check for production Firebase calls
    const productionCalls = validator.getFirebaseProductionCalls();

    if (productionCalls.length > 0) {
      console.log("Production calls found:", productionCalls);
    }

    expect(productionCalls).toEqual([]);
  });

  test("should only call Auth on emulator localhost", async ({
    page,
  }) => {
    await authenticateAs(page, "canonical");

    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    // Check Auth calls
    const authCalls = validator.requests.filter((req) =>
      req.url.includes("identitytoolkit")
    );

    for (const call of authCalls) {
      // All Auth calls should be to emulator
      expect(call.domain).toMatch(/localhost|127\.0\.0\.1|demo/);
    }
  });

  test("should only call Firestore on emulator localhost", async ({
    page,
  }) => {
    await authenticateAs(page, "canonical");

    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    // Check Firestore calls
    const firestoreCalls = validator.requests.filter(
      (req) =>
        req.url.includes("firestore") || req.url.includes("firebaseio")
    );

    for (const call of firestoreCalls) {
      // All Firestore calls should be to emulator
      expect(call.domain).toMatch(/localhost|127\.0\.0\.1|demo/);
    }
  });

  test("should not initiate mutations from shell", async ({
    page,
  }) => {
    await authenticateAs(page, "canonical");

    // Just load pages, don't interact
    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    await page.goto("/health/schedule");
    await page.waitForLoadState("networkidle");

    // Check for mutation calls (POST/PUT/PATCH/DELETE)
    const mutations = validator.getMutationCalls();

    if (mutations.length > 0) {
      console.log("Mutation calls found:", mutations);
    }

    // Read-only shell should not initiate mutations
    expect(mutations).toEqual([]);
  });

  test("should have zero forbidden network calls", async ({
    page,
  }) => {
    await authenticateAs(page, "canonical");

    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    await page.goto("/health/clinical");
    await page.waitForLoadState("networkidle");

    const forbiddenCalls = validator.getForbiddenCalls();

    if (forbiddenCalls.length > 0) {
      console.log("Forbidden calls found:", forbiddenCalls);
    }

    expect(forbiddenCalls).toEqual([]);
  });
});
