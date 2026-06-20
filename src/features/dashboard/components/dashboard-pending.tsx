import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  Clock3,
  FileSignature,
  GraduationCap,
  ListChecks,
  RefreshCw,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { PendingMetrics } from "./dashboard-types";
import { formatCount, toneClasses } from "./dashboard-utils";

export interface PendingItem {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: string;
  loading: boolean;
  error: string | null;
}

export interface DashboardPendingProps {
  items: PendingItem[];
}

export function DashboardPending({ items }: DashboardPendingProps) {
  return (
    <article className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center">
          <Image
            src="/assets/icones/pendencias.png"
            alt="Pendências e ações"
            width={48}
            height={48}
            className="h-10 w-10 object-contain"
            unoptimized
          />
        </span>
        <div>
          <h2 className="text-lg font-bold text-white">
            Pendências e ações
          </h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Itens que precisam de atenção agora.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((pending) => (
          <div
            className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4"
            key={pending.label}
          >
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                toneClasses(pending.tone),
              )}
            >
              <pending.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-bold text-white">
                  {pending.label}
                </p>
                <span className="font-mono text-2xl font-black text-white">
                  {pending.loading
                    ? "..."
                    : pending.error
                      ? "--"
                      : formatCount(pending.value)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {pending.error ? "dados indisponíveis" : pending.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Pendências pessoais respeitam as permissões do usuário logado.
        Indicadores de ocorrência representam toda a unidade.
      </p>
    </article>
  );
}
