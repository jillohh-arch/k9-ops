import { ShieldCheck } from "lucide-react";

import type { ShiftTodayGroup } from "./dashboard-types";

export interface DashboardShiftTodayProps {
  onDutyToday: ShiftTodayGroup[];
}

export function DashboardShiftToday({ onDutyToday }: DashboardShiftTodayProps) {
  if (onDutyToday.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-white">
            GCMs de serviço hoje
          </h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Agentes escalados para os turnos do dia.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {onDutyToday.map(({ group, members, startHour, endHour }) => (
          <div
            key={group.id}
            className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-white">{group.name}</p>
              {startHour && endHour && (
                <span className="text-xs text-slate-500">
                  {startHour}–{endHour}
                </span>
              )}
            </div>
            {members.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {members.map((name) => (
                  <li
                    className="flex items-center gap-2 text-sm text-slate-300"
                    key={name}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Nenhum agente vinculado.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
