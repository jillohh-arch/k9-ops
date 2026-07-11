"use client";

import { cn } from "@/lib/utils";

export function TrainingK9Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            className="h-32 rounded-2xl border border-cyan-300/5 bg-slate-900/40"
            key={i}
          />
        ))}
      </div>

      {/* Content area */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-2xl border border-cyan-300/5 bg-slate-900/40" />
        <div className="h-72 rounded-2xl border border-cyan-300/5 bg-slate-900/40" />
      </div>
    </div>
  );
}

export function TrainingK9Empty({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-cyan-200/8 bg-slate-950/50 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/5">
        <svg
          className="h-7 w-7 text-cyan-300/50"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-bold text-white">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-400">{description}</p>
    </div>
  );
}

export function TrainingK9Error({
  errors,
  onRetry,
}: {
  errors: string[];
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6">
      <h3 className="text-sm font-bold text-red-300">
        Erro ao carregar dados de treinamento
      </h3>
      <ul className="mt-2 space-y-1">
        {errors.map((error, i) => (
          <li className="text-xs text-red-300/80" key={i}>
            {error}
          </li>
        ))}
      </ul>
      {onRetry ? (
        <button
          className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-1.5 text-xs font-bold text-red-200 transition hover:bg-red-400/20"
          onClick={onRetry}
          type="button"
        >
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}

interface TabPlaceholderProps {
  className?: string;
  tabLabel: string;
}

export function TabPlaceholder({ className, tabLabel }: TabPlaceholderProps) {
  return (
    <div
      className={cn(
        "flex min-h-64 items-center justify-center rounded-2xl border border-cyan-200/8 bg-slate-950/40",
        className,
      )}
    >
      <p className="text-sm text-slate-500">
        Conteúdo da aba <span className="font-bold text-slate-300">{tabLabel}</span> será implementado na próxima etapa.
      </p>
    </div>
  );
}
