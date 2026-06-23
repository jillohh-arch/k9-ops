/**
 * Side card rendered alongside the central HUD core.
 *
 * The card intentionally mirrors the structure used by the rest of the
 * dashboard (translucent background, thin border, monospaced number,
 * segmented share indicator) so it stays consistent with existing
 * components like `DashboardMetrics`.
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  cardBorderClass,
  cardGlyphBgClass,
  cardGlyphBorderClass,
  cardGlyphTextClass,
  formatPercent,
  formatWeight,
  segmentFillClass,
} from "./dashboard-utils";
import type { DrugDisplayItem } from "./dashboard-utils";

const SEGMENT_COUNT = 8;

export interface HudCardProps {
  item: DrugDisplayItem;
  /** Total grams used to compute the percentage indicator. */
  totalGrams: number;
  loading?: boolean;
  /** Optional slot rendered next to the title (e.g. an overflow badge). */
  trailing?: ReactNode;
  /** Slot ref registered by the parent for connection lines. */
  cardRef?: (node: HTMLElement | null) => void;
  /** Visual emphasis: primary cards are slightly larger. */
  emphasis?: "primary" | "secondary";
}

export function DashboardHudCard({
  item,
  totalGrams,
  loading = false,
  trailing,
  cardRef,
  emphasis = "primary",
}: HudCardProps) {
  const filledSegments = Math.round(
    Math.min(SEGMENT_COUNT, Math.max(0, (item.percent / 100) * SEGMENT_COUNT)),
  );

  const ariaLabel = loading
    ? "Carregando categoria"
    : `${item.name}: ${formatWeight(item.grams)}, ${formatPercent(
        item.grams,
        totalGrams,
      )} do total`;

  return (
    <article
      aria-label={ariaLabel}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-slate-950/60 shadow-[inset_0_0_22px_rgba(255,255,255,0.04),0_0_30px_rgba(0,0,0,0.35)]",
        "transition-colors duration-200 hover:bg-slate-950/80",
        cardBorderClass(item.tone),
        emphasis === "primary" ? "p-4" : "p-3",
      )}
      ref={cardRef}
    >
      {/* Corner detail */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-2 h-2 w-2 rounded-full border border-white/15 bg-white/5"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2 bottom-2 h-1 w-6 rounded-full bg-white/8"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-[0.22em] text-slate-300">
            {item.name}
          </p>
          <p
            className={cn(
              "mt-2 font-mono font-black leading-none text-white",
              emphasis === "primary" ? "text-3xl" : "text-2xl",
            )}
          >
            {loading ? "--" : formatWeight(item.grams)}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            {loading
              ? "carregando"
              : item.isAggregate
                ? "demais categorias"
                : "apreendido"}
          </p>
        </div>

        <div
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl border font-mono text-[10px] font-black uppercase tracking-[0.18em]",
            cardGlyphBgClass(item.tone),
            cardGlyphBorderClass(item.tone),
            cardGlyphTextClass(item.tone),
            emphasis === "primary" ? "h-10 w-10" : "h-8 w-8",
          )}
        >
          {item.glyph}
        </div>
      </div>

      {trailing ? <div className="mt-3">{trailing}</div> : null}

      {/* Segment share indicator + numeric percentage */}
      <div className="mt-3 flex items-center gap-2">
        <div
          aria-label={`${formatPercent(item.grams, totalGrams)} do total`}
          className="grid h-2 flex-1 gap-[3px]"
          role="meter"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(item.percent)}
          aria-valuetext={`${formatPercent(item.grams, totalGrams)} do total`}
          style={{ gridTemplateColumns: `repeat(${SEGMENT_COUNT}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: SEGMENT_COUNT }).map((_, index) => (
            <span
              aria-hidden="true"
              className={cn(
                "h-full rounded-sm transition-opacity duration-500",
                index < filledSegments
                  ? segmentFillClass(item.tone)
                  : "bg-white/8",
                loading && "opacity-40",
              )}
              key={`${item.id}-seg-${index}`}
            />
          ))}
        </div>
        <span className="min-w-[48px] text-right font-mono text-[11px] font-bold text-white/80">
          {loading ? "--" : formatPercent(item.grams, totalGrams)}
        </span>
      </div>
    </article>
  );
}