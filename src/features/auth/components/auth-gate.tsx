"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/features/auth/providers/auth-provider";
import { paths } from "@/lib/routes/paths";
import AppLoading from "@/app/(app)/loading";

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
    return <AppLoading />;
  }

  if (status === "unauthenticated") {
    return null;
  }

  return children;
}
