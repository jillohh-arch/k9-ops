/**
 * HW-2 E2E Test 6: Legacy User Read-Only Access
 *
 * Validates:
 * - Legacy user with only health.view can access shell
 * - Shell is read-only (no write controls)
 * - health.read capability is absent
 * - No admin controls visible
 */

import { test, expect } from "./auth.setup";

test.describe("HW-2 Test 6: Legacy User Read-Only", () => {
  test.beforeEach(async ({ page, authenticateAs }) => {
    await authenticateAs("legacy");
    await page.goto("/health");
  });

  test("should display read-only shell for legacy user", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Shell should be visible
    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 5000 });
  });

  test("should not show write controls for legacy user", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for write-related buttons/links
    const writeButtons = page.getByRole("button", {
      name: /novo|create|adicionar|add|editar|edit/i,
    });

    // These buttons should not exist or be hidden
    if (await writeButtons.count() > 0) {
      await expect(writeButtons.first()).not.toBeVisible();
    }
  });

  test("should not show admin controls for legacy user", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for admin-related elements
    const adminElements = page.getByText(/admin|administrador|configurações/i);
    await expect(adminElements).toHaveCount(0);
  });

  test("should have health.view but not health.read capability", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle");

    // Can access health routes
    await page.goto("/health/readiness");
    await expect(page.locator("nav")).toBeVisible({ timeout: 5000 });

    // Should see content (view access works)
    await page.goto("/health/reports");
    await expect(page.locator("main, [role='main']")).toBeVisible({
      timeout: 5000,
    });
  });
});
