"use client";

import React from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { AnimatedNumber } from "../presentation/warehouse-motion";

export type KpiColorVariant = "emerald" | "amber" | "rose" | "cyan" | "purple" | "blue";

export interface WarehouseKpiCardProps {
  label: string;
  value: number | string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  colorVariant?: KpiColorVariant;
  trend?: {
    text: string;
    direction?: "up" | "down" | "neutral";
    variant?: KpiColorVariant | "slate";
  };
  testId?: string;
  className?: string;
}

const COLOR_STYLES: Record<
  KpiColorVariant,
  {
    iconBox: string;
    icon: string;
    borderGlow: string;
    trendPill: string;
  }
> = {
  emerald: {
    iconBox: "border-emerald-500/30 bg-emerald-500/10",
    icon: "text-emerald-400",
    borderGlow: "hover:border-emerald-500/40 hover:shadow-[0_12px_30px_rgba(16,185,129,0.16)]",
    trendPill: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  },
  amber: {
    iconBox: "border-amber-500/30 bg-amber-500/10",
    icon: "text-amber-400",
    borderGlow: "hover:border-amber-500/40 hover:shadow-[0_12px_30px_rgba(245,158,11,0.16)]",
    trendPill: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  },
  rose: {
    iconBox: "border-rose-500/30 bg-rose-500/10",
    icon: "text-rose-400",
    borderGlow: "hover:border-rose-500/40 hover:shadow-[0_12px_30px_rgba(244,63,94,0.16)]",
    trendPill: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  },
  cyan: {
    iconBox: "border-cyan-500/30 bg-cyan-500/10",
    icon: "text-cyan-400",
    borderGlow: "hover:border-cyan-500/40 hover:shadow-[0_12px_30px_rgba(6,182,212,0.16)]",
    trendPill: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  },
  purple: {
    iconBox: "border-purple-500/30 bg-purple-500/10",
    icon: "text-purple-400",
    borderGlow: "hover:border-purple-500/40 hover:shadow-[0_12px_30px_rgba(168,85,247,0.16)]",
    trendPill: "border-purple-500/20 bg-purple-500/10 text-purple-300",
  },
  blue: {
    iconBox: "border-sky-500/30 bg-sky-500/10",
    icon: "text-sky-400",
    borderGlow: "hover:border-sky-500/40 hover:shadow-[0_12px_30px_rgba(2,132,199,0.16)]",
    trendPill: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  },
};

export function WarehouseKpiCard({
  label,
  value,
  subtext,
  icon: Icon,
  colorVariant = "cyan",
  trend,
  testId,
  className = "",
}: WarehouseKpiCardProps) {
  const styles = COLOR_STYLES[colorVariant] || COLOR_STYLES.cyan;

  return (
    <div
      data-testid={testId}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-all duration-200 hover:-translate-y-1 focus-within:ring-2 focus-within:ring-cyan-500/40 active:scale-[0.99] ${styles.borderGlow} ${className}`}
    >
      {/* Top row: Label and Icon Box */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold font-mono uppercase tracking-[0.16em] text-slate-400 leading-tight">
          {label}
        </span>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${styles.iconBox} ${styles.icon} shadow-inner transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>

      {/* Main value & Subtext */}
      <div className="my-2.5">
        <div className="font-mono text-3xl font-black tracking-tight text-white tabular-nums sm:text-4xl">
          <AnimatedNumber value={value} />
        </div>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">{subtext}</p>
      </div>

      {/* Bottom Status / Operational Pill */}
      {trend && (
        <div className="flex items-center justify-end pt-2 border-t border-white/[0.04]">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold font-mono tracking-tight transition-colors duration-200 ${
              trend.variant && trend.variant !== "slate"
                ? COLOR_STYLES[trend.variant]?.trendPill
                : styles.trendPill
            }`}
          >
            {trend.direction === "up" && <ArrowUpRight className="h-2.5 w-2.5" />}
            {trend.direction === "down" && <ArrowDownRight className="h-2.5 w-2.5" />}
            {trend.direction === "neutral" && <ArrowRight className="h-2.5 w-2.5" />}
            <span>{trend.text}</span>
          </span>
        </div>
      )}
    </div>
  );
}
