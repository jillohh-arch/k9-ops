import Image from "next/image";

import { cn } from "@/lib/utils";

import type { SummaryCardData } from "./dashboard-types";

export interface DashboardMetricsProps {
  cards: SummaryCardData[];
}

export function DashboardMetrics({ cards }: DashboardMetricsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {cards.map((card) => (
        <article
          className="relative min-h-[154px] overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 pr-28 shadow-[0_24px_80px_rgba(0,0,0,0.26)]"
          key={card.label}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(77,208,225,0.12),transparent_34%)]" />
          <div
            className={cn(
              "pointer-events-none absolute opacity-50 mix-blend-screen [filter:drop-shadow(0_0_28px_rgba(34,211,238,0.24))] [mask-image:linear-gradient(90deg,transparent,transparent_8%,black_34%,black_92%,transparent)]",
              card.imageClassName,
            )}
          >
            <Image
              alt=""
              className="object-contain object-right-bottom"
              fill
              priority={card.collection === "dogs"}
              sizes="220px"
              src={card.image}
              unoptimized
            />
          </div>
          <div className="relative z-10">
            <p className="font-semibold text-slate-100">{card.label}</p>
            <p className="mt-7 font-mono text-4xl font-black text-white">
              {card.value}
            </p>
            <p className="mt-2 text-sm text-slate-400">{card.detail}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
