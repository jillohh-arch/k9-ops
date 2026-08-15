"use client";

import { cn } from "@/lib/utils";

interface RankedBarItem {
  /** Unique key for the item. */
  key: string;
  /** Human-readable label. */
  label: string;
  /** Numeric value to display and for bar width calculation. */
  value: number;
}

interface ReportRankedBarsProps {
  /** Items to display, sorted descending by value (caller sorts). */
  items: RankedBarItem[];
  /** Accessible label for the whole list. */
  ariaLabel: string;
  /** Shown when items is empty. */
  emptyMessage: string;
  /** True when data may be truncated. */
  truncated?: boolean;
  /** Format a value for display (default: toLocaleString). */
  formatValue?: (value: number) => string;
  /** Optional CSS max-height for the bar container. */
  maxHeight?: string;
}

/**
 * Renders a ranked list of items with proportional horizontal bars.
 * Zero values render a minimal bar (not hidden). Uses accessible text labels.
 */
export function ReportRankedBars({
  items,
  ariaLabel,
  emptyMessage,
  truncated = false,
  formatValue = (v) => v.toLocaleString("pt-BR"),
  maxHeight,
}: ReportRankedBarsProps) {
  if (items.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-slate-500">{emptyMessage}</p>
    );
  }

  const maxValue = Math.max(...items.map((i) => i.value));

  return (
    <div className="space-y-3" role="list" aria-label={ariaLabel}>
      {truncated && (
        <p className="text-[11px] text-slate-500">
          Os valores representam pelo menos os registros carregados.
        </p>
      )}
      <ul className={cn("space-y-2", maxHeight ? `max-h-${maxHeight}` : "")}>
        {items.map((item) => {
          // Proportional width: minimum 4% for small values, full for max.
          const pct = maxValue === 0 ? 0 : Math.max(4, (item.value / maxValue) * 100);
          const accessibleLabel = `${item.label}: ${formatValue(item.value)}`;

          return (
            <li key={item.key} role="listitem" aria-label={accessibleLabel}>
              <div className="flex items-center gap-3">
                {/* Label */}
                <span
                  className={cn(
                    "min-w-0 shrink-0 text-xs font-semibold text-slate-300",
                    "truncate max-w-[10rem]",
                  )}
                  title={item.label}
                >
                  {item.label}
                </span>

                {/* Bar track */}
                <div className="relative min-w-0 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    aria-hidden="true"
                    className="h-2.5 rounded-full bg-cyan-400/30 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Value */}
                <span className="shrink-0 text-xs font-bold text-slate-300 tabular-nums">
                  {formatValue(item.value)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
