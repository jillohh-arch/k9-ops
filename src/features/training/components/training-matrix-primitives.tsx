"use client";

import { cn } from "@/lib/utils";
import { progressWidth } from "./training-matrix-utils";

export function ProgressBar({
  className,
  value,
}: {
  className?: string;
  value: number;
}) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-slate-800">
      <span
        className={cn(
          "block h-full rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.42)]",
          className,
        )}
        style={{ width: progressWidth(value) }}
      />
    </span>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-cyan-200/15 bg-black/16 px-5 py-7 text-center text-sm text-slate-400">
      {label}
    </div>
  );
}
