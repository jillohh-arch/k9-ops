import { cn } from "@/lib/utils";

import type { DrugStats, DrugTile } from "./dashboard-types";
import { toneClasses } from "./dashboard-utils";
import { DashboardDrugsHud } from "./dashboard-drugs-hud";

/* ─── DashboardGlyph ─── */

function DashboardGlyph({
  glyph,
  tone,
  className,
}: {
  glyph: string;
  tone?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border font-mono text-[11px] font-black uppercase tracking-[0.14em] shadow-[inset_0_0_22px_rgba(255,255,255,0.04)]",
        toneClasses(tone ?? "cyan"),
        className,
      )}
    >
      <span className="absolute inset-2 rounded-xl border border-current/18" />
      <span className="absolute -right-3 -top-3 h-8 w-8 rounded-full bg-current/10 blur-md" />
      <span className="relative">{glyph}</span>
    </span>
  );
}

export { DashboardGlyph };

/* ─── DashboardDrugs ─── */

export interface DashboardDrugsProps {
  drugStats: DrugStats;
  totalDrugGrams: number;
  activeDrugCategories: number;
  visibleDrugTiles: DrugTile[];
  isLoadingDrugs: boolean;
  drugStatsError: string | null;
}

export function DashboardDrugs({
  drugStats,
  totalDrugGrams,
  activeDrugCategories,
  visibleDrugTiles,
  isLoadingDrugs,
  drugStatsError,
}: DashboardDrugsProps) {
  // The HUD composes itself from the raw `drugStats`. The
  // `visibleDrugTiles` list is forwarded as a stable category ordering
  // so the layout matches the original "active categories" sequence
  // (maconha, cocaina, crack, ecstasy, outros).
  const categoryOrder = visibleDrugTiles.map((tile) => tile.category);

  return (
    <section className="grid items-start gap-4 2xl:grid-cols-[1.35fr_0.95fr]">
      <article className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h2 className="text-lg font-bold text-white">
              Drogas apreendidas por tipo
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Distribuição total de apreensões no período selecionado.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-cyan-300/20 bg-cyan-300/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/70 shadow-[inset_0_0_18px_rgba(34,211,238,0.05)]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.7)]"
            />
            {drugStatsError
              ? "Falha ao carregar"
              : isLoadingDrugs
                ? "Sincronizando"
                : "Sistema online"}
          </div>
        </div>

        <DashboardDrugsHud
          activeDrugCategories={activeDrugCategories}
          categoryOrder={categoryOrder}
          drugStats={drugStats}
          error={drugStatsError}
          loading={isLoadingDrugs}
          totalDrugGrams={totalDrugGrams}
        />
      </article>
    </section>
  );
}