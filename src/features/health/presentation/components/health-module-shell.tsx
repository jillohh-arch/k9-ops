"use client";

import { type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  Package,
  RefreshCw,
} from "lucide-react";
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
  /**
   * Suppresses the shell's own title/description row.
   *
   * Pages that render their own full identity region (e.g. the overview, whose
   * approved composition in HW-M01 has a single header) would otherwise show
   * two nearly identical Health titles stacked around the tabs. The technical
   * state strip is unaffected and still renders here.
   */
  hideModuleHeading?: boolean;
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
  hideModuleHeading = false,
}: HealthModuleShellProps) {
  return (
    <div
      className="flex min-h-screen flex-col bg-background"
      data-testid="health-module-shell"
    >
      {/* Module Header */}
      {(!hideModuleHeading || actions || technicalState) && (
        <header className="border-b border-border bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {(!hideModuleHeading || actions) && (
            <div className="flex items-start justify-between gap-4">
              {!hideModuleHeading && (
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
              )}

              {/* Header Actions */}
              {actions && (
                <div className={cn("flex items-center gap-2", hideModuleHeading && "ml-auto")}>
                  {actions}
                </div>
              )}
            </div>
          )}

          {/* Technical State Warning */}
          {technicalState && (
            <TechnicalStateBanner
              status={technicalState.status}
              message={technicalState.message}
              computedAt={technicalState.computedAt}
              spaced={!hideModuleHeading || Boolean(actions)}
            />
          )}
        </header>
      )}

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
  spaced = true,
}: {
  status: NonNullable<HealthModuleShellProps["technicalState"]>["status"];
  message: string;
  computedAt?: Date;
  /** Adds top spacing only when something is rendered above the strip. */
  spaced?: boolean;
}) {
  /**
   * K9 Ops operational status strip.
   *
   * These are TECHNICAL coverage states, not clinical alarms, so the treatment
   * stays dark navy with a low-alpha semantic tint — the same grammar the
   * Training module uses for attention banners. `label` only names the
   * technical category already carried by `status`; the runtime `message` is
   * always rendered verbatim so no meaning is added or softened.
   */
  const statusConfig = {
    stale: {
      label: "Leitura desatualizada",
      surface: "border-amber-300/20 bg-amber-300/[0.06]",
      tile: "border-amber-300/25 bg-amber-300/10 text-amber-300",
      micro: "text-amber-300/85",
      title: "text-amber-100",
      Icon: Clock,
    },
    degraded: {
      label: "Cobertura degradada",
      surface: "border-amber-300/20 bg-amber-300/[0.06]",
      tile: "border-amber-300/25 bg-amber-300/10 text-amber-300",
      micro: "text-amber-300/85",
      title: "text-amber-100",
      Icon: AlertTriangle,
    },
    partial: {
      label: "Cobertura parcial",
      surface: "border-amber-300/20 bg-amber-300/[0.06]",
      tile: "border-amber-300/25 bg-amber-300/10 text-amber-300",
      micro: "text-amber-300/85",
      title: "text-amber-100",
      Icon: AlertTriangle,
    },
    conflict: {
      label: "Conflito de dados",
      surface: "border-red-400/20 bg-red-400/[0.06]",
      tile: "border-red-400/25 bg-red-400/10 text-red-300",
      micro: "text-red-300/85",
      title: "text-red-100",
      Icon: RefreshCw,
    },
    legacy: {
      label: "Origem legada",
      surface: "border-indigo-400/20 bg-indigo-400/[0.06]",
      tile: "border-indigo-400/25 bg-indigo-400/10 text-indigo-300",
      micro: "text-indigo-300/85",
      title: "text-indigo-100",
      Icon: Package,
    },
  };

  const config = statusConfig[status];
  const Icon = config.Icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3",
        spaced && "mt-3",
        config.surface,
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          config.tile,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[10px] font-black uppercase tracking-[0.22em]",
            config.micro,
          )}
        >
          {config.label}
        </p>
        <p className={cn("mt-1 text-sm font-semibold leading-snug", config.title)}>
          {message}
        </p>
      </div>

      {computedAt && (
        <span className="shrink-0 pt-1 text-[11px] tabular-nums text-muted-foreground">
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
