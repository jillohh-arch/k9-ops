"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Crown,
  Eye,
  PawPrint,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { countModulesWithAccess, accessModules, type AccessProfile } from "@/lib/permissions/access-control";

import {
  formatNumber,
  getToneClass,
  profileLevelLabels,
  usersForProfile,
} from "./access-profiles-types";
import type { AccessUser } from "@/features/access/data/access-profile-service";

// ─── ProfileIcon ──────────────────────────────────────────────────────────

export function ProfileIcon({ profile }: { profile: AccessProfile }) {
  const Icon =
    profile.id === "administrador"
      ? Crown
      : profile.id === "operador_k9"
        ? User
        : profile.id === "instrutor_k9"
          ? PawPrint
          : profile.id === "gestor"
            ? ShieldCheck
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

// ─── LevelBadge ───────────────────────────────────────────────────────────

export function LevelBadge({ level }: { level: string }) {
  return (
    <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">
      {profileLevelLabels[level] ?? level}
    </span>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────

export function SectionCard({
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
  title?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-cyan-200/12 bg-surface-card/82 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {icon ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                {icon}
              </span>
            ) : null}
            <div>
              <h2 className="text-sm font-black text-white">{title}</h2>
              {subtitle ? (
                <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {action ?? null}
        </div>
      ) : null}
      <div className={title ? "mt-5" : ""}>{children}</div>
    </section>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────

export function MetricCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: "cyan" | "blue" | "amber" | "violet";
  value: string;
}) {
  const tones = {
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-200",
    blue: "border-blue-300/20 bg-blue-300/10 text-blue-200",
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
    violet: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  };
  return (
    <article className="rounded-2xl border border-white/9 bg-surface-card/82 p-4">
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
            tones[tone],
          )}
        >
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

// ─── TabButton ────────────────────────────────────────────────────────────

export function TabButton({
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

// ─── ProfileCard ──────────────────────────────────────────────────────────

export function ProfileCard({
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
        "rounded-[1.45rem] border bg-surface-card/72 transition",
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
                  {profile.description || "Sem descrição cadastrada."}
                </p>
              </div>
              <LevelBadge level={profile.level} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
              <span>
                <span className="block text-xs text-slate-500">Usuários</span>
                <span className="font-mono text-lg font-black text-white">
                  {formatNumber(userCount)}
                </span>
              </span>
              <span>
                <span className="block text-xs text-slate-500">
                  Módulos liberados
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
          <ShieldCheck className="h-4 w-4" />
          Permissões
        </button>
        <button
          className="flex items-center justify-center gap-2 px-3 py-3 transition hover:bg-white/[0.045] hover:text-cyan-200"
          onClick={onAssign}
          type="button"
        >
          <User className="h-4 w-4" />
          Atribuir
        </button>
      </div>
    </article>
  );
}

// ─── ProfileHero ──────────────────────────────────────────────────────────

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
            <ShieldCheck className="h-6 w-6 text-cyan-200" />
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

// ─── Avatar ───────────────────────────────────────────────────────────────

export function Avatar({ user }: { user: AccessUser }) {
  return user.photoUrl ? (
    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
      <img
        alt={user.callsign ?? user.fullName ?? user.ra}
        className="h-full w-full object-cover"
        src={user.photoUrl}
      />
    </span>
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.065] font-mono text-xs font-black text-cyan-200">
      {(user.callsign ?? user.fullName ?? user.ra).slice(0, 2).toUpperCase()}
    </span>
  );
}

// ─── SecuritySummary ─────────────────────────────────────────────────────

export function SecuritySummary({
  profiles,
  users,
}: {
  profiles: AccessProfile[];
  users: AccessUser[];
}) {
  const withoutProfile = users.filter((user) => !user.accessProfileId).length;
  const linkedUsers = users.filter((user) => user.accessProfileId).length;

  return (
    <aside className="space-y-5">
      <SectionCard
        icon={
          <span className="flex h-5 w-5 items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </span>
        }
        title="Resumo de segurança"
        subtitle="Indicadores gerais sobre o modelo de acesso vigente."
      >
        <div className="space-y-3">
          {[
            {
              label: "Usuários sem perfil",
              tone: withoutProfile > 0 ? "text-amber-200" : "text-emerald-200",
              value: formatNumber(withoutProfile),
            },
            {
              label: "Usuários com perfil",
              tone: "text-cyan-200",
              value: formatNumber(linkedUsers),
            },
            {
              label: "Total de perfis oficiais",
              tone: "text-white",
              value: formatNumber(profiles.length),
            },
          ].map((item) => (
            <div
              className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3"
              key={item.label}
            >
              <span className="text-xs text-slate-400">{item.label}</span>
              <span className={`font-mono text-sm font-black ${item.tone}`}>
                {item.value}
              </span>
            </div>
          ))}
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
