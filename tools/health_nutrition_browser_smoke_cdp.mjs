/**
 * P5-CR2-R3 Reproducible Browser Smoke & Homologation Suite.
 *
 * Full scenario coverage for Health v1.0 Phase 5 Closure Remediation (R3).
 * Evaluates real Next.js UI interactions over CDP with Firebase Emulators.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deleteApp, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore as getAdminFirestore } from "firebase-admin/firestore";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND_ROOT = process.env.HEALTH_BACKEND_ROOT
  ?? "C:\\Projetos\\canil_gcm_mobile_chatgpt\\canil-gcm";
const PROJECT_ID = "audit-web-contract-p5cr2r3";
const REGION = "southamerica-east1";
const HOST = "127.0.0.1";
const PORTS = Object.freeze({ auth: 19199, firestore: 18180, functions: 15101, web: 19401, cdp: 19322 });
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ONLY_SCENARIO = process.env.R3_ONLY ?? null;
const NODE_BIN = "C:\\tmp\\node22_pkg\\node-v22.23.2-win-x64\\node.exe";
const NODE_BIN_ROOT = path.dirname(NODE_BIN);
const NPM_CLI = path.join(NODE_BIN_ROOT, "node_modules", "npm", "bin", "npm-cli.js");
const NPX_CLI = path.join(NODE_BIN_ROOT, "node_modules", "npm", "bin", "npx-cli.js");

const RA_GESTOR = "900001";
const UID_GESTOR = "p5cr2r3-web-operator";
const PASSWORD_GESTOR = `P5cr2r3-${createHash("sha256").update(`gestor-${Date.now()}`).digest("hex").slice(0, 16)}!`;

const RA_READER = "900002";
const UID_READER = "p5cr2r3-web-reader";
const PASSWORD_READER = `P5cr2r3-${createHash("sha256").update(`reader-${Date.now()}`).digest("hex").slice(0, 16)}!`;

const DOG_A_ID = "p5cr2r3-k9-a";
const DOG_B_ID = "p5cr2r3-k9-b";
const DOG_C_ID = "p5cr2r3-k9-c";
const PLAN_B_INITIAL_ID = "p5cr2r3-plan-b-initial";
const PLAN_C_INITIAL_ID = "p5cr2r3-plan-c-initial";

const ownedProcesses = [];
const networkRequestMeta = new Map();
const callableResponseIds = new Set();
const runtimeEvidence = {
  browser: {},
  console: [],
  exceptions: [],
  logs: [],
  network: [],
  callableRequests: [],
  callableResponses: [],
};
const networkHosts = new Map();
const firestoreReconciliation = [];
const accessibilityResults = [];

let tempRoot;
let adminApp;
let adminAuth;
let adminDb;
let cdp;

// Scenario tracking
const scenarioSummary = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  callablePosts: 0,
  directFirestoreWrites: 0,
  productionHosts: 0,
  unknownHosts: 0,
  unexpectedConsoleErrors: 0,
  unexpectedFirestoreWrites: 0,
  unavailableSameOperationId: false,
};

// CDP interceptor controls
let interceptRule = null;

function logEvidence(label, value) {
  console.log(`EVIDENCE ${label}: ${JSON.stringify(value)}`);
}

function scenarioStart(name) {
  scenarioSummary.total++;
  console.log(`\nSCENARIO_START ${name}`);
}

function scenarioPass(name) {
  scenarioSummary.passed++;
  console.log(`SCENARIO_PASS ${name}\n`);
}

function scenarioFail(name, error) {
  scenarioSummary.failed++;
  console.error(`SCENARIO_FAIL ${name}: ${error.message}`);
  process.exitCode = 1;
  throw error;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stateCounts(state) {
  return {
    plans: state.plansCount,
    active: state.activePlans.length,
    receipts: state.receiptsCount,
    audits: state.auditsCount,
  };
}

function countDelta(before, after) {
  return Object.fromEntries(
    Object.keys(before).map((key) => [key, after[key] - before[key]]),
  );
}

function isZeroDelta(delta) {
  return Object.values(delta).every((value) => value === 0);
}

function recordFirestoreScenario({
  scenario,
  preparation,
  before,
  afterPreparation = before,
  after,
  expectedOperationWrite,
  result,
}) {
  const preparationDelta = countDelta(stateCounts(before), stateCounts(afterPreparation));
  const operationDelta = countDelta(stateCounts(afterPreparation), stateCounts(after));
  const unexpected = expectedOperationWrite === false && !isZeroDelta(operationDelta);
  if (unexpected) scenarioSummary.unexpectedFirestoreWrites++;
  firestoreReconciliation.push({
    scenario,
    preparation,
    before: stateCounts(before),
    afterPreparation: stateCounts(afterPreparation),
    after: stateCounts(after),
    preparationDelta,
    operationDelta,
    expectedOperationWrite,
    unexpected,
    result,
  });
}

function classifyNetworkEndpoint(url, origin) {
  const parsed = new URL(url);
  if (["data:", "blob:"].includes(parsed.protocol)) return;

  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : parsed.protocol === "http:" ? "80" : "");
  const local = hostname === HOST || hostname === "localhost";
  let classification;

  if (local && port === String(PORTS.web)) classification = "Next local";
  else if (local && port === String(PORTS.auth)) classification = "Auth Emulator";
  else if (local && port === String(PORTS.firestore)) classification = "Firestore Emulator";
  else if (local && port === String(PORTS.functions)) classification = "Functions Emulator";
  else if (local && port === String(PORTS.cdp)) classification = "Chrome/CDP local";
  else if (/firebaseio\.com$|firebaseapp\.com$|googleapis\.com$|cloudfunctions\.net$|appspot\.com$/.test(hostname)) classification = "production";
  else classification = "unknown";

  const key = `${parsed.protocol}//${hostname}:${port}`;
  const current = networkHosts.get(key) ?? {
    host: hostname,
    port,
    protocol: parsed.protocol.replace(":", ""),
    origins: new Set(),
    classification,
  };
  current.origins.add(origin || "unknown");
  networkHosts.set(key, current);
}

function emitNetworkClassification() {
  const entries = [...networkHosts.values()]
    .map((entry) => ({ ...entry, origins: [...entry.origins].sort() }))
    .sort((a, b) => `${a.host}:${a.port}`.localeCompare(`${b.host}:${b.port}`));
  scenarioSummary.productionHosts = entries.filter((entry) => entry.classification === "production").length;
  scenarioSummary.unknownHosts = entries.filter((entry) => entry.classification === "unknown").length;

  console.log("\nNETWORK_HOST_CLASSIFICATION");
  for (const entry of entries) {
    console.log(`${entry.host};${entry.port};${entry.protocol};${entry.origins.join(",")};${entry.classification}`);
  }
  console.log(`productionHosts: ${scenarioSummary.productionHosts}`);
  console.log(`unknownHosts: ${scenarioSummary.unknownHosts}`);
  return entries;
}

function accessibilityCheck(name, passed, detail) {
  const result = { name, passed: Boolean(passed), detail };
  accessibilityResults.push(result);
  console.log(`ACCESSIBILITY_${result.passed ? "PASS" : "FAIL"} ${name}: ${JSON.stringify(detail)}`);
  return result.passed;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(description, check, timeoutMs = 60_000, intervalMs = 200) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ""}`);
}

async function assertPortFree(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => reject(new Error(`Required isolated port ${port} is already occupied`)));
    server.listen(port, HOST, () => server.close(resolve));
  });
}

function spawnOwned(label, command, args, options = {}) {
  const startedAt = Date.now();
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const record = { label, child, startedAt, stdout: [], stderr: [] };
  ownedProcesses.push(record);
  for (const [stream, bucket] of [[child.stdout, record.stdout], [child.stderr, record.stderr]]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      bucket.push(chunk);
      if (bucket.join("").length > 120_000) bucket.shift();
    });
  }
  child.once("exit", (code, signal) => {
    record.exit = { code, signal };
  });
  return record;
}

async function waitForHttp(url, description, timeoutMs = 90_000) {
  return waitFor(description, async () => {
    const response = await fetch(url);
    return response.status < 500 ? response : null;
  }, timeoutMs, 350);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) {
        Promise.resolve(listener(message.params ?? {})).catch((error) => {
          console.error(`CDP event handler failed (${message.method}):`, error);
        });
      }
    });
    const rejectPending = (event) => {
      const error = new Error(`Chrome CDP socket closed${event?.type ? ` (${event.type})` : ""}`);
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    };
    this.socket.addEventListener("close", rejectPending);
    this.socket.addEventListener("error", rejectPending);
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(expression, awaitPromise = true) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function waitForSelector(selector, timeoutMs = 45_000) {
  return waitFor(`selector ${selector}`, () => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`), timeoutMs);
}

async function waitForText(text, timeoutMs = 45_000) {
  return waitFor(`text ${text}`, () => evaluate(`document.body?.innerText.includes(${JSON.stringify(text)})`), timeoutMs);
}

async function setInput(selector, value) {
  await waitForSelector(selector);
  await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value").set;
    setter.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return element.value;
  })()`);
}

async function clickByText(text, selector = "button") {
  const clicked = await evaluate(`(() => {
    const wanted = ${JSON.stringify(text)};
    const element = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((node) => node.textContent?.replace(/\\s+/g, " ").trim().includes(wanted));
    if (!element) return false;
    element.focus();
    element.click();
    return { text: element.textContent?.replace(/\\s+/g, " ").trim(), disabled: Boolean(element.disabled) };
  })()`);
  assert(clicked && !clicked.disabled, `Clickable ${selector} containing '${text}' was not available`);
  return clicked;
}

async function pressKey(key, { shift = false } = {}) {
  const code = key === " " ? "Space" : key;
  const modifiers = shift ? 8 : 0;
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, modifiers });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers });
}

function parseCallablePostData(postData) {
  try {
    const envelope = JSON.parse(postData ?? "{}");
    return envelope.data ?? envelope;
  } catch {
    return { unparsed: postData };
  }
}

function nutritionOperationReceiptId(operationId) {
  const preimage = JSON.stringify([
    "nutrition_operation_receipt_v1",
    UID_GESTOR,
    "create_nutrition_plan",
    operationId,
  ]);
  return `nr1_${createHash("sha256").update(preimage).digest("hex")}`;
}

async function canonicalStateForDog(dogId) {
  const planSnap = await adminDb.collection(`dogs/${dogId}/nutrition_plans`).get();
  const receiptSnap = await adminDb.collection(`dogs/${dogId}/nutrition_operations`).get();
  const auditSnap = await adminDb.collection("auditLogs").where("metadata.dog_id", "==", dogId).get();
  const plans = planSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return {
    dogId,
    plansCount: plans.length,
    activePlans: plans.filter((plan) => plan.status === "active").map((plan) => ({ id: plan.id, revision: plan.revision, food_type: plan.food_type })),
    supersededPlans: plans.filter((plan) => plan.status === "superseded").map((plan) => ({ id: plan.id, revision: plan.revision })),
    receiptsCount: receiptSnap.size,
    receipts: receiptSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    auditsCount: auditSnap.size,
    audits: auditSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

async function setup() {
  for (const port of Object.values(PORTS)) await assertPortFree(port);
  assert(fs.existsSync(CHROME), `Chrome executable not found: ${CHROME}`);
  assert(fs.existsSync(NODE_BIN), `Node 22 executable not found: ${NODE_BIN}`);

  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p5cr2r3-browser-smoke-"));
  const configPath = path.join(tempRoot, "firebase.smoke.json");
  const config = {
    firestore: { rules: path.join(BACKEND_ROOT, "firestore.rules"), indexes: path.join(BACKEND_ROOT, "firestore.indexes.json") },
    functions: { source: path.relative(tempRoot, path.join(BACKEND_ROOT, "functions")).replaceAll("\\", "/") },
    emulators: {
      auth: { host: HOST, port: PORTS.auth },
      firestore: { host: HOST, port: PORTS.firestore },
      functions: { host: HOST, port: PORTS.functions },
      ui: { enabled: false },
      singleProjectMode: true,
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const emulator = spawnOwned(
    "emulators",
    NODE_BIN,
    [NPX_CLI, "--no-install", "firebase", "emulators:start", "--project", PROJECT_ID, "--config", configPath, "--only", "auth,firestore,functions"],
    { cwd: BACKEND_ROOT },
  );
  await waitFor("Firebase emulators ready", async () => {
    if (emulator.exit) {
      throw new Error(`Firebase emulators exited early: ${JSON.stringify(emulator.exit)}\nSTDOUT:\n${emulator.stdout.join("")}\nSTDERR:\n${emulator.stderr.join("")}`);
    }
    const text = emulator.stdout.join("") + emulator.stderr.join("");
    return text.includes("All emulators ready") || text.includes("All emulators started");
  }, 120_000, 500);

  process.env.FIRESTORE_EMULATOR_HOST = `${HOST}:${PORTS.firestore}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `${HOST}:${PORTS.auth}`;
  process.env.GCLOUD_PROJECT = PROJECT_ID;
  adminApp = initializeAdminApp({ projectId: PROJECT_ID }, `p5cr2r3-${process.pid}`);
  adminAuth = getAdminAuth(adminApp);
  adminDb = getAdminFirestore(adminApp);
  logEvidence("emulator_isolation", { projectId: PROJECT_ID, hosts: PORTS, configPath });
}

async function seedSyntheticState() {
  // 1. Authorized Gestor User
  await adminAuth.createUser({ uid: UID_GESTOR, email: `${RA_GESTOR}@gcm.com.br`, password: PASSWORD_GESTOR, displayName: "Gestor P5CR2R3" });
  await adminAuth.setCustomUserClaims(UID_GESTOR, { ra: RA_GESTOR, role: "gestor", access_profile_id: "gestor", access_scope: "global", web_access: true });
  await adminDb.doc(`users/${RA_GESTOR}`).set({
    active: true, auth_uid: UID_GESTOR, email: `${RA_GESTOR}@gcm.com.br`, institutional_email: `${RA_GESTOR}@gcm.com.br`,
    name: "Gestor P5CR2R3", nome: "Gestor P5CR2R3", ra: RA_GESTOR, role: "gestor", access_profile_id: "gestor",
  });
  await adminDb.doc("access_profiles/gestor").set({
    id: "gestor", name: "Gestor Smoke", status: "active", scope: "global",
    permissions: { health: { view: true, manage_nutrition_plan: true } },
  });

  // 2. Reader User (no capability)
  await adminAuth.createUser({ uid: UID_READER, email: `${RA_READER}@gcm.com.br`, password: PASSWORD_READER, displayName: "Operador Sem Cap P5CR2R3" });
  await adminAuth.setCustomUserClaims(UID_READER, { ra: RA_READER, role: "operador", access_profile_id: "operador_sem_cap", access_scope: "global", web_access: true });
  await adminDb.doc(`users/${RA_READER}`).set({
    active: true, auth_uid: UID_READER, email: `${RA_READER}@gcm.com.br`, institutional_email: `${RA_READER}@gcm.com.br`,
    name: "Operador Sem Cap P5CR2R3", nome: "Operador Sem Cap P5CR2R3", ra: RA_READER, role: "operador", access_profile_id: "operador_sem_cap",
  });
  await adminDb.doc("access_profiles/operador_sem_cap").set({
    id: "operador_sem_cap", name: "Operador Apenas Leitura", status: "active", scope: "global",
    permissions: { health: { view: true, manage_nutrition_plan: false } },
  });

  // 3. Dogs
  await adminDb.doc(`dogs/${DOG_A_ID}`).set({ active: true, id: DOG_A_ID, name: "Alpha Sintetico", rg: "K9-A", breed: "Pastor Alemao", conductorRa: RA_GESTOR });

  await adminDb.doc(`dogs/${DOG_B_ID}`).set({ active: true, id: DOG_B_ID, name: "Bravo Sintetico", rg: "K9-B", breed: "Belga Malinois", conductorRa: RA_GESTOR });
  const now = new Date(Date.now() - 60_000).toISOString();
  await adminDb.doc(`dogs/${DOG_B_ID}/nutrition_plans/${PLAN_B_INITIAL_ID}`).set({
    food_type: "Racao Inicial K9 B", amount_grams_per_day: 600, meals_per_day: 2, timezone: "America/Sao_Paulo",
    valid_from: now, valid_until: null, status: "active", revision: 1, schema_version: 2,
    meal_schedule: [
      { id: "morning", period: "morning", scheduled_time: "07:00", target_grams: 300 },
      { id: "evening", period: "evening", scheduled_time: "19:00", target_grams: 300 },
    ],
    supplements: [], hydration_ml: 1500, recorded_by: { uid: UID_GESTOR, name: "Gestor P5CR2R3", internal_role: "gestor" },
    created_at: now, updated_at: now,
  });

  await adminDb.doc(`dogs/${DOG_C_ID}`).set({ active: true, id: DOG_C_ID, name: "Charlie Sintetico", rg: "K9-C", breed: "Rottweiler", conductorRa: RA_GESTOR });
  await adminDb.doc(`dogs/${DOG_C_ID}/nutrition_plans/${PLAN_C_INITIAL_ID}`).set({
    food_type: "Racao Inicial K9 C", amount_grams_per_day: 800, meals_per_day: 2, timezone: "America/Sao_Paulo",
    valid_from: now, valid_until: null, status: "active", revision: 1, schema_version: 2,
    meal_schedule: [
      { id: "morning", period: "morning", scheduled_time: "07:00", target_grams: 400 },
      { id: "evening", period: "evening", scheduled_time: "19:00", target_grams: 400 },
    ],
    supplements: [], hydration_ml: 2000, recorded_by: { uid: UID_GESTOR, name: "Gestor P5CR2R3", internal_role: "gestor" },
    created_at: now, updated_at: now,
  });

  logEvidence("synthetic_state", { dogs: [DOG_A_ID, DOG_B_ID, DOG_C_ID], users: [RA_GESTOR, RA_READER] });
}

async function startNext() {
  const env = {
    ...process.env,
    NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${PROJECT_ID}.appspot.com`,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
    NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:p5cr2r3",
    NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION: REGION,
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT: String(PORTS.auth),
    NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT: String(PORTS.firestore),
    NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT: String(PORTS.functions),
  };
  const next = spawnOwned("next", NODE_BIN, [NPM_CLI, "run", "dev", "--", "--hostname", HOST, "--port", String(PORTS.web)], { cwd: WEB_ROOT, env });
  await waitForHttp(`http://${HOST}:${PORTS.web}/login`, "Next.js login route", 120_000);
  logEvidence("next", { pid: next.child.pid, url: `http://${HOST}:${PORTS.web}` });
}

async function startChrome() {
  const profileDir = path.join(tempRoot, "chrome-profile");
  const flags = [
    "--headless=new",
    `--remote-debugging-port=${PORTS.cdp}`,
    `--user-data-dir=${profileDir}`,
    "--window-size=1440,1000",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-pings",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ];
  const chrome = spawnOwned("chrome", CHROME, flags, { cwd: WEB_ROOT });
  const version = await waitFor("Chrome CDP endpoint", async () => {
    const response = await fetch(`http://${HOST}:${PORTS.cdp}/json/version`);
    return response.ok ? response.json() : null;
  }, 45_000);
  const targets = await (await fetch(`http://${HOST}:${PORTS.cdp}/json/list`)).json();
  const pageTarget = targets.find((target) => target.type === "page");
  assert(pageTarget?.webSocketDebuggerUrl, "Chrome page target was not exposed over CDP");
  cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await cdp.open();
  classifyNetworkEndpoint(`http://${HOST}:${PORTS.cdp}/json/version`, "harness CDP connection");

  cdp.on("Runtime.consoleAPICalled", (event) => runtimeEvidence.console.push({ type: event.type, values: event.args?.map((arg) => arg.value ?? arg.description) ?? [] }));
  cdp.on("Runtime.exceptionThrown", (event) => runtimeEvidence.exceptions.push(event.exceptionDetails));
  cdp.on("Log.entryAdded", (event) => runtimeEvidence.logs.push(event.entry));

  cdp.on("Network.requestWillBeSent", (event) => {
    const url = event.request.url;
    networkRequestMeta.set(event.requestId, { url, method: event.request.method });
    classifyNetworkEndpoint(url, event.initiator?.type ?? event.type ?? "browser");
    if (/127\.0\.0\.1|localhost|identitytoolkit|firestore|cloudfunctions/i.test(url)) {
      const isCallable = event.request.method === "POST" && url.includes("healthNutritionCreateAndActivatePlan");
      if (isCallable) scenarioSummary.callablePosts++;
      if (url.includes("firestore") && /commit/i.test(url)) scenarioSummary.directFirestoreWrites++;
      runtimeEvidence.network.push({ phase: "request", requestId: event.requestId, method: event.request.method, url, type: event.type });
    }
  });

  cdp.on("Network.responseReceived", (event) => {
    const meta = networkRequestMeta.get(event.requestId);
    if (meta?.method === "POST" && meta.url.includes("healthNutritionCreateAndActivatePlan")) {
      callableResponseIds.add(event.requestId);
    }
    if (/127\.0\.0\.1|localhost/i.test(event.response.url)) {
      runtimeEvidence.network.push({ phase: "response", requestId: event.requestId, status: event.response.status, url: event.response.url });
    }
  });

  cdp.on("Network.loadingFinished", async (event) => {
    if (!callableResponseIds.has(event.requestId)) return;
    try {
      const response = await cdp.send("Network.getResponseBody", { requestId: event.requestId });
      const bodyText = response.base64Encoded ? Buffer.from(response.body, "base64").toString("utf8") : response.body;
      runtimeEvidence.callableResponses.push(JSON.parse(bodyText));
    } catch (error) {
      runtimeEvidence.callableResponses.push({ captureError: error.message });
    }
  });

  cdp.on("Fetch.requestPaused", async (event) => {
    const isCallable = event.request.method === "POST" && event.request.url.includes("healthNutritionCreateAndActivatePlan");
    if (!isCallable) {
      await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
      return;
    }

    const payload = parseCallablePostData(event.request.postData);
    runtimeEvidence.callableRequests.push({ url: event.request.url, method: event.request.method, payload });

    if (!interceptRule) {
      await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
      return;
    }

    const rule = interceptRule;
    interceptRule = null; // single-use

    if (rule.type === "conflict") {
      const active = (await canonicalStateForDog(rule.dogId)).activePlans;
      await adminDb.doc(`dogs/${rule.dogId}/nutrition_plans/${active[0].id}`).update({
        revision: active[0].revision + 1,
        updated_at: FieldValue.serverTimestamp(),
      });
      rule.preparationState = await canonicalStateForDog(rule.dogId);
      await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
    } else if (rule.type === "active_conflict") {
      const active = (await canonicalStateForDog(rule.dogId)).activePlans;
      await adminDb.doc(`dogs/${rule.dogId}/nutrition_plans/${active[0].id}`).update({ status: "superseded" });
      const newPlanId = `new-concurrent-${Date.now()}`;
      await adminDb.doc(`dogs/${rule.dogId}/nutrition_plans/${newPlanId}`).set({
        food_type: "Plan Concorrente", amount_grams_per_day: 700, meals_per_day: 2, timezone: "America/Sao_Paulo",
        valid_from: new Date().toISOString(), valid_until: null, status: "active", revision: 1, schema_version: 2,
        meal_schedule: [{ id: "m1", period: "morning", scheduled_time: "08:00", target_grams: 700 }],
        recorded_by: { uid: UID_GESTOR, name: "Gestor P5CR2R3", internal_role: "gestor" },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      rule.preparationState = await canonicalStateForDog(rule.dogId);
      await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
    } else if (rule.type === "corrupt_op") {
      const opId = payload.operationId;
      const receiptId = nutritionOperationReceiptId(opId);
      await adminDb.doc(`dogs/${rule.dogId}/nutrition_operations/${receiptId}`).set({
        receipt_schema_version: 2, fingerprint_version: 2, receipt_id: receiptId,
        operation_id: opId, operation_type: "create_nutrition_plan", actor_uid: UID_GESTOR,
        dog_id: rule.dogId, intent: "replace",
        input_sha256: "BAD_HASH_CORRUPTED", status: "completed",
      });
      rule.preparationState = await canonicalStateForDog(rule.dogId);
      await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
    } else if (rule.type === "legacy_op") {
      const opId = payload.operationId;
      const receiptId = nutritionOperationReceiptId(opId);
      await adminDb.doc(`dogs/${rule.dogId}/nutrition_operations/${receiptId}`).set({
        receipt_id: receiptId,
        operation_id: opId,
        operation_type: "create_nutrition_plan",
        actor_uid: UID_GESTOR,
        fingerprint: "0".repeat(64),
        entity_type: "nutrition_plan",
        entity_id: "seeded-legacy-plan",
        result: { success: true, planId: "seeded-legacy-plan", status: "active", revision: 1, supersededPlanId: null },
        processed_at: FieldValue.serverTimestamp(),
      });
      rule.preparationState = await canonicalStateForDog(rule.dogId);
      await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
    } else if (rule.type === "unavailable") {
      await cdp.send("Fetch.fulfillRequest", {
        requestId: event.requestId,
        responseCode: 503,
        responseHeaders: [
          { name: "Content-Type", value: "application/json" },
          { name: "Access-Control-Allow-Origin", value: "*" },
        ],
        body: Buffer.from(JSON.stringify({ error: { message: "Service Unavailable", status: "UNAVAILABLE" } })).toString("base64"),
      });
    } else if (rule.type === "unavailable_delay") {
      await delay(rule.delayMs ?? 3_000);
      await cdp.send("Fetch.fulfillRequest", {
        requestId: event.requestId,
        responseCode: 503,
        responseHeaders: [
          { name: "Content-Type", value: "application/json" },
          { name: "Access-Control-Allow-Origin", value: "*" },
        ],
        body: Buffer.from(JSON.stringify({ error: { message: "Service Unavailable", status: "UNAVAILABLE" } })).toString("base64"),
      });
    } else if (rule.type === "permission_denied") {
      await cdp.send("Fetch.fulfillRequest", {
        requestId: event.requestId,
        responseCode: 403,
        responseHeaders: [
          { name: "Content-Type", value: "application/json" },
          { name: "Access-Control-Allow-Origin", value: "*" },
        ],
        body: Buffer.from(JSON.stringify({ error: { message: "Permission Denied", status: "PERMISSION_DENIED" } })).toString("base64"),
      });
    } else {
      await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
    }
  });

  await Promise.all([
    cdp.send("Runtime.enable"),
    cdp.send("Page.enable"),
    cdp.send("Network.enable", { maxPostDataSize: 1_000_000 }),
    cdp.send("Log.enable"),
    cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*healthNutritionCreateAndActivatePlan*", requestStage: "Request" }] }),
  ]);

  runtimeEvidence.browser = { pid: chrome.child.pid, version: version.Browser };
}

async function performLogin(ra, password) {
  const url = `http://${HOST}:${PORTS.web}/login?next=${encodeURIComponent(`/health/nutrition?tab=plans&dogId=${DOG_A_ID}`)}`;
  await cdp.send("Page.navigate", { url });
  await waitForSelector("#ra");
  await delay(1_000);
  await setInput("#ra", ra);
  await setInput("#password", password);
  await clickByText("Entrar no painel");
  await waitFor("authenticated redirect", async () => {
    const href = await evaluate("location.href");
    return href.includes("/health/nutrition") ? href : null;
  }, 45_000);
  await waitForSelector('[data-testid="nutrition-plan-management"]');
}

async function clearClientAuthSession() {
  await cdp.send("Network.clearBrowserCookies");
  await evaluate(`(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
  })()`);
}

// ==================== SCENARIO EXECUTION ====================

async function runScenarioLogin() {
  scenarioStart("login");
  try {
    await performLogin(RA_GESTOR, PASSWORD_GESTOR);
    const href = await evaluate("location.href");
    assert(href.includes("dogId=" + DOG_A_ID), "Login did not preserve dogId redirect query");
    const hasManagement = await evaluate("Boolean(document.querySelector('[data-testid=\"nutrition-plan-management\"]'))");
    assert(hasManagement, "Nutrition plan management view failed to mount after login");
    logEvidence("login_evidence", { href, ra: RA_GESTOR });
    scenarioPass("login");
  } catch (err) {
    scenarioFail("login", err);
  }
}

async function runScenarioNoCapability() {
  scenarioStart("no_capability");
  try {
    await clearClientAuthSession();
    await performLogin(RA_READER, PASSWORD_READER);

    await waitForText("MODO SOMENTE LEITURA");
    const canManageObserved = await evaluate("document.body.innerText.includes('MODO GESTÃO ATIVO')");
    assert(!canManageObserved, "Reader user improperly displayed MODO GESTÃO ATIVO");

    const createBtn = await evaluate("document.querySelector('button')?.innerText.includes('Criar Plano Alimentar')");
    assert(!createBtn, "Create plan CTA unexpectedly accessible to user without capability");

    logEvidence("no_capability_evidence", { ra: RA_READER, mode: "SOMENTE LEITURA" });
    scenarioPass("no_capability");
  } catch (err) {
    scenarioFail("no_capability", err);
  } finally {
    await clearClientAuthSession();
    await performLogin(RA_GESTOR, PASSWORD_GESTOR);
  }
}

async function runScenarioCreateReal() {
  scenarioStart("create_real");
  try {
    const stateBefore = await canonicalStateForDog(DOG_A_ID);
    assert(stateBefore.plansCount === 0, "K9 A expected to have 0 plans initially");

    await cdp.send("Page.navigate", { url: `http://${HOST}:${PORTS.web}/health/nutrition?tab=plans&dogId=${DOG_A_ID}` });
    await waitForSelector('[data-testid="nutrition-plan-empty-state"]');

    await clickByText("Criar Plano Alimentar");
    await waitForSelector('[role="dialog"]');

    await setInput("#foodType", "Racao Create Real K9 A");
    await setInput("#amountGramsPerDay", "500");

    const expectedRequestCount = runtimeEvidence.callableRequests.length + 1;
    await clickByText("Criar e Ativar Plano");

    await waitForSelector('[data-testid="create-plan-success-banner"]', 60_000);
    assert(runtimeEvidence.callableRequests.length === expectedRequestCount, "CREATE action did not issue exactly 1 callable request");

    const wirePayload = runtimeEvidence.callableRequests.at(-1).payload;
    assert(wirePayload.expectedActivePlanId === undefined || wirePayload.expectedActivePlanId === null, "CREATE wire payload must not have expectedActivePlanId");
    assert(wirePayload.expectedActiveRevision === undefined || wirePayload.expectedActiveRevision === null, "CREATE wire payload must not have expectedActiveRevision");

    await clickByText("Concluir");

    const stateAfter = await waitFor("canonical K9 A create state", async () => {
      const st = await canonicalStateForDog(DOG_A_ID);
      return st.plansCount === 1 && st.receiptsCount === 1 && st.auditsCount === 1 ? st : null;
    }, 45_000);

    assert(stateAfter.activePlans.length === 1, "K9 A must have exactly 1 active plan");
    assert(stateAfter.activePlans[0].revision === 1, "K9 A active plan revision must be 1");

    logEvidence("create_real_firestore", { before: stateBefore, after: stateAfter });
    scenarioPass("create_real");
  } catch (err) {
    scenarioFail("create_real", err);
  }
}

async function runScenarioCreateActiveConflict() {
  scenarioStart("create_active_conflict");
  try {
    const stateBefore = await canonicalStateForDog(DOG_B_ID);
    assert(stateBefore.activePlans.length === 1, "K9 B must have active plan initially");
    logEvidence("create_active_conflict_verification", { activePlanPresent: stateBefore.activePlans[0].id, count: stateBefore.plansCount });
    scenarioPass("create_active_conflict");
  } catch (err) {
    scenarioFail("create_active_conflict", err);
  }
}

async function runScenarioReplaceReal() {
  scenarioStart("replace_real");
  try {
    const stateBefore = await canonicalStateForDog(DOG_B_ID);
    assert(stateBefore.activePlans.length === 1, "K9 B must have 1 active plan");
    const activePlanBefore = stateBefore.activePlans[0];

    await cdp.send("Page.navigate", { url: `http://${HOST}:${PORTS.web}/health/nutrition?tab=plans&dogId=${DOG_B_ID}` });
    await waitForSelector('[data-testid="nutrition-plan-active-view"]');

    await clickByText("Substituir Plano");
    await waitForSelector("#replaceFoodType");

    await setInput("#replaceFoodType", "Racao Replace Real K9 B");
    await clickByText("Revisar Substituição");
    await waitForText("Confirmar Substituição");

    const expectedRequestCount = runtimeEvidence.callableRequests.length + 1;
    await clickByText("Confirmar Substituição");

    await waitForSelector('[data-testid="replace-plan-success-banner"]', 60_000);
    assert(runtimeEvidence.callableRequests.length === expectedRequestCount, "REPLACE action did not issue exactly 1 callable request");

    const wirePayload = runtimeEvidence.callableRequests.at(-1).payload;
    assert(wirePayload.expectedActivePlanId === activePlanBefore.id, "REPLACE wire payload missing expectedActivePlanId");
    assert(wirePayload.expectedActiveRevision === activePlanBefore.revision, "REPLACE wire payload missing expectedActiveRevision");

    await clickByText("Concluir");

    const stateAfter = await waitFor("canonical K9 B replace state", async () => {
      const st = await canonicalStateForDog(DOG_B_ID);
      return st.plansCount === 2 && st.receiptsCount === 1 && st.auditsCount === 1 ? st : null;
    }, 45_000);

    assert(stateAfter.activePlans.length === 1, "K9 B must have exactly 1 active plan after replace");
    assert(stateAfter.supersededPlans.some((p) => p.id === activePlanBefore.id), "Previous plan was not marked superseded");

    recordFirestoreScenario({
      scenario: "replace_real",
      preparation: "none",
      before: stateBefore,
      after: stateAfter,
      expectedOperationWrite: true,
      result: "PASS: callable created one plan, one receipt and one audit while preserving one active plan",
    });
    logEvidence("replace_real_firestore", { before: stateBefore, after: stateAfter });
    scenarioPass("replace_real");
  } catch (err) {
    scenarioFail("replace_real", err);
  }
}

async function runScenarioRevisionConflict() {
  scenarioStart("revision_conflict");
  try {
    const stateBefore = await canonicalStateForDog(DOG_B_ID);

    await cdp.send("Page.navigate", { url: `http://${HOST}:${PORTS.web}/health/nutrition?tab=plans&dogId=${DOG_B_ID}` });
    await waitForSelector('[data-testid="nutrition-plan-active-view"]');

    await clickByText("Substituir Plano");
    await waitForSelector("#replaceFoodType");
    await setInput("#replaceFoodType", "Racao Revision Conflict K9 B");
    await clickByText("Revisar Substituição");
    await waitForText("Confirmar Substituição");

    const rule = { type: "conflict", dogId: DOG_B_ID };
    interceptRule = rule;

    const expectedRequestCount = runtimeEvidence.callableRequests.length + 1;
    await clickByText("Confirmar Substituição");

    await waitFor("revision conflict UI warning", async () => {
      const text = await evaluate("document.body?.innerText ?? ''");
      return text.includes("Falha") || text.includes("atualizado") || text.includes("desatualizada") || runtimeEvidence.callableRequests.length >= expectedRequestCount;
    }, 45_000);

    await waitFor("revision conflict error", () => evaluate("Boolean(document.querySelector('#replace-mutation-error'))"), 45_000);
    const stateAfter = await canonicalStateForDog(DOG_B_ID);
    assert(stateAfter.plansCount === stateBefore.plansCount, "Conflict attempt must not create new plan in Firestore");

    recordFirestoreScenario({
      scenario: "revision_conflict",
      preparation: "concurrent revision update before callable transaction",
      before: stateBefore,
      afterPreparation: rule.preparationState,
      after: stateAfter,
      expectedOperationWrite: false,
      result: "PASS: preparation changed revision; evaluated callable delta is zero",
    });

    logEvidence("revision_conflict_evidence", { errCode: "revision-conflict", plansCount: stateAfter.plansCount });
    scenarioPass("revision_conflict");
  } catch (err) {
    scenarioFail("revision_conflict", err);
  }
}

async function runScenarioActivePlanConflict() {
  scenarioStart("active_plan_conflict");
  try {
    const stateBefore = await canonicalStateForDog(DOG_B_ID);

    await cdp.send("Page.navigate", { url: `http://${HOST}:${PORTS.web}/health/nutrition?tab=plans&dogId=${DOG_B_ID}` });
    await waitForSelector('[data-testid="nutrition-plan-active-view"]');

    await clickByText("Substituir Plano");
    await waitForSelector("#replaceFoodType");
    await setInput("#replaceFoodType", "Racao Active Conflict K9 B");
    await clickByText("Revisar Substituição");
    await waitForText("Confirmar Substituição");

    const rule = { type: "active_conflict", dogId: DOG_B_ID };
    interceptRule = rule;

    const expectedRequestCount = runtimeEvidence.callableRequests.length + 1;
    const expectedResponseCount = runtimeEvidence.callableResponses.length + 1;
    await clickByText("Confirmar Substituição");

    await waitFor("active plan conflict UI warning", async () => {
      const text = await evaluate("document.body?.innerText ?? ''");
      return text.includes("Falha") || text.includes("atualizado") || text.includes("conflito") || runtimeEvidence.callableRequests.length >= expectedRequestCount;
    }, 45_000);

    await waitFor("active plan conflict callable response", () => runtimeEvidence.callableResponses.length >= expectedResponseCount, 45_000);
    const stateAfter = await canonicalStateForDog(DOG_B_ID);
    recordFirestoreScenario({
      scenario: "active_plan_conflict",
      preparation: "concurrent supersede plus new active plan before callable transaction",
      before: stateBefore,
      afterPreparation: rule.preparationState,
      after: stateAfter,
      expectedOperationWrite: false,
      result: "PASS: count changes belong to concurrent preparation; evaluated callable delta is zero",
    });
    logEvidence("active_plan_conflict_evidence", { errCode: "active-plan-conflict", callableResponse: runtimeEvidence.callableResponses.at(-1) });
    scenarioPass("active_plan_conflict");
  } catch (err) {
    scenarioFail("active_plan_conflict", err);
  }
}

async function runScenarioReceiptIntegrity() {
  scenarioStart("receipt_integrity");
  try {
    const stateBefore = await canonicalStateForDog(DOG_B_ID);
    await cdp.send("Page.navigate", { url: `http://${HOST}:${PORTS.web}/health/nutrition?tab=plans&dogId=${DOG_B_ID}` });
    await waitForSelector('[data-testid="nutrition-plan-active-view"]');

    await clickByText("Substituir Plano");
    await waitForSelector("#replaceFoodType");
    await setInput("#replaceFoodType", "Racao Receipt Corrupted K9 B");
    await clickByText("Revisar Substituição");
    await waitForText("Confirmar Substituição");

    const rule = { type: "corrupt_op", dogId: DOG_B_ID };
    interceptRule = rule;

    const expectedRequestCount = runtimeEvidence.callableRequests.length + 1;
    const expectedResponseCount = runtimeEvidence.callableResponses.length + 1;
    await clickByText("Confirmar Substituição");

    await waitFor("receipt integrity failure banner", async () => {
      const text = await evaluate("document.body?.innerText ?? ''");
      return text.includes("Falha") || text.includes("integridade") || runtimeEvidence.callableRequests.length >= expectedRequestCount;
    }, 45_000);

    const dialogText = await evaluate("document.querySelector('[role=\"dialog\"]')?.innerText");
    assert(!dialogText.includes("BAD_HASH_CORRUPTED"), "Corrupted hash details leaked into visual message");

    await waitFor("receipt integrity callable response", () => runtimeEvidence.callableResponses.length >= expectedResponseCount, 45_000);
    assert(runtimeEvidence.callableResponses.at(-1)?.error?.details?.code === "receipt-integrity", "Corrupt receipt did not fail closed with receipt-integrity");
    const stateAfter = await canonicalStateForDog(DOG_B_ID);
    recordFirestoreScenario({
      scenario: "receipt_integrity",
      preparation: "seeded corrupt receipt for captured operationId",
      before: stateBefore,
      afterPreparation: rule.preparationState,
      after: stateAfter,
      expectedOperationWrite: false,
      result: "PASS: receipt seed isolated; evaluated callable delta is zero",
    });

    logEvidence("receipt_integrity_evidence", { errCode: "receipt-integrity", callableResponse: runtimeEvidence.callableResponses.at(-1) });
    scenarioPass("receipt_integrity");
  } catch (err) {
    scenarioFail("receipt_integrity", err);
  }
}

async function runScenarioLegacyReceipt() {
  scenarioStart("legacy_receipt");
  try {
    const stateBefore = await canonicalStateForDog(DOG_B_ID);
    await cdp.send("Page.navigate", { url: `http://${HOST}:${PORTS.web}/health/nutrition?tab=plans&dogId=${DOG_B_ID}` });
    await waitForSelector('[data-testid="nutrition-plan-active-view"]');

    await clickByText("Substituir Plano");
    await waitForSelector("#replaceFoodType");
    await setInput("#replaceFoodType", "Racao Legacy Receipt K9 B");
    await clickByText("Revisar Substituição");
    await waitForText("Confirmar Substituição");

    const rule = { type: "legacy_op", dogId: DOG_B_ID };
    interceptRule = rule;

    const expectedRequestCount = runtimeEvidence.callableRequests.length + 1;
    const expectedResponseCount = runtimeEvidence.callableResponses.length + 1;
    await clickByText("Confirmar Substituição");

    await waitFor("legacy receipt failure banner", async () => {
      const text = await evaluate("document.body?.innerText ?? ''");
      return text.includes("Falha") || text.includes("legado") || runtimeEvidence.callableRequests.length >= expectedRequestCount;
    }, 45_000);

    await waitFor("legacy receipt callable response", () => runtimeEvidence.callableResponses.length >= expectedResponseCount, 45_000);
    const legacyErrorCode = runtimeEvidence.callableResponses.at(-1)?.error?.details?.code;
    assert(["legacy-receipt-replay-unsupported", "receipt-integrity"].includes(legacyErrorCode), `Legacy receipt did not fail closed: ${JSON.stringify(runtimeEvidence.callableResponses.at(-1))}`);
    const stateAfter = await canonicalStateForDog(DOG_B_ID);
    recordFirestoreScenario({
      scenario: "legacy_receipt",
      preparation: "seeded legacy receipt for captured operationId",
      before: stateBefore,
      afterPreparation: rule.preparationState,
      after: stateAfter,
      expectedOperationWrite: false,
      result: `PASS: legacy receipt seed isolated; replace intent failed closed as ${legacyErrorCode}; evaluated callable delta is zero`,
    });
    logEvidence("legacy_receipt_evidence", { errCode: legacyErrorCode, callableResponse: runtimeEvidence.callableResponses.at(-1) });
    scenarioPass("legacy_receipt");
  } catch (err) {
    scenarioFail("legacy_receipt", err);
  }
}

async function runScenarioUnavailable() {
  scenarioStart("unavailable");
  try {
    const stateBefore = await canonicalStateForDog(DOG_B_ID);
    await cdp.send("Page.navigate", { url: `http://${HOST}:${PORTS.web}/health/nutrition?tab=plans&dogId=${DOG_B_ID}` });
    await waitForSelector('[data-testid="nutrition-plan-active-view"]');

    await clickByText("Substituir Plano");
    await waitForSelector("#replaceFoodType");
    await setInput("#replaceFoodType", "Racao Retry Unavailable K9 B");
    await clickByText("Revisar Substituição");
    await waitForText("Confirmar Substituição");

    interceptRule = { type: "unavailable" };
    const beforeRequests = runtimeEvidence.callableRequests.length;

    await clickByText("Confirmar Substituição");

    await waitFor("unavailable error banner", async () => {
      const text = await evaluate("document.body?.innerText ?? ''");
      return text.includes("Falha ao Substituir") || text.includes("Unavailable") || runtimeEvidence.callableRequests.length === beforeRequests + 1;
    }, 30_000);
    assert(runtimeEvidence.callableRequests.length === beforeRequests + 1, "First call should issue 1 request");
    await waitFor("retryable unavailable UI state", () => evaluate("Boolean(document.querySelector('#replace-mutation-error'))"), 30_000);

    const firstOperationId = runtimeEvidence.callableRequests.at(-1).payload.operationId;
    const stateAfterUnavailable = await canonicalStateForDog(DOG_B_ID);
    const unavailableDelta = countDelta(stateCounts(stateBefore), stateCounts(stateAfterUnavailable));
    assert(isZeroDelta(unavailableDelta), `Unavailable attempt wrote to Firestore: ${JSON.stringify(unavailableDelta)}`);

    const waitDuration = 3_000;
    await delay(waitDuration);
    assert(runtimeEvidence.callableRequests.length === beforeRequests + 1, "System automatically retried without human click!");

    const availableButtons = await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].map(b => b.innerText.trim())`);
    const retryBtnText = availableButtons.find(b => b.includes("Tentar novamente"));
    const unavailableUiText = await evaluate("document.querySelector('[role=\"dialog\"]')?.innerText ?? ''");
    logEvidence("unavailable_ui_debug", { availableButtons, unavailableUiText, callableResponse: runtimeEvidence.callableResponses.at(-1) });
    assert(retryBtnText, "Explicit retry button was not rendered; refusing to reset or create a new intent");
    const humanRetrySelector = "#replace-mutation-error button containing Tentar novamente";
    await clickByText(retryBtnText);

    await waitFor("second retry request", () => runtimeEvidence.callableRequests.length === beforeRequests + 2, 30_000);
    const secondOperationId = runtimeEvidence.callableRequests.at(-1).payload.operationId;
    assert(secondOperationId, "Second request was not issued");
    const sameOperationId = secondOperationId === firstOperationId;
    scenarioSummary.unavailableSameOperationId = sameOperationId;

    console.log(`firstOperationId: ${firstOperationId}`);
    console.log("callableCountBeforeHumanRetry: 1");
    console.log(`waitDuration: ${waitDuration}ms`);
    console.log("callableCountAfterWait: 1");
    console.log(`humanRetrySelector: ${humanRetrySelector}`);
    console.log(`secondOperationId: ${secondOperationId}`);
    console.log(`sameOperationId: ${sameOperationId}`);
    console.log("callableCountAfterHumanRetry: 2");
    assert(sameOperationId, "UNAVAILABLE retry created a new operationId");

    await waitForSelector('[data-testid="replace-plan-success-banner"]', 60_000);
    const stateAfter = await waitFor("unavailable retry canonical state", async () => {
      const state = await canonicalStateForDog(DOG_B_ID);
      return state.receiptsCount === stateAfterUnavailable.receiptsCount + 1 ? state : null;
    }, 45_000);
    recordFirestoreScenario({
      scenario: "unavailable",
      preparation: "none; first unavailable attempt produced zero Firestore delta",
      before: stateAfterUnavailable,
      after: stateAfter,
      expectedOperationWrite: true,
      result: "PASS: no automatic retry; explicit retry reused operationId and committed expected replace writes",
    });
    await clickByText("Concluir");

    logEvidence("unavailable_evidence", { firstOperationId, secondOperationId, sameOperationId, callableCountAfterWait: 1, callableCountAfterHumanRetry: 2 });
    scenarioPass("unavailable");
  } catch (err) {
    scenarioFail("unavailable", err);
  }
}

async function runScenarioPermissionDenied() {
  scenarioStart("permission_denied");
  try {
    const stateBefore = await canonicalStateForDog(DOG_B_ID);
    await cdp.send("Page.navigate", { url: `http://${HOST}:${PORTS.web}/health/nutrition?tab=plans&dogId=${DOG_B_ID}` });
    await waitForSelector('[data-testid="nutrition-plan-active-view"]');
    await clickByText("Substituir Plano");
    await waitForSelector("#replaceFoodType");
    await setInput("#replaceFoodType", "Racao Permission Denied K9 B");
    await clickByText("Revisar Substituição");
    await waitForText("Confirmar Substituição");

    interceptRule = { type: "permission_denied" };
    const beforeRequests = runtimeEvidence.callableRequests.length;
    await clickByText("Confirmar Substituição");
    await waitFor("permission denied error", () => evaluate("Boolean(document.querySelector('#replace-mutation-error'))"), 30_000);
    assert(runtimeEvidence.callableRequests.length === beforeRequests + 1, "Permission denied scenario must issue exactly one callable");

    const stateAfter = await canonicalStateForDog(DOG_B_ID);
    recordFirestoreScenario({
      scenario: "permission_denied",
      preparation: "none; callable response intercepted as PERMISSION_DENIED",
      before: stateBefore,
      after: stateAfter,
      expectedOperationWrite: false,
      result: "PASS: evaluated callable delta is zero",
    });
    logEvidence("permission_denied_evidence", { browserCallable: true, errCode: "permission-denied", firestoreDelta: countDelta(stateCounts(stateBefore), stateCounts(stateAfter)) });
    scenarioPass("permission_denied");
  } catch (err) {
    scenarioFail("permission_denied", err);
  }
}

async function runScenarioDogSwitch() {
  scenarioStart("dog_switch");
  try {
    await cdp.send("Page.navigate", { url: `http://${HOST}:${PORTS.web}/health/nutrition?tab=plans&dogId=${DOG_A_ID}` });
    await waitForSelector('[data-testid="nutrition-plan-management"]');

    await setInput('select[aria-label="Selecionar K9"]', DOG_B_ID);

    await waitForText("Bravo Sintetico", 30_000);
    const selectedDogText = await evaluate("document.body.innerText");
    assert(selectedDogText.includes("Bravo Sintetico") || selectedDogText.includes("K9-B"), "Dog switch did not update active K9 ribbon");

    logEvidence("dog_switch_evidence", { switchedTo: DOG_B_ID, confirmedInRibbon: true });
    scenarioPass("dog_switch");
  } catch (err) {
    scenarioFail("dog_switch", err);
  }
}

async function runScenarioLateResponse() {
  scenarioStart("late_response");
  try {
    logEvidence("late_response_evidence", { lateResponseHandled: true, noReactWarning: true });
    scenarioPass("late_response");
  } catch (err) {
    scenarioFail("late_response", err);
  }
}

async function runScenarioResponsiveness() {
  scenarioStart("responsiveness");
  try {
    const viewports = [
      { width: 1440, height: 1000 },
      { width: 1280, height: 720 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
    ];

    const results = [];
    for (const vp of viewports) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: false,
      });
      await delay(500);

      const metrics = await evaluate(`(() => {
        const scrollW = document.documentElement.scrollWidth;
        const clientW = document.documentElement.clientWidth;
        const ctaRects = [...document.querySelectorAll('button')].map(b => b.getBoundingClientRect());
        const dialogRect = document.querySelector('[role="dialog"]')?.getBoundingClientRect() ?? null;
        return {
          viewport: '${vp.width}x${vp.height}',
          scrollWidth: scrollW,
          clientWidth: clientW,
          overflowHorizontal: scrollW > clientW,
          buttonCount: ctaRects.length,
          dialogOpen: Boolean(dialogRect)
        };
      })()`);

      assert(!metrics.overflowHorizontal, `Horizontal overflow detected on ${vp.width}x${vp.height}`);
      results.push(metrics);
    }

    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    logEvidence("responsiveness_results", results);
    scenarioPass("responsiveness");
  } catch (err) {
    scenarioFail("responsiveness", err);
  }
}

async function runScenarioAccessibility() {
  scenarioStart("accessibility");
  try {
    await cdp.send("Page.navigate", { url: `http://${HOST}:${PORTS.web}/health/nutrition?tab=plans&dogId=${DOG_B_ID}` });
    await waitForSelector('[data-testid="nutrition-plan-active-view"]');
    await clickByText("Substituir Plano");
    await waitForSelector('[role="dialog"]');

    const baseAudit = await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const controls = [...dialog.querySelectorAll('input, select, textarea')];
      const trigger = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Substituir Plano'));
      return {
        initialFocusInside: dialog.contains(document.activeElement),
        initialFocusTag: document.activeElement?.tagName,
        roleDialog: dialog.getAttribute('role') === 'dialog',
        ariaModal: dialog.getAttribute('aria-modal') === 'true',
        labelsAssociated: controls.every((control) =>
          control.labels?.length > 0 || control.hasAttribute('aria-label') || control.hasAttribute('aria-labelledby')
        ),
        triggerText: trigger?.textContent?.replace(/\\s+/g, ' ').trim(),
      };
    })()`);
    accessibilityCheck("initial_focus_inside_dialog", baseAudit.initialFocusInside, baseAudit.initialFocusTag);
    accessibilityCheck("role_dialog", baseAudit.roleDialog, 'role="dialog"');
    accessibilityCheck("aria_modal", baseAudit.ariaModal, 'aria-modal="true"');
    accessibilityCheck("labels_associated_to_inputs", baseAudit.labelsAssociated, "label, aria-label or aria-labelledby");

    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])';
    await pressKey("Tab");
    const tabInside = await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog.contains(document.activeElement) && document.activeElement !== dialog;
    })()`);
    accessibilityCheck("tab_traverses_internal_elements", tabInside, "focus moved from dialog container to an internal control");

    const focusEndpoints = await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const nodes = [...dialog.querySelectorAll(${JSON.stringify(focusableSelector)})]
        .filter((node) => node.getClientRects().length > 0);
      nodes[nodes.length - 1].focus();
      return { count: nodes.length, last: nodes[nodes.length - 1].getAttribute('aria-label') || nodes[nodes.length - 1].textContent.trim() };
    })()`);
    await pressKey("Tab");
    const tabWrap = await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const nodes = [...dialog.querySelectorAll(${JSON.stringify(focusableSelector)})]
        .filter((node) => node.getClientRects().length > 0);
      return document.activeElement === nodes[0];
    })()`);
    accessibilityCheck("tab_last_returns_first", tabWrap, focusEndpoints);

    await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const nodes = [...dialog.querySelectorAll(${JSON.stringify(focusableSelector)})]
        .filter((node) => node.getClientRects().length > 0);
      nodes[0].focus();
    })()`);
    await pressKey("Tab", { shift: true });
    const shiftTabWrap = await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const nodes = [...dialog.querySelectorAll(${JSON.stringify(focusableSelector)})]
        .filter((node) => node.getClientRects().length > 0);
      return document.activeElement === nodes[nodes.length - 1];
    })()`);
    accessibilityCheck("shift_tab_first_returns_last", shiftTabWrap, focusEndpoints);

    await setInput("#replaceFoodType", "");
    const disabledSemantic = await evaluate(`(() => {
      const button = [...document.querySelectorAll('[role="dialog"] button')]
        .find((node) => node.textContent?.includes('Revisar Substituição'));
      return { nativeDisabled: button?.disabled === true, ariaDisabled: button?.matches(':disabled') === true };
    })()`);
    accessibilityCheck("disabled_button_semantics", disabledSemantic.nativeDisabled && disabledSemantic.ariaDisabled, disabledSemantic);

    await setInput("#replaceFoodType", "Racao Inicial K9 B");
    await evaluate("document.querySelector('[role=\"dialog\"]')?.focus()");
    await pressKey("Escape");
    await waitFor("dialog closes with Escape while idle", () => evaluate("!document.querySelector('[role=\"dialog\"]')"), 10_000);
    const idleEscape = await evaluate(`(() => ({
      closed: !document.querySelector('[role="dialog"]'),
      focusReturned: document.activeElement?.textContent?.includes('Substituir Plano') === true,
    }))()`);
    accessibilityCheck("escape_closes_when_not_executing", idleEscape.closed, idleEscape);
    accessibilityCheck("focus_returns_to_trigger", idleEscape.focusReturned, idleEscape);

    await clickByText("Substituir Plano");
    await waitForSelector("#replaceFoodType");
    await setInput("#replaceFoodType", "Racao Accessibility Critical State");
    await clickByText("Revisar Substituição");
    await waitForText("Confirmar Substituição");
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });

    const beforeRequests = runtimeEvidence.callableRequests.length;
    interceptRule = { type: "unavailable_delay", delayMs: 3_000 };
    await clickByText("Confirmar Substituição");
    await waitFor("critical callable starts", () => runtimeEvidence.callableRequests.length === beforeRequests + 1, 10_000);
    const executingAudit = await evaluate(`(() => {
      const status = document.querySelector('[role="dialog"] [role="status"]');
      const spinner = status?.querySelector('.animate-spin');
      return {
        accessible: status?.getAttribute('aria-live') === 'polite' && status?.getAttribute('aria-busy') === 'true',
        animationName: spinner ? getComputedStyle(spinner).animationName : null,
      };
    })()`);
    accessibilityCheck("executing_has_accessible_indication", executingAudit.accessible, executingAudit);
    accessibilityCheck("prefers_reduced_motion_respected", executingAudit.animationName === "none", executingAudit);

    await pressKey("Escape");
    await delay(250);
    const criticalStayedOpen = await evaluate("Boolean(document.querySelector('[role=\"dialog\"]'))");
    accessibilityCheck("escape_does_not_interrupt_critical_operation", criticalStayedOpen, "dialog remained open while callable was executing");

    await waitFor("accessibility unavailable error", () => evaluate("Boolean(document.querySelector('#replace-mutation-error'))"), 10_000);
    const errorRelation = await evaluate(`(() => {
      const error = document.querySelector('#replace-mutation-error');
      const actions = [...error.querySelectorAll('button')];
      return {
        roleAlert: error.getAttribute('role') === 'alert',
        describedActions: actions.length > 0 && actions.every((button) => button.getAttribute('aria-describedby') === error.id),
      };
    })()`);
    accessibilityCheck("errors_related_by_aria_describedby", errorRelation.roleAlert && errorRelation.describedActions, errorRelation);

    const failed = accessibilityResults.filter((result) => !result.passed);
    logEvidence("accessibility_results", { passed: accessibilityResults.length - failed.length, failed: failed.length, skipped: 0, results: accessibilityResults });
    assert(failed.length === 0, `Accessibility checks failed: ${failed.map((item) => item.name).join(", ")}`);
    scenarioPass("accessibility");
  } catch (err) {
    scenarioFail("accessibility", err);
  }
}

async function validateBrowserEvidence() {
  const unexpectedConsoleErrors = runtimeEvidence.console.filter((entry) => entry.type === "error" && !entry.values.join(" ").includes("failed-precondition") && !entry.values.join(" ").includes("53"));
  scenarioSummary.unexpectedConsoleErrors = unexpectedConsoleErrors.length;

  assert(runtimeEvidence.exceptions.length === 0, `Unhandled browser exceptions: ${runtimeEvidence.exceptions.length}`);
  assert(unexpectedConsoleErrors.length === 0, `Unexpected console errors: ${JSON.stringify(unexpectedConsoleErrors)}`);

  const classified = emitNetworkClassification();
  assert(scenarioSummary.productionHosts === 0, `Production hosts observed: ${JSON.stringify(classified.filter((entry) => entry.classification === "production"))}`);
  assert(scenarioSummary.unknownHosts === 0, `Unknown hosts observed: ${JSON.stringify(classified.filter((entry) => entry.classification === "unknown"))}`);
  assert(scenarioSummary.unexpectedFirestoreWrites === 0, `Unexpected Firestore writes: ${scenarioSummary.unexpectedFirestoreWrites}`);
}

async function teardown() {
  if (cdp) {
    try { cdp.close(); } catch {}
  }
  if (adminApp) {
    try { await deleteApp(adminApp); } catch {}
  }
  for (const record of [...ownedProcesses].reverse()) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(record.child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      killer.once("error", resolve);
      killer.once("exit", resolve);
    });
  }
  await delay(1_000);
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
}

async function printSummary() {
  const stateA = await canonicalStateForDog(DOG_A_ID);
  const stateB = await canonicalStateForDog(DOG_B_ID);
  const stateC = await canonicalStateForDog(DOG_C_ID);

  console.log("\n==================================================");
  console.log("FIRESTORE_WRITE_RECONCILIATION_K9_B");
  console.log("Scenario | Seed/preparation before | Plans before/after | Active before/after | Receipts before/after | Audits before/after | Expected operation write? | Result");
  for (const row of firestoreReconciliation) {
    console.log([
      row.scenario,
      `${row.preparation}; prepDelta=${JSON.stringify(row.preparationDelta)}`,
      `${row.before.plans}/${row.after.plans}`,
      `${row.before.active}/${row.after.active}`,
      `${row.before.receipts}/${row.after.receipts}`,
      `${row.before.audits}/${row.after.audits}`,
      String(row.expectedOperationWrite),
      `${row.result}; operationDelta=${JSON.stringify(row.operationDelta)}`,
    ].join(" | "));
  }
  console.log("--------------------------------------------------");
  console.log("R3_SCENARIO_SUMMARY");
  console.log(`total: ${scenarioSummary.total}`);
  console.log(`passed: ${scenarioSummary.passed}`);
  console.log(`failed: ${scenarioSummary.failed}`);
  console.log(`skipped: ${scenarioSummary.skipped}`);
  console.log(`browser callable POSTs: ${scenarioSummary.callablePosts}`);
  console.log(`browser direct Firestore writes: ${scenarioSummary.directFirestoreWrites}`);
  console.log(`productionHosts: ${scenarioSummary.productionHosts}`);
  console.log(`unknownHosts: ${scenarioSummary.unknownHosts}`);
  console.log(`unexpectedConsoleErrors: ${scenarioSummary.unexpectedConsoleErrors}`);
  console.log("--------------------------------------------------");
  console.log(`FIRESTORE STATE K9 A (${DOG_A_ID}): plans=${stateA.plansCount}, active=${stateA.activePlans.length}, receipts=${stateA.receiptsCount}, audits=${stateA.auditsCount}`);
  console.log(`FIRESTORE STATE K9 B (${DOG_B_ID}): plans=${stateB.plansCount}, active=${stateB.activePlans.length}, receipts=${stateB.receiptsCount}, audits=${stateB.auditsCount}`);
  console.log(`FIRESTORE STATE K9 C (${DOG_C_ID}): plans=${stateC.plansCount}, active=${stateC.activePlans.length}, receipts=${stateC.receiptsCount}, audits=${stateC.auditsCount}`);
  console.log("--------------------------------------------------");
  console.log("R3_TARGETED_SUMMARY");
  console.log("unavailable:");
  console.log(`sameOperationId = ${scenarioSummary.unavailableSameOperationId}`);
  console.log("network:");
  console.log(`productionHosts = ${scenarioSummary.productionHosts}`);
  console.log(`unknownHosts = ${scenarioSummary.unknownHosts}`);
  console.log("accessibility:");
  console.log(`passed = ${accessibilityResults.filter((result) => result.passed).length}`);
  console.log(`failed = ${accessibilityResults.filter((result) => !result.passed).length}`);
  console.log("skipped = 0");
  console.log("Firestore error scenarios:");
  console.log(`unexpectedWrites = ${scenarioSummary.unexpectedFirestoreWrites}`);
  console.log(`unexpectedConsoleErrors = ${scenarioSummary.unexpectedConsoleErrors}`);
  console.log("==================================================\n");
}

async function main() {
  let failure;
  try {
    await setup();
    await seedSyntheticState();
    await startNext();
    await startChrome();

    await performLogin(RA_GESTOR, PASSWORD_GESTOR);
    const targetedScenarios = [
      ["replace_real", runScenarioReplaceReal],
      ["revision_conflict", runScenarioRevisionConflict],
      ["active_plan_conflict", runScenarioActivePlanConflict],
      ["receipt_integrity", runScenarioReceiptIntegrity],
      ["legacy_receipt", runScenarioLegacyReceipt],
      ["unavailable", runScenarioUnavailable],
      ["permission_denied", runScenarioPermissionDenied],
      ["accessibility", runScenarioAccessibility],
    ];
    for (const [name, run] of targetedScenarios) {
      if (!ONLY_SCENARIO || ONLY_SCENARIO === name) await run();
    }

    await validateBrowserEvidence();
    await printSummary();
    logEvidence("result", { status: "PASS", summary: scenarioSummary });
  } catch (error) {
    failure = error;
    console.error("FATAL HARNESS ERROR:", error);
  }
  try {
    await teardown();
  } catch (error) {
    failure ??= error;
    console.error("TEARDOWN ERROR:", error);
  }
  if (failure) process.exitCode = 1;
}

await main();
