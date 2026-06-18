"use client";

import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  dashboardPeriodOptions,
  useDashboardPeriod,
  type DashboardPeriodDays,
} from "@/features/dashboard/providers/dashboard-period-provider";
import { cn } from "@/lib/utils";

import type { UserProfile } from "./dashboard-types";

/* ─── ProfileBadge ─── */

const profileConfig: Record<
  UserProfile,
  { label: string; tone: string; icon: typeof Users }
> = {
  operador: { label: "Operador K9", tone: "blue", icon: Users },
  instrutor: { label: "Instrutor K9", tone: "emerald", icon: Users },
  gestor: { label: "Gestor K9", tone: "amber", icon: Users },
  admin: { label: "Administrador", tone: "red", icon: Users },
};

export function ProfileBadge({ profile }: { profile: UserProfile }) {
  const config = profileConfig[profile];
  const tones: Record<string, string> = {
    blue: "border-blue-400/30 bg-blue-400/10 text-blue-300",
    emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    red: "border-red-400/30 bg-red-400/10 text-red-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold",
        tones[config.tone] ?? tones.blue,
      )}
    >
      <config.icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

/* ─── DashboardHeader ─── */

export interface DashboardHeaderProps {
  warName: string;
  userProfile: UserProfile;
}

export function DashboardHeader({ warName, userProfile }: DashboardHeaderProps) {
  const { periodDays, setPeriodDays } = useDashboardPeriod();

  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Bom dia, {warName}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Resumo administrativo da unidade K9 -{" "}
            <span className="text-cyan-300" suppressHydrationWarning>
              {new Intl.DateTimeFormat("pt-BR", {
                day: "2-digit",
                month: "long",
                timeZone: "America/Sao_Paulo",
              }).format(new Date())}
              .
            </span>
          </p>
        </div>
        <div className="hidden lg:block">
          <ProfileBadge profile={userProfile} />
        </div>
      </div>
    </section>
  );
}
