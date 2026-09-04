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
 *
 * HW-6A.H1.FIX1 — scope alignment:
 * The institutional roster (`dogs`) is readable by any signed in user, while
 * every per-dog Health projection under it is gated by `canAccessDogRecord`.
 * An `own_records` persona therefore loads K9s it may not inspect, and offering
 * them here walks the operator into a guaranteed `firestore-read-error`. The
 * list is now filtered by the server's OWN per-dog verdict, already preserved in
 * `item.dataQuality` by the shared loader — no second authorization model is
 * introduced and Security Rules stay the only authority. Exclusions are
 * surfaced as a truthful count, never silently dropped.
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
  ForbiddenState,
  LoadingState,
} from "../../presentation/components/health-technical-states";
import { loadReadinessScope } from "../../presentation/hooks/load-readiness-scope";
import { useNutritionReadAuthority } from "../hooks/use-nutrition-read-authority";
import {
  describeNutritionExclusions,
  selectVisibleNutritionDogs,
} from "./nutrition-scope-visibility";

const dogCard = cn(
  "flex items-center justify-between gap-3 rounded-2xl border border-cyan-200/12 bg-[#0b1628]/82 px-4 py-3 text-left transition-colors",
  "hover:bg-[#0b1628] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

const EMPTY_DOGS: DogIdentityReadModel[] = [];

export function NutritionLandingView() {
  const authority = useNutritionReadAuthority();
  const [dataResult, setDataResult] = useState<{
    dogs: DogIdentityReadModel[];
    exclusionNotice: string | null;
    status: "success" | "empty" | "error";
  } | null>(null);

  useEffect(() => {
    if (authority.status !== "allowed") {
      return;
    }

    let active = true;

    loadReadinessScope()
      .then((scope) => {
        if (!active) return;
        // Only K9s the server itself authorized become navigable options.
        const visibility = selectVisibleNutritionDogs(scope.items);
        setDataResult({
          dogs: visibility.visibleDogs,
          exclusionNotice: describeNutritionExclusions(visibility),
          status: visibility.authorizedCount === 0 ? "empty" : "success",
        });
      })
      .catch(() => {
        if (!active) return;
        setDataResult({
          dogs: EMPTY_DOGS,
          exclusionNotice: null,
          status: "error",
        });
      });

    return () => {
      active = false;
    };
  }, [authority.status]);

  if (authority.status === "loading") {
    return <LoadingState message="Verificando permissões..." />;
  }

  if (authority.status === "forbidden") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-border/60 bg-card/40 p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
        data-testid="nutrition-landing-forbidden"
      >
        <ForbiddenState
          requiredCapability={authority.requiredCapability}
          message="Leitura do módulo de nutrição não autorizada para o perfil de acesso atual."
        />
      </div>
    );
  }

  if (!dataResult) {
    return <LoadingState message="Carregando efetivo..." />;
  }

  const { dogs, exclusionNotice, status } = dataResult;

  if (status === "error") {
    return (
      <ErrorState
        message="Não foi possível carregar o efetivo. Nenhum estado foi presumido."
        retryable={false}
      />
    );
  }

  if (status === "empty") {
    // Honest emptiness. When the institution DOES hold K9s but none are
    // authorized, the count is still stated so the operator is never told the
    // effective is empty when it merely is not theirs.
    return (
      <div className="space-y-3">
        <EmptyState
          title="Nenhum K9 disponível"
          description="Nenhum K9 no escopo autorizado para consulta de nutrição."
        />
        {exclusionNotice && <NutritionCoverageNotice notice={exclusionNotice} />}
      </div>
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
      {exclusionNotice && (
        <div className="mt-3">
          <NutritionCoverageNotice notice={exclusionNotice} />
        </div>
      )}
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

/**
 * Partial-coverage banner, mirroring the Clinical precedent.
 *
 * Non-error by design: an incomplete list is an authorization fact, not a
 * failure. PRIVACY: `notice` carries counts only — no identifying attribute of
 * an excluded K9 reaches this component.
 */
function NutritionCoverageNotice({ notice }: { notice: string }) {
  return (
    <div
      className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3"
      role="status"
      aria-live="polite"
      data-testid="nutrition-partial-notice"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300/85">
          Cobertura parcial
        </p>
        <p className="mt-1 text-sm font-semibold leading-snug text-amber-100">
          A lista está incompleta e não representa todo o efetivo.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{notice}</p>
      </div>
    </div>
  );
}
