"use client";

import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Dog,
  HeartPulse,
  History,
  Link2,
  Pencil,
  Star,
  Target,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useAccessControl } from "@/features/access/providers/access-control-provider";
import {
  DataState,
  EntityImage,
  StatusPill,
  SummaryCard,
} from "@/features/effective/components/effective-ui";
import { specialtyLabel } from "@/features/effective/data/binomial-admin-service";
import {
  binomialDate,
  binomialNumber,
  binomialRecordDate,
  binomialText,
  useBinomialProfileData,
  type BinomialRecord,
} from "@/features/effective/hooks/use-binomial-profile-data";
import { paths } from "@/lib/routes/paths";

function formatDate(date: Date | null, withTime = false) {
  if (!date) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function eventTitle(record: BinomialRecord) {
  if (record._source.startsWith("training_sessions")) {
    return binomialText(record, "trainingType", "modality", "type") ?? "Treino conjunto";
  }
  if (record._source.startsWith("occurrences")) {
    return binomialText(record, "type_name", "nature", "nature_name") ?? "Ocorrência";
  }
  if (record._source === "shift_logs") return "Turno operacional";
  return binomialText(record, "summary", "status") ?? "Evento do binômio";
}

function yearsLabel(date: Date | null) {
  if (!date) return "--";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days < 30) return `${days} dia(s)`;
  if (days < 365) return `${Math.floor(days / 30)} mes(es)`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return months ? `${years} ano(s), ${months} mes(es)` : `${years} ano(s)`;
}

export default function BinomialProfilePage() {
  const { can } = useAccessControl();
  const params = useParams<{ binomialId: string }>();
  const binomialId = decodeURIComponent(params.binomialId ?? "");
  const data = useBinomialProfileData(binomialId);

  if (data.loading || data.error || (!data.dog && !data.handler)) {
    return (
      <DataState
        error={data.error ?? (!data.loading ? "Binômio não localizado." : null)}
        loading={data.loading}
        noun="o perfil do binômio"
      />
    );
  }

  const dogName =
    binomialText(data.dog, "name", "nome") ??
    binomialText(data.binomial, "dog_name") ??
    "K9";
  const handlerName =
    binomialText(data.handler, "callsign", "callSign", "name") ??
    binomialText(data.binomial, "handler_name") ??
    data.handlerRa ??
    "Condutor";
  const dogPhoto =
    binomialText(data.dog, "profileImageUrl", "photoUrl") ??
    binomialText(data.binomial, "dog_photo_url");
  const handlerPhoto =
    binomialText(data.handler, "photoUrl", "image_url") ??
    binomialText(data.binomial, "handler_photo_url");
  const startAt = binomialDate(
    data.binomial?.start_at ?? data.binomial?.startAt,
  );
  const status = binomialText(data.binomial, "status") ?? "Vínculo ativo";
  const readiness = binomialNumber(
    data.binomial,
    "readiness_score",
    "readinessScore",
  );
  const synergy = binomialNumber(
    data.binomial,
    "synergy_score",
    "synergyScore",
  );
  const recentEvents = data.events.slice(0, 6);
  const canEditBinomial = can("binomials", "edit");

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
        <Link
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-300"
            href={paths.binomials}
          >
            <ArrowLeft className="h-4 w-4" />
            Binômios
          </Link>
          <h1 className="mt-3 text-3xl font-black text-white">
            Perfil do Binômio
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Vínculo operacional, atividades e histórico compartilhado.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canEditBinomial ? (
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-4 py-2.5 text-sm font-bold text-cyan-200"
              href={`/binomials/${encodeURIComponent(binomialId)}/edit`}
            >
              <Pencil className="h-4 w-4" /> Editar vínculo
            </Link>
          ) : null}
          <Link
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300"
            href={`/binomials/${encodeURIComponent(binomialId)}/history`}
          >
            <History className="h-4 w-4" /> Ver histórico
          </Link>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#0a172a]/90 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,0.14),transparent_42%),linear-gradient(90deg,transparent,rgba(59,130,246,0.08),transparent)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1fr_240px_1fr]">
          <div className="flex gap-4">
            <EntityImage
              alt={handlerName}
              className="h-40 w-36 shrink-0"
              fallback={UserRound}
              src={handlerPhoto}
            />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Condutor
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">{handlerName}</h2>
              <p className="mt-1 font-mono text-xs text-slate-500">
                RA {data.handlerRa ?? "--"}
              </p>
              <p className="mt-4 text-sm text-slate-400">
                {binomialText(data.handler, "accessLevel", "cargo", "rank") ?? "Operacional"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_36px_rgba(34,211,238,0.2)]">
              <Link2 className="h-11 w-11" />
            </span>
            <p className="mt-3 font-mono text-xs font-bold text-cyan-300">
              {binomialId}
            </p>
            <StatusPill label={status} tone="green" />
          </div>
          <div className="flex gap-4 xl:justify-end">
            <div className="text-left xl:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                K9
              </p>
              <h2 className="mt-2 text-2xl font-black text-cyan-200">{dogName}</h2>
              <p className="mt-1 font-mono text-xs text-slate-500">
                RGA {binomialText(data.dog, "registrationNumber", "matrícula", "rga") ?? "--"}
              </p>
              <p className="mt-4 text-sm text-slate-400">
                {binomialText(data.dog, "breed", "raça") ?? "Raça não informada"}
              </p>
            </div>
            <EntityImage
              alt={dogName}
              className="h-40 w-36 shrink-0"
              fallback={Dog}
              src={dogPhoto}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard
          detail={readiness == null ? "não informado" : "prontidão administrativa"}
          icon={Activity}
          label="Prontidão"
          tone="cyan"
          value={readiness == null ? "--" : `${readiness}%`}
        />
        <SummaryCard
          detail={synergy == null ? "não informado" : "avaliação do vínculo"}
          icon={HeartPulse}
          label="Sinergia"
          tone="green"
          value={synergy == null ? "--" : `${synergy}%`}
        />
        <SummaryCard
          detail="eventos compartilhados"
          icon={Target}
          label="Atividades"
          tone="blue"
          value={String(data.events.length)}
        />
        <SummaryCard
          detail={`desde ${formatDate(startAt)}`}
          icon={CalendarDays}
          label="Tempo de vínculo"
          tone="violet"
          value={yearsLabel(startAt)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
          <h2 className="text-sm font-black text-white">Resumo do vínculo</h2>
          <div className="mt-4 space-y-3 text-sm">
            {[
              ["Início", formatDate(startAt)],
              ["Tipo", binomialText(data.binomial, "type") ?? "Legado do K9"],
              ["Especialidade", specialtyLabel(binomialText(data.binomial, "primary_specialty", "primarySpecialty") ?? "")],
              ["Unidade", binomialText(data.binomial, "unit") ?? "--"],
              ["Equipe", binomialText(data.binomial, "team") ?? "--"],
            ].map(([label, value]) => (
              <div className="flex justify-between gap-4" key={label}>
                <span className="text-slate-500">{label}</span>
                <span className="text-right font-medium text-slate-200">{value}</span>
              </div>
            ))}
          </div>
          {binomialText(data.binomial, "notes") ? (
            <p className="mt-4 border-t border-white/8 pt-4 text-xs leading-5 text-slate-400">
              {binomialText(data.binomial, "notes")}
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
          <h2 className="text-sm font-black text-white">Capacidades combinadas</h2>
          <div className="mt-4 space-y-3">
            {[
              ["Treinos conjuntos", data.trainings.length, "blue"],
              ["Ocorrências", data.occurrences.length, "violet"],
              ["Turnos registrados", data.shifts.length, "cyan"],
            ].map(([label, value, tone]) => (
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3" key={String(label)}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-200">{label}</span>
                  <StatusPill label={String(value)} tone={tone as "blue"} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
          <h2 className="text-sm font-black text-white">Últimos eventos</h2>
          <div className="mt-4 space-y-3">
            {recentEvents.slice(0, 4).length ? (
              recentEvents.slice(0, 4).map((record) => (
                <div className="flex items-start gap-3" key={`${record._source}-${record._id}`}>
                  <Star className="mt-0.5 h-4 w-4 text-cyan-300" />
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      {eventTitle(record)}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">
                      {formatDate(binomialRecordDate(record), true)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Nenhum evento localizado.</p>
            )}
          </div>
        </section>
      </section>

      <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-black text-white">Linha do tempo recente</h2>
          <Link
            className="text-xs font-bold text-cyan-300"
            href={`/binomials/${encodeURIComponent(binomialId)}/history`}
          >
          Ver histórico completo
        </Link>
      </div>
        <div className="mt-4 grid gap-3">
          {recentEvents.length ? (
            recentEvents.map((record) => (
              <article
                className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 md:grid-cols-[9rem_1fr_auto]"
                key={`${record._source}-${record._id}`}
              >
                <p className="font-mono text-xs text-slate-400">
                  {formatDate(binomialRecordDate(record))}
                </p>
                <div>
                  <p className="font-bold text-white">{eventTitle(record)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {record._source.replaceAll("_", " ")}
                  </p>
                </div>
                <p className="text-sm text-slate-300 md:text-right">
                  {binomialText(record, "result", "status", "location") ??
                    "--"}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-500">Sem histórico compartilhado.</p>
          )}
        </div>
      </section>
    </div>
  );
}
