import { pathToFileURL } from "node:url";

const AUTH_DOMAIN = "gcm.com.br";
const EMULATOR_OWNER_TOKEN = "owner";

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
  {
    key: "nutrition-manager",
    ra: "100004",
    password: "TestPassword123!",
    displayName: "Nutrition Manager E2E",
    profileId: "health-e2e-nutrition-manager",
    level: "manager",
    permissions: {
      health: { view: true, read: true, manage_nutrition_plan: true },
    },
    dog: {
      id: "dog-e2e-nutrition-empty",
      name: "K9 E2E Nutrition Empty",
      registrationNumber: "E2E-NUT-001",
      conductorRa: "100004",
      conductorName: "Nutrition Manager E2E",
      active: true,
      status: "active",
    },
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

async function setEmulatorClaims(fetchImpl, authBase, uid, scenario) {
  const response = await fetchImpl(
    `${authBase}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-api-key`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EMULATOR_OWNER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        localId: uid,
        customAttributes: JSON.stringify({ ra: scenario.ra }),
      }),
    },
  );
  if (!response.ok) throw jsonResponseError("Auth claims write", response);
}

function firestoreValue(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
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

function collectionUrl(options, ...segments) {
  const path = segments.map((segment) => encodeURIComponent(segment)).join("/");
  return `${options.firestoreEmulator}/v1/projects/${options.projectId}/databases/(default)/documents/${path}`;
}

async function writeDocument(fetchImpl, url, fields, operation) {
  const response = await fetchImpl(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${EMULATOR_OWNER_TOKEN}`,
      "Content-Type": "application/json",
    },
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

async function readDocument(fetchImpl, url, operation) {
  const payload = await readJson(
    await fetchImpl(url, {
      headers: { Authorization: `Bearer ${EMULATOR_OWNER_TOKEN}` },
    }),
    operation,
  );
  return Object.fromEntries(
    Object.entries(payload.fields ?? {}).map(([key, value]) => [
      key,
      fieldValue(value),
    ]),
  );
}

async function assertCollectionEmpty(fetchImpl, url, operation) {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${EMULATOR_OWNER_TOKEN}` },
  });
  if (response.status === 404) return;
  const payload = await readJson(response, operation);
  if ((payload.documents ?? []).length !== 0) {
    throw new Error(`${operation} diverged`);
  }
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
  await setEmulatorClaims(fetchImpl, options.authEmulator, uid, scenario);
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
    level: scenario.level ?? "read-only",
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

  await writeDocument(fetchImpl, userUrl, userFields, "User association write");
  await writeDocument(fetchImpl, profileUrl, profileFields, "Profile write");

  let dogUrl;
  if (scenario.dog) {
    dogUrl = documentUrl(options, "dogs", scenario.dog.id);
    const { id: _id, ...dogFields } = scenario.dog;
    await writeDocument(fetchImpl, dogUrl, dogFields, "Dog association write");
  }

  const storedUser = await readDocument(
    fetchImpl,
    userUrl,
    "User association verification",
  );
  const storedProfile = await readDocument(
    fetchImpl,
    profileUrl,
    "Profile verification",
  );

  for (const [field, expected] of Object.entries(userFields)) {
    assertEqual(storedUser[field], expected, "User association verification diverged");
  }
  for (const [field, expected] of Object.entries(profileFields)) {
    assertEqual(storedProfile[field], expected, "Profile verification diverged");
  }

  if (scenario.dog && dogUrl) {
    const { id: dogId, ...dogFields } = scenario.dog;
    const storedDog = await readDocument(
      fetchImpl,
      dogUrl,
      "Dog association verification",
    );
    for (const [field, expected] of Object.entries(dogFields)) {
      assertEqual(storedDog[field], expected, "Dog association verification diverged");
    }
    for (const collection of [
      "nutrition_plans",
      "nutritional_prescriptions",
      "nutrition_prescriptions",
    ]) {
      await assertCollectionEmpty(
        fetchImpl,
        collectionUrl(options, "dogs", dogId, collection),
        `${collection} empty-state verification`,
      );
    }
  }
}

export async function runSeed(options, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const log = dependencies.log ?? console.log;
  parseEmulatorEndpoint(options.authEmulator, "Auth");
  parseEmulatorEndpoint(options.firestoreEmulator, "Firestore");
  if (!options.projectId?.startsWith("demo-")) {
    throw new Error("Emulator project must use the demo- prefix");
  }

  for (const scenario of TEST_SCENARIOS) {
    await seedScenario(fetchImpl, options, scenario);
    log(`${scenario.key} identity: valid`);
    log(`${scenario.key} user association: valid`);
    log(`${scenario.key} profile: valid`);
    if (scenario.dog) {
      log(`${scenario.key} dog association: valid`);
      log(`${scenario.key} nutrition state: empty`);
    }
  }
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
