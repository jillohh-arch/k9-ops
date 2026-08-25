/**
 * Fail-closed Firebase Web IDENTITY guard (gate 10H-HUMAN-CREATE-H3-W.R1,
 * strengthened by correction C1).
 *
 * A developer must NOT be able to run the web app against a HYBRID Firebase
 * identity — e.g. the staging `projectId` with the PRODUCTION `apiKey` and
 * `authDomain` (which would authenticate real production users), or the
 * staging project with the production `storageBucket`. Pinning `projectId`
 * alone bounds Firestore but leaves Auth and Storage free to cross over.
 *
 * This module is a PURE, SYNCHRONOUS, NETWORK-FREE resolver that:
 *
 *   1. requires every public Firebase config field to be present and non-blank;
 *   2. requires an explicit `NEXT_PUBLIC_APP_ENV` selector (NO default) whose
 *      allowed values are exactly `staging` | `production`;
 *   3. resolves the ONE canonical Firebase Web identity tuple that the selector
 *      demands, and asserts EVERY identity field matches it.
 *
 * Any missing, blank, invalid, or contradictory input THROWS before the config
 * is handed to `initializeApp()`. There is deliberately NO fallback to
 * production: a missing selector is a configuration error, never a silent
 * production target.
 *
 * WHY THE VALUES ARE IN SOURCE: every field below is Firebase Web *public*
 * client config. It is compiled into the browser bundle and served to every
 * visitor, so it is not a secret and pinning it here adds no exposure. The
 * Firebase Web `apiKey` is a project identifier, not a credential; access is
 * enforced by Firestore/Storage Rules and Auth, never by its secrecy.
 *
 * SECURITY: error messages never expose config VALUES (apiKey, appId, etc.)
 * and never dump the resolved config. Only the non-secret project identities
 * (`k9-ops-staging`, `canil-gcm`), the offending FIELD name, and the
 * environment name may appear in messages.
 */

/** Non-secret target project identities. */
export const STAGING_PROJECT_ID = "k9-ops-staging";
export const PRODUCTION_PROJECT_ID = "canil-gcm";

export type AppEnv = "staging" | "production";

/**
 * The full public Web identity of one Firebase environment. Every field is a
 * hard equality anchor except `measurementId` (see the resolver).
 */
export type FirebaseIdentity = {
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  /**
   * Analytics stream. Present ONLY for production (`Canil-Web`); staging has
   * no Analytics stream, so its canonical value is `undefined`.
   */
  measurementId?: string;
};

/**
 * The canonical Firebase Web identity per environment selector.
 *
 * staging    -> Web app `k9-ops-staging-web01` in project `k9-ops-staging`
 * production -> Web app `Canil-Web`            in project `canil-gcm`
 *
 * These are the ONLY tuples either environment may present. A field taken from
 * the opposite environment is a hybrid configuration and fails closed.
 *
 * The two `apiKey` values are the PUBLIC Firebase Web keys (retrieved fresh
 * from `firebase apps:sdkconfig` for gate C1); they ship to the browser and
 * are not secrets.
 */
export const EXPECTED_FIREBASE_IDENTITY: Record<AppEnv, FirebaseIdentity> = {
  staging: {
    projectId: STAGING_PROJECT_ID,
    apiKey: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
    authDomain: "k9-ops-staging.firebaseapp.com",
    storageBucket: "k9-ops-staging.firebasestorage.app",
    messagingSenderId: "507588808242",
    appId: "1:507588808242:web:89b531a8e7d358596ef62b",
    // staging has no Analytics stream: any measurementId here is a crossover.
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

/**
 * The public Firebase config passed to `initializeApp()`. Mirrors the fields
 * the previous passthrough built, MINUS the `NEXT_PUBLIC_APP_ENV` selector,
 * which is an assertion input and must never leak into `FirebaseOptions`.
 *
 * `measurementId` is optional (Analytics is best-effort and absent in some
 * projects); every other field is required and validated as non-blank.
 */
export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

/** Environment shape the resolver reads. Injectable for unit tests. */
export type FirebaseClientEnv = Record<string, string | undefined>;

/**
 * The public Firebase env variables that MUST be present and non-blank before
 * an app is initialized. Order is stable so "which field is missing" is
 * deterministic.
 */
const REQUIRED_FIREBASE_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

/**
 * The identity fields asserted against the canonical tuple, in a stable order,
 * paired with the env var each one comes from. `projectId` is asserted
 * separately and FIRST so the pre-existing "wrong project" diagnostic (which
 * may name both non-secret project ids) is preserved verbatim.
 */
const ASSERTED_IDENTITY_FIELDS = [
  { field: "apiKey", envKey: "NEXT_PUBLIC_FIREBASE_API_KEY" },
  { field: "authDomain", envKey: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" },
  { field: "storageBucket", envKey: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" },
  {
    field: "messagingSenderId",
    envKey: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  },
  { field: "appId", envKey: "NEXT_PUBLIC_FIREBASE_APP_ID" },
] as const satisfies ReadonlyArray<{
  field: keyof Omit<FirebaseIdentity, "projectId" | "measurementId">;
  envKey: (typeof REQUIRED_FIREBASE_ENV_KEYS)[number];
}>;

/** Thrown for any fail-closed condition. Never carries config values. */
export class FirebaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseConfigError";
  }
}

/** A value counts as present only if it is a non-whitespace string. */
function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

/**
 * Validate the environment and resolve an identity-checked Firebase config.
 * Throws `FirebaseConfigError` (fail closed) on any missing/invalid/mismatched
 * input. Returns ONLY validated `FirebaseOptions` — never the APP_ENV selector.
 */
export function resolveFirebaseClientConfig(
  env: FirebaseClientEnv,
): FirebaseClientConfig {
  // 1. Required public Firebase fields — refuse to build a partial config.
  const missing = REQUIRED_FIREBASE_ENV_KEYS.filter((key) => isBlank(env[key]));
  if (missing.length > 0) {
    throw new FirebaseConfigError(
      `Missing Firebase configuration: ${missing.join(", ")}. ` +
        "Refusing to initialize Firebase with an incomplete config.",
    );
  }

  // 2. Explicit environment selector — NO default, never fall back to production.
  const appEnv = env.NEXT_PUBLIC_APP_ENV;
  if (isBlank(appEnv)) {
    throw new FirebaseConfigError(
      "Missing Firebase configuration: NEXT_PUBLIC_APP_ENV is required and " +
        'must be "staging" or "production". It has no default and never ' +
        "falls back to production.",
    );
  }
  const normalizedEnv = (appEnv as string).trim();
  if (normalizedEnv !== "staging" && normalizedEnv !== "production") {
    throw new FirebaseConfigError(
      'Invalid NEXT_PUBLIC_APP_ENV: expected "staging" or "production".',
    );
  }
  const selector = normalizedEnv as AppEnv;

  // 3. Resolve the ONE canonical identity tuple this selector may present.
  const expected = EXPECTED_FIREBASE_IDENTITY[selector];

  // 4. Project assertion FIRST — the coarsest, most legible failure. Preserves
  //    the pre-existing "Firebase project mismatch" diagnostic verbatim.
  const projectId = (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string).trim();
  if (projectId !== expected.projectId) {
    throw new FirebaseConfigError(
      `Firebase project mismatch: NEXT_PUBLIC_APP_ENV="${selector}" requires ` +
        `project "${expected.projectId}", but the resolved ` +
        `NEXT_PUBLIC_FIREBASE_PROJECT_ID targets "${projectId}". ` +
        "Refusing to initialize Firebase against the wrong project.",
    );
  }

  // 5. Full identity assertion — blocks HYBRID configs (right project, wrong
  //    Auth/Storage/app identity). Values are never echoed: apiKey in
  //    particular is only ever referred to by FIELD NAME.
  for (const { field, envKey } of ASSERTED_IDENTITY_FIELDS) {
    const actual = (env[envKey] as string).trim();
    if (actual !== expected[field]) {
      throw new FirebaseConfigError(
        `Firebase ${field} does not match the expected ${selector} Firebase ` +
          `Web app (project "${expected.projectId}"). ${envKey} carries a ` +
          `value from a different Firebase app. Refusing to initialize ` +
          `Firebase with a hybrid configuration.`,
      );
    }
  }

  // 6. measurementId is CONDITIONALLY asserted, not required. Analytics is
  //    best-effort, and production CI supplies it through an OPTIONAL GitHub
  //    variable, so an ABSENT measurementId is tolerated in both environments.
  //    But a PRESENT one must be the canonical stream for this environment —
  //    so production's "G-KNTKW04X7S" in a staging config is a crossover and
  //    fails closed (staging has no canonical stream at all).
  const measurementId = env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
  const normalizedMeasurementId = isBlank(measurementId)
    ? undefined
    : (measurementId as string).trim();
  if (
    normalizedMeasurementId !== undefined &&
    normalizedMeasurementId !== expected.measurementId
  ) {
    throw new FirebaseConfigError(
      `Firebase measurementId does not match the expected ${selector} ` +
        `Firebase Web app (project "${expected.projectId}"). ` +
        `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID carries a value from a ` +
        `different Firebase app. Refusing to initialize Firebase with a ` +
        `hybrid configuration.`,
    );
  }

  // Build validated FirebaseOptions. APP_ENV is intentionally excluded.
  const config: FirebaseClientConfig = {
    apiKey: (env.NEXT_PUBLIC_FIREBASE_API_KEY as string).trim(),
    authDomain: (env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN as string).trim(),
    projectId,
    storageBucket: (env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string).trim(),
    messagingSenderId: (
      env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string
    ).trim(),
    appId: (env.NEXT_PUBLIC_FIREBASE_APP_ID as string).trim(),
  };

  if (normalizedMeasurementId !== undefined) {
    config.measurementId = normalizedMeasurementId;
  }

  return config;
}
