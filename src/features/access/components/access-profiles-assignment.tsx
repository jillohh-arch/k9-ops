"use client";

import {
  ArrowRight,
  Search,
  Shield,
  User,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  accessModules,
  countActivePermissions,
  countModulesWithAccess,
  type AccessProfile,
} from "@/lib/permissions/access-control";
import type { AccessUser } from "@/features/access/data/access-profile-service";

import {
  formatNumber,
  inputClass,
  moduleLevel,
  usersForProfile,
} from "./access-profiles-types";
import {
  Avatar,
  LevelBadge,
  ProfileIcon,
  SectionCard,
} from "./access-profiles-primitives";

export function AccessProfilesAssignment({
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">
            Atribuir perfil a usuários
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Selecione usuários e vincule ao perfil de acesso desejado.
          </p>
        </div>
        <Button
          disabled={!selectedUsers.length}
          onClick={() => onAssignMany(selectedUsers, targetProfile)}
          variant="primary"
        >
          <ArrowRight className="mr-2 h-4 w-4" />
          Atribuir {selectedUsers.length ? `(${selectedUsers.length})` : ""}
        </Button>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <SectionCard
            icon={<Search className="h-5 w-5" />}
            subtitle="Busque por nome, RA ou unidade."
            title="Selecionar usuários"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className={cn(inputClass, "pl-10")}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar usuário..."
                value={search}
              />
            </div>

            <div className="mt-4 space-y-2">
              {filteredUsers.map((user) => {
                const checked = selectedRas.includes(user.ra);
                return (
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                      checked
                        ? "border-cyan-300/35 bg-cyan-300/10"
                        : "border-white/10 bg-black/18 hover:border-cyan-300/20",
                    )}
                    key={user.ra}
                    onClick={() => toggleUser(user.ra)}
                    type="button"
                  >
                    <Avatar user={user} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-white">
                        {user.callsign || user.fullName || user.ra}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {user.unit ?? ""}{" "}
                        {user.accessProfile ? `· ${user.accessProfile}` : ""}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border",
                        checked
                          ? "border-cyan-300 bg-cyan-300 text-slate-950"
                          : "border-white/20",
                      )}
                    >
                      {checked ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
              {!filteredUsers.length ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Nenhum usuário localizado.
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Perfil de destino">
            <div className="flex flex-wrap gap-2">
              {profiles.map((profile) => (
                <button
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs font-bold transition",
                    targetProfileId === profile.id
                      ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-100"
                      : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-300/20",
                  )}
                  key={profile.id}
                  onClick={() => setTargetProfileId(profile.id)}
                  type="button"
                >
                  {profile.name}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-4 rounded-2xl border border-white/10 bg-black/18 p-4">
              <ProfileIcon profile={targetProfile} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xl font-black text-white">
                    {targetProfile.name}
                  </h3>
                  <LevelBadge level={targetProfile.level} />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {targetProfile.description || "Sem descrição."}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 border-t border-white/10 pt-4 md:grid-cols-2">
              <span>
                <span className="block text-xs text-slate-500">Escopo</span>
                <span className="font-semibold text-white">
                  {targetProfile.scope === "own_records"
                    ? "Próprio usuário"
                    : "Global"}
                </span>
              </span>
              <span>
                <span className="block text-xs text-slate-500">
                  Módulos liberados
                </span>
                <span className="font-semibold text-white">
                  {countModulesWithAccess(targetProfile)} módulos
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
          </SectionCard>

          <SectionCard title="Resumo da atribuição">
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/18 p-4 md:grid-cols-4">
              <span>
                <span className="block text-xs text-slate-500">Perfil</span>
                <span className="font-black text-white">{targetProfile.name}</span>
              </span>
              <span>
                <span className="block text-xs text-slate-500">Usuários</span>
                <span className="font-mono text-lg font-black text-white">
                  {selectedUsers.length}
                </span>
              </span>
              <span>
                <span className="block text-xs text-slate-500">Vigência</span>
                <span className="font-semibold text-white">imediata</span>
              </span>
              <span>
                <span className="block text-xs text-slate-500">Permissões</span>
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
            title="Usuários vinculados"
            subtitle="Usuários que já possuem este perfil."
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
                      <span className="block truncate font-bold text-white">
                        {user.callsign || user.fullName || user.ra}
                      </span>
                      <span className="block text-xs text-slate-500">
                        RA {user.ra}
                      </span>
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">
                  Nenhum usuário vinculado.
                </p>
              )}
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
