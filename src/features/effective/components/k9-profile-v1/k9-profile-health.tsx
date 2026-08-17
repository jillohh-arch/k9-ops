"use client";

import { ExternalLink, Scale, Stethoscope, Syringe } from "lucide-react";
import Link from "next/link";

import type { HealthDogSummary } from "@/features/health/hooks/use-health-data";
import {
  profileRecordDate,
  profileText,
  type ProfileRecord,
} from "@/features/effective/lib/k9-profile-records";
import {
  healthEventTitle,
  healthEventType,
} from "@/features/effective/lib/k9-profile-activity";
import type { buildK9ProfileStatus } from "@/features/effective/lib/k9-profile-status";
import { paths } from "@/lib/routes/paths";

import {
  ProfileCard,
  ProfileEmpty,
  ProfileError,
  ProfileField,
  ProfileSkeleton,
  ProfileStateRow,
} from "./k9-profile-ui";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Rótulos dos estados que o módulo Health já calcula. Nada é recalculado. */
const VACCINE_LABEL: Record<HealthDogSummary["vaccine"], string> = {
  current: "Em dia",
  due_soon: "Próxima dose a vencer",
  missing: "Sem registro de vacinação",
  overdue: "Dose vencida",
};

const VACCINE_TONE: Record<HealthDogSummary["vaccine"], "amber" | "green" | "red" | "violet"> = {
  current: "green",
  due_soon: "amber",
  missing: "violet",
  overdue: "red",
};

const WEIGHT_LABEL: Record<HealthDogSummary["weight"], string> = {
  in_range: "Dentro da faixa ideal",
  missing: "Sem pesagem canônica",
  missing_range: "Faixa ideal não cadastrada",
  out_of_range: "Fora da faixa ideal",
};

const WEIGHT_TONE: Record<HealthDogSummary["weight"], "amber" | "green" | "violet"> = {
  in_range: "green",
  missing: "violet",
  missing_range: "amber",
  out_of_range: "amber",
};

export type K9ProfileHealthProps = {
  /** Erro do módulo Health; degradação é local. */
  error: string | null;
  events: ProfileRecord[];
  loading: boolean;
  status: ReturnType<typeof buildK9ProfileStatus>;
  /** Resumo canônico do módulo Health; `null` = ainda não disponível. */
  summary: HealthDogSummary | null;
};

/**
 * Aba Saúde — consome outputs do módulo Health, não recalcula nada.
 *
 * Vacinação, peso e exame vêm de `HealthDogSummary`, produzido por
 * `useHealthData()`. O Perfil não mantém `vaccineState`/`weightState` próprios:
 * duas implementações da mesma regra divergiriam com o tempo.
 *
 * Prontidão clínica continua vindo de `health_summary/current`, que é uma fonte
 * distinta — e `HealthDogSummary.ready` NÃO é usada para isso: aquele campo é
 * conformidade administrativa (vacina + peso), não avaliação clínica.
 */
export function K9ProfileHealth({
  error,
  events,
  loading,
  status,
  summary,
}: K9ProfileHealthProps) {
  const clinical = events
    .filter((event) => healthEventType(event) !== "vaccination")
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {error ? (
        <ProfileError>Falha ao carregar dados de saúde: {error}</ProfileError>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <ProfileCard title="Prontidão clínica">
          {status.readiness.available ? (
            <ProfileStateRow
              detail={status.readiness.detail}
              icon={Stethoscope}
              label={status.readiness.label}
              tone={status.readiness.tone}
            />
          ) : (
            <>
              <ProfileStateRow
                icon={Stethoscope}
                label={status.readiness.label}
                tone="slate"
              />
              <ProfileEmpty>
                <span className="mt-2 block">{status.readiness.message}</span>
              </ProfileEmpty>
            </>
          )}
        </ProfileCard>

        <ProfileCard title="Vacinação">
          {loading && !summary ? (
            <ProfileSkeleton className="h-16" />
          ) : summary ? (
            <>
              <ProfileStateRow
                icon={Syringe}
                label={VACCINE_LABEL[summary.vaccine]}
                tone={VACCINE_TONE[summary.vaccine]}
              />
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
                <ProfileField
                  label="Última dose"
                  value={
                    summary.latestVaccineAt
                      ? dateFormatter.format(summary.latestVaccineAt)
                      : "Não informada"
                  }
                />
                <ProfileField
                  label="Próxima dose"
                  value={
                    summary.latestVaccineDueAt
                      ? dateFormatter.format(summary.latestVaccineDueAt)
                      : "Não informada"
                  }
                />
              </dl>
            </>
          ) : (
            <ProfileEmpty>
              Resumo de vacinação não disponível para este K9.
            </ProfileEmpty>
          )}
        </ProfileCard>

        <ProfileCard title="Peso">
          {loading && !summary ? (
            <ProfileSkeleton className="h-16" />
          ) : summary ? (
            <>
              <ProfileStateRow
                icon={Scale}
                label={WEIGHT_LABEL[summary.weight]}
                tone={WEIGHT_TONE[summary.weight]}
              />
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
                <ProfileField
                  label="Peso atual"
                  mono
                  value={
                    summary.latestWeightKg == null
                      ? "Não informado"
                      : `${summary.latestWeightKg.toFixed(1)} kg`
                  }
                />
                <ProfileField
                  label="Faixa ideal"
                  mono
                  value={
                    summary.idealRange
                      ? `${summary.idealRange.min.toFixed(1)}–${summary.idealRange.max.toFixed(1)} kg`
                      : "Não cadastrada"
                  }
                />
              </dl>
              {summary.latestWeightAt ? (
                <p className="mt-2 text-[11px] text-slate-500">
                  Pesagem de {dateFormatter.format(summary.latestWeightAt)}
                </p>
              ) : null}
            </>
          ) : (
            <ProfileEmpty>
              Resumo de peso não disponível para este K9.
            </ProfileEmpty>
          )}
        </ProfileCard>
      </div>

      {summary?.issues.length ? (
        <ProfileCard title="Pendências registradas pelo módulo Saúde">
          <ul className="space-y-2">
            {summary.issues.map((issue) => (
              <li
                className="flex items-start gap-2.5 border-b border-white/[0.05] pb-2 last:border-0 last:pb-0"
                key={`${issue.label}:${issue.detail}`}
              >
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/70"
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-100">
                    {issue.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {issue.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </ProfileCard>
      ) : null}

      <ProfileCard title="Últimos eventos clínicos">
        {loading && !events.length ? (
          <ProfileSkeleton className="h-20" />
        ) : clinical.length ? (
          <ul className="space-y-0">
            {clinical.map((event, index) => {
              const date = profileRecordDate(event);
              return (
                <li
                  className={
                    index < clinical.length - 1
                      ? "border-b border-white/[0.05] pb-2.5 pt-2.5 first:pt-0"
                      : "pt-2.5 first:pt-0"
                  }
                  key={event._id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-slate-100">
                        {healthEventTitle(event)}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {profileText(event, [
                          "healthObservations",
                          "professionalClinic",
                          "vetName",
                        ]) ?? "Registro clínico"}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">
                      {date ? dateFormatter.format(date) : "Sem data"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <ProfileEmpty>Nenhum evento clínico registrado.</ProfileEmpty>
        )}

        {/*
          O módulo Saúde não expõe rota por cão: `/health` é a única superfície
          real. O CTA aponta para ela, sem inventar `/health/[dogId]`.
        */}
        <Link
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-2.5 text-xs font-bold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          href={paths.health}
        >
          <ExternalLink aria-hidden className="h-4 w-4" />
          Acessar Saúde
        </Link>
      </ProfileCard>
    </div>
  );
}
