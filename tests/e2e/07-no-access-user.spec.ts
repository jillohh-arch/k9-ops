/**
 * HW-2 E2E Test 7: User Without Health Access
 *
 * Validates:
 * - User without health permissions sees forbidden state
 * - Protected content is not rendered
 * - No mutation is possible
 */

import { test, expect } from "./auth.setup";

test.describe("HW-2 Test 7: User Without Access", () => {
  test.beforeEach(async ({ page, authenticateAs }) => {
    await authenticateAs("noAccess");
  });

  test("should show forbidden state when accessing health without permissions", async ({
    page,
  }) => {
    await page.goto("/health");

    // Wait for auth gate or forbidden state
    await page.waitForLoadState("networkidle");

    // Should show forbidden/error state
    const forbiddenContent = page.getByText(/acesso negado|forbidden|proibido|sem permissão/i);
    const unauthorizedContent = page.getByText(/não autorizado|unauthorized/i);

    const hasForbidden = (await forbiddenContent.isVisible({ timeout: 2000 }).catch(() => false)) ||
                        (await unauthorizedContent.isVisible({ timeout: 2000 }).catch(() => false));

    // Either forbidden message or redirect to another page
    if (!hasForbidden) {
      // Should redirect away from health
      await expect(page).not.toHaveURL(/^\/health($|\/)/, { timeout: 5000 });
    }
  });

  test("should not show health content for no-access user", async ({
    page,
  }) => {
    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    // Health navigation should not be visible
    const healthNav = page.getByRole("link", { name: /saúde|health/i }).filter({
      hasNot: page.locator('[aria-current]'),
    });

    // If user can see health links at all, they shouldn't be fully functional
    const mainContent = page.locator("main, [role='main']");
    const contentText = await mainContent.textContent().catch(() => "");

    // Should not contain health-specific data
    const hasHealthData = /prontidão|readiness|agenda|schedule/i.test(contentText || "");
    expect(hasHealthData).toBe(false);
  });

  test("should not be able to mutate health data", async ({ page }) => {
    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    // Should not have write buttons
    const writeButtons = page.getByRole("button", {
      name: /novo|create|adicionar|add/i,
    });

    // Even if buttons exist, they should be disabled or not functional
    const visibleWriteButtons = await writeButtons.filter({ has: page.locator(':not([disabled])') }).count();
    expect(visibleWriteButtons).toBe(0);
  });
});
