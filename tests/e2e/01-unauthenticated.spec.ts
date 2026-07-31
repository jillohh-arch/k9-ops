/**
 * HW-2 E2E Test 1: Unauthenticated User Redirect
 *
 * Validates:
 * - Opening /health without session redirects to /login
 * - Health shell is not rendered
 */

import { test, expect } from "./auth.setup";

test.describe("HW-2 Test 1: Unauthenticated User", () => {
  test("should redirect to /login when accessing /health without session", async ({
    page,
  }) => {
    // Clear any existing session
    await page.context().clearCookies();

    // Navigate to health
    await page.goto("/health");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Health shell should not be present
    const healthNav = page.locator('nav[aria-label*="saúde" i], nav[aria-label*="health" i], [data-testid="health-sidebar"]');
    await expect(healthNav).not.toBeVisible({ timeout: 2000 });

    // Should see login form
    await expect(page.getByRole("heading", { name: /login|entrar|acesso/i })).toBeVisible();
  });

  test("should not show any health content on login page", async ({ page }) => {
    await page.goto("/login");

    // Should not show health navigation items
    const healthItems = page.getByRole("link", { name: /saúde|health/i });
    await expect(healthItems).toHaveCount(0);
  });
});
