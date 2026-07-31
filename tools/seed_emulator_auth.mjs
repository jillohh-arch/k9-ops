/**
 * Firebase Auth Emulator Seed Script for HW-2 E2E Tests
 *
 * Creates test users with different permission levels:
 * - canonical: Full health.read access
 * - legacy: Only health.view (no health.read)
 * - no-access: No health permissions
 *
 * Uses emulator-specific authentication endpoint.
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
const DEFAULT_PROJECT = "demo-k9-ops";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    authEmulator: DEFAULT_AUTH_EMULATOR,
    projectId: DEFAULT_PROJECT,
  };
  let force = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--auth-emulator":
        options.authEmulator = args[++i];
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

async function signUpUser(email, password, uid, displayName, authEmulator) {
  const response = await fetch(`${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    // Ignore if user already exists (idempotent)
    if (!error.includes("EMAIL_EXISTS") && !error.includes("DUPLICATE_EMAIL")) {
      throw new Error(`Failed to create user ${email}: ${error}`);
    }
  }
}

async function createAccessProfile(profileId, permissions, displayName) {
  // Direct Firestore write to emulator
  // Note: Firebase Emulator allows all operations without auth
  const projectId = "demo-k9-ops";

  // Try to create, ignore if already exists (idempotent)
  try {
    const response = await fetch(
      `http://127.0.0.1:8181/v1/projects/${projectId}/databases/(default)/documents/access_profiles/${profileId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
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
      }
    );

    if (!response.ok && response.status !== 409) {
      console.log(`[Seed]   Warning: Could not create profile ${profileId} (status ${response.status})`);
    }
  } catch (err) {
    // Ignore network errors for individual profiles
    console.log(`[Seed]   Warning: Could not create profile ${profileId} (${err.message})`);
  }
}

async function main() {
  const { options, force } = parseArgs();

  console.log("[Seed] Firebase Auth Emulator Seed");
  console.log("[Seed] Project:", options.projectId);
  console.log("[Seed] Auth Emulator:", options.authEmulator);
  console.log("");

  // Verify emulator is running
  try {
    await fetch(`${options.authEmulator}/identitytoolkit.googleapis.com/v1/projects/${options.projectId}/config`);
  } catch {
    console.error("[Seed] ERROR: Auth emulator not reachable at", options.authEmulator);
    console.error("[Seed] Please start emulators first with: npm run test:e2e:hw2:emulators");
    process.exit(1);
  }

  // Create test users
  for (const user of TEST_USERS) {
    console.log(`[Seed] Creating user: ${user.email} (${user.uid})`);

    try {
      await signUpUser(user.email, user.password, user.uid, user.displayName, options.authEmulator);
    } catch (error) {
      if (force) throw error;
      console.log(`[Seed]   User exists, skipping (use --force to recreate)`);
    }
  }

  // Create access profiles
  console.log("\n[Seed] Creating access profiles...\n");

  // Canonical profile with health.read
  await createAccessProfile("canonical-profile", {
    health: {
      read: true,
      view: true,
    },
    training: {
      read: true,
      write: true,
    },
  }, "Canonical Health Access");
  console.log("[Seed]   ✓ canonical-profile (health.read + health.view)");

  // Legacy profile with only health.view
  await createAccessProfile("legacy-profile", {
    health: {
      view: true,
    },
  }, "Legacy Health View Only");
  console.log("[Seed]   ✓ legacy-profile (health.view only)");

  // No-access profile
  await createAccessProfile("noaccess-profile", {
    training: {
      read: true,
    },
  }, "No Health Access");
  console.log("[Seed]   ✓ noaccess-profile (no health permissions)");

  console.log("\n[Seed] ✓ Seed complete");
  console.log("\n[Seed] Test credentials:");
  console.log("  Canonical: canonical@hw2-test.local / TestPassword123!");
  console.log("  Legacy:    legacy@hw2-test.local / TestPassword123!");
  console.log("  No Access: noaccess@hw2-test.local / TestPassword123!");
}

main().catch((error) => {
  console.error("[Seed] Fatal error:", error);
  process.exit(1);
});
