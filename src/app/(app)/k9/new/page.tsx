"use client";

import { K9CreateForm } from "@/features/effective/components/k9-create-v1/k9-create-form";

export default function NewK9Page() {
  return (
    <div className="mx-auto w-full max-w-[95rem] px-0 py-1 sm:px-0 lg:py-2">
      <nav aria-label="Trilha de navegação" className="mb-4">
        <ol className="flex items-center gap-1.5 text-xs text-slate-500">
          <li>K9</li>
          <li aria-hidden>/</li>
          <li>Efetivo</li>
          <li aria-hidden>/</li>
          <li className="font-semibold text-slate-300">Novo K9</li>
        </ol>
      </nav>
      <K9CreateForm />
    </div>
  );
}
