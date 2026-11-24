"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Bone,
  HeartPulse,
  LayoutGrid,
  List,
  Package,
  Shield,
  Sparkles,
} from "lucide-react";

/**
 * AnimatedNumber
 * Smoothly animates an integer or floating value from 0 to target on initial mount / change.
 * Immediately renders final value if prefers-reduced-motion is active.
 * Safe for SSR: initial server render matches target to prevent hydration mismatches.
 */
export function AnimatedNumber({
  value,
  duration = 800,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number | string;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const hasPercent = typeof value === "string" && value.includes("%");
  const effSuffix = suffix || (hasPercent ? "%" : "");

  const numericValue = typeof value === "number" ? value : parseFloat(String(value).replace(/[^\d.-]/g, ""));
  const isNumeric = !isNaN(numericValue);
  const shouldReduceMotion = useReducedMotion();

  const [animatedValue, setAnimatedValue] = useState<number | null>(null);

  useEffect(() => {
    if (!isNumeric || shouldReduceMotion) {
      return;
    }

    let startTimestamp: number | null = null;
    const startValue = 0;
    const endValue = numericValue;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(startValue + (endValue - startValue) * ease);
      setAnimatedValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setAnimatedValue(endValue);
      }
    };

    const animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [numericValue, isNumeric, shouldReduceMotion, duration]);

  const display = !isNumeric || shouldReduceMotion || animatedValue === null ? value : animatedValue;
  const formatted =
    typeof display === "number"
      ? `${display.toLocaleString("pt-BR")}${effSuffix}`
      : display;

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {!hasPercent ? suffix : ""}
    </span>
  );
}

/**
 * AnimatedProgressBar
 * Smooth expanding progress bar with easeOut animation.
 */
export function AnimatedProgressBar({
  percentage,
  colorVariant = "cyan",
  className = "h-2 w-full rounded-full bg-slate-800/80 overflow-hidden",
  indicatorClassName = "",
}: {
  percentage: number;
  colorVariant?: "cyan" | "emerald" | "amber" | "rose" | "purple" | "blue";
  className?: string;
  indicatorClassName?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, percentage));

  const gradientMap: Record<string, string> = {
    cyan: "bg-gradient-to-r from-cyan-500 to-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]",
    emerald: "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]",
    amber: "bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]",
    rose: "bg-gradient-to-r from-rose-500 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]",
    purple: "bg-gradient-to-r from-purple-500 to-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)]",
    blue: "bg-gradient-to-r from-blue-500 to-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.4)]",
  };

  const bg = gradientMap[colorVariant] || gradientMap.cyan;

  return (
    <div className={className}>
      <motion.div
        initial={shouldReduceMotion ? false : { width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.8, ease: "easeOut" }}
        className={`h-full rounded-full ${bg} ${indicatorClassName}`}
      />
    </div>
  );
}

/**
 * PriorityPulseDot
 * Restrained subtle pulse on critical alert indicators only.
 */
export function PriorityPulseDot({
  tone = "rose",
  className = "",
}: {
  tone?: "rose" | "amber" | "cyan" | "emerald";
  className?: string;
}) {
  const colorMap = {
    rose: "bg-rose-500 ring-rose-500/40",
    amber: "bg-amber-400 ring-amber-400/40",
    cyan: "bg-cyan-400 ring-cyan-400/40",
    emerald: "bg-emerald-400 ring-emerald-400/40",
  };

  const selected = colorMap[tone] || colorMap.rose;

  return (
    <span className={`relative flex h-2 w-2 ${className}`}>
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${selected}`}
      />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${selected}`} />
    </span>
  );
}

/**
 * Stagger Container and Item Variants
 */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1], // easeOutCubic
    },
  },
};

/**
 * WarehouseItemThumbnail
 * High-performance image container with graceful local fallback placeholder,
 * hover zoom, and category-themed tactical illustration.
 */
export function WarehouseItemThumbnail({
  src,
  alt = "Item de Almoxarifado",
  categoryName = "",
  size = "md",
  className = "",
}: {
  src?: string | null;
  alt?: string;
  categoryName?: string;
  size?: "sm" | "md" | "lg" | "card" | "fill";
  className?: string;
}) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: "h-14 w-14 rounded-xl",
    md: "h-24 w-24 rounded-2xl",
    card: "h-[115px] w-[100px] shrink-0 rounded-2xl",
    lg: "h-36 w-full rounded-2xl",
    fill: "h-full w-full rounded-xl",
  };

  const getCategoryTheme = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes("nutri") || lower.includes("alim") || lower.includes("raç")) {
      return {
        icon: Bone,
        gradient: "from-amber-500/20 via-slate-900 to-[#0b1424]",
        accent: "text-amber-400",
        border: "border-amber-500/20",
        label: "Nutrição",
      };
    }
    if (lower.includes("hig") || lower.includes("dermat")) {
      return {
        icon: Sparkles,
        gradient: "from-cyan-500/20 via-slate-900 to-[#0b1424]",
        accent: "text-cyan-400",
        border: "border-cyan-500/20",
        label: "Higiene",
      };
    }
    if (lower.includes("limp") || lower.includes("desinf")) {
      return {
        icon: Package,
        gradient: "from-blue-500/20 via-slate-900 to-[#0b1424]",
        accent: "text-blue-400",
        border: "border-blue-500/20",
        label: "Limpeza",
      };
    }
    if (lower.includes("saúd") || lower.includes("farm") || lower.includes("med")) {
      return {
        icon: HeartPulse,
        gradient: "from-rose-500/20 via-slate-900 to-[#0b1424]",
        accent: "text-rose-400",
        border: "border-rose-500/20",
        label: "Saúde",
      };
    }
    // Equipment / Tactical
    return {
      icon: Shield,
      gradient: "from-emerald-500/20 via-slate-900 to-[#0b1424]",
      accent: "text-emerald-400",
      border: "border-emerald-500/20",
      label: "Operacional",
    };
  };

  const theme = getCategoryTheme(categoryName);
  const Icon = theme.icon;

  const isSafeImageSrc = (() => {
    if (!src || typeof src !== "string") return false;
    const trimmed = src.trim();
    if (!trimmed) return false;
    if (/^\s*javascript:/i.test(trimmed) || /^\s*data:/i.test(trimmed)) return false;
    return true;
  })();

  if (isSafeImageSrc && !imageError) {
    return (
      <div
        className={`relative overflow-hidden border border-white/[0.08] bg-[#07111f] ${sizeClasses[size]} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src!.trim()}
          alt={alt}
          onError={() => setImageError(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      </div>
    );
  }

  // Tactical SVG Fallback Placeholder
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden border ${theme.border} bg-gradient-to-br ${theme.gradient} shadow-inner group-hover:border-cyan-500/40 transition-colors duration-300 ${sizeClasses[size]} ${className}`}
    >
      {/* Background grid texture */}
      <svg
        className="absolute inset-0 h-full w-full opacity-10"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid-pattern" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="currentColor" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
      </svg>

      {/* Central Tactical Icon */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center p-2">
        <div
          className={`rounded-xl border border-white/10 bg-white/[0.04] p-2.5 ${theme.accent} shadow-md transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon className="h-6 w-6" />
        </div>
        {size === "lg" && (
          <span className="mt-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
            {theme.label}
          </span>
        )}
      </div>

      {/* Subtle corner badge */}
      <div className="absolute bottom-1 right-1.5 text-[9px] font-mono font-bold text-slate-500/70 select-none">
        K9 // F60
      </div>
    </div>
  );
}

/**
 * ViewToggle
 * Toggle between Card Grid and List/Table view.
 */
export function ViewToggle({
  viewMode,
  onViewModeChange,
  className = "",
}: {
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center rounded-xl border border-white/10 bg-slate-900/80 p-0.5 shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={() => onViewModeChange("grid")}
        aria-label="Visualização em Grade"
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
          viewMode === "grid"
            ? "bg-cyan-500 text-slate-950 font-bold shadow"
            : "text-slate-400 hover:text-white"
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Cards</span>
      </button>

      <button
        type="button"
        onClick={() => onViewModeChange("list")}
        aria-label="Visualização em Lista"
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
          viewMode === "list"
            ? "bg-cyan-500 text-slate-950 font-bold shadow"
            : "text-slate-400 hover:text-white"
        }`}
      >
        <List className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Tabela</span>
      </button>
    </div>
  );
}
