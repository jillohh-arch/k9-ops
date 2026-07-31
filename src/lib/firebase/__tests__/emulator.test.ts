/**
 * Unit tests for Firebase Emulator module
 *
 * Tests cover:
 * 1. Variable absent: does not connect
 * 2. Variable false: does not connect
 * 3. Development + true: connects Auth and Firestore
 * 4. Production + true: explicit failure, no connection
 * 5. Repeated call: each service connects once only
 * 6. Server-side execution: no connection, no browser APIs
 * 7. Error on service connection: structured error, no silent partial state
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

/** Mock factory for Firebase instances - using eslint-disable for test mocking */
const createMockAuth = (): Auth => ({} as Auth);
const createMockDb = (): Firestore => ({} as Firestore);

// Mock Firebase emulator functions before importing
vi.mock("firebase/auth", () => ({
  connectAuthEmulator: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  connectFirestoreEmulator: vi.fn(),
}));

describe("validateEmulatorEnvironment", () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset module state
    vi.doUnmock("../emulator");
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns enabled:false when NEXT_PUBLIC_FIREBASE_USE_EMULATORS is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "");
    vi.stubEnv("NODE_ENV", "development");

    const { validateEmulatorEnvironment, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();
    const result = validateEmulatorEnvironment();
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('is not "true"');
  });

  it("returns enabled:false when NEXT_PUBLIC_FIREBASE_USE_EMULATORS is 'false'", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "false");
    vi.stubEnv("NODE_ENV", "development");

    const { validateEmulatorEnvironment, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();
    const result = validateEmulatorEnvironment();
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('is not "true"');
  });

  it("returns enabled:false when NEXT_PUBLIC_FIREBASE_USE_EMULATORS is undefined", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", undefined);
    vi.stubEnv("NODE_ENV", "development");

    const { validateEmulatorEnvironment, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();
    const result = validateEmulatorEnvironment();
    expect(result.enabled).toBe(false);
  });

  it("returns enabled:true when NEXT_PUBLIC_FIREBASE_USE_EMULATORS is 'true' and not production", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    const { validateEmulatorEnvironment, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();
    const result = validateEmulatorEnvironment();
    expect(result.enabled).toBe(true);
  });

  it("returns enabled:false in production environment even with emulator flag true", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "production");

    const { validateEmulatorEnvironment, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();
    const result = validateEmulatorEnvironment();
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain("Production");
  });

  it("returns enabled:false in server-side environment", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    const originalWindow = global.window;
    // @ts-expect-error - deleting window to simulate server environment
    delete global.window;

    try {
      const { validateEmulatorEnvironment, _resetEmulatorState } = await import("../emulator");
      _resetEmulatorState();
      const result = validateEmulatorEnvironment();
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain("Server-side");
    } finally {
      global.window = originalWindow;
    }
  });
});

describe("connectToEmulators", () => {
  let connectAuthEmulator: ReturnType<typeof vi.fn>;
  let connectFirestoreEmulator: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();

    // Re-import mocks
    const authModule = await import("firebase/auth");
    const firestoreModule = await import("firebase/firestore");
    connectAuthEmulator = authModule.connectAuthEmulator as ReturnType<typeof vi.fn>;
    connectFirestoreEmulator = firestoreModule.connectFirestoreEmulator as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("connects Auth and Firestore when environment is valid", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    const { connectToEmulators, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();

    const mockAuth = createMockAuth();
    const mockDb = createMockDb();

    connectToEmulators(mockAuth, mockDb);

    // Should use E2E config ports: Auth 9199, Firestore 8181
    expect(connectAuthEmulator).toHaveBeenCalledWith(mockAuth, "http://127.0.0.1:9199", { disableWarnings: true });
    expect(connectFirestoreEmulator).toHaveBeenCalledWith(mockDb, "127.0.0.1", 8181);
  });

  it("connects Auth and Firestore with E2E config ports", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    const { connectToEmulators, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();

    const mockAuth = createMockAuth();
    const mockDb = createMockDb();

    // connectToEmulators now uses E2E config - no options parameter
    connectToEmulators(mockAuth, mockDb);

    // Should use E2E config ports: Auth 9199, Firestore 8181
    expect(connectAuthEmulator).toHaveBeenCalledWith(mockAuth, "http://127.0.0.1:9199", { disableWarnings: true });
    expect(connectFirestoreEmulator).toHaveBeenCalledWith(mockDb, "127.0.0.1", 8181);
  });

  it("does not connect Auth when environment is invalid (variable false)", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "false");
    vi.stubEnv("NODE_ENV", "development");

    const { connectToEmulators, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();

    const mockAuth = createMockAuth();
    const mockDb = createMockDb();

    connectToEmulators(mockAuth, mockDb);

    expect(connectAuthEmulator).not.toHaveBeenCalled();
    expect(connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it("does not connect in production even with emulator flag true", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "production");

    const { connectToEmulators, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();

    const mockAuth = createMockAuth();
    const mockDb = createMockDb();

    connectToEmulators(mockAuth, mockDb);

    expect(connectAuthEmulator).not.toHaveBeenCalled();
    expect(connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it("does not connect on repeated calls (duplicate prevention)", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    const { connectToEmulators, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();

    const mockAuth = createMockAuth();
    const mockDb = createMockDb();

    // First call
    connectToEmulators(mockAuth, mockDb);
    // Second call
    connectToEmulators(mockAuth, mockDb);

    // Each should only be called once
    expect(connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(connectFirestoreEmulator).toHaveBeenCalledTimes(1);
  });

  it("does not connect on concurrent calls (race prevention)", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    const { connectToEmulators, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();

    const mockAuth = createMockAuth();
    const mockDb = createMockDb();

    // Simulate concurrent calls
    connectToEmulators(mockAuth, mockDb);
    connectToEmulators(mockAuth, mockDb);
    connectToEmulators(mockAuth, mockDb);

    expect(connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(connectFirestoreEmulator).toHaveBeenCalledTimes(1);
  });

  it("does not connect in server-side environment", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    const originalWindow = global.window;
    // @ts-expect-error - deleting window to simulate server environment
    delete global.window;

    try {
      const { connectToEmulators, _resetEmulatorState } = await import("../emulator");
      _resetEmulatorState();

      const mockAuth = {} as any;
      const mockDb = {} as any;

      connectToEmulators(mockAuth, mockDb);

      expect(connectAuthEmulator).not.toHaveBeenCalled();
      expect(connectFirestoreEmulator).not.toHaveBeenCalled();
    } finally {
      global.window = originalWindow;
    }
  });

  it("throws structured error when Auth connection fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    connectAuthEmulator.mockImplementation(() => {
      throw new Error("Auth connection failed");
    });

    const { connectToEmulators, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();

    const mockAuth = createMockAuth();
    const mockDb = createMockDb();

    expect(() => connectToEmulators(mockAuth, mockDb)).toThrow(/Failed to connect to emulators/);
    expect(connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it("throws structured error when Firestore connection fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    connectFirestoreEmulator.mockImplementation(() => {
      throw new Error("Firestore connection failed");
    });

    const { connectToEmulators, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();

    const mockAuth = createMockAuth();
    const mockDb = createMockDb();

    expect(() => connectToEmulators(mockAuth, mockDb)).toThrow(/Failed to connect to emulators/);
    expect(connectAuthEmulator).toHaveBeenCalled(); // Auth connected before Firestore failed
  });

  it("allows reconnection after state reset", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    const { connectToEmulators, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();

    const mockAuth = createMockAuth();
    const mockDb = createMockDb();

    // First connection
    connectToEmulators(mockAuth, mockDb);
    expect(connectAuthEmulator).toHaveBeenCalledTimes(1);

    // Reset state
    _resetEmulatorState();

    // Second connection should work
    connectToEmulators(mockAuth, mockDb);
    expect(connectAuthEmulator).toHaveBeenCalledTimes(2);
  });
});

describe("areEmulatorsConnected", () => {
  it("returns false when not connected", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    const { areEmulatorsConnected, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();

    expect(areEmulatorsConnected()).toBe(false);
  });

  it("returns true after successful connection", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    vi.mock("firebase/auth", () => ({
      connectAuthEmulator: vi.fn(),
    }));

    vi.mock("firebase/firestore", () => ({
      connectFirestoreEmulator: vi.fn(),
    }));

    const { connectToEmulators, areEmulatorsConnected, _resetEmulatorState } = await import("../emulator");
    _resetEmulatorState();

    const mockAuth = createMockAuth();
    const mockDb = createMockDb();

    expect(areEmulatorsConnected()).toBe(false);

    connectToEmulators(mockAuth, mockDb);

    expect(areEmulatorsConnected()).toBe(true);
  });
});
