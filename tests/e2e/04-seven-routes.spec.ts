import { expect, openHealth, test } from "./auth.setup";

const routes = [
  ["/health", "Saúde e Prontidão", "Visão Geral"],
  ["/health/readiness", "Prontidão", "Prontidão"],
  ["/health/schedule", "Agenda", "Agenda"],
  ["/health/clinical", "Clínico", "Clínico"],
  ["/health/nutrition", "Nutrição", "Nutrição"],
  ["/health/history", "Histórico", "Histórico"],
  ["/health/reports", "Relatórios", "Relatórios"],
] as const;

test("HW-2 renders all seven Health routes with exact titles and active links", async ({
  authenticateAs,
  page,
}) => {
  await authenticateAs("canonical");
  for (const [path, title, activeItem] of routes) {
    await openHealth(page, path);
    expect(new URL(page.url()).pathname).toBe(path);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const navigation = page.getByRole("navigation", {
      name: /navegação secundária de saúde/i,
    });
    await expect(navigation.getByRole("link")).toHaveCount(7);
    await expect(
      navigation.getByRole("link", { name: activeItem, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
});
