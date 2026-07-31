import { setTimeout as sleep } from "node:timers/promises";
import { spawn, type ChildProcess } from "node:child_process";
import * as net from "node:net";

// E2E Configuration - synced with src/lib/e2e/config.ts
// These values are the source of truth for the lifecycle script
const AUTH_EMULATOR_PORT = Number(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT || "9199");
const FIRESTORE_EMULATOR_PORT = Number(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT || "8181");
const HUB_EMULATOR_PORT = Number(process.env.NEXT_PUBLIC_FIREBASE_HUB_EMULATOR_PORT || "4545");
const EMULATOR_PROJECT_ID = "demo-k9-ops";
const AUTH_EMULATOR_URL = `http://127.0.0.1:${AUTH_EMULATOR_PORT}`;
const E2E_PORTS = {
  auth: AUTH_EMULATOR_PORT,
  firestore: FIRESTORE_EMULATOR_PORT,
  hub: HUB_EMULATOR_PORT,
} as const;

const NEXTJS_PORT = 3000;

async function isPortInUse(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      resolve(false);
    }, 500);

    client.once("connect", () => {
      clearTimeout(timeout);
      client.destroy();
      resolve(true);
    });
    client.once("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
    client.connect(port, "127.0.0.1");
  });
}

async function waitForPort(
  host: string,
  port: number,
  timeoutMs = 60000,
  intervalMs = 1000,
  processRef?: ChildProcess
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (processRef && processRef.exitCode !== null) {
      throw new Error("[Lifecycle] Process exited unexpectedly during port wait (" + host + ":" + port + ")");
    }
    const inUse = await isPortInUse(port);
    if (inUse) return true;
    await sleep(intervalMs);
  }
  throw new Error("[Lifecycle] Timeout waiting for " + host + ":" + port);
}

async function waitForService(
  url: string,
  maxAttempts = 30,
  interval = 1000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 401) return true;
    } catch {
      // Not ready yet
    }
    await sleep(interval);
  }
  return false;
}

async function verifyPortsFree(): Promise<void> {
  const ports = [E2E_PORTS.auth, E2E_PORTS.firestore, E2E_PORTS.hub, NEXTJS_PORT];
  const occupied: string[] = [];
  for (const p of ports) {
    if (await isPortInUse(p)) {
      const n = p === E2E_PORTS.auth ? "Auth" : p === E2E_PORTS.firestore ? "Firestore" : p === E2E_PORTS.hub ? "Hub" : "Next.js";
      occupied.push(p + " (" + n + ")");
    }
  }
  if (occupied.length) {
    throw new Error("[Lifecycle] Required ports are already in use: " + occupied.join(", ") + ". Please stop any running emulators or Next.js servers.");
  }
}

async function verifyPortsReleased(): Promise<void> {
  const ports = [E2E_PORTS.auth, E2E_PORTS.firestore, E2E_PORTS.hub, NEXTJS_PORT];
  const stillBound: string[] = [];
  await sleep(2000);
  for (const p of ports) {
    if (await isPortInUse(p)) stillBound.push(String(p));
  }
  if (stillBound.length) {
    console.warn("[Lifecycle] Warning: Ports may not be fully released: " + stillBound.join(", "));
  } else {
    console.log("[Lifecycle] All ports released");
  }
}

class LifecycleManager {
  private emulatorProcess: ChildProcess | null = null;
  private nextjsProcess: ChildProcess | null = null;
  private exited = false;

  async start(): Promise<void> {
    console.log("[Lifecycle] Starting E2E test environment...");
    console.log("[Lifecycle] Checking port availability...");
    await verifyPortsFree();
    console.log("[Lifecycle] Starting Firebase emulators (Auth + Firestore)...");
    console.log("[Lifecycle]   Auth: 127.0.0.1:" + AUTH_EMULATOR_PORT);
    console.log("[Lifecycle]   Firestore: 127.0.0.1:" + FIRESTORE_EMULATOR_PORT);
    console.log("[Lifecycle]   Hub: 127.0.0.1:" + HUB_EMULATOR_PORT);
    this.emulatorProcess = spawn("npx", ["firebase", "emulators:start", "--only", "auth,firestore", "--project", EMULATOR_PROJECT_ID], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: { ...process.env, FORCE_COLOR: "1" },
    });
    let output = "";
    this.emulatorProcess.stdout?.on("data", (d: Buffer) => {
      output += d.toString();
    });
    this.emulatorProcess.stderr?.on("data", (d: Buffer) => {
      output += d.toString();
    });
    this.emulatorProcess.on("exit", (code: number | null) => {
      if (!this.exited && code !== 0 && code !== null) {
        console.error("[Lifecycle] Emulator exited with code " + code);
      }
    });
    console.log("[Lifecycle] Waiting for Auth emulator...");
    await waitForPort("127.0.0.1", E2E_PORTS.auth, 60000, 1000, this.emulatorProcess);
    console.log("[Lifecycle] Waiting for Firestore emulator...");
    await waitForPort("127.0.0.1", E2E_PORTS.firestore, 60000, 1000, this.emulatorProcess);
    if (this.emulatorProcess.exitCode !== null) {
      throw new Error("[Lifecycle] Emulator process died during startup.\n" + output);
    }
    console.log("[Lifecycle] Auth Emulator ready at 127.0.0.1:" + E2E_PORTS.auth);
    console.log("[Lifecycle] Firestore Emulator ready at 127.0.0.1:" + E2E_PORTS.firestore);
    console.log("[Lifecycle] Hub UI available at http://127.0.0.1:" + E2E_PORTS.hub);
    console.log("[Lifecycle] Running seed for test data...");
    await this.runSeed();
    console.log("[Lifecycle] Seed complete");
    console.log("[Lifecycle] Starting Next.js development server...");
    this.nextjsProcess = spawn("npx", ["next", "dev", "-p", String(NEXTJS_PORT)], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "true",
        NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key-for-e2e-tests",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-k9-ops.firebaseapp.com",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: EMULATOR_PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-k9-ops.appspot.com",
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
        NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:abcdef",
        NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT: String(AUTH_EMULATOR_PORT),
        NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT: String(FIRESTORE_EMULATOR_PORT),
        FORCE_COLOR: "1",
      },
    });
    const ready = await waitForService("http://localhost:" + NEXTJS_PORT, 60, 2000);
    if (!ready) throw new Error("Next.js failed to start");
    console.log("[Lifecycle] Next.js ready at http://localhost:" + NEXTJS_PORT);
    console.log("[Lifecycle] === Environment Ready ===");
  }

  private async runSeed(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const seed = spawn("node", [
        "tools/seed_emulator_auth.mjs",
        "--project",
        EMULATOR_PROJECT_ID,
        "--auth-emulator",
        AUTH_EMULATOR_URL,
        "--firestore-emulator",
        "127.0.0.1:" + FIRESTORE_EMULATOR_PORT,
      ], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });
      let output = "";
      seed.stdout?.on("data", (d: Buffer) => {
        output += d.toString();
      });
      seed.stderr?.on("data", (d: Buffer) => {
        output += d.toString();
      });
      seed.on("close", (code: number | null) => {
        if (code === 0) resolve();
        else {
          console.error("[Seed] Output:", output);
          reject(new Error("Seed failed with code " + code));
        }
      });
      seed.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    if (this.exited) return;
    this.exited = true;
    console.log("[Lifecycle] Shutting down...");
    if (this.nextjsProcess) {
      console.log("[Lifecycle] Stopping Next.js...");
      this.nextjsProcess.kill("SIGTERM");
      await sleep(1000);
      if (!this.nextjsProcess.killed) this.nextjsProcess.kill("SIGKILL");
      console.log("[Lifecycle] Next.js stopped");
    }
    if (this.emulatorProcess) {
      console.log("[Lifecycle] Stopping Firebase emulators...");
      this.emulatorProcess.kill("SIGTERM");
      await sleep(2000);
      if (!this.emulatorProcess.killed) this.emulatorProcess.kill("SIGKILL");
      console.log("[Lifecycle] Firebase emulators stopped");
    }
    await verifyPortsReleased();
    console.log("[Lifecycle] Cleanup complete");
  }

  getPorts(): typeof E2E_PORTS {
    return E2E_PORTS;
  }
}

async function main(): Promise<void> {
  const lifecycle = new LifecycleManager();
  let exitCode = 1;
  const cleanup = async (): Promise<void> => {
    await lifecycle.stop();
    process.exit(exitCode);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  try {
    await lifecycle.start();
    console.log("[Lifecycle] Running Playwright E2E tests...");
    const playwright = spawn("npx", ["playwright", "test", "--config", "playwright.config.ts", "--project=chromium", ...process.argv.slice(2)], {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: true,
      env: { ...process.env, NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "true" },
    });
    return new Promise<void>((resolve) => {
      playwright.on("close", (code: number | null) => {
        exitCode = code ?? 1;
        resolve();
      });
      playwright.on("error", (err: Error) => {
        console.error("[Lifecycle] Playwright error:", err);
        exitCode = 1;
        resolve();
      });
    });
  } catch (error) {
    console.error("[Lifecycle] Error:", error);
    exitCode = 1;
  } finally {
    await lifecycle.stop();
    process.exit(exitCode);
  }
}

main();
