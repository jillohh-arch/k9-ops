import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectAuth: vi.fn(),
  connectFirestore: vi.fn(),
  connectFunctions: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  getApps: () => [],
  initializeApp: () => ({ name: "test-app" }),
}));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ name: "auth" }),
  connectAuthEmulator: mocks.connectAuth,
}));
vi.mock("firebase/firestore", () => ({
  getFirestore: () => ({ name: "firestore" }),
  connectFirestoreEmulator: mocks.connectFirestore,
}));
vi.mock("firebase/functions", () => ({
  getFunctions: () => ({ name: "functions" }),
  connectFunctionsEmulator: mocks.connectFunctions,
}));
vi.mock("firebase/storage", () => ({ getStorage: () => ({ name: "storage" }) }));
vi.mock("firebase/analytics", () => ({
  getAnalytics: () => null,
  isSupported: () => Promise.resolve(false),
}));

async function loadClient(flag?: string) {
  if (flag === undefined) {
    delete process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
  } else {
    vi.stubEnv("NEXT_PUBLIC_USE_FIREBASE_EMULATORS", flag);
  }
  vi.resetModules();
  return import("../client");
}

describe("Firebase emulator opt-in flag", () => {
  beforeEach(() => {
    mocks.connectAuth.mockClear();
    mocks.connectFirestore.mockClear();
    mocks.connectFunctions.mockClear();
    globalThis.__k9OpsFirebaseEmulatorsConnected = undefined;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.__k9OpsFirebaseEmulatorsConnected = undefined;
  });

  it.each([undefined, "false", "TRUE", "1", "development"])(
    "does not connect when flag is %s",
    async (flag) => {
      await loadClient(flag);
      expect(mocks.connectAuth).not.toHaveBeenCalled();
      expect(mocks.connectFirestore).not.toHaveBeenCalled();
      expect(mocks.connectFunctions).not.toHaveBeenCalled();
    },
  );

  it("connects every emulator exactly once when flag is exactly true", async () => {
    await loadClient("true");
    expect(mocks.connectAuth).toHaveBeenCalledTimes(1);
    expect(mocks.connectFirestore).toHaveBeenCalledTimes(1);
    expect(mocks.connectFunctions).toHaveBeenCalledTimes(1);
    expect(mocks.connectAuth).toHaveBeenCalledWith(
      { name: "auth" },
      "http://127.0.0.1:9099",
      { disableWarnings: true },
    );
    expect(mocks.connectFirestore).toHaveBeenCalledWith(
      { name: "firestore" },
      "127.0.0.1",
      8080,
    );
    expect(mocks.connectFunctions).toHaveBeenCalledWith(
      { name: "functions" },
      "127.0.0.1",
      5001,
    );

    // Force module initialization again. The global instance guard, not ESM cache,
    // must prevent a second connection attempt.
    vi.resetModules();
    await import("../client");
    expect(mocks.connectAuth).toHaveBeenCalledTimes(1);
    expect(mocks.connectFirestore).toHaveBeenCalledTimes(1);
    expect(mocks.connectFunctions).toHaveBeenCalledTimes(1);
  });

  it("does not infer emulator use from NODE_ENV production or development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await loadClient();
    expect(mocks.connectFirestore).not.toHaveBeenCalled();
  });
});
