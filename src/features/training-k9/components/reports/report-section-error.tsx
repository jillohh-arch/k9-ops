"use client";

interface ReportSectionErrorProps {
  /** Error title. */
  title: string;
  /** Description when no stale data is available. */
  description: string;
  /** Description when stale data from a previous filter may still be visible. */
  staleDescription?: string;
  /** True when previous data is still rendered alongside this error. */
  hasStaleData?: boolean;
  /** Retry action. */
  onRetry: () => void;
  /** Label for the retry button. */
  retryLabel?: string;
}

/**
 * Compact error indicator for a specific report section.
 * Does not replace the entire tab — shows inline within the section shell.
 */
export function ReportSectionError({
  title,
  description,
  staleDescription,
  hasStaleData = false,
  onRetry,
  retryLabel = "Tentar novamente",
}: ReportSectionErrorProps) {
  const displayDescription = hasStaleData && staleDescription
    ? staleDescription
    : description;

  return (
    <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
      <h3 className="text-xs font-bold text-amber-300">
        {title}
      </h3>
      <p className="mt-1 text-[11px] text-amber-300/70">
        {displayDescription}
      </p>
      <button
        className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-200 transition hover:bg-amber-400/20"
        onClick={onRetry}
        type="button"
      >
        {retryLabel}
      </button>
    </div>
  );
}
