#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS build-time script, same convention as the existing production guard scripts */
/**
 * CT4 WEB-P0 — G8 exact Firebase upload-boundary wrapper, stream attester, and pre-release barrier.
 *
 * Gate: CT4.WEB-P0.G8-EXACT-UPLOAD-BOUNDARY-AND-RELEASE-SAFETY-R1
 *
 * ARCHITECTURE (Strategy B + Strategy C Honesty):
 * -----------------------------------------------
 * Runs `firebase-tools@15.25.1` in-process (NEVER via NODE_OPTIONS, so `npm i` /
 * `next build` subprocesses spawned by `prepareFrameworks` are never polluted):
 *   1. `verify-cli`: pins `package.json` / `package-lock.json` / `node_modules/.package-lock.json`
 *      and SHA-256 of every hooked `firebase-tools@15.25.1` and `archiver@7.0.1` CJS module.
 *   2. `assert-active`: invoked inside `firebase.json` `hosting.predeploy`; proves an active,
 *      integrity-verified wrapper session owns the deployment (blocking direct `firebase deploy`).
 *   3. `exec`: enforces env/flag anti-bypass rules, patches `require.cache` in-process ONLY,
 *      hooks Hosting (`listFiles`, `hashcache.load/dump`, `Uploader.start/hashHandler/zipStream/
 *      populateHandler/uploadHandler`) and Functions (`fsAsync.readdirRecursive`, `archiver`,
 *      `prepareFunctionsUpload`, `functions/deploy.shouldUploadBeSkipped`, `gcp/storage.upload`,
 *      `functions/release`, `hosting/release`), verifies every boundary against PREDEPLOY_MANIFEST,
 *      blocks BOTH `FunctionsTarget.release` (`pintags` runs Functions first!) and `HostingTarget.release`
 *      on any defect, scans serialized attestation for secret leaks, and enforces strict local honesty
 *      (`actualRemoteUpload = "NOT_PROVEN"`, `actualDeployedRelease = "NOT_PROVEN"`).
 *   4. `validate`: fail-closed validator for emitted upload-boundary attestations.
 */

"use strict";

const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { PassThrough, Transform } = require("node:stream");
const zlib = require("node:zlib");

const g8 = require("./ct4-web-p0-g8-payload-manifest.cjs");

const ATTESTATION_VERSION = 1;
const ATTESTATION_KIND = "ct4-web-p0-g8-upload-boundary-attestation";
const EXPECTED_CLI_VERSION = "15.25.1";
const EXPECTED_CLI_LOCK_INTEGRITY =
  "sha512-TcKCgmlHducC3XrzS+FPgGXe2DlDl1Fh2GSN2Vkh71eGGvP7jE/JuEOFcE3osI0TBb1Os6MNTSsGL8mjdZ1IKA==";
const EXPECTED_ARCHIVER_VERSION = "7.0.1";

/** Exact SHA-256 pins of hooked firebase-tools@15.25.1 & archiver@7.0.1 CJS modules. */
const PINNED_MODULE_SHA256 = Object.freeze({
  "node_modules/firebase-tools/package.json":
    "c57db42c5fcd834c1b1d17abb6c9e1b2ffba7ac3e81213a6749fb883b1f0c100",
  "node_modules/firebase-tools/lib/bin/firebase.js":
    "1e05ff8373e5a5c7222475a0d90d4db58c85c2f281d44d4884bc96062288b864",
  "node_modules/firebase-tools/lib/bin/cli.js":
    "cb27d55f9554d92a086fff4af53b3a5d9fb158689ba1389f5ebcc62f56ff0023",
  "node_modules/firebase-tools/lib/commands/deploy.js":
    "f79b5f7ae11e033e4dfe8ec4f2539a684422e346a22cf16355e908967a89fa5b",
  "node_modules/firebase-tools/lib/deploy/index.js":
    "3312085417062367a78b7e53f679a920594f251b03bfc382a142e32e61cc6fbf",
  "node_modules/firebase-tools/lib/deploy/lifecycleHooks.js":
    "1efe948a8997052437c65b803b643627345b9683cd0a5960ebaf996f90403e76",
  "node_modules/firebase-tools/lib/listFiles.js":
    "f6ec2fb7387434a950238deb6c5e9c12412019287cff51a8964532e1b685ff55",
  "node_modules/firebase-tools/lib/fsAsync.js":
    "c8989264cfe50f902dfd1015a4c060ff36e114cbf24ac63dc5e254284a3ab3a2",
  "node_modules/firebase-tools/lib/deploy/hosting/index.js":
    "06b68b00f829f6bb4f7c39f642c24e23ebce29540958e7159d483004cac720a2",
  "node_modules/firebase-tools/lib/deploy/hosting/prepare.js":
    "76c4e53830e8505c7e1f879f1b9fbfc7f841ce1d2e1162f38eb1db184025e7de",
  "node_modules/firebase-tools/lib/deploy/hosting/deploy.js":
    "5e5108ebf94b71f5d1f76473318218ed783834da7e1290612e38bdde235861bb",
  "node_modules/firebase-tools/lib/deploy/hosting/uploader.js":
    "a1c2129ab611480ac902111c8b4d5e0fd464c8727c0946c002de94d88638b8f8",
  "node_modules/firebase-tools/lib/deploy/hosting/hashcache.js":
    "03c7c6f243a6d1529e952c91ee9e374225cd82daee2fc0e5daf396f5e2c9e11d",
  "node_modules/firebase-tools/lib/deploy/hosting/release.js":
    "49ce92a66e4f23bfa6be1a743b830c91493c59045271dcfc57141d5c726a6abc",
  "node_modules/firebase-tools/lib/deploy/functions/index.js":
    "2f29925b0f43d17962d9ddc85c0391dbb51818864adea52dc7b8c3b61a17e4da",
  "node_modules/firebase-tools/lib/deploy/functions/prepare.js":
    "7246ab3fa5927552614ca4078c6995cd05b2a58081f5cbe1a38f11a212d4af0f",
  "node_modules/firebase-tools/lib/deploy/functions/prepareFunctionsUpload.js":
    "db73eefa9de70e77a0f8bb0f602e87e6a97c067fd8362f8931a54230803e07cb",
  "node_modules/firebase-tools/lib/deploy/functions/deploy.js":
    "93592080ba4e7d2e6057df1f34056ee6d1962e1a92a9447d2e3e69ca12b20e7e",
  "node_modules/firebase-tools/lib/deploy/functions/release/index.js":
    "03c7a0acae1ad8096370fcc263631947f048676ee4b42f3cd43dc0c64a3b6a6e",
  "node_modules/firebase-tools/lib/gcp/storage.js":
    "76ffc029c99a28ce0e8a9679b2d4d8b734b49971a7c5dc4ae6ab887d3336453e",
  "node_modules/firebase-tools/lib/apiv2.js":
    "eada1f0c2f2bce92482647dcbf78fddff32eb6439d18f4a8cb26076fd2746db5",
  "node_modules/firebase-tools/lib/api.js":
    "a13c173c36066ac62c711005534fc3bc071d49be8bb26df60303d88e818c5907",
  "node_modules/firebase-tools/lib/experiments.js":
    "378e67c08948cab4284f6765e055fbd0245254e6e07ce883d08f78d4de6572af",
  "node_modules/archiver/package.json":
    "71f9d2abd62fc121c3f5c7ccb75a148cf1e8ce0b58ae6b86ea150cf719b86133",
  "node_modules/archiver/index.js":
    "63e5d45a6b939146c5b43f0379214792acc44771608047b924de0924a788b1dc",
});

const BANNED_ENV_VARS = Object.freeze([
  "NODE_OPTIONS",
  "FIREBASE_API_URL",
  "FIREBASE_HOSTING_API_URL",
  "FIREBASE_HOSTING_URL",
  "FIREBASE_STORAGE_URL",
  "FIREBASE_FIREBASESTORAGE_URL",
  "FIREBASE_FUNCTIONS_URL",
  "FIREBASE_FUNCTIONS_V2_URL",
  "CLOUD_RUN_URL",
  "CLOUD_RUN_API_URL",
  "FIREBASE_AUTH_URL",
  "FIREBASE_TOKEN_URL",
  "FIREBASE_GOOGLE_URL",
  "STORAGE_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST",
  "FIRESTORE_EMULATOR_HOST",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "http_proxy",
  "https_proxy",
]);

class BoundaryFailure extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "BoundaryFailure";
    this.code = code;
    this.detail = detail || {};
    this.exit = 1;
  }
}

function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function sha256Json(obj) {
  return sha256Buffer(Buffer.from(JSON.stringify(obj), "utf8"));
}

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

function assertSafeWrapperEnvironment(env) {
  const e = env || process.env;
  for (const name of BANNED_ENV_VARS) {
    if (!isBlank(e[name])) {
      throw new BoundaryFailure(
        "E_UNSAFE_ENV",
        `Disallowed environment variable "${name}" is set during controlled upload boundary execution.`,
        { envVar: name },
      );
    }
  }
}

function validateWrappedFirebaseCommand(cmdTokens) {
  if (!Array.isArray(cmdTokens) || cmdTokens.length < 2) {
    throw new BoundaryFailure("E_BYPASS_DISALLOWED", "Missing wrapped firebase deploy command after --.");
  }
  const binName = path.basename(cmdTokens[0]).replace(/\.(cmd|exe|bat)$/i, "");
  if (binName !== "firebase" || cmdTokens[1] !== "deploy") {
    throw new BoundaryFailure(
      "E_BYPASS_DISALLOWED",
      "Controlled wrapper only permits `firebase deploy` subcommand.",
      { command: cmdTokens.slice(0, 2) },
    );
  }

  let onlyVal = null;
  let projectVal = null;
  let nonInteractive = false;
  const disallowed = new Set(["--dry-run", "--force", "-f", "--except", "--public", "-p", "--config", "-c", "--token", "--open"]);
  const allowedValueFlags = new Set(["--only", "--project", "-P", "--message", "-m"]);

  for (let i = 2; i < cmdTokens.length; i += 1) {
    const tok = cmdTokens[i];
    const flagName = tok.includes("=") ? tok.slice(0, tok.indexOf("=")) : tok;
    if (disallowed.has(flagName)) {
      throw new BoundaryFailure("E_BYPASS_DISALLOWED", `Disallowed deploy flag "${flagName}".`, { flag: flagName });
    }
    if (tok === "--non-interactive") {
      nonInteractive = true;
      continue;
    }
    if (tok === "--debug") {
      continue;
    }
    if (allowedValueFlags.has(flagName)) {
      let val;
      if (tok.includes("=")) {
        val = tok.slice(tok.indexOf("=") + 1);
      } else {
        val = cmdTokens[i + 1];
        i += 1;
      }
      if (isBlank(val) || val.startsWith("-")) {
        throw new BoundaryFailure("E_BYPASS_DISALLOWED", `Flag "${flagName}" requires an explicit value.`);
      }
      if (flagName === "--only") {
        if (onlyVal !== null) throw new BoundaryFailure("E_BYPASS_DISALLOWED", "Duplicate --only flag.");
        onlyVal = val;
      } else if (flagName === "--project" || flagName === "-P") {
        if (projectVal !== null) throw new BoundaryFailure("E_BYPASS_DISALLOWED", "Duplicate --project flag.");
        projectVal = val;
      }
      continue;
    }
    throw new BoundaryFailure("E_BYPASS_DISALLOWED", `Unapproved firebase deploy argument "${tok}".`, { arg: tok });
  }

  if (onlyVal !== "hosting") {
    throw new BoundaryFailure("E_BYPASS_DISALLOWED", `Controlled deploy requires --only hosting (got ${onlyVal}).`);
  }
  if (projectVal !== g8.PRODUCTION_PROJECT_ID) {
    throw new BoundaryFailure(
      "E_BYPASS_DISALLOWED",
      `Controlled deploy requires --project ${g8.PRODUCTION_PROJECT_ID} (got ${projectVal}).`,
    );
  }
  if (!nonInteractive) {
    throw new BoundaryFailure("E_BYPASS_DISALLOWED", "Controlled deploy requires --non-interactive.");
  }
}

/** Verify package.json, package-lock.json, node_modules/.package-lock.json, and all pinned CJS modules. */
function verifyCliIntegrity(root) {
  const resolvedRoot = path.resolve(root);
  const pkgPath = path.join(resolvedRoot, "package.json");
  const lockPath = path.join(resolvedRoot, "package-lock.json");
  const nmLockPath = path.join(resolvedRoot, "node_modules", ".package-lock.json");

  if (!fs.existsSync(pkgPath) || !fs.existsSync(lockPath) || !fs.existsSync(nmLockPath)) {
    throw new BoundaryFailure(
      "E_CLI_INTEGRITY",
      "Missing package.json, package-lock.json, or node_modules/.package-lock.json for CLI integrity verification.",
    );
  }

  let pkg;
  let pkgLock;
  let nmLock;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkgLock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    nmLock = JSON.parse(fs.readFileSync(nmLockPath, "utf8"));
  } catch {
    throw new BoundaryFailure("E_CLI_INTEGRITY", "Failed to parse package.json or lockfile JSON.");
  }

  const declaredFt = (pkg.devDependencies && pkg.devDependencies["firebase-tools"]) ||
    (pkg.dependencies && pkg.dependencies["firebase-tools"]);
  if (declaredFt !== EXPECTED_CLI_VERSION) {
    throw new BoundaryFailure(
      "E_CLI_INTEGRITY",
      `package.json firebase-tools must be pinned to ${EXPECTED_CLI_VERSION} (found ${declaredFt}).`,
    );
  }

  const lockFt = pkgLock.packages && pkgLock.packages["node_modules/firebase-tools"];
  const nmFt = nmLock.packages && nmLock.packages["node_modules/firebase-tools"];
  if (
    !lockFt ||
    !nmFt ||
    lockFt.version !== EXPECTED_CLI_VERSION ||
    nmFt.version !== EXPECTED_CLI_VERSION ||
    lockFt.integrity !== EXPECTED_CLI_LOCK_INTEGRITY ||
    nmFt.integrity !== lockFt.integrity
  ) {
    throw new BoundaryFailure(
      "E_CLI_INTEGRITY",
      "Lockfile or node_modules/.package-lock.json integrity mismatch for firebase-tools.",
    );
  }

  const ftPkgPath = path.join(resolvedRoot, "node_modules", "firebase-tools", "package.json");
  if (!fs.existsSync(ftPkgPath)) {
    throw new BoundaryFailure("E_CLI_INTEGRITY", "node_modules/firebase-tools/package.json is absent.");
  }
  const ftPkg = JSON.parse(fs.readFileSync(ftPkgPath, "utf8"));
  if (ftPkg.version !== EXPECTED_CLI_VERSION) {
    throw new BoundaryFailure("E_CLI_INTEGRITY", `Installed firebase-tools version is ${ftPkg.version}, expected ${EXPECTED_CLI_VERSION}.`);
  }

  const archLock = pkgLock.packages && pkgLock.packages["node_modules/archiver"];
  const archNm = nmLock.packages && nmLock.packages["node_modules/archiver"];
  if (!archLock || !archNm || archLock.version !== EXPECTED_ARCHIVER_VERSION || archNm.version !== archLock.version || archNm.integrity !== archLock.integrity) {
    throw new BoundaryFailure("E_CLI_INTEGRITY", "Lockfile integrity mismatch for archiver.");
  }

  const moduleDigests = {};
  for (const relPosix of Object.keys(PINNED_MODULE_SHA256).sort()) {
    g8.assertNoSymlinkChain(resolvedRoot, relPosix);
    const full = path.join(resolvedRoot, ...relPosix.split("/"));
    if (!fs.existsSync(full)) {
      throw new BoundaryFailure("E_CLI_MODULE_TAMPER", `Pinned module missing: ${relPosix}.`, { path: relPosix });
    }
    const actualSha = g8.sha256File(full);
    if (actualSha !== PINNED_MODULE_SHA256[relPosix]) {
      throw new BoundaryFailure(
        "E_CLI_MODULE_TAMPER",
        `Pinned module SHA-256 mismatch for ${relPosix}.`,
        { path: relPosix },
      );
    }
    moduleDigests[relPosix] = actualSha;
  }

  return {
    package: "firebase-tools",
    version: EXPECTED_CLI_VERSION,
    lockfileIntegrity: EXPECTED_CLI_LOCK_INTEGRITY,
    moduleCount: Object.keys(moduleDigests).length,
    modulesDigest: sha256Json(moduleDigests),
  };
}

/** Parse and hash every regular entry of a ZIP archive from disk without trusting archiver callbacks. */
function parseAndHashZipArchive(zipPath) {
  const buf = fs.readFileSync(zipPath);
  let eocdOffset = -1;
  const minOffset = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minOffset; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new BoundaryFailure("E_ARCHIVE_CORRUPT", "ZIP End of Central Directory signature not found.");
  }
  const diskNum = buf.readUInt16LE(eocdOffset + 4);
  const cdDisk = buf.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = buf.readUInt16LE(eocdOffset + 8);
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdSize = buf.readUInt32LE(eocdOffset + 12);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  if (
    diskNum !== 0 ||
    cdDisk !== 0 ||
    entriesOnDisk !== totalEntries ||
    totalEntries === 0xffff ||
    cdOffset === 0xffffffff ||
    cdOffset + cdSize > eocdOffset
  ) {
    throw new BoundaryFailure("E_ARCHIVE_CORRUPT", "Unsupported or malformed ZIP central directory structure.");
  }

  const out = [];
  const seen = new Set();
  const seenLower = new Set();
  let ptr = cdOffset;

  for (let idx = 0; idx < totalEntries; idx += 1) {
    if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== 0x02014b50) {
      throw new BoundaryFailure("E_ARCHIVE_CORRUPT", "Invalid ZIP Central Directory header.");
    }
    const flags = buf.readUInt16LE(ptr + 8);
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const uncompSize = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const externalAttr = buf.readUInt32LE(ptr + 38);
    const localOffset = buf.readUInt32LE(ptr + 42);
    if (flags & 0x01) {
      throw new BoundaryFailure("E_ARCHIVE_CORRUPT", "Encrypted ZIP entries are forbidden.");
    }
    const rawName = buf.subarray(ptr + 46, ptr + 46 + nameLen).toString("utf8");
    ptr += 46 + nameLen + extraLen + commentLen;

    const unixMode = (externalAttr >>> 16) & 0xffff;
    const fileType = unixMode & 0o170000;
    if (fileType === 0o120000) {
      throw new BoundaryFailure("E_LINK_UNPROVABLE", "Functions ZIP archive contains a symlink entry.", {
        path: rawName,
      });
    }
    const isDirEntry = rawName.endsWith("/") && uncompSize === 0 && ((externalAttr & 0x10) !== 0 || fileType === 0o040000 || fileType === 0);
    if (isDirEntry) continue;

    try {
      g8.validateRelativePath(rawName);
    } catch (err) {
      throw new BoundaryFailure(err.code || "E_PATH_TRAVERSAL", err.message, { path: rawName });
    }
    if (seen.has(rawName)) {
      throw new BoundaryFailure("E_ARCHIVE_DUPLICATE_ENTRY", "Functions ZIP contains duplicate entry.", { path: rawName });
    }
    const lower = rawName.toLowerCase();
    if (seenLower.has(lower)) {
      throw new BoundaryFailure("E_CASE_COLLISION", "Functions ZIP contains case-colliding entries.", { path: rawName });
    }
    seen.add(rawName);
    seenLower.add(lower);

    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new BoundaryFailure("E_ARCHIVE_CORRUPT", "Invalid ZIP Local File Header.", { path: rawName });
    }
    const lfhNameLen = buf.readUInt16LE(localOffset + 26);
    const lfhExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lfhNameLen + lfhExtraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > buf.length) {
      throw new BoundaryFailure("E_ARCHIVE_CORRUPT", "Truncated ZIP entry payload.", { path: rawName });
    }
    const compSlice = buf.subarray(dataStart, dataEnd);
    let raw;
    if (method === 0) {
      raw = compSlice;
    } else if (method === 8) {
      raw = zlib.inflateRawSync(compSlice);
    } else {
      throw new BoundaryFailure("E_ARCHIVE_CORRUPT", `Unsupported ZIP compression method ${method}.`, { path: rawName });
    }
    if (raw.length !== uncompSize) {
      throw new BoundaryFailure("E_ARCHIVE_CORRUPT", "ZIP entry uncompressed size mismatch.", { path: rawName });
    }
    out.push({ path: rawName, bytes: raw.length, sha256: sha256Buffer(raw) });
  }

  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

function parseOctal(slice) {
  const s = slice.toString("ascii").replace(/\0.*$/, "").trim();
  return s === "" ? 0 : parseInt(s, 8);
}

/** Parse and hash every regular entry of a `.tar.gz` archive from disk. */
function parseAndHashTarGzArchive(tgzPath) {
  const rawTar = zlib.gunzipSync(fs.readFileSync(tgzPath));
  const out = [];
  const seen = new Set();
  const seenLower = new Set();
  let offset = 0;
  let paxPath = null;

  while (offset + 512 <= rawTar.length) {
    const hdr = rawTar.subarray(offset, offset + 512);
    offset += 512;
    if (hdr.every((b) => b === 0)) break;

    const storedSum = parseOctal(hdr.subarray(148, 156));
    let calcSum = 0;
    for (let i = 0; i < 512; i += 1) {
      calcSum += i >= 148 && i < 156 ? 32 : hdr[i];
    }
    if (storedSum !== calcSum) {
      throw new BoundaryFailure("E_ARCHIVE_CORRUPT", "Invalid TAR header checksum.");
    }

    const namePart = hdr.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefixPart = hdr.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const typeFlag = String.fromCharCode(hdr[156] === 0 ? 48 : hdr[156]);
    const size = parseOctal(hdr.subarray(124, 136));
    const padded = Math.ceil(size / 512) * 512;
    if (offset + size > rawTar.length) {
      throw new BoundaryFailure("E_ARCHIVE_CORRUPT", "Truncated TAR entry payload.");
    }
    const content = rawTar.subarray(offset, offset + size);
    offset += padded;

    if (typeFlag === "x") {
      const paxText = content.toString("utf8");
      const m = /\d+ path=([^\n]+)\n/.exec(paxText);
      if (m) paxPath = m[1];
      continue;
    }
    if (typeFlag === "g") continue;
    if (typeFlag === "2" || typeFlag === "1") {
      throw new BoundaryFailure("E_LINK_UNPROVABLE", "Functions TAR archive contains a symlink or hardlink entry.", {
        path: paxPath || namePart,
      });
    }
    const fullName = paxPath || (prefixPart ? `${prefixPart}/${namePart}` : namePart);
    paxPath = null;
    if (typeFlag === "5") continue;
    if (typeFlag !== "0") {
      throw new BoundaryFailure("E_ARCHIVE_CORRUPT", `Unsupported TAR entry type "${typeFlag}".`, { path: fullName });
    }

    try {
      g8.validateRelativePath(fullName);
    } catch (err) {
      throw new BoundaryFailure(err.code || "E_PATH_TRAVERSAL", err.message, { path: fullName });
    }
    if (seen.has(fullName)) {
      throw new BoundaryFailure("E_ARCHIVE_DUPLICATE_ENTRY", "Functions TAR contains duplicate entry.", { path: fullName });
    }
    const lower = fullName.toLowerCase();
    if (seenLower.has(lower)) {
      throw new BoundaryFailure("E_CASE_COLLISION", "Functions TAR contains case-colliding entries.", { path: fullName });
    }
    seen.add(fullName);
    seenLower.add(lower);

    out.push({ path: fullName, bytes: content.length, sha256: sha256Buffer(content) });
  }

  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

/** Scan serialized attestation JSON for accidental secrets, tokens, or raw Firebase config leaks. */
function scanNoSecretLeaks(serialized, env) {
  const forbiddenPatterns = [
    /AIza[0-9A-Za-z_-]{10,}/,
    /ya29\.[0-9A-Za-z._-]+/,
    /\b1\/\/[0-9A-Za-z._-]{10,}/,
    /Bearer\s+[A-Za-z0-9._-]{8,}/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /__FIREBASE_DEFAULTS__/,
    /gh[pousr]_[0-9A-Za-z_]{10,}/,
  ];
  for (const re of forbiddenPatterns) {
    if (re.test(serialized)) {
      throw new BoundaryFailure(
        "E_SECRET_LEAK_DETECTED",
        "Serialized attestation matched a forbidden token, key, or Firebase defaults pattern.",
      );
    }
  }
  const e = env || process.env;
  for (const [k, v] of Object.entries(e)) {
    if (!/(TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL|AUTH|COOKIE)/i.test(k)) continue;
    if (typeof v !== "string" || v.trim().length < 8) continue;
    if (serialized.includes(v.trim())) {
      throw new BoundaryFailure(
        "E_SECRET_LEAK_DETECTED",
        `Serialized attestation leaked environment secret variable "${k}".`,
        { key: k },
      );
    }
  }
  return true;
}

function reconcileFileLists(expectedFiles, actualFiles, errorCode, label) {
  const expectedMap = new Map(expectedFiles.map((f) => [f.path, f]));
  const actualMap = new Map(actualFiles.map((f) => [f.path, f]));

  for (const [rel, exp] of expectedMap) {
    const act = actualMap.get(rel);
    if (!act) {
      throw new BoundaryFailure(errorCode, `${label} missing expected file "${rel}".`, { path: rel });
    }
    if (act.bytes !== exp.bytes || act.sha256 !== exp.sha256) {
      throw new BoundaryFailure(
        errorCode,
        `${label} content mismatch on "${rel}" (expected ${exp.bytes}B/${exp.sha256}, got ${act.bytes}B/${act.sha256}).`,
        { path: rel },
      );
    }
  }
  for (const rel of actualMap.keys()) {
    if (!expectedMap.has(rel)) {
      throw new BoundaryFailure(errorCode, `${label} contains unlisted extra file "${rel}".`, { path: rel });
    }
  }
}

function buildAttestationBody(state) {
  const hostingRawFiles = [...state.hosting.pass1ByPath.values()]
    .map((e) => ({ path: e.path, bytes: e.rawBytes, rawSha256: e.rawSha256 }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const hostingCompressedFiles = [...state.hosting.pass1ByPath.values()]
    .map((e) => ({
      path: e.path,
      compressedBytes: e.compressedBytes,
      compressedSha256: e.compressedSha256,
      gzipOsByte: e.gzipOsByte,
      populateVerified: state.hosting.populatedPaths.has(e.path),
      uploadedInPass2: state.hosting.uploadedHashes.has(e.compressedSha256),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const osBytes = new Set(hostingCompressedFiles.map((f) => f.gzipOsByte));
  const gzipOsByte = osBytes.size === 1 ? [...osBytes][0] : null;
  const cdnDedupCount = hostingCompressedFiles.filter((f) => !f.uploadedInPass2).length;
  const hostingEnumFiles = [...state.hosting.enumeratedFiles].sort();
  const totalRawBytes = hostingRawFiles.reduce((acc, f) => acc + f.bytes, 0);

  return {
    version: ATTESTATION_VERSION,
    kind: ATTESTATION_KIND,
    transportMode: state.mockTransport ? "OFFLINE_MOCK_TRANSPORT" : "REAL_FIREBASE_CLI",
    attestationScope: state.mockTransport
      ? "OFFLINE_MOCK_BOUNDARY_ONLY"
      : "CLI_UPLOAD_BOUNDARY_WITHOUT_CLOUD_READBACK",
    actualRemoteUpload: "NOT_PROVEN",
    actualDeployedRelease: "NOT_PROVEN",
    limitations: [
      "Local CLI upload-boundary attestation measures exact listFiles enumeration, Uploader Pass 1/Pass 2 gzip streams, parsed SSR archive entries, and gcs.upload stream bytes.",
      "Remote storage persistence and live HTTP response bytes remain NOT_PROVEN without independent cloud readback.",
    ],
    binding: state.predeployManifest.binding,
    cliIntegrity: state.cliIntegrity,
    predeployManifest: {
      path: state.predeployManifestRel,
      digest: state.predeployManifest.digest,
      hostingSurfaceDigest: state.predeployManifest.surfaces.hosting.surfaceDigest,
      functionsSurfaceDigest: state.predeployManifest.surfaces.functions.surfaceDigest,
    },
    boundaries: {
      hostingEnumeration: {
        publicRelative: state.predeployManifest.surfaces.hosting.rootRelative,
        fileCount: hostingEnumFiles.length,
        files: hostingEnumFiles,
        enumerationDigest: sha256Json(hostingEnumFiles),
      },
      hostingRawBytes: {
        fileCount: hostingRawFiles.length,
        totalBytes: totalRawBytes,
        files: hostingRawFiles,
        rawSurfaceDigest: sha256Json(hostingRawFiles),
      },
      hostingCompressedBytes: {
        platform: process.platform,
        gzipOsByte,
        fileCount: hostingCompressedFiles.length,
        requiredUploadCount: state.hosting.requiredUploadHashes.size,
        uploadedCount: state.hosting.uploadedHashes.size,
        cdnDedupCount,
        files: hostingCompressedFiles,
        compressedSurfaceDigest: sha256Json(hostingCompressedFiles),
      },
      functionsArchiveBytes: {
        exportType: state.functions.packaged.exportType,
        archiveBytes: state.functions.packaged.archiveBytes,
        archiveSha256: state.functions.packaged.archiveSha256,
        cliSourceHash: state.functions.packaged.cliSourceHash,
        entryCount: state.functions.packaged.entries.length,
        entries: state.functions.packaged.entries,
        entriesDigest: sha256Json(state.functions.packaged.entries),
      },
      functionsUploadStream: {
        streamedBytes: state.functions.uploaded.streamedBytes,
        streamedSha256: state.functions.uploaded.streamedSha256,
        generation: state.functions.uploaded.generation || null,
      },
    },
    releaseBarrier: {
      verifiedBeforeFunctionsRelease: state.release.verifiedBeforeFunctionsRelease,
      verifiedBeforeHostingRelease: state.release.verifiedBeforeHostingRelease,
      functionsReleaseExecuted: state.release.functionsReleaseExecuted,
      hostingReleaseExecuted: state.release.hostingReleaseExecuted,
      targetOrderObserved: [...state.release.targetOrderObserved],
    },
  };
}

function signAndWriteAttestation(state) {
  const body = buildAttestationBody(state);
  const digest = sha256Json(body);
  const full = { ...body, digest };
  const serialized = `${JSON.stringify(full, null, 2)}\n`;
  scanNoSecretLeaks(serialized, process.env);
  fs.mkdirSync(path.dirname(state.attestationOutAbs), { recursive: true });
  const tmpOut = `${state.attestationOutAbs}.tmp-${process.pid}`;
  fs.writeFileSync(tmpOut, serialized, "utf8");
  fs.renameSync(tmpOut, state.attestationOutAbs);
  return full;
}

/** Validate an upload-boundary attestation fail-closed against predeploy manifest & expected binding. */
function validateUploadAttestation(att, predeployManifest, root, expectedBinding, opts) {
  const options = opts || {};
  if (!att || typeof att !== "object" || Array.isArray(att)) {
    throw new BoundaryFailure("E_ATTESTATION_INVALID", "Upload attestation must be a JSON object.");
  }
  if (att.version !== ATTESTATION_VERSION || att.kind !== ATTESTATION_KIND) {
    throw new BoundaryFailure("E_ATTESTATION_INVALID", "Upload attestation version or kind mismatch.");
  }
  if (att.actualRemoteUpload !== "NOT_PROVEN" || att.actualDeployedRelease !== "NOT_PROVEN") {
    throw new BoundaryFailure(
      "E_UNSUPPORTED_ATTESTATION_CLAIM",
      "Upload attestation cannot claim remote persistence or live release without independent cloud readback.",
    );
  }
  if (!Array.isArray(att.limitations) || att.limitations.length === 0) {
    throw new BoundaryFailure("E_ATTESTATION_INVALID", "Upload attestation must disclose limitations.");
  }
  if (att.transportMode !== "OFFLINE_MOCK_TRANSPORT" && att.transportMode !== "REAL_FIREBASE_CLI") {
    throw new BoundaryFailure("E_ATTESTATION_INVALID", "Invalid transportMode in attestation.");
  }
  if (process.env.GITHUB_ACTIONS === "true" && att.transportMode === "OFFLINE_MOCK_TRANSPORT") {
    throw new BoundaryFailure("E_BYPASS_DISALLOWED", "Mock transport attestation is forbidden in GitHub Actions.");
  }

  scanNoSecretLeaks(JSON.stringify(att), process.env);

  let preReport;
  try {
    preReport = g8.validatePredeployManifest(predeployManifest, root, expectedBinding);
  } catch (err) {
    throw new BoundaryFailure(err.code || "E_MANIFEST_INVALID", err.message, err.detail);
  }

  if (!att.predeployManifest || att.predeployManifest.digest !== preReport.digest) {
    throw new BoundaryFailure("E_ATTESTATION_INVALID", "Attestation predeployManifest.digest mismatch.");
  }

  const bindingNorm = g8.normalizeBinding(att.binding, { repoRoot: root });
  for (const k of Object.keys(preReport.binding)) {
    if (bindingNorm[k] !== preReport.binding[k]) {
      throw new BoundaryFailure("E_BINDING_MISMATCH", `Attestation binding.${k} mismatches predeploy binding.`, {
        field: k,
      });
    }
  }

  const b = att.boundaries;
  if (!b || !b.hostingEnumeration || !b.hostingRawBytes || !b.hostingCompressedBytes || !b.functionsArchiveBytes || !b.functionsUploadStream) {
    throw new BoundaryFailure("E_ATTESTATION_INVALID", "Attestation boundaries section is incomplete.");
  }

  const expectedHosting = predeployManifest.surfaces.hosting.files;
  const expectedFunctions = predeployManifest.surfaces.functions.files;

  const enumSorted = [...b.hostingEnumeration.files].sort();
  if (
    JSON.stringify(enumSorted) !== JSON.stringify(expectedHosting.map((f) => f.path).sort()) ||
    b.hostingEnumeration.enumerationDigest !== sha256Json(enumSorted)
  ) {
    throw new BoundaryFailure("E_BOUNDARY_FILE_SET_MISMATCH", "Attestation hostingEnumeration does not match predeploy manifest.");
  }

  const actualRawMapped = b.hostingRawBytes.files.map((f) => ({ path: f.path, bytes: f.bytes, sha256: f.rawSha256 }));
  reconcileFileLists(expectedHosting, actualRawMapped, "E_BOUNDARY_RAW_MISMATCH", "Attestation hostingRawBytes");
  if (b.hostingRawBytes.rawSurfaceDigest !== sha256Json(b.hostingRawBytes.files)) {
    throw new BoundaryFailure("E_ATTESTATION_INVALID", "Attestation rawSurfaceDigest mismatch.");
  }

  const compByPath = new Map(b.hostingCompressedBytes.files.map((f) => [f.path, f]));
  for (const exp of expectedHosting) {
    const cf = compByPath.get(exp.path);
    if (!cf || !/^[0-9a-f]{64}$/.test(cf.compressedSha256) || !cf.populateVerified) {
      throw new BoundaryFailure("E_BOUNDARY_POPULATE_MISMATCH", `Missing populateFiles proof for "${exp.path}".`, {
        path: exp.path,
      });
    }
  }
  if (b.hostingCompressedBytes.compressedSurfaceDigest !== sha256Json(b.hostingCompressedBytes.files)) {
    throw new BoundaryFailure("E_ATTESTATION_INVALID", "Attestation compressedSurfaceDigest mismatch.");
  }

  reconcileFileLists(expectedFunctions, b.functionsArchiveBytes.entries, "E_FUNCTIONS_ARCHIVE_MISMATCH", "Functions archive");
  if (b.functionsArchiveBytes.entriesDigest !== sha256Json(b.functionsArchiveBytes.entries)) {
    throw new BoundaryFailure("E_ATTESTATION_INVALID", "Attestation entriesDigest mismatch.");
  }
  if (
    b.functionsUploadStream.streamedBytes !== b.functionsArchiveBytes.archiveBytes ||
    b.functionsUploadStream.streamedSha256 !== b.functionsArchiveBytes.archiveSha256
  ) {
    throw new BoundaryFailure("E_FUNCTIONS_STREAM_MISMATCH", "Functions upload stream differs from packaged archive.");
  }

  const rb = att.releaseBarrier;
  if (!rb || rb.verifiedBeforeFunctionsRelease !== true) {
    throw new BoundaryFailure("E_RELEASE_BARRIER_BYPASSED", "Pre-release barrier was not verified before Functions release.");
  }
  if (options.requireReleaseComplete) {
    if (!rb.verifiedBeforeHostingRelease || !rb.functionsReleaseExecuted || !rb.hostingReleaseExecuted) {
      throw new BoundaryFailure("E_RELEASE_INCOMPLETE", "Release lifecycle did not complete all verified release stages.");
    }
  }

  const { digest: actualDigest, ...body } = att;
  if (typeof actualDigest !== "string" || !/^[0-9a-f]{64}$/.test(actualDigest) || sha256Json(body) !== actualDigest) {
    throw new BoundaryFailure("E_ATTESTATION_DIGEST", "Attestation own SHA-256 digest mismatch.");
  }

  return {
    result: "PASS",
    transportMode: att.transportMode,
    attestationScope: att.attestationScope,
    actualRemoteUpload: att.actualRemoteUpload,
    actualDeployedRelease: att.actualDeployedRelease,
    rawSurfaceDigest: b.hostingRawBytes.rawSurfaceDigest,
    compressedSurfaceDigest: b.hostingCompressedBytes.compressedSurfaceDigest,
    functionsArchiveSha256: b.functionsArchiveBytes.archiveSha256,
    digest: actualDigest,
    binding: bindingNorm,
  };
}

/** Verify wrapper session file + active parent wrapper PID inside `hosting.predeploy` (`assert-active`). */
function resolveCliRoot(root, flags) {
  if (flags && flags["--cli-root"]) return path.resolve(flags["--cli-root"]);
  const resolved = path.resolve(root);
  if (
    fs.existsSync(path.join(resolved, "package.json")) ||
    fs.existsSync(path.join(resolved, "node_modules"))
  ) {
    return resolved;
  }
  return path.resolve(__dirname, "..");
}

function runAssertActive(root, env, flags) {
  const e = env || process.env;
  assertSafeWrapperEnvironment(e);
  const resolvedRoot = path.resolve(root);
  const cliRoot = resolveCliRoot(resolvedRoot, flags);
  const nonce = e.CT4_G8_BOUNDARY_NONCE;
  const sessionRel = e.CT4_G8_BOUNDARY_SESSION;
  const pidStr = e.CT4_G8_BOUNDARY_PID;
  if (isBlank(nonce) || isBlank(sessionRel) || isBlank(pidStr)) {
    throw new BoundaryFailure(
      "E_BOUNDARY_WRAPPER_NOT_ACTIVE",
      "Direct `firebase deploy` without ct4-web-p0-firebase-upload-boundary.cjs exec wrapper is forbidden.",
    );
  }
  const normalizedRel = String(sessionRel).replace(/\\/g, "/");
  g8.validateRelativePath(normalizedRel);
  g8.assertNoSymlinkChain(resolvedRoot, normalizedRel);
  const sessionAbs = path.join(resolvedRoot, ...normalizedRel.split("/"));
  if (!fs.existsSync(sessionAbs)) {
    throw new BoundaryFailure("E_BOUNDARY_WRAPPER_NOT_ACTIVE", "Active boundary wrapper session file is absent.");
  }
  const session = JSON.parse(fs.readFileSync(sessionAbs, "utf8"));
  const expectedNonceHash = sha256Buffer(Buffer.from(String(nonce), "utf8"));
  if (session.nonceHash !== expectedNonceHash || String(session.pid) !== String(pidStr)) {
    throw new BoundaryFailure("E_BOUNDARY_WRAPPER_NOT_ACTIVE", "Boundary wrapper session nonce or PID mismatch.");
  }
  try {
    process.kill(Number(session.pid), 0);
  } catch {
    throw new BoundaryFailure("E_BOUNDARY_WRAPPER_NOT_ACTIVE", "Boundary wrapper parent PID is not alive.");
  }
  const cliIntegrity = verifyCliIntegrity(cliRoot);
  if (cliIntegrity.modulesDigest !== session.cliModulesDigest) {
    throw new BoundaryFailure("E_CLI_MODULE_TAMPER", "CLI integrity drifted between wrapper launch and predeploy.");
  }
  return { result: "PASS", pid: session.pid, cliModulesDigest: cliIntegrity.modulesDigest };
}

/** Create offline mock-transport router for `apiv2.Client.prototype.request` (zero network). */
function createOfflineMockTransport(options) {
  const opts = options || {};
  const records = {
    requests: [],
    hostingPopulateBatches: [],
    hostingUploadedStreams: new Map(),
    functionsUploadedStreams: [],
    functionsReleaseCalls: 0,
    hostingFinalizeCalls: 0,
    hostingCreateReleaseCalls: 0,
  };

  async function drainStreamAndHash(stream) {
    const hash = createHash("sha256");
    let bytes = 0;
    let firstChunk = null;
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (!firstChunk && buf.length > 0) firstChunk = buf;
      bytes += buf.length;
      hash.update(buf);
    }
    return { bytes, sha256: hash.digest("hex"), firstChunk };
  }

  async function handleRequest(reqOptions) {
    const fullUrl = this.requestURL(reqOptions);
    const method = (reqOptions.method || "GET").toUpperCase();
    records.requests.push({ method, url: fullUrl });

    if (opts.onRequest) {
      await opts.onRequest({ method, url: fullUrl, reqOptions, records });
    }

    if (fullUrl.includes(":populateFiles")) {
      const batch = reqOptions.body && reqOptions.body.files ? reqOptions.body.files : {};
      records.hostingPopulateBatches.push(batch);
      const hashes = [...new Set(Object.values(batch))];
      const required = opts.cdnCachedHashes
        ? hashes.filter((h) => !opts.cdnCachedHashes.has(h))
        : hashes;
      return {
        status: 200,
        response: { headers: new Headers() },
        body: {
          uploadUrl: "https://upload.firebasehosting.mock.invalid/upload",
          uploadRequiredHashes: required,
        },
      };
    }

    if (fullUrl.startsWith("https://upload.firebasehosting.mock.invalid/upload/")) {
      const targetHash = fullUrl.split("/").pop();
      const streamed = await drainStreamAndHash(reqOptions.body);
      records.hostingUploadedStreams.set(targetHash, streamed);
      return {
        status: 200,
        response: { headers: new Headers() },
        body: PassThrough.from([]),
      };
    }

    if (fullUrl.startsWith("https://storage.googleapis.mock.invalid/upload/")) {
      const streamed = await drainStreamAndHash(reqOptions.body);
      records.functionsUploadedStreams.push(streamed);
      return {
        status: 200,
        response: { headers: new Headers({ "x-goog-generation": "1794970000000001" }) },
        body: "<Ok/>",
      };
    }

    if (fullUrl.includes(":generateUploadUrl")) {
      return {
        status: 200,
        response: { headers: new Headers() },
        body: {
          uploadUrl: "https://storage.googleapis.mock.invalid/upload/signed-fn-upload?GoogleAccessId=mock",
          storageSource: { bucket: "gcf-v2-sources-mock", object: "function-source.zip" },
        },
      };
    }

    if (fullUrl.includes(":testIamPermissions")) {
      const perms = (reqOptions.body && reqOptions.body.permissions) || [];
      return { status: 200, response: { headers: new Headers() }, body: { permissions: perms } };
    }

    if (fullUrl.includes("/versions") && method === "POST" && !fullUrl.includes(":")) {
      return {
        status: 200,
        response: { headers: new Headers() },
        body: { name: "projects/-/sites/canil-gcm/versions/mock-ver-001" },
      };
    }

    if (fullUrl.includes("/versions/mock-ver-001") && method === "PATCH") {
      records.hostingFinalizeCalls += 1;
      return {
        status: 200,
        response: { headers: new Headers() },
        body: { name: "projects/-/sites/canil-gcm/versions/mock-ver-001", status: "FINALIZED" },
      };
    }

    if (fullUrl.includes("/releases") && method === "POST") {
      records.hostingCreateReleaseCalls += 1;
      return {
        status: 200,
        response: { headers: new Headers() },
        body: { name: "projects/-/sites/canil-gcm/channels/live/releases/mock-rel-001" },
      };
    }

    if (fullUrl.includes("cloudfunctions.googleapis.com") && fullUrl.includes("/functions") && (method === "POST" || method === "PATCH")) {
      records.functionsReleaseCalls += 1;
      return {
        status: 200,
        response: { headers: new Headers() },
        body: {
          name: "projects/canil-gcm/locations/southamerica-east1/operations/op-fn-1",
          done: true,
          response: {
            name: "projects/canil-gcm/locations/southamerica-east1/functions/ssrcanilgcm",
            serviceConfig: {
              service: "projects/canil-gcm/locations/southamerica-east1/services/ssrcanilgcm",
              uri: "https://ssrcanilgcm-mock.a.run.app",
            },
            state: "ACTIVE",
          },
        },
      };
    }

    if (fullUrl.includes("/sites/canil-gcm/channels/live")) {
      return {
        status: 200,
        response: { headers: new Headers() },
        body: { name: "projects/canil-gcm/sites/canil-gcm/channels/live", release: { version: { config: { rewrites: [] } } } },
      };
    }

    if (fullUrl.includes("/sites/canil-gcm")) {
      return {
        status: 200,
        response: { headers: new Headers() },
        body: { name: "projects/canil-gcm/sites/canil-gcm", type: "DEFAULT_SITE", defaultUrl: "https://canil-gcm.web.app" },
      };
    }

    if (fullUrl.includes("/sites") && method === "GET") {
      return {
        status: 200,
        response: { headers: new Headers() },
        body: { sites: [{ name: "projects/canil-gcm/sites/canil-gcm", type: "DEFAULT_SITE", defaultUrl: "https://canil-gcm.web.app" }] },
      };
    }

    if (fullUrl.includes("adminSdkConfig")) {
      return {
        status: 200,
        response: { headers: new Headers() },
        body: { projectId: "canil-gcm", storageBucket: "canil-gcm.appspot.com", locationId: "us-central" },
      };
    }

    if (fullUrl.includes("cloudresourcemanager.googleapis.com/v1/projects/canil-gcm") || fullUrl.includes("firebase.googleapis.com/v1beta1/projects/canil-gcm")) {
      return {
        status: 200,
        response: { headers: new Headers() },
        body: {
          projectId: "canil-gcm",
          projectNumber: "418249404282",
          displayName: "Canil GCM",
          resources: {
            hostingSite: "canil-gcm",
            storageBucket: "canil-gcm.appspot.com",
          },
        },
      };
    }

    if (fullUrl.includes("runtimeconfig.googleapis.com")) {
      return { status: 200, response: { headers: new Headers() }, body: { configs: [] } };
    }

    if (fullUrl.includes("serviceusage.googleapis.com")) {
      return { status: 200, response: { headers: new Headers() }, body: { state: "ENABLED", done: true } };
    }

    if (fullUrl.includes("cloudfunctions.googleapis.com") && fullUrl.includes("/locations/-/functions")) {
      return { status: 200, response: { headers: new Headers() }, body: { functions: [] } };
    }

    if (fullUrl.includes("run.googleapis.com") && fullUrl.includes("/services")) {
      return {
        status: 200,
        response: { headers: new Headers() },
        body: {
          metadata: {
            name: "ssrcanilgcm",
            namespace: "canil-gcm",
            generation: 1,
            labels: {
              "cloud.googleapis.com/location": "southamerica-east1",
            },
          },
          spec: {
            traffic: [
              {
                revisionName: "ssrcanilgcm-00001-mock",
                percent: 100,
              },
            ],
          },
          status: {
            latestReadyRevisionName: "ssrcanilgcm-00001-mock",
            observedGeneration: 1,
            conditions: [
              {
                type: "Ready",
                status: "True",
              },
            ],
          },
          services: [],
        },
      };
    }

    if (fullUrl.includes(":getIamPolicy") || fullUrl.includes(":setIamPolicy")) {
      return { status: 200, response: { headers: new Headers() }, body: { bindings: [] } };
    }

    if (fullUrl.includes("artifactregistry.googleapis.com")) {
      return {
        status: 200,
        response: { headers: new Headers() },
        body: {
          name: "projects/canil-gcm/locations/southamerica-east1/repositories/gcf-artifacts",
          format: "DOCKER",
          cleanupPolicies: {
            "firebase-functions-cleanup": {
              id: "firebase-functions-cleanup",
              condition: { tagState: "ANY", olderThan: "86400s" },
              action: "DELETE",
            },
          },
          repositories: [],
        },
      };
    }

    if (fullUrl.includes("/operations/")) {
      return {
        status: 200,
        response: { headers: new Headers() },
        body: {
          name: "projects/canil-gcm/locations/southamerica-east1/operations/op-fn-1",
          done: true,
          response: {
            name: "projects/canil-gcm/locations/southamerica-east1/functions/ssrcanilgcm",
            serviceConfig: {
              service: "projects/canil-gcm/locations/southamerica-east1/services/ssrcanilgcm",
              uri: "https://ssrcanilgcm-mock.a.run.app",
            },
            state: "ACTIVE",
            url: "https://ssrcanilgcm-mock.a.run.app",
          },
        },
      };
    }

    if (fullUrl.includes("firebase-public")) {
      return { status: 200, response: { headers: new Headers() }, body: {} };
    }

    return { status: 200, response: { headers: new Headers() }, body: {} };
  }

  return { handleRequest, records };
}

function toFirebaseError(err, fbErrorCtor) {
  if (err && err.constructor && err.constructor.name === "FirebaseError") return err;
  const code = err && err.code ? err.code : "E_BOUNDARY_INTERNAL";
  const msg = `CT4 WEB-P0 G8 upload boundary: FAIL ${code} — ${err && err.message ? err.message : String(err)}`;
  if (fbErrorCtor) {
    return new fbErrorCtor(msg, { exit: 1, original: err });
  }
  const e = new Error(msg);
  e.exit = 1;
  return e;
}

/**
 * Install in-process `require.cache` boundary hooks over verified firebase-tools@15.25.1 modules.
 * Must be invoked AFTER verifyCliIntegrity(root) and BEFORE loading `lib/bin/firebase.js`.
 */
function installInProcessBoundaryHooks(config) {
  const resolvedRoot = path.resolve(config.root);
  const cliRoot = config.cliRoot ? path.resolve(config.cliRoot) : resolvedRoot;
  const ftBase = path.join(cliRoot, "node_modules", "firebase-tools", "lib");
  const requireFromRoot = (rel) => require(path.join(ftBase, ...rel.split("/")));

  const { FirebaseError } = requireFromRoot("error.js");
  const apiv2 = requireFromRoot("apiv2.js");
  const listFilesMod = requireFromRoot("listFiles.js");
  const fsAsyncMod = requireFromRoot("fsAsync.js");
  const hashcacheMod = requireFromRoot("deploy/hosting/hashcache.js");
  const uploaderMod = requireFromRoot("deploy/hosting/uploader.js");
  const hostingDeployMod = requireFromRoot("deploy/hosting/deploy.js");
  const hostingReleaseMod = requireFromRoot("deploy/hosting/release.js");
  const prepareFnUploadMod = requireFromRoot("deploy/functions/prepareFunctionsUpload.js");
  const fnDeployMod = requireFromRoot("deploy/functions/deploy.js");
  const fnReleaseMod = requireFromRoot("deploy/functions/release/index.js");
  const gcsMod = requireFromRoot("gcp/storage.js");
  const deployMod = requireFromRoot("deploy/index.js");
  const archiverPath = require.resolve("archiver", { paths: [cliRoot, path.join(cliRoot, "node_modules", "firebase-tools")] });
  const origArchiver = require(archiverPath);

  const restorable = [];
  const patchProp = (obj, key, replacement) => {
    const prev = obj[key];
    obj[key] = replacement;
    restorable.push(() => {
      obj[key] = prev;
    });
  };

  const state = {
    root: resolvedRoot,
    cliRoot,
    mockTransport: Boolean(config.mockTransport),
    verifyGit: Boolean(config.verifyGit),
    predeployManifestAbs: config.predeployManifestAbs,
    predeployManifestRel: config.predeployManifestRel,
    attestationOutAbs: config.attestationOutAbs,
    expectedBinding: config.expectedBinding,
    cliIntegrity: config.cliIntegrity,
    predeployManifest: null,
    hostingCfg: null,
    inPrepareFunctionsUpload: false,
    hosting: {
      enumeratedFiles: null,
      pass1ByPath: new Map(),
      hashToPaths: new Map(),
      populatedPaths: new Set(),
      requiredUploadHashes: new Set(),
      uploadedHashes: new Set(),
      uploadStreamsByHash: new Map(),
      activeZipTracks: new WeakMap(),
    },
    functions: {
      packaged: null,
      uploaded: null,
      skipChecked: false,
    },
    release: {
      verifiedBeforeFunctionsRelease: false,
      verifiedBeforeHostingRelease: false,
      functionsReleaseExecuted: false,
      hostingReleaseExecuted: false,
      targetOrderObserved: [],
    },
  };

  function verifyPredeployManifestMetaAndBinding(manifestObj) {
    if (!manifestObj || typeof manifestObj !== "object" || Array.isArray(manifestObj)) {
      throw new BoundaryFailure("E_MANIFEST_INVALID", "Predeploy manifest is not an object.");
    }
    if (
      manifestObj.version !== g8.MANIFEST_VERSION ||
      manifestObj.mode !== "firebase-predeploy" ||
      manifestObj.attestationScope !== "PREDEPLOY_MATERIALIZED_SURFACES" ||
      manifestObj.realUploaderHookAttested !== false ||
      typeof manifestObj.limitation !== "string" ||
      manifestObj.limitation.trim().length === 0
    ) {
      throw new BoundaryFailure("E_MANIFEST_INVALID", "Predeploy manifest metadata or limitation is invalid.");
    }
    const hostingCfg = g8.readFirebaseHostingConfig(state.root);
    const reconciled = g8.reconcilePredeploySurfaces(state.root, hostingCfg.site, manifestObj.binding && manifestObj.binding.buildId);
    const binding = g8.normalizeBinding(manifestObj.binding, { repoRoot: state.root });
    if (state.expectedBinding) {
      const exp = g8.normalizeBinding(
        { ...state.expectedBinding, buildId: state.expectedBinding.buildId || reconciled.buildId },
        { repoRoot: state.root },
      );
      for (const k of Object.keys(exp)) {
        if (binding[k] !== exp[k]) {
          throw new BoundaryFailure("E_BINDING_MISMATCH", `Predeploy binding.${k} mismatches expected release binding.`, {
            field: k,
          });
        }
      }
    }
    if (!manifestObj.surfaces || !manifestObj.surfaces.hosting || !manifestObj.surfaces.functions) {
      throw new BoundaryFailure("E_MANIFEST_INVALID", "Predeploy manifest missing hosting or functions surface.");
    }
    const hSurf = manifestObj.surfaces.hosting;
    const fSurf = manifestObj.surfaces.functions;
    if (
      hSurf.surfaceDigest !== sha256Json({ surface: hSurf.surface, rootRelative: hSurf.rootRelative, files: hSurf.files }) ||
      fSurf.surfaceDigest !== sha256Json({ surface: fSurf.surface, rootRelative: fSurf.rootRelative, files: fSurf.files })
    ) {
      throw new BoundaryFailure("E_MANIFEST_DIGEST", "Predeploy surfaceDigest mismatch.");
    }
    const { digest, ...body } = manifestObj;
    if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest) || sha256Json(body) !== digest) {
      throw new BoundaryFailure("E_MANIFEST_DIGEST", "Predeploy manifest own digest mismatch.");
    }
    if (state.verifyGit) {
      g8.verifyGitBinding(state.root, binding);
    }
    return { hostingCfg };
  }

  function loadAndCheckPredeployManifest() {
    if (!fs.existsSync(state.predeployManifestAbs)) {
      throw new BoundaryFailure(
        "E_PREDEPLOY_MANIFEST_ABSENT",
        `Predeploy manifest absent at ${state.predeployManifestRel}.`,
      );
    }
    const manifestObj = g8.readJsonFile(
      state.predeployManifestAbs,
      "E_PREDEPLOY_MANIFEST_ABSENT",
      "E_MANIFEST_INVALID",
      "Predeploy manifest",
    );
    try {
      const { hostingCfg } = verifyPredeployManifestMetaAndBinding(manifestObj);
      state.predeployManifest = manifestObj;
      state.hostingCfg = hostingCfg;
      return manifestObj;
    } catch (err) {
      throw new BoundaryFailure(err.code || "E_MANIFEST_INVALID", err.message, err.detail);
    }
  }

  // 1. Optional offline mock-transport + hard network block
  let netBlockRestore = null;
  if (state.mockTransport) {
    if (process.env.GITHUB_ACTIONS === "true") {
      throw new BoundaryFailure("E_BYPASS_DISALLOWED", "--mock-transport is strictly forbidden in GitHub Actions.");
    }
    const mock = config.mockTransportAdapter || createOfflineMockTransport(config.mockOptions);
    state.mockRecords = mock.records;
    patchProp(apiv2.Client.prototype, "request", mock.handleRequest);

    const blockNetwork = () => {
      throw new BoundaryFailure(
        "E_NETWORK_DISABLED_IN_HARNESS",
        "Real network calls are disabled in offline mock-transport mode.",
      );
    };
    const origHttpReq = http.request;
    const origHttpsReq = https.request;
    const origNetConnect = net.Socket.prototype.connect;
    const origFetch = globalThis.fetch;
    http.request = blockNetwork;
    https.request = blockNetwork;
    net.Socket.prototype.connect = blockNetwork;
    globalThis.fetch = async () => blockNetwork();

    netBlockRestore = () => {
      http.request = origHttpReq;
      https.request = origHttpsReq;
      net.Socket.prototype.connect = origNetConnect;
      globalThis.fetch = origFetch;
    };

    const fetchMotdMod = requireFromRoot("fetchMOTD.js");
    const requireAuthMod = requireFromRoot("requireAuth.js");
    const frameworksMod = requireFromRoot("frameworks/index.js");
    const runtimesMod = requireFromRoot("deploy/functions/runtimes/index.js");
    const loggerMod = requireFromRoot("logger.js");

    patchProp(fetchMotdMod, "fetchMOTD", () => {});
    patchProp(requireAuthMod, "requireAuth", async () => "mock@canil-gcm.invalid");
    patchProp(loggerMod, "useFileLogger", () => path.join(os.tmpdir(), `ct4-mock-fb-${process.pid}.log`));

    patchProp(frameworksMod, "prepareFrameworks", async (_purpose, _targetNames, _context, options) => {
      const configs = requireFromRoot("hosting/config.js").hostingConfig(options);
      for (const cfg of configs) {
        if (!cfg.source) continue;
        const site = cfg.site || g8.PRODUCTION_SITE;
        const hDist = path.join(state.root, ".firebase", site, "hosting");
        const fDist = path.join(state.root, ".firebase", site, "functions");
        if (!fs.existsSync(hDist) || !fs.existsSync(fDist)) {
          throw new BoundaryFailure(
            "E_PREDEPLOY_SURFACES_ABSENT",
            `Offline fixture requires pre-materialized .firebase/${site}/{hosting,functions}.`,
          );
        }
        cfg.public = path.relative(state.root, hDist).split(path.sep).join("/");
        cfg.webFramework = "next_ssr";
        cfg.rewrites = cfg.rewrites || [];
        cfg.rewrites.push({
          source: "/**",
          function: {
            functionId: `ssr${site.toLowerCase().replace(/-/g, "").substring(0, 20)}`,
            region: "southamerica-east1",
            pinTag: true,
          },
        });
        const existingFns = options.config.get("functions") ? [].concat(options.config.get("functions")) : [];
        options.config.set("functions", [
          ...existingFns,
          {
            source: path.relative(state.root, fDist).split(path.sep).join("/"),
            codebase: `firebase-frameworks-${site}`,
            runtime: "nodejs22",
          },
        ]);
      }
    });

    const origGetRuntimeDelegate = runtimesMod.getRuntimeDelegate;
    patchProp(runtimesMod, "getRuntimeDelegate", async (delegateContext) => {
      const fnPkg = path.join(delegateContext.sourceDir, "node_modules", "firebase-functions");
      if (fs.existsSync(fnPkg)) {
        return origGetRuntimeDelegate(delegateContext);
      }
      return {
        language: "nodejs",
        runtime: delegateContext.runtime || "nodejs22",
        validate: async () => {},
        build: async () => {},
        watch: async () => () => Promise.resolve(),
        discoverBuild: async () => ({
          endpoints: {
            ssrcanilgcm: {
              project: delegateContext.projectId || g8.PRODUCTION_PROJECT_ID,
              platform: "gcfv2",
              region: ["southamerica-east1"],
              httpsTrigger: {},
              entryPoint: "ssrcanilgcm",
            },
          },
          params: [],
          requiredAPIs: [],
        }),
      };
    });
  }

  // 2. Patch archiver.create so even modules holding an earlier `require("archiver")` binding are wrapped
  const origArchiverCreate = origArchiver.create;
  patchProp(origArchiver, "create", function wrappedArchiverCreate(format, opts) {
    const inst = origArchiverCreate.call(origArchiver, format, opts);
    const seenArchiveEntries = new Set();
    const seenArchiveLower = new Set();

    inst.on("warning", (warnErr) => {
      inst.emit(
        "error",
        new BoundaryFailure(
          "E_ARCHIVE_WARNING",
          `Archiver warning escalated to fatal error: ${warnErr && warnErr.message ? warnErr.message : String(warnErr)}`,
        ),
      );
    });

    const checkEntryName = (name) => {
      const norm = String(name || "");
      try {
        g8.validateRelativePath(norm);
      } catch (err) {
        throw new BoundaryFailure(err.code || "E_PATH_TRAVERSAL", err.message, { path: norm });
      }
      if (seenArchiveEntries.has(norm)) {
        throw new BoundaryFailure("E_ARCHIVE_DUPLICATE_ENTRY", `Duplicate archive entry "${norm}".`, { path: norm });
      }
      const lower = norm.toLowerCase();
      if (seenArchiveLower.has(lower)) {
        throw new BoundaryFailure("E_CASE_COLLISION", `Case-colliding archive entry "${norm}".`, { path: norm });
      }
      seenArchiveEntries.add(norm);
      seenArchiveLower.add(lower);
    };

    const origFile = inst.file.bind(inst);
    inst.file = (srcPath, data, ...rest) => {
      if (data && data.name) checkEntryName(data.name);
      return origFile(srcPath, data, ...rest);
    };
    const origAppend = inst.append.bind(inst);
    inst.append = (source, data, ...rest) => {
      if (data && data.name) checkEntryName(data.name);
      return origAppend(source, data, ...rest);
    };
    return inst;
  });

  // 3. Patch fsAsync.readdirRecursive to block symlinks/junctions during prepareFunctionsUpload
  const origReaddirRecursive = fsAsyncMod.readdirRecursive;
  patchProp(fsAsyncMod, "readdirRecursive", async function wrappedReaddirRecursive(opts) {
    const files = await origReaddirRecursive.call(this, opts);
    if (state.inPrepareFunctionsUpload && opts && opts.path) {
      g8.walkFiles(opts.path, g8.makeFunctionsMatcher());
      for (const f of files) {
        const rel = path.relative(opts.path, f.name).split(path.sep).join("/");
        g8.validateRelativePath(rel);
        g8.assertNoSymlinkChain(opts.path, rel);
      }
    }
    return files;
  });

  // 4. Patch hashcache to never bypass hashing via stale mtime caches
  patchProp(hashcacheMod, "load", () => new Map());
  patchProp(hashcacheMod, "dump", () => {});

  // 5. Patch listFiles to enforce containment, NFC, case collisions, and 1:1 predeploy parity
  const origListFiles = listFilesMod.listFiles;
  patchProp(listFilesMod, "listFiles", function wrappedListFiles(cwd, ignore) {
    try {
      const manifest = state.predeployManifest || loadAndCheckPredeployManifest();
      const expectedFiles = manifest.surfaces.hosting.files;
      const expectedDir = path.resolve(state.root, ...manifest.surfaces.hosting.rootRelative.split("/"));
      if (g8.canonicalContainmentPath(cwd) !== g8.canonicalContainmentPath(expectedDir)) {
        throw new BoundaryFailure("E_BOUNDARY_ROOT_MISMATCH", "Hosting publicDir does not match predeploy hosting surface root.");
      }

      const statRoot = fs.lstatSync(cwd);
      if (statRoot.isSymbolicLink()) {
        throw new BoundaryFailure("E_LINK_UNPROVABLE", "Hosting publicDir itself is a symlink.");
      }
      g8.walkFiles(cwd, g8.makeHostingMatcher(state.hostingCfg.ignore));

      const rawListed = origListFiles.call(this, cwd, ignore);
      const listed = rawListed.map((p) => p.split(path.sep).join("/")).sort();
      const seen = new Set();
      const seenLower = new Set();

      for (const rel of listed) {
        g8.validateRelativePath(rel);
        g8.assertNoSymlinkChain(cwd, rel);
        if (seen.has(rel)) {
          throw new BoundaryFailure("E_BOUNDARY_FILE_SET_MISMATCH", `Duplicate Hosting path "${rel}".`);
        }
        if (seenLower.has(rel.toLowerCase())) {
          throw new BoundaryFailure("E_CASE_COLLISION", `Case-colliding Hosting path "${rel}".`);
        }
        seen.add(rel);
        seenLower.add(rel.toLowerCase());
      }

      const expectedSet = new Set(expectedFiles.map((f) => f.path));
      for (const exp of expectedSet) {
        if (!seen.has(exp)) {
          throw new BoundaryFailure("E_BOUNDARY_FILE_SET_MISMATCH", `listFiles() omitted predeploy file "${exp}".`, {
            path: exp,
          });
        }
      }
      for (const act of seen) {
        if (!expectedSet.has(act)) {
          throw new BoundaryFailure("E_BOUNDARY_FILE_SET_MISMATCH", `listFiles() discovered unlisted file "${act}".`, {
            path: act,
          });
        }
      }

      state.hosting.enumeratedFiles = listed;
      return rawListed;
    } catch (err) {
      throw toFirebaseError(err, FirebaseError);
    }
  });

  // 6. Patch Uploader methods for dual-stream raw+gzip verification & race-free Node 22 queue handling
  const origUploader = uploaderMod.Uploader;
  patchProp(origUploader.prototype, "zipStream", function wrappedZipStream(filePath) {
    g8.validateRelativePath(filePath);
    g8.assertNoSymlinkChain(this.public, filePath);
    const full = path.resolve(this.public, filePath);
    const fileStream = fs.createReadStream(full);
    const rawHash = createHash("sha256");
    let rawBytes = 0;

    const rawTap = new Transform({
      transform(chunk, _enc, cb) {
        rawBytes += chunk.length;
        rawHash.update(chunk);
        cb(null, chunk);
      },
    });

    const gzip = zlib.createGzip({ level: this.gzipLevel });
    const gzHash = createHash("sha256");
    let gzBytes = 0;
    let gzipOsByte = null;

    const gzTap = new Transform({
      transform(chunk, _enc, cb) {
        if (gzipOsByte === null && gzBytes === 0 && chunk.length >= 10) {
          gzipOsByte = chunk[9];
        }
        gzBytes += chunk.length;
        gzHash.update(chunk);
        cb(null, chunk);
      },
    });

    const forwardErr = (err) => gzTap.destroy(err);
    fileStream.on("error", forwardErr);
    rawTap.on("error", forwardErr);
    gzip.on("error", forwardErr);

    const outStream = fileStream.pipe(rawTap).pipe(gzip).pipe(gzTap);
    state.hosting.activeZipTracks.set(outStream, {
      filePath,
      done: () => ({
        rawBytes,
        rawSha256: rawHash.digest("hex"),
        compressedBytes: gzBytes,
        compressedSha256: gzHash.digest("hex"),
        gzipOsByte,
      }),
    });
    return outStream;
  });

  patchProp(origUploader.prototype, "hashHandler", async function wrappedHashHandler(filePath) {
    try {
      const manifest = state.predeployManifest || loadAndCheckPredeployManifest();
      const expected = manifest.surfaces.hosting.files.find((f) => f.path === filePath);
      if (!expected) {
        throw new BoundaryFailure("E_BOUNDARY_FILE_SET_MISMATCH", `Uploader Pass 1 received unlisted file "${filePath}".`, {
          path: filePath,
        });
      }
      const check = g8.assertNoSymlinkChain(this.public, filePath);
      if (!check.exists || !check.lstat.isFile()) {
        throw new BoundaryFailure("E_BOUNDARY_RAW_MISMATCH", `Uploader Pass 1 missing file "${filePath}".`, {
          path: filePath,
        });
      }
      this.sizeMap[filePath] = check.lstat.size;

      const stream = this.zipStream(filePath);
      const track = state.hosting.activeZipTracks.get(stream);
      await new Promise((resolve, reject) => {
        stream.on("data", () => {});
        stream.on("end", resolve);
        stream.on("error", reject);
      });
      const metrics = track.done();
      if (metrics.rawBytes !== expected.bytes || metrics.rawSha256 !== expected.sha256) {
        throw new BoundaryFailure(
          "E_BOUNDARY_RAW_MISMATCH",
          `Hosting Pass 1 raw bytes/SHA-256 mismatch on "${filePath}" vs PREDEPLOY_MANIFEST.`,
          { path: filePath },
        );
      }

      state.hosting.pass1ByPath.set(filePath, { path: filePath, ...metrics });
      if (!state.hosting.hashToPaths.has(metrics.compressedSha256)) {
        state.hosting.hashToPaths.set(metrics.compressedSha256, new Set());
      }
      state.hosting.hashToPaths.get(metrics.compressedSha256).add(filePath);
      this.addHash(filePath, metrics.compressedSha256);
    } catch (err) {
      throw toFirebaseError(err, FirebaseError);
    }
  });

  const origPopulateHandler = origUploader.prototype.populateHandler;
  patchProp(origUploader.prototype, "populateHandler", async function wrappedPopulateHandler(batch) {
    try {
      const entries = Object.entries(batch || {});
      for (const [slashPath, hash] of entries) {
        const rel = slashPath.startsWith("/") ? slashPath.slice(1) : slashPath;
        const pass1 = state.hosting.pass1ByPath.get(rel);
        if (!pass1 || pass1.compressedSha256 !== hash) {
          throw new BoundaryFailure(
            "E_BOUNDARY_POPULATE_MISMATCH",
            `populateFiles batch entry "${rel}" hash does not match Pass 1 compressed SHA-256.`,
            { path: rel },
          );
        }
        state.hosting.populatedPaths.add(rel);
      }

      const res = await this.hashClient.post(`/${this.version}:populateFiles`, { files: batch });
      this.uploadUrl = res.body.uploadUrl;
      this.uploadClient = new apiv2.Client({ urlPrefix: this.uploadUrl, auth: true });
      const required = res.body.uploadRequiredHashes || [];
      for (const h of required) {
        if (!state.hosting.hashToPaths.has(h)) {
          throw new BoundaryFailure(
            "E_BOUNDARY_POPULATE_MISMATCH",
            `Server requested unattested hash "${h}" in uploadRequiredHashes.`,
          );
        }
        state.hosting.requiredUploadHashes.add(h);
      }
      this.addUploads(required);
    } catch (err) {
      if (this.populateQueue) this.populateQueue.retries = 0;
      throw toFirebaseError(err, FirebaseError);
    }
  });
  void origPopulateHandler;

  patchProp(origUploader.prototype, "uploadHandler", async function wrappedUploadHandler(toUpload) {
    try {
      if (!this.uploadClient) {
        throw new FirebaseError("No upload client available.", { exit: 2 });
      }
      const filePath = this.hashMap[toUpload];
      const pass1 = filePath ? state.hosting.pass1ByPath.get(filePath) : null;
      if (!filePath || !pass1 || pass1.compressedSha256 !== toUpload) {
        throw new BoundaryFailure(
          "E_BOUNDARY_COMPRESSED_MISMATCH",
          `Pass 2 uploadHandler requested unknown hash "${toUpload}".`,
        );
      }

      g8.assertNoSymlinkChain(this.public, filePath);
      const stream = this.zipStream(filePath);
      const track = state.hosting.activeZipTracks.get(stream);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.uploadTimeout(filePath));
      const res = await this.uploadClient.request({
        method: "POST",
        path: `/${toUpload}`,
        body: stream,
        resolveOnHTTPError: true,
        responseType: "stream",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const pass2 = track.done();
      if (pass2.rawBytes !== pass1.rawBytes || pass2.rawSha256 !== pass1.rawSha256) {
        throw new BoundaryFailure(
          "E_BOUNDARY_TOCTOU_MISMATCH",
          `Hosting Pass 2 raw bytes changed on "${filePath}" between Pass 1 and upload.`,
          { path: filePath },
        );
      }
      if (pass2.compressedBytes !== pass1.compressedBytes || pass2.compressedSha256 !== toUpload) {
        throw new BoundaryFailure(
          "E_BOUNDARY_COMPRESSED_MISMATCH",
          `Hosting Pass 2 compressed stream digest mismatch on "${filePath}".`,
          { path: filePath },
        );
      }
      if (res.status !== 200) {
        throw new FirebaseError(`Unexpected HTTP ${res.status} while uploading ${filePath}`, { exit: 1 });
      }
      state.hosting.uploadedHashes.add(toUpload);
      state.hosting.uploadStreamsByHash.set(toUpload, pass2);
    } catch (err) {
      if (this.uploadQueue) this.uploadQueue.retries = 0;
      throw toFirebaseError(err, FirebaseError);
    }
  });

  patchProp(origUploader.prototype, "start", async function wrappedUploaderStart() {
    if (!Array.isArray(this.files) || this.files.length === 0) {
      throw toFirebaseError(new BoundaryFailure("E_EMPTY_PAYLOAD", "Hosting Uploader received 0 files."), FirebaseError);
    }
    const hashWait = this.hashQueue.wait();
    const popWait = this.populateQueue.wait();
    const uploadWait = this.uploadQueue.wait();
    popWait.catch(() => {});
    uploadWait.catch(() => {});

    for (const f of this.files) {
      this.hashQueue.add(f);
    }
    this.hashQueue.close();
    this.hashQueue.process();
    try {
      await hashWait;
      if (Object.keys(this.populateBatch || {}).length > 0) {
        this.queuePopulate();
      }
      this.populateQueue.close();
      await popWait;
      this.uploadQueue.close();
      await uploadWait;
    } catch (err) {
      try { this.hashQueue.close(); } catch { /* ignore */ }
      try { this.populateQueue.close(); } catch { /* ignore */ }
      try { this.uploadQueue.close(); } catch { /* ignore */ }
      throw toFirebaseError(err, FirebaseError);
    }
  });

  // 7. Patch prepareFunctionsUpload + gcs.upload + functions/deploy
  const origPrepareFnUpload = prepareFnUploadMod.prepareFunctionsUpload;
  patchProp(prepareFnUploadMod, "prepareFunctionsUpload", async function wrappedPrepareFunctionsUpload(
    projectDir,
    sourceDir,
    cfg,
    additionalSources,
    runtimeConfig,
    opts,
  ) {
    try {
      const manifest = state.predeployManifest || loadAndCheckPredeployManifest();
      const expectedFnDir = path.resolve(state.root, ...manifest.surfaces.functions.rootRelative.split("/"));
      if (g8.canonicalContainmentPath(sourceDir) !== g8.canonicalContainmentPath(expectedFnDir)) {
        throw new BoundaryFailure("E_BOUNDARY_ROOT_MISMATCH", "Functions sourceDir does not match predeploy functions surface.");
      }
      if (Array.isArray(additionalSources) && additionalSources.length > 0) {
        throw new BoundaryFailure("E_FUNCTIONS_ARCHIVE_MISMATCH", "Unexpected additionalSources passed to prepareFunctionsUpload.");
      }
      if (runtimeConfig !== undefined) {
        throw new BoundaryFailure("E_FUNCTIONS_ARCHIVE_MISMATCH", "Unexpected runtimeConfig passed to SSR prepareFunctionsUpload.");
      }

      g8.walkFiles(sourceDir, g8.makeFunctionsMatcher());
      state.inPrepareFunctionsUpload = true;
      let packaged;
      try {
        packaged = await origPrepareFnUpload.call(this, projectDir, sourceDir, cfg, additionalSources, runtimeConfig, opts);
      } finally {
        state.inPrepareFunctionsUpload = false;
      }

      if (!packaged || !packaged.pathToSource || !fs.existsSync(packaged.pathToSource)) {
        throw new BoundaryFailure("E_FUNCTIONS_ARCHIVE_MISMATCH", "prepareFunctionsUpload produced no archive.");
      }
      const st = fs.lstatSync(packaged.pathToSource);
      if (st.isSymbolicLink() || !st.isFile()) {
        throw new BoundaryFailure("E_LINK_UNPROVABLE", "Packaged functions archive path is not a regular file.");
      }

      const exportType = (opts && opts.exportType) || "zip";
      const entries = exportType === "tar.gz"
        ? parseAndHashTarGzArchive(packaged.pathToSource)
        : parseAndHashZipArchive(packaged.pathToSource);

      reconcileFileLists(manifest.surfaces.functions.files, entries, "E_FUNCTIONS_ARCHIVE_MISMATCH", "Functions archive");

      state.functions.packaged = {
        pathToSource: packaged.pathToSource,
        exportType,
        archiveBytes: st.size,
        archiveSha256: g8.sha256File(packaged.pathToSource),
        cliSourceHash: packaged.hash,
        entries,
      };
      return packaged;
    } catch (err) {
      throw toFirebaseError(err, FirebaseError);
    }
  });

  const origShouldSkip = fnDeployMod.shouldUploadBeSkipped;
  patchProp(fnDeployMod, "shouldUploadBeSkipped", function wrappedShouldUploadBeSkipped(context, wantBackend, haveBackend) {
    state.functions.skipChecked = true;
    const skip = origShouldSkip.call(this, context, wantBackend, haveBackend);
    if (skip) {
      throw toFirebaseError(
        new BoundaryFailure("E_SSR_UPLOAD_SKIPPED", "Refusing to silently skip SSR Functions upload during attested release."),
        FirebaseError,
      );
    }
    return false;
  });

  function wrapGcsUploadStream(source) {
    const pkg = state.functions.packaged;
    if (!pkg) {
      throw new BoundaryFailure("E_FUNCTIONS_STREAM_MISMATCH", "gcs.upload called without verified packaged Functions archive.");
    }
    if (!source || !source.file || path.resolve(source.file) !== path.resolve(pkg.pathToSource)) {
      throw new BoundaryFailure("E_FUNCTIONS_STREAM_MISMATCH", "gcs.upload source file path differs from verified archive.");
    }
    const st = fs.lstatSync(source.file);
    if (st.isSymbolicLink() || !st.isFile() || st.size !== pkg.archiveBytes || g8.sha256File(source.file) !== pkg.archiveSha256) {
      throw new BoundaryFailure("E_FUNCTIONS_STREAM_MISMATCH", "Functions archive on disk mutated before gcs.upload.");
    }
    const hash = createHash("sha256");
    let streamedBytes = 0;
    const tap = new Transform({
      transform(chunk, _enc, cb) {
        streamedBytes += chunk.length;
        hash.update(chunk);
        cb(null, chunk);
      },
    });
    const origStream = source.stream;
    origStream.on("error", (err) => tap.destroy(err));
    return {
      wrappedSource: { ...source, stream: origStream.pipe(tap) },
      verifyAfterUpload: (res) => {
        const streamedSha256 = hash.digest("hex");
        if (streamedBytes !== pkg.archiveBytes || streamedSha256 !== pkg.archiveSha256) {
          throw new BoundaryFailure(
            "E_FUNCTIONS_STREAM_MISMATCH",
            `Functions upload stream mismatch (expected ${pkg.archiveBytes}B/${pkg.archiveSha256}, streamed ${streamedBytes}B/${streamedSha256}).`,
          );
        }
        state.functions.uploaded = {
          streamedBytes,
          streamedSha256,
          generation: res && res.generation ? res.generation : null,
        };
      },
    };
  }

  const origGcsUpload = gcsMod.upload;
  patchProp(gcsMod, "upload", async function wrappedGcsUpload(source, uploadUrl, extraHeaders, ignoreQuotaProject) {
    try {
      const { wrappedSource, verifyAfterUpload } = wrapGcsUploadStream(source);
      const res = await origGcsUpload.call(this, wrappedSource, uploadUrl, extraHeaders, ignoreQuotaProject);
      verifyAfterUpload(res);
      return res;
    } catch (err) {
      throw toFirebaseError(err, FirebaseError);
    }
  });

  const origGcsUploadObject = gcsMod.uploadObject;
  patchProp(gcsMod, "uploadObject", async function wrappedGcsUploadObject(source, bucketName, contentType) {
    try {
      const { wrappedSource, verifyAfterUpload } = wrapGcsUploadStream(source);
      const res = await origGcsUploadObject.call(this, wrappedSource, bucketName, contentType);
      verifyAfterUpload(res);
      return res;
    } catch (err) {
      throw toFirebaseError(err, FirebaseError);
    }
  });

  // 8. Fail-closed pre-release barrier BEFORE FunctionsTarget.release AND HostingTarget.release
  function enforcePreReleaseBarrier(stage) {
    const manifest = state.predeployManifest || loadAndCheckPredeployManifest();
    const expectedHosting = manifest.surfaces.hosting.files;

    if (!Array.isArray(state.hosting.enumeratedFiles) || state.hosting.enumeratedFiles.length !== expectedHosting.length) {
      throw new BoundaryFailure("E_RELEASE_BARRIER_BYPASSED", `Hosting enumeration missing or incomplete before ${stage} release.`);
    }
    if (state.hosting.pass1ByPath.size !== expectedHosting.length || state.hosting.populatedPaths.size !== expectedHosting.length) {
      throw new BoundaryFailure("E_RELEASE_BARRIER_BYPASSED", `Hosting Pass 1 or populateFiles incomplete before ${stage} release.`);
    }
    for (const h of state.hosting.requiredUploadHashes) {
      if (!state.hosting.uploadedHashes.has(h)) {
        throw new BoundaryFailure("E_RELEASE_BARRIER_BYPASSED", `Required Hosting upload hash ${h} was not streamed before ${stage} release.`);
      }
    }

    // Re-verify Hosting disk files right before release to catch TOCTOU even if CDN-deduped
    const hostingDir = path.resolve(state.root, ...manifest.surfaces.hosting.rootRelative.split("/"));
    for (const exp of expectedHosting) {
      const check = g8.assertNoSymlinkChain(hostingDir, exp.path);
      if (!check.exists || !check.lstat.isFile() || check.lstat.size !== exp.bytes || g8.sha256File(check.fullPath) !== exp.sha256) {
        throw new BoundaryFailure("E_BOUNDARY_TOCTOU_MISMATCH", `Hosting file "${exp.path}" mutated on disk before ${stage} release.`);
      }
    }

    if (!state.functions.packaged || !state.functions.uploaded) {
      throw new BoundaryFailure("E_RELEASE_BARRIER_BYPASSED", `SSR Functions archive or gcs.upload proof missing before ${stage} release.`);
    }

    if (stage === "functions") {
      state.release.verifiedBeforeFunctionsRelease = true;
    } else if (stage === "hosting") {
      if (!state.release.verifiedBeforeFunctionsRelease) {
        throw new BoundaryFailure("E_RELEASE_BARRIER_BYPASSED", "Functions pre-release barrier was bypassed before Hosting release.");
      }
      state.release.verifiedBeforeHostingRelease = true;
    }

    const written = signAndWriteAttestation(state);
    validateUploadAttestation(written, manifest, state.root, state.expectedBinding, { requireReleaseComplete: false });
  }

  const origFnRelease = fnReleaseMod.release;
  patchProp(fnReleaseMod, "release", async function wrappedFnRelease(context, options, payload) {
    try {
      state.release.targetOrderObserved.push("functions");
      enforcePreReleaseBarrier("functions");
      const res = await origFnRelease.call(this, context, options, payload);
      state.release.functionsReleaseExecuted = true;
      return res;
    } catch (err) {
      throw toFirebaseError(err, FirebaseError);
    }
  });

  const origHostingRelease = hostingReleaseMod.release;
  patchProp(hostingReleaseMod, "release", async function wrappedHostingRelease(context, options, functionsPayload) {
    try {
      state.release.targetOrderObserved.push("hosting");
      enforcePreReleaseBarrier("hosting");
      const res = await origHostingRelease.call(this, context, options, functionsPayload);
      state.release.hostingReleaseExecuted = true;
      return res;
    } catch (err) {
      throw toFirebaseError(err, FirebaseError);
    }
  });

  // 9. Patch top-level deploy() to finalize & validate release-complete attestation
  const origDeploy = deployMod.deploy;
  patchProp(deployMod, "deploy", async function wrappedDeploy(targetNames, options, customContext) {
    try {
      if (options && options.dryRun) {
        throw new BoundaryFailure("E_BYPASS_DISALLOWED", "--dry-run is prohibited in controlled release boundary.");
      }
      const res = await origDeploy.call(this, targetNames, options, customContext);
      const manifest = state.predeployManifest || loadAndCheckPredeployManifest();
      const written = signAndWriteAttestation(state);
      validateUploadAttestation(written, manifest, state.root, state.expectedBinding, { requireReleaseComplete: true });
      return res;
    } catch (err) {
      throw toFirebaseError(err, FirebaseError);
    } finally {
      if (netBlockRestore) netBlockRestore();
    }
  });

  // Expose hostingDeployMod reference check so linter/static checks see all modules wired
  void hostingDeployMod;

  const restore = () => {
    if (netBlockRestore) netBlockRestore();
    for (let i = restorable.length - 1; i >= 0; i -= 1) {
      restorable[i]();
    }
  };

  return {
    state,
    restore,
    restoreNetwork: netBlockRestore,
  };
}

function parseBoundaryCli(args) {
  const sepIdx = args.indexOf("--");
  const wrapperArgs = sepIdx === -1 ? args : args.slice(0, sepIdx);
  const wrappedCmd = sepIdx === -1 ? [] : args.slice(sepIdx + 1);
  const command = wrapperArgs[0];
  if (!["verify-cli", "assert-active", "exec", "validate"].includes(command)) {
    throw new BoundaryFailure(
      "E_USAGE",
      "usage: ct4-web-p0-firebase-upload-boundary.cjs verify-cli|assert-active|exec|validate ...",
    );
  }
  const flags = Object.create(null);
  const booleans = new Set(["--from-env", "--verify-git", "--mock-transport", "--require-release-complete"]);
  for (let i = 1; i < wrapperArgs.length; i += 1) {
    const tok = wrapperArgs[i];
    if (!tok.startsWith("--")) {
      throw new BoundaryFailure("E_USAGE", `Unexpected positional argument "${tok}".`);
    }
    if (booleans.has(tok)) {
      flags[tok] = true;
      continue;
    }
    const next = wrapperArgs[i + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new BoundaryFailure("E_USAGE", `Flag ${tok} requires a value.`);
    }
    flags[tok] = next;
    i += 1;
  }
  return { command, flags, wrappedCmd };
}

function resolveExpectedBinding(flags, root) {
  if (flags["--from-env"] && flags["--binding"]) {
    throw new BoundaryFailure("E_USAGE", "Cannot pass both --from-env and --binding.");
  }
  if (!flags["--from-env"] && !flags["--binding"]) {
    throw new BoundaryFailure("E_USAGE", "Either --from-env or --binding <file> is required.");
  }
  if (flags["--from-env"]) {
    const cfg = g8.readFirebaseHostingConfig(root);
    const rec = g8.reconcilePredeploySurfaces(root, cfg.site, process.env.CT4_BUILD_ID);
    return g8.resolveBindingFromEnv(process.env, {
      mode: "firebase-predeploy",
      reconciledBuildId: rec.buildId,
      configuredSite: cfg.site,
    });
  }
  return g8.readJsonFile(flags["--binding"], "E_BINDING_INCOMPLETE", "E_BINDING_INCOMPLETE", "Binding");
}

function runExec(flags, wrappedCmd) {
  assertSafeWrapperEnvironment(process.env);
  validateWrappedFirebaseCommand(wrappedCmd);
  const root = path.resolve(flags["--root"] || process.cwd());
  const cliRoot = resolveCliRoot(root, flags);
  const mockTransport = Boolean(flags["--mock-transport"]);
  if (mockTransport && process.env.GITHUB_ACTIONS === "true") {
    throw new BoundaryFailure("E_BYPASS_DISALLOWED", "--mock-transport is prohibited in GitHub Actions.");
  }

  const predeployInput = flags["--predeploy-manifest"] || ".firebase/canil-gcm-g8-predeploy-manifest.json";
  const attestationInput = flags["--attestation-out"] || ".firebase/canil-gcm-g8-upload-attestation.json";
  const predeployAbs = path.resolve(root, predeployInput);
  const attestationAbs = path.resolve(root, attestationInput);
  const predeployRel = path.relative(root, predeployAbs).split(path.sep).join("/");

  let expectedBinding;
  if (flags["--from-env"]) {
    const cfg = g8.readFirebaseHostingConfig(root);
    let reconciledBuildId;
    const hDir = path.join(root, ".firebase", cfg.site, "hosting");
    const fDir = path.join(root, ".firebase", cfg.site, "functions");
    if (fs.existsSync(hDir) && fs.existsSync(fDir)) {
      reconciledBuildId = g8.reconcilePredeploySurfaces(root, cfg.site, process.env.CT4_BUILD_ID).buildId;
    }
    expectedBinding = g8.resolveBindingFromEnv(process.env, {
      mode: "firebase-predeploy",
      reconciledBuildId: reconciledBuildId || "PENDING_PREDEPLOY",
      configuredSite: cfg.site,
    });
    if (!reconciledBuildId) expectedBinding.buildId = undefined;
  } else if (flags["--binding"]) {
    expectedBinding = g8.readJsonFile(path.resolve(root, flags["--binding"]), "E_BINDING_INCOMPLETE", "E_BINDING_INCOMPLETE", "Binding");
  } else {
    throw new BoundaryFailure("E_USAGE", "exec requires --from-env or --binding <file>.");
  }

  const cliIntegrity = verifyCliIntegrity(cliRoot);
  const nonce = randomBytes(32).toString("hex");
  const sessionRel = ".firebase/canil-gcm-g8-wrapper-session.json";
  const sessionAbs = path.join(root, ".firebase", "canil-gcm-g8-wrapper-session.json");
  fs.mkdirSync(path.dirname(sessionAbs), { recursive: true });
  fs.writeFileSync(
    sessionAbs,
    JSON.stringify({
      pid: process.pid,
      nonceHash: sha256Buffer(Buffer.from(nonce, "utf8")),
      cliModulesDigest: cliIntegrity.modulesDigest,
      startedAt: new Date().toISOString(),
    }),
    "utf8",
  );

  const prevEnv = {
    CT4_G8_BOUNDARY_NONCE: process.env.CT4_G8_BOUNDARY_NONCE,
    CT4_G8_BOUNDARY_SESSION: process.env.CT4_G8_BOUNDARY_SESSION,
    CT4_G8_BOUNDARY_PID: process.env.CT4_G8_BOUNDARY_PID,
  };
  process.env.CT4_G8_BOUNDARY_NONCE = nonce;
  process.env.CT4_G8_BOUNDARY_SESSION = sessionRel;
  process.env.CT4_G8_BOUNDARY_PID = String(process.pid);

  const cleanup = () => {
    try { fs.rmSync(sessionAbs, { force: true }); } catch { /* ignore */ }
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  process.once("exit", cleanup);

  installInProcessBoundaryHooks({
    root,
    cliRoot,
    mockTransport,
    verifyGit: Boolean(flags["--verify-git"]),
    predeployManifestAbs: predeployAbs,
    predeployManifestRel: predeployRel,
    attestationOutAbs: attestationAbs,
    expectedBinding,
    cliIntegrity,
  });

  // Hand control to pinned firebase-tools@15.25.1 bin/firebase.js (without NODE_OPTIONS)
  const firebaseBin = path.join(cliRoot, "node_modules", "firebase-tools", "lib", "bin", "firebase.js");
  process.argv = [process.execPath, firebaseBin, ...wrappedCmd.slice(1)];
  if (fs.existsSync(root) && process.cwd() !== root) {
    process.chdir(root);
  }
  require(firebaseBin);
}

function main(argv) {
  try {
    const { command, flags, wrappedCmd } = parseBoundaryCli(argv.slice(2));
    const root = path.resolve(flags["--root"] || process.cwd());

    if (command === "verify-cli") {
      const report = verifyCliIntegrity(resolveCliRoot(root, flags));
      process.stdout.write(`${JSON.stringify({ result: "PASS", ...report }, null, 2)}\n`);
      return 0;
    }

    if (command === "assert-active") {
      const report = runAssertActive(root, process.env, flags);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return 0;
    }

    if (command === "validate") {
      const prePathArg = flags["--predeploy-manifest"];
      const attPathArg = flags["--attestation"];
      if (!prePathArg || !attPathArg) {
        throw new BoundaryFailure("E_USAGE", "validate requires --predeploy-manifest <file> and --attestation <file>.");
      }
      const prePath = fs.existsSync(prePathArg) ? prePathArg : path.resolve(root, prePathArg);
      const attPath = fs.existsSync(attPathArg) ? attPathArg : path.resolve(root, attPathArg);
      const preManifest = g8.readJsonFile(prePath, "E_MANIFEST_INVALID", "E_MANIFEST_INVALID", "Predeploy manifest");
      const attObj = g8.readJsonFile(attPath, "E_ATTESTATION_INVALID", "E_ATTESTATION_INVALID", "Upload attestation");
      const expectedBinding = resolveExpectedBinding(flags, root);
      const report = validateUploadAttestation(attObj, preManifest, root, expectedBinding, {
        requireReleaseComplete: Boolean(flags["--require-release-complete"]),
      });
      if (flags["--verify-git"]) {
        g8.verifyGitBinding(root, report.binding);
      }
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return 0;
    }

    runExec(flags, wrappedCmd);
    return undefined;
  } catch (err) {
    if (err instanceof BoundaryFailure || err instanceof g8.ManifestFailure) {
      console.error(`CT4 WEB-P0 G8 upload boundary: FAIL ${err.code}`);
      console.error(`  ${err.message}`);
      return 1;
    }
    console.error("CT4 WEB-P0 G8 upload boundary: FAIL E_INTERNAL");
    console.error(`  ${err && err.message ? err.message : String(err)}`);
    return 1;
  }
}

module.exports = {
  ATTESTATION_KIND,
  ATTESTATION_VERSION,
  BANNED_ENV_VARS,
  BoundaryFailure,
  EXPECTED_ARCHIVER_VERSION,
  EXPECTED_CLI_LOCK_INTEGRITY,
  EXPECTED_CLI_VERSION,
  PINNED_MODULE_SHA256,
  assertSafeWrapperEnvironment,
  buildAttestationBody,
  createOfflineMockTransport,
  installInProcessBoundaryHooks,
  parseAndHashTarGzArchive,
  parseAndHashZipArchive,
  parseBoundaryCli,
  reconcileFileLists,
  runAssertActive,
  scanNoSecretLeaks,
  sha256Buffer,
  sha256Json,
  signAndWriteAttestation,
  validateUploadAttestation,
  validateWrappedFirebaseCommand,
  verifyCliIntegrity,
};

if (require.main === module) {
  const code = main(process.argv);
  if (typeof code === "number") process.exitCode = code;
}
