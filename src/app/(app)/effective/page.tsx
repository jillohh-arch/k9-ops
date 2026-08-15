"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  resolveEffectiveRedirect,
} from "@/features/effective/lib/effective-navigation";

/**
 * `/effective` deixou de ser um hub com quatro cards.
 *
 * Os núcleos do Efetivo agora vivem na sidebar como subitens, então esta rota
 * apenas resolve o primeiro núcleo permitido e redireciona — preferindo
 * `/k9` quando `k9/view` estiver liberado (seção 6 do prompt).
 *
 * Se nenhum núcleo estiver liberado, mantém o estado fail-closed em vez de
 * redirecionar: a ausência de destino nunca vira acesso.
 */
export default function EffectivePage() {
  const router = useRouter();
  const { can, status } = useAccessControl();
  const accessResolved = status !== "loading";
  const destination = accessResolved
    ? resolveEffectiveRedirect((moduleId) => can(moduleId, "view"))
    : null;

  useEffect(() => {
    if (!destination) return;
    // `replace` evita que o botão voltar caia de novo em `/effective`,
    // o que produziria um laço de redirecionamento perceptível.
    router.replace(destination);
  }, [destination, router]);

  if (!accessResolved) {
    return (
      <div
        aria-busy="true"
        className="rounded-3xl border border-dashed border-cyan-200/12 bg-[#0b1628]/60 p-10 text-center text-sm text-slate-500"
      >
        Resolvendo acesso aos núcleos do efetivo...
      </div>
    );
  }

  if (!destination) {
    return (
      <div className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-8 text-center">
        <h1 className="text-xl font-black text-white">Nenhum núcleo liberado</h1>
        <p className="mt-2 text-sm text-slate-400">
          Seu perfil não possui acesso aos módulos de efetivo.
        </p>
      </div>
    );
  }

  return (
    <div
      aria-busy="true"
      className="rounded-3xl border border-dashed border-cyan-200/12 bg-[#0b1628]/60 p-10 text-center text-sm text-slate-500"
    >
      Redirecionando para o núcleo do efetivo...
    </div>
  );
}
