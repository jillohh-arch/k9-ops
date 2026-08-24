import { expect, openHealth, test } from "./auth.setup";

test.describe("HW-2 keyboard navigation", () => {
  test.beforeEach(async ({ authenticateAs, page }) => {
    await authenticateAs("canonical");
    await openHealth(page);
  });

  test("reaches all seven secondary links in logical forward and reverse order", async ({
    page,
  }) => {
    const links = page
      .getByRole("navigation", { name: /navegação secundária de saúde/i })
      .getByRole("link");
    await expect(links).toHaveCount(7);
    await links.first().focus();

    const reached: string[] = [];
    for (let index = 0; index < 7; index += 1) {
      await expect(links.nth(index)).toBeFocused();
      reached.push((await links.nth(index).textContent())?.trim() ?? "");
      if (index < 6) await page.keyboard.press("Tab");
    }
    expect(new Set(reached).size).toBe(7);
    await page.keyboard.press("Shift+Tab");
    await expect(links.nth(5)).toBeFocused();
  });

  test("activates a route with Enter and exposes the main-content skip target", async ({
    page,
  }) => {
    const readiness = page
      .getByRole("navigation", { name: /navegação secundária de saúde/i })
      .getByRole("link", { name: "Prontidão", exact: true });
    await readiness.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === "/health/readiness");

    const skipLink = page.getByRole("link", {
      name: /pular para o conteúdo principal/i,
    });
    await skipLink.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });
});
