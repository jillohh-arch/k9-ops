"use client";

/**
 * K9 Ops Web — Health Web v1 / WEB-01B.2
 * Canonical nutrition plan card (READ-ONLY).
 *
 * Adapted from the pre-Foundation `nutrition-plan-active-view`. The mutation
 * affordances of the original (canManage / onOpenEdit / onOpenReplace /
 * onOpenCancel and their buttons) were deliberately dropped: WEB-01B.2 has no
 * management surface, so those props do not exist here rather than being
 * passed as undefined.
 *
 * Renders only fields the read model actually supports.
 */

import { Clock, Droplets, Scale, Utensils } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { NutritionPlan } from "../types";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(value: Date | undefined): string {
  return value ? dateFormat.format(value) : "—";
}

const PERIOD_LABELS: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
  night: "Madrugada",
  extra: "Extra",
};

/**
 * WEB-01B.5 — optional action slot.
 *
 * The card stays presentation-focused: it renders whatever action node the
 * caller passes and decides nothing about authorization. Eligibility
 * (capability x read state x pending reconciliation) is resolved by the panel,
 * so there is no second authorization boundary inside the card.
 */
export function NutritionPlanCanonicalCard({
  plan,
  action,
}: {
  plan: NutritionPlan;
  action?: React.ReactNode;
}) {
  const supplements = plan.supplements ?? [];

  return (
    <section
      className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="nutrition-canonical-card"
      aria-labelledby="nutrition-canonical-heading"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">
            Plano alimentar vigente
          </p>
          <h2
            id="nutrition-canonical-heading"
            className="mt-1 text-sm font-semibold text-foreground"
          >
            {plan.foodType}
          </h2>
        </div>
        {/*
          MAJOR-V2 — mobile action overflow.

          This row previously had no `flex-wrap`, so the badge plus three buttons
          formed one unbreakable line: at 390px the page measured scrollWidth 429
          against clientWidth 375 and "Cancelar plano" ended off-screen.

          The fix is layout, not truncation. On narrow widths the badge takes its own
          line and the actions wrap beneath it, each keeping its full label and touch
          target. From `sm` up the original single-line arrangement returns, so the
          desktop composition the review found good is unchanged.
        */}
        <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Badge tone="cyan">Revisão {plan.revision}</Badge>
          {action ? (
            <div
              className="flex flex-wrap items-center gap-2"
              data-testid="nutrition-canonical-actions"
            >
              {action}
            </div>
          ) : null}
        </div>
      </header>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <Metric
          icon={<Scale className="h-4 w-4" aria-hidden="true" />}
          label="Quantidade diária"
          value={`${plan.amountGramsPerDay} g`}
        />
        <Metric
          icon={<Utensils className="h-4 w-4" aria-hidden="true" />}
          label="Refeições por dia"
          value={String(plan.mealsPerDay)}
        />
        <Metric
          icon={<Droplets className="h-4 w-4" aria-hidden="true" />}
          label="Hidratação"
          value={plan.hydrationMl != null ? `${plan.hydrationMl} ml` : "—"}
        />
      </dl>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Metric
          icon={<Clock className="h-4 w-4" aria-hidden="true" />}
          label="Vigência"
          value={`${formatDate(plan.validFrom)} — ${formatDate(plan.validUntil)}`}
        />
        <Metric label="Fuso horário" value={plan.timezone} />
      </div>

      {plan.mealSchedule.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Grade de refeições
          </h3>
          <ul className="mt-3 space-y-2">
            {plan.mealSchedule.map((slot) => (
              <li
                key={slot.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-3.5 py-2 text-xs"
              >
                <span className="font-medium text-foreground">
                  {PERIOD_LABELS[slot.period] ?? slot.period} — {slot.scheduledTime}
                </span>
                <span className="text-muted-foreground">{slot.targetGrams} g</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {supplements.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Suplementação
          </h3>
          <ul className="mt-3 space-y-2">
            {supplements.map((supplement) => (
              <li
                key={supplement.id}
                className="rounded-xl border border-border/60 bg-background/40 px-3.5 py-2 text-xs"
              >
                <span className="font-medium text-foreground">{supplement.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  — {supplement.dose} {supplement.unit}, {supplement.frequency}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.specialInstructions && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Instruções especiais
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {plan.specialInstructions}
          </p>
        </div>
      )}

      <footer className="mt-6 border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
        Registrado por {plan.recordedBy.name} ({plan.recordedBy.internalRole})
      </footer>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
