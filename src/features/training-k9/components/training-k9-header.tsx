"use client";

import Link from "next/link";
import { BookOpen, CheckSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAccessControl } from "@/features/access/providers/access-control-provider";
import { paths } from "@/lib/routes/paths";

export function TrainingK9Header() {
  const { can } = useAccessControl();
  const canManageMatrices =
    can("training", "edit") || can("training_matrix", "edit");
  const canViewEvaluations =
    can("training", "approve") ||
    can("training_matrix", "approve") ||
    can("training", "audit") ||
    can("training_matrix", "audit");

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">
          TREINAMENTO E AVALIAÇÃO K9
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Acompanhe a evolução dos cães, matrizes de treinamento e avaliações
        </p>
      </div>

      <div className="flex items-center gap-3">
        {canManageMatrices ? (
          <Link href={paths.trainingMatrices}>
            <Button
              className="gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2.5 text-sm font-bold text-cyan-200 hover:bg-cyan-300/20"
            >
              <BookOpen className="h-4 w-4" />
              Matrizes de Treinamento
            </Button>
          </Link>
        ) : null}

        {canViewEvaluations ? (
          <Link href={`${paths.training}?tab=evaluations`}>
            <Button
              className="gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-2.5 text-sm font-bold text-amber-200 hover:bg-amber-300/20"
            >
              <CheckSquare className="h-4 w-4" />
              Avaliações Pendentes
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
