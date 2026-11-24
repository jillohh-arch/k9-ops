#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS build-time script, same convention as the existing production guard scripts */
/**
 * CT4 WEB-P0 — G8 payload manifest: build and validate a SHA-256 manifest of a
 * candidate upload tree or predeploy materialized Hosting + SSR Functions surfaces,
 * bound to commit / tree / buildId / project / site / selector / firebaseIdentity /
 * cliVersion / runId / runAttempt.
 *
 * Gate: CT4.WEB-P0.CORRECTION-R1-RECONCILIATION-AND-G8-LOCAL-CLOSURE-R2
 *
 * WHAT THIS IS
 * ------------
 * A fail-closed manifest builder/validator for:
 *   - `--mode directory`: isolated directory fixtures (never accepts `.next` alone);
 *   - `--mode firebase-predeploy`: materialized `.firebase/<site>/hosting` and
 *     `.firebase/<site>/functions` surfaces produced before `hosting.predeploy`.
 *
 * HONEST ATTESTATION BOUNDARY
 * ---------------------------
 * In pinned firebase-tools@15.25.1, `hosting.predeploy` runs AFTER `prepareFrameworks`
 * materializes `.firebase/<site>/hosting` and `.firebase/<site>/functions`, but
 * BEFORE `hosting/deploy.js` calls `listFiles(publicDir, ignore)` + `new Uploader(...)`
 * and BEFORE `functions/prepare.js` calls `prepareFunctionsUpload(...)` to zip the
 * SSR backend. Therefore `realUploaderHookAttested` is ALWAYS `false` here, and
 * `G8_REAL_UPLOAD_PAYLOAD` remains `NOT_PROVEN` until an owner-approved instrumented
 * CLI captures the post-listFiles / post-archive bytes at upload time.
 *
 * SAFETY: no network, no credentials, no Firebase access, never echoes raw Firebase
 * config field values (apiKey/appId/etc.) in error messages or serialized manifests.
 */

"use strict";

const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MANIFEST_VERSION = 2;
const PRODUCTION_PROJECT_ID = "canil-gcm";
const PRODUCTION_SITE = "canil-gcm";
const PRODUCTION_SELECTOR = "production";

const R4_MARKERS = Object.freeze([
  "_buildManifest.js",
  "_ssgManifest.js",
  "_clientMiddlewareManifest.js",
  "_clientMiddlewareManifest.json",
]);

/** Canonical public production identity anchored to `src/lib/firebase/config.ts`. */
const CANONICAL_PRODUCTION_IDENTITY = Object.freeze({
  projectId: "canil-gcm",
  apiKey: "AIzaSyAQKCu-UOQQFiRfq-Slahhcy985rtQBkmU",
  authDomain: "canil-gcm.firebaseapp.com",
  storageBucket: "canil-gcm.firebasestorage.app",
  messagingSenderId: "418249404282",
  appId: "1:418249404282:web:6c0093a341e04ef518b0c3",
  measurementId: "G-KNTKW04X7S",
});

const REQUIRED_IDENTITY_FIELDS = Object.freeze([
  "projectId",
  "apiKey",
  "authDomain",
  "storageBucket",
  "messagingSenderId",
  "appId",
]);

function computeIdentityDigest(identity) {
  const id = identity || {};
  const norm = {
    apiKey: id.apiKey === undefined ? "" : String(id.apiKey).trim(),
    authDomain: id.authDomain === undefined ? "" : String(id.authDomain).trim(),
    projectId: id.projectId === undefined ? "" : String(id.projectId).trim(),
    storageBucket: id.storageBucket === undefined ? "" : String(id.storageBucket).trim(),
    messagingSenderId: id.messagingSenderId === undefined ? "" : String(id.messagingSenderId).trim(),
    appId: id.appId === undefined ? "" : String(id.appId).trim(),
    measurementId:
      id.measurementId === undefined || id.measurementId === null || String(id.measurementId).trim() === ""
        ? null
        : String(id.measurementId).trim(),
  };
  return crypto.createHash("sha256").update(JSON.stringify(norm)).digest("hex");
}

const CANONICAL_PRODUCTION_IDENTITY_DIGEST = computeIdentityDigest(CANONICAL_PRODUCTION_IDENTITY);

class ManifestFailure extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "ManifestFailure";
    this.code = code;
    this.detail = detail || {};
  }
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function sha256File(file) {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(file, "r");
  try {
    const buffer = Buffer.allocUnsafe(1 << 20);
    let read;
    while ((read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

function canonicalContainmentPath(p) {
  let resolved;
  try {
    resolved = fs.realpathSync.native(p);
  } catch {
    resolved = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  }
  resolved = path.resolve(resolved);
  let out = process.platform === "win32" ? resolved.replace(/\//g, "\\") : resolved.replace(/\\/g, "/");
  if (process.platform === "win32") {
    if (/^[A-Za-z]\\/.test(out)) out = `${out[0]}:${out.slice(1)}`;
    const drive = out.match(/^([A-Za-z]):/);
    if (drive) out = `${drive[1].toUpperCase()}:${out.slice(2)}`;
    out = out.toLowerCase();
  }
  return out;
}

function isPathContained(child, ancestor) {
  const c = canonicalContainmentPath(child);
  const a = canonicalContainmentPath(ancestor);
  if (c === a) return true;
  const prefix = a.endsWith(path.sep) ? a : a + path.sep;
  return c.startsWith(prefix);
}

/** Validate a relative manifest path against traversal, Windows separators, non-NFC, and empty segments. */
function validateRelativePath(rel) {
  if (typeof rel !== "string" || rel.length === 0) {
    throw new ManifestFailure("E_PATH_TRAVERSAL", "Manifest file path must be a non-empty string.");
  }
  if (/[\u0000-\u001f\u007f]/.test(rel) || rel.includes("\\") || rel.startsWith("/") || rel.endsWith("/")) {
    throw new ManifestFailure("E_PATH_TRAVERSAL", "Manifest file path contains illegal separators, control characters, or leading/trailing slash.", {
      path: rel,
    });
  }
  if (rel !== rel.normalize("NFC")) {
    throw new ManifestFailure("E_NON_NFC_PATH", "Manifest file path must be Unicode NFC normalized.", {
      path: rel,
    });
  }
  const segments = rel.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      throw new ManifestFailure("E_PATH_TRAVERSAL", "Manifest file path contains traversal or empty segment.", {
        path: rel,
      });
    }
  }
  return rel;
}

function assertNoSymlinkChain(rootDir, relPosix) {
  const realRoot = canonicalContainmentPath(rootDir);
  const segments = relPosix.split("/");
  let cur = rootDir;
  for (const seg of segments) {
    cur = path.join(cur, seg);
    let st;
    try {
      st = fs.lstatSync(cur);
    } catch {
      return { exists: false, lstat: null };
    }
    if (st.isSymbolicLink()) {
      throw new ManifestFailure("E_LINK_UNPROVABLE", "Payload contains a symbolic link or junction.", {
        path: relPosix,
      });
    }
  }
  let realTarget;
  try {
    realTarget = fs.realpathSync.native(cur);
  } catch {
    throw new ManifestFailure("E_LINK_UNPROVABLE", "Cannot resolve realpath of payload entry.", {
      path: relPosix,
    });
  }
  if (!isPathContained(realTarget, realRoot)) {
    throw new ManifestFailure("E_LINK_UNPROVABLE", "Payload entry escapes root containment boundary.", {
      path: relPosix,
    });
  }
  const finalStat = fs.lstatSync(cur);
  return { exists: true, lstat: finalStat, fullPath: cur };
}

function isFirebaseDebugLog(name) {
  return name === "firebase-debug.log" || /^firebase-debug\..*\.log$/.test(name);
}

function compileSimpleGlob(pattern) {
  const norm = String(pattern).replace(/\\/g, "/").replace(/^\.\//, "");
  let re = "^";
  for (let i = 0; i < norm.length; i += 1) {
    const ch = norm[i];
    if (ch === "*") {
      if (norm[i + 1] === "*") {
        if (norm[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (ch === "?") {
      re += "[^/]";
    } else {
      re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  re += "$";
  return new RegExp(re);
}

const BUILTIN_HOSTING_IGNORES = new Set(["firebase.json", "**/.*", "**/node_modules/**"]);

function makeHostingMatcher(hostingIgnoreList) {
  const customPatterns = (hostingIgnoreList || [])
    .filter((p) => typeof p === "string" && p.trim() !== "" && !BUILTIN_HOSTING_IGNORES.has(p.trim()))
    .map((p) => compileSimpleGlob(p.trim()));
  return {
    skipDirForSymlinkCheck: (relSegments) => relSegments.includes("node_modules"),
    shouldExclude: (relPosix, relSegments, isDir) => {
      if (relSegments.includes("node_modules")) return true;
      if (isDir) return false;
      const base = relSegments[relSegments.length - 1];
      if (relSegments.length === 2 && relSegments[0] === ".firebase") return true;
      if (base.startsWith(".")) return true;
      if (isFirebaseDebugLog(base)) return true;
      if (relPosix === "firebase.json") return true;
      for (const re of customPatterns) {
        if (re.test(relPosix)) return true;
      }
      return false;
    },
  };
}

function makeFunctionsMatcher() {
  return {
    skipDirForSymlinkCheck: (relSegments) => relSegments.includes("node_modules") || relSegments.includes(".git"),
    shouldExclude: (_relPosix, relSegments, isDir) => {
      if (relSegments.includes("node_modules") || relSegments.includes(".git")) return true;
      const base = relSegments[relSegments.length - 1];
      if (!isDir && (isFirebaseDebugLog(base) || base === ".runtimeconfig.json")) return true;
      return false;
    },
  };
}

/** Deterministic walk: sorted dirs, sorted files, forward-slash relative paths, NFC & case-collision safe. */
function walkFiles(root, matcher) {
  const resolvedRoot = path.resolve(root);
  const realRoot = canonicalContainmentPath(resolvedRoot);
  const out = [];
  const seenFileLower = new Set();
  const visit = (dir, relSegments) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const seenDirEntriesLower = new Set();
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const nextSegs = [...relSegments, entry.name];
      const relPosix = nextSegs.join("/");
      const skipSymlink = matcher && matcher.skipDirForSymlinkCheck && matcher.skipDirForSymlinkCheck(nextSegs);
      if (skipSymlink) continue;

      if (entry.isSymbolicLink()) {
        throw new ManifestFailure(
          "E_LINK_UNPROVABLE",
          "The payload tree contains a symbolic link; its shipped bytes depend on where it resolves.",
          { path: relPosix },
        );
      }

      if (entry.isDirectory()) {
        if (matcher && matcher.shouldExclude && matcher.shouldExclude(relPosix, nextSegs, true)) {
          continue;
        }
        if (entry.name !== entry.name.normalize("NFC")) {
          throw new ManifestFailure("E_NON_NFC_PATH", "Payload directory contains non-NFC Unicode characters.", {
            path: relPosix,
          });
        }
        const entryLower = entry.name.toLowerCase();
        if (seenDirEntriesLower.has(entryLower)) {
          throw new ManifestFailure(
            "E_CASE_COLLISION",
            "Payload directory contains entries colliding under case-insensitive comparison.",
            { path: relPosix },
          );
        }
        seenDirEntriesLower.add(entryLower);
        let realSub;
        try {
          realSub = fs.realpathSync.native(full);
        } catch {
          throw new ManifestFailure("E_LINK_UNPROVABLE", "Cannot resolve directory realpath.", { path: relPosix });
        }
        if (!isPathContained(realSub, realRoot)) {
          throw new ManifestFailure("E_LINK_UNPROVABLE", "Directory resolves outside payload root.", { path: relPosix });
        }
        visit(full, nextSegs);
      } else if (entry.isFile()) {
        if (matcher && matcher.shouldExclude && matcher.shouldExclude(relPosix, nextSegs, false)) {
          continue;
        }
        if (entry.name !== entry.name.normalize("NFC")) {
          throw new ManifestFailure("E_NON_NFC_PATH", "Payload file contains non-NFC Unicode characters.", {
            path: relPosix,
          });
        }
        const entryLower = entry.name.toLowerCase();
        if (seenDirEntriesLower.has(entryLower)) {
          throw new ManifestFailure(
            "E_CASE_COLLISION",
            "Payload contains entries colliding under case-insensitive comparison.",
            { path: relPosix },
          );
        }
        seenDirEntriesLower.add(entryLower);
        const relLower = relPosix.toLowerCase();
        if (seenFileLower.has(relLower)) {
          throw new ManifestFailure(
            "E_CASE_COLLISION",
            "Payload contains file paths colliding under case-insensitive comparison.",
            { path: relPosix },
          );
        }
        seenFileLower.add(relLower);
        let realFile;
        try {
          realFile = fs.realpathSync.native(full);
        } catch {
          throw new ManifestFailure("E_LINK_UNPROVABLE", "Cannot resolve file realpath.", { path: relPosix });
        }
        if (!isPathContained(realFile, realRoot)) {
          throw new ManifestFailure("E_LINK_UNPROVABLE", "File resolves outside payload root.", { path: relPosix });
        }
        out.push({ full, relPosix });
      }
    }
  };
  visit(resolvedRoot, []);
  return out;
}

/** Refuse a tree that is only a Next build directory. */
function assertNotNextOnly(root) {
  const base = path.basename(path.resolve(root));
  if (base === ".next") {
    throw new ManifestFailure(
      "E_NOT_ACCEPTED_AS_G8",
      "A manifest over a .next directory is not a G8 payload attestation. " +
        ".next is an input to the Firebase frameworks build, not the uploaded tree.",
      { root: base },
    );
  }
  const entries = fs.readdirSync(root, { withFileTypes: true }).map((e) => e.name);
  if (entries.length === 1 && entries[0] === ".next") {
    throw new ManifestFailure(
      "E_NOT_ACCEPTED_AS_G8",
      "The tree contains only .next; that is a build input, not a Firebase upload payload.",
      { root: base },
    );
  }
}

/** Verify our canonical production tuple still matches `src/lib/firebase/config.ts` when present. */
function assertCanonicalTupleMatchesSource(root) {
  if (!root) return true;
  const sourcePath = path.join(root, "src", "lib", "firebase", "config.ts");
  if (!fs.existsSync(sourcePath)) return true;
  const source = fs.readFileSync(sourcePath, "utf8");
  const constantValues = Object.create(null);
  for (const [, constantName, literal] of source.matchAll(
    /export const ([A-Z_]+_PROJECT_ID) = "([^"]+)"/g,
  )) {
    constantValues[constantName] = literal;
  }
  const blockStart = source.indexOf("production: {");
  if (blockStart === -1) {
    throw new ManifestFailure("E_DRIFT", 'Canonical identity block "production" not found in src/lib/firebase/config.ts.');
  }
  const blockEnd = source.indexOf("},", blockStart);
  const block = source.slice(blockStart, blockEnd === -1 ? undefined : blockEnd);
  for (const [field, expected] of Object.entries(CANONICAL_PRODUCTION_IDENTITY)) {
    if (expected === undefined) continue;
    let found = block.includes(`"${expected}"`);
    if (!found) {
      for (const [constantName, literal] of Object.entries(constantValues)) {
        if (literal === expected && new RegExp(`\\b${constantName}\\b`).test(block)) {
          found = true;
          break;
        }
      }
    }
    if (!found) {
      throw new ManifestFailure(
        "E_DRIFT",
        `Canonical production constant for ${field} no longer matches src/lib/firebase/config.ts.`,
        { field },
      );
    }
  }
  return true;
}

/** Validate `firebaseIdentity` and/or `identityDigest` without echoing raw config values. */
function validateFirebaseIdentity(firebaseIdentity, identityDigest) {
  if (firebaseIdentity !== undefined && firebaseIdentity !== null) {
    if (typeof firebaseIdentity !== "object" || Array.isArray(firebaseIdentity)) {
      throw new ManifestFailure("E_IDENTITY_MISMATCH", "Binding firebaseIdentity must be an object.");
    }
    for (const field of REQUIRED_IDENTITY_FIELDS) {
      const val = firebaseIdentity[field];
      if (isBlank(val) || String(val).trim() !== CANONICAL_PRODUCTION_IDENTITY[field]) {
        throw new ManifestFailure(
          "E_IDENTITY_MISMATCH",
          `Binding firebaseIdentity field "${field}" does not match the canonical production Firebase Web identity.`,
          { field },
        );
      }
    }
    if (!isBlank(firebaseIdentity.measurementId)) {
      if (String(firebaseIdentity.measurementId).trim() !== CANONICAL_PRODUCTION_IDENTITY.measurementId) {
        throw new ManifestFailure(
          "E_IDENTITY_MISMATCH",
          'Binding firebaseIdentity field "measurementId" does not match the canonical production Firebase Web identity.',
          { field: "measurementId" },
        );
      }
    }
  }
  if (!isBlank(identityDigest)) {
    const dig = String(identityDigest).trim();
    if (!/^[0-9a-f]{64}$/.test(dig) || dig !== CANONICAL_PRODUCTION_IDENTITY_DIGEST) {
      throw new ManifestFailure(
        "E_IDENTITY_MISMATCH",
        "Binding identityDigest does not match the canonical production Firebase Web identity digest.",
        { field: "identityDigest" },
      );
    }
  }
  if ((firebaseIdentity === undefined || firebaseIdentity === null) && isBlank(identityDigest)) {
    throw new ManifestFailure(
      "E_BINDING_INCOMPLETE",
      "Manifest binding is incomplete. Missing: identityDigest (or firebaseIdentity).",
      { fields: ["identityDigest"] },
    );
  }
  return CANONICAL_PRODUCTION_IDENTITY_DIGEST;
}

function isValidBuildId(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return false;
  if (/(^|[\\/])\.\.([\\/]|$)/.test(trimmed)) return false;
  return true;
}

function normalizeBinding(binding, opts) {
  const b = binding || {};
  const required = [
    "commit",
    "tree",
    "buildId",
    "project",
    "site",
    "selector",
    "cliVersion",
    "runId",
    "runAttempt",
  ];
  const missing = required.filter((key) => isBlank(b[key]));
  if (isBlank(b.identityDigest) && (b.firebaseIdentity === undefined || b.firebaseIdentity === null)) {
    missing.push("identityDigest");
  }
  if (missing.length > 0) {
    throw new ManifestFailure(
      "E_BINDING_INCOMPLETE",
      `Manifest binding is incomplete. Missing: ${missing.join(", ")}.`,
      { fields: missing },
    );
  }
  if (opts && opts.repoRoot) {
    assertCanonicalTupleMatchesSource(opts.repoRoot);
  }
  if (b.project !== PRODUCTION_PROJECT_ID) {
    throw new ManifestFailure("E_BINDING_MISMATCH", `Binding project must be "${PRODUCTION_PROJECT_ID}".`, {
      field: "project",
    });
  }
  if (b.site !== PRODUCTION_SITE) {
    throw new ManifestFailure("E_BINDING_MISMATCH", `Binding site must be "${PRODUCTION_SITE}".`, {
      field: "site",
    });
  }
  if (b.selector !== PRODUCTION_SELECTOR) {
    throw new ManifestFailure("E_BINDING_MISMATCH", `Binding selector must be "${PRODUCTION_SELECTOR}".`, {
      field: "selector",
    });
  }
  const identityDigest = validateFirebaseIdentity(b.firebaseIdentity, b.identityDigest);
  if (!/^[0-9a-f]{40}$/.test(String(b.commit))) {
    throw new ManifestFailure("E_BINDING_MISMATCH", "Binding commit must be a full 40-hex SHA.", { field: "commit" });
  }
  if (!/^[0-9a-f]{40}$/.test(String(b.tree))) {
    throw new ManifestFailure("E_BINDING_MISMATCH", "Binding tree must be a full 40-hex SHA.", { field: "tree" });
  }
  if (!isValidBuildId(String(b.buildId))) {
    throw new ManifestFailure("E_BINDING_MISMATCH", "Binding buildId is invalid.", { field: "buildId" });
  }
  return {
    commit: String(b.commit),
    tree: String(b.tree),
    buildId: String(b.buildId).trim(),
    project: b.project,
    site: b.site,
    selector: b.selector,
    identityDigest,
    cliVersion: String(b.cliVersion).trim(),
    runId: String(b.runId).trim(),
    runAttempt: String(b.runAttempt).trim(),
  };
}

function hashFilesInRoot(rootDir, matcher) {
  const resolved = path.resolve(rootDir);
  const files = walkFiles(resolved, matcher).map(({ full, relPosix }) => ({
    path: relPosix,
    sha256: sha256File(full),
    bytes: fs.statSync(full).size,
  }));
  if (files.length === 0) {
    throw new ManifestFailure("E_EMPTY_PAYLOAD", "The payload tree contains no publishable files.", { root: resolved });
  }
  return files;
}

function validateFilesAgainstRoot(filesInput, rootDir, matcher) {
  if (!Array.isArray(filesInput)) {
    throw new ManifestFailure("E_MANIFEST_INVALID", "Manifest files must be an array.");
  }
  if (filesInput.length === 0) {
    throw new ManifestFailure("E_EMPTY_PAYLOAD", "Manifest lists no files.");
  }

  const resolved = path.resolve(rootDir);
  const listed = new Map();
  const listedLower = new Set();
  for (const entry of filesInput) {
    if (!entry || typeof entry.path !== "string" || typeof entry.sha256 !== "string") {
      throw new ManifestFailure("E_MANIFEST_INVALID", "Manifest contains a malformed file entry.");
    }
    validateRelativePath(entry.path);
    if (!/^[0-9a-f]{64}$/.test(entry.sha256)) {
      throw new ManifestFailure("E_MANIFEST_INVALID", "Manifest entry sha256 must be 64 lowercase hex characters.", {
        path: entry.path,
      });
    }
    if (typeof entry.bytes !== "number" || !Number.isInteger(entry.bytes) || entry.bytes < 0) {
      throw new ManifestFailure("E_MANIFEST_INVALID", "Manifest entry bytes must be a non-negative integer.", {
        path: entry.path,
      });
    }
    if (listed.has(entry.path)) {
      throw new ManifestFailure("E_MANIFEST_INVALID", "Manifest lists the same path twice.", { path: entry.path });
    }
    const lower = entry.path.toLowerCase();
    if (listedLower.has(lower)) {
      throw new ManifestFailure("E_CASE_COLLISION", "Manifest lists paths colliding under case-insensitive comparison.", {
        path: entry.path,
      });
    }
    listedLower.add(lower);
    listed.set(entry.path, entry);
  }

  const onDisk = new Set(walkFiles(resolved, matcher).map((f) => f.relPosix));

  for (const [rel, entry] of listed) {
    const check = assertNoSymlinkChain(resolved, rel);
    if (!check.exists || !check.lstat.isFile()) {
      throw new ManifestFailure("E_FILE_MISSING", "A file listed in the manifest is absent from the payload.", {
        path: rel,
      });
    }
    const actual = sha256File(check.fullPath);
    if (actual !== entry.sha256) {
      throw new ManifestFailure("E_HASH_MISMATCH", "A payload file's SHA-256 differs from the manifest.", {
        path: rel,
      });
    }
    if (check.lstat.size !== entry.bytes) {
      throw new ManifestFailure("E_SIZE_MISMATCH", "A payload file's byte length differs from the manifest.", {
        path: rel,
      });
    }
    onDisk.delete(rel);
  }

  if (onDisk.size > 0) {
    throw new ManifestFailure("E_UNLISTED_FILE", "The payload contains files the manifest does not list.", {
      paths: [...onDisk].slice(0, 10),
    });
  }

  return listed.size;
}

function assertValidManifestDigest(manifest, body) {
  if (typeof manifest.digest !== "string" || !/^[0-9a-f]{64}$/.test(manifest.digest)) {
    throw new ManifestFailure("E_MANIFEST_DIGEST", "The manifest digest is missing or malformed.");
  }
  const expectedDigest = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
  if (manifest.digest !== expectedDigest) {
    throw new ManifestFailure("E_MANIFEST_DIGEST", "The manifest's own digest does not match its content.");
  }
  return expectedDigest;
}

function assertLocalHookHonesty(manifest) {
  if (manifest.realUploaderHookAttested !== false) {
    throw new ManifestFailure(
      "E_UNSUPPORTED_ATTESTATION_CLAIM",
      "Local/predeploy manifests cannot claim realUploaderHookAttested=true without an instrumented Uploader hook.",
    );
  }
}

/** Build a single-directory manifest (`--mode directory`). */
function buildManifest(root, binding, opts) {
  const resolved = path.resolve(root);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new ManifestFailure("E_ROOT_ABSENT", "The payload root does not exist or is not a directory.", {
      root: resolved,
    });
  }
  assertNotNextOnly(resolved);
  const normalized = normalizeBinding(binding, opts);
  const files = hashFilesInRoot(resolved, null);
  const body = {
    version: MANIFEST_VERSION,
    mode: "directory",
    attestationScope: "DIRECTORY_FIXTURE",
    realUploaderHookAttested: false,
    binding: normalized,
    files,
  };
  const digest = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
  return { ...body, digest };
}

/** Validate a single-directory manifest (`--mode directory`). */
function validateManifest(manifest, root, expectedBinding, opts) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new ManifestFailure("E_MANIFEST_INVALID", "Manifest is not an object.");
  }
  if (manifest.version !== MANIFEST_VERSION) {
    throw new ManifestFailure("E_MANIFEST_INVALID", "Unsupported manifest version.", { version: manifest.version });
  }
  if (manifest.mode !== "directory") {
    throw new ManifestFailure("E_MANIFEST_INVALID", "Expected directory mode manifest.", { mode: manifest.mode });
  }
  if (manifest.attestationScope !== "DIRECTORY_FIXTURE") {
    throw new ManifestFailure("E_MANIFEST_INVALID", "Unexpected attestationScope for directory manifest.", {
      attestationScope: manifest.attestationScope,
    });
  }
  assertLocalHookHonesty(manifest);
  if (!manifest.binding) {
    throw new ManifestFailure("E_BINDING_INCOMPLETE", "Manifest carries no binding.");
  }
  const binding = normalizeBinding(manifest.binding, opts);
  if (expectedBinding) {
    const expected = normalizeBinding(expectedBinding, opts);
    for (const key of Object.keys(expected)) {
      if (binding[key] !== expected[key]) {
        throw new ManifestFailure(
          "E_BINDING_MISMATCH",
          `Manifest binding "${key}" does not match the expected release binding.`,
          { field: key },
        );
      }
    }
  }
  const resolved = path.resolve(root);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new ManifestFailure("E_ROOT_ABSENT", "The payload root does not exist.", { root: resolved });
  }
  assertNotNextOnly(resolved);

  const fileCount = validateFilesAgainstRoot(manifest.files, resolved, null);
  const body = {
    version: manifest.version,
    mode: manifest.mode,
    attestationScope: manifest.attestationScope,
    realUploaderHookAttested: manifest.realUploaderHookAttested,
    binding,
    files: manifest.files,
  };
  const digest = assertValidManifestDigest(manifest, body);

  return {
    result: "PASS",
    mode: "directory",
    attestationScope: manifest.attestationScope,
    realUploaderHookAttested: false,
    files: fileCount,
    digest,
    binding,
  };
}

function readFirebaseHostingConfig(root) {
  const jsonPath = path.join(root, "firebase.json");
  if (!fs.existsSync(jsonPath)) {
    throw new ManifestFailure("E_TARGET_UNREADABLE", "firebase.json is missing.", { target: "firebase.json" });
  }
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch {
    throw new ManifestFailure("E_TARGET_UNREADABLE", "firebase.json is not valid JSON.", { target: "firebase.json" });
  }
  const hosting = cfg && cfg.hosting;
  if (!hosting || Array.isArray(hosting)) {
    throw new ManifestFailure("E_TARGET_MISMATCH", "firebase.json must declare a single hosting configuration.");
  }
  if (hosting.site !== PRODUCTION_SITE) {
    throw new ManifestFailure("E_TARGET_MISMATCH", `firebase.json hosting.site must be "${PRODUCTION_SITE}".`, {
      site: hosting.site,
    });
  }
  return {
    site: hosting.site,
    ignore: Array.isArray(hosting.ignore) ? hosting.ignore : [],
  };
}

function scanSingleR4Anchor(staticDir, surfaceName) {
  if (!fs.existsSync(staticDir) || !fs.statSync(staticDir).isDirectory()) {
    throw new ManifestFailure("E_BUILD_ID_MISMATCH", `${surfaceName} static directory is absent.`, {
      surface: surfaceName,
    });
  }
  const entries = fs.readdirSync(staticDir, { withFileTypes: true });
  const genuine = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const innerPath = path.join(staticDir, entry.name);
    const inner = fs.readdirSync(innerPath);
    if (R4_MARKERS.some((marker) => inner.includes(marker))) {
      genuine.push(entry.name);
    }
  }
  if (genuine.length !== 1) {
    throw new ManifestFailure(
      "E_BUILD_ID_MISMATCH",
      `${surfaceName} must expose exactly one marker-bearing static buildId directory (found ${genuine.length}).`,
      { surface: surfaceName, ids: genuine },
    );
  }
  if (!isValidBuildId(genuine[0])) {
    throw new ManifestFailure("E_BUILD_ID_MISMATCH", `${surfaceName} buildId directory name is invalid.`);
  }
  return genuine[0];
}

function reconcilePredeploySurfaces(root, site, expectedBuildId) {
  const resolvedRoot = path.resolve(root);
  const hostingDir = path.join(resolvedRoot, ".firebase", site, "hosting");
  const functionsDir = path.join(resolvedRoot, ".firebase", site, "functions");

  if (
    !fs.existsSync(hostingDir) ||
    !fs.statSync(hostingDir).isDirectory() ||
    !fs.existsSync(functionsDir) ||
    !fs.statSync(functionsDir).isDirectory()
  ) {
    throw new ManifestFailure(
      "E_PREDEPLOY_SURFACES_ABSENT",
      `Materialized Firebase surfaces .firebase/${site}/hosting and .firebase/${site}/functions are required (raw .next alone is not accepted).`,
      { site },
    );
  }

  const buildIdFile = path.join(functionsDir, ".next", "BUILD_ID");
  if (!fs.existsSync(buildIdFile) || fs.lstatSync(buildIdFile).isSymbolicLink()) {
    throw new ManifestFailure("E_BUILD_ID_MISMATCH", "functions/.next/BUILD_ID is missing or invalid.");
  }
  const functionsBuildId = fs.readFileSync(buildIdFile, "utf8").trim();
  if (!isValidBuildId(functionsBuildId)) {
    throw new ManifestFailure("E_BUILD_ID_MISMATCH", "functions/.next/BUILD_ID is empty or invalid.");
  }

  const functionsStaticId = scanSingleR4Anchor(path.join(functionsDir, ".next", "static"), "functions");
  if (functionsStaticId !== functionsBuildId) {
    throw new ManifestFailure(
      "E_BUILD_ID_MISMATCH",
      `Intra-functions BUILD_ID mismatch (${functionsBuildId} vs static ${functionsStaticId}).`,
    );
  }

  const hostingStaticId = scanSingleR4Anchor(path.join(hostingDir, "_next", "static"), "hosting");
  if (hostingStaticId !== functionsBuildId) {
    throw new ManifestFailure(
      "E_BUILD_ID_MISMATCH",
      `Cross-surface BUILD_ID mismatch (hosting ${hostingStaticId} vs functions ${functionsBuildId}).`,
    );
  }

  if (!isBlank(expectedBuildId) && String(expectedBuildId).trim() !== functionsBuildId) {
    throw new ManifestFailure(
      "E_BUILD_ID_MISMATCH",
      `Binding buildId (${String(expectedBuildId).trim()}) does not match materialized surface BUILD_ID (${functionsBuildId}).`,
    );
  }

  return {
    buildId: functionsBuildId,
    hostingDir,
    functionsDir,
  };
}

/** Build a dual-surface manifest over `.firebase/<site>/hosting` and `.firebase/<site>/functions`. */
function buildPredeployManifest(root, binding) {
  const resolvedRoot = path.resolve(root);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new ManifestFailure("E_ROOT_ABSENT", "The candidate root does not exist.", { root: resolvedRoot });
  }
  assertCanonicalTupleMatchesSource(resolvedRoot);
  const hostingCfg = readFirebaseHostingConfig(resolvedRoot);
  const reconciled = reconcilePredeploySurfaces(resolvedRoot, hostingCfg.site, binding && binding.buildId);

  const effectiveBindingInput = { ...(binding || {}), buildId: (binding && binding.buildId) || reconciled.buildId };
  const normalized = normalizeBinding(effectiveBindingInput, { repoRoot: resolvedRoot });
  if (normalized.buildId !== reconciled.buildId) {
    throw new ManifestFailure("E_BUILD_ID_MISMATCH", "Normalized buildId does not match reconciled BUILD_ID.");
  }

  const hostingFiles = hashFilesInRoot(reconciled.hostingDir, makeHostingMatcher(hostingCfg.ignore));
  const functionsFiles = hashFilesInRoot(reconciled.functionsDir, makeFunctionsMatcher());

  const hostingSurface = {
    surface: "hosting",
    rootRelative: `.firebase/${hostingCfg.site}/hosting`,
    files: hostingFiles,
  };
  hostingSurface.surfaceDigest = crypto
    .createHash("sha256")
    .update(JSON.stringify(hostingSurface))
    .digest("hex");

  const functionsSurface = {
    surface: "functions",
    rootRelative: `.firebase/${hostingCfg.site}/functions`,
    files: functionsFiles,
  };
  functionsSurface.surfaceDigest = crypto
    .createHash("sha256")
    .update(JSON.stringify(functionsSurface))
    .digest("hex");

  const body = {
    version: MANIFEST_VERSION,
    mode: "firebase-predeploy",
    attestationScope: "PREDEPLOY_MATERIALIZED_SURFACES",
    realUploaderHookAttested: false,
    limitation:
      "Captured at hosting.predeploy before firebase-tools hosting/deploy.js listFiles() + Uploader and before prepareFunctionsUpload() archive.",
    binding: normalized,
    surfaces: {
      hosting: hostingSurface,
      functions: functionsSurface,
    },
  };
  const digest = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
  return { ...body, digest };
}

/** Validate a dual-surface predeploy manifest against `.firebase/<site>/hosting` and `functions`. */
function validatePredeployManifest(manifest, root, expectedBinding) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new ManifestFailure("E_MANIFEST_INVALID", "Manifest is not an object.");
  }
  if (manifest.version !== MANIFEST_VERSION) {
    throw new ManifestFailure("E_MANIFEST_INVALID", "Unsupported manifest version.", { version: manifest.version });
  }
  if (manifest.mode !== "firebase-predeploy") {
    throw new ManifestFailure("E_MANIFEST_INVALID", "Expected firebase-predeploy mode manifest.", {
      mode: manifest.mode,
    });
  }
  if (manifest.attestationScope !== "PREDEPLOY_MATERIALIZED_SURFACES") {
    throw new ManifestFailure("E_MANIFEST_INVALID", "Unexpected attestationScope for predeploy manifest.", {
      attestationScope: manifest.attestationScope,
    });
  }
  assertLocalHookHonesty(manifest);
  if (typeof manifest.limitation !== "string" || manifest.limitation.trim().length === 0) {
    throw new ManifestFailure(
      "E_MANIFEST_INVALID",
      "Predeploy manifest must carry a non-empty limitation disclosure.",
    );
  }
  if (!manifest.binding) {
    throw new ManifestFailure("E_BINDING_INCOMPLETE", "Manifest carries no binding.");
  }

  const resolvedRoot = path.resolve(root);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new ManifestFailure("E_ROOT_ABSENT", "The candidate root does not exist.", { root: resolvedRoot });
  }
  assertCanonicalTupleMatchesSource(resolvedRoot);
  const hostingCfg = readFirebaseHostingConfig(resolvedRoot);
  const binding = normalizeBinding(manifest.binding, { repoRoot: resolvedRoot });
  const reconciled = reconcilePredeploySurfaces(resolvedRoot, hostingCfg.site, binding.buildId);

  if (expectedBinding) {
    const expInput = {
      ...expectedBinding,
      buildId: !isBlank(expectedBinding.buildId) ? expectedBinding.buildId : reconciled.buildId,
    };
    const expected = normalizeBinding(expInput, { repoRoot: resolvedRoot });
    for (const key of Object.keys(expected)) {
      if (binding[key] !== expected[key]) {
        throw new ManifestFailure(
          "E_BINDING_MISMATCH",
          `Manifest binding "${key}" does not match the expected release binding.`,
          { field: key },
        );
      }
    }
  }

  if (!manifest.surfaces || typeof manifest.surfaces !== "object" || !manifest.surfaces.hosting || !manifest.surfaces.functions) {
    throw new ManifestFailure("E_MANIFEST_INVALID", "Predeploy manifest must carry both hosting and functions surfaces.");
  }

  const hSurf = manifest.surfaces.hosting;
  const fSurf = manifest.surfaces.functions;
  if (hSurf.surface !== "hosting" || hSurf.rootRelative !== `.firebase/${hostingCfg.site}/hosting`) {
    throw new ManifestFailure("E_MANIFEST_INVALID", "Hosting surface metadata is invalid.");
  }
  if (fSurf.surface !== "functions" || fSurf.rootRelative !== `.firebase/${hostingCfg.site}/functions`) {
    throw new ManifestFailure("E_MANIFEST_INVALID", "Functions surface metadata is invalid.");
  }

  const hostingCount = validateFilesAgainstRoot(hSurf.files, reconciled.hostingDir, makeHostingMatcher(hostingCfg.ignore));
  const expectedHostingDigest = crypto
    .createHash("sha256")
    .update(JSON.stringify({ surface: hSurf.surface, rootRelative: hSurf.rootRelative, files: hSurf.files }))
    .digest("hex");
  if (typeof hSurf.surfaceDigest !== "string" || hSurf.surfaceDigest !== expectedHostingDigest) {
    throw new ManifestFailure("E_MANIFEST_DIGEST", "Hosting surfaceDigest is missing or mismatched.");
  }

  const functionsCount = validateFilesAgainstRoot(fSurf.files, reconciled.functionsDir, makeFunctionsMatcher());
  const expectedFunctionsDigest = crypto
    .createHash("sha256")
    .update(JSON.stringify({ surface: fSurf.surface, rootRelative: fSurf.rootRelative, files: fSurf.files }))
    .digest("hex");
  if (typeof fSurf.surfaceDigest !== "string" || fSurf.surfaceDigest !== expectedFunctionsDigest) {
    throw new ManifestFailure("E_MANIFEST_DIGEST", "Functions surfaceDigest is missing or mismatched.");
  }

  const body = {
    version: manifest.version,
    mode: manifest.mode,
    attestationScope: manifest.attestationScope,
    realUploaderHookAttested: manifest.realUploaderHookAttested,
    limitation: manifest.limitation,
    binding,
    surfaces: {
      hosting: {
        surface: hSurf.surface,
        rootRelative: hSurf.rootRelative,
        files: hSurf.files,
        surfaceDigest: hSurf.surfaceDigest,
      },
      functions: {
        surface: fSurf.surface,
        rootRelative: fSurf.rootRelative,
        files: fSurf.files,
        surfaceDigest: fSurf.surfaceDigest,
      },
    },
  };
  const digest = assertValidManifestDigest(manifest, body);

  return {
    result: "PASS",
    mode: "firebase-predeploy",
    attestationScope: manifest.attestationScope,
    realUploaderHookAttested: false,
    surfaces: {
      hosting: { files: hostingCount, surfaceDigest: hSurf.surfaceDigest },
      functions: { files: functionsCount, surfaceDigest: fSurf.surfaceDigest },
    },
    digest,
    binding,
  };
}

function resolveBindingFromEnv(env, opts) {
  const e = env || process.env;
  const mode = (opts && opts.mode) || "directory";
  let buildId = e.CT4_BUILD_ID;
  if (mode === "firebase-predeploy" && isBlank(buildId) && opts && opts.reconciledBuildId) {
    buildId = opts.reconciledBuildId;
  }
  const raw = {
    commit: e.CT4_GIT_COMMIT_SHA || e.GITHUB_SHA,
    tree: e.CT4_GIT_TREE_SHA,
    buildId,
    project: e.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    site: e.CT4_FIREBASE_SITE || (opts && opts.configuredSite) || e.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    selector: e.NEXT_PUBLIC_APP_ENV,
    cliVersion: e.CT4_FIREBASE_CLI_VERSION,
    runId: e.CT4_RUN_ID || e.GITHUB_RUN_ID,
    runAttempt: e.CT4_RUN_ATTEMPT || e.GITHUB_RUN_ATTEMPT,
    firebaseIdentity: {
      projectId: e.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      apiKey: e.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: e.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      storageBucket: e.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: e.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: e.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: e.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    },
  };
  return raw;
}

function verifyGitBinding(root, binding) {
  const resolvedRoot = path.resolve(root);
  if (!fs.existsSync(path.join(resolvedRoot, ".git"))) {
    throw new ManifestFailure("E_GIT_BINDING_MISMATCH", "Cannot verify git HEAD/tree binding: .git directory is absent.", {
      root: resolvedRoot,
    });
  }
  let lines;
  try {
    const out = execFileSync(
      "git",
      ["--no-optional-locks", "-C", resolvedRoot, "rev-parse", "HEAD", "HEAD^{tree}"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    lines = out.trim().split(/\r?\n/);
  } catch (error) {
    throw new ManifestFailure("E_GIT_BINDING_MISMATCH", "Failed to read git HEAD and tree SHA.", {
      reason: error && error.message ? error.message : String(error),
    });
  }
  const actualCommit = (lines[0] || "").trim();
  const actualTree = (lines[1] || "").trim();
  if (actualCommit !== binding.commit) {
    throw new ManifestFailure("E_GIT_BINDING_MISMATCH", "Git HEAD commit does not match manifest binding.commit.", {
      field: "commit",
    });
  }
  if (actualTree !== binding.tree) {
    throw new ManifestFailure("E_GIT_BINDING_MISMATCH", "Git HEAD^{tree} does not match manifest binding.tree.", {
      field: "tree",
    });
  }
  return { commit: actualCommit, tree: actualTree };
}

module.exports = {
  CANONICAL_PRODUCTION_IDENTITY,
  CANONICAL_PRODUCTION_IDENTITY_DIGEST,
  MANIFEST_VERSION,
  ManifestFailure,
  PRODUCTION_PROJECT_ID,
  PRODUCTION_SELECTOR,
  PRODUCTION_SITE,
  R4_MARKERS,
  assertCanonicalTupleMatchesSource,
  assertNoSymlinkChain,
  assertNotNextOnly,
  buildManifest,
  buildPredeployManifest,
  canonicalContainmentPath,
  computeIdentityDigest,
  isPathContained,
  makeFunctionsMatcher,
  makeHostingMatcher,
  normalizeBinding,
  parseCliArgs,
  readFirebaseHostingConfig,
  readJsonFile,
  reconcilePredeploySurfaces,
  resolveBindingFromEnv,
  sha256File,
  validateFirebaseIdentity,
  validateManifest,
  validatePredeployManifest,
  validateRelativePath,
  verifyGitBinding,
  walkFiles,
};

function parseCliArgs(args) {
  const command = args[0];
  if (command !== "build" && command !== "validate") {
    throw new ManifestFailure(
      "E_USAGE",
      "usage: ct4-web-p0-g8-payload-manifest.cjs build|validate --mode directory|firebase-predeploy --root <dir> ...",
    );
  }
  const flags = Object.create(null);
  const booleans = new Set(["--from-env", "--verify-git"]);
  for (let i = 1; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) {
      throw new ManifestFailure("E_USAGE", `Unexpected positional argument: ${token}`);
    }
    if (booleans.has(token)) {
      flags[token] = true;
      continue;
    }
    const next = args[i + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new ManifestFailure("E_USAGE", `Flag ${token} requires a value.`);
    }
    flags[token] = next;
    i += 1;
  }
  const mode = flags["--mode"] || "directory";
  if (mode !== "directory" && mode !== "firebase-predeploy") {
    throw new ManifestFailure("E_USAGE", `Invalid --mode "${mode}". Expected "directory" or "firebase-predeploy".`);
  }
  return { command, mode, flags };
}

function readJsonFile(filePath, missingCode, invalidCode, label) {
  if (!fs.existsSync(filePath)) {
    throw new ManifestFailure(missingCode, `${label} file does not exist.`, { file: filePath });
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    throw new ManifestFailure(invalidCode, `${label} file is not valid JSON.`, { file: filePath });
  }
}

function main(argv) {
  try {
    const { command, mode, flags } = parseCliArgs(argv.slice(2));
    const root = path.resolve(flags["--root"] || process.cwd());
    const fromEnv = Boolean(flags["--from-env"]);
    const bindingFile = flags["--binding"];

    if (!fromEnv && !bindingFile) {
      throw new ManifestFailure("E_USAGE", "Either --binding <file> or --from-env is required.");
    }
    if (fromEnv && bindingFile) {
      throw new ManifestFailure("E_USAGE", "Cannot pass both --binding and --from-env.");
    }

    let rawBinding;
    if (fromEnv) {
      let reconciledBuildId;
      let configuredSite;
      if (mode === "firebase-predeploy") {
        const cfg = readFirebaseHostingConfig(root);
        configuredSite = cfg.site;
        const rec = reconcilePredeploySurfaces(root, cfg.site, process.env.CT4_BUILD_ID);
        reconciledBuildId = rec.buildId;
      }
      rawBinding = resolveBindingFromEnv(process.env, { mode, reconciledBuildId, configuredSite });
    } else {
      rawBinding = readJsonFile(bindingFile, "E_BINDING_INCOMPLETE", "E_BINDING_INCOMPLETE", "Binding");
    }

    if (command === "build") {
      const manifest =
        mode === "firebase-predeploy"
          ? buildPredeployManifest(root, rawBinding)
          : buildManifest(root, rawBinding, { repoRoot: root });
      if (flags["--verify-git"]) {
        verifyGitBinding(root, manifest.binding);
      }
      const out = flags["--out"];
      const payload = `${JSON.stringify(manifest, null, 2)}\n`;
      if (out) {
        fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
        fs.writeFileSync(out, payload);
      } else {
        process.stdout.write(payload);
      }
      return 0;
    }

    const manifestFile = flags["--manifest"];
    if (!manifestFile) {
      throw new ManifestFailure("E_USAGE", "Missing required --manifest <file> argument for validate.");
    }
    const manifestObj = readJsonFile(manifestFile, "E_MANIFEST_INVALID", "E_MANIFEST_INVALID", "Manifest");
    const report =
      mode === "firebase-predeploy"
        ? validatePredeployManifest(manifestObj, root, rawBinding)
        : validateManifest(manifestObj, root, rawBinding, { repoRoot: root });
    if (flags["--verify-git"]) {
      verifyGitBinding(root, report.binding);
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof ManifestFailure) {
      console.error(`CT4 WEB-P0 G8 manifest: FAIL ${error.code}`);
      console.error(`  ${error.message}`);
      return 1;
    }
    console.error("CT4 WEB-P0 G8 manifest: FAIL E_INTERNAL");
    console.error(`  ${error && error.message ? error.message : String(error)}`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}
