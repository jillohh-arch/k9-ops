/* eslint-disable react-hooks/rules-of-hooks */

import {
  test as base,
  type ConsoleMessage,
  type Page,
  type Request,
} from "@playwright/test";

export const TEST_USERS = {
  canonical: { ra: "100001", password: "TestPassword123!" },
  legacy: { ra: "100002", password: "TestPassword123!" },
  noAccess: { ra: "100003", password: "TestPassword123!" },
} as const;

const AUTH_HOST = "127.0.0.1";
const AUTH_PORT = "9199";
const FIRESTORE_HOST = "127.0.0.1";
const FIRESTORE_PORT = "8181";
const FORBIDDEN_FIREBASE_HOSTS = [
  "identitytoolkit.googleapis.com",
  "firestore.googleapis.com",
  "firebaseio.com",
  "googleapis.com",
];

export type NetworkCall = {
  host: string;
  method: string;
  path: string;
  port: string;
};

export class NetworkMonitor {
  private calls: NetworkCall[] = [];

  attach(page: Page) {
    page.on("request", (request: Request) => {
      const parsed = new URL(request.url());
      this.calls.push({
        host: parsed.hostname,
        method: request.method(),
        path: parsed.pathname,
        port: parsed.port,
      });
    });
  }

  all() {
    return [...this.calls];
  }

  authCalls() {
    return this.calls.filter(
      (call) =>
        call.host === AUTH_HOST &&
        call.port === AUTH_PORT &&
        call.path.includes("identitytoolkit"),
    );
  }

  firestoreCalls() {
    return this.calls.filter(
      (call) => call.host === FIRESTORE_HOST && call.port === FIRESTORE_PORT,
    );
  }

  productionFirebaseCalls() {
    return this.calls.filter(
      (call) =>
        call.host !== "localhost" &&
        call.host !== "127.0.0.1" &&
        FORBIDDEN_FIREBASE_HOSTS.some(
          (host) => call.host === host || call.host.endsWith(`.${host}`),
        ),
    );
  }

  firestoreMutationCalls() {
    return this.firestoreCalls().filter((call) => {
      if (["PUT", "PATCH", "DELETE"].includes(call.method)) return true;
      return (
        call.method === "POST" &&
        (/documents:(commit|batchWrite)$/.test(call.path) ||
          call.path.includes("/documents:write"))
      );
    });
  }

  summary() {
    return this.calls.map(({ host, port, method }) => ({ host, port, method }));
  }
}

export class ConsoleMonitor {
  private critical: string[] = [];

  attach(page: Page) {
    page.on("console", (message: ConsoleMessage) => {
      if (message.type() === "error") this.critical.push(message.text());
    });
    page.on("pageerror", (error) => this.critical.push(error.message));
  }

  errors() {
    return [...this.critical];
  }

  hydrationErrors() {
    return this.critical.filter((message) => /hydration|hydrated/i.test(message));
  }
}

export async function authenticateAs(
  page: Page,
  user: keyof typeof TEST_USERS,
) {
  const credentials = TEST_USERS[user];
  await page.goto("/login");
  await page.getByLabel(/^RA$/i).fill(credentials.ra);
  await page.getByLabel(/^Senha$/i).fill(credentials.password);

  const authResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.hostname === AUTH_HOST &&
      url.port === AUTH_PORT &&
      url.pathname.includes("accounts:signInWithPassword")
    );
  });
  await page.getByRole("button", { name: /entrar no painel/i }).click();
  const response = await authResponse;
  if (!response.ok()) {
    throw new Error(`Auth Emulator rejected login with HTTP ${response.status()}`);
  }

  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15_000 });
  const appShell = page.getByTestId("app-shell");
  await appShell.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => {
    const shell = document.querySelector('[data-testid="app-shell"]');
    const status = shell?.getAttribute("data-access-status");
    return status === "ready" || status === "fallback";
  });
}

export async function openHealth(page: Page, path = "/health") {
  await page.goto(path);
  await page.getByTestId("health-permission-boundary").waitFor({
    state: "visible",
    timeout: 15_000,
  });
}

export const test = base.extend<{
  authenticateAs: (user: keyof typeof TEST_USERS) => Promise<void>;
  consoleMonitor: ConsoleMonitor;
  networkMonitor: NetworkMonitor;
}>({
  authenticateAs: async ({ page }, use) => {
    await use((user) => authenticateAs(page, user));
  },
  consoleMonitor: async ({ page }, use) => {
    const monitor = new ConsoleMonitor();
    monitor.attach(page);
    await use(monitor);
  },
  networkMonitor: async ({ page }, use) => {
    const monitor = new NetworkMonitor();
    monitor.attach(page);
    await use(monitor);
  },
});

export { expect } from "@playwright/test";
