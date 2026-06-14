"use client";

import {
  ClipboardList,
  Filter,
  KeyRound,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  accessPolicyVersion,
  countModulesWithAccess,
  accessModules,
  defaultAccessProfiles,
  type AccessProfile,
} from "@/lib/permissions/access-control";
import type { AccessUser } from "@/features/access/data/access-profile-service";

import {
  criticalPermissionCount,
  formatNumber,
  usersForProfile,
} from "./access-profiles-types";
import {
  LevelBadge,
  MetricCard,
  ProfileCard,
  SectionCard,
  SecuritySummary,
} from "./access-profiles-primitives";

export function AccessProfilesOverview({
  canCreateAccess,
  onSelectProfile,
  onStartNew,
  profiles,
  selectedProfile,
  userCounts,
  users,
}: {
  canCreateAccess: boolean;
  onSelectProfile: (profile: AccessProfile, tab?: "overview" | "permissions" | "users") => void;
  onStartNew: () => void;
  profiles: AccessProfile[];
  selectedProfile: AccessProfile;
  userCounts: Map<string, number>;
  users: AccessUser[];
}) {
  const linkedUsers = users.filter((user) => user.accessProfileId).length;
  const withoutProfile = users.filter((user) => !user.accessProfileId).length;
  const outdatedOfficialProfiles = useMemo(() => {
    const officialProfileIds = new Set(defaultAccessProfiles.map((p) => p.id));
    return profiles.filter(
      (profile) =>
        officialProfileIds.has(profile.id) &&
        profile.seed_version < accessPolicyVersion,
    ).length;
  }, [profiles]);
  const reviewPendencies = withoutProfile + outdatedOfficialProfiles;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          detail={`${profiles.length} oficiais ativos`}
          icon={Users}
          label="Perfis ativos"
          tone="cyan"
          value={formatNumber(profiles.length)}
        />
        <MetricCard
          detail="usuários com perfil definido"
          icon={UserCheck}
          label="Usuários vinculados"
          tone="blue"
          value={formatNumber(linkedUsers)}
        />
        <MetricCard
          detail={`em ${profiles.length} perfis`}
          icon={ShieldAlert}
          label="Permissões sensíveis"
          tone="amber"
          value={formatNumber(criticalPermissionCount(profiles))}
        />
        <MetricCard
          detail={`${withoutProfile} usuário(s) sem perfil`}
          icon={ClipboardList}
          label="Pendências de revisão"
          tone="violet"
          value={formatNumber(reviewPendencies)}
        />
      </section>

      <div className="grid gap-5 2xl:grid-cols-[1fr_360px]">
        <SectionCard
          action={
            canCreateAccess ? (
              <Button onClick={onStartNew} variant="secondary">
                <Plus className="mr-2 h-4 w-4" />
                Novo Perfil
              </Button>
            ) : undefined
          }
          title="Perfis e escopos"
          subtitle="Visão geral dos perfis cadastrados e seus níveis de acesso."
        >
          {profiles.length ? (
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {profiles.map((profile) => (
                <ProfileCard
                  active={profile.id === selectedProfile.id}
                  key={profile.id}
                  onAssign={() => onSelectProfile(profile, "users")}
                  onEdit={() => onSelectProfile(profile, "permissions")}
                  onSelect={() => onSelectProfile(profile)}
                  profile={profile}
                  userCount={userCounts.get(profile.id) ?? 0}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-slate-700" />
              <p className="mt-3 text-sm text-slate-400">
                Nenhum perfil cadastrado.
              </p>
            </div>
          )}
        </SectionCard>
        <SecuritySummary profiles={profiles} users={users} />
      </div>
    </div>
  );
}
