"use client";

import { cn } from "@/lib/utils";

interface ReportSectionShellProps {
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Custom message for the empty (non-pending) state. */
  emptyMessage?: string;
  /** Show a "coming soon" badge and placeholder instead of children. */
  pending?: boolean;
  title: string;
}

export function ReportSectionShell({
  action,
  children,
  className,
  emptyMessage = "Nenhum dado disponível para os filtros selecionados.",
  pending = false,
  title,
}: ReportSectionShellProps) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-cyan-200/10 bg-slate-950/60 p-5",
        "shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {pending && (
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300/70">
              Próxima etapa
            </span>
          )}
          {action}
        </div>
      </div>

      {/* Content */}
      {pending ? (
        <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-cyan-300/10 bg-slate-900/20 p-6 text-center">
          <p className="text-sm font-semibold text-slate-400">{title}</p>
          <p className="mt-1 text-xs text-slate-600">
            Será detalhado em etapa futura.
          </p>
        </div>
      ) : children ? (
        children
      ) : (
        <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-cyan-300/5 bg-slate-900/20 p-4 text-center">
          <p className="text-xs text-slate-600">{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}
