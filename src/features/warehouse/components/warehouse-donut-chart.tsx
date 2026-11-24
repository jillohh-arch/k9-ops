"use client";

import React, { useMemo } from "react";

export interface DonutSegment {
  label: string;
  count: number;
  percent: number;
  color: string;
}

export interface WarehouseDonutChartProps {
  title: string;
  centerValue: number | string;
  centerLabel: string;
  segments: DonutSegment[];
  emptyMessage?: string;
  className?: string;
}

export function WarehouseDonutChart({
  title,
  centerValue,
  centerLabel,
  segments,
  emptyMessage = "Nenhum dado cadastrado",
  className = "",
}: WarehouseDonutChartProps) {
  const total = useMemo(() => {
    return segments.reduce((sum, seg) => sum + seg.count, 0);
  }, [segments]);

  // Generate SVG arcs for the donut
  const arcs = useMemo(() => {
    if (total === 0) return [];

    let accumulatedAngle = 0;
    const radius = 38;
    const center = 50;

    return segments.map((seg) => {
      const fraction = seg.count / total;
      const angle = fraction * 360;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angle;
      accumulatedAngle += angle;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      const largeArcFlag = angle > 180 ? 1 : 0;
      const pathData =
        angle >= 359.9
          ? `M ${center - radius} ${center} A ${radius} ${radius} 0 1 0 ${center + radius} ${center} A ${radius} ${radius} 0 1 0 ${center - radius} ${center}`
          : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

      return {
        ...seg,
        pathData,
      };
    });
  }, [segments, total]);

  return (
    <div
      className={`flex flex-col rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] ${className}`}
    >
      <h3 className="text-xs font-bold font-mono uppercase tracking-[0.16em] text-slate-300">
        {title}
      </h3>

      {segments.length === 0 || total === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-center text-xs text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row sm:items-center sm:justify-around">
          {/* Donut Graphic */}
          <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 transform">
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="11"
              />
              {/* Colored Segments */}
              {arcs.map((arc, idx) => (
                <path
                  key={idx}
                  d={arc.pathData}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth="11"
                  strokeLinecap="round"
                />
              ))}
            </svg>

            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="font-mono text-2xl font-black text-white tabular-nums tracking-tight">
                {centerValue}
              </span>
              <span className="text-[10px] leading-tight text-slate-400 font-medium max-w-[70px]">
                {centerLabel}
              </span>
            </div>
          </div>

          {/* Legend Rows */}
          <div className="w-full flex-1 space-y-2">
            {segments.map((seg, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs text-slate-300 transition hover:text-white"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-slate-300">{seg.label}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] tabular-nums">
                  <span className="text-slate-400 font-medium">{seg.percent}%</span>
                  <span className="w-6 text-right font-bold text-white">{seg.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
