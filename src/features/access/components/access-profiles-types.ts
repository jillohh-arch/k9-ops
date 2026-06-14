import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardList,
  Crown,
  FileText,
  HeartPulse,
  KeyRound,
  LayoutGrid,
  Lock,
  PawPrint,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from "lucide-react";

import {
  accessActions,
  accessModules,
  type AccessAction,
  type AccessModuleId,
  type AccessProfile,
} from "@/lib/permissions/access-control";

// ─── Types ─────────────────────────────────────────────────────────────────

export type AccessTab = "overview" | "permissions" | "users";
export type ModuleAccessLevel = "none" | "consulta" | "operacional" | "gestão" | "total";

export type ModuleView = {
  icon: LucideIcon;
  id: AccessModuleId | string;
};

// ─── Constants ─────────────────────────────────────────────────────────────

export const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-55";

export const textareaClass =
  "min-h-20 w-full rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-55";

export const levelOptions = ["máximo", "gestão", "operacional", "técnico", "logística", "restrito", "leitura"];

export const profileLevelLabels: Record<string, string> = {
  gestão: "Gestão",
  leitura: "Leitura",
  logística: "Logística",
  máximo: "Máximo",
  operacional: "Operacional",
  restrito: "Restrito",
  técnico: "Técnico",
};

export const toneOptions = ["violet", "cyan", "amber", "blue", "orange", "green", "purple", "slate"];

export const accessTabs: Array<{
  description: string;
  id: AccessTab;
  label: string;
}> = [
  {
    description: "visão geral e segurança",
    id: "overview",
    label: "Central",
  },
  {
    description: "módulos e níveis",
    id: "permissions",
    label: "Editar perfil",
  },
  {
    description: "vincular usuários",
    id: "users",
    label: "Atribuição",
  },
];

export const roleKeyLabels: Record<string, string> = {
  admin: "Administrador",
  administrador: "Administrador",
  admin_master: "Legado admin",
  almoxarifado: "Almoxarifado",
  condutor: "Condutor",
  estoque: "Estoque",
  gestor: "Gestão",
  handler: "Condutor mobile",
  inspetor: "Inspetor",
  instrutor: "Instrutor",
  instrutor_k9: "Instrutor K9",
  inventory_manager: "Gestor de estoque",
  mobile_user: "Acesso mobile",
  subinspetor: "Subinspetor",
  subinspetor_inspetor: "Gestão inspetoria",
};

export const toneClasses: Record<string, string> = {
  amber: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  blue: "border-blue-300/30 bg-blue-300/10 text-blue-200",
  cyan: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
  green: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  orange: "border-orange-300/30 bg-orange-300/10 text-orange-200",
  purple: "border-purple-300/30 bg-purple-300/10 text-purple-200",
  slate: "border-slate-300/20 bg-slate-300/10 text-slate-200",
  violet: "border-violet-300/30 bg-violet-300/10 text-violet-200",
};

export const levelToneClasses: Record<ModuleAccessLevel, string> = {
  consulta: "border-cyan-300/35 bg-cyan-300/10 text-cyan-200",
  gestão: "border-blue-300/35 bg-blue-300/10 text-blue-200",
  none: "border-slate-400/20 bg-slate-400/10 text-slate-400",
  operacional: "border-emerald-300/35 bg-emerald-300/10 text-emerald-200",
  total: "border-violet-300/35 bg-violet-300/10 text-violet-200",
};

export const accessLevelLabels: Record<ModuleAccessLevel, string> = {
  consulta: "Consulta",
  gestão: "Gestão",
  none: "Sem acesso",
  operacional: "Operacional",
  total: "Total",
};

export const levelActions: Record<ModuleAccessLevel, AccessAction[]> = {
  consulta: ["view"],
  gestão: ["view", "create", "edit", "export", "approve", "audit"],
  none: [],
  operacional: ["view", "create", "edit", "approve"],
  total: accessActions.map((action) => action.id),
};

export const moduleViews: ModuleView[] = [
  { id: "dashboard", icon: LayoutGrid },
  { id: "me", icon: User },
  { id: "k9", icon: PawPrint },
  { id: "humans", icon: Users },
  { id: "binomials", icon: UserCheck },
  { id: "vehicles", icon: Shield },
  { id: "occurrences", icon: ShieldAlert },
  { id: "training", icon: ClipboardList },
  { id: "health", icon: HeartPulse },
  { id: "inventory", icon: Boxes },
  { id: "reports", icon: FileText },
  { id: "calendar", icon: CalendarDays },
  { id: "settings", icon: Settings },
  { id: "access", icon: KeyRound },
  { id: "audit", icon: Lock },
  { id: "intelligence", icon: BarChart3 },
];

export const moduleIconById: Record<string, LucideIcon> = Object.fromEntries(
  moduleViews.map((view) => [view.id, view.icon]),
);

// ─── Utility functions ─────────────────────────────────────────────────────

export function formatNumber(n: number) {
  return String(n).padStart(2, "0");
}

export function getToneClass(tone: string | undefined) {
  return toneClasses[tone ?? "cyan"] ?? toneClasses.cyan;
}

export function roleKeyLabel(key: string) {
  return roleKeyLabels[key] ?? key;
}

export function moduleLabel(moduleId: AccessModuleId) {
  return accessModules.find((module) => module.id === moduleId)?.label ?? moduleId;
}

export function moduleLevel(profile: AccessProfile, moduleId: AccessModuleId): ModuleAccessLevel {
  const permissions = profile.permissions[moduleId] ?? {};
  const enabled = accessActions
    .map((action) => action.id)
    .filter((action) => permissions[action] === true);

  if (!enabled.length) return "none";
  if (enabled.length === accessActions.length) return "total";
  if (
    ["view", "create", "edit", "export", "approve", "audit"].every(
      (action) => permissions[action as AccessAction] === true,
    )
  ) {
    return "gestão";
  }
  if (
    ["view", "create", "edit"].every(
      (action) => permissions[action as AccessAction] === true,
    )
  ) {
    return "operacional";
  }
  return "consulta";
}

export function setModuleAccessLevel(
  profile: AccessProfile,
  moduleId: AccessModuleId,
  level: ModuleAccessLevel,
) {
  return {
    ...profile,
    permissions: {
      ...profile.permissions,
      [moduleId]: Object.fromEntries(
        accessActions.map((action) => [
          action.id,
          levelActions[level].includes(action.id),
        ]),
      ) as Partial<Record<AccessAction, boolean>>,
    },
  };
}

export function togglePermission(
  profile: AccessProfile,
  moduleId: AccessModuleId,
  action: AccessAction,
) {
  const current = profile.permissions[moduleId]?.[action] === true;
  return {
    ...profile,
    permissions: {
      ...profile.permissions,
      [moduleId]: {
        ...(profile.permissions[moduleId] ?? {}),
        [action]: !current,
      },
    },
  };
}

export function hasPermission(
  profile: AccessProfile,
  moduleId: AccessModuleId,
  action: AccessAction,
) {
  return profile.permissions[moduleId]?.[action] === true;
}

export function usersForProfile<T extends { accessProfileId?: string | null }>(
  users: T[],
  profileId: string,
): T[] {
  return users.filter((user) => user.accessProfileId === profileId);
}

export function sensitiveCount(profile: AccessProfile) {
  return Object.values(profile.permissions).reduce(
    (total, permissions) =>
      total +
      Number(permissions?.archive === true) +
      Number(permissions?.approve === true) +
      Number(permissions?.audit === true) +
      Number(permissions?.export === true),
    0,
  );
}

export function criticalPermissionCount(profiles: AccessProfile[]) {
  return profiles.reduce((total, profile) => total + sensitiveCount(profile), 0);
}

export function newProfileDraft(): AccessProfile & { created_at?: string } {
  const id = `custom_${Date.now()}`;
  return {
    created_at: new Date().toISOString(),
    description: "",
    id,
    level: "restrito",
    module_tags: [],
    name: "",
    permissions: {},
    role_keys: [],
    scope: "own_records",
    seed_version: 0,
    slug: id,
    status: "active",
    tone: "cyan",
  };
}

export function cloneProfile(profile: AccessProfile): AccessProfile {
  return JSON.parse(JSON.stringify(profile));
}

export function commaListToArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function arrayToCommaList(arr: string[]) {
  return arr.join(", ");
}

export const visibleModuleIds: AccessModuleId[] = accessModules.map(
  (module) => module.id,
);
