"use client";

export function NutritionPlanLoadingSkeleton() {
  return (
    <div
      data-testid="nutrition-plan-loading-skeleton"
      className="space-y-6 animate-pulse"
    >
      {/* Header skeleton */}
      <div className="rounded-[1.75rem] border border-cyan-200/12 bg-slate-950/72 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-slate-800" />
            <div className="h-7 w-64 rounded bg-slate-800" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded-full bg-slate-800" />
            <div className="h-8 w-28 rounded-full bg-slate-800" />
          </div>
        </div>
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-[1.25rem] border border-cyan-200/12 bg-slate-950/72 p-5"
          >
            <div className="h-3 w-24 rounded bg-slate-800" />
            <div className="mt-3 h-8 w-20 rounded bg-slate-800" />
            <div className="mt-2 h-3 w-32 rounded bg-slate-800/60" />
          </div>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="h-48 rounded-[1.5rem] border border-cyan-200/12 bg-slate-950/72 p-6">
            <div className="h-5 w-40 rounded bg-slate-800" />
            <div className="mt-4 space-y-3">
              <div className="h-10 w-full rounded bg-slate-800/50" />
              <div className="h-10 w-full rounded bg-slate-800/50" />
            </div>
          </div>
        </div>
        <div className="h-48 rounded-[1.5rem] border border-cyan-200/12 bg-slate-950/72 p-6">
          <div className="h-5 w-32 rounded bg-slate-800" />
          <div className="mt-4 h-24 w-full rounded bg-slate-800/50" />
        </div>
      </div>
    </div>
  );
}
