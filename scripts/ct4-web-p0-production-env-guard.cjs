#!/usr/bin/env node
/**
 * CT4 WEB-P0 — PRE-BUILD production identity/precedence guard.
 *
 * Gate: CT4.WEB-P0.PRODUCTION-GUARD-AND-CANDIDATE-BUILD-R2
 *
 * WHY THIS EXISTS
 * ---------------
 * `src/lib/firebase/config.ts` already refuses a hybrid or unexpected Firebase
 * Web identity, but only from the inputs it is handed at build time. The
 * release pipeline decided those inputs in two different places:
 *
 *   - the `validate` job built through shell `env:` vars, and
 *   - the `release` job materialised `.env.local`, which the Firebase CLI then
 *     re-read during its OWN `next build` (see frameworks/next build()).
 *
 * Shell env outranks every dotenv file in Next.js, so a shell `NEXT_PUBLIC_*`
 * set to staging silently beat a "correct" `.env.local`. Nothing failed
 * closed before a build started. This guard is that missing checkpoint: it
 * resolves the EFFECTIVE environment the way Next.js does and refuses to let a
 * production build begin unless the selection is production/canil-gcm.
 *
 * PRECEDENCE (highest wins), matching Next.js `loadEnvConfig`:
 *   1. process.env (shell / CI step env)
 *   2. .env.$(NODE_ENV).local
 *   3. .env.local                  (NOT loaded when NODE_ENV === "test")
 *   4. .env.$(NODE_ENV)
 *   5. .env
 *
 * SAFETY: this module never prints a config VALUE except the non-secret
 * project identity (`canil-gcm` / `k9-ops-staging`). Field names, layer names,
 * statuses and exit codes only. No network, no credentials, no Firebase access.
 *
 * CLI:
 *   node scripts/ct4-web-p0-production-env-guard.cjs [--stage pre-build]
 *        [--root <dir>] [--ci] [--json]
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** Non-secret target project identities (mirror src/lib/firebase/config.ts). */
const STAGING_PROJECT_ID = "k9-ops-staging";
const PRODUCTION_PROJECT_ID = "canil-gcm";

/**
 * Canonical Firebase Web identity per environment selector.
 *
 * These mirror `EXPECTED_FIREBASE_IDENTITY` in `src/lib/firebase/config.ts`.
 * They are Firebase Web *public* client config (shipped to every browser), so
 * embedding them here adds no exposure — but `assertCanonicalTupleMatchesSource`
 * keeps them from drifting away from the source of truth.
 */
const CANONICAL_IDENTITY = {
  staging: {
    projectId: STAGING_PROJECT_ID,
    apiKey: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
    authDomain: "k9-ops-staging.firebaseapp.com",
    storageBucket: "k9-ops-staging.firebasestorage.app",
    messagingSenderId: "507588808242",
    appId: "1:507588808242:web:89b531a8e7d358596ef62b",
    measurementId: undefined,
  },
  production: {
    projectId: PRODUCTION_PROJECT_ID,
    apiKey: "AIzaSyAQKCu-UOQQFiRfq-Slahhcy985rtQBkmU",
    authDomain: "canil-gcm.firebaseapp.com",
    storageBucket: "canil-gcm.firebasestorage.app",
    messagingSenderId: "418249404282",
    appId: "1:418249404282:web:6c0093a341e04ef518b0c3",
    measurementId: "G-KNTKW04X7S",
  },
};

/** Env var carried by each identity field, in stable order. */
const IDENTITY_ENV_KEYS = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
  measurementId: "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
};

const SELECTOR_KEY = "NEXT_PUBLIC_APP_ENV";
const PROJECT_KEY = "NEXT_PUBLIC_FIREBASE_PROJECT_ID";

/** Every key this guard is allowed to look at. */
const GUARDED_KEYS = [SELECTOR_KEY, PROJECT_KEY, ...Object.values(IDENTITY_ENV_KEYS)];

class GuardFailure extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "GuardFailure";
    this.code = code;
    this.detail = detail || {};
  }
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

/**
 * Parse one dotenv file EXACTLY as Next.js does.
 *
 * This is a literal port of dotenv 16.3.1 `parse()`, the parser bundled in
 * `@next/env` and therefore the one `next build` actually uses. It is not an
 * approximation on purpose: any divergence is a bypass, because the guard
 * could then PASS on a file the real build reads differently.
 *
 * Two details matter and were both found by an independent checker:
 *   - a lone `\r` is normalized to `\n` BEFORE matching, so `a=1\rb=2` is two
 *     assignments to dotenv even though it is one line to a naive splitter;
 *   - the separator is `=` (with optional spaces) or `:` followed by at least
 *     one space, and the pattern is matched globally over the whole content.
 *
 * Still non-evaluating: this returns raw parsed values. `expand()` (variable
 * interpolation) is deliberately not applied — the guard compares the values
 * the file literally declares.
 */
function parseEnvFile(contents) {
  const LINE =
    /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;

  const out = Object.create(null);
  const normalized = String(contents).replace(/\r\n?/gm, "\n");

  let match;
  while ((match = LINE.exec(normalized)) !== null) {
    const key = match[1];
    let value = match[2] || "";
    value = value.trim();
    const quote = value[0];
    value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");
    if (quote === '"') {
      value = value.replace(/\\n/g, "\n");
      value = value.replace(/\\r/g, "\r");
    }
    out[key] = value;
  }
  return out;
}

/** The dotenv layers Next.js would read, highest precedence first. */
function envLayerNames(nodeEnv) {
  const layers = [`.env.${nodeEnv}.local`];
  // Next.js skips .env.local under NODE_ENV=test so tests never read a
  // developer's local production credentials.
  if (nodeEnv !== "test") layers.push(".env.local");
  layers.push(`.env.${nodeEnv}`, ".env");
  return layers;
}

/**
 * Resolve the effective value of every guarded key, plus the layer that won.
 *
 * `shellEnv` represents `process.env` and outranks every file. Returns values
 * but callers must never print them (see `describe`).
 */
function loadEffectiveEnv(options) {
  const opts = options || {};
  const root = opts.root || process.cwd();
  // Never inherit NODE_ENV from the caller. Next.js skips `.env.local` when
  // NODE_ENV=test, so honouring an ambient NODE_ENV would let anyone hide a
  // stray production dotenv from this guard by setting NODE_ENV=test. A
  // production release always resolves as production.
  const nodeEnv = opts.nodeEnv || "production";
  // `shellEnv` unset means "read the real process env"; an explicitly passed
  // empty object must stay empty (tests rely on that distinction).
  const shellEnv = opts.shellEnv === undefined ? process.env : opts.shellEnv;

  const layers = envLayerNames(nodeEnv);
  const present = [];
  const fileValues = Object.create(null);

  for (const layer of layers) {
    const file = path.join(root, layer);
    if (!fs.existsSync(file)) continue;
    present.push({ layer, file });
    const parsed = parseEnvFile(fs.readFileSync(file, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      // First writer wins: layers are iterated highest precedence first.
      if (!(key in fileValues)) {
        fileValues[key] = { value, layer };
      }
    }
  }

  const resolved = Object.create(null);
  const provenance = Object.create(null);
  for (const key of GUARDED_KEYS) {
    const shellValue = shellEnv[key];
    if (!isBlank(shellValue)) {
      resolved[key] = String(shellValue).trim();
      provenance[key] = "process-env";
    } else if (key in fileValues) {
      resolved[key] = fileValues[key].value;
      provenance[key] = fileValues[key].layer;
    } else {
      resolved[key] = undefined;
      provenance[key] = "absent";
    }
  }

  return { root, nodeEnv, layers, present, resolved, provenance };
}

/**
 * Assert the embedded canonical tuple still matches `src/lib/firebase/config.ts`.
 *
 * Fails closed on drift so this guard can never validate against a stale copy
 * of the production identity. Textual extraction on purpose: no TypeScript
 * compiler, no network, no dependency on the app's build graph.
 */
function assertCanonicalTupleMatchesSource(root) {
  const sourcePath = path.join(root, "src", "lib", "firebase", "config.ts");
  if (!fs.existsSync(sourcePath)) {
    throw new GuardFailure(
      "E_SOURCE_ABSENT",
      "src/lib/firebase/config.ts is missing; cannot prove the canonical identity is current.",
      { path: "src/lib/firebase/config.ts" },
    );
  }
  const source = fs.readFileSync(sourcePath, "utf8");

  // config.ts may express the project identity through the exported constants
  // instead of a literal; resolve whichever form is present.
  const constantValues = Object.create(null);
  for (const [, constantName, literal] of source.matchAll(
    /export const ([A-Z_]+_PROJECT_ID) = "([^"]+)"/g,
  )) {
    constantValues[constantName] = literal;
  }

  const blockDeclares = (block, expected) => {
    if (block.includes(`"${expected}"`)) return true;
    for (const [constantName, literal] of Object.entries(constantValues)) {
      if (literal === expected && new RegExp(`\\b${constantName}\\b`).test(block)) return true;
    }
    return false;
  };

  for (const envName of ["staging", "production"]) {
    const blockStart = source.indexOf(`${envName}: {`);
    if (blockStart === -1) {
      throw new GuardFailure(
        "E_DRIFT",
        `Canonical identity block "${envName}" not found in src/lib/firebase/config.ts.`,
        { block: envName },
      );
    }
    const blockEnd = source.indexOf("},", blockStart);
    const block = source.slice(blockStart, blockEnd === -1 ? undefined : blockEnd);
    for (const [field, expected] of Object.entries(CANONICAL_IDENTITY[envName])) {
      if (expected === undefined) continue;
      if (!blockDeclares(block, expected)) {
        throw new GuardFailure(
          "E_DRIFT",
          `Guard constant for ${envName}.${field} no longer matches src/lib/firebase/config.ts. ` +
            "Update the guard in the same change as the identity.",
          { block: envName, field },
        );
      }
    }
  }
  return true;
}

/**
 * Read the configured Firebase/Hosting target without mutating anything.
 *
 * Absence or malformed JSON is an ERROR, never "no constraint to check":
 * a guard that silently skips its target assertion when the file is missing
 * fails open, which is the failure mode this whole gate exists to remove.
 */
function readConfiguredTargets(root) {
  const rcPath = path.join(root, ".firebaserc");
  const jsonPath = path.join(root, "firebase.json");

  if (!fs.existsSync(rcPath)) {
    throw new GuardFailure("E_TARGET_UNREADABLE", ".firebaserc is missing; the Firebase target cannot be verified.", {
      target: ".firebaserc",
    });
  }
  if (!fs.existsSync(jsonPath)) {
    throw new GuardFailure("E_TARGET_UNREADABLE", "firebase.json is missing; the Hosting target cannot be verified.", {
      target: "firebase.json",
    });
  }

  let defaultProject;
  let hostingSite;
  try {
    const rc = JSON.parse(fs.readFileSync(rcPath, "utf8"));
    defaultProject = rc && rc.projects ? rc.projects.default : undefined;
  } catch {
    throw new GuardFailure("E_TARGET_UNREADABLE", ".firebaserc is not valid JSON; the Firebase target cannot be verified.", {
      target: ".firebaserc",
    });
  }

  try {
    const cfg = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const hosting = cfg && cfg.hosting;
    // Array-form hosting has no single site to verify; treat it as unproven.
    if (Array.isArray(hosting)) {
      throw new GuardFailure(
        "E_TARGET_UNREADABLE",
        "firebase.json declares multiple hosting targets; a single production site cannot be proven.",
        { target: "firebase.json.hosting" },
      );
    }
    hostingSite = hosting && hosting.site;
  } catch (error) {
    if (error instanceof GuardFailure) throw error;
    throw new GuardFailure("E_TARGET_UNREADABLE", "firebase.json is not valid JSON; the Hosting target cannot be verified.", {
      target: "firebase.json",
    });
  }

  return { defaultProject, hostingSite };
}

/**
 * Run the PRE-BUILD guard.
 *
 * `forbidLocalEnv` is the CI posture: an unexpected `.env.local` inside the
 * checkout means the build inputs are not the ones the pipeline declared.
 */
function runEnvGuard(options) {
  const opts = options || {};
  const root = opts.root || process.cwd();
  const forbidLocalEnv = opts.forbidLocalEnv !== false;
  const expectedProject = opts.expectedProject || PRODUCTION_PROJECT_ID;

  assertCanonicalTupleMatchesSource(root);
  const env = loadEffectiveEnv({ root, nodeEnv: opts.nodeEnv, shellEnv: opts.shellEnv });

  if (forbidLocalEnv && env.present.some((entry) => entry.layer === ".env.local")) {
    throw new GuardFailure(
      "E_LOCAL_ENV_FORBIDDEN",
      "An unexpected .env.local exists in the build checkout. The release pipeline must " +
        "supply the production identity as explicit job env, never as a generated dotenv file.",
      { layers: env.present.map((entry) => entry.layer) },
    );
  }

  const missing = GUARDED_KEYS.filter(
    (key) => key !== IDENTITY_ENV_KEYS.measurementId && isBlank(env.resolved[key]),
  );
  if (missing.length > 0) {
    throw new GuardFailure(
      "E_TUPLE_MISSING",
      `Effective production identity is incomplete. Missing: ${missing.join(", ")}.`,
      { fields: missing },
    );
  }

  const selector = env.resolved[SELECTOR_KEY];
  if (selector !== "production") {
    throw new GuardFailure(
      "E_ENV_SELECTOR_INVALID",
      `Effective ${SELECTOR_KEY} resolves to "${selector}" (from ` +
        `${env.provenance[SELECTOR_KEY]}), but a production release requires "production".`,
      { provenance: env.provenance[SELECTOR_KEY] },
    );
  }

  const expected = CANONICAL_IDENTITY.production;
  const projectId = env.resolved[PROJECT_KEY];
  if (projectId !== expectedProject) {
    throw new GuardFailure(
      "E_PROJECT_MISMATCH",
      `${PROJECT_KEY} resolves to "${projectId}" (from ${env.provenance[PROJECT_KEY]}), ` +
        `but production requires "${expectedProject}".`,
      { provenance: env.provenance[PROJECT_KEY] },
    );
  }

  const mismatchedFields = [];
  for (const [field, envKey] of Object.entries(IDENTITY_ENV_KEYS)) {
    if (field === "measurementId") continue;
    if (env.resolved[envKey] !== expected[field]) mismatchedFields.push(field);
  }
  const measurementId = env.resolved[IDENTITY_ENV_KEYS.measurementId];
  if (!isBlank(measurementId) && measurementId !== expected.measurementId) {
    mismatchedFields.push("measurementId");
  }
  if (mismatchedFields.length > 0) {
    throw new GuardFailure(
      "E_IDENTITY_MISMATCH",
      `Effective Firebase Web identity is hybrid: ${mismatchedFields.join(", ")} do not ` +
        `belong to project "${expectedProject}".`,
      { fields: mismatchedFields },
    );
  }

  const targets = readConfiguredTargets(root);
  if (targets.defaultProject !== expectedProject) {
    throw new GuardFailure(
      "E_TARGET_MISMATCH",
      `.firebaserc default project is ${targets.defaultProject ? "not the expected target" : "absent"}, ` +
        `but a production release requires "${expectedProject}".`,
      { target: "firebaserc.default" },
    );
  }
  if (targets.hostingSite !== expectedProject) {
    throw new GuardFailure(
      "E_TARGET_MISMATCH",
      `firebase.json hosting.site is ${targets.hostingSite ? "not the expected target" : "absent"}, ` +
        `but a production release requires "${expectedProject}".`,
      { target: "firebase.json.hosting.site" },
    );
  }

  // A lower-precedence layer holding a different selector is not a failure —
  // the effective value wins — but it is the exact shape of the old CF-01
  // contradiction, so surface it as a warning without printing values.
  const warnings = [];
  for (const layerEntry of env.present) {
    const parsedSelector = parseEnvFile(fs.readFileSync(layerEntry.file, "utf8"))[SELECTOR_KEY];
    if (
      parsedSelector !== undefined &&
      parsedSelector !== "production" &&
      env.provenance[SELECTOR_KEY] !== layerEntry.layer
    ) {
      warnings.push({
        code: "W_SHADOWED_ENV_FILE",
        layer: layerEntry.layer,
        message:
          `${layerEntry.layer} declares a non-production ${SELECTOR_KEY} but is shadowed by ` +
          `${env.provenance[SELECTOR_KEY]}. Effective selection stays production.`,
      });
    }
  }

  return {
    result: "PASS",
    stage: opts.stage || "pre-build",
    projectId,
    selector,
    target: { firebasercDefault: targets.defaultProject, hostingSite: targets.hostingSite },
    provenance: env.provenance,
    envFiles: env.present.map((entry) => entry.layer),
    warnings,
  };
}

module.exports = {
  CANONICAL_IDENTITY,
  GUARDED_KEYS,
  IDENTITY_ENV_KEYS,
  PRODUCTION_PROJECT_ID,
  STAGING_PROJECT_ID,
  GuardFailure,
  assertCanonicalTupleMatchesSource,
  envLayerNames,
  loadEffectiveEnv,
  parseEnvFile,
  readConfiguredTargets,
  runEnvGuard,
};

/** Minimal CLI so the workflow can run this as a single Node process. */
function main(argv) {
  const args = argv.slice(2);
  const get = (flag, fallback) => {
    const index = args.indexOf(flag);
    return index === -1 ? fallback : args[index + 1];
  };
  const root = path.resolve(get("--root", process.cwd()));
  const stage = get("--stage", "pre-build");
  const asJson = args.includes("--json");
  const forbidLocalEnv = !args.includes("--allow-local-env");

  try {
    const report = runEnvGuard({ root, stage, forbidLocalEnv });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      console.log(`CT4 WEB-P0 env guard [${stage}]: PASS`);
      console.log(`  project: ${report.projectId}`);
      console.log(`  selector: ${report.selector}`);
      console.log(`  env files: ${report.envFiles.length === 0 ? "(none)" : report.envFiles.join(", ")}`);
      for (const warning of report.warnings) console.warn(`  WARN ${warning.code}: ${warning.message}`);
    }
    return 0;
  } catch (error) {
    if (error instanceof GuardFailure) {
      const payload = { result: "FAIL", stage, code: error.code, message: error.message, detail: error.detail };
      if (asJson) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      } else {
        console.error(`CT4 WEB-P0 env guard [${stage}]: FAIL ${error.code}`);
        console.error(`  ${error.message}`);
      }
      return 1;
    }
    console.error(`CT4 WEB-P0 env guard [${stage}]: FAIL E_INTERNAL`);
    console.error(`  ${error && error.message ? error.message : String(error)}`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}
