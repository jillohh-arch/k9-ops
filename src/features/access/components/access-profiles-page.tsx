"use client";

import {
  AlertCircle,
  Archive,
  ArrowRight,
  Award,
  BarChart3,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  Crown,
  Download,
  Eye,
  FileText,
  Filter,
  HeartPulse,
  KeyRound,
  LayoutGrid,
  Lock,
  PawPrint,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Star,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  assignUserAccessProfile,
  duplicateAccessProfile,
  saveAccessProfile,
  seedDefaultAccessProfiles,
  type AccessUser,
} from "@/features/access/data/access-profile-service";
import { useAccessProfiles } from "@/features/access/hooks/use-access-profiles";
import { useAccessUsers } from "@/features/access/hooks/use-access-users";
import { useAuth } from "@/features/auth/providers/auth-provider";
import {
  accessActions,
  accessModules,
  countActivePermissions,
  countModulesWithAccess,
  defaultAccessProfiles,
  type AccessAction,
  type AccessModuleId,
  type AccessPermissionMap,
  type AccessProfile,
} from "@/lib/permissions/access-control";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AccessTab = "overview" | "permissions" | "users";

// ─── Design Tokens ───────────────────────────────────────────────────────────

const toneMap: Record<string, { border: string; bg: string; text: string; glow: string; icon: string }> = {
  violet: {
    border: "border-violet-400/30",
    bg: "bg-violet-500/10",
    text: "text-violet-200",
    glow: "shadow-[0_0_40px_rgba(139,92,246,0.15)]",
    icon: "bg-violet-400/20 text-violet-300",
  },
  cyan: {
    border: "border-cyan-400/30",
    bg: "bg-cyan-500/10",
    text: "text-cyan-200",
    glow: "shadow-[0_0_40px_rgba(34,211,238,0.15)]",
    icon: "bg-cyan-400/20 text-cyan-300",
  },
  amber: {
    border: "border-amber-400/30",
    bg: "bg-amber-500/10",
    text: "text-amber-200",
    glow: "shadow-[0_0_40px_rgba(251,191,36,0.15)]",
    icon: "bg-amber-400/20 text-amber-300",
  },
  blue: {
    border: "border-blue-400/30",
    bg: "bg-blue-500/10",
    text: "text-blue-200",
    glow: "shadow-[0_0_40px_rgba(59,130,246,0.15)]",
    icon: "bg-blue-400/20 text-blue-300",
  },
};

function getToneTokens(tone: string) {
  return toneMap[tone] ?? toneMap.cyan;
}

const levelColors: Record<string, string> = {
  máximo: "bg-violet-400/20 text-violet-200 border-violet-400/30",
  gestão: "bg-amber-400/20 text-amber-200 border-amber-400/30",
  técnico: "bg-cyan-400/20 text-cyan-200 border-cyan-400/30",
  operacional: "bg-blue-400/20 text-blue-200 border-blue-400/30",
  logística: "bg-orange-400/20 text-orange-200 border-orange-400/30",
  restrito: "bg-slate-400/20 text-slate-200 border-slate-400/30",
  leitura: "bg-slate-400/20 text-slate-200 border-slate-400/30",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-55";

const textareaClass =
  "min-h-20 w-full rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-55";

const toneOptions = ["violet", "cyan", "amber", "blue"];

const accessTabs: Array<{
  description: string;
  id: AccessTab;
  label: string;
}> = [
  { description: "visão geral dos perfis", id: "overview", label: "Central" },
  { description: "módulos e permissões", id: "permissions", label: "Editar perfil" },
  { description: "vincular usuários", id: "users", label: "Atribuição" },
];

const roleKeyLabels: Record<string, string> = {
  adestrador: "Adestrador",
  adestrador_k9: "Adestrador K9",
  admin: "Administrador",
  administrador: "Administrador",
  comando: "Comando",
  comando_canil: "Comando Canil",
  coordenador: "Coordenador",
  guarda_k9: "Guarda K9",
  gestor: "Gestor",
  gestor_canil: "Gestor do Canil",
  inspetor: "Inspetor",
  instrutor: "Instrutor",
  instrutor_k9: "Instrutor K9",
  operador: "Operador",
  operador_k9: "Operador K9",
  subinspetor: "Subinspetor",
  ti: "TI",
};

function formatNumber(n: number) {
  return Intl.NumberFormat("pt-BR").format(n);
}

function commaListToArray(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function arrayToCommaList(value: string[]) {
  return value.join(", ");
}

function moduleLabel(moduleId: AccessModuleId) {
  return accessModules.find((module) => module.id === moduleId)?.label ?? moduleId;
}

function cloneProfile(profile: AccessProfile): AccessProfile {
  return {
    ...profile,
    module_tags: [...profile.module_tags],
    permissions: Object.fromEntries(
      Object.entries(profile.permissions).map(([moduleId, actions]) => [
        moduleId,
        { ...(actions ?? {}) },
      ]),
    ) as AccessPermissionMap,
    role_keys: [...profile.role_keys],
  };
}

function newProfileDraft(): AccessProfile {
  return {
    description: "",
    id: "novo_perfil",
    level: "restrito",
    module_tags: [],
    name: "Novo perfil",
    permissions: {},
    role_keys: [],
    scope: "global",
    seed_version: 3,
    slug: "novo_perfil",
    status: "active",
    tone: "cyan",
  };
}

function moduleLevel(profile: AccessProfile, moduleId: AccessModuleId): ModuleAccessLevel {
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

function setModuleAccessLevel(
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

function togglePermission(
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

function hasPermission(
  profile: AccessProfile,
  moduleId: AccessModuleId,
  action: AccessAction,
) {
  return profile.permissions[moduleId]?.[action] === true;
}

function usersForProfile(users: AccessUser[], profileId: string) {
  return users.filter((user) => user.accessProfileId === profileId);
}

function sensitiveCount(profile: AccessProfile) {
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

function criticalPermissionCount(profiles: AccessProfile[]) {
  return profiles.reduce((total, profile) => total + sensitiveCount(profile), 0);
}

// ─── Icons por Perfil ────────────────────────────────────────────────────────

const profileIcons: Record<string, LucideIcon> = {
  administrador: Crown,
  operador_k9: User,
  instrutor_k9: PawPrint,
  gestor: ShieldCheck,
};

type ModuleAccessLevel = "none" | "consulta" | "operacional" | "gestão" | "total";

const levelActions: Record<ModuleAccessLevel, AccessAction[]> = {
  consulta: ["view"],
  gestão: ["view", "create", "edit", "export", "approve", "audit"],
  none: [],
  operacional: ["view", "create", "edit", "approve"],
  total: accessActions.map((action) => action.id),
};

function ProfileIcon({ profile, size = 56 }: { profile: AccessProfile; size?: number }) {
  const Icon = profileIcons[profile.id] ?? Shield;
  const tokens = getToneTokens(profile.tone);

  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-2xl border",
        tokens.border,
        tokens.bg,
        tokens.icon,
      )}
      style={{ width: size, height: size }}
    >
      <Icon className="text-current" style={{ width: size * 0.45, height: size * 0.45 }} />
    </span>
  );
}

// ─── Badge de Nível ──────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: string }) {
  const colorClass = levelColors[level] ?? levelColors.restrito;
  return (
    <span className={cn("rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]", colorClass)}>
      {level}
    </span>
  );
}

// ─── Cards de Perfil (Visual Redesenhado) ────────────────────────────────────

function ProfileCard({
  isSelected,
  onAssign,
  onEdit,
  onSelect,
  profile,
  userCount,
}: {
  isSelected: boolean;
  onAssign: () => void;
  onEdit: () => void;
  onSelect: () => void;
  profile: AccessProfile;
  userCount: number;
}) {
  const tokens = getToneTokens(profile.tone);
  const Icon = profileIcons[profile.id] ?? Shield;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-950 to-slate-900 p-5 transition-all duration-300",
        isSelected
          ? cn(tokens.border, tokens.glow, "scale-[1.02]")
          : "border-white/10 hover:border-white/20",
      )}
    >
      {/* Background glow */}
      {isSelected && (
        <div className={cn("absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-3xl", tokens.bg)} />
      )}

      <div className="relative">
        {/* Header: Icon + Name + Level */}
        <div className="flex items-start gap-4">
          <ProfileIcon profile={profile} size={56} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-black text-white leading-tight">{profile.name}</h3>
              <LevelBadge level={profile.level} />
            </div>
            <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {profile.description || "Sem descrição"}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <p className="font-mono text-2xl font-black text-white">{userCount}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">usuários</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <p className="font-mono text-2xl font-black text-white">
              {countModulesWithAccess(profile)}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">módulos</p>
          </div>
        </div>

        {/* Role Keys */}
        {profile.role_keys.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {profile.role_keys.slice(0, 3).map((key) => (
              <span
                key={key}
                className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400"
              >
                {roleKeyLabels[key] ?? key}
              </span>
            ))}
            {profile.role_keys.length > 3 && (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-500">
                +{profile.role_keys.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
          <button
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-semibold transition",
              isSelected
                ? cn(tokens.border, tokens.bg, tokens.text)
                : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200",
            )}
            onClick={onSelect}
            type="button"
          >
            <Eye className="h-3.5 w-3.5" />
            Ver
          </button>
          <button
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-2 py-2.5 text-xs font-semibold text-slate-400 transition hover:border-cyan-400/30 hover:text-cyan-200"
            onClick={onEdit}
            type="button"
          >
            <UserCog className="h-3.5 w-3.5" />
            Editar
          </button>
          <button
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-2 py-2.5 text-xs font-semibold text-slate-400 transition hover:border-emerald-400/30 hover:text-emerald-200"
            onClick={onAssign}
            type="button"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Atribuir
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function TabButton({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-2xl border px-5 py-3 text-left transition-all",
        active
          ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.1)]"
          : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="block text-sm font-bold">{label}</span>
      <span className="mt-0.5 block text-[11px] text-slate-500">{description}</span>
    </button>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  action,
  children,
  className,
  icon,
  subtitle,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon ? (
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              {icon}
            </span>
          ) : null}
          <div>
            <h2 className="text-lg font-black text-white">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: string;
  value: string;
}) {
  const tokens = getToneTokens(tone);
  return (
    <article className={cn("relative min-h-36 overflow-hidden rounded-2xl border p-5", tokens.border, tokens.bg)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_18%,rgba(255,255,255,0.1),transparent_30%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-200">{label}</p>
          <p className="mt-3 font-mono text-4xl font-black text-white">{value}</p>
          <p className="mt-1.5 text-sm text-slate-400">{detail}</p>
        </div>
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10", tokens.icon)}>
          <Icon className="h-6 w-6" />
        </span>
      </div>
    </article>
  );
}

// ─── Permissions Matrix ────────────────────────────────────────────────────────

function PermissionMatrix({
  profile,
  onToggle,
}: {
  profile: AccessProfile;
  onToggle: (profile: AccessProfile) => void;
}) {
  const modulesByCategory = useMemo(() => {
    const map = new Map<string, typeof accessModules>();
    for (const mod of accessModules) {
      const cat = mod.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(mod);
    }
    return map;
  }, []);

  return (
    <div className="space-y-6">
      {Array.from(modulesByCategory.entries()).map(([category, modules]) => (
        <div key={category}>
          <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">{category}</h3>
          <div className="space-y-2">
            {modules.map((mod) => {
              const perms = profile.permissions[mod.id] ?? {};
              const enabledCount = Object.values(perms).filter(Boolean).length;
              const totalCount = accessActions.length;

              return (
                <div
                  key={mod.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-200">{mod.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {accessActions.map((action) => {
                      const isEnabled = perms[action.id] === true;
                      return (
                        <button
                          key={action.id}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg border text-xs transition",
                            isEnabled
                              ? "border-emerald-400/40 bg-emerald-400/20 text-emerald-300"
                              : "border-white/10 bg-white/[0.02] text-slate-600 hover:border-white/20",
                          )}
                          onClick={() =>
                            onToggle(
                              togglePermission(profile, mod.id, action.id),
                            )
                          }
                          title={action.label}
                          type="button"
                        >
                          {isEnabled ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                    <span className="ml-2 text-xs text-slate-500">
                      {enabledCount}/{totalCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── User Assignment List ────────────────────────────────────────────────────

function UserAssignmentList({
  profile,
  users,
}: {
  profile: AccessProfile;
  users: AccessUser[];
}) {
  const profileUsers = usersForProfile(users, profile.id);
  const tokens = getToneTokens(profile.tone);

  if (profileUsers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
        <Users className="mx-auto h-10 w-10 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">Nenhum usuário com este perfil</p>
        <p className="mt-1 text-xs text-slate-500">Atribua usuários abaixo</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {profileUsers.map((user) => (
        <div
          key={user.ra}
          className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-slate-400">
            {user.callsign?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user.callsign}</p>
            <p className="text-xs text-slate-500">{user.ra} · {user.role ?? "Sem cargo"}</p>
          </div>
          <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", tokens.border, tokens.text)}>
            {profile.name}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AccessProfilesPage() {
  const { profile: authProfile } = useAuth();
  const { profiles, loading: profilesLoading } = useAccessProfiles();
  const { users, loading: usersLoading } = useAccessUsers();

  const [activeTab, setActiveTab] = useState<AccessTab>("overview");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [draftProfile, setDraftProfile] = useState<AccessProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedProfile = useMemo(
    () =>
      profiles.find((p) => p.id === selectedProfileId) ??
      defaultAccessProfiles.find((p) => p.id === selectedProfileId) ??
      null,
    [profiles, selectedProfileId],
  );

  const displayProfile = draftProfile ?? selectedProfile;

  const filteredProfiles = useMemo(() => {
    const all = [...defaultAccessProfiles, ...profiles.filter((p) => p.seed_version !== 2)];
    if (!searchQuery) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
    );
  }, [profiles, searchQuery]);

  const stats = useMemo(() => {
    const totalProfiles = profiles.length + defaultAccessProfiles.length;
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.active).length;
    const instructorCount = users.filter(
      (u) => u.isK9Instructor || u.accessProfileId === "instrutor_k9",
    ).length;
    return { totalProfiles, totalUsers, activeUsers, instructorCount };
  }, [profiles, users]);

  const handleSelectProfile = (profile: AccessProfile) => {
    setSelectedProfileId(profile.id);
    setDraftProfile(null);
    setActiveTab("overview");
  };

  const handleEditProfile = (profile: AccessProfile) => {
    setSelectedProfileId(profile.id);
    setDraftProfile(cloneProfile(profile));
    setActiveTab("permissions");
  };

  const handleTogglePermission = (updated: AccessProfile) => {
    setDraftProfile(updated);
  };

  const handleSaveProfile = async () => {
    if (!draftProfile) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await saveAccessProfile({
        ...draftProfile,
        actorRa: authProfile?.ra ?? null,
      });
      setSaveSuccess(true);
      setDraftProfile(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignUser = async (user: AccessUser) => {
    if (!selectedProfile) return;
    try {
      await assignUserAccessProfile(user, selectedProfile, authProfile?.ra ?? null);
    } catch (err) {
      console.error("Erro ao atribuir:", err);
    }
  };

  const handleSyncProfiles = async () => {
    setSyncing(true);
    try {
      const result = await seedDefaultAccessProfiles(authProfile?.ra ?? null);
      console.log("Perfis sincronizados:", result);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Erro ao sincronizar:", err);
    } finally {
      setSyncing(false);
    }
  };

  const isEditing = draftProfile !== null;
  const tokens = displayProfile ? getToneTokens(displayProfile.tone) : getToneTokens("cyan");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Perfis de Acesso</h1>
          <p className="mt-1 text-sm text-slate-400">
            Gerencie quem pode acessar o quê no sistema K9 Ops
          </p>
        </div>
        <div className="flex items-center gap-3">
          {syncing && (
            <span className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200">
              Sincronizando...
            </span>
          )}
          {saveSuccess && (
            <span className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200">
              Sincronizado com sucesso!
            </span>
          )}
          <button
            className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-50"
            disabled={syncing}
            onClick={handleSyncProfiles}
            type="button"
          >
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            Sincronizar Perfis
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard detail="perfis configurados" icon={KeyRound} label="Total de Perfis" tone="violet" value={String(stats.totalProfiles)} />
        <MetricCard detail="usuários ativos" icon={Users} label="Usuários" tone="cyan" value={String(stats.activeUsers)} />
        <MetricCard detail="instrutores K9" icon={Award} label="Instrutores" tone="amber" value={String(stats.instructorCount)} />
        <MetricCard detail="ações sensíveis" icon={ShieldAlert} label="Permissões Críticas" tone="blue" value={String(criticalPermissionCount(profiles))} />
      </div>

      {/* Main Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* Left: Profile Cards */}
        <div className="space-y-4">
          {/* Search + Tabs */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
                placeholder="Buscar perfil..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Profile Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {filteredProfiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                isSelected={selectedProfileId === profile.id}
                profile={profile}
                userCount={usersForProfile(users, profile.id).length}
                onAssign={() => {
                  setSelectedProfileId(profile.id);
                  setActiveTab("users");
                }}
                onEdit={() => handleEditProfile(profile)}
                onSelect={() => handleSelectProfile(profile)}
              />
            ))}
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div>
          {!displayProfile ? (
            <div className="flex h-full min-h-96 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
              <KeyRound className="h-14 w-14 text-slate-600" />
              <p className="mt-4 text-base font-semibold text-slate-400">
                Selecione um perfil
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Clique em um perfil ao lado para ver os detalhes
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Profile Header */}
              <div className={cn("rounded-3xl border bg-gradient-to-br from-slate-950 to-slate-900 p-6", tokens.border)}>
                <div className="flex items-start gap-4">
                  <ProfileIcon profile={displayProfile} size={72} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-black text-white">{displayProfile.name}</h2>
                        <p className="mt-1 text-sm text-slate-400">{displayProfile.id}</p>
                      </div>
                      <LevelBadge level={displayProfile.level} />
                    </div>
                    <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                      {displayProfile.description || "Sem descrição"}
                    </p>
                    {displayProfile.role_keys.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {displayProfile.role_keys.map((key) => (
                          <span
                            key={key}
                            className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-400"
                          >
                            {roleKeyLabels[key] ?? key}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
                  <div className="text-center">
                    <p className="font-mono text-2xl font-black text-white">
                      {usersForProfile(users, displayProfile.id).length}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">usuários</p>
                  </div>
                  <div className="text-center border-x border-white/10">
                    <p className="font-mono text-2xl font-black text-white">
                      {countModulesWithAccess(displayProfile)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">módulos</p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-2xl font-black text-white">
                      {countActivePermissions(displayProfile)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">permissões</p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2">
                {accessTabs.map((tab) => (
                  <TabButton
                    key={tab.id}
                    active={activeTab === tab.id}
                    description={tab.description}
                    label={tab.label}
                    onClick={() => setActiveTab(tab.id)}
                  />
                ))}
              </div>

              {/* Tab Content */}
              <div className={cn("rounded-3xl border border-white/10 bg-slate-950/50 p-6", tokens.border)}>
                {activeTab === "overview" && (
                  <PermissionMatrix
                    profile={displayProfile}
                    onToggle={() => {}}
                  />
                )}

                {activeTab === "permissions" && (
                  <div className="space-y-4">
                    {isEditing && (
                      <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="h-5 w-5 text-amber-400" />
                          <span className="text-sm text-amber-200">Modo de edição ativo</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setDraftProfile(null)}
                            variant="ghost"
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            variant="primary"
                          >
                            {saving ? "Salvando..." : "Salvar"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {saveSuccess && (
                      <div className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                        <Check className="h-5 w-5 text-emerald-400" />
                        <span className="text-sm text-emerald-200">Perfil salvo com sucesso!</span>
                      </div>
                    )}

                    {saveError && (
                      <div className="flex items-center gap-3 rounded-xl border border-red-400/30 bg-red-400/10 p-4">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <span className="text-sm text-red-200">{saveError}</span>
                      </div>
                    )}

                    <PermissionMatrix
                      profile={draftProfile ?? displayProfile}
                      onToggle={isEditing ? handleTogglePermission : () => {}}
                    />

                    {!isEditing && (
                      <Button
                        onClick={() => handleEditProfile(displayProfile)}
                        variant="primary"
                        className="w-full"
                      >
                        <UserCog className="mr-2 h-4 w-4" />
                        Editar Permissões
                      </Button>
                    )}
                  </div>
                )}

                {activeTab === "users" && (
                  <div className="space-y-4">
                    <UserAssignmentList profile={displayProfile} users={users} />

                    <div className="border-t border-white/10 pt-4">
                      <p className="mb-3 text-sm font-semibold text-slate-300">Atribuir outro usuário</p>
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {users
                          .filter((u) => u.accessProfileId !== displayProfile.id)
                          .slice(0, 10)
                          .map((user) => (
                            <div
                              key={user.ra}
                              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-400">
                                  {user.callsign?.[0]?.toUpperCase() ?? "?"}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-white">{user.callsign}</p>
                                  <p className="text-xs text-slate-500">{user.ra}</p>
                                </div>
                              </div>
                              <Button
                                onClick={() => handleAssignUser(user)}
                                variant="ghost"
                              >
                                Atribuir
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
