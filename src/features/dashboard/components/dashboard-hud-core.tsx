/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { Component, Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { DashboardHudCoreFallback } from "./dashboard-hud-core-fallback";
import {
  DRUG_HUD_3D_FORCE_FALLBACK,
  DRUG_HUD_3D_MOBILE_QUERY,
} from "./drug-hud-3d-config";
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

// Lazy load the 3D core to avoid importing Three.js eagerly in the main bundle
const DashboardHudCore3D = lazy(() =>
  import("./dashboard-hud-core-3d").then((m) => ({
    default: m.DashboardHudCore3D,
  }))
);

// Helper to check WebGL compatibility on the client side
function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

// Safety Error Boundary to fallback to CSS/SVG HUD core on rendering or loader failures
interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Three.js/R3F Canvas error caught in ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
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

  const [use3D, setUse3D] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (DRUG_HUD_3D_FORCE_FALLBACK) {
      setUse3D(false);
      return;
    }

    // Skip WebGL pipeline on mobile/touch screens
    const mediaQuery = window.matchMedia(DRUG_HUD_3D_MOBILE_QUERY);
    if (mediaQuery.matches) {
      setUse3D(false);
      return;
    }

    // Check feature support in the browser
    if (!isWebGLAvailable()) {
      setUse3D(false);
      return;
    }

    setUse3D(true);
  }, []);

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

  if (use3D) {
    return (
      <ErrorBoundary fallback={<DashboardHudCoreFallback {...fallbackProps} />}>
        <Suspense fallback={<DashboardHudCoreFallback {...fallbackProps} loading={true} />}>
          <DashboardHudCore3D {...props} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return <DashboardHudCoreFallback {...fallbackProps} />;
}