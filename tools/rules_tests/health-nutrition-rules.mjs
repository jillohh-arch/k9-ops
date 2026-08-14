import {readFileSync} from 'node:fs';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {deleteDoc, doc, getDoc, setDoc, updateDoc} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-k9-ops';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST;

if (!PROJECT_ID.startsWith('demo-')) {
  throw new Error(`Rules tests require a demo-* project, received: ${PROJECT_ID}`);
}

if (!FIRESTORE_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST must point to a local emulator');
}

const emulatorUrl = new URL(`http://${FIRESTORE_HOST}`);
const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

if (!localHosts.has(emulatorUrl.hostname) || !emulatorUrl.port) {
  throw new Error(
    `Firestore Rules tests reject non-local emulator host: ${FIRESTORE_HOST}`,
  );
}

const AUTHORIZED_RA = 'rules-nutrition-authorized';
const OTHER_RA = 'rules-nutrition-other';
const OWNED_DOG = 'rules-nutrition-owned-dog';
const OTHER_DOG = 'rules-nutrition-other-dog';
const PROFILE_ID = 'rules-nutrition-own-records';
const PLAN_ID = 'active-plan';

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    host: emulatorUrl.hostname,
    port: Number(emulatorUrl.port),
    rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
  },
});

const tests = [];

function test(name, run) {
  tests.push({name, run});
}

function authenticatedDb(ra = AUTHORIZED_RA) {
  return testEnv.authenticatedContext(`uid-${ra}`, {ra}).firestore();
}

function planRef(db, dogId = OWNED_DOG, planId = PLAN_ID) {
  return doc(db, 'dogs', dogId, 'nutrition_plans', planId);
}

async function seedFixtures() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'access_profiles', PROFILE_ID), {
      status: 'active',
      scope: 'own_records',
    });

    for (const ra of [AUTHORIZED_RA, OTHER_RA]) {
      await setDoc(doc(db, 'users', ra), {
        ra,
        access_profile_id: PROFILE_ID,
        access_scope: 'own_records',
      });
    }

    await setDoc(doc(db, 'dogs', OWNED_DOG), {
      name: 'Nutrition Rules Dog',
      conductorRa: AUTHORIZED_RA,
    });
    await setDoc(doc(db, 'dogs', OTHER_DOG), {
      name: 'Other Nutrition Rules Dog',
      conductorRa: OTHER_RA,
    });

    await setDoc(planRef(db), {status: 'active', revision: 1});
    await setDoc(planRef(db, OTHER_DOG), {status: 'active', revision: 1});
  });
}

async function resetAndSeed() {
  await testEnv.clearFirestore();
  await seedFixtures();
}

test('authenticated user with dog access can read nutrition_plans', async () => {
  await resetAndSeed();
  await assertSucceeds(getDoc(planRef(authenticatedDb())));
});

test('authenticated user without dog access cannot read nutrition_plans', async () => {
  await resetAndSeed();
  await assertFails(getDoc(planRef(authenticatedDb(), OTHER_DOG)));
});

test('unauthenticated user cannot read nutrition_plans', async () => {
  await resetAndSeed();
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(planRef(db)));
});

test('direct client create of nutrition_plans is denied', async () => {
  await resetAndSeed();
  const db = authenticatedDb();
  await assertFails(
    setDoc(planRef(db, OWNED_DOG, 'new-plan'), {status: 'active', revision: 1}),
  );
});

test('direct client update of nutrition_plans is denied', async () => {
  await resetAndSeed();
  await assertFails(updateDoc(planRef(authenticatedDb()), {revision: 2}));
});

test('direct client delete of nutrition_plans is denied', async () => {
  await resetAndSeed();
  await assertFails(deleteDoc(planRef(authenticatedDb())));
});

let failed = 0;

try {
  for (const {name, run} of tests) {
    try {
      await run();
      console.log(`  PASS ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`  FAIL ${name}`);
      console.error(error);
    }
  }
} finally {
  await testEnv.cleanup();
}

console.log(
  `\nHealth Nutrition Rules: ${tests.length - failed} passed, ${failed} failed, 0 skipped`,
);

if (failed > 0) {
  process.exit(1);
}
