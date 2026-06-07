"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Boxes,
  Car,
  ClipboardList,
  Dog,
  FileBarChart,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Search,
  Shield,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/providers/auth-provider";
import {
  DashboardPeriodProvider,
  dashboardPeriodOptions,
  useDashboardPeriod,
  type DashboardPeriodDays,
} from "@/features/dashboard/providers/dashboard-period-provider";
import { paths } from "@/lib/routes/paths";
import { cn } from "@/lib/utils";

const navItems = [
  { href: paths.dashboard, label: "Dashboard", icon: LayoutDashboard },
  { href: paths.k9, label: "Efetivo K9", icon: Dog },
  { href: paths.humans, label: "Efetivo Humano", icon: Users },
  { href: paths.vehicles, label: "Viaturas", icon: Car },
  { href: paths.occurrences, label: "Ocorrencias", icon: Shield },
  { href: paths.training, label: "Treinamentos", icon: ClipboardList },
  { href: paths.trainingMatrix, label: "Matriz", icon: FileBarChart },
  { href: paths.health, label: "Saude", icon: HeartPulse },
  { href: paths.inventory, label: "Estoque", icon: Boxes },
];

function getDisplayName(profileName: string | null | undefined) {
  return profileName?.trim() || "Ragonha";
}

function AppShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { periodDays, setPeriodDays } = useDashboardPeriod();
  const displayName = getDisplayName(profile?.displayName);
  const avatarSrc = profile?.photoUrl || "/brand/logo-app.png";

  async function handleSignOut() {
    await signOut();
    router.replace(paths.login);
  }

  return (
    <div className="min-h-dvh bg-[#040b15] text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-[300px] overflow-hidden border-r border-cyan-200/10 bg-[#07111f]/94 shadow-[30px_0_90px_rgba(0,0,0,0.36)] backdrop-blur-2xl xl:block">
        <div className="absolute inset-x-0 bottom-0 h-[470px] bg-[radial-gradient(circle_at_38%_66%,rgba(0,188,212,0.28),transparent_32%),linear-gradient(180deg,transparent,rgba(0,188,212,0.07))]" />
        <div className="absolute bottom-8 left-[-58px] h-[390px] w-[360px] opacity-38 mix-blend-screen">
          <Image
            alt=""
            className="object-contain object-bottom-left"
            fill
            loading="eager"
            priority
            src="/assets/cao_sidebar.png"
            sizes="360px"
          />
        </div>

        <div className="relative flex h-full flex-col">
          <Link
            className="flex h-20 items-center gap-3 border-b border-cyan-200/10 px-6"
            href={paths.dashboard}
          >
            <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_34px_rgba(77,208,225,0.2)]">
              <Image
                alt="Logo K9 Ops"
                className="object-contain p-1.5"
                fill
                priority
                src="/brand/logo-app.png"
                sizes="48px"
              />
            </span>
            <span>
              <span className="block text-lg font-black text-white">K9 Ops</span>
              <span className="block text-xs text-slate-400">
                Gestao Operacional K9
              </span>
            </span>
          </Link>

          <nav className="relative mt-7 flex-1 space-y-1 px-3">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  className={cn(
                    "relative flex items-center gap-4 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-400 transition hover:bg-white/[0.045] hover:text-white",
                    isActive &&
                      "border border-cyan-300/25 bg-cyan-300/10 text-white shadow-[0_0_32px_rgba(0,188,212,0.12)]",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {isActive ? (
                    <span className="absolute -left-3 top-1/2 h-9 w-1 -translate-y-1/2 rounded-r-full bg-cyan-300 shadow-[0_0_18px_rgba(77,208,225,0.8)]" />
                  ) : null}
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="relative border-t border-cyan-200/10 px-5 py-5">
            <Button
              className="mb-7 w-full justify-start gap-3"
              onClick={handleSignOut}
              variant="ghost"
            >
              <LogOut className="h-4 w-4" />
              Encerrar Sessao
            </Button>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.85)]" />
                Sistema online
              </span>
              <span>v0.1.0</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="xl:pl-[300px]">
        <header className="sticky top-0 z-20 flex h-20 items-center border-b border-cyan-200/10 bg-[#07111f]/82 px-5 backdrop-blur-2xl lg:px-8">
          <div className="grid w-full items-center gap-4 lg:grid-cols-[minmax(320px,1fr)_170px_auto]">
            <div className="relative hidden lg:block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                className="h-12 w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.045] pl-12 pr-4 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35 focus:bg-white/[0.06]"
                placeholder="Buscar K9, condutor, documento..."
                type="search"
              />
            </div>

            <label className="relative hidden h-12 items-center rounded-2xl border border-white/10 bg-white/[0.045] transition focus-within:border-cyan-300/35 lg:flex">
              <span className="pointer-events-none absolute left-4 top-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Periodo
              </span>
              <select
                aria-label="Periodo global do dashboard"
                className="h-full w-full cursor-pointer appearance-none bg-transparent px-4 pb-1 pt-4 text-sm font-semibold text-slate-200 outline-none"
                onChange={(event) =>
                  setPeriodDays(
                    Number(event.target.value) as DashboardPeriodDays,
                  )
                }
                value={periodDays}
              >
                {dashboardPeriodOptions.map((option) => (
                  <option
                    className="bg-[#0b1628] text-slate-100"
                    key={option.days}
                    value={option.days}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 text-xs text-cyan-300">
                ▾
              </span>
            </label>

            <div className="flex items-center justify-between gap-4 lg:justify-end">
              <div className="lg:hidden">
                <p className="text-sm font-black text-white">K9 Ops</p>
                <p className="text-xs text-slate-500">Gestao Operacional</p>
              </div>

              <button className="relative rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100">
                <Bell className="h-5 w-5" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(77,208,225,0.9)]" />
              </button>

              <div className="hidden h-12 w-px bg-white/10 md:block" />

              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-bold text-white">{displayName}</p>
                  <p className="font-mono text-xs text-slate-500">
                    MAT: {profile?.ra ?? "--"}
                  </p>
                </div>
                <div className="relative h-12 w-12 overflow-hidden rounded-full border border-cyan-300/20 bg-cyan-300/10">
                  <Image
                    alt="Avatar do operador"
                    className="object-cover"
                    fill
                    src={avatarSrc}
                    sizes="48px"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardPeriodProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </DashboardPeriodProvider>
  );
}
