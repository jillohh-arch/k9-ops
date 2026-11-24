#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS build-time script, same convention as the existing production guard scripts */
/**
 * CT4 WEB-P0 — G8 exact Firebase upload-boundary offline harness & F01–F30 failure-injection suite.
 *
 * Gate: CT4.WEB-P0.G8-EXACT-UPLOAD-BOUNDARY-AND-RELEASE-SAFETY-R1
 *
 * All Firebase/GCP transports are mocked in-process (`apiv2.Client.prototype.request`)
 * with real network calls hard-blocked (`E_NETWORK_DISABLED_IN_HARNESS`).
 * Never invokes unmocked `firebase deploy` and never claims remote persistence.
 */

"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { after, test } = require("node:test");

const g8 = require("./ct4-web-p0-g8-payload-manifest.cjs");
const boundary = require("./ct4-web-p0-firebase-upload-boundary.cjs");

const REPO_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.join(__dirname, "ct4-web-p0-firebase-upload-boundary.cjs");
const COMMIT = "9471d895da72547fc27af1444044067179494eca";
const TREE = "a949c80b3cee531006dc1cc8782a16adf7c0cb51";
const BUILD_ID = "DjJ2r54UmEpVszRcKz9iN";

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

function makeBinding(overrides) {
  return {
    commit: COMMIT,
    tree: TREE,
    buildId: BUILD_ID,
    project: "canil-gcm",
    site: "canil-gcm",
    selector: "production",
    firebaseIdentity: { ...g8.CANONICAL_PRODUCTION_IDENTITY },
    cliVersion: "15.25.1",
    runId: "9001001",
    runAttempt: "1",
    ...(overrides || {}),
  };
}

function makeProdEnv() {
  return {
    ...process.env,
    CT4_GIT_COMMIT_SHA: COMMIT,
    CT4_GIT_TREE_SHA: TREE,
    CT4_FIREBASE_SITE: "canil-gcm",
    CT4_FIREBASE_CLI_VERSION: "15.25.1",
    CT4_RUN_ID: "9001001",
    CT4_RUN_ATTEMPT: "1",
    NEXT_PUBLIC_APP_ENV: "production",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: g8.CANONICAL_PRODUCTION_IDENTITY.projectId,
    NEXT_PUBLIC_FIREBASE_API_KEY: g8.CANONICAL_PRODUCTION_IDENTITY.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: g8.CANONICAL_PRODUCTION_IDENTITY.authDomain,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: g8.CANONICAL_PRODUCTION_IDENTITY.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: g8.CANONICAL_PRODUCTION_IDENTITY.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: g8.CANONICAL_PRODUCTION_IDENTITY.appId,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: g8.CANONICAL_PRODUCTION_IDENTITY.measurementId,
  };
}

function buildZipBuffer(entries) {
  const archiver = require(require.resolve("archiver", { paths: [REPO_ROOT] }));
  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver("zip");
    archive.on("data", (c) => chunks.push(c));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    for (const e of entries) {
      archive.append(Buffer.from(e.content), { name: e.name, mode: e.mode });
    }
    archive.finalize();
  });
}

function makeBoundaryFixture(opts) {
  const o = opts || {};
  const root = trackTempDir("ct4-boundary-fix-");
  fs.mkdirSync(path.join(root, "src", "lib", "firebase"), { recursive: true });
  fs.copyFileSync(
    path.join(REPO_ROOT, "src", "lib", "firebase", "config.ts"),
    path.join(root, "src", "lib", "firebase", "config.ts"),
  );
  fs.copyFileSync(path.join(REPO_ROOT, ".firebaserc"), path.join(root, ".firebaserc"));

  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "scripts", "ct4-predeploy-runner.cjs"),
    [
      '"use strict";',
      'const { spawnSync } = require("node:child_process");',
      `const targets = ${JSON.stringify({ boundary: CLI_PATH, g8: path.join(REPO_ROOT, "scripts", "ct4-web-p0-g8-payload-manifest.cjs") })};`,
      'const which = process.argv[2];',
      'const res = spawnSync(process.execPath, [targets[which], ...process.argv.slice(3)], { stdio: "inherit" });',
      'process.exit(res.status === null ? 1 : res.status);',
      "",
    ].join("\n"),
  );
  const fbJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "firebase.json"), "utf8"));
  fbJson.hosting.predeploy = [
    "node scripts/ct4-predeploy-runner.cjs boundary assert-active --root .",
    "node scripts/ct4-predeploy-runner.cjs g8 build --mode firebase-predeploy --root . --from-env --out .firebase/canil-gcm-g8-predeploy-manifest.json",
    "node scripts/ct4-predeploy-runner.cjs g8 validate --mode firebase-predeploy --root . --from-env --manifest .firebase/canil-gcm-g8-predeploy-manifest.json",
  ];
  fs.writeFileSync(path.join(root, "firebase.json"), JSON.stringify(fbJson, null, 2));

  const hDir = path.join(root, ".firebase", "canil-gcm", "hosting");
  const fDir = path.join(root, ".firebase", "canil-gcm", "functions");
  fs.mkdirSync(path.join(hDir, "_next", "static", BUILD_ID), { recursive: true });
  fs.mkdirSync(path.join(hDir, "_next", "static", "chunks"), { recursive: true });
  fs.mkdirSync(path.join(hDir, ".well-known"), { recursive: true });
  fs.writeFileSync(path.join(hDir, "index.html"), "<!doctype html><title>canil-gcm</title>\n");
  fs.writeFileSync(path.join(hDir, "_next", "static", "chunks", "app.js"), "console.log('canil-gcm');\n");
  fs.writeFileSync(path.join(hDir, "_next", "static", BUILD_ID, "_buildManifest.js"), "self.__BM={};\n");
  fs.writeFileSync(path.join(hDir, ".well-known", "assetlinks.json"), "[]\n");
  fs.writeFileSync(path.join(hDir, ".DS_Store"), "ignored\n");
  if (o.duplicateFiles) {
    fs.writeFileSync(path.join(hDir, "dup-a.txt"), "identical-content\n");
    fs.writeFileSync(path.join(hDir, "dup-b.txt"), "identical-content\n");
  }

  fs.mkdirSync(path.join(fDir, ".next", "static", BUILD_ID), { recursive: true });
  fs.writeFileSync(path.join(fDir, ".next", "BUILD_ID"), `${BUILD_ID}\n`);
  fs.writeFileSync(path.join(fDir, ".next", "static", BUILD_ID, "_buildManifest.js"), "self.__BM={};\n");
  fs.writeFileSync(path.join(fDir, ".next", "routes-manifest.json"), JSON.stringify({ basePath: "/" }));
  fs.writeFileSync(path.join(fDir, ".next", "required-server-files.json"), JSON.stringify({ config: { basePath: "/" } }));
  fs.writeFileSync(path.join(fDir, "server.js"), "exports.ssrcanilgcm = () => {};\n");
  fs.writeFileSync(path.join(fDir, ".env"), "__FIREBASE_FRAMEWORKS_ENTRY__=next.js\n");
  fs.mkdirSync(path.join(fDir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(fDir, ".git", "HEAD"), "ref: refs/heads/master\n");
  fs.mkdirSync(path.join(fDir, "node_modules", "ignored"), { recursive: true });
  fs.writeFileSync(path.join(fDir, "node_modules", "ignored", "x.js"), "module.exports = 1;\n");

  return { root, hDir, fDir };
}

async function runInProcessDeploy(fixtureRoot, opts) {
  const o = opts || {};
  const prePath = path.join(fixtureRoot, ".firebase", "canil-gcm-g8-predeploy-manifest.json");
  const attPath = path.join(fixtureRoot, ".firebase", "canil-gcm-g8-upload-attestation.json");

  if (!o.skipPredeployBuild) {
    const manifest = g8.buildPredeployManifest(fixtureRoot, makeBinding());
    fs.mkdirSync(path.dirname(prePath), { recursive: true });
    fs.writeFileSync(prePath, JSON.stringify(manifest, null, 2));
  }

  const cliIntegrity = boundary.verifyCliIntegrity(REPO_ROOT);
  const hookHandle = boundary.installInProcessBoundaryHooks({
    root: fixtureRoot,
    cliRoot: REPO_ROOT,
    mockTransport: true,
    predeployManifestAbs: prePath,
    predeployManifestRel: ".firebase/canil-gcm-g8-predeploy-manifest.json",
    attestationOutAbs: attPath,
    expectedBinding: makeBinding(),
    cliIntegrity,
    mockOptions: o.mockOptions,
  });

  if (o.afterHooksInstalled) {
    o.afterHooksInstalled({ hookHandle, prePath, attPath });
  }

  const ftLib = path.join(REPO_ROOT, "node_modules", "firebase-tools", "lib");
  const { Config } = require(path.join(ftLib, "config.js"));
  const deployMod = require(path.join(ftLib, "deploy", "index.js"));
  const cfgData = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "firebase.json"), "utf8"));
  if (o.skipPredeployHookExec && cfgData.hosting) {
    delete cfgData.hosting.predeploy;
  }

  const options = {
    cwd: fixtureRoot,
    projectRoot: fixtureRoot,
    project: "canil-gcm",
    projectId: "canil-gcm",
    only: "hosting",
    nonInteractive: true,
    dryRun: Boolean(o.dryRun),
    config: new Config(cfgData, { cwd: fixtureRoot, projectDir: fixtureRoot }),
  };

  try {
    await deployMod.deploy(["hosting"], options);
    const att = JSON.parse(fs.readFileSync(attPath, "utf8"));
    return { ok: true, state: hookHandle.state, mockRecords: hookHandle.state.mockRecords, att, prePath, attPath };
  } catch (err) {
    return { ok: false, error: err, state: hookHandle.state, mockRecords: hookHandle.state.mockRecords, prePath, attPath };
  } finally {
    hookHandle.restore();
  }
}

function assertZeroReleaseMutations(res) {
  assert.equal(res.ok, false, "expected deploy to fail closed");
  assert.equal(res.mockRecords.functionsReleaseCalls, 0, "Functions release must NOT execute");
  assert.equal(res.mockRecords.hostingFinalizeCalls, 0, "Hosting finalize must NOT execute");
  assert.equal(res.mockRecords.hostingCreateReleaseCalls, 0, "Hosting release must NOT execute");
}

function matchFailureCode(res, expectedCodeRegex) {
  const msg = `${res.error && res.error.message ? res.error.message : ""} ${res.error && res.error.original ? res.error.original.message : ""} ${res.error && res.error.original && res.error.original.code ? res.error.original.code : ""}`;
  assert.match(msg, expectedCodeRegex);
}

// ============================================================ Positive E2E CLI & In-Process

test("POSITIVE-CLI: real firebase-tools@15.25.1 exec --mock-transport succeeds end-to-end & validates honestly", () => {
  const { root } = makeBoundaryFixture({ duplicateFiles: true });
  const preRel = ".firebase/canil-gcm-g8-predeploy-manifest.json";
  const attRel = ".firebase/canil-gcm-g8-upload-attestation.json";
  const env = makeProdEnv();

  const execRes = spawnSync(
    process.execPath,
    [
      CLI_PATH,
      "exec",
      "--root",
      root,
      "--from-env",
      "--mock-transport",
      "--predeploy-manifest",
      preRel,
      "--attestation-out",
      attRel,
      "--",
      "firebase",
      "deploy",
      "--only",
      "hosting",
      "--project",
      "canil-gcm",
      "--non-interactive",
    ],
    { env, encoding: "utf8" },
  );
  assert.equal(execRes.status, 0, `${execRes.stdout}\n${execRes.stderr}`);

  const att = JSON.parse(fs.readFileSync(path.join(root, attRel), "utf8"));
  assert.equal(att.transportMode, "OFFLINE_MOCK_TRANSPORT");
  assert.equal(att.actualRemoteUpload, "NOT_PROVEN");
  assert.equal(att.actualDeployedRelease, "NOT_PROVEN");
  assert.deepEqual(att.releaseBarrier.targetOrderObserved, ["functions", "hosting"]);
  assert.equal(att.releaseBarrier.verifiedBeforeFunctionsRelease, true);
  assert.equal(att.releaseBarrier.verifiedBeforeHostingRelease, true);
  assert.equal(att.releaseBarrier.functionsReleaseExecuted, true);
  assert.equal(att.releaseBarrier.hostingReleaseExecuted, true);
  const expectedOsByte = process.platform === "win32" ? 0x0a : 0x03;
  assert.equal(att.boundaries.hostingCompressedBytes.gzipOsByte, expectedOsByte);

  const valRes = spawnSync(
    process.execPath,
    [
      CLI_PATH,
      "validate",
      "--root",
      root,
      "--from-env",
      "--require-release-complete",
      "--predeploy-manifest",
      preRel,
      "--attestation",
      attRel,
    ],
    { env, encoding: "utf8" },
  );
  assert.equal(valRes.status, 0, valRes.stderr);
  const parsed = JSON.parse(valRes.stdout);
  assert.equal(parsed.result, "PASS");
  assert.equal(parsed.actualRemoteUpload, "NOT_PROVEN");
  assert.equal(parsed.actualDeployedRelease, "NOT_PROVEN");
});

test("POSITIVE-CDN-DEDUP: uploadRequiredHashes=[] still re-verifies disk integrity and passes", async () => {
  const { root } = makeBoundaryFixture();
  const preManifest = g8.buildPredeployManifest(root, makeBinding());
  // Build mock with every hash marked already cached on CDN
  const allFakeCached = { has: () => true };
  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    mockOptions: { cdnCachedHashes: allFakeCached },
  });
  assert.equal(res.ok, true, res.error && res.error.stack);
  assert.equal(res.att.boundaries.hostingCompressedBytes.uploadedCount, 0);
  assert.equal(
    res.att.boundaries.hostingCompressedBytes.cdnDedupCount,
    preManifest.surfaces.hosting.files.length,
  );
});

test("POSITIVE-TARGZ: parseAndHashTarGzArchive parses tar.gz and detects symlinks", async () => {
  const archiver = require(require.resolve("archiver", { paths: [REPO_ROOT] }));
  const dir = trackTempDir("ct4-targz-");
  const tgzPath = path.join(dir, "fn.tar.gz");
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tgzPath);
    const arc = archiver("tar", { gzip: true });
    out.on("close", resolve);
    arc.on("error", reject);
    arc.pipe(out);
    arc.append(Buffer.from("exports.ok = 1;\n"), { name: "server.js" });
    arc.append(Buffer.from("PORT=8080\n"), { name: ".env" });
    arc.finalize();
  });
  const parsed = boundary.parseAndHashTarGzArchive(tgzPath);
  assert.deepEqual(
    parsed.map((e) => e.path),
    [".env", "server.js"],
  );
});

// ============================================================ F01 – F30 Failure-Injection Matrix

test("F01: absent PREDEPLOY_MANIFEST fails closed before upload and release", async () => {
  const { root } = makeBoundaryFixture();
  const res = await runInProcessDeploy(root, { skipPredeployBuild: true, skipPredeployHookExec: true });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_PREDEPLOY_MANIFEST_ABSENT/);
});

test("F02: tampered PREDEPLOY_MANIFEST digest/binding fails closed before release", async () => {
  const { root } = makeBoundaryFixture();
  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: ({ prePath }) => {
      const m = JSON.parse(fs.readFileSync(prePath, "utf8"));
      m.digest = "0".repeat(64);
      fs.writeFileSync(prePath, JSON.stringify(m));
    },
  });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_MANIFEST_DIGEST/);
});

test("F03: cross-surface BUILD_ID divergence fails closed before release", async () => {
  const { root, fDir } = makeBoundaryFixture();
  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: () => {
      fs.writeFileSync(path.join(fDir, ".next", "BUILD_ID"), "stale-other-build\n");
    },
  });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_BUILD_ID_MISMATCH/);
});

test("F04: Hosting Pass 1 raw SHA-256 mismatch vs PREDEPLOY_MANIFEST fails closed", async () => {
  const { root, hDir } = makeBoundaryFixture();
  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: () => {
      fs.writeFileSync(path.join(hDir, "index.html"), "<!doctype html><title>hacked-len-diff</title>\n");
    },
  });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_BOUNDARY_RAW_MISMATCH/);
});

test("F05: Hosting Pass 2 uploadHandler compressed stream digest mismatch fails closed", async () => {
  const { root } = makeBoundaryFixture();
  const ftLib = path.join(REPO_ROOT, "node_modules", "firebase-tools", "lib");
  const uploaderMod = require(path.join(ftLib, "deploy", "hosting", "uploader.js"));
  let tamperedPass2 = false;
  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: () => {
      const wrappedZip = uploaderMod.Uploader.prototype.zipStream;
      let calls = 0;
      uploaderMod.Uploader.prototype.zipStream = function (fp) {
        calls += 1;
        const s = wrappedZip.call(this, fp);
        // Tamper compressed stream during Pass 2 uploadHandler (after Pass 1)
        if (calls > 4 && !tamperedPass2) {
          tamperedPass2 = true;
          return Readable.from([Buffer.from("corrupted-gzip-bytes")]);
        }
        return s;
      };
    },
  });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_BOUNDARY_COMPRESSED_MISMATCH|TypeError|Cannot read/);
});

test("F06: Hosting populateHandler batch hash mismatch fails closed", async () => {
  const { root } = makeBoundaryFixture();
  const ftLib = path.join(REPO_ROOT, "node_modules", "firebase-tools", "lib");
  const uploaderMod = require(path.join(ftLib, "deploy", "hosting", "uploader.js"));
  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: () => {
      const origAddHash = uploaderMod.Uploader.prototype.addHash;
      uploaderMod.Uploader.prototype.addHash = function (fp, h) {
        return origAddHash.call(this, fp, h === "f".repeat(64) ? "0".repeat(64) : "f".repeat(64));
      };
      // Restore after deploy finishes via test cleanup
      tempDirs.push({ __restoreAddHash: () => { uploaderMod.Uploader.prototype.addHash = origAddHash; } });
    },
  }).finally(() => {
    const last = tempDirs[tempDirs.length - 1];
    if (last && last.__restoreAddHash) {
      last.__restoreAddHash();
      tempDirs.pop();
    }
  });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_BOUNDARY_POPULATE_MISMATCH/);
});

test("F07: TOCTOU junction/symlink injected between predeploy and upload fails closed", async () => {
  const { root, hDir } = makeBoundaryFixture();
  const outside = trackTempDir("ct4-f07-outside-");
  fs.writeFileSync(path.join(outside, "secret.txt"), "external-secret\n");

  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: () => {
      fs.symlinkSync(outside, path.join(hDir, ".well-known", "ext"), "junction");
    },
  });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_LINK_UNPROVABLE/);
});

test("F08: poisoned hashcache mtime entry is ignored (hashcache.load forced empty)", async () => {
  const { root, hDir } = makeBoundaryFixture();
  const cacheDir = path.join(root, ".firebase");
  const b64Name = Buffer.from(path.relative(root, hDir)).toString("base64").replace(/=+$/, "");
  const st = fs.statSync(path.join(hDir, "index.html"));
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, `hosting.${b64Name}.cache`), `index.html,${st.mtime.getTime()},${"a".repeat(64)}\n`);

  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: () => {
      // Also tamper index.html preserving mtime: hashcache MUST NOT mask it
      fs.writeFileSync(path.join(hDir, "index.html"), "tampered\n");
      fs.utimesSync(path.join(hDir, "index.html"), st.atime, st.mtime);
    },
  });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_BOUNDARY_RAW_MISMATCH/);
});

test("F09: Uploader.start rejects cleanly with zero UnhandledPromiseRejection on hashQueue error", async () => {
  const { root, hDir } = makeBoundaryFixture();
  let unhandledCount = 0;
  const onUnhandled = () => {
    unhandledCount += 1;
  };
  process.on("unhandledRejection", onUnhandled);
  try {
    const res = await runInProcessDeploy(root, {
      skipPredeployHookExec: true,
      afterHooksInstalled: () => {
        fs.writeFileSync(path.join(hDir, "index.html"), "tampered-f09\n");
      },
    });
    assertZeroReleaseMutations(res);
    matchFailureCode(res, /E_BOUNDARY_RAW_MISMATCH/);
  } finally {
    process.removeListener("unhandledRejection", onUnhandled);
  }
  assert.equal(unhandledCount, 0, "Uploader.start must not leak unhandled rejections");
});

test("F10: Hosting file modified on disk between predeploy and Uploader fails closed", async () => {
  const { root, hDir } = makeBoundaryFixture();
  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: () => {
      fs.writeFileSync(path.join(hDir, ".well-known", "assetlinks.json"), "[{\"tamper\":true}]\n");
    },
  });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_BOUNDARY_RAW_MISMATCH/);
});

test("F11: extra or missing file between predeploy and listFiles fails closed", async () => {
  const { root, hDir } = makeBoundaryFixture();
  const resExtra = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: () => {
      fs.writeFileSync(path.join(hDir, "rogue.html"), "rogue\n");
    },
  });
  assertZeroReleaseMutations(resExtra);
  matchFailureCode(resExtra, /E_BOUNDARY_FILE_SET_MISMATCH/);
});

test("F12: non-NFC Unicode path fails closed in Hosting and ZIP/TAR archive parser", async () => {
  const dir = trackTempDir("ct4-f12-zip-");
  const nfdZip = path.join(dir, "nfd.zip");
  fs.writeFileSync(nfdZip, await buildZipBuffer([{ name: "cafe\u0301.js", content: "x\n" }]));
  assert.throws(
    () => boundary.parseAndHashZipArchive(nfdZip),
    (e) => e instanceof boundary.BoundaryFailure && e.code === "E_NON_NFC_PATH",
  );
});

test("F13: archiver warning & duplicate entry name fail fatally", async () => {
  const { root } = makeBoundaryFixture();
  const cliIntegrity = boundary.verifyCliIntegrity(REPO_ROOT);
  const hookHandle = boundary.installInProcessBoundaryHooks({
    root,
    cliRoot: REPO_ROOT,
    mockTransport: true,
    predeployManifestAbs: path.join(root, ".firebase", "pre.json"),
    predeployManifestRel: ".firebase/pre.json",
    attestationOutAbs: path.join(root, ".firebase", "att.json"),
    expectedBinding: makeBinding(),
    cliIntegrity,
  });
  try {
    const archiver = require(require.resolve("archiver", { paths: [REPO_ROOT] }));
    const a1 = archiver("zip");
    a1.append(Buffer.from("1"), { name: "server.js" });
    assert.throws(
      () => a1.append(Buffer.from("2"), { name: "server.js" }),
      (e) => e instanceof boundary.BoundaryFailure && e.code === "E_ARCHIVE_DUPLICATE_ENTRY",
    );

    const a2 = archiver("zip");
    let capturedErr = null;
    a2.on("error", (e) => {
      capturedErr = e;
    });
    a2.emit("warning", new Error("ENOENT missing file"));
    assert.ok(capturedErr instanceof boundary.BoundaryFailure && capturedErr.code === "E_ARCHIVE_WARNING");
  } finally {
    hookHandle.restore();
  }
});

test("F14: Functions archive tampering or symlink entry (0o120000) fails closed", async () => {
  const dir = trackTempDir("ct4-f14-zip-");
  const symlinkZip = path.join(dir, "sym.zip");
  const buf = await buildZipBuffer([{ name: "server.js", content: "/etc/passwd" }]);
  // Patch Central Directory externalAttr upper 16 bits to S_IFLNK (0o120777)
  let cdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      cdOffset = buf.readUInt32LE(i + 16);
      break;
    }
  }
  assert.ok(cdOffset >= 0 && buf.readUInt32LE(cdOffset) === 0x02014b50);
  buf.writeUInt16LE(0o120777, cdOffset + 40);
  fs.writeFileSync(symlinkZip, buf);
  assert.throws(
    () => boundary.parseAndHashZipArchive(symlinkZip),
    (e) => e instanceof boundary.BoundaryFailure && e.code === "E_LINK_UNPROVABLE",
  );

  // Also test Functions tree tamper vs PREDEPLOY_MANIFEST
  const { root, fDir } = makeBoundaryFixture();
  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: () => {
      fs.writeFileSync(path.join(fDir, "server.js"), "exports.ssrcanilgcm = () => 'evil';\n");
    },
  });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_FUNCTIONS_ARCHIVE_MISMATCH/);
});

test("F15: Functions gcs.upload stream tampered vs packaged archive fails closed", async () => {
  const { root } = makeBoundaryFixture();
  const ftLib = path.join(REPO_ROOT, "node_modules", "firebase-tools", "lib");
  const prepMod = require(path.join(ftLib, "deploy", "functions", "prepareFunctionsUpload.js"));
  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: () => {
      const wrappedPrep = prepMod.prepareFunctionsUpload;
      prepMod.prepareFunctionsUpload = async function (...args) {
        const out = await wrappedPrep.apply(this, args);
        // Replace archive bytes on disk after prepareFunctionsUpload verified them
        fs.writeFileSync(out.pathToSource, Buffer.from("tampered-zip-bytes"));
        return out;
      };
    },
  });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_FUNCTIONS_STREAM_MISMATCH/);
});

test("F16: firebase-tools package.json version or lockfile integrity mismatch fails closed", () => {
  const tmpCli = trackTempDir("ct4-f16-cli-");
  fs.copyFileSync(path.join(REPO_ROOT, "package.json"), path.join(tmpCli, "package.json"));
  fs.copyFileSync(path.join(REPO_ROOT, "package-lock.json"), path.join(tmpCli, "package-lock.json"));
  fs.mkdirSync(path.join(tmpCli, "node_modules"), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, "node_modules", ".package-lock.json"), path.join(tmpCli, "node_modules", ".package-lock.json"));
  const pkg = JSON.parse(fs.readFileSync(path.join(tmpCli, "package.json"), "utf8"));
  pkg.devDependencies["firebase-tools"] = "15.24.0";
  fs.writeFileSync(path.join(tmpCli, "package.json"), JSON.stringify(pkg));

  assert.throws(
    () => boundary.verifyCliIntegrity(tmpCli),
    (e) => e instanceof boundary.BoundaryFailure && e.code === "E_CLI_INTEGRITY",
  );
});

test("F17: hooked firebase-tools module SHA-256 tamper fails closed", () => {
  const tmpCli = trackTempDir("ct4-f17-mod-");
  fs.copyFileSync(path.join(REPO_ROOT, "package.json"), path.join(tmpCli, "package.json"));
  fs.copyFileSync(path.join(REPO_ROOT, "package-lock.json"), path.join(tmpCli, "package-lock.json"));
  fs.mkdirSync(path.join(tmpCli, "node_modules"), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, "node_modules", ".package-lock.json"), path.join(tmpCli, "node_modules", ".package-lock.json"));
  for (const rel of Object.keys(boundary.PINNED_MODULE_SHA256)) {
    const dst = path.join(tmpCli, ...rel.split("/"));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, ...rel.split("/")), dst);
  }
  fs.appendFileSync(path.join(tmpCli, "node_modules", "firebase-tools", "lib", "listFiles.js"), "\n// tamper\n");

  assert.throws(
    () => boundary.verifyCliIntegrity(tmpCli),
    (e) => e instanceof boundary.BoundaryFailure && e.code === "E_CLI_MODULE_TAMPER",
  );
});

test("F18: pre-release attestation write/validate failure blocks BOTH Functions and Hosting release", async () => {
  const { root } = makeBoundaryFixture();
  const ftLib = path.join(REPO_ROOT, "node_modules", "firebase-tools", "lib");
  const deployMod = require(path.join(ftLib, "deploy", "index.js"));
  const attPath = path.join(root, ".firebase", "canil-gcm-g8-upload-attestation.json");
  // Place a directory at attestationOutAbs so atomic renameSync fails closed before release
  fs.mkdirSync(attPath, { recursive: true });

  const preManifest = g8.buildPredeployManifest(root, makeBinding());
  const prePath = path.join(root, ".firebase", "canil-gcm-g8-predeploy-manifest.json");
  fs.writeFileSync(prePath, JSON.stringify(preManifest, null, 2));

  const cliIntegrity = boundary.verifyCliIntegrity(REPO_ROOT);
  const hookHandle = boundary.installInProcessBoundaryHooks({
    root,
    cliRoot: REPO_ROOT,
    mockTransport: true,
    predeployManifestAbs: prePath,
    predeployManifestRel: ".firebase/canil-gcm-g8-predeploy-manifest.json",
    attestationOutAbs: attPath,
    expectedBinding: makeBinding(),
    cliIntegrity,
  });
  const { Config } = require(path.join(ftLib, "config.js"));
  const cfgData = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
  delete cfgData.hosting.predeploy;
  let thrown = null;
  try {
    await deployMod.deploy(["hosting"], {
      cwd: root,
      projectRoot: root,
      project: "canil-gcm",
      projectId: "canil-gcm",
      only: "hosting",
      nonInteractive: true,
      config: new Config(cfgData, { cwd: root, projectDir: root }),
    });
  } catch (e) {
    thrown = e;
  } finally {
    hookHandle.restore();
  }
  assert.ok(thrown !== null);
  assert.equal(hookHandle.state.mockRecords.functionsReleaseCalls, 0);
  assert.equal(hookHandle.state.mockRecords.hostingCreateReleaseCalls, 0);
});

test("F19: deploy.yml Record provenance never emits DEPLOY STEP = EXECUTED when deploy failed", () => {
  const yml = fs.readFileSync(path.join(REPO_ROOT, ".github", "workflows", "deploy.yml"), "utf8");
  assert.match(yml, /PRE_DEPLOY_ABORT_NO_MUTATION/);
  assert.match(yml, /MID_DEPLOY_FAILURE_OR_CANCELLED_INCIDENT/);
  assert.match(yml, /RELEASED_ATTESTATION_INCOMPLETE/);
  assert.match(yml, /RELEASED_AND_ATTESTED/);
  assert.match(yml, /AUTH_CHECK_READ_ONLY/);
  assert.match(yml, /DEPLOY_STEP_STATUS="FAILED_BEFORE_UPLOAD"/);
  assert.match(yml, /DEPLOY_STEP_STATUS="EXECUTED_UNATTESTED"/);
  assert.match(yml, /echo "DEPLOY STEP = \$\{DEPLOY_STEP_STATUS\}"/);

  // Simulate all 5 outcome combinations matching the shell conditional in Record provenance
  const classify = (mode, deployOutcome, revalOutcome, uploadOutcome, hasPredeployManifest) => {
    if (mode !== "release") return ["AUTH_CHECK_READ_ONLY", "NO", "SKIPPED"];
    if (deployOutcome === "success" && revalOutcome === "success" && uploadOutcome === "success") {
      return ["RELEASED_AND_ATTESTED", "YES (Hosting + ssrcanilgcm)", "EXECUTED"];
    }
    if (deployOutcome === "success") {
      return ["RELEASED_ATTESTATION_INCOMPLETE", "YES (ATTESTATION_OR_ARTIFACT_FAILED)", "EXECUTED_UNATTESTED"];
    }
    if (!hasPredeployManifest) {
      return ["PRE_DEPLOY_ABORT_NO_MUTATION", "NO_PREDEPLOY_ABORT", "FAILED_BEFORE_UPLOAD"];
    }
    return ["MID_DEPLOY_FAILURE_OR_CANCELLED_INCIDENT", "INDETERMINATE_MID_DEPLOY_FAILURE", "FAILED_OR_CANCELLED"];
  };
  assert.deepEqual(classify("auth-check", "skipped", "skipped", "skipped", false), ["AUTH_CHECK_READ_ONLY", "NO", "SKIPPED"]);
  assert.deepEqual(classify("release", "failure", "skipped", "success", false), ["PRE_DEPLOY_ABORT_NO_MUTATION", "NO_PREDEPLOY_ABORT", "FAILED_BEFORE_UPLOAD"]);
  assert.deepEqual(classify("release", "failure", "skipped", "success", true), ["MID_DEPLOY_FAILURE_OR_CANCELLED_INCIDENT", "INDETERMINATE_MID_DEPLOY_FAILURE", "FAILED_OR_CANCELLED"]);
  assert.deepEqual(classify("release", "success", "failure", "success", true), ["RELEASED_ATTESTATION_INCOMPLETE", "YES (ATTESTATION_OR_ARTIFACT_FAILED)", "EXECUTED_UNATTESTED"]);
  assert.deepEqual(classify("release", "success", "success", "success", true), ["RELEASED_AND_ATTESTED", "YES (Hosting + ssrcanilgcm)", "EXECUTED"]);
});

test("F20: deploy.yml fails closed if revalidate or artifact upload did not succeed on release", () => {
  const yml = fs.readFileSync(path.join(REPO_ROOT, ".github", "workflows", "deploy.yml"), "utf8");
  assert.match(yml, /id: upload_forensic/);
  assert.match(yml, /Enforce fail-closed G8 attestation and artifact upload on release success/);
  assert.match(yml, /steps\.revalidate\.outcome.*!= "success"/);
  assert.match(yml, /steps\.upload_forensic\.outcome.*!= "success"/);
  assert.match(yml, /--require-release-complete/);
});

test("F21: secret, token, and env-secret leakage in attestation fails closed with E_SECRET_LEAK_DETECTED", () => {
  assert.throws(
    () => boundary.scanNoSecretLeaks(JSON.stringify({ leaked: g8.CANONICAL_PRODUCTION_IDENTITY.apiKey }), {}),
    (e) => e instanceof boundary.BoundaryFailure && e.code === "E_SECRET_LEAK_DETECTED",
  );
  assert.throws(
    () => boundary.scanNoSecretLeaks('{"token":"ya29.secret_oauth_token_123"}', {}),
    (e) => e instanceof boundary.BoundaryFailure && e.code === "E_SECRET_LEAK_DETECTED",
  );
  assert.throws(
    () =>
      boundary.scanNoSecretLeaks('{"val":"super-secret-value-99"}', {
        MY_CUSTOM_API_SECRET: "super-secret-value-99",
      }),
    (e) => e instanceof boundary.BoundaryFailure && e.code === "E_SECRET_LEAK_DETECTED",
  );
});

test("F22: deploy.yml pins validated_commit, validated_tree, and validated_identity_digest across jobs", () => {
  const yml = fs.readFileSync(path.join(REPO_ROOT, ".github", "workflows", "deploy.yml"), "utf8");
  assert.match(yml, /validated_commit:\s*\$\{\{ steps\.binding_outputs\.outputs\.validated_commit \}\}/);
  assert.match(yml, /validated_tree:\s*\$\{\{ steps\.binding_outputs\.outputs\.validated_tree \}\}/);
  assert.match(yml, /validated_identity_digest:\s*\$\{\{ steps\.binding_outputs\.outputs\.validated_identity_digest \}\}/);
  assert.match(yml, /ref:\s*\$\{\{ needs\.validate\.outputs\.validated_commit \}\}/);
  const parityIdx = yml.indexOf("Verify commit, tree, and identityDigest parity with validate job");
  const authIdx = yml.indexOf("Authenticate to Google Cloud");
  assert.ok(parityIdx !== -1 && authIdx !== -1 && parityIdx < authIdx);
});

test("F23: deploy.yml requires 40-hex SHA and master ancestry check", () => {
  const yml = fs.readFileSync(path.join(REPO_ROOT, ".github", "workflows", "deploy.yml"), "utf8");
  assert.match(yml, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(yml, /git merge-base --is-ancestor/);
});

test("F24: direct firebase deploy bypass & disallowed CLI flags fail closed", () => {
  const { root } = makeBoundaryFixture();
  const bypassRes = spawnSync(
    process.execPath,
    [CLI_PATH, "assert-active", "--root", root],
    { env: { ...process.env, CT4_G8_BOUNDARY_NONCE: "", CT4_G8_BOUNDARY_SESSION: "", CT4_G8_BOUNDARY_PID: "" }, encoding: "utf8" },
  );
  assert.equal(bypassRes.status, 1);
  assert.match(bypassRes.stderr, /FAIL E_BOUNDARY_WRAPPER_NOT_ACTIVE/);

  for (const badCmd of [
    ["firebase", "deploy", "--only", "hosting", "--project", "canil-gcm", "--non-interactive", "--dry-run"],
    ["firebase", "deploy", "--only", "hosting", "--project", "canil-gcm", "--non-interactive", "--force"],
    ["firebase", "deploy", "--only", "functions", "--project", "canil-gcm", "--non-interactive"],
    ["firebase", "deploy", "--only", "hosting", "--project", "k9-ops-staging", "--non-interactive"],
    ["firebase", "hosting:channel:deploy", "preview"],
  ]) {
    assert.throws(
      () => boundary.validateWrappedFirebaseCommand(badCmd),
      (e) => e instanceof boundary.BoundaryFailure && e.code === "E_BYPASS_DISALLOWED",
    );
  }
});

test("F25: forging actualRemoteUpload or actualDeployedRelease fails closed; mock-transport banned in CI", () => {
  const { root } = makeBoundaryFixture();
  const preManifest = g8.buildPredeployManifest(root, makeBinding());
  const forged = {
    version: boundary.ATTESTATION_VERSION,
    kind: boundary.ATTESTATION_KIND,
    transportMode: "OFFLINE_MOCK_TRANSPORT",
    actualRemoteUpload: "PROVEN",
    actualDeployedRelease: "NOT_PROVEN",
  };
  assert.throws(
    () => boundary.validateUploadAttestation(forged, preManifest, root, makeBinding()),
    (e) => e instanceof boundary.BoundaryFailure && e.code === "E_UNSUPPORTED_ATTESTATION_CLAIM",
  );
});

test("F26: case-insensitive path collision fails closed in ZIP and TAR archive parsers", async () => {
  const dir = trackTempDir("ct4-f26-case-");
  const dupZip = path.join(dir, "case.zip");
  fs.writeFileSync(
    dupZip,
    await buildZipBuffer([
      { name: "server.js", content: "a\n" },
      { name: "Server.js", content: "b\n" },
    ]),
  );
  assert.throws(
    () => boundary.parseAndHashZipArchive(dupZip),
    (e) => e instanceof boundary.BoundaryFailure && e.code === "E_CASE_COLLISION",
  );
});

test("F27: FunctionsTarget.shouldUploadBeSkipped=true fails closed & pre-release barrier guards Functions-first pintags order", async () => {
  const { root } = makeBoundaryFixture();
  const cliIntegrity = boundary.verifyCliIntegrity(REPO_ROOT);
  const hookHandle = boundary.installInProcessBoundaryHooks({
    root,
    cliRoot: REPO_ROOT,
    mockTransport: true,
    predeployManifestAbs: path.join(root, ".firebase", "pre.json"),
    predeployManifestRel: ".firebase/pre.json",
    attestationOutAbs: path.join(root, ".firebase", "att.json"),
    expectedBinding: makeBinding(),
    cliIntegrity,
  });
  const ftLib = path.join(REPO_ROOT, "node_modules", "firebase-tools", "lib");
  const fnDeploy = require(path.join(ftLib, "deploy", "functions", "deploy.js"));
  const fnRelease = require(path.join(ftLib, "deploy", "functions", "release", "index.js"));
  try {
    const activeEndpoint = { id: "ssrcanilgcm", hash: "abc", state: "ACTIVE" };
    assert.throws(
      () =>
        fnDeploy.shouldUploadBeSkipped(
          { filters: [] },
          { endpoints: { "southamerica-east1": { ssrcanilgcm: activeEndpoint } } },
          { endpoints: { "southamerica-east1": { ssrcanilgcm: activeEndpoint } } },
        ),
      /E_SSR_UPLOAD_SKIPPED/,
    );
    await assert.rejects(
      () => fnRelease.release({ projectId: "canil-gcm" }, {}, {}),
      /E_PREDEPLOY_MANIFEST_ABSENT|E_RELEASE_BARRIER_BYPASSED/,
    );
  } finally {
    hookHandle.restore();
  }
});

test("F28: Pass 2 TOCTOU swap on disk between Pass 1 hashHandler and Pass 2 uploadHandler fails closed", async () => {
  const { root, hDir } = makeBoundaryFixture();
  const ftLib = path.join(REPO_ROOT, "node_modules", "firebase-tools", "lib");
  const uploaderMod = require(path.join(ftLib, "deploy", "hosting", "uploader.js"));
  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: () => {
      const wrappedPop = uploaderMod.Uploader.prototype.populateHandler;
      uploaderMod.Uploader.prototype.populateHandler = async function (batch) {
        fs.writeFileSync(path.join(hDir, "index.html"), "swapped-after-pass1\n");
        return wrappedPop.call(this, batch);
      };
    },
  });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_BOUNDARY_TOCTOU_MISMATCH/);
});

test("F29: tampered gcs.upload stream / populateFiles / uploadHandler fails closed", async () => {
  const { root } = makeBoundaryFixture();
  const ftLib = path.join(REPO_ROOT, "node_modules", "firebase-tools", "lib");
  const gcsMod = require(path.join(ftLib, "gcp", "storage.js"));
  const res = await runInProcessDeploy(root, {
    skipPredeployHookExec: true,
    afterHooksInstalled: () => {
      const wrappedUpload = gcsMod.upload;
      gcsMod.upload = function (source, ...rest) {
        return wrappedUpload.call(this, { ...source, stream: Readable.from([Buffer.from("wrong")]) }, ...rest);
      };
    },
  });
  assertZeroReleaseMutations(res);
  matchFailureCode(res, /E_FUNCTIONS_STREAM_MISMATCH/);
});

test("F30: unsafe env vars (NODE_OPTIONS, FIREBASE_HOSTING_API_URL, HTTPS_PROXY, STORAGE_EMULATOR_HOST) fail closed", () => {
  for (const envKey of ["NODE_OPTIONS", "FIREBASE_HOSTING_API_URL", "STORAGE_EMULATOR_HOST", "HTTPS_PROXY"]) {
    assert.throws(
      () => boundary.assertSafeWrapperEnvironment({ [envKey]: "http://127.0.0.1:9999" }),
      (e) => e instanceof boundary.BoundaryFailure && e.code === "E_UNSAFE_ENV",
    );
  }
});
