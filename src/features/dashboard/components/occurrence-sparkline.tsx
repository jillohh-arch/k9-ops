"use client";

import { useId, useMemo } from "react";

import type { DashboardPeriodDays } from "@/features/dashboard/providers/dashboard-period-provider";

import {
  occurrenceDate,
  periodStart,
} from "./dashboard-utils";
import type { DashboardRecord } from "./dashboard-types";

/* ─── Sparkline ───
 * Smooth SVG line showing occurrence volume per day in the period.
 * Filled area below the line with a cyan gradient.
 */
export function OccurrenceSparkline({
  periodDays,
  records,
}: {
  periodDays: DashboardPeriodDays;
  records: DashboardRecord[];
}) {
  const points = useMemo(() => {
    const start = periodStart(periodDays);
    const buckets: { day: number; count: number; label: string }[] = [];

    for (let offset = 0; offset < periodDays; offset += 1) {
      const day = new Date(start);
      day.setDate(day.getDate() + offset);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const count = records.filter((record) => {
        const date = occurrenceDate(record);
        if (!date) return false;
        return date >= day && date < next;
      }).length;
      buckets.push({
        count,
        day: offset,
        label: day.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3),
      });
    }
    return buckets;
  }, [periodDays, records]);

  const W = 280;
  const H = 56;
  const PAD_X = 4;
  const PAD_Y = 6;
  const max = Math.max(1, ...points.map((p) => p.count));
  const stepX = (W - PAD_X * 2) / Math.max(1, points.length - 1);

  const toX = (i: number) => PAD_X + i * stepX;
  const toY = (count: number) =>
    H - PAD_Y - (count / max) * (H - PAD_Y * 2);

  // Build a smooth (monotone) path through the points.
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(2)} ${toY(p.count).toFixed(2)}`)
    .join(" ");

  const areaPath = points.length > 0
    ? `${linePath} L ${toX(points.length - 1).toFixed(2)} ${H} L ${toX(0).toFixed(2)} ${H} Z`
    : "";

  const lastCount = points[points.length - 1]?.count ?? 0;
  const lastX = toX(points.length - 1);
  const lastY = toY(lastCount);

  // Unique gradient id (stable across renders)
  const gradId = useId();

  return (
    <div className="flex items-center gap-3">
      <svg
        className="overflow-visible"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        aria-label="Tendência de ocorrências no período"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(34,211,238)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(34,211,238)" stopOpacity="0" />
          </linearGradient>
          <filter id={`${gradId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {areaPath && (
          <path d={areaPath} fill={`url(#${gradId})`} />
        )}
        <path
          d={linePath}
          fill="none"
          stroke="rgb(34,211,238)"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${gradId}-glow)`}
        />
        {/* Latest point dot */}
        <circle
          cx={lastX}
          cy={lastY}
          r={3}
          fill="rgb(34,211,238)"
          stroke="white"
          strokeWidth={1.2}
        />
      </svg>

      <div className="min-w-0">
        <p className="font-mono text-2xl font-black leading-none text-white">
          {lastCount}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
          hoje
        </p>
      </div>
    </div>
  );
}