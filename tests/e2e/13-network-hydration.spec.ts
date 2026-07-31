import { expect, openHealth, test } from "./auth.setup";

test.describe("HW-2 network and hydration audit", () => {
  test("observes non-empty Auth and Firestore emulator traffic", async ({
    authenticateAs,
    networkMonitor,
    page,
  }) => {
    await authenticateAs("canonical");
    await openHealth(page);

    expect(networkMonitor.authCalls().length).toBeGreaterThan(0);
    expect(networkMonitor.firestoreCalls().length).toBeGreaterThan(0);
    for (const call of networkMonitor.authCalls()) {
      expect(call).toMatchObject({ host: "127.0.0.1", port: "9199" });
    }
    for (const call of networkMonitor.firestoreCalls()) {
      expect(call).toMatchObject({ host: "127.0.0.1", port: "8181" });
    }
  });

  test("makes zero Firebase production requests", async ({
    authenticateAs,
    networkMonitor,
    page,
  }) => {
    await authenticateAs("canonical");
    await openHealth(page, "/health/readiness");
    await openHealth(page, "/health/reports");
    expect(networkMonitor.productionFirebaseCalls()).toEqual([]);
  });

  test("starts no Firestore mutation from Health shell routes", async ({
    authenticateAs,
    networkMonitor,
    page,
  }) => {
    await authenticateAs("canonical");
    for (const route of ["/health", "/health/readiness", "/health/schedule"]) {
      await openHealth(page, route);
    }
    expect(networkMonitor.firestoreMutationCalls()).toEqual([]);
  });

  test("has zero critical console and hydration errors", async ({
    authenticateAs,
    consoleMonitor,
    page,
  }) => {
    await authenticateAs("canonical");
    await openHealth(page);
    await openHealth(page, "/health/readiness/test-dog");
    expect(consoleMonitor.errors()).toEqual([]);
    expect(consoleMonitor.hydrationErrors()).toEqual([]);
  });
});
