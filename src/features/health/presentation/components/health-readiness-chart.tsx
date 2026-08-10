/**
 * K9 Ops Web — Health Web v1 HW-3B
 * Readiness Distribution Donut Chart Component for Health Overview (/health)
 *
 * MANDATE §11:
 * - Represents exclusively the distribution of valid operational readiness statuses.
 * - ZERO score, ZERO health percentage, ZERO clinical average!
 * - Accessible SVG chart with textual alternative and legend.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DonutSegment } from "../hooks/use-health-overview";

interface HealthReadinessChartProps {
  donutData: DonutSegment[];
  totalMonitored: number;
}

export function HealthReadinessChart({
  donutData,
  totalMonitored,
}: HealthReadinessChartProps) {
  // Compute SVG Donut paths
  const svgArcs = useMemo(() => {
    if (totalMonitored === 0 || donutData.length === 0) return [];

    let accumulatedAngle = 0;
    const radius = 40;
    const strokeWidth = 14;
    const center = 50;

    return donutData.map((segment) => {
      const fraction = segment.count / totalMonitored;
      const angle = fraction * 360;

      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angle;
      accumulatedAngle += angle;

      // Convert angles to radians
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
        ...segment,
        pathData,
        strokeWidth,
      };
    });
  }, [donutData, totalMonitored]);

  return (
    <div
      className="flex flex-col justify-between rounded-xl border border-border/60 bg-card p-5 shadow-sm"
      data-testid="health-readiness-chart"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Situação Geral da Prontidão
        </h3>
        <span className="text-xs text-muted-foreground">
          {totalMonitored} cães monitorados
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 items-center gap-6 sm:grid-cols-2">
        {/* SVG Donut Chart */}
        <div className="relative flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className="h-36 w-36 transform -rotate-90 transition-transform"
            aria-label="Gráfico de distribuição da prontidão operacional do efetivo"
            role="img"
          >
            {svgArcs.length === 0 ? (
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="14"
                className="text-muted/20"
              />
            ) : (
              svgArcs.map((arc) => (
                <path
                  key={arc.status}
                  d={arc.pathData}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={arc.strokeWidth}
                  strokeLinecap="round"
                  className="transition-all duration-300 hover:opacity-85"
                />
              ))
            )}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {totalMonitored}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              Monitorados
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2.5">
          {donutData.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sem dados de prontidão disponíveis no escopo atual.
            </p>
          ) : (
            donutData.map((seg) => (
              <div
                key={seg.status}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-foreground">{seg.label}</span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold">
                  <span className="text-foreground">{seg.count}</span>
                  <span className="text-muted-foreground text-[10px]">
                    ({seg.percentage}%)
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
