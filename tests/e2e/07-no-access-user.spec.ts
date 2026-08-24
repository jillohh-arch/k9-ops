import { expect, test } from "./auth.setup";

test.describe("HW-2 no-access boundary", () => {
  test.beforeEach(async ({ authenticateAs }) => {
    await authenticateAs("noAccess");
  });

  test("shows an explicit forbidden state and withholds the Health shell", async ({
    networkMonitor,
    page,
  }) => {
    await page.goto("/health");
    expect(new URL(page.url()).pathname).toBe("/health");
    await expect(page.getByTestId("app-access-denied")).toBeVisible();
    await expect(page.getByText(/acesso não liberado/i)).toBeVisible();
    await expect(page.getByTestId("health-module-shell")).toHaveCount(0);
    await expect(page.getByTestId("health-permission-boundary")).toHaveCount(0);
    expect(networkMonitor.firestoreMutationCalls()).toEqual([]);
  });

  test("does not expose Health navigation or write controls", async ({ page }) => {
    await page.goto("/health/readiness");
    await expect(page.getByTestId("app-access-denied")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: /navegação secundária de saúde/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /novo|adicionar|criar|editar|aprovar/i }),
    ).toHaveCount(0);
  });
});
