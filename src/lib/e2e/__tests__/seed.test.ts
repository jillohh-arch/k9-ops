import { describe, expect, it } from "vitest";

// The production entrypoint is intentionally plain ESM so Node can execute it
// without a transpiler during emulator startup.
import {
  TEST_SCENARIOS,
  parseArgs,
  raToAuthEmail,
  runSeed,
} from "../../../../tools/seed_emulator_auth.mjs";

const options = {
  authEmulator: "http://127.0.0.1:9199",
  firestoreEmulator: "http://127.0.0.1:8181",
  projectId: "demo-k9-ops",
};

function response(body: unknown, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createFakeBackend(config: {
  authFailure?: boolean;
  firestoreFailure?: boolean;
  divergentRead?: boolean;
} = {}) {
  const documents = new Map<string, unknown>();
  const requests: Array<{ body?: string; method: string; url: string }> = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    requests.push({ body: init?.body as string | undefined, method, url });

    if (url.includes("accounts:signUp")) {
      if (config.authFailure) return response("AUTH_DISABLED", 503);
      const payload = JSON.parse(String(init?.body));
      return response({ localId: `uid-${payload.email.split("@")[0]}` });
    }
    if (method === "PATCH") {
      if (config.firestoreFailure) return response("write failed", 500);
      documents.set(url, JSON.parse(String(init?.body)));
      return response({});
    }
    if (method === "GET") {
      const stored = structuredClone(documents.get(url)) as {
        fields?: Record<string, unknown>;
      };
      if (!stored) return response("missing", 404);
      if (config.divergentRead && url.includes("/users/")) {
        delete stored.fields?.access_profile_id;
      }
      return response(stored);
    }
    return response("unexpected", 500);
  };
  return { documents, fetchImpl, requests };
}

describe("HW-2 emulator seed", () => {
  it("uses the same normalized RA authentication format as the app", () => {
    expect(raToAuthEmail("12.34-5")).toBe("12345@gcm.com.br");
  });

  it("requires all explicit CLI arguments", () => {
    expect(() => parseArgs([])).toThrow(/--auth-emulator is required/);
    expect(
      parseArgs([
        "--auth-emulator",
        options.authEmulator,
        "--firestore-emulator",
        options.firestoreEmulator,
        "--project",
        options.projectId,
      ]),
    ).toEqual(options);
  });

  it("uses returned UIDs and creates all user-profile associations", async () => {
    const backend = createFakeBackend();
    await runSeed(options, { fetchImpl: backend.fetchImpl, log: () => undefined });

    for (const scenario of TEST_SCENARIOS) {
      const userWrite = backend.requests.find(
        (request) =>
          request.method === "PATCH" &&
          request.url.endsWith(`/users/${scenario.ra}`),
      );
      const body = JSON.parse(String(userWrite?.body));
      expect(body.fields.auth_uid.stringValue).toBe(`uid-${scenario.ra}`);
      expect(body.fields.access_profile_id.stringValue).toBe(scenario.profileId);
    }
  });

  it("creates the exact canonical, legacy and no-access profiles", async () => {
    const backend = createFakeBackend();
    await runSeed(options, { fetchImpl: backend.fetchImpl, log: () => undefined });

    const profilePermissions = TEST_SCENARIOS.map((scenario: (typeof TEST_SCENARIOS)[number]) => {
      const entry = [...backend.documents.entries()].find(([url]) =>
        url.endsWith(`/access_profiles/${scenario.profileId}`),
      );
      return (entry?.[1] as { fields: { permissions: unknown } }).fields.permissions;
    });
    expect(profilePermissions[0]).toMatchObject({
      mapValue: { fields: { health: { mapValue: { fields: { read: { booleanValue: true } } } } } },
    });
    expect(profilePermissions[1]).toMatchObject({
      mapValue: { fields: { health: { mapValue: { fields: { view: { booleanValue: true } } } } } },
    });
    expect(profilePermissions[2]).toEqual({ mapValue: { fields: {} } });
  });

  it("fails on Auth and Firestore errors", async () => {
    await expect(
      runSeed(options, { fetchImpl: createFakeBackend({ authFailure: true }).fetchImpl }),
    ).rejects.toThrow(/Auth identity creation failed/);
    await expect(
      runSeed(options, {
        fetchImpl: createFakeBackend({ firestoreFailure: true }).fetchImpl,
      }),
    ).rejects.toThrow(/User association write failed/);
  });

  it("fails when independent Firestore verification diverges", async () => {
    await expect(
      runSeed(options, {
        fetchImpl: createFakeBackend({ divergentRead: true }).fetchImpl,
      }),
    ).rejects.toThrow(/verification diverged/);
  });

  it("rejects non-local hosts and non-demo projects", async () => {
    await expect(
      runSeed({ ...options, authEmulator: "https://identitytoolkit.googleapis.com" }),
    ).rejects.toThrow(/must be local/);
    await expect(runSeed({ ...options, projectId: "canil-gcm" })).rejects.toThrow(
      /demo-/,
    );
  });

  it("never logs credentials or identity values", async () => {
    const logs: string[] = [];
    await runSeed(options, {
      fetchImpl: createFakeBackend().fetchImpl,
      log: (message: string) => logs.push(message),
    });
    const output = logs.join("\n");
    for (const scenario of TEST_SCENARIOS) {
      expect(output).not.toContain(scenario.ra);
      expect(output).not.toContain(scenario.password);
      expect(output).not.toContain(raToAuthEmail(scenario.ra));
      expect(output).not.toContain(`uid-${scenario.ra}`);
    }
    expect(logs).toHaveLength(9);
  });
});
