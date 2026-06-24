/**
 * Side card rendered alongside the central HUD core.
 *
 * The card mirrors the structure used across the dashboard (translucent
 * background, semantic border, monospaced number) but it is visually
 * heavier than the original: a 48-56px icon disc, a 26-30px number, a
 * percentage badge, a thicker segmented indicator and technical corner
 * ticks. The dimensions are kept close to the reference composition
 * (≈ 280×100 on desktop).
 */

import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

import {
  cardGlyphBgClass,
  formatPercent,
  formatWeight,
} from "./dashboard-utils";
import type { DrugDisplayItem } from "./dashboard-utils";

/**
 * Number of segments in the percentage indicator. The reference image
 * shows ~20 segments to give the user a finer reading of the share.
 * Each segment represents (100 / 20) = 5% of the total.
 */
const SEGMENT_COUNT = 20;

export interface HudCardProps {
  item: DrugDisplayItem;
  /** Total grams used to compute the percentage indicator. */
  totalGrams: number;
  loading?: boolean;
  /** Optional slot rendered near the title (e.g. an overflow badge). */
  trailing?: ReactNode;
  /** Slot ref registered by the parent for connection lines. */
  cardRef?: (node: HTMLElement | null) => void;
  /** Visual emphasis: primary cards are slightly larger. */
  emphasis?: "primary" | "secondary";
}

const colorByTone: Record<string, string> = {
  emerald: "#10b981", // Maconha (verde)
  blue: "#22d3ee",    // Cocaína (cyan)
  violet: "#a78bfa",  // Crack (violeta)
  amber: "#f59e0b",   // Ecstasy
  cyan: "#06b6d4",    // Outros
  red: "#ef4444",
};

function renderDrugIcon(id: string, color: string) {
  if (id === "maconha") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/assets/icones/maconha_icon.png"
        alt="Maconha"
        className="w-[85%] h-[85%] object-contain"
      />
    );
  }
  
  if (id === "cocaina") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/assets/icones/cocaina_icon.png"
        alt="Cocaína"
        className="w-[85%] h-[85%] object-contain"
      />
    );
  }
  
  if (id === "crack") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/assets/icones/crack_icon.png"
        alt="Crack"
        className="w-[85%] h-[85%] object-contain"
      />
    );
  }
  
  if (id === "ecstasy") {
    return (
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color }}>
        <rect x="5" y="9" width="14" height="6" rx="3" transform="rotate(-45 12 12)" />
        <line x1="9" y1="15" x2="15" y2="9" />
      </svg>
    );
  }
  
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color }}>
      <path d="M6 3h12" />
      <path d="M9 3v6L4.5 18A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.8-3L15 9V3" />
      <path d="M6 14h12" />
    </svg>
  );
}

export function DashboardHudCard({
  item,
  totalGrams,
  loading = false,
  trailing,
  cardRef,
  emphasis = "primary",
}: HudCardProps) {
  const filledSegments = Math.round(
    Math.min(SEGMENT_COUNT, Math.max(0, (item.percent / 100) * SEGMENT_COUNT)),
  );

  const ariaLabel = loading
    ? "Carregando categoria"
    : `${item.name}: ${formatWeight(item.grams)}, ${formatPercent(
        item.grams,
        totalGrams,
      )} do total`;

  const color = colorByTone[item.tone] ?? "#06b6d4";

  const stableDuration = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < item.id.length; i++) {
      hash = item.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const randomFloat = (Math.abs(hash) % 100) / 100;
    return 4 + randomFloat * 2;
  }, [item.id]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ duration: 0.4 }}
      className="w-full h-[132px]"
      style={{
        filter: `drop-shadow(0 4px 20px rgba(0,0,0,0.5)) drop-shadow(0 0 15px ${color}18)`,
      }}
    >
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{
          duration: stableDuration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="w-full h-full relative"
      >
        {/* Outer clipped border layer */}
        <div
          className="absolute inset-0 transition-colors duration-300"
          style={{
            backgroundColor: `${color}40`,
            clipPath: "polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))",
          }}
        >
          {/* Inner clipped content layer */}
          <div
            aria-label={ariaLabel}
            className={cn(
              "absolute inset-[1px] overflow-hidden bg-slate-950/90 backdrop-blur-md transition-all duration-300 hover:bg-slate-900/95",
              emphasis === "primary" ? "p-5" : "p-4.5",
            )}
            style={{
              clipPath: "polygon(0 11px, 11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px))",
            }}
          >
            {/* Glow highlight on hover */}
            <div
              className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                boxShadow: `inset 0 0 12px ${color}20`,
              }}
            />

            {/* Subtle internal gradient — tone tinted */}
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 opacity-20 transition-opacity duration-300 hover:opacity-35",
                cardGlyphBgClass(item.tone),
              )}
              style={{
                maskImage: "linear-gradient(120deg, black 0%, transparent 60%)",
              }}
            />

            <div className="relative z-10 flex h-full items-center gap-4">
              {/* Left Side: Circular Icon Disc */}
              <div
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border transition-all duration-300 hover:scale-105"
                style={{
                  borderColor: `${color}45`,
                  backgroundColor: `${color}12`,
                  boxShadow: `inset 0 0 15px ${color}20, 0 0 12px ${color}12`,
                }}
              >
                {renderDrugIcon(item.id, color)}
              </div>

              {/* Right Side: Information */}
              <div className="flex min-w-0 flex-1 flex-col h-full justify-between py-0.5">
                {/* Header Row: Title & Trailing badge */}
                <div className="flex items-center justify-between">
                  <p
                    className="truncate text-[10px] font-black uppercase tracking-[0.24em]"
                    style={{ color: `${color}d0` }}
                  >
                    {item.name}
                  </p>
                  {trailing}
                </div>

                {/* Value Row */}
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-mono text-3xl font-black text-white leading-none tracking-tight">
                    {loading ? "--" : formatWeight(item.grams).split(" ")[0]}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {formatWeight(item.grams).split(" ")[1]}
                  </span>
                </div>

                {/* Subtitle */}
                <p className="text-[8px] uppercase tracking-[0.18em] text-slate-500 font-medium leading-none">
                  {loading
                    ? "sincronizando"
                    : item.isAggregate
                      ? "demais categorias"
                      : "apreendido"}
                </p>

                {/* Footer Row: Progress bar & Percentage badge */}
                <div className="flex items-center justify-between gap-3 mt-auto">
                  {/* Segmented meter */}
                  <div
                    aria-label={`${formatPercent(item.grams, totalGrams)} do total`}
                    className="flex gap-[3px] h-2 flex-1"
                    role="meter"
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={Math.round(item.percent)}
                    aria-valuetext={`${formatPercent(item.grams, totalGrams)} do total`}
                  >
                    {Array.from({ length: SEGMENT_COUNT }).map((_, index) => (
                      <span
                        aria-hidden="true"
                        className="h-full w-2.5 rounded-[1px] transition-all duration-500"
                        style={{
                          backgroundColor: index < filledSegments ? color : "rgba(255,255,255,0.06)",
                          boxShadow: index < filledSegments ? `0 0 6px ${color}af` : "none",
                          opacity: loading ? 0.4 : 1,
                        }}
                        key={`${item.id}-seg-${index}`}
                      />
                    ))}
                  </div>

                  {/* Percentage Capsule Badge */}
                  <span
                    className="rounded-full border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.16em] leading-none shrink-0"
                    style={{
                      borderColor: `${color}45`,
                      color: color,
                      backgroundColor: `${color}08`,
                      boxShadow: `0 0 8px ${color}10`,
                    }}
                  >
                    {loading ? "--" : formatPercent(item.grams, totalGrams)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}