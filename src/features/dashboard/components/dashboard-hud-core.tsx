/**
 * Central HUD ring rendered as inline SVG. Server-safe — no hooks,
 * browser APIs, or client-only behaviour. Animations are declared as
 * Tailwind utilities (`animate-*`) plus a small SVG transition on
 * `stroke-dashoffset`/`opacity` controlled by CSS in the parent.
 *
 * The ring represents the real distribution across categories: each
 * visible category gets its own circular segment computed from
 * `strokeDasharray` and `strokeDashoffset`. Segments are rendered
 * starting from 12 o'clock and rotated by `-90deg` via `transform`.
 */

import { cn } from "@/lib/utils";

import { ringStrokeClass } from "./dashboard-utils";
import type { DashboardTone } from "./dashboard-utils";

export interface HudCoreSegment {
  /** Display label — used for the legend tooltip (sr-only). */
  label: string;
  /** Percentage 0..100. */
  percent: number;
  /** Tone key for the segment colour. */
  tone: DashboardTone;
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
  /** Optional size in pixels (square). Default 240. */
  size?: number;
  /** Optional accent text shown below the unit. Defaults to "N categorias". */
  categoriesCaption?: string;
  /** Ref callback registered by the parent so connection lines can
   *  measure the core element. */
  coreRef?: (node: HTMLElement | null) => void;
}

const RING_RADIUS_RATIO = 0.78;
const RING_STROKE_RATIO = 0.08;
const OUTER_RING_RATIO = 0.94;
const OUTER_RING_STROKE = 0.012;
const INNER_RING_RATIO = 0.62;
const INNER_RING_STROKE = 0.01;

export function DashboardHudCore({
  segments,
  totalLabel,
  unit,
  categoryCount,
  loading = false,
  totalCaption = "TOTAL APREENDIDO",
  size = 240,
  categoriesCaption,
  coreRef,
}: HudCoreProps) {
  const center = size / 2;
  const ringRadius = size * RING_RADIUS_RATIO;
  const ringStroke = size * RING_STROKE_RATIO;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const outerRadius = size * OUTER_RING_RATIO;
  const outerStroke = size * OUTER_RING_STROKE;
  const innerRadius = size * INNER_RING_RATIO;
  const innerStroke = size * INNER_RING_STROKE;

  const caption = categoriesCaption ?? `${categoryCount} categorias`;

  return (
    <div
      ref={coreRef}
      aria-hidden={loading ? undefined : "true"}
      className="relative inline-flex items-center justify-center"
      style={{ height: size, width: size }}
    >
      {/* Base ellipse — simulates projection on the floor */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 left-1/2 -z-10 h-6 w-[80%] -translate-x-1/2 rounded-[100%] bg-cyan-400/20 blur-md"
      />
      <svg
        aria-label={
          loading
            ? "Carregando distribuição de apreensões"
            : `Total apreendido: ${totalLabel}, ${categoryCount} categorias`
        }
        className="hud-fade-in"
        height={size}
        role="img"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <defs>
          <radialGradient cx="50%" cy="50%" id="hud-core-glow" r="50%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.25)" />
            <stop offset="60%" stopColor="rgba(34,211,238,0.04)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </radialGradient>
          <linearGradient id="hud-core-stroke" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.0)" />
            <stop offset="50%" stopColor="rgba(34,211,238,0.4)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.0)" />
          </linearGradient>
        </defs>

        {/* Inner glow */}
        <circle
          cx={center}
          cy={center}
          fill="url(#hud-core-glow)"
          r={center}
        />

        {/* Technical outer ring (slow rotation handled via parent class) */}
        <g
          className="hud-rotate-slow origin-center"
          style={{ transformOrigin: `${center}px ${center}px` }}
        >
          <circle
            cx={center}
            cy={center}
            fill="none"
            r={outerRadius}
            stroke="rgba(34,211,238,0.18)"
            strokeWidth={outerStroke}
          />
          {/* Markers around the outer ring */}
          {Array.from({ length: 24 }).map((_, index) => {
            const angle = (index / 24) * Math.PI * 2 - Math.PI / 2;
            const x1 = center + Math.cos(angle) * (outerRadius - outerStroke * 2);
            const y1 = center + Math.sin(angle) * (outerRadius - outerStroke * 2);
            const x2 = center + Math.cos(angle) * (outerRadius + outerStroke * 2);
            const y2 = center + Math.sin(angle) * (outerRadius + outerStroke * 2);
            return (
              <line
                key={`marker-${index}`}
                stroke="rgba(34,211,238,0.35)"
                strokeWidth={outerStroke * 0.6}
                x1={x1}
                x2={x2}
                y1={y1}
                y2={y2}
              />
            );
          })}
        </g>

        {/* Inner technical ring */}
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={innerRadius}
          stroke="rgba(148,163,184,0.18)"
          strokeDasharray="2 6"
          strokeWidth={innerStroke}
        />

        {/* Background ring track */}
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={ringRadius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={ringStroke}
        />

        {/* Distribution segments */}
        {!loading &&
          segments.map((segment, index) => {
            const previousTotal = segments
              .slice(0, index)
              .reduce((sum, current) => sum + current.percent, 0);
            const dashLength = (segment.percent / 100) * ringCircumference;
            const offset = -(previousTotal / 100) * ringCircumference;
            return (
              <circle
                className={cn("hud-ring-segment", ringStrokeClass(segment.tone))}
                cx={center}
                cy={center}
                fill="none"
                key={`${segment.label}-${index}`}
                r={ringRadius}
                strokeDasharray={`${dashLength} ${ringCircumference - dashLength}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                strokeWidth={ringStroke}
                style={{
                  transform: `rotate(${-90 + (previousTotal / 100) * 360}deg)`,
                  transformOrigin: `${center}px ${center}px`,
                }}
              />
            );
          })}

        {/* Outer hairline */}
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={ringRadius + ringStroke}
          stroke="url(#hud-core-stroke)"
          strokeWidth={outerStroke * 0.6}
        />

        {/* Loading skeleton: dim placeholder ring */}
        {loading && (
          <circle
            className="hud-ring-pulse"
            cx={center}
            cy={center}
            fill="none"
            r={ringRadius}
            stroke="rgba(148,163,184,0.25)"
            strokeDasharray={`${ringCircumference * 0.25} ${ringCircumference * 0.75}`}
            strokeWidth={ringStroke}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: `${center}px ${center}px`,
            }}
          />
        )}
      </svg>

      {/* Center labels */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-200/60">
          {totalCaption}
        </span>
        <span className="mt-2 font-mono text-4xl font-black leading-none text-white drop-shadow-[0_0_18px_rgba(34,211,238,0.28)]">
          {loading ? "--" : totalLabel}
        </span>
        {unit && !loading && (
          <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
            {unit}
          </span>
        )}
        <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
          {caption}
        </span>
      </div>
    </div>
  );
}