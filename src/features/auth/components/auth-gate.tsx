"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/features/auth/providers/auth-provider";
import { paths } from "@/lib/routes/paths";

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "unauthenticated") {
      return;
    }

    const next = encodeURIComponent(pathname || paths.dashboard);
    router.replace(`${paths.login}?next=${next}`);
  }, [pathname, router, status]);

  if (status === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#050d10] px-4 text-slate-100">
        <div className="rounded-2xl border border-cyan-300/10 bg-slate-900/70 px-6 py-5 text-center shadow-[0_0_40px_rgba(0,0,0,0.22)]">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
            K9 OPS
          </p>
          <p className="mt-2 text-sm text-slate-400">Validando acesso...</p>
        </div>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return children;
}
