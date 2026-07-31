"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HEALTH_NAV_ITEMS, type HealthNavItemKey } from "@/features/health/domain/paths";

interface HealthSecondaryNavigationProps {
  className?: string;
  dogId?: string;
  /** Override the auto-detected active key */
  activeKey?: HealthNavItemKey;
}

/**
 * Secondary navigation for the Health module.
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §8 (Secondary Navigation)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §33 (Health Shell)
 *
 * This navigation appears within the Health module and provides
 * access to the main sub-areas.
 */
export function HealthSecondaryNavigation({
  className,
  dogId,
  activeKey: forcedActiveKey,
}: HealthSecondaryNavigationProps) {
  const pathname = usePathname();

  // Determine active key from pathname if not forced
  const activeKey = forcedActiveKey ?? detectActiveKey(pathname, dogId);

  return (
    <nav
      role="navigation"
      aria-label="Navegação secundária de Saúde"
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-border px-4 py-2",
        "scrollbar-hide",
        className,
      )}
    >
      {HEALTH_NAV_ITEMS.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Detect the active navigation key from the current pathname.
 */
function detectActiveKey(pathname: string, dogId?: string): HealthNavItemKey {
  // Direct route matches first
  for (const item of HEALTH_NAV_ITEMS) {
    if (pathname === item.href) {
      return item.key;
    }
  }

  // Check for specific patterns
  if (pathname.startsWith("/health/readiness")) return "readiness";
  if (pathname.startsWith("/health/schedule")) return "schedule";
  if (pathname.startsWith("/health/clinical")) return "clinical";
  if (pathname.startsWith("/health/nutrition")) return "nutrition";
  if (pathname.startsWith("/health/history")) return "history";
  if (pathname.startsWith("/health/reports")) return "reports";

  return "overview";
}
