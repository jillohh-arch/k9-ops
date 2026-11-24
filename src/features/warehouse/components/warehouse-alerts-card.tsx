"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { WarehouseOperationalAlert } from "../domain/overview";

export interface WarehouseAlertsCardProps {
  title?: string;
  alerts: WarehouseOperationalAlert[];
  allAlertsHref?: string;
  maxItems?: number;
  className?: string;
  testId?: string;
}

export function WarehouseAlertsCard({
  title = "PENDÊNCIAS DO ALMOXARIFADO",
  alerts,
  allAlertsHref = "/warehouse",
  maxItems = 5,
  className = "",
  testId = "alerts-list",
}: WarehouseAlertsCardProps) {
  const displayedAlerts = alerts.slice(0, maxItems);
  const criticalAndWarningCount = alerts.filter(
    (a) => a.severity === "critical" || a.severity === "warning",
  ).length;

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0b1424]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <h3 className="text-xs font-bold font-mono uppercase tracking-[0.16em] text-slate-300">
            {title}
          </h3>
          {criticalAndWarningCount > 0 && (
            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold font-mono text-rose-300">
              {criticalAndWarningCount} {criticalAndWarningCount === 1 ? "pendência" : "pendências"}
            </span>
          )}
        </div>

        {allAlertsHref && (
          <Link
            href={allAlertsHref}
            className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
          >
            <span>Ver todas</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* Body */}
      {alerts.length === 0 ? (
        <div
          data-testid="healthy-empty-state"
          className="flex flex-1 flex-col items-center justify-center py-8 text-center"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="mt-3 text-xs font-semibold text-emerald-200">
            Nenhuma pendência crítica no almoxarifado.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Todos os lotes, cautelas e estoques estão em conformidade operacional.
          </p>
        </div>
      ) : (
        <ul data-testid={testId} className="mt-3 divide-y divide-white/[0.04]">
          {displayedAlerts.map((alert) => {
            const isCritical = alert.severity === "critical";
            const badgeLabel = isCritical ? "CRÍTICO" : "ATENÇÃO";
            const badgeClass = isCritical
              ? "border-rose-500/40 bg-rose-500/20 text-rose-300"
              : "border-amber-500/40 bg-amber-500/20 text-amber-300";

            return (
              <li
                key={alert.id}
                className="group flex items-center justify-between gap-3 py-2.5 transition hover:bg-white/[0.02] px-1 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[9px] font-black font-mono tracking-wider shrink-0 ${badgeClass}`}
                  >
                    {badgeLabel}
                  </span>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate group-hover:text-cyan-200 transition">
                      {alert.title}
                    </p>
                    {alert.description && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {alert.description}
                      </p>
                    )}
                  </div>
                </div>

                <Link
                  href={alert.href}
                  className="flex items-center gap-1 shrink-0 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition ml-2"
                >
                  <span>{alert.kind === "out_of_stock" ? "Ajustar" : "Acessar"}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
