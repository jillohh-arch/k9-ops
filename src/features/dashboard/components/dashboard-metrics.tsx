"use client";

import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import { HudAnimatedCount } from "@/components/hud-animated-count";
import { formatCount } from "./dashboard-utils";

import type { SummaryCardData } from "./dashboard-types";

export interface DashboardMetricsProps {
  cards: SummaryCardData[];
}

const CARD_STAGGER = 0.06;
const CARD_ENTRY = { duration: 0.3, ease: [0.215, 0.61, 0.355, 1] as const };

export function DashboardMetrics({ cards }: DashboardMetricsProps) {
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion ?? false;

  const container: Variants = reduced
    ? { animate: {} }
    : {
        animate: {
          transition: { staggerChildren: CARD_STAGGER },
        },
      };

  const item: Variants = reduced
    ? { animate: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: CARD_ENTRY,
      };

  return (
    <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      <motion.div
        className="contents"
        variants={container}
        initial="initial"
        animate="animate"
      >
        {cards.map((card) => (
          <motion.article
            className="relative min-h-[154px] overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 pr-28 shadow-[0_24px_80px_rgba(0,0,0,0.26)]"
            key={card.label}
            variants={item}
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
                {card.value === "..." ? "--" : (
                  <HudAnimatedCount
                    value={card.rawValue}
                    format={formatCount}
                    className="font-mono text-4xl font-black"
                  />
                )}
              </p>
              <p className="mt-2 text-sm text-slate-400">{card.detail}</p>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
