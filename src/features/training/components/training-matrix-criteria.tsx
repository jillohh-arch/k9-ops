"use client";

import { CheckCircle2 } from "lucide-react";

import { Panel } from "@/components/form/form-primitives";
import { cn } from "@/lib/utils";

import type { CritérionStatus } from "./training-matrix-types";
import { gradientClasses, toneClasses } from "./training-matrix-constants";
import { ProgressBar } from "./training-matrix-primitives";
import { hasRealValue } from "./training-matrix-utils";

const glowClasses: Record<string, string> = {
  amber: "shadow-[0_0_24px_rgba(251,191,36,0.28)]",
  blue: "shadow-[0_0_24px_rgba(96,165,250,0.28)]",
  cyan: "shadow-[0_0_24px_rgba(34,211,238,0.28)]",
  emerald: "shadow-[0_0_24px_rgba(52,211,153,0.28)]",
  red: "shadow-[0_0_24px_rgba(248,113,113,0.28)]",
  slate: "",
  violet: "shadow-[0_0_24px_rgba(167,139,250,0.28)]",
};

export function CritérionCard({ criterion }: { criterion: CritérionStatus }) {
  const Icon = criterion.icon;
  const hasTarget = criterion.target && hasRealValue(criterion.target) && criterion.target !== "--";
  const borderTone = criterion.ok ? criterion.tone : "amber";

  return (
    <article
      className={cn(
        "rounded-[1.25rem] border p-4 transition",
        toneClasses[borderTone],
        criterion.ok && glowClasses[borderTone],
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
            toneClasses[criterion.ok ? criterion.tone : "amber"],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            {criterion.label}
          </p>
          <p className="mt-2 font-mono text-4xl font-black leading-none text-white">
            {hasRealValue(criterion.current) ? criterion.current : "—"}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">{criterion.detail}</p>
          <div className="mt-3">
            <ProgressBar
              className={cn(
                "h-2.5 bg-gradient-to-r",
                gradientClasses[criterion.ok ? criterion.tone : "amber"],
              )}
              value={criterion.progress}
            />
          </div>
          <p className="mt-2 text-xs">
            {hasTarget ? (
              <span className="text-emerald-300/70">
                Meta: {criterion.target}
              </span>
            ) : (
              <span className="text-slate-600">Sem meta</span>
            )}
          </p>
        </div>
      </div>
      {criterion.ok ? (
        <div className="mt-3 flex items-center gap-1.5 text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">Cumprido</span>
        </div>
      ) : null}
    </article>
  );
}

export function ReadinessSummary({
  isReady,
  score,
}: {
  isReady: boolean;
  score: number;
}) {
  return (
    <Panel title="Quando ficara apto">
      <div className="rounded-[1.5rem] border border-white/10 bg-black/18 p-8 text-center">
        <p className="font-mono text-5xl font-black text-white">
          {Math.round(score)}%
        </p>
        <p className="mt-3 text-sm text-slate-400">
          {isReady
            ? "Todos os critérios atendidos"
            : "Critérios pendentes para promoção"}
        </p>
        {isReady ? (
          <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100">
            <CheckCircle2 className="h-4 w-4" /> Apto para avançar
          </span>
        ) : null}
      </div>
    </Panel>
  );
}
