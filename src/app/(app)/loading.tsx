import { LoaderCircle } from "lucide-react";

export default function AppLoading() {
  return (
    <main className="flex min-h-[60dvh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-300" />
        <p className="text-sm font-medium text-slate-400">Carregando...</p>
      </div>
    </main>
  );
}
