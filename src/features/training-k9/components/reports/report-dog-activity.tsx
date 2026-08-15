"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import type {
  DogActivity,
  SessionMetrics,
} from "../../types/training-reports";

interface DogWithPhoto {
  dogId: string;
  dogName: string;
  photoUrl: string | null;
}

interface ReportDogActivityProps {
  /** Dogs with progress, filtered by current modality. */
  activity: DogActivity[];
  /** Session metrics for session counts per dog. */
  sessionMetrics: SessionMetrics;
  /** Dogs from trainingK9 for photo lookup. */
  trainingDogs: DogWithPhoto[];
}

/** Format a date relative to today. */
function formatRelativeDate(date: Date | null): string {
  if (!date) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? "mês" : "meses"}`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} ${years === 1 ? "ano" : "anos"}`;
}

/** Format an absolute date for aria-label / sr-only text. */
function formatAbsoluteDate(date: Date | null): string {
  if (!date) return "sem data";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Get the activity status label and color variant.
 * Thresholds are mutually exclusive (checked smallest → largest). */
function getActivityStatus(activity: DogActivity): { label: string; variant: "recent" | "idle" | "warning" | "none" } {
  if (activity.neverTrained) {
    return { label: "Nenhuma sessão registrada", variant: "none" };
  }
  // 8–30 days: idle (checked BEFORE 30+ so this takes priority)
  if (activity.inactiveOver7Days && !activity.inactiveOver30Days) {
    return { label: "Sem atividade recente", variant: "idle" };
  }
  // 31+ days: attention (both flags true, or only 30+ flag)
  if (activity.inactiveOver30Days) {
    return { label: "Atenção à frequência", variant: "warning" };
  }
  // 0–7 days: recent
  return { label: "Atividade recente", variant: "recent" };
}

/** Status badge color classes. */
const statusStyles = {
  recent: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300/80",
  idle: "border-amber-400/20 bg-amber-400/5 text-amber-300/80",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-400/90",
  none: "border-amber-400/20 bg-amber-400/5 text-amber-300/80",
};

/** Sort: never trained first, then longest inactive, then most recent, name as tiebreaker. */
export function sortActivity(a: DogActivity, b: DogActivity): number {
  if (a.neverTrained && !b.neverTrained) return -1;
  if (!a.neverTrained && b.neverTrained) return 1;

  // Both never trained → alphabetical by name
  if (a.neverTrained && b.neverTrained) {
    return a.dogName.localeCompare(b.dogName, "pt-BR");
  }

  // Both trained → longest inactive first
  const aDays = a.daysSinceLastSession ?? 0;
  const bDays = b.daysSinceLastSession ?? 0;
  if (aDays !== bDays) return bDays - aDays;

  // Same inactivity → alphabetical by name
  return a.dogName.localeCompare(b.dogName, "pt-BR");
}

/** Dog avatar component (inline, no external file needed). */
function DogAvatar({ name, url, size = "sm" }: { name: string; url: string | null; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === "md" ? "h-12 w-12" : "h-10 w-10";

  if (!url || failed) {
    return (
      <div className={cn("flex shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-slate-800/60", sizeClass)}>
        <Image
          alt={name}
          className="object-contain p-1.5"
          height={size === "md" ? 44 : 36}
          src="/brand/logo-app.png"
          width={size === "md" ? 44 : 36}
        />
      </div>
    );
  }

  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl border border-cyan-300/15", sizeClass)}>
      <Image
        alt={name}
        className="object-cover"
        fill
        onError={() => setFailed(true)}
        sizes={size === "md" ? "48px" : "40px"}
        src={url}
      />
    </div>
  );
}

export function ReportDogActivity({
  activity,
  sessionMetrics,
  trainingDogs,
}: ReportDogActivityProps) {
  const sorted = [...activity].sort(sortActivity);

  const photoMap = new Map(trainingDogs.map((d) => [d.dogId, d]));

  const sessionCountPerDog = sessionMetrics.sessionsByDog ?? {};

  if (sorted.length === 0) {
    return (
      <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-cyan-300/5 bg-slate-900/20 p-4 text-center">
        <p className="text-xs text-slate-600">
          Não há cães com atividade para a modalidade e o período selecionados.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Atividade por cão" data-testid="report-dog-list">
      {sorted.map((dog) => {
        const photoDog = photoMap.get(dog.dogId);
        const sessions = sessionCountPerDog[dog.dogId] ?? 0;
        const status = getActivityStatus(dog);

        // Build modality labels from the modalities array
        const modalityLabels = (dog.modalities ?? [])
          .map((m) => canônicalModalityLabel(m))
          .join(" • ");

        // Build drill-down URL preserving current filters
        const drillDownHref = `/training/dogs/${dog.dogId}`;

        return (
          <li key={dog.dogId}>
            <div className="group relative flex items-center gap-3 rounded-xl border border-white/[0.035] bg-slate-900/30 p-3 transition hover:border-cyan-300/15 hover:bg-slate-900/50 sm:gap-4">
              {/* Photo */}
              <DogAvatar
                name={dog.dogName}
                size="sm"
                url={photoDog?.photoUrl ?? null}
              />

              {/* Main info */}
              <div className="min-w-0 flex-1">
                {/* Name + modality row */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate text-sm font-bold text-white" title={dog.dogName}>
                    {dog.dogName}
                  </span>
                  {modalityLabels && (
                    <span className="shrink-0 text-[11px] text-slate-500">
                      {modalityLabels}
                    </span>
                  )}
                </div>

                {/* Metrics row */}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 sm:gap-x-4">
                  <span>
                    <span className="font-semibold text-slate-300">{sessions}</span>{" "}
                    {sessions === 1 ? "sessão" : "sessões"}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span title={formatAbsoluteDate(dog.lastSessionAt)}>
                    {dog.neverTrained ? "Sem treino" : formatRelativeDate(dog.lastSessionAt)}
                  </span>
                </div>
              </div>

              {/* Status badge */}
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  statusStyles[status.variant],
                )}
                aria-label={`Situação: ${status.label}`}
              >
                {status.label}
              </span>

              {/* Drill-down link */}
              <Link
                className={cn(
                  "absolute inset-0 rounded-xl",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/50",
                )}
                href={drillDownHref}
                tabIndex={0}
                aria-label={`Ver jornada de ${dog.dogName}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
