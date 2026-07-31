/**
 * HW-2 E2E Test 3: Prontidão Active State
 *
 * Validates:
 * - Opening /health/readiness shows Prontidão with aria-current
 * - URL is preserved
 */

import { test, expect } from "./auth.setup";

test.describe("HW-2 Test 3: Prontidão Active Item", () => {
  test.beforeEach(async ({ page, authenticateAs }) => {
    await authenticateAs("canonical");
  });

  test("should have aria-current on Prontidão when on /health/readiness", async ({
    page,
  }) => {
    await page.goto("/health/readiness");
    await page.waitForLoadState("networkidle");

    // Find Prontidão link
    const prontidaoLink = page.getByRole("link", { name: /prontidão|readiness/i });
    await expect(prontidaoLink).toBeVisible();

    // Should have aria-current
    await expect(prontidaoLink).toHaveAttribute("aria-current", /page/i);
  });

  test("should preserve URL when accessing /health/readiness directly", async ({
    page,
  }) => {
    await page.goto("/health/readiness");
    await expect(page).toHaveURL(/readiness/);
  });
});
