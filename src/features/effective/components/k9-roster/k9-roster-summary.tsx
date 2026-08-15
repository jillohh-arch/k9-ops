"use client";

import { AlertTriangle, GraduationCap, PawPrint, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export type K9RosterSummaryProps = {
  formation: number;
  loading: boolean;
  ready: number;
  total: number;
  unavailable: number;
};

const tones = {
  amber: {
    icon: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    glow: "bg-[radial-gradient(circle_at_84%_14%,rgba(251,191,36,0.10),transparent_36%)]",
  },
  cyan: {
    icon: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
    glow: "bg-[radial-gradient(circle_at_84%_14%,rgba(34,211,238,0.11),transparent_36%)]",
  },
  green: {
    icon: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
    glow: "bg-[radial-gradient(circle_at_84%_14%,rgba(52,211,153,0.10),transparent_36%)]",
  },
  red: {
    icon: "border-red-300/25 bg-red-300/10 text-red-200",
    glow: "bg-[radial-gradient(circle_at_84%_14%,rgba(248,113,113,0.10),transparent_36%)]",
  },
} as const;

function SummaryTile({
  detail,
  icon: Icon,
  label,
  loading,
  tone,
  value,
}: {
  detail: string;
  icon: typeof PawPrint;
  label: string;
  loading: boolean;
  tone: keyof typeof tones;
  value: number;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-cyan-200/12 bg-[#0b1628]/85 p-4 shadow-[0_20px_64px_rgba(0,0,0,0.2)]">
      <div className={cn("absolute inset-0", tones[tone].glow)} />
      <div className="relative flex items-center gap-3.5">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
            tones[tone].icon,
          )}
        >
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          {loading ? (
            <span
              aria-hidden
              className="mt-1 block h-7 w-12 animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none"
            />
          ) : (
            <p className="mt-0.5 text-[28px] font-black leading-none tabular-nums text-white">
              {value}
            </p>
          )}
          <p className="mt-1 truncate text-xs text-slate-400">{detail}</p>
        </div>
      </div>
    </article>
  );
}

function share(value: number, total: number) {
  if (!total) return "sem efetivo registrado";
  return `${Math.round((value / total) * 100)}% do efetivo`;
}

export function K9RosterSummary({
  formation,
  loading,
  ready,
  total,
  unavailable,
}: K9RosterSummaryProps) {
  return (
    <section
      className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4"
      data-testid="k9-roster-summary"
    >
      <SummaryTile
        detail="K9s no efetivo"
        icon={PawPrint}
        label="Efetivo total"
        loading={loading}
        tone="cyan"
        value={total}
      />
      <SummaryTile
        detail={loading ? "calculando..." : share(ready, total)}
        icon={ShieldCheck}
        label="Prontos para emprego"
        loading={loading}
        tone="green"
        value={ready}
      />
      <SummaryTile
        detail={loading ? "calculando..." : share(formation, total)}
        icon={GraduationCap}
        label="Em formação"
        loading={loading}
        tone="amber"
        value={formation}
      />
      <SummaryTile
        detail={loading ? "calculando..." : share(unavailable, total)}
        icon={AlertTriangle}
        label="Indisponíveis"
        loading={loading}
        tone="red"
        value={unavailable}
      />
    </section>
  );
}
