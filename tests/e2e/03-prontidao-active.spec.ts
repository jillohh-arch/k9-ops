import { expect, openHealth, test } from "./auth.setup";

test("HW-2 keeps Prontidão active on a direct readiness route", async ({
  authenticateAs,
  page,
}) => {
  await authenticateAs("canonical");
  await openHealth(page, "/health/readiness");
  expect(new URL(page.url()).pathname).toBe("/health/readiness");
  await expect(
    page
      .getByRole("navigation", { name: /navegação secundária de saúde/i })
      .getByRole("link", { name: "Prontidão", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});
