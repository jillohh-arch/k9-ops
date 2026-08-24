import { expect, openHealth, test } from "./auth.setup";

test.describe("HW-2 legacy read-only adapter", () => {
  test.beforeEach(async ({ authenticateAs, page }) => {
    await authenticateAs("legacy");
    await openHealth(page);
  });

  test("grants the shell only through legacy health.view", async ({ page }) => {
    const boundary = page.getByTestId("health-permission-boundary");
    await expect(boundary).toHaveAttribute(
      "data-health-permission-source",
      "legacy_adapter",
    );
    await expect(boundary).toHaveAttribute(
      "data-health-has-canonical-read",
      "false",
    );
    await expect(boundary).toHaveAttribute(
      "data-health-has-legacy-view",
      "true",
    );
    await expect(page.getByTestId("health-module-shell")).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: /navegação secundária de saúde/i })
        .getByRole("link"),
    ).toHaveCount(7);
  });

  test("exposes no Health write controls or browser mutations", async ({
    networkMonitor,
    page,
  }) => {
    await expect(
      page.getByRole("button", {
        name: /novo|adicionar|criar|editar|arquivar|aprovar|exportar/i,
      }),
    ).toHaveCount(0);
    expect(networkMonitor.firestoreMutationCalls()).toEqual([]);
  });
});
