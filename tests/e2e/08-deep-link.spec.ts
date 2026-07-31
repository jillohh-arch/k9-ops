import { expect, openHealth, test } from "./auth.setup";

test("HW-2 preserves session, route and active item on direct deep links", async ({
  authenticateAs,
  page,
}) => {
  await authenticateAs("canonical");
  for (const [path, activeItem] of [
    ["/health/readiness", "Prontidão"],
    ["/health/clinical", "Clínico"],
    ["/health/reports", "Relatórios"],
  ] as const) {
    await openHealth(page, path);
    expect(new URL(page.url()).pathname).toBe(path);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByTestId("health-module-shell")).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: /navegação secundária de saúde/i })
        .getByRole("link", { name: activeItem, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
});
