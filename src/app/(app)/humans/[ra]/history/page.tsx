"use client";

import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Dog,
  FileText,
  GraduationCap,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";

import {
  DataState,
  EntityImage,
  StatusPill,
  SummaryCard,
} from "@/features/effective/components/effective-ui";
import {
  humanRecordDate,
  humanText,
  useHumanProfileData,
} from "@/features/effective/hooks/use-human-profile-data";

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    auditLogs: "Administracao",
    certifications: "Certificacao",
    documents: "Documento",
    effective_movements: "Movimentacao",
    occurrences: "Ocorrencia",
    promotion_requests: "Avaliacao",
    shift_logs: "Turno",
    trainings: "Treino",
  };
  return labels[source] ?? source;
}

export default function HumanHistoryPage() {
  const params = useParams<{ ra: string }>();
  const ra = decodeURIComponent(params.ra ?? "");
  const data = useHumanProfileData(ra);
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const events = useMemo(() => {
    const needle = normalize(search);
    return data.events.filter((record) => {
      const matchesSource = source === "all" || record._source === source;
      const matchesSearch =
        !needle ||
        Object.values(record).some((value) => {
          if (typeof value !== "string" && typeof value !== "number") {
            return false;
          }
          return normalize(value).includes(needle);
        });
      return matchesSource && matchesSearch;
    });
  }, [data.events, search, source]);

  if (data.loading || data.error || !data.user) {
    return (
      <DataState
        error={data.error ?? (!data.loading ? "Agente nao localizado." : null)}
        loading={data.loading}
        noun="o historico humano"
      />
    );
  }

  const callsign =
    humanText(data.user, "callsign", "nomeCompleto", "name") ?? ra;
  const photo = humanText(data.user, "photoUrl", "image_url");
  const sourceOptions = Array.from(
    new Set(data.events.map((record) => record._source)),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Auditoria funcional
          </p>
          <h1 className="mt-1 text-3xl font-black text-white">
            Historico do agente
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Treinos, ocorrencias, turnos, documentos e alteracoes administrativas.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300"
          href={`/humans/${encodeURIComponent(ra)}`}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao perfil
        </Link>
      </div>

      <section className="flex flex-col gap-5 rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5 sm:flex-row sm:items-center">
        <EntityImage
          alt={callsign}
          className="h-28 w-28 shrink-0"
          fallback={UserRound}
          src={photo}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black text-white">{callsign}</h2>
            <StatusPill label={`RA ${ra}`} tone="blue" />
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {humanText(data.user, "cargo", "accessLevel") ?? "Funcao nao informada"}
            {" · "}
            {humanText(data.user, "unit") ?? "Lotacao nao informada"}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          detail="fontes agregadas"
          icon={CalendarDays}
          label="Eventos"
          tone="cyan"
          value={String(data.events.length)}
        />
        <SummaryCard
          detail="registros operacionais"
          icon={Activity}
          label="Treinos"
          tone="blue"
          value={String(data.trainings.length)}
        />
        <SummaryCard
          detail="participacoes localizadas"
          icon={ShieldCheck}
          label="Ocorrencias"
          tone="violet"
          value={String(data.occurrences.length)}
        />
        <SummaryCard
          detail="cursos e documentos"
          icon={GraduationCap}
          label="Registros"
          tone="green"
          value={String(data.certifications.length + data.documents.length)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-[#0b1628]/72 p-3 lg:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-11 pr-4 text-sm text-white outline-none"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar evento ou palavra-chave..."
            value={search}
          />
        </label>
        <select
          className="h-11 rounded-xl border border-white/10 bg-[#0b1628] px-4 text-sm text-slate-300"
          onChange={(event) => setSource(event.target.value)}
          value={source}
        >
          <option value="all">Todas as origens</option>
          {sourceOptions.map((item) => (
            <option key={item} value={item}>
              {sourceLabel(item)}
            </option>
          ))}
        </select>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
          <h2 className="text-sm font-black text-white">
            Linha do tempo de eventos
          </h2>
          <div className="mt-5 space-y-1">
            {events.length ? (
              events.map((record) => {
                const title =
                  humanText(
                    record,
                    "summary",
                    "trainingType",
                    "type_name",
                    "movement_type",
                    "name",
                    "action",
                    "status",
                  ) ?? "Evento registrado";
                const detail =
                  humanText(
                    record,
                    "dogName",
                    "location",
                    "reason",
                    "issuer",
                    "entityPath",
                  ) ?? "Registro preservado na fonte original.";
                return (
                  <article
                    className="relative grid gap-3 border-l border-cyan-300/20 pb-5 pl-7 last:pb-0 sm:grid-cols-[1fr_auto]"
                    key={`${record._source}-${record._id}`}
                  >
                    <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
                    <div>
                      <p className="text-sm font-bold text-slate-100">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {detail}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <StatusPill
                        label={sourceLabel(record._source)}
                        tone={
                          record._source === "occurrences"
                            ? "violet"
                            : record._source === "trainings"
                              ? "blue"
                              : record._source === "certifications"
                                ? "green"
                                : "slate"
                        }
                      />
                      <p className="mt-2 font-mono text-[11px] text-slate-500">
                        {humanRecordDate(record)
                          ? humanRecordDate(record)!.toLocaleString("pt-BR")
                          : "--"}
                      </p>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">
                Nenhum evento corresponde aos filtros.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
            <h2 className="text-sm font-black text-white">K9 vinculados</h2>
            <div className="mt-4 space-y-3">
              {data.linkedDogs.map((dog) => (
                <Link
                  className="flex items-center gap-3 rounded-xl border border-white/8 p-3"
                  href={`/k9/${encodeURIComponent(dog._id)}`}
                  key={dog._id}
                >
                  <Dog className="h-5 w-5 text-cyan-300" />
                  <div>
                    <p className="text-sm font-bold text-white">
                      {humanText(dog, "name", "nome") ?? dog._id}
                    </p>
                    <p className="text-xs text-slate-500">
                      {humanText(dog, "breed", "raca") ?? "Sem raca informada"}
                    </p>
                  </div>
                </Link>
              ))}
              {!data.linkedDogs.length ? (
                <p className="text-sm text-slate-500">Nenhum vinculo atual.</p>
              ) : null}
            </div>
          </section>
          <section className="rounded-3xl border border-cyan-200/12 bg-[#0b1628]/82 p-5">
            <h2 className="text-sm font-black text-white">
              Composicao do historico
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              {(
                [
                  { icon: Activity, label: "Treino", total: data.trainings.length },
                  {
                    icon: ShieldCheck,
                    label: "Ocorrencia",
                    total: data.occurrences.length,
                  },
                  {
                    icon: GraduationCap,
                    label: "Certificacao",
                    total: data.certifications.length,
                  },
                  {
                    icon: FileText,
                    label: "Documento",
                    total: data.documents.length,
                  },
                ] satisfies Array<{
                  icon: LucideIcon;
                  label: string;
                  total: number;
                }>
              ).map(({ icon: Icon, label, total }) => (
                <div
                  className="flex items-center justify-between"
                  key={label}
                >
                  <span className="flex items-center gap-2 text-slate-400">
                    <Icon className="h-4 w-4 text-cyan-300/70" />
                    {label}
                  </span>
                  <span className="font-mono font-black text-white">
                    {total}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
