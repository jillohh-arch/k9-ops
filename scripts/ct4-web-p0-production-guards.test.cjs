#!/usr/bin/env node
/**
 * CT4 WEB-P0 — tests for the production release guards.
 *
 * Gate: CT4.WEB-P0.PRODUCTION-GUARD-AND-CANDIDATE-BUILD-R2
 * Coverage map to the dispatch's matrix:
 *   N1 correct production passes
 *   N2 shell env selecting staging fails even with a correct production file
 *   N3 contradictory/unexpected .env.local fails before build
 *   N4 missing/inconsistent tuple or unexpected target fails
 *   N5 inactive staging object/string does NOT false-positive
 *   N6 contaminated artifact / Warehouse route fails
 *   N7 stale bundle, divergent buildId, absent or ambiguous output fails
 *   N8 guards are actually wired into CI and Hosting, in PRE-BUILD ->
 *      POST-BUILD -> PRE-PUBLISH order
 *
 * Runs under `node --test` (no dependency beyond Node itself), so it is
 * executable in a bare worktree without `npm ci`. Every fixture is created in
 * a fresh temporary directory; the candidate tree is never written to.
 */

"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const envGuard = require("./ct4-web-p0-production-env-guard.cjs");
const bundleGuard = require("./ct4-web-p0-production-bundle-guard.cjs");

const REPO_ROOT = path.resolve(__dirname, "..");
const ENV_GUARD = path.join(__dirname, "ct4-web-p0-production-env-guard.cjs");
const BUNDLE_GUARD = path.join(__dirname, "ct4-web-p0-production-bundle-guard.cjs");

const PRODUCTION_ENV = {
  NEXT_PUBLIC_APP_ENV: "production",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "canil-gcm",
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyAQKCu-UOQQFiRfq-Slahhcy985rtQBkmU",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "canil-gcm.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "canil-gcm.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "418249404282",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:418249404282:web:6c0093a341e04ef518b0c3",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-KNTKW04X7S",
};

const STAGING_ENV = {
  NEXT_PUBLIC_APP_ENV: "staging",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "k9-ops-staging",
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "k9-ops-staging.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "k9-ops-staging.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "507588808242",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:507588808242:web:89b531a8e7d358596ef62b",
};

/** A fixture checkout that mirrors the files the env guard reads. */
function makeFixture(options) {
  const opts = options || {};
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ct4-env-guard-"));
  fs.mkdirSync(path.join(root, "src", "lib", "firebase"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "lib", "firebase", "config.ts"),
    fs.readFileSync(path.join(REPO_ROOT, "src", "lib", "firebase", "config.ts")),
  );
  if (opts.firebaserc !== null) {
    fs.writeFileSync(
      path.join(root, ".firebaserc"),
      JSON.stringify({ projects: { default: opts.firebaserc || "canil-gcm" } }),
    );
  }
  if (opts.firebaseJson !== null) {
    fs.writeFileSync(
      path.join(root, "firebase.json"),
      JSON.stringify({ hosting: { site: opts.hostingSite || "canil-gcm", source: ".", rewrites: [] } }),
    );
  }
  for (const [layer, values] of Object.entries(opts.envFiles || {})) {
    const body = Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    fs.writeFileSync(path.join(root, layer), `${body}\n`);
  }
  return root;
}

/**
 * Give a Firebase site the build-id layout the CLI really produces:
 * `<site>/hosting/_next/static/<id>/` and `<site>/functions/.next/BUILD_ID`.
 *
 * Measured on the two real `.firebase/<site>` trees in this workspace; see the
 * R4 evidence pack. Passing different ids to the two surfaces reproduces a
 * hosting tree left over from another build.
 */
function stampBuildId(root, site, hostingId, functionsId) {
  const hostingBuild = hostingId || "build-abc123";
  const functionsBuild = functionsId || hostingBuild;
  fs.mkdirSync(path.join(site, "hosting", "_next", "static", hostingBuild), { recursive: true });
  fs.mkdirSync(path.join(site, "hosting", "_next", "static", "chunks"), { recursive: true });
  fs.mkdirSync(path.join(site, "functions", ".next"), { recursive: true });
  fs.writeFileSync(path.join(site, "functions", ".next", "BUILD_ID"), `${functionsBuild}\n`);
  // R4 topology: a genuine build-id directory carries a signature marker, the
  // Functions static anchor mirrors the BUILD_ID, and both rooted manifests
  // carry the (root) basePath the guard reconciles.
  fs.writeFileSync(path.join(site, "hosting", "_next", "static", hostingBuild, "_buildManifest.js"), "x");
  fs.mkdirSync(path.join(site, "functions", ".next", "static", functionsBuild), { recursive: true });
  fs.writeFileSync(path.join(site, "functions", ".next", "static", functionsBuild, "_buildManifest.js"), "x");
  fs.writeFileSync(path.join(site, "functions", ".next", "routes-manifest.json"), JSON.stringify({ basePath: "/" }));
  fs.writeFileSync(
    path.join(site, "functions", ".next", "required-server-files.json"),
    JSON.stringify({ config: { basePath: "/" } }),
  );
  // A real upload tree carries the compiled client chunk inside the hosting
  // tree. Without it the delivered surfaces hold no env-selection object and
  // the guard correctly refuses with E_IDENTITY_NOT_PROVEN — which would test
  // the fixture, not the guard.
  const compiled = path.join(root, ".next", "static", "chunks", "main.js");
  if (fs.existsSync(compiled)) {
    fs.copyFileSync(compiled, path.join(site, "hosting", "_next", "static", "chunks", "main.js"));
  }
}

function runGuardCli(script, args) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status, stdout: `${error.stdout || ""}${error.stderr || ""}` };
  }
}

function expectBundleFailure(fn, code) {
  let thrown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(
    thrown instanceof bundleGuard.BundleGuardFailure,
    `expected BundleGuardFailure ${code}, got ${thrown === undefined ? "no failure" : thrown.stack}`,
  );
  assert.equal(thrown.code, code);
  return thrown;
}

function expectFailure(fn, code) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof envGuard.GuardFailure, `expected GuardFailure, got ${error}`);
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`expected GuardFailure ${code}, but the guard passed`);
}

// ---------------------------------------------------------------- env guard

test("N1: correct production identity passes pre-build", () => {
  const root = makeFixture();
  const report = envGuard.runEnvGuard({ root, shellEnv: PRODUCTION_ENV });
  assert.equal(report.result, "PASS");
  assert.equal(report.projectId, "canil-gcm");
  assert.equal(report.selector, "production");
  assert.equal(report.target.firebasercDefault, "canil-gcm");
  assert.equal(report.target.hostingSite, "canil-gcm");
});

test("N2: shell env selecting staging fails even when a correct production file exists", () => {
  const root = makeFixture({ envFiles: { ".env.production": PRODUCTION_ENV } });
  const shellEnv = { ...PRODUCTION_ENV, ...STAGING_ENV };
  const error = expectFailure(
    () => envGuard.runEnvGuard({ root, shellEnv }),
    "E_ENV_SELECTOR_INVALID",
  );
  assert.equal(error.detail.provenance, "process-env");
});

test("N2b: shell env pinned to the staging project under a production selector fails", () => {
  const root = makeFixture({ envFiles: { ".env.production": PRODUCTION_ENV } });
  const shellEnv = { ...PRODUCTION_ENV, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "k9-ops-staging" };
  expectFailure(() => envGuard.runEnvGuard({ root, shellEnv }), "E_PROJECT_MISMATCH");
});

test("N3: contradictory .env.local fails before build in CI posture", () => {
  const root = makeFixture({
    envFiles: { ".env.production": PRODUCTION_ENV, ".env.local": STAGING_ENV },
  });
  expectFailure(
    () => envGuard.runEnvGuard({ root, shellEnv: PRODUCTION_ENV, forbidLocalEnv: true }),
    "E_LOCAL_ENV_FORBIDDEN",
  );
});

test("N3b: an unexpected shell-supplied .env.local is rejected even when it is production", () => {
  const root = makeFixture({ envFiles: { ".env.local": PRODUCTION_ENV } });
  expectFailure(
    () => envGuard.runEnvGuard({ root, shellEnv: PRODUCTION_ENV, forbidLocalEnv: true }),
    "E_LOCAL_ENV_FORBIDDEN",
  );
});

test("N3c: outside CI, a shadowed .env.local is a warning, not a false failure", () => {
  const root = makeFixture({ envFiles: { ".env.local": STAGING_ENV } });
  const report = envGuard.runEnvGuard({
    root,
    shellEnv: PRODUCTION_ENV,
    forbidLocalEnv: false,
  });
  assert.equal(report.result, "PASS");
  assert.ok(report.warnings.some((w) => w.code === "W_SHADOWED_ENV_FILE"));
});

test("N3d: NODE_ENV=test cannot hide a stray .env.local from the guard", () => {
  // Next.js skips .env.local under NODE_ENV=test. If the guard inherited the
  // ambient NODE_ENV, setting it to `test` would make an unexpected .env.local
  // invisible — a one-variable bypass of E_LOCAL_ENV_FORBIDDEN.
  const root = makeFixture({ envFiles: { ".env.local": STAGING_ENV } });
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    expectFailure(
      () => envGuard.runEnvGuard({ root, shellEnv: PRODUCTION_ENV, forbidLocalEnv: true }),
      "E_LOCAL_ENV_FORBIDDEN",
    );
    const env = envGuard.loadEffectiveEnv({ root, shellEnv: PRODUCTION_ENV });
    assert.ok(
      env.present.some((entry) => entry.layer === ".env.local"),
      "guard must still read .env.local regardless of ambient NODE_ENV",
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("CHECKER-1: colon syntax in a dotenv file is parsed like dotenv does", () => {
  // dotenv 16.x accepts `KEY: value`. A parser that only knows `KEY=value`
  // would miss a staging override written in colon form and PASS while the
  // real build selects staging.
  const parsed = envGuard.parseEnvFile(
    "NEXT_PUBLIC_APP_ENV: staging\nNEXT_PUBLIC_FIREBASE_PROJECT_ID: k9-ops-staging\n",
  );
  assert.equal(parsed.NEXT_PUBLIC_APP_ENV, "staging");
  assert.equal(parsed.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "k9-ops-staging");
});

test("CHECKER-1b: colon-form staging in .env.production is caught, not bypassed", () => {
  const root = makeFixture({
    envFiles: {
      ".env": PRODUCTION_ENV,
    },
  });
  // Write .env.production in colon form with a staging selector.
  fs.writeFileSync(
    path.join(root, ".env.production"),
    "NEXT_PUBLIC_APP_ENV: staging\nNEXT_PUBLIC_FIREBASE_PROJECT_ID: k9-ops-staging\n",
  );
  expectFailure(() => envGuard.runEnvGuard({ root, shellEnv: {} }), "E_ENV_SELECTOR_INVALID");
});

test("CHECKER-1c: colon-form production is accepted, matching dotenv", () => {
  const root = makeFixture();
  const colon = Object.entries(PRODUCTION_ENV)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  fs.writeFileSync(path.join(root, ".env.production"), `${colon}\n`);
  const report = envGuard.runEnvGuard({ root, shellEnv: {} });
  assert.equal(report.result, "PASS");
  assert.equal(report.selector, "production");
});

test("CHECKER-1d: a lone CR is a line separator, exactly as dotenv treats it", () => {
  // dotenv 16.3.1 does `contents.replace(/\r\n?/gm, "\n")` before matching.
  // A guard splitting on /\r?\n/ sees the staging block as one comment line and
  // misses it — PASSING while the build selects staging. Last assignment wins,
  // so the staging tuple must come LAST for the bypass to bite.
  const root = makeFixture();
  const productionBlock = Object.entries(PRODUCTION_ENV)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const stagingBlock = Object.entries(STAGING_ENV)
    .map(([k, v]) => `${k}=${v}`)
    .join("\r");
  fs.writeFileSync(path.join(root, ".env.production"), `${productionBlock}\n#${stagingBlock}\n`);

  // dotenv treats the text after the lone CR as separate lines: the `#` line
  // itself stays a comment (so APP_ENV keeps production), but every field
  // after the CR is read — and is staging.
  const parsed = envGuard.parseEnvFile(fs.readFileSync(path.join(root, ".env.production"), "utf8"));
  assert.equal(parsed.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "k9-ops-staging");

  // The guard must refuse. A naive splitter would have seen one comment line
  // and PASSED on the production tuple alone. Which refusal fires depends on
  // check order (project is asserted before the remaining fields); both are
  // fail-closed, so accept either.
  const error = (() => {
    try {
      envGuard.runEnvGuard({ root, shellEnv: {} });
      return undefined;
    } catch (thrown) {
      return thrown;
    }
  })();
  assert.ok(error instanceof envGuard.GuardFailure, "guard must refuse a CR-smuggled staging tuple");
  assert.ok(
    ["E_PROJECT_MISMATCH", "E_IDENTITY_MISMATCH"].includes(error.code),
    `unexpected code ${error.code}`,
  );
});

test("CHECKER-1d2: the same CR file WITHOUT staging still passes (no false positive)", () => {
  const root = makeFixture();
  const productionBlock = Object.entries(PRODUCTION_ENV)
    .map(([k, v]) => `${k}=${v}`)
    .join("\r");
  fs.writeFileSync(path.join(root, ".env.production"), `${productionBlock}\n`);
  const report = envGuard.runEnvGuard({ root, shellEnv: {} });
  assert.equal(report.result, "PASS");
  assert.equal(report.selector, "production");
});

test("CHECKER-1e: `KEY:value` without a space is NOT a separator, matching dotenv", () => {
  // dotenv requires `:\s+`. The guard must not accept a form dotenv ignores,
  // or its tests would encode a grammar the build does not have.
  const parsed = envGuard.parseEnvFile("NEXT_PUBLIC_APP_ENV:staging\n");
  assert.equal(parsed.NEXT_PUBLIC_APP_ENV, undefined);
});

test("CHECKER-1f: parser agrees with dotenv 16.3.1 on a battery of inputs", () => {
  const cases = [
    "A=1\nB=2\n",
    "export A=1\n",
    "A: 1\n",
    "A='quoted value'\n",
    'A="double"\n',
    "A=bare # trailing comment\n",
    "A=\n",
    "# comment only\n",
    "A=1\r\nB=2\r\n",
    "A=1\rB=2\r",
    "A:1\n",
    "A = 1\n",
  ];
  // Expected results were produced by dotenv 16.3.1 parse() itself.
  const expected = [
    { A: "1", B: "2" },
    { A: "1" },
    { A: "1" },
    { A: "quoted value" },
    { A: "double" },
    { A: "bare" },
    { A: "" },
    {},
    { A: "1", B: "2" },
    { A: "1", B: "2" },
    {},
    { A: "1" },
  ];
  cases.forEach((input, index) => {
    // Compare as plain objects: the guard returns a null-prototype map.
    assert.deepEqual(
      { ...envGuard.parseEnvFile(input) },
      expected[index],
      `input #${index}: ${JSON.stringify(input)}`,
    );
  });
});

test("N4f: a missing .firebaserc is unreadable, not 'no constraint'", () => {
  const root = makeFixture({ firebaserc: null });
  expectFailure(() => envGuard.runEnvGuard({ root, shellEnv: PRODUCTION_ENV }), "E_TARGET_UNREADABLE");
});

test("N4g: a missing firebase.json is unreadable, not 'no constraint'", () => {
  const root = makeFixture({ firebaseJson: null });
  expectFailure(() => envGuard.runEnvGuard({ root, shellEnv: PRODUCTION_ENV }), "E_TARGET_UNREADABLE");
});

test("N4h: a corrupted firebase.json fails closed instead of skipping the target check", () => {
  const root = makeFixture();
  fs.writeFileSync(path.join(root, "firebase.json"), "{ this is not json");
  expectFailure(() => envGuard.runEnvGuard({ root, shellEnv: PRODUCTION_ENV }), "E_TARGET_UNREADABLE");
});

test("N4i: hosting declared as an array is unproven, so it fails closed", () => {
  const root = makeFixture();
  fs.writeFileSync(
    path.join(root, "firebase.json"),
    JSON.stringify({ hosting: [{ site: "canil-gcm" }, { site: "other-site" }] }),
  );
  expectFailure(() => envGuard.runEnvGuard({ root, shellEnv: PRODUCTION_ENV }), "E_TARGET_UNREADABLE");
});

test("N4: missing tuple fails", () => {
  const root = makeFixture();
  const partial = { ...PRODUCTION_ENV };
  delete partial.NEXT_PUBLIC_FIREBASE_APP_ID;
  expectFailure(() => envGuard.runEnvGuard({ root, shellEnv: partial }), "E_TUPLE_MISSING");
});

test("N4b: absent selector fails (no default)", () => {
  const root = makeFixture();
  const partial = { ...PRODUCTION_ENV };
  delete partial.NEXT_PUBLIC_APP_ENV;
  expectFailure(() => envGuard.runEnvGuard({ root, shellEnv: partial }), "E_TUPLE_MISSING");
});

test("N4c: hybrid identity fails", () => {
  const root = makeFixture();
  const hybrid = { ...PRODUCTION_ENV, NEXT_PUBLIC_FIREBASE_API_KEY: STAGING_ENV.NEXT_PUBLIC_FIREBASE_API_KEY };
  expectFailure(() => envGuard.runEnvGuard({ root, shellEnv: hybrid }), "E_IDENTITY_MISMATCH");
});

test("N4d: unexpected Firebase target fails", () => {
  const root = makeFixture({ firebaserc: "k9-ops-staging" });
  expectFailure(() => envGuard.runEnvGuard({ root, shellEnv: PRODUCTION_ENV }), "E_TARGET_MISMATCH");
});

test("N4e: unexpected Hosting site fails", () => {
  const root = makeFixture({ hostingSite: "k9-ops-staging" });
  expectFailure(() => envGuard.runEnvGuard({ root, shellEnv: PRODUCTION_ENV }), "E_TARGET_MISMATCH");
});

test("N5: an inactive staging object in source does not false-positive", () => {
  // The real config.ts embeds the whole staging tuple as an inactive branch.
  const root = makeFixture({ envFiles: { ".env.production": PRODUCTION_ENV } });
  const report = envGuard.runEnvGuard({ root, shellEnv: {} });
  assert.equal(report.result, "PASS");
  assert.equal(report.projectId, "canil-gcm");
});

test("N5b: fixture proves the staging tuple really is present in config.ts (so N5 is meaningful)", () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, "src", "lib", "firebase", "config.ts"), "utf8");
  assert.ok(source.includes("k9-ops-staging"), "fixture assumption: inactive staging identity exists");
});

test("drift: guard refuses when its canonical constants diverge from config.ts", () => {
  const root = makeFixture();
  const configPath = path.join(root, "src", "lib", "firebase", "config.ts");
  const original = fs.readFileSync(configPath, "utf8");
  // Rotate only the production authDomain: the identity changed, the guard's
  // embedded constant did not.
  fs.writeFileSync(configPath, original.replace("canil-gcm.firebaseapp.com", "canil-gcm2.firebaseapp.com"));
  expectFailure(() => envGuard.assertCanonicalTupleMatchesSource(root), "E_DRIFT");
});

test("precedence: .env.production.local outranks .env.production; shell outranks all", () => {
  const root = makeFixture({
    envFiles: {
      ".env.production": STAGING_ENV,
      ".env.production.local": PRODUCTION_ENV,
    },
  });
  const fromFiles = envGuard.runEnvGuard({ root, shellEnv: {} });
  assert.equal(fromFiles.provenance.NEXT_PUBLIC_APP_ENV, ".env.production.local");

  const fromShell = envGuard.runEnvGuard({ root, shellEnv: PRODUCTION_ENV });
  assert.equal(fromShell.provenance.NEXT_PUBLIC_APP_ENV, "process-env");
});

test("precedence: .env.local contradicts .env.production and wins by Next.js rules", () => {
  const root = makeFixture({
    envFiles: { ".env.production": PRODUCTION_ENV, ".env.local": STAGING_ENV },
  });
  const report = envGuard.loadEffectiveEnv({ root, shellEnv: {}, nodeEnv: "production" });
  assert.equal(report.resolved.NEXT_PUBLIC_APP_ENV, "staging");
  assert.equal(report.provenance.NEXT_PUBLIC_APP_ENV, ".env.local");
});

test("N8: env guard CLI exits 1 and prints no secret value", () => {
  const root = makeFixture();
  // Strip inherited NEXT_PUBLIC_* from process.env so this test is green
  // regardless of whether the CI job sets them at job level. The guard must
  // fail on a fixture with no env; inheriting the job's production tuple
  // would make it pass and mask the absence check.
  const saved = {};
  const keys = Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_"));
  for (const k of keys) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  try {
    const result = runGuardCli(ENV_GUARD, ["--root", root, "--json"]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /E_TUPLE_MISSING/);
    assert.ok(!result.stdout.includes(PRODUCTION_ENV.NEXT_PUBLIC_FIREBASE_API_KEY));
    assert.ok(!result.stdout.includes(STAGING_ENV.NEXT_PUBLIC_FIREBASE_API_KEY));
  } finally {
    for (const [k, v] of Object.entries(saved)) process.env[k] = v;
  }
});

// ------------------------------------------------------------- bundle guard


/** A full STAGING env-selection object, the shape the resolver really receives. */
const STAGING_SELECTION_OBJECT = `resolver({${[
  'NEXT_PUBLIC_APP_ENV:"staging"',
  'NEXT_PUBLIC_FIREBASE_API_KEY:"AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo"',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:"k9-ops-staging.firebaseapp.com"',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID:"k9-ops-staging"',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:"k9-ops-staging.firebasestorage.app"',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:"507588808242"',
  'NEXT_PUBLIC_FIREBASE_APP_ID:"1:507588808242:web:89b531a8e7d358596ef62b"',
].join(",")}})`;

/** A staging object that shares production's fields but swaps one value. */
function stagingSelectionWith(overrides) {
  const base = {
    NEXT_PUBLIC_APP_ENV: "production",
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyAQKCu-UOQQFiRfq-Slahhcy985rtQBkmU",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "canil-gcm.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "canil-gcm",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "canil-gcm.firebasestorage.app",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "418249404282",
    NEXT_PUBLIC_FIREBASE_APP_ID: "1:418249404282:web:6c0093a341e04ef518b0c3",
    ...overrides,
  };
  const entries = Object.entries(base).map(([k, v]) => `${k}:"${v}"`).join(",");
  return `resolver({${entries}})`;
}

/** The inlined production env values a correct build emits. */
const PRODUCTION_INLINED = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyAQKCu-UOQQFiRfq-Slahhcy985rtQBkmU",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "canil-gcm.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "canil-gcm",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "canil-gcm.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "418249404282",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:418249404282:web:6c0093a341e04ef518b0c3",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-KNTKW04X7S",
};

/** Build a fake compiled Next output. */
function makeBundleFixture(options) {
  const opts = options || {};
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ct4-bundle-guard-"));
  const nextDir = path.join(root, ".next");
  fs.mkdirSync(path.join(nextDir, "server", "app"), { recursive: true });
  fs.mkdirSync(path.join(nextDir, "static", "chunks"), { recursive: true });

  if (opts.buildId !== null) {
    fs.writeFileSync(path.join(nextDir, "BUILD_ID"), `${opts.buildId || "build-abc123"}\n`);
  }
  fs.writeFileSync(
    path.join(nextDir, "server", "app-paths-manifest.json"),
    JSON.stringify(Object.fromEntries((opts.routes || ["/page"]).map((route) => [route, "x.js"]))),
  );

  // Emit the inlined-env discriminator exactly as Next.js writes it.
  // Both identity tuples are always in source (config.ts embeds them), so
  // marker presence is NOT a discriminator — only NEXT_PUBLIC_APP_ENV:"..." is.
  // Mirror real Next output: the resolver is invoked with the WHOLE env bundle
  // as one flat object literal, and the canonical object keeps BOTH tuples as
  // bare (unprefixed) source literals.
  const envValue = opts.markers === "staging" ? "staging" : opts.markers === "none" ? null : "production";
  const identity = opts.identity || PRODUCTION_INLINED;
  const envObject = envValue
    ? `resolver({${[`NEXT_PUBLIC_APP_ENV:"${envValue}"`, ...Object.entries(identity).map(([k, v]) => `${k}:"${v}"`)].join(",")}})`
    : "";
  const body = [
    envObject,
    'const EXPECTED={staging:{projectId:"k9-ops-staging"},production:{projectId:"canil-gcm"}};',
    opts.extraChunk || "",
  ]
    .filter(Boolean)
    .join("\n");
  fs.writeFileSync(path.join(nextDir, "static", "chunks", "main.js"), body);

  if (opts.source) {
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "page.tsx"), "export default function Page(){return null}");
  }
  if (opts.staleSource) {
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "page.tsx"), "export default function Page(){return null}");
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(path.join(root, "src", "page.tsx"), future, future);
    const past = new Date(Date.now() - 3_600_000);
    fs.utimesSync(nextDir, past, past);
  }
  return root;
}

test("N1b: clean production-compiled artifact passes post-build", () => {
  const root = makeBundleFixture();
  const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(report.result, "PASS");
  assert.deepEqual(report.buildIds, ["build-abc123"]);
  assert.equal(report.warehouseHits, 0);
});

test("N5c: both identity tuples in source do not false-positive", () => {
  // config.ts embeds BOTH tuples, so every real build contains the staging
  // strings. Presence therefore proves nothing; POSITION does. The inactive
  // branch must be recognised as canonical, the keyed values must all be
  // production, and nothing may be reported as injected.
  const root = makeBundleFixture({ buildId: "b1" });
  const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(report.result, "PASS");
  assert.equal(report.identitySelection.verdict, "production");
  assert.equal(report.identitySelection.selectionObjects, 1);
  // Restored strength: the artefacts that would prove an injection are absent.
  assert.deepEqual(report.identitySelection.keyedViolations, []);
  assert.deepEqual(report.identitySelection.injectedFieldNameTuples, []);
  assert.ok(
    report.identitySelection.canonicalFieldNameTuples > 0,
    "the inactive canonical staging branch must still be recognised, not merely tolerated",
  );
  // Both marker sets are present (proving they are not the criterion).
  assert.ok(report.identitySelection.productionMarkers.length > 0);
  assert.ok(report.identitySelection.stagingMarkers.length > 0);
});

test("N5d: no active identity marker at all fails closed", () => {
  // Restored coverage: the R3 rewrite deleted this test and kept only the
  // "no object" case. The property it guarded is that an artifact carrying NO
  // identity signal whatsoever is refused instead of being assumed safe.
  const root = makeBundleFixture({ markers: "none" });
  expectBundleFailure(
    () => bundleGuard.runBundleGuard({ root, stage: "post-build" }),
    "E_IDENTITY_NOT_PROVEN",
  );
});

test("N5d3: no env-selection object at all fails closed as NOT_PROVEN", () => {
  // Without a selection object the guard cannot prove the identity, so it must
  // refuse rather than infer from stray literals.
  const root = makeBundleFixture({ markers: "none" });
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_NOT_PROVEN");
});

test("N5d2: a partial staging tuple with no production tuple fails closed (not a silent pass)", () => {
  const root = makeBundleFixture({ markers: "none" });
  fs.appendFileSync(
    path.join(root, ".next", "static", "chunks", "main.js"),
    `\nconst a="${bundleGuard.STAGING_MARKERS.authDomain}";\n`,
  );
  try {
    bundleGuard.runBundleGuard({ root, stage: "post-build" });
    assert.fail("expected failure");
  } catch (error) {
    assert.ok(error instanceof bundleGuard.BundleGuardFailure, String(error));
    assert.ok(
      ["E_IDENTITY_NOT_PROVEN", "E_STAGING_SELECTION_INLINED"].includes(error.code),
      `unexpected code ${error.code}`,
    );
  }
});

test("CHECKER-2: a hybrid artifact (production selector, staging apiKey) fails", () => {
  // The selector says production but one inlined field came from staging.
  // Marker-presence logic missed this; inlined-value comparison must catch it.
  const root = makeBundleFixture({
    identity: {
      ...PRODUCTION_INLINED,
      NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
    },
  });
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

test("CHECKER-2b: a hybrid artifact with the staging projectId fails", () => {
  const root = makeBundleFixture({
    identity: { ...PRODUCTION_INLINED, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "k9-ops-staging" },
  });
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

test("CHECKER-2c: a later staging copy is caught even when production appears first", () => {
  // readdir order decided which occurrence won. A chunk carrying staging
  // IDENTITY LITERALS must fail regardless of file order — even when those
  // literals are not wrapped in a well-formed selection object.
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "zz-late.js"),
    [
      'NEXT_PUBLIC_FIREBASE_API_KEY:"AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo"',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID:"k9-ops-staging"',
    ].join("\n"),
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

test("CHECKER-2d: an earlier staging copy is caught even when production appears later", () => {
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "aa-early.js"),
    [
      'NEXT_PUBLIC_FIREBASE_API_KEY:"AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo"',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID:"k9-ops-staging"',
    ].join("\n"),
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

test("CHECKER-2e: a staging identity hidden in a source map is caught", () => {
  // Hosting serves .map files, and they carry the inlined env values as
  // ESCAPED JSON strings. The collector must decode that form — a single
  // staging literal inside a map is enough to condemn the artifact.
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "main.js.map"),
    JSON.stringify({
      sourcesContent: ['NEXT_PUBLIC_FIREBASE_API_KEY:"AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo"'],
    }),
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

// ---- round-3 vectors: every one of these shipped staging while the guard passed

test("CHECKER-3-B1: a chunk just over the old 8 MB cap is still inspected", () => {
  // Proves the LARGE-FILE path, not the object regex: a lone staging literal
  // past the 8 MB boundary must still be read and condemned.
  const root = makeBundleFixture();
  const filler = "/*" + "x".repeat(8 * 1024 * 1024) + "*/";
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "huge.js"),
    `${filler}\nvar NEXT_PUBLIC_FIREBASE_API_KEY:"AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo";\n`,
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

test("CHECKER-3-B2: staging apiKey with a space after the colon is caught", () => {
  const root = makeBundleFixture();
  // A lone staging literal beside a VALID production selection. Formatting
  // tolerance is the property under test: a space after the colon must not
  // hide the value from the literal scan.
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "spaced.js"),
    'NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo"',
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

test("CHECKER-3-B2b: staging apiKey behind a quoted JSON key is caught", () => {
  // Quoting tolerance: a JSON-shaped object must not hide the literal.
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "jsonkey.js"),
    '{"NEXT_PUBLIC_FIREBASE_API_KEY":"AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo"}',
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

test("CHECKER-3-B2c: staging apiKey in single quotes is caught", () => {
  // Quote-style tolerance: single quotes are the same literal as double.
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "single.js"),
    "NEXT_PUBLIC_FIREBASE_API_KEY:'AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo'",
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

test("CHECKER-3-B4: an identity under a skipped directory name is still read", () => {
  // A directory named `cache` inside .next exists in real builds and is NOT
  // excluded. A lone staging literal there must still be found.
  const root = makeBundleFixture();
  fs.mkdirSync(path.join(root, ".next", "cache"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".next", "cache", "buried.js"),
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID:"k9-ops-staging"',
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

test("CHECKER-3-B4b: an extensionless file is still read", () => {
  // No extension filter: a staging literal in a file with no suffix counts.
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "payload"),
    'NEXT_PUBLIC_FIREBASE_API_KEY:"AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo"',
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

test("CHECKER-3-B3: every encoding a bundler may emit is caught", () => {
  // Each shape ships the staging apiKey next to a clean production tuple.
  // Anchoring on `NEXT_PUBLIC_<FIELD> : <quote>` with escape-aware parsing is
  // what makes all of these visible.
  const stagingKey = "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo";
  const shapes = [
    `NEXT_PUBLIC_FIREBASE_API_KEY:'${stagingKey}'`,
    "NEXT_PUBLIC_FIREBASE_API_KEY:`" + stagingKey + "`",
    `NEXT_PUBLIC_FIREBASE_API_KEY: "${stagingKey}"`,
    `NEXT_PUBLIC_FIREBASE_API_KEY:\n"${stagingKey}"`,
    `"NEXT_PUBLIC_FIREBASE_API_KEY":"${stagingKey}"`,
    `NEXT_PUBLIC_FIREBASE_API_KEY:\\"${stagingKey}\\"`,
    `NEXT_PUBLIC_FIREBASE_API_KEY:\\\\"${stagingKey}\\\\"`,
    `NEXT_PUBLIC_FIREBASE_API_KEY/**/:"${stagingKey}"`,
    `process.env["NEXT_PUBLIC_FIREBASE_API_KEY"]="${stagingKey}"`,
    `NEXT_PUBLIC_FIREBASE_API_KEY:"${stagingKey.slice(0, -1)}\\u006f"`,
    `NEXT_PUBLIC_FIREBASE_API_KEY:"${stagingKey.slice(0, -1)}\\x6f"`,
  ];
  for (const shape of shapes) {
    const root = makeBundleFixture();
    fs.writeFileSync(path.join(root, ".next", "static", "chunks", "variant.js"), shape);
    expectBundleFailure(
      () => bundleGuard.runBundleGuard({ root, stage: "post-build" }),
      "E_IDENTITY_MISMATCH",
    );
  }
});

test("CHECKER-4-D2b: an identity in a binary-named file is read (content decides)", () => {
  // Classification is by content (a NUL byte), not by extension: a `.png`
  // that actually contains JavaScript must still be inspected.
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "chunk.png"),
    'NEXT_PUBLIC_FIREBASE_API_KEY:"AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo"',
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

test("CHECKER-4-D2b2: a genuinely binary file is skipped without failing", () => {
  const root = makeBundleFixture();
  fs.writeFileSync(path.join(root, ".next", "static", "chunks", "real.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]));
  const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(report.result, "PASS");
});

test("CHECKER-4-D1: a tree far larger than one JS string is inspected without crashing", () => {
  // 12 x 8 MB of extra text. The old implementation joined every file into a
  // single string; that path must be gone.
  const root = makeBundleFixture();
  const dir = path.join(root, ".next", "dev", "cache");
  fs.mkdirSync(dir, { recursive: true });
  const block = "x".repeat(8 * 1024 * 1024);
  for (let i = 0; i < 12; i += 1) fs.writeFileSync(path.join(dir, `chunk-${i}.js`), block);
  const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(report.result, "PASS");
});

test("CHECKER-5-D1: a clean tree under an exact 'batches'/'custody' segment passes", () => {
  // The warehouse predicate must run against the path RELATIVE to the root.
  // Testing the absolute path fails any checkout whose own location contains a
  // segment named exactly one of those words, so the fixture must reproduce
  // that shape — a mere prefix like "nested-batches" does not.
  for (const segment of ["batches", "custody"]) {
    const parent = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ct4-paths-")), segment);
    fs.mkdirSync(parent, { recursive: true });
    const root = fs.mkdtempSync(path.join(parent, "clean-"));
    fs.mkdirSync(path.join(root, ".next", "static", "chunks"), { recursive: true });
    fs.mkdirSync(path.join(root, ".next", "server"), { recursive: true });
    // A pre-existing base route, so the source-route branch actually runs.
    fs.mkdirSync(path.join(root, "src", "app", "(app)", "inventory"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "app", "(app)", "inventory", "page.tsx"), "x");
    fs.writeFileSync(path.join(root, ".next", "BUILD_ID"), "b\n");
    fs.writeFileSync(path.join(root, ".next", "server", "app-paths-manifest.json"), "{}");
    fs.writeFileSync(
      path.join(root, ".next", "static", "chunks", "main.js"),
      `resolver({${[
        'NEXT_PUBLIC_APP_ENV:"production"',
        ...Object.entries(PRODUCTION_INLINED).map(([k, v]) => `${k}:"${v}"`),
      ].join(",")}})`,
    );
    const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
    assert.equal(report.result, "PASS", `clean tree under an exact ${segment}/ segment must pass`);
  }
});

test("CHECKER-5-D2: a staging chunk behind a NUL byte is still inspected", () => {
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "hidden.js"),
    Buffer.concat([
      Buffer.from([0x00]),
      Buffer.from(STAGING_SELECTION_OBJECT),
    ]),
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_CONFLICT");
});

test("CHECKER-5-D3: a UTF-16LE staging chunk is inspected", () => {
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "wide.js"),
    Buffer.from(STAGING_SELECTION_OBJECT, "utf16le"),
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_CONFLICT");
});

test("CHECKER-6-W1: a warehouse entrypoint in a hosting tree with no nested .next is caught", () => {
  // A hosting tree carries `_next/`, assets and prerendered HTML but no nested
  // `.next`. The manifest skip must not also skip the tree walk.
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  const hosting = path.join(site, "hosting");
  fs.mkdirSync(path.join(hosting, "custody"), { recursive: true });
  fs.writeFileSync(path.join(hosting, "custody", "index.html"), "<html></html>");
  // Real topology: hosting carries the id as a `_next/static/<id>/` directory,
  // functions carries it at `functions/.next/BUILD_ID`.
  stampBuildId(root, site);
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_WAREHOUSE_CONTAMINATION");
});

test("CHECKER-6-W2: a clean hosting tree with no nested .next still passes", () => {
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  fs.mkdirSync(path.join(site, "hosting"), { recursive: true });
  stampBuildId(root, site, "shared-build");
  fs.copyFileSync(path.join(root, ".next", "static", "chunks", "main.js"),
    path.join(site, "hosting", "_next", "static", "chunks", "main.js"));
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
  assert.equal(report.warehouseHits, 0);
  assert.deepEqual(report.buildIds, ["shared-build"]);
});

test("CHECKER-7-R1: an unauthorized 12th warehouse entrypoint in functions/ is caught", () => {
  // firebase-tools writes the SSR codebase AT .firebase/<site>/functions, not
  // nested under it. That directory must be an output in its own right.
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  fs.mkdirSync(path.join(site, "hosting", "_next", "static", "chunks"), { recursive: true });
  fs.copyFileSync(path.join(root, ".next", "static", "chunks", "main.js"),
    path.join(site, "hosting", "_next", "static", "chunks", "main.js"));
  const ssr = path.join(site, "functions");
  const warehousePage = path.join(ssr, ".next", "server", "app", "(app)", "warehouse", "unauthorized", "page.js");
  fs.mkdirSync(path.dirname(warehousePage), { recursive: true });
  fs.writeFileSync(warehousePage, "export default function Page(){return null}");
  fs.copyFileSync(path.join(root, ".next", "BUILD_ID"), path.join(ssr, ".next", "BUILD_ID"));
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_WAREHOUSE_CONTAMINATION");
});

test("CHECKER-7-R1b: authorized F60 warehouse entrypoint in functions/ and hosting/ passes", () => {
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  fs.mkdirSync(path.join(site, "hosting", "warehouse"), { recursive: true });
  fs.writeFileSync(path.join(site, "hosting", "warehouse", "batches.html"), "<html></html>");
  fs.mkdirSync(path.join(site, "hosting", "_next", "static", "chunks"), { recursive: true });
  fs.copyFileSync(path.join(root, ".next", "static", "chunks", "main.js"),
    path.join(site, "hosting", "_next", "static", "chunks", "main.js"));
  const ssr = path.join(site, "functions");
  const warehousePage = path.join(ssr, ".next", "server", "app", "(app)", "warehouse", "page.js");
  fs.mkdirSync(path.dirname(warehousePage), { recursive: true });
  fs.writeFileSync(warehousePage, "export default function Page(){return null}");
  fs.copyFileSync(path.join(root, ".next", "BUILD_ID"), path.join(ssr, ".next", "BUILD_ID"));
  stampBuildId(root, site);
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
});

test("CHECKER-7-R2: the same layout without a warehouse entrypoint passes", () => {
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  fs.mkdirSync(path.join(site, "hosting", "_next", "static", "chunks"), { recursive: true });
  fs.copyFileSync(path.join(root, ".next", "static", "chunks", "main.js"),
    path.join(site, "hosting", "_next", "static", "chunks", "main.js"));
  const ssr = path.join(site, "functions");
  fs.mkdirSync(path.join(ssr, ".next", "server", "app"), { recursive: true });
  fs.copyFileSync(path.join(root, ".next", "BUILD_ID"), path.join(ssr, ".next", "BUILD_ID"));
  // R4 topology: genuine marker-bearing id dirs and reconciled manifests.
  stampBuildId(root, site);
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
});

test("N6: staging selected as the active tuple fails", () => {
  const root = makeBundleFixture({ markers: "staging" });
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_STAGING_SELECTION_INLINED");
});

test("CHECKER-3: pre-existing base routes (inventory, movements) are not F60", () => {
  // S1 already ships src/app/(app)/inventory, reports/inventory and
  // humans/movements. Treating those as F60 would block every release.
  const root = makeBundleFixture({ routes: ["/", "/inventory", "/reports/inventory", "/humans/movements"] });
  const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(report.result, "PASS");
  assert.equal(report.warehouseHits, 0);
});

test("CHECKER-3b: a source tree with base inventory/movements routes is clean", () => {
  const root = makeBundleFixture();
  for (const rel of ["(app)/inventory", "(app)/reports/inventory", "(app)/humans/movements"]) {
    fs.mkdirSync(path.join(root, "src", "app", rel), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "app", rel, "page.tsx"), "x");
  }
  const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(report.result, "PASS");
});

test("N6b: Authorized 11 F60 source routes pass while a 12th unknown warehouse source route fails", () => {
  const root = makeBundleFixture();
  for (const sub of [
    "", "[section]", "batches", "custody", "equipment", "equipment/[id]",
    "inventory", "inventory/[id]", "materials", "materials/[id]", "movements",
  ]) {
    const dir = sub ? path.join(root, "src", "app", "(app)", "warehouse", sub) : path.join(root, "src", "app", "(app)", "warehouse");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "page.tsx"), "x");
  }
  const okReport = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(okReport.result, "PASS");

  fs.mkdirSync(path.join(root, "src", "app", "(app)", "warehouse", "rogue"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "app", "(app)", "warehouse", "rogue", "page.tsx"), "x");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
});

test("N6c: Authorized F60 manifest route passes while 12th unknown route fails", () => {
  const okRoot = makeBundleFixture({ routes: ["/", "/warehouse/batches"] });
  assert.equal(bundleGuard.runBundleGuard({ root: okRoot, stage: "post-build" }).result, "PASS");

  const badRoot = makeBundleFixture({ routes: ["/", "/warehouse/rogue"] });
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root: badRoot, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
});

test("N6d: Unknown warehouse route also caught in the app/ sub-layout manifest", () => {
  // Next has shipped app-paths-manifest.json both under server/ and under
  // server/app/. Detection must not depend on which layout a build produced.
  const root = makeBundleFixture({ routes: ["/"] });
  fs.mkdirSync(path.join(root, ".next", "server", "app"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".next", "server", "app", "app-paths-manifest.json"),
    JSON.stringify({ "/": "x.js", "/warehouse/rogue": "y.js" }),
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
});

test("N7: absent output fails closed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ct4-bundle-empty-"));
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_OUTPUT_ABSENT");
});

test("N7b: missing BUILD_ID fails closed", () => {
  const root = makeBundleFixture({ buildId: null });
  // R4 retired the ABSENT label: a required anchor that proves no id is
  // E_BUILD_ID_UNPROVABLE, never a separate absent state.
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_BUILD_ID_UNPROVABLE");
});

test("N7c: stale output (source newer than build) fails", () => {
  const root = makeBundleFixture({ staleSource: true });
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_STALE_BUNDLE");
});

test("N7d: ambiguous delivered outputs with divergent build ids fail", () => {
  const root = makeBundleFixture({ buildId: "next-build" });
  const site = path.join(root, ".firebase", "canil-gcm");
  // Same site, two surfaces, two different builds: the upload would ship a
  // hosting tree from a build its SSR half does not belong to.
  stampBuildId(root, site, "hosting-build", "functions-build");
  // R4 reports divergent cross-surface ids as E_BUILD_ID_CONFLICT; the retired
  // E_AMBIGUOUS_OUTPUT label belonged to the pre-R4 vocabulary.
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_BUILD_ID_CONFLICT");
});

test("N7e: pre-publish refuses when no Firebase upload tree exists", () => {
  const root = makeBundleFixture();
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_OUTPUT_ABSENT");
});

test("bundle guard CLI reports FAIL with a stable exit code", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ct4-bundle-cli-"));
  const result = runGuardCli(BUNDLE_GUARD, ["--root", root, "--json"]);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /E_OUTPUT_ABSENT/);
});


// ------------------------------- R4: X2 / Y3 / FP vectors, inside the suite
// These were external probes during R3. They live here now so a future rewrite
// cannot quietly drop the coverage that motivated the R3 REJECT.

/** A complete staging identity in FIELD-NAME form, as an initializeApp arg. */
const STAGING_FIELDNAME_OBJECT = `initializeApp({${[
  'apiKey:"AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo"',
  'authDomain:"k9-ops-staging.firebaseapp.com"',
  'projectId:"k9-ops-staging"',
  'storageBucket:"k9-ops-staging.firebasestorage.app"',
  'messagingSenderId:"507588808242"',
  'appId:"1:507588808242:web:89b531a8e7d358596ef62b"',
].join(",")}})`;

test("X2a: a field-name staging identity beside a production selection fails", () => {
  // The exact shape that produced the R3 REJECT: a complete staging tuple in
  // field-name form coexisting with a valid production selection object.
  const root = makeBundleFixture();
  fs.writeFileSync(path.join(root, ".next", "static", "chunks", "leak.js"), STAGING_FIELDNAME_OBJECT);
  expectBundleFailure(
    () => bundleGuard.runBundleGuard({ root, stage: "post-build" }),
    "E_IDENTITY_INJECTED_FIELDNAME",
  );
});

test("X2b: a field-name staging identity appended to the production chunk fails", () => {
  const root = makeBundleFixture();
  fs.appendFileSync(path.join(root, ".next", "static", "chunks", "main.js"),
    "\n" + STAGING_FIELDNAME_OBJECT);
  expectBundleFailure(
    () => bundleGuard.runBundleGuard({ root, stage: "post-build" }),
    "E_IDENTITY_INJECTED_FIELDNAME",
  );
});

test("X2c: a partial staging selection below the old 3-key threshold fails", () => {
  // R3 shipped MIN_SELECTION_KEYS=3, so a staging selector with only two
  // identity keys escaped as "not a selection". Any staging credential is a
  // defect regardless of how many companions it brings.
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "partial.js"),
    ['NEXT_PUBLIC_APP_ENV:"staging"', `NEXT_PUBLIC_FIREBASE_PROJECT_ID:"k9-ops-staging"`,
      'NEXT_PUBLIC_FIREBASE_API_KEY:"AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo"'].join(","),
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_IDENTITY_MISMATCH");
});

test("X2d: the inactive canonical staging branch is NOT reported as injected", () => {
  // The other half of X2: the fix must not simply condemn every staging
  // literal. config.ts compiles the whole staging tuple into every build.
  const root = makeBundleFixture();
  const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(report.result, "PASS");
  assert.ok(report.identitySelection.stagingFieldNameTuples > 0, "staging tuple is present in the fixture");
  assert.ok(report.identitySelection.canonicalFieldNameTuples > 0, "and is classified canonical");
  assert.deepEqual(report.identitySelection.injectedFieldNameTuples, []);
});

test("X2e: an unbalanced/dangling staging tuple fails closed instead of being skipped", () => {
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "dangling.js"),
    'projectId:"k9-ops-staging",apiKey:"AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo"',
  );
  expectBundleFailure(
    () => bundleGuard.runBundleGuard({ root, stage: "post-build" }),
    "E_IDENTITY_INJECTED_FIELDNAME",
  );
});


test("X2f: a lone staging selector with no identity companions fails", () => {
  // The gap the min-keys probe found: only the selector, nothing else. It is
  // not a well-formed selection object, so the object layer ignores it — but it
  // is still an active staging selection written into the artifact.
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "bare.js"),
    'NEXT_PUBLIC_APP_ENV:"staging"',
  );
  expectBundleFailure(
    () => bundleGuard.runBundleGuard({ root, stage: "post-build" }),
    "E_IDENTITY_MISMATCH",
  );
});

test("X2g: the staging selector is caught in every quote style and in a map", () => {
  const shapes = [
    "NEXT_PUBLIC_APP_ENV:'staging'",
    "NEXT_PUBLIC_APP_ENV:\"staging\"",
    '{"NEXT_PUBLIC_APP_ENV":"staging"}',
    'process.env["NEXT_PUBLIC_APP_ENV"]="staging"',
    'NEXT_PUBLIC_APP_ENV:\\"staging\\"',
  ];
  for (const shape of shapes) {
    const root = makeBundleFixture();
    fs.writeFileSync(path.join(root, ".next", "static", "chunks", "q.js"), shape);
    expectBundleFailure(
      () => bundleGuard.runBundleGuard({ root, stage: "post-build" }),
      "E_IDENTITY_MISMATCH",
    );
  }
  const root = makeBundleFixture();
  fs.writeFileSync(
    path.join(root, ".next", "static", "chunks", "main.js.map"),
    JSON.stringify({ sourcesContent: ['NEXT_PUBLIC_APP_ENV:"staging"'] }),
  );
  expectBundleFailure(
    () => bundleGuard.runBundleGuard({ root, stage: "post-build" }),
    "E_IDENTITY_MISMATCH",
  );
});

test("X2i: compiler error-message templates are not mistaken for a staging selection", () => {
  // Regression for a false positive this gate introduced and then measured on a
  // real production build: the compiled chunk carries UNRESOLVED placeholders
  // inside its own diagnostics. A "anything that is not production" rule flags
  // them and condemns a legitimate artifact.
  const root = makeBundleFixture();
  fs.appendFileSync(
    path.join(root, ".next", "static", "chunks", "main.js"),
    [
      "",
      'throw new b(`NEXT_PUBLIC_APP_ENV="${r}" requires project "${i.projectId}"`);',
      "throw new b('Invalid NEXT_PUBLIC_APP_ENV: expected staging or production.');",
      'const msg = "NEXT_PUBLIC_APP_ENV: expected \\"staging\\" or \\"production\\".";',
    ].join("\n"),
  );
  const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(report.result, "PASS");
  assert.equal(report.identitySelection.stagingSelectorLiterals, 0);
});

test("X2h: a production selector alone is not reported as a staging selector", () => {
  // The counterpart guard: the new scan must not fire on the production value.
  const root = makeBundleFixture();
  const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(report.result, "PASS");
  assert.equal(report.identitySelection.stagingSelectorLiterals, 0);
});

test("isUnpublishedPath: node_modules is unpublished on every surface", () => {
  // Exported contract. walk() also skips node_modules, so this branch is not
  // reached through the walker — asserting it directly keeps the contract from
  // being deleted as "dead" later.
  for (const surface of ["functions", "hosting", "next"]) {
    assert.equal(bundleGuard.isUnpublishedPath("node_modules/batches/x.js", surface), true);
    assert.equal(bundleGuard.isUnpublishedPath("app/node_modules/p/y.js", surface), true);
  }
});

test("isUnpublishedPath: dot-directories differ by surface, as the CLI behaves", () => {
  // Stage A probe (probe-listfiles-a1.js): the pinned CLI matcher publishes
  // descendants of dot-dirs, so only the basename itself is excluded.
  assert.equal(bundleGuard.isUnpublishedPath(".cache/batches/i.html", "hosting"), false);
  // The matcher only drops the dot-NAMED entry itself; auditUploadTreeLinks is the boundary for links under it.
  assert.equal(bundleGuard.isUnpublishedPath(".cache", "hosting"), false);
  assert.equal(bundleGuard.isUnpublishedPath(".git/config", "hosting"), false);
  // Functions uploads with ignore = [node_modules, .git], so `.next` SHIPS.
  assert.equal(
    bundleGuard.isUnpublishedPath(".next/server/app/warehouse/page.js", "functions"),
    false,
  );
  assert.equal(bundleGuard.isUnpublishedPath(".git/config", "functions"), true);
});

test("FP5: the CLI's __FIREBASE_DEFAULTS__ blob in a production tree does not false-positive", () => {
  // `firebase deploy` writes `.firebase/<site>/functions/.env` with a serialized
  // __FIREBASE_DEFAULTS__ config. Functions uploads dot-files, so it ships. In a
  // production artifact it carries the PRODUCTION project and must be accepted.
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  fs.writeFileSync(
    path.join(site, "functions", ".env"),
    '__FIREBASE_DEFAULTS__={"config":{"projectId":"canil-gcm","apiKey":"' +
      PRODUCTION_INLINED.NEXT_PUBLIC_FIREBASE_API_KEY + '"}}\n',
  );
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
  assert.deepEqual(report.identitySelection.injectedFieldNameTuples, []);
});

test("FP6: a STAGING __FIREBASE_DEFAULTS__ blob in the upload tree fails", () => {
  // The inverse of FP5. If the SSR env file carries staging config while the
  // build selects production, the server would boot against staging.
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  fs.writeFileSync(
    path.join(site, "functions", ".env"),
    '__FIREBASE_DEFAULTS__={"config":{"projectId":"k9-ops-staging","apiKey":"AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo"}}\n',
  );
  let thrown;
  try {
    bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  } catch (error) {
    thrown = error;
  }
  assert.ok(
    thrown instanceof bundleGuard.BundleGuardFailure,
    "a staging SSR env blob must be refused",
  );
  assert.ok(
    ["E_IDENTITY_INJECTED_FIELDNAME", "E_IDENTITY_MISMATCH"].includes(thrown.code),
    "unexpected code " + (thrown && thrown.code),
  );
});

test("Y3a: a hosting tree left over from another build fails", () => {
  const root = makeBundleFixture({ buildId: "current-build" });
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site, "stale-build", "current-build");
  expectBundleFailure(
    () => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }),
    "E_BUILD_ID_CONFLICT",
  );
});

test("Y3b: production in hosting and staging in functions is a cross-tree conflict", () => {
  // The two halves of one upload disagree about which project they belong to.
  // stampBuildId puts the production chunk in the hosting tree; this adds a
  // staging selection to the functions tree, so the artifact as a whole has two
  // different selections and cannot be released.
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  fs.writeFileSync(path.join(site, "functions", "b.js"), STAGING_SELECTION_OBJECT);
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_IDENTITY_CONFLICT");
});

test("Y3c: a field-name staging identity in the functions tree fails", () => {
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  fs.writeFileSync(path.join(site, "functions", "b.js"), STAGING_FIELDNAME_OBJECT);
  expectBundleFailure(
    () => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }),
    "E_IDENTITY_INJECTED_FIELDNAME",
  );
});

test("Y3d: a staging selection nested deeper in the functions tree still fails", () => {
  // R3 coverage depended on nesting depth: `functions/node_modules` was its own
  // output root while `functions/app/node_modules` was not. Coverage must not
  // depend on where inside the upload tree the identity sits.
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  fs.mkdirSync(path.join(site, "functions", "app", "deep", "deeper"), { recursive: true });
  fs.writeFileSync(
    path.join(site, "functions", "app", "deep", "deeper", "x.js"),
    STAGING_SELECTION_OBJECT,
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_IDENTITY_CONFLICT");
});

test("FP1: benign content under functions/node_modules does not fail", () => {
  // Critical: `functions/node_modules` must not become a delivery root. R3
  // promoted it, which dropped the segment from the relative path and turned a
  // clean artifact into E_WAREHOUSE_CONTAMINATION.
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  fs.mkdirSync(path.join(site, "functions", "node_modules", "batches"), { recursive: true });
  fs.writeFileSync(path.join(site, "functions", "node_modules", "batches", "x.js"), "//benign");
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
  assert.equal(report.warehouseHits, 0);
});

test("FP2: a Warehouse route under a dot-dir in the HOSTING tree fails (ships)", () => {
  // Stage A probe: the pinned CLI matcher publishes dot-dir descendants.
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  fs.mkdirSync(path.join(site, "hosting", ".cache", "batches"), { recursive: true });
  fs.writeFileSync(path.join(site, "hosting", ".cache", "batches", "i.html"), "x");
  expectBundleFailure(
    () => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }),
    "E_WAREHOUSE_CONTAMINATION",
  );
});

test("FP3: an unauthorized 12th Warehouse page materialised inside functions/.next IS published and fails", () => {
  // The counterpart of FP2: Functions uploads dot-directories, so an unauthorized Warehouse
  // page that reached `functions/.next/...` would really ship. Suppressing it
  // would be a blind spot, not a fix.
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  const page = path.join(site, "functions", ".next", "server", "app", "(app)", "warehouse", "rogue", "page.js");
  fs.mkdirSync(path.dirname(page), { recursive: true });
  fs.writeFileSync(page, "export default function Page(){return null}");
  expectBundleFailure(
    () => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }),
    "E_WAREHOUSE_CONTAMINATION",
  );
});

test("Y3e: a staging selection inside node_modules is NOT reachable (not uploaded)", () => {
  // Inverse of FP1: because node_modules never ships, an identity there is not
  // an artifact defect. This documents the boundary instead of leaving it
  // implicit — and it is what would break if node_modules were promoted to its
  // own output root again.
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  fs.mkdirSync(path.join(site, "functions", "node_modules", "pkg"), { recursive: true });
  fs.writeFileSync(path.join(site, "functions", "node_modules", "pkg", "y.js"), STAGING_SELECTION_OBJECT);
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
});

test("FP4: a benign package named batches inside node_modules passes on the functions surface too", () => {
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  fs.mkdirSync(path.join(site, "functions", "node_modules", "@acme", "custody"), { recursive: true });
  fs.writeFileSync(path.join(site, "functions", "node_modules", "@acme", "custody", "index.js"), "//benign");
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
});

test("W1: a genuine Warehouse route in the delivered hosting tree still fails", () => {
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  fs.mkdirSync(path.join(site, "hosting", "batches"), { recursive: true });
  fs.writeFileSync(path.join(site, "hosting", "batches", "index.html"), "<html></html>");
  expectBundleFailure(
    () => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }),
    "E_WAREHOUSE_CONTAMINATION",
  );
});

// ------------------------------------------ N8: pipeline wiring simulation

/** Read the workflow derived from the repository, as YAML text (no parser). */
function readWorkflow() {
  return fs.readFileSync(path.join(REPO_ROOT, ".github", "workflows", "deploy.yml"), "utf8");
}

/**
 * The workflow as executable content: comment lines removed, so a header that
 * merely *describes* the guards cannot satisfy or shift an ordering assertion.
 */
function readWorkflowCode() {
  return readWorkflow()
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

function indexOrDie(haystack, needle) {
  const index = haystack.indexOf(needle);
  assert.notEqual(index, -1, `expected to find ${JSON.stringify(needle)} in deploy.yml`);
  return index;
}

/** Slice of the workflow belonging to one job (`validate:` / `release:`). */
function readJob(name) {
  const code = readWorkflowCode();
  const start = indexOrDie(code, `\n  ${name}:`);
  const rest = code.slice(start + 1);
  const next = rest.search(/\n  [a-z][a-z-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next);
}

test("N8: deploy workflow runs PRE-BUILD, POST-BUILD and PRE-PUBLISH in order", () => {
  const workflow = readWorkflowCode();
  const validate = readJob("validate");

  const preBuild = indexOrDie(validate, "production-env-guard.cjs");
  const build = indexOrDie(validate, "npm run build");
  const postBuild = indexOrDie(validate, "production-bundle-guard.cjs --stage post-build");
  const deploy = indexOrDie(workflow, "firebase deploy");

  assert.ok(preBuild < build, "env guard must run before the build");
  assert.ok(build < postBuild, "bundle guard must inspect the compiled output after the build");
  assert.ok(postBuild < deploy, "the post-build checkpoint must precede the deploy");

  // PRE-PUBLISH is deliberately NOT another workflow line: the CLI's own
  // rebuild happens inside `firebase deploy`, so a workflow step placed before
  // it would inspect the wrong artifact. It is bound to hosting.predeploy,
  // which the CLI runs after that rebuild and immediately before upload.
  const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "firebase.json"), "utf8"));
  const hosting = Array.isArray(config.hosting) ? config.hosting[0] : config.hosting;
  const predeploy = Array.isArray(hosting.predeploy) ? hosting.predeploy : [hosting.predeploy];
  assert.ok(
    predeploy.some((command) => command.includes("--stage pre-publish")),
    "PRE-PUBLISH must be bound to hosting.predeploy",
  );
});

test("N8a2: the release job does not build a throwaway artifact", () => {
  // `firebase deploy` builds the app itself; an explicit build in the release
  // job would audit a tree the CLI immediately replaces, which is a false
  // proof rather than a guard.
  const release = readJob("release");
  assert.ok(
    !release.includes("npm run build"),
    "release job must not build a tree the CLI discards",
  );
  assert.ok(
    release.includes("production-env-guard.cjs"),
    "release job still needs its own PRE-BUILD checkpoint before authenticating",
  );
});

test("N8b: the workflow no longer generates a contradictory .env.local", () => {
  const workflow = readWorkflowCode();
  assert.ok(
    !/NEXT_PUBLIC_FIREBASE_API_KEY[^\n]*\n?[^\n]*>\s*\.env\.local/.test(workflow) &&
      !workflow.includes("} > .env.local"),
    "the release job must not write .env.local",
  );
});

test("N8c: predeploy checkpoint is declared in firebase.json", () => {
  const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "firebase.json"), "utf8"));
  const hosting = Array.isArray(config.hosting) ? config.hosting[0] : config.hosting;
  assert.ok(hosting && hosting.predeploy, "hosting.predeploy must be declared");
  const commands = Array.isArray(hosting.predeploy) ? hosting.predeploy : [hosting.predeploy];
  assert.ok(
    commands.some((command) => command.includes("production-bundle-guard.cjs")),
    "hosting.predeploy must invoke the bundle guard",
  );
});

test("N8d: guards are invoked by direct Node path, not through an absent package script", () => {
  // package.json is outside this gate's five-file allowlist, so the guards are
  // wired in the workflow and firebase.json by explicit path. Assert both.
  const workflow = readWorkflowCode();
  assert.match(workflow, /node scripts\/ct4-web-p0-production-env-guard\.cjs/);
  assert.match(workflow, /node scripts\/ct4-web-p0-production-bundle-guard\.cjs/);

  const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "firebase.json"), "utf8"));
  const hosting = Array.isArray(config.hosting) ? config.hosting[0] : config.hosting;
  const commands = Array.isArray(hosting.predeploy) ? hosting.predeploy : [hosting.predeploy];
  assert.ok(
    commands.some((command) => command.includes("node scripts/ct4-web-p0-production-bundle-guard.cjs")),
    "predeploy must invoke the guard by Node path",
  );
});

// ============================== H0 + F-01 (R4) adversarial matrix

/** Make the pre-publish fixture a complete R4-consistent upload tree. */
function makeR4Upload(root) {
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  return site;
}

test("H0-A: a named symlink in the hosting tree pointing OUTSIDE fails closed", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "h0-outside-"));
  fs.writeFileSync(path.join(outside, "blob"), "external content");
  // Windows: file symlinks need privilege. A junction to the external DIR
  // exercises the same failure (the CLI follows it, content outside ships).
  fs.symlinkSync(outside, path.join(site, "hosting", "weblink"), "junction");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_LINK_UNPROVABLE");
});

test("H0-B: a junction to an external directory fails closed", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "h0-junc-"));
  fs.writeFileSync(path.join(outside, "leak.js"), "x");
  fs.symlinkSync(outside, path.join(site, "hosting", "ext"), "junction");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_LINK_UNPROVABLE");
});

test("H0-C: a dangling symlink fails closed", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  // A directory junction to a path that does not exist is dangling: the CLI
  // (follow:true) cannot resolve it, so the guard must fail closed.
  fs.symlinkSync(path.join(root, "does", "not", "exist"), path.join(site, "hosting", "dangling"), "junction");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_LINK_UNPROVABLE");
});

test("H0-D: a link inside an excluded node_modules directory cannot ship", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "h0-nm-"));
  fs.writeFileSync(path.join(outside, "blob"), "x");
  fs.mkdirSync(path.join(site, "functions", "node_modules", "pkg"), { recursive: true });
  fs.symlinkSync(outside, path.join(site, "functions", "node_modules", "pkg", "link"), "junction");
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
});

test("H0-E: containment is path-segment aware (safe vs safe2)", () => {
  assert.equal(bundleGuard.isPathContained("C:\\safe2\\x", "C:\\safe"), false);
  assert.equal(bundleGuard.isPathContained("C:\\safe\\x", "C:\\safe"), true);
  // Win32-only: the canonical form case-folds the drive path because the
  // on-disk case of a directory is arbitrary on Windows. On POSIX a lexical
  // Windows-style path has no on-disk case to consult and stays exact.
  if (process.platform === "win32") {
    assert.equal(bundleGuard.isPathContained("C:\\SAFE\\x", "C:\\safe"), true);
  } else {
    assert.equal(bundleGuard.isPathContained("C:\\SAFE\\x", "C:\\safe"), false);
  }
  assert.equal(bundleGuard.isPathContained("C:\\safe", "C:\\safe"), true);
});

test("F-01-A: an empty/whitespace BUILD_ID file is E_BUILD_ID_UNPROVABLE", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  fs.writeFileSync(path.join(site, "functions", ".next", "BUILD_ID"), "   \n");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_BUILD_ID_UNPROVABLE");
});

test("F-01-B: a markerless static directory proves no id", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  fs.rmSync(path.join(site, "functions", ".next", "static", "build-abc123"), { recursive: true, force: true });
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_BUILD_ID_UNPROVABLE");
});

test("F-01-C: two genuine id directories are ambiguous", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  fs.mkdirSync(path.join(site, "hosting", "_next", "static", "other-id"), { recursive: true });
  fs.writeFileSync(path.join(site, "hosting", "_next", "static", "other-id", "_ssgManifest.js"), "x");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_BUILD_ID_AMBIGUOUS");
});

test("F-01-D: intra-Functions divergence (BUILD_ID=A, static=B) conflicts", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  fs.writeFileSync(path.join(site, "functions", ".next", "BUILD_ID"), "other-build\n");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_BUILD_ID_CONFLICT");
});

test("F-01-E: cross-surface divergence (hosting=A, functions=B) conflicts", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  fs.writeFileSync(path.join(site, "functions", ".next", "BUILD_ID"), "functions-build\n");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_BUILD_ID_CONFLICT");
});

test("F-01-F: disagreeing basePath manifests fail closed", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  fs.writeFileSync(path.join(site, "functions", ".next", "routes-manifest.json"), JSON.stringify({ basePath: "/docs" }));
  fs.writeFileSync(
    path.join(site, "functions", ".next", "required-server-files.json"),
    JSON.stringify({ config: { basePath: "/other" } }),
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_BUILD_ID_CONFLICT");
});

test("F-01-G: the model validator rejects artificial invalid inputs", () => {
  for (const bad of [undefined, null, 42, true, {}, [], "", "   "]) {
    const result = bundleGuard.f01ValidateId(bad, "test.id");
    assert.equal(result.ok, false, "input " + JSON.stringify(bad) + " must be rejected");
  }
  const traversal = bundleGuard.f01ValidateId("safe/../../etc", "test.id");
  assert.equal(traversal.ok, false);
  const valid = bundleGuard.f01ValidateId("build-abc123", "test.id");
  assert.equal(valid.ok, true);
});

test("F-01-H: basePath normalization accepts valid forms and rejects UNC/drive/non-string", () => {
  assert.equal(bundleGuard.r4NormalizeBasePath("").ok, true);
  assert.equal(bundleGuard.r4NormalizeBasePath("/").value, "");
  assert.equal(bundleGuard.r4NormalizeBasePath("/docs").value, "docs");
  assert.equal(bundleGuard.r4NormalizeBasePath("/docs/").value, "docs");
  assert.equal(bundleGuard.r4NormalizeBasePath("C:\\x").ok, false);
  assert.equal(bundleGuard.r4NormalizeBasePath("//server/share").ok, false);
  assert.equal(bundleGuard.r4NormalizeBasePath(42).ok, false);
  assert.equal(bundleGuard.r4NormalizeBasePath(null).ok, false);
});

test("F-01-I: pre-publish with a Hosting root but no Functions root fails closed", () => {
  const root = makeBundleFixture();
  const site = path.join(root, ".firebase", "canil-gcm");
  stampBuildId(root, site);
  fs.rmSync(path.join(site, "functions"), { recursive: true, force: true });
  expectBundleFailure(
    () => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }),
    "E_SURFACE_REQUIREMENT_UNPROVABLE",
  );
});

test("R4-J: a coherent R4 upload reconciles and passes", () => {
  const root = makeBundleFixture();
  makeR4Upload(root);
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
  assert.deepEqual(report.buildIds, ["build-abc123"]);
});

// ============================== H0 DOT-DIR ADVERSARIAL (R1)
// Stage A proved with the pinned firebase-tools@15.25.1 matcher (glob 10.5.0,
// dot:true + follow:true): dot-dir DESCENDANTS ship on Hosting, .git/config
// ships, and an external junction under a dot-dir leaks. The guard was
// repaired in this clone (H0_DOT_ANCESTOR_BYPASS) to fail closed on those.

function makeDotDirFixture(site) {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "dotdir-out-"));
  fs.writeFileSync(path.join(outside, "leak.txt"), "external");
  return outside;
}

test("H0-F (R1): external junction UNDER .cache fails closed on Hosting", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "dotdir-out-"));
  fs.writeFileSync(path.join(outside, "leak.txt"), "external");
  fs.symlinkSync(outside, path.join(site, "hosting", ".cache"), "junction");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_LINK_UNPROVABLE");
});

test("H0-G (R1): external symlink under .well-known fails closed on Hosting", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "dotdir-wk-"));
  fs.writeFileSync(path.join(outside, "blob.txt"), "external");
  fs.mkdirSync(path.join(site, "hosting", ".well-known"), { recursive: true });
  fs.symlinkSync(outside, path.join(site, "hosting", ".well-known", "weblink"), "junction");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_LINK_UNPROVABLE");
});

test("H0-H (R1): .git directory content is inspected, not skipped", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  fs.mkdirSync(path.join(site, "hosting", ".git"), { recursive: true });
  fs.writeFileSync(path.join(site, "hosting", ".git", "config"), "[core]");
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
});

test("H0-I (R1): benign descendants under a real dot-dir still pass on Hosting", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  fs.mkdirSync(path.join(site, "hosting", ".well-known"), { recursive: true });
  fs.writeFileSync(path.join(site, "hosting", ".well-known", "assetlinks.json"), "{}");
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
});

test("H0-J (R1): direct audit probe reproduces dot-ancestor ESCAPE on Hosting", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "dotdir-audit-"));
  fs.writeFileSync(path.join(outside, "blob.txt"), "x");
  fs.symlinkSync(outside, path.join(site, "hosting", ".cache"), "junction");
  const findings = bundleGuard.auditUploadTreeLinks(path.join(site, "hosting"), "hosting");
  assert.ok(Array.isArray(findings) && findings.length >= 1, "expected ESCAPE finding");
  assert.equal(findings[0].status, "ESCAPE");
});

// ============================== H0 POSIX-CONTAINMENT REGRESSION (R2)
// The original guard forced backslashes onto POSIX canonical paths, so
// isPathContained compared "/"-separated paths against path.sep === "/" with
// literal backslash segments and returned false for genuine children (RED:
// isPathContained("/root/parent/child", "/root/parent") === false). These
// regressions run on BOTH Windows and Linux with real filesystem paths.

test("H0-K (R2): containment holds for real child paths on the native platform", () => {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "h0-pos-")));
  const child = path.join(parent, "child");
  fs.mkdirSync(child, { recursive: true });
  assert.equal(bundleGuard.isPathContained(child, parent), true);
  assert.equal(bundleGuard.isPathContained(parent, parent), true);
  assert.equal(bundleGuard.isPathContained(path.join(child, "file.txt"), parent), true);
  const siblingBase = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "h0-pos2-")));
  const sibling = path.join(siblingBase, "target");
  fs.mkdirSync(sibling, { recursive: true });
  const lookalike = path.join(siblingBase, "target2");
  fs.mkdirSync(lookalike, { recursive: true });
  assert.equal(bundleGuard.isPathContained(lookalike, sibling), false, "target2 must not be inside target");
  assert.equal(bundleGuard.isPathContained(siblingBase, sibling), false, "ancestor is not inside");
});

test("H0-L (R2): containment fails closed for paths outside the parent", () => {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "h0-outp-")));
  const external = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "h0-outx-")));
  assert.equal(bundleGuard.isPathContained(external, parent), false);
  const ancestor = path.dirname(parent);
  assert.equal(bundleGuard.isPathContained(ancestor, parent), false, "ancestor is not inside");
});

test("H0-M (R2): canonical containment path resolves real paths without separator forcing", () => {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "h0-canon-")));
  const child = path.join(parent, "sub", "leaf");
  fs.mkdirSync(child, { recursive: true });
  const canonical = bundleGuard.canonicalContainmentPath(child);
  assert.equal(typeof canonical, "string");
  // canonicalContainmentPath is not guaranteed idempotent on win32 (its
  // backslash output is not realpath-able input), so containment is asserted
  // between the canonical forms themselves.
  const canonicalParent = bundleGuard.canonicalContainmentPath(parent);
  assert.equal(bundleGuard.isPathContained(canonical, canonicalParent), true, "canonical child stays contained");
});

test("H0-N (R2): dangling link inside Hosting fails closed (audit probe)", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  fs.symlinkSync(path.join(site, "hosting", "no", "such", "target"), path.join(site, "hosting", "dangling"), "junction");
  const findings = bundleGuard.auditUploadTreeLinks(path.join(site, "hosting"), "hosting");
  assert.ok(Array.isArray(findings) && findings.length >= 1);
  assert.equal(findings[0].status, "DANGLING");
});

test("H0-O (R2): symlink cycle inside Hosting fails closed", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  fs.symlinkSync(site, path.join(site, "hosting", "loop"), "junction");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_LINK_UNPROVABLE");
});

test("H0-P (R2): Windows junction ancestor-escape still fails closed on win32", { skip: process.platform === "win32" ? false : "Windows-only junction semantics" }, () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "h0-winj-")));
  fs.writeFileSync(path.join(outside, "secret.txt"), "x");
  fs.symlinkSync(outside, path.join(site, "hosting", "escape"), "junction");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_LINK_UNPROVABLE");
});

test("H0-Q (R2): drive-casing restoration keeps containment on win32", { skip: process.platform === "win32" ? false : "Windows-only drive semantics" }, () => {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "h0-drive-")));
  const lowerDrive = parent[0].toLowerCase() + parent.slice(1);
  const child = path.join(parent, "kid");
  fs.mkdirSync(child, { recursive: true });
  assert.equal(bundleGuard.isPathContained(child, lowerDrive), true);
  assert.equal(bundleGuard.isPathContained(lowerDrive, parent), true);
});

// ============================== H0 DOT-DIR ADVERSARIAL (R1)
// Stage A proved with the pinned firebase-tools@15.25.1 matcher (glob 10.5.0,
// dot:true + follow:true): dot-dir DESCENDANTS ship on Hosting, .git/config
// ships, and an external junction under a dot-dir leaks. The guard was
// repaired in this clone (H0_DOT_ANCESTOR_BYPASS) to fail closed on those.

function makeDotDirFixture(site) {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "dotdir-out-"));
  fs.writeFileSync(path.join(outside, "leak.txt"), "external");
  return outside;
}

test("H0-F (R1): external junction UNDER .cache fails closed on Hosting", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "dotdir-out-"));
  fs.writeFileSync(path.join(outside, "leak.txt"), "external");
  fs.symlinkSync(outside, path.join(site, "hosting", ".cache"), "junction");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_LINK_UNPROVABLE");
});

test("H0-G (R1): external symlink under .well-known fails closed on Hosting", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "dotdir-wk-"));
  fs.writeFileSync(path.join(outside, "blob.txt"), "external");
  fs.mkdirSync(path.join(site, "hosting", ".well-known"), { recursive: true });
  fs.symlinkSync(outside, path.join(site, "hosting", ".well-known", "weblink"), "junction");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_LINK_UNPROVABLE");
});

test("H0-H (R1): .git directory content is inspected, not skipped", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  fs.mkdirSync(path.join(site, "hosting", ".git"), { recursive: true });
  fs.writeFileSync(path.join(site, "hosting", ".git", "config"), "[core]");
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
});

test("H0-I (R1): benign descendants under a real dot-dir still pass on Hosting", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  fs.mkdirSync(path.join(site, "hosting", ".well-known"), { recursive: true });
  fs.writeFileSync(path.join(site, "hosting", ".well-known", "assetlinks.json"), "{}");
  const report = bundleGuard.runBundleGuard({ root, stage: "pre-publish" });
  assert.equal(report.result, "PASS");
});

test("H0-J (R1): direct audit probe reproduces dot-ancestor ESCAPE on Hosting", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "dotdir-audit-"));
  fs.writeFileSync(path.join(outside, "blob.txt"), "x");
  fs.symlinkSync(outside, path.join(site, "hosting", ".cache"), "junction");
  const findings = bundleGuard.auditUploadTreeLinks(path.join(site, "hosting"), "hosting");
  assert.ok(Array.isArray(findings) && findings.length >= 1, "expected ESCAPE finding");
  assert.equal(findings[0].status, "ESCAPE");
});


// ------------------------------------------ R2: fail-closed artifact attribution

test("R2-S1: an arbitrary file under server/chunks with a warehouse name fails closed", () => {
  const root = makeBundleFixture();
  fs.mkdirSync(path.join(root, ".next", "server", "chunks", "ssr", "warehouse"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".next", "server", "chunks", "ssr", "warehouse", "arbitrary_blob.js"),
    "export default null;",
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
});

test("R2-S2: a server chunk without a warehouse name stays outside the name predicate", () => {
  // Shared chunks are judged by trace attribution, not by name; one whose name
  // carries no warehouse segment is outside this predicate by design.
  const root = makeBundleFixture();
  fs.mkdirSync(path.join(root, ".next", "server", "chunks"), { recursive: true });
  fs.writeFileSync(path.join(root, ".next", "server", "chunks", "shared-vendor.js"), "// benign");
  const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(report.result, "PASS");
});

test("R2-S3: a fake artifact starting with 'page' under an authorized route fails closed", () => {
  const root = makeBundleFixture();
  const page = path.join(root, ".next", "server", "app", "(app)", "warehouse", "page_evil.js");
  fs.mkdirSync(path.dirname(page), { recursive: true });
  fs.writeFileSync(page, "export default function Page(){return null}");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
});

test("R2-S4: a fake artifact 'pageanything' under an authorized route fails closed", () => {
  const root = makeBundleFixture();
  const page = path.join(root, ".next", "server", "app", "(app)", "warehouse", "batches", "pageanything");
  fs.mkdirSync(path.dirname(page), { recursive: true });
  fs.writeFileSync(page, "malicious");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
});

test("R2-S5: PAGE_ARTIFACT_RE rejects spoofed basenames and accepts real page artifacts", () => {
  for (const bad of ["page_evil.js", "pageanything", "page.ts", "page.js.bak", "pages.js", "PageX"]) {
    assert.equal(bundleGuard.isPageArtifactName(bad), false, bad);
  }
  for (const good of ["page.js", "page.js.map", "page.js.nft.json", "page.rsc.js", "page.meta", "page_client-reference-manifest.js", "page_client-reference-manifest.js.map"]) {
    assert.equal(bundleGuard.isPageArtifactName(good), true, good);
  }
});

test("R2-S6: unauthorized /batches and /custody routes in the manifest fail closed", () => {
  const root = makeBundleFixture({ routes: ["/page", "/batches", "/custody"] });
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
});

test("R2-S7: route inventory reconciles 60 functional + 11 F60 + 3 internal = 74", () => {
  const root = makeBundleFixture();
  const manifestPath = path.join(root, ".next", "server", "app-paths-manifest.json");
  const f60 = [
    "/(app)/warehouse/[section]/page", "/(app)/warehouse/batches/page", "/(app)/warehouse/custody/page",
    "/(app)/warehouse/equipment/[id]/page", "/(app)/warehouse/equipment/page",
    "/(app)/warehouse/inventory/[id]/page", "/(app)/warehouse/inventory/page",
    "/(app)/warehouse/materials/[id]/page", "/(app)/warehouse/materials/page",
    "/(app)/warehouse/movements/page", "/(app)/warehouse/page",
  ];
  const functional = Array.from({ length: 60 }, (_, i) => "/functional/route-" + i);
  const manifest = Object.fromEntries(
    [...f60, ...functional, "/_not-found/page", "/_global-error/page", "/favicon.ico/route"].map((r) => [r, "x.js"]),
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(report.result, "PASS");
  assert.equal(report.routeInventory.manifestEntries, 74);
  assert.equal(report.routeInventory.authorizedF60.length, 11);
  assert.equal(report.routeInventory.preexistingFunctional, 60);
  assert.deepEqual(report.routeInventory.nextInternal, ["/_global-error/page", "/_not-found/page", "/favicon.ico/route"]);
});

test("R2-S8: an unknown warehouse route in the manifest fails closed", () => {
  const root = makeBundleFixture({ routes: ["/", "/warehouse/rogue"] });
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
});

test("R2-S9: a server chunk proven by an authorized route trace is attributed and passes", () => {
  const root = makeBundleFixture();
  const chunkDir = path.join(root, ".next", "server", "chunks", "ssr");
  fs.mkdirSync(chunkDir, { recursive: true });
  const chunk = path.join(chunkDir, "some_warehouse_shared_chunk.js");
  fs.writeFileSync(chunk, "// shared warehouse code");
  const routeDir = path.join(root, ".next", "server", "app", "(app)", "warehouse", "batches");
  fs.mkdirSync(routeDir, { recursive: true });
  const trace = {
    version: 1,
    files: ["page.js", path.relative(routeDir, chunk)],
  };
  fs.writeFileSync(path.join(routeDir, "page.js.nft.json"), JSON.stringify(trace));
  const report = bundleGuard.runBundleGuard({ root, stage: "post-build" });
  assert.equal(report.result, "PASS");
});

test("R2-S10: the .map of an unproven warehouse chunk still fails closed", () => {
  const root = makeBundleFixture();
  const chunkDir = path.join(root, ".next", "server", "chunks", "ssr", "warehouse");
  fs.mkdirSync(chunkDir, { recursive: true });
  fs.writeFileSync(path.join(chunkDir, "orphan_chunk.js.map"), "{}");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
});

test("R2-S11: unreferenced server/chunks/warehouse_evil_999.js fails closed (G8-2c)", () => {
  const root = makeBundleFixture();
  const chunkDir = path.join(root, ".next", "server", "chunks");
  fs.mkdirSync(chunkDir, { recursive: true });
  fs.writeFileSync(path.join(chunkDir, "warehouse_evil_999.js"), "export default null;");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
});

test("R2-S12: unreferenced server/chunks/warehouse_evil_999.js.map fails closed (G8-2d)", () => {
  const root = makeBundleFixture();
  const chunkDir = path.join(root, ".next", "server", "chunks");
  fs.mkdirSync(chunkDir, { recursive: true });
  fs.writeFileSync(path.join(chunkDir, "warehouse_evil_999.js.map"), "{}");
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
});

test("R2-S13: unreferenced Turbopack underscore-flattened SSR chunk fails closed (TURBOPACK_ROGUE_CHUNK)", () => {
  const root = makeBundleFixture();
  const chunkDir = path.join(root, ".next", "server", "chunks", "ssr");
  fs.mkdirSync(chunkDir, { recursive: true });
  fs.writeFileSync(
    path.join(chunkDir, "0klw__next-internal_server_app_(app)_warehouse_rogue_page_actions_evil123.js"),
    "export default null;",
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
});

test("R2-S14: proven Turbopack SSR chunk and .map pass while unproven functions chunk fails", () => {
  const root = makeBundleFixture();
  const chunkDir = path.join(root, ".next", "server", "chunks", "ssr");
  fs.mkdirSync(chunkDir, { recursive: true });
  const chunk = path.join(chunkDir, "0klw__next-internal_server_app_(app)_warehouse_batches_page_actions_060r6hb.js");
  fs.writeFileSync(chunk, "// proven action chunk");
  fs.writeFileSync(`${chunk}.map`, "{}");
  const routeDir = path.join(root, ".next", "server", "app", "(app)", "warehouse", "batches");
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(
    path.join(routeDir, "page.js.nft.json"),
    JSON.stringify({ version: 1, files: ["page.js", path.relative(routeDir, chunk)] }),
  );
  assert.equal(bundleGuard.runBundleGuard({ root, stage: "post-build" }).result, "PASS");

  // Pre-publish Functions surface must also reject an unproven Turbopack chunk.
  const site = makeR4Upload(root);
  const fnChunkDir = path.join(site, "functions", ".next", "server", "chunks", "ssr");
  fs.mkdirSync(fnChunkDir, { recursive: true });
  fs.writeFileSync(
    path.join(fnChunkDir, "0klw__next-internal_server_app_(app)_warehouse_rogue_page_actions_evil123.js"),
    "export default null;",
  );
  expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_WAREHOUSE_CONTAMINATION");
});

test("F05-S1: flattened warehouse tokens outside server/chunks fail closed on client, SSR app, and hosting surfaces", () => {
  {
    const root = makeBundleFixture();
    const dir = path.join(root, ".next", "static", "chunks");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "0klw_warehouse_rogue_client.js"), "export default null;");
    expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
  }
  {
    const root = makeBundleFixture();
    const dir = path.join(root, ".next", "server", "app", "(app)");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "warehouse_rogue.js"), "export default null;");
    expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
  }
  {
    const root = makeBundleFixture();
    const site = makeR4Upload(root);
    const dir = path.join(site, "hosting", "_next", "static", "chunks");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "0klw_warehouse_rogue_hosting.js"), "export default null;");
    expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_WAREHOUSE_CONTAMINATION");
  }
  {
    const root = makeBundleFixture();
    const site = makeR4Upload(root);
    const dir = path.join(site, "hosting");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "warehouse_rogue.html"), "<html></html>");
    expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "pre-publish" }), "E_WAREHOUSE_CONTAMINATION");
  }
  {
    const root = makeBundleFixture();
    const dir = path.join(root, ".next", "static", "chunks", "app", "(app)", "warehouse");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "rogue_backdoor.js"), "export default null;");
    expectBundleFailure(() => bundleGuard.runBundleGuard({ root, stage: "post-build" }), "E_WAREHOUSE_CONTAMINATION");
  }
});

test("F05-S2: authorized framework route-entry chunks and legitimate non-warehouse tokens pass without false positives", () => {
  const root = makeBundleFixture();
  const site = makeR4Upload(root);
  const nextRouteDir = path.join(root, ".next", "static", "chunks", "app", "(app)", "warehouse", "batches");
  fs.mkdirSync(nextRouteDir, { recursive: true });
  fs.writeFileSync(path.join(nextRouteDir, "page-0123456789abcdef.js"), "// authorized route entry");
  fs.writeFileSync(path.join(nextRouteDir, "page-0123456789abcdef.js.map"), "{}");

  const hostingRouteDir = path.join(site, "hosting", "_next", "static", "chunks", "app", "(app)", "warehouse");
  fs.mkdirSync(hostingRouteDir, { recursive: true });
  fs.writeFileSync(path.join(hostingRouteDir, "layout-0123456789abcdef.js"), "// authorized layout entry");

  const otherDir = path.join(root, ".next", "static", "chunks");
  fs.mkdirSync(otherDir, { recursive: true });
  fs.writeFileSync(path.join(otherDir, "inventory-legacy-chunk.js"), "// pre-existing inventory");
  fs.writeFileSync(path.join(otherDir, "warehousekeeper-note.js"), "// substring without token boundary");

  assert.equal(bundleGuard.runBundleGuard({ root, stage: "pre-publish" }).result, "PASS");
});
