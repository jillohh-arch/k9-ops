"use client";

/**
 * K9 Ops Web — Health Web v1 / WEB-01B.2
 * Client view for the individual Nutrition route (/health/nutrition/dogs/[dogId]).
 *
 * Resolves the K9 context through the Foundation's institutional mapping, then
 * renders the read-only nutrition surface inside the Health shell.
 *
 * Dog access is a Health/route-context responsibility, not the Nutrition read
 * model's: `not_found` here is resolved exactly as the readiness cockpit does,
 * never by the nutrition hook.
 */

import Link from "next/link";
import { Activity, ArrowLeft, Dog as DogIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { paths } from "../../domain/paths";
import { HealthModuleShell } from "../../presentation/components/health-module-shell";
import {
  ErrorState,
  ForbiddenState,
  LoadingState,
} from "../../presentation/components/health-technical-states";
import { useNutritionReadAuthority } from "../hooks/use-nutrition-read-authority";
import { NutritionPlanPanel } from "./nutrition-plan-panel";
import { useNutritionDogContext } from "./use-nutrition-dog-context";

const backLink = cn(
  "mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors",
  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

/*
 * Cross-navigation to the readiness cockpit of the SAME K9 (NUT-WEB-5B).
 *
 * Read affordance only: it carries no capability requirement and issues no
 * command. The href always comes from `paths.health_readiness_dog`, never from
 * manual concatenation, so dogId encoding stays with the single path authority.
 */
const cockpitLink = cn(
  "inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors",
  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

export function NutritionDogView({ dogId }: { dogId: string }) {
  const authority = useNutritionReadAuthority();
  const { status, dog, errorMessage } = useNutritionDogContext(dogId, authority.canRead);

  if (authority.status === "loading") {
    return (
      <HealthModuleShell title="Nutrição" activeNavKey="nutrition">
        <LoadingState message="Verificando permissões..." />
      </HealthModuleShell>
    );
  }

  if (authority.status === "forbidden") {
    return (
      <HealthModuleShell title="Nutrição" activeNavKey="nutrition">
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-border/60 bg-card/40 p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
          data-testid="nutrition-dog-forbidden"
        >
          <ForbiddenState
            requiredCapability={authority.requiredCapability}
            message="Leitura do módulo de nutrição não autorizada para o perfil de acesso atual."
          />
          <Link href="/health/nutrition" className={backLink}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Voltar à nutrição do efetivo</span>
          </Link>
        </div>
      </HealthModuleShell>
    );
  }

  if (status === "loading") {
    return (
      <HealthModuleShell title="Nutrição" activeNavKey="nutrition">
        <LoadingState message="Carregando contexto do K9..." />
      </HealthModuleShell>
    );
  }

  /*
   * Not found and "exists but out of scope" are deliberately indistinguishable,
   * so scope membership is never revealed. No silent redirect to another K9.
   */
  if (status === "not_found") {
    return (
      <HealthModuleShell title="Nutrição" activeNavKey="nutrition">
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
          data-testid="nutrition-dog-not-found"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-500/25 bg-slate-500/10 text-slate-300">
            <DogIcon className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-sm font-semibold text-foreground">K9 não encontrado</h1>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            O K9 solicitado não está disponível no escopo atual.
          </p>
          <Link href="/health/nutrition" className={backLink}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Voltar à nutrição do efetivo</span>
          </Link>
        </div>
      </HealthModuleShell>
    );
  }

  if (status === "error" || dog === null) {
    return (
      <HealthModuleShell title="Nutrição" activeNavKey="nutrition">
        <ErrorState
          message="Não foi possível resolver o contexto deste K9. Nenhum estado foi presumido."
          technicalDetails={errorMessage ?? undefined}
          retryable={false}
        />
      </HealthModuleShell>
    );
  }

  return (
    <HealthModuleShell
      title="Nutrição"
      description="Plano alimentar do K9"
      activeNavKey="nutrition"
      dogContext={{
        id: dog.id,
        name: dog.name,
        photo: dog.photoUrl ?? undefined,
      }}
    >
      <div className="flex flex-wrap items-center gap-2" data-testid="nutrition-dog-cross-nav">
        <Link
          href={paths.health_readiness_dog(dog.id)}
          className={cockpitLink}
          data-testid="nutrition-to-cockpit-link"
        >
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Ver prontidão deste K9</span>
        </Link>
      </div>

      <NutritionPlanPanel dogId={dog.id} dogName={dog.name} />
    </HealthModuleShell>
  );
}
