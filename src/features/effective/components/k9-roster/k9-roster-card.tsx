"use client";

import { Dog, UserRound } from "lucide-react";

import { EntityImage } from "@/features/effective/components/effective-ui";
import type { K9RosterGroup } from "@/features/effective/lib/k9-roster-classification";
import type { EffectiveDog } from "@/features/effective/hooks/use-effective-data";
import { cn } from "@/lib/utils";

export type K9RosterCardProps = {
  breed: string | null;
  dog: EffectiveDog;
  group: K9RosterGroup;
  handlerLabel: string | null;
  onSelect: (dogId: string) => void;
  restrictionNote?: string | null;
  selected: boolean;
  specialtyLabels: string[];
  statusLabel: string;
  viewMode: "grid" | "list";
};

/**
 * Cor nunca é o único sinal: cada tom vem sempre acompanhado do label textual
 * de status renderizado no corpo do card.
 */
const groupTones: Record<
  K9RosterGroup,
  { dot: string; pill: string }
> = {
  formation: {
    dot: "bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.75)]",
    pill: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  },
  ready: {
    dot: "bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.75)]",
    pill: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  },
  unavailable: {
    dot: "bg-red-300 shadow-[0_0_10px_rgba(248,113,113,0.7)]",
    pill: "border-red-300/25 bg-red-300/10 text-red-200",
  },
  unclassified_active: {
    dot: "bg-slate-400",
    pill: "border-slate-400/25 bg-slate-400/10 text-slate-300",
  },
};

const MAX_VISIBLE_SPECIALTIES = 3;

export function K9RosterCard({
  breed,
  dog,
  group,
  handlerLabel,
  onSelect,
  restrictionNote,
  selected,
  specialtyLabels,
  statusLabel,
  viewMode,
}: K9RosterCardProps) {
  const tone = groupTones[group];
  const visible = specialtyLabels.slice(0, MAX_VISIBLE_SPECIALTIES);
  const overflow = specialtyLabels.length - visible.length;

  return (
    <article
      aria-current={selected ? "true" : undefined}
      aria-label={`${dog.name} — ${statusLabel}`}
      className={cn(
        "group relative cursor-pointer rounded-2xl border border-cyan-200/12 bg-[#0b1628]/85 p-3 text-left shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition",
        "hover:border-cyan-300/30 hover:bg-[#0d1a2e]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
        "motion-reduce:transition-none",
        // Seleção: cyan discreto, glow sutil — nunca com cara de alerta.
        selected &&
          "border-cyan-300/50 bg-[#0c1e36]/90 shadow-[0_0_0_1px_rgba(34,211,238,0.28),0_0_24px_rgba(34,211,238,0.12),0_18px_50px_rgba(0,0,0,0.22)]",
        viewMode === "list" && "sm:flex sm:items-center sm:gap-4",
      )}
      onClick={() => onSelect(dog.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(dog.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-3 top-3 z-10 h-2 w-2 rounded-full",
          tone.dot,
        )}
      />

      <div className={cn("flex gap-3", viewMode === "list" && "sm:items-center sm:gap-4")}>
        {/* Foto com protagonismo como painel visual vertical à esquerda (~118px x 138px). */}
        <EntityImage
          alt={`Foto de ${dog.name}`}
          className="h-[138px] w-[118px] shrink-0 rounded-xl border border-white/10"
          fallback={Dog}
          src={dog.profileImageUrl}
        />
        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div>
            {/* Nome dominante em branco; status badge próximo ao nome. */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 truncate text-[17px] font-black leading-tight tracking-tight text-white">
                {dog.name}
              </h3>
              <span
                className={cn(
                  "inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold",
                  tone.pill,
                )}
              >
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 truncate text-xs font-medium text-slate-400">
              {breed ?? "Raça não informada"}
            </p>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-400">
              <UserRound aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="truncate">
                {handlerLabel ? `Op. ${handlerLabel}` : "Op. não vinculado"}
              </span>
            </p>
            {restrictionNote ? (
              <p className="mt-1 truncate text-[11px] font-medium text-red-200/85">
                {restrictionNote}
              </p>
            ) : null}
          </div>

          {visible.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {visible.map((label) => (
                <span
                  className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold text-slate-300"
                  key={label}
                >
                  {label}
                </span>
              ))}
              {overflow > 0 ? (
                <span
                  className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-1.5 py-0.5 text-[10px] font-bold text-cyan-200"
                  title={specialtyLabels.slice(MAX_VISIBLE_SPECIALTIES).join(", ")}
                >
                  +{overflow}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
