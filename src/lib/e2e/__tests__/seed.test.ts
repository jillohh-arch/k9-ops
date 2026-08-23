import { describe, expect, it } from "vitest";

// The production entrypoint is intentionally plain ESM so Node can execute it
// without a transpiler during emulator startup.
import {
  TEST_DOG_FIXTURE,
  TEST_SCENARIOS,
  assertEmulatorOnlyTarget,
  parseArgs,
  raToAuthEmail,
  runSeed,
} from "../../../../tools/seed_emulator_auth.mjs";

// The canonical Seed V6 policy source. This is the exact blob the
// seed_access_profiles.mjs merge would publish; freezing its health.read
// target set here (a pure JSON read — no Firebase, no emulator) is what
// enforces the frozen CLIN-AUTH-BE-4B reconciliation BEFORE any V6 sync.
import accessPolicy from "../../permissions/default-access-profiles.json";

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
  claimFailure?: boolean;
  firestoreFailure?: boolean;
  divergentRead?: boolean;
  dogFixtureFailure?: boolean;
} = {}) {
  const documents = new Map<string, unknown>();
  const requests: Array<{
    body?: string;
    headers?: HeadersInit;
    method: string;
    url: string;
  }> = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    requests.push({
      body: init?.body as string | undefined,
      headers: init?.headers,
      method,
      url,
    });

    if (url.includes("accounts:signUp")) {
      if (config.authFailure) return response("AUTH_DISABLED", 503);
      const payload = JSON.parse(String(init?.body));
      return response({ localId: `uid-${payload.email.split("@")[0]}` });
    }
    // The Auth Emulator claim endpoint (NUT-WEB-5B.E): mirrors ra /
    // access_profile_id onto the identity so Rules can resolve authorization.
    if (url.includes("accounts:update")) {
      if (config.claimFailure) return response("claims rejected", 500);
      return response({});
    }
    if (method === "PATCH") {
      if (config.dogFixtureFailure && url.includes("/dogs/")) {
        return response("dog write failed", 500);
      }
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

/** Authorization header of a recorded request, regardless of HeadersInit shape. */
function authHeaderOf(request: { headers?: HeadersInit }) {
  return new Headers(request.headers ?? {}).get("Authorization");
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
    // 3 scenarios x 3 lines, plus the two test-dog fixture lines.
    expect(logs).toHaveLength(11);
  });
});

// ---------------------------------------------------------------------------
// NUT-WEB-5B.E — emulator-only privilege and the deterministic K9 fixture
// ---------------------------------------------------------------------------

/**
 * The seed writes with the Firestore Emulator's `Bearer owner` administrative
 * bypass, because the canonical fail-closed Rules deny these writes to every
 * client token. That privilege is acceptable ONLY against a local emulator, so
 * these tests treat "cannot possibly reach a real project" as the contract —
 * and additionally lock the fixture the E2E specs depend on.
 */
describe("NUT-WEB-5B.E — emulator-only privileged seed", () => {
  it("refuses a remote Firestore target before any write", async () => {
    const backend = createFakeBackend();
    await expect(
      runSeed(
        { ...options, firestoreEmulator: "https://firestore.googleapis.com" },
        { fetchImpl: backend.fetchImpl, log: () => undefined },
      ),
    ).rejects.toThrow(/must be local/);
    // Fail-closed means nothing was attempted at all, not "attempted and denied".
    expect(backend.requests).toHaveLength(0);
  });

  it("refuses a remote Auth target before any write", async () => {
    const backend = createFakeBackend();
    await expect(
      runSeed(
        { ...options, authEmulator: "https://identitytoolkit.googleapis.com" },
        { fetchImpl: backend.fetchImpl, log: () => undefined },
      ),
    ).rejects.toThrow(/must be local/);
    expect(backend.requests).toHaveLength(0);
  });

  it("refuses a non-demo project even on a local host", async () => {
    const backend = createFakeBackend();
    await expect(
      runSeed(
        { ...options, projectId: "canil-gcm" },
        { fetchImpl: backend.fetchImpl, log: () => undefined },
      ),
    ).rejects.toThrow(/demo-/);
    expect(backend.requests).toHaveLength(0);
  });

  it("guards the privileged header directly, for every unsafe shape", () => {
    expect(() => assertEmulatorOnlyTarget(options)).not.toThrow();
    for (const unsafe of [
      { ...options, authEmulator: "http://10.0.0.5:9199" },
      { ...options, firestoreEmulator: "http://firestore.example.com:8181" },
      { ...options, projectId: "prod-k9" },
      {},
      undefined,
    ]) {
      expect(() => assertEmulatorOnlyTarget(unsafe)).toThrow();
    }
  });

  it("sends Bearer owner on every Firestore write and verification read", async () => {
    const backend = createFakeBackend();
    await runSeed(options, { fetchImpl: backend.fetchImpl, log: () => undefined });

    const firestoreCalls = backend.requests.filter((request) =>
      request.url.startsWith(options.firestoreEmulator),
    );
    expect(firestoreCalls.length).toBeGreaterThan(0);
    for (const call of firestoreCalls) {
      expect(authHeaderOf(call)).toBe("Bearer owner");
    }
  });

  it("keeps every request on the local emulator endpoints", async () => {
    const backend = createFakeBackend();
    await runSeed(options, { fetchImpl: backend.fetchImpl, log: () => undefined });

    for (const request of backend.requests) {
      const host = new URL(request.url).hostname;
      expect(host).toBe("127.0.0.1");
    }
    // No production/staging surface may appear anywhere in the traffic.
    const traffic = backend.requests.map((request) => request.url).join(" ");
    expect(traffic).not.toMatch(/googleapis\.com\/v1\/projects\/(?!demo-)/);
    expect(traffic).not.toContain("canil-gcm");
    expect(traffic).not.toContain("firebaseio.com");
  });

  it("requires no real credential: only the literal emulator owner token", async () => {
    const backend = createFakeBackend();
    await runSeed(options, { fetchImpl: backend.fetchImpl, log: () => undefined });

    for (const request of backend.requests) {
      const header = authHeaderOf(request);
      if (header !== null) expect(header).toBe("Bearer owner");
      // Never a JWT, service-account assertion or refresh/access token.
      expect(String(request.body ?? "")).not.toMatch(/private_key|refresh_token|serviceAccount/);
      expect(header ?? "").not.toMatch(/^Bearer ey[A-Za-z0-9_-]+\./);
    }
  });

  it("mirrors the institutional ra claim onto each identity", async () => {
    const backend = createFakeBackend();
    await runSeed(options, { fetchImpl: backend.fetchImpl, log: () => undefined });

    for (const scenario of TEST_SCENARIOS) {
      const claimCall = backend.requests.find(
        (request) =>
          request.url.includes("accounts:update") &&
          String(request.body).includes(`uid-${scenario.ra}`),
      );
      expect(claimCall).toBeDefined();
      const attributes = JSON.parse(
        JSON.parse(String(claimCall?.body)).customAttributes as string,
      );
      // Rules resolve authorization through request.auth.token.ra.
      expect(attributes.ra).toBe(scenario.ra);
      expect(attributes.access_profile_id).toBe(scenario.profileId);
    }
  });

  it("fails closed when the claim write is rejected", async () => {
    await expect(
      runSeed(options, {
        fetchImpl: createFakeBackend({ claimFailure: true }).fetchImpl,
        log: () => undefined,
      }),
    ).rejects.toThrow(/Institutional claim write failed/);
  });
});

describe("NUT-WEB-5B.E — deterministic test-dog fixture", () => {
  it("exposes a stable dogId the E2E specs can deep-link to", () => {
    expect(TEST_DOG_FIXTURE.dogId).toBe("test-dog");
    // A fixture whose id drifts is not a fixture.
    expect(TEST_DOG_FIXTURE.dog.name).toBeTruthy();
  });

  it("seeds the institutional dog document and its readiness projection", async () => {
    const backend = createFakeBackend();
    await runSeed(options, { fetchImpl: backend.fetchImpl, log: () => undefined });

    const dogEntry = [...backend.documents.entries()].find(([url]) =>
      url.endsWith("/dogs/test-dog"),
    );
    const summaryEntry = [...backend.documents.entries()].find(([url]) =>
      url.endsWith("/dogs/test-dog/health_summary/current"),
    );
    expect(dogEntry).toBeDefined();
    expect(summaryEntry).toBeDefined();

    const dogFields = (dogEntry?.[1] as { fields: Record<string, { stringValue?: string }> })
      .fields;
    // Read by toDogIdentity, tolerating the legacy pt-BR names.
    expect(dogFields.name.stringValue).toBe(TEST_DOG_FIXTURE.dog.name);
    expect(dogFields.rg.stringValue).toBe(TEST_DOG_FIXTURE.dog.rg);
  });

  it("writes a projection the canonical wire parser accepts", async () => {
    const backend = createFakeBackend();
    const now = new Date("2026-08-20T12:00:00.000Z");
    await runSeed(options, {
      fetchImpl: backend.fetchImpl,
      log: () => undefined,
      now,
    });

    const summaryEntry = [...backend.documents.entries()].find(([url]) =>
      url.endsWith("/dogs/test-dog/health_summary/current"),
    );
    const fields = (
      summaryEntry?.[1] as {
        fields: Record<string, { stringValue?: string; timestampValue?: string }>;
      }
    ).fields;

    // snake_case wire contract, a VALID operational status, and real timestamps
    // (not a serialized Date object) so freshness parses.
    expect(fields.readiness_status.stringValue).toBe("operational");
    expect(fields.dog_id.stringValue).toBe("test-dog");
    expect(fields.readiness_updated_at.timestampValue).toBe(now.toISOString());
    expect(fields.last_evaluated_at.timestampValue).toBe(now.toISOString());
  });

  it("creates NO nutrition plan: the empty state is the real product state", async () => {
    const backend = createFakeBackend();
    await runSeed(options, { fetchImpl: backend.fetchImpl, log: () => undefined });

    const urls = [...backend.documents.keys()].join(" ");
    expect(urls).not.toContain("nutrition_plans");
    expect(urls).not.toContain("nutritional_prescriptions");
  });

  it("fails closed when the dog fixture write is rejected", async () => {
    await expect(
      runSeed(options, {
        fetchImpl: createFakeBackend({ dogFixtureFailure: true }).fetchImpl,
        log: () => undefined,
      }),
    ).rejects.toThrow(/Dog fixture write failed/);
  });
});

// ---------------------------------------------------------------------------
// HW-ACCESS-SEED-3A — frozen V6 health.read reconciliation (CLIN-AUTH-BE-4B)
// ---------------------------------------------------------------------------

/**
 * The Seed V6 source is unreleased/unexecuted. Before its first sync it MUST
 * match the frozen CLIN-AUTH-BE-4B policy: canonical `health.read` exists on
 * operador_k9 and gestor ONLY. Because the seeder merge is positive-only
 * (an absent key never revokes an existing grant), a read wrongly present here
 * would be added to a profile on first sync and could never be pulled back via
 * the seeder. This is a pure JSON assertion — no Firebase, no emulator.
 */
describe("HW-ACCESS-SEED-3A — V6 health.read frozen target set", () => {
  const profilesById = new Map(
    (accessPolicy.profiles as Array<{ id: string; permissions?: Record<string, string[]> }>).map(
      (profile) => [profile.id, profile],
    ),
  );

  function healthGrants(id: string): string[] | undefined {
    return profilesById.get(id)?.permissions?.health;
  }

  const READ_TARGET_SET = ["operador_k9", "gestor"] as const;
  const READ_EXCLUDED_SET = ["instrutor_k9", "administrador", "almoxarifado"] as const;

  it("keeps the policy pinned at version 6 (no V7)", () => {
    expect(accessPolicy.version).toBe(6);
  });

  it("grants canonical health.read to EXACTLY operador_k9 and gestor", () => {
    const withRead = (accessPolicy.profiles as Array<{ id: string; permissions?: Record<string, string[]> }>)
      .filter((profile) => (profile.permissions?.health ?? []).includes("read"))
      .map((profile) => profile.id)
      .sort();
    expect(withRead).toEqual([...READ_TARGET_SET].sort());
  });

  it.each(READ_TARGET_SET)("includes health.read for %s", (id) => {
    expect(healthGrants(id)).toContain("read");
  });

  it.each(READ_EXCLUDED_SET)("does NOT grant health.read to %s", (id) => {
    expect(healthGrants(id) ?? []).not.toContain("read");
  });

  it("preserves health.view on every profile that already had a health module", () => {
    // 4B is subtractive on read only — the legacy view adapter must survive.
    for (const id of ["operador_k9", "instrutor_k9", "gestor", "administrador"]) {
      expect(healthGrants(id)).toContain("view");
    }
  });

  it("leaves instrutor_k9 and administrador health grants otherwise intact", () => {
    // Only `read` is removed; every sibling health capability stays.
    expect(healthGrants("instrutor_k9")).toEqual(["view", "create", "edit"]);
    expect(healthGrants("administrador")).toEqual([
      "view",
      "create",
      "edit",
      "archive",
      "export",
      "approve",
      "audit",
      "manage_nutrition_plan",
    ]);
  });

  it("keeps almoxarifado with no health module at all", () => {
    expect(healthGrants("almoxarifado")).toBeUndefined();
  });
});
