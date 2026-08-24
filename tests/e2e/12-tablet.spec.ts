import { expect, openHealth, test } from "./auth.setup";

test.describe("HW-2 tablet homologation at 1024x768", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("keeps overview, readiness and schedule usable and unclipped", async ({
    authenticateAs,
    page,
  }) => {
    await authenticateAs("canonical");
    for (const route of [
      "/health",
      "/health/readiness",
      "/health/schedule",
      // NUT-WEB-5B: Nutrition joins the tablet homologation. The goal is
      // structural integrity at 1024x768, not pixel-perfection.
      "/health/nutrition",
      "/health/nutrition/dogs/test-dog",
    ]) {
      await openHealth(page, route);
      const navigation = page.getByRole("navigation", {
        name: /navegação secundária de saúde/i,
      });
      await expect(navigation).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const box = await navigation.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(1024);

      // Main content must stay reachable inside the viewport, not pushed off.
      const shell = page.getByTestId("health-module-shell");
      await expect(shell).toBeVisible();
      const shellBox = await shell.boundingBox();
      expect(shellBox).not.toBeNull();
      expect(shellBox!.x).toBeGreaterThanOrEqual(0);
      expect(shellBox!.x + shellBox!.width).toBeLessThanOrEqual(1024);
    }
  });

  /*
   * NUT-WEB-5B.E: this test is deliberately NON-VACUOUS.
   *
   * An earlier revision wrapped the assertions in `if (await link.count())`,
   * which turned "the link never rendered" into a silent pass. With the
   * deterministic `test-dog` fixture seeded, both cross-navigation links MUST
   * exist; their absence has to fail the suite, because that absence is exactly
   * the regression this gate has to be able to detect.
   */
  test("keeps Nutrition cross-navigation usable at tablet width", async ({
    authenticateAs,
    page,
  }) => {
    await authenticateAs("canonical");

    // Nutrition per-dog -> readiness cockpit of the same K9.
    await openHealth(page, "/health/nutrition/dogs/test-dog");
    // The K9 context must genuinely resolve: no loading/not-found masquerade.
    await expect(page.getByTestId("nutrition-dog-not-found")).toHaveCount(0);
    const toCockpit = page.getByTestId("nutrition-to-cockpit-link");
    await expect(toCockpit).toBeVisible();
    await expect(toCockpit).toHaveAttribute("href", "/health/readiness/test-dog");

    const cockpitBox = await toCockpit.boundingBox();
    expect(cockpitBox).not.toBeNull();
    expect(cockpitBox!.x).toBeGreaterThanOrEqual(0);
    expect(cockpitBox!.x + cockpitBox!.width).toBeLessThanOrEqual(1024);
    await toCockpit.focus();
    await expect(toCockpit).toBeFocused();

    // Usable, not merely present: keyboard activation must actually navigate.
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === "/health/readiness/test-dog");

    // Readiness cockpit -> Nutrition of the same K9.
    await openHealth(page, "/health/readiness/test-dog");
    await expect(page.getByTestId("cockpit-not-found")).toHaveCount(0);
    const toNutrition = page.getByTestId("cockpit-to-nutrition-link");
    await expect(toNutrition).toBeVisible();
    await expect(toNutrition).toHaveAttribute(
      "href",
      "/health/nutrition/dogs/test-dog",
    );

    const nutritionBox = await toNutrition.boundingBox();
    expect(nutritionBox).not.toBeNull();
    expect(nutritionBox!.x).toBeGreaterThanOrEqual(0);
    expect(nutritionBox!.x + nutritionBox!.width).toBeLessThanOrEqual(1024);
    await toNutrition.focus();
    await expect(toNutrition).toBeFocused();

    // Closes the bidirectional loop in a real browser.
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === "/health/nutrition/dogs/test-dog");
  });

  test("provides visible focus and keyboard activation", async ({
    authenticateAs,
    page,
  }) => {
    await authenticateAs("canonical");
    await openHealth(page);
    const readiness = page
      .getByRole("navigation", { name: /navegação secundária de saúde/i })
      .getByRole("link", { name: "Prontidão", exact: true });
    await readiness.focus();
    await expect(readiness).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === "/health/readiness");
  });
});
