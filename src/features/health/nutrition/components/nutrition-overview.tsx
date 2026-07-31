"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Dog, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useEntities } from "@/features/effective/providers/entities-provider";
import { useNutritionPlans } from "../hooks/use-nutrition-plans";

type EntityDog = Record<string, unknown> & { _id: string };

function valueOf(dog: EntityDog, key: string) {
  const value = dog[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function NutritionOverviewRow({ dog }: { dog: EntityDog }) {
  const planState = useNutritionPlans(dog._id);
  const dogName = valueOf(dog, "name") ?? dog._id;
  const plan = planState.activePlan;

  const status =
    planState.status === "loading"
      ? "loading"
      : planState.status === "conflict"
        ? "conflict"
        : planState.status === "error" || planState.status === "degraded"
          ? "error"
          : plan
            ? "active"
            : "empty";

  return (
    <li className="grid gap-4 border-b border-white/8 px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Dog className="h-4 w-4 shrink-0 text-cyan-300" />
          <span className="truncate font-semibold text-slate-100">K9 {dogName}</span>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">
          {[valueOf(dog, "breed"), valueOf(dog, "rg")].filter(Boolean).join(" · ") ||
            "Identificação complementar não informada"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {status === "loading" && (
          <Badge tone="slate">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Consultando
          </Badge>
        )}
        {status === "active" && (
          <>
            <Badge tone="green">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Plano ativo
            </Badge>
            <span className="text-xs text-slate-400">
              {plan && "foodType" in plan ? plan.foodType : "Plano legado"}
            </span>
          </>
        )}
        {status === "empty" && <Badge tone="slate">Sem plano ativo</Badge>}
        {status === "conflict" && (
          <Badge tone="red">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Conflito de integridade
          </Badge>
        )}
        {status === "error" && (
          <Badge tone="yellow">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Leitura indisponível
          </Badge>
        )}
      </div>

      <Link
        href={`/health/nutrition?tab=plans&dogId=${encodeURIComponent(dog._id)}`}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/8 px-3 text-xs font-bold text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-300/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
      >
        Acessar plano
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </li>
  );
}

export function NutritionOverview() {
  const { dogs, dogsLoading, error } = useEntities();

  if (dogsLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
        Consultando efetivo K9…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-950/20 p-5 text-sm text-red-200">
        Não foi possível consultar o efetivo K9. {error}
      </div>
    );
  }

  if (dogs.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-5 py-12 text-center">
        <p className="font-semibold text-slate-200">Nenhum K9 ativo disponível</p>
        <p className="mt-2 text-sm text-slate-500">
          A visão geral não cria registros ou planos para preencher este estado.
        </p>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55">
      <div className="border-b border-white/8 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-100">Situação nutricional do efetivo</h2>
        <p className="mt-1 text-sm text-slate-500">
          Leitura individual dos planos; erros e conflitos nunca são convertidos em “sem plano”.
        </p>
      </div>
      <ul>
        {dogs.map((dog) => (
          <NutritionOverviewRow key={dog._id} dog={dog} />
        ))}
      </ul>
    </section>
  );
}
