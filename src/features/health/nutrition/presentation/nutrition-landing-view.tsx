"use client";

/**
 * K9 Ops Web — Health Web v1 / WEB-01B.2
 * Nutrition submodule landing (/health/nutrition).
 *
 * Entry point for the submodule: lists the accessible K9s and navigates to the
 * individual context. It reuses the Foundation's readiness scope loader, which
 * is already the single composition path for "the K9s in my authorized scope" —
 * there must never be a second scope engine, and no custom dog selector is
 * introduced.
 *
 * Navigation uses `paths.health_nutrition_dog`, so the canonical route
 * `/health/nutrition/dogs/[dogId]` is the only source of individual context.
 * No `?dogId=` anywhere.
 *
 * Plan management is NOT embedded here.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { paths } from "../../domain/paths";
import type { DogIdentityReadModel } from "../../domain/readiness-types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../presentation/components/health-technical-states";
import { loadReadinessScope } from "../../presentation/hooks/load-readiness-scope";

type LandingStatus = "loading" | "success" | "empty" | "error";

const dogCard = cn(
  "flex items-center justify-between gap-3 rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 px-4 py-3 text-left transition-colors",
  "hover:bg-[#0b1628] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

export function NutritionLandingView() {
  const [status, setStatus] = useState<LandingStatus>("loading");
  const [dogs, setDogs] = useState<DogIdentityReadModel[]>([]);

  useEffect(() => {
    let active = true;

    loadReadinessScope()
      .then((scope) => {
        if (!active) return;
        const items = scope.items.map((item) => item.dog);
        setDogs(items);
        setStatus(items.length === 0 ? "empty" : "success");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return <LoadingState message="Carregando efetivo..." />;
  }

  if (status === "error") {
    return (
      <ErrorState
        message="Não foi possível carregar o efetivo. Nenhum estado foi presumido."
        retryable={false}
      />
    );
  }

  if (status === "empty") {
    return (
      <EmptyState
        title="Nenhum K9 disponível"
        description="Não há K9 no escopo autorizado para consulta de nutrição."
      />
    );
  }

  return (
    <section aria-labelledby="nutrition-effective-heading">
      <h2
        id="nutrition-effective-heading"
        className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        Selecione um K9
      </h2>
      <ul className="mt-3 space-y-2" data-testid="nutrition-dog-list">
        {dogs.map((dog) => (
          <li key={dog.id}>
            <Link href={paths.health_nutrition_dog(dog.id)} className={dogCard}>
              <span>
                <span className="block text-sm font-semibold text-foreground">{dog.name}</span>
                {dog.registrationNumber && (
                  <span className="block text-[11px] text-muted-foreground">
                    Matrícula {dog.registrationNumber}
                  </span>
                )}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
