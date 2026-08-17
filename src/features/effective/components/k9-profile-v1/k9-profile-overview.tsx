"use client";

import {
  CalendarClock,
  ChevronRight,
  ClipboardList,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";

import type { EffectiveDog } from "@/features/effective/hooks/use-effective-data";
import type { K9RosterDetail } from "@/features/effective/hooks/use-k9-roster-detail";
import {
  humanizeTrainingLabel,
  type K9ActivityItem,
} from "@/features/effective/lib/k9-profile-activity";
import type { buildK9ProfileStatus } from "@/features/effective/lib/k9-profile-status";
import { paths } from "@/lib/routes/paths";

import { K9ActivityTimeline } from "./k9-profile-timeline";
import {
  ProfileCard,
  ProfileEmpty,
  ProfileField,
  ProfilePill,
  ProfileSkeleton,
  ProfileHeadlineState,
} from "./k9-profile-ui";

const NOT_INFORMED = "Não informado";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export type K9ProfileOverviewProps = {
  activity: K9ActivityItem[];
  detail: K9RosterDetail;
  dog: EffectiveDog;
  onSeeAllActivity: () => void;
  onSeeHealth: () => void;
  /** Porte cadastral; `null` quando não persistido. */
  size: string | null;
  status: ReturnType<typeof buildK9ProfileStatus>;
};

/**
 * Visão Geral: leitura operacional rápida, não um dashboard.
 *
 * Quatro cards de estado + atividades recentes. Cada conceito de status é um
 * card ou uma linha própria — administrativo e operacional nunca compartilham
 * um badge, e a prontidão clínica nunca é derivada dos outros dois.
 */
export function K9ProfileOverview({
  activity,
  detail,
  dog,
  onSeeAllActivity,
  onSeeHealth,
  size,
  status,
}: K9ProfileOverviewProps) {
  const recent = activity.slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {/* 1. Status operacional — administrativo e operacional separados. */}
        <ProfileCard title="Status operacional">
          {/*
            Dois conceitos, duas linhas: o administrativo é o valor dominante
            (é o que está persistido) e a situação operacional aparece logo
            abaixo, rotulada. Continuam separados — nada de badge único.
          */}
          <ProfileHeadlineState
            detail={status.administrative.detail}
            icon={ShieldCheck}
            label={status.administrative.label}
            tone={status.administrative.tone}
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
            <span className="text-[11px] font-semibold text-slate-400">
              Situação operacional
            </span>
            <ProfilePill
              label={status.operational.label}
              tone={status.operational.tone}
            />
          </div>
        </ProfileCard>

        {/* 2. Prontidão clínica — só da fonte Health. */}
        <ProfileCard title="Prontidão clínica">
          {detail.loading ? (
            <ProfileSkeleton className="h-12" />
          ) : status.readiness.available ? (
            <>
              <ProfileHeadlineState
                detail={status.readiness.detail}
                icon={Stethoscope}
                label={status.readiness.label}
                tone={status.readiness.tone}
              />
              {detail.readiness?.evaluatedAt ? (
                <p className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] text-slate-400">
                  Última avaliação:{" "}
                  {dateTimeFormatter.format(detail.readiness.evaluatedAt)}
                </p>
              ) : null}
            </>
          ) : (
            // Indisponibilidade também merece presença: o estado é uma
            // informação operacional, não um espaço vazio. Sem score.
            <ProfileHeadlineState
              detail={status.readiness.message}
              icon={Stethoscope}
              label={status.readiness.label}
              tone="slate"
            />
          )}
          {/*
            Não existe rota canônica por cão no módulo Saúde (`/health` é a
            única superfície). O CTA leva à aba Saúde deste próprio perfil, que
            é um destino real, em vez de inventar `/health/[dogId]`.
          */}
          <button
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 pt-2 text-[11px] font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            onClick={onSeeHealth}
            type="button"
          >
            Acessar saúde
            <ChevronRight aria-hidden className="h-3.5 w-3.5" />
          </button>
        </ProfileCard>

        {/* 3. Última atividade — fato real mais recente por timestamp. */}
        <ProfileCard title="Última atividade">
          {detail.loading ? (
            <ProfileSkeleton className="h-12" />
          ) : detail.lastTrainingSession ? (
            <>
              <ProfileHeadlineState
                /*
                  `useK9RosterDetail` devolve a modalidade como token do
                  Training (ex.: `detection_formation`). O hook é compartilhado
                  com o Roster e não é alterado aqui: a humanização acontece na
                  renderização.
                */
                detail={humanizeTrainingLabel(
                  detail.lastTrainingSession.modality,
                )}
                icon={CalendarClock}
                label={detail.lastTrainingSession.title}
                tone="cyan"
              />
              {detail.lastTrainingSession.date ? (
                <p className="mt-3 border-t border-white/[0.06] pt-3 font-mono text-[11px] text-slate-400">
                  {dateTimeFormatter.format(detail.lastTrainingSession.date)}
                </p>
              ) : null}
            </>
          ) : (
            <ProfileEmpty>
              Nenhuma sessão de treinamento registrada.
            </ProfileEmpty>
          )}
          {/*
            "Próxima sessão" não é exibida em nenhuma hipótese: não existe
            fonte de agendamento futuro (seção 15).
          */}
          <button
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            onClick={onSeeAllActivity}
            type="button"
          >
            Ver histórico completo
            <ChevronRight aria-hidden className="h-3.5 w-3.5" />
          </button>
        </ProfileCard>

        {/* 4. Dados cadastrais — sem peso: peso é fato clínico, vive na Saúde. */}
        <ProfileCard title="Dados cadastrais">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <ProfileField
              label="Matrícula"
              mono
              value={dog.registrationNumber ?? NOT_INFORMED}
            />
            <ProfileField
              label="Microchip"
              mono
              value={dog.microchip ?? NOT_INFORMED}
            />
            <ProfileField
              label="Nascimento"
              value={
                dog.dateOfBirth
                  ? dateFormatter.format(dog.dateOfBirth)
                  : NOT_INFORMED
              }
            />
            <ProfileField label="Sexo" value={dog.sex ?? NOT_INFORMED} />
            <ProfileField label="Cor" value={dog.color ?? NOT_INFORMED} />
            <ProfileField label="Porte" value={size ?? NOT_INFORMED} />
          </dl>
          {/*
            Peso é exibido na aba Saúde, a partir da fonte canônica
            (`weight_records` via módulo Health), e não como atributo cadastral
            estático (seção 16). "Altura" não existe no schema — não é exibida.
          */}
          <Link
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            href={`${paths.k9}/${encodeURIComponent(dog.id)}/edit`}
          >
            Ver todos os dados
            <ChevronRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        </ProfileCard>
      </div>

      <ProfileCard title="Atividades recentes">
        {recent.length ? (
          <>
            {/* Apresentação de timeline; fontes e ordem vêm prontas. */}
            <K9ActivityTimeline items={recent} variant="compact" />
            <button
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
              onClick={onSeeAllActivity}
              type="button"
            >
              <ClipboardList aria-hidden className="h-3.5 w-3.5" />
              Ver todas as atividades
            </button>
          </>
        ) : (
          <ProfileEmpty>
            Nenhuma atividade com data confiável registrada para este K9.
          </ProfileEmpty>
        )}
      </ProfileCard>
    </div>
  );
}
