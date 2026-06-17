"use client";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import {
  callAdminAssignAccessProfile,
  callAdminDuplicateAccessProfile,
  callAdminSaveAccessProfile,
  callAdminSeedAccessProfiles,
  callAdminSetAccessProfileStatus,
} from "@/lib/firebase/functions";
import {
  defaultAccessProfiles,
  getProfileIdFromLegacyValue,
  normalizePermissionMap,
  type AccessProfile,
} from "@/lib/permissions/access-control";

const ACCESS_PROFILES_COLLECTION = "access_profiles";
const USERS_COLLECTION = "users";

type RawAccessProfile = Omit<AccessProfile, "permissions"> & {
  permissions?: unknown;
};

export function normalizeAccessProfile(
  id: string,
  data: Record<string, unknown>,
): AccessProfile {
  const raw = data as Partial<RawAccessProfile>;

  return {
    description: String(raw.description ?? ""),
    id,
    level: String(raw.level ?? "restrito"),
    module_tags: Array.isArray(raw.module_tags)
      ? raw.module_tags.filter((item): item is string => typeof item === "string")
      : [],
    name: String(raw.name ?? id),
    permissions: normalizePermissionMap(
      (raw.permissions ?? {}) as AccessProfile["permissions"],
    ),
    role_keys: Array.isArray(raw.role_keys)
      ? raw.role_keys.filter((item): item is string => typeof item === "string")
      : [],
    scope: raw.scope === "own_records" ? "own_records" : "global",
    seed_version: Number(raw.seed_version ?? 0),
    slug: String(raw.slug ?? id),
    status: raw.status === "inactive" ? "inactive" : "active",
    tone: String(raw.tone ?? "cyan"),
    ui_hidden: raw.ui_hidden === true,
  };
}

export function subscribeAccessProfiles(
  onData: (profiles: AccessProfile[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, ACCESS_PROFILES_COLLECTION), orderBy("name")),
    (snapshot) => {
      onData(
        snapshot.docs.map((snapshotDoc) =>
          normalizeAccessProfile(snapshotDoc.id, snapshotDoc.data()),
        ),
      );
    },
    onError,
  );
}

export type AccessUser = {
  accessLevel: string | null;
  accessProfile: string | null;
  accessProfileId: string | null;
  active: boolean;
  callsign: string;
  fullName: string | null;
  isK9Instructor: boolean;
  photoUrl: string | null;
  ra: string;
  role: string | null;
  unit: string | null;
};

function text(data: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" || typeof value === "number") {
      const parsed = String(value).trim();
      if (parsed) return parsed;
    }
  }
  return null;
}

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const parsed = String(value ?? "").trim().toLowerCase();
  if (["ativo", "active", "sim", "true", "1"].includes(parsed)) return true;
  if (["inativo", "inactive", "nao", "não", "false", "0"].includes(parsed)) {
    return false;
  }
  return fallback;
}

function isArchived(data: Record<string, unknown>) {
  return data.archived_at != null || data.deleted_at != null;
}

function normalizeAccessUser(id: string, data: Record<string, unknown>) {
  const accessProfileId =
    text(data, "access_profile_id", "accessProfileId") ??
    getProfileIdFromLegacyValue(
      text(data, "accessProfile", "access_profile", "accessLevel"),
    );

  return {
    accessLevel: text(data, "accessLevel", "access_level"),
    accessProfile: text(data, "accessProfile", "access_profile"),
    accessProfileId,
    active: booleanValue(data.active, true) && !isArchived(data),
    callsign:
      text(data, "callsign", "callSign", "nome_guerra", "nome", "name") ?? id,
    fullName: text(data, "nomeCompleto", "fullName", "name", "nome_completo"),
    isK9Instructor:
      data.is_k9_instructor === true ||
      data.training_instructor === true ||
      text(data, "training_role") === "instrutor_k9",
    photoUrl: text(data, "photoUrl", "image_url", "photo_url"),
    ra: id,
    role: text(data, "cargo", "role", "função"),
    unit: text(data, "unit", "unidade", "lotação"),
  } satisfies AccessUser;
}

export function subscribeAccessUsers(
  onData: (users: AccessUser[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  // QW-3: Filter at query level — prevents downloading inactive/archived
  // user documents. The active field is the canonical flag used throughout
  // the codebase (confirmed in normalizeAccessUser).
  return onSnapshot(
    query(
      collection(db, USERS_COLLECTION),
      where("active", "==", true),
    ),
    (snapshot) => {
      onData(
        snapshot.docs
          .map((snapshotDoc) =>
            normalizeAccessUser(snapshotDoc.id, snapshotDoc.data()),
          )
          .filter((user) => user.active)
          .sort((a, b) => a.callsign.localeCompare(b.callsign, "pt-BR")),
      );
    },
    onError,
  );
}

export type AccessProfileInput = AccessProfile & {
  actorRa?: string | null;
};

function accessProfileForFunction(profile: AccessProfile) {
  return {
    description: profile.description,
    id: profile.id,
    level: profile.level,
    module_tags: profile.module_tags,
    name: profile.name,
    permissions: profile.permissions,
    role_keys: profile.role_keys,
    scope: profile.scope ?? "global",
    seed_version: profile.seed_version,
    slug: profile.slug,
    status: profile.status,
    tone: profile.tone,
    ui_hidden: profile.ui_hidden === true,
  };
}

export async function saveAccessProfile(values: AccessProfileInput) {
  await callAdminSaveAccessProfile({
    id: values.id,
    profile: accessProfileForFunction(values),
  });
}

export async function duplicateAccessProfile(
  source: AccessProfile,
  actorRa?: string | null,
) {
  void actorRa;
  const response = await callAdminDuplicateAccessProfile({
    profile: accessProfileForFunction(source),
  });
  const id = response.data.id;
  if (!id) {
    throw new Error("Function não retornou o identificador do perfil duplicado.");
  }
  return id;
}

export async function setAccessProfileStatus(
  profileId: string,
  status: AccessProfile["status"],
  actorRa?: string | null,
) {
  void actorRa;
  await callAdminSetAccessProfileStatus({
    id: profileId,
    status,
  });
}

export async function assignUserAccessProfile(
  user: AccessUser,
  profile: AccessProfile,
  actorRa?: string | null,
) {
  void actorRa;
  await callAdminAssignAccessProfile({
    profileId: profile.id,
    ra: user.ra,
  });
}

export async function seedDefaultAccessProfiles(actorRa?: string | null) {
  void actorRa;
  const response = await callAdminSeedAccessProfiles({
    profiles: defaultAccessProfiles.map(accessProfileForFunction),
    reconcile: true,
  });
  return {
    archived: response.data.archived ?? [],
    created: response.data.created ?? [],
    skipped: [],
    updated: response.data.updated ?? [],
  };
}
