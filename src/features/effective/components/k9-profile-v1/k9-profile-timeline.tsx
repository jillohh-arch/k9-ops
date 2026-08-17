"use client";

import {
  Activity,
  FileText,
  HeartPulse,
  Scale,
  ShieldCheck,
  Target,
  type LucideIcon,
} from "lucide-react";

import {
  K9_ACTIVITY_LABEL,
  type K9ActivityCategory,
  type K9ActivityItem,
} from "@/features/effective/lib/k9-profile-activity";
import { cn } from "@/lib/utils";

/**
 * Apresentação compartilhada da timeline do Perfil.
 *
 * Usada tanto pelas "Atividades recentes" (Visão Geral) quanto pelo Histórico,
 * para que marcador, ícone e cor de categoria não divirjam entre as duas
 * superfícies.
 *
 * Esta camada é só visual: fonte, categoria, timestamp e ordenação chegam
 * prontos de `buildK9Activity()` e não são reinterpretados aqui.
 */

export const CATEGORY_ICON: Record<K9ActivityCategory, LucideIcon> = {
  document: FileText,
  health: HeartPulse,
  occurrence: ShieldCheck,
  specialty: Target,
  training: Activity,
  weight: Scale,
};

/** Cores discretas e semânticas; sempre acompanhadas do rótulo textual. */
export const CATEGORY_TONE: Record<K9ActivityCategory, string> = {
  document: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  health: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  occurrence: "border-red-300/20 bg-red-300/10 text-red-200",
  specialty: "border-violet-300/20 bg-violet-300/10 text-violet-200",
  training: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  weight: "border-blue-300/20 bg-blue-300/10 text-blue-200",
};

const CATEGORY_CHIP: Record<K9ActivityCategory, string> = {
  document: "border-amber-300/20 bg-amber-300/[0.07] text-amber-200/90",
  health: "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200/90",
  occurrence: "border-red-300/20 bg-red-300/[0.07] text-red-200/90",
  specialty: "border-violet-300/20 bg-violet-300/[0.07] text-violet-200/90",
  training: "border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-200/90",
  weight: "border-blue-300/20 bg-blue-300/[0.07] text-blue-200/90",
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function K9ActivityTimeline({
  items,
  variant = "full",
}: {
  items: readonly K9ActivityItem[];
  /**
   * `compact` é o resumo da Visão Geral (marcador menor, sem ícone);
   * `full` é o Histórico (medalhão com ícone por categoria).
   */
  variant?: "compact" | "full";
}) {
  const compact = variant === "compact";

  return (
    <ol
      className={cn(
        // A linha vertical corre atrás dos marcadores; `before` é decorativo.
        "relative before:absolute before:top-2 before:w-px before:bg-gradient-to-b before:from-cyan-300/25 before:via-cyan-300/12 before:to-transparent",
        compact
          ? "space-y-3 before:bottom-2 before:left-[5px]"
          : "space-y-3.5 before:bottom-3 before:left-[15px]",
      )}
    >
      {items.map((item) => {
        const Icon = CATEGORY_ICON[item.category];
        return (
          <li className="relative flex gap-3" key={item.id}>
            {compact ? (
              <span
                aria-hidden
                className={cn(
                  "z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#0b1628] ring-1",
                  item.category === "health" && "bg-emerald-300 ring-emerald-300/40",
                  item.category === "weight" && "bg-blue-300 ring-blue-300/40",
                  item.category === "training" && "bg-cyan-300 ring-cyan-300/40",
                  item.category === "occurrence" && "bg-red-300 ring-red-300/40",
                  item.category === "document" && "bg-amber-300 ring-amber-300/40",
                  item.category === "specialty" && "bg-violet-300 ring-violet-300/40",
                )}
              />
            ) : (
              <span
                aria-hidden
                className={cn(
                  "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                  CATEGORY_TONE[item.category],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            )}

            <div
              className={cn(
                "min-w-0 flex-1",
                compact ? "pb-0.5" : "border-b border-white/[0.05] pb-3.5",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 text-[13px] font-bold leading-snug text-slate-100">
                  {item.title}
                </p>
                {/* Chip de categoria: quebra para a linha seguinte no mobile. */}
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold",
                    CATEGORY_CHIP[item.category],
                  )}
                >
                  {K9_ACTIVITY_LABEL[item.category]}
                </span>
              </div>
              <p className="mt-0.5 break-words text-[11px] leading-relaxed text-slate-400">
                {item.detail}
              </p>
              <p className="mt-1 font-mono text-[10px] text-slate-500">
                {dateTimeFormatter.format(item.date)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
