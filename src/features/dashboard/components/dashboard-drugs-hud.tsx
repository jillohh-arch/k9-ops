"use client";

/**
 * Top-level HUD composition that renders the central ring, the side
 * cards and the decorative connections. The composition adapts to the
 * number of available categories:
 *
 *   - 0 categories: empty-state message
 *   - 1 category:   one card on the left of the ring
 *   - 2 categories: one card on each side
 *   - 3 categories: classic 1+1+1 layout
 *   - 4+ categories: top 3 + a compact "+N categorias" badge
 *
 * The DOM measurement logic lives in `DashboardHudConnections`; this
 * file owns the React state for the connection registry and the
 * decorative HUD backdrop (radial halo, grid, corner ticks).
 */

import { Children, isValidElement, useMemo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { DashboardHudCard } from "./dashboard-hud-card";
import {
  DashboardHudConnections,
  useHudElementRegistry,
  type HudConnection,
} from "./dashboard-hud-connections";
import { DashboardHudCore, type HudCoreSegment } from "./dashboard-hud-core";
import type { DrugCategory } from "./dashboard-types";
import {
  buildDrugDisplayItems,
  formatPercent,
  formatWeight,
  HUD_PRIMARY_SLOTS,
  type DrugDisplayItem,
  type DrugStats,
} from "./dashboard-utils";

/** Opacity of the dark overlay on top of the background image.
 *  Lower = more image visible. Adjust to calibrate without touching logic. */
const BG_OVERLAY_OPACITY = 0.5;

export interface DashboardDrugsHudProps {
  drugStats: DrugStats;
  /** Total grams already computed by the dashboard page. */
  totalDrugGrams: number;
  /** Number of active categories (counted by the page). */
  activeDrugCategories: number;
  /** Optional override: ordered list of categories. When omitted,
   *  every category present in `drugStats` is considered. */
  categoryOrder?: readonly DrugCategory[];
  loading?: boolean;
  error?: string | null;
}



interface BadgeProps {
  children: ReactNode;
  tone: "cyan" | "amber";
}

function OverflowBadge({ children, tone }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.2em]",
        tone === "cyan"
          ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
          : "border-amber-300/30 bg-amber-300/10 text-amber-200",
      )}
    >
      {children}
    </span>
  );
}

export function DashboardDrugsHud({
  drugStats,
  totalDrugGrams,
  activeDrugCategories,
  categoryOrder,
  loading = false,
  error = null,
}: DashboardDrugsHudProps) {
  const summary = useMemo(
    () => buildDrugDisplayItems({ categoryOrder, drugStats }),
    [categoryOrder, drugStats],
  );

  const { cardNodes, coreNode, registerCore, registerSource } =
    useHudElementRegistry();

  const segments: HudCoreSegment[] = summary.items.map((item) => ({
    label: item.name,
    percent: item.percent,
    tone: item.tone,
  }));

  const connectionList = useMemo<HudConnection[]>(
    () =>
      summary.items.slice(0, HUD_PRIMARY_SLOTS).map((item) => ({
        id: item.id,
        tone: item.tone,
      })),
    [summary.items],
  );

  if (summary.items.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-slate-500">
        {error
          ? "Falha ao carregar apreensões."
          : "Nenhuma apreensão registrada no período."}
      </div>
    );
  }

  const maconha = summary.items.find((item) => item.id === "maconha");
  const cocaina = summary.items.find((item) => item.id === "cocaina");
  const crack = summary.items.find((item) => item.id === "crack");
  
  const others = summary.items.filter(
    (item) => item.id !== "maconha" && item.id !== "cocaina" && item.id !== "crack"
  );
  
  let left: DrugDisplayItem | null = null;
  const right: DrugDisplayItem[] = [];

  if (maconha) {
    left = maconha;
  } else if (others.length > 0) {
    left = others.shift()!;
  } else if (cocaina) {
    left = cocaina;
  } else if (crack) {
    left = crack;
  }

  if (cocaina && cocaina !== left) {
    right.push(cocaina);
  }
  if (crack && crack !== left) {
    right.push(crack);
  }
  
  for (const item of others) {
    if (item !== left) {
      right.push(item);
    }
  }

  const totalForDisplay = totalDrugGrams > 0 ? totalDrugGrams : summary.totalGrams;

  const leftCard = left ? (
    <DashboardHudCard
      cardRef={registerSource(left.id)}
      emphasis="primary"
      item={left}
      loading={loading}
      totalGrams={totalForDisplay}
    />
  ) : null;

  const rightCards = right.map((item, index) => (
    <DashboardHudCard
      cardRef={registerSource(item.id)}
      emphasis={index === 0 && summary.items.length >= 3 ? "primary" : "secondary"}
      item={item}
      key={item.id}
      loading={loading}
      totalGrams={totalForDisplay}
      trailing={
        item.isAggregate && summary.overflowCount > 0 ? (
          <OverflowBadge tone="cyan">+{summary.overflowCount}</OverflowBadge>
        ) : null
      }
    />
  ));

  return (
    <div className="relative mt-5 overflow-hidden rounded-3xl border border-cyan-200/12 bg-slate-950/65 p-5">
      {/* Layer 1 — Background image fills the full rectangular card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          backgroundImage: `url("/assets/bg_drogas.png")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          zIndex: 0,
        }}
      />
      {/* Layer 2 — Dark blue overlay controls how much the image shows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          backgroundImage: `radial-gradient(ellipse at center,
            rgba(2, 8, 20, ${Math.min(1, BG_OVERLAY_OPACITY + 0.08)}) 20%,
            rgba(2, 8, 20, ${BG_OVERLAY_OPACITY}) 55%,
            rgba(2, 8, 20, ${Math.max(0, BG_OVERLAY_OPACITY - 0.15)}) 100%)`,
          zIndex: 1,
        }}
      />
      {/* Connection lines (absolute, beneath the cards/core) */}
      <div className="absolute inset-0 z-0">
        <DashboardHudConnections
          cardNodes={cardNodes}
          connections={connectionList}
          coreNode={coreNode}
        />
      </div>

      {/* Main composition grid */}
      <div
        className={cn(
          "relative z-10 grid min-h-[360px] items-center gap-x-5 gap-y-5",
          "lg:[grid-template-columns:minmax(290px,1fr)_288px_minmax(290px,1fr)]",
          "md:[grid-template-columns:minmax(220px,1fr)_288px_minmax(220px,1fr)]",
          "grid-cols-1",
        )}
      >
        <div className="order-2 flex items-center justify-center md:order-1 md:justify-end">
          <div className="w-full max-w-[320px]">{leftCard}</div>
        </div>

        <div className="order-1 flex items-center justify-center md:order-2">
          <DashboardHudCore
            categoryCount={Math.max(activeDrugCategories, summary.categoryCount)}
            coreRef={registerCore}
            loading={loading || Boolean(error)}
            segments={segments}
            size={288}
            totalLabel={loading || error ? "--" : formatWeight(totalForDisplay)}
            unit={loading || error ? "" : primaryUnit(totalForDisplay)}
          />
        </div>

        <div
          className={cn(
            "order-3 flex flex-col gap-3",
            rightCards.length > 1 && "md:gap-4",
          )}
        >
          {rightCards.length > 0 ? (
            Children.map(rightCards, (card, index) => (
              <div
                className={cn(
                  "w-full",
                  index === 0 ? "max-w-[320px]" : "max-w-[310px]",
                )}
                key={isValidElement(card) ? card.key : `right-${index}`}
              >
                {card}
              </div>
            ))
          ) : (
            <div
              aria-hidden="true"
              className="hidden h-full min-h-[120px] rounded-2xl border border-dashed border-white/8 md:block"
            />
          )}
        </div>
      </div>

      <span className="sr-only">
        {loading
          ? "Carregando distribuição de apreensões"
          : `Total apreendido ${formatWeight(totalForDisplay)}, ${formatPercent(
              totalForDisplay,
              totalForDisplay,
            )} do total. ${summary.categoryCount} categorias representadas, das quais ${summary.items.length} exibidas com ${
              summary.hasOverflow ? `+${summary.overflowCount} demais categorias` : "sem excedente"
            }.`}
      </span>
    </div>
  );
}

function primaryUnit(grams: number): string {
  if (grams <= 0) return "g";
  return grams < 1000 ? "g" : "kg";
}