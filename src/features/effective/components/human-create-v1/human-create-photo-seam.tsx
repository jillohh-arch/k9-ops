"use client";

import { UserRound } from "lucide-react";

/**
 * Selo visual de foto — deliberadamente INERTE.
 *
 * Create V1 não seleciona arquivo, não faz upload, não escreve no Storage e não
 * envia `photoUrl`/`photoURL`. O backend homologado recusa esses campos (domínio
 * "foto — fluxo pós-cadastro"). Aqui existe apenas a silhueta, para que a tela
 * leia como um cadastro de pessoa sem prometer uma ação que este gate não faz.
 *
 * Sem <input type="file">, sem onChange, sem label clicável: nada aqui pode
 * iniciar um upload.
 */
export function HumanCreatePhotoSeam() {
  return (
    <div>
      <div className="relative flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-cyan-200/16 bg-[radial-gradient(circle_at_50%_18%,rgba(77,208,225,0.12),transparent_40%),#081521] text-center shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200 shadow-[0_12px_28px_rgba(0,0,0,0.16)]">
          <UserRound aria-hidden className="h-6 w-6" />
        </span>
        <div className="px-4">
          <p className="text-sm font-bold text-slate-200">Foto do integrante</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Foto poderá ser adicionada após o cadastro.
          </p>
        </div>
      </div>
    </div>
  );
}
