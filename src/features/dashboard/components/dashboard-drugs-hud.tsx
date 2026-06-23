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
 * file owns the React state for the connection registry.
 */

import { useMemo, type ReactNode } from "react";

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

/**
 * Splits the HUD items into left and right slots.
 *
 * With 1 or 2 items, the items occupy the left column (item 0) and the
 * right column (item 1). With 3+ items, the left side holds the
 * top-ranked category and the right side stacks the rest.
 */
function splitLayout(items: DrugDisplayItem[]) {
  const safeItems = items.slice(0, HUD_PRIMARY_SLOTS + 1);
  if (safeItems.length === 0) {
    return { left: null, right: [] as DrugDisplayItem[] };
  }
  if (safeItems.length === 1) {
    return { left: safeItems[0] ?? null, right: [] };
  }
  return {
    left: safeItems[0] ?? null,
    right: safeItems.slice(1),
  };
}

interface BadgeProps {
  children: ReactNode;
  tone: "cyan" | "amber";
}

function OverflowBadge({ children, tone }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.18em]",
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

  const { left, right } = splitLayout(summary.items);
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
    <div className="relative mt-4">
      <DashboardHudConnections
        cardNodes={cardNodes}
        className="z-0"
        connections={connectionList}
        coreNode={coreNode}
      />

      <div className="relative z-10 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="flex justify-center md:justify-end">{leftCard}</div>

        <div className="flex justify-center">
          <DashboardHudCore
            categoryCount={Math.max(activeDrugCategories, summary.categoryCount)}
            coreRef={registerCore}
            loading={loading || Boolean(error)}
            segments={segments}
            totalLabel={loading || error ? "--" : formatWeight(totalForDisplay)}
            unit={loading || error ? "" : primaryUnit(totalForDisplay)}
          />
        </div>

        <div
          className={cn(
            "flex flex-col gap-3",
            rightCards.length > 1 && "md:gap-4",
          )}
        >
          {rightCards.length > 0 ? (
            rightCards
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

/**
 * Lightweight helper used only to surface the unit ("g" / "kg") below
 * the total. Lives here instead of `formatWeight` because the HUD wants
 * the unit separately from the formatted number.
 */
function primaryUnit(grams: number): string {
  if (grams <= 0) return "g";
  return grams < 1000 ? "g" : "kg";
}