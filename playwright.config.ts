import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for HW-2 authenticated E2E tests
 *
 * Features:
 * - Chromium-only for faster execution
 * - Serial execution for shared emulator state
 * - Network interception to verify exclusively local Firebase
 * - Artifacts only on failure
 */

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    headless: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-tablet",
      use: { ...devices["iPad (gen 7)"] },
    },
  ],

  webServer: undefined, // Managed externally via lifecycle script
});
