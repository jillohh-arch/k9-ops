"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * Lazy-loaded Recharts components with SSR disabled.
 *
 * Recharts depends heavily on browser APIs (SVG measuring, DOM refs) and does
 * not render correctly on the server. Each component below is loaded via
 * next/dynamic with `ssr: false` so the bundle is only fetched client-side.
 *
 * NOTE: Turbopack requires the options object to be an inline literal for each
 * dynamic() call — we cannot share a variable reference.
 */

function ChartSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando gráfico"
      className="flex h-full min-h-[200px] w-full items-center justify-center rounded-2xl border border-white/8 bg-white/[0.02]"
      role="status"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-700/60" />
        <span className="text-xs text-slate-500">Carregando gráfico…</span>
      </div>
    </div>
  );
}

// --- Containers ---
export const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

// --- Charts ---
export const AreaChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.AreaChart })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

export const BarChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.BarChart })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

export const LineChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.LineChart })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

export const PieChart = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.PieChart })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

// --- Series ---
export const Area = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Area })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

export const Bar = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Bar })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

export const Line = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Line })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

export const Pie = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Pie })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

// --- Axes & Helpers ---
export const XAxis = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.XAxis })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

export const YAxis = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.YAxis })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

export const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.CartesianGrid })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

export const Tooltip = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Tooltip })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

export const Legend = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Legend })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

export const Cell = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.Cell })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;

// --- Reference elements ---
export const ReferenceArea = dynamic(
  () => import("recharts").then((mod) => ({ default: mod.ReferenceArea })),
  { loading: () => <ChartSkeleton />, ssr: false },
) as unknown as ComponentType<any>;
