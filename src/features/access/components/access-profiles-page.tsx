"use client";

import {
  AlertCircle,
  Award,
  Boxes,
  CheckCircle2,
  Crown,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  assignUserAccessProfile,
  seedDefaultAccessProfiles,
  type AccessUser,
} from "@/features/access/data/access-profile-service";
import { useAccessProfiles } from "@/features/access/hooks/use-access-profiles";
import { useAccessUsers } from "@/features/access/hooks/use-access-users";
import { useAuth } from "@/features/auth/providers/auth-provider";
import {
  accessActions,
  accessModules,
  accessPolicyVersion,
  countModulesWithAccess,
  defaultAccessProfiles,
  getProfileIdFromLegacyValue,
  mergeAccessProfilesWithDefaults,
  visibleAccessProfiles,
  type AccessAction,
  type AccessModuleId,
  type AccessProfile,
} from "@/lib/permissions/access-control";
import { cn } from "@/lib/utils";

type ProfileTone = {
  border: string;
  bg: string;
  icon: string;
  text: string;
};

const profileIcons: Record<string, LucideIcon> = {
  administrador: Crown,
  almoxarifado: Boxes,
  gestor: ShieldCheck,
  operador_k9: User,
};

const toneMap: Record<string, ProfileTone> = {
  amber: {
    bg: "bg-amber-400/10",
    border: "border-amber-300/25",
    icon: "text-amber-200",
    text: "text-amber-100",
  },
  blue: {
    bg: "bg-blue-400/10",
    border: "border-blue-300/25",
    icon: "text-blue-200",
    text: "text-blue-100",
  },
  cyan: {
    bg: "bg-cyan-400/10",
    border: "border-cyan-300/25",
    icon: "text-cyan-200",
    text: "text-cyan-100",
  },
  orange: {
    bg: "bg-orange-400/10",
    border: "border-orange-300/25",
    icon: "text-orange-200",
    text: "text-orange-100",
  },
  violet: {
    bg: "bg-violet-400/10",
    border: "border-violet-300/25",
    icon: "text-violet-200",
    text: "text-violet-100",
  },
};

const levelLabels: Record<string, string> = {
  gestão: "Gestão",
  logística: "Logística",
  máximo: "Administrador",
  operacional: "Operacional",
  técnico: "Técnico",
};

function getTone(profile: AccessProfile) {
  return toneMap[profile.tone] ?? toneMap.cyan;
}

function formatNumber(value: number) {
  return Intl.NumberFormat("pt-BR").format(value);
}

function rawUserProfileId(user: AccessUser) {
  return (
    user.accessProfileId ??
    getProfileIdFromLegacyValue(user.accessProfile ?? user.role)
  );
}

function visibleUserProfileId(user: AccessUser) {
  const profileId = rawUserProfileId(user);
  if (profileId === "instrutor_k9") return "operador_k9";
  return profileId;
}

function hasNumericRa(user: AccessUser) {
  return /^\d{4,12}$/.test(user.ra.trim());
}

function usersForProfile(users: AccessUser[], profileId: string) {
  return users.filter((user) => visibleUserProfileId(user) === profileId);
}

function modulePermissionLevel(
  profile: AccessProfile,
  moduleId: AccessModuleId,
) {
  const permissions = profile.permissions[moduleId] ?? {};
  const enabled = accessActions
    .map((action) => action.id)
    .filter((action) => permissions[action] === true);

  if (!enabled.length) return null;
  if (enabled.length === accessActions.length) return "Acesso total";
  if (
    ["view", "create", "edit", "export", "approve", "audit"].every(
      (action) => permissions[action as AccessAction] === true,
    )
  ) {
    return "Gestão";
  }
  if (
    ["view", "create", "edit"].every(
      (action) => permissions[action as AccessAction] === true,
    )
  ) {
    return "Operacional";
  }
  return "Consulta";
}

function moduleSummaries(profile: AccessProfile) {
  return accessModules
    .map((module) => ({
      ...module,
      level: modulePermissionLevel(profile, module.id),
    }))
    .filter((module) => module.level != null);
}

function profileNeedsSync(profile: AccessProfile, remoteIds: Set<string>) {
  return !remoteIds.has(profile.id) || profile.seed_version < accessPolicyVersion;
}

function ProfileIcon({ profile }: { profile: AccessProfile }) {
  const tone = getTone(profile);
  const Icon = profileIcons[profile.id] ?? ShieldCheck;

  return (
    <span
      className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-[0_0_30px_rgba(77,208,225,0.12)]",
        tone.border,
        tone.bg,
        tone.icon,
      )}
    >
      <Icon className="h-6 w-6" />
    </span>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-cyan-200/12 bg-surface-card/82 p-4">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 font-mono text-2xl font-black text-white">{value}</p>
          <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
        </div>
      </div>
    </article>
  );
}

function SectionCard({
  children,
  className,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)]",
        className,
      )}
    >
      <div className="mb-5">
        <h2 className="text-lg font-black text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ProfileCard({
  active,
  missingRemote,
  onSelect,
  profile,
  userCount,
}: {
  active: boolean;
  missingRemote: boolean;
  onSelect: () => void;
  profile: AccessProfile;
  userCount: number;
}) {
  const tone = getTone(profile);

  return (
    <button
      className={cn(
        "w-full rounded-3xl border bg-gradient-to-br from-slate-950 to-slate-900 p-5 text-left transition",
        active ? cn(tone.border, "shadow-[0_0_34px_rgba(0,188,212,0.16)]") : "border-white/10 hover:border-white/20",
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start gap-4">
        <ProfileIcon profile={profile} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-white">{profile.name}</h3>
            <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]", tone.border, tone.bg, tone.text)}>
              {levelLabels[profile.level] ?? profile.level}
            </span>
            {missingRemote ? (
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100">
                sincronizar
              </span>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
            {profile.description}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
        <span>
          <span className="block text-xs text-slate-500">Usuários</span>
          <span className="font-mono text-xl font-black text-white">
            {formatNumber(userCount)}
          </span>
        </span>
        <span>
          <span className="block text-xs text-slate-500">Módulos</span>
          <span className="font-mono text-xl font-black text-white">
            {countModulesWithAccess(profile)}
          </span>
        </span>
      </div>
    </button>
  );
}

function UserRow({
  blocked,
  selected,
  user,
}: {
  blocked?: boolean;
  selected?: boolean;
  user: AccessUser;
}) {
  const numericRa = hasNumericRa(user);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3",
        selected
          ? "border-cyan-300/30 bg-cyan-300/10"
          : blocked
            ? "border-amber-300/20 bg-amber-300/10"
          : "border-white/10 bg-black/18",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/15 bg-cyan-300/10 text-sm font-black text-cyan-100">
        {(user.callsign || user.fullName || user.ra).slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-white">
          {user.callsign || user.fullName || user.ra}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {numericRa ? `RA ${user.ra}` : "Cadastro sem RA numérico"}
          {user.isK9Instructor ? " · Instrutor K9" : ""}
        </span>
      </span>
      {blocked ? (
        <AlertCircle className="h-5 w-5 text-amber-200" />
      ) : null}
      {selected ? <CheckCircle2 className="h-5 w-5 text-cyan-200" /> : null}
    </div>
  );
}

export function AccessProfilesPage() {
  const { profile: authProfile } = useAuth();
  const { profiles, loading: profilesLoading } = useAccessProfiles();
  const { users, loading: usersLoading } = useAccessUsers();
  const [selectedProfileId, setSelectedProfileId] = useState("operador_k9");
  const [searchQuery, setSearchQuery] = useState("");
  const [assigningRa, setAssigningRa] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mergedProfiles = useMemo(
    () => mergeAccessProfilesWithDefaults(profiles),
    [profiles],
  );
  const displayProfiles = useMemo(
    () => visibleAccessProfiles(mergedProfiles),
    [mergedProfiles],
  );
  const remoteProfileIds = useMemo(
    () => new Set(profiles.map((profile) => profile.id)),
    [profiles],
  );
  const selectedProfile =
    displayProfiles.find((profile) => profile.id === selectedProfileId) ??
    displayProfiles[0];
  const selectedProfileUsers = selectedProfile
    ? usersForProfile(users, selectedProfile.id)
    : [];
  const instructorCount = users.filter((user) => user.isK9Instructor).length;
  const usersWithoutVisibleProfile = users.filter((user) => {
    const profileId = visibleUserProfileId(user);
    return !profileId || !displayProfiles.some((profile) => profile.id === profileId);
  });
  const legacyProfileUsers = users.filter((user) =>
    ["instrutor_k9", "subinspetor_inspetor"].includes(rawUserProfileId(user) ?? ""),
  );
  const profilesToSync = defaultAccessProfiles.filter((profile) =>
    profileNeedsSync(
      profiles.find((remote) => remote.id === profile.id) ?? profile,
      remoteProfileIds,
    ),
  );
  const filteredUsers = users
    .filter((user) =>
      [user.callsign, user.fullName, user.ra, user.accessProfile, user.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.trim().toLowerCase()),
    )
    .slice(0, 12);

  async function handleSyncProfiles() {
    setSyncing(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const result = await seedDefaultAccessProfiles(authProfile?.ra ?? null);
      const changed =
        (result.created?.length ?? 0) + (result.updated?.length ?? 0);
      setStatusMessage(
        changed > 0
          ? `${changed} perfil(is) sincronizado(s) com a política atual.`
          : "Perfis oficiais já estavam sincronizados.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível sincronizar os perfis.",
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleAssignUser(user: AccessUser) {
    if (!selectedProfile) return;
    if (!remoteProfileIds.has(selectedProfile.id)) {
      setErrorMessage("Sincronize os perfis oficiais antes de atribuir este perfil.");
      return;
    }

    setAssigningRa(user.ra);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await assignUserAccessProfile(user, selectedProfile, authProfile?.ra ?? null);
      setStatusMessage(`${user.callsign || user.ra} agora usa o perfil ${selectedProfile.name}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atribuir o perfil.",
      );
    } finally {
      setAssigningRa(null);
    }
  }

  if (profilesLoading || usersLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-200" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.34em] text-cyan-300">
            Governança
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">Acessos</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Controle os perfis oficiais do K9 Ops, atribua usuários e acompanhe
            capacidades especiais sem expor a estrutura técnica do sistema.
          </p>
        </div>
        <Button disabled={syncing} onClick={handleSyncProfiles} variant="secondary">
          <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
          Sincronizar perfis
        </Button>
      </div>

      {profilesToSync.length ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-200" />
            <div>
              <p className="font-bold text-amber-100">
                Há perfis oficiais aguardando sincronização.
              </p>
              <p className="mt-1 text-sm text-amber-100/70">
                Isso mantém o Firestore alinhado com a política atual de acesso.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-amber-300/25 px-3 py-1 text-xs font-black text-amber-100">
            {profilesToSync.length} pendência(s)
          </span>
        </div>
      ) : null}

      {statusMessage ? (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-semibold text-emerald-100">
          {statusMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm font-semibold text-red-100">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          detail="perfis institucionais"
          icon={KeyRound}
          label="Perfis oficiais"
          value={formatNumber(displayProfiles.length)}
        />
        <MetricCard
          detail="usuários ativos no cadastro"
          icon={Users}
          label="Usuários"
          value={formatNumber(users.length)}
        />
        <MetricCard
          detail="capacidade especial"
          icon={Award}
          label="Instrutores K9"
          value={formatNumber(instructorCount)}
        />
        <MetricCard
          detail="cadastros a revisar"
          icon={AlertCircle}
          label="Pendências"
          value={formatNumber(usersWithoutVisibleProfile.length + legacyProfileUsers.length)}
        />
      </section>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-6">
          <SectionCard
            title="Perfis oficiais"
            subtitle="A tela mostra apenas os perfis que devem ser atribuídos aos usuários."
          >
            <div className="grid gap-4 xl:grid-cols-2">
              {displayProfiles.map((profile) => (
                <ProfileCard
                  active={profile.id === selectedProfile?.id}
                  key={profile.id}
                  missingRemote={!remoteProfileIds.has(profile.id)}
                  onSelect={() => setSelectedProfileId(profile.id)}
                  profile={profile}
                  userCount={usersForProfile(users, profile.id).length}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Capacidades especiais"
            subtitle="Capacidades complementam o perfil do usuário; não são perfis separados."
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
                    <Award className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="font-black text-white">Instrutor K9</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Permite avaliar evolução de treino e aprovar progressão.
                      É marcado no cadastro do agente.
                    </p>
                    <p className="mt-3 font-mono text-2xl font-black text-white">
                      {formatNumber(instructorCount)}
                    </p>
                  </div>
                </div>
              </article>
              <article className="rounded-2xl border border-white/10 bg-black/18 p-4">
                <p className="font-black text-white">Cadastros a revisar</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Usuários sem perfil oficial ou com perfil legado aparecem aqui
                  para correção segura.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                    {usersWithoutVisibleProfile.length} sem perfil oficial
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                    {legacyProfileUsers.length} legado(s)
                  </span>
                </div>
              </article>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-6">
          {selectedProfile ? (
            <SectionCard title={selectedProfile.name} subtitle="Resumo do acesso liberado.">
              <div className="flex items-start gap-4">
                <ProfileIcon profile={selectedProfile} />
                <div>
                  <p className="text-sm leading-6 text-slate-400">
                    {selectedProfile.description}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <span className="rounded-2xl border border-white/10 bg-black/18 p-3">
                      <span className="block text-xs text-slate-500">Usuários</span>
                      <span className="font-mono text-xl font-black text-white">
                        {formatNumber(selectedProfileUsers.length)}
                      </span>
                    </span>
                    <span className="rounded-2xl border border-white/10 bg-black/18 p-3">
                      <span className="block text-xs text-slate-500">Módulos</span>
                      <span className="font-mono text-xl font-black text-white">
                        {formatNumber(countModulesWithAccess(selectedProfile))}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {moduleSummaries(selectedProfile).map((module) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2"
                    key={module.id}
                  >
                    <span className="text-sm font-semibold text-white">{module.label}</span>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-bold text-cyan-100">
                      {module.level}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Usuários vinculados"
            subtitle="Quem já está dentro do perfil selecionado."
          >
            <div className="space-y-3">
              {selectedProfileUsers.slice(0, 6).map((user) => (
                <UserRow key={user.ra} selected user={user} />
              ))}
              {!selectedProfileUsers.length ? (
                <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                  Nenhum usuário vinculado a este perfil.
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Atribuir perfil"
            subtitle="Selecione um usuário para aplicar o perfil ativo."
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar por nome ou RA..."
                value={searchQuery}
              />
            </div>
            <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {filteredUsers.map((user) => {
                const alreadySelected =
                  selectedProfile != null &&
                  visibleUserProfileId(user) === selectedProfile.id;
                const blocked = !hasNumericRa(user);
                return (
                  <button
                    className="w-full text-left disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={alreadySelected || blocked || assigningRa === user.ra}
                    key={user.ra}
                    onClick={() => handleAssignUser(user)}
                    title={
                      blocked
                        ? "Cadastre o RA numérico do usuário antes de alterar o perfil."
                        : undefined
                    }
                    type="button"
                  >
                    <UserRow blocked={blocked} selected={alreadySelected} user={user} />
                  </button>
                );
              })}
              {!filteredUsers.length ? (
                <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                  Nenhum usuário localizado.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
