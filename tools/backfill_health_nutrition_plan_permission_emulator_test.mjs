import assert from "node:assert/strict";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {
  CAPABILITY,
  parseBackfillCli,
  runHealthNutritionPlanPermissionBackfill,
} from "./backfill_health_nutrition_plan_permission.mjs";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("EMULATOR_REQUIRED");
const projectId = `gate25a-${Date.now()}`;
const db = getFirestore(initializeApp({projectId}));
const actor = {uid: "human-admin-uid", name: "Administrador Teste", ra: "123456"};
const technicalPrincipal = "emulator-test-principal";
const targets = ["administrador", "gestor"];

async function reset({admin = {}, gestor = {}} = {}) {
  await Promise.all([db.recursiveDelete(db.collection("access_profiles")), db.recursiveDelete(db.collection("auditLogs"))]);
  const base = {status: "active", permissions: {health: {view: true, edit: true}, other: {view: true}}};
  if (admin !== null) await db.collection("access_profiles").doc("administrador").set({...base, ...admin});
  if (gestor !== null) await db.collection("access_profiles").doc("gestor").set({...base, ...gestor});
  await Promise.all([
    db.collection("access_profiles").doc("operador_k9").set(base),
    db.collection("access_profiles").doc("instrutor_k9").set(base),
    db.collection("access_profiles").doc("custom_clinical").set(base),
  ]);
}

async function run(apply = false) {
  return runHealthNutritionPlanPermissionBackfill({actor, apply, db, mode: "emulator", projectId, technicalPrincipal});
}
async function audits() { return (await db.collection("auditLogs").get()).docs; }
async function data(id) { return (await db.collection("access_profiles").doc(id).get()).data(); }
async function test(name, fn) { await fn(); console.log(`ok - backfill ${name}`); }

await test("CLI requires explicit matching emulator intent", async () => {
  assert.throws(() => parseBackfillCli(["--project", "canil-gcm"], {FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080"}), /EMULATOR_INTENT_MISMATCH/);
  assert.throws(() => parseBackfillCli(["--project", "other", "--apply"], {}), /REAL_PROJECT_MUST_BE_CANIL_GCM|APPLY_PROJECT/);
  assert.throws(() => parseBackfillCli(["--project", "canil-gcm", "--emulator", "--apply"], {FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080"}), /APPLY_REQUIRES_DECLARED_ACTOR/);
  assert.equal(parseBackfillCli(["--project", "canil-gcm", "--emulator"], {FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080"}).mode, "emulator");
});
await test("dry-run reports both additions with zero writes", async () => {
  await reset(); const result = await run(false);
  assert.deepEqual(result.profiles.map((p) => p.action), ["WOULD ADD", "WOULD ADD"]);
  assert.equal((await audits()).length, 0);
  for (const id of targets) assert.equal((await data(id)).permissions.health[CAPABILITY], undefined);
});
await test("apply adds both and creates one audit", async () => {
  await reset(); const result = await run(true); assert.equal(result.applied, true);
  for (const id of targets) assert.equal((await data(id)).permissions.health[CAPABILITY], true);
  assert.equal((await audits()).length, 1);
});
await test("replay is no-op without audit or timestamp churn", async () => {
  const before = Object.fromEntries(await Promise.all(targets.map(async (id) => [id, (await data(id)).updated_at.toMillis()])));
  const result = await run(true); assert.equal(result.applied, false); assert.equal((await audits()).length, 1);
  for (const id of targets) assert.equal((await data(id)).updated_at.toMillis(), before[id]);
});
await test("one existing capability changes only the other", async () => {
  await reset({admin: {permissions: {health: {view: true, [CAPABILITY]: true}, custom_module: {approve: true}}}});
  const result = await run(true); assert.deepEqual(result.profiles.map((p) => p.action), ["NO CHANGES", "ADDED"]);
  assert.equal((await audits()).length, 1);
});
await test("preserves all extra permissions and health custom keys", async () => {
  const extra = {permissions: {health: {view: true, clinical_override: true}, custom_module: {approve: true}}};
  await reset({admin: extra, gestor: extra}); await run(true);
  for (const id of targets) {const p = await data(id); assert.equal(p.permissions.health.clinical_override, true); assert.equal(p.permissions.custom_module.approve, true);}
});
await test("never touches operator, instructor or custom profile", async () => {
  await reset(); const before = Object.fromEntries(await Promise.all(["operador_k9", "instrutor_k9", "custom_clinical"].map(async (id) => [id, await data(id)])));
  await run(true); for (const [id, value] of Object.entries(before)) assert.deepEqual(await data(id), value);
});
await test("missing administrador aborts all", async () => {
  await reset({admin: null}); await assert.rejects(() => run(true), /TARGET_PROFILE_MISSING:administrador/);
  assert.equal((await data("gestor")).permissions.health[CAPABILITY], undefined); assert.equal((await audits()).length, 0);
});
await test("missing gestor aborts all", async () => {
  await reset({gestor: null}); await assert.rejects(() => run(true), /TARGET_PROFILE_MISSING:gestor/);
  assert.equal((await data("administrador")).permissions.health[CAPABILITY], undefined); assert.equal((await audits()).length, 0);
});
await test("inactive target aborts all", async () => {
  await reset({gestor: {status: "inactive"}}); await assert.rejects(() => run(true), /TARGET_PROFILE_INACTIVE:gestor/);
  assert.equal((await data("administrador")).permissions.health[CAPABILITY], undefined);
});
await test("malformed permissions aborts all", async () => {
  await reset({gestor: {permissions: "invalid"}}); await assert.rejects(() => run(true), /MALFORMED_PERMISSIONS:gestor/);
  assert.equal((await data("administrador")).permissions.health[CAPABILITY], undefined);
});
await test("malformed health permissions aborts all", async () => {
  await reset({admin: {permissions: {health: []}}}); await assert.rejects(() => run(true), /MALFORMED_HEALTH_PERMISSIONS:administrador/);
  assert.equal((await data("gestor")).permissions.health[CAPABILITY], undefined);
});
await test("audit identifies actor, technical principal and effective changes", async () => {
  await reset(); await run(true); const audit = (await audits())[0].data();
  assert.equal(audit.actor.uid, actor.uid); assert.equal(audit.metadata.technical_principal, technicalPrincipal);
  assert.deepEqual(audit.metadata.profiles_affected, targets); assert.equal(audit.metadata.project_id, projectId);
});

await Promise.all([db.recursiveDelete(db.collection("access_profiles")), db.recursiveDelete(db.collection("auditLogs"))]);
console.log("backfill_health_nutrition_plan_permission_emulator_test: all passed");
