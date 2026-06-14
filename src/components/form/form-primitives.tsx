/**
 * Shared form layout primitives used across admin forms and pages.
 *
 * These components standardize spacing, labels, and section wrappers
 * without imposing business logic.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// ─── Field ──────────────────────────────────────────────────────────────────

export type FieldVariant = "default" | "uppercase" | "bold-uppercase";

export interface FieldProps {
  children: ReactNode;
  /** Displayed below the field (non-error context). */
  hint?: string;
  /** Error message. Takes precedence over hint. */
  error?: string;
  label: string;
  required?: boolean;
  /** Visual style of the label. @default "default" */
  variant?: FieldVariant;
}

const labelVariantClasses: Record<FieldVariant, string> = {
  default: "mb-2 block text-xs font-semibold text-slate-300",
  uppercase:
    "text-xs font-black uppercase tracking-[0.14em] text-slate-500",
  "bold-uppercase":
    "mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400",
};

const requiredVariantClasses: Record<FieldVariant, string> = {
  default: "text-red-300",
  uppercase: "text-cyan-300",
  "bold-uppercase": "text-cyan-300",
};

export function Field({
  children,
  error,
  hint,
  label,
  required,
  variant = "default",
}: FieldProps) {
  return (
    <label className="block">
      <span className={labelVariantClasses[variant]}>
        {label}{" "}
        {required ? (
          <span className={requiredVariantClasses[variant]}>*</span>
        ) : null}
      </span>
      {variant !== "default" ? <span className="mt-2 block">{children}</span> : children}
      {error ? (
        <span className="mt-1 block text-xs text-red-300">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────

export interface SectionProps {
  active: boolean;
  children: ReactNode;
  /** Optional icon displayed alongside the title. */
  icon?: LucideIcon;
  title: string;
}

export function Section({ active, children, icon: Icon, title }: SectionProps) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-cyan-200/12 bg-surface-card/82 p-5",
        !active && "hidden",
      )}
    >
      {Icon ? (
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-black text-white">{title}</h2>
        </div>
      ) : (
        <h2 className="text-lg font-black text-white">{title}</h2>
      )}
      {Icon ? children : <div className="mt-5">{children}</div>}
    </section>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export interface PanelProps {
  /** Optional action element (button, link) rendered top-right. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Subtitle below the title. */
  subtitle?: string;
  title: string;
}

export function Panel({
  action,
  children,
  className,
  subtitle,
  title,
}: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/72 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
