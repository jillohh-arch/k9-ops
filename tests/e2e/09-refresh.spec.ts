import { expect, openHealth, test } from "./auth.setup";

test("HW-2 preserves the reports session, route and shell after refresh", async ({
  authenticateAs,
  consoleMonitor,
  page,
}) => {
  await authenticateAs("canonical");
  await openHealth(page, "/health/reports");
  await page.reload();
  await page.getByTestId("health-module-shell").waitFor({ state: "visible" });

  expect(new URL(page.url()).pathname).toBe("/health/reports");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(
    page
      .getByRole("navigation", { name: /navegação secundária de saúde/i })
      .getByRole("link", { name: "Relatórios", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(consoleMonitor.hydrationErrors()).toEqual([]);
});
