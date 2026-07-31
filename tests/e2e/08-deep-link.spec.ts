/**
 * HW-2 E2E Test 8: Deep Link Navigation
 *
 * Validates:
 * - Direct navigation to /health/clinical preserves session
 * - Shell and route are correct
 * - Clínico item is active
 */

import { test, expect } from "./auth.setup";

test.describe("HW-2 Test 8: Deep Link Navigation", () => {
  test.beforeEach(async ({ page, authenticateAs }) => {
    await authenticateAs("canonical");
  });

  test("should preserve session and route when opening /health/clinical directly", async ({
    page,
  }) => {
    // Authenticate first
    await page.waitForURL((url) => !url.pathname.includes("/login"));

    // Now open clinical directly
    await page.goto("/health/clinical");
    await page.waitForLoadState("networkidle");

    // URL should be preserved
    await expect(page).toHaveURL(/clinical/);

    // Shell should be visible
    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 5000 });

    // Clínico item should be active
    const clinicoLink = page.getByRole("link", { name: /clínico|clinical/i });
    await expect(clinicoLink).toBeVisible();
    await expect(clinicoLink).toHaveAttribute("aria-current", /page/i);
  });

  test("should preserve session when opening /health/reports directly", async ({
    page,
  }) => {
    await page.goto("/health/reports");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/reports/);

    // Should not redirect to login (session preserved)
    await expect(page).not.toHaveURL(/\/login/);

    // Relatórios should be active
    const relatoriosLink = page.getByRole("link", { name: /relatórios|reports/i });
    await expect(relatoriosLink).toHaveAttribute("aria-current", /page/i);
  });
});
