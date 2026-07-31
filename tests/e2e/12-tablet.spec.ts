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
    }
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
