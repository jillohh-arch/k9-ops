/**
 * HW-2 E2E Test 11: Desktop Viewport (1440x900)
 *
 * Validates:
 * - /health renders without overflow
 * - /health/readiness renders without clipping
 * - /health/schedule renders without overflow
 * - Sidebar is usable
 */

import { test, expect } from "@playwright/test";
import { authenticateAs } from "./auth.setup";

test.describe("HW-2 Test 11: Desktop Viewport (1440x900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await authenticateAs(page, "canonical");
  });

  test("should Render /health without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    // Check for horizontal overflow
    const body = page.locator("body");
    const scrollWidth = await body.evaluate((el) => el.scrollWidth);
    const clientWidth = await body.evaluate((el) => el.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    // Sidebar should be visible
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
  });

  test("should render /health/readiness without clipping", async ({
    page,
  }) => {
    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    // Main content should not be clipped
    const main = page.locator("main, [role='main']");
    const mainBox = await main.boundingBox();

    if (mainBox) {
      // Content should be within viewport
      expect(mainBox.x).toBeGreaterThanOrEqual(0);
      expect(mainBox.width).toBeLessThanOrEqual(1440);
    }
  });

  test("should render /health/schedule without overflow", async ({
    page,
  }) => {
    await page.goto("/health/schedule");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    const scrollWidth = await body.evaluate((el) => el.scrollWidth);
    const clientWidth = await body.evaluate((el) => el.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
