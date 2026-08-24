import { expect, openHealth, test } from "./auth.setup";

const routes = [
  ["/health", "Saúde e Prontidão", "Visão Geral"],
  ["/health/readiness", "Prontidão", "Prontidão"],
  ["/health/schedule", "Agenda", "Agenda"],
  ["/health/clinical", "Clínico", "Clínico"],
  ["/health/nutrition", "Nutrição", "Nutrição"],
  ["/health/history", "Histórico", "Histórico"],
  ["/health/reports", "Relatórios", "Relatórios"],
  ["/health/readiness/test-dog", "Prontidão do K9", "Prontidão"],
] as const;

test.describe("HW-2 desktop homologation at 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("validates all Health routes without overflow, clipping or console errors", async ({
    authenticateAs,
    consoleMonitor,
    page,
  }) => {
    await authenticateAs("canonical");
    for (const [route, title, activeItem] of routes) {
      await openHealth(page, route);
      expect(new URL(page.url()).pathname).toBe(route);
      await expect(page.getByTestId("health-module-shell")).toBeVisible();
      await expect(page.getByRole("heading", { name: title })).toBeVisible();

      const secondaryNavigation = page.getByRole("navigation", {
        name: /navegação secundária de saúde/i,
      });
      await expect(secondaryNavigation).toBeVisible();
      await expect(
        secondaryNavigation.getByRole("link", { name: activeItem, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        page.getByRole("link", { name: "Saúde", exact: true }).first(),
      ).toHaveAttribute("aria-current", "page");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const shellBox = await page.getByTestId("health-module-shell").boundingBox();
      expect(shellBox).not.toBeNull();
      expect(shellBox!.x).toBeGreaterThanOrEqual(0);
      expect(shellBox!.x + shellBox!.width).toBeLessThanOrEqual(1440);
    }
    expect(consoleMonitor.errors()).toEqual([]);
  });
});
