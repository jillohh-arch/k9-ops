import { expect, test } from "./auth.setup";

test.describe("HW-2 unauthenticated boundary", () => {
  test("redirects direct /health access to the RA login without rendering Health", async ({
    consoleMonitor,
    networkMonitor,
    page,
  }) => {
    await page.goto("/health");
    await page.waitForURL((url) => url.pathname === "/login", {
      timeout: 15_000,
    });

    expect(new URL(page.url()).pathname).toBe("/login");
    await expect(page.getByTestId("health-module-shell")).toHaveCount(0);
    await expect(page.getByLabel(/^RA$/i)).toBeVisible();
    await expect(page.getByLabel(/^Senha$/i)).toBeVisible();
    expect(networkMonitor.productionFirebaseCalls()).toEqual([]);
    expect(consoleMonitor.hydrationErrors()).toEqual([]);
  });

  test("does not expose Health navigation on the login page", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("navigation", { name: /navegação secundária de saúde/i }),
    ).toHaveCount(0);
  });

  test("shows accessible RA, password and submit controls", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/^RA$/i)).toBeVisible();
    await expect(page.getByLabel(/^Senha$/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /entrar no painel/i }),
    ).toBeVisible();
  });

  test("protects every Health deep link", async ({ page }) => {
    for (const route of [
      "/health/readiness",
      "/health/schedule",
      "/health/clinical",
      "/health/nutrition",
      "/health/history",
      "/health/reports",
    ]) {
      await page.goto(route);
      await page.waitForURL((url) => url.pathname === "/login", {
        timeout: 15_000,
      });
      expect(new URL(page.url()).pathname).toBe("/login");
      await expect(page.getByTestId("health-module-shell")).toHaveCount(0);
    }
  });
});
