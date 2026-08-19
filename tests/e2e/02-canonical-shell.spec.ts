import { expect, openHealth, test } from "./auth.setup";

test.describe("HW-2 canonical shell", () => {
  test.beforeEach(async ({ authenticateAs, page }) => {
    await authenticateAs("canonical");
    await openHealth(page);
  });

  test("shows the explicit source, shell, sidebar and seven-item navigation", async ({
    page,
  }) => {
    await expect(page.getByTestId("health-permission-boundary")).toHaveAttribute(
      "data-health-permission-source",
      "explicit",
    );
    await expect(page.getByTestId("health-module-shell")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Saúde", exact: true }).first(),
    ).toHaveAttribute("aria-current", "page");
    const navigation = page.getByRole("navigation", {
      name: /navegação secundária de saúde/i,
    });
    await expect(navigation.getByRole("link")).toHaveCount(7);
    await expect(
      navigation.getByRole("link", { name: "Visão Geral", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("navigates through every secondary destination", async ({ page }) => {
    const destinations = [
      ["Prontidão", "/health/readiness"],
      ["Agenda", "/health/schedule"],
      ["Clínico", "/health/clinical"],
      ["Nutrição", "/health/nutrition"],
      ["Histórico", "/health/history"],
      ["Relatórios", "/health/reports"],
    ] as const;
    for (const [label, path] of destinations) {
      await page
        .getByRole("navigation", { name: /navegação secundária de saúde/i })
        .getByRole("link", { name: label, exact: true })
        .click();
      await page.waitForURL((url) => url.pathname === path);
      await page.goto("/health");
    }
  });
});
