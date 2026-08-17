"use client";

import { CalendarClock, ExternalLink } from "lucide-react";
import Link from "next/link";

import {
  profileRecordDate,
  profileText,
  type ProfileRecord,
} from "@/features/effective/lib/k9-profile-records";
import type { K9RosterDetail } from "@/features/effective/hooks/use-k9-roster-detail";
import {
  humanizePhase,
  humanizeTrainingLabel,
  sessionTitle,
} from "@/features/effective/lib/k9-profile-activity";
import { specialtySituationLabel } from "@/features/effective/lib/k9-profile-status";
import { canônicalModalityLabel } from "@/features/effective/lib/k9-modalities";
import { paths } from "@/lib/routes/paths";

import {
  ProfileCard,
  ProfileEmpty,
  ProfileError,
  ProfilePill,
  ProfileSkeleton,
  ProfileStateRow,
} from "./k9-profile-ui";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export type K9ProfileTrainingProps = {
  detail: K9RosterDetail;
  dogId: string;
  error: string | null;
  loading: boolean;
  sessions: ProfileRecord[];
  specialties: ProfileRecord[];
};

/**
 * Aba Treinamento — resumo, não réplica do módulo.
 *
 * Não há matriz completa, promoção, relatório nem histórico detalhado aqui: a
 * autoridade é `/training/dogs/[dogId]`, que existe de verdade e recebe o
 * deep-link.
 */
export function K9ProfileTraining({
  detail,
  dogId,
  error,
  loading,
  sessions,
  specialties,
}: K9ProfileTrainingProps) {
  const recent = sessions.slice(0, 5);
  const deepLink = `${paths.trainingDog}/${encodeURIComponent(dogId)}`;

  return (
    <div className="space-y-4">
      {error ? (
        <ProfileError>Falha ao carregar dados de treinamento: {error}</ProfileError>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard title="Última sessão">
          {detail.loading ? (
            <ProfileSkeleton className="h-12" />
          ) : detail.lastTrainingSession ? (
            <>
              <ProfileStateRow
                // Mesma humanização do resumo: o token do Training nunca
                // chega cru à superfície.
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
        </ProfileCard>

        <ProfileCard title="Situação por especialidade">
          {loading && !specialties.length ? (
            <ProfileSkeleton className="h-20" />
          ) : specialties.length ? (
            <ul className="space-y-2.5">
              {specialties.map((specialty) => {
                const modality =
                  profileText(specialty, ["type", "modality", "name"]) ??
                  specialty._id;
                const situation = specialtySituationLabel(
                  profileText(specialty, ["status", "state"]),
                );
                // Módulo/fase atual é campo real do registro; quando ausente,
                // simplesmente não é afirmado.
                const phase = profileText(specialty, [
                  "currentModule",
                  "current_module",
                  "phase",
                  "level",
                ]);
                return (
                  <li
                    className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-2.5 last:border-0 last:pb-0"
                    key={specialty._id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-slate-100">
                        {canônicalModalityLabel(modality)}
                      </p>
                      {phase ? (
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          Módulo/fase: {humanizePhase(phase)}
                        </p>
                      ) : null}
                    </div>
                    <ProfilePill label={situation.label} tone={situation.tone} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <ProfileEmpty>Nenhuma especialidade registrada.</ProfileEmpty>
          )}
        </ProfileCard>
      </div>

      <ProfileCard title="Sessões recentes">
        {loading && !sessions.length ? (
          <ProfileSkeleton className="h-24" />
        ) : recent.length ? (
          <ul className="space-y-0">
            {recent.map((session, index) => {
              const date = profileRecordDate(session);
              return (
                <li
                  className={
                    index < recent.length - 1
                      ? "border-b border-white/[0.05] pb-2.5 pt-2.5 first:pt-0"
                      : "pt-2.5 first:pt-0"
                  }
                  key={`${session._source ?? "session"}:${session._id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold capitalize text-slate-100">
                        {sessionTitle(session)}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {profileText(session, ["location", "local"]) ??
                          "Local não informado"}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">
                      {date ? dateTimeFormatter.format(date) : "Sem data"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <ProfileEmpty>Nenhuma sessão registrada para este K9.</ProfileEmpty>
        )}

        <Link
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-2.5 text-xs font-bold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          href={deepLink}
        >
          <ExternalLink aria-hidden className="h-4 w-4" />
          Abrir treinamento completo
        </Link>
      </ProfileCard>
    </div>
  );
}
