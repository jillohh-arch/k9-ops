"use client";

import {
  AlertCircle,
  Archive,
  ArrowRight,
  Award,
  BarChart3,
  Boxes,
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
  Save,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  UserCog,
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

type AccessTab = "overview" | "permissions" | "users";
type ModuleAccessLevel = "none" | "consulta" | "operacional" | "gestao" | "total";

type ModuleView = {
  icon: LucideIcon;
  id: AccessModuleId;
};

const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-55";

const textareaClass =
  "min-h-20 w-full rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-55";

const levelOptions = ["maximo", "gestao", "operacional", "tecnico", "logistica", "restrito", "leitura"];
const toneOptions = ["violet", "cyan", "amber", "blue", "orange", "green", "purple", "slate"];

const accessTabs: Array<{
  description: string;
  id: AccessTab;
  label: string;
}> = [
  {
    description: "cards e seguranca",
    id: "overview",
    label: "Central",
  },
  {
    description: "modulos e niveis",
    id: "permissions",
    label: "Editar perfil",
  },
  {
    description: "vincular usuarios",
    id: "users",
    label: "Atribuicao",
  },
];

const roleKeyLabels: Record<string, string> = {
  admin: "Administrador",
  administrador: "Administrador",
  admin_master: "Legado admin",
  almoxarifado: "Almoxarifado",
  condutor: "Condutor",
  estoque: "Estoque",
  gestor: "Gestao",
  handler: "Condutor mobile",
  inspetor: "Inspetor",
  instrutor: "Instrutor",
  instrutor_k9: "Instrutor K9",
  inventory_manager: "Gestor de estoque",
  mobile_user: "Acesso mobile",
  subinspetor: "Subinspetor",
  subinspetor_inspetor: "Gestao inspetoria",
};

const toneClasses: Record<string, string> = {
  amber: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  blue: "border-blue-300/30 bg-blue-300/10 text-blue-200",
  cyan: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
  green: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  orange: "border-orange-300/30 bg-orange-300/10 text-orange-200",
  purple: "border-purple-300/30 bg-purple-300/10 text-purple-200",
  slate: "border-slate-300/20 bg-slate-300/10 text-slate-200",
  violet: "border-violet-300/30 bg-violet-300/10 text-violet-200",
};

const levelToneClasses: Record<ModuleAccessLevel, string> = {
  consulta: "border-cyan-300/35 bg-cyan-300/10 text-cyan-200",
  gestao: "border-blue-300/35 bg-blue-300/10 text-blue-200",
  none: "border-slate-400/20 bg-slate-400/10 text-slate-400",
  operacional: "border-emerald-300/35 bg-emerald-300/10 text-emerald-200",
  total: "border-violet-300/35 bg-violet-300/10 text-violet-200",
};

const accessLevelLabels: Record<ModuleAccessLevel, string> = {
  consulta: "Consulta",
  gestao: "Gestao",
  none: "Sem acesso",
  operacional: "Operacional",
  total: "Total",
};

const levelActions: Record<ModuleAccessLevel, AccessAction[]> = {
  consulta: ["view"],
  gestao: ["view", "create", "edit", "export", "approve", "audit"],
  none: [],
  operacional: ["view", "create", "edit", "approve"],
  total: accessActions.map((action) => action.id),
};

const moduleViews: ModuleView[] = [
  { id: "dashboard", icon: LayoutGrid },
  { id: "me", icon: User },
  { id: "k9", icon: PawPrint },
  { id: "humans", icon: Users },
  { id: "binomials", icon: UserCheck },
  { id: "vehicles", icon: Shield },
  { id: "occurrences", icon: ShieldAlert },
  { id: "training", icon: Award },
  { id: "training_matrix", icon: BarChart3 },
  { id: "health", icon: HeartPulse },
  { id: "inventory", icon: Boxes },
  { id: "reports", icon: FileText },
  { id: "audit", icon: ClipboardList },
  { id: "access", icon: KeyRound },
  { id: "settings", icon: Settings },
];

const moduleIconById = Object.fromEntries(
  moduleViews.map((module) => [module.id, module.icon]),
) as Partial<Record<AccessModuleId, LucideIcon>>;

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function getToneClass(tone: string) {
  return toneClasses[tone] ?? toneClasses.cyan;
}

function roleKeyLabel(roleKey: string) {
  return roleKeyLabels[roleKey] ?? roleKey;
}

function commaListToArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToCommaList(value: string[]) {
  return value.join(", ");
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
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
    seed_version: 2,
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
    return "gestao";
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

function ProfileIcon({ profile }: { profile: AccessProfile }) {
  const Icon =
    profile.id === "administrador"
      ? Crown
      : profile.id === "condutor"
        ? User
        : profile.id === "instrutor_k9"
          ? PawPrint
          : profile.id === "almoxarifado"
            ? Boxes
            : ShieldCheck;

  return (
    <span
      className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-[0_0_28px_rgba(77,208,225,0.12)]",
        getToneClass(profile.tone),
      )}
    >
      <Icon className="h-7 w-7" />
    </span>
  );
}

function LevelBadge({ level }: { level: string }) {
  return (
    <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">
      {level}
    </span>
  );
}

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
        "rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon ? (
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              {icon}
            </span>
          ) : null}
          <div>
            <h2 className="text-lg font-black text-white">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

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
  return (
    <article
      className={cn(
        "relative min-h-32 overflow-hidden rounded-[1.45rem] border p-5",
        getToneClass(tone),
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_18%,rgba(255,255,255,0.14),transparent_24%)]" />
      <div className="relative flex items-start justify-between gap-5">
        <div>
          <p className="text-sm font-semibold text-slate-200">{label}</p>
          <p className="mt-4 font-mono text-4xl font-black text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055]">
          <Icon className="h-6 w-6" />
        </span>
      </div>
    </article>
  );
}

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
        "rounded-2xl border px-4 py-3 text-left transition",
        active
          ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-100 shadow-[0_0_30px_rgba(77,208,225,0.1)]"
          : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-cyan-300/20 hover:text-slate-100",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="block text-sm font-black">{label}</span>
      <span className="mt-1 block text-[11px] text-slate-500">
        {description}
      </span>
    </button>
  );
}

function ProfileCard({
  active,
  onAssign,
  onEdit,
  onSelect,
  profile,
  userCount,
}: {
  active: boolean;
  onAssign: () => void;
  onEdit: () => void;
  onSelect: () => void;
  profile: AccessProfile;
  userCount: number;
}) {
  return (
    <article
      className={cn(
        "rounded-[1.45rem] border bg-[#0b1628]/72 transition",
        active
          ? "border-cyan-300/35 shadow-[0_0_34px_rgba(0,188,212,0.14)]"
          : "border-white/10",
      )}
    >
      <button
        className="w-full p-4 text-left"
        onClick={onSelect}
        type="button"
      >
        <div className="flex items-start gap-4">
          <ProfileIcon profile={profile} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-white">
                  {profile.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                  {profile.description || "Sem descricao cadastrada."}
                </p>
              </div>
              <LevelBadge level={profile.level} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
              <span>
                <span className="block text-xs text-slate-500">Usuarios</span>
                <span className="font-mono text-lg font-black text-white">
                  {formatNumber(userCount)}
                </span>
              </span>
              <span>
                <span className="block text-xs text-slate-500">
                  Modulos liberados
                </span>
                <span className="font-mono text-lg font-black text-white">
                  {countModulesWithAccess(profile)}/{accessModules.length}
                </span>
              </span>
            </div>
          </div>
        </div>
      </button>
      <div className="grid grid-cols-3 border-t border-white/10 text-xs text-slate-400">
        <button
          className="flex items-center justify-center gap-2 px-3 py-3 transition hover:bg-white/[0.045] hover:text-cyan-200"
          onClick={onSelect}
          type="button"
        >
          <Eye className="h-4 w-4" />
          Ver detalhes
        </button>
        <button
          className="flex items-center justify-center gap-2 border-x border-white/10 px-3 py-3 transition hover:bg-white/[0.045] hover:text-cyan-200"
          onClick={onEdit}
          type="button"
        >
          <KeyRound className="h-4 w-4" />
          Editar
        </button>
        <button
          className="flex items-center justify-center gap-2 px-3 py-3 transition hover:bg-white/[0.045] hover:text-cyan-200"
          onClick={onAssign}
          type="button"
        >
          <Users className="h-4 w-4" />
          Atribuir
        </button>
      </div>
    </article>
  );
}

function SecuritySummary({
  lastMessage,
  profiles,
  users,
}: {
  lastMessage: string | null;
  profiles: AccessProfile[];
  users: AccessUser[];
}) {
  const totalAccessProfiles = profiles.filter(
    (profile) => moduleLevel(profile, "access") !== "none",
  ).length;
  const withoutProfile = users.filter((user) => !user.accessProfileId).length;
  const critical = criticalPermissionCount(profiles);

  return (
    <aside className="space-y-5">
      <SectionCard
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Resumo de Seguranca"
      >
        <div className="space-y-3">
          {[
            {
              icon: Lock,
              label: "Perfis com acesso a Central",
              value: totalAccessProfiles,
            },
            {
              icon: AlertCircle,
              label: "Usuarios sem perfil",
              value: withoutProfile,
            },
            {
              icon: ShieldAlert,
              label: "Permissoes criticas ativas",
              value: critical,
            },
            {
              icon: CalendarDays,
              label: "Ultima alteracao",
              value: lastMessage ? "agora" : "--",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/18 px-4 py-3"
                key={item.label}
              >
                <span className="flex items-center gap-3 text-sm text-slate-300">
                  <Icon className="h-4 w-4 text-cyan-200" />
                  {item.label}
                </span>
                <span className="font-mono text-sm font-black text-white">
                  {item.value}
                </span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        action={<span className="text-xs font-semibold text-cyan-200">sessao</span>}
        title="Revisoes recentes"
      >
        <div className="space-y-3">
          {lastMessage ? (
            <div className="rounded-2xl border border-cyan-300/18 bg-cyan-300/[0.06] p-4">
              <p className="font-black text-white">Alteracao aplicada</p>
              <p className="mt-1 text-sm text-slate-400">{lastMessage}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
              <p className="font-black text-white">Sem alteracoes nesta sessao</p>
              <p className="mt-1 text-sm text-slate-400">
                A trilha historica completa fica em Auditoria.
              </p>
            </div>
          )}
          <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
            <p className="font-black text-white">Perfis oficiais ativos</p>
            <p className="mt-1 text-sm text-slate-400">
              {profiles.map((profile) => profile.name).join(" · ")}
            </p>
          </div>
        </div>
      </SectionCard>
    </aside>
  );
}

function ProfileHero({
  profile,
  users,
}: {
  profile: AccessProfile;
  users: AccessUser[];
}) {
  return (
    <section className="rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/72 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-4">
          <ProfileIcon profile={profile} />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-black text-white">{profile.name}</h2>
              <LevelBadge level={profile.level} />
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {profile.description || "Sem descricao cadastrada."}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border-white/10 sm:border-l sm:pl-6">
            <Users className="h-6 w-6 text-cyan-200" />
            <p className="mt-2 font-mono text-2xl font-black text-white">
              {formatNumber(usersForProfile(users, profile.id).length)}
            </p>
            <p className="text-xs text-slate-500">usuarios vinculados</p>
          </div>
          <div className="border-white/10 sm:border-l sm:pl-6">
            <Boxes className="h-6 w-6 text-violet-200" />
            <p className="mt-2 font-mono text-2xl font-black text-white">
              {countModulesWithAccess(profile)}/{accessModules.length}
            </p>
            <p className="text-xs text-slate-500">modulos liberados</p>
          </div>
          <div className="border-white/10 sm:border-l sm:pl-6">
            <TargetIcon />
            <p className="mt-2 text-lg font-black text-white">
              {profile.scope === "own_records" ? "Proprio usuario" : "Global"}
            </p>
            <p className="text-xs text-slate-500">escopo de dados</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TargetIcon() {
  return <ShieldCheck className="h-6 w-6 text-cyan-200" />;
}

function ProfileSummary({ profile }: { profile: AccessProfile }) {
  return (
    <SectionCard
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Resumo do Perfil"
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/18">
        {[
          ["Nivel de acesso predominante", profile.level],
          ["Escopo", profile.scope === "own_records" ? "Proprio usuario" : "Global"],
          ["Claims tecnicas", profile.role_keys.length ? profile.role_keys.map(roleKeyLabel).join(", ") : "sem claim"],
          ["Status", profile.status === "active" ? "Ativo" : "Inativo"],
        ].map(([label, value]) => (
          <div
            className="grid gap-2 border-b border-white/10 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto]"
            key={label}
          >
            <span className="text-sm text-slate-400">{label}</span>
            <span className="text-sm font-semibold text-white">{value}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function ProfileIdentityForm({
  draft,
  isCreating,
  onChange,
}: {
  draft: AccessProfile;
  isCreating: boolean;
  onChange: (profile: AccessProfile) => void;
}) {
  return (
    <SectionCard
      icon={<UserCog className="h-5 w-5" />}
      title={isCreating ? "Identidade do Perfil" : "Dados do perfil"}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.55fr_0.45fr]">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Nome do perfil
          </span>
          <input
            className={inputClass}
            onChange={(event) => {
              const name = event.target.value;
              onChange({
                ...draft,
                id: isCreating ? slug(name) || draft.id : draft.id,
                name,
                slug: isCreating ? slug(name) || draft.slug : draft.slug,
              });
            }}
            value={draft.name}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Descricao
          </span>
          <textarea
            className={cn(textareaClass, "min-h-11 py-2")}
            onChange={(event) =>
              onChange({ ...draft, description: event.target.value })
            }
            value={draft.description}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Tipo de perfil
          </span>
          <select
            className={`${inputClass} appearance-none`}
            onChange={(event) =>
              onChange({ ...draft, level: event.target.value })
            }
            value={draft.level}
          >
            {levelOptions.map((option) => (
              <option className="bg-[#0b1628]" key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Cor / badge
          </span>
          <select
            className={`${inputClass} appearance-none`}
            onChange={(event) =>
              onChange({ ...draft, tone: event.target.value })
            }
            value={draft.tone}
          >
            {toneOptions.map((option) => (
              <option className="bg-[#0b1628]" key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[0.45fr_1fr]">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Escopo
          </span>
          <select
            className={`${inputClass} appearance-none`}
            onChange={(event) =>
              onChange({
                ...draft,
                scope:
                  event.target.value === "own_records"
                    ? "own_records"
                    : "global",
              })
            }
            value={draft.scope ?? "global"}
          >
            <option className="bg-[#0b1628]" value="global">
              Global
            </option>
            <option className="bg-[#0b1628]" value="own_records">
              Proprio usuario
            </option>
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Claims / roles tecnicas
          </span>
          <input
            className={inputClass}
            onChange={(event) =>
              onChange({
                ...draft,
                role_keys: commaListToArray(event.target.value),
              })
            }
            placeholder="condutor, instrutor_k9..."
            value={arrayToCommaList(draft.role_keys)}
          />
        </label>
      </div>
    </SectionCard>
  );
}

function ScopeSelector({
  draft,
  onChange,
}: {
  draft: AccessProfile;
  onChange: (profile: AccessProfile) => void;
}) {
  const options = [
    {
      icon: Shield,
      label: "Global",
      value: "global",
    },
    {
      icon: User,
      label: "Proprio usuario",
      value: "own_records",
    },
  ];

  return (
    <SectionCard
      icon={<TargetIcon />}
      title="Escopo"
      subtitle="Defina o limite de dados que este perfil pode enxergar."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = (draft.scope ?? "global") === option.value;
          return (
            <button
              className={cn(
                "rounded-2xl border p-5 text-left transition",
                selected
                  ? "border-cyan-300/45 bg-cyan-300/12 text-cyan-100"
                  : "border-white/10 bg-black/18 text-slate-300 hover:border-cyan-300/25",
              )}
              key={option.value}
              onClick={() =>
                onChange({
                  ...draft,
                  scope:
                    option.value === "own_records" ? "own_records" : "global",
                })
              }
              type="button"
            >
              <Icon className="h-7 w-7" />
              <span className="mt-3 block font-black">{option.label}</span>
              {selected ? (
                <span className="mt-2 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs">
                  selecionado
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

function ModuleLevelCard({
  moduleId,
  onChange,
  profile,
}: {
  moduleId: AccessModuleId;
  onChange: (profile: AccessProfile) => void;
  profile: AccessProfile;
}) {
  const Icon = moduleIconById[moduleId] ?? Shield;
  const currentLevel = moduleLevel(profile, moduleId);

  return (
    <article className="rounded-[1.35rem] border border-white/10 bg-black/18 p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
            levelToneClasses[currentLevel],
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-white">{moduleLabel(moduleId)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {accessModules.find((module) => module.id === moduleId)?.category}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-5 overflow-hidden rounded-xl border border-white/10">
        {(Object.keys(accessLevelLabels) as ModuleAccessLevel[]).map((level) => (
          <button
            className={cn(
              "min-h-10 border-r border-white/10 px-2 text-[10px] font-black transition last:border-r-0",
              currentLevel === level
                ? levelToneClasses[level]
                : "bg-slate-950/35 text-slate-500 hover:bg-white/[0.04] hover:text-slate-200",
            )}
            key={level}
            onClick={() => onChange(setModuleAccessLevel(profile, moduleId, level))}
            type="button"
          >
            {accessLevelLabels[level]}
          </button>
        ))}
      </div>
    </article>
  );
}

function SensitiveToggle({
  active,
  icon: Icon,
  label,
  onToggle,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      className={cn(
        "flex min-h-24 items-center justify-between gap-4 rounded-2xl border p-4 text-left transition",
        active
          ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
          : "border-white/10 bg-black/18 text-slate-300 hover:border-cyan-300/25",
      )}
      onClick={onToggle}
      type="button"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        <span className="font-semibold">{label}</span>
      </span>
      <span
        className={cn(
          "relative h-7 w-12 rounded-full border transition",
          active
            ? "border-cyan-300/40 bg-cyan-300/30"
            : "border-slate-400/20 bg-slate-700/40",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-slate-300 transition",
            active ? "left-6 bg-cyan-200" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

function PermissionsEditor({
  draft,
  onChange,
}: {
  draft: AccessProfile;
  onChange: (profile: AccessProfile) => void;
}) {
  const visibleModuleIds = moduleViews.map((module) => module.id);

  return (
    <div className="space-y-5">
      <SectionCard
        action={
          <span className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
            {countModulesWithAccess(draft)} / {accessModules.length}
          </span>
        }
        icon={<LayoutGrid className="h-5 w-5" />}
        subtitle="Escolha o nivel de acesso por modulo, sem a matriz gigante."
        title="Modulos e Niveis de Acesso"
      >
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visibleModuleIds.map((moduleId) => (
            <ModuleLevelCard
              key={moduleId}
              moduleId={moduleId}
              onChange={onChange}
              profile={draft}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        className="border-amber-300/20"
        icon={<Lock className="h-5 w-5" />}
        subtitle="Permissoes criticas que exigem atencao redobrada."
        title="Acoes Sensiveis"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SensitiveToggle
            active={hasPermission(draft, "k9", "archive")}
            icon={Archive}
            label="Pode arquivar registros"
            onToggle={() => onChange(togglePermission(draft, "k9", "archive"))}
          />
          <SensitiveToggle
            active={hasPermission(draft, "training", "approve")}
            icon={Check}
            label="Pode aprovar evolucao K9"
            onToggle={() => onChange(togglePermission(draft, "training", "approve"))}
          />
          <SensitiveToggle
            active={hasPermission(draft, "access", "edit")}
            icon={UserCog}
            label="Pode alterar permissoes"
            onToggle={() => onChange(togglePermission(draft, "access", "edit"))}
          />
          <SensitiveToggle
            active={hasPermission(draft, "reports", "export")}
            icon={Download}
            label="Pode exportar relatorios"
            onToggle={() => onChange(togglePermission(draft, "reports", "export"))}
          />
          <SensitiveToggle
            active={hasPermission(draft, "audit", "view")}
            icon={Eye}
            label="Pode ver auditoria"
            onToggle={() => onChange(togglePermission(draft, "audit", "view"))}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function AssignmentBoard({
  onAssignMany,
  profiles,
  selectedProfile,
  users,
}: {
  onAssignMany: (users: AccessUser[], profile: AccessProfile) => Promise<void>;
  profiles: AccessProfile[];
  selectedProfile: AccessProfile;
  users: AccessUser[];
}) {
  const [search, setSearch] = useState("");
  const [targetProfileId, setTargetProfileId] = useState(selectedProfile.id);
  const [selectedRas, setSelectedRas] = useState<string[]>([]);

  const targetProfile =
    profiles.find((profile) => profile.id === targetProfileId) ?? selectedProfile;
  const filteredUsers = users
    .filter((user) =>
      [user.callsign, user.fullName, user.ra, user.unit, user.accessProfile]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .slice(0, 10);
  const selectedUsers = users.filter((user) => selectedRas.includes(user.ra));
  const linkedUsers = usersForProfile(users, targetProfile.id).slice(0, 5);
  const targetModules = accessModules
    .filter((module) => moduleLevel(targetProfile, module.id) !== "none")
    .slice(0, 5);

  const toggleUser = (ra: string) => {
    setSelectedRas((current) =>
      current.includes(ra)
        ? current.filter((item) => item !== ra)
        : [...current, ra],
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          disabled={!selectedUsers.length}
          onClick={async () => {
            await onAssignMany(selectedUsers, targetProfile);
            setSelectedRas([]);
          }}
        >
          <Check className="mr-2 h-4 w-4" />
          Aplicar atribuicao
        </Button>
        <Button onClick={() => setSelectedRas([])} variant="secondary">
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[0.8fr_1.1fr_0.8fr]">
        <SectionCard
          icon={<User className="h-5 w-5" />}
          title="Usuarios"
          subtitle="Selecione usuarios para atribuir o perfil."
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className={cn(inputClass, "pl-9")}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar usuarios..."
                value={search}
              />
            </label>
            <Button variant="secondary">
              <Filter className="mr-2 h-4 w-4" />
              Filtros
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {filteredUsers.map((user) => {
              const selected = selectedRas.includes(user.ra);
              return (
                <button
                  className={cn(
                    "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border p-3 text-left transition",
                    selected
                      ? "border-cyan-300/35 bg-cyan-300/10"
                      : "border-white/10 bg-black/18 hover:border-cyan-300/25",
                  )}
                  key={user.ra}
                  onClick={() => toggleUser(user.ra)}
                  type="button"
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-md border",
                      selected
                        ? "border-cyan-300/35 bg-cyan-300 text-slate-950"
                        : "border-slate-500/30 text-slate-500",
                    )}
                  >
                    {selected ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar user={user} />
                    <span className="min-w-0">
                      <span className="block truncate font-black text-white">
                        {user.callsign}
                      </span>
                      <span className="block truncate font-mono text-xs text-slate-500">
                        MAT: {user.ra}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-cyan-200">
                    {user.active ? "Online" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Perfil Selecionado"
            subtitle="Perfil que sera atribuido aos usuarios selecionados."
          >
            <select
              className={`${inputClass} mb-4 appearance-none`}
              onChange={(event) => setTargetProfileId(event.target.value)}
              value={targetProfile.id}
            >
              {profiles.map((profile) => (
                <option className="bg-[#0b1628]" key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/18 p-5">
              <div className="flex items-start gap-4">
                <ProfileIcon profile={targetProfile} />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-black text-white">
                      {targetProfile.name}
                    </h3>
                    <LevelBadge level={targetProfile.level} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {targetProfile.description || "Sem descricao."}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 border-t border-white/10 pt-4 md:grid-cols-2">
                <span>
                  <span className="block text-xs text-slate-500">Escopo</span>
                  <span className="font-semibold text-white">
                    {targetProfile.scope === "own_records"
                      ? "Proprio usuario"
                      : "Global"}
                  </span>
                </span>
                <span>
                  <span className="block text-xs text-slate-500">
                    Modulos liberados
                  </span>
                  <span className="font-semibold text-white">
                    {countModulesWithAccess(targetProfile)} modulos
                  </span>
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {targetModules.map((module) => (
                  <span
                    className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200"
                    key={module.id}
                  >
                    {module.label}
                  </span>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Resumo da Atribuicao">
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/18 p-4 md:grid-cols-4">
              <span>
                <span className="block text-xs text-slate-500">Perfil</span>
                <span className="font-black text-white">{targetProfile.name}</span>
              </span>
              <span>
                <span className="block text-xs text-slate-500">Usuarios</span>
                <span className="font-mono text-lg font-black text-white">
                  {selectedUsers.length}
                </span>
              </span>
              <span>
                <span className="block text-xs text-slate-500">Vigencia</span>
                <span className="font-semibold text-white">imediata</span>
              </span>
              <span>
                <span className="block text-xs text-slate-500">Permissoes</span>
                <span className="font-mono text-lg font-black text-white">
                  {countActivePermissions(targetProfile)}
                </span>
              </span>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-5">
          <SectionCard
            icon={<Users className="h-5 w-5" />}
            title="Usuarios vinculados"
            subtitle="Usuarios que ja possuem este perfil."
          >
            <div className="space-y-3">
              {linkedUsers.length ? (
                linkedUsers.map((user) => (
                  <div
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/18 p-3"
                    key={user.ra}
                  >
                    <Avatar user={user} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-white">
                        {user.callsign}
                      </span>
                      <span className="block truncate font-mono text-xs text-slate-500">
                        MAT: {user.ra}
                      </span>
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-cyan-200/15 bg-black/16 p-4 text-sm text-slate-400">
                  Nenhum usuario vinculado.
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Registro da Alteracao"
            subtitle="A Function grava a trilha da atribuicao."
          >
            <div className="space-y-4 text-sm text-slate-400">
              <p>
                A alteracao sera aplicada por callable admin e refletida em
                users/RA e custom claims.
              </p>
              <div className="rounded-2xl border border-amber-300/16 bg-amber-300/[0.06] p-4 text-amber-100">
                O usuario precisa renovar o token. Para teste limpo, faca
                logout/login apos receber o novo perfil.
              </div>
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

function Avatar({ user }: { user: AccessUser }) {
  return (
    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-cyan-300/20 bg-cyan-300/10">
      {user.photoUrl ? (
        <Image
          alt=""
          className="object-cover"
          fill
          src={user.photoUrl}
          unoptimized
        />
      ) : (
        <UserCog className="m-3 h-5 w-5 text-cyan-200/60" />
      )}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-cyan-200/15 bg-black/16 px-5 py-7 text-center text-sm text-slate-400">
      {label}
    </div>
  );
}

export function AccessProfilesPage() {
  const { profile: authProfile } = useAuth();
  const { error, loading, profiles } = useAccessProfiles();
  const {
    error: usersError,
    loading: usersLoading,
    users,
  } = useAccessUsers();
  const allProfiles = profiles.length ? profiles : defaultAccessProfiles;
  const visibleProfiles = useMemo(
    () =>
      allProfiles.filter((profile) => profile.status === "active").length
        ? allProfiles.filter((profile) => profile.status === "active")
        : defaultAccessProfiles.filter((profile) => profile.status === "active"),
    [allProfiles],
  );
  const archivedProfiles = useMemo(
    () => allProfiles.filter((profile) => profile.status !== "active"),
    [allProfiles],
  );
  const [activeTab, setActiveTab] = useState<AccessTab>("overview");
  const [selectedId, setSelectedId] = useState(defaultAccessProfiles[0].id);
  const [draft, setDraft] = useState<AccessProfile>(() =>
    cloneProfile(defaultAccessProfiles[0]),
  );
  const [dirty, setDirty] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () =>
      visibleProfiles.find((profile) => profile.id === selectedId) ??
      visibleProfiles[0] ??
      defaultAccessProfiles[0],
    [selectedId, visibleProfiles],
  );

  const userCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const user of users) {
      if (!user.accessProfileId) continue;
      counts.set(user.accessProfileId, (counts.get(user.accessProfileId) ?? 0) + 1);
    }
    return counts;
  }, [users]);

  function updateDraft(next: AccessProfile) {
    setDraft(next);
    setDirty(true);
    setMessage(null);
  }

  function selectProfile(profile: AccessProfile, tab?: AccessTab) {
    setSelectedId(profile.id);
    setDraft(cloneProfile(profile));
    setDirty(false);
    setIsCreating(false);
    setMessage(null);
    if (tab) setActiveTab(tab);
  }

  function startNewProfile() {
    const next = newProfileDraft();
    setSelectedId(next.id);
    setDraft(next);
    setDirty(true);
    setIsCreating(true);
    setMessage(null);
    setActiveTab("permissions");
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      setMessage("Informe o nome do perfil antes de salvar.");
      return;
    }
    if (!draft.id.trim()) {
      setMessage("Informe um identificador tecnico valido.");
      return;
    }

    setSaving(true);
    try {
      await saveAccessProfile({
        ...draft,
        actorRa: authProfile?.ra,
      });
      setDirty(false);
      setIsCreating(false);
      setSelectedId(draft.id);
      setMessage("Perfil salvo com sucesso.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao salvar perfil.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    setSaving(true);
    try {
      const newId = await duplicateAccessProfile(draft, authProfile?.ra);
      setSelectedId(newId);
      setMessage(`Perfil duplicado: ${newId}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao duplicar perfil.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignMany(
    selectedUsers: AccessUser[],
    profile: AccessProfile,
  ) {
    if (!selectedUsers.length) return;
    setSaving(true);
    try {
      for (const user of selectedUsers) {
        await assignUserAccessProfile(user, profile, authProfile?.ra);
      }
      setMessage(
        `${selectedUsers.length} usuario(s) agora usam o perfil ${profile.name}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao atribuir perfil.",
      );
    } finally {
      setSaving(false);
    }
  }

  const linkedUsers = users.filter((user) => Boolean(user.accessProfileId)).length;
  const withoutProfile = users.filter((user) => !user.accessProfileId).length;
  const reviewPendencies =
    withoutProfile +
    visibleProfiles.filter((profile) => !profile.role_keys.length).length;

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-cyan-200/12 bg-[#081320]/82 p-5 shadow-[0_26px_90px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              Gestao de acessos
            </p>
            <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">
              Central de Acessos
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Gerencie perfis, escopos e permissoes operacionais do K9 Ops.
              Roles tecnicas continuam sincronizadas pelas Functions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {activeTab === "permissions" ? (
              <Button disabled={!dirty || saving} onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar alteracoes"}
              </Button>
            ) : null}
            <Button onClick={startNewProfile} variant="secondary">
              <Plus className="mr-2 h-4 w-4" />
              Novo Perfil
            </Button>
          </div>
        </div>

        {error || usersError || message ? (
          <div
            className={cn(
              "mt-5 rounded-2xl border px-4 py-3 text-sm",
              error || usersError
                ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
                : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
            )}
          >
            {error ?? usersError ?? message}
          </div>
        ) : null}
      </header>

      <nav className="grid gap-3 md:grid-cols-3">
        {accessTabs.map((tab) => (
          <TabButton
            active={activeTab === tab.id}
            description={tab.description}
            key={tab.id}
            label={tab.label}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </nav>

      {activeTab === "overview" ? (
        <div className="space-y-5">
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              detail={`${visibleProfiles.length} oficiais ativos`}
              icon={Users}
              label="Perfis ativos"
              tone="cyan"
              value={formatNumber(visibleProfiles.length)}
            />
            <MetricCard
              detail="usuarios com perfil definido"
              icon={UserCheck}
              label="Usuarios vinculados"
              tone="blue"
              value={formatNumber(linkedUsers)}
            />
            <MetricCard
              detail={`em ${visibleProfiles.length} perfis`}
              icon={ShieldAlert}
              label="Permissoes sensiveis"
              tone="amber"
              value={formatNumber(criticalPermissionCount(visibleProfiles))}
            />
            <MetricCard
              detail={`${withoutProfile} usuario(s) sem perfil`}
              icon={ClipboardList}
              label="Pendencias de revisao"
              tone="violet"
              value={formatNumber(reviewPendencies)}
            />
          </section>

          <div className="grid gap-5 2xl:grid-cols-[1fr_360px]">
            <SectionCard
              action={
                <Button onClick={startNewProfile} variant="secondary">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Perfil
                </Button>
              }
              title="Perfis e Escopos"
              subtitle="Visao geral dos perfis cadastrados e seus niveis de acesso."
            >
              {visibleProfiles.length ? (
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {visibleProfiles.map((profile) => (
                    <ProfileCard
                      active={profile.id === selectedProfile.id}
                      key={profile.id}
                      onAssign={() => selectProfile(profile, "users")}
                      onEdit={() => selectProfile(profile, "permissions")}
                      onSelect={() => selectProfile(profile)}
                      profile={profile}
                      userCount={userCounts.get(profile.id) ?? 0}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState label="Nenhum perfil ativo encontrado." />
              )}
            </SectionCard>

            <SecuritySummary
              lastMessage={message}
              profiles={visibleProfiles}
              users={users}
            />
          </div>
        </div>
      ) : null}

      {activeTab === "permissions" ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button onClick={() => setActiveTab("overview")} variant="secondary">
              <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
              Voltar
            </Button>
            {!isCreating ? (
              <Button disabled={saving} onClick={handleDuplicate} variant="secondary">
                <Copy className="mr-2 h-4 w-4" />
                Duplicar perfil
              </Button>
            ) : null}
            <Button disabled={!dirty || saving} onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              {isCreating ? "Salvar perfil" : "Salvar alteracoes"}
            </Button>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <ProfileHero profile={draft} users={users} />
            <ProfileSummary profile={draft} />
          </div>

          <ProfileIdentityForm
            draft={draft}
            isCreating={isCreating}
            onChange={updateDraft}
          />
          <ScopeSelector draft={draft} onChange={updateDraft} />
          <PermissionsEditor draft={draft} onChange={updateDraft} />
        </div>
      ) : null}

      {activeTab === "users" ? (
        <AssignmentBoard
          onAssignMany={handleAssignMany}
          profiles={visibleProfiles}
          selectedProfile={selectedProfile}
          users={users}
        />
      ) : null}

      {archivedProfiles.length ? (
        <p className="text-xs text-slate-600">
          {archivedProfiles.length} perfil(is) legado(s) continuam arquivados
          para auditoria e nao aparecem na operacao.
        </p>
      ) : null}

      {loading || usersLoading ? (
        <div className="fixed bottom-5 right-5 rounded-full border border-cyan-300/20 bg-slate-950/90 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          sincronizando
        </div>
      ) : null}
    </div>
  );
}
