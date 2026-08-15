"use client";

import { AlertCircle, AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

export type CategorizedWarning = {
  message: string;
  severity: "error" | "attention" | "info";
};

interface ReportDataQualityProps {
  /** Categorized warnings (preferred). */
  categorizedWarnings?: CategorizedWarning[];
  /** Plain warning strings — kept for backward compatibility. */
  warnings?: string[];
  className?: string;
}

const severityStyles = {
  attention: {
    border: "border-amber-300/20",
    bg: "bg-amber-300/[0.04]",
    text: "text-amber-200",
    icon: "text-amber-300",
    Icon: AlertTriangle,
  },
  error: {
    border: "border-red-400/25",
    bg: "bg-red-400/[0.06]",
    text: "text-red-200",
    icon: "text-red-300",
    Icon: AlertCircle,
  },
  info: {
    border: "border-cyan-300/15",
    bg: "bg-cyan-300/[0.03]",
    text: "text-slate-300",
    icon: "text-cyan-300/70",
    Icon: Info,
  },
};

export function ReportDataQuality({
  categorizedWarnings,
  warnings,
  className,
}: ReportDataQualityProps) {
  // Normalize inputs
  const items: CategorizedWarning[] = categorizedWarnings
    ? categorizedWarnings
    : (warnings ?? []).map((w) => ({ message: w, severity: "attention" as const }));

  if (items.length === 0) return null;

  // Group by severity for clearer display
  const grouped = items.reduce<Record<string, CategorizedWarning[]>>(
    (acc, w) => {
      (acc[w.severity] ??= []).push(w);
      return acc;
    },
    {},
  );

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="space-y-2"
      role="note"
    >
      {(["error", "attention", "info"] as const).map((sev) => {
        const group = grouped[sev];
        if (!group || group.length === 0) return null;
        const style = severityStyles[sev];
        const Icon = style.Icon;
        return (
          <div
            className={cn(
              "rounded-xl border p-4",
              style.border,
              style.bg,
              className,
            )}
            key={sev}
          >
            <div className="flex items-start gap-3">
              <Icon
                aria-hidden="true"
                className={cn("mt-0.5 h-4 w-4 shrink-0", style.icon)}
              />
              <ul className="flex-1 space-y-1.5">
                {group.map((warning, i) => (
                  <li
                    className={cn("flex items-start gap-2 text-xs", style.text)}
                    key={`${sev}-${i}`}
                  >
                    <span className="mt-0.5 shrink-0 opacity-60">•</span>
                    <span>{warning.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Loading / error quality indicator ────────────────────────────────────────

interface QueryStatusIndicatorProps {
  hasError: boolean;
  isBaseLoading?: boolean;
  isLoading: boolean;
}

export function QueryStatusIndicator({
  isLoading,
  hasError,
  isBaseLoading = false,
}: QueryStatusIndicatorProps) {
  if (!isLoading && !hasError) return null;

  if (hasError) {
    return (
      <div
        className="flex items-center gap-2 text-xs text-red-300"
        role="status"
      >
        <Info aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>Alguns dados podem estar incompletos.</span>
      </div>
    );
  }

  if (isBaseLoading) {
    return (
      <div
        className="flex items-center gap-2 text-xs text-slate-500"
        role="status"
        aria-live="polite"
      >
        <span>Carregando dados de relatórios...</span>
      </div>
    );
  }

  // Granular reload indicator (sessions or evaluations refresh)
  if (isLoading) {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-2 text-xs text-slate-500"
        role="status"
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
        <span>Atualizando dados dos relatórios</span>
      </div>
    );
  }

  return null;
}