"use client";

import { TrainingK9Empty } from "@/features/training-k9/components/training-k9-shell";

export default function TrainingMatricesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">
          MATRIZES DE TREINAMENTO
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Gerencie as matrizes de treinamento utilizadas na unidade
        </p>
      </div>

      <TrainingK9Empty
        title="Matrizes de treinamento"
        description="O gerenciamento de matrizes será implementado na próxima etapa. As matrizes existentes continuam acessíveis pela integração atual."
      />
    </div>
  );
}
