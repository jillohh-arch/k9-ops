"use client";

import {
  Archive,
  Award,
  Boxes,
  Check,
  Download,
  Eye,
  LayoutGrid,
  Lock,
  Shield,
  ShieldCheck,
  User,
  UserCog,
  Users,
} from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import {
  accessActions,
  accessModules,
  countActivePermissions,
  countModulesWithAccess,
  type AccessAction,
  type AccessModuleId,
  type AccessProfile,
} from "@/lib/permissions/access-control";
import type { AccessUser } from "@/features/access/data/access-profile-service";

import {
  accessLevelLabels,
  formatNumber,
  hasPermission,
  inputClass,
  levelActions,
  levelToneClasses,
  moduleIconById,
  moduleLabel,
  moduleLevel,
  profileLevelLabels,
  roleKeyLabel,
  setModuleAccessLevel,
  textareaClass,
  togglePermission,
  toneOptions,
  usersForProfile,
  type ModuleAccessLevel,
} from "./access-profiles-types";
import {
  LevelBadge,
  ProfileIcon,
  SectionCard,
} from "./access-profiles-primitives";

// ─── Profile Hero ─────────────────────────────────────────────────────────

function TargetIcon() {
  return <ShieldCheck className="h-6 w-6 text-cyan-200" />;
}

export function ProfileHero({
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
              {profile.description || "Sem descrição cadastrada."}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border-white/10 sm:border-l sm:pl-6">
            <Users className="h-6 w-6 text-cyan-200" />
            <p className="mt-2 font-mono text-2xl font-black text-white">
              {formatNumber(usersForProfile(users, profile.id).length)}
            </p>
            <p className="text-xs text-slate-500">usuários vinculados</p>
          </div>
          <div className="border-white/10 sm:border-l sm:pl-6">
            <Boxes className="h-6 w-6 text-violet-200" />
            <p className="mt-2 font-mono text-2xl font-black text-white">
              {countModulesWithAccess(profile)}/{accessModules.length}
            </p>
            <p className="text-xs text-slate-500">módulos liberados</p>
          </div>
          <div className="border-white/10 sm:border-l sm:pl-6">
            <TargetIcon />
            <p className="mt-2 text-lg font-black text-white">
              {profile.scope === "own_records" ? "Próprio usuário" : "Global"}
            </p>
            <p className="text-xs text-slate-500">escopo de dados</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Profile Summary ──────────────────────────────────────────────────────

export function ProfileSummary({ profile }: { profile: AccessProfile }) {
  return (
    <SectionCard
      icon={<ShieldCheck className="h-5 w-5" />}
      title="Resumo do perfil"
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/18">
        {[
          ["Nível de acesso predominante", profileLevelLabels[profile.level] ?? profile.level],
          ["Escopo", profile.scope === "own_records" ? "Próprio usuário" : "Global"],
          ["Identificadores avançados", profile.role_keys.length ? profile.role_keys.map(roleKeyLabel).join(", ") : "não informados"],
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

// ─── Profile Identity Form ────────────────────────────────────────────────

function commaListToArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToCommaList(values: string[]) {
  return values.join(", ");
}

export function ProfileIdentityForm({
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
      icon={<Award className="h-5 w-5" />}
      title="Identidade"
      subtitle="Nome, nível e descrição do perfil."
    >
      <div className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-300">
              Nome do perfil
            </span>
            <input
              className={inputClass}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
              placeholder="Ex.: Condutor K9"
              value={draft.name}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-300">
              Identificador único
            </span>
            <input
              className={inputClass}
              disabled={!isCreating}
              onChange={(event) =>
                onChange({ ...draft, id: event.target.value })
              }
              placeholder="operador_k9"
              value={draft.id}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Descrição
          </span>
          <textarea
            className={textareaClass}
            onChange={(event) =>
              onChange({ ...draft, description: event.target.value })
            }
            placeholder="Descreva o propósito deste perfil..."
            value={draft.description}
          />
        </label>
        <div className="grid gap-5 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-300">
              Nível
            </span>
            <select
              className={inputClass}
              onChange={(event) =>
                onChange({ ...draft, level: event.target.value })
              }
              value={draft.level}
            >
              {["máximo", "gestão", "operacional", "técnico", "logística", "restrito", "leitura"].map(
                (level) => (
                  <option className="bg-surface-card" key={level} value={level}>
                    {profileLevelLabels[level] ?? level}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-300">
              Cor / tom
            </span>
            <select
              className={inputClass}
              onChange={(event) =>
                onChange({ ...draft, tone: event.target.value })
              }
              value={draft.tone ?? "cyan"}
            >
              {toneOptions.map((tone) => (
                <option className="bg-surface-card" key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-slate-300">
              Escopo (dados)
            </span>
            <select
              className={inputClass}
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
              <option className="bg-surface-card" value="global">
                Global
              </option>
              <option className="bg-surface-card" value="own_records">
                Próprio usuário
              </option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-300">
            Identificadores avançados
          </span>
          <input
            className={inputClass}
            onChange={(event) =>
              onChange({
                ...draft,
                role_keys: commaListToArray(event.target.value),
              })
            }
            placeholder="operador_k9, instrutor_k9..."
            value={arrayToCommaList(draft.role_keys)}
          />
          <span className="mt-2 block text-[11px] leading-5 text-slate-500">
            Campo técnico para integração. Altere somente ao criar ou migrar um
            perfil institucional.
          </span>
        </label>
      </div>
    </SectionCard>
  );
}

// ─── Scope Selector ───────────────────────────────────────────────────────

export function ScopeSelector({
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
      label: "Próprio usuário",
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

// ─── Module Level Card ────────────────────────────────────────────────────

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
            {accessActions
              .filter(
                (action) => hasPermission(profile, moduleId, action.id),
              )
              .map((action) => action.label)
              .join(", ") || "sem permissões"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          ["none", "consulta", "operacional", "gestão", "total"] as ModuleAccessLevel[]
        ).map((level) => (
          <button
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-bold transition",
              currentLevel === level
                ? levelToneClasses[level]
                : "border-white/10 text-slate-500 hover:border-white/20",
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

// ─── Sensitive Toggle ─────────────────────────────────────────────────────

function SensitiveToggle({
  active,
  icon: Icon,
  label,
  onToggle,
}: {
  active: boolean;
  icon: typeof Lock;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-2xl border p-4 text-left transition",
        active
          ? "border-amber-300/30 bg-amber-300/12"
          : "border-white/10 bg-black/18 hover:border-amber-300/20",
      )}
      onClick={onToggle}
      type="button"
    >
      <Icon
        className={cn("h-5 w-5", active ? "text-amber-200" : "text-slate-500")}
      />
      <span
        className={cn(
          "mt-2 block text-xs font-bold",
          active ? "text-amber-100" : "text-slate-400",
        )}
      >
        {label}
      </span>
    </button>
  );
}

// ─── Permissions Editor ───────────────────────────────────────────────────

export function PermissionsEditor({
  draft,
  onChange,
}: {
  draft: AccessProfile;
  onChange: (profile: AccessProfile) => void;
}) {
  const visibleModuleIds = accessModules.map((module) => module.id);

  return (
    <div className="space-y-5">
      <SectionCard
        action={
          <span className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[10px] text-slate-400">
            {countActivePermissions(draft)} permissões ativas
          </span>
        }
        icon={<LayoutGrid className="h-5 w-5" />}
        subtitle="Escolha o nível de acesso por módulo."
        title="Módulos e níveis de acesso"
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
        subtitle="Permissões críticas que exigem atenção redobrada."
        title="Ações sensíveis"
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
            label="Pode aprovar evolução K9"
            onToggle={() => onChange(togglePermission(draft, "training", "approve"))}
          />
          <SensitiveToggle
            active={hasPermission(draft, "access", "edit")}
            icon={UserCog}
            label="Pode alterar permissões"
            onToggle={() => onChange(togglePermission(draft, "access", "edit"))}
          />
          <SensitiveToggle
            active={hasPermission(draft, "reports", "export")}
            icon={Download}
            label="Pode exportar relatórios"
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

// ─── Composed Editor ──────────────────────────────────────────────────────

export function AccessProfilesEditor({
  draft,
  isCreating,
  onChange,
  onDuplicate,
  profile,
  saving,
  users,
}: {
  draft: AccessProfile;
  isCreating: boolean;
  onChange: (profile: AccessProfile) => void;
  onDuplicate: () => void;
  profile: AccessProfile;
  saving: boolean;
  users: AccessUser[];
}) {
  return (
    <div className="space-y-5">
      <ProfileHero profile={profile} users={users} />
      <ProfileSummary profile={profile} />
      <ProfileIdentityForm
        draft={draft}
        isCreating={isCreating}
        onChange={onChange}
      />
      <ScopeSelector draft={draft} onChange={onChange} />
      <PermissionsEditor draft={draft} onChange={onChange} />
    </div>
  );
}
