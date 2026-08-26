"use client";

import Link from "next/link";
import { Archive, CircleAlert, RefreshCw } from "lucide-react";

import { paths } from "@/lib/routes/paths";

/**
 * Aviso de conflito de concorrência (Human Edit V1).
 *
 * Decisão congelada: SEM reload silencioso, SEM merge automático, SEM retry.
 * O rascunho do operador permanece na tela e intocado; recarregar a versão
 * atual é uma escolha explícita que substitui o que foi digitado.
 */
export function HumanEditConflictNotice({ onReload }: { onReload: () => void }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4 sm:flex-row sm:items-start"
      role="alert"
    >
      <CircleAlert
        aria-hidden
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-200"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-amber-100">
          Este cadastro foi alterado enquanto você estava editando.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
          Suas alterações continuam nesta tela e não foram enviadas. Nada foi
          sobrescrito automaticamente. Para continuar, revise a versão atual — o
          recarregamento substitui o que você digitou.
        </p>
      </div>
      <button
        className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-300/30 px-4 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
        onClick={onReload}
        type="button"
      >
        <RefreshCw aria-hidden className="h-3.5 w-3.5" />
        Revisar versão atual
      </button>
    </div>
  );
}

/**
 * Estado arquivado/inativo: o formulário não é renderizado. Restauração é
 * responsabilidade de outro fluxo — não implementada aqui.
 */
export function HumanEditArchivedState({ ra }: { ra: string }) {
  return (
    <section className="rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] text-amber-200">
          <Archive aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-black tracking-tight text-white">
            Integrante arquivado
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
            Este integrante está arquivado/inativo. Restaure o cadastro antes de
            editar os dados de pessoal.
          </p>
          <Link
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            href={`${paths.humans}/${encodeURIComponent(ra)}`}
          >
            Voltar ao perfil
          </Link>
        </div>
      </div>
    </section>
  );
}
