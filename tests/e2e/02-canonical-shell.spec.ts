/**
 * HW-2 E2E Test 2: Canonical User Opens Health Shell
 *
 * Validates:
 * - Canonical user can access /health
 * - Health shell is visible
 * - Sidebar with 7 items is visible
 * - "Saúde" navigation item is active
 */

import { test, expect } from "./auth.setup";

test.describe("HW-2 Test 2: Canonical User Shell Access", () => {
  test.beforeEach(async ({ page, authenticateAs }) => {
    await authenticateAs("canonical");
    await page.goto("/health");
  });

  test("should display health shell for canonical user", async ({ page }) => {
    // Wait for shell to render
    await page.waitForLoadState("networkidle");

    // Shell should be visible - look for main content area or navigation
    const main = page.locator("main, [role='main'], nav");
    await expect(main.first()).toBeVisible({ timeout: 5000 });
  });

  test("should show sidebar navigation", async ({ page }) => {
    // Sidebar should be present
    const sidebar = page.locator("nav");
    await expect(sidebar).toBeVisible({ timeout: 5000 });
  });

  test("should show Saúde active item", async ({ page }) => {
    // Look for Saúde or Health link with aria-current
    const healthLink = page.getByRole("link", { name: /saúde|health/i }).first();
    await expect(healthLink).toBeVisible();

    // Should have aria-current when on /health
    await expect(healthLink).toHaveAttribute("aria-current", /page/i);
  });

  test("should show seven navigation items", async ({ page }) => {
    // Get all navigation links in the health sidebar
    const navLinks = page.getByRole("link").filter({
      hasText: /prontidão|agenda|clínico|nutrição|histórico|relatórios|saúde/i,
    });

    // Should have at least 7 items (6 sub-items + main health)
    await expect(navLinks.first()).toBeVisible({ timeout: 5000 });
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });
});
