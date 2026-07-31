/**
 * HW-2 E2E Test 4: Seven Routes Validation
 *
 * Validates all 7 Health routes have correct titles and active items:
 * - /health
 * - /health/readiness
 * - /health/schedule
 * - /health/clinical
 * - /health/nutrition
 * - /health/history
 * - /health/reports
 */

import { test, expect } from "./auth.setup";

const HEALTH_ROUTES = [
  { path: "/health", name: "health", activeName: /saúde|health/i },
  { path: "/health/readiness", name: "readiness", activeName: /prontidão|readiness/i },
  { path: "/health/schedule", name: "schedule", activeName: /agenda|schedule/i },
  { path: "/health/clinical", name: "clinical", activeName: /clínico|clinical/i },
  { path: "/health/nutrition", name: "nutrition", activeName: /nutrição|nutrition/i },
  { path: "/health/history", name: "history", activeName: /histórico|history/i },
  { path: "/health/reports", name: "reports", activeName: /relatórios|reports/i },
];

test.describe("HW-2 Test 4: Seven Routes Validation", () => {
  test.beforeEach(async ({ page, authenticateAs }) => {
    await authenticateAs("canonical");
  });

  for (const route of HEALTH_ROUTES) {
    test(`should render /health/${route.name} with correct title and active item`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      // URL should match
      await expect(page).toHaveURL(new RegExp(route.path));

      // Should show a title (page heading or main content)
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible({ timeout: 5000 });

      // Active navigation item should match
      const activeLink = page.locator('[aria-current="page"], [aria-current="true"]');
      await expect(activeLink).toBeVisible();

      // The active link text should contain the route name
      const activeText = await activeLink.textContent();
      expect(activeText).toMatch(route.activeName);
    });
  }
});
