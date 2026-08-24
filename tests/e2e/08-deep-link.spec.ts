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
    // NUT-WEB-5B: Nutrition must resolve on a direct deep link, with the
    // secondary navigation marking it active — no prior navigation required.
    ["/health/nutrition", "Nutrição"],
    ["/health/nutrition/dogs/test-dog", "Nutrição"],
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

test("NUT-WEB-5B keeps an encoded Nutrition dogId intact on deep link", async ({
  authenticateAs,
  page,
}) => {
  await authenticateAs("canonical");

  // The path authority encodes the segment; the deep link must preserve it and
  // must never fall back to a ?dogId= contract.
  const encoded = "/health/nutrition/dogs/dog%2F42";
  await openHealth(page, encoded);
  const url = new URL(page.url());
  expect(url.pathname).toBe(encoded);
  expect(url.search).not.toContain("dogId=");
  await expect(page.getByTestId("health-module-shell")).toBeVisible();
});

/*
 * NUT-WEB-5B.E — per-dog deep link, proven substantively.
 *
 * Route existence and an HTTP 200 are NOT proof. This asserts the K9 context
 * actually resolved from the seeded fixture: the dog is identified, Nutrition is
 * the active nav item, the cross-navigation affordance is present, and the page
 * is neither stuck in a loading skeleton nor showing not-found.
 */
test("NUT-WEB-5B.E resolves real test-dog context on a direct per-dog deep link", async ({
  authenticateAs,
  page,
}) => {
  await authenticateAs("canonical");

  const path = "/health/nutrition/dogs/test-dog";
  await openHealth(page, path);

  // 1. Canonical URL, no prior navigation, no query-string fallback.
  const url = new URL(page.url());
  expect(url.pathname).toBe(path);
  expect(url.search).not.toContain("dogId=");
  await expect(page).not.toHaveURL(/\/login/);

  // 2. Health shell + Nutrition nav active.
  await expect(page.getByTestId("health-module-shell")).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: /navegação secundária de saúde/i })
      .getByRole("link", { name: "Nutrição", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  // 3. The K9 context genuinely resolved — not loading, not found, not error.
  await expect(page.getByTestId("nutrition-dog-not-found")).toHaveCount(0);
  await expect(page.getByText(/carregando contexto do k9/i)).toHaveCount(0);
  await expect(page.getByText(/não foi possível resolver o contexto/i)).toHaveCount(0);

  // 4. The seeded identity is actually rendered.
  await expect(page.getByText("Bono E2E").first()).toBeVisible();

  // 5. Cross-navigation is reachable, pointing at the SAME K9.
  await expect(page.getByTestId("nutrition-to-cockpit-link")).toHaveAttribute(
    "href",
    "/health/readiness/test-dog",
  );
});

/**
 * The cockpit direction of the same deep-link contract: the readiness route
 * resolves standalone and offers the Nutrition affordance for the same K9.
 */
test("NUT-WEB-5B.E resolves the readiness cockpit deep link for test-dog", async ({
  authenticateAs,
  page,
}) => {
  await authenticateAs("canonical");

  const path = "/health/readiness/test-dog";
  await openHealth(page, path);

  expect(new URL(page.url()).pathname).toBe(path);
  await expect(page.getByTestId("health-module-shell")).toBeVisible();
  await expect(page.getByTestId("cockpit-not-found")).toHaveCount(0);
  await expect(page.getByTestId("cockpit-error")).toHaveCount(0);

  // The seeded projection must render a VALID operational readiness, never the
  // technical "sem projeção válida" state.
  await expect(page.getByTestId("health-cockpit")).toBeVisible();
  await expect(page.getByText("Sem projeção válida")).toHaveCount(0);

  await expect(page.getByTestId("cockpit-to-nutrition-link")).toHaveAttribute(
    "href",
    "/health/nutrition/dogs/test-dog",
  );
});
