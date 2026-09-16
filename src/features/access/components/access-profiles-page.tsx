"use client";

import {
  AlertCircle,
  Award,
  Boxes,
  CheckCircle2,
  Crown,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  assignUserAccessProfile,
  seedDefaultAccessProfiles,
  unassignUserAccessProfile,
  type AccessUser,
} from "@/features/access/data/access-profile-service";
import { useAccessProfiles } from "@/features/access/hooks/use-access-profiles";
import { useAccessUsers } from "@/features/access/hooks/use-access-users";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { AccessOnboardingJourney } from "./access-onboarding-journey";
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
  return rawUserProfileId(user);
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

function ProfileIconBadge({
  profile,
  size = "md",
}: {
  profile: AccessProfile;
  size?: "sm" | "md" | "lg";
}) {
  const tone = getTone(profile);
  const Icon = profileIcons[profile.id] ?? ShieldCheck;

  const sizeClasses = {
    sm: "h-8 w-8 rounded-lg",
    md: "h-10 w-10 rounded-xl",
    lg: "h-12 w-12 rounded-2xl",
  }[size];

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }[size];

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center border shadow-[0_0_18px_rgba(77,208,225,0.08)]",
        sizeClasses,
        tone.border,
        tone.bg,
        tone.icon,
      )}
    >
      <Icon className={iconSizes} />
    </span>
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
        "rounded-2xl border border-cyan-200/12 bg-slate-950/70 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.22)]",
        className,
      )}
    >
      <div className="mb-4">
        <h2 className="text-base font-black text-white">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function UserRow({
  blocked,
  highlighted,
  selected,
  user,
}: {
  blocked?: boolean;
  highlighted?: boolean;
  selected?: boolean;
  user: AccessUser;
}) {
  const numericRa = hasNumericRa(user);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-2.5 transition",
        selected
          ? "border-cyan-300/30 bg-cyan-300/10"
          : highlighted
            ? "border-cyan-300/60 bg-cyan-300/15 ring-2 ring-cyan-400/50"
            : blocked
              ? "border-amber-300/20 bg-amber-300/10"
              : "border-white/10 bg-black/20 hover:border-white/15",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100">
        {(user.callsign || user.fullName || user.ra).slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-white">
          {user.callsign || user.fullName || user.ra}
        </span>
        <span className="block truncate text-[11px] text-slate-400">
          {numericRa ? `RA ${user.ra}` : "Cadastro sem RA numérico"}
          {user.isK9Instructor ? " · Instrutor K9" : ""}
          {highlighted ? " · Indicado para acesso" : ""}
        </span>
      </span>
      {blocked ? (
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
      ) : null}
      {selected ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-300" />
      ) : null}
    </div>
  );
}

type TabType = "profiles" | "capabilities" | "sync";

export function AccessProfilesPage() {
  const { can } = useAccessControl();
  const canManageAccess = can("access", "edit");
  const { profile: authProfile } = useAuth();
  const { profiles, loading: profilesLoading } = useAccessProfiles();
  const { users, loading: usersLoading } = useAccessUsers();

  const searchParams = useSearchParams();
  const targetRa = searchParams?.get?.("ra")?.trim() ?? "";

  const [activeTab, setActiveTab] = useState<TabType>("profiles");
  const [selectedProfileId, setSelectedProfileId] = useState("operador_k9");
  const [searchQuery, setSearchQuery] = useState(targetRa);
  const [prevTargetRa, setPrevTargetRa] = useState(targetRa);
  const [assigningRa, setAssigningRa] = useState<string | null>(null);

  if (targetRa !== prevTargetRa) {
    setPrevTargetRa(targetRa);
    setSearchQuery(targetRa);
  }
  const [unassignTargetUser, setUnassignTargetUser] = useState<AccessUser | null>(null);
  const [unassigningRa, setUnassigningRa] = useState<string | null>(null);
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
  const targetUser = useMemo(
    () => users.find((user) => user.ra === targetRa),
    [users, targetRa],
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

  async function handleUnassignUser(user: AccessUser) {
    setUnassigningRa(user.ra);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await unassignUserAccessProfile(user.ra, authProfile?.ra ?? null);
      setStatusMessage(
        `Perfil ${selectedProfile?.name ?? ""} desvinculado com sucesso de ${user.callsign || user.ra}. O acesso base agora está Não provisionado.`,
      );
      setUnassignTargetUser(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível desvincular o perfil de acesso.",
      );
    } finally {
      setUnassigningRa(null);
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
      {/* Top Header */}
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
      </div>

      {/* Onboarding Journey for target RA */}
      {targetRa ? (
        <AccessOnboardingJourney
          actorRa={authProfile?.ra ?? null}
          canManageAccess={canManageAccess}
          onClearTarget={() => {
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", "/access");
            }
            setPrevTargetRa("");
            setSearchQuery("");
          }}
          onProfileAssigned={(profileName) => {
            setStatusMessage(`Perfil ${profileName} atribuído com sucesso.`);
          }}
          profiles={displayProfiles}
          targetRa={targetRa}
          targetUser={targetUser}
        />
      ) : null}

      {/* Top HUD Compact Summary */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-cyan-200/12 bg-slate-950/60 px-4 py-3 text-xs sm:text-sm">
        <span className="font-semibold text-slate-200">
          <span className="font-mono font-black text-cyan-200">{formatNumber(displayProfiles.length)}</span> perfis
        </span>
        <span className="text-slate-600">·</span>
        <span className="font-semibold text-slate-200">
          <span className="font-mono font-black text-cyan-200">{formatNumber(users.length)}</span> usuários
        </span>
        <span className="text-slate-600">·</span>
        <span className="font-semibold text-slate-200">
          <span className="font-mono font-black text-cyan-200">{formatNumber(instructorCount)}</span> {instructorCount === 1 ? "instrutor" : "instrutores"}
        </span>

        {profilesToSync.length > 0 ? (
          <>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1.5 font-bold text-amber-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono">{profilesToSync.length}</span>{" "}
              {profilesToSync.length === 1 ? "pendência de sincronização" : "pendências de sincronização"}
            </span>
          </>
        ) : null}

        {usersWithoutVisibleProfile.length + legacyProfileUsers.length > 0 ? (
          <>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="font-mono font-bold text-slate-300">
                {usersWithoutVisibleProfile.length + legacyProfileUsers.length}
              </span>{" "}
              cadastros a revisar
              {legacyProfileUsers.length > 0 ? (
                <span className="ml-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                  {legacyProfileUsers.length} legado(s)
                </span>
              ) : null}
            </span>
          </>
        ) : null}
      </div>

      {/* Global Status / Error Feedback */}
      {statusMessage ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-semibold text-emerald-100">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
          <span>{statusMessage}</span>
        </div>
      ) : null}
      {errorMessage ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm font-semibold text-red-100">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-300" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {/* Segmented Navigation / Tabs */}
      <div
        aria-label="Navegação de controle de acessos"
        className="flex items-center gap-2 border-b border-white/10 pb-px"
        role="tablist"
      >
        <button
          aria-selected={activeTab === "profiles"}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition",
            activeTab === "profiles"
              ? "border-cyan-400 text-cyan-200"
              : "border-transparent text-slate-400 hover:text-slate-200",
          )}
          onClick={() => setActiveTab("profiles")}
          role="tab"
          type="button"
        >
          <Users className="h-4 w-4" />
          Perfis e usuários
        </button>
        <button
          aria-selected={activeTab === "capabilities"}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition",
            activeTab === "capabilities"
              ? "border-cyan-400 text-cyan-200"
              : "border-transparent text-slate-400 hover:text-slate-200",
          )}
          onClick={() => setActiveTab("capabilities")}
          role="tab"
          type="button"
        >
          <Award className="h-4 w-4" />
          Capacidades especiais
        </button>
        <button
          aria-selected={activeTab === "sync"}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition",
            activeTab === "sync"
              ? "border-cyan-400 text-cyan-200"
              : "border-transparent text-slate-400 hover:text-slate-200",
          )}
          onClick={() => setActiveTab("sync")}
          role="tab"
          type="button"
        >
          <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
          Sincronização
          {profilesToSync.length > 0 ? (
            <span className="ml-1 rounded-full border border-amber-300/30 bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-200">
              {profilesToSync.length}
            </span>
          ) : null}
        </button>
      </div>

      {/* SECTION 1: PERFIS E USUÁRIOS (Master-Detail) */}
      {activeTab === "profiles" ? (
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)] items-start">
          {/* Master List (Left) */}
          <SectionCard
            subtitle="Selecione um perfil oficial para inspecionar e gerenciar integrantes."
            title="Perfis oficiais"
          >
            <div className="space-y-2.5">
              {displayProfiles.map((profile) => {
                const active = profile.id === selectedProfile?.id;
                const tone = getTone(profile);
                const count = usersForProfile(users, profile.id).length;
                const missingRemote = !remoteProfileIds.has(profile.id);

                return (
                  <button
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition",
                      active
                        ? cn(
                            tone.border,
                            tone.bg,
                            "ring-1 ring-cyan-400/30 shadow-[0_0_24px_rgba(0,188,212,0.12)]",
                          )
                        : "border-white/10 bg-slate-900/40 hover:border-white/20 hover:bg-slate-900/70",
                    )}
                    key={profile.id}
                    onClick={() => setSelectedProfileId(profile.id)}
                    type="button"
                  >
                    <ProfileIconBadge profile={profile} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <h3 className="truncate text-sm font-bold text-white">
                          {profile.name}
                        </h3>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em]",
                            tone.border,
                            tone.bg,
                            tone.text,
                          )}
                        >
                          {levelLabels[profile.level] ?? profile.level}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-400">
                        {profile.description}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300">
                          <span className="font-mono font-bold text-white">{formatNumber(count)}</span>{" "}
                          {count === 1 ? "usuário" : "usuários"}
                        </span>
                        <span>·</span>
                        <span>
                          <span className="font-mono font-bold text-slate-300">{countModulesWithAccess(profile)}</span> módulos
                        </span>
                        {missingRemote ? (
                          <span className="ml-auto rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-200">
                            sincronizar
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* Detail Pane (Right) */}
          {selectedProfile ? (
            <div className="space-y-6 min-w-0">
              {/* Prominent Profile Identity Header */}
              <div className="rounded-2xl border border-cyan-200/15 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.25)]">
                <div className="flex flex-wrap items-start gap-4">
                  <ProfileIconBadge profile={selectedProfile} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-xl font-black text-white">
                        {selectedProfile.name}
                      </h2>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]",
                          getTone(selectedProfile).border,
                          getTone(selectedProfile).bg,
                          getTone(selectedProfile).text,
                        )}
                      >
                        {levelLabels[selectedProfile.level] ?? selectedProfile.level}
                      </span>
                      {!remoteProfileIds.has(selectedProfile.id) ? (
                        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">
                          Pendente de sincronização
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {selectedProfile.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                      <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300">
                        <strong className="font-mono text-cyan-200">{formatNumber(selectedProfileUsers.length)}</strong> usuários vinculados
                      </span>
                      <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300">
                        <strong className="font-mono text-cyan-200">{countModulesWithAccess(selectedProfile)}</strong> módulos com acesso
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order 1: Linked Users (Primary Focus) */}
              <SectionCard
                subtitle="Integrantes atualmente autorizados sob este perfil de acesso."
                title="Usuários vinculados"
              >
                <div className="space-y-2.5">
                  {selectedProfileUsers.map((user) => (
                    <div className="flex items-center gap-2.5" key={user.ra}>
                      <div className="min-w-0 flex-1">
                        <UserRow selected user={user} />
                      </div>
                      {canManageAccess ? (
                        <button
                          className="shrink-0 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-400/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={
                            !user.active ||
                            assigningRa === user.ra ||
                            unassigningRa === user.ra
                          }
                          onClick={() => setUnassignTargetUser(user)}
                          title={
                            !user.active
                              ? "Reative o integrante antes de alterar o perfil de acesso."
                              : "Desvincular usuário deste perfil"
                          }
                          type="button"
                        >
                          Desvincular
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {!selectedProfileUsers.length ? (
                    <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                      Nenhum usuário vinculado a este perfil.
                    </p>
                  ) : null}
                </div>
              </SectionCard>

              {/* Order 2: Assignment Action */}
              <SectionCard
                subtitle={`Selecione um usuário para vincular ao perfil ${selectedProfile.name}.`}
                title="Atribuir usuário"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar por nome ou RA..."
                    value={searchQuery}
                  />
                </div>
                <div className="mt-3 max-h-[340px] space-y-2 overflow-y-auto pr-1">
                  {targetRa ? (
                    <div className="mb-2 flex items-center justify-between rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-200">
                      <span>
                        Filtro ativo por RA: <strong>{targetRa}</strong>
                      </span>
                      <button
                        className="text-[11px] font-bold text-cyan-300 underline hover:text-cyan-100"
                        onClick={() => setSearchQuery("")}
                        type="button"
                      >
                        Limpar
                      </button>
                    </div>
                  ) : null}
                  {filteredUsers.map((user) => {
                    const alreadySelected =
                      visibleUserProfileId(user) === selectedProfile.id;
                    const blocked = !hasNumericRa(user);
                    const isTarget = Boolean(targetRa && user.ra === targetRa);
                    return (
                      <button
                        className="w-full text-left disabled:cursor-not-allowed disabled:opacity-55"
                        disabled={
                          alreadySelected ||
                          blocked ||
                          assigningRa === user.ra ||
                          !canManageAccess
                        }
                        key={user.ra}
                        onClick={() => handleAssignUser(user)}
                        title={
                          blocked
                            ? "Cadastre o RA numérico do usuário antes de alterar o perfil."
                            : undefined
                        }
                        type="button"
                      >
                        <UserRow
                          blocked={blocked}
                          highlighted={isTarget}
                          selected={alreadySelected}
                          user={user}
                        />
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

              {/* Order 3: Modules and Permissions Summary (Secondary Visual Priority) */}
              <SectionCard
                subtitle="Resumo de prerrogativas e níveis de acesso concedidos por este perfil."
                title="Módulos e permissões"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {moduleSummaries(selectedProfile).map((module) => (
                    <div
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs"
                      key={module.id}
                    >
                      <span className="font-semibold text-white truncate">
                        {module.label}
                      </span>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100 shrink-0">
                        {module.level}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* SECTION 2: CAPACIDADES ESPECIAIS */}
      {activeTab === "capabilities" ? (
        <div className="space-y-6">
          {/* Independence Explanatory Banner */}
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
            <div className="flex items-start gap-3">
              <Award className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
              <div>
                <p className="font-bold text-cyan-100">
                  Capacidades especiais são independentes do perfil de acesso.
                </p>
                <p className="mt-1 text-xs sm:text-sm text-cyan-100/70 leading-relaxed">
                  Capacidades como Instrutor K9 são atributos funcionais individuais vinculados
                  ao cadastro do agente no efetivo. Elas não constituem um perfil de acesso isolado
                  nem concedem permissões fora do escopo funcional definido.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Primary Special Capability: Instrutor K9 */}
            <SectionCard
              subtitle="Habilitação técnica para avaliação e progressão de cães de serviço."
              title="Instrutor K9"
            >
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
                    <Award className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black text-white">Instrutor K9</p>
                      <span className="font-mono text-xl font-black text-cyan-200">
                        {formatNumber(instructorCount)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                      Permite avaliar evolução de treino e aprovar progressão.
                      É marcado no cadastro do agente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2 max-h-[360px] overflow-y-auto pr-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Integrantes qualificados ({instructorCount})
                </p>
                {users
                  .filter((u) => u.isK9Instructor)
                  .map((user) => (
                    <UserRow key={user.ra} user={user} />
                  ))}
                {instructorCount === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
                    Nenhum integrante com capacidade de Instrutor K9 cadastrado.
                  </p>
                ) : null}
              </div>
            </SectionCard>

            {/* Distinct Review Section: Cadastros a revisar */}
            <SectionCard
              subtitle="Usuários que necessitam de intervenção segura no cadastro."
              title="Cadastros a revisar"
            >
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="font-bold text-sm text-slate-200">Resumo de pendências cadastrais</p>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Usuários sem perfil oficial ou com perfil legado aparecem aqui
                  para correção segura.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                    {usersWithoutVisibleProfile.length} sem perfil oficial
                  </span>
                  <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs text-amber-200">
                    {legacyProfileUsers.length} legado(s)
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2 max-h-[360px] overflow-y-auto pr-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Listagem para revisão ({usersWithoutVisibleProfile.length + legacyProfileUsers.length})
                </p>
                {[...usersWithoutVisibleProfile, ...legacyProfileUsers]
                  .filter((u, idx, arr) => arr.findIndex((x) => x.ra === u.ra) === idx)
                  .map((user) => {
                    const isLegacy = ["instrutor_k9", "subinspetor_inspetor"].includes(
                      rawUserProfileId(user) ?? "",
                    );
                    return (
                      <div
                        className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-2.5"
                        key={user.ra}
                      >
                        <UserRow blocked={!hasNumericRa(user)} user={user} />
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
                          <span>Perfil atual: {user.accessProfile || user.role || "Nenhum"}</span>
                          {isLegacy ? (
                            <span className="font-bold text-amber-300">Perfil legado</span>
                          ) : (
                            <span className="text-slate-500">Sem perfil oficial</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {usersWithoutVisibleProfile.length + legacyProfileUsers.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
                    Todos os cadastros estão alinhados a perfis oficiais válidos.
                  </p>
                ) : null}
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {/* SECTION 3: SINCRONIZAÇÃO */}
      {activeTab === "sync" ? (
        <div className="space-y-6">
          {/* Header Action Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-200/12 bg-slate-950/70 p-5">
            <div>
              <h2 className="text-base font-black text-white">
                Sincronização de perfis oficiais
              </h2>
              <p className="mt-1 max-w-2xl text-xs text-slate-400 leading-relaxed">
                Alinha o banco Firestore com a política de acesso canônica (versão {accessPolicyVersion}).
                Garante que todos os perfis institucionais possuam as permissões e módulos corretos.
              </p>
            </div>
            <Button
              disabled={syncing || !canManageAccess}
              onClick={handleSyncProfiles}
              variant="primary"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "Sincronizando perfis..." : "Sincronizar perfis"}
            </Button>
          </div>

          {/* Sync Status Banner */}
          {profilesToSync.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                <div>
                  <p className="font-bold text-amber-100">
                    Perfis aguardando sincronização
                  </p>
                  <p className="mt-1 text-xs text-amber-100/70">
                    Há perfis oficiais aguardando sincronização para ficarem alinhados à política v{accessPolicyVersion}.
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-amber-300/25 px-3 py-1 text-xs font-black text-amber-100">
                {profilesToSync.length} pendência(s) de sincronização
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-xs sm:text-sm text-emerald-100">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
              <span>
                Todos os perfis oficiais estão sincronizados com a política de governança v{accessPolicyVersion}.
              </span>
            </div>
          )}

          {/* Official Default Profiles Audit List */}
          <SectionCard
            subtitle="Status individual de cada perfil oficial em relação à base de dados remota."
            title="Perfis do sistema"
          >
            <div className="space-y-3">
              {defaultAccessProfiles.map((defProfile) => {
                const isPending = profilesToSync.some((p) => p.id === defProfile.id);
                const remoteProfile = profiles.find((p) => p.id === defProfile.id);
                const tone = getTone(defProfile);

                return (
                  <div
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 transition",
                      isPending
                        ? "border-amber-300/25 bg-amber-300/5"
                        : "border-white/10 bg-slate-900/30",
                    )}
                    key={defProfile.id}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProfileIconBadge profile={defProfile} size="sm" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white">
                            {defProfile.name}
                          </p>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em]",
                              tone.border,
                              tone.bg,
                              tone.text,
                            )}
                          >
                            {levelLabels[defProfile.level] ?? defProfile.level}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate max-w-md">
                          {defProfile.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 font-mono">
                        v{remoteProfile?.seed_version ?? defProfile.seed_version}
                      </span>
                      {isPending ? (
                        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200">
                          Aguardando sincronização
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Sincronizado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {/* Unassign Confirmation Modal */}
      {unassignTargetUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1b2a] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              Desvincular perfil de acesso
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Confirma a desvinculação de{" "}
              <strong className="text-white">
                {unassignTargetUser.callsign || unassignTargetUser.fullName || unassignTargetUser.ra}
              </strong>{" "}
              (RA {unassignTargetUser.ra}) do perfil{" "}
              <strong className="text-cyan-200">{selectedProfile?.name}</strong>?
            </p>

            <div className="mt-4 space-y-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-xs text-slate-400">
              <p>
                <strong className="text-slate-300">• Acesso base:</strong> Passará para{" "}
                <span className="font-semibold text-cyan-200">Não provisionado</span>.
              </p>
              <p>
                <strong className="text-slate-300">• Integrante (Lifecycle):</strong> O cadastro no efetivo{" "}
                <span className="text-slate-200">não é desativado</span>.
              </p>
              <p>
                <strong className="text-slate-300">• Instrutor K9:</strong> A qualificação funcional{" "}
                <span className="text-slate-200">permanece inalterada</span> independentemente.
              </p>
              <p>
                <strong className="text-slate-300">• Autenticação (Auth):</strong> A conta de acesso{" "}
                <span className="text-slate-200">não é removida</span>.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
                disabled={unassigningRa === unassignTargetUser.ra}
                onClick={() => setUnassignTargetUser(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                disabled={unassigningRa === unassignTargetUser.ra}
                onClick={() => handleUnassignUser(unassignTargetUser)}
                type="button"
              >
                {unassigningRa === unassignTargetUser.ra ? (
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Desvinculando...
                  </span>
                ) : (
                  "Confirmar desvinculação"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
