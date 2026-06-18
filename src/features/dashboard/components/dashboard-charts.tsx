import {
  AlertCircle,
  BarChart3,
  FileSignature,
  Shield,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { IntegrityMetrics, OccurrenceMetrics, UserProfile } from "./dashboard-types";
import { formatCount, toneClasses } from "./dashboard-utils";

export interface DashboardChartsProps {
  userProfile: UserProfile;
  integrityMetrics: IntegrityMetrics;
  occurrenceMetrics: OccurrenceMetrics;
  readinessPercent: number;
  loading: boolean;
  error: string | null;
}

export function DashboardCharts({
  userProfile,
  integrityMetrics,
  occurrenceMetrics,
  readinessPercent,
  loading,
  error,
}: DashboardChartsProps) {
  if (userProfile !== "gestor" && userProfile !== "admin") {
    return null;
  }

  return (
    <section>
      <article className="overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex items-center gap-3 border-b border-white/8 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white">
              Painel de Gestão
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">
              Visão executiva para comandantes e gestores
            </p>
          </div>
          <Badge tone="green" className="ml-auto">
            Gestor
          </Badge>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
              <p className="text-sm font-semibold">Índice de Conformidade</p>
            </div>
            <p className="mt-3 font-mono text-3xl font-black text-white">
              {readinessPercent}%
            </p>
            <p className="mt-1 text-xs text-slate-400">prontidão operacional</p>
          </div>
          <div className="rounded-2xl border border-blue-400/20 bg-blue-400/[0.05] p-4">
            <div className="flex items-center gap-2 text-blue-300">
              <BarChart3 className="h-5 w-5" />
              <p className="text-sm font-semibold">Taxa de Finalização</p>
            </div>
            <p className="mt-3 font-mono text-3xl font-black text-white">
              {occurrenceMetrics.total > 0
                ? Math.round((occurrenceMetrics.finalized / occurrenceMetrics.total) * 100)
                : 0}%
            </p>
            <p className="mt-1 text-xs text-slate-400">ocorrências concluídas</p>
          </div>
          <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.05] p-4">
            <div className="flex items-center gap-2 text-violet-300">
              <Shield className="h-5 w-5" />
              <p className="text-sm font-semibold">Integridade</p>
            </div>
            <p className="mt-3 font-mono text-3xl font-black text-white">
              {new Intl.NumberFormat("pt-BR", {
                maximumFractionDigits: 0,
              }).format(integrityMetrics.coverage)}%
            </p>
            <p className="mt-1 text-xs text-slate-400">documentos selados</p>
          </div>
        </div>
        <div className="border-t border-white/8 px-5 py-4">
          <p className="text-xs text-slate-500">
            Acesse relatórios completos em{" "}
            <a href="/reports" className="text-cyan-300 hover:underline">
              Relatórios
            </a>{" "}
            para análises detalhadas.
          </p>
        </div>
      </article>
    </section>
  );
}
