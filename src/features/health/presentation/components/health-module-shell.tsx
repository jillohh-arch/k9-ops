"use client";

import { type ReactNode } from "react";
import { Activity } from "lucide-react";
import { HealthSecondaryNavigation } from "./health-secondary-navigation";
import { cn } from "@/lib/utils";

interface HealthModuleShellProps {
  /** Page title */
  title?: string;
  /** Page description */
  description?: string;
  /** Additional header actions */
  actions?: ReactNode;
  /** Current dog context (optional) */
  dogContext?: {
    id: string;
    name: string;
    photo?: string;
    readinessStatus?: string;
  };
  /** Whether to show secondary navigation */
  showNavigation?: boolean;
  /** Override active nav key */
  activeNavKey?: "overview" | "readiness" | "schedule" | "clinical" | "nutrition" | "history" | "reports";
  /** Child content */
  children: ReactNode;
  /** Additional classes for content area */
  contentClassName?: string;
  /** Module-level technical state indicator */
  technicalState?: {
    status: "stale" | "degraded" | "partial" | "conflict" | "legacy";
    message: string;
    computedAt?: Date;
  };
}

/**
 * Health Module Shell Component
 *
 * Based on:
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §33 (Health Shell)
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §11 (Module Shell Structure)
 *
 * This is the primary container for all Health module pages.
 * It provides:
 * - Module header with title and actions
 * - Secondary navigation
 * - Dog context card (when in individual dog view)
 * - Technical state indicators
 * - Content area
 */
export function HealthModuleShell({
  title = "Saúde e Prontidão",
  description,
  actions,
  dogContext,
  showNavigation = true,
  activeNavKey,
  children,
  contentClassName,
  technicalState,
}: HealthModuleShellProps) {
  return (
    <div
      className="flex min-h-screen flex-col bg-background"
      data-testid="health-module-shell"
    >
      {/* Module Header */}
      <header className="border-b border-border bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>

          {/* Header Actions */}
          {actions && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
        </div>

        {/* Technical State Warning */}
        {technicalState && (
          <TechnicalStateBanner
            status={technicalState.status}
            message={technicalState.message}
            computedAt={technicalState.computedAt}
          />
        )}
      </header>

      {/* Dog Context Card */}
      {dogContext && (
        <DogContextCard
          id={dogContext.id}
          name={dogContext.name}
          photo={dogContext.photo}
          readinessStatus={dogContext.readinessStatus}
        />
      )}

      {/* Secondary Navigation */}
      {showNavigation && (
        <HealthSecondaryNavigation activeKey={activeNavKey} />
      )}

      {/* Content Area */}
      <main
        className={cn("flex-1 px-6 py-6", contentClassName)}
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}

/**
 * Technical state warning banner.
 * Shows when the module has degraded, stale, partial, or conflict state.
 */
function TechnicalStateBanner({
  status,
  message,
  computedAt,
}: {
  status: NonNullable<HealthModuleShellProps["technicalState"]>["status"];
  message: string;
  computedAt?: Date;
}) {
  const statusConfig = {
    stale: {
      className: "bg-amber-50 border-amber-200 text-amber-900",
      icon: "⏰",
    },
    degraded: {
      className: "bg-orange-50 border-orange-200 text-orange-900",
      icon: "⚠️",
    },
    partial: {
      className: "bg-yellow-50 border-yellow-200 text-yellow-900",
      icon: "📉",
    },
    conflict: {
      className: "bg-red-50 border-red-200 text-red-900",
      icon: "🔄",
    },
    legacy: {
      className: "bg-blue-50 border-blue-200 text-blue-900",
      icon: "📦",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
        config.className,
      )}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{message}</span>
      {computedAt && (
        <span className="ml-auto text-xs opacity-75">
          Atualizado em {computedAt.toLocaleTimeString("pt-BR")}
        </span>
      )}
    </div>
  );
}

/**
 * Dog context card shown in individual dog views.
 */
function DogContextCard({
  id: _id,
  name,
  photo,
  readinessStatus,
}: {
  id: string;
  name: string;
  photo?: string;
  readinessStatus?: string;
}) {
  void _id; // Reserved for future use
  return (
    <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-6 py-3">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={name}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <span className="text-lg font-medium">{name[0]}</span>
        </div>
      )}
      <div>
        <span className="font-medium">{name}</span>
        {readinessStatus && (
          <span className="ml-2 text-sm text-muted-foreground">
            — {readinessStatus}
          </span>
        )}
      </div>
    </div>
  );
}
