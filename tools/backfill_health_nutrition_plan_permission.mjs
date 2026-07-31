import {createHash} from "node:crypto";
import process from "node:process";
import {pathToFileURL} from "node:url";
import {applicationDefault, initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";

export const CAPABILITY = "manage_nutrition_plan";
export const TARGET_PROFILE_IDS = ["administrador", "gestor"];

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function snapshotHash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function validateProfile(id, snapshot) {
  if (!snapshot.exists) throw new Error(`TARGET_PROFILE_MISSING:${id}`);
  const data = snapshot.data();
  if (data.status !== "active") throw new Error(`TARGET_PROFILE_INACTIVE:${id}`);
  if (!isPlainObject(data.permissions)) throw new Error(`MALFORMED_PERMISSIONS:${id}`);
  if (!isPlainObject(data.permissions.health)) throw new Error(`MALFORMED_HEALTH_PERMISSIONS:${id}`);
  return data;
}

export async function runHealthNutritionPlanPermissionBackfill({
  actor = null,
  apply = false,
  db,
  mode,
  projectId,
  technicalPrincipal = null,
}) {
  if (!db) throw new Error("DB_REQUIRED");
  if (!projectId) throw new Error("PROJECT_REQUIRED");
  if (!['emulator', 'real'].includes(mode)) throw new Error("MODE_REQUIRED");
  if (apply && (!actor?.uid || !actor?.name || !technicalPrincipal)) {
    throw new Error("APPLY_REQUIRES_DECLARED_ACTOR_AND_TECHNICAL_PRINCIPAL");
  }

  const refs = TARGET_PROFILE_IDS.map((id) => db.collection("access_profiles").doc(id));
  const auditRef = db.collection("auditLogs").doc();

  return db.runTransaction(async (tx) => {
    const snapshots = [];
    for (const ref of refs) snapshots.push(await tx.get(ref));
    const validated = snapshots.map((snapshot, index) =>
      validateProfile(TARGET_PROFILE_IDS[index], snapshot));
    const profiles = validated.map((data, index) => {
      const id = TARGET_PROFILE_IDS[index];
      const before = data.permissions.health;
      const alreadyGranted = before[CAPABILITY] === true;
      return {
        id,
        action: alreadyGranted ? "NO CHANGES" : apply ? "ADDED" : "WOULD ADD",
        before,
        before_hash: snapshotHash(before),
        capability_before: before[CAPABILITY] ?? null,
        capability_after: true,
        changed: !alreadyGranted,
      };
    });
    const changed = profiles.filter((profile) => profile.changed);

    if (apply && changed.length > 0) {
      for (const profile of changed) {
        const ref = db.collection("access_profiles").doc(profile.id);
        tx.update(ref, {
          [`permissions.health.${CAPABILITY}`]: true,
          updated_at: FieldValue.serverTimestamp(),
          updated_by: actor.ra ?? actor.uid,
        });
      }
      tx.set(auditRef, {
        action: "health_nutrition_plan_permission_backfill",
        actor: {uid: actor.uid, name: actor.name, ra: actor.ra ?? null},
        entity_id: "health.manage_nutrition_plan",
        entity_type: "access_profiles",
        metadata: {
          after: Object.fromEntries(changed.map((profile) => [profile.id, {[CAPABILITY]: true}])),
          before: Object.fromEntries(changed.map((profile) => [profile.id, profile.before])),
          before_hashes: Object.fromEntries(changed.map((profile) => [profile.id, profile.before_hash])),
          capability: `health.${CAPABILITY}`,
          mode,
          profiles_affected: changed.map((profile) => profile.id),
          project_id: projectId,
          technical_principal: technicalPrincipal,
        },
        source: "administrative_script",
        summary: `Capability health.${CAPABILITY} adicionada a ${changed.map((profile) => profile.id).join(", ")}`,
        performed_at: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return {applied: apply && changed.length > 0, audit_id: apply && changed.length > 0 ? auditRef.id : null,
      mode, profiles, project: projectId};
  });
}

function argValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

export function parseBackfillCli(args, env = process.env) {
  const apply = args.includes("--apply");
  const emulatorFlag = args.includes("--emulator");
  const emulatorHost = env.FIRESTORE_EMULATOR_HOST?.trim() || null;
  const projectId = argValue(args, "--project");
  if (!projectId) throw new Error("EXPLICIT_PROJECT_REQUIRED");
  if (emulatorFlag !== Boolean(emulatorHost)) throw new Error("EMULATOR_INTENT_MISMATCH");
  const mode = emulatorHost ? "emulator" : "real";
  if (mode === "real" && projectId !== "canil-gcm") throw new Error("REAL_PROJECT_MUST_BE_CANIL_GCM");
  if (apply && projectId !== "canil-gcm") throw new Error("APPLY_PROJECT_MUST_BE_CANIL_GCM");
  const actor = {uid: argValue(args, "--actor-uid"), name: argValue(args, "--actor-name"),
    ra: argValue(args, "--actor-ra")};
  const technicalPrincipal = argValue(args, "--technical-principal");
  if (apply && (!actor.uid || !actor.name || !technicalPrincipal)) {
    throw new Error("APPLY_REQUIRES_DECLARED_ACTOR_AND_TECHNICAL_PRINCIPAL");
  }
  return {actor, apply, emulatorHost, mode, projectId, technicalPrincipal};
}

async function main() {
  const parsed = parseBackfillCli(process.argv.slice(2));
  const app = initializeApp(parsed.mode === "real" ?
    {credential: applicationDefault(), projectId: parsed.projectId} : {projectId: parsed.projectId});
  const result = await runHealthNutritionPlanPermissionBackfill({...parsed, db: getFirestore(app)});
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {console.error(error instanceof Error ? error.message : error); process.exitCode = 1;});
}
