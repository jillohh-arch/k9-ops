/**
 * HW-2 E2E Test 9: Page Refresh Session Preservation
 *
 * Validates:
 * - Refresh preserves session
 * - Route is preserved
 * - Active item is preserved
 */

import { test, expect } from "./auth.setup";

test.describe("HW-2 Test 9: Page Refresh", () => {
  test.beforeEach(async ({ authenticateAs }) => {
    await authenticateAs("canonical");
  });

  test("should preserve session on refresh at /health/reports", async ({
    page,
  }) => {
    await page.goto("/health/reports");
    await page.waitForLoadState("networkidle");

    // Store active link before refresh
    const activeLink = page.locator('[aria-current="page"]');
    await expect(activeLink).toHaveAttribute("aria-current", /page/i);

    // Refresh
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Session preserved - still authenticated
    await expect(page).not.toHaveURL(/\/login/);

    // Route preserved
    await expect(page).toHaveURL(/reports/);

    // Active item preserved
    await expect(activeLink).toHaveAttribute("aria-current", /page/i);
  });

  test("should preserve session on refresh at /health/readiness", async ({
    page,
  }) => {
    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    const activeLink = page.getByRole("link", { name: /prontidão|readiness/i });
    await expect(activeLink).toHaveAttribute("aria-current", /page/i);

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/readiness/);
    await expect(activeLink).toHaveAttribute("aria-current", /page/i);
  });
});
