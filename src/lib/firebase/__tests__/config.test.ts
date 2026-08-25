import { describe, expect, it } from "vitest";

import {
  EXPECTED_FIREBASE_IDENTITY,
  FirebaseConfigError,
  PRODUCTION_PROJECT_ID,
  STAGING_PROJECT_ID,
  resolveFirebaseClientConfig,
  type AppEnv,
  type FirebaseClientEnv,
} from "@/lib/firebase/config";

/**
 * Gate 10H-HUMAN-CREATE-H3-W.R1 (+ correction C1) — fail-closed Firebase Web
 * IDENTITY guard.
 *
 * These are PURE unit tests over the resolver: no network, no Firebase SDK, no
 * real env file. The canonical CROSS-ENVIRONMENT identity values (projectId,
 * authDomain, storageBucket, messagingSenderId, appId, measurementId) are the
 * public Web SDK config already pinned in `config.ts`; they are not secrets.
 * The two apiKeys are read from `EXPECTED_FIREBASE_IDENTITY` rather than
 * re-hardcoded, so the test never carries an apiKey literal of its own.
 */

const STAGING = EXPECTED_FIREBASE_IDENTITY.staging;
const PRODUCTION = EXPECTED_FIREBASE_IDENTITY.production;

/** The complete, canonical staging environment (the ONLY valid staging tuple). */
function stagingEnv(): FirebaseClientEnv {
  return {
    NEXT_PUBLIC_APP_ENV: "staging",
    NEXT_PUBLIC_FIREBASE_API_KEY: STAGING.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: STAGING.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: STAGING.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: STAGING.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: STAGING.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: STAGING.appId,
  };
}

/** The complete, canonical production environment (the ONLY valid prod tuple). */
function productionEnv(): FirebaseClientEnv {
  return {
    NEXT_PUBLIC_APP_ENV: "production",
    NEXT_PUBLIC_FIREBASE_API_KEY: PRODUCTION.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: PRODUCTION.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: PRODUCTION.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: PRODUCTION.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: PRODUCTION.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: PRODUCTION.appId,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: PRODUCTION.measurementId,
  };
}

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

/** The env var each cross-environment identity field is read from. */
const IDENTITY_FIELD_ENV: Record<string, string> = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
};

describe("resolveFirebaseClientConfig — canonical tuples (happy paths)", () => {
  it("resolves the canonical staging tuple targeting k9-ops-staging", () => {
    const config = resolveFirebaseClientConfig(stagingEnv());

    expect(config.projectId).toBe("k9-ops-staging");
    expect(config.authDomain).toBe(STAGING.authDomain);
    expect(config.apiKey).toBe(STAGING.apiKey);
    expect(config.storageBucket).toBe(STAGING.storageBucket);
    expect(config.messagingSenderId).toBe(STAGING.messagingSenderId);
    expect(config.appId).toBe(STAGING.appId);
    // staging has no Analytics stream, so no measurementId is emitted.
    expect(config).not.toHaveProperty("measurementId");
  });

  it("resolves the canonical production tuple targeting canil-gcm", () => {
    const config = resolveFirebaseClientConfig(productionEnv());

    expect(config.projectId).toBe("canil-gcm");
    expect(config.authDomain).toBe(PRODUCTION.authDomain);
    expect(config.apiKey).toBe(PRODUCTION.apiKey);
    expect(config.storageBucket).toBe(PRODUCTION.storageBucket);
    expect(config.messagingSenderId).toBe(PRODUCTION.messagingSenderId);
    expect(config.appId).toBe(PRODUCTION.appId);
    // production carries its canonical Analytics stream.
    expect(config.measurementId).toBe("G-KNTKW04X7S");
  });

  it("returns exactly the validated Firebase fields and never APP_ENV", () => {
    const config = resolveFirebaseClientConfig(stagingEnv());

    // No FirebaseOptions field may carry the selector, under any spelling.
    expect(Object.keys(config).sort()).toEqual([
      "apiKey",
      "appId",
      "authDomain",
      "messagingSenderId",
      "projectId",
      "storageBucket",
    ]);
    expect(config).not.toHaveProperty("NEXT_PUBLIC_APP_ENV");
    expect(config).not.toHaveProperty("appEnv");
    // The selector value must not appear as any config field. (Note: the
    // literal substring "staging" legitimately appears inside the staging
    // projectId/authDomain, so we assert on the exact selector value only.)
    expect(Object.values(config)).not.toContain("staging");
    expect(Object.values(config)).not.toContain("production");
  });
});

describe("resolveFirebaseClientConfig — measurementId handling", () => {
  it("accepts the canonical production measurementId", () => {
    const config = resolveFirebaseClientConfig(productionEnv());
    expect(config.measurementId).toBe("G-KNTKW04X7S");
  });

  it("tolerates an ABSENT measurementId on production (optional CI var)", () => {
    const env = productionEnv();
    delete env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
    const config = resolveFirebaseClientConfig(env);
    expect(config).not.toHaveProperty("measurementId");
  });

  it("tolerates a blank measurementId (treated as absent)", () => {
    const config = resolveFirebaseClientConfig({
      ...productionEnv(),
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "   ",
    });
    expect(config).not.toHaveProperty("measurementId");
  });

  it("REJECTS the production measurementId inside a staging config", () => {
    expect(() =>
      resolveFirebaseClientConfig({
        ...stagingEnv(),
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-KNTKW04X7S",
      }),
    ).toThrow(/measurementId does not match the expected staging/);
  });

  it("REJECTS any non-canonical measurementId on production", () => {
    expect(() =>
      resolveFirebaseClientConfig({
        ...productionEnv(),
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-SOMEOTHER",
      }),
    ).toThrow(/measurementId does not match the expected production/);
  });
});

describe("resolveFirebaseClientConfig — hybrid identity (fail closed)", () => {
  // The core C1 invariant: any single identity field taken from the OPPOSITE
  // environment must fail closed, even though projectId still matches.
  const FIELDS = [
    "apiKey",
    "authDomain",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ] as const;

  it.each(FIELDS)(
    "throws when staging carries the production %s",
    (field) => {
      const envKey = IDENTITY_FIELD_ENV[field];
      expect(() =>
        resolveFirebaseClientConfig({
          ...stagingEnv(),
          [envKey]: PRODUCTION[field as keyof typeof PRODUCTION] as string,
        }),
      ).toThrow(FirebaseConfigError);
      expect(() =>
        resolveFirebaseClientConfig({
          ...stagingEnv(),
          [envKey]: PRODUCTION[field as keyof typeof PRODUCTION] as string,
        }),
      ).toThrow(
        new RegExp(`Firebase ${field} does not match the expected staging`),
      );
    },
  );

  it.each(FIELDS)(
    "throws when production carries the staging %s",
    (field) => {
      const envKey = IDENTITY_FIELD_ENV[field];
      expect(() =>
        resolveFirebaseClientConfig({
          ...productionEnv(),
          [envKey]: STAGING[field as keyof typeof STAGING] as string,
        }),
      ).toThrow(FirebaseConfigError);
      expect(() =>
        resolveFirebaseClientConfig({
          ...productionEnv(),
          [envKey]: STAGING[field as keyof typeof STAGING] as string,
        }),
      ).toThrow(
        new RegExp(`Firebase ${field} does not match the expected production`),
      );
    },
  );

  it("throws on the specific staging-project + production-apiKey hybrid", () => {
    // The exact Auth-crossover the C1 correction closes: right Firestore
    // project, but Auth would authenticate real production users.
    expect(() =>
      resolveFirebaseClientConfig({
        ...stagingEnv(),
        NEXT_PUBLIC_FIREBASE_API_KEY: PRODUCTION.apiKey,
      }),
    ).toThrow(/Firebase apiKey does not match the expected staging/);
  });

  it("throws on the specific staging-project + production-storageBucket hybrid", () => {
    expect(() =>
      resolveFirebaseClientConfig({
        ...stagingEnv(),
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: PRODUCTION.storageBucket,
      }),
    ).toThrow(/Firebase storageBucket does not match the expected staging/);
  });

  it("asserts projectId BEFORE the finer identity fields", () => {
    // A wrong project surfaces the coarse "project mismatch" diagnostic, not a
    // per-field one, so the most legible failure wins.
    expect(() =>
      resolveFirebaseClientConfig({
        ...stagingEnv(),
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: PRODUCTION.projectId,
        NEXT_PUBLIC_FIREBASE_API_KEY: PRODUCTION.apiKey,
      }),
    ).toThrow(/Firebase project mismatch/);
  });
});

describe("resolveFirebaseClientConfig — NEXT_PUBLIC_APP_ENV selector", () => {
  it("throws when NEXT_PUBLIC_APP_ENV is absent", () => {
    const env = stagingEnv();
    delete env.NEXT_PUBLIC_APP_ENV;

    expect(() => resolveFirebaseClientConfig(env)).toThrow(FirebaseConfigError);
    expect(() => resolveFirebaseClientConfig(env)).toThrow(
      /NEXT_PUBLIC_APP_ENV/,
    );
  });

  it("throws when NEXT_PUBLIC_APP_ENV is whitespace only", () => {
    expect(() =>
      resolveFirebaseClientConfig({
        ...stagingEnv(),
        NEXT_PUBLIC_APP_ENV: "   ",
      }),
    ).toThrow(/NEXT_PUBLIC_APP_ENV/);
  });

  it.each(["prod", "PRODUCTION", "Staging", "dev", "development", "test"])(
    "throws for the invalid selector %s",
    (value) => {
      expect(() =>
        resolveFirebaseClientConfig({
          ...stagingEnv(),
          NEXT_PUBLIC_APP_ENV: value,
        }),
      ).toThrow(/Invalid NEXT_PUBLIC_APP_ENV/);
    },
  );

  it("NEVER falls back to production when the selector is missing", () => {
    const env = stagingEnv();
    delete env.NEXT_PUBLIC_APP_ENV;

    let thrown: unknown;
    try {
      resolveFirebaseClientConfig(env);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(FirebaseConfigError);
    expect((thrown as Error).message).not.toContain("canil-gcm");
  });

  it("NEVER resolves canil-gcm when nothing at all is configured", () => {
    let thrown: unknown;
    try {
      resolveFirebaseClientConfig({});
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(FirebaseConfigError);
    expect(() => resolveFirebaseClientConfig({})).toThrow(
      /Missing Firebase configuration/,
    );
  });
});

describe("resolveFirebaseClientConfig — project identity assertion", () => {
  it("throws when the staging selector meets the production project", () => {
    expect(() =>
      resolveFirebaseClientConfig({
        ...productionEnv(),
        NEXT_PUBLIC_APP_ENV: "staging",
      }),
    ).toThrow(/Firebase project mismatch/);
  });

  it("throws when the production selector meets the staging project", () => {
    expect(() =>
      resolveFirebaseClientConfig({
        ...stagingEnv(),
        NEXT_PUBLIC_APP_ENV: "production",
      }),
    ).toThrow(/Firebase project mismatch/);
  });

  it("throws for any third project under either selector", () => {
    expect(() =>
      resolveFirebaseClientConfig({
        ...stagingEnv(),
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "some-other-project",
      }),
    ).toThrow(/Firebase project mismatch/);

    expect(() =>
      resolveFirebaseClientConfig({
        ...productionEnv(),
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "canil-gcm-staging",
      }),
    ).toThrow(/Firebase project mismatch/);
  });

  it("rejects a near-miss project id (no prefix or substring matching)", () => {
    expect(() =>
      resolveFirebaseClientConfig({
        ...stagingEnv(),
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "k9-ops-staging-2",
      }),
    ).toThrow(/Firebase project mismatch/);
  });

  it("names both the expected and the offending project in the message", () => {
    expect(() =>
      resolveFirebaseClientConfig({
        ...productionEnv(),
        NEXT_PUBLIC_APP_ENV: "staging",
      }),
    ).toThrow(/k9-ops-staging/);

    expect(() =>
      resolveFirebaseClientConfig({
        ...productionEnv(),
        NEXT_PUBLIC_APP_ENV: "staging",
      }),
    ).toThrow(/canil-gcm/);
  });
});

describe("resolveFirebaseClientConfig — required fields", () => {
  it.each(REQUIRED_KEYS)("throws when %s is absent", (key) => {
    const env = stagingEnv();
    delete env[key];

    expect(() => resolveFirebaseClientConfig(env)).toThrow(
      /Missing Firebase configuration/,
    );
    expect(() => resolveFirebaseClientConfig(env)).toThrow(
      new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });

  it.each(REQUIRED_KEYS)("throws when %s is an empty string", (key) => {
    expect(() =>
      resolveFirebaseClientConfig({ ...stagingEnv(), [key]: "" }),
    ).toThrow(/Missing Firebase configuration/);
  });

  it.each(REQUIRED_KEYS)("throws when %s is whitespace only", (key) => {
    expect(() =>
      resolveFirebaseClientConfig({ ...stagingEnv(), [key]: "   \t \n " }),
    ).toThrow(/Missing Firebase configuration/);
  });

  it("reports every missing field at once", () => {
    const env = stagingEnv();
    delete env.NEXT_PUBLIC_FIREBASE_API_KEY;
    delete env.NEXT_PUBLIC_FIREBASE_APP_ID;

    expect(() => resolveFirebaseClientConfig(env)).toThrow(
      /NEXT_PUBLIC_FIREBASE_API_KEY/,
    );
    expect(() => resolveFirebaseClientConfig(env)).toThrow(
      /NEXT_PUBLIC_FIREBASE_APP_ID/,
    );
  });

  it("fails on missing fields BEFORE evaluating the selector", () => {
    const env = stagingEnv();
    delete env.NEXT_PUBLIC_FIREBASE_API_KEY;
    env.NEXT_PUBLIC_APP_ENV = "bogus";

    expect(() => resolveFirebaseClientConfig(env)).toThrow(
      /Missing Firebase configuration/,
    );
  });
});

describe("resolveFirebaseClientConfig — value redaction", () => {
  it("does not leak the apiKey or appId in any error message", () => {
    const secretish = "SUPER-SECRET-VALUE";
    const cases: FirebaseClientEnv[] = [
      // wrong project
      {
        ...stagingEnv(),
        NEXT_PUBLIC_FIREBASE_API_KEY: secretish,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: PRODUCTION_PROJECT_ID,
      },
      // invalid selector
      {
        ...stagingEnv(),
        NEXT_PUBLIC_FIREBASE_APP_ID: secretish,
        NEXT_PUBLIC_APP_ENV: "nope",
      },
      // missing field
      {
        ...stagingEnv(),
        NEXT_PUBLIC_FIREBASE_API_KEY: secretish,
        NEXT_PUBLIC_FIREBASE_APP_ID: "",
      },
      // hybrid apiKey (must name the FIELD, never echo the value)
      {
        ...stagingEnv(),
        NEXT_PUBLIC_FIREBASE_API_KEY: secretish,
      },
    ];

    for (const env of cases) {
      let message = "";
      try {
        resolveFirebaseClientConfig(env);
      } catch (error) {
        message = (error as Error).message;
      }

      expect(message).not.toBe("");
      expect(message).not.toContain(secretish);
    }
  });

  it("never echoes the canonical apiKey values in a hybrid error", () => {
    // Substituting the real production apiKey into staging must not surface
    // that apiKey value in the message — only the field name + environment.
    let message = "";
    try {
      resolveFirebaseClientConfig({
        ...stagingEnv(),
        NEXT_PUBLIC_FIREBASE_API_KEY: PRODUCTION.apiKey,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/Firebase apiKey does not match/);
    expect(message).not.toContain(PRODUCTION.apiKey);
    expect(message).not.toContain(STAGING.apiKey);
  });
});

describe("EXPECTED_FIREBASE_IDENTITY — canonical map shape", () => {
  it("exposes exactly the two environments as identity anchors", () => {
    const envs: AppEnv[] = ["staging", "production"];
    for (const env of envs) {
      const id = EXPECTED_FIREBASE_IDENTITY[env];
      expect(id.apiKey.length).toBe(39);
      expect(id.projectId).toBe(
        env === "staging" ? STAGING_PROJECT_ID : PRODUCTION_PROJECT_ID,
      );
    }
    // staging has no Analytics stream; production carries exactly one.
    expect(STAGING.measurementId).toBeUndefined();
    expect(PRODUCTION.measurementId).toBe("G-KNTKW04X7S");
    // the two apiKeys are distinct across environments.
    expect(STAGING.apiKey).not.toBe(PRODUCTION.apiKey);
  });
});
