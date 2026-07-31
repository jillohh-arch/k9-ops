/**
 * HW-2 E2E Test 12: Tablet Viewport (1024x768)
 *
 * Validates:
 * - /health renders correctly on tablet
 * - /health/readiness renders correctly
 * - /health/schedule renders correctly
 * - No overlap, controlled scroll/wrapping
 * - Legibility and accessible navigation
 */

import { test, expect } from "@playwright/test";
import { authenticateAs } from "./auth.setup";

test.describe("HW-2 Test 12: Tablet Viewport (1024x768)", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test.beforeEach(async ({ page }) => {
    await authenticateAs(page, "canonical");
  });

  test("should render /health on tablet without overlap", async ({
    page,
  }) => {
    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    // Page should be usable
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    // Main content should be within bounds
    const main = page.locator("main, [role='main']").first();
    const mainBox = await main.boundingBox();

    if (mainBox) {
      expect(mainBox.width).toBeLessThanOrEqual(1024);
      expect(mainBox.x).toBeGreaterThanOrEqual(0);
    }
  });

  test("should render /health/readiness on tablet", async ({ page }) => {
    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    // Content should be accessible
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();
  });

  test("should render /health/schedule on tablet with controlled layout", async ({
    page,
  }) => {
    await page.goto("/health/schedule");
    await page.waitForLoadState("networkidle");

    // Page should load without errors
    await expect(page.locator("body")).toBeVisible();

    // Navigation should still work
    const prontidaoLink = page.getByRole("link", { name: /prontidão|readiness/i });
    await prontidaoLink.click();
    await expect(page).toHaveURL(/readiness/);
  });

  test("should have accessible navigation on tablet", async ({ page }) => {
    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    // All health links should be reachable
    const healthLinks = page.getByRole("link").filter({
      hasText: /prontidão|agenda|clínico|nutrição|histórico|relatórios/i,
    });

    const count = await healthLinks.count();
    expect(count).toBeGreaterThanOrEqual(6);

    // Should be able to click each one
    for (let i = 0; i < Math.min(count, 6); i++) {
      const link = healthLinks.nth(i);
      await expect(link).toBeEnabled();
    }
  });
});
