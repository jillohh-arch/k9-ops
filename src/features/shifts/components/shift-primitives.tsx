"use client";

import { Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const shiftInputClass =
  "h-12 w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-white/[0.055] disabled:cursor-not-allowed disabled:opacity-45";

export function FormField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export function SegmentedButtons({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: Array<{ icon: LucideIcon; label: string; value: string }>;
  value: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm font-bold transition",
              active
                ? "border-cyan-300/45 bg-cyan-300/12 text-cyan-100"
                : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <option.icon className="mr-2 inline h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ToggleRow({
  checked,
  detail,
  label,
  onChange,
}: {
  checked: boolean;
  detail: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.025]"
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span>
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          {label}
          <Info className="h-3.5 w-3.5 text-slate-500" />
        </span>
        <span className="mt-1 block text-xs text-slate-500">{detail}</span>
      </span>
      <span
        className={cn(
          "relative h-7 w-12 rounded-full border transition",
          checked
            ? "border-cyan-300/40 bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.26)]"
            : "border-white/10 bg-white/[0.08]",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-slate-950 transition",
            checked ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

export function FilterSelect<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <select
        className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-semibold text-slate-200 outline-none transition focus:border-cyan-300/35"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ShiftMetricCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.015] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-300">{label}</p>
          <p className="mt-2 text-4xl font-black text-white">{value}</p>
          <p className="mt-1 text-sm text-slate-400">{detail}</p>
        </div>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.16)]">
          <Icon className="h-7 w-7" />
        </span>
      </div>
    </div>
  );
}

export function InfoLine({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-500" />
      <span>{children}</span>
    </div>
  );
}

export function ActionButton({
  danger,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition",
        danger
          ? "border-red-400/20 bg-red-400/8 text-red-300 hover:border-red-300/35"
          : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/25 hover:text-cyan-100",
        disabled && "cursor-not-allowed opacity-45 hover:border-white/10",
      )}
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Disponível na próxima etapa" : undefined}
      type="button"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
