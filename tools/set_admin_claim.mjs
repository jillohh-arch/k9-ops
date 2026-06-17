import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);

function getArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function hasFlag(name) {
  return args.includes(name);
}

function usage() {
  console.log(`
Uso:
  node tools/set_admin_claim.mjs --ra 691755 --service-account "C:\\tmp\\canil-gcm-firebase-admin.json"
  node tools/set_admin_claim.mjs --uid UID --ra 691755 --service-account "C:\\tmp\\canil-gcm-firebase-admin.json"
  node tools/set_admin_claim.mjs --email 691755@gcm.com.br --ra 691755

Opcoes:
  --uid <uid>                         UID do Firebase Auth
  --email <email>                     E-mail do usuario no Firebase Auth
  --ra <ra>                           Matricula/RA numerico. Recomendado e usado em users/{ra}
  --service-account <caminho-json>    JSON de service account
  --project <project-id>              Padrao: canil-gcm
  --no-instructor                     Nao marcar como Instrutor K9
`);
}

function cleanString(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

async function resolveAuthUser(auth, { uid, email, ra }) {
  if (uid) return auth.getUser(uid);
  if (email) return auth.getUserByEmail(email);
  if (ra) return auth.getUserByEmail(`${ra}@gcm.com.br`);
  throw new Error("Informe --uid, --email ou --ra.");
}

const projectId = getArg("--project") ?? "canil-gcm";
const serviceAccountPath = getArg("--service-account");
const ra = cleanString(getArg("--ra"));
const uid = cleanString(getArg("--uid"));
const email = cleanString(getArg("--email"));
const markInstructor = !hasFlag("--no-instructor");

if (hasFlag("--help") || (!uid && !email && !ra)) {
  usage();
  process.exit(hasFlag("--help") ? 0 : 1);
}

if (ra && !/^\d{4,12}$/.test(ra)) {
  throw new Error("--ra deve ser numerico, por exemplo 691755.");
}

const credential = serviceAccountPath
  ? cert(JSON.parse(await readFile(resolve(serviceAccountPath), "utf8")))
  : applicationDefault();

initializeApp({ credential, projectId });

const auth = getAuth();
const db = getFirestore();
const userRecord = await resolveAuthUser(auth, { uid, email, ra });
const targetRa = ra ?? cleanString(userRecord.customClaims?.ra);

if (!targetRa || !/^\d{4,12}$/.test(targetRa)) {
  throw new Error("Nao foi possivel determinar um RA numerico. Informe --ra.");
}

const beforeClaims = userRecord.customClaims ?? {};
const roles = new Set(
  [
    ...(Array.isArray(beforeClaims.roles) ? beforeClaims.roles : []),
    "administrador",
    "admin",
    "gestor",
  ]
    .filter(Boolean)
    .map((role) => String(role).trim()),
);

if (markInstructor) {
  roles.add("instrutor_k9");
  roles.add("instrutor");
}

const afterClaims = compactObject({
  ...beforeClaims,
  access_profile: "administrador",
  access_profile_id: "administrador",
  access_scope: "global",
  admin: true,
  app_access: ["web", "mobile"],
  is_admin: true,
  mobile_access: true,
  ra: targetRa,
  role: "administrador",
  roles: Array.from(roles).sort(),
  web_access: true,
  instrutor_k9: markInstructor ? true : undefined,
  training_instructor: markInstructor ? true : undefined,
  training_role: markInstructor ? "instrutor_k9" : undefined,
});

await auth.setCustomUserClaims(userRecord.uid, afterClaims);

const userRef = db.collection("users").doc(targetRa);
const beforeDoc = await userRef.get();
const beforeUser = beforeDoc.exists ? beforeDoc.data() : null;

const userPatch = compactObject({
  access_profile: "administrador",
  access_profile_id: "administrador",
  active: true,
  auth_uid: userRecord.uid,
  claim_refresh_required: true,
  claim_role: "administrador",
  email: userRecord.email ?? email ?? `${targetRa}@gcm.com.br`,
  is_k9_instructor: markInstructor,
  ra: targetRa,
  role: "administrador",
  status: "active",
  training_role: markInstructor ? "instrutor_k9" : null,
  updated_at: FieldValue.serverTimestamp(),
});

await userRef.set(
  {
    ...userPatch,
    created_at: beforeDoc.exists
      ? (beforeUser?.created_at ?? FieldValue.serverTimestamp())
      : FieldValue.serverTimestamp(),
  },
  { merge: true },
);

const afterDoc = await userRef.get();

console.log(
  JSON.stringify(
    {
      project: projectId,
      action: "grant_admin",
      token_refresh_required: true,
      ra: targetRa,
      uid: userRecord.uid,
      email: userRecord.email,
      user_doc: `users/${targetRa}`,
      custom_claims_before: beforeClaims,
      custom_claims_after: afterClaims,
      user_before: beforeUser,
      user_after: afterDoc.data(),
      note: "Faca logout/login para renovar o ID token no web e no mobile.",
    },
    null,
    2,
  ),
);
