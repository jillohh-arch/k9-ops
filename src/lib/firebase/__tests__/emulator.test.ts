/**
 * Unit tests for Firebase Emulator module
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { validateEmulatorEnvironment, _resetEmulatorState } from "../emulator";

describe("validateEmulatorEnvironment", () => {
  beforeEach(() => {
    _resetEmulatorState();
    vi.resetModules();
  });

  afterEach(() => {
    _resetEmulatorState();
  });

  it("returns enabled:true when NEXT_PUBLIC_FIREBASE_USE_EMULATORS is true and not production", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "development");

    const { validateEmulatorEnvironment } = await import("../emulator");
    const result = validateEmulatorEnvironment();
    expect(result.enabled).toBe(true);
  });

  it("returns enabled:false when NEXT_PUBLIC_FIREBASE_USE_EMULATORS is not true", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "false");
    vi.stubEnv("NODE_ENV", "development");

    const { validateEmulatorEnvironment } = await import("../emulator");
    const result = validateEmulatorEnvironment();
    expect(result.enabled).toBe(false);
  });

  it("returns enabled:false in production environment", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATORS", "true");
    vi.stubEnv("NODE_ENV", "production");

    const { validateEmulatorEnvironment } = await import("../emulator");
    const result = validateEmulatorEnvironment();
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain("Production");
  });
});
