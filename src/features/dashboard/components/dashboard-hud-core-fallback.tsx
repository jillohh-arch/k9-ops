"use client";

/**
 * CSS-only fallback for the central HUD core.
 *
 * Mirrors the layout of the 3D version (rings + beam + center label)
 * using only HTML, CSS and inline SVG. Activated when:
 *   - WebGL is unavailable (mobile, disabled GPU, headless browser)
 *   - the 3D component throws inside its Error Boundary
 *   - `DRUG_HUD_3D_FORCE_FALLBACK` is true
 *   - the device matches `DRUG_HUD_3D_MOBILE_QUERY`
 *
 * Visual parity with the 3D component is intentional: the audience
 * sees the same total/category composition regardless of which path
 * is taken, only the decorative chrome differs.
 */

import { useMemo } from "react";


export interface HudCoreSegment {
  /** Display label — used for sr-only legend. */
  label: string;
  /** Percentage 0..100. */
  percent: number;
  /** Tone key — currently used to colour the segments ring. */
  tone: string;
}

export interface HudCoreProps {
  segments: HudCoreSegment[];
  totalLabel: string;
  unit: string;
  categoryCount: number;
  loading?: boolean;
  totalCaption?: string;
  size?: number;
  categoriesCaption?: string;
  coreRef?: (node: HTMLElement | null) => void;
}

const TONE_COLOR: Record<string, string> = {
  amber: "#fcd34d",
  blue: "#60a5fa",
  cyan: "#22d3ee",
  emerald: "#34d399",
  red: "#f87171",
  violet: "#a78bfa",
};

export function DashboardHudCoreFallback({
  segments,
  totalLabel,
  unit,
  categoryCount,
  loading = false,
  totalCaption = "TOTAL APREENDIDO",
  size = 288,
  categoriesCaption,
  coreRef,
}: HudCoreProps) {
  const caption = categoriesCaption ?? `${categoryCount} categorias`;

  const ringSegments = useMemo(() => {
    const filtered = segments.filter((s) => s.percent > 0);
    if (filtered.length === 0) return [];
    const total = filtered.reduce((sum, s) => sum + s.percent, 0);
    let cursor = -90; // start at 12 o'clock
    return filtered.map((segment, index) => {
      const sweep = total > 0 ? (segment.percent / total) * 360 : 0;
      const start = cursor;
      const end = cursor + sweep;
      cursor = end;
      const largeArc = sweep > 180 ? 1 : 0;
      const r = 110;
      const cx = 130;
      const cy = 130;
      const startRad = (start * Math.PI) / 180;
      const endRad = (end * Math.PI) / 180;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      return {
        color: TONE_COLOR[segment.tone] ?? TONE_COLOR.cyan,
        d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        key: `${segment.tone}-${index}`,
      };
    });
  }, [segments]);

  return (
    <div
      ref={coreRef}
      aria-label={loading ? "Carregando total apreendido" : `Total apreendido ${totalLabel}, ${caption}`}
      className="relative inline-flex items-center justify-center select-none"
      style={{ width: size, height: size }}
    >
      <div
        className="relative h-full w-full"
        style={{ animation: "drug-hud-fallback-pulse 4s ease-in-out infinite" }}
      >
        {/* Outer halo */}
        <div
          aria-hidden="true"
          className="absolute inset-[-8%] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.18) 0%, rgba(34,211,238,0.06) 35%, transparent 65%)",
            filter: "blur(6px)",
          }}
        />

        {/* Concentric rings (SVG so we can animate them cheaply) */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 260 260"
        >
          <defs>
            <filter id="drug-hud-fallback-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Static plate */}
          <circle
            cx="130"
            cy="130"
            r="118"
            fill="rgba(8,16,28,0.85)"
            stroke="rgba(34,211,238,0.35)"
            strokeWidth="1"
          />

          {/* Spinning outer ring */}
          <g style={{ transformOrigin: "130px 130px", animation: "drug-hud-spin-cw 16s linear infinite" }}>
            <circle
              cx="130"
              cy="130"
              r="104"
              fill="none"
              stroke="rgba(34,211,238,0.55)"
              strokeDasharray="4 12"
              strokeWidth="1.2"
              filter="url(#drug-hud-fallback-glow)"
            />
          </g>

          {/* Counter-spinning mid ring */}
          <g style={{ transformOrigin: "130px 130px", animation: "drug-hud-spin-ccw 22s linear infinite" }}>
            <circle
              cx="130"
              cy="130"
              r="92"
              fill="none"
              stroke="rgba(167,139,250,0.45)"
              strokeDasharray="2 6"
              strokeWidth="1"
              filter="url(#drug-hud-fallback-glow)"
            />
          </g>

          {/* Inner ring (slow) */}
          <g style={{ transformOrigin: "130px 130px", animation: "drug-hud-spin-cw 28s linear infinite" }}>
            <circle
              cx="130"
              cy="130"
              r="80"
              fill="none"
              stroke="rgba(34,211,238,0.4)"
              strokeDasharray="1 4"
              strokeWidth="0.8"
            />
          </g>

          {/* Tick marks every 30° on the outer ring */}
          {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index * 30 * Math.PI) / 180;
            const x1 = 130 + 116 * Math.cos(angle);
            const y1 = 130 + 116 * Math.sin(angle);
            const x2 = 130 + 122 * Math.cos(angle);
            const y2 = 130 + 122 * Math.sin(angle);
            return (
              <line
                key={`tick-${index}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(34,211,238,0.6)"
                strokeWidth="1"
              />
            );
          })}

          {/* Data ring (segments) */}
          {ringSegments.length > 0 && (
            <g filter="url(#drug-hud-fallback-glow)">
              {ringSegments.map((segment) => (
                <path
                  d={segment.d}
                  key={segment.key}
                  fill="none"
                  stroke={segment.color}
                  strokeLinecap="round"
                  strokeWidth="6"
                />
              ))}
            </g>
          )}

          {/* Vertical light beam */}
          <rect
            x="120"
            y="0"
            width="20"
            height="260"
            fill="url(#drug-hud-beam)"
            opacity="0.35"
          />
          <defs>
            <linearGradient id="drug-hud-beam" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgba(34,211,238,0)" />
              <stop offset="50%" stopColor="rgba(34,211,238,0.7)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0)" />
            </linearGradient>
          </defs>

          {/* Center cross-hair */}
          <g opacity="0.5">
            <line x1="130" y1="120" x2="130" y2="140" stroke="rgba(34,211,238,0.7)" strokeWidth="1" />
            <line x1="120" y1="130" x2="140" y2="130" stroke="rgba(34,211,238,0.7)" strokeWidth="1" />
          </g>
        </svg>

        {/* Central Glass Card Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div
            className="relative w-[170px] h-[122px]"
            style={{
              filter: "drop-shadow(0 0 18px rgba(34,211,238,0.3))",
            }}
          >
            {/* Bevel Border */}
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: "rgba(34,211,238,0.45)",
                clipPath: "polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))",
              }}
            />
            {/* Bevel Content */}
            <div
              className="absolute inset-[1px] bg-[#021020]/90 flex flex-col items-center justify-center p-4 text-center"
              style={{
                clipPath: "polygon(0 11px, 11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px))",
              }}
            >
              <span className="text-[8px] font-bold uppercase tracking-[0.24em] text-cyan-200/70 font-sans">
                {totalCaption}
              </span>
              <span
                className="mt-1.5 font-mono text-[30px] font-extrabold leading-none text-white"
                style={{
                  textShadow: "0 0 12px rgba(34,211,238,0.6)",
                }}
              >
                {loading ? "--" : totalLabel}
              </span>
              {unit && !loading && (
                <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.24em] text-cyan-200/60 font-sans font-mono">
                  {unit}
                </span>
              )}
              <span className="mt-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-300 font-sans">
                {caption}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Animations are scoped via Tailwind's arbitrary values? No — we use
          a regular style tag so the fallback works without any external
          animation utility. */}
      <style jsx>{`
        @keyframes drug-hud-fallback-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.025); }
        }
        @keyframes drug-hud-spin-cw {
          to { transform: rotate(360deg); }
        }
        @keyframes drug-hud-spin-ccw {
          to { transform: rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}