/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import React, { useEffect, useState } from "react";
import { DashboardHudCoreFallback } from "./dashboard-hud-core-fallback";
import type { DashboardTone } from "./dashboard-utils";

export interface HudCoreSegment {
  /** Display label — used for the legend tooltip (sr-only). */
  label: string;
  /** Percentage 0..100. */
  percent: number;
  /** Tone key for the segment colour. */
  tone: DashboardTone | string;
}

export interface HudCoreProps {
  /** Segments to render on the main ring. */
  segments: HudCoreSegment[];
  /** Formatted total string already (e.g. "198 g" or "1,2 kg"). */
  totalLabel: string;
  /** Unit shown next to the total ("g" / "kg"). */
  unit: string;
  /** Number of underlying categories for the subtitle. */
  categoryCount: number;
  /** When true, displays the loading skeleton (no segments). */
  loading?: boolean;
  /** Optional override for the inner text. Defaults to "TOTAL APREENDIDO". */
  totalCaption?: string;
  /** Optional size in pixels (square). Default 220. */
  size?: number;
  /** Optional accent text shown below the unit. Defaults to "N categorias". */
  categoriesCaption?: string;
  /** Ref callback registered by the parent so connection lines can
   *  measure the core element. */
  coreRef?: (node: HTMLElement | null) => void;
}



export function DashboardHudCore(props: HudCoreProps) {
  const {
    segments,
    totalLabel,
    unit,
    categoryCount,
    loading = false,
    totalCaption = "TOTAL APREENDIDO",
    size = 288,
    categoriesCaption,
    coreRef,
  } = props;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fallbackProps = {
    segments,
    totalLabel,
    unit,
    categoryCount,
    loading,
    totalCaption,
    size,
    categoriesCaption,
    coreRef,
  };

  // Server-side rendering or initial client mount placeholder to prevent layout shift
  if (!mounted) {
    return (
      <div
        ref={coreRef}
        className="relative inline-flex items-center justify-center select-none"
        style={{ width: size, height: size }}
      >
        <div className="p-4 rounded-full bg-slate-900/60 backdrop-blur-md flex flex-col items-center shadow-[0_0_15px_rgba(0,255,255,0.2)] pointer-events-none text-center select-none whitespace-nowrap">
          <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-200/70">
            {totalCaption}
          </span>
          <span className="mt-2 font-mono text-[40px] font-extrabold leading-none text-white">
            --
          </span>
        </div>
      </div>
    );
  }

  return <DashboardHudCoreFallback {...fallbackProps} />;
}