"use client";

/**
 * K9 Ops Web — Health Web v1 / WEB-01B.2
 * Legacy nutrition prescription card (READ-ONLY).
 *
 * Adapted from the pre-Foundation `nutrition-plan-legacy-view`, minus its
 * mutation affordances (canManage / onOpenCreate and the "create canonical
 * plan" button).
 *
 * The legacy origin is stated plainly and without alarmist language, and the
 * record is never promoted to canonical. The Foundation's `LegacyState`
 * provides the surrounding legacy indicator.
 */

import { Clock, Scale, Utensils } from "lucide-react";

import type { LegacyNutritionPlanView } from "../types";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(value: Date | undefined): string {
  return value ? dateFormat.format(value) : "—";
}

export function NutritionPlanLegacyCard({ plan }: { plan: LegacyNutritionPlanView }) {
  const professional = plan.professionalName;

  return (
    <section
      className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]"
      data-testid="nutrition-legacy-card"
      aria-labelledby="nutrition-legacy-heading"
    >
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
          Prescrição legada
        </p>
        <h2
          id="nutrition-legacy-heading"
          className="mt-1 text-sm font-semibold text-foreground"
        >
          {plan.foodType}
        </h2>
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
          icon={<Clock className="h-4 w-4" aria-hidden="true" />}
          label="Vigência"
          value={`${formatDate(plan.vigentFrom)} — ${formatDate(plan.vigentUntil)}`}
        />
      </dl>

      {plan.notes && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Observações
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{plan.notes}</p>
        </div>
      )}

      {professional && (
        <footer className="mt-6 border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
          Profissional responsável: {professional}
        </footer>
      )}
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
