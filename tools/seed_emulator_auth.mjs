/**
 * Firebase Auth Emulator Seed Script for HW-2 E2E Tests
 *
 * Creates test users with different permission levels:
 * - canonical: Full health.read access
 * - legacy: Only health.view (no health.read)
 * - no-access: No health permissions
 *
 * Uses emulator-specific authentication endpoint.
 * Port configuration is sourced from command-line arguments.
 */

// Test users with deterministic UIDs for idempotency
const TEST_USERS = [
  {
    email: "canonical@hw2-test.local",
    password: "TestPassword123!",
    displayName: "Canonical Test User",
    uid: "canonical-test-user-uid",
    profileId: "canonical-profile",
  },
  {
    email: "legacy@hw2-test.local",
    password: "TestPassword123!",
    displayName: "Legacy Test User",
    uid: "legacy-test-user-uid",
    profileId: "legacy-profile",
  },
  {
    email: "noaccess@hw2-test.local",
    password: "TestPassword123!",
    displayName: "No Access Test User",
    uid: "noaccess-test-user-uid",
    profileId: "noaccess-profile",
  },
];

const DEFAULT_AUTH_EMULATOR = "http://127.0.0.1:9199";
const DEFAULT_FIRESTORE_EMULATOR = "127.0.0.1:8181";
const DEFAULT_PROJECT = "demo-k9-ops";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    authEmulator: DEFAULT_AUTH_EMULATOR,
    firestoreEmulator: DEFAULT_FIRESTORE_EMULATOR,
    projectId: DEFAULT_PROJECT,
  };
  let force = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--auth-emulator":
        options.authEmulator = args[++i];
        break;
      case "--firestore-emulator":
        options.firestoreEmulator = args[++i];
        break;
      case "--project":
        options.projectId = args[++i];
        break;
      case "--force":
        force = true;
        break;
    }
  }

  return { options, force };
}

async function signUpUser(email, password, uid, displayName, authEmulator, projectId) {
  const response = await fetch(`${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      displayName,
      idToken: undefined,
      localId: uid, // Request specific UID for deterministic testing
      returnSecureToken: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    // Ignore if user already exists (idempotent)
    if (error.includes("EMAIL_EXISTS") || error.includes("DUPLICATE_EMAIL") || error.includes("already exists")) {
      return { status: "exists", uid: uid };
    }
    throw new Error(`Failed to create user ${email}: ${error}`);
  }

  const data = await response.json();
  return { status: "created", uid: data.localId || uid };
}

async function createAccessProfile(profileId, permissions, displayName, firestoreEmulator, projectId) {
  const url = `http://${firestoreEmulator}/v1/projects/${projectId}/databases/(default)/documents/access_profiles/${profileId}`;

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          id: { stringValue: profileId },
          displayName: { stringValue: displayName },
          description: { stringValue: `Test profile for ${profileId}` },
          isActive: { booleanValue: true },
          permissions: {
            mapValue: {
              fields: Object.fromEntries(
                Object.entries(permissions).map(([moduleId, actions]) => [
                  moduleId,
                  {
                    mapValue: {
                      fields: Object.fromEntries(
                        Object.entries(actions).map(([action, value]) => [action, { booleanValue: value }])
                      ),
                    },
                  },
                ])
              ),
            },
          },
        },
      }),
    });

    if (!response.ok && response.status !== 409) {
      throw new Error(`Failed to create profile ${profileId}: HTTP ${response.status}`);
    }

    // Verify the document was written correctly
    const verifyResponse = await fetch(url);
    if (!verifyResponse.ok) {
      throw new Error(`Failed to verify profile ${profileId} creation`);
    }

    const verifyData = await verifyResponse.json();
    if (!verifyData.fields || !verifyData.fields.permissions) {
      throw new Error(`Profile ${profileId} verification failed: missing permissions field`);
    }

    return { status: response.status === 409 ? "exists" : "created" };
  } catch (err) {
    throw new Error(`Failed to create/verify profile ${profileId}: ${err.message}`);
  }
}

async function verifyEmulatorConnection(authEmulator, projectId) {
  try {
    const response = await fetch(`${authEmulator}/identitytoolkit.googleapis.com/v1/projects/${projectId}/config`);
    if (!response.ok && response.status !== 404) {
      throw new Error(`Auth emulator health check failed: HTTP ${response.status}`);
    }
    return true;
  } catch (err) {
    throw new Error(`Auth emulator not reachable at ${authEmulator}: ${err.message}`);
  }
}

async function main() {
  const { options, force } = parseArgs();

  console.log("[Seed] Firebase Auth Emulator Seed");
  console.log("[Seed] Project: " + options.projectId);
  console.log("[Seed] Auth Emulator: " + options.authEmulator);
  console.log("[Seed] Firestore Emulator: " + options.firestoreEmulator);
  console.log("");

  // Verify emulator is running
  await verifyEmulatorConnection(options.authEmulator, options.projectId);
  console.log("[Seed] Emulators verified and ready");

  // Create test users
  console.log("\n[Seed] Creating test users...\n");
  const userResults = [];

  for (const user of TEST_USERS) {
    console.log("[Seed] Creating user: [REDACTED] (" + user.uid + ")");

    try {
      const result = await signUpUser(user.email, user.password, user.uid, user.displayName, options.authEmulator, options.projectId);
      userResults.push({ ...user, result });
      console.log("[Seed]   " + (result.status === "created" ? "Created" : "Exists") + " with UID: " + result.uid);
    } catch (error) {
      if (force) throw error;
      console.log("[Seed]   Error: " + error.message);
    }
  }

  // Create access profiles
  console.log("\n[Seed] Creating access profiles...\n");

  try {
    // Canonical profile with health.read
    const canonicalResult = await createAccessProfile(
      "canonical-profile",
      {
        health: { read: true, view: true },
        training: { read: true, write: true },
      },
      "Canonical Health Access",
      options.firestoreEmulator,
      options.projectId
    );
    console.log("[Seed]   canonical-profile (" + canonicalResult.status + ")");
    console.log("[Seed]     - health.read: true");
    console.log("[Seed]     - health.view: true");
  } catch (error) {
    console.error("[Seed]   canonical-profile FAILED: " + error.message);
    throw error;
  }

  try {
    // Legacy profile with only health.view
    const legacyResult = await createAccessProfile(
      "legacy-profile",
      {
        health: { view: true },
      },
      "Legacy Health View Only",
      options.firestoreEmulator,
      options.projectId
    );
    console.log("[Seed]   legacy-profile (" + legacyResult.status + ")");
    console.log("[Seed]     - health.view: true");
    console.log("[Seed]     - health.read: NOT PRESENT (legacy adapter required)");
  } catch (error) {
    console.error("[Seed]   legacy-profile FAILED: " + error.message);
    throw error;
  }

  try {
    // No-access profile
    const noaccessResult = await createAccessProfile(
      "noaccess-profile",
      {
        training: { read: true },
      },
      "No Health Access",
      options.firestoreEmulator,
      options.projectId
    );
    console.log("[Seed]   noaccess-profile (" + noaccessResult.status + ")");
    console.log("[Seed]     - health permissions: NONE");
  } catch (error) {
    console.error("[Seed]   noaccess-profile FAILED: " + error.message);
    throw error;
  }

  console.log("\n[Seed] Seed complete");
  console.log("\n[Seed] Test users (canonical identifiers only):");
  console.log("  Canonical: canonical@hw2-test.local / [REDACTED]");
  console.log("  Legacy:    legacy@hw2-test.local / [REDACTED]");
  console.log("  No Access: noaccess@hw2-test.local / [REDACTED]");
}

main().catch((error) => {
  console.error("[Seed] Fatal error:", error);
  process.exit(1);
});
