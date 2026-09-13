"use client";

/**
 * K9 Ops Web — Health Web v1 F30 Reports
 * Period selector for temporal scope filtering (Hoje, 7 dias, 30 dias).
 */

import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  REPORT_PERIOD_OPTIONS,
  type ReportPeriod,
} from "../domain/health-reports-types";

interface HealthReportsPeriodSelectorProps {
  period?: ReportPeriod;
  value?: ReportPeriod;
  onPeriodChange?: (period: ReportPeriod) => void;
  onChange?: (period: ReportPeriod) => void;
  disabled?: boolean;
  className?: string;
}

export function HealthReportsPeriodSelector({
  period,
  value,
  onPeriodChange,
  onChange,
  disabled = false,
  className,
}: HealthReportsPeriodSelectorProps) {
  const activePeriod = value ?? period ?? "7d";
  const handlePeriodChange = onChange ?? onPeriodChange ?? (() => {});

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/80 p-1 shadow-inner",
        className
      )}
      role="group"
      aria-label="Filtro de período para relatórios de saúde"
    >
      <div className="flex items-center gap-1 px-2 text-xs font-medium text-slate-400">
        <Calendar className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
        <span className="hidden sm:inline">Período:</span>
      </div>
      {REPORT_PERIOD_OPTIONS.map((option) => {
        const isActive = option.key === activePeriod;
        return (
          <button
            key={option.key}
            type="button"
            disabled={disabled}
            onClick={() => handlePeriodChange(option.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              isActive
                ? "bg-cyan-400/20 text-cyan-200 shadow-sm border border-cyan-400/30"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            title={option.description}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
