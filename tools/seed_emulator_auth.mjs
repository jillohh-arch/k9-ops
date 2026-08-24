import { pathToFileURL } from "node:url";

const AUTH_DOMAIN = "gcm.com.br";

/*
 * NUT-WEB-5B.E — why this script needs an authorization header at all.
 *
 * The canonical Rules mirror is fail-closed: `users/{ra}` writes require an
 * audited-record shape and `access_profiles` writes are `if false`. A plain
 * REST write is therefore denied (403), and NO client ID token can lift it —
 * that was measured, not assumed.
 *
 * `owner` is the Firestore/Auth Emulator's documented administrative bypass
 * credential. It is NOT a secret, NOT a service account and NOT usable against
 * a real project: only the local emulator honours it. The seed adapts to the
 * hardened Rules; the Rules are never weakened for the seed.
 *
 * Because this token bypasses Rules entirely, every use is gated behind
 * assertEmulatorOnlyTarget() below, which fails CLOSED.
 */
const EMULATOR_OWNER_TOKEN = "owner";

/**
 * Deterministic K9 fixture for the Health Web E2E specs.
 *
 * The E2E suites deep-link to /health/nutrition/dogs/test-dog and
 * /health/readiness/test-dog. Only the fields the real readers actually consume
 * are seeded — `toDogIdentity` (institutional identity, tolerating the legacy
 * pt-BR names) and `parseHealthSummaryWireDoc` (snake_case projection wire doc).
 * No field is invented, and no NutritionPlan is fabricated: Nutrition renders
 * its genuine empty state, which is enough for the cross-navigation affordance.
 */
export const TEST_DOG_FIXTURE = {
  dogId: "test-dog",
  dog: {
    name: "Bono E2E",
    rg: "111222",
    breed: "Pastor Belga Malinois",
    sex: "M",
  },
  /*
   * `health_summary/current` is a server-owned projection. It is seeded so the
   * cockpit renders a VALID operational readiness instead of the technical
   * "sem projeção válida" state — the readiness semantics still come from the
   * projection, never from the Web.
   */
  healthSummary: {
    dog_id: "test-dog",
    readiness_status: "operational",
    readiness_label: "Operacional",
    readiness_reason: "Evidencias em conformidade",
    evaluated_by: "function_v1",
    schema_version: 1,
    active_cases_count: 0,
    active_treatments_count: 0,
    pending_schedule_count: 0,
    overdue_schedule_count: 0,
  },
};

export const TEST_SCENARIOS = [
  {
    key: "canonical",
    ra: "100001",
    password: "TestPassword123!",
    displayName: "Canonical Health E2E",
    profileId: "health-e2e-canonical",
    permissions: { health: { read: true } },
  },
  {
    key: "legacy",
    ra: "100002",
    password: "TestPassword123!",
    displayName: "Legacy Health E2E",
    profileId: "health-e2e-legacy",
    permissions: { health: { view: true } },
  },
  {
    key: "no-access",
    ra: "100003",
    password: "TestPassword123!",
    displayName: "No Access Health E2E",
    profileId: "health-e2e-no-access",
    permissions: {},
  },
];

export function normalizeRa(value) {
  return String(value).replace(/\D/g, "");
}

export function raToAuthEmail(ra) {
  return `${normalizeRa(ra)}@${AUTH_DOMAIN}`;
}

export function parseEmulatorEndpoint(value, name) {
  if (!value) throw new Error(`${name} emulator argument is required`);
  const url = new URL(value.includes("://") ? value : `http://${value}`);
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`${name} emulator host must be local`);
  }
  if (!url.port) throw new Error(`${name} emulator port is required`);
  return `${url.protocol}//${url.hostname}:${url.port}`;
}

export function parseArgs(args = process.argv.slice(2)) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (["--auth-emulator", "--firestore-emulator", "--project"].includes(flag)) {
      if (!value || value.startsWith("--")) {
        throw new Error(`${flag} requires a value`);
      }
      parsed[flag] = value;
      index += 1;
    }
  }

  for (const flag of ["--auth-emulator", "--firestore-emulator", "--project"]) {
    if (!parsed[flag]) throw new Error(`${flag} is required`);
  }

  const projectId = parsed["--project"];
  if (!projectId.startsWith("demo-")) {
    throw new Error("Emulator project must use the demo- prefix");
  }

  return {
    authEmulator: parseEmulatorEndpoint(parsed["--auth-emulator"], "Auth"),
    firestoreEmulator: parseEmulatorEndpoint(
      parsed["--firestore-emulator"],
      "Firestore",
    ),
    projectId,
  };
}

/**
 * FAIL-CLOSED gate for the emulator administrative bypass.
 *
 * `Bearer owner` must never leave the loopback interface. This helper is the
 * single choke point: it re-validates BOTH endpoints and the project id
 * immediately before any privileged header is attached, so a caller cannot
 * reach a remote target by constructing the options object by hand.
 *
 * Anything not provably local, or any project without the `demo-` prefix,
 * throws instead of degrading to an unauthenticated attempt.
 */
export function assertEmulatorOnlyTarget(options) {
  parseEmulatorEndpoint(options?.authEmulator, "Auth");
  parseEmulatorEndpoint(options?.firestoreEmulator, "Firestore");

  if (!options?.projectId?.startsWith("demo-")) {
    throw new Error(
      "Refusing privileged emulator write: project must use the demo- prefix",
    );
  }

  for (const [name, endpoint] of [
    ["Auth", options.authEmulator],
    ["Firestore", options.firestoreEmulator],
  ]) {
    const hostname = new URL(endpoint).hostname.toLowerCase();
    if (hostname !== "127.0.0.1" && hostname !== "localhost") {
      throw new Error(
        `Refusing privileged emulator write: ${name} target is not loopback`,
      );
    }
  }
}

/**
 * Headers for a privileged (Rules-bypassing) emulator write.
 * Only reachable once assertEmulatorOnlyTarget() has passed.
 */
function emulatorAdminHeaders(options) {
  assertEmulatorOnlyTarget(options);
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${EMULATOR_OWNER_TOKEN}`,
  };
}

function jsonResponseError(operation, response) {
  return new Error(`${operation} failed with HTTP ${response.status}`);
}

async function readJson(response, operation) {
  if (!response.ok) throw jsonResponseError(operation, response);
  return response.json();
}

async function createOrResolveIdentity(fetchImpl, authBase, scenario) {
  const body = {
    email: raToAuthEmail(scenario.ra),
    password: scenario.password,
    displayName: scenario.displayName,
    returnSecureToken: true,
  };
  const signUp = await fetchImpl(
    `${authBase}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  let payload;
  if (signUp.ok) {
    payload = await signUp.json();
  } else if ((await signUp.text()).includes("EMAIL_EXISTS")) {
    const signIn = await fetchImpl(
      `${authBase}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: body.email,
          password: body.password,
          returnSecureToken: true,
        }),
      },
    );
    payload = await readJson(signIn, "Auth identity resolution");
  } else {
    throw jsonResponseError("Auth identity creation", signUp);
  }

  if (typeof payload.localId !== "string" || !payload.localId) {
    throw new Error("Auth identity response did not include a UID");
  }
  return payload.localId;
}

/**
 * Mirrors the institutional `ra` / `access_profile_id` custom claims onto the
 * emulator identity.
 *
 * This is NOT cosmetic. The canonical Rules resolve authorization through
 * `authState()`, which looks the user up by `request.auth.token.ra`. Without the
 * claim the token is unusable for scoped reads: `canAccessDogRecord()` fails
 * closed, and `dogs/{id}/health_summary/current` and `operational_restrictions`
 * are denied — the K9 context never resolves and the E2E routes cannot render.
 *
 * In production these claims are set by the Admin SDK (see
 * tools/consolidate_access_profiles.mjs). Here the Auth Emulator's
 * `accounts:update` endpoint provides the same result with no real credential.
 */
async function applyInstitutionalClaims(fetchImpl, options, uid, scenario) {
  const response = await fetchImpl(
    `${options.authEmulator}/identitytoolkit.googleapis.com/v1/projects/${options.projectId}/accounts:update`,
    {
      method: "POST",
      headers: emulatorAdminHeaders(options),
      body: JSON.stringify({
        localId: uid,
        customAttributes: JSON.stringify({
          ra: scenario.ra,
          access_profile_id: scenario.profileId,
        }),
      }),
    },
  );
  if (!response.ok) throw jsonResponseError("Institutional claim write", response);
}

function firestoreValue(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  // A Date must land as a real Firestore timestamp, not as a map of its fields:
  // the projection wire parser reads these through parseTimestamp().
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(firestoreValue) } };
  }
  if (value && typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, firestoreValue(item)]),
        ),
      },
    };
  }
  return { stringValue: String(value) };
}

function documentBody(fields) {
  return {
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, firestoreValue(value)]),
    ),
  };
}

function documentUrl(options, collection, id) {
  return `${options.firestoreEmulator}/v1/projects/${options.projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
}

/**
 * Seeds the deterministic `test-dog` K9 the E2E specs deep-link to.
 *
 * Two documents, both minimal and both read by real code paths:
 *   dogs/test-dog                       -> toDogIdentity (institutional identity)
 *   dogs/test-dog/health_summary/current -> parseHealthSummaryWireDoc (projection)
 *
 * Timestamps are generated at seed time so the projection is fresh rather than
 * stale, and `now` is injectable to keep the seed deterministic under test.
 */
async function seedTestDog(fetchImpl, options, now = new Date()) {
  const dogUrl = documentUrl(options, "dogs", TEST_DOG_FIXTURE.dogId);
  const summaryUrl = documentUrl(
    options,
    `dogs/${TEST_DOG_FIXTURE.dogId}/health_summary`,
    "current",
  );

  const summaryFields = {
    ...TEST_DOG_FIXTURE.healthSummary,
    readiness_updated_at: now,
    last_evaluated_at: now,
    updated_at: now,
  };

  await writeDocument(fetchImpl, options, dogUrl, TEST_DOG_FIXTURE.dog, "Dog fixture write");
  await writeDocument(
    fetchImpl,
    options,
    summaryUrl,
    summaryFields,
    "Health summary fixture write",
  );

  // Independent read-back: a write that cannot be verified is not a fixture.
  const storedDog = await readDocument(
    fetchImpl,
    options,
    dogUrl,
    "Dog fixture verification",
  );
  const storedSummary = await readDocument(
    fetchImpl,
    options,
    summaryUrl,
    "Health summary fixture verification",
  );

  for (const [field, expected] of Object.entries(TEST_DOG_FIXTURE.dog)) {
    assertEqual(storedDog[field], expected, "Dog fixture verification diverged");
  }
  if (storedSummary.readiness_status !== TEST_DOG_FIXTURE.healthSummary.readiness_status) {
    throw new Error("Health summary fixture verification diverged");
  }
}

async function writeDocument(fetchImpl, options, url, fields, operation) {
  const response = await fetchImpl(url, {
    method: "PATCH",
    headers: emulatorAdminHeaders(options),
    body: JSON.stringify(documentBody(fields)),
  });
  if (!response.ok) throw jsonResponseError(operation, response);
}

function fieldValue(field) {
  if (!field) return undefined;
  if ("stringValue" in field) return field.stringValue;
  if ("booleanValue" in field) return field.booleanValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("arrayValue" in field) {
    return (field.arrayValue.values ?? []).map(fieldValue);
  }
  if ("mapValue" in field) {
    return Object.fromEntries(
      Object.entries(field.mapValue.fields ?? {}).map(([key, value]) => [
        key,
        fieldValue(value),
      ]),
    );
  }
  return undefined;
}

async function readDocument(fetchImpl, options, url, operation) {
  /*
   * Verification reads also need the admin credential: under the hardened Rules
   * an anonymous read of `users/{ra}` is denied (403), so an unauthenticated
   * verification could not distinguish "write failed" from "cannot read".
   */
  const payload = await readJson(
    await fetchImpl(url, { headers: emulatorAdminHeaders(options) }),
    operation,
  );
  return Object.fromEntries(
    Object.entries(payload.fields ?? {}).map(([key, value]) => [
      key,
      fieldValue(value),
    ]),
  );
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message);
  }
}

async function seedScenario(fetchImpl, options, scenario) {
  const uid = await createOrResolveIdentity(
    fetchImpl,
    options.authEmulator,
    scenario,
  );
  const userUrl = documentUrl(options, "users", scenario.ra);
  const profileUrl = documentUrl(
    options,
    "access_profiles",
    scenario.profileId,
  );

  const userFields = {
    active: true,
    status: "active",
    ra: scenario.ra,
    auth_uid: uid,
    email: raToAuthEmail(scenario.ra),
    name: scenario.displayName,
    access_profile_id: scenario.profileId,
  };
  const profileFields = {
    id: scenario.profileId,
    name: scenario.displayName,
    description: "Synthetic HW-2 emulator profile",
    level: "read-only",
    module_tags: ["health"],
    role_keys: [],
    scope: "global",
    seed_version: 1,
    slug: scenario.profileId,
    status: "active",
    tone: "cyan",
    ui_hidden: true,
    permissions: scenario.permissions,
  };

  await applyInstitutionalClaims(fetchImpl, options, uid, scenario);

  await writeDocument(fetchImpl, options, userUrl, userFields, "User association write");
  await writeDocument(fetchImpl, options, profileUrl, profileFields, "Profile write");

  const storedUser = await readDocument(
    fetchImpl,
    options,
    userUrl,
    "User association verification",
  );
  const storedProfile = await readDocument(
    fetchImpl,
    options,
    profileUrl,
    "Profile verification",
  );

  for (const [field, expected] of Object.entries(userFields)) {
    assertEqual(storedUser[field], expected, "User association verification diverged");
  }
  for (const [field, expected] of Object.entries(profileFields)) {
    assertEqual(storedProfile[field], expected, "Profile verification diverged");
  }
}

export async function runSeed(options, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const log = dependencies.log ?? console.log;
  // Fail closed BEFORE anything is written: this is the same gate the
  // privileged headers use, asserted once up front so a remote target can never
  // reach even the first request.
  assertEmulatorOnlyTarget(options);

  for (const scenario of TEST_SCENARIOS) {
    await seedScenario(fetchImpl, options, scenario);
    log(`${scenario.key} identity: valid`);
    log(`${scenario.key} user association: valid`);
    log(`${scenario.key} profile: valid`);
  }

  await seedTestDog(fetchImpl, options, dependencies.now);
  log("test-dog fixture: valid");
  log("test-dog health summary: valid");
}

async function main() {
  await runSeed(parseArgs());
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      "seed failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exitCode = 1;
  });
}
