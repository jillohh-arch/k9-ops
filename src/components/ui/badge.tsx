import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "cyan" | "green" | "yellow" | "red" | "slate";

const tones: Record<BadgeTone, string> = {
  cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
  green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  yellow: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  red: "border-red-400/25 bg-red-400/10 text-red-300",
  slate: "border-slate-500/25 bg-slate-500/10 text-slate-300",
};

export function Badge({
  className,
  tone = "slate",
  ...props
}: React.ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
