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

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stringValue(value) {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = String(value).trim();
    return parsed.length ? parsed : null;
  }
  return null;
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => stringValue(item))
    .filter(Boolean);
}

function normalizePermissions(permissions) {
  return Object.fromEntries(
    Object.entries(permissions ?? {}).map(([moduleId, actions]) => [
      moduleId,
      Object.fromEntries(
        (Array.isArray(actions) ? actions : []).map((action) => [action, true]),
      ),
    ]),
  );
}

function profilePayload(profile, policyVersion, actor) {
  return {
    ...profile,
    permissions: normalizePermissions(profile.permissions),
    seed_source: "k9-ops-web",
    seed_version: policyVersion,
    updated_at: FieldValue.serverTimestamp(),
    updated_by: actor,
  };
}

function canonicalProfileId(value) {
  const normalized = normalizeKey(value);
  if (!normalized) return null;
  if (["admin", "administrador", "admin_master", "ti"].includes(normalized)) {
    return "administrador";
  }
  if (
    [
      "gestor",
      "comando",
      "comando_canil",
      "coordenador",
      "inspetor",
      "subinspetor",
      "subinspetor_inspetor",
      "gestor_canil",
    ].includes(normalized)
  ) {
    return "gestor";
  }
  if (["almoxarifado", "estoque", "inventory_manager"].includes(normalized)) {
    return "almoxarifado";
  }
  if (
    [
      "condutor",
      "guarda_k9",
      "handler",
      "mobile_user",
      "operador",
      "operador_k9",
      "operacional",
    ].includes(normalized)
  ) {
    return "operador_k9";
  }
  if (["instrutor", "instrutor_k9", "adestrador", "adestrador_k9"].includes(normalized)) {
    return "operador_k9";
  }
  return normalized;
}

function isInstructorFromUser(data) {
  const candidates = [
    data.is_k9_instructor,
    data.training_instructor,
    data.training_role,
    data.claim_role,
    data.role,
    data.access_profile_id,
    data.accessProfileId,
    data.accessProfile,
    data.access_profile,
    ...stringList(data.roles),
  ];
  return candidates.some((candidate) =>
    ["instrutor", "instrutor_k9", "adestrador", "adestrador_k9"].includes(
      normalizeKey(candidate),
    ),
  );
}

function claimsForProfile(existingClaims, ra, profile, isK9Instructor) {
  const roleKeys = new Set([
    ...stringList(profile.role_keys).map(normalizeKey),
    normalizeKey(profile.id),
  ]);

  if (isK9Instructor) {
    roleKeys.add("instrutor_k9");
    roleKeys.add("instrutor");
  }

  const isAdmin = roleKeys.has("admin") ||
    roleKeys.has("administrador") ||
    roleKeys.has("admin_master");
  const isInventory = roleKeys.has("almoxarifado") ||
    roleKeys.has("inventory_manager") ||
    roleKeys.has("estoque");
  const isManager = roleKeys.has("gestor") ||
    roleKeys.has("subinspetor") ||
    roleKeys.has("inspetor");
  const isMobile = isAdmin ||
    isK9Instructor ||
    roleKeys.has("condutor") ||
    roleKeys.has("handler") ||
    roleKeys.has("mobile_user") ||
    roleKeys.has("operador_k9");
  const primaryRole = isAdmin
    ? "admin"
    : isInventory
      ? "inventory_manager"
      : isManager
        ? "gestor"
        : "condutor";

  const nextClaims = {
    ...existingClaims,
    access_profile_id: profile.id,
    access_scope: profile.scope === "own_records" ? "own_records" : "global",
    admin: isAdmin,
    app_access: isMobile ? ["web", "mobile"] : ["web"],
    mobile_access: isMobile,
    ra,
    role: primaryRole,
    roles: Array.from(roleKeys).sort(),
    web_access: true,
  };

  if (isK9Instructor) {
    nextClaims.instrutor_k9 = true;
    nextClaims.training_instructor = true;
    nextClaims.training_role = "instrutor_k9";
  } else {
    delete nextClaims.instrutor_k9;
    delete nextClaims.training_instructor;
    delete nextClaims.training_role;
  }

  if (isInventory) {
    nextClaims.inventory_manager = true;
  } else {
    delete nextClaims.inventory_manager;
  }

  return nextClaims;
}

async function authUserForData(auth, ra, data) {
  const uid = stringValue(data.auth_uid) ?? stringValue(data.authUid) ?? stringValue(data.uid);
  const email = stringValue(data.email) ?? `${ra}@gcm.com.br`;

  if (uid) {
    try {
      return await auth.getUser(uid);
    } catch {
      // Fall through to email lookup.
    }
  }

  try {
    return await auth.getUserByEmail(email);
  } catch {
    return null;
  }
}

const projectId = getArg("--project") ?? "canil-gcm";
const serviceAccountPath = getArg("--service-account");
const actor = getArg("--actor") ?? "consolidate_access_profiles";
const apply = hasFlag("--apply");

const credential = serviceAccountPath
  ? cert(JSON.parse(await readFile(resolve(serviceAccountPath), "utf8")))
  : applicationDefault();

initializeApp({ credential, projectId });

const policy = JSON.parse(
  await readFile(resolve("src", "lib", "permissions", "default-access-profiles.json"), "utf8"),
);
const profileById = new Map(policy.profiles.map((profile) => [profile.id, profile]));
const db = getFirestore();
const auth = getAuth();

const result = {
  applied: apply,
  project: projectId,
  profiles: {
    created: [],
    updated: [],
    unchanged: [],
  },
  users: {
    migrated: [],
    missing_profile: [],
    skipped_non_ra: [],
    unchanged: [],
  },
};

for (const profile of policy.profiles) {
  const ref = db.collection("access_profiles").doc(profile.id);
  const snapshot = await ref.get();
  const payload = profilePayload(profile, policy.version, actor);
  const existing = snapshot.data() ?? {};
  const shouldUpdate =
    !snapshot.exists ||
    existing.seed_version !== policy.version ||
    existing.ui_hidden !== profile.ui_hidden ||
    existing.name !== profile.name;

  if (!shouldUpdate) {
    result.profiles.unchanged.push(profile.id);
    continue;
  }

  if (apply) {
    await ref.set(
      {
        ...payload,
        ...(snapshot.exists
          ? {}
          : {
              created_at: FieldValue.serverTimestamp(),
              created_by: actor,
            }),
      },
      { merge: true },
    );
  }

  if (snapshot.exists) {
    result.profiles.updated.push(profile.id);
  } else {
    result.profiles.created.push(profile.id);
  }
}

const usersSnapshot = await db.collection("users").get();

for (const userDoc of usersSnapshot.docs) {
  const data = userDoc.data();
  const ra = stringValue(data.ra) ?? stringValue(data.matricula) ?? userDoc.id;
  if (!/^\d{4,12}$/.test(ra)) {
    result.users.skipped_non_ra.push({
      document_id: userDoc.id,
      name: stringValue(data.callsign) ?? stringValue(data.name),
      reason: "documento sem RA numerico",
    });
    continue;
  }
  const rawProfileId =
    stringValue(data.access_profile_id) ??
    stringValue(data.accessProfileId) ??
    stringValue(data.accessProfile) ??
    stringValue(data.access_profile) ??
    stringValue(data.role);
  const canonicalId = canonicalProfileId(rawProfileId);

  if (!canonicalId || !profileById.has(canonicalId)) {
    result.users.missing_profile.push({
      ra,
      raw_profile: rawProfileId,
    });
    continue;
  }

  const isK9Instructor = isInstructorFromUser(data);
  const profile = profileById.get(canonicalId);
  const profileName = profile.name;
  const needsMigration =
    data.access_profile_id !== canonicalId ||
    data.accessProfileId !== canonicalId ||
    data.accessProfile !== profileName ||
    data.access_profile !== profileName ||
    data.is_k9_instructor !== isK9Instructor;

  if (!needsMigration) {
    result.users.unchanged.push(ra);
    continue;
  }

  const authUser = await authUserForData(auth, ra, data);
  const nextClaims = authUser
    ? claimsForProfile(authUser.customClaims ?? {}, ra, profile, isK9Instructor)
    : null;

  if (apply) {
    if (authUser && nextClaims) {
      await auth.setCustomUserClaims(authUser.uid, nextClaims);
    }

    await userDoc.ref.set(
      {
        ...(authUser ? { auth_uid: authUser.uid, email: authUser.email ?? `${ra}@gcm.com.br` } : {}),
        access_profile: profileName,
        access_profile_id: canonicalId,
        access_role: nextClaims?.role ?? data.role ?? null,
        access_scope: profile.scope === "own_records" ? "own_records" : "global",
        accessProfile: profileName,
        accessProfileId: canonicalId,
        accessScope: profile.scope === "own_records" ? "own_records" : "global",
        admin: nextClaims?.admin === true,
        app_access: nextClaims?.app_access ?? data.app_access ?? ["web"],
        claim_role: nextClaims?.role ?? data.claim_role ?? null,
        claim_refresh_required: authUser != null,
        claim_updated_at: authUser ? FieldValue.serverTimestamp() : null,
        inventory_manager: nextClaims?.inventory_manager === true,
        is_k9_instructor: isK9Instructor,
        mobile_access: nextClaims?.mobile_access ?? data.mobile_access ?? false,
        permissions_version: policy.version,
        role: nextClaims?.role ?? data.role ?? null,
        roles: nextClaims?.roles ?? data.roles ?? [],
        training_instructor: isK9Instructor,
        training_role: isK9Instructor ? "instrutor_k9" : null,
        updated_at: FieldValue.serverTimestamp(),
        updated_by: actor,
        web_access: true,
      },
      { merge: true },
    );
  }

  result.users.migrated.push({
    auth_claims_updated: authUser != null,
    from: rawProfileId,
    instrutor_k9: isK9Instructor,
    ra,
    to: canonicalId,
  });
}

console.log(JSON.stringify(result, null, 2));
