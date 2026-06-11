import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);

function getArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function hasFlag(name) {
  return args.includes(name);
}

function normalizePermissions(permissions) {
  return Object.fromEntries(
    Object.entries(permissions ?? {}).map(([moduleId, actions]) => [
      moduleId,
      Object.fromEntries((Array.isArray(actions) ? actions : []).map((action) => [action, true])),
    ]),
  );
}

const projectId = getArg("--project") ?? "canil-gcm";
const serviceAccountPath = getArg("--service-account");
const actor = getArg("--actor") ?? "seed_access_profiles";
const force = hasFlag("--force");

const credential = serviceAccountPath
  ? cert(JSON.parse(await readFile(resolve(serviceAccountPath), "utf8")))
  : applicationDefault();

initializeApp({
  credential,
  projectId,
});

const policyPath = resolve(
  "src",
  "lib",
  "permissions",
  "default-access-profiles.json",
);
const policy = JSON.parse(await readFile(policyPath, "utf8"));
const db = getFirestore();
const collection = db.collection("access_profiles");

const result = {
  actor,
  collection: "access_profiles",
  created: [],
  force,
  project: projectId,
  skipped: [],
  updated: [],
  version: policy.version,
};

for (const profile of policy.profiles) {
  const ref = collection.doc(profile.id);
  const snapshot = await ref.get();
  const payload = {
    ...profile,
    permissions: normalizePermissions(profile.permissions),
    seed_source: "k9-ops-web",
    seed_version: policy.version,
    updated_at: FieldValue.serverTimestamp(),
    updated_by: actor,
  };

  if (snapshot.exists && !force) {
    result.skipped.push(profile.id);
    continue;
  }

  if (!snapshot.exists) {
    payload.created_at = FieldValue.serverTimestamp();
    payload.created_by = actor;
    result.created.push(profile.id);
  } else {
    result.updated.push(profile.id);
  }

  await ref.set(payload, { merge: true });
}

console.log(JSON.stringify(result, null, 2));
