/**
 * HW-2 E2E Test 2: Canonical User Opens Health Shell
 *
 * Validates:
 * - Canonical user can access /health
 * - Health shell is visible with header
 * - Secondary navigation with exactly 7 items is visible
 * - "Saúde" navigation item is active
 * - All 7 navigation items are present
 */

import { test, expect } from "./auth.setup";

test.describe("HW-2 Test 2: Canonical User Shell Access", () => {
  test.beforeEach(async ({ page, authenticateAs }) => {
    await authenticateAs("canonical");
    await page.goto("/health");
  });

  test("should display health shell header for canonical user", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Shell header should be visible - look for the Activity icon and "Saúde" text
    const header = page.locator("header").filter({ hasText: /saúde/i });
    await expect(header).toBeVisible({ timeout: 5000 });

    // Activity icon should be present
    const activityIcon = page.locator("header svg").first();
    await expect(activityIcon).toBeVisible();
  });

  test("should show secondary navigation with exactly 7 items", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Secondary navigation should be present
    const secondaryNav = page.locator('nav[aria-label*="saúde" i]');
    await expect(secondaryNav).toBeVisible({ timeout: 5000 });

    // Get all 7 navigation items by their expected labels
    const navLabels = [
      "Visão Geral",
      "Prontidão",
      "Agenda",
      "Clínico",
      "Nutrição",
      "Histórico",
      "Relatórios",
    ];

    for (const label of navLabels) {
      const navLink = page.getByRole("link", { name: new RegExp(`^${label}$`) });
      await expect(navLink).toBeVisible();
    }

    // Verify exactly 7 items (no more, no less)
    const allNavLinks = page.locator('nav[aria-label*="saúde" i] a[role="link"]');
    const count = await allNavLinks.count();
    expect(count).toBe(7);
  });

  test("should show Visão Geral as active item on /health", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for Visão Geral link with aria-current="page"
    const overviewLink = page.getByRole("link", { name: /^Visão Geral$/i });
    await expect(overviewLink).toBeVisible();
    await expect(overviewLink).toHaveAttribute("aria-current", "page");
  });

  test("should show Saúde active in sidebar when on overview", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Main health sidebar should show Saúde active
    const saudeLink = page.locator("nav").filter({ hasText: /saúde/i }).locator('a[aria-current="page"]');
    await expect(saudeLink).toBeVisible({ timeout: 3000 });
  });

  test("should navigate to each of the 7 sub-routes", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const routes = [
      { name: "Prontidão", href: "/health/readiness" },
      { name: "Agenda", href: "/health/schedule" },
      { name: "Clínico", href: "/health/clinical" },
      { name: "Nutrição", href: "/health/nutrition" },
      { name: "Histórico", href: "/health/history" },
      { name: "Relatórios", href: "/health/reports" },
    ];

    for (const route of routes) {
      const link = page.getByRole("link", { name: new RegExp(`^${route.name}$`) });
      await link.click();
      await expect(page).toHaveURL(new RegExp(route.href));

      // Verify navigation is still visible
      const nav = page.locator('nav[aria-label*="saúde" i]');
      await expect(nav).toBeVisible({ timeout: 3000 });

      // Go back to overview
      const overviewLink = page.getByRole("link", { name: /^Visão Geral$/i });
      await overviewLink.click();
      await expect(page).toHaveURL("/health");
    }
  });
});
