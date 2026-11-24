#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS build-time script, same convention as the existing production guard scripts */
/**
 * CT4 WEB-P0 — tests for the G8 payload manifest mechanism.
 *
 * Gate: CT4.WEB-P0.CORRECTION-R1-RECONCILIATION-AND-G8-LOCAL-CLOSURE-R2
 *
 * Coverage map:
 *   G8-P1 / G8-P2  positive controls + deterministic digest + full R2 §12 binding
 *   T13            non-existent directory fails closed
 *   T14            manifest listing an absent file fails closed
 *   T15 / T15b/c/d divergent file hash, forged digest, missing digest, size/array defect
 *   T16 / T16b     unlisted file on disk & path traversal fail closed
 *   T17 / T17b–j   divergent commit/site/project/selector/runId/tree/buildId/firebaseIdentity
 *   T18 / T18b     `.next` alone rejected (`E_NOT_ACCEPTED_AS_G8`); nested `.next` allowed
 *   G8-X1..X3      symlink/junction, empty payload, false uploader hook claim rejected
 *   G8-PRE1..PRE4  dual-surface `firebase-predeploy`, ignore semantics, BUILD_ID reconciliation, real CLI `--from-env`
 *
 * Runs on bare Node (`node --test`) with zero external dependencies.
 */

"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");

const manifest = require("./ct4-web-p0-g8-payload-manifest.cjs");

const CLI_PATH = path.join(__dirname, "ct4-web-p0-g8-payload-manifest.cjs");
const REPO_ROOT = path.resolve(__dirname, "..");

const COMMIT = "9471d895da72547fc27af1444044067179494eca";
const TREE = "a949c80b3cee531006dc1cc8782a16adf7c0cb51";
const BUILD_ID = "q_sIo8S0xb3Q9WYWhiPJW";

const STAGING_IDENTITY = {
  projectId: "k9-ops-staging",
  apiKey: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
  authDomain: "k9-ops-staging.firebaseapp.com",
  storageBucket: "k9-ops-staging.firebasestorage.app",
  messagingSenderId: "507588808242",
  appId: "1:507588808242:web:89b531a8e7d358596ef62b",
};

const tempDirs = [];

function trackTempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function binding(overrides) {
  return {
    commit: COMMIT,
    tree: TREE,
    buildId: BUILD_ID,
    project: "canil-gcm",
    site: "canil-gcm",
    selector: "production",
    firebaseIdentity: { ...manifest.CANONICAL_PRODUCTION_IDENTITY },
    runId: "43645547728",
    runAttempt: "1",
    cliVersion: "15.25.1",
    ...(overrides || {}),
  };
}

function makePayloadFixture() {
  const root = trackTempDir("ct4-g8-payload-");
  fs.mkdirSync(path.join(root, "_next", "static", "chunks"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "<!doctype html><title>canil-gcm</title>\n");
  fs.writeFileSync(path.join(root, "_next", "static", "chunks", "main.js"), "console.log('prod');\n");
  fs.writeFileSync(path.join(root, "404.html"), "not found\n");
  return root;
}

function makePredeployWorkspaceFixture(options) {
  const opts = options || {};
  const hostingBuildId = opts.hostingBuildId || BUILD_ID;
  const functionsBuildId = opts.functionsBuildId || BUILD_ID;
  const root = trackTempDir("ct4-g8-predeploy-");

  fs.mkdirSync(path.join(root, "src", "lib", "firebase"), { recursive: true });
  fs.copyFileSync(
    path.join(REPO_ROOT, "src", "lib", "firebase", "config.ts"),
    path.join(root, "src", "lib", "firebase", "config.ts"),
  );
  fs.copyFileSync(path.join(REPO_ROOT, "firebase.json"), path.join(root, "firebase.json"));

  const hostingDir = path.join(root, ".firebase", "canil-gcm", "hosting");
  const functionsDir = path.join(root, ".firebase", "canil-gcm", "functions");
  fs.mkdirSync(path.join(hostingDir, "_next", "static", hostingBuildId), { recursive: true });
  fs.mkdirSync(path.join(hostingDir, "_next", "static", "chunks"), { recursive: true });
  fs.writeFileSync(path.join(hostingDir, "index.html"), "<!doctype html><html>prod</html>\n");
  fs.writeFileSync(path.join(hostingDir, "_next", "static", "chunks", "app.js"), "console.log('canil-gcm');\n");
  fs.writeFileSync(path.join(hostingDir, "_next", "static", hostingBuildId, "_buildManifest.js"), "self.__BM={};\n");

  // Hosting surface entries matching firebase-tools@15.25.1 listFiles() semantics:
  // Included descendants:
  fs.mkdirSync(path.join(hostingDir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(hostingDir, ".git", "config"), "[core]\n");
  fs.mkdirSync(path.join(hostingDir, ".well-known"), { recursive: true });
  fs.writeFileSync(path.join(hostingDir, ".well-known", "assetlinks.json"), "[]\n");
  fs.mkdirSync(path.join(hostingDir, ".firebase", "nested"), { recursive: true });
  fs.writeFileSync(path.join(hostingDir, ".firebase", "nested", "deep.txt"), "nested\n");
  fs.mkdirSync(path.join(hostingDir, "sub"), { recursive: true });
  fs.writeFileSync(path.join(hostingDir, "sub", "firebase.json"), "{\"nested\":true}\n");
  // Excluded entries on Hosting surface per listFiles + hosting.ignore:
  fs.writeFileSync(path.join(hostingDir, ".DS_Store"), "ignored-dotfile\n");
  fs.writeFileSync(path.join(hostingDir, "sub", ".DS_Store"), "ignored-sub-dotfile\n");
  fs.writeFileSync(path.join(hostingDir, ".well-known", ".hidden"), "ignored-hidden\n");
  fs.writeFileSync(path.join(hostingDir, ".firebase", "top.txt"), "ignored-firebase-top\n");
  fs.writeFileSync(path.join(hostingDir, "firebase.json"), "{}\n");
  fs.writeFileSync(path.join(hostingDir, "firebase-debug.log"), "debug\n");
  fs.writeFileSync(path.join(hostingDir, "sub", "firebase-debug.log"), "debug-sub\n");
  fs.mkdirSync(path.join(hostingDir, "node_modules", "ignored-pkg"), { recursive: true });
  fs.writeFileSync(path.join(hostingDir, "node_modules", "ignored-pkg", "index.js"), "x\n");

  fs.mkdirSync(path.join(functionsDir, ".next", "static", functionsBuildId), { recursive: true });
  fs.writeFileSync(path.join(functionsDir, ".next", "BUILD_ID"), `${functionsBuildId}\n`);
  fs.writeFileSync(path.join(functionsDir, ".next", "static", functionsBuildId, "_buildManifest.js"), "self.__BM={};\n");
  fs.writeFileSync(path.join(functionsDir, "server.js"), "exports.ssrcanilgcm = () => {};\n");
  fs.writeFileSync(path.join(functionsDir, ".env"), "__FIREBASE_FRAMEWORKS_ENTRY__=next.js\n");

  // Ignored entries on Functions surface per prepareFunctionsUpload:
  fs.mkdirSync(path.join(functionsDir, "node_modules", ".bin"), { recursive: true });
  fs.writeFileSync(path.join(functionsDir, "node_modules", "dep.js"), "module.exports = 1;\n");
  fs.mkdirSync(path.join(functionsDir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(functionsDir, ".git", "HEAD"), "ref: refs/heads/master\n");
  fs.writeFileSync(path.join(functionsDir, ".runtimeconfig.json"), "{}\n");
  fs.writeFileSync(path.join(functionsDir, "firebase-debug.log"), "debug\n");

  return root;
}

function expectFailure(fn, code) {
  let thrown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(
    thrown instanceof manifest.ManifestFailure,
    `expected ManifestFailure ${code}, got ${thrown === undefined ? "no failure" : thrown.stack}`,
  );
  assert.equal(thrown.code, code);
  return thrown;
}

// ------------------------------------------------------------ positive control

test("G8-P1: a clean payload fixture builds and validates with full §12 binding", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  assert.equal(built.version, manifest.MANIFEST_VERSION);
  assert.equal(built.mode, "directory");
  assert.equal(built.attestationScope, "DIRECTORY_FIXTURE");
  assert.equal(built.realUploaderHookAttested, false);
  assert.equal(built.binding.commit, COMMIT);
  assert.equal(built.binding.tree, TREE);
  assert.equal(built.binding.buildId, BUILD_ID);
  assert.equal(built.binding.identityDigest, manifest.CANONICAL_PRODUCTION_IDENTITY_DIGEST);
  assert.equal("firebaseIdentity" in built.binding, false);
  assert.equal(built.files.length, 3);
  assert.match(built.digest, /^[0-9a-f]{64}$/);
  const report = manifest.validateManifest(built, root, binding());
  assert.equal(report.result, "PASS");
  assert.equal(report.files, 3);
  assert.equal(report.realUploaderHookAttested, false);
});

test("G8-P2: the manifest is deterministic across two builds", () => {
  const root = makePayloadFixture();
  const a = manifest.buildManifest(root, binding());
  const b = manifest.buildManifest(root, binding());
  assert.equal(a.digest, b.digest);
});

// ------------------------------------------------------------------- T13

test("T13: attestation over a non-existent directory fails closed", () => {
  const missing = path.join(os.tmpdir(), "ct4-g8-does-not-exist-" + Date.now());
  expectFailure(() => manifest.buildManifest(missing, binding()), "E_ROOT_ABSENT");
  const built = manifest.buildManifest(makePayloadFixture(), binding());
  expectFailure(() => manifest.validateManifest(built, missing, binding()), "E_ROOT_ABSENT");
});

// ------------------------------------------------------------------- T14

test("T14: a manifest listing an absent file fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  fs.rmSync(path.join(root, "404.html"));
  expectFailure(() => manifest.validateManifest(built, root, binding()), "E_FILE_MISSING");
});

// ------------------------------------------------------------------- T15

test("T15: a hash that diverges from the manifest fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  fs.writeFileSync(path.join(root, "_next", "static", "chunks", "main.js"), "console.log('tampered');\n");
  expectFailure(() => manifest.validateManifest(built, root, binding()), "E_HASH_MISMATCH");
});

test("T15b: a manifest whose own digest was edited fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  const forged = { ...built, digest: "0".repeat(64) };
  expectFailure(() => manifest.validateManifest(forged, root, binding()), "E_MANIFEST_DIGEST");
});

test("T15c: a manifest with missing or empty digest fails closed (R1 bypass closed)", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  const omitted = { ...built };
  delete omitted.digest;
  expectFailure(() => manifest.validateManifest(omitted, root, binding()), "E_MANIFEST_DIGEST");
  expectFailure(() => manifest.validateManifest({ ...built, digest: "" }, root, binding()), "E_MANIFEST_DIGEST");
});

test("T15d: divergent entry.bytes or non-array files fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  const wrongBytes = {
    ...built,
    files: built.files.map((f, idx) => (idx === 0 ? { ...f, bytes: f.bytes + 1 } : f)),
  };
  expectFailure(() => manifest.validateManifest(wrongBytes, root, binding()), "E_SIZE_MISMATCH");
  expectFailure(() => manifest.validateManifest({ ...built, files: {} }, root, binding()), "E_MANIFEST_INVALID");
});

// ------------------------------------------------------------------- T16

test("T16: a file present on disk but not listed fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  fs.writeFileSync(path.join(root, "injected.html"), "unlisted\n");
  expectFailure(() => manifest.validateManifest(built, root, binding()), "E_UNLISTED_FILE");
});

test("T16b: path traversal or backslash entry paths fail closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  for (const badPath of ["../escape.html", "a/../index.html", "./index.html", "a\\b.js", "/index.html"]) {
    const forged = {
      ...built,
      files: [{ path: badPath, sha256: "0".repeat(64), bytes: 1 }],
    };
    expectFailure(() => manifest.validateManifest(forged, root, binding()), "E_PATH_TRAVERSAL");
  }
});

// ------------------------------------------------------------------- T17

test("T17: a divergent commit binding fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  expectFailure(
    () => manifest.validateManifest(built, root, binding({ commit: "0".repeat(40) })),
    "E_BINDING_MISMATCH",
  );
});

test("T17b: a divergent destination (site) fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  expectFailure(
    () => manifest.validateManifest(built, root, binding({ site: "k9-ops-staging" })),
    "E_BINDING_MISMATCH",
  );
});

test("T17c: a divergent project fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  expectFailure(
    () => manifest.validateManifest(built, root, binding({ project: "k9-ops-staging" })),
    "E_BINDING_MISMATCH",
  );
});

test("T17d: a divergent environment selector fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  expectFailure(
    () => manifest.validateManifest(built, root, binding({ selector: "staging" })),
    "E_BINDING_MISMATCH",
  );
});

test("T17e: a divergent run id fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  expectFailure(
    () => manifest.validateManifest(built, root, binding({ runId: "99999999999" })),
    "E_BINDING_MISMATCH",
  );
});

test("T17f: an incomplete binding fails closed", () => {
  const root = makePayloadFixture();
  expectFailure(() => manifest.buildManifest(root, { commit: COMMIT }), "E_BINDING_INCOMPLETE");
});

test("T17g: a manifest with no binding at all fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  const stripped = { ...built, binding: undefined };
  expectFailure(() => manifest.validateManifest(stripped, root, binding()), "E_BINDING_INCOMPLETE");
});

test("T17h: a divergent tree SHA binding fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  expectFailure(
    () => manifest.validateManifest(built, root, binding({ tree: "f".repeat(40) })),
    "E_BINDING_MISMATCH",
  );
});

test("T17i: a divergent buildId binding fails closed", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  expectFailure(
    () => manifest.validateManifest(built, root, binding({ buildId: "stale-other-build" })),
    "E_BINDING_MISMATCH",
  );
});

test("T17j: staging or hybrid firebaseIdentity / identityDigest fails closed without echoing secrets", () => {
  const root = makePayloadFixture();
  const errStaging = expectFailure(
    () => manifest.buildManifest(root, binding({ firebaseIdentity: STAGING_IDENTITY })),
    "E_IDENTITY_MISMATCH",
  );
  assert.equal(errStaging.message.includes(STAGING_IDENTITY.apiKey), false);

  const errHybrid = expectFailure(
    () =>
      manifest.buildManifest(
        root,
        binding({
          firebaseIdentity: {
            ...manifest.CANONICAL_PRODUCTION_IDENTITY,
            apiKey: STAGING_IDENTITY.apiKey,
          },
        }),
      ),
    "E_IDENTITY_MISMATCH",
  );
  assert.equal(errHybrid.message.includes(STAGING_IDENTITY.apiKey), false);

  const stagingDigest = manifest.computeIdentityDigest(STAGING_IDENTITY);
  expectFailure(
    () =>
      manifest.buildManifest(
        root,
        binding({ firebaseIdentity: undefined, identityDigest: stagingDigest }),
      ),
    "E_IDENTITY_MISMATCH",
  );
});

// ------------------------------------------------------------------- T18

test("T18: a manifest over .next alone is NOT_ACCEPTED_AS_G8", () => {
  const parent = trackTempDir("ct4-g8-nextonly-");
  const nextDir = path.join(parent, ".next");
  fs.mkdirSync(path.join(nextDir, "static"), { recursive: true });
  fs.writeFileSync(path.join(nextDir, "BUILD_ID"), "build-abc\n");
  fs.writeFileSync(path.join(nextDir, "static", "main.js"), "x\n");
  expectFailure(() => manifest.buildManifest(nextDir, binding()), "E_NOT_ACCEPTED_AS_G8");
  expectFailure(() => manifest.buildManifest(parent, binding()), "E_NOT_ACCEPTED_AS_G8");
});

test("T18b: a .next directory nested inside a real payload is allowed", () => {
  const root = makePayloadFixture();
  fs.mkdirSync(path.join(root, "functions", ".next"), { recursive: true });
  fs.writeFileSync(path.join(root, "functions", ".next", "BUILD_ID"), "build-abc\n");
  const built = manifest.buildManifest(root, binding());
  assert.equal(built.files.length, 4);
  assert.equal(manifest.validateManifest(built, root, binding()).result, "PASS");
});

// ------------------------------------------------------------- extra guards

test("G8-X1: a symbolic link or directory junction in the payload fails closed", () => {
  const root = makePayloadFixture();
  const outside = trackTempDir("ct4-g8-outside-");
  fs.writeFileSync(path.join(outside, "leak.html"), "external\n");
  const link = path.join(root, "escape-dir");
  try {
    fs.symlinkSync(outside, link, "junction");
  } catch {
    return;
  }
  expectFailure(() => manifest.buildManifest(root, binding()), "E_LINK_UNPROVABLE");
});

test("G8-X2: an empty payload fails closed", () => {
  const root = trackTempDir("ct4-g8-empty-");
  expectFailure(() => manifest.buildManifest(root, binding()), "E_EMPTY_PAYLOAD");
});

test("G8-X3: claiming realUploaderHookAttested=true fails closed locally", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  const forged = { ...built, realUploaderHookAttested: true };
  expectFailure(
    () => manifest.validateManifest(forged, root, binding()),
    "E_UNSUPPORTED_ATTESTATION_CLAIM",
  );
});

// ------------------------------------------------------- firebase-predeploy

test("G8-PRE1: dual-surface firebase-predeploy builds, filters ignores accurately, and validates", () => {
  const root = makePredeployWorkspaceFixture();
  const built = manifest.buildPredeployManifest(root, binding());
  assert.equal(built.version, manifest.MANIFEST_VERSION);
  assert.equal(built.mode, "firebase-predeploy");
  assert.equal(built.attestationScope, "PREDEPLOY_MATERIALIZED_SURFACES");
  assert.equal(built.realUploaderHookAttested, false);

  const hostingPaths = built.surfaces.hosting.files.map((f) => f.path);
  assert.deepEqual(hostingPaths, [
    ".firebase/nested/deep.txt",
    ".git/config",
    ".well-known/assetlinks.json",
    "_next/static/chunks/app.js",
    `_next/static/${BUILD_ID}/_buildManifest.js`,
    "index.html",
    "sub/firebase.json",
  ]);

  const functionsPaths = built.surfaces.functions.files.map((f) => f.path);
  assert.deepEqual(functionsPaths, [
    ".env",
    ".next/BUILD_ID",
    `.next/static/${BUILD_ID}/_buildManifest.js`,
    "server.js",
  ]);

  const report = manifest.validatePredeployManifest(built, root, binding());
  assert.equal(report.result, "PASS");
  assert.equal(report.realUploaderHookAttested, false);
  assert.equal(report.surfaces.hosting.files, 7);
  assert.equal(report.surfaces.functions.files, 4);

  // Tamper Functions surface -> fails closed
  fs.writeFileSync(path.join(root, ".firebase", "canil-gcm", "functions", "server.js"), "tampered\n");
  expectFailure(() => manifest.validatePredeployManifest(built, root, binding()), "E_HASH_MISMATCH");
});

test("G8-PRE2: raw .next without .firebase/canil-gcm fails closed with E_PREDEPLOY_SURFACES_ABSENT", () => {
  const root = trackTempDir("ct4-g8-nopredeploy-");
  fs.mkdirSync(path.join(root, "src", "lib", "firebase"), { recursive: true });
  fs.copyFileSync(
    path.join(REPO_ROOT, "src", "lib", "firebase", "config.ts"),
    path.join(root, "src", "lib", "firebase", "config.ts"),
  );
  fs.copyFileSync(path.join(REPO_ROOT, "firebase.json"), path.join(root, "firebase.json"));
  fs.mkdirSync(path.join(root, ".next"), { recursive: true });
  fs.writeFileSync(path.join(root, ".next", "BUILD_ID"), `${BUILD_ID}\n`);

  expectFailure(
    () => manifest.buildPredeployManifest(root, binding()),
    "E_PREDEPLOY_SURFACES_ABSENT",
  );
});

test("G8-PRE3: BUILD_ID mismatch between hosting and functions fails closed", () => {
  const root = makePredeployWorkspaceFixture({
    hostingBuildId: "stale-hosting-build",
    functionsBuildId: BUILD_ID,
  });
  expectFailure(
    () => manifest.buildPredeployManifest(root, binding()),
    "E_BUILD_ID_MISMATCH",
  );
});

test("G8-PRE4: CLI --from-env builds, validates, and fails closed on staging/tamper/usage", () => {
  const root = makePredeployWorkspaceFixture();
  const outManifest = path.join(root, ".firebase", "canil-gcm-g8-predeploy-manifest.json");
  const prodEnv = {
    ...process.env,
    CT4_GIT_COMMIT_SHA: COMMIT,
    CT4_GIT_TREE_SHA: TREE,
    CT4_FIREBASE_SITE: "canil-gcm",
    CT4_FIREBASE_CLI_VERSION: "15.25.1",
    CT4_RUN_ID: "43645547728",
    CT4_RUN_ATTEMPT: "1",
    NEXT_PUBLIC_APP_ENV: "production",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: manifest.CANONICAL_PRODUCTION_IDENTITY.projectId,
    NEXT_PUBLIC_FIREBASE_API_KEY: manifest.CANONICAL_PRODUCTION_IDENTITY.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: manifest.CANONICAL_PRODUCTION_IDENTITY.authDomain,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: manifest.CANONICAL_PRODUCTION_IDENTITY.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: manifest.CANONICAL_PRODUCTION_IDENTITY.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: manifest.CANONICAL_PRODUCTION_IDENTITY.appId,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: manifest.CANONICAL_PRODUCTION_IDENTITY.measurementId,
  };

  const buildRes = spawnSync(
    process.execPath,
    [CLI_PATH, "build", "--mode", "firebase-predeploy", "--root", root, "--from-env", "--out", outManifest],
    { env: prodEnv, encoding: "utf8" },
  );
  assert.equal(buildRes.status, 0, buildRes.stderr);

  const valRes = spawnSync(
    process.execPath,
    [CLI_PATH, "validate", "--mode", "firebase-predeploy", "--root", root, "--from-env", "--manifest", outManifest],
    { env: prodEnv, encoding: "utf8" },
  );
  assert.equal(valRes.status, 0, valRes.stderr);
  const parsedOut = JSON.parse(valRes.stdout);
  assert.equal(parsedOut.result, "PASS");
  assert.equal(parsedOut.realUploaderHookAttested, false);

  // Staging env must fail closed
  const stagingEnv = {
    ...prodEnv,
    NEXT_PUBLIC_APP_ENV: "staging",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: STAGING_IDENTITY.projectId,
    NEXT_PUBLIC_FIREBASE_API_KEY: STAGING_IDENTITY.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: STAGING_IDENTITY.authDomain,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: STAGING_IDENTITY.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: STAGING_IDENTITY.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: STAGING_IDENTITY.appId,
  };
  const stagingRes = spawnSync(
    process.execPath,
    [CLI_PATH, "validate", "--mode", "firebase-predeploy", "--root", root, "--from-env", "--manifest", outManifest],
    { env: stagingEnv, encoding: "utf8" },
  );
  assert.equal(stagingRes.status, 1);
  assert.match(stagingRes.stderr, /FAIL E_BINDING_MISMATCH|FAIL E_IDENTITY_MISMATCH/);

  // Missing --manifest must emit E_USAGE, never E_INTERNAL
  const missingFlagRes = spawnSync(
    process.execPath,
    [CLI_PATH, "validate", "--mode", "firebase-predeploy", "--root", root, "--from-env"],
    { env: prodEnv, encoding: "utf8" },
  );
  assert.equal(missingFlagRes.status, 1);
  assert.match(missingFlagRes.stderr, /FAIL E_USAGE/);
  assert.equal(missingFlagRes.stderr.includes("E_INTERNAL"), false);

  // Tamper hosting surface file -> fail closed with E_HASH_MISMATCH
  fs.writeFileSync(path.join(root, ".firebase", "canil-gcm", "hosting", "index.html"), "tampered\n");
  const tamperRes = spawnSync(
    process.execPath,
    [CLI_PATH, "validate", "--mode", "firebase-predeploy", "--root", root, "--from-env", "--manifest", outManifest],
    { env: prodEnv, encoding: "utf8" },
  );
  assert.equal(tamperRes.status, 1);
  assert.match(tamperRes.stderr, /FAIL E_HASH_MISMATCH/);
});

test("G8-PRE5: makeHostingMatcher and makeFunctionsMatcher match firebase-tools@15.25.1 inclusion matrix on bare Node", () => {
  const hostRoot = trackTempDir("ct4-g8-hparity-");
  const hostingInputs = [
    "index.html",
    "_next/static/chunks/app.js",
    "firebase.json",
    "sub/firebase.json",
    ".DS_Store",
    "sub/.DS_Store",
    ".git/config",
    "sub/.git/config",
    ".well-known/assetlinks.json",
    ".well-known/.hidden",
    ".firebase/top.txt",
    ".firebase/nested/deep.txt",
    ".firebase/.hidden",
    "firebase-debug.log",
    "sub/firebase-debug.log",
    "sub/firebase-debug.123.log",
    "node_modules/pkg/index.js",
    "sub/node_modules/pkg/index.js",
  ];
  for (const rel of hostingInputs) {
    const full = path.join(hostRoot, ...rel.split("/"));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "x\n");
  }
  const hActual = manifest
    .walkFiles(hostRoot, manifest.makeHostingMatcher(["firebase.json", "**/.*", "**/node_modules/**"]))
    .map((f) => f.relPosix);
  assert.deepEqual(hActual, [
    ".firebase/nested/deep.txt",
    ".git/config",
    ".well-known/assetlinks.json",
    "_next/static/chunks/app.js",
    "index.html",
    "sub/.git/config",
    "sub/firebase.json",
  ]);

  const fnRoot = trackTempDir("ct4-g8-fparity-");
  const fnInputs = [
    ".env",
    ".next/BUILD_ID",
    ".next/server/app/page.js",
    "server.js",
    "node_modules/dep/index.js",
    ".git/HEAD",
    ".runtimeconfig.json",
    "sub/.runtimeconfig.json",
    "firebase-debug.log",
    "sub/firebase-debug.99.log",
  ];
  for (const rel of fnInputs) {
    const full = path.join(fnRoot, ...rel.split("/"));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "x\n");
  }
  const fActual = manifest.walkFiles(fnRoot, manifest.makeFunctionsMatcher()).map((f) => f.relPosix);
  assert.deepEqual(fActual, [
    ".env",
    ".next/BUILD_ID",
    ".next/server/app/page.js",
    "server.js",
  ]);
});

test("G8-PRE6: predeploy manifest without non-empty limitation disclosure fails closed (F-R2-02)", () => {
  const root = makePredeployWorkspaceFixture();
  const built = manifest.buildPredeployManifest(root, binding());
  const missingLim = { ...built };
  delete missingLim.limitation;
  expectFailure(
    () => manifest.validatePredeployManifest(missingLim, root, binding()),
    "E_MANIFEST_INVALID",
  );
  expectFailure(
    () => manifest.validatePredeployManifest({ ...built, limitation: "   " }, root, binding()),
    "E_MANIFEST_INVALID",
  );
});

test("G8-F12: non-NFC Unicode path fails closed on validateRelativePath and on disk", () => {
  const nfd = "cafe\u0301.html";
  assert.notEqual(nfd, nfd.normalize("NFC"));
  expectFailure(() => manifest.validateRelativePath(nfd), "E_NON_NFC_PATH");

  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  const forged = {
    ...built,
    files: [{ path: nfd, sha256: "0".repeat(64), bytes: 1 }],
  };
  expectFailure(() => manifest.validateManifest(forged, root, binding()), "E_NON_NFC_PATH");

  // Also test actual NFD filename on disk (works cleanly on Windows & Linux)
  const nfdRoot = makePayloadFixture();
  fs.writeFileSync(path.join(nfdRoot, nfd), "nfd\n");
  expectFailure(() => manifest.buildManifest(nfdRoot, binding()), "E_NON_NFC_PATH");
});

test("G8-F26: case-insensitive path collisions fail closed in manifest and on case-sensitive filesystems", () => {
  const root = makePayloadFixture();
  const built = manifest.buildManifest(root, binding());
  const collidingManifest = {
    ...built,
    files: [
      ...built.files,
      { path: "INDEX.HTML", sha256: built.files[0].sha256, bytes: built.files[0].bytes },
    ],
  };
  expectFailure(() => manifest.validateManifest(collidingManifest, root, binding()), "E_CASE_COLLISION");

  // On case-sensitive filesystems (Linux), creating Index.html beside index.html must fail closed.
  const csRoot = makePayloadFixture();
  fs.writeFileSync(path.join(csRoot, "Index.html"), "upper\n");
  const distinctOnDisk = fs.existsSync(path.join(csRoot, "index.html")) &&
    fs.readdirSync(csRoot).includes("Index.html") &&
    fs.readdirSync(csRoot).includes("index.html");
  if (distinctOnDisk) {
    expectFailure(() => manifest.buildManifest(csRoot, binding()), "E_CASE_COLLISION");
  }
});

test("G8-GIT1: verifyGitBinding fails closed when .git is absent", () => {
  const root = makePayloadFixture();
  expectFailure(() => manifest.verifyGitBinding(root, binding()), "E_GIT_BINDING_MISMATCH");
});
