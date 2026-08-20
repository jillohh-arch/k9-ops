"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  GraduationCap,
  HeartPulse,
  Link2,
} from "lucide-react";

import { paths } from "@/lib/routes/paths";

/**
 * Operational context — STRICTLY read-only.
 *
 * These values belong to Health, Binomial and Training. They used to be
 * editable inputs in the legacy Edit form, which let an operator type a change
 * that the identity contract can never persist. Here they are rendered as
 * context with links to the owning modules, so nothing on this screen promises
 * a write it cannot perform.
 *
 * No value in this file may ever reach the save payload.
 */

function ContextRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-right text-xs font-semibold text-slate-200">
        {value || "Não informado"}
      </span>
    </div>
  );
}

function ContextCard({
  children,
  href,
  hrefLabel,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  icon: typeof HeartPulse;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-cyan-200/10 bg-[#0b1628]/70 p-4">
      <header className="mb-3 flex items-center gap-2">
        <Icon aria-hidden className="h-4 w-4 text-cyan-300/80" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300/90">
          {title}
        </h3>
      </header>
      <div className="space-y-2">{children}</div>
      {href && hrefLabel ? (
        <Link
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-200 transition hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
          href={href}
        >
          {hrefLabel}
          <ArrowUpRight aria-hidden className="h-3 w-3" />
        </Link>
      ) : null}
    </section>
  );
}

export function K9EditOperationalContext({
  conductorRa,
  dogId,
  idealWeightMax,
  idealWeightMin,
  operationalStatus,
  physicalCondition,
  specialties,
  weight,
}: {
  conductorRa: string;
  dogId: string;
  idealWeightMax: string;
  idealWeightMin: string;
  operationalStatus: string;
  physicalCondition: string;
  specialties: string[];
  weight: string;
}) {
  const idealRange =
    idealWeightMin && idealWeightMax
      ? `${idealWeightMin} – ${idealWeightMax} kg`
      : idealWeightMin || idealWeightMax
        ? `${idealWeightMin || idealWeightMax} kg`
        : "";

  return (
    <aside aria-label="Contexto operacional" className="space-y-4">
      <div className="rounded-2xl border border-cyan-200/10 bg-cyan-300/[0.04] px-4 py-3">
        <p className="text-[11px] leading-relaxed text-slate-400">
          Estas informações pertencem a outros módulos e não são alteradas por
          esta tela.
        </p>
      </div>

      <ContextCard
        href={paths.health}
        hrefLabel="Gerenciar Saúde"
        icon={HeartPulse}
        title="Saúde"
      >
        <ContextRow label="Peso atual" value={weight ? `${weight} kg` : ""} />
        <ContextRow label="Peso ideal" value={idealRange} />
        <ContextRow label="Condição corporal" value={physicalCondition} />
      </ContextCard>

      <ContextCard
        href={paths.binomials}
        hrefLabel="Gerenciar Binômio"
        icon={Link2}
        title="Binômio"
      >
        <ContextRow label="Condutor (RA)" value={conductorRa} />
      </ContextCard>

      <ContextCard
        href={`${paths.trainingDog}/${encodeURIComponent(dogId)}`}
        hrefLabel="Ver Formação"
        icon={GraduationCap}
        title="Formação"
      >
        {specialties.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {specialties.map((modality) => (
              <li
                className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] px-2 py-1 text-[11px] font-semibold text-cyan-100"
                key={modality}
              >
                {modality}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">Nenhuma modalidade registrada</p>
        )}
      </ContextCard>

      {operationalStatus ? (
        <ContextCard icon={Activity} title="Situação cadastral">
          <ContextRow label="Estado" value={operationalStatus} />
          <p className="pt-1 text-[11px] leading-relaxed text-slate-500">
            Arquivamento e restauração seguem o fluxo próprio do cadastro.
          </p>
        </ContextCard>
      ) : null}
    </aside>
  );
}
