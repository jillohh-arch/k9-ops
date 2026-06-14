"use client";

import { profileRecordDate, profileText, type ProfileRecord } from "@/features/effective/hooks/use-k9-profile-data";

import { dateLabel, SectionCard, sessionTitle } from "./k9-profile-types";

export function K9ProfileTraining({
  sessions,
}: {
  sessions: ProfileRecord[];
}) {
  return (
    <SectionCard title="Treinos recentes">
      <div className="mt-4 grid gap-3">
        {sessions.slice(0, 6).map((session) => (
          <article
            className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 md:grid-cols-[9rem_1fr_auto]"
            key={`${session._source}:${session._id}`}
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                Data
              </p>
              <p className="mt-1 font-mono text-xs text-slate-300">
                {dateLabel(profileRecordDate(session))}
              </p>
            </div>
            <div>
              <p className="font-bold capitalize text-white">
                {sessionTitle(session)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {profileText(session, ["location", "local"]) ??
                  "Local não informado"}
              </p>
            </div>
            <div className="md:text-right">
              <p className="text-xs font-bold capitalize text-cyan-100">
                {profileText(session, ["result", "status", "phase"]) ??
                  "Registrado"}
              </p>
            </div>
          </article>
        ))}
        {!sessions.length ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center">
            <p className="text-sm text-slate-500">
              Nenhuma sessão de treinamento registrada para este K9.
            </p>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
