"use client";

import {
  AlertTriangle,
  GraduationCap,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  K9_ROSTER_GROUP_LABEL,
  type K9RosterGroup,
} from "@/features/effective/lib/k9-roster-classification";
import { cn } from "@/lib/utils";

const groupMeta: Record<
  K9RosterGroup,
  { className: string; icon: typeof ShieldCheck }
> = {
  formation: { className: "text-amber-200", icon: GraduationCap },
  ready: { className: "text-emerald-200", icon: ShieldCheck },
  unavailable: { className: "text-red-200", icon: AlertTriangle },
  unclassified_active: { className: "text-slate-300", icon: HelpCircle },
};

export function K9RosterSection({
  children,
  count,
  group,
  viewMode,
}: {
  children: ReactNode;
  count: number;
  group: K9RosterGroup;
  viewMode: "grid" | "list";
}) {
  const meta = groupMeta[group];

  return (
    <section aria-labelledby={`roster-group-${group}`}>
      <div className="mb-3 flex items-center gap-2">
        <meta.icon aria-hidden className={cn("h-3.5 w-3.5 shrink-0", meta.className)} />
        <h2
          className={cn(
            "text-[11px] font-black uppercase tracking-[0.18em]",
            meta.className,
          )}
          id={`roster-group-${group}`}
        >
          {K9_ROSTER_GROUP_LABEL[group]}
        </h2>
        <span className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-400">
          {count}
        </span>
        {/* Régua discreta: separa a seção sem virar banner. */}
        <span
          aria-hidden
          className="ml-1 h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"
        />
      </div>
      {/*
        O máximo da trilha precisa ser flexível (`1fr`), não um pixel fixo:
        quando o máximo é definido, o CSS Grid usa esse valor para contar as
        repetições de `auto-fill`. Com `minmax(270px,320px)` o roster colapsava
        para uma única coluna sempre que o container ficava abaixo de ~640px —
        medido em 1440px com o drawer aberto (container de 635px gerava 1
        trilha de 320px e ~315px de vazio, com os cards empilhados).

        O teto de largura fica no card, via `max-w`, preservando a contagem de
        colunas e ainda impedindo o card de crescer indefinidamente.
      */}
      <div
        className={cn(
          "grid gap-3.5",
          viewMode === "grid"
            ? "grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(270px,1fr))] sm:[&>*]:max-w-[320px]"
            : "grid-cols-1",
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function K9RosterSkeleton() {
  return (
    <div aria-busy="true" className="space-y-5">
      <span className="sr-only">Carregando o efetivo K9...</span>
      {[0, 1].map((section) => (
        <div key={section}>
          <span
            aria-hidden
            className="mb-2.5 block h-3 w-44 animate-pulse rounded bg-white/10 motion-reduce:animate-none"
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <span
                aria-hidden
                className="block h-[150px] animate-pulse rounded-2xl border border-cyan-200/10 bg-white/[0.045] motion-reduce:animate-none"
                key={card}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
