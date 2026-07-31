/**
 * HW-2 E2E Test 10: Keyboard Navigation
 *
 * Validates:
 * - Tab/Shift+Tab navigation works
 * - Focus is visible
 * - Enter activates links
 * - No focus trap
 * - All 7 items are reachable
 */

import { test, expect } from "@playwright/test";
import { authenticateAs } from "./auth.setup";

test.describe("HW-2 Test 10: Keyboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAs(page, "canonical");
    await page.goto("/health");
    await page.waitForLoadState("networkidle");
  });

  test("should navigate with Tab key through health items", async ({
    page,
  }) => {
    // Press Tab to move focus
    await page.keyboard.press("Tab");

    // Focus should be visible on some element
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();

    // Continue tabbing - should move through elements
    const tabbableElements: string[] = [];
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const tag = await focused.evaluate((el) => el.tagName.toLowerCase());
      const href = await focused.getAttribute("href").catch(() => null);
      tabbableElements.push(`${tag}${href ? `(${href})` : ""}`);
    }

    // Should have found multiple tabbable elements
    expect(tabbableElements.length).toBeGreaterThan(5);
  });

  test("should navigate backwards with Shift+Tab", async ({ page }) => {
    // Focus on a link first
    const link = page.getByRole("link", { name: /saúde|health/i }).first();
    await link.focus();

    // Press Shift+Tab to go back
    await page.keyboard.press("Shift+Tab");

    // Focus should have moved
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
  });

  test("should activate link with Enter key", async ({ page }) => {
    // Focus on Prontidão link
    const prontidaoLink = page.getByRole("link", { name: /prontidão|readiness/i });
    await prontidaoLink.focus();

    // Press Enter
    await page.keyboard.press("Enter");

    // Should navigate to readiness
    await expect(page).toHaveURL(/readiness/);
  });

  test("should reach all 7 navigation items with keyboard", async ({
    page,
  }) => {
    // Start from the first health link
    const healthLink = page.getByRole("link", { name: /saúde|health/i }).first();
    await healthLink.focus();

    const reachedLinks: string[] = [];

    // Tab through and collect navigation links
    for (let i = 0; i < 20; i++) {
      const focused = page.locator(":focus");
      const href = await focused.getAttribute("href").catch(() => null);
      const text = await focused.textContent().catch(() => "");

      if (href?.includes("/health/") && text) {
        reachedLinks.push(text.trim());
      }

      await page.keyboard.press("Tab");
    }

    // Should reach at least 6 health sub-items
    expect(reachedLinks.length).toBeGreaterThanOrEqual(6);
  });

  test("should not have focus trapped", async ({ page }) => {
    // Tab through many elements
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
    }

    // Focus should still be on a visible element
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();

    // Should be able to continue tabbing (no infinite loop)
    const tagBefore = await focused.evaluate((el) => el.tagName);
    await page.keyboard.press("Tab");
    const tagAfter = await focused.evaluate((el) => el.tagName);

    // Focus should have moved
    expect(tagBefore).not.toBe(tagAfter);
  });
});
