import { type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: "cyan" | "green" | "yellow" | "red" | "slate";
  accent?: string;
};

const toneClasses = {
  cyan: "from-cyan-300/20 text-cyan-200 shadow-cyan-500/10",
  green: "from-emerald-400/20 text-emerald-300 shadow-emerald-500/10",
  yellow: "from-amber-300/20 text-amber-200 shadow-amber-500/10",
  red: "from-red-400/20 text-red-300 shadow-red-500/10",
  slate: "from-slate-400/15 text-slate-300 shadow-slate-500/10",
};

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "cyan",
  accent = "0%",
}: MetricCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-cyan-300/10 bg-slate-950/55 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/25">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent opacity-80",
          toneClasses[tone],
        )}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            {label}
          </p>
          <p className="mt-3 font-mono text-4xl font-black text-white">{value}</p>
        </div>
        <Badge tone={tone} className="rounded-2xl p-3 shadow-lg">
          <Icon className="h-5 w-5" />
        </Badge>
      </div>

      <p className="relative mt-4 min-h-10 text-sm leading-5 text-slate-400">
        {description}
      </p>

      <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 shadow-[0_0_22px_rgba(77,208,225,0.45)]"
          style={{ width: accent }}
        />
      </div>
    </article>
  );
}
