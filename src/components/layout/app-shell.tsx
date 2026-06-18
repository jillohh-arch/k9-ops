"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  Bell,
  BellRing,
  Boxes,
  ChevronRight,
  ClipboardList,
  Clock,
  FileBarChart,
  FileText,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  RadioTower,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { db } from "@/lib/firebase/client";
import {
  DashboardPeriodProvider,
  dashboardPeriodOptions,
  useDashboardPeriod,
  type DashboardPeriodDays,
} from "@/features/dashboard/providers/dashboard-period-provider";
import { paths } from "@/lib/routes/paths";
import type {
  AccessAction,
  AccessModuleId,
} from "@/lib/permissions/access-control";
import { cn } from "@/lib/utils";

type NavItem = {
  activePrefixes?: string[];
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  moduleId?: AccessModuleId;
  moduleIds?: AccessModuleId[];
};

const navItems = [
  {
    href: paths.dashboard,
    icon: LayoutDashboard,
    label: "Dashboard",
    moduleId: "dashboard",
  },
  {
    activePrefixes: [
      paths.effective,
      paths.k9,
      paths.humans,
      paths.binomials,
      paths.vehicles,
    ],
    icon: Users,
    href: paths.effective,
    label: "Efetivo",
    moduleIds: ["k9", "humans", "binomials", "vehicles"],
  },
  {
    href: paths.occurrences,
    icon: RadioTower,
    label: "Central",
    moduleId: "occurrences",
  },
  {
    activePrefixes: [paths.training, paths.trainingPromotions],
    href: paths.training,
    icon: ClipboardList,
    label: "Treinamentos",
    moduleId: "training",
  },
  {
    href: paths.trainingMatrix,
    icon: FileBarChart,
    label: "Prontidão K9",
    moduleId: "training_matrix",
  },
  { href: paths.health, icon: HeartPulse, label: "Saúde", moduleId: "health" },
  {
    href: paths.inventory,
    icon: Boxes,
    label: "Estoque",
    moduleId: "inventory",
  },
  {
    href: paths.reports,
    icon: FileText,
    label: "Relatórios",
    moduleId: "reports",
  },
  { href: paths.access, icon: KeyRound, label: "Acessos", moduleId: "access" },
  { href: paths.shifts, icon: Clock, label: "Plantões", moduleId: "shifts" },
] satisfies NavItem[];

function getDisplayName(profileName: string | null | undefined) {
  return profileName?.trim() || "Ragonha";
}

function navModules(item: NavItem) {
  return item.moduleIds ?? (item.moduleId ? [item.moduleId] : []);
}

type RouteAccessRule = {
  action?: AccessAction;
  matches?: (pathname: string) => boolean;
  modules: AccessModuleId[];
  prefix?: string;
};

function entityEditPath(basePath: string) {
  return (pathname: string) => {
    const escaped = basePath.replace("/", "\\/");
    return new RegExp(`^${escaped}\\/[^/]+\\/edit$`).test(pathname);
  };
}

const routeAccessRules: RouteAccessRule[] = [
  { prefix: paths.humanNew, modules: ["humans"], action: "create" },
  { matches: entityEditPath(paths.humans), modules: ["humans"], action: "edit" },
  { prefix: paths.humanCertifications, modules: ["humans"] },
  { prefix: paths.humanMovements, modules: ["humans"] },
  { prefix: paths.humans, modules: ["humans"] },
  { prefix: paths.k9New, modules: ["k9"], action: "create" },
  { matches: entityEditPath(paths.k9), modules: ["k9"], action: "edit" },
  { prefix: paths.k9, modules: ["k9"] },
  { prefix: `${paths.binomials}/new`, modules: ["binomials"], action: "create" },
  {
    matches: entityEditPath(paths.binomials),
    modules: ["binomials"],
    action: "edit",
  },
  { prefix: paths.binomials, modules: ["binomials"] },
  { prefix: `${paths.vehicles}/new`, modules: ["vehicles"], action: "create" },
  {
    matches: entityEditPath(paths.vehicles),
    modules: ["vehicles"],
    action: "edit",
  },
  { prefix: paths.vehicles, modules: ["vehicles"] },
  { prefix: paths.effective, modules: ["k9", "humans", "binomials", "vehicles"] },
  { prefix: paths.trainingMatrix, modules: ["training_matrix"] },
  { prefix: paths.training, modules: ["training"] },
  { prefix: paths.occurrences, modules: ["occurrences"] },
  { prefix: paths.health, modules: ["health"] },
  { prefix: paths.inventory, modules: ["inventory"] },
  { prefix: paths.reports, modules: ["reports"] },
  { prefix: paths.access, modules: ["access"] },
  { prefix: paths.shifts, modules: ["shifts"] },
  { prefix: paths.me, modules: ["me"] },
  { prefix: paths.dashboard, modules: ["dashboard"] },
];

function isNavItemActive(item: NavItem, pathname: string) {
  const prefixes = item.activePrefixes ?? [item.href];
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPathMatch(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function getModulesForPath(pathname: string) {
  const rule = [...routeAccessRules]
    .sort((a, b) => (b.prefix?.length ?? 1000) - (a.prefix?.length ?? 1000))
    .find((item) =>
      item.matches ? item.matches(pathname) : item.prefix && isPathMatch(pathname, item.prefix),
    );
  return {
    action: rule?.action ?? "view",
    modules: rule?.modules ?? [],
  };
}

function AccessDenied({ onGoHome }: { onGoHome: () => void }) {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center">
      <section className="max-w-xl rounded-[2rem] border border-amber-300/20 bg-amber-300/[0.06] p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-200">
          <KeyRound className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-2xl font-black text-white">
          Acesso não liberado
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Seu perfil atual não possui permissão para visualizar este módulo.
          Solicite ajuste de acesso a um gestor autorizado.
        </p>
        <Button className="mt-6" onClick={onGoHome}>
          Voltar ao dashboard
        </Button>
      </section>
    </div>
  );
}

function SidebarContent({
  items,
  onNavigate,
  onSignOut,
  pathname,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  onSignOut: () => void;
  pathname: string;
}) {
  return (
    <div className="relative flex h-full flex-col">
      <Link
        className="flex h-20 items-center gap-3 border-b border-cyan-200/10 px-6"
        href={paths.dashboard}
        onClick={onNavigate}
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
            Gestão Operacional K9
          </span>
        </span>
      </Link>

      <nav className="relative mt-7 flex-1 space-y-1 px-3">
        {items.map((item) => {
          const isActive = isNavItemActive(item, pathname);

          return (
            <Link
              className={cn(
                "relative flex items-center gap-4 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-400 transition hover:bg-white/[0.045] hover:text-white",
                isActive &&
                  "border border-cyan-300/25 bg-cyan-300/10 text-white shadow-[0_0_32px_rgba(0,188,212,0.12)]",
              )}
              href={item.href}
              key={item.href}
              onClick={onNavigate}
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
          onClick={() => {
            onNavigate?.();
            onSignOut();
          }}
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
  );
}

function SidebarChrome({ children }: { children: ReactNode }) {
  return (
    <>
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
      {children}
    </>
  );
}

function OperatorAvatar({ src }: { src: string | null }) {
  const fallbackSrc = "/brand/logo-app.png";
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolvedSrc = src && src !== failedSrc ? src : fallbackSrc;
  const isExternal = resolvedSrc.startsWith("http");

  return (
    <Image
      alt="Avatar do operador"
      className="object-cover"
      fill
      onError={() => setFailedSrc(resolvedSrc)}
      src={resolvedSrc}
      sizes="48px"
      unoptimized={isExternal}
    />
  );
}

// ─── Notification Bell ─────────────────────────────────────────────────────────

type NotificationItem = {
  _id: string;
  title?: string;
  body?: string;
  message?: string;
  type?: string;
  read?: boolean;
  action_required?: boolean;
  created_at?: { toDate: () => Date } | Date;
  createdAt?: { toDate: () => Date } | Date;
};

function formatTime(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return date.toLocaleDateString("pt-BR");
}

function NotificationBell({ ra }: { ra: string | null | undefined }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ra) {
      // Defer state update to avoid synchronous setState in effect body
      Promise.resolve().then(() => setLoading(false));
      return;
    }

    const q = query(
      collection(db, "notifications", ra, "items"),
      where("archived_at", "==", null),
      orderBy("created_at", "desc"),
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        _id: doc.id,
        ...doc.data(),
      })) as NotificationItem[];
      setNotifications(items);
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return unsub;
  }, [ra]);

  const unreadCount = notifications.filter(
    (n) => !n.read && n.action_required,
  ).length;

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="relative">
      <button
        className={cn(
          "relative rounded-2xl border p-3 transition",
          unreadCount > 0
            ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
            : "border-white/10 bg-white/[0.045] text-slate-300 hover:border-cyan-300/30",
        )}
        onClick={() => setOpen(!open)}
        type="button"
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400 text-[10px] font-bold text-slate-950 shadow-[0_0_12px_rgba(77,208,225,0.9)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-14 z-50 w-80 overflow-hidden rounded-2xl border border-cyan-200/20 bg-[#0b1628] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <h3 className="text-sm font-bold text-white">Notificações</h3>
              <span className="text-xs text-slate-400">
                {loading ? "..." : `${notifications.length} total`}
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Carregando...
                </div>
              ) : recentNotifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="mx-auto h-8 w-8 text-slate-600" />
                  <p className="mt-2 text-sm text-slate-500">
                    Nenhuma notificação
                  </p>
                </div>
              ) : (
                recentNotifications.map((notif) => {
                  const rawDate = notif.created_at || notif.createdAt;
                  const date = rawDate
                    ? typeof rawDate === "object" && "toDate" in rawDate
                      ? (rawDate as { toDate: () => Date }).toDate()
                      : (rawDate as Date)
                    : new Date();
                  const title = notif.title || notif.type || "Notificação";
                  const body = notif.body || notif.message || "";

                  return (
                    <div
                      key={notif._id}
                      className={cn(
                        "flex items-start gap-3 border-b border-white/5 p-4 transition hover:bg-white/[0.03]",
                        !notif.read && "bg-cyan-300/[0.03]",
                      )}
                    >
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10">
                        <Bell className="h-4 w-4 text-cyan-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{title}</p>
                        {body && (
                          <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">
                            {body}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          {formatTime(date)}
                        </p>
                      </div>
                      {!notif.read && (
                        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(77,208,225,0.8)]" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <Link
              className="flex items-center justify-center gap-2 border-t border-white/10 p-3 text-xs font-semibold text-cyan-300 transition hover:bg-white/[0.03]"
              href={paths.notifications}
              onClick={() => setOpen(false)}
            >
              Ver todas
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { can, status: accessStatus } = useAccessControl();
  const { periodDays, setPeriodDays } = useDashboardPeriod();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const displayName = getDisplayName(profile?.displayName);
  const avatarSrc = profile?.photoUrl ?? null;
  const accessResolved = accessStatus !== "loading";
  const visibleNavItems = accessResolved
    ? navItems.filter((item) =>
        navModules(item).some((moduleId) => can(moduleId, "view")),
      )
    : navItems;
  const currentAccess = getModulesForPath(pathname);
  const routeBlocked = Boolean(
    accessResolved &&
      currentAccess.modules.length > 0 &&
      !currentAccess.modules.some((moduleId) =>
        can(moduleId, currentAccess.action),
      ),
  );
  const firstAllowedPath = visibleNavItems[0]?.href ?? paths.me;

  async function handleSignOut() {
    await signOut();
    router.replace(paths.login);
  }

  return (
    <div className="min-h-dvh bg-[#040b15] text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-[300px] overflow-hidden border-r border-cyan-200/10 bg-[#07111f]/94 shadow-[30px_0_90px_rgba(0,0,0,0.36)] backdrop-blur-2xl xl:block">
        <SidebarChrome>
          <SidebarContent
            items={visibleNavItems}
            onSignOut={handleSignOut}
            pathname={pathname}
          />
        </SidebarChrome>
      </aside>

      <div
        aria-hidden={!isMobileSidebarOpen}
        className={cn(
          "fixed inset-0 z-50 xl:hidden",
          isMobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          aria-label="Fechar menu"
          className={cn(
            "absolute inset-0 bg-black/62 backdrop-blur-sm transition-opacity",
            isMobileSidebarOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setIsMobileSidebarOpen(false)}
          type="button"
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-[min(86vw,320px)] overflow-hidden border-r border-cyan-200/10 bg-[#07111f]/96 shadow-[30px_0_90px_rgba(0,0,0,0.48)] backdrop-blur-2xl transition-transform duration-300 ease-out",
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <SidebarChrome>
            <button
              aria-label="Fechar menu"
              className="absolute right-4 top-4 z-10 rounded-2xl border border-white/10 bg-white/[0.055] p-2 text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
              onClick={() => setIsMobileSidebarOpen(false)}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              items={visibleNavItems}
              onNavigate={() => setIsMobileSidebarOpen(false)}
              onSignOut={handleSignOut}
              pathname={pathname}
            />
          </SidebarChrome>
        </aside>
      </div>

      <div className="xl:pl-[300px]">
        <header className="sticky top-0 z-20 flex h-20 items-center border-b border-cyan-200/10 bg-[#07111f]/82 px-5 backdrop-blur-2xl lg:px-8">
          <button
            aria-expanded={isMobileSidebarOpen}
            aria-label="Abrir menu principal"
            className="mr-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-100 shadow-[0_0_28px_rgba(77,208,225,0.12)] transition hover:border-cyan-300/35 xl:hidden"
            onClick={() => setIsMobileSidebarOpen(true)}
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="grid min-w-0 flex-1 items-center gap-4 lg:grid-cols-[minmax(320px,1fr)_170px_auto]">
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
                Período
              </span>
              <select
                aria-label="Período global do dashboard"
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
                <p className="text-xs text-slate-500">Gestão Operacional</p>
              </div>

              <NotificationBell ra={profile?.ra} />

              <div className="hidden h-12 w-px bg-white/10 md:block" />

              <Link
                className="flex items-center gap-3 rounded-2xl border border-transparent p-1.5 transition hover:border-cyan-300/25 hover:bg-cyan-300/8"
                href={paths.me}
              >
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-bold text-white">{displayName}</p>
                  <p className="font-mono text-xs text-slate-500">
                    MAT: {profile?.ra ?? "--"}
                  </p>
                </div>
                <div className="relative h-12 w-12 overflow-hidden rounded-full border border-cyan-300/20 bg-cyan-300/10">
                  <OperatorAvatar src={avatarSrc} />
                </div>
              </Link>
            </div>
          </div>
        </header>

        <main className="px-5 py-6 lg:px-8">
          {routeBlocked ? (
            <AccessDenied onGoHome={() => router.push(firstAllowedPath)} />
          ) : (
            children
          )}
        </main>
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
