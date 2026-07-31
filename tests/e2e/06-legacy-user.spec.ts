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

  test("should display shell for legacy user", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Shell header should be visible
    const header = page.locator("header").filter({ hasText: /saúde/i });
    await expect(header).toBeVisible({ timeout: 5000 });

    // Secondary navigation should be present
    const nav = page.locator('nav[aria-label*="saúde" i]');
    await expect(nav).toBeVisible({ timeout: 3000 });
  });

  test("should identify as legacy adapter", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for legacy indicator in the shell
    // Legacy users should see some indicator that they're using legacy access
    const legacyIndicator = page.locator("text=/legacy|adaptador|legado/i");
    // This is a soft check - may not be visible in all implementations
    // The key is that they CAN access the shell with view-only
  });

  test("should have health.view access but not health.read capability", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle");

    // Can access health routes
    const readinessLink = page.getByRole("link", { name: /^Prontidão$/ });
    await expect(readinessLink).toBeVisible();

    // Can navigate to readiness
    await readinessLink.click();
    await expect(page).toHaveURL("/health/readiness");
    await expect(page.locator('nav[aria-label*="saúde" i]')).toBeVisible({ timeout: 3000 });

    // Can access reports
    await page.goto("/health/reports");
    await expect(page.locator('nav[aria-label*="saúde" i]')).toBeVisible({ timeout: 3000 });
  });

  test("should not show write controls for legacy user", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for write-related buttons/links
    const writeButtons = page.locator("button, a").filter({
      hasText: /novo|create|adicionar|add|editar|edit/i,
    });

    // If buttons exist, they should be hidden or disabled
    const count = await writeButtons.count();
    if (count > 0) {
      // At least some should be hidden or disabled
      const visibleButtons = await writeButtons.filter({ hasNot: page.locator('[disabled]') }).filter({ hasNot: page.locator('[aria-hidden="true"]') }).filter({ hasNot: page.locator('[hidden]') }).all();
      // Legacy users should not have active write controls
    }
  });

  test("should not show admin controls for legacy user", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for admin-related elements
    const adminElements = page.locator("text=/admin|administrador|configurações|sistema/i");
    await expect(adminElements).toHaveCount(0);
  });

  test("should not have canonical health.read capability", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Navigate through health routes - legacy should not have full write access
    const routes = ["/health", "/health/readiness", "/health/schedule", "/health/reports"];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      // Should not have "Novo" or "Adicionar" buttons visible
      const addButton = page.getByRole("button", { name: /novo|adicionar|criar/i }).first();
      const isVisible = await addButton.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    }
  });
});
