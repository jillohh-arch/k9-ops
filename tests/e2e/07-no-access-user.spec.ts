/**
 * HW-2 E2E Test 7: User Without Health Access
 *
 * Validates:
 * - User without health permissions sees forbidden state OR is redirected
 * - Protected content is not rendered
 * - No mutation is possible
 * - Uses rigorous pathname comparison
 */

import { test, expect } from "./auth.setup";

test.describe("HW-2 Test 7: User Without Access", () => {
  test.beforeEach(async ({ authenticateAs }) => {
    await authenticateAs("noAccess");
  });

  test("should show forbidden state when accessing health without permissions", async ({
    page,
  }) => {
    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    // Use rigorous pathname comparison
    const currentPathname = new URL(page.url()).pathname;

    // Either shows forbidden OR redirects away from /health
    const showsForbidden = await page.getByText(/acesso negado|forbidden|proibido|sem permissão|acesso negado/i).isVisible().catch(() => false);
    const showsUnauthorized = await page.getByText(/não autorizado|unauthorized/i).isVisible().catch(() => false);
    const isRedirected = currentPathname !== "/health" && !currentPathname.startsWith("/health/");

    expect(showsForbidden || showsUnauthorized || isRedirected).toBe(true);
  });

  test("should NOT show health content for no-access user", async ({
    page,
  }) => {
    await page.goto("/health");
    await page.waitForLoadState("networkidle");

    // Use rigorous pathname comparison
    const currentPathname = new URL(page.url()).pathname;

    // If on /health, should show forbidden
    if (currentPathname === "/health") {
      const forbiddenText = page.getByText(/acesso|forbidden|proibido/i);
      await expect(forbiddenText).toBeVisible({ timeout: 3000 });
    } else {
      // If redirected, should not be on /health
      expect(currentPathname).not.toMatch(/^\/health($|\/)/);
    }
  });

  test("should not have write controls accessible", async ({ page }) => {
    // Even if user somehow accesses health routes
    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    const currentPathname = new URL(page.url()).pathname;

    // Should either show forbidden or be redirected
    if (currentPathname.startsWith("/health")) {
      // No write buttons should be visible
      const writeButtons = page.getByRole("button", {
        name: /novo|create|adicionar|add/i,
      });

      const visibleWriteButtons = await writeButtons
        .filter({ hasNot: page.locator('[disabled]') })
        .filter({ hasNot: page.locator('[hidden]') })
        .count();

      expect(visibleWriteButtons).toBe(0);
    }
  });

  test("should redirect to login when accessing health without session", async ({
    page,
  }) => {
    // Clear session
    await page.context().clearCookies();

    await page.goto("/health");

    // Should redirect to /login
    const currentPathname = new URL(page.url()).pathname;
    expect(currentPathname).toBe("/login");
  });
});
