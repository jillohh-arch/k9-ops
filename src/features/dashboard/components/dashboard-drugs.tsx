import { cn } from "@/lib/utils";

import type { DrugStats, DrugTile } from "./dashboard-types";
import { formatCount, formatPercent, formatWeight, toneClasses } from "./dashboard-utils";

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
          <div className="min-w-[170px] rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-right shadow-[inset_0_0_24px_rgba(34,211,238,0.05),0_0_28px_rgba(34,211,238,0.06)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/60">
              Total apreendido
            </p>
            <p className="mt-1 font-mono text-3xl font-black leading-none text-cyan-300 drop-shadow-[0_0_14px_rgba(34,211,238,0.28)]">
              {isLoadingDrugs ? "..." : formatWeight(totalDrugGrams)}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {drugStatsError
                ? "Falha ao carregar"
                : `${activeDrugCategories} categorias`}
            </p>
          </div>
        </div>

        {visibleDrugTiles.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {visibleDrugTiles.map((tile) => {
              const grams = drugStats[tile.category];
              const share =
                totalDrugGrams > 0
                  ? Math.max(8, (grams / totalDrugGrams) * 100)
                  : 0;

              return (
                <div
                  className={cn(
                    "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-4",
                    tile.className,
                  )}
                  key={tile.label}
                >
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {tile.label}
                      </p>
                      <p className="mt-2 font-mono text-2xl font-black text-white">
                        {isLoadingDrugs ? "..." : formatWeight(grams)}
                      </p>
                    </div>
                    <DashboardGlyph
                      className="h-9 w-9 rounded-xl bg-black/12 text-[9px] text-cyan-100/70"
                      glyph={tile.glyph}
                      tone="cyan"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/28">
                      <div
                        className="h-full rounded-full bg-white/50 transition-all duration-500"
                        style={{ width: `${isLoadingDrugs ? 0 : share}%` }}
                      />
                    </div>
                    <span className="min-w-[42px] text-right font-mono text-[10px] font-bold text-white/70">
                      {isLoadingDrugs
                        ? "..."
                        : formatPercent(grams, totalDrugGrams)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-slate-500">
            Nenhuma apreensão registrada no período.
          </div>
        )}
      </article>
    </section>
  );
}
