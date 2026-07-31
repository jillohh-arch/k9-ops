import { expect, openHealth, test } from "./auth.setup";

test.describe("HW-2 readiness cockpit placeholder", () => {
  test.beforeEach(async ({ authenticateAs }) => {
    await authenticateAs("canonical");
  });

  test("keeps /health/readiness/test-dog structural and data-free", async ({
    networkMonitor,
    page,
  }) => {
    await openHealth(page, "/health/readiness/test-dog");
    expect(new URL(page.url()).pathname).toBe("/health/readiness/test-dog");
    await expect(page.getByTestId("health-module-shell")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /prontidão do k9/i }),
    ).toBeVisible();
    await expect(page.getByText(/carregando prontidão de test-dog/i)).toBeVisible();

    await expect(page.getByText(/score|percentual|diagnóstico|tratamento/i)).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: /salvar|registrar|editar|concluir/i }),
    ).toHaveCount(0);
    expect(networkMonitor.firestoreMutationCalls()).toEqual([]);
  });
});
