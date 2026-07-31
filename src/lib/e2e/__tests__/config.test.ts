import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_E2E_CONFIG,
  assertLocalEmulatorHost,
  createE2EConfig,
  validateE2EConfig,
} from "../config";

describe("HW-2 E2E configuration", () => {
  it("uses the canonical default ports, hosts and project", () => {
    expect(createE2EConfig({})).toEqual(DEFAULT_E2E_CONFIG);
  });

  it("supports explicit custom ports", () => {
    const config = createE2EConfig({
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT: "9299",
      NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT: "8281",
      NEXT_PUBLIC_FIREBASE_HUB_EMULATOR_PORT: "4645",
      E2E_NEXTJS_PORT: "3100",
    });
    expect(config).toMatchObject({
      authPort: 9299,
      firestorePort: 8281,
      hubPort: 4645,
      nextjsPort: 3100,
    });
  });

  it("accepts only loopback emulator hosts", () => {
    expect(() => assertLocalEmulatorHost("127.0.0.1", "Auth")).not.toThrow();
    expect(() => assertLocalEmulatorHost("localhost", "Auth")).not.toThrow();
    expect(() => assertLocalEmulatorHost("firebase.example.com", "Auth")).toThrow(
      /must be local/,
    );
  });

  it("rejects production projects and hosts", () => {
    expect(() =>
      validateE2EConfig({
        ...DEFAULT_E2E_CONFIG,
        authHost: "identitytoolkit.googleapis.com",
      }),
    ).toThrow(/must be local/);
    expect(() =>
      validateE2EConfig({ ...DEFAULT_E2E_CONFIG, projectId: "canil-gcm" }),
    ).toThrow(/demo-/);
  });

  it("stays synchronized with firebase.json", () => {
    const firebase = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    );
    expect(DEFAULT_E2E_CONFIG).toMatchObject({
      authHost: firebase.emulators.auth.host,
      authPort: firebase.emulators.auth.port,
      firestoreHost: firebase.emulators.firestore.host,
      firestorePort: firebase.emulators.firestore.port,
      hubHost: firebase.emulators.hub.host,
      hubPort: firebase.emulators.hub.port,
    });
  });
});
