/**
 * Firebase Emulator Lifecycle Script for HW-2 E2E Tests
 *
 * Manages the complete lifecycle:
 * 1. Start Auth and Firestore emulators
 * 2. Run idempotent seed
 * 3. Start Next.js dev server
 * 4. Execute Playwright tests
 * 5. Cleanup all processes
 */

import { setTimeout } from "node:timers/promises";
import { spawn, type ChildProcess } from "node:child_process";
import * as net from "node:net";

const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080,
  hub: 4400,
};

async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.once("connect", () => {
      client.destroy();
      resolve(true);
    });
    client.once("error", () => {
      resolve(false);
    });
    client.connect(port, "127.0.0.1");
  });
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
    await setTimeout(interval);
  }
  return false;
}

class LifecycleManager {
  private emulatorProcess: ChildProcess | null = null;
  private nextjsProcess: ChildProcess | null = null;
  private exited = false;

  async start(): Promise<void> {
    console.log("[Lifecycle] Starting E2E test environment...\n");

    // Check for existing emulator processes
    for (const [service, port] of Object.entries(EMULATOR_PORTS)) {
      if (await isPortInUse(port)) {
        console.log(`[Lifecycle] Port ${port} (${service}) already in use`);
      }
    }

    // Start Firebase emulators
    console.log("[Lifecycle] Starting Firebase emulators (Auth + Firestore)...");
    this.emulatorProcess = spawn("npx", ["firebase", "emulators:start", "--only", "auth,firestore", "--project", "demo-k9-ops"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: "1",
      },
    });

    let emulatorOutput = "";
    this.emulatorProcess.stdout?.on("data", (data: Buffer) => {
      emulatorOutput += data.toString();
    });
    this.emulatorProcess.stderr?.on("data", (data: Buffer) => {
      emulatorOutput += data.toString();
    });

    // Wait for emulators to start
    const authReady = await waitForService(`http://127.0.0.1:${EMULATOR_PORTS.auth}`);
    const firestoreReady = await waitForService(`http://127.0.0.1:${EMULATOR_PORTS.firestore}/emulator`);

    if (!authReady || !firestoreReady) {
      throw new Error(`Emulators failed to start. Output:\n${emulatorOutput}`);
    }
    console.log(`[Lifecycle] ✓ Auth Emulator ready at 127.0.0.1:${EMULATOR_PORTS.auth}`);
    console.log(`[Lifecycle] ✓ Firestore Emulator ready at 127.0.0.1:${EMULATOR_PORTS.firestore}`);
    console.log(`[Lifecycle] ✓ Hub UI available at http://127.0.0.1:${EMULATOR_PORTS.hub}\n`);

    // Run seed
    console.log("[Lifecycle] Running seed for test data...");
    await this.runSeed();
    console.log("[Lifecycle] ✓ Seed complete\n");

    // Start Next.js
    console.log("[Lifecycle] Starting Next.js development server...");
    this.nextjsProcess = spawn(
      "npx",
      ["next", "dev", "-p", "3000"],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        env: {
          ...process.env,
          NODE_ENV: "development",
          NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "true",
          NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key-for-e2e-tests",
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-k9-ops.firebaseapp.com",
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-k9-ops",
          NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-k9-ops.appspot.com",
          NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
          NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:abcdef",
          FORCE_COLOR: "1",
        },
      }
    );

    const nextReady = await waitForService("http://localhost:3000", 60, 2000);
    if (!nextReady) {
      throw new Error("Next.js failed to start");
    }
    console.log("[Lifecycle] ✓ Next.js ready at http://localhost:3000\n");
    console.log("[Lifecycle] === Environment Ready ===\n");
  }

  private async runSeed(): Promise<void> {
    return new Promise((resolve, reject) => {
      const seed = spawn(
        "node",
        [
          "tools/seed_emulator_auth.mjs",
          "--project", "demo-k9-ops",
          "--auth-emulator", `http://127.0.0.1:${EMULATOR_PORTS.auth}`,
          "--firestore-emulator", `127.0.0.1:${EMULATOR_PORTS.firestore}`,
        ],
        {
          cwd: process.cwd(),
          stdio: ["ignore", "pipe", "pipe"],
          shell: true,
        }
      );

      let output = "";
      seed.stdout?.on("data", (data: Buffer) => {
        output += data.toString();
      });
      seed.stderr?.on("data", (data: Buffer) => {
        output += data.toString();
      });

      seed.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error("[Seed] Output:", output);
          reject(new Error(`Seed failed with code ${code}`));
        }
      });

      seed.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    if (this.exited) return;
    this.exited = true;

    console.log("\n[Lifecycle] Shutting down...");

    if (this.nextjsProcess) {
      console.log("[Lifecycle] Stopping Next.js...");
      this.nextjsProcess.kill("SIGTERM");
      await setTimeout(1000);
      if (!this.nextjsProcess.killed) {
        this.nextjsProcess.kill("SIGKILL");
      }
    }

    if (this.emulatorProcess) {
      console.log("[Lifecycle] Stopping Firebase emulators...");
      this.emulatorProcess.kill("SIGTERM");
      await setTimeout(2000);
      if (!this.emulatorProcess.killed) {
        this.emulatorProcess.kill("SIGKILL");
      }
    }

    console.log("[Lifecycle] ✓ Cleanup complete\n");
  }

  getPorts(): typeof EMULATOR_PORTS {
    return EMULATOR_PORTS;
  }
}

async function main() {
  const lifecycle = new LifecycleManager();
  let exitCode = 1;

  // Handle signals
  const cleanup = async () => {
    await lifecycle.stop();
    process.exit(exitCode);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    await lifecycle.start();

    // Run Playwright tests
    console.log("[Lifecycle] Running Playwright E2E tests...\n");

    const playwright = spawn(
      "npx",
      [
        "playwright",
        "test",
        "--config",
        "playwright.config.ts",
        "--project=chromium",
        ...(process.argv.slice(2)),
      ],
      {
        cwd: process.cwd(),
        stdio: "inherit",
        shell: true,
        env: {
          ...process.env,
          NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "true",
        },
      }
    );

    return new Promise((resolve) => {
      playwright.on("close", (code) => {
        exitCode = code ?? 1;
        resolve(exitCode);
      });
      playwright.on("error", (err) => {
        console.error("[Lifecycle] Playwright error:", err);
        exitCode = 1;
        resolve(exitCode);
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
