import { expect, openHealth, test } from "./auth.setup";

test("HW-2 canonical canary proves Auth, access, shell and local reads", async ({
  authenticateAs,
  consoleMonitor,
  networkMonitor,
  page,
}) => {
  await authenticateAs("canonical");
  expect(networkMonitor.authCalls().length).toBeGreaterThan(0);

  await openHealth(page);
  expect(new URL(page.url()).pathname).toBe("/health");

  await expect(page.getByTestId("health-module-shell")).toBeVisible();
  await expect(page.getByTestId("health-permission-boundary")).toHaveAttribute(
    "data-health-permission-source",
    "explicit",
  );

  const secondaryNavigation = page.getByRole("navigation", {
    name: /navegação secundária de saúde/i,
  });
  await expect(secondaryNavigation.getByRole("link")).toHaveCount(7);
  await expect(
    secondaryNavigation.getByRole("link", { name: /^Visão Geral$/i }),
  ).toHaveAttribute("aria-current", "page");

  expect(networkMonitor.firestoreCalls().length).toBeGreaterThan(0);
  expect(networkMonitor.productionFirebaseCalls()).toEqual([]);
  expect(networkMonitor.firestoreMutationCalls()).toEqual([]);
  expect(consoleMonitor.errors()).toEqual([]);
  expect(consoleMonitor.hydrationErrors()).toEqual([]);
});
