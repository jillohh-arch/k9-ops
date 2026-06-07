"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DashboardPeriodDays = 1 | 7 | 30;

export const dashboardPeriodOptions: Array<{
  days: DashboardPeriodDays;
  label: string;
}> = [
  { days: 1, label: "Hoje" },
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
];

type DashboardPeriodContextValue = {
  periodDays: DashboardPeriodDays;
  periodLabel: string;
  setPeriodDays: (days: DashboardPeriodDays) => void;
};

const DashboardPeriodContext =
  createContext<DashboardPeriodContextValue | null>(null);

export function DashboardPeriodProvider({ children }: { children: ReactNode }) {
  const [periodDays, setPeriodDays] = useState<DashboardPeriodDays>(7);
  const periodLabel =
    dashboardPeriodOptions.find((option) => option.days === periodDays)?.label ??
    "7 dias";

  const value = useMemo(
    () => ({
      periodDays,
      periodLabel,
      setPeriodDays,
    }),
    [periodDays, periodLabel],
  );

  return (
    <DashboardPeriodContext.Provider value={value}>
      {children}
    </DashboardPeriodContext.Provider>
  );
}

export function useDashboardPeriod() {
  const context = useContext(DashboardPeriodContext);

  if (!context) {
    throw new Error(
      "useDashboardPeriod deve ser usado dentro de DashboardPeriodProvider.",
    );
  }

  return context;
}
