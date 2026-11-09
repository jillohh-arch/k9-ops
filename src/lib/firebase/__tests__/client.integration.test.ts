import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Narrow client-integration test: with the Firebase SDK fully mocked and a
 * complete staging environment injected via `process.env`, importing
 * `client.ts` must call `initializeApp` with EXACTLY the resolver's validated
 * FirebaseOptions — and never the NEXT_PUBLIC_APP_ENV selector.
 *
 * No network, no real Firebase init. The injected values are the canonical
 * public STAGING Web config (non-secret browser config) the C1 resolver requires.
 */

const initializeApp = vi.fn(() => ({ name: "[mock-app]" }));
const getApps = vi.fn(() => [] as unknown[]);
const getAuth = vi.fn(() => ({}));
const getFirestore = vi.fn(() => ({}));
const getStorage = vi.fn(() => ({}));
const getFunctions = vi.fn(() => ({}));

/** Read a positional arg from a mock call without tripping tuple-length types. */
function callArg(calls: unknown, callIndex: number, argIndex: number): unknown {
  const list = calls as unknown[][];
  return list[callIndex]?.[argIndex];
}

vi.mock("firebase/app", () => ({ getApps, initializeApp }));
vi.mock("firebase/auth", () => ({ getAuth }));
vi.mock("firebase/firestore", () => ({ getFirestore }));
vi.mock("firebase/storage", () => ({ getStorage }));
vi.mock("firebase/functions", () => ({ getFunctions }));
vi.mock("firebase/analytics", () => ({
  getAnalytics: vi.fn(),
  isSupported: vi.fn(() => Promise.resolve(false)),
}));

const ORIGINAL_ENV = { ...process.env };

/**
 * The canonical STAGING Firebase Web identity (public browser config, proven by
 * R1.IDA and pinned in `config.ts`). The strengthened C1 resolver asserts the
 * FULL identity tuple, so the fixture must present the authoritative staging
 * values — not synthetic placeholders. Staging has NO Analytics stream, so no
 * measurementId is supplied (a present one would be a crossover and fail closed).
 */
const STAGING_ENV = {
  NEXT_PUBLIC_APP_ENV: "staging",
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "k9-ops-staging.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "k9-ops-staging",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "k9-ops-staging.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "507588808242",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:507588808242:web:89b531a8e7d358596ef62b",
} as const;

beforeEach(() => {
  vi.resetModules();
  initializeApp.mockClear();
  getFunctions.mockClear();
  getApps.mockReturnValue([]);
  Object.assign(process.env, STAGING_ENV);
});

afterEach(() => {
  for (const key of Object.keys(STAGING_ENV)) {
    delete (process.env as Record<string, string | undefined>)[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("client.ts — initializeApp receives only the validated config", () => {
  it("calls initializeApp with the resolver's FirebaseOptions, without APP_ENV", async () => {
    await import("@/lib/firebase/client");

    expect(initializeApp).toHaveBeenCalledTimes(1);
    const passed = callArg(initializeApp.mock.calls, 0, 0) as Record<
      string,
      unknown
    >;

    expect(passed).toEqual({
      apiKey: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
      authDomain: "k9-ops-staging.firebaseapp.com",
      projectId: "k9-ops-staging",
      storageBucket: "k9-ops-staging.firebasestorage.app",
      messagingSenderId: "507588808242",
      appId: "1:507588808242:web:89b531a8e7d358596ef62b",
    });
    expect(passed).not.toHaveProperty("NEXT_PUBLIC_APP_ENV");
  });

  it("initializes Functions in the southamerica-east1 region", async () => {
    await import("@/lib/firebase/client");

    expect(getFunctions).toHaveBeenCalledTimes(1);
    expect(callArg(getFunctions.mock.calls, 0, 1)).toBe("southamerica-east1");
  });

  it("throws (fail closed) at import when the selector is missing", async () => {
    delete (process.env as Record<string, string | undefined>)
      .NEXT_PUBLIC_APP_ENV;

    await expect(import("@/lib/firebase/client")).rejects.toThrow(
      /NEXT_PUBLIC_APP_ENV/,
    );
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("throws (fail closed) at import when the project mismatches the selector", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "canil-gcm";

    await expect(import("@/lib/firebase/client")).rejects.toThrow(
      /Firebase project mismatch/,
    );
    expect(initializeApp).not.toHaveBeenCalled();
  });
});

describe("T3/R4-05 — alias / second-instance semantics (documented)", () => {
  it("T3-06 (CLOSED): an existing getApps() entry WITHOUT a [DEFAULT] app is rejected (fail closed)", async () => {
    // Since the T3-06 alias guard, client.ts revalidates any pre-existing app
    // against the resolved identity before reusing it. A getApps() population
    // lacking a [DEFAULT] instance is refused. A fully independent second
    // initializeApp elsewhere in the runtime remains out of scope
    // (ASSURANCE_ARBITRARY_RUNTIME_JS: NOT_PROVEN).
    getApps.mockReturnValue([{ name: "legacy-alias" }]);
    await expect(import("@/lib/firebase/client")).rejects.toThrow(
      /no \[DEFAULT\] app/,
    );
    expect(initializeApp).not.toHaveBeenCalled();
  });
});

/**
 * T3-06 — existing-app alias guard.
 *
 * When getApps() already contains a [DEFAULT] app, client.ts reuses it. The
 * reuse MUST be identity-checked against the resolver's validated config:
 * an app whose effective options diverge from the selected environment is a
 * hybrid/alias identity and must be REJECTED before any dependent
 * (auth/firestore/storage/functions) is handed out.
 */
describe("T3-06 — existing app alias identity guard", () => {
  /** Build a fake FirebaseApp-like object for the getApps() mock. */
  function fakeApp(name: string, options: Record<string, unknown> | undefined) {
    return { name, options } as unknown;
  }

  function setExistingApps(apps: unknown[]) {
    getApps.mockReturnValue(apps as never);
  }

  it("B1: rejects an existing DEFAULT app whose projectId targets the OPPOSITE environment", async () => {
    setExistingApps([
      fakeApp("[DEFAULT]", {
        apiKey: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
        projectId: "canil-gcm",
        authDomain: "canil-gcm.firebaseapp.com",
        storageBucket: "canil-gcm.firebasestorage.app",
        messagingSenderId: "418249404282",
        appId: "1:418249404282:web:6c0093a341e04ef518b0c3",
      }),
    ]);

    await expect(import("@/lib/firebase/client")).rejects.toThrow(
      /Firebase client identity error/,
    );
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("B2: rejects a DEFAULT app with the right projectId but a hybrid appId", async () => {
    setExistingApps([
      fakeApp("[DEFAULT]", {
        apiKey: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
        authDomain: "k9-ops-staging.firebaseapp.com",
        projectId: "k9-ops-staging",
        storageBucket: "k9-ops-staging.firebasestorage.app",
        messagingSenderId: "507588808242",
        appId: "1:418249404282:web:6c0093a341e04ef518b0c3",
      }),
    ]);

    await expect(import("@/lib/firebase/client")).rejects.toThrow(/appId/);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("B3: rejects a DEFAULT app with incomplete/undefined options (fail closed)", async () => {
    setExistingApps([fakeApp("[DEFAULT]", { projectId: "k9-ops-staging" })]);

    await expect(import("@/lib/firebase/client")).rejects.toThrow(
      /existing .DEFAULT. app/,
    );
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("B4: reuses a legitimately matching DEFAULT app WITHOUT a second initializeApp", async () => {
    const app = fakeApp("[DEFAULT]", {
      apiKey: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
      authDomain: "k9-ops-staging.firebaseapp.com",
      projectId: "k9-ops-staging",
      storageBucket: "k9-ops-staging.firebasestorage.app",
      messagingSenderId: "507588808242",
      appId: "1:507588808242:web:89b531a8e7d358596ef62b",
    });
    setExistingApps([app]);

    const mod = await import("@/lib/firebase/client");
    expect(initializeApp).not.toHaveBeenCalled();
    expect(mod.firebaseApp).toBe(app);
  });

  it("B5: selects the [DEFAULT] app among other NAMED apps, not getApps()[0]", async () => {
    const named = fakeApp("other", { projectId: "wrong" });
    const def = fakeApp("[DEFAULT]", {
      apiKey: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
      authDomain: "k9-ops-staging.firebaseapp.com",
      projectId: "k9-ops-staging",
      storageBucket: "k9-ops-staging.firebasestorage.app",
      messagingSenderId: "507588808242",
      appId: "1:507588808242:web:89b531a8e7d358596ef62b",
    });
    setExistingApps([named, def]);

    const mod = await import("@/lib/firebase/client");
    expect(mod.firebaseApp).toBe(def);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("B6: fails closed deterministically when only a NAMED app exists (no DEFAULT)", async () => {
    setExistingApps([fakeApp("legacy-alias", { projectId: "k9-ops-staging" })]);

    await expect(import("@/lib/firebase/client")).rejects.toThrow(
      /existing .DEFAULT. app|[DEFAULT]/,
    );
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("B7: compares EFFECTIVE option VALUES (computed keys, not source tokens)", async () => {
    // Build the hybrid options dynamically so any source-level token matching
    // would be defeated; the guard must compare runtime values.
    const key = ["app", "Id"].join("");
    const options: Record<string, unknown> = {
      apiKey: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
      authDomain: "k9-ops-staging.firebaseapp.com",
      projectId: "k9-ops-staging",
      storageBucket: "k9-ops-staging.firebasestorage.app",
      messagingSenderId: "507588808242",
    };
    options[key] = "1:999999999999:web:0000000000000000000000";
    setExistingApps([fakeApp("[DEFAULT]", options)]);

    await expect(import("@/lib/firebase/client")).rejects.toThrow(/appId/);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("B8: reimport (SSR/HMR) reuses the same valid DEFAULT app deterministically", async () => {
    const app = fakeApp("[DEFAULT]", {
      apiKey: "AIzaSyAc42tXt2jlF3ja4TQ-JQFI3S-hvdo1hqo",
      authDomain: "k9-ops-staging.firebaseapp.com",
      projectId: "k9-ops-staging",
      storageBucket: "k9-ops-staging.firebasestorage.app",
      messagingSenderId: "507588808242",
      appId: "1:507588808242:web:89b531a8e7d358596ef62b",
    });
    setExistingApps([app]);

    const first = await import("@/lib/firebase/client");
    const second = await import("@/lib/firebase/client");
    expect(initializeApp).not.toHaveBeenCalled();
    expect(second.firebaseApp).toBe(first.firebaseApp);
    expect(second.firebaseApp).toBe(app);
  });
});
