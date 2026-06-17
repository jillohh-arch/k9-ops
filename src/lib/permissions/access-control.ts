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
  | "shifts"
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
  ui_hidden?: boolean;
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

export const canonicalAccessProfileOrder = [
  "operador_k9",
  "gestor",
  "almoxarifado",
  "administrador",
] as const;

export function isVisibleAccessProfile(
  profile: Pick<AccessProfile, "id" | "ui_hidden">,
) {
  return (
    profile.ui_hidden !== true &&
    canonicalAccessProfileOrder.includes(
      profile.id as (typeof canonicalAccessProfileOrder)[number],
    )
  );
}

export function sortAccessProfiles(profiles: AccessProfile[]) {
  return [...profiles].sort((left, right) => {
    const leftIndex = canonicalAccessProfileOrder.indexOf(
      left.id as (typeof canonicalAccessProfileOrder)[number],
    );
    const rightIndex = canonicalAccessProfileOrder.indexOf(
      right.id as (typeof canonicalAccessProfileOrder)[number],
    );

    if (leftIndex >= 0 || rightIndex >= 0) {
      return (
        (leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER) -
        (rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER)
      );
    }

    return left.name.localeCompare(right.name, "pt-BR");
  });
}

export function mergeAccessProfilesWithDefaults(profiles: AccessProfile[]) {
  const merged = new Map<string, AccessProfile>(
    defaultAccessProfiles.map((profile) => [profile.id, profile]),
  );

  for (const profile of profiles) {
    merged.set(profile.id, profile);
  }

  return Array.from(merged.values());
}

export function visibleAccessProfiles(profiles: AccessProfile[]) {
  return sortAccessProfiles(profiles.filter(isVisibleAccessProfile));
}

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
    almoxarifado: "almoxarifado",
    comando: "gestor",
    comando_canil: "gestor",
    condutor: "operador_k9",
    coordenador: "gestor",
    estoque: "almoxarifado",
    guarda_k9: "operador_k9",
    gestor: "gestor",
    gestor_canil: "gestor",
    inventory_manager: "almoxarifado",
    inspetor: "gestor",
    operacional: "operador_k9",
    operador: "operador_k9",
    operador_k9: "operador_k9",
    subinspetor: "gestor",
    subinspetor_inspetor: "gestor",
    instrutor: "instrutor_k9",
    instrutor_k9: "instrutor_k9",
    adestrador: "instrutor_k9",
    adestrador_k9: "instrutor_k9",
    ti: "administrador",
  };

  return aliases[normalized] ?? getDefaultAccessProfile(normalized)?.id ?? null;
}
