"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[K9-Ops] Unhandled error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10">
        <AlertCircle className="h-8 w-8 text-red-300" />
      </div>
      <div>
        <h1 className="text-xl font-black text-white">Algo deu errado</h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          Ocorreu um erro inesperado. Tente novamente ou volte ao dashboard.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-slate-600">
            Ref: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
        <Button variant="ghost" onClick={() => (window.location.href = "/dashboard")}>
          Voltar ao dashboard
        </Button>
      </div>
    </main>
  );
}
