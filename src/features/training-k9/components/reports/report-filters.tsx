"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import { cn } from "@/lib/utils";

import {
  REPORT_PERIOD_OPTIONS,
  DEFAULT_REPORT_PERIOD,
  type TrainingReportPeriod,
} from "../../types/training-reports";

interface ReportFiltersProps {
  availableModalities: string[];
  /**
   * True when the modality list is stable and authoritative. When false,
   * the filters trust whatever the URL says (modality stays selected
   * even if it isn't in the list yet).
   */
  modalityListReady?: boolean;
  /** Called when user selects a new period. */
  onPeriodChange: (period: TrainingReportPeriod) => void;
  /** Called when user selects a new modality (null = all). */
  onModalityChange: (modality: string | null) => void;
}

/**
 * Validate the URL params and return true if normalization is needed.
 * - Invalid period is silently rewritten to the default (no param).
 * - Invalid modality is silently removed (after the modality list is stable).
 */

export function ReportFilters({
  availableModalities,
  modalityListReady = true,
  onPeriodChange,
  onModalityChange,
}: ReportFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawPeriod = searchParams.get("reportPeriod");
  const rawModality = searchParams.get("reportModality");

  const activePeriod: TrainingReportPeriod = REPORT_PERIOD_OPTIONS.some(
    (o) => o.value === rawPeriod,
  )
    ? (rawPeriod as TrainingReportPeriod)
    : DEFAULT_REPORT_PERIOD;

  // Only honor a URL modality as "active" if:
  //   - it's null; OR
  //   - it's in the available list; OR
  //   - the list is not yet stable (e.g. base data still loading).
  // This prevents the select from snapping back to "all" during the
  // initial render when the modality list is still empty.
  const activeModality =
    !rawModality ||
    availableModalities.includes(rawModality) ||
    !modalityListReady
      ? rawModality
      : null;

  // ── Normalize invalid URL params silently (no new history entry) ────────
  // - Period: always authoritative (static list). Invalid → drop param.
  // - Modality: only normalize after the modality list has stabilized.
  //   During initial loading, availableModalities may be empty or partial
  //   — we must NOT strip a valid-looking URL modality just because the
  //   provider hasn't loaded its canonical list yet.
  const lastNormalizedRef = useRef<string | null>(null);
  useEffect(() => {
    // Period normalization (always safe)
    const periodInvalid =
      !!rawPeriod &&
      !REPORT_PERIOD_OPTIONS.some((o) => o.value === rawPeriod);

    // Modality normalization requires a stable list
    const modalityListReady = availableModalities.length > 0;
    const modalityInvalid =
      modalityListReady &&
      !!rawModality &&
      !availableModalities.includes(rawModality);

    if (!periodInvalid && !modalityInvalid) return;

    const fingerprint = `${rawPeriod ?? ""}|${rawModality ?? ""}|${availableModalities.join(",")}`;
    if (lastNormalizedRef.current === fingerprint) return;
    lastNormalizedRef.current = fingerprint;

    const params = new URLSearchParams(searchParams.toString());
    if (periodInvalid) params.delete("reportPeriod");
    if (modalityInvalid) params.delete("reportModality");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPeriod, rawModality, availableModalities.join("|")]);

  // ── Push to history when the user changes a filter ──────────────────────
  const pushParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      // push (not replace) so each filter change creates a new history entry
      // that the browser's back/forward buttons can navigate to.
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const handlePeriodChange = useCallback(
    (value: string) => {
      const next: TrainingReportPeriod = value as TrainingReportPeriod;
      const urlValue = next === DEFAULT_REPORT_PERIOD ? null : next;
      pushParam("reportPeriod", urlValue);
      onPeriodChange(next);
    },
    [pushParam, onPeriodChange],
  );

  const handleModalityChange = useCallback(
    (value: string) => {
      const next = value === "all" ? null : value;
      pushParam("reportModality", next);
      onModalityChange(next);
    },
    [pushParam, onModalityChange],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <label
          className="text-xs font-bold uppercase tracking-wider text-slate-500"
          htmlFor="report-period"
        >
          Período
        </label>
        <select
          aria-label="Filtrar por período"
          className={cn(
            "h-9 appearance-none rounded-xl border border-white/10 bg-white/[0.035] px-3",
            "text-sm font-semibold text-slate-100 outline-none transition",
            "focus:border-cyan-300/35",
            "cursor-pointer",
          )}
          id="report-period"
          onChange={(e) => handlePeriodChange(e.target.value)}
          value={activePeriod}
        >
          {REPORT_PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Modality selector */}
      <div className="flex items-center gap-2">
        <label
          className="text-xs font-bold uppercase tracking-wider text-slate-500"
          htmlFor="report-modality"
        >
          Modalidade
        </label>
        <select
          aria-label="Filtrar por modalidade"
          className={cn(
            "h-9 appearance-none rounded-xl border border-white/10 bg-white/[0.035] px-3",
            "text-sm font-semibold text-slate-100 outline-none transition",
            "focus:border-cyan-300/35",
            "cursor-pointer",
          )}
          id="report-modality"
          onChange={(e) => handleModalityChange(e.target.value)}
          value={activeModality ?? "all"}
        >
          <option value="all">Todas as modalidades</option>
          {availableModalities.map((mod) => (
            <option key={mod} value={mod}>
              {canônicalModalityLabel(mod)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────────

export function ReportFiltersSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="h-3 w-12 animate-pulse rounded bg-slate-700" />
        <div className="h-9 w-36 animate-pulse rounded-xl border border-white/5 bg-slate-800" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 w-16 animate-pulse rounded bg-slate-700" />
        <div className="h-9 w-52 animate-pulse rounded-xl border border-white/5 bg-slate-800" />
      </div>
    </div>
  );
}