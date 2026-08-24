import { spawn, type ChildProcess } from "node:child_process";
import * as net from "node:net";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import {
  AUTH_EMULATOR_HOST,
  AUTH_EMULATOR_PORT,
  E2E_PORTS,
  EMULATOR_PROJECT_ID,
  FIRESTORE_EMULATOR_HOST,
  FIRESTORE_EMULATOR_PORT,
  HUB_EMULATOR_HOST,
  HUB_EMULATOR_PORT,
  validateE2EConfig,
  createE2EConfig,
} from "../src/lib/e2e/config";
import { LifecycleStateMachine } from "../src/lib/e2e/lifecycle-machine";

const projectRoot = process.cwd();
const node = process.execPath;
const firebaseCli = resolve(projectRoot, "node_modules/firebase-tools/lib/bin/firebase.js");
const nextCli = resolve(projectRoot, "node_modules/next/dist/bin/next");
const playwrightCli = resolve(projectRoot, "node_modules/@playwright/test/cli.js");

function isPortInUse(host: string, port: number) {
  return new Promise<boolean>((resolveResult) => {
    const socket = net.createConnection({ host, port });
    const finish = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolveResult(result);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function waitForPort(
  host: string,
  port: number,
  processRef: ChildProcess,
  timeoutMs = 60_000,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (processRef.exitCode !== null) {
      throw new Error(`Process exited before ${host}:${port} became ready`);
    }
    if (await isPortInUse(host, port)) return;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

async function waitForHttp(url: string, processRef: ChildProcess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (processRef.exitCode !== null) {
      throw new Error("Next.js exited before readiness");
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Startup retry.
    }
    await sleep(1_000);
  }
  throw new Error("Timed out waiting for Next.js readiness");
}

async function verifyPorts(expectedInUse: boolean) {
  const endpoints = [
    [AUTH_EMULATOR_HOST, E2E_PORTS.auth],
    [FIRESTORE_EMULATOR_HOST, E2E_PORTS.firestore],
    [HUB_EMULATOR_HOST, E2E_PORTS.hub],
    ["127.0.0.1", E2E_PORTS.nextjs],
  ] as const;
  const mismatches: number[] = [];
  for (const [host, port] of endpoints) {
    if ((await isPortInUse(host, port)) !== expectedInUse) mismatches.push(port);
  }
  return mismatches;
}

function spawnNode(script: string, args: string[], env = process.env) {
  return spawn(node, [script, ...args], {
    cwd: projectRoot,
    env: { ...env, FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function pipeOutput(child: ChildProcess) {
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
}

function waitForClose(child: ChildProcess) {
  return new Promise<number>((resolveResult, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolveResult(code ?? 1));
  });
}

async function terminateKnownChild(child: ChildProcess | null, label: string) {
  if (!child || child.exitCode !== null) return;
  console.log(`[Lifecycle] Stopping ${label}`);
  if (process.platform === "win32" && child.pid) {
    const gracefulTree = spawn(
      "taskkill",
      ["/PID", String(child.pid), "/T"],
      { stdio: "ignore", windowsHide: true },
    );
    await waitForClose(gracefulTree);
  } else {
    child.kill("SIGTERM");
  }
  for (let attempt = 0; attempt < 20 && child.exitCode === null; attempt += 1) {
    await sleep(250);
  }
  if (child.exitCode === null && child.pid) {
    if (process.platform === "win32") {
      const taskkill = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      await waitForClose(taskkill);
    } else {
      child.kill("SIGKILL");
    }
  }
}

class Lifecycle {
  private emulators: ChildProcess | null = null;
  private nextjs: ChildProcess | null = null;
  private stopped = false;
  readonly machine = new LifecycleStateMachine();

  async start() {
    console.log("[Lifecycle] Verifying dedicated ports");
    validateE2EConfig(createE2EConfig());
    const occupied = await verifyPorts(false);
    if (occupied.length) {
      throw new Error(`Required ports already occupied: ${occupied.join(", ")}`);
    }
    this.machine.transition("ports_verified");

    console.log("[Lifecycle] Starting Auth and Firestore emulators");
    this.emulators = spawnNode(firebaseCli, [
      "emulators:start",
      "--only",
      "auth,firestore",
      "--project",
      EMULATOR_PROJECT_ID,
    ]);
    pipeOutput(this.emulators);
    this.machine.transition("emulators_started");
    await Promise.all([
      waitForPort(AUTH_EMULATOR_HOST, AUTH_EMULATOR_PORT, this.emulators),
      waitForPort(
        FIRESTORE_EMULATOR_HOST,
        FIRESTORE_EMULATOR_PORT,
        this.emulators,
      ),
      waitForPort(HUB_EMULATOR_HOST, HUB_EMULATOR_PORT, this.emulators),
    ]);
    this.machine.transition("emulators_ready");
    console.log("[Lifecycle] Auth, Firestore and Hub ready");

    console.log("[Lifecycle] Running validated emulator seed");
    const seed = spawnNode(resolve(projectRoot, "tools/seed_emulator_auth.mjs"), [
      "--auth-emulator",
      `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`,
      "--firestore-emulator",
      `http://${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`,
      "--project",
      EMULATOR_PROJECT_ID,
    ]);
    pipeOutput(seed);
    const seedExit = await waitForClose(seed);
    if (seedExit !== 0) throw new Error(`Seed failed with exit code ${seedExit}`);
    this.machine.transition("seed_validated");
    console.log("[Lifecycle] Seed validated");

    console.log("[Lifecycle] Starting Next.js");
    this.nextjs = spawnNode(nextCli, ["dev", "-p", String(E2E_PORTS.nextjs)], {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "true",
      NEXT_PUBLIC_FIREBASE_API_KEY: "synthetic-e2e-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: EMULATOR_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${EMULATOR_PROJECT_ID}.appspot.com`,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "100000000000",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:100000000000:web:synthetic",
    });
    pipeOutput(this.nextjs);
    this.machine.transition("nextjs_started");
    await waitForHttp(`http://localhost:${E2E_PORTS.nextjs}`, this.nextjs);
    this.machine.transition("nextjs_ready");
    console.log("[Lifecycle] Next.js ready");
  }

  async runPlaywright(args: string[]) {
    console.log("[Lifecycle] Starting Playwright");
    const playwright = spawnNode(playwrightCli, ["test", ...args], {
      ...process.env,
      NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "true",
    });
    pipeOutput(playwright);
    this.machine.transition("playwright_started");
    const exitCode = await waitForClose(playwright);
    this.machine.transition("playwright_closed");
    console.log(`[Lifecycle] Playwright closed with exit code ${exitCode}`);
    return exitCode;
  }

  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    await terminateKnownChild(this.nextjs, "Next.js");
    if (this.machine.state === "playwright_closed") {
      this.machine.transition("nextjs_stopped");
    }
    await terminateKnownChild(this.emulators, "Firebase emulators");
    if (this.machine.state === "nextjs_stopped") {
      this.machine.transition("emulators_stopped");
    }
    await sleep(1_000);
    const occupied = await verifyPorts(false);
    if (occupied.length) {
      throw new Error(`Dedicated ports still occupied after cleanup: ${occupied.join(", ")}`);
    }
    if (this.machine.state === "emulators_stopped") {
      this.machine.transition("ports_released");
      this.machine.transition("finished");
    }
    console.log("[Lifecycle] Ports released: 3000, 9199, 8181, 4545");
  }
}

async function main() {
  const lifecycle = new Lifecycle();
  let exitCode = 1;
  let interrupted = false;
  const handleSignal = () => {
    interrupted = true;
    process.exitCode = 130;
    void lifecycle.stop().catch((error) => console.error("[Lifecycle]", error));
  };
  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  try {
    await lifecycle.start();
    exitCode = await lifecycle.runPlaywright(process.argv.slice(2));
  } catch (error) {
    console.error("[Lifecycle]", error);
    exitCode = 1;
  } finally {
    try {
      await lifecycle.stop();
    } catch (error) {
      console.error("[Lifecycle] Cleanup failed:", error);
      exitCode = 1;
    }
    process.removeListener("SIGINT", handleSignal);
    process.removeListener("SIGTERM", handleSignal);
    process.exitCode = interrupted ? 130 : exitCode;
  }
}

void main();
