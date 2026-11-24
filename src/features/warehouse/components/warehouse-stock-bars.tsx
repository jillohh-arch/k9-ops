"use client";

import React from "react";

export interface StockBarItem {
  label: string;
  count: number;
  percent: number;
  color: string;
  barClass: string;
}

export interface WarehouseStockBarsProps {
  title?: string;
  items: StockBarItem[];
  className?: string;
}

export function WarehouseStockBars({
  title = "SITUAÇÃO DO ESTOQUE",
  items,
  className = "",
}: WarehouseStockBarsProps) {
  return (
    <div
      className={`flex flex-col rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] ${className}`}
    >
      <h3 className="text-xs font-bold font-mono uppercase tracking-[0.16em] text-slate-300">
        {title}
      </h3>

      <div className="mt-4 flex flex-1 flex-col justify-center space-y-3.5">
        {items.map((item, idx) => (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">{item.label}</span>
              <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                <span className="font-bold text-white">{item.count}</span>
                <span className="text-slate-400 font-medium">{item.percent}%</span>
              </div>
            </div>

            {/* Progress Track */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${item.barClass}`}
                style={{
                  width: `${Math.min(100, Math.max(item.percent, item.count > 0 ? 3 : 0))}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
