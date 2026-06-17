"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#050d10] px-6 text-center text-slate-100">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10">
        <AlertCircle className="h-8 w-8 text-red-300" />
      </div>
      <div>
        <h1 className="text-xl font-black text-white">Erro de autenticação</h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          Não foi possível carregar a tela de login. Verifique sua conexão.
        </p>
      </div>
      <Button variant="secondary" onClick={reset}>
        <RotateCcw className="mr-2 h-4 w-4" />
        Tentar novamente
      </Button>
    </main>
  );
}
