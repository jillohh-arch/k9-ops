#!/usr/bin/env node
/**
 * CT4 WEB-P0 — POST-BUILD / PRE-PUBLISH compiled-artifact guard.
 *
 * Gate: CT4.WEB-P0.PRODUCTION-GUARD-AND-CANDIDATE-BUILD-R2
 *
 * WHAT IT PROVES
 * --------------
 * The env guard checks INTENT (the inputs a build is about to receive). This
 * guard checks what was actually produced and what would actually ship:
 *
 *   1. one build id per delivered candidate, and no two surfaces of the SAME
 *      site disagreeing about which build they belong to;
 *   2. no stale artifact: a delivered tree that predates the sources it claims
 *      to ship is refused;
 *   3. the compiled artifact resolves to production/canil-gcm, proven in three
 *      independent layers, each of which fails closed:
 *        (a) the keyed env-selection object the resolver consumes
 *            (`NEXT_PUBLIC_APP_ENV:"production"` plus the NEXT_PUBLIC_FIREBASE_*
 *            identity keys) must be unique and canonical;
 *        (b) every inlined `NEXT_PUBLIC_FIREBASE_<FIELD>:"<value>"` literal must
 *            carry the PRODUCTION value. A staging credential anywhere in the
 *            artifact is a defect, whether or not it sits in a selection object;
 *        (c) a FIELD-NAME staging tuple (`projectId:"k9-ops-staging"`, …) is
 *            legitimate ONLY as the `staging` member of the canonical
 *            `{staging:{…},production:{…}}` record that config.ts compiles into
 *            every build. Outside that record it is an injected identity.
 *   4. no F60 Warehouse route or entrypoint exists in anything that ships.
 *
 * WHY (c) IS NOT A GREP: `src/lib/firebase/config.ts` embeds BOTH tuples, so
 * `k9-ops-staging` appears in every legitimate build. Presence proves nothing;
 * POSITION does. Measured over 24 real build trees on this machine: 140
 * occurrences of the field-name staging tuple, 140 inside the canonical record,
 * 0 outside. An occurrence outside that record is a second, ACTIVE identity.
 *
 * WHY (b) IS NOT A GREP EITHER: it compares the decoded VALUE against the
 * canonical production tuple, so a benign third-party package that merely
 * mentions `NEXT_PUBLIC_FIREBASE_*` key names cannot trip it. Measured: 2844
 * keyed identity literals across those same trees, 0 violations in builds that
 * select production.
 *
 * SCOPE: this is a STATIC check of the compiled artifact and of the tree the
 * Firebase CLI would upload. It does NOT prove that the GitHub Environment
 * variables were correct, that the CLI's internal rebuild inherited them, or
 * what any server serves at runtime. Those are NOT_PROVEN_LIVE and are listed
 * in the gate's evidence pack.
 *
 * SAFETY: prints field names, counts, build ids and public route names only.
 * Never prints a config value. No network, no credentials, read-only on disk.
 *
 * CLI:
 *   node scripts/ct4-web-p0-production-bundle-guard.cjs [--root <dir>]
 *        [--stage post-build|pre-publish] [--json]
 */

"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PRODUCTION_PROJECT_ID = "canil-gcm";
const STAGING_PROJECT_ID = "k9-ops-staging";

/** R4 signature markers: a directory is a build-id candidate only if it
 *  directly contains at least one of these (contract reference
 *  decision-oracle.cjs MARKERS). */
const R4_MARKERS = Object.freeze([
  "_buildManifest.js",
  "_ssgManifest.js",
  "_clientMiddlewareManifest.js",
  "_clientMiddlewareManifest.json",
]);

/**
 * H0 -- real link inspection and upload-root containment.
 *
 * The CLI follows a Hosting glob with { follow: true }: a symlink or Windows
 * junction inside the upload tree is followed and its TARGET content ships.
 * A link the guard cannot resolve, or one that escapes the canonical upload
 * root, is a fail-closed defect (E_LINK_UNPROVABLE / E_ROOT_ESCAPE). A link is
 * only dismissed when it is proven to point INSIDE the root it was found in.
 * Textual prefix comparison is unsound (C:\safe vs C:\safe2); the containment
 * test is path-segment aware over realpaths, with drive-letter normalization.
 */

/** Canonicalize a path for containment comparison (drive/case/separator aware). */
function canonicalContainmentPath(p) {
  let resolved = p;
  try {
    // realpathSync resolves to the ON-DISK case (case-insensitive
    // containment on Windows), but it only works for existing paths.
    resolved = fs.realpathSync(p);
  } catch {
    // Non-existent or unresolvable path: no realpath is possible, so the
    // canonical form is lexical only. Case is preserved, which is safe for
    // containment (a mismatched case can only make the comparison STRICTER).
    resolved = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  }
  resolved = path.resolve(resolved);
  // Normalize separators ONLY to the executing platform separator.
  // Forcing backslashes on POSIX made canonical paths incomparable with
  // path.sep ('/') and broke containment on Linux (H0-E RED). Windows keeps
  // backslash normalization (realpath may return forward slashes) plus
  // drive-casing restoration, both win32-only.
  let out;
  if (process.platform === "win32") {
    // Windows keeps backslash normalization (realpath may return forward
    // slashes) plus drive-casing restoration, both win32-only.
    out = resolved.replace(/\//g, "\\");
  } else {
    // POSIX: normalize any literal backslashes to the platform separator so
    // mixed-separator lexical inputs (H0-E fixtures) compare consistently.
    // Real POSIX paths from realpathSync contain no backslash separators, so
    // the H0-E RED fix (all-forward canonical forms) is preserved.
    out = resolved.replace(/\\/g, "/");
  }
  if (process.platform === "win32") {
    // path.resolve strips the drive colon (C:\x -> C:\x) on Windows; restore
    // it so containment comparison preserves a canonical drive prefix.
    if (/^[A-Za-z]\\/.test(out)) out = out[0] + ':' + out.slice(1);
    const drive = out.match(/^([A-Za-z]):/);
    if (drive) out = drive[1].toUpperCase() + out.slice(2);
  }
  if (process.platform === "win32") {
    // Windows path comparison is case-insensitive (the on-disk case of a
    // directory is whatever the creating process chose). A case-sensitive
    // comparison false-negates containment and turns a benign link into an
    // escape; a case-insensitive one only on win32 stays honest for Linux.
    out = out.toLowerCase();
  }


  // Windows path comparison is case-insensitive (the on-disk case of a
  // directory is whatever the creating process chose). A case-sensitive
  // comparison false-negates containment and turns a benign link into an
  // escape; a case-insensitive one only on win32 stays honest for Linux.
  if (process.platform === "win32") out = out.toLowerCase();
  return out;
}

/** True iff child is inside (or equal to) ancestor, path-segment aware. */
function isPathContained(child, ancestor) {
  const c = canonicalContainmentPath(child);
  const a = canonicalContainmentPath(ancestor);
  if (c === a) return true;
  const prefix = a.endsWith(path.sep) ? a : a + path.sep;
  return c.startsWith(prefix);
}

/** Extract the final path component of a realpath. */
function realBasename(p) {
  const c = canonicalContainmentPath(p);
  const parts = c.split(path.sep);
  return parts[parts.length - 1];
}

/**
 * Classify one filesystem link.
 *
 * Returns { status: "INSIDE" | "ESCAPE" | "DANGLING" | "CYCLE" | "UNRESOLVABLE", ... }.
 * CYCLE detection walks the chain with a visited set (bounded by depth 64).
 */
function classifyLink(fullPath, rootDir) {
  const visited = new Set();
  let current = fullPath;
  for (let depth = 0; depth < 64; depth += 1) {
    let st;
    try {
      st = fs.lstatSync(current);
    } catch {
      return { status: "UNRESOLVABLE", target: null, real: null };
    }
    if (!st.isSymbolicLink()) break;
    const key = canonicalContainmentPath(current);
    if (visited.has(key)) {
      return { status: "CYCLE", target: null, real: null };
    }
    visited.add(key);
    let next;
    try {
      next = fs.readlinkSync(current);
    } catch {
      return { status: "UNRESOLVABLE", target: null, real: null };
    }
    const nextAbs = path.isAbsolute(next) ? next : path.resolve(path.dirname(current), next);
    let nextStat;
    try {
      nextStat = fs.statSync(nextAbs);
    } catch {
      return { status: "DANGLING", target: nextAbs, real: null };
    }
    current = nextAbs;
    if (!nextStat.isDirectory()) break;
  }
  let real;
  try {
    real = fs.realpathSync.native(current);
  } catch {
    return { status: "UNRESOLVABLE", target: current, real: null };
  }
  const contained = isPathContained(real, rootDir);
  return {
    status: contained ? "INSIDE" : "ESCAPE",
    target: current,
    real,
  };
}

/**
 * H0 audit of one upload tree.
 *
 * Classifies every symlink/junction BEFORE following it. Skips nothing except
 * what the surface matcher already excludes: node_modules (never uploaded by
 * any surface) and .git (never uploaded; on Windows a worktree .git is a FILE
 * and cannot carry a directory link anyway). A link is an escape only when its
 * target is INSIDE the upload set of the surface being judged: a link that the
 * matcher excludes (a dot-dir on Hosting, node_modules, .git) cannot ship.
 *
 * For HOSTING the matcher is the effective hosting.ignore, i.e. the three
 * entries firebase.json, the dot-path glob and the node_modules glob.
 * A path is matcher-EXCLUDED iff any segment starts with "." or equals
 * node_modules. Functions (prepareFunctionsUpload default) excludes only
 * node_modules and .git.
 */
function hostingMatcherExcludes(relSegments) {
  // Pinned firebase-tools@15.25.1 probe (Stage A, probe-listfiles-a1.js):
  // glob runs with dot:true and follow:true, so the dot-path pattern excludes
  // the dot-NAMED entry itself but its descendants still ship, and
  // .git/config IS listed. Only node_modules is truly excluded.
  return relSegments.some((segment) => segment === "node_modules");
}

function functionsMatcherExcludes(relSegments) {
  return relSegments.some((segment) => segment === "node_modules" || segment === ".git");
}

function auditUploadTreeLinks(rootDir, surface) {
  const rootCanonical = canonicalContainmentPath(rootDir);
  const findings = [];
  const walkLocal = (dir, relSegments, depth) => {
    if (depth > 64) {
      throw new BundleGuardFailure(
        "E_UNINSPECTABLE_TREE",
        "Directory nesting exceeds 64 levels during the H0 link audit.",
        { path: dir },
      );
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      throw new BundleGuardFailure(
        "E_UNINSPECTABLE_TREE",
        "A directory the H0 audit cannot read is not evidence of safety.",
        { path: dir, reason: error && error.code },
      );
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = [...relSegments, entry.name];
      if (entry.isSymbolicLink()) {
        // A link inside a matcher-excluded directory cannot ship.
        const parentExcluded =
          surface === "hosting" ? hostingMatcherExcludes(relSegments) : functionsMatcherExcludes(relSegments);
        if (parentExcluded) continue;
        const cls = classifyLink(full, rootDir);
        if (cls.status === "UNRESOLVABLE" || cls.status === "DANGLING" || cls.status === "CYCLE") {
          findings.push({ path: path.relative(rootDir, full), status: cls.status });
          continue;
        }
        if (cls.status === "INSIDE") continue;
        // ESCAPE: does the link NAME (or an ancestor directory it lives in)
        // survive the effective matcher? If the link or any ancestor is
        // matcher-excluded, it cannot ship and is dismissed.
        const linkExcluded =
          surface === "hosting" ? hostingMatcherExcludes(rel) : functionsMatcherExcludes(rel);
        // For a directory link that ESCAPES, everything the CLI follows under
        // it is outside the root: the containment boundary is broken at the
        // link itself. If the link path is matcher-eligible, it is a defect.
        if (!linkExcluded) {
          findings.push({ path: path.relative(rootDir, full), status: "ESCAPE" });
        }
        continue;
      }
      if (!entry.isDirectory()) continue;
      walkLocal(full, rel, depth + 1);
    }
  };
  walkLocal(rootDir, [], 0);
  return findings;
}

/** Root-level containment of the resolved upload root (H0 boundary proof). */
function assertUploadRootContained(rootDir, label) {
  const canonical = canonicalContainmentPath(rootDir);
  if (!fs.existsSync(rootDir)) {
    throw new BundleGuardFailure(
      "E_ROOT_ABSENT",
      label + " upload root does not exist on disk at the resolved path.",
      { root: rootDir },
    );
  }
  const stat = fs.lstatSync(rootDir);
  if (stat.isSymbolicLink()) {
    // The root itself is a link: resolve it and require containment of itself.
    const cls = classifyLink(rootDir, path.dirname(rootDir));
    if (cls.status !== "INSIDE" && cls.status !== "ESCAPE") {
      throw new BundleGuardFailure(
        "E_LINK_UNPROVABLE",
        label + " upload root is a link that cannot be resolved safely.",
        { root: rootDir },
      );
    }
    // A link root pointing outside the project is still readable; the audit
    // uses the REAL target as the boundary below.
    return canonicalContainmentPath(fs.realpathSync.native(rootDir));
  }
  return canonical;
}

/**
 * WHY NO SINGLE SIGNAL IS TRUSTED ALONE.
 *
 * `src/lib/firebase/config.ts` embeds BOTH identity tuples as source literals,
 * so grepping a bundle for "k9-ops-staging" or "canil-gcm" proves nothing —
 * both strings appear in every build regardless of which one was selected.
 *
 * What Next.js inlines at build time is the value of each
 * `process.env.NEXT_PUBLIC_*` variable (see next/dist/lib/static-env.js), so a
 * compiled chunk carries `NEXT_PUBLIC_APP_ENV:"<value>"` for whichever
 * environment was chosen. That discriminator is necessary but not sufficient:
 * a chunk can carry a second, contradictory identity beside it, which is why
 * the guard combines three layers (see WHAT IT PROVES at the top of the file).
 *
 * The two maps that used to live here — an inlined-discriminator constant and a
 * field->env-key map — became dead when the accumulator was replaced by the
 * three-layer proof. The knowledge now lives in `IDENTITY_LITERAL_FIELDS`
 * (field -> env key, used by the literal scan) and `ENV_OBJECT_FIELDS` (the keys
 * a selection object must carry), below.
 */

/** Canonical production identity, the only values a production build may inline. */
const CANONICAL_IDENTITY = {
  production: {
    apiKey: "AIzaSyAQKCu-UOQQFiRfq-Slahhcy985rtQBkmU",
    authDomain: "canil-gcm.firebaseapp.com",
    projectId: "canil-gcm",
    storageBucket: "canil-gcm.firebasestorage.app",
    messagingSenderId: "418249404282",
    appId: "1:418249404282:web:6c0093a341e04ef518b0c3",
    measurementId: "G-KNTKW04X7S",
  },
};

/** Production identity markers (secondary evidence; always present in source). */
const PRODUCTION_MARKERS = {
  projectId: PRODUCTION_PROJECT_ID,
  authDomain: "canil-gcm.firebaseapp.com",
  storageBucket: "canil-gcm.firebasestorage.app",
  appId: "1:418249404282:web:6c0093a341e04ef518b0c3",
  apiKey: "AIzaSyAQKCu-UOQQFiRfq-Slahhcy985rtQBkmU",
  messagingSenderId: "418249404282",
};

/** Staging identity markers (secondary evidence; always present in source). */
const STAGING_MARKERS = {
  projectId: STAGING_PROJECT_ID,
  authDomain: "k9-ops-staging.firebaseapp.com",
  storageBucket: "k9-ops-staging.firebasestorage.app",
  appId: "1:507588808242:web:89b531a8e7d358596ef62b",
  apiKey: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
  messagingSenderId: "507588808242",
};

/**
 * Route / entrypoint shapes that ONLY F60 Warehouse introduces.
 *
 * Pre-existing base routes (`inventory`, `movements`) are NOT F60 and must not
 * trigger this gate. Only paths under the `warehouse/` feature namespace or
 * the `batches` / `custody` domain concepts introduced by F60 count.
 */
const WAREHOUSE_ROUTE_PATTERNS = [
  /(^|[\\/])warehouse([\\/]|$)/i,
  /(^|[\\/])batches([\\/]|$)/i,
  /(^|[\\/])custody([\\/]|$)/i,
];

/**
 * Directories that are never uploaded by ANY Firebase surface.
 *
 * `node_modules` is excluded from a Functions source upload by the CLI default
 * (`prepareFunctionsUpload.js`: `config.ignore || ["node_modules", ".git"]`) and
 * from Hosting by `hosting.ignore`. `.git` is excluded everywhere. Skipping
 * them is therefore not a blind spot: nothing inside them can ship.
 *
 * `cache`, `cache.webpack` and `typescript` are deliberately NOT skipped — they
 * exist inside a real `.next` and ARE inspected.
 */
const SKIP_DIRS = new Set(["node_modules"]);

class BundleGuardFailure extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "BundleGuardFailure";
    this.code = code;
    this.detail = detail || {};
  }
}

function exists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Walk a tree exhaustively.
 *
 * There IS a depth cap (64) and it fails closed, and exactly two directory
 * names are skipped: `node_modules` and `.git` — both of which no Firebase
 * surface uploads. Everything else on disk under a delivered tree is read,
 * including dot-directories, because a Functions source upload ships them
 * (only `.git` is excluded). A tree the guard cannot read is never reported as
 * safe.
 */
function walk(dir, visit, depth) {
  const currentDepth = depth || 0;
  if (currentDepth > 64) {
    throw new BundleGuardFailure(
      "E_UNINSPECTABLE_TREE",
      `Directory nesting exceeds 64 levels at "${dir}"; refusing to report a tree it could not read.`,
      { path: dir },
    );
  }
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    throw new BundleGuardFailure(
      "E_UNINSPECTABLE_TREE",
      `Cannot read directory "${dir}". A tree the guard cannot read is not evidence of safety.`,
      { path: dir, reason: error && error.code },
    );
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (SKIP_DIRS.has(entry.name)) continue;

    // Symlinks and Windows junctions report isDirectory()===false and
    // isFile()===false, so a naive branch skips them entirely — and a skipped
    // directory is exactly where an identity can hide. Resolve the real type.
    let isDir = entry.isDirectory();
    let isFile = entry.isFile();
    if (entry.isSymbolicLink()) {
      try {
        const target = fs.statSync(full);
        isDir = target.isDirectory();
        isFile = target.isFile();
      } catch (error) {
        throw new BundleGuardFailure(
          "E_UNINSPECTABLE_TREE",
          `Cannot resolve symlink "${full}"; a link the guard cannot follow is not evidence of safety.`,
          { path: full, reason: error && error.code },
        );
      }
    }

    if (isDir) {
      visit({ path: full, name: entry.name, isDir: true });
      walk(full, visit, currentDepth + 1);
    } else if (isFile) {
      visit({ path: full, name: entry.name, isDir: false });
    }
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

/**
 * Next.js writes the build id to `<distDir>/BUILD_ID`; a frameworks deploy also
 * carries it inside `required-server-files.json`. `ssr` function bundles keep a
 * `.next/BUILD_ID` next to the copied config.
 */
function readBuildId(outputDir) {
  const candidate = path.join(outputDir, "BUILD_ID");
  if (exists(candidate)) {
    const value = fs.readFileSync(candidate, "utf8").trim();
    if (value) return value;
  }
  const required = readJson(path.join(outputDir, "required-server-files.json"));
  if (required && typeof required.config !== "undefined") {
    const sibling = path.join(outputDir, "BUILD_ID");
    if (exists(sibling)) return fs.readFileSync(sibling, "utf8").trim();
  }
  return undefined;
}

/**
 * Names that occupy `_next/static/` but are NOT the build id.
 *
 * A Next build writes the build id as a directory name alongside these:
 *   `<hosting>/_next/static/<BUILD_ID>/`, `chunks/`, `css/`, `media/`, …
 * Verified on two real `.firebase/<site>/hosting` trees in this workspace.
 */
const NON_BUILD_ID_STATIC_ENTRIES = new Set(["chunks", "css", "media", "development", "webpack"]);

/**
 * Read the build id a HOSTING tree carries.
 *
 * Hosting does not ship a `BUILD_ID` file — that is a `.next` concept — so
 * requiring one there would reject every legitimate artifact. What it DOES
 * carry is the id-addressable static directory, plus, in some layouts, an
 * explicit marker. Read all of them; return `undefined` when nothing proves an
 * id, so the caller can report "not carried" instead of inventing one.
 */
function readHostingBuildId(hostingDir) {
  for (const marker of ["BUILD_ID", path.join(".next", "BUILD_ID"), path.join("_next", "BUILD_ID")]) {
    const candidate = path.join(hostingDir, marker);
    if (exists(candidate)) {
      const value = fs.readFileSync(candidate, "utf8").trim();
      if (value) return value;
    }
  }
  const staticDir = path.join(hostingDir, "_next", "static");
  let entries;
  try {
    entries = fs.readdirSync(staticDir, { withFileTypes: true });
  } catch {
    return undefined;
  }
  const ids = entries
    .filter((entry) => entry.isDirectory() && !NON_BUILD_ID_STATIC_ENTRIES.has(entry.name))
    .map((entry) => entry.name);
  // Two candidate id directories is not a fact to pick from; it is unproven.
  return ids.length === 1 ? ids[0] : undefined;
}

/** R4 anchor scan for one surface directory (e.g. <hosting>/_next/static or
 *  <functions-root>/.next/static): every entry dir, with marker evidence. */
function r4ScanAnchor(dir) {
  if (!fs.existsSync(dir)) return { state: "MISSING", idDirs: [] };
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { state: "UNREADABLE", idDirs: [] };
  }
  const idDirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let inner;
    try {
      inner = fs.readdirSync(path.join(dir, entry.name));
    } catch {
      continue;
    }
    const markers = R4_MARKERS.filter((marker) => inner.includes(marker));
    idDirs.push({ name: entry.name, hasMarker: markers.length > 0, markers });
  }
  return { state: "OK", idDirs };
}

/** Validate a model-provided build id (F-01). Strict on type/content. */
function f01ValidateId(value, label) {
  if (value === undefined || value === null) return { ok: false, reason: label + " is undefined/null" };
  if (typeof value !== "string") return { ok: false, reason: label + " is not a string (typeof=" + typeof value + ")" };
  if (value.trim().length === 0) return { ok: false, reason: label + " is empty or whitespace" };
  if (/[\u0000-\u001f\u007f]/.test(value)) return { ok: false, reason: label + " contains a control character" };
  if (/(^|[\\/])\.\.([\\/]|$)/.test(value)) return { ok: false, reason: label + " contains a traversal segment" };
  return { ok: true, value };
}

/**
 * R4 basePath normalization (normative equivalent of the contract reference
 * normalizeBasePath). "" and "/" are the same anchor; everything ambiguous,
 * non-string, UNC, drive-prefixed, traversal or reserved fails closed.
 */
function r4NormalizeBasePath(raw) {
  if (typeof raw !== "string") return { ok: false, reason: "basePath is not a string" };
  if (/[\u0000-\u001f\u007f]/.test(raw)) return { ok: false, reason: "basePath contains a control character" };
  if (raw.includes("\\")) return { ok: false, reason: "basePath contains a backslash" };
  if (/^[A-Za-z]:/.test(raw)) return { ok: false, reason: "basePath is Windows drive-prefixed" };
  if (raw.startsWith("//")) return { ok: false, reason: "basePath starts with '//' (UNC form)" };
  if (raw === "" || raw === "/") return { ok: true, value: "" };
  if (!raw.startsWith("/")) return { ok: false, reason: "basePath does not start with '/'" };
  let segments = raw.split("/");
  segments = segments.slice(1);
  if (segments.length && segments[segments.length - 1] === "") segments = segments.slice(0, -1);
  if (segments.length === 0) return { ok: false, reason: "basePath has no segment after normalization" };
  for (const s of segments) {
    if (s === "" || s === "." || s === "..") return { ok: false, reason: "basePath has an empty or relative segment" };
    if (s === "_next") return { ok: false, reason: "basePath collides with reserved '_next'" };
  }
  return { ok: true, value: segments.join("/") };
}

/** Read + validate the two rooted Functions manifests (F-01/R4). */
function r4ReadManifests(functionsRoot) {
  const result = { routesManifest: null, requiredServerFiles: null };
  for (const [key, rel] of [
    ["routesManifest", path.join(".next", "routes-manifest.json")],
    ["requiredServerFiles", path.join(".next", "required-server-files.json")],
  ]) {
    const full = path.join(functionsRoot, rel);
    if (!fs.existsSync(full)) {
      result[key] = { state: "MISSING" };
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(full, "utf8"));
    } catch {
      result[key] = { state: "INVALID_JSON" };
      continue;
    }
    result[key] = { state: "OK", parsed };
  }
  return result;
}

/** F-01: extract and validate basePath from both manifests; fail closed. */
function r4ResolveBasePath(functionsRoot) {
  const m = r4ReadManifests(functionsRoot);
  if (m.routesManifest.state !== "OK") {
    return { ok: false, code: "E_BUILD_ID_UNPROVABLE", reason: "routes-manifest.json state=" + m.routesManifest.state };
  }
  if (m.requiredServerFiles.state !== "OK") {
    return { ok: false, code: "E_BUILD_ID_UNPROVABLE", reason: "required-server-files.json state=" + m.requiredServerFiles.state };
  }
  const rb = m.routesManifest.parsed.basePath;
  const sb = m.requiredServerFiles.parsed && m.requiredServerFiles.parsed.config
    ? m.requiredServerFiles.parsed.config.basePath
    : undefined;
  const nr = r4NormalizeBasePath(rb);
  if (!nr.ok) return { ok: false, code: "E_BUILD_ID_UNPROVABLE", reason: "routes-manifest.basePath: " + nr.reason };
  const ns = r4NormalizeBasePath(sb);
  if (!ns.ok) return { ok: false, code: "E_BUILD_ID_UNPROVABLE", reason: "required-server-files.basePath: " + ns.reason };
  if (nr.value !== ns.value) {
    return {
      ok: false,
      code: "E_BUILD_ID_CONFLICT",
      reason: "basePath manifests disagree: " + JSON.stringify(rb) + " vs " + JSON.stringify(sb),
    };
  }
  return { ok: true, value: nr.value, sources: { routesManifest: rb, requiredServerFiles: sb } };
}

/**
 * Evaluate one R4 anchor: exactly ONE genuine (marker-bearing) directory may
 * exist. Zero -> E_BUILD_ID_UNPROVABLE; two or more -> E_BUILD_ID_AMBIGUOUS.
 * F-01 rejects any non-string / empty / whitespace / traversal id.
 */
function r4EvaluateAnchor(anchor, surfaceName) {
  if (!anchor || anchor.state === "MISSING" || anchor.state === "UNREADABLE") {
    return { ok: false, code: "E_BUILD_ID_UNPROVABLE", reason: surfaceName + " anchor state=" + (anchor ? anchor.state : "absent") };
  }
  const genuine = (anchor.idDirs || []).filter((d) => d.hasMarker).map((d) => d.name);
  if (genuine.length === 0) {
    return { ok: false, code: "E_BUILD_ID_UNPROVABLE", reason: surfaceName + ": no marker-bearing id directory" };
  }
  if (genuine.length > 1) {
    return { ok: false, code: "E_BUILD_ID_AMBIGUOUS", reason: surfaceName + ": " + genuine.length + " genuine id dirs", ids: genuine };
  }
  const f01 = f01ValidateId(genuine[0], surfaceName + " static idDir name");
  if (!f01.ok) return { ok: false, code: "E_INPUT_MODEL_INVALID", reason: f01.reason };
  return { ok: true, id: f01.value };
}

/**
 * Gather every plausible delivered output tree.
 *
 * `--stage post-build` inspects the app's own `.next`. `--stage pre-publish`
 * inspects the tree the Firebase CLI would upload (`.firebase/<site>/hosting`
 * plus the generated `functions/<ssr>/...`) and treats a competing `.next` as
 * an ambiguity to be reported, not silently resolved.
 */
function discoverOutputs(root) {
  const outputs = [];
  const nextDir = path.join(root, ".next");
  if (exists(nextDir)) {
    // The project-root `.next` is the artifact a POST-BUILD check must judge,
    // but the frameworks pipeline treats it as an INPUT: `firebase deploy`
    // rebuilds into `.firebase/<site>/`. It is therefore never `delivered`.
    outputs.push({ kind: "next", dir: nextDir, selected: false, delivered: false });
  }
  const firebaseDir = path.join(root, ".firebase");
  if (exists(firebaseDir)) {
    for (const entry of fs.readdirSync(firebaseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const siteDir = path.join(firebaseDir, entry.name);
      const hostingDir = path.join(siteDir, "hosting");
      if (exists(hostingDir)) {
        outputs.push({
          kind: "firebase-hosting",
          site: entry.name,
          dir: hostingDir,
          selected: true,
          delivered: true,
        });
      }
      const functionsDir = path.join(siteDir, "functions");
      // The frameworks deploy writes the SSR codebase AT `.firebase/<site>/functions`
      // (firebase-tools frameworks/index.js: `functionsDist = join(dist,"functions")`).
      // That directory IS the upload root; everything inside it — `public/`,
      // `.next/`, `node_modules/` — is its CONTENT, not a second codebase.
      //
      // The R3 shape promoted every nested directory to its own output root,
      // which created a phantom root at `functions/node_modules`. Walking that
      // root made `path.relative(root, …)` drop the `node_modules` segment, so
      // the publishability filter could no longer see it and a clean artifact
      // failed with a false E_WAREHOUSE_CONTAMINATION. One root, walked once.
      if (exists(functionsDir)) {
        outputs.push({
          kind: "firebase-functions",
          site: entry.name,
          codebase: entry.name,
          dir: functionsDir,
          selected: true,
          delivered: true,
        });
      }
    }
  }
  return outputs;
}

/** Newest mtime among shipped source files (src/**, next.config.ts, package.json). */
function newestSourceMtime(root) {
  let newest = 0;
  const consider = (file) => {
    try {
      const stat = fs.statSync(file);
      if (stat.mtimeMs > newest) newest = stat.mtimeMs;
    } catch {
      /* ignore */
    }
  };
  for (const rel of ["next.config.ts", "next.config.js", "package.json", "tsconfig.json"]) {
    consider(path.join(root, rel));
  }
  const srcDir = path.join(root, "src");
  if (exists(srcDir)) walk(srcDir, (entry) => (!entry.isDir ? consider(entry.path) : undefined));
  return newest;
}

/**
 * Visit the text of every file in a delivered tree, one file at a time.
 *
 * Deliberately unbounded and unfiltered by extension: no per-file size cap, no
 * total budget, no name-based skipping. Each of those was a place an identity
 * could hide, and a guard that skips a file cannot claim to have inspected it.
 *
 * Files are handed to `onText` individually rather than concatenated: joining a
 * large tree into one string can exceed V8's string limit and throw, which
 * would turn a legitimate build (one that happens to carry dev-cache files)
 * into a failure. Inspection is per file; nothing is ever accumulated whole.
 *
 * There is NO binary skip and NO extension filter: every file is decoded as
 * UTF-8 and inspected, and additionally as UTF-16LE when it contains NULs. A
 * `.png` that actually contains JavaScript is still read, because the identity
 * does not care what the file is called.
 */
function forEachTextFile(dir, onText) {
  walk(dir, (entry) => {
    if (entry.isDir) return;
    let buffer;
    try {
      buffer = fs.readFileSync(entry.path);
    } catch (error) {
      throw new BundleGuardFailure(
        "E_UNINSPECTABLE_FILE",
        `Cannot read "${entry.path}"; refusing to treat an unreadable file as absent.`,
        { path: entry.path, reason: error && error.code },
      );
    }

    // Every file is decoded as UTF-8 and inspected. There is no binary skip:
    // a single NUL prefix, or a UTF-16LE payload full of NULs, would otherwise
    // hide a staging identity from the walker. The per-file accumulator never
    // joins files, so decoding even a large asset costs memory one file at a
    // time and cannot overflow.
    //
    // UTF-16LE text decodes as NUL-interleaved UTF-8, so it is additionally
    // decoded natively when NULs are present; both views are offered.
    onText(buffer.toString("utf8"), entry.path);
    if (buffer.includes(0)) {
      const utf16 = buffer.toString("utf16le");
      if (utf16.indexOf("\u0000") === -1) onText(utf16, `${entry.path}#utf16le`);
    }
  });
}

function routeListFromManifest(dir) {
  // Next writes app-paths-manifest.json under server/; older layouts and
  // copied SSR trees have also carried it one level down. Read every location
  // that exists rather than assuming one.
  const candidates = [
    path.join(dir, "server", "app-paths-manifest.json"),
    path.join(dir, "server", "app", "app-paths-manifest.json"),
    path.join(dir, "app-paths-manifest.json"),
  ];
  const routes = [];
  for (const candidate of candidates) {
    const parsed = readJson(candidate);
    if (parsed) routes.push(...Object.keys(parsed));
  }
  return routes;
}

/**
 * Pre-existing base routes that are NOT F60 Warehouse. These exist in S1
 * (commit a394b24) and must never trigger E_WAREHOUSE_CONTAMINATION.
 * Only paths matching WAREHOUSE_ROUTE_PATTERNS (warehouse/, batches/, custody/)
 * count as F60 contamination.
 */
const BASE_ROUTE_ALLOWLIST = new Set([
  "/inventory",
  "/reports/inventory",
  "/humans/movements",
]);

function detectWarehouseRoutes(root, outputs) {
  const hits = [];

  // 1. Source-tree: only src/features/warehouse is definitive F60 presence.
  const warehouseSrc = path.join(root, "src", "features", "warehouse");
  if (exists(warehouseSrc)) hits.push({ where: "src/features/warehouse", kind: "source" });

  // 2. Source app routes — only match WAREHOUSE_ROUTE_PATTERNS (no inventory/movements).
  const warehouseApp = path.join(root, "src", "app");
  if (exists(warehouseApp)) {
    walk(warehouseApp, (entry) => {
      if (entry.isDir && entry.name.toLowerCase() === "warehouse") {
        hits.push({ where: path.relative(root, entry.path), kind: "source-route-dir" });
      }
      // Test the path RELATIVE to the candidate. Testing the absolute path
      // makes any checkout whose own location contains "warehouse", "batches"
      // or "custody" fail on a perfectly clean tree.
      if (!entry.isDir && WAREHOUSE_ROUTE_PATTERNS.some((re) => re.test(path.relative(root, entry.path)))) {
        hits.push({ where: path.relative(root, entry.path), kind: "source-route" });
      }
    });
  }

  // 3. Delivered trees: route manifests AND the tree itself.
  //
  // These are independent checks and must not share an early exit. A hosting
  // tree (`.firebase/<site>/hosting`) carries `_next/`, `public/` assets and
  // prerendered HTML but NO nested `.next`, so gating the walk on the manifest
  // directory would leave every hosting artifact unwalked — exactly the surface
  // where a Warehouse static asset would land.
  for (const output of outputs) {
    const manifestDir = output.kind === "next" ? output.dir : path.join(output.dir, ".next");
    if (exists(manifestDir)) {
      for (const route of routeListFromManifest(manifestDir)) {
        if (BASE_ROUTE_ALLOWLIST.has(route)) continue;
        if (WAREHOUSE_ROUTE_PATTERNS.some((re) => re.test(route))) {
          hits.push({ where: `${path.relative(root, manifestDir)}${route}`, kind: "manifest-route" });
        }
      }
    }

    walk(output.dir, (entry) => {
      if (entry.isDir) return;
      const rel = path.relative(root, entry.path);
      // Judge exclusion on the path INSIDE the delivered tree: the tree root
      // itself sits under `.firebase/`, which is a dot-directory but is exactly
      // what gets uploaded.
      const insideTree = path.relative(output.dir, entry.path);
      // Whether this path can ship depends on the SURFACE, not on a blanket
      // dot-file rule: Hosting excludes dot-directories, Functions does not. Judging it
      // per surface removes the `node_modules`/dot-dir false positive without
      // blinding the guard to a Warehouse page that really is uploaded.
      if (isUnpublishedPath(insideTree, surfaceFor(output))) return;
      if (WAREHOUSE_ROUTE_PATTERNS.some((re) => re.test(rel))) {
        hits.push({ where: rel, kind: "artifact-entrypoint" });
      }
    });
  }

  return hits;
}

/** Which canonical identity field each env key carries. */
const IDENTITY_LITERAL_FIELDS = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "apiKey",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "authDomain",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "projectId",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "storageBucket",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "messagingSenderId",
  NEXT_PUBLIC_FIREBASE_APP_ID: "appId",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "measurementId",
};

/**
 * Every inlined `NEXT_PUBLIC_FIREBASE_<FIELD>` literal, decoded and compared
 * against the canonical PRODUCTION tuple.
 *
 * This is layer (b) of the identity proof. It is deliberately blind to object
 * shape: a staging apiKey is a defect whether it sits inside a selection
 * object, a bare assignment, a bracket access, a JSON key, a source map's
 * `sourcesContent`, or a `.png` that is really JavaScript. Layer (a) can only
 * see well-formed selection objects, and layer (c) only sees field-name
 * tuples — each alone leaves a shape uncovered.
 *
 * SOUNDNESS: a production build inlines only production values, so the rule
 * cannot fire on a legitimate artifact. Measured on this machine: 2844 keyed
 * identity literals across 24 real build trees, 0 violations in any build that
 * selects production. A staging build trips it on every field, which is the
 * intended failure.
 */
function scanKeyedIdentityLiterals(text) {
  const expectedTuple = CANONICAL_IDENTITY.production;
  const violations = [];
  let pairs = 0;
  const Q = String.raw`\\*["'\`]`;
  const VALUE = String.raw`((?:[^"'\`\\]|\\.)*)`;
  for (const envKey of Object.keys(IDENTITY_LITERAL_FIELDS)) {
    const field = IDENTITY_LITERAL_FIELDS[envKey];
    const expected = expectedTuple[field];
    // Bare key, quoted key, bracket form (`["KEY"]="v"`), optional block comment
    // between name and separator, and any quote style — minifiers emit all of
    // them, so all of them are the same literal.
    const re = new RegExp(
      `"?${escapeRegExp(envKey)}"?\\s*\\]?\\s*(?:\\/\\*[\\s\\S]*?\\*\\/\\s*)*[:=]\\s*${Q}${VALUE}${Q}`,
      "g",
    );
    let match;
    while ((match = re.exec(text)) !== null) {
      pairs += 1;
      if (expected === undefined) continue;
      const raw = match[1];
      if (raw === expected) continue;
      if (decodeJsEscapes(raw) === expected) continue;
      violations.push({ field });
    }
  }
  return { pairs, violations };
}

/**
 * Every inlined `NEXT_PUBLIC_APP_ENV:"staging"` literal.
 *
 * The selection-object layer only sees well-formed objects (selector plus at
 * least MIN_SELECTION_KEYS identity keys), so a staging selector travelling on
 * its own — `NEXT_PUBLIC_APP_ENV:"staging"` with nothing else — was invisible to
 * it. That is still an active staging selection written into the artifact.
 *
 * WHY ONLY `staging`, AND NOT "anything that is not production": compiled code
 * carries UNRESOLVED TEMPLATE PLACEHOLDERS inside its own error messages, e.g.
 *
 *     `NEXT_PUBLIC_APP_ENV="${r}" requires project "${i.projectId}"`
 *     'Invalid NEXT_PUBLIC_APP_ENV: expected "staging" or "production".'
 *
 * A "value !== production" rule flags those and condemns a legitimate
 * production build — measured on `k9-ops-f30-web-pilot-batch01-r1`, which has
 * three such placeholders and zero real staging selections. `config.ts` admits
 * exactly two selector values, so any other string is message text rather than
 * a selection; the runtime resolver rejects it independently.
 *
 * SOUNDNESS: a build that selects production never inlines the staging
 * selector. Measured across 24 real build trees: 0 production builds carry it.
 */
function scanStagingSelectorLiterals(text) {
  const re = /"?NEXT_PUBLIC_APP_ENV"?(?:\s*\])?\s*(?:\/\*[\s\S]*?\*\/\s*)*[:=]\s*\\*["'`]\s*([^"'`\\]*)\s*\\*["'`]/g;
  const found = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    const value = decodeJsEscapes(match[1]).trim();
    // An unresolved placeholder (`${…}`) is template text, not a value.
    if (value === "staging") found.push(value);
  }
  return found;
}

const STAGING_PROJECT_LITERAL = STAGING_PROJECT_ID;

function isSpaceCode(code) {
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 12;
}

function isMemberNameCode(code) {
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 95 || // _
    code === 36 || // $
    code === 34 || // "
    code === 39 || // '
    code === 96 // `
  );
}

/** Index of the `{` that opens the object containing `idx`, or -1. */
function braceOpenBefore(text, idx) {
  let depth = 0;
  const floor = Math.max(0, idx - 400000);
  for (let i = idx; i >= floor; i -= 1) {
    const code = text.charCodeAt(i);
    if (code === 125) depth += 1;
    else if (code === 123) {
      if (depth === 0) return i;
      depth -= 1;
    }
  }
  return -1;
}

/** Index of the `}` that closes the object opened at `openIdx`, or -1. */
function braceCloseAfter(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code === 123) depth += 1;
    else if (code === 125) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** The member name immediately preceding an object literal, or null. */
function memberNameBefore(text, openIdx) {
  let i = openIdx - 1;
  while (i >= 0 && isSpaceCode(text.charCodeAt(i))) i -= 1;
  if (text.charCodeAt(i) !== 58) return null; // ':'
  i -= 1;
  while (i >= 0 && isSpaceCode(text.charCodeAt(i))) i -= 1;
  const end = i + 1;
  while (i >= 0 && isMemberNameCode(text.charCodeAt(i))) i -= 1;
  return text.slice(i + 1, end).replace(/["'`]/g, "");
}

/**
 * Classify every FIELD-NAME staging tuple as canonical or injected.
 *
 * Layer (c) of the identity proof. `src/lib/firebase/config.ts` compiles to
 *
 *     {staging:{projectId:"k9-ops-staging",…},production:{projectId:"canil-gcm",…}}
 *
 * in EVERY build, so the string alone is worthless as a signal. What separates
 * the inactive branch from a smuggled identity is its POSITION: a staging tuple
 * is canonical only when its object is the value of a member literally named
 * `staging` whose PARENT object also has a `production` member.
 *
 * Anything else — a top-level literal, an `initializeApp({…})` argument, a
 * stray object in another chunk — is an injected identity and fails closed.
 * When the enclosing structure cannot be resolved, the tuple is counted as
 * injected: an unprovable position is not a proven-inactive one.
 */
function classifyStagingTuples(text) {
  const result = { hits: 0, canonical: 0, injected: 0 };
  let i = -1;
  while ((i = text.indexOf(STAGING_PROJECT_LITERAL, i + 1)) !== -1) {
    // Only the projectId VALUE counts; `authDomain`/`storageBucket` also carry
    // the literal and must not be classified as tuples.
    const back = text.slice(Math.max(0, i - 80), i);
    if (!/projectId\s*["'`]?\s*:\s*\\*["'`]\s*$/.test(back)) continue;
    result.hits += 1;

    const innerOpen = braceOpenBefore(text, i);
    if (innerOpen === -1 || memberNameBefore(text, innerOpen) !== "staging") {
      result.injected += 1;
      continue;
    }
    const parentOpen = braceOpenBefore(text, innerOpen - 1);
    const parentClose = parentOpen === -1 ? -1 : braceCloseAfter(text, parentOpen);
    if (parentOpen === -1 || parentClose === -1) {
      result.injected += 1;
      continue;
    }
    const parent = text.slice(parentOpen, parentClose + 1);
    if (/[{,]\s*production\s*:\s*\{/.test(parent)) result.canonical += 1;
    else result.injected += 1;
  }
  return result;
}

/** Which publishability rule applies to an output. */
function surfaceFor(output) {
  if (output.kind === "firebase-functions") return "functions";
  if (output.kind === "firebase-hosting") return "hosting";
  return "next";
}

/**
 * Extract every ENV-SELECTION OBJECT from compiled text.
 *
 * This is the load-bearing proof of ACTIVE identity, and it replaces the old
 * "does the substring NEXT_PUBLIC_APP_ENV:"staging" appear anywhere" test,
 * which could not tell a selection from an inlined literal and masked
 * conflicts by letting production win by precedence.
 *
 * In a real Next build the resolver is invoked with the whole env bundle as an
 * object literal — verified on `k9-ops-f30-web-pilot-batch01-r1`:
 *
 *   ...l}({NEXT_PUBLIC_APP_ENV:"production",NEXT_PUBLIC_FIREBASE_API_KEY:"…",
 *          …,NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:"G-…"}),S=(0,r.getApps)()…
 *
 * That object IS the selection the client resolves from. It is structurally
 * distinguishable from the canonical `EXPECTED_FIREBASE_IDENTITY` block in
 * `config.ts`, whose fields are bare (`projectId:"…"`, `apiKey:"…"`) and carry
 * no `NEXT_PUBLIC_` prefix.
 *
 * KNOWN LIMIT OF THIS LAYER: requiring the selector plus MIN_SELECTION_KEYS
 * `NEXT_PUBLIC_FIREBASE_*` keys keeps the canonical block from being mistaken
 * for a selection, but it also means a PARTIAL staging object is not a
 * selection object. That is not a hole, because this layer is not the only
 * one: `scanKeyedIdentityLiterals` compares every inlined identity value
 * against the production tuple whatever object it sits in, and
 * `scanStagingSelectorLiterals` condemns a non-production selector literal even
 * when it travels alone. Each layer covers the others' blind spots;
 * `resolveSelection` is only asked to judge well-formed selections.
 */
const ENV_OBJECT_FIELDS = [
  "NEXT_PUBLIC_APP_ENV",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
];

/** Minimum NEXT_PUBLIC_FIREBASE_* keys for an object to count as a selection. */
const MIN_SELECTION_KEYS = 3;

/**
 * Find env-selection objects in one chunk of text.
 *
 * Flat object literals only (`[^{}]*`): the resolver is called with a flat
 * bundle, and nested scanning would risk matching unrelated structures.
 */
function extractEnvSelectionObjects(text) {
  const found = [];
  // A key may be bare (`KEY:`), double-quoted (`"KEY":`) or single-quoted
  // ('KEY':), and the value may use any quote style. All three are the same
  // selection, so all three must be read — otherwise reformatting the same
  // artifact would hide it from the proof.
  const KEY = `["'\`]?NEXT_PUBLIC_APP_ENV["'\`]?`;
  // Inside a JSON string (a source map's `sourcesContent`) every quote is
  // backslash-escaped, so quotes may carry preceding backslashes on both sides.
  const Q = String.raw`\\*["'\`]`;
  const re = new RegExp(`\\{[^{}]*${KEY}\\s*:\\s*${Q}[^"'\`]*${Q}[^{}]*\\}`, "g");
  let match;
  while ((match = re.exec(text)) !== null) {
    const body = match[0];
    const fields = Object.create(null);
    for (const key of ENV_OBJECT_FIELDS) {
      const value = new RegExp(
        `${Q}?${escapeRegExp(key)}${Q}?\\s*:\\s*${Q}([^"'\`]*)${Q}`,
      ).exec(body);
      if (value) fields[key] = decodeJsEscapes(value[1]);
    }
    const explicit = Object.keys(fields).filter((key) => key.startsWith("NEXT_PUBLIC_FIREBASE_")).length;
    if (fields.NEXT_PUBLIC_APP_ENV !== undefined && explicit >= MIN_SELECTION_KEYS) {
      found.push(fields);
    }
  }
  return found;
}

/** Stable identity of one selection object, for equality comparison. */
function selectionFingerprint(fields) {
  return ENV_OBJECT_FIELDS.map((key) => `${key}=${fields[key] === undefined ? "\u0000" : fields[key]}`).join(
    "\u0001",
  );
}

/**
 * Validate the ONE selection the artifact resolves from.
 *
 * Fails closed at every ambiguity, and never resolves a conflict by preferring
 * one value: two different selections in one artifact are a defect regardless
 * of which one looks better.
 */
function resolveSelection(selections) {
  if (selections.length === 0) {
    return { verdict: "absent", reason: "no env-selection object was found" };
  }
  const distinct = new Map();
  for (const fields of selections) {
    const fingerprint = selectionFingerprint(fields);
    if (!distinct.has(fingerprint)) distinct.set(fingerprint, fields);
  }
  if (distinct.size > 1) {
    return {
      verdict: "conflict",
      distinctSelections: distinct.size,
      selectors: [...distinct.values()].map((fields) => fields.NEXT_PUBLIC_APP_ENV),
    };
  }
  const fields = [...distinct.values()][0];
  if (fields.NEXT_PUBLIC_APP_ENV !== "production") {
    return { verdict: "staging", selector: fields.NEXT_PUBLIC_APP_ENV, fields };
  }
  const expected = CANONICAL_IDENTITY.production;
  const mismatched = [];
  if (fields.NEXT_PUBLIC_FIREBASE_API_KEY !== expected.apiKey) mismatched.push("apiKey");
  if (fields.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== expected.authDomain) mismatched.push("authDomain");
  if (fields.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== expected.projectId) mismatched.push("projectId");
  if (fields.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET !== expected.storageBucket) mismatched.push("storageBucket");
  if (fields.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID !== expected.messagingSenderId) {
    mismatched.push("messagingSenderId");
  }
  if (fields.NEXT_PUBLIC_FIREBASE_APP_ID !== expected.appId) mismatched.push("appId");
  const measurementId = fields.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
  if (measurementId !== undefined && measurementId !== "" && measurementId !== expected.measurementId) {
    mismatched.push("measurementId");
  }
  if (mismatched.length > 0) {
    return { verdict: "hybrid", mismatched, fields };
  }
  return { verdict: "production", fields };
}

/**
 * Test whether a path inside a delivered tree can never reach a user.
 *
 * The answer is SURFACE-SPECIFIC, and collapsing the two surfaces is what made
 * the R3 guard both unsafe and noisy:
 *
 *   - HOSTING is uploaded through `listFiles(publicDir, config.ignore)` with
 *     this repo's `ignore` = [firebase.json, a dot-path glob, a node_modules glob].
 *     Dot-directories are therefore NOT published, so `batches/` under `.cache/`
 *     is not a Warehouse route.
 *   - FUNCTIONS source is uploaded with `ignore = ["node_modules", ".git"]`
 *     (firebase-tools prepareFunctionsUpload). Dot-directories ARE published
 *     there — a `warehouse/` page materialised at `functions/.next/server/app/`
 *     ships, so it must still be caught.
 *   - A compiled `.next` is inspected in full; only VCS metadata is noise.
 *
 * `node_modules` is unpublished on every surface.
 */
function isUnpublishedPath(relativePath, surface) {
  const segments = relativePath.split(/[\\/]/);
  if (segments.some((segment) => segment === "node_modules")) return true;
  // Stage A probe (probe-listfiles-a1.js): the pinned CLI matcher publishes
  // dot-dir descendants and .git/config on Hosting, so only node_modules and
  // (on Functions) .git are truly unpublished.
  if (surface === "hosting") return false;
  return segments.some((segment) => segment === ".git");
}

/** Decode the JavaScript escape sequences a minifier may leave in a string. */
function decodeJsEscapes(value) {
  return String(value)
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\(["'`\\])/g, "$1");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/**
 * R4 build-identity decision (equivalent to the contract reference oracle,
 * implemented locally over measured filesystem facts; the reference oracle is
 * a quality standard and is never copied into scripts/).
 *
 * Hosting id: the single genuine marker dir at <hosting>/_next/static.
 * Functions id: BUILD_ID file must equal the single genuine marker dir at
 * <functionsRoot>/.next/static. basePath from both rooted manifests must
 * agree. Required-surface absence NEVER yields a silent skip: every anchor on
 * a required surface must prove an id or fail closed.
 */
function r4DecideBuildIdentity(root, hostingDir, functionsDir) {
  const trace = [];

  const hostingAnchor = r4ScanAnchor(path.join(hostingDir, "_next", "static"));
  const hostingEval = r4EvaluateAnchor(hostingAnchor, "hosting");
  if (!hostingEval.ok) {
    trace.push({ stage: "hosting-anchor", ...hostingEval });
    return { ok: false, code: hostingEval.code, reason: hostingEval.reason, trace };
  }
  const hostingId = hostingEval.id;

  const buildIdPath = path.join(functionsDir, ".next", "BUILD_ID");
  let buildIdValue;
  if (!fs.existsSync(buildIdPath)) {
    const reason = "<functions>/.next/BUILD_ID is missing";
    trace.push({ stage: "functions-buildid", code: "E_BUILD_ID_UNPROVABLE", reason });
    return { ok: false, code: "E_BUILD_ID_UNPROVABLE", reason, trace };
  }
  let rawBuildId;
  try {
    rawBuildId = fs.readFileSync(buildIdPath, "utf8");
  } catch {
    const reason = "<functions>/.next/BUILD_ID is unreadable";
    trace.push({ stage: "functions-buildid", code: "E_BUILD_ID_UNPROVABLE", reason });
    return { ok: false, code: "E_BUILD_ID_UNPROVABLE", reason, trace };
  }
  if (rawBuildId.trim().length === 0) {
    const reason = "<functions>/.next/BUILD_ID is empty";
    trace.push({ stage: "functions-buildid", code: "E_BUILD_ID_UNPROVABLE", reason });
    return { ok: false, code: "E_BUILD_ID_UNPROVABLE", reason, trace };
  }
  const f01BuildId = f01ValidateId(rawBuildId.trim(), "functions BUILD_ID");
  if (!f01BuildId.ok) {
    trace.push({ stage: "functions-buildid", code: "E_INPUT_MODEL_INVALID", reason: f01BuildId.reason });
    return { ok: false, code: "E_INPUT_MODEL_INVALID", reason: f01BuildId.reason, trace };
  }
  buildIdValue = f01BuildId.value;

  const functionsAnchor = r4ScanAnchor(path.join(functionsDir, ".next", "static"));
  const functionsEval = r4EvaluateAnchor(functionsAnchor, "functions");
  if (!functionsEval.ok) {
    trace.push({ stage: "functions-anchor", ...functionsEval });
    return { ok: false, code: functionsEval.code, reason: functionsEval.reason, trace };
  }

  const bp = r4ResolveBasePath(functionsDir);
  if (!bp.ok) {
    trace.push({ stage: "basePath", code: bp.code, reason: bp.reason });
    return { ok: false, code: bp.code, reason: bp.reason, trace };
  }

  if (buildIdValue !== functionsEval.id) {
    const reason = "intra-Functions conflict: BUILD_ID=" + buildIdValue + " but static id=" + functionsEval.id;
    trace.push({ stage: "intra-functions", code: "E_BUILD_ID_CONFLICT", reason });
    return { ok: false, code: "E_BUILD_ID_CONFLICT", reason, trace };
  }
  if (hostingId !== buildIdValue) {
    const reason = "cross-surface conflict: hosting id=" + hostingId + " but Functions BUILD_ID=" + buildIdValue;
    trace.push({ stage: "cross-surface", code: "E_BUILD_ID_CONFLICT", reason });
    return { ok: false, code: "E_BUILD_ID_CONFLICT", reason, trace };
  }

  return {
    ok: true,
    buildId: buildIdValue,
    basePath: bp.value,
    basePathSources: bp.sources,
    surfaces: {
      hosting: { state: "SINGLE", buildId: hostingId },
      functions: { state: "SINGLE", buildId: buildIdValue, staticId: functionsEval.id },
    },
    trace,
  };
}

function runBundleGuard(options) {
  const opts = options || {};
  const root = path.resolve(opts.root || process.cwd());
  const stage = opts.stage || "post-build";

  const discovered = discoverOutputs(root);
  // POST-BUILD judges the build `npm run build` just produced. PRE-PUBLISH
  // judges what the CLI would UPLOAD: `.firebase/<site>/hosting` and
  // `.firebase/<site>/functions`. The project-root `.next` is an input to the
  // frameworks pipeline, never a published artifact, so counting it as a
  // competing deliverable would invent a conflict that does not ship.
  const outputs =
    stage === "post-build"
      ? discovered.filter((output) => output.kind === "next")
      : discovered.filter((output) => output.delivered);

  if (outputs.length === 0) {
    throw new BundleGuardFailure(
      "E_OUTPUT_ABSENT",
      `No ${stage === "post-build" ? "compiled Next.js output" : "Firebase upload tree"} was found. ` +
        "Refusing to assume a missing artifact is a valid one.",
      { stage },
    );
  }
  if (stage === "pre-publish" && !outputs.some((output) => output.selected)) {
    throw new BundleGuardFailure(
      "E_OUTPUT_ABSENT",
      "No Firebase upload tree exists, so there is no artifact to publish-check. " +
        "A stale .next alone is not a releasable artifact.",
      { stage, outputs: outputs.map((output) => output.kind) },
    );
  }

  // ---- one candidate: build ids must agree across surfaces of the same site.
  const buildIds = new Set();
  const perOutput = [];
  for (const output of outputs) {
    let buildId;
    if (output.kind === "next") buildId = readBuildId(output.dir);
    else if (output.kind === "firebase-hosting") buildId = readHostingBuildId(output.dir);
    else buildId = readBuildId(output.dir) || readBuildId(path.join(output.dir, ".next"));
    if (buildId) buildIds.add(buildId);
    perOutput.push({
      kind: output.kind,
      site: output.site,
      buildId: buildId || null,
      surface: surfaceFor(output),
    });
  }

  // Two delivered trees with different build ids cannot both be the artifact
  // under release. A hosting tree left over from an earlier build is exactly
  // this shape, and it ships whatever it happens to contain.
  if (buildIds.size > 1) {
    throw new BundleGuardFailure(
      "E_BUILD_ID_CONFLICT",
      `Conflicting build ids across the delivered artifact (${[...buildIds].join(", ")}). ` +
        "These surfaces are supposed to represent the same build; refusing to release an " +
        "artifact whose parts disagree.",
      { outputs: perOutput },
    );
  }
  if (buildIds.size === 0) {
    throw new BundleGuardFailure(
      "E_BUILD_ID_UNPROVABLE",
      "No BUILD_ID could be read from any delivered surface; cannot pin the artifact being released.",
      { outputs: perOutput },
    );
  }

  // ---- not stale: a tree older than the sources it claims to ship is refused.
  const sourceMtime = newestSourceMtime(root);
  for (const output of outputs) {
    let mtime = 0;
    try {
      mtime = fs.statSync(output.dir).mtimeMs;
    } catch {
      /* handled by the absence check above */
    }
    // A 2s tolerance absorbs filesystem timestamp granularity on Windows.
    if (sourceMtime > 0 && mtime > 0 && sourceMtime - mtime > 2000) {
      throw new BundleGuardFailure(
        "E_STALE_BUNDLE",
        `Output "${path.relative(root, output.dir)}" predates the newest source file it would ship. ` +
          "Rebuild before publishing.",
        { output: path.relative(root, output.dir) },
      );
    }
  }

  // ---- H0: real link inspection + upload-root containment (pre-publish only).
  if (stage === "pre-publish") {
    const h0Findings = [];
    for (const output of outputs) {
      const surface = surfaceFor(output);
      if (surface !== "hosting" && surface !== "functions") continue;
      const canonicalRoot = assertUploadRootContained(output.dir, surface);
      const findings = auditUploadTreeLinks(output.dir, surface);
      for (const finding of findings) {
        h0Findings.push({ surface, root: output.dir, ...finding });
      }
    }
    if (h0Findings.length > 0) {
      throw new BundleGuardFailure(
        "E_LINK_UNPROVABLE",
        "The upload tree contains a link the guard cannot prove is contained, or a " +
          "link whose resolved target escapes the upload root. Refusing to publish a " +
          "tree whose shipped content depends on where a link resolves.",
        { findings: h0Findings.slice(0, 10) },
      );
    }
  }

  // ---- no F60 Warehouse footprint in anything that ships.
  const warehouseHits = detectWarehouseRoutes(root, outputs);
  if (warehouseHits.length > 0) {
    throw new BundleGuardFailure(
      "E_WAREHOUSE_CONTAMINATION",
      "F60 Warehouse footprint detected in the candidate or its artifact. " +
        "Warehouse is out of scope for this gate.",
      { hits: warehouseHits.slice(0, 10) },
    );
  }

  // ---- identity: three independent layers, every one fail-closed.
  const selectionObjects = [];
  const keyedViolations = new Set();
  const stagingSelectorLiterals = [];
  const injectedFieldNameTuples = [];
  const markerEvidence = { production: new Set(), staging: new Set() };
  const perOutputSelections = [];
  let keyedPairs = 0;
  let stagingFieldNameHits = 0;
  let canonicalFieldNameTuples = 0;

  for (const output of outputs) {
    let countForOutput = 0;
    forEachTextFile(output.dir, (text, file) => {
      // (a) the env-selection object the resolver consumes
      for (const fields of extractEnvSelectionObjects(text)) {
        selectionObjects.push(fields);
        countForOutput += 1;
      }

      // (b) every inlined NEXT_PUBLIC_FIREBASE_* value, whatever its shape
      const keyed = scanKeyedIdentityLiterals(text);
      keyedPairs += keyed.pairs;
      for (const violation of keyed.violations) keyedViolations.add(violation.field);

      // (b2) a non-production selector literal, even without companions
      for (const selectorValue of scanStagingSelectorLiterals(text)) {
        stagingSelectorLiterals.push(selectorValue);
      }

      // (c) field-name staging tuples outside the canonical record
      const structural = classifyStagingTuples(text);
      stagingFieldNameHits += structural.hits;
      canonicalFieldNameTuples += structural.canonical;
      if (structural.injected > 0) {
        injectedFieldNameTuples.push(
          `${path.relative(root, file)} (${structural.injected} injected tuple(s))`,
        );
      }

      // Forensic markers only; never a pass/fail criterion on their own.
      for (const [field, marker] of Object.entries(PRODUCTION_MARKERS)) {
        if (text.includes(marker)) markerEvidence.production.add(field);
      }
      for (const [field, marker] of Object.entries(STAGING_MARKERS)) {
        if (text.includes(marker)) markerEvidence.staging.add(field);
      }
    });
    perOutputSelections.push({ kind: output.kind, site: output.site, selections: countForOutput });
  }

  const resolved = resolveSelection(selectionObjects);
  const selection = {
    verdict: resolved.verdict,
    selectionObjects: selectionObjects.length,
    distinctSelections:
      resolved.distinctSelections === undefined
        ? selectionObjects.length === 0
          ? 0
          : 1
        : resolved.distinctSelections,
    perOutput: perOutputSelections,
    keyedIdentityLiterals: keyedPairs,
    keyedViolations: [...keyedViolations],
    stagingSelectorLiterals: stagingSelectorLiterals.length,
    stagingFieldNameTuples: stagingFieldNameHits,
    canonicalFieldNameTuples,
    injectedFieldNameTuples: [...new Set(injectedFieldNameTuples)].slice(0, 10),
    productionMarkers: [...markerEvidence.production],
    stagingMarkers: [...markerEvidence.staging],
  };

  // Layer (a): the ONE selection the artifact resolves from. A conflict is a
  // defect even when one side is production — the artifact would resolve
  // differently depending on which chunk executes — and is never resolved by
  // letting production win.
  if (resolved.verdict === "conflict") {
    throw new BundleGuardFailure(
      "E_IDENTITY_CONFLICT",
      `The artifact contains ${resolved.distinctSelections} different env selections ` +
        `(selectors: ${resolved.selectors.map((value) => JSON.stringify(value)).join(", ")}). ` +
        "Refusing to release an artifact whose identity depends on which chunk executes.",
      { selection },
    );
  }
  if (resolved.verdict === "staging") {
    throw new BundleGuardFailure(
      "E_STAGING_SELECTION_INLINED",
      `The artifact's env selection is ${JSON.stringify(resolved.selector)} — the build selected ` +
        "staging. A production build must select production/canil-gcm.",
      { selection },
    );
  }
  if (resolved.verdict === "hybrid") {
    throw new BundleGuardFailure(
      "E_IDENTITY_MISMATCH",
      `The artifact's env selection names production but these fields do not belong to it: ` +
        `${resolved.mismatched.join(", ")}. Refusing to release a hybrid identity.`,
      { selection },
    );
  }

  // Layer (b): a staging credential anywhere, in any shape.
  if (keyedViolations.size > 0) {
    throw new BundleGuardFailure(
      "E_IDENTITY_MISMATCH",
      `The artifact inlines non-production values for: ${[...keyedViolations].join(", ")}. ` +
        "A production build may only ever carry the production/canil-gcm tuple.",
      { selection },
    );
  }

  // Layer (b2): a staging SELECTOR literal, even with no companions. Sits after
  // resolveSelection so a build that selected staging everywhere still reports
  // the more precise E_STAGING_SELECTION_INLINED.
  if (stagingSelectorLiterals.length > 0) {
    throw new BundleGuardFailure(
      "E_IDENTITY_MISMATCH",
      `The artifact inlines NEXT_PUBLIC_APP_ENV:"staging"` +
        `${stagingSelectorLiterals.length > 1 ? ` (${stagingSelectorLiterals.length} occurrences)` : ""}. ` +
        "The build selected staging; a production build must inline production/canil-gcm.",
      { selection },
    );
  }

  // Layer (c): a staging tuple that is not the inactive canonical branch.
  if (injectedFieldNameTuples.length > 0) {
    throw new BundleGuardFailure(
      "E_IDENTITY_INJECTED_FIELDNAME",
      "A complete staging identity in field-name form exists OUTSIDE the canonical " +
        "{staging,production} record. That is a second, active identity rather than the " +
        "inactive branch every build legitimately carries.",
      { selection, files: selection.injectedFieldNameTuples },
    );
  }

  // Nothing proven at all: refuse rather than infer from stray literals.
  if (resolved.verdict === "absent") {
    throw new BundleGuardFailure(
      "E_IDENTITY_NOT_PROVEN",
      "No env-selection object was found in the artifact and no identity literal " +
        "contradicted production, so the guard cannot prove which Firebase identity the " +
        "build selected. It refuses to call the artifact safe.",
      { selection },
    );
  }

  // ---- F-01 / R4 build-identity reconciliation (pre-publish only).
  if (stage === "pre-publish") {
    const hostingOutput = outputs.find((output) => surfaceFor(output) === "hosting");
    const functionsOutput = outputs.find((output) => surfaceFor(output) === "functions");
    if (!hostingOutput || !functionsOutput) {
      throw new BundleGuardFailure(
        "E_SURFACE_REQUIREMENT_UNPROVABLE",
        "Pre-publish requires BOTH delivered surfaces to reconcile build identity. " +
          "A missing Hosting or Functions upload root cannot be treated as absent-silent.",
        { hostingPresent: Boolean(hostingOutput), functionsPresent: Boolean(functionsOutput) },
      );
    }
    const identity = r4DecideBuildIdentity(root, hostingOutput.dir, functionsOutput.dir);
    if (!identity.ok) {
      throw new BundleGuardFailure(identity.code, identity.reason, { trace: identity.trace });
    }
  }

  return {
    result: "PASS",
    stage,
    buildIds: [...buildIds],
    outputs: perOutput,
    warehouseHits: 0,
    identitySelection: selection,
    identityProofScope: stage === "post-build" ? "compiled-next-output" : "firebase-upload-tree",
  };
}

module.exports = {
  BundleGuardFailure,
  PRODUCTION_MARKERS,
  PRODUCTION_PROJECT_ID,
  STAGING_MARKERS,
  STAGING_PROJECT_ID,
  classifyStagingTuples,
  detectWarehouseRoutes,
  discoverOutputs,
  extractEnvSelectionObjects,
  forEachTextFile,
  isUnpublishedPath,
  readBuildId,
  readHostingBuildId,
  resolveSelection,
  runBundleGuard,
  scanKeyedIdentityLiterals,
  scanStagingSelectorLiterals,
  sha256File,
  R4_MARKERS,
  f01ValidateId,
  r4DecideBuildIdentity,
  r4EvaluateAnchor,
  r4NormalizeBasePath,
  r4ScanAnchor,
  r4ResolveBasePath,
  classifyLink,
  isPathContained,
  canonicalContainmentPath,
  auditUploadTreeLinks,
};

/** Minimal CLI: exit 0 only on a proven artifact. */
function main(argv) {
  const args = argv.slice(2);
  const get = (flag, fallback) => {
    const index = args.indexOf(flag);
    return index === -1 ? fallback : args[index + 1];
  };
  const root = path.resolve(get("--root", process.cwd()));
  const stage = get("--stage", "post-build");
  const asJson = args.includes("--json");

  try {
    const report = runBundleGuard({ root, stage });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      console.log(`CT4 WEB-P0 bundle guard [${stage}]: PASS`);
      console.log(`  build id: ${report.buildIds.length === 0 ? "(not carried by this tree)" : report.buildIds.join(", ")}`);
      console.log(`  outputs: ${report.outputs.map((o) => `${o.kind}${o.site ? `:${o.site}` : ""}`).join(", ")}`);
      console.log(`  warehouse routes: 0`);
      console.log(`  identity: verdict=${report.identitySelection.verdict}` +
        ` keyedLiterals=${report.identitySelection.keyedIdentityLiterals}` +
        ` keyedViolations=${report.identitySelection.keyedViolations.length}` +
        ` injectedFieldNameTuples=${report.identitySelection.injectedFieldNameTuples.length}`);
    }
    return 0;
  } catch (error) {
    if (error instanceof BundleGuardFailure) {
      const payload = { result: "FAIL", stage, code: error.code, message: error.message, detail: error.detail };
      if (asJson) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      } else {
        console.error(`CT4 WEB-P0 bundle guard [${stage}]: FAIL ${error.code}`);
        console.error(`  ${error.message}`);
      }
      return 1;
    }
    console.error(`CT4 WEB-P0 bundle guard [${stage}]: FAIL E_INTERNAL`);
    console.error(`  ${error && error.message ? error.message : String(error)}`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}
