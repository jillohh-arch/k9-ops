import accessPolicy from "./default-access-profiles.json";

export type AccessAction =
  | "archive"
  | "approve"
  | "audit"
  | "create"
  | "edit"
  | "export"
  | "view";

export type AccessModuleId =
  | "access"
  | "audit"
  | "binomials"
  | "dashboard"
  | "health"
  | "humans"
  | "inventory"
  | "k9"
  | "me"
  | "occurrences"
  | "reports"
  | "settings"
  | "training"
  | "training_matrix"
  | "vehicles";

export type AccessPermissionMap = Partial<
  Record<AccessModuleId, Partial<Record<AccessAction, boolean>>>
>;

type AccessActionSeed = {
  description: string;
  id: AccessAction;
  label: string;
};

type AccessModuleSeed = {
  category: string;
  id: AccessModuleId;
  label: string;
  path: string;
};

type AccessProfileSeed = {
  description: string;
  id: string;
  level: string;
  module_tags: string[];
  name: string;
  permissions: Partial<Record<AccessModuleId, AccessAction[]>>;
  role_keys: string[];
  scope?: "global" | "own_records";
  slug: string;
  status: "active" | "inactive";
  tone: string;
};

type AccessPolicySeed = {
  actions: AccessActionSeed[];
  modules: AccessModuleSeed[];
  profiles: AccessProfileSeed[];
  version: number;
};

export type AccessProfile = Omit<AccessProfileSeed, "permissions"> & {
  permissions: AccessPermissionMap;
  seed_version: number;
};

const typedPolicy = accessPolicy as AccessPolicySeed;

export const accessPolicyVersion = typedPolicy.version;
export const accessActions = typedPolicy.actions;
export const accessModules = typedPolicy.modules;

export function normalizePermissionMap(
  permissions: AccessProfileSeed["permissions"] | AccessPermissionMap,
): AccessPermissionMap {
  return Object.fromEntries(
    Object.entries(permissions).map(([moduleId, actions]) => [
      moduleId,
      Array.isArray(actions)
        ? Object.fromEntries(actions.map((action) => [action, true]))
        : actions,
    ]),
  ) as AccessPermissionMap;
}

export const defaultAccessProfiles: AccessProfile[] =
  typedPolicy.profiles.map((profile) => ({
    ...profile,
    permissions: normalizePermissionMap(profile.permissions),
    seed_version: typedPolicy.version,
  }));

export function getDefaultAccessProfile(id: string | null | undefined) {
  if (!id) return null;
  const normalized = id.trim().toLowerCase();
  return (
    defaultAccessProfiles.find(
      (profile) =>
        profile.id === normalized ||
        profile.slug === normalized ||
        profile.role_keys.includes(normalized),
    ) ?? null
  );
}

export function hasAccessPermission(
  profile: Pick<AccessProfile, "permissions" | "status"> | null | undefined,
  moduleId: AccessModuleId,
  action: AccessAction = "view",
) {
  if (!profile || profile.status !== "active") return false;
  return profile.permissions[moduleId]?.[action] === true;
}

export function countActivePermissions(profile: AccessProfile) {
  return Object.values(profile.permissions).reduce(
    (total, modulePermissions) =>
      total +
      Object.values(modulePermissions ?? {}).filter((enabled) => enabled)
        .length,
    0,
  );
}

export function countModulesWithAccess(profile: AccessProfile) {
  return Object.values(profile.permissions).filter(
    (modulePermissions) => modulePermissions?.view === true,
  ).length;
}

export function getProfileIdFromLegacyValue(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const aliases: Record<string, string> = {
    administrador: "administrador",
    admin: "administrador",
    admin_master: "administrador",
    comando: "gestor",
    comando_canil: "gestor",
    coordenador: "gestor",
    guarda_k9: "operador_k9",
    gestor: "gestor",
    gestor_canil: "gestor",
    inspetor: "gestor",
    operador: "operador_k9",
    operador_k9: "operador_k9",
    subinspetor: "gestor",
    instrutor: "instrutor_k9",
    instrutor_k9: "instrutor_k9",
    adestrador: "instrutor_k9",
    adestrador_k9: "instrutor_k9",
    ti: "administrador",
  };

  return aliases[normalized] ?? getDefaultAccessProfile(normalized)?.id ?? null;
}
